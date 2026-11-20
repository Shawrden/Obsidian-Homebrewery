# Homebrew Exporter — Feature & Syntax Manual

Complete documentation for **Homebrew Exporter** (`obsidian-homebrewery-exporter`), covering every preview workflow, layout diagnostic, customization setting, Markdown extension, and command.

---

## Table of Contents

1. [Feature Guide & Step-by-Step Workflows](#1-feature-guide--step-by-step-workflows)
   - [Homebrew Preview Workspace](#homebrew-preview-workspace)
   - [Bidirectional Navigation & Layout Diagnostics](#bidirectional-navigation--layout-diagnostics)
   - [Multi-Note Sortable Book Compiler](#multi-note-sortable-book-compiler)
   - [Built-In Template Library](#built-in-template-library)
   - [Visual Themes & Custom Colors](#visual-themes--custom-colors)
   - [Typography & Custom Font Manager](#typography--custom-font-manager)
   - [Editor Right-Click Context Menus & PDF Export](#editor-right-click-context-menus--pdf-export)
2. [Complete Syntax & Command Reference](#2-complete-syntax--command-reference)
   - [Page, Column & Flow Controls](#page-column--flow-controls)
   - [Blocks & Native Obsidian Callouts](#blocks--native-obsidian-callouts)
   - [Inline & Block Styling Wrappers](#inline--block-styling-wrappers)
   - [Image Embeds & Pipe Modifiers](#image-embeds--pipe-modifiers)
   - [Table Extensions](#table-extensions)
   - [Per-Note YAML Frontmatter Overrides](#per-note-yaml-frontmatter-overrides)
   - [YAML & Fenced Monster Statblocks](#yaml--fenced-monster-statblocks)
   - [Command Palette Commands](#command-palette-commands)

---

## 1. Feature Guide & Step-by-Step Workflows

### Homebrew Preview Workspace

Click the **Open Homebrew Preview** ribbon icon (open book) or run **Open Homebrew Preview** from the Command Palette to open a split-pane preview powered by a sandboxed `<iframe>` that isolates book typography from your Obsidian theme.

The preview toolbar provides:

| Control | Function |
|---|---|
| **Page Size** | Switches between `Letter (8.5" × 11")` and `A4 (210mm × 297mm)`. Per-note `hb-size` frontmatter overrides this non-destructively. |
| **Zoom** | `Fit to Width`, `Fit to Height`, `50%`, `75%`, `100%`, `125%`, or `150%`. |
| **Theme** | Switches the global visual theme (`Classic Parchment (5ePHB)`, `Ink-Saver (Print)`, `Dark / Eldritch Grimoire`, or `Custom`) and persists to plugin settings. |
| **Single Page / Facing Spread** | Toggles between a vertical stack of single pages and a hardcover-style two-page facing spread (`Page 1` on the right, then `2–3`, `4–5`, etc.). |
| **Page Jump** | Dropdown listing `Page X of N` to scroll straight to any rendered page. |
| **Status & Preflight Pill** | Shows the active note (or compiled book) page count and a `Ready` / `N Warnings` diagnostics button. |
| **Live: On / Off** | Synced toggle with **Settings → Live Preview**. When enabled, editing or modifying the active note automatically refreshes the preview after a `300ms` debounce. Keep off on large image-heavy notes and use **Refresh** or a hotkey instead. |
| **Refresh** | Reloads the preview immediately (including any `mtime`-cached local custom fonts). Bind a custom hotkey to **Refresh Homebrew Preview** in **Settings → Hotkeys** for instant keyboard refreshes. |
| **Compile Book** | Opens the Multi-Note Book Compiler modal. |
| **Templates** | Opens the 4-template D&D 5e Library modal. |
| **Export PDF** | Refreshes the preview and opens the system print dialog configured with full-bleed `@page` sizing. |
| **Export .md** | Writes a `<NoteName>-Homebrewery.md` file (or `<BookTitle>-Homebrewery.md` when compiled) containing clean Homebrewery V3 Markdown in the note's folder. |
| **?** | Opens the in-app Formatting & Syntax Guide modal. |

---

### Bidirectional Navigation & Layout Diagnostics

- **Editor → Preview Live Cursor Tracking:** Moving the cursor in the Markdown editor highlights the tightest corresponding rendered block (`[data-line-start][data-line-end]`) with a subtle crimson left indicator and smoothly scrolls it into view.
- **Preview → Editor Click-to-Jump:** Clicking any rendered heading, paragraph, table, callout, or block inside the preview jumps to the corresponding `MarkdownView`, sets the cursor to line start (`ch: 0`), and centers that line in the editor viewport. Dragging to select text inside the preview is ignored so copying text does not trigger a jump.
- **3rd-Column Overflow Warnings:** Each page uses fixed `column-count: 2` dimensions (`8.5in × 11in` or `210mm × 297mm`). Elements pushed horizontally past column 2 into an off-page 3rd column are outlined with a dashed red border and tagged with a screen-only `Overflow — Add \page or \column` badge (automatically hidden when printing).
- **Preflight Diagnostics Pill:** Click the toolbar pill (`Ready` or `N Warnings`) to inspect three checks:
  1. **Unclosed `{{ }}` blocks** (with 1-based source line numbers, ignoring fenced code blocks).
  2. **Unresolved images** (vault links or paths that could not be resolved to an image file).
  3. **Column overflow** (1-based page numbers with 3rd-column spill).

---

### Multi-Note Sortable Book Compiler

Use **Compile Book** in the toolbar (or **Homebrewery: Compile Multi-Note Book** in the Command Palette) to assemble multiple Markdown notes into a single continuous volume:

1. **Choose Notes:** Filter vault Markdown notes on the left and click **Add**, or select a folder and click **Add Entire Folder** (sorted naturally by filename).
2. **Order Chapters:** Use **Move Up**, **Move Down**, and **Remove** in the **Chapter Queue** pane.
3. **Configure Metadata:** Set the **Book title** and optional **Running header** / **Running footer** strings.
4. **Save / Load Recipes (`.json`):** Save the ordered chapter list, title, and running header/footer metadata to a vault `.json` file (default `Book Recipe.json`) and reload it later.
5. **Compile:** Clicking **Compile Book** strips each chapter's YAML frontmatter, inserts `\page` between chapters so `{{pageNumber,auto}}` numbering stays continuous, and populates every `{{toc}}` block across the entire book. If the first chapter defines YAML overrides (`hb-theme`, `hb-size`, `hb-columns`, `running-header`, `running-footer`), those apply to the compiled book unless overridden by recipe metadata.

---

### Built-In Template Library

Open **Templates** in the preview toolbar or run **Homebrewery: Create Note from D&D Template** to preview V3 source and either **Insert at Cursor** or **Create as New Vault Note**:

| Template | Category | Included Elements |
|---|---|---|
| **Class & Subclass Spread** | 2-Page Class Layout | Drop-cap intro, 1–20 `{{classTable,frame}}` progression table, core features, quick-build sidebar, and subclass section. |
| **Monster & Encounter Spread** | Bestiary & Encounter | Two-column encounter spread with lore, read-aloud box, DM tactics note, and a framed `{{monster,frame}}` statblock. |
| **Spells & Magic Items Compendium** | Arcane Reference | Multi-column `{{spellList,wide}}` index, formatted `[!spell]` entries, and `[!item]` magic item descriptions. |
| **Worldbuilding & Gazetteer Spread** | Campaign Setting | Regional gazetteer spread with drop-cap overview, full-width `{{wide}}` faction/settlement table, `{{no-split}}` plot hooks, and gold footnotes. |

---

### Visual Themes & Custom Colors

Configure themes in **Settings → Homebrew Exporter** or the preview toolbar:

- **Classic Parchment (`5ePHB`):** Warm parchment radial gradient (`#f6f2e9`), crimson headings (`#58180d`), gold rules (`#c9ad6a`), sage note boxes, and cream statblocks.
- **Ink-Saver (Print):** Pure white background (`#ffffff`), monochrome borders, and light zebra striping (`#f4f4f4`) for toner-friendly home printing.
- **Dark / Eldritch Grimoire:** Charcoal slate pages (`#1d1f24`), pale parchment text (`#d9d5c9`), muted gold headings/block titles (`#c9ad6a` / `#ead08c`), translucent table headers, and dark-ink callout cards.
- **Custom:** Pick any **Custom Page Color** (`--hb-page-bg`) and **Custom Font Color** (`--hb-text-color` / `--hb-heading-color`); block surfaces, bold/italic tints, and table zebra rows automatically mix with your chosen palette using `color-mix()`.
- **Custom CSS File:** Point **Custom CSS file** to a vault `.css` file (e.g., `Styles/book.css`) to inject custom overrides last inside `#hb-custom-styles`. Live Preview watches modifications to that CSS file automatically.
- **5 Custom Text Color Slots:** Configure tag names and hex colors (defaults: `crimson` `#9c2b1b`, `gold` `#b8860b`, `arcane` `#5b3fa0`, `sage` `#4f7a4a`, `frost` `#2f6f8f`) for `{{tagName text}}` spans and blocks.

---

### Typography & Custom Font Manager

All default fonts are bundled locally inside `main.js` as latin `.woff2` base64 data URIs under SIL Open Font License 1.1—zero external network requests are ever made:

- **Headings (`H1`–`H6`):** `Cinzel` (600, 700)
- **Body Copy & Read Aloud:** `Libre Baskerville` (400, 400 italic, 700)
- **Statblocks, Tables & Sidebar Notes:** `Open Sans` (400, 400 italic, 700)
- **Drop Cap Initials:** `Uncial Antiqua` (400)
- **Handwritten Notes:** `Ephesis` (400)

In **Settings → Homebrew Exporter → Typography & Custom Fonts**, you can override **14 typography slots** plus **3 custom font tags**:

1. **Per-Header (`H1`–`H6`) Inheritance:** Set `Heading 1 (H1)` to change all headings at once (`H2`–`H6` inherit `H1` when left empty), or override any individual heading level (`H2` through `H6`) independently.
2. **Body & Block Slots:** Customize `Body Copy`, `Base Statblock / Class Tables / Spell Blocks`, `Magic Item Blocks` (inherits `Base Statblock` when empty), `Monster Statblocks` (inherits `Base Statblock` when empty), `Drop Cap Initial`, `Read Aloud Callouts`, `Sidebar Notes`, and `Handwritten Notes`.
3. **3 Custom Inline/Block Font Tags:** Configure 3 tag names (defaults: `elvish`, `runic`, `draconic`) and assign each a font for `{{tagName text}}` spans or multi-line blocks.
4. **3 Font Sources per Slot:**
   - **Plugin Default** (or Reset icon button to clear back to `""`).
   - **Local Font Files:** Drop `.ttf`, `.otf`, `.woff`, or `.woff2` files into `<Vault>/.obsidian/plugins/obsidian-homebrewery-exporter/fonts/` (created automatically on plugin load) or anywhere in your vault. Local font files are base64-encoded and cached in memory by `path:mtime` with unique per-slot `@font-face` identifiers (`hb-font-<slot>-<hash>`) so switching or editing font files updates immediately with zero repeated disk overhead.
   - **Scanned OS Fonts:** Click **Scan Installed System Fonts** to query installed desktop font families (via `window.queryLocalFonts` when available), or type any installed font family name manually.
5. **Live Preview Swatches:** Every slot renders an immediate sample swatch (`"The quick wyvern guards 12 arcane relics — 0123456789"`) directly in Settings and refreshes open preview tabs when saved or when Settings closes.

---

### Editor Right-Click Context Menus & PDF Export

Right-click in any Markdown editor and open **Homebrew Formatting** for five categorized submenus:

- **Page & Columns:** `\page`, `\page-single`, `\column`, `{{wide}}`, `{{no-split}}`, `{{toc}}`, `{{colophon}}`
- **Blocks & Callouts:** `{{note}}`, `{{descriptive}}`, `{{handwritten}}`, `{{monster,frame}}`, `[!statblock]`, `[!spell]`, `[!item]`, `Term :: Definition`
- **Images & Backgrounds:** `|top`, `|bottom`, `|col`, **Insert Column Art (Top-Aligned)** (`|col,pos-top`), `|bg-width`, `|bg-height`, `|right-45,fade-25`, `|inline`
- **Text Color, Drop Cap & Alignment:** `{{dropcap}}`, Custom Colors 1–5, Custom Fonts 1–3, `{{center}}`, `{{right}}`, `{{justify}}`
- **Templates & Book Compiler:** **Insert Full Template...**, **Open Multi-Note Book Compiler...**

#### Recommended PDF Export Settings

Click **Export PDF** (or run **Export Note as PDF**) to invoke the print dialog. The plugin injects an automatic `@media print` `@page` rule matching the effective paper size (`8.5in 11in` for Letter or `210mm 297mm` for A4) with `margin: 0 !important` and `print-color-adjust: exact`. In your OS/Chromium print dialog:
- Enable **Background graphics** (required for parchment backgrounds, callouts, and zebra tables).
- Set **Margins** to **None** (if your dialog exposes a margin selector) and **Scale** to **100%** / **Default**.

---

## 2. Complete Syntax & Command Reference

### Page, Column & Flow Controls

| Syntax | Effect |
|---|---|
| `\page` or `---page---` | Starts a new page. |
| `\page-single` | Starts a new single-column (`column-count: 1`) page without affecting surrounding pages. |
| `\column` or `---column---` | Breaks to the next column on the current page. |
| `{{singleColumn}}` | Forces the current page into single-column layout. |
| `{{twoColumn}}` | Overrides a `hb-columns: 1` note back to two columns for the current page. |
| `{{wide ... }}` | Spans content across both columns (`column-span: all`). |
| `{{no-split ... }}` | Enforces `break-inside: avoid` to keep paragraphs, lists, or tables together in one column. |
| `{{toc}}` | Inserts a two-column dotted-leader Table of Contents generated from `H1`–`H3` headings (excluding headings inside statblocks, notes, descriptive boxes, handwritten notes, spells, items, and class tables). |
| `{{colophon ... }}` | Bottom-anchored credits and license block (`column-span: all`). |
| `{{pageNumber,auto}}` | Inserts an automatic 1-based page number badge in the alternating corner footer. |
| `{{footnote TEXT}}` | Renders a small-caps running footnote along the bottom rule (alternating left/right on odd/even pages) and replaces an auto running footer on that page. |
| `{{no-header}}` | Suppresses the frontmatter/book `running-header` on the current page. |
| `{{no-footer}}` | Suppresses the auto running footer / default page footer on the current page. |
| `:`, `::`, `:::` | Colon-only lines insert vertical spacing (`calc(0.6em * N)`). |

---

### Blocks & Native Obsidian Callouts

Every block supports both single-line (`{{tag content}}`) and multi-line (`{{tag\n...\n}}`) forms, plus optional comma-chained classes/styles/IDs (e.g., `{{monster,frame,#goblin,width:50% ... }}`).

| Homebrewery Block | Obsidian Callout Equivalent | Styling |
|---|---|---|
| `{{note ... }}` | `> [!note] Title` (or any generic `[!info]`, `[!tip]`, `[!warning]`) | Shaded lore / DM sidebar note box. |
| `{{descriptive ... }}` | `> [!quote]`, `[!cite]`, `[!descriptive]`, `[!readaloud]`, `[!read-aloud]`, `[!boxed]` | Crimson-bordered read-aloud box. |
| `{{handwritten ... }}` | `> [!handwritten] Title` | Cursive `Ephesis` letter/journal card with warm parchment tint (or muted dark-ink card in Dark mode). |
| `{{monster,frame ... }}` | `> [!monster] Name`, `[!statblock]`, `[!stat-block]` | Framed 5e monster statblock with tapered crimson rules and gold borders. |
| `{{spell ... }}` | `> [!spell] Spell Name` | Left-accented spell card. |
| `{{item ... }}` | `> [!item] Item Name`, `[!magic-item]` | Gold-topped magic item card. |
| `{{classTable,frame ... }}` | — | Double gold-bordered class progression frame. |
| `{{spellList}}` / `{{spellList,wide}}` | — | Borderless compact spell list (`wide` renders in 2 columns). |
| `Term :: Definition` | `Term :: Definition` | Hanging-indent `<dl class="hb-dl">` definition list (used inside statblocks, spells, and prose). |

> **Obsidian Syntax Automatic Conversions:** `[[Target|Alias]]` → `Alias`, `[[Note#Heading]]` → `Note > Heading`, `==highlight==` → `<mark>highlight</mark>`, `%% comments %%` → stripped, and `^block-id` → stripped. Inline code and fenced code blocks are left untouched.

---

### Inline & Block Styling Wrappers

| Syntax | Description | Example |
|---|---|---|
| `{{dropcap}} Text` | Illuminated `Uncial Antiqua` gold drop cap + small-caps first line. (Also applied automatically to `H1 + p`.) | `{{dropcap}} Midnight fell over the citadel.` |
| `{{center ... }}` | Centers text (inline single-line or multi-line block). | `{{center Chapter One}}` |
| `{{right ... }}` | Right-aligns text. | `{{right — Archmage Veyra}}` |
| `{{justify ... }}` | Justifies text. | `{{justify Full-justified clause.}}` |
| `{{colorTag ... }}` | Applies one of the 5 custom color slots (`crimson`, `gold`, `arcane`, `sage`, `frost` by default). | `{{crimson Danger!}}` |
| `{{fontTag ... }}` | Applies one of the 3 custom font tag slots (`elvish`, `runic`, `draconic` by default). | `{{elvish Mellon}}` |
| `{{tagA,tagB ... }}` | Comma-chains custom font tags, color tags, and alignment tags in any order. | `{{elvish,crimson Ash nazg}}` or `{{runic,center Carved Stone}}` |

---

### Image Embeds & Pipe Modifiers

Both Obsidian embeds (`![[image.png|modifiers]]`) and standard Markdown images (`![alt|modifiers](image.png)`) are supported. You can combine multiple modifiers with commas (e.g., `![[art.png|col,fade-25,pos-top]]`).

#### Placement & Sizing Modifiers

| Modifier | Behavior |
|---|---|
| `inline` | Default inline block scaled to 100% column width. |
| `col` | Full-column height (`9.2in`) cover art. |
| `top` / `top-<1-100>` | Full-page-width top banner promoted above both columns (default `35%` height). |
| `bottom` / `bottom-<1-100>` | Full-page-width bottom banner pinned below both columns (default `35%` height). |
| `left-<1-100>` / `right-<1-100>` | Floats image left or right at `<N>%` of column width with text wrap. |
| `bg` / `bg-<1-100>` | Full-page background cover image (`z-index: 0`), optional opacity percentage (`1`–`100`). |
| `bg-width` / `bg-width-<1-100>` | Full-page background fitted to page width, optional opacity. |
| `bg-height` / `bg-height-<1-100>` | Full-page background fitted to page height, optional opacity. |
| `<W>` or `<W>x<H>` | Explicit pixel dimensions (e.g., `![[dragon.png|350]]` or `![[dragon.png|300x200]]`). |

#### Edge Fade & Focal-Point Modifiers

| Modifier | CSS Output | Description |
|---|---|---|
| `fade` / `fade-<1-100>` | `--hb-fade: <N>` (default `25`) | Soft rectangular inset fade dissolving image edges into `--hb-page-bg`. |
| `pos-top` | `object-position: top center` | Anchors crop focal point to top edge (ideal for character portraits). |
| `pos-bottom` | `object-position: bottom center` | Anchors crop focal point to bottom edge. |
| `pos-left` | `object-position: center left` | Anchors crop focal point to left edge. |
| `pos-right` | `object-position: center right` | Anchors crop focal point to right edge. |
| `pos-center` | `object-position: center center` | Anchors crop focal point to center. |
| `pos-<X>-<Y>` | `object-position: <X>% <Y>%` | Precise horizontal and vertical focal percentages (`0`–`100`, e.g., `pos-30-20`). |

---

### Table Extensions

1. **Auto-Calculated Ability Score Modifiers:** Any 6-column table with header `| STR | DEX | CON | INT | WIS | CHA |` automatically populates omitted modifiers (e.g., `18` → `18 (+4)`, `8` → `8 (-1)`).
2. **Column Spanning (`colspan`):** Append extra pipes at the end of a cell to span right (`| Category || Notes |` gives `Category` `colspan="2"`).
3. **Row Spanning (`rowspan`):** Put `^` alone inside a cell to merge it downward into the cell directly above (`| ^ |`).

---

### Per-Note YAML Frontmatter Overrides

Frontmatter is stripped from the rendered body text. These optional keys override layout and theme settings for that note only without altering your saved global settings:

| YAML Key | Accepted Values | Effect |
|---|---|---|
| `hb-theme` | `classic` (`5ePHB`, `parchment`), `ink-saver` (`ink`, `print`), `eldritch` (`dark`, `grimoire`), `custom` | Overrides the active visual theme for the note. |
| `hb-size` | `letter`, `a4` | Overrides the active paper size and `@page` print dimensions. |
| `hb-columns` | `1` (`single`), `2` (`double`, `two`) | Sets the default column layout for all pages in the note unless overridden per page. |
| `running-header` | Any non-empty string | Injects a subtle top running header onto every page (suppress per page with `{{no-header}}`). |
| `running-footer` | Any non-empty string | Injects an alternating odd/even bottom running footer with continuous page numbers (suppress with `{{no-footer}}` or override with `{{footnote ...}}`). |

Example:

```yaml
---
hb-theme: eldritch
hb-size: a4
hb-columns: 2
running-header: Chapter II — The Obsidian Vaults
running-footer: Campaign Gazetteer
---
```

---

### YAML & Fenced Monster Statblocks

Set `statblock: true` or `type: monster` in YAML frontmatter (optionally placing `{{statblock}}` in the body to control placement), or use a fenced ```` ```statblock ```` / ```` ```monster ```` code block:

```yaml
---
statblock: true
name: Ashscale Drake
size: Medium
type: dragon
alignment: unaligned
ac: 16
ac_class: natural armor
hp: 65
hit_dice: 10d8 + 20
speed: 30 ft., fly 60 ft.
str: 16
dex: 14
con: 15
int: 6
wis: 11
cha: 8
cr: 3
traits:
  - name: Cinder Scales
    desc: Deals 3 fire damage to melee attackers within 5 feet.
actions:
  - name: Bite
    desc: Melee Weapon Attack +5 to hit, reach 5 ft., one target. Hit 10 (2d6 + 3) piercing damage.
---
```

Supported statblock sections also include `saves`, `skillsaves` / `skills`, `damage_vulnerabilities`, `damage_resistances`, `damage_immunities`, `condition_immunities`, `senses`, `languages`, `bonus_actions`, `reactions`, `legendary_actions`, `mythic_actions`, and `lair_actions`.

---

### Command Palette Commands

| Command Name | Command ID | Action |
|---|---|---|
| **Open Homebrew Preview** | `open-homebrewery-preview` | Opens and reveals the Homebrew Preview pane. |
| **Refresh Homebrew Preview** | `refresh-homebrew-preview` | Refreshes the active Homebrew Preview (or opens it if closed). |
| **Export Note as PDF** | `export-homebrewery-pdf` | Refreshes the preview and opens the print-to-PDF dialog. |
| **Export Note as Homebrewery Markdown** | `export-homebrewery-markdown` | Exports transpiled Homebrewery V3 Markdown to `<Note>-Homebrewery.md`. |
| **Homebrewery: Create Note from D&D Template** | `create-note-from-template` | Opens the D&D 5e Template Library modal. |
| **Homebrewery: Compile Multi-Note Book** | `compile-multi-note-book` | Opens the Multi-Note Book Compiler modal. |
