/*! @license
 * Homebrewery V3 (5ePHB) layout conventions: NaturalCrit Homebrewery, MIT License
 * (https://github.com/naturalcrit/homebrewery).
 * Bundled fonts Cinzel, Uncial Antiqua, Ephesis, Libre Baskerville, Open Sans: SIL Open Font License 1.1.
 */

/**
 * Book Layout & Print Stylesheet Engine (`5ePHB` Offline Edition).
 *
 * Generates a self-contained HTML document with D&D 5e book typography,
 * fixed-aspect two-column pages, anti-split guards, and strict `@media print`
 * rules so the iframe preview is 100% isolated from Obsidian theme styles.
 *
 * Third-Party Attributions:
 * - Homebrewery V3 (`5ePHB`) layout & CSS conventions modeled after NaturalCrit's
 *   Homebrewery (https://github.com/naturalcrit/homebrewery), MIT License.
 * - Bundled fonts: Cinzel (The Cinzel Project Authors), Uncial Antiqua
 *   (Astigmatic / Brian J. Bonislawsky), Ephesis (The Ephesis Project Authors),
 *   Libre Baskerville (The Libre Baskerville Project Authors), and Open Sans
 *   (The Open Sans Project Authors), each licensed under the SIL Open Font License 1.1.
 */

import { getEmbeddedFontsCss } from "./fonts";
import { BookStyleOptions, getThemeCss } from "./themes";
import { escapeHtml } from "./utils";

export type { BookStyleOptions } from "./themes";

export type PageSize = "letter" | "a4";

export interface RenderBookOptions {
	title?: string;
	pageSize?: PageSize;
	/** Theme and color-slot styling. */
	style?: BookStyleOptions;
	/** Optional user CSS injected last in `<head>`. */
	customCss?: string;
	/** Book/chapter running header text. */
	runningHeader?: string;
	/** Book/chapter running footer text. */
	runningFooter?: string;
	/** Default column count for pages (`1` or `2`). */
	defaultColumns?: 1 | 2;
}

interface PageDimensions {
	cssSize: string;
	width: string;
	height: string;
}

const PAGE_DIMENSIONS: Record<PageSize, PageDimensions> = {
	letter: { cssSize: "letter", width: "8.5in", height: "11in" },
	a4: { cssSize: "A4", width: "210mm", height: "297mm" },
};

