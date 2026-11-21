import {
	type FontResolverApp,
	DEFAULT_CUSTOM_FONTS,
	buildCustomFontVariablesCss,
	buildCustomFontsCss,
	fontTagSlotsToMap,
	getEmbeddedFontsCss,
	listAvailableLocalFontFiles,
} from "../src/fonts";
import { findUnclosedBlocks } from "../src/preflight";
import {
	buildBookHtmlDocument,
	buildBookPagesMarkup,
	buildBookShellHtml,
	buildTocHtml,
	getBookStylesheet,
	getPrintPageRuleCss,
} from "../src/renderer";
import { BOOK_TEMPLATES } from "../src/templates";
import { colorSlotsToMap } from "../src/themes";
import {
	extractBookFrontmatterOverrides,
	joinBookChapters,
	obsidianToHomebrewery,
	prepareBookFromV3,
	renderHomebreweryPages,
	renderPageHtml,
	splitPages,
	transpileToBook,
} from "../src/transpiler";

describe("obsidianToHomebrewery", () => {
	test("converts Obsidian [!note] and [!quote] callouts to Homebrewery V3 blocks", () => {
		const md = [
			"> [!note] Loremaster's Secret",
			"> Only those bearing the sun sigil may enter.",
			"",
			"> [!quote]",
			"> Torchlight dances across the basalt colonnade.",
		].join("\n");

		const v3 = obsidianToHomebrewery(md);

		expect(v3).toContain("{{note\n##### Loremaster's Secret\nOnly those bearing the sun sigil may enter.\n}}");
		expect(v3).toContain("{{descriptive\nTorchlight dances across the basalt colonnade.\n}}");
	});

	test("converts ---page--- and ---column--- markers to \\page and \\column", () => {
		const md = "First column\n---column---\nSecond column\n---page---\nSecond page";
		const v3 = obsidianToHomebrewery(md);

		expect(v3).toContain("First column\n\\column\nSecond column\n\\page\nSecond page");
	});

	test("strips Obsidian wikilinks while preserving aliases and section labels", () => {
		const md = "Travel from [[Waterdeep|City of Splendors]] to [[Neverwinter]] via [[Sword Coast#High Road]].";
		const v3 = obsidianToHomebrewery(md);

		expect(v3.trim()).toBe("Travel from City of Splendors to Neverwinter via Sword Coast > High Road.");
	});

	test("leaves inline code and fenced code blocks untouched during conversion", () => {
		const md = [
			"Inline `[[Literal]]` stays.",
			"",
			"```markdown",
			"> [!note] Keep Raw",
			"---page---",
			"[[AlsoLiteral]]",
			"```",
		].join("\n");

		const v3 = obsidianToHomebrewery(md);

		expect(v3).toContain("Inline `[[Literal]]` stays.");
		expect(v3).toContain("> [!note] Keep Raw\n---page---\n[[AlsoLiteral]]");
	});

	test("resolves image embeds with widths and converts them into base64 data URIs on HTML render", () => {
		const md = "![[dragon.png|350]]";
		const v3 = obsidianToHomebrewery(md, {
			resolveImagePath: (link) => (link === "dragon.png" ? "assets/dragon.png" : link),
		});

		expect(v3.trim()).toBe("![dragon](assets/dragon.png){width:350px}");

		const pages = renderHomebreweryPages(v3, {
			resolveImageSrc: (url) => (url === "assets/dragon.png" ? "data:image/png;base64,QUFB" : null),
		});

		expect(pages).toHaveLength(1);
		expect(pages[0]).toContain('<img src="data:image/png;base64,QUFB" alt="dragon"');
		expect(pages[0]).toContain('style="width:350px"');
	});

	test("converts YAML frontmatter with statblock: true into a {{monster,frame}} block", () => {
		const md = [
			"---",
			"statblock: true",
			"name: Ashscale Drake",
			"size: Medium",
			"type: dragon",
			"alignment: unaligned",
			"ac: 16",
			"ac_class: natural armor",
			"hp: 65",
			"hit_dice: 10d8 + 20",
			"speed: 30 ft., fly 60 ft.",
			"str: 16",
			"dex: 14",
			"con: 15",
			"int: 6",
			"wis: 11",
			"cha: 8",
			"cr: 3",
			"actions:",
			"  - name: Bite",
			"    desc: Melee Weapon Attack +5 to hit, 10 piercing damage.",
			"---",
			"",
			"Drakes nest atop cinder spires.",
		].join("\n");

		const v3 = obsidianToHomebrewery(md);

		expect(v3).toContain("{{monster,frame");
		expect(v3).toContain("## Ashscale Drake");
		expect(v3).toContain("*Medium dragon, unaligned*");
		expect(v3).toContain("**Armor Class** :: 16 (natural armor)");
		expect(v3).toContain("**Hit Points** :: 65 (10d8 + 20)");
		expect(v3).toContain("**Challenge** :: 3 (700 XP)");
		expect(v3).toContain("### Actions");
		expect(v3).toContain("***Bite.*** Melee Weapon Attack +5 to hit, 10 piercing damage.");
		expect(v3).toContain("Drakes nest atop cinder spires.");
	});

	test("converts YAML frontmatter with type: monster using note title fallback", () => {
		const md = [
			"---",
			"type: monster",
			"size: Large",
			"creature_type: aberration",
			"ac: 15",
			"hp: 90",
			"---",
			"",
			"Lurks beneath the flooded vault.",
		].join("\n");

		const v3 = obsidianToHomebrewery(md, { title: "Abyssal Watcher" });

		expect(v3).toContain("{{monster,frame");
		expect(v3).toContain("## Abyssal Watcher");
		expect(v3).toContain("*Large aberration*");
	});
});

