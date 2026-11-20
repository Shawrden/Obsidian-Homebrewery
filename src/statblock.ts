/**
 * Converts structured monster data (YAML frontmatter or ```statblock fences)
 * into a Homebrewery V3 `{{monster,frame ... }}` block.
 */

import { isYamlMap } from "./yaml";

type Data = Record<string, unknown>;

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
const ABILITY_LONG: Record<(typeof ABILITIES)[number], string> = {
	str: "strength",
	dex: "dexterity",
	con: "constitution",
	int: "intelligence",
	wis: "wisdom",
	cha: "charisma",
};

const CR_XP: Record<string, number> = {
	"0": 10, "1/8": 25, "1/4": 50, "1/2": 100, "1": 200, "2": 450, "3": 700, "4": 1100,
	"5": 1800, "6": 2300, "7": 2900, "8": 3900, "9": 5000, "10": 5900, "11": 7200,
	"12": 8400, "13": 10000, "14": 11500, "15": 13000, "16": 15000, "17": 18000,
	"18": 20000, "19": 22000, "20": 25000, "21": 33000, "22": 41000, "23": 50000,
	"24": 62000, "25": 75000, "26": 90000, "27": 105000, "28": 120000, "29": 135000,
	"30": 155000,
};

function isTruthy(v: unknown): boolean {
	return v === true || (typeof v === "string" && /^(true|yes|on|1)$/i.test(v.trim())) || v === 1;
}

/** True when frontmatter declares `statblock: true` or `type: monster`. */
export function isStatblockFrontmatter(fm: Data | null | undefined): boolean {
	if (!fm) return false;
	if (isTruthy(fm.statblock)) return true;
	return typeof fm.type === "string" && fm.type.trim().toLowerCase() === "monster";
}

function present(v: unknown): boolean {
	return v !== undefined && v !== null && !(typeof v === "string" && v.trim() === "");
}

function get(data: Data, ...keys: string[]): unknown {
	for (const k of keys) if (present(data[k])) return data[k];
	return undefined;
}

function text(v: unknown): string {
	if (!present(v)) return "";
	if (Array.isArray(v)) return v.map(text).filter(Boolean).join(", ");
	if (isYamlMap(v)) return Object.entries(v).map(([k, val]) => `${k} ${text(val)}`.trim()).join(", ");
	return String(v).trim();
}

function toNumber(v: unknown, fallback = 10): number {
	const n = typeof v === "number" ? v : Number(String(v ?? "").trim());
	return Number.isFinite(n) ? n : fallback;
}

/** 5e ability modifier, formatted with an explicit sign (e.g. `+2`, `-1`). */
export function abilityModifier(score: number): string {
	const mod = Math.floor((score - 10) / 2);
	return mod >= 0 ? `+${mod}` : `${mod}`;
}

function signed(v: unknown): string {
	if (typeof v === "string" && /^[+-]/.test(v.trim())) return v.trim();
	const n = Number(v);
	if (Number.isFinite(n)) return n >= 0 ? `+${n}` : `${n}`;
	return text(v);
}

function titleCase(key: string): string {
	return key
		.replace(/[_-]+/g, " ")
		.split(" ")
		.filter(Boolean)
		.map((w, i) => (i > 0 && /^(of|and|the)$/i.test(w) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)))
		.join(" ");
}

function bonusList(v: unknown): string {
	if (!present(v)) return "";
	if (typeof v === "string" || typeof v === "number") return String(v);
	const entries: Array<[string, unknown]> = [];
	if (Array.isArray(v)) {
		for (const item of v) {
			if (isYamlMap(item)) entries.push(...Object.entries(item));
			else if (present(item)) entries.push([String(item), undefined]);
		}
	} else if (isYamlMap(v)) {
		entries.push(...Object.entries(v));
	}
	return entries
		.map(([k, val]) => (present(val) ? `${titleCase(k)} ${signed(val)}` : String(k)))
		.join(", ");
}

function formatSpeed(v: unknown): string {
	if (!present(v)) return "";
	if (typeof v === "number") return `${v} ft.`;
	if (isYamlMap(v)) {
		return Object.entries(v)
			.map(([mode, val]) => {
				const dist = typeof val === "number" ? `${val} ft.` : text(val);
				return /^walk$/i.test(mode) ? dist : `${mode} ${dist}`;
			})
			.join(", ");
	}
	return text(v);
}

function formatCr(v: unknown): string {
	if (!present(v)) return "";
	let cr = String(v).trim();
	const asNum = Number(cr);
	if (asNum === 0.125) cr = "1/8";
	else if (asNum === 0.25) cr = "1/4";
	else if (asNum === 0.5) cr = "1/2";
	const xp = CR_XP[cr];
	if (/\bXP\b/i.test(cr) || xp === undefined) return cr;
	return `${cr} (${xp.toLocaleString("en-US")} XP)`;
}

function abilityScores(data: Data): number[] {
	const stats = get(data, "stats", "abilities", "ability_scores");
	if (Array.isArray(stats) && stats.length >= 6) return stats.slice(0, 6).map((s) => toNumber(s));
	const source: Data = isYamlMap(stats) ? stats : data;
	return ABILITIES.map((a) => toNumber(get(source, a, a.toUpperCase(), ABILITY_LONG[a])));
}

interface Entry {
	name: string;
	desc: string;
}

