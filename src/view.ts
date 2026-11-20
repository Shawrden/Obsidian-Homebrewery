/**
 * Live Split-Pane Homebrew Preview ItemView.
 *
 * Initializes a persistent sandboxed <iframe> shell once on open so font assets
 * and scroll position stay intact across refreshes, eliminating flicker while
 * supporting live cursor highlighting and visual 3rd-column overflow warnings.
 */

import {
	IconName,
	ItemView,
	MarkdownView,
	Notice,
	TFile,
	WorkspaceLeaf,
	arrayBufferToBase64,
	debounce,
	normalizePath,
	parseYaml,
	setIcon,
} from "obsidian";
import { buildCustomFontsCss, fontTagSlotsToMap } from "./fonts";
import { BookCompilerModal, CompileBookMetadata, SyntaxGuideModal, TemplateLibraryModal } from "./modals";
import {
	BookStyleOptions,
	PageSize,
	TocEntry,
	buildBookPagesMarkup,
	buildBookShellHtml,
	buildTocHtml,
	getBookStylesheet,
	getPrintPageRuleCss,
} from "./renderer";
import { DEFAULT_SETTINGS, HomebrewExporterSettings } from "./settings";
import { BOOK_THEMES, BookTheme, CustomFontsCssBundle, colorSlotsToMap } from "./themes";
import {
	PreflightReport,
	countPreflightWarnings,
	emptyPreflightReport,
	findUnclosedBlocks,
} from "./preflight";
import {
	BookFrontmatterOverrides,
	RenderOptions,
	collectImageUrls,
	extractBookFrontmatterOverrides,
	isExternalUrl,
	joinBookChapters,
	obsidianToHomebrewery,
	prepareBookFromV3,
	prepareMappedBook,
	safeDecodeUri,
} from "./transpiler";

export const HOMEBREWERY_PREVIEW_VIEW = "homebrewery-preview-view";

type ZoomMode = "width" | "height" | number;
type ViewMode = "single" | "spread";

interface PreparedBook {
	v3: string;
	renderPages: (renderOpts?: RenderOptions) => string[];
}

const ZOOM_PRESETS = [0.5, 0.75, 1, 1.25, 1.5];

const MIME_TYPES: Record<string, string> = {
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	gif: "image/gif",
	bmp: "image/bmp",
	svg: "image/svg+xml",
	webp: "image/webp",
	avif: "image/avif",
};

export class HomebreweryPreviewView extends ItemView {
	private pageSize: PageSize = "letter";
	private appliedStyleKey = "";
	private appliedLayoutKey = "";
	private appliedPrintPageSize: PageSize | null = null;
	private customCss = "";
	private customFontsCss: CustomFontsCssBundle = {};
	private compiledFiles: TFile[] | null = null;
	private compiledTitle = "Compiled Book";
	private compiledMetadata: CompileBookMetadata = {};
	private clickJumpAttachedDocs = new WeakSet<Document>();
	private themeSelectEl: HTMLSelectElement | null = null;
	private iframeEl: HTMLIFrameElement | null = null;
	private statusEl: HTMLElement | null = null;
	private sizeSelectEl: HTMLSelectElement | null = null;
	private activeFile: TFile | null = null;
	private shellReadyPromise: Promise<void> | null = null;
	private refreshToken = 0;
	private lastCursorLine = -1;
	private zoomMode: ZoomMode = "width";
	private viewMode: ViewMode = "single";
	private zoomSelectEl: HTMLSelectElement | null = null;
	private pageJumpEl: HTMLSelectElement | null = null;
	private spreadBtnEl: HTMLButtonElement | null = null;
	private liveBtnEl: HTMLButtonElement | null = null;
	private pillEl: HTMLButtonElement | null = null;
	private popoverEl: HTMLElement | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private preflight: PreflightReport = emptyPreflightReport();
	private readonly getSettings: () => HomebrewExporterSettings;
	private readonly updateSettings: (patch: Partial<HomebrewExporterSettings>) => Promise<void>;

	private readonly debouncedRefresh = debounce(
		() => {
			void this.refreshPreview();
		},
		300,
		true,
	);

	constructor(
		leaf: WorkspaceLeaf,
		getSettings: () => HomebrewExporterSettings = () => DEFAULT_SETTINGS,
		updateSettings: (patch: Partial<HomebrewExporterSettings>) => Promise<void> = () => Promise.resolve(),
	) {
		super(leaf);
		this.getSettings = getSettings;
		this.updateSettings = updateSettings;
	}

	override getViewType(): string {
		return HOMEBREWERY_PREVIEW_VIEW;
	}

	override getDisplayText(): string {
		return "Homebrew Preview";
	}

	override getIcon(): IconName {
		return "book-open";
	}

