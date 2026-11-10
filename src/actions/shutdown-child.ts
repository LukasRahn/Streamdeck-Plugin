import { action, SingletonAction } from "@elgato/streamdeck";
import type { WillAppearEvent, WillDisappearEvent, DidReceiveSettingsEvent } from "@elgato/streamdeck";

import type { ShutdownSettings } from "../core/types";
import { shutdownController } from "../core/shutdown-controller";

@action({ UUID: "com.lukas.shutdown.child" })
export class ShutdownChildAction extends SingletonAction<ShutdownSettings> {
	override onWillAppear(ev: WillAppearEvent<ShutdownSettings>): void {
		shutdownController.register(ev, "child");
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent<ShutdownSettings>): void {
		shutdownController.handleSettings(ev, "child");
	}

	override onWillDisappear(ev: WillDisappearEvent<ShutdownSettings>): void {
		shutdownController.unregister(ev);
	}

	override onKeyDown(): void {
		shutdownController.handleKeyDown("child");
	}

	override onKeyUp(): void {
		shutdownController.handleKeyUp();
	}
}
