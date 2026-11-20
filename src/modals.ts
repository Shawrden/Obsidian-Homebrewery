/**
 * In-app formatting cheatsheet modal & D&D Template Library modal.
 */

import { App, Editor, MarkdownView, Modal, Notice, TFile, normalizePath } from "obsidian";
import { BOOK_TEMPLATES, BookTemplate } from "./templates";

interface GuideEntry {
	title: string;
	syntax: string;
	description: string;
}

const GUIDE_SECTIONS: Array<{ heading: string; items: GuideEntry[] }> = [
	{
		heading: "Pagination, Footers & Column Flow",
		items: [
			{
				title: "Page Break",
				syntax: "\\page\n(or ---page---)",
				description: "Starts a new fixed-aspect two-column D&D book page (Letter or A4).",
			},
			{
				title: "Column Break",
				syntax: "\\column\n(or ---column---)",
				description: "Advances from the left column to the right column on the current page.",
			},
			{
				title: "Full-Width Banner / Wide Table",
				syntax: "{{wide\n## Regional Timeline\n| Year | Event |\n|---|---|\n| 1492 DR | The Veil Tears |\n}}",
				description: "Spans across both columns (column-span: all) for wide tables, maps, or chapter banners.",
			},
			{
				title: "Keep-Together Anti-Split Block",
				syntax: "{{no-split\n### Encounter Roster\n- 4 × Hobgoblin Captains\n- 1 × War Mage\n}}",
				description:
					"Prevents content from splitting across columns or pages. Tables, statblocks, notes, and read-aloud boxes automatically enforce break-inside: avoid.",
			},
			{
				title: "Footnotes & Auto Page Numbers",
				syntax: "{{footnote PART 1 | THE SUNKEN REACH}}\n{{pageNumber,auto}}",
				description: "Renders bottom-corner gold-accented running footers and automatic page numbering.",
			},
		],
	},
	{
		heading: "Callouts, Class Tables, Spell Lists & Drop Caps",
		items: [
			{
				title: "Lore / DM Note Box",
				syntax: "> [!note] Sage's Note\n> Keep hidden until the party decodes the mural.\n\n{{note\n##### Sage's Note\nShaded green sidebar box.\n}}",
				description: "Obsidian [!note] callouts and {{note}} blocks render as shaded green 5e sidebar boxes.",
			},
			{
				title: "Read-Aloud Descriptive Box",
				syntax: "> [!quote]\n> Lantern light flickers across obsidian pillars.\n\n{{descriptive\nGold-bordered read-aloud block.\n}}",
				description: "Obsidian [!quote] callouts and {{descriptive}} blocks render as cream read-aloud boxes with crimson sidebars.",
			},
			{
				title: "Class Progression Frame & Spell List",
				syntax: "{{classTable,frame\n##### The Runeblade\n| Level | Prof. | Features |\n|---|---|---|\n| 1st | +2 | Runic Edge |\n}}\n\n{{spellList,wide\n#### 1st Level\n- Beacon Step\n}}",
				description: "Formats ornate double-bordered class progression tables and multi-column spell index lists.",
			},
			{
				title: "Drop Cap Opening Paragraph",
				syntax: "{{dropcap}} The ancient spire hums with arcane resonance.",
				description: "Adds an ornate crimson-and-gold drop-cap initial to the paragraph.",
			},
		],
	},
	{
		heading: "5e Monster Statblocks & Media",
		items: [
			{
				title: "Homebrewery Monster Frame",
				syntax: "{{monster,frame\n## Ashscale Drake\n*Medium dragon, unaligned*\n___\n**Armor Class** :: 16 (natural armor)\n**Hit Points** :: 65 (10d8 + 20)\n**Speed** :: 30 ft., fly 60 ft.\n}}",
				description: "Renders a crimson-ruled 5e monster statblock frame. Also supports Term :: Definition rows.",
			},
			{
				title: "YAML Frontmatter or Fenced Statblocks",
				syntax: "---\nstatblock: true\nname: Ashscale Drake\nsize: Medium\ntype: dragon\nac: 16\nhp: 65\n---",
				description: "Frontmatter with statblock: true or type: monster (or ```statblock code blocks) converts automatically.",
			},
			{
				title: "Images, Alignment & Parchment Edge-Fade",
				syntax: "![[art.png|bg-35,fade]]\n![[art.png|col,fade]]\n![[art.png|right-45,fade]]\n![[art.png|left-40]]\n![[art.png|inline]]\n![[dragon-map.png|350]]\n[[Waterdeep|City of Splendors]]",
				description:
					"Supports full-page backgrounds (|bg, |bg-1..100), full-column fills (|col), inline full-column width (|inline), floated wraps (|left-N, |right-N), pixel widths (|350), and composable ,fade edge-blending into parchment.",
			},
		],
	},
	{
		heading: "Pass 2: Books, Themes, Special Pages & V3 Extensions",
		items: [
			{
				title: "Table of Contents & Single-Column Pages",
				syntax: "{{toc}}\n\\page-single\n{{colophon\nCredits & license\n}}",
				description:
					"{{toc}} builds a dotted-leader contents list from H1-H3 headings. \\page-single (or {{singleColumn}}) renders one page as a single column; {{colophon}} anchors credits at the bottom.",
			},
			{
				title: "Image Banners, Backgrounds, Fade & Focal Points",
				syntax: "![[art.png|top-40,pos-bottom]]\n![[art.png|col,pos-top]]\n![[art.png|col,pos-30-20]]\n![[map.png|bg-width,pos-center]]\n![[art.png|right-45,fade-30]]",
				description:
					"top/bottom banners, bg/bg-width/bg-height backgrounds, col/inline/left-N/right-N floats, ,fade-N edge-fade, and |pos-top / |pos-bottom / |pos-left / |pos-right / |pos-center / |pos-X-Y focal-point alignment.",
			},
			{
				title: "Text Colors, Custom Font Tags, Alignment & Drop Cap",
				syntax: "{{crimson Warning!}}\n{{elvish Elrond's Seal}}\n{{elvish,crimson Ash nazg}}\n{{center Centered line}}\n{{dropcap}} Once upon a time...",
				description:
					"Configure five color tags and three font tags in plugin settings, and chain them with commas. {{center}}, {{right}}, {{justify}} align lines or blocks.",
			},
			{
				title: "Frontmatter Overrides & Running Headers/Footers",
				syntax: "---\nhb-theme: eldritch\nhb-size: a4\nhb-columns: 1\nrunning-header: Chapter I — The Sunken Reach\nrunning-footer: Campaign Gazetteer\n---\n{{no-header}}\n{{no-footer}}",
				description:
					"Override theme, paper size, default columns, and running headers/footers per note. Suppress per-page headers or footers with {{no-header}} / {{no-footer}}.",
			},
			{
				title: "Spacers, Definition Lists, Table Spans & Callouts",
				syntax: ":::\nTerm :: Definition\n| A || B |\n| ^ | C |\n> [!spell] Fireball\n> [!item] Cloak of Ash",
				description:
					"Colon-only lines add vertical space. Term :: Definition renders hanging definition lists. || spans columns, ^ merges with the cell above. [!statblock], [!spell], [!item] callouts become native blocks.",
			},
		],
	},
];