	override async onOpen(): Promise<void> {
		this.contentEl.empty();
		this.contentEl.addClass("hb-preview-root");

		this.buildToolbar();

		const frameWrap = this.contentEl.createDiv({ cls: "hb-iframe-wrap" });
		this.iframeEl = frameWrap.createEl("iframe", {
			cls: "hb-preview-iframe",
			attr: {
				title: "Homebrew Preview",
				sandbox: "allow-same-origin allow-modals allow-scripts",
			},
		});

		this.shellReadyPromise = this.initializeIframeShell(this.iframeEl);

		this.resizeObserver = new ResizeObserver(() => this.applyZoom());
		this.resizeObserver.observe(frameWrap);

		this.registerDomEvent(document, "click", (evt: MouseEvent) => {
			const target = evt.target;
			if (
				this.popoverEl?.hasClass("is-open") &&
				target instanceof Node &&
				!this.popoverEl.contains(target) &&
				!this.pillEl?.contains(target)
			) {
				this.popoverEl.removeClass("is-open");
			}
		});
		this.registerEvent(
			this.app.workspace.on("file-open", (file) => {
				if (file instanceof TFile && file.extension === "md") {
					if (this.compiledFiles) {
						if (this.compiledFiles.some((f) => f.path === file.path)) return;
						this.compiledFiles = null;
						this.compiledMetadata = {};
					}
					this.activeFile = file;
					this.lastCursorLine = -1;
					void this.refreshPreview();
				}
			}),
		);

		this.registerEvent(
			this.app.workspace.on("active-leaf-change", (leaf) => {
				const view = leaf?.view;
				if (view instanceof MarkdownView && view.file && this.activeFile?.path !== view.file.path) {
					const path = view.file.path;
					if (this.compiledFiles) {
						if (this.compiledFiles.some((f) => f.path === path)) return;
						this.compiledFiles = null;
						this.compiledMetadata = {};
					}
					this.activeFile = view.file;
					this.lastCursorLine = -1;
					void this.refreshPreview();
				}
			}),
		);

		this.registerEvent(
			this.app.workspace.on("editor-change", (_editor, info) => {
				if (info.file && info.file.extension === "md") {
					if (!this.compiledFiles) this.activeFile = info.file;
					if (this.getSettings().livePreview) {
						this.debouncedRefresh();
					}
				}
			}),
		);

		this.registerEvent(
			this.app.vault.on("modify", (file) => {
				if (!(file instanceof TFile)) return;
				const cssPath = this.getSettings().customCssPath.trim();
				if (cssPath !== "" && file.path === normalizePath(cssPath)) {
					this.debouncedRefresh();
					return;
				}
				const tracked = this.compiledFiles
					? this.compiledFiles.some((f) => f.path === file.path)
					: this.activeFile?.path === file.path;
				if (tracked && this.getSettings().livePreview) {
					this.debouncedRefresh();
				}
			}),
		);

		this.activeFile = this.resolveTargetFile();
		await this.refreshPreview();
	}

	override async onClose(): Promise<void> {
		this.debouncedRefresh.cancel();
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
		this.iframeEl = null;
		this.statusEl = null;
		this.sizeSelectEl = null;
		this.themeSelectEl = null;
		this.zoomSelectEl = null;
		this.pageJumpEl = null;
		this.spreadBtnEl = null;
		this.liveBtnEl = null;
		this.pillEl = null;
		this.popoverEl = null;
		this.shellReadyPromise = null;
		this.contentEl.empty();
	}

	/** Re-syncs the toolbar Live Preview toggle with `settings.livePreview`. */
	public syncLivePreviewToggle(): void {
		const on = this.getSettings().livePreview;
		if (!this.liveBtnEl) return;
		this.liveBtnEl.toggleClass("is-active", on);
		this.liveBtnEl.setAttribute("aria-pressed", String(on));
		this.liveBtnEl.setText(on ? "Live: On" : "Live: Off");
	}

	/** Called by the plugin after settings change: syncs toolbar controls and re-renders if styling/colors changed. */
	public onSettingsChanged(): void {
		this.syncLivePreviewToggle();
		if (this.themeSelectEl) this.themeSelectEl.value = this.getSettings().theme;
		if (this.computeStyleKey() !== this.appliedStyleKey) {
			this.debouncedRefresh();
		}
	}

	private currentStyle(effectiveTheme?: BookTheme): BookStyleOptions {
		const s = this.getSettings();
		return {
			theme: effectiveTheme ?? s.theme,
			customPageColor: s.customPageColor,
			customFontColor: s.customFontColor,
			colorSlots: s.colorSlots,
			fontTags: s.customFontTags,
		};
	}

	private computeLayoutKey(effectivePageSize: PageSize = this.pageSize, effectiveTheme?: BookTheme): string {
		const s = this.getSettings();
		return JSON.stringify([
			effectivePageSize,
			effectiveTheme ?? s.theme,
			s.customPageColor,
			s.customFontColor,
			s.colorSlots.map((c) => [c.name, c.color]),
			s.customFontTags.map((t) => [t.name, t.font]),
		]);
	}

