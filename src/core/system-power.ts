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

// rundll32 can't pass SetSuspendState's arguments, so it may hibernate instead; call it properly.
const PS_SLEEP =
	"Add-Type -AssemblyName System.Windows.Forms; " +
	"if (-not [System.Windows.Forms.Application]::SetSuspendState('Suspend', $false, $false)) { exit 1 }";

// WM_SYSCOMMAND / SC_MONITORPOWER / 2 = off, broadcast. PostMessage can't hang on a frozen window.
const PS_MONITOR_OFF =
	"Add-Type -Namespace Win32 -Name User32 -MemberDefinition " +
	"'[DllImport(\"user32.dll\")] public static extern bool PostMessage(int hWnd, int msg, int wParam, int lParam);'; " +
	"if (-not [Win32.User32]::PostMessage(0xffff, 0x0112, 0xf170, 2)) { exit 1 }";

export class SystemPower {
	constructor(private readonly log: LogFn) {}

	/** Returns false when the command could not run, so the caller can tell the user. */
	async perform(action: PowerAction, armed: boolean, force: boolean): Promise<boolean> {
		if (!armed) {
			this.log(`${action} skipped — not armed`);
			return true;
		}

		switch (process.platform) {
			case "win32":
				return this.performWindows(action, force);
			case "darwin":
				return this.performMac(action);
			default:
				this.log(`${action} skipped — unsupported platform: ${process.platform}`);
				return false;
		}
	}

	private performWindows(action: PowerAction, force: boolean): Promise<boolean> {
		const shutdown = (args: string[]) => this.run("shutdown", force ? [...args, "/f"] : args, action);
		switch (action) {
			case "shutdown":
				return shutdown(["/s", "/t", "0"]);
			case "restart":
				return shutdown(["/r", "/t", "0"]);
			case "hibernate":
				return shutdown(["/h"]);
			case "logoff":
				return shutdown(["/l"]);
			case "sleep":
				return this.powershell(PS_SLEEP, action);
			case "monitor":
				return this.powershell(PS_MONITOR_OFF, action);
			case "lock":
				return this.run("rundll32.exe", ["user32.dll,LockWorkStation"], action);
		}
	}

	private performMac(action: PowerAction): Promise<boolean> {
		const osa = (script: string) => this.run("osascript", ["-e", script], action);
		switch (action) {
			case "shutdown":
				return osa('tell application "System Events" to shut down');
			case "restart":
				return osa('tell application "System Events" to restart');
			case "sleep":
			case "hibernate": // macOS decides itself when to hibernate
				return this.run("pmset", ["sleepnow"], action);
			case "logoff":
				return osa('tell application "System Events" to log out');
			case "lock": // the system "Lock Screen" shortcut; needs the Accessibility permission
				return osa('tell application "System Events" to keystroke "q" using {control down, command down}');
			case "monitor":
				return this.run("pmset", ["displaysleepnow"], action);
		}
	}

	/** -EncodedCommand sidesteps every quoting rule between Node, Windows and PowerShell. */
	private powershell(script: string, label: string): Promise<boolean> {
		const encoded = Buffer.from(script, "utf16le").toString("base64");
		return this.run("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded], label);
	}

	private async run(command: string, args: string[], label: string): Promise<boolean> {
		try {
			await execFileAsync(command, args);
			this.log(`${label} — executed`);
			return true;
		} catch (error) {
			this.log(`${label} — failed`, error);
			return false;
		}
	}
}
