/**
 * Minimal, dependency-free YAML subset parser.
 *
 * Inside Obsidian the plugin uses the built-in `parseYaml`; this parser is the
 * fallback used by the pure transpiler (and therefore by unit tests). It
 * supports the subset of YAML used by statblock frontmatter: scalars, quoted
 * strings, flow sequences/maps, block sequences, nested maps, sequences of maps
 * and literal/folded block scalars.
 */

export type YamlScalar = string | number | boolean | null;
export type YamlValue = YamlScalar | YamlValue[] | YamlMap;
export interface YamlMap {
	[key: string]: YamlValue;
}

export function isYamlMap(v: unknown): v is YamlMap {
	return typeof v === "object" && v !== null && !Array.isArray(v);
}

const SEQ_ITEM = /^-(?:\s|$)/;
const MAP_ENTRY = /^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^\s"'#\[{\-][^:]*?|-[^\s:][^:]*?)\s*:(?:\s+(.*))?$/;

function indentOf(line: string): number {
	return line.length - line.trimStart().length;
}

function stripComment(s: string): string {
	const idx = s.search(/(^|\s)#/);
	return idx < 0 ? s : s.slice(0, idx).trimEnd();
}

function splitFlow(inner: string): string[] {
	const parts: string[] = [];
	let depth = 0;
	let quote: string | null = null;
	let cur = "";
	for (const ch of inner) {
		if (quote) {
			cur += ch;
			if (ch === quote) quote = null;
			continue;
		}
		if (ch === '"' || ch === "'") {
			quote = ch;
			cur += ch;
		} else if (ch === "[" || ch === "{") {
			depth++;
			cur += ch;
		} else if (ch === "]" || ch === "}") {
			depth--;
			cur += ch;
		} else if (ch === "," && depth === 0) {
			parts.push(cur);
			cur = "";
		} else {
			cur += ch;
		}
	}
	if (cur.trim() !== "") parts.push(cur);
	return parts.map((p) => p.trim()).filter((p) => p !== "");
}

function unquote(s: string): string {
	if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
		return s
			.slice(1, -1)
			.replace(/\\n/g, "\n")
			.replace(/\\t/g, "\t")
			.replace(/\\(["\\])/g, "$1");
	}
	if (s.length >= 2 && s.startsWith("'") && s.endsWith("'")) {
		return s.slice(1, -1).replace(/''/g, "'");
	}
	return s;
}

export function parseYamlScalar(raw: string): YamlValue {
	const s = raw.trim();
	if (s === "" || s === "~" || /^null$/i.test(s)) return null;
	if (s.startsWith('"')) {
		const m = /^"((?:[^"\\]|\\.)*)"/.exec(s);
		return m ? unquote(`"${m[1]}"`) : s.slice(1);
	}
	if (s.startsWith("'")) {
		const m = /^'((?:[^']|'')*)'/.exec(s);
		return m ? unquote(`'${m[1]}'`) : s.slice(1);
	}
	if (s.startsWith("[")) {
		const end = s.lastIndexOf("]");
		const inner = s.slice(1, end < 0 ? undefined : end);
		return splitFlow(inner).map(parseYamlScalar);
	}
	if (s.startsWith("{")) {
		const end = s.lastIndexOf("}");
		const inner = s.slice(1, end < 0 ? undefined : end);
		const out: YamlMap = {};
		for (const part of splitFlow(inner)) {
			const idx = part.indexOf(":");
			if (idx < 0) out[unquote(part)] = null;
			else out[unquote(part.slice(0, idx).trim())] = parseYamlScalar(part.slice(idx + 1));
		}
		return out;
	}
	const v = stripComment(s);
	if (/^(true|yes|on)$/i.test(v)) return true;
	if (/^(false|no|off)$/i.test(v)) return false;
	if (/^[-+]?\d+(\.\d+)?$/.test(v)) return Number(v);
	return v;
}

class MiniYamlParser {
	private i = 0;

	constructor(private readonly lines: string[]) {}

	parseDocument(): YamlValue {
		return this.parseNode(0);
	}