function entryList(v: unknown): Entry[] {
	if (!present(v)) return [];
	let items: unknown[];
	if (Array.isArray(v)) items = v;
	else if (isYamlMap(v) && !("name" in v) && !("desc" in v) && !("description" in v)) {
		items = Object.entries(v).map(([k, val]) => ({ name: k, desc: val }));
	} else items = [v];

	return items
		.map((item): Entry => {
			if (typeof item === "string") {
				const m = /^(.+?)\.\s+([\s\S]*)$/.exec(item.trim());
				return m && m[1].length <= 60 ? { name: m[1], desc: m[2] } : { name: "", desc: item.trim() };
			}
			if (isYamlMap(item)) {
				const name = get(item, "name", "title");
				const desc = get(item, "desc", "description", "text", "entries");
				if (name !== undefined || desc !== undefined) {
					const d = Array.isArray(desc) ? desc.map(text).join(" ") : text(desc);
					return { name: text(name), desc: d };
				}
				const first = Object.entries(item)[0];
				return first ? { name: first[0], desc: text(first[1]) } : { name: "", desc: "" };
			}
			return { name: "", desc: text(item) };
		})
		.filter((e) => e.name || e.desc);
}

function renderEntry(e: Entry): string {
	const desc = e.desc.replace(/\s*\n\s*/g, " ").trim();
	if (!e.name) return desc;
	return `***${e.name.trim().replace(/\.$/, "")}.*** ${desc}`.trim();
}

/** Builds a Homebrewery V3 `{{monster,frame ... }}` block from monster data. */
export function buildMonsterBlock(data: Data, fallbackName = "Monster"): string {
	const name = text(get(data, "name", "title")) || fallbackName;
	const typeIsMarker = typeof data.type === "string" && data.type.trim().toLowerCase() === "monster";
	const creatureType = typeIsMarker
		? get(data, "creature_type", "monster_type", "creatureType")
		: get(data, "creature_type", "monster_type", "creatureType", "type");
	const subtype = get(data, "subtype");
	const typeText = creatureType ? `${text(creatureType)}${subtype ? ` (${text(subtype)})` : ""}` : "";
	const sizeType = [text(get(data, "size")), typeText].filter(Boolean).join(" ");
	const alignment = text(get(data, "alignment"));
	const meta = sizeType && alignment ? `${sizeType}, ${alignment}` : sizeType || alignment;

	const header = [`## ${name}`];
	if (meta) header.push(`*${meta}*`);

	const core: string[] = [];
	const ac = text(get(data, "ac", "armor_class", "armorClass"));
	const acNote = text(get(data, "ac_class", "armor_desc", "armor_type"));
	if (ac) core.push(`**Armor Class** :: ${ac}${acNote ? ` (${acNote})` : ""}`);
	const hp = text(get(data, "hp", "hit_points", "hitPoints"));
	const hitDice = text(get(data, "hit_dice", "hp_dice", "hitDice"));
	if (hp) core.push(`**Hit Points** :: ${hp}${hitDice ? ` (${hitDice})` : ""}`);
	const speed = formatSpeed(get(data, "speed"));
	if (speed) core.push(`**Speed** :: ${speed}`);

	const scores = abilityScores(data);
	const abilityTable = [
		"| STR | DEX | CON | INT | WIS | CHA |",
		"|:---:|:---:|:---:|:---:|:---:|:---:|",
		`| ${scores.map((s) => `${s} (${abilityModifier(s)})`).join(" | ")} |`,
	];

	const details: string[] = [];
	const addDetail = (label: string, value: string): void => {
		if (value) details.push(`**${label}** :: ${value}`);
	};
	addDetail("Saving Throws", bonusList(get(data, "saves", "saving_throws", "savingThrows")));
	addDetail("Skills", bonusList(get(data, "skills", "skillsaves")));
	addDetail("Damage Vulnerabilities", text(get(data, "damage_vulnerabilities", "vulnerabilities")));
	addDetail("Damage Resistances", text(get(data, "damage_resistances", "resistances")));
	addDetail("Damage Immunities", text(get(data, "damage_immunities", "immunities")));
	addDetail("Condition Immunities", text(get(data, "condition_immunities")));
	addDetail("Senses", text(get(data, "senses")));
	addDetail("Languages", text(get(data, "languages")));
	addDetail("Challenge", formatCr(get(data, "cr", "challenge", "challenge_rating")));

	const traits = entryList(get(data, "traits", "special_abilities", "features")).map(renderEntry);

	const groups = [core, abilityTable, details].filter((g) => g.length > 0);
	const lines: string[] = [];
	const wide = isTruthy(data.wide) || isTruthy(data.statblock_wide);
	lines.push(wide ? "{{monster,frame,wide" : "{{monster,frame", ...header);
	for (const g of groups) lines.push("___", ...g);
	if (traits.length) {
		lines.push("___");
		traits.forEach((t, i) => {
			if (i > 0) lines.push("");
			lines.push(t);
		});
	}

	const sections: Array<[string, string[], string]> = [
		["Actions", ["actions"], ""],
		["Bonus Actions", ["bonus_actions", "bonusActions"], ""],
		["Reactions", ["reactions"], ""],
		["Legendary Actions", ["legendary_actions", "legendaryActions"], text(get(data, "legendary_description"))],
		["Lair Actions", ["lair_actions", "lairActions"], ""],
	];
	for (const [title, keys, intro] of sections) {
		const entries = entryList(get(data, ...keys)).map(renderEntry);
		if (!entries.length) continue;
		lines.push(`### ${title}`);
		if (intro) lines.push(intro, "");
		entries.forEach((e, i) => {
			if (i > 0) lines.push("");
			lines.push(e);
		});
	}
	lines.push("}}");
	return lines.join("\n");
}
