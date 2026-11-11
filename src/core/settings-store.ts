/**
 * Holds the plugin-wide settings: the raw global settings as stored by Stream
 * Deck, and their normalized form the rest of the plugin reads.
 *
 * Pure data + validation — no I/O, so it is trivial to reason about and test.
 */
import { DEFAULTS, durationSeconds, normalizeColor, normalizePowerAction } from "./types";
import type { NormalizedSettings, ShutdownSettings } from "./types";

export class SettingsStore {
	private raw: ShutdownSettings = {};
	private settings: NormalizedSettings = { ...DEFAULTS };

	get current(): NormalizedSettings {
		return this.settings;
	}

	set(raw: ShutdownSettings): void {
		this.raw = raw;
		this.settings = SettingsStore.normalize(raw);
	}

	/** Flips armed and returns the raw settings to persist (slider value + unit can't be rebuilt from seconds). */
	toggleArmed(): ShutdownSettings {
		this.set({ ...this.raw, armed: !this.settings.armed });
		return this.raw;
	}

	/** Coerces partial/untrusted settings into a complete, valid set. */
	static normalize(raw?: ShutdownSettings): NormalizedSettings {
		return {
			countdownSeconds: durationSeconds(raw?.countdownValue, raw?.countdownUnit),
			accentColor: normalizeColor(raw?.accentColor ?? DEFAULTS.accentColor),
			armed: raw?.armed !== undefined ? !!raw.armed : DEFAULTS.armed,
			powerAction: normalizePowerAction(raw?.powerAction),
			forceClose: !!raw?.forceClose,
		};
	}
}
