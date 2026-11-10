/**
 * Orchestrates the countdown as a small state machine.
 *
 *   idle ──short press──▶ running ──reaches 0──▶ completing ──▶ power action ──▶ idle
 *     ▲                      │                       │
 *     └──── cancelling ◀─────┴──────press───────────┘
 *
 * The display is purely derived from state: every change just requests a render,
 * and `renderCurrent` draws whatever is true at that moment. Nothing can paint a
 * stale frame over a newer state.
 */
import streamDeck from "@elgato/streamdeck";
import type {
	KeyAction,
	WillAppearEvent,
	WillDisappearEvent,
	DidReceiveSettingsEvent,
} from "@elgato/streamdeck";

import { CountdownTimer } from "./countdown-timer";
import { KeyRegistry } from "./key-registry";
import { RenderScheduler } from "./render-scheduler";
import { SettingsStore } from "./settings-store";
import { SystemPower } from "./system-power";
import { POWER_LABELS } from "./types";
import type { Role, ShutdownSettings } from "./types";
import { DisplayRenderer } from "../render/renderer";
import { countdownView, holdView, idleView, messageView, type View } from "../render/svg";

type ControllerState = "idle" | "arming" | "running" | "cancelling" | "completing";

const LONG_PRESS_MS = 800; // hold the master this long to toggle armed
const HOLD_TICK_MS = 50;
const HOLD_VISIBLE_AFTER_MS = 150; // a normal short press never shows "HOLD"
const CANCEL_DISPLAY_MS = 800; // how long "Cancelled" stays up
const COMPLETE_HOLD_MS = 300; // hold "0" before the action name
const COMPLETE_FLASH_MS = 800; // action name before executing (still cancellable)
const FINAL_SECONDS = 3; // the number turns red for these

const COLOR_ARMED = "#ff3b30";
const COLOR_PREVIEW = "#3fa3ff";
const COLOR_CANCEL = "#ffb02e";

export class ShutdownController {
	private readonly registry = new KeyRegistry();
	private readonly settings = new SettingsStore();
	private readonly timer = new CountdownTimer();
	private readonly renderer = new DisplayRenderer();
	private readonly power: SystemPower;
	private readonly scheduler: RenderScheduler;

	private state: ControllerState = "idle";
	private completingLabel: string | null = null;

	private keyDownTime = 0;
	private keyDownState: ControllerState = "idle";
	private holdInterval?: NodeJS.Timeout;
	private armTriggered = false;

	constructor() {
		this.power = new SystemPower((msg, err) => this.log(msg, err));
		this.scheduler = new RenderScheduler(
			() => this.renderCurrent(),
			(e) => this.log("Render failed", e),
		);
	}

	// ── Lifecycle hooks (called by the action delegates) ───────────────────────

	register(ev: WillAppearEvent<ShutdownSettings>, role: Role): void {
		const key = this.toKeyAction(ev.action);
		if (!key) return;

		this.registry.add(key, role);
		this.renderer.forget(key.id);
		key.setTitle("").catch((e) => this.log("setTitle failed", e));

		if (role === "master") this.applyMasterSettings(ev.payload.settings);
		else this.mirrorToChild(key);

		this.scheduler.request();
	}

	unregister(ev: WillDisappearEvent<ShutdownSettings>): void {
		const key = this.toKeyAction(ev.action);
		if (!key) return;

		this.registry.remove(key.id);
		this.renderer.forget(key.id);

		if (this.registry.size === 0) {
			this.endHold();
			this.timer.cancel();
			this.state = "idle"; // nobody can see or cancel it any more, so nothing may fire
			return;
		}
		this.scheduler.request();
	}

	handleSettings(ev: DidReceiveSettingsEvent<ShutdownSettings>, role: Role): void {
		const key = this.toKeyAction(ev.action);
		if (!key) return;

		if (role === "master") this.applyMasterSettings(ev.payload.settings);
		else this.mirrorToChild(key);

		this.scheduler.request();
	}

	handleKeyDown(role: Role): void {
		this.keyDownTime = Date.now();
		this.keyDownState = this.state;

		if (this.state === "running" || this.state === "completing") {
			this.cancelCountdown();
			return;
		}

		if (role === "master" && this.state === "idle") this.beginHold();
	}

	handleKeyUp(): void {
		// A hold that reached the threshold already fired — swallow the release.
		if (this.armTriggered) {
			this.armTriggered = false;
			return;
		}

		if (this.state === "arming") {
			this.endHold();
			this.state = "idle";
			this.startCountdown();
			return;
		}

		// Child press that began and ended in idle.
		if (this.keyDownState === "idle" && this.state === "idle") this.startCountdown();
	}

	// ── State transitions ──────────────────────────────────────────────────────

