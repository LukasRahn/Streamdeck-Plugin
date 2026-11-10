import { action, SingletonAction } from "@elgato/streamdeck";
import type { WillAppearEvent, WillDisappearEvent, DidReceiveSettingsEvent } from "@elgato/streamdeck";

import type { ShutdownSettings } from "../core/types";
import { shutdownController } from "../core/shutdown-controller";

@action({ UUID: "com.lukas.shutdown.master" })
export class ShutdownMasterAction extends SingletonAction<ShutdownSettings> {
	override onWillAppear(ev: WillAppearEvent<ShutdownSettings>): void {
		shutdownController.register(ev, "master");
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent<ShutdownSettings>): void {
		shutdownController.handleSettings(ev, "master");
	}

	override onWillDisappear(ev: WillDisappearEvent<ShutdownSettings>): void {
		shutdownController.unregister(ev);
	}

	override onKeyDown(): void {
		shutdownController.handleKeyDown("master");
	}

	override onKeyUp(): void {
		shutdownController.handleKeyUp();
	}
}