export class SyntaxGuideModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	override onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass("hb-syntax-modal");
		contentEl.empty();

		contentEl.createEl("h2", { text: "D&D Book & Homebrewery V3 Syntax Guide" });
		contentEl.createEl("p", {
			cls: "hb-syntax-intro",
			text: "Right-click anywhere inside the Markdown editor and open the \"Homebrew Formatting\" menu to insert or wrap these blocks without memorizing syntax.",
		});

		for (const section of GUIDE_SECTIONS) {
			contentEl.createEl("h3", { text: section.heading });
			const grid = contentEl.createDiv({ cls: "hb-syntax-grid" });

			for (const item of section.items) {
				const card = grid.createDiv({ cls: "hb-syntax-card" });
				card.createEl("div", { cls: "hb-syntax-title", text: item.title });
				card.createEl("p", { cls: "hb-syntax-desc", text: item.description });
				const pre = card.createEl("pre", { cls: "hb-syntax-code" });
				pre.createEl("code", { text: item.syntax });
			}
		}
	}

	override onClose(): void {
		this.contentEl.empty();
	}
}

export class TemplateLibraryModal extends Modal {
	private readonly targetEditor?: Editor;

	constructor(app: App, targetEditor?: Editor) {
		super(app);
		this.targetEditor = targetEditor;
	}

