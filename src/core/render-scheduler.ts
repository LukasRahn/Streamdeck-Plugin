/**
 * Runs at most one render at a time. A request that arrives mid-render collapses
 * into a single follow-up, so the render callback (which always reads the live
 * state) is guaranteed to finish on the newest state and frames can't overtake
 * each other.
 */
type RenderFn = () => Promise<void>;
type ErrorFn = (error: unknown) => void;

export class RenderScheduler {
	private rendering = false;
	private scheduled = false;

	constructor(
		private readonly render: RenderFn,
		private readonly onError: ErrorFn,
	) {}

	request(): void {
		if (this.rendering) {
			this.scheduled = true;
			return;
		}
		this.run();
	}

	private run(): void {
		this.rendering = true;
		this.scheduled = false;
		this.render()
			.catch((e) => this.onError(e))
			.finally(() => {
				this.rendering = false;
				if (this.scheduled) this.run();
			});
	}
}
