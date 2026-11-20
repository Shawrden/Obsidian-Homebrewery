/**
 * Obsidian Homebrewery Exporter Plugin entry point.
 */

import { EditorView } from "@codemirror/view";
import {
	Editor,
	Menu,
	MenuItem,
	Notice,
	Plugin,
	TFile,
	WorkspaceLeaf,
	editorInfoField,
	normalizePath,
	parseYaml,
} from "obsidian";
import { getPluginFontsDir } from "./fonts";
import { BookCompilerModal, TemplateLibraryModal } from "./modals";
import {
	HomebrewExporterSettingTab,
	HomebrewExporterSettings,
	normalizeSettings,
} from "./settings";
import { colorSlotsToMap, isValidTagName } from "./themes";
import { obsidianToHomebrewery } from "./transpiler";
import { HOMEBREWERY_PREVIEW_VIEW, HomebreweryPreviewView } from "./view";

interface SubmenuCapableMenuItem extends MenuItem {
	setSubmenu?: () => Menu;
}

const STATBLOCK_TEMPLATE = [
	"{{monster,frame",
	"## Monster Name",
	"*Medium humanoid, neutral*",
	"___",
	"**Armor Class** :: 15 (natural armor)",
	"**Hit Points** :: 45 (7d8 + 14)",
	"**Speed** :: 30 ft.",
	"___",
	"| STR | DEX | CON | INT | WIS | CHA |",
	"|:---:|:---:|:---:|:---:|:---:|:---:|",
	"| 14 (+2) | 12 (+1) | 14 (+2) | 10 (+0) | 11 (+0) | 10 (+0) |",
	"___",
	"**Senses** :: passive Perception 10",
	"**Languages** :: Common",
	"**Challenge** :: 2 (450 XP)",
	"___",
	"***Trait Name.*** Describe a passive trait here.",
	"### Actions",
	"***Multiattack.*** Makes two attacks.",
	"",
	"***Strike.*** *Melee Weapon Attack:* +4 to hit, reach 5 ft., one target. *Hit:* 9 (2d6 + 2) slashing damage.",
	"}}",
].join("\n");

function insertSnippet(editor: Editor, snippet: string): void {
	editor.replaceSelection(snippet);
	editor.focus();
}

function wrapOrInsertBlock(editor: Editor, blockHeader: string, placeholder: string): void {
	const selected = editor.getSelection();
	if (selected) {
		editor.replaceSelection(`{{${blockHeader}\n${selected}\n}}`);
	} else {
		const cursor = editor.getCursor();
		const text = `{{${blockHeader}\n${placeholder}\n}}`;
		editor.replaceSelection(text);
		editor.setCursor({ line: cursor.line + 1, ch: placeholder.length });
	}
	editor.focus();
}

/** Wraps a selection as `{{tag text}}` (single line) or `{{tag ... }}` (multi-line), or inserts a placeholder. */
function wrapInlineOrBlock(editor: Editor, tag: string, placeholder: string): void {
	const selected = editor.getSelection();
	if (!selected) {
		editor.replaceSelection(`{{${tag} ${placeholder}}}`);
	} else if (selected.includes("\n")) {
		editor.replaceSelection(`{{${tag}\n${selected}\n}}`);
	} else {
		editor.replaceSelection(`{{${tag} ${selected}}}`);
	}
	editor.focus();
}

function insertCallout(editor: Editor, type: string, title: string, body: string): void {
	const selected = editor.getSelection();
	const lines = (selected ? selected : body).split("\n").map((l) => `> ${l}`);
	editor.replaceSelection(`> [!${type}] ${title}\n${lines.join("\n")}\n`);
	editor.focus();
}

function insertDropCap(editor: Editor): void {
	const selected = editor.getSelection();
	if (selected) {
		editor.replaceSelection(`{{dropcap}} ${selected.trimStart()}`);
	} else {
		editor.replaceSelection("{{dropcap}} ");
	}
	editor.focus();
}