	override onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass("hb-template-modal");
		contentEl.empty();

		contentEl.createEl("h2", { text: "D&D 5e Book Template Library" });
		contentEl.createEl("p", {
			cls: "hb-syntax-intro",
			text: "Insert a complete Homebrewery V3 spread at your cursor or create a brand-new Markdown note in your vault.",
		});

		const grid = contentEl.createDiv({ cls: "hb-template-grid" });
		for (const template of BOOK_TEMPLATES) {
			this.renderTemplateCard(grid, template);
		}
	}

	override onClose(): void {
		this.contentEl.empty();
	}

	private resolveActiveEditor(): Editor | null {
		if (this.targetEditor) return this.targetEditor;
		const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (markdownView?.editor) return markdownView.editor;
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			if (leaf.view instanceof MarkdownView && leaf.view.editor) {
				return leaf.view.editor;
			}
		}
		return null;
	}

	private renderTemplateCard(container: HTMLElement, template: BookTemplate): void {
		const card = container.createDiv({ cls: "hb-template-card" });

		const header = card.createDiv({ cls: "hb-template-header" });
		header.createEl("div", { cls: "hb-template-title", text: template.title });
		header.createEl("span", { cls: "hb-template-badge", text: template.category });

		card.createEl("p", { cls: "hb-template-desc", text: template.description });

		const previewDetails = card.createEl("details", { cls: "hb-template-preview" });
		previewDetails.createEl("summary", { text: "Preview V3 Markdown" });
		const pre = previewDetails.createEl("pre", { cls: "hb-syntax-code" });
		pre.createEl("code", { text: template.content });

		const actions = card.createDiv({ cls: "hb-template-actions" });

		const insertBtn = actions.createEl("button", {
			cls: "hb-toolbar-btn",
			text: "Insert at Cursor",
			attr: { type: "button" },
		});
		insertBtn.addEventListener("click", () => {
			this.insertTemplateAtCursor(template);
		});

		const createBtn = actions.createEl("button", {
			cls: "mod-cta hb-toolbar-btn",
			text: "Create as New Vault Note",
			attr: { type: "button" },
		});
		createBtn.addEventListener("click", () => {
			void this.createVaultNoteFromTemplate(template);
		});
	}

	private insertTemplateAtCursor(template: BookTemplate): void {
		const editor = this.resolveActiveEditor();
		if (!editor) {
			new Notice("Open a Markdown note in the editor to insert a template at the cursor.");
			return;
		}
		editor.replaceSelection(template.content);
		editor.focus();
		new Notice(`Inserted template: ${template.title}`);
		this.close();
	}

	private async createVaultNoteFromTemplate(template: BookTemplate): Promise<void> {
		const activeFile = this.app.workspace.getActiveFile();
		const folderPrefix =
			activeFile?.parent && activeFile.parent.path !== "/" ? `${activeFile.parent.path}/` : "";

		let candidatePath = normalizePath(`${folderPrefix}${template.defaultFileName}.md`);
		let counter = 1;
		while (this.app.vault.getAbstractFileByPath(candidatePath)) {
			candidatePath = normalizePath(`${folderPrefix}${template.defaultFileName} ${counter}.md`);
			counter++;
		}

		let created: TFile | null = null;
		let attempt = counter;
		let path = candidatePath;
		for (let tries = 0; tries < 50 && !created; tries++) {
			try {
				created = await this.app.vault.create(path, template.content);
			} catch {
				// Race with another writer (or case-insensitive collision): increment and retry.
				path = normalizePath(`${folderPrefix}${template.defaultFileName} ${attempt}.md`);
				attempt++;
			}
		}
		if (!created) {
			new Notice("Could not create a uniquely named template note.");
			return;
		}
		const leaf = this.app.workspace.getLeaf(false);
		await leaf.openFile(created);
		new Notice(`Created template note: ${created.path}`);
		this.close();
	}
}

