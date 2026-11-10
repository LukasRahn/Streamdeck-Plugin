/**
 * Cross-platform power commands (Windows + macOS).
 *
 * `perform` is the single safety gate between the countdown reaching zero and
 * the machine actually powering off: when not armed, nothing executes.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { PowerAction } from "./types";

const execFileAsync = promisify(execFile);

type LogFn = (message: string, error?: unknown) => void;

export class SystemPower {
	constructor(private readonly log: LogFn) {}

	async perform(action: PowerAction, armed: boolean): Promise<void> {
		if (!armed) {
			this.log(`${action} skipped — not armed`);
			return;
		}

		switch (process.platform) {
			case "win32":
				await this.performWindows(action);
				break;
			case "darwin":
				await this.performMac(action);
				break;
			default:
				this.log(`${action} skipped — unsupported platform: ${process.platform}`);
		}
	}

	private async performWindows(action: PowerAction): Promise<void> {
		switch (action) {
			case "shutdown":
				return this.run("shutdown", ["/s", "/t", "0"], "shutdown");
			case "restart":
				return this.run("shutdown", ["/r", "/t", "0"], "restart");
			case "sleep":
				return this.run("rundll32.exe", ["powrprof.dll,SetSuspendState", "0,1,0"], "sleep");
			case "hibernate":
				return this.run("shutdown", ["/h"], "hibernate");
			case "logoff":
				return this.run("shutdown", ["/l"], "log off");
		}
	}

	private async performMac(action: PowerAction): Promise<void> {
		const osa = (script: string, label: string) => this.run("osascript", ["-e", script], label);
		switch (action) {
			case "shutdown":
				return osa('tell application "System Events" to shut down', "shutdown");
			case "restart":
				return osa('tell application "System Events" to restart', "restart");
			case "sleep":
				return this.run("pmset", ["sleepnow"], "sleep");
			case "hibernate":
				return this.run("pmset", ["sleepnow"], "hibernate (via sleep)");
			case "logoff":
				return osa('tell application "System Events" to log out', "log off");
		}
	}

	private async run(command: string, args: string[], label: string): Promise<void> {
		try {
			await execFileAsync(command, args);
			this.log(`${label} — executed`);
		} catch (error) {
			this.log(`${label} — failed`, error);
		}
	}
}