describe("pagination, layout blocks, and renderer", () => {
	test("splits pages on \\page and renders \\column markers", () => {
		const v3 = "Left column\n\\column\nRight column\n\\page\nSecond page text";
		expect(splitPages(v3)).toEqual(["Left column\n\\column\nRight column", "Second page text"]);

		const pages = renderHomebreweryPages(v3);
		expect(pages).toHaveLength(2);
		expect(pages[0]).toContain('<div class="columnSplit"></div>');
		expect(pages[1]).toMatch(/<p\b[^>]*>Second page text<\/p>/);
	});

	test("renders wide, no-split, note, descriptive, monster, and dropcap blocks", () => {
		const md = [
			"{{wide",
			"## Regional Timeline",
			"}}",
			"",
			"{{no-split",
			"| d4 | Omen |",
			"|---|---|",
			"| 1 | Ash falls |",
			"}}",
			"",
			"{{dropcap}} The iron bells tolled at midnight.",
			"",
			"{{note",
			"DM Note text.",
			"}}",
			"",
			"{{descriptive",
			"Read aloud text.",
			"}}",
		].join("\n");

		const html = renderPageHtml(md);

		expect(html).toMatch(/<div class="block wide"[^>]*>/);
		expect(html).toMatch(/<div class="block no-split"[^>]*>/);
		expect(html).toMatch(/<p class="hb-dropcap"[^>]*>The iron bells tolled at midnight.<\/p>/);
		expect(html).toMatch(/<div class="block note"[^>]*>/);
		expect(html).toMatch(/<div class="block descriptive"[^>]*>/);
	});

	test("renders full statblock definition lists and ability table", () => {
		const md = [
			"---",
			"statblock: true",
			"name: Goblin Scout",
			"ac: 15",
			"hp: 7",
			"str: 8",
			"dex: 14",
			"con: 10",
			"int: 10",
			"wis: 8",
			"cha: 8",
			"---",
		].join("\n");

		const { pages } = transpileToBook(md);
		expect(pages[0]).toMatch(/<div class="block monster frame"[^>]*>/);
		expect(pages[0]).toMatch(/<dl class="hb-dl"[^>]*>/);
		expect(pages[0]).toContain("<dt><strong>Armor Class</strong></dt><dd>15</dd>");
		expect(pages[0]).toMatch(/<table\b[^>]*>/);
	});

	test("generates isolated HTML document with Letter/A4 @page and anti-split CSS", () => {
		const letterDoc = buildBookHtmlDocument(["<p>Page 1</p>", "<p>Page 2</p>"], {
			title: "Campaign Book",
			pageSize: "letter",
		});

		expect(letterDoc).toContain("<!DOCTYPE html>");
		expect(letterDoc).toContain("<title>Campaign Book</title>");
		expect(letterDoc).toContain("width: 8.5in;");
		expect(letterDoc).toContain("height: 11in;");
		expect(letterDoc).toContain("column-count: 2;");
		expect(letterDoc).toContain("column-gap: 0.35in;");
		expect(letterDoc).toContain("size: letter;");
		expect(letterDoc).toContain("margin: 0;");
		expect(letterDoc).toContain("column-span: all;");
		expect(letterDoc).toContain("break-inside: avoid;");
		expect(letterDoc).toContain("page-break-inside: avoid;");
		expect(letterDoc).toContain('<section class="page" data-page="1">');
		expect(letterDoc).toContain('<section class="page" data-page="2">');

		const a4Css = getBookStylesheet("a4");
		expect(a4Css).toContain("width: 210mm;");
		expect(a4Css).toContain("height: 297mm;");
		expect(a4Css).toContain("size: A4;");
	});

	test("renders classTable,frame, spellList, footnote, and auto pageNumber blocks", () => {
		const md = [
			"{{classTable,frame",
			"##### The Runeblade",
			"| Level | Proficiency Bonus | Features |",
			"|:---:|:---:|:---|",
			"| 1st | +2 | Runic Edge |",
			"}}",
			"",
			"{{spellList,wide",
			"#### 1st Level",
			"- Beacon Step",
			"- Aegis of Glass",
			"}}",
			"",
			"{{footnote PART 1 | CLASSES}}",
			"{{pageNumber,auto}}",
			"\\page",
			"Page Two",
			"{{footnote PART 1 | CLASSES}}",
			"{{pageNumber,auto}}",
		].join("\n");

		const pages = renderHomebreweryPages(md);
		expect(pages).toHaveLength(2);
		expect(pages[0]).toMatch(/<div class="block classTable frame"[^>]*>/);
		expect(pages[0]).toMatch(/<h5\b[^>]*>The Runeblade<\/h5>/);
		expect(pages[0]).toMatch(/<div class="block spellList wide"[^>]*>/);
		expect(pages[0]).toMatch(/<div class="block footnote"[^>]*>/);
		expect(pages[0]).toContain("PART 1 | CLASSES");
		expect(pages[0]).toMatch(/<div class="block pageNumber auto"[^>]*>1<\/div>/);
		expect(pages[1]).toMatch(/<div class="block pageNumber auto"[^>]*>2<\/div>/);

		const doc = buildBookHtmlDocument(pages, { title: "Class Guide" });
		expect(doc).toContain(".block.classTable.frame");
		expect(doc).toContain(".block.spellList");
		expect(doc).toContain(".block.footnote");
		expect(doc).toContain(".block.pageNumber");
		expect(doc).not.toContain('<div class="page-footer">');
	});

	test("auto-calculates omitted ability modifiers in raw monster statblock tables", () => {
		const md = [
			"{{monster,frame",
			"## Stone Ward",
			"*Medium construct, unaligned*",
			"___",
			"| STR | DEX | CON | INT | WIS | CHA |",
			"|:---:|:---:|:---:|:---:|:---:|:---:|",
			"| 18 | 10 | 16 | 6 | 11 | 5 |",
			"}}",
		].join("\n");

		const html = renderPageHtml(md);
		expect(html).toContain("18 (+4)");
		expect(html).toContain("10 (+0)");
		expect(html).toContain("16 (+3)");
		expect(html).toContain("6 (-2)");
		expect(html).toContain("11 (+0)");
		expect(html).toContain("5 (-3)");
	});

	test("embeds offline SIL OFL @font-face rules via getEmbeddedFontsCss()", () => {
		const fontsCss = getEmbeddedFontsCss();
		expect(fontsCss).toContain("font-family: 'Cinzel'");
		expect(fontsCss).toContain("font-family: 'Libre Baskerville'");
		expect(fontsCss).toContain("font-family: 'Open Sans'");
		expect(fontsCss).toContain("font-display: block;");
		expect(fontsCss).toContain("format('woff2')");

		const doc = buildBookHtmlDocument(["<p>Hello</p>"]);
		expect(doc).toContain("@font-face");
		expect(doc).toContain("font-family: 'Cinzel'");
		expect(doc).toContain("var(--hb-parchment)");
		expect(doc).toContain("#f6f2e9");
		expect(doc).not.toContain("fonts.googleapis.com");
	});

	test("renders all 4 built-in D&D templates cleanly with zero external URLs", () => {
		expect(BOOK_TEMPLATES).toHaveLength(4);
		for (const tpl of BOOK_TEMPLATES) {
			const { v3, pages } = transpileToBook(tpl.content, { title: tpl.title });
			expect(v3.length).toBeGreaterThan(100);
			expect(pages.length).toBeGreaterThanOrEqual(1);
			for (const page of pages) {
				expect(page).not.toContain("https://");
				expect(page).not.toContain("http://");
			}
		}
	});

	test("attaches accurate 0-based data-line-start and data-line-end attributes across frontmatter and pages", () => {
		const md = [
			"---", // 0
			"title: Source Map Test", // 1
			"---", // 2
			"# Chapter One", // 3
			"", // 4
			"Intro paragraph.", // 5
			"", // 6
			"> [!note] GM Secret", // 7
			"> Hidden clue here.", // 8
			"", // 9
			"| Col A | Col B |", // 10
			"| --- | --- |", // 11
			"| 1 | 2 |", // 12
			"", // 13
			"\\page", // 14
			"", // 15
			"![[map.png|col]]", // 16
		].join("\n");

		const { pages } = transpileToBook(md, {
			resolveImagePath: (link) => link,
			resolveImageSrc: (url) => `data:image/png;base64,${url}`,
		});

		expect(pages).toHaveLength(2);
		expect(pages[0]).toContain('<h1 data-line-start="3" data-line-end="3">Chapter One</h1>');
		expect(pages[0]).toContain('<p data-line-start="5" data-line-end="5">Intro paragraph.</p>');
		expect(pages[0]).toContain('<div class="block note" data-line-start="7" data-line-end="8">');
		expect(pages[0]).toContain('<h5 data-line-start="7" data-line-end="7">GM Secret</h5>');
		expect(pages[0]).toContain('<p data-line-start="8" data-line-end="8">Hidden clue here.</p>');
		expect(pages[0]).toContain('<table data-line-start="10" data-line-end="12">');
		expect(pages[1]).toContain('<div class="hb-image-wrapper hb-img-col" data-line-start="16" data-line-end="16">');
	});

	test("supports multi-mode image alignment and parchment fade modifiers without breaking pixel widths", () => {
		const md = [
			"![[backdrop.png|bg-35]]",
			"",
			"![[portrait.png|col,fade]]",
			"",
			"![[crest.png|right-45]]",
			"",
			"![[badge.png|inline]]",
			"",
			"![Sketch|left-40,fade](sketch.png)",
		].join("\n");

		const { v3, pages } = transpileToBook(md, {
			resolveImagePath: (link) => link,
			resolveImageSrc: (url) => `data:image/png;base64,${url}`,
		});

		expect(v3).toContain("![backdrop](backdrop.png){.hb-img-bg,opacity:0.35}");
		expect(v3).toContain("![portrait](portrait.png){.hb-img-col,.hb-img-fade}");
		expect(v3).toContain("![crest](crest.png){.hb-img-right,width:45%}");
		expect(v3).toContain("![badge](badge.png){.hb-img-inline}");
		expect(v3).toContain("![Sketch](sketch.png){.hb-img-left,.hb-img-fade,width:40%}");

		expect(pages).toHaveLength(1);
		expect(pages[0]).toContain('<div class="hb-image-wrapper hb-img-bg" style="opacity:0.35" data-line-start="0" data-line-end="0">');
		expect(pages[0]).toContain('<div class="hb-image-wrapper hb-img-col hb-img-fade" data-line-start="2" data-line-end="2">');
		expect(pages[0]).toContain('<div class="hb-image-wrapper hb-img-right" style="width:45%" data-line-start="4" data-line-end="4">');
		expect(pages[0]).toContain('<div class="hb-image-wrapper hb-img-inline" data-line-start="6" data-line-end="6">');
		expect(pages[0]).toContain('<div class="hb-image-wrapper hb-img-left hb-img-fade" style="width:40%" data-line-start="8" data-line-end="8">');
	});

	test("builds flicker-free shell HTML, page markup, and screen-only cursor/overflow rules", () => {
		const css = getBookStylesheet("a4");
		expect(css).toContain(".active-cursor-block");
		expect(css).toContain(".hb-overflow-warning");
		expect(css).toContain(".hb-overflow-badge");
		expect(css).toContain(".hb-image-wrapper.hb-img-bg");
		expect(css).toContain(".hb-img-fade {");
		expect(css).toContain("@media print");
		expect(css).toMatch(/\.hb-overflow-badge\s*\{\s*display:\s*none\s*!important;/);

		const shell = buildBookShellHtml({ pageSize: "letter", title: "Shell Title" });
		expect(shell).toContain('<style id="hb-base-fonts">');
		expect(shell).toContain('<style id="hb-layout-styles">');
		expect(shell).toContain('<style id="hb-print-page-rule">');
		expect(shell).toContain('<style id="hb-custom-fonts"></style>');
		expect(shell).toContain('<main class="pages" data-page-size="letter"></main>');
		expect(shell).toContain('<div id="hb-stage">');
		expect(css).toContain('.pages[data-view-mode="spread"]');
		expect(css).toContain("transform: none !important;");

		const markup = buildBookPagesMarkup(["<p>One</p>", "<p>Two</p>"]);
		expect(markup).toContain('<section class="page" data-page="1">');
		expect(markup).toContain('<div class="page-footer">1</div>');
		expect(markup).toContain('<section class="page" data-page="2">');
		expect(markup).toContain('<div class="page-footer">2</div>');
	});
});

describe("preflight diagnostics", () => {
	test("finds unclosed {{ }} blocks and ignores fenced code", () => {
		const md = ["{{note", "ok", "}}", "", "{{monster,frame", "## Open", "", "```", "{{ignored", "```"].join("\n");
		expect(findUnclosedBlocks(md)).toEqual([5]);
		expect(findUnclosedBlocks("{{note\nx\n}}")).toEqual([]);
	});
});

describe("Pass 2 features", () => {
	test("supports \\page-single, {{singleColumn}}, and {{colophon}} without affecting surrounding pages", () => {
		const md = [
			"Two-column intro",
			"\\page-single",
			"# Cover Title",
			"{{colophon\nPublished under Open License.\n}}",
			"\\page",
			"Back to two columns",
		].join("\n");

		const pages = renderHomebreweryPages(md);
		expect(pages).toHaveLength(3);
		const markup = buildBookPagesMarkup(pages);

		expect(markup).toContain('<section class="page" data-page="1">');
		expect(markup).toContain('<section class="page single-column" data-page="2">');
		expect(markup).toContain('<div class="block colophon"');
		expect(markup).toContain('<section class="page" data-page="3">');
	});

	test("supports expanded image alignment modifiers (bg-width, bg-height, top, bottom) and fade-<N>", () => {
		const md = [
			"![[map.png|bg-width-50]]",
			"",
			"![[pillar.png|bg-height]]",
			"",
			"![[header.png|top-40]]",
			"",
			"![[footer.png|bottom,fade-20]]",
			"",
			"![[crest.png|right-45,fade-30]]",
		].join("\n");

		const { v3, pages } = transpileToBook(md, {
			resolveImagePath: (link) => link,
			resolveImageSrc: (url) => `data:image/png;base64,${url}`,
		});

		expect(v3).toContain("![map](map.png){.hb-img-bg,.hb-img-bg-width,opacity:0.5}");
		expect(v3).toContain("![pillar](pillar.png){.hb-img-bg,.hb-img-bg-height}");
		expect(v3).toContain("![header](header.png){.hb-img-top,height:40%}");
		expect(v3).toContain("![footer](footer.png){.hb-img-bottom,.hb-img-fade,height:35%,--hb-fade:20}");
		expect(v3).toContain("![crest](crest.png){.hb-img-right,.hb-img-fade,width:45%,--hb-fade:30}");

		expect(pages[0]).toContain('class="hb-image-wrapper hb-img-bg hb-img-bg-width" style="opacity:0.5"');
		expect(pages[0]).toContain('class="hb-image-wrapper hb-img-top" style="height:40%"');
		expect(pages[0]).toContain('class="hb-image-wrapper hb-img-bottom hb-img-fade" style="height:35%;--hb-fade:20"');
		expect(pages[0]).toContain('class="hb-image-wrapper hb-img-right hb-img-fade" style="width:45%;--hb-fade:30"');

		const markup = buildBookPagesMarkup(pages);
		expect(markup).toContain("hb-banner-page");
		expect(markup).toContain('<div class="hb-slot-top">');
		expect(markup).toContain('<div class="hb-page-body">');
		expect(markup).toContain('<div class="hb-slot-bottom">');
	});

	test("supports custom color tags (single-line span, inline span, and multi-line div) and themes", () => {
		const colorTags = colorSlotsToMap([
			{ name: "crimson", color: "#9c2b1b" },
			{ name: "arcane", color: "#5b3fa0" },
		]);

		const md = [
			"{{crimson Standalone red line}}",
			"",
			"Beware the {{arcane **Arcane** Ward}} here.",
			"",
			"{{crimson",
			"Multi-line crimson block.",
			"}}",
		].join("\n");

		const html = renderPageHtml(md, { colorTags });
		expect(html).toContain('<span class="crimson" style="color:#9c2b1b">Standalone red line</span>');
		expect(html).toContain('<span class="arcane" style="color:#5b3fa0"><strong>Arcane</strong> Ward</span>');
		expect(html).toMatch(/<div class="block crimson" style="color:#9c2b1b"[^>]*>/);

		const customCss = getBookStylesheet("letter", {
			theme: "custom",
			customPageColor: "#112233",
			customFontColor: "#eeeeee",
			colorSlots: [{ name: "crimson", color: "#9c2b1b" }],
		});
		expect(customCss).toContain("--hb-page-bg: #112233;");
		expect(customCss).toContain("--hb-text-color: #eeeeee;");
		expect(customCss).toContain("--hb-heading-color: #eeeeee;");
		expect(customCss).toContain(".crimson { color: #9c2b1b; }");

		const inkCss = getBookStylesheet("letter", { theme: "ink" });
		expect(inkCss).toContain("--hb-page-bg: #ffffff;");
		expect(inkCss).toContain("--hb-table-header-text: #000000;");
		expect(inkCss).toContain("--hb-table-row-alt: #f4f4f4;");
		expect(inkCss).toContain("--hb-strong-color: #000000;");
		expect(inkCss).toContain("--hb-em-color: #454545;");

		const darkCss = getBookStylesheet("letter", { theme: "dark" });
		expect(darkCss).toContain("--hb-page-bg: #1d1f24;");
		expect(darkCss).toContain("--hb-table-header-bg: rgba(201, 173, 106, 0.16);");
		expect(darkCss).toContain("--hb-table-header-text: #ead9a8;");
		expect(darkCss).toContain("--hb-table-row-alt: rgba(255, 255, 255, 0.04);");
		expect(darkCss).toContain("--hb-strong-color: #e6c675;");
		expect(darkCss).toContain("--hb-em-color: #a7bacb;");
		expect(darkCss).toContain("--hb-note-bg: #252932;");
		expect(darkCss).toContain("--hb-note-title-color: #ead08c;");
		expect(darkCss).toContain("--hb-descriptive-bg: #23262e;");
		expect(darkCss).toContain("--hb-descriptive-title-color: #ead08c;");
		expect(darkCss).toContain("--hb-handwritten-bg: #262830;");
		expect(darkCss).toContain("--hb-handwritten-text-color: #e2dccf;");
		expect(darkCss).toContain("--hb-statblock-bg: #24262e;");
		expect(darkCss).toContain("--hb-statblock-heading-color: #edd085;");
		expect(darkCss).toContain("color: var(--hb-note-title-color);");
		expect(darkCss).toContain("color: var(--hb-descriptive-title-color);");
		expect(darkCss).toContain("color: var(--hb-statblock-heading-color);");

		expect(customCss).toContain("--hb-table-header-text: var(--hb-heading-color);");
		expect(customCss).toContain("--hb-strong-color: color-mix(in srgb, var(--hb-text-color) 80%, #c9ad6a 20%);");
		expect(customCss).toContain("--hb-em-color: color-mix(in srgb, var(--hb-text-color) 82%, transparent);");

		const doc = buildBookHtmlDocument(["<p>Hi</p>"], {
			customCss: ".page { letter-spacing: 0.01em; }",
		});
		expect(doc).toContain(".page { letter-spacing: 0.01em; }");
	});

	test("renders text alignment tags, vertical colon spacers, and Term :: Definition lists", () => {
		const md = [
			"{{center Centered line}}",
			"",
			"{{right",
			"Right block",
			"}}",
			"",
			"{{justify Justified line}}",
			"",
			":::",
			"",
			"**Casting Time** :: 1 action",
			"**Range** :: 60 feet",
		].join("\n");

		const html = renderPageHtml(md);
		expect(html).toContain('<span class="center">Centered line</span>');
		expect(html).toMatch(/<div class="block right"[^>]*>/);
		expect(html).toContain('<span class="justify">Justified line</span>');
		expect(html).toContain('<div class="blank hb-spacer" style="height:calc(0.6em * 3)"></div>');
		expect(html).toMatch(/<dl class="hb-dl"[^>]*>/);
		expect(html).toContain("<dt><strong>Casting Time</strong></dt><dd>1 action</dd>");
		expect(html).toContain("<dt><strong>Range</strong></dt><dd>60 feet</dd>");
	});

	test("renders table colspan (||) and rowspan (^) spans", () => {
		const md = [
			"| Category || Notes |",
			"|---|---|---|",
			"| Group A | Alpha | First |",
			"| ^ | Beta ||",
		].join("\n");

		const html = renderPageHtml(md);
		expect(html).toContain('<th colspan="2">Category</th>');
		expect(html).toContain('<td rowspan="2">Group A</td>');
		expect(html).toContain('<td colspan="2">Beta</td>');
	});

	test("converts [!statblock], [!spell], and [!item] callouts", () => {
		const md = [
			"> [!statblock] Dusk Wolf",
			"> *Medium beast, unaligned*",
			"",
			"> [!spell] Ember Bolt",
			"> *1st-level evocation*",
			"",
			"> [!item] Lantern of Echoes",
			"> *Wondrous item, uncommon*",
		].join("\n");

		const { v3, pages } = transpileToBook(md);
		expect(v3).toContain("{{monster,frame\n## Dusk Wolf");
		expect(v3).toContain("{{spell\n##### Ember Bolt");
		expect(v3).toContain("{{item\n##### Lantern of Echoes");

		expect(pages[0]).toMatch(/<div class="block monster frame"[^>]*>/);
		expect(pages[0]).toMatch(/<div class="block spell"[^>]*>/);
		expect(pages[0]).toMatch(/<div class="block item"[^>]*>/);
	});

	test("converts [!handwritten] callouts and {{handwritten}} blocks with line mappings", () => {
		const md = [
			"> [!handwritten] Journal Entry",
			"> Meet me at the docks at midnight.",
			"",
			"{{handwritten",
			"Signed, A.",
			"}}",
			"",
			"{{handwritten Quick margin scribble}}",
		].join("\n");

		const { v3, pages } = transpileToBook(md);
		expect(v3).toContain("{{handwritten\n##### Journal Entry\nMeet me at the docks at midnight.\n}}");
		expect(pages[0]).toContain('<div class="block handwritten" data-line-start="0" data-line-end="1">');
		expect(pages[0]).toContain('<div class="block handwritten" data-line-start="3" data-line-end="5">');
		expect(pages[0]).toContain('<div class="block handwritten" data-line-start="7" data-line-end="7">');
	});

	test("embeds Uncial Antiqua and Ephesis fonts, joins multi-note books with continuous page numbers, and builds TOC rows", () => {
		const fontsCss = getEmbeddedFontsCss();
		expect(fontsCss).toContain("font-family: 'Uncial Antiqua'");
		expect(fontsCss).toContain("font-family: 'Ephesis'");
		expect(fontsCss).not.toContain("Cinzel Decorative");

		const baseCss = getBookStylesheet("letter");
		expect(baseCss).toContain("'Uncial Antiqua', 'Cinzel', serif");
		expect(baseCss).toContain("'Ephesis', cursive");
		expect(baseCss).toContain("var(--hb-strong-color)");
		expect(baseCss).toContain("var(--hb-em-color)");
		expect(baseCss).toContain("var(--hb-table-header-bg)");
		expect(baseCss).toContain("var(--hb-table-header-text)");
		expect(baseCss).toContain("var(--hb-table-row-alt)");
		expect(baseCss).toContain("linear-gradient(180deg, #b89856 0%, #7c602c 55%, #a58648 100%)");

		const ch1 = obsidianToHomebrewery("---\ntitle: One\n---\n# Chapter One\n{{pageNumber,auto}}");
		const ch2 = obsidianToHomebrewery("---\ntitle: Two\n---\n# Chapter Two\n{{pageNumber,auto}}");
		const joined = joinBookChapters([ch1, ch2]);
		expect(joined).not.toContain("title: One");
		const pages = prepareBookFromV3(joined).renderPages();
		expect(pages).toHaveLength(2);
		expect(pages[0]).toMatch(/<div class="block pageNumber auto"[^>]*>1<\/div>/);
		expect(pages[1]).toMatch(/<div class="block pageNumber auto"[^>]*>2<\/div>/);

		const tocHtml = buildTocHtml([
			{ level: 1, title: "Chapter One", page: 1 },
			{ level: 2, title: "Section A", page: 3 },
		]);
		expect(tocHtml).toContain("hb-toc-l1");
		expect(tocHtml).toContain("hb-toc-leader");
		expect(tocHtml).toContain('<span class="hb-toc-page">3</span>');
	});

	test("generates H1-H6 custom font CSS variables with H1 inheritance and statblock inheritance", () => {
		const varsCss = buildCustomFontVariablesCss(
			{
				h1: "Morpheus",
				h3: "Cormorant SC",
				statblock: "Alegreya Sans",
				dropcap: "Goudy Initialen",
				handwritten: "Segoe Script",
			},
			{},
			[
				{ name: "elvish", font: "Tengwar Annatar" },
				{ name: "runic", font: "" },
				{ name: "draconic", font: "Iokharic" },
			],
		);

		expect(varsCss).toContain('--hb-font-h1: "Morpheus", \'Cinzel\', \'Libre Baskerville\', Georgia, serif;');
		expect(varsCss).toContain('--hb-font-h2: "Morpheus", \'Cinzel\', \'Libre Baskerville\', Georgia, serif;');
		expect(varsCss).toContain('--hb-font-h3: "Cormorant SC", \'Cinzel\', \'Libre Baskerville\', Georgia, serif;');
		expect(varsCss).toContain('--hb-font-h4: "Morpheus", \'Cinzel\', \'Libre Baskerville\', Georgia, serif;');
		expect(varsCss).toContain('--hb-font-h5: "Morpheus", \'Cinzel\', \'Libre Baskerville\', Georgia, serif;');
		expect(varsCss).toContain('--hb-font-h6: "Morpheus", \'Cinzel\', \'Libre Baskerville\', Georgia, serif;');
		expect(varsCss).toContain('--hb-font-body: \'Libre Baskerville\', \'Book Antiqua\', Palatino, Georgia, serif;');
		expect(varsCss).toContain('--hb-font-statblock: "Alegreya Sans", \'Open Sans\',');
		expect(varsCss).toContain('--hb-font-magic-item: "Alegreya Sans", \'Open Sans\',');
		expect(varsCss).toContain('--hb-font-monster: "Alegreya Sans", \'Open Sans\',');
		expect(varsCss).toContain('--hb-font-dropcap: "Goudy Initialen", \'Uncial Antiqua\', \'Cinzel\', serif;');
		expect(varsCss).toContain('--hb-font-read-aloud: \'Libre Baskerville\',');
		expect(varsCss).toContain('--hb-font-note: \'Open Sans\',');
		expect(varsCss).toContain('--hb-font-handwritten: "Segoe Script", \'Ephesis\', cursive;');
		expect(varsCss).toContain('--hb-custom-font-1: "Tengwar Annatar", serif;');
		expect(varsCss).toContain('--hb-custom-font-2: inherit;');
		expect(varsCss).toContain('--hb-custom-font-3: "Iokharic", serif;');

		const overriddenMagicItem = buildCustomFontVariablesCss({
			statblock: "Alegreya Sans",
			magicItem: "Cormorant Garamond",
		});
		expect(overriddenMagicItem).toContain('--hb-font-magic-item: "Cormorant Garamond", \'Open Sans\',');
		expect(overriddenMagicItem).toContain('--hb-font-monster: "Alegreya Sans", \'Open Sans\',');
	});

	test("discovers local font files, caches base64 @font-face rules by mtime, and injects them into stylesheet", async () => {
		let mtime = 1000;
		let readCount = 0;
		const fontBytes = new Uint8Array([0x00, 0x01, 0x00, 0x00]).buffer;

		const mockApp: FontResolverApp = {
			vault: {
				configDir: ".obsidian",
				getFiles: () => [
					{ path: "Assets/Fonts/VaultScript.woff2", stat: { mtime: 500 } },
					{ path: "Notes/chapter.md", stat: { mtime: 500 } },
				],
				adapter: {
					exists: async (p) => p === ".obsidian/plugins/obsidian-homebrewery-exporter/fonts",
					list: async () => ({
						files: [".obsidian/plugins/obsidian-homebrewery-exporter/fonts/Morpheus.ttf"],
						folders: [],
					}),
					stat: async (p) =>
						p === ".obsidian/plugins/obsidian-homebrewery-exporter/fonts/Morpheus.ttf" ? { mtime } : null,
					readBinary: async () => {
						readCount++;
						return fontBytes;
					},
				},
			},
		};

		const discovered = await listAvailableLocalFontFiles(mockApp);
		expect(discovered).toEqual([
			{
				label: "Morpheus.ttf (plugin fonts/)",
				path: ".obsidian/plugins/obsidian-homebrewery-exporter/fonts/Morpheus.ttf",
				source: "plugin",
			},
			{
				label: "Assets/Fonts/VaultScript.woff2",
				path: "Assets/Fonts/VaultScript.woff2",
				source: "vault",
			},
		]);

		const customFonts = {
			...DEFAULT_CUSTOM_FONTS,
			h1: ".obsidian/plugins/obsidian-homebrewery-exporter/fonts/Morpheus.ttf",
		};

		const first = await buildCustomFontsCss(mockApp, customFonts);
		expect(first.fontFacesCss).toContain("src: url('data:font/ttf;base64,AAEAAA==') format('truetype');");
		expect(first.fontFacesCss).toMatch(/font-family: 'hb-font-h1-[a-z0-9]+';/);
		expect(first.fontVariablesCss).toMatch(/--hb-font-h1: 'hb-font-h1-[a-z0-9]+', 'Cinzel'/);
		expect(first.fontVariablesCss).toMatch(/--hb-font-h2: 'hb-font-h1-[a-z0-9]+', 'Cinzel'/);
		expect(readCount).toBe(1);

		// Second call with identical mtime must hit cache without calling readBinary again.
		const second = await buildCustomFontsCss(mockApp, customFonts);
		expect(second.fontFacesCss).toBe(first.fontFacesCss);
		expect(readCount).toBe(1);

		// Assigning the same file to another slot produces a unique per-slot family without re-reading disk.
		const sharedFile = await buildCustomFontsCss(mockApp, {
			...customFonts,
			body: ".obsidian/plugins/obsidian-homebrewery-exporter/fonts/Morpheus.ttf",
		});
		expect(sharedFile.fontFacesCss).toMatch(/font-family: 'hb-font-h1-[a-z0-9]+';/);
		expect(sharedFile.fontFacesCss).toMatch(/font-family: 'hb-font-body-[a-z0-9]+';/);
		expect(sharedFile.fontVariablesCss).toMatch(/--hb-font-body: 'hb-font-body-[a-z0-9]+', 'Libre Baskerville'/);
		expect(readCount).toBe(1);

		// Advancing mtime invalidates the cache entry, re-reads the binary, and rotates the family hash.
		mtime = 2000;
		const rotated = await buildCustomFontsCss(mockApp, customFonts);
		expect(readCount).toBe(2);
		expect(rotated.fontFacesCss).not.toBe(first.fontFacesCss);

		const css = getBookStylesheet("letter", { customFontsCss: first });
		expect(css).toContain("data:font/ttf;base64,AAEAAA==");
		expect(css).toContain("var(--hb-font-h1");
		expect(css).toContain("var(--hb-font-h2");
		expect(css).toContain("var(--hb-font-h3");
		expect(css).toContain("var(--hb-font-h4");
		expect(css).toContain("var(--hb-font-h5");
		expect(css).toContain("var(--hb-font-h6");
		expect(css).toContain("var(--hb-font-body");
		expect(css).toContain("var(--hb-font-statblock");
		expect(css).toContain("var(--hb-font-magic-item");
		expect(css).toContain("var(--hb-font-monster");
		expect(css).toContain("var(--hb-font-dropcap");
		expect(css).toContain("var(--hb-font-read-aloud");
		expect(css).toContain("var(--hb-font-note");
		expect(css).toContain("var(--hb-font-handwritten");
	});

	test("renders custom font tags and comma-chained font/color/alignment combinations", () => {
		const colorTags = colorSlotsToMap([{ name: "crimson", color: "#9c2b1b" }]);
		const fontTags = fontTagSlotsToMap([
			{ name: "elvish", font: "Tengwar" },
			{ name: "runic", font: "Elder Futhark" },
		]);

		const md = [
			"Speak {{elvish friend}} and enter.",
			"",
			"Inscribed {{elvish,crimson Ash nazg}} upon gold.",
			"",
			"{{runic,center Carved Runes}}",
			"",
			"{{elvish,crimson",
			"A verse in Elvish.",
			"}}",
		].join("\n");

		const html = renderPageHtml(md, { colorTags, fontTags });
		expect(html).toContain('<span class="elvish" style="font-family:var(--hb-custom-font-1)">friend</span>');
		expect(html).toContain(
			'<span class="elvish crimson" style="color:#9c2b1b;font-family:var(--hb-custom-font-1)">Ash nazg</span>',
		);
		expect(html).toContain(
			'<span class="runic center" style="font-family:var(--hb-custom-font-2)">Carved Runes</span>',
		);
		expect(html).toMatch(
			/<div class="block elvish crimson" style="color:#9c2b1b;font-family:var\(--hb-custom-font-1\)"[^>]*>/,
		);
	});

	test("parses YAML frontmatter overrides, injects running headers/footers, and honors {{no-header}}/{{no-footer}}", () => {
		const md = [
			"---",
			"hb-theme: eldritch",
			"hb-size: a4",
			"hb-columns: 1",
			"running-header: Chapter I — Sunken Reach",
			"running-footer: Campaign Gazetteer",
			"---",
			"{{no-header}}",
			"{{no-footer}}",
			"# Cover",
			"\\page",
			"Page Two Content",
			"\\page",
			"Page Three Content",
			"{{footnote SPECIAL APPENDIX}}",
		].join("\n");

		const overrides = extractBookFrontmatterOverrides(md);
		expect(overrides).toEqual({
			theme: "dark",
			pageSize: "a4",
			columns: 1,
			runningHeader: "Chapter I — Sunken Reach",
			runningFooter: "Campaign Gazetteer",
		});

		const { pages, frontmatterOverrides } = transpileToBook(md);
		expect(pages).toHaveLength(3);

		const markup = buildBookPagesMarkup(pages, {
			runningHeader: frontmatterOverrides.runningHeader,
			runningFooter: frontmatterOverrides.runningFooter,
			defaultColumns: frontmatterOverrides.columns,
		});

		// All pages inherit single-column from hb-columns: 1
		expect(markup).toContain('<section class="page single-column" data-page="1">');
		expect(markup).toContain('<section class="page single-column" data-page="2">');
		expect(markup).toContain('<section class="page single-column" data-page="3">');

		// Page 1 suppressed both running header and footer; pages 2 and 3 have running header
		const page1 = markup.split('<section class="page single-column" data-page="2">')[0];
		expect(page1).not.toContain("hb-running-header");
		expect(page1).not.toContain("hb-running-footer");
		expect(page1).not.toContain("page-footer");

		// Page 2 receives running header + running footer with page number 2
		const page2 = markup
			.split('<section class="page single-column" data-page="2">')[1]
			.split('<section class="page single-column" data-page="3">')[0];
		expect(page2).toContain('<div class="hb-running-header">Chapter I — Sunken Reach</div>');
		expect(page2).toContain(
			'<div class="hb-running-footer"><span class="hb-running-footer-text">Campaign Gazetteer</span><span class="hb-running-footer-page">2</span></div>',
		);

		// Page 3 overrides footer with explicit {{footnote SPECIAL APPENDIX}}
		const page3 = markup.split('<section class="page single-column" data-page="3">')[1];
		expect(page3).toContain('<div class="hb-running-header">Chapter I — Sunken Reach</div>');
		expect(page3).toContain("SPECIAL APPENDIX");
		expect(page3).not.toContain("hb-running-footer");

		// Automatic @page print sizing rules
		const letterPrint = getPrintPageRuleCss("letter");
		expect(letterPrint).toContain("size: 8.5in 11in;");
		expect(letterPrint).toContain("margin: 0 !important;");
		expect(letterPrint).toContain(".page:not(:last-child)");
		const a4Print = getPrintPageRuleCss("a4");
		expect(a4Print).toContain("size: 210mm 297mm;");
	});

	test("supports image focal-point alignment modifiers (|pos-top, |pos-bottom, |pos-left, |pos-30-20)", () => {
		const md = [
			"![[portrait.png|col,pos-top]]",
			"",
			"![[banner.png|top-40,pos-bottom]]",
			"",
			"![[map.png|bg,pos-left]]",
			"",
			"![[hero.png|col,pos-30-20]]",
		].join("\n");

		const { v3, pages } = transpileToBook(md, {
			resolveImagePath: (link) => link,
			resolveImageSrc: (url) => `data:image/png;base64,${url}`,
		});

		expect(v3).toContain("![portrait](portrait.png){.hb-img-col,object-position:top center}");
		expect(v3).toContain("![banner](banner.png){.hb-img-top,height:40%,object-position:bottom center}");
		expect(v3).toContain("![map](map.png){.hb-img-bg,object-position:center left}");
		expect(v3).toContain("![hero](hero.png){.hb-img-col,object-position:30% 20%}");

		expect(pages[0]).toContain('style="object-position:top center"');
		expect(pages[0]).toContain('style="object-position:bottom center"');
		expect(pages[0]).toContain('style="object-position:center left"');
		expect(pages[0]).toContain('style="object-position:30% 20%"');
	});

	test("resolves external local file paths (Windows drive, Unix absolute, and file:///) to app://local/ URLs", () => {
		const winMd = "![alt|bg](D:\\Games\\Wallpapers\\Test%20Image.jpg)";
		const { v3: winV3, pages: winPages } = transpileToBook(winMd, {
			resolveImagePath: () => null,
		});

		expect(winV3.trim()).toBe("![alt](app://local/D:/Games/Wallpapers/Test%20Image.jpg){.hb-img-bg}");
		expect(winPages).toHaveLength(1);
		expect(winPages[0]).toContain('src="app://local/D:/Games/Wallpapers/Test%20Image.jpg"');
		expect(winPages[0]).toMatch(/class="[^"]*\bbg\b[^"]*"/);

		const extraMd = [
			"![uri|bg](file:///D:/Games/Wallpapers/Test%20Image.jpg)",
			"",
			"![unix|col](/Users/alice/Pictures/Test%20Image.png)",
		].join("\n");
		const { pages: extraPages } = transpileToBook(extraMd, {
			resolveImagePath: () => null,
		});
		expect(extraPages[0]).toContain('src="app://local/D:/Games/Wallpapers/Test%20Image.jpg"');
		expect(extraPages[0]).toContain('src="app://local//Users/alice/Pictures/Test%20Image.png"');
	});
});
