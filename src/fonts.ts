/**
 * Offline Embedded SIL OFL Font Stylesheet Generator & Custom Font Resolver.
 *
 * Imports latin `.woff2` subsets directly so esbuild bundles them into `main.js`
 * as `data:font/woff2;base64,...` URIs with zero external network dependencies,
 * and discovers/caches user-supplied local font files from the vault or plugin
 * `fonts/` directory.
 */

import cinzel600 from "@fontsource/cinzel/files/cinzel-latin-600-normal.woff2";
import cinzel700 from "@fontsource/cinzel/files/cinzel-latin-700-normal.woff2";
import ephesis400 from "@fontsource/ephesis/files/ephesis-latin-400-normal.woff2";
import libreBaskerville400Italic from "@fontsource/libre-baskerville/files/libre-baskerville-latin-400-italic.woff2";
import libreBaskerville400 from "@fontsource/libre-baskerville/files/libre-baskerville-latin-400-normal.woff2";
import libreBaskerville700 from "@fontsource/libre-baskerville/files/libre-baskerville-latin-700-normal.woff2";
import openSans400Italic from "@fontsource/open-sans/files/open-sans-latin-400-italic.woff2";
import openSans400 from "@fontsource/open-sans/files/open-sans-latin-400-normal.woff2";
import openSans700 from "@fontsource/open-sans/files/open-sans-latin-700-normal.woff2";
import uncialAntiqua400 from "@fontsource/uncial-antiqua/files/uncial-antiqua-latin-400-normal.woff2";

interface FontFaceSpec {
	family: string;
	weight: number;
	style: "normal" | "italic";
	src: string;
}

const FONT_FACES: FontFaceSpec[] = [
	{ family: "Cinzel", weight: 600, style: "normal", src: cinzel600 },
	{ family: "Cinzel", weight: 700, style: "normal", src: cinzel700 },
	{ family: "Uncial Antiqua", weight: 400, style: "normal", src: uncialAntiqua400 },
	{ family: "Ephesis", weight: 400, style: "normal", src: ephesis400 },
	{ family: "Libre Baskerville", weight: 400, style: "normal", src: libreBaskerville400 },
	{ family: "Libre Baskerville", weight: 400, style: "italic", src: libreBaskerville400Italic },
	{ family: "Libre Baskerville", weight: 700, style: "normal", src: libreBaskerville700 },
	{ family: "Open Sans", weight: 400, style: "normal", src: openSans400 },
	{ family: "Open Sans", weight: 400, style: "italic", src: openSans400Italic },
	{ family: "Open Sans", weight: 700, style: "normal", src: openSans700 },
];

/** Returns embedded `@font-face` rules for Cinzel, Uncial Antiqua, Ephesis, Libre Baskerville, and Open Sans. */
export function getEmbeddedFontsCss(): string {
	return FONT_FACES.map(
		(face) => `@font-face {
	font-family: '${face.family}';
	font-style: ${face.style};
	font-weight: ${face.weight};
	font-display: block;
	src: url('${face.src}') format('woff2');
}`,
	).join("\n");
}

// ---------------------------------------------------------------------------
// 9-Slot Custom Font Schema, Local Discovery & mtime-Cached @font-face Builder
// ---------------------------------------------------------------------------

export type CustomFontSlotKey =
	| "h1"
	| "h2"
	| "h3"
	| "h4"
	| "h5"
	| "h6"
	| "body"
	| "statblock"
	| "magicItem"
	| "monsterStatblock"
	| "dropcap"
	| "readAloud"
	| "note"
	| "handwritten";

export type CustomFontSettings = Record<CustomFontSlotKey, string>;

export const DEFAULT_CUSTOM_FONTS: CustomFontSettings = {
	h1: "",
	h2: "",
	h3: "",
	h4: "",
	h5: "",
	h6: "",
	body: "",
	statblock: "",
	magicItem: "",
	monsterStatblock: "",
	dropcap: "",
	readAloud: "",
	note: "",
	handwritten: "",
};

export interface FontTagSlot {
	/** Short tag name used as `{{name text}}`. */
	name: string;
	/** Font family name or local font file path (`""` = unset). */
	font: string;
}

export const DEFAULT_CUSTOM_FONT_TAGS: FontTagSlot[] = [
	{ name: "elvish", font: "" },
	{ name: "runic", font: "" },
	{ name: "draconic", font: "" },
];