/** Returns the complete D&D 5e book CSS and print stylesheet for the chosen page size and theme. */
export function getBookStylesheet(pageSize: PageSize = "letter", style: BookStyleOptions = {}): string {
	const dim = PAGE_DIMENSIONS[pageSize];
	const base = `
:root {
	--hb-parchment: #f6f2e9;
	--hb-parchment-light: #fbf8f1;
	--hb-parchment-edge: #e9dec8;
	--hb-ink: #1e1915;
	--hb-crimson: #58180d;
	--hb-crimson-rule: #9c2b1b;
	--hb-gold: #c9ad6a;
	--hb-gold-accent: #e69a28;
	--hb-note-bg: #e0e5c1;
	--hb-note-border: #1e1e1e;
	--hb-note-title-color: #1e1915;
	--hb-note-text-color: #1e1915;
	--hb-desc-bg: #faf7ea;
	--hb-descriptive-bg: #faf7ea;
	--hb-descriptive-border: #9c2b1b;
	--hb-descriptive-title-color: #58180d;
	--hb-descriptive-text-color: #1e1915;
	--hb-stat-bg: #fdf1dc;
	--hb-statblock-bg: #fdf1dc;
	--hb-statblock-border: #e69a28;
	--hb-statblock-heading-color: #58180d;
	--hb-statblock-text-color: #1e1915;
	--hb-statblock-divider-color: #9c2b1b;
	--hb-table-alt: #e0e5c1;
	--hb-table-header-bg: transparent;
	--hb-table-header-text: #58180d;
	--hb-table-row-alt: #e0e5c1;
	--hb-strong-color: #4a150b;
	--hb-em-color: #463c33;
	--hb-handwritten-bg: #f4ebd8;
	--hb-handwritten-border: rgba(120, 90, 48, 0.28);
	--hb-handwritten-shadow: inset 0 0 12px rgba(120, 88, 42, 0.12), 0 1px 4px rgba(0, 0, 0, 0.08);
	--hb-handwritten-text: #2a1f16;
	--hb-handwritten-text-color: #2a1f16;
	--hb-page-bg: #f6f2e9;
	--hb-page-grad: radial-gradient(ellipse at center, var(--hb-parchment-light) 0%, var(--hb-parchment) 72%, var(--hb-parchment-edge) 100%);
	--hb-text-color: #1e1915;
	--hb-heading-color: #58180d;
	--hb-serif: 'Libre Baskerville', 'Book Antiqua', Palatino, Georgia, serif;
	--hb-display: 'Cinzel', 'Libre Baskerville', Georgia, serif;
	--hb-ornate: 'Uncial Antiqua', 'Cinzel', serif;
	--hb-handwritten: 'Ephesis', cursive;
	--hb-sans: 'Open Sans', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
	--hb-font-h1: var(--hb-display);
	--hb-font-h2: var(--hb-font-h1);
	--hb-font-h3: var(--hb-font-h1);
	--hb-font-h4: var(--hb-font-h1);
	--hb-font-h5: var(--hb-font-h1);
	--hb-font-h6: var(--hb-font-h1);
	--hb-font-body: var(--hb-serif);
	--hb-font-statblock: var(--hb-sans);
	--hb-font-magic-item: var(--hb-font-statblock);
	--hb-font-monster: var(--hb-font-statblock);
	--hb-font-dropcap: var(--hb-ornate);
	--hb-font-read-aloud: var(--hb-serif);
	--hb-font-note: var(--hb-sans);
	--hb-font-handwritten: var(--hb-handwritten);
}

* {
	box-sizing: border-box;
	-webkit-print-color-adjust: exact;
	print-color-adjust: exact;
}

html,
body {
	margin: 0;
	padding: 0;
	background: #2f2c28;
	color: var(--hb-text-color);
	font-family: var(--hb-font-body, 'Libre Baskerville', 'Book Antiqua', Palatino, Georgia, serif);
	font-size: 9.5pt;
	line-height: 1.35;
}

.pages {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 20px;
	padding: 20px 12px 32px;
}

.page {
	position: relative;
	z-index: 0;
	width: ${dim.width};
	height: ${dim.height};
	padding: 0.62in 0.55in 0.72in 0.55in;
	background-color: var(--hb-page-bg);
	background-image: var(--hb-page-grad);
	color: var(--hb-text-color);
	box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45);
	column-count: 2;
	column-gap: 0.35in;
	column-fill: auto;
	overflow: hidden;
	text-align: justify;
	hyphens: auto;
}

.page > *:not(.hb-img-bg):not(.hb-overflow-badge):not(.page-footer):not(.pageNumber):not(.footnote):not(.hb-page-body):not(.colophon):not(.hb-running-header):not(.hb-running-footer) {
	position: relative;
	z-index: 1;
}

/* Single-Column Special Pages (covers, full-page maps, colophons) */
.page.single-column,
.page.single-column > .hb-page-body {
	column-count: 1;
}

/* Banner pages: vertical flex container with top/bottom full-width image slots */
.page.hb-banner-page {
	display: flex;
	flex-direction: column;
	column-count: 1;
}

.page.hb-banner-page > .hb-page-body {
	flex: 1 1 auto;
	min-height: 0;
	column-count: 2;
	column-gap: 0.35in;
	column-fill: auto;
	overflow: hidden;
	position: static;
}

.page.hb-banner-page.single-column > .hb-page-body {
	column-count: 1;
}

.hb-slot-top,
.hb-slot-bottom {
	flex: 0 0 auto;
	width: 100%;
	position: relative;
	z-index: 1;
}

.hb-slot-top {
	margin-bottom: 0.2in;
}

.hb-slot-bottom {
	margin-top: 0.2in;
}

.hb-slot-top .hb-image-wrapper,
.hb-slot-bottom .hb-image-wrapper {
	width: 100%;
	margin: 0;
}

.hb-slot-top .hb-image-wrapper > img,
.hb-slot-bottom .hb-image-wrapper > img {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.page-footer,
.block.pageNumber {
	position: absolute;
	z-index: 2;
	bottom: 0.25in;
	right: 0.55in;
	font-family: var(--hb-font-h1, var(--hb-display));
	font-size: 8.5pt;
	font-weight: 700;
	color: #8b6d29;
	border-top: 1px solid var(--hb-gold);
	padding-top: 2px;
	min-width: 1.5em;
	text-align: center;
	pointer-events: none;
}

.page:nth-child(even) .page-footer,
.page:nth-child(even) .block.pageNumber {
	right: auto;
	left: 0.55in;
}

.block.footnote {
	position: absolute;
	z-index: 2;
	bottom: 0.25in;
	left: 0.55in;
	right: 1.35in;
	font-family: var(--hb-font-h1, var(--hb-display));
	font-variant: small-caps;
	font-size: 7.5pt;
	letter-spacing: 0.05em;
	color: #7c5f24;
	border-top: 1px solid var(--hb-gold);
	padding-top: 2px;
	text-align: left;
	pointer-events: none;
}

.block.footnote p {
	margin: 0;
	text-indent: 0;
}

.page:nth-child(even) .block.footnote {
	left: 1.35in;
	right: 0.55in;
	text-align: right;
}

/* Book-Wide Running Headers & Alternating Footers */
.hb-running-header {
	position: absolute;
	z-index: 2;
	top: 0.24in;
	left: 0.55in;
	right: 0.55in;
	font-family: var(--hb-font-h1, var(--hb-display));
	font-variant: small-caps;
	font-size: 7.5pt;
	letter-spacing: 0.08em;
	color: var(--hb-heading-color);
	opacity: 0.72;
	border-bottom: 0.5px solid var(--hb-gold);
	padding-bottom: 2px;
	text-align: right;
	pointer-events: none;
}

.page:nth-child(even) .hb-running-header {
	text-align: left;
}

.hb-running-footer {
	position: absolute;
	z-index: 2;
	bottom: 0.25in;
	left: 0.55in;
	right: 0.55in;
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 12px;
	font-family: var(--hb-font-h1, var(--hb-display));
	font-variant: small-caps;
	font-size: 7.8pt;
	letter-spacing: 0.05em;
	color: var(--hb-heading-color);
	opacity: 0.78;
	border-top: 1px solid var(--hb-gold);
	padding-top: 2px;
	pointer-events: none;
}

.hb-running-footer-text {
	flex: 1 1 auto;
	text-align: left;
}

.hb-running-footer-page {
	flex: 0 0 auto;
	font-weight: 700;
	font-size: 8.5pt;
}

.page:nth-child(even) .hb-running-footer {
	flex-direction: row-reverse;
}

.page:nth-child(even) .hb-running-footer-text {
	text-align: right;
}

.block.no-header,
.block.no-footer,
.block.twoColumn {
	display: none;
}

/* Colophon: bottom-anchored credits / license block */
.block.colophon {
	position: absolute;
	z-index: 2;
	left: 0.55in;
	right: 0.55in;
	bottom: 0.7in;
	font-family: var(--hb-sans);
	font-size: 8pt;
	line-height: 1.35;
	text-align: center;
	column-span: all;
	border-top: 1px solid var(--hb-gold);
	padding-top: 6px;
}

.block.colophon p {
	margin: 0 0 0.3em;
	text-indent: 0;
}

/* Headings */
h1, h2, h3, h4, h5, h6 {
	font-family: var(--hb-font-h1, 'Cinzel', 'Libre Baskerville', Georgia, serif);
	color: var(--hb-heading-color);
	font-weight: 700;
	line-height: 1.15;
	padding-bottom: 2px;
	margin-top: 0.7em;
	margin-bottom: 0.25em;
	break-after: avoid;
	page-break-after: avoid;
	text-align: left;
}

h1 {
	font-family: var(--hb-font-h1, var(--hb-display));
	font-size: 23pt;
	font-variant: small-caps;
	letter-spacing: 0.03em;
	margin-top: 0;
	padding-bottom: 4px;
	border-bottom: 2px solid var(--hb-gold);
}

h2 {
	font-family: var(--hb-font-h2, var(--hb-font-h1, var(--hb-display)));
	font-size: 16pt;
	letter-spacing: 0.02em;
	margin-top: 0.8em;
	padding-bottom: 2px;
	border-bottom: 1px solid var(--hb-gold);
}

h3 {
	font-family: var(--hb-font-h3, var(--hb-font-h1, var(--hb-display)));
	font-size: 12.5pt;
	border-bottom: 2px solid var(--hb-gold);
	padding-bottom: 2px;
	margin-top: 0.85em;
}

h4 {
	font-family: var(--hb-font-h4, var(--hb-font-h1, var(--hb-display)));
	font-size: 10.5pt;
	margin-top: 0.65em;
	margin-bottom: 0.15em;
}

h5 {
	font-family: var(--hb-font-h5, var(--hb-font-h1, var(--hb-display)));
	font-size: 9.8pt;
	font-variant: small-caps;
	letter-spacing: 0.02em;
	color: var(--hb-heading-color);
	margin-top: 0.35em;
	margin-bottom: 0.2em;
}

h6 {
	font-family: var(--hb-font-h6, var(--hb-font-h1, var(--hb-display)));
	font-size: 9pt;
	font-weight: 700;
	font-style: italic;
	color: var(--hb-heading-color);
	margin-top: 0.25em;
	margin-bottom: 0.15em;
}

p {
	margin: 0 0 0.55em;
}

p + p {
	text-indent: 1em;
	margin-top: -0.25em;
}

h1 + p, h2 + p, h3 + p, h4 + p, h5 + p,
blockquote + p, table + p, .block + p, ul + p, ol + p,
p.hb-dropcap {
	text-indent: 0;
	margin-top: 0;
}

/* Ornate Illuminated Drop Cap */
.dropcap::first-letter,
p.hb-dropcap::first-letter,
.block.dropcap > p:first-of-type::first-letter,
.page > h1 + p::first-letter,
.hb-page-body > h1 + p::first-letter {
	font-family: var(--hb-font-dropcap, 'Uncial Antiqua', 'Cinzel', serif);
	float: left;
	font-weight: 400;
	font-size: 3.8em;
	line-height: 0.88;
	padding: 0.06em 0.14em 0.06em 0.02em;
	margin: 0.04em 0.12em 0 0;
	background: linear-gradient(180deg, #b89856 0%, #7c602c 55%, #a58648 100%);
	-webkit-background-clip: text;
	background-clip: text;
	-webkit-text-fill-color: transparent;
	color: #7c602c;
	text-shadow: 0.02em 0.03em 0.05em rgba(60, 40, 10, 0.35);
}

.dropcap::first-line,
p.hb-dropcap::first-line,
.block.dropcap > p:first-of-type::first-line {
	font-variant: small-caps;
	letter-spacing: 0.04em;
}

.page strong,
.page b {
	color: var(--hb-strong-color);
}

.page em,
.page i {
	color: var(--hb-em-color);
}

.page h1 strong, .page h1 b, .page h1 em, .page h1 i,
.page h2 strong, .page h2 b, .page h2 em, .page h2 i,
.page h3 strong, .page h3 b, .page h3 em, .page h3 i,
.page h4 strong, .page h4 b, .page h4 em, .page h4 i,
.page h5 strong, .page h5 b, .page h5 em, .page h5 i,
.page h6 strong, .page h6 b, .page h6 em, .page h6 i,
.block.monster .hb-dl-row strong,
.block.monster .hb-dl-row b,
.block.monster .hb-dl-row em,
.block.monster .hb-dl-row i,
.block.monster table thead th strong,
.block.monster table thead th b,
[style*="color:"] strong,
[style*="color:"] b,
[style*="color:"] em,
[style*="color:"] i {
	color: inherit;
}

ul, ol {
	margin: 0 0 0.65em;
	padding-left: 1.35em;
	text-align: left;
}

li {
	margin-bottom: 0.2em;
}

hr {
	border: none;
	height: 2px;
	background: linear-gradient(to right, var(--hb-gold), transparent);
	margin: 0.6em 0;
}

mark {
	background-color: rgba(230, 154, 40, 0.28);
	color: inherit;
	padding: 0 2px;
	border-radius: 2px;
}

code {
	font-family: Consolas, "Courier New", monospace;
	font-size: 8.5pt;
	background: rgba(88, 24, 13, 0.08);
	padding: 0 3px;
	border-radius: 2px;
}

pre {
	background: rgba(255, 255, 255, 0.45);
	border: 1px solid var(--hb-gold);
	padding: 6px 8px;
	overflow-x: auto;
	font-size: 8pt;
	text-align: left;
	break-inside: avoid;
	page-break-inside: avoid;
}

pre code {
	background: none;
	padding: 0;
}

img {
	max-width: 100%;
	height: auto;
	display: block;
	margin: 0.45em auto;
}

/* Zoom Stage & Facing Spread */
#hb-stage {
	margin: 0 auto;
	position: relative;
}

.pages {
	width: max-content;
	transform-origin: 0 0;
}

.pages[data-view-mode="spread"] {
	display: grid;
	grid-template-columns: auto auto;
	justify-content: center;
	align-items: start;
	gap: 0;
}

.pages[data-view-mode="spread"] > .page:first-child {
	grid-column: 2;
}

/* Multi-Mode Image Alignment & Parchment Edge-Fade */
.hb-image-wrapper {
	break-inside: avoid;
	page-break-inside: avoid;
	-webkit-column-break-inside: avoid;
}

.hb-image-wrapper > img {
	display: block;
	margin: 0;
}

.hb-image-wrapper.hb-img-inline {
	width: 100%;
	margin: 8px 0;
}

.hb-image-wrapper.hb-img-inline > img:not([style*="width:"]) {
	width: 100%;
	height: auto;
}

.hb-image-wrapper.hb-img-inline > img[style*="width:"] {
	max-width: 100%;
	height: auto;
	margin: 0 auto;
}

.hb-image-wrapper.hb-img-bg {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	margin: 0;
	z-index: 0;
	pointer-events: none;
}

.hb-image-wrapper.hb-img-bg > img {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.hb-image-wrapper.hb-img-bg.hb-img-bg-width {
	display: flex;
	align-items: flex-start;
	justify-content: center;
}

.hb-image-wrapper.hb-img-bg.hb-img-bg-width > img {
	width: 100%;
	height: auto;
	object-fit: contain;
}

.hb-image-wrapper.hb-img-bg.hb-img-bg-height {
	display: flex;
	align-items: flex-start;
	justify-content: center;
}

.hb-image-wrapper.hb-img-bg.hb-img-bg-height > img {
	width: auto;
	height: 100%;
	object-fit: contain;
}

/* Top / bottom banners (promoted into .hb-slot-* by the page builder; fallback spans columns) */
.hb-image-wrapper.hb-img-top,
.hb-image-wrapper.hb-img-bottom {
	column-span: all;
	-webkit-column-span: all;
	width: 100%;
	height: 35%;
	margin: 0 0 8px;
}

.hb-image-wrapper.hb-img-top > img,
.hb-image-wrapper.hb-img-bottom > img {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.hb-image-wrapper.hb-img-col {
	width: 100%;
	height: 9.2in;
	margin: 0 0 8px;
}

.hb-image-wrapper.hb-img-col > img {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.hb-image-wrapper.hb-img-left {
	float: left;
	margin: 2px 12px 8px 0;
}

.hb-image-wrapper.hb-img-right {
	float: right;
	margin: 2px 0 8px 12px;
}

.hb-image-wrapper.hb-img-left > img,
.hb-image-wrapper.hb-img-right > img {
	width: 100%;
	height: auto;
}

/* Composable rectangular edge-fade: inset shadow in the page color dissolves the edges */
.hb-img-fade {
	--hb-fade: 25;
	position: relative;
	border-radius: 14px;
	overflow: hidden;
}

.hb-img-fade::after {
	content: "";
	position: absolute;
	inset: 0;
	border-radius: inherit;
	pointer-events: none;
	box-shadow: inset 0 0 calc(var(--hb-fade) * 1.2px) calc(var(--hb-fade) * 0.45px) var(--hb-page-bg);
}

.hb-image-wrapper.hb-img-bg.hb-img-fade {
	position: absolute;
}

img.hb-img-bg {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	object-fit: cover;
	z-index: 0;
	margin: 0;
	pointer-events: none;
}

img.hb-img-col {
	width: 100%;
	height: 9.2in;
	object-fit: cover;
	display: block;
	break-inside: avoid;
	page-break-inside: avoid;
}

img.hb-img-inline {
	width: 100%;
	margin: 8px 0;
	break-inside: avoid;
	page-break-inside: avoid;
}

img.hb-img-left {
	float: left;
	margin: 2px 12px 8px 0;
	break-inside: avoid;
	page-break-inside: avoid;
}

img.hb-img-right {
	float: right;
	margin: 2px 0 8px 12px;
	break-inside: avoid;
	page-break-inside: avoid;
}

/* Wide / Column / Spacer Helpers */
.wide {
	column-span: all;
	-webkit-column-span: all;
	margin-bottom: 0.65em;
}

.columnSplit {
	break-after: column;
	page-break-after: always;
	-webkit-column-break-after: always;
	height: 0;
	margin: 0;
	padding: 0;
}

.blank {
	height: 0.85em;
}

/* Anti-Split Controls */
table,
.monster,
.note,
.descriptive,
.handwritten,
.spell,
.item,
.no-split,
.classTable {
	break-inside: avoid;
	page-break-inside: avoid;
	-webkit-column-break-inside: avoid;
}

/* Tables & Class Progression Frames */
table {
	width: 100%;
	border-collapse: collapse;
	margin: 0.55em 0 0.75em;
	font-family: var(--hb-font-statblock, 'Open Sans', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif);
	font-size: 8.4pt;
	text-align: left;
}

thead th {
	font-weight: 700;
	background-color: var(--hb-table-header-bg);
	color: var(--hb-table-header-text);
	border-bottom: 1.5px solid var(--hb-table-header-text);
	padding: 3px 5px;
}

tbody td {
	padding: 3px 5px;
	vertical-align: top;
}

tbody tr:nth-child(odd) {
	background-color: var(--hb-table-row-alt);
}

.block.classTable {
	margin: 0.65em 0;
	font-family: var(--hb-font-statblock, 'Open Sans', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif);
	text-align: left;
}

.block.classTable.frame {
	background: var(--hb-statblock-bg);
	border: 4px double var(--hb-gold);
	outline: 1px solid var(--hb-statblock-border);
	padding: 10px 12px;
	box-shadow: 0 3px 10px rgba(0, 0, 0, 0.16);
}

.block.classTable h5,
.block.classTable h3 {
	font-family: var(--hb-font-h3, var(--hb-font-h1, var(--hb-display)));
	color: var(--hb-statblock-heading-color);
	margin: 0 0 0.35em;
	border-bottom: none;
}

.block.classTable table {
	margin: 0.2em 0 0;
	font-size: 8pt;
}

/* Spell Lists */
.block.spellList {
	font-family: var(--hb-font-statblock, 'Open Sans', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif);
	font-size: 8.5pt;
	line-height: 1.32;
	text-align: left;
	margin: 0.45em 0 0.65em;
}

.block.spellList.wide {
	column-count: 2;
	column-gap: 0.3in;
}

.block.spellList h4,
.block.spellList h5 {
	font-family: var(--hb-font-h4, var(--hb-font-h1, var(--hb-display)));
	color: var(--hb-statblock-heading-color);
	border-bottom: 1px solid var(--hb-gold);
	margin: 0.5em 0 0.25em;
	padding-bottom: 1px;
}

.block.spellList ul {
	list-style: none;
	padding-left: 0;
	margin: 0 0 0.55em;
	break-inside: avoid;
	page-break-inside: avoid;
}

.block.spellList li {
	padding-left: 1.1em;
	text-indent: -1.1em;
	margin-bottom: 0.15em;
}

/* Note Callout Box */
.block.note {
	background-color: var(--hb-note-bg);
	color: var(--hb-note-text-color);
	border-top: 2px solid var(--hb-note-border);
	border-bottom: 2px solid var(--hb-note-border);
	padding: 8px 11px;
	margin: 0.7em 0;
	font-family: var(--hb-font-note, 'Open Sans', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif);
	font-size: 8.6pt;
	line-height: 1.35;
	box-shadow: 1px 2px 6px rgba(0, 0, 0, 0.14);
	text-align: left;
}

.block.note h5 {
	font-family: var(--hb-font-note, 'Open Sans', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif);
	font-size: 9.5pt;
	font-weight: 700;
	color: var(--hb-note-title-color);
	margin: 0 0 0.3em;
}

.note h1,
.note h2,
.note h3,
.note h4,
.note h5,
.note h6,
.note .hb-block-title {
	color: var(--hb-note-title-color);
}

.block.note p:last-child,
.block.descriptive p:last-child {
	margin-bottom: 0;
}

/* Read-Aloud Descriptive Box */
.block.descriptive {
	background-color: var(--hb-descriptive-bg);
	color: var(--hb-descriptive-text-color);
	border-top: 1px solid var(--hb-gold);
	border-bottom: 1px solid var(--hb-gold);
	border-left: 3px solid var(--hb-descriptive-border);
	border-right: 3px solid var(--hb-descriptive-border);
	padding: 9px 12px;
	margin: 0.7em 0;
	font-family: var(--hb-font-read-aloud, 'Libre Baskerville', 'Book Antiqua', Palatino, Georgia, serif);
	font-size: 8.8pt;
	line-height: 1.38;
	box-shadow: 0 2px 6px rgba(0, 0, 0, 0.14);
	text-align: left;
}

.block.descriptive h5 {
	font-family: var(--hb-font-read-aloud, 'Libre Baskerville', 'Book Antiqua', Palatino, Georgia, serif);
	color: var(--hb-descriptive-title-color);
	margin: 0 0 0.25em;
}

.descriptive h1,
.descriptive h2,
.descriptive h3,
.descriptive h4,
.descriptive h5,
.descriptive h6,
.descriptive .hb-block-title {
	color: var(--hb-descriptive-title-color);
}

/* Handwritten Note Block */
.handwritten,
.block.handwritten {
	font-family: var(--hb-font-handwritten, 'Ephesis', cursive);
	font-size: 1.32em;
	line-height: 1.25;
	padding: 10px 14px;
	margin: 8px 0;
	border-radius: 4px;
	break-inside: avoid;
	page-break-inside: avoid;
	-webkit-column-break-inside: avoid;
	background-color: var(--hb-handwritten-bg);
	color: var(--hb-handwritten-text-color);
	border: 1px solid var(--hb-handwritten-border);
	box-shadow: var(--hb-handwritten-shadow);
	text-align: left;
}

.handwritten p,
.block.handwritten p {
	text-indent: 0;
	margin-top: 0;
}

.handwritten p:last-child,
.block.handwritten p:last-child {
	margin-bottom: 0;
}

.handwritten h5,
.block.handwritten h5,
.handwritten h1,
.handwritten h2,
.handwritten h3,
.handwritten h4,
.handwritten .hb-block-title {
	font-family: var(--hb-font-handwritten, 'Ephesis', cursive);
	font-size: 1.15em;
	font-weight: 400;
	color: var(--hb-heading-color);
	margin: 0 0 0.2em;
}

/* Blockquotes fallback */
blockquote {
	margin: 0.6em 0;
	padding: 6px 10px;
	border-left: 3px solid var(--hb-gold);
	background: var(--hb-descriptive-bg);
	font-style: italic;
}

/* 5e Monster Statblock */
.block.monster {
	font-family: var(--hb-font-monster, var(--hb-font-statblock, 'Open Sans', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif));
	font-size: 8.4pt;
	line-height: 1.32;
	color: var(--hb-statblock-text-color);
	margin: 0.65em 0;
	text-align: left;
}

.block.monster.frame {
	background: var(--hb-statblock-bg);
	padding: 8px 10px 10px;
	border-top: 4px solid var(--hb-statblock-border);
	border-bottom: 4px solid var(--hb-statblock-border);
	box-shadow:
		0 2px 8px rgba(0, 0, 0, 0.22),
		inset 0 1px 0 var(--hb-statblock-divider-color),
		inset 0 -1px 0 var(--hb-statblock-divider-color);
	outline: 1px solid var(--hb-statblock-border);
}

.block.monster h2 {
	font-family: var(--hb-font-h2, var(--hb-font-h1, var(--hb-display)));
	font-size: 14.5pt;
	color: var(--hb-statblock-heading-color);
	border-bottom: none;
	margin: 0 0 1px;
	padding-bottom: 0;
	letter-spacing: 0.02em;
}

.block.monster h2 + p {
	margin-bottom: 0.25em;
	font-size: 8.3pt;
	text-indent: 0;
}

.block.monster h3 {
	font-family: var(--hb-font-h3, var(--hb-font-h1, var(--hb-display)));
	font-size: 11pt;
	color: var(--hb-statblock-heading-color);
	border-bottom: 1.5px solid var(--hb-statblock-divider-color);
	margin: 0.6em 0 0.35em;
	padding-bottom: 1px;
}

.block.monster hr {
	height: 5px;
	border: none;
	margin: 0.45em 0;
	background: var(--hb-statblock-divider-color);
	clip-path: polygon(0 0, 100% 50%, 0 100%);
}

.block.monster table {
	margin: 0.2em 0;
	font-family: inherit;
	font-size: 8.2pt;
	text-align: center;
}

.block.monster table thead th {
	background-color: transparent;
	color: var(--hb-statblock-heading-color);
	border-bottom: none;
	text-align: center;
	padding: 2px 3px;
}

.block.monster table tbody td {
	color: var(--hb-statblock-heading-color);
	text-align: center;
	padding: 1px 3px;
}

.block.monster table tbody tr {
	background: transparent;
}

dl.hb-dl {
	margin: 0.2em 0;
}

.hb-dl-row {
	margin: 0.12em 0;
	padding-left: 1.2em;
	text-indent: -1.2em;
}

.block.monster .hb-dl-row {
	color: var(--hb-statblock-heading-color);
}

.hb-dl-row dt {
	display: inline;
	font-weight: 700;
}

.hb-dl-row dd {
	display: inline;
	margin: 0 0 0 0.35em;
}

/* Vertical spacers (:, ::, :::) */
.hb-spacer {
	display: block;
}

/* Text alignment tags */
.center { text-align: center; }
.right { text-align: right; }
.justify { text-align: justify; }
span.center,
span.right,
span.justify {
	display: block;
}

/* Native spell / magic item callouts */
.block.spell,
.block.item {
	margin: 0.7em 0;
	padding: 8px 11px;
	font-size: 8.6pt;
	line-height: 1.35;
	text-align: left;
	background: var(--hb-descriptive-bg);
	color: var(--hb-statblock-text-color);
	box-shadow: 0 2px 6px rgba(0, 0, 0, 0.14);
	break-inside: avoid;
	page-break-inside: avoid;
	-webkit-column-break-inside: avoid;
}

.block.spell {
	font-family: var(--hb-font-statblock, var(--hb-sans));
	border-left: 4px solid var(--hb-statblock-divider-color);
	border-top: 1px solid var(--hb-statblock-border);
	border-bottom: 1px solid var(--hb-statblock-border);
}

.block.item {
	font-family: var(--hb-font-magic-item, var(--hb-font-statblock, var(--hb-sans)));
	border: 1px solid var(--hb-statblock-border);
	border-top: 4px solid var(--hb-statblock-border);
}

.block.spell h5,
.block.item h5,
.monster h1,
.monster h2,
.monster h3,
.monster h4,
.monster h5,
.spell h3,
.spell h4,
.item h3,
.item h4 {
	font-family: var(--hb-font-h3, var(--hb-font-h1, var(--hb-display)));
	color: var(--hb-statblock-heading-color);
}

.block.spell h5,
.block.item h5 {
	font-size: 10.5pt;
	margin: 0 0 0.25em;
}

.block.spell p:last-child,
.block.item p:last-child {
	margin-bottom: 0;
}

/* Dynamic Table of Contents */
.block.toc {
	column-span: all;
	-webkit-column-span: all;
	column-count: 2;
	column-gap: 0.35in;
	text-align: left;
	margin: 0.4em 0;
}

.hb-toc-row {
	display: flex;
	align-items: baseline;
	gap: 4px;
	margin: 0.18em 0;
	font-family: var(--hb-font-h1, var(--hb-display));
	font-size: 9pt;
	break-inside: avoid;
}

.hb-toc-row.hb-toc-l2 { padding-left: 1em; font-size: 8.5pt; }
.hb-toc-row.hb-toc-l3 { padding-left: 2em; font-size: 8pt; font-family: var(--hb-sans); }

.hb-toc-title {
	flex: 0 1 auto;
}

.hb-toc-leader {
	flex: 1 1 auto;
	min-width: 12px;
	border-bottom: 1.5px dotted currentColor;
	opacity: 0.55;
	transform: translateY(-0.2em);
}

.hb-toc-page {
	flex: 0 0 auto;
	font-weight: 700;
}

/* Screen-Only Cursor Tracking & Overflow Diagnostics */
@media screen {
	.active-cursor-block {
		box-shadow:
			-5px 0 0 -1px rgba(156, 43, 27, 0.78),
			0 0 0 2px rgba(156, 43, 27, 0.14);
		background-color: rgba(156, 43, 27, 0.045);
		border-radius: 2px;
		transition: background-color 140ms ease, box-shadow 140ms ease;
	}

	.hb-overflow-warning {
		outline: 2px dashed #b91c1c;
		outline-offset: 2px;
	}

	.hb-overflow-badge {
		position: absolute;
		top: 0.16in;
		right: 0.55in;
		z-index: 10;
		background: rgba(156, 43, 27, 0.94);
		color: #fbf8f1;
		font-family: var(--hb-sans);
		font-size: 7.5pt;
		font-weight: 700;
		padding: 3px 8px;
		border-radius: 3px;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
		pointer-events: none;
	}
}

/* Print Layout */
@page {
	size: ${dim.cssSize};
	margin: 0;
}

@media print {
	html,
	body {
		margin: 0;
		padding: 0;
		background: none !important;
	}

	#hb-stage {
		width: auto !important;
		height: auto !important;
		margin: 0 !important;
	}

	.pages,
	.pages[data-view-mode="spread"] {
		display: block;
		padding: 0;
		margin: 0;
		gap: 0;
		width: auto;
		transform: none !important;
	}

	.pages[data-view-mode="spread"] > .page:first-child {
		grid-column: auto;
	}

	.page {
		margin: 0 !important;
		box-shadow: none !important;
		border: none !important;
	}

	.page:not(:last-child) {
		break-after: page;
		page-break-after: always;
	}

	.page:last-child {
		break-after: auto;
		page-break-after: auto;
	}

	.active-cursor-block {
		box-shadow: none !important;
		background-color: transparent !important;
		outline: none !important;
	}

	.hb-overflow-warning {
		outline: none !important;
		box-shadow: none !important;
	}

	.hb-overflow-badge {
		display: none !important;
	}
}
`;
	const fontFaces = style.customFontsCss?.fontFacesCss?.trim();
	const fontVars = style.customFontsCss?.fontVariablesCss;
	const parts: string[] = [];
	if (fontFaces) parts.push(fontFaces);
	parts.push(base);
	if (fontVars && fontVars.trim()) parts.push(`:root {\n${fontVars}\n}`);
	parts.push(getThemeCss(style));
	return parts.join("\n");
}