function insertImageModifierSnippet(editor: Editor, modifier: string): void {
	const selected = editor.getSelection().trim();
	const cleaned = selected.replace(/^!?\[\[([^\]|]+)(?:\|[^\]]*)?\]\]$/, "$1").trim();
	const target = cleaned || "image.png";
	editor.replaceSelection(`![[${target}|${modifier}]]`);
	editor.focus();
}

/** Adds a submenu item (or, on Obsidian builds without submenu support, inlines its entries). */
function addSubmenu(parent: Menu, title: string, icon: string, populate: (menu: Menu) => void): void {
	parent.addItem((item) => {
		item.setTitle(title).setIcon(icon);
		const capable = item as SubmenuCapableMenuItem;
		if (typeof capable.setSubmenu === "function") {
			populate(capable.setSubmenu());
		} else {
			item.setIsLabel(true);
			populate(parent);
		}
	});
}

function addEntry(menu: Menu, title: string, icon: string, onClick: () => void): void {
	menu.addItem((item) => item.setTitle(title).setIcon(icon).onClick(onClick));
}

function populateFormattingMenu(plugin: HomebreweryExporterPlugin, root: Menu, editor: Editor): void {
	addSubmenu(root, "Page & Columns", "columns-2", (m) => {
		addEntry(m, "Page Break (\\page)", "file-plus-2", () => insertSnippet(editor, "\n\\page\n\n"));
		addEntry(m, "Single-Column Page (\\page-single)", "file-text", () => insertSnippet(editor, "\n\\page-single\n\n"));
		addEntry(m, "Column Break (\\column)", "columns-2", () => insertSnippet(editor, "\n\\column\n\n"));
		addEntry(m, "Wide Block ({{wide}})", "stretch-horizontal", () =>
			wrapOrInsertBlock(
				editor,
				"wide",
				"## Wide Banner or Table\n| Column A | Column B |\n|---|---|\n| Value 1 | Value 2 |",
			),
		);
		addEntry(m, "Keep-Together Block ({{no-split}})", "shield-check", () =>
			wrapOrInsertBlock(editor, "no-split", "Keep these paragraphs and lists together in one column."),
		);
		addEntry(m, "Table of Contents ({{toc}})", "list-ordered", () => insertSnippet(editor, "\n{{toc}}\n\n"));
		addEntry(m, "Colophon ({{colophon}})", "copyright", () =>
			wrapOrInsertBlock(editor, "colophon", "Credits, license, and copyright notices."),
		);
	});

	addSubmenu(root, "Blocks & Callouts", "square-stack", (m) => {
		addEntry(m, "Lore/DM Note Box ({{note}})", "sticky-note", () =>
			wrapOrInsertBlock(
				editor,
				"note",
				"##### Dungeon Master's Note\nAdd lore, optional rules, or hidden secrets here.",
			),
		);
		addEntry(m, "Read-Aloud Box ({{descriptive}})", "message-square-quote", () =>
			wrapOrInsertBlock(editor, "descriptive", "Read this atmospheric passage aloud to the players."),
		);
		addEntry(m, "Insert Handwritten Note ({{handwritten}})", "feather", () =>
			wrapOrInsertBlock(
				editor,
				"handwritten",
				"Dearest traveler,\nWrite a handwritten letter, journal entry, or note here.",
			),
		);
		addEntry(m, "Monster Statblock ({{monster,frame}})", "skull", () => {
			const selected = editor.getSelection();
			editor.replaceSelection(selected ? `{{monster,frame\n${selected}\n}}` : `${STATBLOCK_TEMPLATE}\n`);
			editor.focus();
		});
		addEntry(m, "Statblock Callout ([!statblock])", "swords", () =>
			insertCallout(editor, "statblock", "Monster Name", "*Medium humanoid, neutral*\n**Armor Class** :: 15"),
		);
		addEntry(m, "Spell Callout ([!spell])", "wand-sparkles", () =>
			insertCallout(
				editor,
				"spell",
				"Spell Name",
				"*3rd-level evocation*\n**Casting Time** :: 1 action\n**Range** :: 150 feet",
			),
		);
		addEntry(m, "Magic Item Callout ([!item])", "gem", () =>
			insertCallout(editor, "item", "Item Name", "*Wondrous item, rare (requires attunement)*\nDescribe the item here."),
		);
		addEntry(m, "Definition (Term :: Definition)", "list", () => {
			const selected = editor.getSelection();
			editor.replaceSelection(selected ? `**${selected}** :: Definition` : "**Term** :: Definition");
			editor.focus();
		});
	});

	addSubmenu(root, "Images & Backgrounds", "image", (m) => {
		addEntry(m, "Top Banner (|top)", "panel-top", () => insertImageModifierSnippet(editor, "top"));
		addEntry(m, "Bottom Banner (|bottom)", "panel-bottom", () => insertImageModifierSnippet(editor, "bottom"));
		addEntry(m, "Full-Column Art (|col)", "panel-left", () => insertImageModifierSnippet(editor, "col"));
		addEntry(m, "Insert Column Art (Top-Aligned)", "align-vertical-justify-start", () =>
			insertImageModifierSnippet(editor, "col,pos-top"),
		);
		addEntry(m, "Background, Fit Width (|bg-width)", "move-horizontal", () =>
			insertImageModifierSnippet(editor, "bg-width"),
		);
		addEntry(m, "Background, Fit Height (|bg-height)", "move-vertical", () =>
			insertImageModifierSnippet(editor, "bg-height"),
		);
		addEntry(m, "Faded Float (|right-45,fade-25)", "sparkles", () =>
			insertImageModifierSnippet(editor, "right-45,fade-25"),
		);
		addEntry(m, "Inline Image (|inline)", "image-plus", () => insertImageModifierSnippet(editor, "inline"));
	});

	addSubmenu(root, "Text Color, Drop Cap & Alignment", "type", (m) => {
		addEntry(m, "Drop Cap ({{dropcap}})", "type", () => insertDropCap(editor));
		const slots = plugin.settings.colorSlots;
		const valid = Object.keys(colorSlotsToMap(slots));
		slots.forEach((slot, idx) => {
			const usable = valid.includes(slot.name);
			addEntry(m, `Custom Color ${idx + 1}${usable ? ` ({{${slot.name}}})` : " (set a tag name in settings)"}`, "palette", () => {
				if (!usable) {
					new Notice(`Set a valid tag name for Color ${idx + 1} in Homebrew Exporter settings.`);
					return;
				}
				wrapInlineOrBlock(editor, slot.name, "colored text");
			});
		});
		plugin.settings.customFontTags.forEach((slot, idx) => {
			const tagName = slot.name.trim();
			const usable = isValidTagName(tagName) && slot.font.trim() !== "";
			addEntry(
				m,
				`Custom Font ${idx + 1}${isValidTagName(tagName) ? ` ({{${tagName}}})` : " (set a tag name in settings)"}`,
				"sparkles",
				() => {
					if (!isValidTagName(tagName)) {
						new Notice(`Set a valid tag name for Font Tag ${idx + 1} in Homebrew Exporter settings.`);
						return;
					}
					if (!usable) {
						new Notice(`Select a font for {{${tagName}}} in Homebrew Exporter settings.`);
					}
					wrapInlineOrBlock(editor, tagName, "styled text");
				},
			);
		});
		addEntry(m, "Center ({{center}})", "align-center", () => wrapInlineOrBlock(editor, "center", "centered text"));
		addEntry(m, "Right Align ({{right}})", "align-right", () => wrapInlineOrBlock(editor, "right", "right-aligned text"));
		addEntry(m, "Justify ({{justify}})", "align-justify", () => wrapInlineOrBlock(editor, "justify", "justified text"));
	});

	addSubmenu(root, "Templates & Book Compiler", "layout-template", (m) => {
		addEntry(m, "Insert Full Template...", "layout-template", () => {
			new TemplateLibraryModal(plugin.app, editor).open();
		});
		addEntry(m, "Open Multi-Note Book Compiler...", "library", () => {
			plugin.openBookCompiler();
		});
	});
}

