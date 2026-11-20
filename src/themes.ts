/**
 * Pure theme + custom color slot definitions (no `obsidian` imports) shared by
 * settings, the stylesheet generator, the transpiler, and the preview view.
 */

export type BookTheme = "5ePHB" | "ink" | "dark" | "custom";

export const BOOK_THEMES: Array<{ value: BookTheme; label: string }> = [
	{ value: "5ePHB", label: "Classic Parchment (5ePHB)" },
	{ value: "ink", label: "Ink-Saver (Print)" },
	{ value: "dark", label: "Dark / Eldritch Grimoire" },
	{ value: "custom", label: "Custom" },
];

export interface ColorSlot {
	/** Short tag name used as `{{name text}}`. */
	name: string;
	/** `#rrggbb` hex color. */
	color: string;
}

export interface CustomFontsCssBundle {
	fontFacesCss?: string;
	fontVariablesCss?: string;
}

export interface FontTagRef {
	name: string;
	font: string;
}

export interface BookStyleOptions {
	theme?: BookTheme;
	customPageColor?: string;
	customFontColor?: string;
	colorSlots?: ColorSlot[];
	fontTags?: FontTagRef[];
	customFontsCss?: CustomFontsCssBundle;
}

export const DEFAULT_COLOR_SLOTS: ColorSlot[] = [
	{ name: "crimson", color: "#9c2b1b" },
	{ name: "gold", color: "#b8860b" },
	{ name: "arcane", color: "#5b3fa0" },
	{ name: "sage", color: "#4f7a4a" },
	{ name: "frost", color: "#2f6f8f" },
];

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const TAG_NAME = /^[A-Za-z][\w-]{0,31}$/;

export function sanitizeHexColor(value: string | undefined, fallback: string): string {
	const v = (value ?? "").trim();
	return HEX_COLOR.test(v) ? v : fallback;
}

export function isValidTagName(value: string): boolean {
	return TAG_NAME.test(value);
}

/** Converts color slots into a `tag -> hex` lookup, skipping invalid/blank entries. */
export function colorSlotsToMap(slots: ColorSlot[] | undefined): Record<string, string> {
	const map: Record<string, string> = {};
	for (const slot of slots ?? []) {
		const name = (slot.name ?? "").trim();
		if (!isValidTagName(name) || !HEX_COLOR.test((slot.color ?? "").trim())) continue;
		map[name] = slot.color.trim();
	}
	return map;
}

const RESERVED_TAGS = new Set([
	"wide",
	"note",
	"descriptive",
	"handwritten",
	"monster",
	"frame",
	"toc",
	"colophon",
	"dropcap",
	"center",
	"right",
	"justify",
	"no-header",
	"no-footer",
	"twoColumn",
	"singleColumn",
]);

