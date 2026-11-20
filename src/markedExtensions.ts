/**
 * Marked configuration, source-line renderer, and Homebrewery V3 post-processing.
 */

import { Marked, Renderer, type Tokens } from "marked";
import { escapeHtml, splitFencedSegments } from "./utils";

export interface LineSpan {
	start: number;
	end: number;
}

const DL_LINE = /^([^\s<][^\n]*?)\s+::\s+(.*)$/;
const IMG_ATTRS = /(<img\b[^>]*?>)\s*\{([^}<>\n]+)\}/gi;
const DROPCAP_DIV = /<div class="dropcap-marker"><\/div>\s*<p([^>]*)>/gi;
const STANDALONE_IMG_P = /<p([^>]*)>\s*(<img\b[^>]*?>)\s*<\/p>/gi;

const WRAPPER_IMAGE_CLASSES = new Set([
	"hb-img-bg",
	"hb-img-bg-width",
	"hb-img-bg-height",
	"hb-img-top",
	"hb-img-bottom",
	"hb-img-col",
	"hb-img-inline",
	"hb-img-left",
	"hb-img-right",
	"hb-img-fade",
]);

const ALIGNMENT_MODES = new Set([
	"hb-img-bg",
	"hb-img-top",
	"hb-img-bottom",
	"hb-img-col",
	"hb-img-inline",
	"hb-img-left",
	"hb-img-right",
]);

interface ParsedImgAttrs {
	id: string;
	classes: string[];
	styles: string[];
}

