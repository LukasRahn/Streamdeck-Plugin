/**
 * Tile and canvas geometry.
 *
 * One SVG canvas spans every key in a device group; each key renders a viewBox
 * slice of it. This module turns Stream Deck key coordinates into that canvas.
 */
import type { KeyAction } from "@elgato/streamdeck";

/** Pixel size of a single key tile within the SVG canvas. */
export const TILE_SIZE = 144;

export type Tile = { action: KeyAction; col: number; row: number };

export type Layout = {
	minCol: number;
	minRow: number;
	widthPx: number;
	heightPx: number;
};

/** Maps key actions to tiles via their device coordinates, with a single-key fallback. */
export function prepareTiles(actions: KeyAction[]): Tile[] {
	const tiles: Tile[] = [];
	for (const a of actions) {
		const c = a.coordinates;
		if (c) tiles.push({ action: a, col: c.column, row: c.row });
	}
	if (tiles.length === 0 && actions.length > 0) {
		tiles.push({ action: actions[0]!, col: 0, row: 0 });
	}
	return tiles;
}

/** Bounding canvas spanning all tiles. */
export function buildLayout(tiles: Tile[]): Layout {
	const cols = tiles.map((t) => t.col);
	const rows = tiles.map((t) => t.row);
	const minCol = Math.min(...cols);
	const minRow = Math.min(...rows);
	return {
		minCol,
		minRow,
		widthPx: (Math.max(...cols) - minCol + 1) * TILE_SIZE,
		heightPx: (Math.max(...rows) - minRow + 1) * TILE_SIZE,
	};
}