export interface CustomFontSlotMeta {
	key: CustomFontSlotKey;
	label: string;
	description: string;
	cssVar: string;
	defaultLabel: string;
	fallbackStack: string;
	inheritsFrom?: CustomFontSlotKey;
}

export const CUSTOM_FONT_SLOTS: CustomFontSlotMeta[] = [
	{
		key: "h1",
		label: "Heading 1 (H1)",
		description: "Chapter titles and primary display headings.",
		cssVar: "--hb-font-h1",
		defaultLabel: "Cinzel",
		fallbackStack: "'Cinzel', 'Libre Baskerville', Georgia, serif",
	},
	{
		key: "h2",
		label: "Heading 2 (H2)",
		description: "Major section headings; inherits H1 when empty.",
		cssVar: "--hb-font-h2",
		defaultLabel: "Inherit H1 (Cinzel)",
		fallbackStack: "'Cinzel', 'Libre Baskerville', Georgia, serif",
		inheritsFrom: "h1",
	},
	{
		key: "h3",
		label: "Heading 3 (H3)",
		description: "Subsection headings; inherits H1 when empty.",
		cssVar: "--hb-font-h3",
		defaultLabel: "Inherit H1 (Cinzel)",
		fallbackStack: "'Cinzel', 'Libre Baskerville', Georgia, serif",
		inheritsFrom: "h1",
	},
	{
		key: "h4",
		label: "Heading 4 (H4)",
		description: "Minor headings; inherits H1 when empty.",
		cssVar: "--hb-font-h4",
		defaultLabel: "Inherit H1 (Cinzel)",
		fallbackStack: "'Cinzel', 'Libre Baskerville', Georgia, serif",
		inheritsFrom: "h1",
	},
	{
		key: "h5",
		label: "Heading 5 (H5)",
		description: "Small-caps inline headings; inherits H1 when empty.",
		cssVar: "--hb-font-h5",
		defaultLabel: "Inherit H1 (Cinzel)",
		fallbackStack: "'Cinzel', 'Libre Baskerville', Georgia, serif",
		inheritsFrom: "h1",
	},
	{
		key: "h6",
		label: "Heading 6 (H6)",
		description: "Bold italic sub-caption headings; inherits H1 when empty.",
		cssVar: "--hb-font-h6",
		defaultLabel: "Inherit H1 (Cinzel)",
		fallbackStack: "'Cinzel', 'Libre Baskerville', Georgia, serif",
		inheritsFrom: "h1",
	},
	{
		key: "body",
		label: "Body Copy",
		description: "Paragraphs, lists, and general book prose.",
		cssVar: "--hb-font-body",
		defaultLabel: "Libre Baskerville",
		fallbackStack: "'Libre Baskerville', 'Book Antiqua', Palatino, Georgia, serif",
	},
	{
		key: "statblock",
		label: "Base Statblock / Class Tables / Spell Blocks",
		description: "Shared sans-serif base for tables, class progression frames, and spell lists.",
		cssVar: "--hb-font-statblock",
		defaultLabel: "Open Sans",
		fallbackStack: "'Open Sans', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
	},
	{
		key: "magicItem",
		label: "Magic Item Blocks",
		description: "Magic item cards ([!item] and {{item}}); inherits Base Statblock when empty.",
		cssVar: "--hb-font-magic-item",
		defaultLabel: "Base Statblock (Open Sans)",
		fallbackStack: "'Open Sans', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
		inheritsFrom: "statblock",
	},
	{
		key: "monsterStatblock",
		label: "Monster Statblocks",
		description: "Monster frames ({{monster,frame}} & [!statblock]); inherits Base Statblock when empty.",
		cssVar: "--hb-font-monster",
		defaultLabel: "Base Statblock (Open Sans)",
		fallbackStack: "'Open Sans', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
		inheritsFrom: "statblock",
	},
	{
		key: "dropcap",
		label: "Drop Cap Initial",
		description: "Illuminated opening letter ({{dropcap}} and H1 + p).",
		cssVar: "--hb-font-dropcap",
		defaultLabel: "Uncial Antiqua",
		fallbackStack: "'Uncial Antiqua', 'Cinzel', serif",
	},
	{
		key: "readAloud",
		label: "Read Aloud Callouts",
		description: "Descriptive read-aloud boxes ({{descriptive}} and [!quote]).",
		cssVar: "--hb-font-read-aloud",
		defaultLabel: "Libre Baskerville",
		fallbackStack: "'Libre Baskerville', 'Book Antiqua', Palatino, Georgia, serif",
	},
	{
		key: "note",
		label: "Sidebar Notes",
		description: "DM and lore note boxes ({{note}} and [!note]).",
		cssVar: "--hb-font-note",
		defaultLabel: "Open Sans",
		fallbackStack: "'Open Sans', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
	},
	{
		key: "handwritten",
		label: "Handwritten Notes",
		description: "Handwritten letters and journal entries ({{handwritten}} & [!handwritten]).",
		cssVar: "--hb-font-handwritten",
		defaultLabel: "Ephesis",
		fallbackStack: "'Ephesis', cursive",
	},
];