	private computeStyleKey(): string {
		const s = this.getSettings();
		return JSON.stringify([
			this.computeLayoutKey(),
			s.customCssPath,
			s.customFonts,
			s.customFontTags,
		]);
	}

	/** Loads the optional custom vault `.css` file (empty string when unset or missing). */
	private async loadCustomCss(): Promise<string> {
		const path = this.getSettings().customCssPath.trim();
		if (!path) return "";
		const file = this.app.vault.getAbstractFileByPath(normalizePath(path));
		if (!(file instanceof TFile)) return "";
		try {
			return await this.app.vault.cachedRead(file);
		} catch {
			return "";
		}
	}

	/** Compiles the given notes (in order) into a single book and shows it in the preview. */
	public async compileBook(files: TFile[], title: string, metadata?: CompileBookMetadata): Promise<void> {
		this.compiledFiles = files;
		this.compiledTitle = title;
		this.compiledMetadata = metadata ?? {};
		this.lastCursorLine = -1;
		await this.refreshPreview();
		new Notice(`Compiled "${title}" from ${files.length} note${files.length === 1 ? "" : "s"}.`);
	}

	private openBookCompiler(): void {
		new BookCompilerModal(this.app, (files, title, metadata) => this.compileBook(files, title, metadata)).open();
	}

