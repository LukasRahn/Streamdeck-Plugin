/**
 * Draws one canvas per device, cuts it into key-sized tiles, and sends only the
 * tiles whose pixels actually changed. Sending is the expensive part of the
 * whole plugin (Stream Deck app + USB), so an unchanged key costs nothing.
 */
import type { KeyAction } from "@elgato/streamdeck";

import { buildLayout, prepareTiles, TILE_SIZE, type Layout, type Tile } from "./layout";
import { encodePng } from "./png";
import { rasterize, type Bitmap } from "./rasterizer";
import type { View } from "./svg";

export class DisplayRenderer {
	/** Last pixels pushed to each key. */
	private readonly shown = new Map<string, Buffer>();

	async render(keys: KeyAction[], view: View): Promise<void> {
		const tiles = prepareTiles(keys);
		if (tiles.length === 0) return;

		const layout = buildLayout(tiles);
		const bitmap = await rasterize(this.toSvg(layout, view));

		await Promise.all(tiles.map((tile) => this.pushTile(tile, layout, bitmap)));
	}

	/** Call when a key (re)appears or goes away: its face is no longer what we last sent. */
	forget(keyId: string): void {
		this.shown.delete(keyId);
	}

	private toSvg(layout: Layout, view: View): string {
		const { widthPx: w, heightPx: h } = layout;
		return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#000"/>${view(layout)}</svg>`;
	}

	private async pushTile(tile: Tile, layout: Layout, bitmap: Bitmap): Promise<void> {
		const pixels = this.crop(bitmap, (tile.col - layout.minCol) * TILE_SIZE, (tile.row - layout.minRow) * TILE_SIZE);
		const id = tile.action.id;

		if (this.shown.get(id)?.equals(pixels)) return;

		this.shown.set(id, pixels);
		try {
			await tile.action.setImage(`data:image/png;base64,${encodePng(pixels, TILE_SIZE).toString("base64")}`);
		} catch (error) {
			this.shown.delete(id); // unknown what the key shows now: resend next time
			throw error;
		}
	}

	private crop(bitmap: Bitmap, x: number, y: number): Buffer {
		const stride = TILE_SIZE * 4;
		const out = Buffer.alloc(stride * TILE_SIZE);
		const source = Buffer.from(bitmap.pixels.buffer, bitmap.pixels.byteOffset, bitmap.pixels.byteLength);
		for (let row = 0; row < TILE_SIZE; row++) {
			const start = ((y + row) * bitmap.width + x) * 4;
			source.copy(out, row * stride, start, start + stride);
		}
		return out;
	}
}
