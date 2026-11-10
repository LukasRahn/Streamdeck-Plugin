type SecondCallback = () => void;
type CompleteCallback = () => void;

/** How often the clock is checked. Cheap: callbacks only fire on a change. */
const TICK_MS = 50;

/** Wall-clock countdown, so slow callbacks can never make it drift. */
export class CountdownTimer {
	private interval?: NodeJS.Timeout;
	private endTime = 0;
	private lastSecond = -1;

	/** Whole seconds left (rounded up). */
	get remainingSeconds(): number {
		return Math.max(0, Math.ceil((this.endTime - Date.now()) / 1000));
	}

	/** Returns false if already running. `onSecond` fires immediately, then on every new second. */
	start(seconds: number, onSecond: SecondCallback, onComplete: CompleteCallback): boolean {
		if (this.interval) return false;

		this.endTime = Date.now() + seconds * 1000;
		this.lastSecond = -1;

		const tick = (): void => {
			if (Date.now() >= this.endTime) {
				this.cancel();
				onComplete();
				return;
			}
			if (this.remainingSeconds !== this.lastSecond) {
				this.lastSecond = this.remainingSeconds;
				onSecond();
			}
		};

		this.interval = setInterval(tick, TICK_MS);
		tick();
		return true;
	}

	cancel(): void {
		clearInterval(this.interval);
		this.interval = undefined;
	}
}
