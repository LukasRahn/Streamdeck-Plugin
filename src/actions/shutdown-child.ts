import { action, SingletonAction } from "@elgato/streamdeck";
import type { WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";

import { shutdownController } from "../core/shutdown-controller";

@action({ UUID: "com.lukas.shutdown.child" })
export class ShutdownChildAction extends SingletonAction {
	override onWillAppear(ev: WillAppearEvent): void {
		shutdownController.register(ev);
	}

	override onWillDisappear(ev: WillDisappearEvent): void {
		shutdownController.unregister(ev);
	}

	override onKeyDown(): void {
		shutdownController.handleKeyDown("child");
	}

	override onKeyUp(): void {
		shutdownController.handleKeyUp();
	}
}