	private skipBlank(): void {
		while (this.i < this.lines.length) {
			const t = this.lines[this.i].trim();
			if (t === "" || t.startsWith("#")) this.i++;
			else break;
		}
	}

	private parseNode(minIndent: number): YamlValue {
		this.skipBlank();
		if (this.i >= this.lines.length) return null;
		const line = this.lines[this.i];
		const ind = indentOf(line);
		if (ind < minIndent) return null;
		const t = line.trim();
		if (SEQ_ITEM.test(t)) return this.parseSeq(ind);
		if (MAP_ENTRY.test(t)) return this.parseMap(ind);
		this.i++;
		return parseYamlScalar(t);
	}

	private parseSeq(ind: number): YamlValue[] {
		const out: YamlValue[] = [];
		for (;;) {
			this.skipBlank();
			if (this.i >= this.lines.length) break;
			const line = this.lines[this.i];
			const li = indentOf(line);
			const t = line.trim();
			if (li !== ind || !SEQ_ITEM.test(t)) break;
			const afterDash = t.slice(1);
			const rest = afterDash.trim();
			if (rest === "") {
				this.i++;
				out.push(this.parseNode(ind + 1));
				continue;
			}
			const col = li + 1 + (afterDash.length - afterDash.trimStart().length);
			if (SEQ_ITEM.test(rest) || MAP_ENTRY.test(rest)) {
				this.lines[this.i] = " ".repeat(col) + rest;
				out.push(this.parseNode(col));
			} else {
				this.i++;
				out.push(parseYamlScalar(rest));
			}
		}
		return out;
	}

	private parseMap(ind: number): YamlMap {
		const out: YamlMap = {};
		for (;;) {
			this.skipBlank();
			if (this.i >= this.lines.length) break;
			const line = this.lines[this.i];
			const li = indentOf(line);
			if (li !== ind) break;
			const m = MAP_ENTRY.exec(line.trim());
			if (!m) break;
			const key = unquote(m[1].trim());
			const rest = (m[2] ?? "").trim();
			this.i++;
			if (rest === "" || rest.startsWith("#")) {
				this.skipBlank();
				if (this.i < this.lines.length) {
					const next = this.lines[this.i];
					const ni = indentOf(next);
					if (ni > ind) out[key] = this.parseNode(ni);
					else if (ni === ind && SEQ_ITEM.test(next.trim())) out[key] = this.parseSeq(ind);
					else out[key] = null;
				} else {
					out[key] = null;
				}
			} else if (/^[|>][-+]?\d*\s*(#.*)?$/.test(rest)) {
				out[key] = this.parseBlockScalar(ind, rest.startsWith("|"));
			} else {
				out[key] = parseYamlScalar(rest);
			}
		}
		return out;
	}

	private parseBlockScalar(parentIndent: number, literal: boolean): string {
		const collected: string[] = [];
		let blockIndent = -1;
		while (this.i < this.lines.length) {
			const line = this.lines[this.i];
			if (line.trim() === "") {
				collected.push("");
				this.i++;
				continue;
			}
			const li = indentOf(line);
			if (li <= parentIndent) break;
			if (blockIndent < 0) blockIndent = li;
			collected.push(line.slice(Math.min(blockIndent, li)));
			this.i++;
		}
		while (collected.length && collected[collected.length - 1] === "") collected.pop();
		if (literal) return collected.join("\n");
		let out = "";
		let prevBlank = true;
		for (const l of collected) {
			if (l === "") {
				out += "\n";
				prevBlank = true;
			} else {
				out += (prevBlank ? "" : " ") + l.trim();
				prevBlank = false;
			}
		}
		return out;
	}
}

/** Parses a YAML document; returns `{}` when the root is not a mapping. */
export function parseSimpleYaml(src: string): YamlMap {
	const lines = src.replace(/\r\n?/g, "\n").replace(/\t/g, "  ").split("\n");
	const doc = new MiniYamlParser(lines).parseDocument();
	return isYamlMap(doc) ? doc : {};
}