const AUTO_PAGE_DIV = /(<div\b[^>]*\bclass="[^"]*\bpageNumber\b[^"]*\bauto\b[^"]*"[^>]*>)\s*<\/div>/gi;
const BANNER_WRAPPER = /<div class="hb-image-wrapper[^"]*\bhb-img-(top|bottom)\b[^"]*"[^>]*>[\s\S]*?<\/div>/gi;
const SINGLE_COLUMN_BLOCK = /<div\b[^>]*\bclass="[^"]*\bsingleColumn\b[^"]*"[^>]*>/i;
const TWO_COLUMN_BLOCK = /<div\b[^>]*\bclass="[^"]*\btwoColumn\b[^"]*"[^>]*>/i;
const NO_HEADER_BLOCK = /<div\b[^>]*\bclass="[^"]*\bno-header\b[^"]*"[^>]*>/i;
const NO_FOOTER_BLOCK = /<div\b[^>]*\bclass="[^"]*\bno-footer\b[^"]*"[^>]*>/i;
const EXPLICIT_FOOTNOTE_BLOCK = /<div\b[^>]*\bclass="[^"]*\bfootnote\b[^"]*"[^>]*>/i;

export interface TocEntry {
	level: number;
	title: string;
	page: number;
}

export interface BuildPagesOptions {
	runningHeader?: string;
	runningFooter?: string;
	defaultColumns?: 1 | 2;
}

/** Returns the dynamic `@media print { @page ... }` rule for full-bleed PDF export. */
export function getPrintPageRuleCss(pageSize: PageSize = "letter"): string {
	const dim = PAGE_DIMENSIONS[pageSize];
	return `@media print {
	@page {
		size: ${dim.width} ${dim.height};
		margin: 0 !important;
	}
	* {
		-webkit-print-color-adjust: exact !important;
		print-color-adjust: exact !important;
	}
	.page:not(:last-child) {
		break-after: page;
		page-break-after: always;
	}
	.page:last-child {
		break-after: auto;
		page-break-after: auto;
	}
}`;
}

/** Builds the two-column dotted-leader Table of Contents rows for `{{toc}}`. */
export function buildTocHtml(entries: TocEntry[]): string {
	return entries
		.map(
			(e) =>
				`<div class="hb-toc-row hb-toc-l${e.level}"><span class="hb-toc-title">${escapeHtml(e.title)}</span><span class="hb-toc-leader"></span><span class="hb-toc-page">${e.page}</span></div>`,
		)
		.join("");
}

/** Renders the `<section class="page">...</section>` markup for a list of rendered page HTML strings. */
export function buildBookPagesMarkup(pages: string[], options: BuildPagesOptions = {}): string {
	const safePages = pages.length ? pages : [""];
	const runningHeader = (options.runningHeader ?? "").trim();
	const runningFooter = (options.runningFooter ?? "").trim();

	return safePages
		.map((content, idx) => {
			const pageNum = idx + 1;
			let resolvedContent = content.replace(AUTO_PAGE_DIV, `$1${pageNum}</div>`);
			const hasExplicitPageNumber = /\bpageNumber\b/.test(resolvedContent);
			const hasExplicitFootnote = EXPLICIT_FOOTNOTE_BLOCK.test(resolvedContent);
			const hasNoHeader = NO_HEADER_BLOCK.test(resolvedContent);
			const hasNoFooter = NO_FOOTER_BLOCK.test(resolvedContent);

			const headerMarkup =
				runningHeader && !hasNoHeader ? `\n<div class="hb-running-header">${escapeHtml(runningHeader)}</div>` : "";

			let footerMarkup = "";
			if (!hasNoFooter) {
				if (runningFooter && !hasExplicitFootnote) {
					const pageSpan = hasExplicitPageNumber
						? ""
						: `<span class="hb-running-footer-page">${pageNum}</span>`;
					footerMarkup = `\n<div class="hb-running-footer"><span class="hb-running-footer-text">${escapeHtml(runningFooter)}</span>${pageSpan}</div>`;
				} else if (!hasExplicitPageNumber) {
					footerMarkup = `\n<div class="page-footer">${pageNum}</div>`;
				}
			}

			const classes = ["page"];
			const isSingleCol =
				SINGLE_COLUMN_BLOCK.test(resolvedContent) ||
				(options.defaultColumns === 1 && !TWO_COLUMN_BLOCK.test(resolvedContent));
			if (isSingleCol) classes.push("single-column");

			const tops: string[] = [];
			const bottoms: string[] = [];
			resolvedContent = resolvedContent.replace(BANNER_WRAPPER, (m, kind: string) => {
				(kind === "top" ? tops : bottoms).push(m);
				return "";
			});

			if (tops.length || bottoms.length) {
				classes.push("hb-banner-page");
				const top = tops.length ? `<div class="hb-slot-top">${tops.join("")}</div>\n` : "";
				const bottom = bottoms.length ? `\n<div class="hb-slot-bottom">${bottoms.join("")}</div>` : "";
				return `<section class="${classes.join(" ")}" data-page="${pageNum}">${headerMarkup}\n${top}<div class="hb-page-body">\n${resolvedContent}\n</div>${bottom}${footerMarkup}\n</section>`;
			}
			return `<section class="${classes.join(" ")}" data-page="${pageNum}">${headerMarkup}\n${resolvedContent}${footerMarkup}\n</section>`;
		})
		.join("\n");
}

/**
 * Builds the persistent iframe shell HTML document initialized once on view open.
 * Embedded static fonts stay in `#hb-base-fonts`, layout/print CSS in `#hb-layout-styles`,
 * print page sizing in `#hb-print-page-rule`, and live custom fonts in `#hb-custom-fonts`.
 */
export function buildBookShellHtml(options: RenderBookOptions = {}): string {
	const pageSize = options.pageSize ?? "letter";
	const title = escapeHtml(options.title ?? "Homebrew Preview");
	const fontsCss = getEmbeddedFontsCss();
	const css = getBookStylesheet(pageSize, options.style);
	const printPageRule = getPrintPageRuleCss(pageSize);
	const customCss = (options.customCss ?? "").replace(/<\/style/gi, "<\\/style");

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
<style id="hb-base-fonts">${fontsCss}</style>
<style id="hb-layout-styles">${css}</style>
<style id="hb-print-page-rule">${printPageRule}</style>
<style id="hb-custom-styles">${customCss}</style>
<style id="hb-custom-fonts"></style>
</head>
<body>
<div id="hb-stage"><main class="pages" data-page-size="${pageSize}"></main></div>
</body>
</html>`;
}

/** Wraps rendered HTML pages into a complete, standalone HTML document. */
export function buildBookHtmlDocument(pages: string[], options: RenderBookOptions = {}): string {
	const pageSize = options.pageSize ?? "letter";
	const title = escapeHtml(options.title ?? "Homebrew Preview");
	const fontsCss = getEmbeddedFontsCss();
	const css = getBookStylesheet(pageSize, options.style);
	const printPageRule = getPrintPageRuleCss(pageSize);
	const customCss = (options.customCss ?? "").replace(/<\/style/gi, "<\\/style");
	const pageHtml = buildBookPagesMarkup(pages, {
		runningHeader: options.runningHeader,
		runningFooter: options.runningFooter,
		defaultColumns: options.defaultColumns,
	});

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
<style>${fontsCss}\n${css}\n${printPageRule}\n${customCss}</style>
</head>
<body>
<main class="pages" data-page-size="${pageSize}">
${pageHtml}
</main>
</body>
</html>`;
}