function parseImgAttrs(raw: string): ParsedImgAttrs {
	const result: ParsedImgAttrs = { id: "", classes: [], styles: [] };
	for (const part of raw.split(/[,;]/)) {
		const tok = part.trim();
		if (!tok) continue;
		if (tok.startsWith("#")) {
			result.id = tok.slice(1).replace(/[^\w-]/g, "");
		} else if (tok.startsWith(".")) {
			const cls = tok.slice(1).replace(/[^\w-]/g, "");
			if (cls) result.classes.push(cls);
		} else if (/^[\w-]+\s*:/.test(tok)) {
			result.styles.push(tok.replace(/["<>]/g, ""));
		} else if (/^[A-Za-z_][\w-]*$/.test(tok)) {
			result.classes.push(tok);
		}
	}
	return result;
}

function injectAttribute(tag: string, name: string, value: string): string {
	const existing = new RegExp(`\\b${name}=(["'])(.*?)\\1`, "i");
	if (existing.test(tag)) {
		return tag.replace(existing, (_m, q: string, prev: string) => {
			const sep = name === "style" ? ";" : " ";
			const joined = prev ? `${prev}${sep}${value}` : value;
			return `${name}=${q}${escapeHtml(joined)}${q}`;
		});
	}
	return tag.replace(/\/?>$/, (end) => ` ${name}="${escapeHtml(value)}"${end}`);
}

function readAttr(tag: string, name: string): string | null {
	const m = new RegExp(`\\b${name}=(["'])(.*?)\\1`, "i").exec(tag);
	return m ? m[2] : null;
}

function setOrRemoveAttr(tag: string, name: string, value: string): string {
	const existing = new RegExp(`\\s*\\b${name}=(["']).*?\\1`, "i");
	const stripped = tag.replace(existing, "");
	if (!value) return stripped;
	return stripped.replace(/\/?>$/, (end) => ` ${name}="${escapeHtml(value)}"${end}`);
}

/**
 * Converts Homebrewery V3 `Term :: Definition` runs (outside fenced code blocks)
 * into semantic `<dl class="hb-dl">` blocks before block-level Markdown parsing.
 */
export function preprocessDefinitionLists(markdown: string, md: Marked): string {
	return splitFencedSegments(markdown)
		.map((seg) => {
			if (seg.code) return seg.text;
			const lines = seg.text.split("\n");
			const out: string[] = [];
			let i = 0;
			while (i < lines.length) {
				const first = DL_LINE.exec(lines[i]);
				if (!first) {
					out.push(lines[i]);
					i++;
					continue;
				}
				const rows: Array<{ term: string; def: string }> = [];
				while (i < lines.length) {
					const m = DL_LINE.exec(lines[i]);
					if (!m) break;
					rows.push({ term: m[1].trim(), def: m[2].trim() });
					i++;
				}
				const rowsHtml = rows
					.map((r) => {
						const dt = md.parseInline(r.term, { async: false });
						const dd = md.parseInline(r.def, { async: false });
						return `<div class="hb-dl-row"><dt>${dt}</dt><dd>${dd}</dd></div>`;
					})
					.join("");
				out.push("", `<dl class="hb-dl">${rowsHtml}</dl>`, "");
			}
			return out.join("\n");
		})
		.join("\n");
}

function applyImageAttributes(html: string): string {
	return html.replace(IMG_ATTRS, (_m, imgTag: string, rawAttrs: string) => {
		const parsed = parseImgAttrs(rawAttrs);
		let updated = imgTag;
		if (parsed.id) updated = injectAttribute(updated, "id", parsed.id);
		if (parsed.classes.length) updated = injectAttribute(updated, "class", parsed.classes.join(" "));
		if (parsed.styles.length) updated = injectAttribute(updated, "style", parsed.styles.join(";"));
		return updated;
	});
}

function promoteImageWrappers(html: string): string {
	return html.replace(STANDALONE_IMG_P, (_m, pAttrs: string, imgTag: string) => {
		const rawClasses = (readAttr(imgTag, "class") ?? "").split(/\s+/).filter(Boolean);
		const wrapperClasses = ["hb-image-wrapper"];
		const remainingImgClasses: string[] = [];

		for (const cls of rawClasses) {
			if (WRAPPER_IMAGE_CLASSES.has(cls)) wrapperClasses.push(cls);
			else remainingImgClasses.push(cls);
		}
		if (!wrapperClasses.some((cls) => ALIGNMENT_MODES.has(cls))) {
			wrapperClasses.push("hb-img-inline");
		}

		const isBg = wrapperClasses.includes("hb-img-bg");
		const isFloat = wrapperClasses.includes("hb-img-left") || wrapperClasses.includes("hb-img-right");
		const isBanner = wrapperClasses.includes("hb-img-top") || wrapperClasses.includes("hb-img-bottom");

		const rawStyles = (readAttr(imgTag, "style") ?? "")
			.split(";")
			.map((s) => s.trim())
			.filter(Boolean);
		const wrapperStyles: string[] = [];
		const remainingImgStyles: string[] = [];

		for (const decl of rawStyles) {
			const prop = decl.split(":")[0]?.trim().toLowerCase() ?? "";
			const val = decl.slice(decl.indexOf(":") + 1).trim();
			if (isBg && prop === "opacity") {
				wrapperStyles.push(decl);
			} else if (prop === "--hb-fade") {
				wrapperStyles.push(decl);
			} else if (isFloat && prop === "width" && val.endsWith("%")) {
				wrapperStyles.push(decl);
			} else if (isBanner && prop === "height" && val.endsWith("%")) {
				wrapperStyles.push(decl);
			} else {
				remainingImgStyles.push(decl);
			}
		}

		let updatedImg = setOrRemoveAttr(imgTag, "class", remainingImgClasses.join(" "));
		updatedImg = setOrRemoveAttr(updatedImg, "style", remainingImgStyles.join(";"));

		const styleAttr = wrapperStyles.length ? ` style="${escapeHtml(wrapperStyles.join(";"))}"` : "";
		return `<div class="${escapeHtml(wrapperClasses.join(" "))}"${styleAttr}${pAttrs}>${updatedImg}</div>`;
	});
}

const TABLE_SPAN_SENTINEL = "\uE000";
const TABLE_BLOCK = /<table\b[\s\S]*?<\/table>/gi;
const TABLE_ROW = /<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi;
const TABLE_CELL = /<(td|th)\b([^>]*)>([\s\S]*?)<\/\1>/gi;

interface SpanCell {
	tag: string;
	attrs: string;
	content: string;
	colspan: number;
	rowspan: number;
	col: number;
	removed: boolean;
}

/**
 * Applies V3 table cell spanning to rendered tables: sentinel cells (`Cell ||`) extend the
 * previous cell via `colspan`, and `^` cells merge into the cell above via `rowspan`.
 */
export function applyTableSpans(html: string): string {
	if (!html.includes(TABLE_SPAN_SENTINEL) && !/<t[dh]\b[^>]*>\s*\^\s*<\/t[dh]>/i.test(html)) return html;

	return html.replace(TABLE_BLOCK, (table) => {
		const rows: Array<{ open: string; cells: SpanCell[] }> = [];
		let hasSpans = false;
		table.replace(TABLE_ROW, (_m, rowAttrs: string, inner: string) => {
			const cells: SpanCell[] = [];
			inner.replace(TABLE_CELL, (_c, tag: string, attrs: string, content: string) => {
				cells.push({ tag, attrs, content, colspan: 1, rowspan: 1, col: 0, removed: false });
				return "";
			});
			rows.push({ open: rowAttrs, cells });
			return "";
		});
		if (!rows.length) return table;

		const ownerAt: Array<SpanCell | undefined> = [];
		for (const row of rows) {
			// Pass 1: column spans from sentinel cells.
			let last: SpanCell | null = null;
			let col = 0;
			for (const cell of row.cells) {
				const text = cell.content.trim();
				if (text === TABLE_SPAN_SENTINEL) {
					cell.removed = true;
					hasSpans = true;
					if (last) last.colspan++;
					else {
						// Leading span marker with nothing to extend: keep a plain empty cell.
						cell.removed = false;
						cell.content = "";
						cell.col = col;
						last = cell;
					}
					col++;
					continue;
				}
				cell.col = col;
				last = cell;
				col++;
			}
			// Pass 2: row spans from caret cells.
			for (const cell of row.cells) {
				if (cell.removed) continue;
				if (cell.content.trim() === "^" && ownerAt[cell.col]) {
					const owner = ownerAt[cell.col];
					if (owner) owner.rowspan++;
					cell.removed = true;
					hasSpans = true;
					continue;
				}
				for (let c = cell.col; c < cell.col + cell.colspan; c++) ownerAt[c] = cell;
			}
		}
		if (!hasSpans) return table;

		let rowIdx = 0;
		return table.replace(TABLE_ROW, (_m, rowAttrs: string) => {
			const row = rows[rowIdx++];
			const cellsHtml = row.cells
				.filter((cell) => !cell.removed)
				.map((cell) => {
					const span = `${cell.colspan > 1 ? ` colspan="${cell.colspan}"` : ""}${cell.rowspan > 1 ? ` rowspan="${cell.rowspan}"` : ""}`;
					return `<${cell.tag}${cell.attrs}${span}>${cell.content}</${cell.tag}>`;
				})
				.join("");
			return `<tr${rowAttrs}>${cellsHtml}</tr>`;
		});
	});
}

/** Applies Homebrewery image attributes, wrapper promotion, table spans, and dropcap markers to HTML. */
export function postprocessBookHtml(html: string): string {
	return applyTableSpans(promoteImageWrappers(applyImageAttributes(html))).replace(
		DROPCAP_DIV,
		'<p class="hb-dropcap"$1>',
	);
}

function addLineAttrs(html: string, token: object, spans?: WeakMap<object, LineSpan>): string {
	const span = spans?.get(token);
	if (!span) return html;
	return html.replace(/^(<\w+)/, `$1 data-line-start="${span.start}" data-line-end="${span.end}"`);
}

/** Creates a `Marked` instance configured for D&D 5e / Homebrewery V3 book rendering. */
export function createBookMarked(spans?: WeakMap<object, LineSpan>): Marked {
	const base = new Renderer();
	const md = new Marked({
		gfm: true,
		breaks: false,
	});

	md.use({
		renderer: spans
			? {
					heading(this: Renderer, token: Tokens.Heading): string {
						return addLineAttrs(base.heading.call(this, token), token, spans);
					},
					paragraph(this: Renderer, token: Tokens.Paragraph): string {
						return addLineAttrs(base.paragraph.call(this, token), token, spans);
					},
					table(this: Renderer, token: Tokens.Table): string {
						return addLineAttrs(base.table.call(this, token), token, spans);
					},
					blockquote(this: Renderer, token: Tokens.Blockquote): string {
						return addLineAttrs(base.blockquote.call(this, token), token, spans);
					},
					list(this: Renderer, token: Tokens.List): string {
						return addLineAttrs(base.list.call(this, token), token, spans);
					},
					code(this: Renderer, token: Tokens.Code): string {
						return addLineAttrs(base.code.call(this, token), token, spans);
					},
			  }
			: {},
		hooks: {
			preprocess(src: string): string {
				return spans ? src : preprocessDefinitionLists(src, md);
			},
			postprocess(html: string): string {
				return postprocessBookHtml(html);
			},
		},
	});

	return md;
}
