/**
 * The key faces, as pure functions returning SVG markup for one canvas.
 *
 * Deliberately plain: no animation, so a face only changes when the information
 * on it changes.
 */
import { TILE_SIZE, type Layout } from "./layout";
import type { PowerAction } from "../core/types";

export type View = (layout: Layout) => string;

const TS = TILE_SIZE;
const WHITE_DIM = "rgba(255,255,255,0.3)";

/** Digit/cap height sits at ~0.72em, so this offset centers text on its y. */
const BASELINE_SHIFT = 0.36;

function n(v: number): number {
	return Math.round(v * 10) / 10;
}

function escapeXml(v: string): string {
	return v.replace(/[<>&"]/g, (c) => (c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : "&quot;"));
}

function text(value: string, x: number, y: number, size: number, color: string, spacing = 0): string {
	const ls = spacing ? ` letter-spacing="${spacing}"` : "";
	return (
		`<text x="${n(x)}" y="${n(y + size * BASELINE_SHIFT)}" fill="${color}" font-size="${n(size)}" ` +
		`font-weight="700" text-anchor="middle"${ls}>${escapeXml(value)}</text>`
	);
}

function subtitle(value: string | undefined, l: Layout, color: string): string {
	return value ? text(value, l.widthPx / 2, l.heightPx - TS * 0.13, TS * 0.1, color, 3) : "";
}

function centeredText(value: string, l: Layout, color: string, widthShare: number, maxHeightShare: number): string {
	const size = Math.min((l.widthPx * widthShare) / Math.max(1, value.length * 0.62), l.heightPx * maxHeightShare);
	return text(value, l.widthPx / 2, l.heightPx / 2, size, color);
}

/** 45 → "45", 754 → "12:34", 5025 → "1:23:45". */
export function formatClock(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = seconds % 60;
	const pad = (v: number) => String(v).padStart(2, "0");
	if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
	return m > 0 ? `${m}:${pad(s)}` : String(s);
}

export function countdownView(seconds: number, color: string, sub?: string, subColor = WHITE_DIM): View {
	return (l) => centeredText(formatClock(seconds), l, color, 0.84, 0.66) + subtitle(sub, l, subColor);
}

export function messageView(message: string, color: string): View {
	return (l) => centeredText(message, l, color, 0.8, 0.38);
}

/** Resting face: what the key will do, and after how long. */
export function idleView(action: PowerAction, seconds: number, color: string, sub: string): View {
	return (l) => {
		const size = Math.min(l.widthPx, l.heightPx) * 0.42;
		return (
			powerGlyph(action, l.widthPx / 2, l.heightPx * 0.4, size, color) +
			text(seconds < 60 ? `${seconds}s` : formatClock(seconds), l.widthPx / 2, l.heightPx * 0.72, Math.min(l.widthPx, l.heightPx) * 0.14, color) +
			subtitle(sub, l, color)
		);
	};
}

/** Hold-to-arm feedback: a bar that fills while held, inset because key edges are hidden on the device. */
export function holdView(progress: number, label: string, sub: string, color: string): View {
	const p = Math.max(0, Math.min(1, progress));
	const inset = TS * 0.14;
	return (l) =>
		centeredText(label, l, color, 0.8, 0.38) +
		subtitle(sub, l, color) +
		`<rect x="${n(inset)}" y="${l.heightPx - TS * 0.26}" width="${n((l.widthPx - inset * 2) * p)}" height="8" rx="4" fill="${color}"/>`;
}

function powerGlyph(action: PowerAction, cx: number, cy: number, size: number, color: string): string {
	const wrap = (paths: string) =>
		`<g transform="translate(${n(cx)} ${n(cy)}) scale(${n(size)})" fill="none" stroke="${color}" ` +
		`stroke-width="0.1" stroke-linecap="round" stroke-linejoin="round">${paths}</g>`;

	switch (action) {
		case "shutdown":
			return wrap(`<path d="M -0.23 -0.33 A 0.4 0.4 0 1 0 0.23 -0.33"/><line x1="0" y1="-0.46" x2="0" y2="-0.02"/>`);
		case "restart":
			return wrap(`<path d="M 0.36 -0.18 A 0.4 0.4 0 1 0 0.4 0.1"/><path d="M 0.4 -0.32 L 0.36 -0.16 L 0.2 -0.24"/>`);
		case "sleep":
			return wrap(
				`<path d="M 0.13 -0.42 A 0.42 0.42 0 1 0 0.13 0.42 A 0.32 0.32 0 1 1 0.13 -0.42 Z" fill="${color}" stroke="none"/>`,
			);
		case "hibernate":
			return wrap(snowflake());
		case "logoff":
			return wrap(
				`<path d="M 0.06 -0.4 H -0.36 V 0.4 H 0.06"/><line x1="-0.12" y1="0" x2="0.42" y2="0"/>` +
					`<path d="M 0.26 -0.14 L 0.44 0 L 0.26 0.14"/>`,
			);
		case "lock":
			return wrap(
				`<rect x="-0.32" y="-0.06" width="0.64" height="0.5" rx="0.08"/>` +
					`<path d="M -0.19 -0.06 V -0.2 A 0.19 0.19 0 0 1 0.19 -0.2 V -0.06"/><line x1="0" y1="0.12" x2="0" y2="0.26"/>`,
			);
		case "monitor":
			return wrap(
				`<rect x="-0.44" y="-0.38" width="0.88" height="0.58" rx="0.06"/>` +
					`<path d="M 0 0.2 V 0.36 M -0.2 0.4 H 0.2"/><line x1="-0.3" y1="0.1" x2="0.3" y2="-0.28"/>`,
			);
	}
}

function snowflake(): string {
	const arms = [0, 60, 120].map((a) => `<line x1="0" y1="-0.46" x2="0" y2="0.46" transform="rotate(${a})"/>`).join("");
	const tips = [0, 60, 120, 180, 240, 300]
		.map((a) => `<path d="M -0.12 -0.32 L 0 -0.46 L 0.12 -0.32" transform="rotate(${a})"/>`)
		.join("");
	return arms + tips;
}
