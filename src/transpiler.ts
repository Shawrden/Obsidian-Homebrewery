/**
 * Transpiler: Obsidian Markdown -> Homebrewery V3 Markdown -> paginated HTML pages.
 *
 * Pure module (no `obsidian` imports) so it can be unit-tested in Node and shared
 * by the live preview, PDF export, and Markdown export.
 */

import { type Marked, type Token } from "marked";
import { type LineSpan, createBookMarked, postprocessBookHtml } from "./markedExtensions";
import { abilityModifier, buildMonsterBlock, isStatblockFrontmatter } from "./statblock";
import { type BookTheme } from "./themes";
import {
	decodeHtmlEntities,
	encodeImageUrl,
	escapeHtml,
	isExternalUrl,
	isImagePath,
	normalizeNewlines,
	safeDecodeUri,
	splitFencedSegments,
	stripAngles,
	withInlineCodeProtected,
} from "./utils";
import { isYamlMap, parseSimpleYaml } from "./yaml";

export { splitFencedSegments, isExternalUrl, safeDecodeUri } from "./utils";

export type YamlParser = (src: string) => unknown;

export interface MappedLine {
	text: string;
	start: number;
	end: number;
}

export interface TranspileOptions {
	/** Note title; fallback monster name for statblock frontmatter. */
	title?: string;
	/** YAML parser (Obsidian's `parseYaml` in-app); falls back to a built-in subset parser. */
	parseYaml?: YamlParser;
	/** Maps an Obsidian link path (e.g. `goblin.png`) to a vault path (e.g. `assets/goblin.png`). */
	resolveImagePath?: (linkpath: string) => string | null | undefined;
}

export interface RenderOptions {
	/** Maps an image URL found in the rendered HTML to a displayable src (e.g. a data URI). */
	resolveImageSrc?: (url: string) => string | null | undefined;
	/** Optional 1-based page number injected into `{{pageNumber,auto}}` blocks. */
	pageNumber?: number;
	/** Optional 0-based line offset added when rendering standalone page Markdown. */
	lineOffset?: number;
	/** Custom `{{tagName ...}}` color slots as a `tag -> #hex` lookup. */
	colorTags?: Record<string, string>;
	/** Custom `{{tagName ...}}` font slots as a `tag -> CSS font-family` lookup. */
	fontTags?: Record<string, string>;
}

export interface BookFrontmatterOverrides {
	theme?: BookTheme;
	pageSize?: "letter" | "a4";
	columns?: 1 | 2;
	runningHeader?: string;
	runningFooter?: string;
}

// ---------------------------------------------------------------------------
// Line-mapped helpers
// ---------------------------------------------------------------------------

function toMappedLines(src: string, lineOffset = 0): MappedLine[] {
	return normalizeNewlines(src)
		.split("\n")
		.map((text, idx) => ({ text, start: idx + lineOffset, end: idx + lineOffset }));
}

interface MappedSegment {
	code: boolean;
	lines: MappedLine[];
	info: string;
}

function splitFencedMappedSegments(lines: MappedLine[]): MappedSegment[] {
	const segments: MappedSegment[] = [];
	let buf: MappedLine[] = [];
	let fenceChar = "";
	let fenceLen = 0;
	let info = "";

	const flush = (code: boolean): void => {
		if (buf.length) segments.push({ code, lines: buf, info: code ? info : "" });
		buf = [];
	};

	for (const line of lines) {
		if (!fenceChar) {
			const m = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line.text);
			if (m && !(m[1][0] === "`" && m[2].includes("`"))) {
				flush(false);
				fenceChar = m[1][0];
				fenceLen = m[1].length;
				info = m[2].trim();
				buf.push(line);
				continue;
			}
			buf.push(line);
		} else {
			buf.push(line);
			const trimmed = line.text.trim();
			const isClose =
				/^ {0,3}\S/.test(line.text) || trimmed === ""
					? trimmed.length >= fenceLen && trimmed.split("").every((c) => c === fenceChar)
					: false;
			if (isClose) {
				flush(true);
				fenceChar = "";
			}
		}
	}
	flush(fenceChar !== "");
	return segments;
}

function stripObsidianCommentsMapped(lines: MappedLine[]): MappedLine[] {
	const out: MappedLine[] = [];
	let inComment = false;

	for (const line of lines) {
		let cur = line.text;
		let rebuilt = "";
		let pos = 0;

		while (pos < cur.length) {
			const idx = cur.indexOf("%%", pos);
			if (idx < 0) {
				if (!inComment) rebuilt += cur.slice(pos);
				break;
			}
			if (!inComment) {
				rebuilt += cur.slice(pos, idx);
				inComment = true;
			} else {
				inComment = false;
			}
			pos = idx + 2;
		}

		if (inComment && rebuilt.trim() === "" && cur.includes("%%")) {
			// Opening line of a multiline comment with no prose before `%%`
			continue;
		}
		if (!inComment || rebuilt !== "") {
			if (!inComment && cur.includes("%%") && rebuilt.trim() === "" && cur.trim().startsWith("%%")) {
				continue;
			}
			out.push({ text: rebuilt, start: line.start, end: line.end });
		}
	}
	return out;
}

// ---------------------------------------------------------------------------
// Frontmatter & callouts
// ---------------------------------------------------------------------------

export interface Frontmatter {
	data: Record<string, unknown> | null;
	body: string;
	bodyStartLine: number;
}

export function extractFrontmatter(src: string, parseYaml?: YamlParser): Frontmatter {
	const m = /^---[ \t]*\n([\s\S]*?)\n(?:---|\.\.\.)[ \t]*(?:\n|$)/.exec(src);
	if (!m) return { data: null, body: src, bodyStartLine: 0 };
	let data: Record<string, unknown> | null = null;
	try {
		const parsed = parseYaml ? parseYaml(m[1]) : parseSimpleYaml(m[1]);
		data = isYamlMap(parsed) ? (parsed as Record<string, unknown>) : null;
	} catch {
		data = null;
	}
	const consumed = m[0];
	const bodyStartLine = consumed.endsWith("\n") ? consumed.slice(0, -1).split("\n").length : consumed.split("\n").length;
	return { data, body: src.slice(consumed.length), bodyStartLine };
}

