/**
 * Holds the shared, normalized settings and knows how to sanitize raw input.
 *
 * Pure data + validation — no I/O. The controller owns propagation to keys
 * (which is async Stream Deck I/O); keeping it out of here makes the store
 * trivial to reason about and test.
 */
import { DEFAULTS, clampSeconds, normalizeColor, normalizePowerAction } from "./types";
import type { NormalizedSettings, ShutdownSettings } from "./types";

export class SettingsStore {
	private settings: NormalizedSettings = { ...DEFAULTS };

	get current(): NormalizedSettings {
		return this.settings;
	}

	set(next: NormalizedSettings): void {
		this.settings = next;
	}

	/** Coerces partial/untrusted settings into a complete, valid set. */
	normalize(raw?: ShutdownSettings): NormalizedSettings {
		return {
			countdownSeconds: clampSeconds(raw?.countdownSeconds ?? DEFAULTS.countdownSeconds),
			accentColor: normalizeColor(raw?.accentColor ?? DEFAULTS.accentColor),
			armed: raw?.armed !== undefined ? !!raw.armed : DEFAULTS.armed,
			powerAction: normalizePowerAction(raw?.powerAction),
		};
	}

	toggleArmed(): NormalizedSettings {
		this.settings = { ...this.settings, armed: !this.settings.armed };
		return this.settings;
	}
}
