# Homebrew Exporter (`obsidian-homebrewery-exporter`)

Turn your Markdown campaign notes, classes, spells, and monster statblocks into publication-grade **D&D 5e two-column book pages** with live preview, vector PDF export, and Homebrewery V3 Markdown export—100% offline.

---

## Highlights

- **Authentic 5e Book Layout:** Fixed-aspect Letter (`8.5" × 11"`) and A4 (`210mm × 297mm`) pages, two-column flow, anti-split guards, illuminated `Uncial Antiqua` drop caps, `Ephesis` handwritten notes, and automatic `@page` print rules.
- **100% Offline SIL OFL Fonts + Custom Font Manager:** Bundles `Cinzel`, `Libre Baskerville`, `Open Sans`, `Uncial Antiqua`, and `Ephesis` directly inside `main.js`. Override `H1`–`H6`, body/block slots, or 3 custom inline/block font tags using OS fonts or local `.ttf` / `.otf` / `.woff` / `.woff2` files.
- **4 Visual Themes + Per-Note Overrides:** Switch between **Classic Parchment (`5ePHB`)**, **Ink-Saver (Print)**, **Dark / Eldritch Grimoire**, and **Custom** colors globally or per note via YAML frontmatter (`hb-theme`, `hb-size`, `hb-columns`, `running-header`, `running-footer`).
- **Bidirectional Navigation & Diagnostics:** Live editor-to-preview cursor tracking, preview-to-editor click-to-jump, 3rd-column overflow badges, and a preflight warning pill.
- **Multi-Note Book Compiler & Templates:** Compile ordered folders or chapters with saved `.json` recipes, continuous `{{pageNumber,auto}}` numbering, automatic `{{toc}}` generation, alternating running footers, and 4 ready-to-use D&D templates.
- **Rich Media & Table Extensions:** Multi-mode image placement (`bg`, `top`, `bottom`, `col`, `left-N`, `right-N`, `fade-N`), focal-point cropping (`|pos-top`, `|pos-30-20`), `||` colspan, `^` rowspan, and auto-calculated ability score modifiers.

---

## Quick Start

Paste this into any Markdown note and click **Open Homebrew Preview** in the left ribbon:

```markdown
# The Sunken Reach

{{dropcap}} Where limestone sea stacks pierce the morning mist, lantern-keepers chart shifting shoals beside sunken causeways.

> [!quote]
> Salt spray hisses against your lantern glass as the harbor bell tolls beneath the waves.

> [!handwritten] Captain's Log
> Do not anchor near the northern spire after dusk.

| d4 | Harbor Omen |
|---|---|
| 1 | Green lanterns drift below the waterline |
| 2 | The tide recedes twice in one hour |
```

For every block, callout, image modifier, frontmatter override, and command, see the **[Complete Feature & Syntax Manual (`DOCS.md`)](DOCS.md)**.

---

## Installation

> **Desktop Only:** Requires Obsidian `1.5.0` or newer on Windows, macOS, or Linux.

### Option 1: Install via BRAT (Recommended for Beta Testing)

1. Install the **BRAT** community plugin in Obsidian and enable it.
2. Open **Settings → BRAT → Add Beta Plugin**.
3. Paste this repository's GitHub URL and click **Add Plugin**.
4. Enable **Homebrew Exporter** under **Settings → Community Plugins**.

### Option 2: Manual Release Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest GitHub Release (`0.1.0`).
2. Create the folder `<YourVault>/.obsidian/plugins/obsidian-homebrewery-exporter/`.
3. Copy `main.js`, `manifest.json`, and `styles.css` into that folder.
4. Reload Obsidian, open **Settings → Community Plugins**, and enable **Homebrew Exporter**.

---

## Using Custom Local Fonts

You can replace any heading (`H1`–`H6`), body, statblock, drop-cap, callout, or custom font tag (`{{elvish ...}}`, `{{runic ...}}`, `{{draconic ...}}`) without editing CSS:

1. **Drop-in Plugin Fonts Folder:** Place `.ttf`, `.otf`, `.woff`, or `.woff2` files into:
   ```text
   <YourVault>/.obsidian/plugins/obsidian-homebrewery-exporter/fonts/
   ```
   *(The plugin creates this folder automatically on startup, or you can store font files anywhere in your vault.)*
2. **Or Scan Installed OS Fonts:** Open **Settings → Homebrew Exporter → Typography & Custom Fonts** and click **Scan Installed System Fonts**, or type any installed font family name directly.
3. Pick your font from the searchable dropdown for any slot, check the live preview swatch underneath, and close Settings to refresh open previews immediately.

Local font binaries are read via Obsidian's vault adapter, base64-encoded into `@font-face` rules, and cached in memory by `path:mtime` for fast refreshes and self-contained PDF/HTML output.

---

## Building from Source

```bash
npm install
npm run test
npm run build
```

Production build outputs `main.js`, `manifest.json`, and `styles.css` in the repository root.

---

## License & Attribution

- **Plugin Code:** Licensed under the [MIT License](LICENSE).
- **Layout Conventions:** Two-column book spread, class progression frames, monster statblocks, callout boxes, and footer styling follow [NaturalCrit's Homebrewery V3 (`5ePHB`)](https://github.com/naturalcrit/homebrewery) under the MIT License.
- **Bundled Fonts:** `Cinzel`, `Libre Baskerville`, `Open Sans`, `Uncial Antiqua`, and `Ephesis` are bundled offline via `@fontsource` under the **SIL Open Font License, Version 1.1**. See [NOTICE](NOTICE) for full copyright and license details.