/** Returns the theme CSS appended after the base book stylesheet. */
export function getThemeCss(style: BookStyleOptions = {}): string {
	const theme: BookTheme = style.theme ?? "5ePHB";
	const parts: string[] = [];

	if (theme === "ink") {
		parts.push(`
/* Theme: Ink-Saver (Print) */
:root {
	--hb-page-bg: #ffffff;
	--hb-page-grad: none;
	--hb-text-color: #2b2b2b;
	--hb-heading-color: #2b2b2b;
	--hb-note-bg: #ffffff;
	--hb-note-border: #8c8c8c;
	--hb-note-title-color: #1e1e1e;
	--hb-note-text-color: #2b2b2b;
	--hb-desc-bg: #ffffff;
	--hb-descriptive-bg: #ffffff;
	--hb-descriptive-border: #8c8c8c;
	--hb-descriptive-title-color: #1e1e1e;
	--hb-descriptive-text-color: #2b2b2b;
	--hb-stat-bg: #ffffff;
	--hb-statblock-bg: #ffffff;
	--hb-statblock-border: #8c8c8c;
	--hb-statblock-heading-color: #1e1e1e;
	--hb-statblock-text-color: #2b2b2b;
	--hb-statblock-divider-color: #8c8c8c;
	--hb-table-alt: #f4f4f4;
	--hb-table-header-bg: transparent;
	--hb-table-header-text: #000000;
	--hb-table-row-alt: #f4f4f4;
	--hb-strong-color: #000000;
	--hb-em-color: #454545;
	--hb-handwritten-bg: #faf8f2;
	--hb-handwritten-border: #8c8c8c;
	--hb-handwritten-shadow: none;
	--hb-handwritten-text: #1e1e1e;
	--hb-handwritten-text-color: #1e1e1e;
	--hb-gold: #8c8c8c;
	--hb-crimson-rule: #8c8c8c;
}
.page { box-shadow: 0 0 0 1px #d0d0d0; }
.block.note, .block.descriptive, .block.monster.frame, .block.classTable.frame, .block.spell, .block.item {
	background: #ffffff;
	box-shadow: none;
	border: 0.5px solid #8c8c8c;
	outline: none;
}
.block.monster.frame { border-top: 1px solid #8c8c8c; border-bottom: 1px solid #8c8c8c; }
blockquote, pre, code, mark { background: transparent; }
mark { border-bottom: 1px solid #8c8c8c; }
thead th { border-bottom: 0.5px solid #2b2b2b; }
tbody td { border-bottom: 0.5px solid #cfcfcf; }
h1, h2, h3 { border-bottom-width: 0.5px; border-bottom-color: #8c8c8c; }
.block.monster hr { background: #8c8c8c; }
.page-footer, .block.pageNumber, .block.footnote, .hb-running-header, .hb-running-footer { color: #555555; border-color: #8c8c8c; }
`);
	} else if (theme === "dark") {
		parts.push(`
/* Theme: Dark / Eldritch Grimoire */
:root {
	--hb-page-bg: #1d1f24;
	--hb-page-grad: none;
	--hb-text-color: #d9d5c9;
	--hb-heading-color: #c9ad6a;
	--hb-gold: #8f8a7a;
	--hb-gold-accent: #b8a06a;
	--hb-crimson-rule: #b85d4b;
	--hb-note-bg: #252932;
	--hb-note-border: #8c7648;
	--hb-note-title-color: #ead08c;
	--hb-note-text-color: #dad6ca;
	--hb-desc-bg: #23262e;
	--hb-descriptive-bg: #23262e;
	--hb-descriptive-border: #9c7a44;
	--hb-descriptive-title-color: #ead08c;
	--hb-descriptive-text-color: #dfd9cc;
	--hb-stat-bg: #24262e;
	--hb-statblock-bg: #24262e;
	--hb-statblock-border: #b39252;
	--hb-statblock-heading-color: #edd085;
	--hb-statblock-text-color: #dad6ca;
	--hb-statblock-divider-color: #b85d4b;
	--hb-table-alt: rgba(255, 255, 255, 0.04);
	--hb-table-header-bg: rgba(201, 173, 106, 0.16);
	--hb-table-header-text: #ead9a8;
	--hb-table-row-alt: rgba(255, 255, 255, 0.04);
	--hb-strong-color: #e6c675;
	--hb-em-color: #a7bacb;
	--hb-handwritten-bg: #262830;
	--hb-handwritten-border: #6e634c;
	--hb-handwritten-shadow: inset 0 0 14px rgba(0, 0, 0, 0.35), 0 2px 8px rgba(0, 0, 0, 0.45);
	--hb-handwritten-text: #e2dccf;
	--hb-handwritten-text-color: #e2dccf;
}
html, body { background: #101114; }
.page { box-shadow: 0 8px 28px rgba(0, 0, 0, 0.7); }
.block.note, .block.descriptive, .block.monster.frame, .block.classTable.frame, .block.spell, .block.item {
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
}
.block.classTable.frame { background: var(--hb-statblock-bg); }
.hb-dl-row, .block.monster .hb-dl-row { color: var(--hb-statblock-heading-color); }
blockquote { background: rgba(255, 255, 255, 0.04); }
code, pre { background: rgba(255, 255, 255, 0.07); }
.page-footer, .block.pageNumber, .block.footnote, .hb-running-header, .hb-running-footer { color: #b8a06a; }
`);
	} else if (theme === "custom") {
		const page = sanitizeHexColor(style.customPageColor, "#f6f2e9");
		const font = sanitizeHexColor(style.customFontColor, "#1e1915");
		parts.push(`
/* Theme: Custom */
:root {
	--hb-page-bg: ${page};
	--hb-page-grad: none;
	--hb-text-color: ${font};
	--hb-heading-color: ${font};
	--hb-note-bg: color-mix(in srgb, var(--hb-page-bg) 90%, var(--hb-text-color) 10%);
	--hb-note-border: color-mix(in srgb, var(--hb-text-color) 35%, transparent);
	--hb-note-title-color: var(--hb-heading-color);
	--hb-note-text-color: var(--hb-text-color);
	--hb-desc-bg: color-mix(in srgb, var(--hb-page-bg) 93%, var(--hb-text-color) 7%);
	--hb-descriptive-bg: color-mix(in srgb, var(--hb-page-bg) 93%, var(--hb-text-color) 7%);
	--hb-descriptive-border: color-mix(in srgb, var(--hb-heading-color) 50%, transparent);
	--hb-descriptive-title-color: var(--hb-heading-color);
	--hb-descriptive-text-color: var(--hb-text-color);
	--hb-stat-bg: color-mix(in srgb, var(--hb-page-bg) 91%, var(--hb-text-color) 9%);
	--hb-statblock-bg: color-mix(in srgb, var(--hb-page-bg) 91%, var(--hb-text-color) 9%);
	--hb-statblock-border: color-mix(in srgb, var(--hb-heading-color) 55%, transparent);
	--hb-statblock-heading-color: var(--hb-heading-color);
	--hb-statblock-text-color: var(--hb-text-color);
	--hb-statblock-divider-color: color-mix(in srgb, var(--hb-heading-color) 65%, transparent);
	--hb-table-header-bg: transparent;
	--hb-table-header-text: var(--hb-heading-color);
	--hb-table-row-alt: color-mix(in srgb, var(--hb-text-color) 6%, transparent);
	--hb-table-alt: var(--hb-table-row-alt);
	--hb-strong-color: color-mix(in srgb, var(--hb-text-color) 80%, #c9ad6a 20%);
	--hb-em-color: color-mix(in srgb, var(--hb-text-color) 82%, transparent);
	--hb-handwritten-bg: color-mix(in srgb, var(--hb-page-bg) 92%, #b89456 8%);
	--hb-handwritten-border: color-mix(in srgb, var(--hb-text-color) 22%, transparent);
	--hb-handwritten-shadow: inset 0 0 10px rgba(0, 0, 0, 0.08);
	--hb-handwritten-text: var(--hb-text-color);
	--hb-handwritten-text-color: var(--hb-text-color);
}
h5 { color: ${font}; }
`);
	} else {
		parts.push(`
/* Theme: Classic Parchment (5ePHB) */
:root {
	--hb-note-bg: #e0e5c1;
	--hb-note-border: #1e1e1e;
	--hb-note-title-color: #1e1915;
	--hb-note-text-color: #1e1915;
	--hb-descriptive-bg: #faf7ea;
	--hb-descriptive-border: #9c2b1b;
	--hb-descriptive-title-color: #58180d;
	--hb-descriptive-text-color: #1e1915;
	--hb-handwritten-bg: #f4ebd8;
	--hb-handwritten-border: rgba(120, 90, 48, 0.28);
	--hb-handwritten-text-color: #2a1f16;
	--hb-statblock-bg: #fdf1dc;
	--hb-statblock-border: #e69a28;
	--hb-statblock-heading-color: #58180d;
	--hb-statblock-text-color: #1e1915;
	--hb-statblock-divider-color: #9c2b1b;
	--hb-table-header-bg: transparent;
	--hb-table-header-text: #58180d;
	--hb-table-row-alt: #e0e5c1;
	--hb-strong-color: #4a150b;
	--hb-em-color: #463c33;
}
`);
	}

	const tagRules: string[] = [];
	for (const [name, color] of Object.entries(colorSlotsToMap(style.colorSlots))) {
		if (RESERVED_TAGS.has(name)) continue;
		tagRules.push(`.${name} { color: ${color}; }`);
	}
	if (tagRules.length) parts.push(`/* Custom text color slots */\n${tagRules.join("\n")}\n`);

	const fontTagRules: string[] = [];
	(style.fontTags ?? []).slice(0, 3).forEach((slot, idx) => {
		const name = (slot.name ?? "").trim();
		const font = (slot.font ?? "").trim();
		if (!isValidTagName(name) || RESERVED_TAGS.has(name) || !font) return;
		fontTagRules.push(`.${name} { font-family: var(--hb-custom-font-${idx + 1}); }`);
	});
	if (fontTagRules.length) parts.push(`/* Custom font tag slots */\n${fontTagRules.join("\n")}\n`);

	return parts.join("\n");
}