function parseFrontmatterTheme(raw: unknown): BookTheme | undefined {
	if (typeof raw !== "string") return undefined;
	const v = raw.trim().toLowerCase();
	if (v === "classic" || v === "5ephb" || v === "parchment" || v === "classic parchment") return "5ePHB";
	if (v === "ink-saver" || v === "ink" || v === "print") return "ink";
	if (v === "eldritch" || v === "dark" || v === "grimoire" || v === "dark / eldritch grimoire") return "dark";
	if (v === "custom") return "custom";
	return undefined;
}

function parseFrontmatterSize(raw: unknown): "letter" | "a4" | undefined {
	if (typeof raw !== "string") return undefined;
	const v = raw.trim().toLowerCase();
	if (v === "letter") return "letter";
	if (v === "a4") return "a4";
	return undefined;
}

function parseFrontmatterColumns(raw: unknown): 1 | 2 | undefined {
	if (raw === 1 || raw === "1") return 1;
	if (raw === 2 || raw === "2") return 2;
	if (typeof raw === "string") {
		const v = raw.trim().toLowerCase();
		if (v === "1" || v === "single") return 1;
		if (v === "2" || v === "double" || v === "two") return 2;
	}
	return undefined;
}

/** Extracts per-note layout overrides (`hb-theme`, `hb-size`, `hb-columns`, running headers/footers) from YAML data. */
export function parseBookFrontmatterOverrides(data: Record<string, unknown> | null): BookFrontmatterOverrides {
	if (!data) return {};
	const overrides: BookFrontmatterOverrides = {};
	const theme = parseFrontmatterTheme(data["hb-theme"]);
	if (theme) overrides.theme = theme;
	const pageSize = parseFrontmatterSize(data["hb-size"]);
	if (pageSize) overrides.pageSize = pageSize;
	const columns = parseFrontmatterColumns(data["hb-columns"]);
	if (columns) overrides.columns = columns;
	if (typeof data["running-header"] === "string" && data["running-header"].trim() !== "") {
		overrides.runningHeader = data["running-header"].trim();
	}
	if (typeof data["running-footer"] === "string" && data["running-footer"].trim() !== "") {
		overrides.runningFooter = data["running-footer"].trim();
	}
	return overrides;
}

/** Extracts per-note layout overrides directly from Markdown YAML frontmatter. */
export function extractBookFrontmatterOverrides(
	markdown: string,
	parseYaml?: YamlParser,
): BookFrontmatterOverrides {
	const { data } = extractFrontmatter(normalizeNewlines(markdown), parseYaml);
	return parseBookFrontmatterOverrides(data);
}

/** Maps an Obsidian callout type to a Homebrewery block class list. */
export function calloutBlockClass(type: string): string {
	const t = type.toLowerCase();
	if (["quote", "cite", "descriptive", "readaloud", "read-aloud", "boxed"].includes(t)) return "descriptive";
	if (["monster", "statblock", "stat-block"].includes(t)) return "monster,frame";
	if (t === "spell") return "spell";
	if (t === "item" || t === "magic-item") return "item";
	if (t === "handwritten") return "handwritten";
	return "note";
}

const CALLOUT_START = /^[ \t]{0,3}>[ \t]?\[!([\w-]+)\]([+-]?)[ \t]*(.*)$/;
const QUOTE_LINE = /^[ \t]{0,3}>/;

function convertCalloutsMapped(lines: MappedLine[]): MappedLine[] {
	const out: MappedLine[] = [];
	for (let i = 0; i < lines.length; i++) {
		const m = CALLOUT_START.exec(lines[i].text);
		if (!m) {
			out.push(lines[i]);
			continue;
		}
		const cls = calloutBlockClass(m[1]);
		const title = m[3].trim();
		const startLine = lines[i].start;
		const content: MappedLine[] = [];
		while (i + 1 < lines.length && QUOTE_LINE.test(lines[i + 1].text)) {
			i++;
			content.push({
				text: lines[i].text.replace(/^[ \t]{0,3}>[ \t]?/, ""),
				start: lines[i].start,
				end: lines[i].end,
			});
		}
		const endLine = content.length ? content[content.length - 1].end : startLine;
		const inner = convertCalloutsMapped(content);
		while (inner.length && inner[0].text === "") inner.shift();
		while (inner.length && inner[inner.length - 1].text === "") inner.pop();

		out.push({ text: `{{${cls}`, start: startLine, end: endLine });
		if (title) {
			out.push({
				text: cls === "monster,frame" ? `## ${title}` : `##### ${title}`,
				start: startLine,
				end: startLine,
			});
		}
		if (inner.some((l) => l.text.trim() !== "")) {
			out.push(...inner);
		}
		out.push({ text: "}}", start: startLine, end: endLine });
	}
	return out;
}

/** Converts `> [!type] Title` callouts (including nested callouts) into V3 blocks. */
export function convertCallouts(text: string): string {
	return convertCalloutsMapped(toMappedLines(text))
		.map((l) => l.text)
		.join("\n");
}

function convertMarkers(text: string): string {
	return text
		.replace(/^[ \t]*---[ \t]*page[ \t]*---[ \t]*$/gim, "\\page")
		.replace(/^[ \t]*---[ \t]*column[ \t]*---[ \t]*$/gim, "\\column");
}

// ---------------------------------------------------------------------------
// Inline conversions: wikilinks, embeds, multi-mode images, highlights
// ---------------------------------------------------------------------------