export interface LocalFontFileEntry {
	label: string;
	path: string;
	source: "plugin" | "vault";
}

export interface FontVaultFile {
	path: string;
	stat: { mtime: number };
}

export interface FontResolverApp {
	vault: {
		configDir: string;
		getFiles(): FontVaultFile[];
		adapter: {
			exists(normalizedPath: string): Promise<boolean>;
			list(normalizedPath: string): Promise<{ files: string[]; folders: string[] }>;
			stat(normalizedPath: string): Promise<{ mtime: number } | null>;
			readBinary(normalizedPath: string): Promise<ArrayBuffer>;
		};
	};
}

const FONT_FILE_EXT_RE = /\.(ttf|otf|woff2?)$/i;

const FONT_FORMAT_INFO: Record<string, { mime: string; format: string }> = {
	woff2: { mime: "font/woff2", format: "woff2" },
	woff: { mime: "font/woff", format: "woff" },
	ttf: { mime: "font/ttf", format: "truetype" },
	otf: { mime: "font/otf", format: "opentype" },
};

const customFontDataCache = new Map<string, { b64: string; mime: string; format: string }>();

function normalizeFontPath(path: string): string {
	return path.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/+/, "").trim();
}

function basename(path: string): string {
	const idx = path.lastIndexOf("/");
	return idx >= 0 ? path.slice(idx + 1) : path;
}

