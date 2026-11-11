/**
 * Tracks the live keys participating in the countdown and groups them per device.
 *
 * One logical countdown can span many keys across one or more devices. This
 * registry is the single source of truth for "which keys are on screen right
 * now", so the controller never touches a raw Map.
 */
import type { KeyAction } from "@elgato/streamdeck";

export class KeyRegistry {
	private readonly keys = new Map<string, KeyAction>();

	add(action: KeyAction): void {
		this.keys.set(action.id, action);
	}

	remove(id: string): void {
		this.keys.delete(id);
	}

	get size(): number {
		return this.keys.size;
	}

	all(): KeyAction[] {
		return [...this.keys.values()];
	}

	/** Keys grouped by device — one canvas spans each group. */
	deviceGroups(): KeyAction[][] {
		const buckets = new Map<string, KeyAction[]>();
		for (const k of this.keys.values()) {
			const deviceId = k.device?.id ?? "unknown";
			const arr = buckets.get(deviceId);
			if (arr) arr.push(k);
			else buckets.set(deviceId, [k]);
		}
		return [...buckets.values()];
	}
}