/** `[[Target|Alias]]` -> `Alias`, `[[Target]]` -> `Target`, `[[Note#Heading]]` -> `Note > Heading`. */
export function wikilinkDisplayText(inner: string): string {
	const raw = inner.replace(/\\\|/g, "|");
	const pipe = raw.indexOf("|");
	if (pipe >= 0) return raw.slice(pipe + 1).trim();
	const hash = raw.indexOf("#");
	const target = (hash >= 0 ? raw.slice(0, hash) : raw).trim();
	const fragment = hash >= 0 ? raw.slice(hash + 1).replace(/^\^/, "").replace(/#/g, " > ").trim() : "";
	if (!target) return fragment;
	return fragment ? `${target} > ${fragment}` : target;
}

function sizeStyles(spec: string): string[] | null {
	const m = /^\s*(\d+)(?:\s*x\s*(\d+))?\s*$/.exec(spec);
	if (!m) return null;
	const styles = [`width:${m[1]}px`];
	if (m[2]) styles.push(`height:${m[2]}px`);
	return styles;
}

interface ParsedImageModifiers {
	classes: string[];
	styles: string[];
}

function clampInt(n: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, n));
}

interface SingleModifier {
	classes: string[];
	style?: string;
}

function bgOpacityStyle(pct: number): string | undefined {
	return pct === 100 ? undefined : `opacity:${Number((pct / 100).toFixed(2))}`;
}

function parseSingleImageModifier(rawToken: string): SingleModifier | null {
	const tok = rawToken.trim().toLowerCase();
	if (!tok) return null;

	const bgVariant = /^bg(?:-(width|height))?(?:-(\d{1,3}))?$/.exec(tok);
	if (bgVariant) {
		const classes = ["hb-img-bg"];
		if (bgVariant[1]) classes.push(`hb-img-bg-${bgVariant[1]}`);
		const style = bgVariant[2] ? bgOpacityStyle(clampInt(Number(bgVariant[2]), 1, 100)) : undefined;
		return { classes, style };
	}

	const banner = /^(top|bottom)(?:-(\d{1,3}))?$/.exec(tok);
	if (banner) {
		const pct = banner[2] ? clampInt(Number(banner[2]), 1, 100) : 35;
		return { classes: [`hb-img-${banner[1]}`], style: `height:${pct}%` };
	}

	if (tok === "col") return { classes: ["hb-img-col"] };
	if (tok === "inline") return { classes: ["hb-img-inline"] };

	const fade = /^fade(?:-(\d{1,3}))?$/.exec(tok);
	if (fade) {
		if (!fade[1]) return { classes: ["hb-img-fade"] };
		const n = clampInt(Number(fade[1]), 1, 100);
		return { classes: ["hb-img-fade"], style: `--hb-fade:${n}` };
	}

	const sideMatch = /^(left|right)-(\d{1,3})$/.exec(tok);
	if (sideMatch) {
		const pct = clampInt(Number(sideMatch[2]), 1, 100);
		return { classes: [`hb-img-${sideMatch[1]}`], style: `width:${pct}%` };
	}

	if (tok === "pos-top") return { classes: [], style: "object-position:top center" };
	if (tok === "pos-bottom") return { classes: [], style: "object-position:bottom center" };
	if (tok === "pos-left") return { classes: [], style: "object-position:center left" };
	if (tok === "pos-right") return { classes: [], style: "object-position:center right" };
	if (tok === "pos-center") return { classes: [], style: "object-position:center center" };

	const posXY = /^pos-(\d{1,3})-(\d{1,3})$/.exec(tok);
	if (posXY) {
		const x = clampInt(Number(posXY[1]), 0, 100);
		const y = clampInt(Number(posXY[2]), 0, 100);
		return { classes: [], style: `object-position:${x}% ${y}%` };
	}

	return null;
}

function parseCommaModifiers(spec: string): ParsedImageModifiers | null {
	const parts = spec
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	if (!parts.length) return null;
	const classes: string[] = [];
	const styles: string[] = [];
	for (const part of parts) {
		const parsed = parseSingleImageModifier(part);
		if (!parsed) return null;
		for (const c of parsed.classes) {
			if (!classes.includes(c)) classes.push(c);
		}
		if (parsed.style) styles.push(parsed.style);
	}
	return { classes, styles };
}

function formatV3Image(alt: string, url: string, attrs: string[], title?: string): string {
	const t = title ? ` "${title}"` : "";
	return `![${alt}](${url}${t})${attrs.length ? `{${attrs.join(",")}}` : ""}`;
}

function basenameNoExt(path: string): string {
	const base = path.slice(path.lastIndexOf("/") + 1);
	const dot = base.lastIndexOf(".");
	return dot > 0 ? base.slice(0, dot) : base;
}

function mergeImageModifiers(segments: string[]): { classes: string[]; styles: string[]; alt: string } {
	const classes: string[] = [];
	let styles: string[] = [];
	let alt = "";

	for (const seg of segments) {
		const trimmed = seg.trim();
		if (!trimmed) continue;
		const px = sizeStyles(trimmed);
		if (px) {
			styles = [...styles, ...px];
			continue;
		}
		const mods = parseCommaModifiers(trimmed);
		if (mods) {
			for (const c of mods.classes) {
				if (!classes.includes(c)) classes.push(c);
			}
			styles = [...styles, ...mods.styles];
			continue;
		}
		alt = trimmed;
	}

	return { classes, styles, alt };
}

function convertEmbed(inner: string, opts: TranspileOptions): string {
	const parts = inner.replace(/\\\|/g, "|").split("|");
	const target = parts[0].trim();
	const rest = parts.slice(1);
	const linkpath = target.split("#")[0].trim();
	if (isImagePath(linkpath)) {
		const { classes, styles, alt } = mergeImageModifiers(rest);
		const resolved = isExternalUrl(linkpath) ? linkpath : (opts.resolveImagePath?.(linkpath) ?? linkpath);
		const attrs = [...classes.map((c) => `.${c}`), ...styles];
		return formatV3Image(alt || basenameNoExt(linkpath), encodeImageUrl(resolved), attrs);
	}
	const alias = rest.join("|").trim();
	return alias || wikilinkDisplayText(target);
}