function hashString(input: string): string {
	let hash = 2166136261;
	for (let i = 0; i < input.length; i++) {
		hash ^= input.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(36);
}

function makeCustomFontFamily(slotId: string, path: string, mtime: number): string {
	const token = hashString(`${slotId}:${path}:${mtime}`);
	return `hb-font-${slotId}-${token}`;
}

function sanitizeFontFamilyName(raw: string): string {
	return raw.replace(/["'\\\r\n;{}<>]/g, "").trim();
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	const chunks: string[] = [];
	const chunkSize = 0x8000;
	for (let i = 0; i < bytes.length; i += chunkSize) {
		const end = Math.min(i + chunkSize, bytes.length);
		let chunk = "";
		for (let j = i; j < end; j++) {
			chunk += String.fromCharCode(bytes[j]);
		}
		chunks.push(chunk);
	}
	const binary = chunks.join("");
	if (typeof btoa === "function") {
		return btoa(binary);
	}
	return Buffer.from(bytes).toString("base64");
}

export function isLocalFontFilePath(value: string): boolean {
	return FONT_FILE_EXT_RE.test(value.trim());
}

export function getPluginFontsDir(app: FontResolverApp, manifestDir?: string): string {
	const base = manifestDir ?? `${app.vault.configDir}/plugins/obsidian-homebrewery-exporter`;
	return `${normalizeFontPath(base).replace(/\/+$/, "")}/fonts`;
}

/**
 * Discovers `.ttf`, `.otf`, `.woff`, and `.woff2` font files in both the plugin's
 * `fonts/` directory and the user's Obsidian vault.
 */
export async function listAvailableLocalFontFiles(
	app: FontResolverApp,
	pluginDir?: string,
): Promise<LocalFontFileEntry[]> {
	const seen = new Set<string>();
	const entries: LocalFontFileEntry[] = [];

	const fontsDir = getPluginFontsDir(app, pluginDir);
	try {
		if (await app.vault.adapter.exists(fontsDir)) {
			const queue: string[] = [fontsDir];
			while (queue.length > 0) {
				const dir = queue.shift();
				if (!dir) continue;
				const listed = await app.vault.adapter.list(dir);
				for (const sub of listed.folders) queue.push(normalizeFontPath(sub));
				for (const rawFile of listed.files) {
					const path = normalizeFontPath(rawFile);
					if (!FONT_FILE_EXT_RE.test(path) || seen.has(path)) continue;
					seen.add(path);
					entries.push({
						label: `${basename(path)} (plugin fonts/)`,
						path,
						source: "plugin",
					});
				}
			}
		}
	} catch {
		// Ignore adapter errors when scanning the plugin fonts directory.
	}

	try {
		const vaultFiles = app.vault.getFiles();
		for (const file of vaultFiles) {
			const path = normalizeFontPath(file.path);
			if (!FONT_FILE_EXT_RE.test(path) || seen.has(path)) continue;
			seen.add(path);
			entries.push({
				label: path,
				path,
				source: "vault",
			});
		}
	} catch {
		// Ignore vault listing errors.
	}

	entries.sort((a, b) => {
		if (a.source !== b.source) return a.source === "plugin" ? -1 : 1;
		return a.label.localeCompare(b.label);
	});
	return entries;
}

/** Resolves each of the 9 font slots into its final CSS `font-family` stack. */
export function resolveCustomFontStacks(
	customFonts: Partial<CustomFontSettings> | undefined,
	resolvedFileFamilies: Partial<Record<CustomFontSlotKey, string>> = {},
): Record<CustomFontSlotKey, string> {
	const raw = { ...DEFAULT_CUSTOM_FONTS, ...(customFonts ?? {}) };
	const resolved = {} as Record<CustomFontSlotKey, string>;

	const resolveOne = (meta: CustomFontSlotMeta): string => {
		const fileFamily = resolvedFileFamilies[meta.key];
		if (fileFamily) {
			return `'${fileFamily}', ${meta.fallbackStack}`;
		}
		const val = (raw[meta.key] ?? "").trim();
		if (val && !isLocalFontFilePath(val)) {
			const clean = sanitizeFontFamilyName(val);
			if (clean) return `"${clean}", ${meta.fallbackStack}`;
		}
		if (meta.inheritsFrom) {
			const parentMeta = CUSTOM_FONT_SLOTS.find((s) => s.key === meta.inheritsFrom);
			if (parentMeta) return resolveOne(parentMeta);
		}
		return meta.fallbackStack;
	};

	for (const meta of CUSTOM_FONT_SLOTS) {
		resolved[meta.key] = resolveOne(meta);
	}
	return resolved;
}

const TAG_NAME_RE = /^[A-Za-z][\w-]{0,31}$/;

/** Converts custom font tag slots into a `tag -> CSS font-family` lookup (e.g. `var(--hb-custom-font-1)`). */
export function fontTagSlotsToMap(slots: FontTagSlot[] | undefined): Record<string, string> {
	const map: Record<string, string> = {};
	(slots ?? []).forEach((slot, idx) => {
		const name = (slot.name ?? "").trim();
		const font = (slot.font ?? "").trim();
		if (!TAG_NAME_RE.test(name) || !font) return;
		map[name] = `var(--hb-custom-font-${idx + 1})`;
	});
	return map;
}

/** Resolves a single custom font tag value into a CSS `font-family` stack. */
export function resolveFontTagStack(rawFont: string, resolvedFileFamily?: string): string {
	if (resolvedFileFamily) return `'${resolvedFileFamily}', serif`;
	const trimmed = rawFont.trim();
	if (trimmed && !isLocalFontFilePath(trimmed)) {
		const clean = sanitizeFontFamilyName(trimmed);
		if (clean) return `"${clean}", serif`;
	}
	return "inherit";
}

/** Generates CSS custom property declarations (`--hb-font-*` and `--hb-custom-font-*`) for all font slots. */
export function buildCustomFontVariablesCss(
	customFonts: Partial<CustomFontSettings> | undefined,
	resolvedFileFamilies: Partial<Record<CustomFontSlotKey, string>> = {},
	customFontTags: FontTagSlot[] = [],
	resolvedTagFileFamilies: Record<number, string> = {},
): string {
	const stacks = resolveCustomFontStacks(customFonts, resolvedFileFamilies);
	const slotLines = CUSTOM_FONT_SLOTS.map((meta) => `\t${meta.cssVar}: ${stacks[meta.key]};`);
	const tagLines = customFontTags.slice(0, 3).map((slot, idx) => {
		const stack = resolveFontTagStack(slot.font ?? "", resolvedTagFileFamilies[idx]);
		return `\t--hb-custom-font-${idx + 1}: ${stack};`;
	});
	return [...slotLines, ...tagLines].join("\n");
}

async function resolveLocalFontFace(
	app: FontResolverApp,
	slotId: string,
	rawPath: string,
): Promise<{ family: string; css: string } | null> {
	const path = normalizeFontPath(rawPath);
	const extMatch = FONT_FILE_EXT_RE.exec(path);
	if (!extMatch) return null;
	const fmt = FONT_FORMAT_INFO[extMatch[1].toLowerCase()];
	if (!fmt) return null;

	try {
		const vaultFile = app.vault.getFiles().find((f) => normalizeFontPath(f.path) === path);
		let mtime = 0;
		if (vaultFile) {
			mtime = vaultFile.stat.mtime;
		} else {
			const stat = await app.vault.adapter.stat(path);
			if (!stat) return null;
			mtime = stat.mtime;
		}

		const dataCacheKey = `${path}:${mtime}`;
		let cachedData = customFontDataCache.get(dataCacheKey);
		if (!cachedData) {
			const buffer = await app.vault.adapter.readBinary(path);
			cachedData = {
				b64: arrayBufferToBase64(buffer),
				mime: fmt.mime,
				format: fmt.format,
			};
			customFontDataCache.set(dataCacheKey, cachedData);
		}

		const family = makeCustomFontFamily(slotId, path, mtime);
		const css = `@font-face {
	font-family: '${family}';
	font-style: normal;
	font-weight: 400;
	font-display: block;
	src: url('data:${cachedData.mime};base64,${cachedData.b64}') format('${cachedData.format}');
}`;
		return { family, css };
	} catch {
		return null;
	}
}

/**
 * Resolves all 14 custom font slots (`h1`–`h6` + body/block slots) and 3 custom font tags,
 * encoding local `.ttf`/`.otf`/`.woff`/`.woff2` files into `mtime`-cached base64 `@font-face`
 * rules and emitting `--hb-font-*` and `--hb-custom-font-*` CSS variables.
 */
export async function buildCustomFontsCss(
	app: FontResolverApp,
	customFonts: Partial<CustomFontSettings> | undefined,
	customFontTags: FontTagSlot[] = [],
): Promise<{ fontFacesCss: string; fontVariablesCss: string }> {
	const settings = { ...DEFAULT_CUSTOM_FONTS, ...(customFonts ?? {}) };
	const resolvedFileFamilies: Partial<Record<CustomFontSlotKey, string>> = {};
	const resolvedTagFileFamilies: Record<number, string> = {};
	const fontFacesByFamily = new Map<string, string>();

	for (const meta of CUSTOM_FONT_SLOTS) {
		const raw = (settings[meta.key] ?? "").trim();
		if (!raw || !isLocalFontFilePath(raw)) continue;
		const resolved = await resolveLocalFontFace(app, meta.key, raw);
		if (resolved) {
			resolvedFileFamilies[meta.key] = resolved.family;
			if (!fontFacesByFamily.has(resolved.family)) {
				fontFacesByFamily.set(resolved.family, resolved.css);
			}
		}
	}

	const tags = customFontTags.slice(0, 3);
	for (let idx = 0; idx < tags.length; idx++) {
		const raw = (tags[idx]?.font ?? "").trim();
		if (!raw || !isLocalFontFilePath(raw)) continue;
		const resolved = await resolveLocalFontFace(app, `custom-${idx + 1}`, raw);
		if (resolved) {
			resolvedTagFileFamilies[idx] = resolved.family;
			if (!fontFacesByFamily.has(resolved.family)) {
				fontFacesByFamily.set(resolved.family, resolved.css);
			}
		}
	}

	return {
		fontFacesCss: Array.from(fontFacesByFamily.values()).join("\n"),
		fontVariablesCss: buildCustomFontVariablesCss(
			settings,
			resolvedFileFamilies,
			tags,
			resolvedTagFileFamilies,
		),
	};
}
