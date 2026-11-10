/**
 * Turns an SVG into raw RGBA pixels inside the plugin, so the Stream Deck app
 * only ever receives finished bitmaps. Uses the WASM build of resvg: one file
 * for every platform, no native module to package.
 */
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export type Bitmap = { width: number; pixels: Uint8Array };

type Font = { family: string; data: Uint8Array };

const FONT_CANDIDATES: { family: string; file: string }[] = [
	{ family: "Segoe UI", file: "C:\\Windows\\Fonts\\segoeuib.ttf" },
	{ family: "Arial", file: "C:\\Windows\\Fonts\\arialbd.ttf" },
	{ family: "Arial", file: "/System/Library/Fonts/Supplemental/Arial Bold.ttf" },
];

async function loadFont(): Promise<Font> {
	for (const { family, file } of FONT_CANDIDATES) {
		try {
			return { family, data: await readFile(file) };
		} catch {
			// Not on this system, try the next one.
		}
	}
	throw new Error("No usable system font found");
}

async function loadEngine(): Promise<Font> {
	const [font, wasm] = await Promise.all([loadFont(), readFile(fileURLToPath(new URL("./resvg.wasm", import.meta.url)))]);
	await initWasm(wasm);
	return font;
}

// initWasm may only ever run once per process, so this is shared and lazy.
let engine: Promise<Font> | undefined;

export async function rasterize(svg: string): Promise<Bitmap> {
	const font = await (engine ??= loadEngine());

	const resvg = new Resvg(svg, {
		font: { fontBuffers: [font.data], defaultFontFamily: font.family, loadSystemFonts: false },
	});
	try {
		const image = resvg.render();
		try {
			return { width: image.width, pixels: image.pixels.slice() };
		} finally {
			image.free();
		}
	} finally {
		resvg.free();
	}
}