/** Reusable ordered chapter list stored as a `.json` file in the vault. */
interface BookRecipe {
	version: 1;
	title: string;
	chapters: string[];
	runningHeader?: string;
	runningFooter?: string;
}

function parseBookRecipe(text: string): BookRecipe | null {
	try {
		const data: unknown = JSON.parse(text);
		if (typeof data !== "object" || data === null) return null;
		const rec = data as {
			title?: unknown;
			chapters?: unknown;
			runningHeader?: unknown;
			runningFooter?: unknown;
		};
		if (!Array.isArray(rec.chapters)) return null;
		const chapters = rec.chapters.filter((c): c is string => typeof c === "string");
		return {
			version: 1,
			title: typeof rec.title === "string" ? rec.title : "Compiled Book",
			chapters,
			runningHeader: typeof rec.runningHeader === "string" ? rec.runningHeader : undefined,
			runningFooter: typeof rec.runningFooter === "string" ? rec.runningFooter : undefined,
		};
	} catch {
		return null;
	}
}

export interface CompileBookMetadata {
	runningHeader?: string;
	runningFooter?: string;
}

export type CompileBookCallback = (files: TFile[], title: string, metadata?: CompileBookMetadata) => Promise<void>;

/** Two-pane modal for choosing and ordering vault notes into a compiled book. */
export class BookCompilerModal extends Modal {
	private readonly onCompile: CompileBookCallback;
	private queue: string[] = [];
	private filter = "";
	private recipePath = "Book Recipe.json";
	private bookTitle = "Compiled Book";
	private runningHeader = "";
	private runningFooter = "";
	private selectedFolder = "";
	private availableListEl: HTMLElement | null = null;
	private queueListEl: HTMLElement | null = null;

	constructor(app: App, onCompile: CompileBookCallback) {
		super(app);
		this.onCompile = onCompile;
	}

	override onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass("hb-book-modal");
		contentEl.empty();

		contentEl.createEl("h2", { text: "Compile Multi-Note Book" });
		contentEl.createEl("p", {
			cls: "hb-syntax-intro",
			text: "Pick notes on the left, order them on the right, then compile. YAML frontmatter is stripped and every note starts on a new page with continuous page numbering.",
		});

		const meta = contentEl.createDiv({ cls: "hb-book-meta" });
		const titleInput = meta.createEl("input", {
			attr: { type: "text", placeholder: "Book title", "aria-label": "Book title" },
		});
		titleInput.value = this.bookTitle;
		titleInput.addEventListener("input", () => {
			this.bookTitle = titleInput.value;
		});

		const headerInput = meta.createEl("input", {
			attr: { type: "text", placeholder: "Running header (optional)", "aria-label": "Running header" },
		});
		headerInput.value = this.runningHeader;
		headerInput.addEventListener("input", () => {
			this.runningHeader = headerInput.value;
		});

		const footerInput = meta.createEl("input", {
			attr: { type: "text", placeholder: "Running footer (optional)", "aria-label": "Running footer" },
		});
		footerInput.value = this.runningFooter;
		footerInput.addEventListener("input", () => {
			this.runningFooter = footerInput.value;
		});

		const panes = contentEl.createDiv({ cls: "hb-book-panes" });

		const left = panes.createDiv({ cls: "hb-book-pane" });
		left.createEl("h3", { text: "Vault Notes" });
		const search = left.createEl("input", {
			attr: { type: "search", placeholder: "Filter notes...", "aria-label": "Filter notes" },
		});
		search.addEventListener("input", () => {
			this.filter = search.value.toLowerCase();
			this.renderAvailable();
		});