function convertMarkdownImage(
	altRaw: string,
	urlRaw: string,
	title: string | undefined,
	attrs: string | undefined,
	opts: TranspileOptions,
): string {
	let alt = altRaw;
	let classAttrs: string[] = [];
	let styles: string[] = [];

	if (altRaw.includes("|")) {
		const pipeParts = altRaw.split("|");
		const first = pipeParts[0].trim();
		const modSegs = pipeParts.slice(1);
		const parsed = mergeImageModifiers(modSegs);
		alt = parsed.alt ? `${first} ${parsed.alt}`.trim() : first;
		classAttrs = parsed.classes.map((c) => `.${c}`);
		styles = parsed.styles;
	} else {
		const pureMods = parseCommaModifiers(altRaw);
		if (pureMods) {
			alt = "";
			classAttrs = pureMods.classes.map((c) => `.${c}`);
			styles = pureMods.styles;
		}
	}

	if (attrs) {
		const existing = attrs.slice(1, -1).trim();
		if (existing) {
			styles = [existing, ...styles];
		}
	}

	let url = stripAngles(urlRaw);
	if (!isExternalUrl(url)) {
		const decoded = safeDecodeUri(url);
		url = encodeImageUrl(opts.resolveImagePath?.(decoded) ?? decoded);
	}
	return formatV3Image(alt, url, [...classAttrs, ...styles], title);
}

const IMAGE_PATTERN =
	/!\[\[([^\]\n]+?)\]\]|!\[([^\]\n]*)\]\((<[^>\n]+>|[^)\s]+)(?:\s+"([^"\n]*)")?\)(\{[^}\n]*\})?/g;

function transformInline(text: string, opts: TranspileOptions): string {
	return withInlineCodeProtected(text, (t) =>
		t
			.replace(IMAGE_PATTERN, (...args: unknown[]) => {
				const [, embed, alt, url, title, attrs] = args as [string, string?, string?, string?, string?, string?];
				if (embed !== undefined) return convertEmbed(embed, opts);
				return convertMarkdownImage(alt ?? "", url ?? "", title, attrs, opts);
			})
			.replace(/\[\[([^\]\n]+?)\]\]/g, (_m, inner: string) => wikilinkDisplayText(inner))
			.replace(/==(?=\S)([^=\n]*?\S)==/g, "<mark>$1</mark>")
			.replace(/[ \t]+\^[A-Za-z0-9-]+[ \t]*$/gm, ""),
	);
}

function transformProseMapped(lines: MappedLine[], opts: TranspileOptions): MappedLine[] {
	const withoutComments = stripObsidianCommentsMapped(lines);
	const withMarkers = withoutComments.map((l) => ({
		text: convertMarkers(l.text),
		start: l.start,
		end: l.end,
	}));
	const withCallouts = convertCalloutsMapped(withMarkers);
	return withCallouts.map((l) => ({
		text: transformInline(l.text, opts),
		start: l.start,
		end: l.end,
	}));
}

function transformCodeMapped(lines: MappedLine[], info: string, opts: TranspileOptions): MappedLine[] {
	const lang = info.split(/\s+/)[0].toLowerCase();
	if (lang !== "statblock" && lang !== "monster") return lines;
	const body = lines
		.slice(1, lines.length > 1 ? -1 : undefined)
		.map((l) => l.text)
		.join("\n");
	try {
		const parsed = opts.parseYaml ? opts.parseYaml(body) : parseSimpleYaml(body);
		if (!isYamlMap(parsed)) return lines;
		const block = buildMonsterBlock(parsed as Record<string, unknown>, opts.title ?? "Monster");
		const start = lines[0].start;
		const end = lines[lines.length - 1].end;
		return block.split("\n").map((text) => ({ text, start, end }));
	} catch {
		return lines;
	}
}

function collapseExcessBlankLines(lines: MappedLine[]): MappedLine[] {
	const out: MappedLine[] = [];
	let blankRun = 0;
	for (const line of lines) {
		if (line.text === "") {
			blankRun++;
			if (blankRun <= 2) out.push(line);
		} else {
			blankRun = 0;
			out.push(line);
		}
	}
	while (out.length && out[0].text === "") out.shift();
	while (out.length && out[out.length - 1].text.trim() === "") out.pop();
	if (out.length) {
		const last = out[out.length - 1];
		out[out.length - 1] = { ...last, text: last.text.trimEnd() };
	}
	return out;
}

/** Converts an Obsidian note into Homebrewery V3 Markdown plus 0-based line mappings. */
export function obsidianToHomebreweryMapped(
	markdown: string,
	options: TranspileOptions = {},
): { v3: string; lines: MappedLine[]; frontmatterOverrides: BookFrontmatterOverrides } {
	const src = normalizeNewlines(markdown);
	const { data, body, bodyStartLine } = extractFrontmatter(src, options.parseYaml);
	const frontmatterOverrides = parseBookFrontmatterOverrides(data);
	const monster = data && isStatblockFrontmatter(data) ? buildMonsterBlock(data, options.title ?? "Monster") : "";
	const fmEndLine = Math.max(0, bodyStartLine - 1);

	const bodyLines = body === "" && bodyStartLine > 0 ? [] : toMappedLines(body, bodyStartLine);
	const segments = splitFencedMappedSegments(bodyLines);
	let resultLines: MappedLine[] = [];
	for (const seg of segments) {
		const transformed = seg.code
			? transformCodeMapped(seg.lines, seg.info, options)
			: transformProseMapped(seg.lines, options);
		resultLines.push(...transformed);
	}

	if (monster) {
		const monsterLines: MappedLine[] = monster.split("\n").map((text) => ({
			text,
			start: 0,
			end: fmEndLine,
		}));
		const placeholderIdx = resultLines.findIndex((l) => /^[ \t]*\{\{statblock\}\}[ \t]*$/.test(l.text));
		if (placeholderIdx >= 0) {
			resultLines = [
				...resultLines.slice(0, placeholderIdx),
				...monsterLines,
				...resultLines.slice(placeholderIdx + 1),
			];
		} else {
			while (resultLines.length && resultLines[0].text === "") resultLines.shift();
			if (resultLines.length) {
				resultLines = [...monsterLines, { text: "", start: fmEndLine, end: fmEndLine }, ...resultLines];
			} else {
				resultLines = monsterLines;
			}
		}
	}

	const cleaned = collapseExcessBlankLines(resultLines);
	const v3 = cleaned.length ? `${cleaned.map((l) => l.text).join("\n")}\n` : "\n";
	return { v3, lines: cleaned, frontmatterOverrides };
}