export default class HomebreweryExporterPlugin extends Plugin {
	public override settings: HomebrewExporterSettings = normalizeSettings(null);

	override async onload(): Promise<void> {
		await this.loadSettings();

		const fontsDir = getPluginFontsDir(this.app, this.manifest.dir);
		try {
			if (!(await this.app.vault.adapter.exists(fontsDir))) {
				await this.app.vault.adapter.mkdir(fontsDir);
			}
		} catch {
			// Ignore if adapter cannot create plugin fonts directory.
		}

		this.addSettingTab(new HomebrewExporterSettingTab(this.app, this));

		this.registerView(
			HOMEBREWERY_PREVIEW_VIEW,
			(leaf: WorkspaceLeaf) =>
				new HomebreweryPreviewView(
					leaf,
					() => this.settings,
					async (patch: Partial<HomebrewExporterSettings>) => {
						Object.assign(this.settings, patch);
						await this.saveSettings();
					},
				),
		);

		this.addRibbonIcon("book-open", "Open Homebrew Preview", () => {
			void this.activatePreviewView();
		});

		this.addCommand({
			id: "open-homebrewery-preview",
			name: "Open Homebrew Preview",
			callback: () => {
				void this.activatePreviewView();
			},
		});

		this.addCommand({
			id: "refresh-homebrew-preview",
			name: "Refresh Homebrew Preview",
			callback: () => {
				void this.refreshActivePreviewView();
			},
		});

		this.addCommand({
			id: "export-homebrewery-pdf",
			name: "Export Note as PDF",
			callback: () => {
				void this.exportActiveNoteAsPdf();
			},
		});

		this.addCommand({
			id: "export-homebrewery-markdown",
			name: "Export Note as Homebrewery Markdown",
			callback: () => {
				void this.exportActiveNoteAsMarkdown();
			},
		});

		this.addCommand({
			id: "create-note-from-template",
			name: "Homebrewery: Create Note from D&D Template",
			callback: () => {
				new TemplateLibraryModal(this.app).open();
			},
		});

		this.addCommand({
			id: "compile-multi-note-book",
			name: "Homebrewery: Compile Multi-Note Book",
			callback: () => {
				this.openBookCompiler();
			},
		});

		this.registerEditorExtension(
			EditorView.updateListener.of((update) => {
				if (!update.selectionSet) return;
				const line = update.state.doc.lineAt(update.state.selection.main.head).number - 1;
				const info = update.state.field(editorInfoField, false);
				const file = info?.file ?? null;
				for (const leaf of this.app.workspace.getLeavesOfType(HOMEBREWERY_PREVIEW_VIEW)) {
					if (leaf.view instanceof HomebreweryPreviewView) {
						leaf.view.handleEditorCursorMove(line, file);
					}
				}
			}),
		);

		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu: Menu, editor: Editor) => {
				menu.addSeparator();
				menu.addItem((item) => {
					item.setTitle("Homebrew Formatting").setIcon("book-open");
					const submenuCapable = item as SubmenuCapableMenuItem;
					if (typeof submenuCapable.setSubmenu === "function") {
						populateFormattingMenu(this, submenuCapable.setSubmenu(), editor);
					} else {
						item.setIsLabel(true);
						populateFormattingMenu(this, menu, editor);
					}
				});
			}),
		);
	}

	override onunload(): void {
		// Workspace leaves are managed automatically by Obsidian when unloading.
	}

	/** Opens the multi-note compiler modal and loads the result into the Homebrew Preview. */
	public openBookCompiler(): void {
		new BookCompilerModal(this.app, async (files, title, metadata) => {
			const view = await this.activatePreviewView();
			if (!view) {
				new Notice("Could not open the Homebrew Preview pane.");
				return;
			}
			await view.compileBook(files, title, metadata);
		}).open();
	}

	public async loadSettings(): Promise<void> {
		const loaded = (await this.loadData()) as Partial<HomebrewExporterSettings> | null;
		this.settings = normalizeSettings(loaded);
		const legacyFonts = loaded?.customFonts as { header?: unknown; h1?: unknown } | undefined;
		if (
			typeof legacyFonts?.header === "string" &&
			legacyFonts.header.trim() !== "" &&
			!(typeof legacyFonts.h1 === "string" && legacyFonts.h1.trim() !== "")
		) {
			await this.saveData(this.settings);
		}
	}

	public async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		for (const leaf of this.app.workspace.getLeavesOfType(HOMEBREWERY_PREVIEW_VIEW)) {
			if (leaf.view instanceof HomebreweryPreviewView) {
				leaf.view.onSettingsChanged();
			}
		}
	}

	/** Immediately refreshes every open Homebrew Preview leaf (e.g. after closing Settings). */
	public async refreshOpenPreviews(): Promise<void> {
		for (const leaf of this.app.workspace.getLeavesOfType(HOMEBREWERY_PREVIEW_VIEW)) {
			if (leaf.view instanceof HomebreweryPreviewView) {
				await leaf.view.refreshPreview();
			}
		}
	}

	private async activatePreviewView(): Promise<HomebreweryPreviewView | null> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(HOMEBREWERY_PREVIEW_VIEW)[0];
		if (!leaf) {
			const splitLeaf = workspace.getLeaf("split");
			if (!splitLeaf) return null;
			leaf = splitLeaf;
			await leaf.setViewState({
				type: HOMEBREWERY_PREVIEW_VIEW,
				active: true,
			});
		}
		await workspace.revealLeaf(leaf);
		const view = leaf.view;
		if (view instanceof HomebreweryPreviewView) {
			await view.refreshPreview();
			return view;
		}
		return null;
	}

	private async refreshActivePreviewView(): Promise<void> {
		const leaves = this.app.workspace.getLeavesOfType(HOMEBREWERY_PREVIEW_VIEW);
		if (leaves.length === 0) {
			await this.activatePreviewView();
			return;
		}
		await this.refreshOpenPreviews();
	}

	private async exportActiveNoteAsPdf(): Promise<void> {
		const view = await this.activatePreviewView();
		if (!view) {
			new Notice("Could not open the Homebrew Preview pane.");
			return;
		}
		await view.exportPdf();
	}

	private async exportActiveNoteAsMarkdown(): Promise<void> {
		const existingView = this.app.workspace.getLeavesOfType(HOMEBREWERY_PREVIEW_VIEW)[0]?.view;
		if (existingView instanceof HomebreweryPreviewView) {
			await existingView.exportHomebreweryMarkdown();
			return;
		}

		const file = this.app.workspace.getActiveFile();
		if (!file || file.extension !== "md") {
			new Notice("Open a Markdown note before exporting.");
			return;
		}

		const raw = await this.app.vault.read(file);
		const v3 = obsidianToHomebrewery(raw, {
			title: file.basename,
			parseYaml: (src) => parseYaml(src),
			resolveImagePath: (linkpath) =>
				this.app.metadataCache.getFirstLinkpathDest(linkpath, file.path)?.path ?? linkpath,
		});

		const folderPrefix = file.parent && file.parent.path !== "/" ? `${file.parent.path}/` : "";
		const targetPath = normalizePath(`${folderPrefix}${file.basename}-Homebrewery.md`);
		const existing = this.app.vault.getAbstractFileByPath(targetPath);
		if (existing instanceof TFile) {
			await this.app.vault.modify(existing, v3);
		} else if (!existing) {
			await this.app.vault.create(targetPath, v3);
		} else {
			new Notice(`Cannot write to ${targetPath}: path is a folder.`);
			return;
		}
		new Notice(`Exported Homebrewery Markdown: ${targetPath}`);
	}
}
