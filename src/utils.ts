/**
 * Shared string / markdown utilities (no Obsidian imports).
 */

export interface Segment {
	code: boolean;
	text: string;
	info: string;
}

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "bmp", "svg", "webp", "avif"]);

export function normalizeNewlines(s: string): string {
	return s.replace(/\r\n?/g, "\n");
}

export function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

export function decodeHtmlEntities(s: string): string {
	return s
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&");
}

export function safeDecodeUri(s: string): string {
	try {
		return decodeURI(s);
	} catch {
		return s;
	}
}

export function isExternalUrl(url: string): boolean {
	return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(url.trim());
}

export function isImagePath(path: string): boolean {
	const clean = path.split(/[?#]/)[0];
	if (!clean.includes(".")) return false;
	const ext = clean.slice(clean.lastIndexOf(".") + 1).toLowerCase();
	return IMAGE_EXTENSIONS.has(ext);
}

export function encodeImageUrl(path: string): string {
	if (isExternalUrl(path)) return path;
	return path.replace(/ /g, "%20").replace(/\(/g, "%28").replace(/\)/g, "%29");
}

export function stripAngles(url: string): string {
	return url.startsWith("<") && url.endsWith(">") ? url.slice(1, -1) : url;
}

/** Splits text into fenced-code and prose segments (line based). */
export function splitFencedSegments(text: string): Segment[] {
	const lines = text.split("\n");
	const segments: Segment[] = [];
	let buf: string[] = [];
	let fenceChar = "";
	let fenceLen = 0;
	let info = "";

	const flush = (code: boolean): void => {
		if (buf.length) segments.push({ code, text: buf.join("\n"), info: code ? info : "" });
		buf = [];
	};

	for (const line of lines) {
		if (!fenceChar) {
			const m = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
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
			const trimmed = line.trim();
			const isClose =
				/^ {0,3}\S/.test(line) || trimmed === ""
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

const MASK_OPEN = "\uE000";
const MASK_CLOSE = "\uE001";

/** Temporarily masks inline code spans so inline transforms never touch them. */
export function withInlineCodeProtected(text: string, fn: (masked: string) => string): string {
	const stash: string[] = [];
	const masked = text.replace(/(`+)(?:(?!\1)[^\n])+?\1(?!`)/g, (m) => {
		stash.push(m);
		return `${MASK_OPEN}${stash.length - 1}${MASK_CLOSE}`;
	});
	const restore = new RegExp(`${MASK_OPEN}(\\d+)${MASK_CLOSE}`, "g");
	return fn(masked).replace(restore, (_m, i: string) => stash[Number(i)]);
}