/** Converts an Obsidian note into Homebrewery V3 Markdown. */
export function obsidianToHomebrewery(markdown: string, options: TranspileOptions = {}): string {
	return obsidianToHomebreweryMapped(markdown, options).v3;
}

// ---------------------------------------------------------------------------
// Homebrewery V3 -> HTML pages
// ---------------------------------------------------------------------------

const PAGE_BREAK = /^[ \t]*\\page[ \t]*$/;
const PAGE_SINGLE_BREAK = /^[ \t]*\\page-single[ \t]*$/;
const SINGLE_COLUMN_MARKER = "{{singleColumn}}";

function isBlankPage(lines: MappedLine[]): boolean {
	return lines.every((l) => l.text.trim() === "");
}

function splitMappedPages(lines: MappedLine[]): MappedLine[][] {
	const pages: MappedLine[][] = [[]];
	for (const seg of splitFencedMappedSegments(lines)) {
		if (seg.code) {
			pages[pages.length - 1].push(...seg.lines);
			continue;
		}
		for (const line of seg.lines) {
			if (PAGE_BREAK.test(line.text)) {
				pages.push([]);
			} else if (PAGE_SINGLE_BREAK.test(line.text)) {
				const marker: MappedLine = { text: SINGLE_COLUMN_MARKER, start: line.start, end: line.end };
				if (pages.length === 1 && isBlankPage(pages[0])) pages[0] = [marker];
				else pages.push([marker]);
			} else pages[pages.length - 1].push(line);
		}
	}
	return pages.map((p) => {
		const copy = [...p];
		while (copy.length && copy[0].text === "") copy.shift();
		while (copy.length && copy[copy.length - 1].text.trim() === "") copy.pop();
		if (copy.length) {
			const last = copy[copy.length - 1];
			copy[copy.length - 1] = { ...last, text: last.text.trimEnd() };
		}
		return copy;
	});
}

/** Splits V3 Markdown into pages on `\page` lines (ignoring fenced code). */
export function splitPages(v3: string): string[] {
	return splitMappedPages(toMappedLines(normalizeNewlines(v3))).map((p) => p.map((l) => l.text).join("\n"));
}

export interface BlockHeader {
	classes: string[];
	id: string;
	styles: string[];
}

