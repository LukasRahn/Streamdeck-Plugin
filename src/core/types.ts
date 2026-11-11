export const POWER_ACTIONS = ["shutdown", "restart", "sleep", "hibernate", "logoff", "lock", "monitor"] as const;

export type PowerAction = (typeof POWER_ACTIONS)[number];

/** Raw plugin-wide (global) settings as the property inspector stores them. */
export type ShutdownSettings = {
	/** Slider value 1–60, in `countdownUnit`. */
	countdownValue?: number;
	countdownUnit?: "s" | "m" | "h";
	accentColor?: string;
	armed?: boolean;
	powerAction?: PowerAction;
	/** Windows only: close apps without asking (unsaved work is lost). */
	forceClose?: boolean;
};

export type NormalizedSettings = {
	countdownSeconds: number;
	accentColor: string;
	armed: boolean;
	powerAction: PowerAction;
	forceClose: boolean;
};

export type Role = "master" | "child";

export const DEFAULTS: NormalizedSettings = {
	countdownSeconds: 10,
	accentColor: "#00d37f",
	armed: false,
	powerAction: "shutdown",
	forceClose: false,
};

export const MIN_SECONDS = 3;
export const MAX_SECONDS = 60 * 60 * 60; // slider max: 60 h

export function clampSeconds(seconds: number): number {
	const safe = Number.isFinite(seconds) ? seconds : DEFAULTS.countdownSeconds;
	return Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, Math.round(safe)));
}

/** Slider value × unit, clamped. The value default matches the PI slider's `default="10"`. */
export function durationSeconds(value: unknown = 10, unit?: unknown): number {
	const factor = unit === "h" ? 3600 : unit === "m" ? 60 : 1;
	return clampSeconds(Number(value) * factor);
}

export function normalizeColor(color: string): string {
	if (!color) return DEFAULTS.accentColor;
	const hex = color.startsWith("#") ? color.slice(1) : color;
	return /^[0-9a-fA-F]{6}$/.test(hex) ? `#${hex}`.toLowerCase() : DEFAULTS.accentColor;
}

export function normalizePowerAction(action?: string): PowerAction {
	return POWER_ACTIONS.includes(action as PowerAction) ? (action as PowerAction) : DEFAULTS.powerAction;
}
