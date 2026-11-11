import assert from "node:assert/strict";
import { test } from "node:test";

import { SettingsStore } from "../src/core/settings-store";
import { DEFAULTS, MAX_SECONDS, MIN_SECONDS, durationSeconds } from "../src/core/types";
import { formatClock } from "../src/render/svg";

test("durationSeconds multiplies the slider value by its unit", () => {
	assert.equal(durationSeconds(45, "s"), 45);
	assert.equal(durationSeconds(5, "m"), 300);
	assert.equal(durationSeconds(2, "h"), 7200);
	assert.equal(durationSeconds(undefined, "m"), 600); // slider untouched, unit changed: PI shows 10
	assert.equal(durationSeconds(), DEFAULTS.countdownSeconds);
});

test("durationSeconds treats unknown units as seconds and garbage as the default", () => {
	assert.equal(durationSeconds(30, "constructor"), 30);
	assert.equal(durationSeconds("abc", "m"), DEFAULTS.countdownSeconds);
});

test("durationSeconds clamps to the allowed range", () => {
	assert.equal(durationSeconds(1, "s"), MIN_SECONDS);
	assert.equal(durationSeconds(60, "h"), MAX_SECONDS);
	assert.equal(durationSeconds(99, "h"), MAX_SECONDS);
});

test("formatClock switches format with magnitude", () => {
	assert.equal(formatClock(0), "0");
	assert.equal(formatClock(45), "45");
	assert.equal(formatClock(60), "1:00");
	assert.equal(formatClock(754), "12:34");
	assert.equal(formatClock(5025), "1:23:45");
	assert.equal(formatClock(MAX_SECONDS), "60:00:00");
});

test("normalize fills defaults and rejects invalid values", () => {
	assert.deepEqual(SettingsStore.normalize(undefined), DEFAULTS);
	const n = SettingsStore.normalize({ countdownValue: 2, countdownUnit: "m", accentColor: "red", powerAction: "nuke" as never, forceClose: true });
	assert.equal(n.countdownSeconds, 120);
	assert.equal(n.accentColor, DEFAULTS.accentColor);
	assert.equal(n.powerAction, DEFAULTS.powerAction);
	assert.equal(n.forceClose, true);
});

test("toggleArmed keeps the raw slider value and unit for the property inspector", () => {
	const store = new SettingsStore();
	store.set({ countdownValue: 5, countdownUnit: "m", powerAction: "lock" });
	assert.deepEqual(store.toggleArmed(), { countdownValue: 5, countdownUnit: "m", powerAction: "lock", armed: true });
	assert.equal(store.current.armed, true);
	assert.equal(store.toggleArmed().armed, false);
});