	private startCountdown(): void {
		if (this.registry.size === 0) return;

		this.state = "running"; // before start(), whose first tick renders immediately
		const started = this.timer.start(
			this.settings.current.countdownSeconds,
			() => this.scheduler.request(),
			() => this.safeAsync(() => this.completeCountdown()),
		);
		if (!started) this.state = "idle";
	}

	private cancelCountdown(): void {
		this.timer.cancel();
		this.state = "cancelling";
		this.scheduler.request();

		setTimeout(() => {
			if (this.state !== "cancelling") return;
			this.state = "idle";
			this.scheduler.request();
		}, CANCEL_DISPLAY_MS);
	}

	private async completeCountdown(): Promise<void> {
		// Flip state synchronously: a press from here on must be able to cancel.
		this.state = "completing";
		this.completingLabel = null;
		this.scheduler.request();

		await this.delay(COMPLETE_HOLD_MS);
		if (this.state !== "completing") return;

		const { powerAction, armed } = this.settings.current;
		this.completingLabel = POWER_LABELS[powerAction];
		this.scheduler.request();

		await this.delay(COMPLETE_FLASH_MS);
		if (this.state !== "completing") return;

		await this.power.perform(powerAction, armed);
		this.state = "idle";
		this.scheduler.request();
	}

	private beginHold(): void {
		this.state = "arming";
		this.armTriggered = false;

		this.holdInterval = setInterval(() => {
			const elapsed = Date.now() - this.keyDownTime;
			if (elapsed >= LONG_PRESS_MS) {
				this.armTriggered = true;
				this.endHold();
				this.toggleArmed();
			} else if (elapsed >= HOLD_VISIBLE_AFTER_MS) {
				this.scheduler.request();
			}
		}, HOLD_TICK_MS);
	}

	private endHold(): void {
		clearInterval(this.holdInterval);
		this.holdInterval = undefined;
	}

	private toggleArmed(): void {
		this.state = "idle";
		this.settings.toggleArmed();
		this.safeAsync(() => this.propagate());
		this.scheduler.request();
	}

	// ── Rendering ────────────────────────────────────────────────────────────────

	private async renderCurrent(): Promise<void> {
		const view = this.currentView();
		await Promise.all(this.registry.deviceGroups().map((keys) => this.renderer.render(keys, view)));
	}

	private currentView(): View {
		const { armed, powerAction, accentColor, countdownSeconds } = this.settings.current;

		switch (this.state) {
			case "idle": {
				const color = armed ? COLOR_ARMED : COLOR_PREVIEW;
				return idleView(powerAction, countdownSeconds, color, armed ? "ARMED" : "PREVIEW");
			}
			case "arming": {
				const targetArmed = !armed;
				const progress = (Date.now() - this.keyDownTime) / LONG_PRESS_MS;
				return holdView(progress, targetArmed, targetArmed ? COLOR_ARMED : COLOR_PREVIEW);
			}
			case "running": {
				const seconds = this.timer.remainingSeconds;
				const color = seconds <= FINAL_SECONDS ? COLOR_ARMED : accentColor;
				return countdownView(seconds, color, armed ? "ARMED" : undefined, COLOR_ARMED);
			}
			case "completing":
				return this.completingLabel
					? messageView(this.completingLabel, COLOR_ARMED)
					: countdownView(0, COLOR_ARMED, armed ? "ARMED" : undefined, COLOR_ARMED);
			case "cancelling":
				return messageView("Cancelled", COLOR_CANCEL);
		}
	}

	// ── Settings propagation ───────────────────────────────────────────────────

	private applyMasterSettings(raw?: ShutdownSettings): void {
		this.settings.set(this.settings.normalize(raw));
		this.safeAsync(() => this.propagate());
	}

	private mirrorToChild(key: KeyAction): void {
		key.setSettings(this.settings.current).catch((e) => this.log("setSettings failed", e));
	}

	private async propagate(): Promise<void> {
		const master = this.registry.master;
		if (master) await master.action.setSettings(this.settings.current);
		await Promise.all(this.registry.children().map((c) => c.action.setSettings(this.settings.current)));
	}

	// ── Utilities ────────────────────────────────────────────────────────────────

	private toKeyAction(action: unknown): KeyAction | null {
		if (!action || typeof action !== "object") return null;
		const candidate = action as KeyAction & { setImage?: unknown };
		return typeof candidate.setImage === "function" ? (candidate as KeyAction) : null;
	}

	private safeAsync(fn: () => Promise<void>): void {
		fn().catch((e) => this.log("Async operation failed", e));
	}

	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	private log(message: string, error?: unknown): void {
		if (error instanceof Error) {
			streamDeck.logger.warn(message, { error: error.message, stack: error.stack });
		} else {
			streamDeck.logger.info(message);
		}
	}
}

export const shutdownController = new ShutdownController();