		const folderRow = left.createDiv({ cls: "hb-book-row" });
		const folderSelect = folderRow.createEl("select", { attr: { "aria-label": "Folder" } });
		const folders = this.collectFolders();
		for (const f of folders) folderSelect.createEl("option", { value: f, text: f === "" ? "/ (vault root)" : f });
		this.selectedFolder = folders[0] ?? "";
		folderSelect.addEventListener("change", () => {
			this.selectedFolder = folderSelect.value;
		});
		const addFolderBtn = folderRow.createEl("button", {
			cls: "hb-toolbar-btn",
			text: "Add Entire Folder",
			attr: { type: "button" },
		});
		addFolderBtn.addEventListener("click", () => this.addFolder(this.selectedFolder));

		this.availableListEl = left.createDiv({ cls: "hb-book-list" });

		const right = panes.createDiv({ cls: "hb-book-pane" });
		right.createEl("h3", { text: "Chapter Queue" });
		this.queueListEl = right.createDiv({ cls: "hb-book-list" });

		const recipe = contentEl.createDiv({ cls: "hb-book-meta" });
		const recipeInput = recipe.createEl("input", {
			attr: { type: "text", placeholder: "Book Recipe.json", "aria-label": "Recipe file path" },
		});
		recipeInput.value = this.recipePath;
		recipeInput.addEventListener("input", () => {
			this.recipePath = recipeInput.value.trim();
		});
		const saveBtn = recipe.createEl("button", { cls: "hb-toolbar-btn", text: "Save Recipe", attr: { type: "button" } });
		saveBtn.addEventListener("click", () => {
			void this.saveRecipe();
		});

		const loadSelect = recipe.createEl("select", { attr: { "aria-label": "Load recipe" } });
		loadSelect.createEl("option", { value: "", text: "Load recipe..." });
		for (const f of this.app.vault.getFiles().filter((file) => file.extension === "json")) {
			loadSelect.createEl("option", { value: f.path, text: f.path });
		}
		loadSelect.addEventListener("change", () => {
			if (loadSelect.value) {
				void this.loadRecipe(loadSelect.value).then(() => {
					recipeInput.value = this.recipePath;
					titleInput.value = this.bookTitle;
					headerInput.value = this.runningHeader;
					footerInput.value = this.runningFooter;
				});
			}
		});

		const compileBtn = contentEl.createEl("button", {
			cls: "mod-cta hb-toolbar-btn hb-book-compile",
			text: "Compile Book",
			attr: { type: "button" },
		});
		compileBtn.addEventListener("click", () => {
			void this.compile();
		});

