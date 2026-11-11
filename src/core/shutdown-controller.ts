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
 *
 * Settings are plugin-wide (Stream Deck global settings), so every key sees the
 * same configuration no matter which page or device the master is on.
 */
import streamDeck from "@elgato/streamdeck";
import type { KeyAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";

import { CountdownTimer } from "./countdown-timer";
import { KeyRegistry } from "./key-registry";
import { RenderScheduler } from "./render-scheduler";
import { SettingsStore } from "./settings-store";
import { SystemPower } from "./system-power";
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

/** Key-face text in the Stream Deck language (`<lang>.json` → "Localization"). */
const t = (key: string): string => streamDeck.i18n.t(key);

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
		streamDeck.settings.onDidReceiveGlobalSettings<ShutdownSettings>((ev) => this.applySettings(ev.settings));
	}

	/** Call once connected; the answer arrives through the global-settings listener. */
	loadSettings(): void {
		this.safeAsync(() => streamDeck.settings.getGlobalSettings());
	}

	// ── Lifecycle hooks (called by the action delegates) ───────────────────────

	register(ev: WillAppearEvent): void {
		const key = this.toKeyAction(ev.action);
		if (!key) return;

		this.registry.add(key);
		this.renderer.forget(key.id);
		key.setTitle("").catch((e) => this.log("setTitle failed", e));
		this.scheduler.request();
	}

	unregister(ev: WillDisappearEvent): void {
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

		const { powerAction, armed, forceClose } = this.settings.current;
		this.completingLabel = t(powerAction);
		this.scheduler.request();

		await this.delay(COMPLETE_FLASH_MS);
		if (this.state !== "completing") return;

		const ok = await this.power.perform(powerAction, armed, forceClose);
		this.state = "idle";
		this.scheduler.request();
		// Stream Deck's warning triangle: e.g. hibernate disabled or a macOS permission denied.
		if (!ok) for (const key of this.registry.all()) key.showAlert().catch((e) => this.log("showAlert failed", e));
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
		const next = this.settings.toggleArmed();
		this.safeAsync(() => streamDeck.settings.setGlobalSettings(next));
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
				return idleView(powerAction, countdownSeconds, color, armed ? t("armed") : t("preview"));
			}
			case "arming": {
				const targetArmed = !armed;
				const progress = (Date.now() - this.keyDownTime) / LONG_PRESS_MS;
				const sub = targetArmed ? t("arming") : t("disarming");
				return holdView(progress, t("hold"), sub, targetArmed ? COLOR_ARMED : COLOR_PREVIEW);
			}
			case "running": {
				const seconds = this.timer.remainingSeconds;
				const color = seconds <= FINAL_SECONDS ? COLOR_ARMED : accentColor;
				return countdownView(seconds, color, armed ? t("armed") : undefined, COLOR_ARMED);
			}
			case "completing":
				return this.completingLabel
					? messageView(this.completingLabel, COLOR_ARMED)
					: countdownView(0, COLOR_ARMED, armed ? t("armed") : undefined, COLOR_ARMED);
			case "cancelling":
				return messageView(t("cancelled"), COLOR_CANCEL);
		}
	}

	// ── Settings ─────────────────────────────────────────────────────────────────

	private applySettings(raw: ShutdownSettings): void {
		this.settings.set(raw);
		this.scheduler.request();
	}

	// ── Utilities ────────────────────────────────────────────────────────────────

	private toKeyAction(action: unknown): KeyAction | null {
		if (!action || typeof action !== "object") return null;
		const candidate = action as KeyAction & { setImage?: unknown };
		return typeof candidate.setImage === "function" ? (candidate as KeyAction) : null;
	}

	private safeAsync(fn: () => Promise<unknown>): void {
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
