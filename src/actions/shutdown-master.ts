import { action, SingletonAction } from "@elgato/streamdeck";
import type { WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";

import { shutdownController } from "../core/shutdown-controller";

@action({ UUID: "com.lukas.shutdown.master" })
export class ShutdownMasterAction extends SingletonAction {
	override onWillAppear(ev: WillAppearEvent): void {
		shutdownController.register(ev);
	}

	override onWillDisappear(ev: WillDisappearEvent): void {
		shutdownController.unregister(ev);
	}

	override onKeyDown(): void {
		shutdownController.handleKeyDown("master");
	}

	override onKeyUp(): void {
		shutdownController.handleKeyUp();
	}
}