		this.renderAvailable();
		this.renderQueue();
	}

	override onClose(): void {
		this.availableListEl = null;
		this.queueListEl = null;
		this.contentEl.empty();
	}

	private collectFolders(): string[] {
		const set = new Set<string>();
		for (const f of this.app.vault.getMarkdownFiles()) {
			set.add(f.parent && f.parent.path !== "/" ? f.parent.path : "");
		}
		return [...set].sort((a, b) => a.localeCompare(b));
	}

	private renderAvailable(): void {
		const el = this.availableListEl;
		if (!el) return;
		el.empty();
		const files = this.app.vault
			.getMarkdownFiles()
			.filter((f) => f.path.toLowerCase().includes(this.filter))
			.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
		for (const f of files) {
			const row = el.createDiv({ cls: "hb-book-item" });
			row.createEl("span", { cls: "hb-book-item-name", text: f.path });
			const add = row.createEl("button", { cls: "hb-toolbar-btn", text: "Add", attr: { type: "button" } });
			add.addEventListener("click", () => {
				this.queue.push(f.path);
				this.renderQueue();
			});
		}
		if (!files.length) el.createDiv({ cls: "hb-book-empty", text: "No matching notes." });
	}

	private renderQueue(): void {
		const el = this.queueListEl;
		if (!el) return;
		el.empty();
		this.queue.forEach((path, idx) => {
			const row = el.createDiv({ cls: "hb-book-item" });
			row.createEl("span", { cls: "hb-book-item-name", text: `${idx + 1}. ${path}` });
			const up = row.createEl("button", { cls: "hb-toolbar-btn", text: "Move Up", attr: { type: "button" } });
			up.disabled = idx === 0;
			up.addEventListener("click", () => this.move(idx, -1));
			const down = row.createEl("button", { cls: "hb-toolbar-btn", text: "Move Down", attr: { type: "button" } });
			down.disabled = idx === this.queue.length - 1;
			down.addEventListener("click", () => this.move(idx, 1));
			const remove = row.createEl("button", { cls: "hb-toolbar-btn", text: "Remove", attr: { type: "button" } });
			remove.addEventListener("click", () => {
				this.queue.splice(idx, 1);
				this.renderQueue();
			});
		});
		if (!this.queue.length) el.createDiv({ cls: "hb-book-empty", text: "No chapters yet." });
	}

	private move(idx: number, delta: number): void {
		const target = idx + delta;
		if (target < 0 || target >= this.queue.length) return;
		const [item] = this.queue.splice(idx, 1);
		this.queue.splice(target, 0, item);
		this.renderQueue();
	}

	private addFolder(folder: string): void {
		const prefix = folder === "" ? "" : `${folder}/`;
		const files = this.app.vault
			.getMarkdownFiles()
			.filter((f) => (folder === "" ? !f.path.includes("/") : f.path.startsWith(prefix)))
			.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
		for (const f of files) {
			if (!this.queue.includes(f.path)) this.queue.push(f.path);
		}
		this.renderQueue();
	}

	private async saveRecipe(): Promise<void> {
		let path = normalizePath(this.recipePath || "Book Recipe.json");
		if (!path.toLowerCase().endsWith(".json")) path += ".json";
		const recipe: BookRecipe = {
			version: 1,
			title: this.bookTitle,
			chapters: [...this.queue],
			runningHeader: this.runningHeader.trim() || undefined,
			runningFooter: this.runningFooter.trim() || undefined,
		};
		const text = JSON.stringify(recipe, null, 2);
		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing instanceof TFile) {
			await this.app.vault.modify(existing, text);
		} else if (!existing) {
			await this.app.vault.create(path, text);
		} else {
			new Notice(`Cannot write to ${path}: path is a folder.`);
			return;
		}
		this.recipePath = path;
		new Notice(`Saved book recipe: ${path}`);
	}

	private async loadRecipe(path: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) return;
		const recipe = parseBookRecipe(await this.app.vault.read(file));
		if (!recipe) {
			new Notice("That JSON file is not a valid book recipe.");
			return;
		}
		const missing = recipe.chapters.filter((p) => !(this.app.vault.getAbstractFileByPath(p) instanceof TFile));
		this.queue = recipe.chapters.filter((p) => !missing.includes(p));
		this.bookTitle = recipe.title;
		this.runningHeader = recipe.runningHeader ?? "";
		this.runningFooter = recipe.runningFooter ?? "";
		this.recipePath = file.path;
		this.renderQueue();
		new Notice(
			missing.length
				? `Loaded recipe (${missing.length} missing note${missing.length === 1 ? "" : "s"} skipped).`
				: `Loaded book recipe: ${file.path}`,
		);
	}

	private async compile(): Promise<void> {
		const files: TFile[] = [];
		for (const path of this.queue) {
			const f = this.app.vault.getAbstractFileByPath(path);
			if (f instanceof TFile) files.push(f);
		}
		if (!files.length) {
			new Notice("Add at least one note to the chapter queue.");
			return;
		}
		this.close();
		await this.onCompile(files, this.bookTitle.trim() || "Compiled Book", {
			runningHeader: this.runningHeader.trim() || undefined,
			runningFooter: this.runningFooter.trim() || undefined,
		});
	}
}