/** Parses a block opener such as `monster,frame,#goblin,width:50%`. */
export function parseBlockHeader(header: string): BlockHeader {
	const result: BlockHeader = { classes: [], id: "", styles: [] };
	for (const raw of splitTopLevel(header)) {
		const tok = raw.trim();
		if (!tok) continue;
		if (tok.startsWith("#")) result.id = tok.slice(1).replace(/[^\w-]/g, "");
		else if (/^[\w-]+\s*:/.test(tok)) result.styles.push(tok.replace(/["<>]/g, ""));
		else if (/^[A-Za-z_][\w-]*$/.test(tok)) result.classes.push(tok);
	}
	return result;
}

/** Splits on commas/semicolons that are not inside parentheses or quotes. */
export function splitTopLevel(s: string): string[] {
	const parts: string[] = [];
	let depth = 0;
	let quote = "";
	let cur = "";
	for (const ch of s) {
		if (quote) {
			if (ch === quote) quote = "";
			cur += ch;
		} else if (ch === '"' || ch === "'") {
			quote = ch;
			cur += ch;
		} else if (ch === "(") {
			depth++;
			cur += ch;
		} else if (ch === ")") {
			depth = Math.max(0, depth - 1);
			cur += ch;
		} else if ((ch === "," || ch === ";") && depth === 0) {
			parts.push(cur);
			cur = "";
		} else cur += ch;
	}
	parts.push(cur);
	return parts;
}

function openDiv(header: BlockHeader, start?: number, end?: number): string {
	const cls = ["block", ...header.classes].join(" ");
	const id = header.id ? ` id="${escapeHtml(header.id)}"` : "";
	const style = header.styles.length ? ` style="${escapeHtml(header.styles.join(";"))}"` : "";
	const lineAttrs =
		start !== undefined && end !== undefined ? ` data-line-start="${start}" data-line-end="${end}"` : "";
	return `<div class="${cls}"${id}${style}${lineAttrs}>`;
}

const COLUMN_MARKER = /^[ \t]*\\column[ \t]*$/;
const BLOCK_OPEN = /^[ \t]*\{\{([A-Za-z][^\s{}]*)(?:[ \t]+(.*))?$/;
const BLOCK_ONE_LINER = /^[ \t]*\{\{([A-Za-z][^\s{}]*)(?:[ \t]+((?:(?!\{\{).)*?))?\}\}[ \t]*$/;
const BLOCK_CLOSE = /^[ \t]*\}\}[ \t]*$/;
const DROPCAP_PREFIX = /^[ \t]*\{\{dropcap\}\}[ \t]*(\S.*)$/;
const DL_LINE = /^([^\s<][^\n]*?)\s+::\s+(.*)$/;
const ABILITY_HEADER_ROW = /^\s*\|?\s*STR\s*\|\s*DEX\s*\|\s*CON\s*\|\s*INT\s*\|\s*WIS\s*\|\s*CHA\s*\|?\s*$/i;
const ABILITY_SEP_ROW = /^\s*\|?(?:\s*:?-{2,}:?\s*\|){5}\s*:?-{2,}:?\s*\|?\s*$/;

/** Auto-populates missing modifiers in 6-column `STR | DEX | CON | INT | WIS | CHA` tables. */
function enrichAbilityScoreTablesMapped(lines: MappedLine[]): MappedLine[] {
	const out = lines.map((l) => ({ ...l }));
	for (let i = 0; i + 2 < out.length; i++) {
		if (!ABILITY_HEADER_ROW.test(out[i].text) || !ABILITY_SEP_ROW.test(out[i + 1].text)) continue;
		const row = out[i + 2].text.trim();
		const stripped = row.replace(/^\|/, "").replace(/\|$/, "");
		const cells = stripped.split("|");
		if (cells.length !== 6) continue;
		const formatted = cells.map((cell) => {
			const trimmed = cell.trim();
			if (/^\d{1,2}$/.test(trimmed)) {
				const score = Number(trimmed);
				return ` ${score} (${abilityModifier(score)}) `;
			}
			return ` ${trimmed} `;
		});
		out[i + 2].text = `|${formatted.join("|")}|`;
	}
	return out;
}

/** Block tags that always render as `<div class="block ...">`, even when written on a single line. */
const BLOCK_TAGS = new Set([
	"wide",
	"no-split",
	"note",
	"descriptive",
	"handwritten",
	"monster",
	"classTable",
	"spellList",
	"spell",
	"item",
	"footnote",
	"pageNumber",
	"toc",
	"colophon",
	"singleColumn",
	"twoColumn",
	"no-header",
	"no-footer",
	"dropcap",
	"frame",
	"statblock",
]);

const TABLE_ROW_LINE = /^[ \t]*\|.*$/;
const TABLE_SEPARATOR_LINE = /^[ \t]*\|?[ \t]*:?-{2,}:?[ \t]*(?:\|[ \t]*:?-{2,}:?[ \t]*)*\|?[ \t]*$/;
/** Private-use sentinel standing in for a `||` span placeholder cell until HTML post-processing. */
export const TABLE_SPAN_SENTINEL = "\uE000";

function applyTagStyles(
	header: BlockHeader,
	colorTags: Record<string, string>,
	fontTags: Record<string, string>,
): void {
	const colorHex = header.classes.map((c) => colorTags[c]).find((c) => c !== undefined);
	if (colorHex && !header.styles.some((s) => /^color\s*:/i.test(s))) {
		header.styles.push(`color:${colorHex}`);
	}
	const fontVal = header.classes.map((c) => fontTags[c]).find((f) => f !== undefined);
	if (fontVal && !header.styles.some((s) => /^font-family\s*:/i.test(s))) {
		header.styles.push(`font-family:${fontVal}`);
	}
}

function buildInlineSpanHtml(
	header: BlockHeader,
	innerHtml: string,
	colorTags: Record<string, string>,
	fontTags: Record<string, string>,
): string {
	applyTagStyles(header, colorTags, fontTags);
	const cls = header.classes.length ? ` class="${escapeHtml(header.classes.join(" "))}"` : "";
	const id = header.id ? ` id="${escapeHtml(header.id)}"` : "";
	const style = header.styles.length ? ` style="${escapeHtml(header.styles.join(";"))}"` : "";
	return `<span${cls}${id}${style}>${innerHtml}</span>`;
}

function replaceInlineCurlySpans(
	text: string,
	md: Marked,
	colorTags: Record<string, string>,
	fontTags: Record<string, string>,
): string {
	if (!text.includes("{{")) return text;
	return withInlineCodeProtected(text, (s) =>
		s.replace(/\{\{([A-Za-z][\w-]*(?:,[A-Za-z_#][\w:-]*)*)[ \t]+((?:(?!\{\{|\}\}).)+?)\}\}/g, (match, headerStr: string, content: string) => {
			const header = parseBlockHeader(headerStr);
			if (!header.classes.length || header.classes.some((c) => BLOCK_TAGS.has(c))) return match;
			const inner = md.parseInline(content.trim(), { async: false });
			return buildInlineSpanHtml(header, inner, colorTags, fontTags);
		}),
	);
}

/** Rewrites grouped pipes (`Cell ||`) in table rows into sentinel cells that survive GFM parsing. */
function markTableSpansMapped(lines: MappedLine[]): MappedLine[] {
	return lines.map((line) => {
		if (!TABLE_ROW_LINE.test(line.text) || TABLE_SEPARATOR_LINE.test(line.text)) return line;
		const body = line.text.trim().replace(/^\|/, "");
		const cells = body.split(/(?<!\\)\|/);
		if (cells.length > 1 && cells[cells.length - 1].trim() === "") cells.pop();
		if (!cells.some((c) => c === "")) return line;
		const rebuilt = cells.map((c) => (c === "" ? ` ${TABLE_SPAN_SENTINEL} ` : c)).join("|");
		return { ...line, text: `|${rebuilt}|` };
	});
}

function preprocessBlocksMapped(
	lines: MappedLine[],
	md: Marked,
	colorTags: Record<string, string> = {},
	fontTags: Record<string, string> = {},
): MappedLine[] {
	const openStack: Array<{ outIdx: number; header: BlockHeader; start: number }> = [];
	const out: MappedLine[] = [];

	const pushLine = (text: string, start: number, end: number): number => {
		out.push({ text, start, end });
		return out.length - 1;
	};

	for (const seg of splitFencedMappedSegments(lines)) {
		if (seg.code) {
			out.push(...seg.lines);
			continue;
		}

		const enriched = markTableSpansMapped(enrichAbilityScoreTablesMapped(seg.lines));

		const open = (headerStr: string, line: MappedLine, content?: string): void => {
			const header = parseBlockHeader(headerStr);
			applyTagStyles(header, colorTags, fontTags);
			pushLine("", line.start, line.start);
			const outIdx = pushLine(openDiv(header, line.start, line.end), line.start, line.end);
			pushLine("", line.start, line.start);
			openStack.push({ outIdx, header, start: line.start });
			if (content && content.trim()) {
				pushLine(content, line.start, line.end);
			}
		};

		const inlineSpan = (header: BlockHeader, content: string, line: MappedLine): void => {
			const inner = md.parseInline(content, { async: false });
			pushLine(buildInlineSpanHtml(header, inner, colorTags, fontTags), line.start, line.end);
		};

		const close = (line: MappedLine): void => {
			pushLine("", line.end, line.end);
			pushLine("</div>", line.end, line.end);
			pushLine("", line.end, line.end);
			const entry = openStack.pop();
			if (entry) {
				out[entry.outIdx].text = openDiv(entry.header, entry.start, line.end);
				out[entry.outIdx].end = line.end;
			}
		};

		for (let i = 0; i < enriched.length; i++) {
			const line = enriched[i];
			let m: RegExpExecArray | null;
			if (COLUMN_MARKER.test(line.text)) {
				pushLine("", line.start, line.end);
				pushLine('<div class="columnSplit"></div>', line.start, line.end);
				pushLine("", line.start, line.end);
			} else if (/^[ \t]*:+[ \t]*$/.test(line.text)) {
				const n = line.text.trim().length;
				pushLine("", line.start, line.end);
				pushLine(`<div class="blank hb-spacer" style="height:calc(0.6em * ${n})"></div>`, line.start, line.end);
				pushLine("", line.start, line.end);
			} else if ((m = DROPCAP_PREFIX.exec(line.text))) {
				pushLine("", line.start, line.end);
				pushLine('<div class="dropcap-marker"></div>', line.start, line.end);
				pushLine("", line.start, line.end);
				pushLine(m[1], line.start, line.end);
			} else if ((m = BLOCK_ONE_LINER.exec(line.text))) {
				const content = (m[2] ?? "").trim();
				const header = parseBlockHeader(m[1]);
				if (m[1] === "dropcap" && !content) {
					pushLine("", line.start, line.end);
					pushLine('<div class="dropcap-marker"></div>', line.start, line.end);
					pushLine("", line.start, line.end);
				} else if (content && header.classes.length > 0 && !header.classes.some((c) => BLOCK_TAGS.has(c))) {
					inlineSpan(header, content, line);
				} else {
					open(m[1], line, content);
					close(line);
				}
			} else if ((m = BLOCK_OPEN.exec(line.text)) && !(m[2] ?? "").includes("}}")) {
				open(m[1], line, m[2]);
			} else if (openStack.length > 0 && BLOCK_CLOSE.test(line.text)) {
				close(line);
			} else if (openStack.length > 0 && /\}\}[ \t]*$/.test(line.text) && !line.text.includes("{{")) {
				pushLine(line.text.replace(/[ \t]*\}\}[ \t]*$/, ""), line.start, line.end);
				close(line);
			} else if (DL_LINE.test(line.text)) {
				const dlStart = line.start;
				let dlEnd = line.end;
				const rows: Array<{ term: string; def: string }> = [];
				while (i < enriched.length) {
					const dlm = DL_LINE.exec(enriched[i].text);
					if (!dlm) break;
					dlEnd = enriched[i].end;
					rows.push({ term: dlm[1].trim(), def: dlm[2].trim() });
					i++;
				}
				i--;
				const rowsHtml = rows
					.map((r) => {
						const dt = md.parseInline(r.term, { async: false });
						const dd = md.parseInline(r.def, { async: false });
						return `<div class="hb-dl-row"><dt>${dt}</dt><dd>${dd}</dd></div>`;
					})
					.join("");
				pushLine("", dlStart, dlStart);
				pushLine(`<dl class="hb-dl" data-line-start="${dlStart}" data-line-end="${dlEnd}">${rowsHtml}</dl>`, dlStart, dlEnd);
				pushLine("", dlEnd, dlEnd);
			} else {
				out.push({ ...line, text: replaceInlineCurlySpans(line.text, md, colorTags, fontTags) });
			}
		}
	}

	const lastEnd = lines.length ? lines[lines.length - 1].end : 0;
	while (openStack.length > 0) {
		const entry = openStack.pop()!;
		out[entry.outIdx].text = openDiv(entry.header, entry.start, lastEnd);
		out[entry.outIdx].end = lastEnd;
		out.push({ text: "", start: lastEnd, end: lastEnd });
		out.push({ text: "</div>", start: lastEnd, end: lastEnd });
		out.push({ text: "", start: lastEnd, end: lastEnd });
	}

	return out;
}

/**
 * Rewrites V3 block syntax (`{{wide`, `{{note`, `}}`, `\column`, `{{dropcap}}`, `:` spacers)
 * into HTML wrappers surrounded by blank lines so Markdown inside them still parses.
 */
export function preprocessBlocks(text: string): string {
	const md = createBookMarked();
	return preprocessBlocksMapped(toMappedLines(text), md)
		.map((l) => l.text)
		.join("\n");
}

function offsetToLineIndex(offset: number, lineStarts: number[]): number {
	let lo = 0;
	let hi = lineStarts.length - 1;
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		if (lineStarts[mid] <= offset) lo = mid;
		else hi = mid - 1;
	}
	return lo;
}

function attachTokenLineSpans(tokens: Token[], processed: MappedLine[], src: string, spans: WeakMap<object, LineSpan>): void {
	if (!processed.length || !src) return;
	const lineStarts: number[] = [0];
	for (let i = 0; i < processed.length - 1; i++) {
		lineStarts.push(lineStarts[i] + processed[i].text.length + 1);
	}

	let pos = 0;
	for (const tok of tokens) {
		const rawLen = tok.raw.length;
		if (tok.type !== "space") {
			const leadMatch = /^\n+/.exec(tok.raw);
			const leadNl = leadMatch ? leadMatch[0].length : 0;
			const trimmed = tok.raw.replace(/\n+$/, "");
			if (trimmed.length > 0) {
				const startOff = Math.min(src.length - 1, pos + leadNl);
				const endOff = Math.min(src.length - 1, startOff + trimmed.length - 1);
				const pStart = offsetToLineIndex(startOff, lineStarts);
				const pEnd = offsetToLineIndex(endOff, lineStarts);
				spans.set(tok, {
					start: processed[pStart].start,
					end: processed[pEnd].end,
				});
			}
		}
		pos += rawLen;
	}
}

/** Resolves every `<img src>` in rendered HTML through the supplied resolver. */
function resolveImagesInHtml(html: string, resolve?: RenderOptions["resolveImageSrc"]): string {
	if (!resolve) return html;
	return html.replace(/(<img\b[^>]*?\bsrc=)(["'])(.*?)\2/gi, (m, pre: string, q: string, src: string) => {
		const raw = decodeHtmlEntities(src);
		if (raw.startsWith("data:")) return m;
		const resolved = resolve(raw);
		return resolved ? `${pre}${q}${escapeHtml(resolved)}${q}` : m;
	});
}

const AUTO_PAGE_NUMBER_DIV = /(<div\b[^>]*\bclass="[^"]*\bpageNumber\b[^"]*\bauto\b[^"]*"[^>]*>)\s*<\/div>/gi;

function renderMappedPageHtml(pageLines: MappedLine[], options: RenderOptions = {}): string {
	if (!pageLines.length) return "";
	const spans = new WeakMap<object, LineSpan>();
	const md = createBookMarked(spans);
	const processed = preprocessBlocksMapped(pageLines, md, options.colorTags ?? {}, options.fontTags ?? {});
	const src = processed.map((l) => l.text).join("\n");
	const tokens = md.lexer(src);
	attachTokenLineSpans(tokens, processed, src, spans);

	let html = postprocessBookHtml(md.parser(tokens));
	if (options.pageNumber !== undefined) {
		html = html.replace(AUTO_PAGE_NUMBER_DIV, `$1${options.pageNumber}</div>`);
	}
	return resolveImagesInHtml(html, options.resolveImageSrc);
}

/** Renders a single page of V3 Markdown to HTML with source-line attributes. */
export function renderPageHtml(pageMarkdown: string, options: RenderOptions = {}): string {
	const lines = toMappedLines(normalizeNewlines(pageMarkdown), options.lineOffset ?? 0);
	return renderMappedPageHtml(lines, options);
}

/** Renders V3 Markdown into one HTML fragment per `\page`, preserving 0-based source line spans. */
export function renderHomebreweryPages(v3: string, options: RenderOptions = {}): string[] {
	const pages = splitMappedPages(toMappedLines(normalizeNewlines(v3))).map((pageLines, idx) =>
		renderMappedPageHtml(pageLines, { ...options, pageNumber: options.pageNumber ?? idx + 1 }),
	);
	return pages.length ? pages : [""];
}

/**
 * Transpiles Obsidian Markdown once into V3 Markdown plus a page renderer that
 * retains original 0-based source line numbers for editor-to-preview tracking.
 */
export function prepareMappedBook(
	markdown: string,
	options: TranspileOptions = {},
): {
	v3: string;
	frontmatterOverrides: BookFrontmatterOverrides;
	renderPages: (renderOpts?: RenderOptions) => string[];
} {
	const { v3, lines, frontmatterOverrides } = obsidianToHomebreweryMapped(markdown, options);
	return { ...prepareBookFromMappedLines(v3, lines), frontmatterOverrides };
}

function prepareBookFromMappedLines(
	v3: string,
	lines: MappedLine[],
): { v3: string; renderPages: (renderOpts?: RenderOptions) => string[] } {
	const mappedPages = splitMappedPages(lines);
	return {
		v3,
		renderPages: (renderOpts: RenderOptions = {}) => {
			const pages = mappedPages.map((pageLines, idx) =>
				renderMappedPageHtml(pageLines, { ...renderOpts, pageNumber: renderOpts.pageNumber ?? idx + 1 }),
			);
			return pages.length ? pages : [""];
		},
	};
}

/**
 * Concatenates already-transpiled V3 chapters (each note's YAML frontmatter has been
 * stripped by `obsidianToHomebrewery`) into one book, starting every chapter on a new
 * page so `{{pageNumber,auto}}` numbering is continuous across the whole book.
 */
export function joinBookChapters(v3Chapters: string[]): string {
	const parts = v3Chapters.map((c) => c.trim()).filter((c) => c !== "");
	return parts.length ? `${parts.join("\n\n\\page\n\n")}\n` : "\n";
}

/** Prepares a page renderer for an already-compiled V3 book (e.g. a multi-note compilation). */
export function prepareBookFromV3(v3: string): { v3: string; renderPages: (renderOpts?: RenderOptions) => string[] } {
	const normalized = normalizeNewlines(v3);
	return prepareBookFromMappedLines(normalized, toMappedLines(normalized));
}

/** Convenience: Obsidian Markdown straight to V3 + HTML pages with source-line mapping. */
export function transpileToBook(
	markdown: string,
	options: TranspileOptions & RenderOptions = {},
): { v3: string; pages: string[]; frontmatterOverrides: BookFrontmatterOverrides } {
	const prepared = prepareMappedBook(markdown, options);
	return {
		v3: prepared.v3,
		pages: prepared.renderPages(options),
		frontmatterOverrides: prepared.frontmatterOverrides,
	};
}

// ---------------------------------------------------------------------------
// Image reference helpers (used by the Obsidian-side compiler)
// ---------------------------------------------------------------------------

const MD_IMAGE = /!\[[^\]\n]*\]\((<[^>\n]+>|[^)\s]+)(?:\s+"[^"\n]*")?\)/g;
const HTML_IMAGE = /<img\b[^>]*?\bsrc=(["'])(.*?)\1/gi;

/** Collects every image URL (Markdown and raw HTML) referenced outside fenced code. */
export function collectImageUrls(v3: string): string[] {
	const urls = new Set<string>();
	for (const seg of splitFencedSegments(normalizeNewlines(v3))) {
		if (seg.code) continue;
		for (const m of seg.text.matchAll(MD_IMAGE)) urls.add(stripAngles(m[1]));
		for (const m of seg.text.matchAll(HTML_IMAGE)) urls.add(decodeHtmlEntities(m[2]));
	}
	return [...urls];
}

/** Rewrites Markdown image URLs (outside fenced code) through `fn`. */
export function replaceImageUrls(v3: string, fn: (url: string) => string): string {
	return splitFencedSegments(normalizeNewlines(v3))
		.map((seg) =>
			seg.code
				? seg.text
				: seg.text.replace(/(!\[[^\]\n]*\]\()(<[^>\n]+>|[^)\s]+)/g, (_m, pre: string, url: string) => `${pre}${fn(stripAngles(url))}`),
		)
		.join("\n");
}

export { PAGE_MARKER_REGEX };
const PAGE_MARKER_REGEX = /^[ \t]*\\page[ \t]*$/m;