	private buildToolbar(): void {
		const toolbar = this.contentEl.createDiv({ cls: "hb-toolbar" });
		const left = toolbar.createDiv({ cls: "hb-toolbar-group" });
		const right = toolbar.createDiv({ cls: "hb-toolbar-group" });

		left.createEl("span", { cls: "hb-toolbar-label", text: "Page Size" });
		this.sizeSelectEl = left.createEl("select", {
			cls: "hb-page-size-select",
			attr: { "aria-label": "Page Size" },
		});
		this.sizeSelectEl.createEl("option", { value: "letter", text: 'Letter (8.5" × 11")' });
		this.sizeSelectEl.createEl("option", { value: "a4", text: "A4 (210mm × 297mm)" });
		this.sizeSelectEl.value = this.pageSize;
		this.sizeSelectEl.addEventListener("change", () => {
			const next = this.sizeSelectEl?.value === "a4" ? "a4" : "letter";
			this.pageSize = next;
			void this.refreshPreview();
		});

		this.zoomSelectEl = left.createEl("select", {
			cls: "hb-page-size-select",
			attr: { "aria-label": "Zoom" },
		});
		this.zoomSelectEl.createEl("option", { value: "width", text: "Fit to Width" });
		this.zoomSelectEl.createEl("option", { value: "height", text: "Fit to Height" });
		for (const preset of ZOOM_PRESETS) {
			this.zoomSelectEl.createEl("option", { value: String(preset), text: `${Math.round(preset * 100)}%` });
		}
		this.zoomSelectEl.value = String(this.zoomMode);
		this.zoomSelectEl.addEventListener("change", () => {
			const value = this.zoomSelectEl?.value ?? "width";
			this.zoomMode = value === "width" || value === "height" ? value : Number(value);
			this.applyZoom();
		});

		this.themeSelectEl = left.createEl("select", {
			cls: "hb-page-size-select",
			attr: { "aria-label": "Theme" },
		});
		for (const t of BOOK_THEMES) this.themeSelectEl.createEl("option", { value: t.value, text: t.label });
		this.themeSelectEl.value = this.getSettings().theme;
		this.themeSelectEl.addEventListener("change", () => {
			const value = this.themeSelectEl?.value as BookTheme | undefined;
			if (value) void this.updateSettings({ theme: value });
		});

		this.spreadBtnEl = left.createEl("button", {
			cls: "hb-toolbar-btn",
			text: "Single Page",
			attr: { type: "button", title: "Toggle Single Page / Facing Spread" },
		});
		this.spreadBtnEl.addEventListener("click", () => {
			this.viewMode = this.viewMode === "single" ? "spread" : "single";
			this.spreadBtnEl?.setText(this.viewMode === "single" ? "Single Page" : "Facing Spread");
			this.spreadBtnEl?.toggleClass("is-active", this.viewMode === "spread");
			this.applyZoom();
		});

		this.pageJumpEl = left.createEl("select", {
			cls: "hb-page-size-select",
			attr: { "aria-label": "Page Jump" },
		});
		this.pageJumpEl.addEventListener("change", () => {
			const n = Number(this.pageJumpEl?.value ?? "1");
			const doc = this.iframeEl?.contentDocument;
			doc?.querySelector(`.page[data-page="${n}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" });
		});

		this.statusEl = left.createEl("span", { cls: "hb-status-badge", text: "No note" });

		this.pillEl = left.createEl("button", {
			cls: "hb-preflight-pill is-ready",
			text: "Ready",
			attr: { type: "button", title: "Preflight diagnostics" },
		});
		this.popoverEl = toolbar.createDiv({ cls: "hb-preflight-popover" });
		this.pillEl.addEventListener("click", () => {
			this.popoverEl?.toggleClass("is-open", !this.popoverEl.hasClass("is-open"));
		});

		this.liveBtnEl = right.createEl("button", {
			cls: "hb-toolbar-btn",
			text: "Live: Off",
			attr: { type: "button", title: "Toggle automatic live preview" },
		});
		this.liveBtnEl.addEventListener("click", () => {
			void this.updateSettings({ livePreview: !this.getSettings().livePreview }).then(() =>
				this.syncLivePreviewToggle(),
			);
		});
		this.syncLivePreviewToggle();

		const refreshBtn = right.createEl("button", {
			cls: "hb-toolbar-btn hb-icon-btn",
			attr: {
				type: "button",
				title: "Refresh Homebrew Preview",
				"aria-label": "Refresh Homebrew Preview",
			},
		});
		setIcon(refreshBtn, "refresh-cw");
		refreshBtn.addEventListener("click", () => {
			void this.refreshPreview();
		});

		const compileBtn = right.createEl("button", {
			cls: "hb-toolbar-btn",
			text: "Compile Book",
			attr: { type: "button", title: "Compile multiple notes into one sortable book" },
		});
		compileBtn.addEventListener("click", () => this.openBookCompiler());

		const templatesBtn = right.createEl("button", {
			cls: "hb-toolbar-btn",
			text: "Templates",
			attr: { type: "button", title: "Open D&D Template Library" },
		});
		templatesBtn.addEventListener("click", () => {
			new TemplateLibraryModal(this.app).open();
		});

		const pdfBtn = right.createEl("button", {
			cls: "mod-cta hb-toolbar-btn",
			text: "Export PDF",
			attr: { type: "button" },
		});
		pdfBtn.addEventListener("click", () => {
			void this.exportPdf();
		});

		const mdBtn = right.createEl("button", {
			cls: "hb-toolbar-btn",
			text: "Export .md",
			attr: { type: "button", title: "Export Homebrewery V3 Markdown" },
		});
		mdBtn.addEventListener("click", () => {
			void this.exportHomebreweryMarkdown();
		});

		const helpBtn = right.createEl("button", {
			cls: "hb-toolbar-btn hb-help-btn",
			text: "?",
			attr: { type: "button", title: "Formatting & Syntax Guide", "aria-label": "Formatting Guide" },
		});
		helpBtn.addEventListener("click", () => {
			new SyntaxGuideModal(this.app).open();
		});
	}

	private initializeIframeShell(iframe: HTMLIFrameElement): Promise<void> {
		this.appliedStyleKey = this.computeStyleKey();
		this.appliedLayoutKey = this.computeLayoutKey();
		this.appliedPrintPageSize = this.pageSize;
		const shellHtml = buildBookShellHtml({
			title: "Homebrew Preview",
			pageSize: this.pageSize,
			style: this.currentStyle(),
		});

		return new Promise<void>((resolve) => {
			let settled = false;
			const finish = (): void => {
				if (settled) return;
				settled = true;
				iframe.removeEventListener("load", finish);
				if (iframe.contentDocument) {
					this.attachPreviewClickJump(iframe.contentDocument);
				}
				resolve();
			};
			iframe.addEventListener("load", finish, { once: true });
			window.setTimeout(finish, 400);
			iframe.srcdoc = shellHtml;
		});
	}

	private attachPreviewClickJump(doc: Document): void {
		if (this.clickJumpAttachedDocs.has(doc) || !doc.body) return;
		this.clickJumpAttachedDocs.add(doc);

		doc.body.addEventListener("click", (evt: MouseEvent) => {
			const win = doc.defaultView;
			if ((win?.getSelection()?.toString().length ?? 0) > 0) return;
			const rawTarget = evt.target;
			let el: Element | null = null;
			if (win && rawTarget instanceof win.Element) {
				el = rawTarget;
			} else if (win && rawTarget instanceof win.Node) {
				el = rawTarget.parentElement;
			}
			const lineEl = el?.closest("[data-line-start]");
			if (!lineEl) return;
			const lineStart = Number(lineEl.getAttribute("data-line-start"));
			if (!Number.isFinite(lineStart) || lineStart < 0) return;
			void this.jumpToEditorLine(lineStart);
		});
	}

	private async jumpToEditorLine(lineStart: number): Promise<void> {
		if (this.compiledFiles) return;
		const file = this.activeFile ?? this.resolveTargetFile();
		if (!file) return;

		let targetLeaf: WorkspaceLeaf | null = null;
		let targetView: MarkdownView | null = null;
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			const view = leaf.view;
			if (view instanceof MarkdownView && view.file?.path === file.path) {
				targetLeaf = leaf;
				targetView = view;
				break;
			}
		}
		if (!targetLeaf) {
			const leaf = this.app.workspace.getLeaf(false);
			await leaf.openFile(file);
			if (leaf.view instanceof MarkdownView) {
				targetLeaf = leaf;
				targetView = leaf.view;
			}
		}
		if (!targetLeaf || !targetView) return;

		this.app.workspace.setActiveLeaf(targetLeaf, { focus: true });
		const clampedLine = Math.min(Math.max(0, lineStart), Math.max(0, targetView.editor.lineCount() - 1));
		const pos = { line: clampedLine, ch: 0 };
		targetView.editor.setCursor(pos);
		targetView.editor.scrollIntoView({ from: pos, to: pos }, true);
		targetView.editor.focus();
	}

	/** Returns the active Markdown note, falling back to the last tracked note. */
	private resolveTargetFile(): TFile | null {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (activeView?.file) return activeView.file;
		const workspaceFile = this.app.workspace.getActiveFile();
		if (workspaceFile && workspaceFile.extension === "md") return workspaceFile;
		if (this.activeFile && this.app.vault.getAbstractFileByPath(this.activeFile.path) instanceof TFile) {
			return this.activeFile;
		}
		return null;
	}

	/** Reads live unsaved editor text when open, or falls back to `app.vault.read`. */
	private async readNoteMarkdown(file: TFile): Promise<string> {
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			const view = leaf.view;
			if (view instanceof MarkdownView && view.file?.path === file.path) {
				return view.editor.getValue();
			}
		}
		return this.app.vault.read(file);
	}

	private async resolveImageDataUris(v3: string, sourcePath: string): Promise<Map<string, string>> {
		const resolved = new Map<string, string>();
		const urls = collectImageUrls(v3);

		for (const rawUrl of urls) {
			if (!rawUrl || rawUrl.startsWith("data:") || isExternalUrl(rawUrl)) continue;
			const decoded = safeDecodeUri(rawUrl);
			let imgFile = this.app.metadataCache.getFirstLinkpathDest(decoded, sourcePath);
			if (!imgFile) {
				const direct = this.app.vault.getAbstractFileByPath(normalizePath(decoded));
				if (direct instanceof TFile) imgFile = direct;
			}
			if (!imgFile) continue;

			const mime = MIME_TYPES[imgFile.extension.toLowerCase()];
			if (!mime) continue;

			try {
				const buf = await this.app.vault.readBinary(imgFile);
				const dataUri = `data:${mime};base64,${arrayBufferToBase64(buf)}`;
				resolved.set(rawUrl, dataUri);
				resolved.set(decoded, dataUri);
			} catch {
				// Ignore unreadable binary assets so preview continues rendering.
			}
		}
		return resolved;
	}

	private transpileOptions(file: TFile) {
		return {
			title: file.basename,
			parseYaml: (src: string) => parseYaml(src),
			resolveImagePath: (linkpath: string) =>
				this.app.metadataCache.getFirstLinkpathDest(linkpath, file.path)?.path ?? linkpath,
		};
	}

	public async refreshPreview(): Promise<void> {
		this.debouncedRefresh.cancel();
		const token = ++this.refreshToken;
		const iframe = this.iframeEl;
		if (!iframe) return;

		if (this.shellReadyPromise) {
			await this.shellReadyPromise;
		}
		if (token !== this.refreshToken || !this.iframeEl) return;

		this.customCss = await this.loadCustomCss();
		if (token !== this.refreshToken || !this.iframeEl) return;

		const s = this.getSettings();
		this.customFontsCss = await buildCustomFontsCss(this.app, s.customFonts, s.customFontTags);
		if (token !== this.refreshToken || !this.iframeEl) return;

		let prepared: PreparedBook;
		let overrides: BookFrontmatterOverrides = {};
		let rawForPreflight: string;
		let sourcePath: string;
		let label: string;

		const compiled = this.compiledFiles;
		if (compiled && compiled.length > 0) {
			const chapters: string[] = [];
			for (let idx = 0; idx < compiled.length; idx++) {
				const chapterFile = compiled[idx];
				const chapterRaw = await this.readNoteMarkdown(chapterFile);
				if (idx === 0) {
					overrides = extractBookFrontmatterOverrides(chapterRaw, (src) => parseYaml(src));
				}
				chapters.push(obsidianToHomebrewery(chapterRaw, this.transpileOptions(chapterFile)));
			}
			if (token !== this.refreshToken) return;
			const v3 = joinBookChapters(chapters);
			prepared = prepareBookFromV3(v3);
			rawForPreflight = v3;
			sourcePath = compiled[0].path;
			label = `${this.compiledTitle} (${compiled.length} notes)`;
		} else {
			const file = this.resolveTargetFile();
			this.activeFile = file;

			if (!file) {
				this.updateStatus("Open a Markdown note");
				this.updateIframePages(
					"Homebrew Preview",
					["<h1>Homebrew Preview</h1><p>Open any Markdown note in Obsidian to preview it in two-column D&amp;D 5e book layout.</p>"],
					token,
				);
				return;
			}

			const raw = await this.readNoteMarkdown(file);
			if (token !== this.refreshToken) return;

			const mapped = prepareMappedBook(raw, this.transpileOptions(file));
			prepared = mapped;
			overrides = mapped.frontmatterOverrides;
			rawForPreflight = raw;
			sourcePath = file.path;
			label = file.basename;
		}

		const imageMap = await this.resolveImageDataUris(prepared.v3, sourcePath);
		if (token !== this.refreshToken) return;

		const pages = prepared.renderPages({
			resolveImageSrc: (url) => imageMap.get(url) ?? imageMap.get(safeDecodeUri(url)),
			colorTags: colorSlotsToMap(s.colorSlots),
			fontTags: fontTagSlotsToMap(s.customFontTags),
		});

		this.preflight = {
			unclosedBlocks: findUnclosedBlocks(rawForPreflight),
			missingImages: collectImageUrls(prepared.v3).filter(
				(url) =>
					url &&
					!url.startsWith("data:") &&
					!isExternalUrl(url) &&
					!imageMap.has(url) &&
					!imageMap.has(safeDecodeUri(url)),
			),
			overflowPages: [],
		};
		this.renderPreflight();

		const effectivePageSize = overrides.pageSize ?? this.pageSize;
		const effectiveTheme = overrides.theme ?? s.theme;
		const runningHeader = (compiled ? this.compiledMetadata.runningHeader : undefined) ?? overrides.runningHeader;
		const runningFooter = (compiled ? this.compiledMetadata.runningFooter : undefined) ?? overrides.runningFooter;

		const pageWord = pages.length === 1 ? "page" : "pages";
		this.updateStatus(`${label} · ${pages.length} ${pageWord}`);
		this.updateIframePages(label, pages, token, {
			pageSize: effectivePageSize,
			theme: effectiveTheme,
			defaultColumns: overrides.columns,
			runningHeader,
			runningFooter,
		});
	}

	private updateStatus(text: string): void {
		if (this.statusEl) this.statusEl.setText(text);
	}

	private updateIframePages(
		title: string,
		pages: string[],
		token: number,
		renderMeta: {
			pageSize?: PageSize;
			theme?: BookTheme;
			defaultColumns?: 1 | 2;
			runningHeader?: string;
			runningFooter?: string;
		} = {},
	): void {
		const iframe = this.iframeEl;
		const doc = iframe?.contentDocument;
		if (!iframe || !doc || !doc.body) return;

		this.attachPreviewClickJump(doc);

		const effectivePageSize = renderMeta.pageSize ?? this.pageSize;
		const effectiveTheme = renderMeta.theme ?? this.getSettings().theme;

		const layoutKey = this.computeLayoutKey(effectivePageSize, effectiveTheme);
		if (this.appliedLayoutKey !== layoutKey) {
			const layoutStyleEl = doc.getElementById("hb-layout-styles");
			if (layoutStyleEl) {
				layoutStyleEl.textContent = getBookStylesheet(effectivePageSize, this.currentStyle(effectiveTheme));
			}
			this.appliedLayoutKey = layoutKey;
		}
		this.appliedStyleKey = this.computeStyleKey();

		if (this.appliedPrintPageSize !== effectivePageSize) {
			let printStyleEl = doc.getElementById("hb-print-page-rule");
			if (!printStyleEl && doc.head) {
				printStyleEl = doc.createElement("style");
				printStyleEl.id = "hb-print-page-rule";
				doc.head.appendChild(printStyleEl);
			}
			if (printStyleEl) {
				printStyleEl.textContent = getPrintPageRuleCss(effectivePageSize);
			}
			this.appliedPrintPageSize = effectivePageSize;
		}

		const customStyleEl = doc.getElementById("hb-custom-styles");
		if (customStyleEl && customStyleEl.textContent !== this.customCss) {
			customStyleEl.textContent = this.customCss;
		}

		const fontFacesCss = this.customFontsCss.fontFacesCss?.trim() ?? "";
		const fontVariablesCss = this.customFontsCss.fontVariablesCss?.trim() ?? "";
		const customFontCssText = [
			fontFacesCss,
			fontVariablesCss ? `:root {\n${fontVariablesCss}\n}` : "",
		]
			.filter(Boolean)
			.join("\n");
		let customFontStyle = doc.getElementById("hb-custom-fonts");
		if (!customFontStyle && doc.head) {
			customFontStyle = doc.createElement("style");
			customFontStyle.id = "hb-custom-fonts";
			doc.head.appendChild(customFontStyle);
		}
		if (customFontStyle && customFontStyle.textContent !== customFontCssText) {
			customFontStyle.textContent = customFontCssText;
		}

		doc.title = title;

		const pagesMarkup = buildBookPagesMarkup(pages, {
			runningHeader: renderMeta.runningHeader,
			runningFooter: renderMeta.runningFooter,
			defaultColumns: renderMeta.defaultColumns,
		});
		const pagesContainer = doc.body.querySelector("main.pages");
		if (pagesContainer instanceof HTMLElement) {
			pagesContainer.setAttribute("data-page-size", effectivePageSize);
			pagesContainer.setAttribute("data-view-mode", this.viewMode);
			pagesContainer.innerHTML = pagesMarkup;
		} else {
			doc.body.innerHTML = `<div id="hb-stage"><main class="pages" data-page-size="${effectivePageSize}" data-view-mode="${this.viewMode}">${pagesMarkup}</main></div>`;
		}

		this.populateToc(doc);
		this.updatePageJump(pages.length);
		this.applyZoom();

		if (this.lastCursorLine >= 0 && !this.compiledFiles) {
			this.highlightLine(this.lastCursorLine);
		}

		window.requestAnimationFrame(() => {
			if (token !== this.refreshToken) return;
			this.preflight.overflowPages = this.detectColumnOverflows();
			this.renderPreflight();
		});
	}

	/** Fills every `{{toc}}` block from rendered H1-H3 headings and their final page numbers. */
	private populateToc(doc: Document): void {
		const tocBlocks = doc.querySelectorAll<HTMLElement>(".block.toc");
		if (tocBlocks.length === 0) return;

		const entries: TocEntry[] = [];
		const headings = doc.querySelectorAll<HTMLElement>(".page h1, .page h2, .page h3");
		headings.forEach((heading) => {
			if (heading.closest(".block.toc, .block.monster, .block.note, .block.descriptive, .block.handwritten, .block.spell, .block.item, .block.classTable")) {
				return;
			}
			const title = (heading.textContent ?? "").trim();
			const page = Number(heading.closest(".page")?.getAttribute("data-page"));
			if (!title || !Number.isFinite(page)) return;
			entries.push({ level: Number(heading.tagName.slice(1)), title, page });
		});

		const html = entries.length
			? buildTocHtml(entries)
			: '<div class="hb-toc-row"><span class="hb-toc-title">No H1-H3 headings found.</span></div>';
		tocBlocks.forEach((block) => {
			block.innerHTML = html;
		});
	}

	private updatePageJump(count: number): void {
		const select = this.pageJumpEl;
		if (!select) return;
		const previous = select.value;
		select.empty();
		for (let i = 1; i <= count; i++) {
			select.createEl("option", { value: String(i), text: `Page ${i} of ${count}` });
		}
		if (previous && Number(previous) <= count) select.value = previous;
	}

	/** Sizes the stage wrapper to `unscaled * zoom` so scaling leaves no dead scroll space. */
	private applyZoom(): void {
		const iframe = this.iframeEl;
		const doc = iframe?.contentDocument;
		if (!iframe || !doc) return;
		const stage = doc.getElementById("hb-stage");
		const pagesEl = doc.querySelector<HTMLElement>("main.pages");
		if (!stage || !pagesEl) return;

		pagesEl.setAttribute("data-view-mode", this.viewMode);
		pagesEl.style.transform = "none";
		const unscaledWidth = pagesEl.offsetWidth;
		const unscaledHeight = pagesEl.offsetHeight;
		if (unscaledWidth === 0 || unscaledHeight === 0) return;

		let zoom = 1;
		if (typeof this.zoomMode === "number") {
			zoom = this.zoomMode;
		} else if (this.zoomMode === "width") {
			zoom = Math.min(1.5, iframe.clientWidth / unscaledWidth);
		} else {
			const firstPage = pagesEl.querySelector<HTMLElement>(".page");
			const pageHeight = (firstPage?.offsetHeight ?? unscaledHeight) + 52;
			zoom = iframe.clientHeight / pageHeight;
		}
		zoom = Math.max(0.1, zoom);

		pagesEl.style.transform = `scale(${zoom})`;
		stage.style.width = `${Math.ceil(unscaledWidth * zoom)}px`;
		stage.style.height = `${Math.ceil(unscaledHeight * zoom)}px`;
	}

	private renderPreflight(): void {
		const pill = this.pillEl;
		const popover = this.popoverEl;
		if (!pill || !popover) return;

		const count = countPreflightWarnings(this.preflight);
		pill.setText(count === 0 ? "Ready" : `${count} Warning${count === 1 ? "" : "s"}`);
		pill.toggleClass("is-ready", count === 0);
		pill.toggleClass("is-warn", count > 0);

		popover.empty();
		if (count === 0) {
			popover.createDiv({ text: "No issues found." });
			return;
		}
		const addSection = (title: string, items: string[]): void => {
			if (items.length === 0) return;
			popover.createEl("strong", { text: title });
			const ul = popover.createEl("ul");
			for (const item of items) ul.createEl("li", { text: item });
		};
		addSection(
			"Unclosed {{ }} blocks",
			this.preflight.unclosedBlocks.map((line) => `Block opened on line ${line}`),
		);
		addSection("Unresolved images", this.preflight.missingImages);
		addSection(
			"Column overflow",
			this.preflight.overflowPages.map((n) => `Page ${n}`),
		);
	}

	/** Handles editor selection/cursor movement when it belongs to the previewed note. */
	public handleEditorCursorMove(line: number, file: TFile | null): void {
		if (this.compiledFiles) return;
		if (file && this.activeFile && file.path !== this.activeFile.path) return;
		this.lastCursorLine = line;
		this.highlightLine(line);
	}

	/** Highlights and smoothly scrolls to the tightest rendered block spanning `line`. */
	public highlightLine(line: number): void {
		const doc = this.iframeEl?.contentDocument;
		if (!doc || line < 0) return;

		doc.querySelectorAll(".active-cursor-block").forEach((el) => el.classList.remove("active-cursor-block"));

		let bestEl: HTMLElement | null = null;
		let bestSpan = Number.POSITIVE_INFINITY;

		const candidates = doc.querySelectorAll<HTMLElement>("[data-line-start][data-line-end]");
		for (let i = 0; i < candidates.length; i++) {
			const el = candidates[i];
			const start = Number(el.getAttribute("data-line-start"));
			const end = Number(el.getAttribute("data-line-end"));
			if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
			if (line < start || line > end) continue;
			const span = end - start;
			if (span <= bestSpan) {
				bestSpan = span;
				bestEl = el;
			}
		}

		if (bestEl) {
			bestEl.classList.add("active-cursor-block");
			bestEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
		}
	}

	/** Detects content spilling past column 2 into an off-page 3rd column. */
	public detectColumnOverflows(): number[] {
		const overflowPages: number[] = [];
		const doc = this.iframeEl?.contentDocument;
		if (!doc) return overflowPages;

		doc.querySelectorAll(".hb-overflow-badge").forEach((el) => el.remove());
		doc.querySelectorAll(".hb-overflow-warning").forEach((el) => el.classList.remove("hb-overflow-warning"));

		const pages = doc.querySelectorAll<HTMLElement>(".page");
		for (let pIdx = 0; pIdx < pages.length; pIdx++) {
			const page = pages[pIdx];
			const pageRect = page.getBoundingClientRect();
			if (pageRect.width === 0) continue;

			let hasOverflow = false;
			const bodyEl = page.querySelector<HTMLElement>(":scope > .hb-page-body");
			const scope: HTMLElement = bodyEl ?? page;
			const children = Array.from(scope.children).filter((child): child is HTMLElement => {
				if (!(child instanceof HTMLElement)) return false;
				return !(
					child.classList.contains("hb-img-bg") ||
					child.classList.contains("hb-overflow-badge") ||
					child.classList.contains("page-footer") ||
					child.classList.contains("pageNumber") ||
					child.classList.contains("footnote") ||
					child.classList.contains("hb-running-header") ||
					child.classList.contains("hb-running-footer") ||
					child.classList.contains("colophon") ||
					child.classList.contains("columnSplit")
				);
			});

			for (const child of children) {
				const rect = child.getBoundingClientRect();
				if (rect.width === 0 && rect.height === 0) continue;
				if (rect.left >= pageRect.right - 24 || rect.right > pageRect.right + 4) {
					child.classList.add("hb-overflow-warning");
					hasOverflow = true;
				}
			}

			if (hasOverflow) {
				overflowPages.push(pIdx + 1);
				const badge = doc.createElement("div");
				badge.className = "hb-overflow-badge";
				badge.textContent = "Overflow — Add \\page or \\column";
				page.appendChild(badge);
			}
		}
		return overflowPages;
	}

	public async exportPdf(): Promise<void> {
		await this.refreshPreview();
		const win = this.iframeEl?.contentWindow;
		if (!win) {
			new Notice("Homebrew Preview is not ready to print yet.");
			return;
		}
		win.focus();
		win.print();
	}

	public async exportHomebreweryMarkdown(): Promise<void> {
		let v3: string;
		let targetPath: string;

		const compiled = this.compiledFiles;
		if (compiled && compiled.length > 0) {
			const chapters: string[] = [];
			for (const chapterFile of compiled) {
				const chapterRaw = await this.readNoteMarkdown(chapterFile);
				chapters.push(obsidianToHomebrewery(chapterRaw, this.transpileOptions(chapterFile)));
			}
			v3 = joinBookChapters(chapters);
			const first = compiled[0];
			const folderPrefix = first.parent && first.parent.path !== "/" ? `${first.parent.path}/` : "";
			targetPath = normalizePath(`${folderPrefix}${this.compiledTitle}-Homebrewery.md`);
		} else {
			const file = this.resolveTargetFile();
			if (!file) {
				new Notice("Open a Markdown note before exporting.");
				return;
			}
			const raw = await this.readNoteMarkdown(file);
			v3 = prepareMappedBook(raw, this.transpileOptions(file)).v3;
			const folderPrefix = file.parent && file.parent.path !== "/" ? `${file.parent.path}/` : "";
			targetPath = normalizePath(`${folderPrefix}${file.basename}-Homebrewery.md`);
		}

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
