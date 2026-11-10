/**
 * Tracks the live keys participating in the countdown and groups them per device.
 *
 * One logical countdown can span many keys across one or more devices. This
 * registry is the single source of truth for "which keys are on screen right
 * now", so the controller never touches a raw Map.
 */
import type { KeyAction } from "@elgato/streamdeck";

import type { Role } from "./types";

export type RegisteredKey = {
	id: string;
	action: KeyAction;
	role: Role;
	deviceId: string;
};

export class KeyRegistry {
	private readonly keys = new Map<string, RegisteredKey>();
	private masterId: string | null = null;

	add(action: KeyAction, role: Role): void {
		const deviceId = action.device?.id ?? "unknown";
		this.keys.set(action.id, { id: action.id, action, role, deviceId });
		if (role === "master") this.masterId = action.id;
	}

	remove(id: string): void {
		this.keys.delete(id);
		if (this.masterId === id) this.masterId = null;
	}

	get size(): number {
		return this.keys.size;
	}

	get master(): RegisteredKey | undefined {
		return this.masterId ? this.keys.get(this.masterId) : undefined;
	}

	children(): RegisteredKey[] {
		return [...this.keys.values()].filter((k) => k.role === "child");
	}

	/** Keys grouped by device — one canvas spans each group. */
	deviceGroups(): KeyAction[][] {
		const buckets = new Map<string, KeyAction[]>();
		for (const k of this.keys.values()) {
			const arr = buckets.get(k.deviceId);
			if (arr) arr.push(k.action);
			else buckets.set(k.deviceId, [k.action]);
		}
		return [...buckets.values()];
	}
}
