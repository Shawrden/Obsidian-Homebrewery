/**
 * Plugin settings and Obsidian settings tab.
 */

import { App, PluginSettingTab, Setting, setIcon } from "obsidian";
import {
	CUSTOM_FONT_SLOTS,
	CustomFontSettings,
	CustomFontSlotMeta,
	DEFAULT_CUSTOM_FONTS,
	DEFAULT_CUSTOM_FONT_TAGS,
	FontTagSlot,
	LocalFontFileEntry,
	buildCustomFontsCss,
	getEmbeddedFontsCss,
	getPluginFontsDir,
	listAvailableLocalFontFiles,
} from "./fonts";
import type HomebreweryExporterPlugin from "./main";
import { BOOK_THEMES, BookTheme, ColorSlot, DEFAULT_COLOR_SLOTS, isValidTagName, sanitizeHexColor } from "./themes";

export type { CustomFontSettings, CustomFontSlotKey, FontTagSlot } from "./fonts";

interface LocalFontFaceData {
	family: string;
}

type QueryLocalFontsFn = () => Promise<LocalFontFaceData[]>;

export interface HomebrewExporterSettings {
	/** When true, automatically refreshes the preview 300ms after editor changes. */
	livePreview: boolean;
	/** Active visual theme. */
	theme: BookTheme;
	/** `--hb-page-bg` when `theme === "custom"`. */
	customPageColor: string;
	/** `--hb-text-color` / `--hb-heading-color` when `theme === "custom"`. */
	customFontColor: string;
	/** Optional vault path of a `.css` file injected last in the preview `<head>`. */
	customCssPath: string;
	/** 5 configurable `{{tagName text}}` color slots. */
	colorSlots: ColorSlot[];
	/** 14 custom typography slots (H1–H6 + body/block slots; empty means use plugin default). */
	customFonts: CustomFontSettings;
	/** 3 configurable `{{tagName text}}` custom font tag slots. */
	customFontTags: FontTagSlot[];
}

export const DEFAULT_SETTINGS: HomebrewExporterSettings = {
	livePreview: false,
	theme: "5ePHB",
	customPageColor: "#f6f2e9",
	customFontColor: "#1e1915",
	customCssPath: "",
	colorSlots: DEFAULT_COLOR_SLOTS.map((s) => ({ ...s })),
	customFonts: { ...DEFAULT_CUSTOM_FONTS },
	customFontTags: DEFAULT_CUSTOM_FONT_TAGS.map((s) => ({ ...s })),
};

/** Merges persisted data over defaults, normalizing color slots, custom font slots, and font tags. */
export function normalizeSettings(loaded: Partial<HomebrewExporterSettings> | null | undefined): HomebrewExporterSettings {
	const merged: HomebrewExporterSettings = { ...DEFAULT_SETTINGS, ...(loaded ?? {}) };
	const loadedSlots = loaded?.colorSlots;
	const slots: ColorSlot[] = [];
	for (let i = 0; i < 5; i++) {
		const fallback = DEFAULT_COLOR_SLOTS[i];
		const given = Array.isArray(loadedSlots) ? loadedSlots[i] : undefined;
		slots.push({
			name: typeof given?.name === "string" ? given.name : fallback.name,
			color: sanitizeHexColor(given?.color, fallback.color),
		});
	}
	merged.colorSlots = slots;

	const loadedFonts = loaded?.customFonts as (Partial<CustomFontSettings> & { header?: unknown }) | undefined;
	const customFonts: CustomFontSettings = { ...DEFAULT_CUSTOM_FONTS };
	for (const meta of CUSTOM_FONT_SLOTS) {
		const candidate = loadedFonts?.[meta.key];
		customFonts[meta.key] = typeof candidate === "string" ? candidate : "";
	}
	if (!customFonts.h1 && typeof loadedFonts?.header === "string" && loadedFonts.header.trim() !== "") {
		customFonts.h1 = loadedFonts.header.trim();
	}
	merged.customFonts = customFonts;

	const loadedFontTags = loaded?.customFontTags;
	const fontTags: FontTagSlot[] = [];
	for (let i = 0; i < 3; i++) {
		const fallback = DEFAULT_CUSTOM_FONT_TAGS[i];
		const given = Array.isArray(loadedFontTags) ? loadedFontTags[i] : undefined;
		fontTags.push({
			name: typeof given?.name === "string" ? given.name : fallback.name,
			font: typeof given?.font === "string" ? given.font : fallback.font,
		});
	}
	merged.customFontTags = fontTags;
	return merged;
}

const SWATCH_SAMPLE_TEXT = "The quick wyvern guards 12 arcane relics — 0123456789";

interface SwatchHandle {
	cssVar: string;
	fallbackStack: string;
	swatchSampleEl: HTMLElement;
	swatchLabelEl: HTMLElement;
	getLabelText: () => string;
	refreshDropdown: () => void;
}

function parseVariableStacks(fontVariablesCss: string): Record<string, string> {
	const map: Record<string, string> = {};
	for (const line of fontVariablesCss.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed.startsWith("--")) continue;
		const colon = trimmed.indexOf(":");
		if (colon < 0) continue;
		const key = trimmed.slice(0, colon).trim();
		const value = trimmed.slice(colon + 1).replace(/;\s*$/, "").trim();
		map[key] = value;
	}
	return map;
}

export class HomebrewExporterSettingTab extends PluginSettingTab {
	private readonly plugin: HomebreweryExporterPlugin;
	private scannedSystemFonts: string[] = [];
	private localFontFiles: LocalFontFileEntry[] = [];
	private injectedStyleEls: HTMLStyleElement[] = [];
	private pickerHandles: SwatchHandle[] = [];
	private cleanupListeners: Array<() => void> = [];
	private swatchRefreshToken = 0;

	constructor(app: App, plugin: HomebreweryExporterPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	private clearInjectedStyles(): void {
		for (const el of this.injectedStyleEls) {
			el.remove();
		}
		this.injectedStyleEls = [];
	}

	private clearListeners(): void {
		for (const fn of this.cleanupListeners) {
			fn();
		}
		this.cleanupListeners = [];
	}

	private setInjectedFontCss(css: string): void {
		this.clearInjectedStyles();
		const styleEl = document.createElement("style");
		styleEl.setAttribute("data-hb-font-swatches", "true");
		styleEl.textContent = css;
		document.head.appendChild(styleEl);
		this.injectedStyleEls.push(styleEl);
	}

	private async refreshAllSwatches(): Promise<void> {
		const token = ++this.swatchRefreshToken;
		const embedded = getEmbeddedFontsCss();
		const resolved = await buildCustomFontsCss(
			this.app,
			this.plugin.settings.customFonts,
			this.plugin.settings.customFontTags,
		);
		if (token !== this.swatchRefreshToken) return;

		this.setInjectedFontCss(resolved.fontFacesCss ? `${embedded}\n${resolved.fontFacesCss}` : embedded);
		const stacks = parseVariableStacks(resolved.fontVariablesCss);

		for (const handle of this.pickerHandles) {
			const stack = stacks[handle.cssVar] ?? handle.fallbackStack;
			handle.swatchSampleEl.style.fontFamily = stack;
			handle.swatchLabelEl.setText(handle.getLabelText());
		}
	}

	override hide(): void {
		this.swatchRefreshToken++;
		this.clearInjectedStyles();
		this.clearListeners();
		this.pickerHandles = [];
		super.hide();
		void this.plugin.refreshOpenPreviews();
	}

	override display(): void {
		this.clearInjectedStyles();
		this.clearListeners();
		this.pickerHandles = [];

		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Homebrew Exporter Settings" });

		new Setting(containerEl)
			.setName("Live Preview")
			.setDesc(
				"Automatically re-render the Homebrew Preview while typing (300ms debounce). Keep off to use manual refresh or a custom hotkey for smoother editing on notes with large images.",
			)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.livePreview).onChange(async (value) => {
					this.plugin.settings.livePreview = value;
					await this.plugin.saveSettings();
				}),
			);

		containerEl.createEl("h3", { text: "Visual Theme" });

		new Setting(containerEl)
			.setName("Theme")
			.setDesc("Classic Parchment, Ink-Saver (print), Dark / Eldritch Grimoire, or Custom colors.")
			.addDropdown((dd) => {
				for (const t of BOOK_THEMES) dd.addOption(t.value, t.label);
				dd.setValue(this.plugin.settings.theme).onChange(async (value) => {
					this.plugin.settings.theme = value as BookTheme;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Custom Page Color")
			.setDesc("Applied to --hb-page-bg when the Custom theme is selected.")
			.addColorPicker((cp) =>
				cp.setValue(this.plugin.settings.customPageColor).onChange(async (value) => {
					this.plugin.settings.customPageColor = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Custom Font Color")
			.setDesc("Applied to --hb-text-color and --hb-heading-color when the Custom theme is selected.")
			.addColorPicker((cp) =>
				cp.setValue(this.plugin.settings.customFontColor).onChange(async (value) => {
					this.plugin.settings.customFontColor = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Custom CSS file")
			.setDesc("Optional vault path to a .css file (e.g. Styles/book.css) injected last into the preview stylesheet.")
			.addText((text) =>
				text
					.setPlaceholder("Styles/book.css")
					.setValue(this.plugin.settings.customCssPath)
					.onChange(async (value) => {
						this.plugin.settings.customCssPath = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		containerEl.createEl("h3", { text: "Typography & Custom Fonts" });
		const fontsDir = getPluginFontsDir(this.app, this.plugin.manifest.dir);
		containerEl.createEl("p", {
			cls: "setting-item-description",
			text: `Override any of the 9 typography slots with a system font name or a local .ttf/.otf/.woff/.woff2 file placed in your vault or ${fontsDir}. Leave empty to use the plugin default.`,
		});

		const scanStatusSetting = new Setting(containerEl)
			.setName("Installed System Fonts")
			.setDesc(
				this.scannedSystemFonts.length > 0
					? `${this.scannedSystemFonts.length} system font families loaded.`
					: "Scan your OS for installed fonts, or type any font family name / local font path directly below.",
			)
			.addButton((btn) =>
				btn.setButtonText("Scan Installed System Fonts").onClick(async () => {
					const queryFn = (window as unknown as { queryLocalFonts?: QueryLocalFontsFn }).queryLocalFonts;
					if (typeof queryFn !== "function") {
						scanStatusSetting.setDesc(
							"System font scanning is unavailable in this environment; enter a font name manually or choose a local font file.",
						);
						return;
					}
					btn.setDisabled(true);
					btn.setButtonText("Scanning...");
					try {
						const fonts = await queryFn();
						const unique = new Set<string>();
						for (const f of fonts) {
							const family = (f.family ?? "").trim();
							if (family) unique.add(family);
						}
						this.scannedSystemFonts = Array.from(unique).sort((a, b) => a.localeCompare(b));
						scanStatusSetting.setDesc(`${this.scannedSystemFonts.length} system font families loaded.`);
						for (const handle of this.pickerHandles) handle.refreshDropdown();
					} catch {
						scanStatusSetting.setDesc(
							"System font access was denied or unavailable; enter a font name manually or choose a local font file.",
						);
					} finally {
						btn.setDisabled(false);
						btn.setButtonText("Scan Installed System Fonts");
					}
				}),
			);

		for (const meta of CUSTOM_FONT_SLOTS) {
			this.renderFontSlotControl(containerEl, meta);
		}

		containerEl.createEl("h3", { text: "Custom Inline & Block Font Tags" });
		containerEl.createEl("p", {
			cls: "setting-item-description",
			text: "Define up to 3 custom font tags (e.g. {{elvish text}} or chained with colors {{elvish,crimson text}}).",
		});
		this.plugin.settings.customFontTags.forEach((slot, idx) => {
			this.renderFontTagControl(containerEl, slot, idx);
		});

		void listAvailableLocalFontFiles(this.app, this.plugin.manifest.dir).then((files) => {
			this.localFontFiles = files;
			for (const handle of this.pickerHandles) handle.refreshDropdown();
		});
		void this.refreshAllSwatches();

		containerEl.createEl("h3", { text: "Custom Text Color Slots" });
		containerEl.createEl("p", {
			text: "Use {{tagName text}} for inline color or {{tagName ...}} blocks. Tag names may contain letters, digits, - and _.",
		});

		this.plugin.settings.colorSlots.forEach((slot, idx) => {
			new Setting(containerEl)
				.setName(`Color ${idx + 1}`)
				.addText((text) =>
					text
						.setPlaceholder("tag name")
						.setValue(slot.name)
						.onChange(async (value) => {
							const name = value.trim();
							if (name !== "" && !isValidTagName(name)) return;
							slot.name = name;
							await this.plugin.saveSettings();
						}),
				)
				.addColorPicker((cp) =>
					cp.setValue(slot.color).onChange(async (value) => {
						slot.color = value;
						await this.plugin.saveSettings();
					}),
				);
		});
	}

	private createSearchableFontPicker(
		controlEl: HTMLElement,
		slotWrap: HTMLElement,
		opts: {
			ariaLabel: string;
			placeholder: string;
			defaultOptionLabel: string;
			defaultSearchKeyword: string;
			initialValue: string;
			cssVar: string;
			fallbackStack: string;
			swatchClass: string;
			getLabelText: () => string;
			onApply: (nextValue: string) => Promise<void>;
		},
	): void {
		const pickerEl = controlEl.createDiv({ cls: "hb-font-picker" });
		const inputEl = pickerEl.createEl("input", {
			cls: "hb-font-search-input",
			attr: {
				type: "text",
				placeholder: opts.placeholder,
				"aria-label": opts.ariaLabel,
			},
		});
		inputEl.value = opts.initialValue;

		const dropdownEl = pickerEl.createDiv({ cls: "hb-font-dropdown" });

		const resetBtn = controlEl.createEl("button", {
			cls: "clickable-icon hb-font-reset-btn",
			attr: {
				type: "button",
				title: `Reset ${opts.ariaLabel} to default`,
				"aria-label": `Reset ${opts.ariaLabel} to default`,
			},
		});
		setIcon(resetBtn, "rotate-ccw");

		const swatchBox = slotWrap.createDiv({ cls: "hb-font-swatch" });
		const swatchHeader = swatchBox.createDiv({ cls: "hb-font-swatch-meta" });
		swatchHeader.createSpan({ cls: "hb-font-swatch-title", text: "Preview" });
		const swatchLabelEl = swatchHeader.createSpan({ cls: "hb-font-swatch-active" });
		const swatchSampleEl = swatchBox.createDiv({
			cls: `hb-font-swatch-sample ${opts.swatchClass}`,
			text: SWATCH_SAMPLE_TEXT,
		});

		const applyValue = async (nextValue: string): Promise<void> => {
			const normalized = nextValue.trim();
			inputEl.value = normalized;
			await opts.onApply(normalized);
			await this.refreshAllSwatches();
			void this.plugin.refreshOpenPreviews();
		};

		const closeDropdown = (): void => {
			dropdownEl.removeClass("is-open");
		};

		const renderOptions = (filterText: string): void => {
			dropdownEl.empty();
			const q = filterText.trim().toLowerCase();

			const addGroupHeading = (title: string): void => {
				dropdownEl.createDiv({ cls: "hb-font-group-label", text: title });
			};

			const addOption = (label: string, value: string, badge?: string): void => {
				const optBtn = dropdownEl.createEl("button", {
					cls: "hb-font-option",
					attr: { type: "button" },
				});
				optBtn.createSpan({ cls: "hb-font-option-label", text: label });
				if (badge) optBtn.createSpan({ cls: "hb-font-option-badge", text: badge });
				optBtn.addEventListener("mousedown", (evt) => {
					evt.preventDefault();
					closeDropdown();
					void applyValue(value);
				});
			};

			addGroupHeading("Plugin Default");
			if (
				!q ||
				opts.defaultOptionLabel.toLowerCase().includes(q) ||
				opts.defaultSearchKeyword.toLowerCase().includes(q)
			) {
				addOption(opts.defaultOptionLabel, "", "Default");
			}

			const matchingLocal = this.localFontFiles.filter(
				(f) => !q || f.label.toLowerCase().includes(q) || f.path.toLowerCase().includes(q),
			);
			if (matchingLocal.length > 0) {
				addGroupHeading("Local Font Files (Vault & Plugin fonts/)");
				for (const entry of matchingLocal) {
					addOption(entry.label, entry.path, entry.source === "plugin" ? "Plugin" : "Vault");
				}
			}

			const matchingOs = this.scannedSystemFonts.filter((name) => !q || name.toLowerCase().includes(q));
			if (matchingOs.length > 0) {
				addGroupHeading("Scanned OS Fonts");
				for (const family of matchingOs.slice(0, 120)) {
					addOption(family, family, "OS");
				}
			}

			if (dropdownEl.childElementCount <= 1 && q && matchingLocal.length === 0 && matchingOs.length === 0) {
				addOption(`Use custom font "${filterText.trim()}"`, filterText.trim(), "Custom");
			}
		};

		const openDropdown = (filterText: string): void => {
			renderOptions(filterText);
			dropdownEl.addClass("is-open");
		};

		inputEl.addEventListener("focus", () => openDropdown(""));
		inputEl.addEventListener("click", () => openDropdown(""));
		inputEl.addEventListener("input", () => openDropdown(inputEl.value));
		inputEl.addEventListener("keydown", (evt) => {
			if (evt.key === "Enter") {
				evt.preventDefault();
				closeDropdown();
				void applyValue(inputEl.value);
			} else if (evt.key === "Escape") {
				closeDropdown();
			}
		});
		inputEl.addEventListener("change", () => {
			closeDropdown();
			void applyValue(inputEl.value);
		});
		resetBtn.addEventListener("click", () => {
			closeDropdown();
			void applyValue("");
		});

		const onDocClick = (evt: MouseEvent): void => {
			const target = evt.target;
			if (target instanceof Node && !pickerEl.contains(target)) {
				closeDropdown();
			}
		};
		document.addEventListener("click", onDocClick);
		this.cleanupListeners.push(() => document.removeEventListener("click", onDocClick));

		this.pickerHandles.push({
			cssVar: opts.cssVar,
			fallbackStack: opts.fallbackStack,
			swatchSampleEl,
			swatchLabelEl,
			getLabelText: opts.getLabelText,
			refreshDropdown: () => {
				if (dropdownEl.hasClass("is-open")) {
					renderOptions(inputEl.value);
				}
			},
		});
	}

	private renderFontSlotControl(containerEl: HTMLElement, meta: CustomFontSlotMeta): void {
		const slotWrap = containerEl.createDiv({ cls: "hb-font-slot-group" });
		const setting = new Setting(slotWrap)
			.setName(meta.label)
			.setDesc(`${meta.description} Default: ${meta.defaultLabel}.`);
		setting.settingEl.addClass("hb-font-setting");

		this.createSearchableFontPicker(setting.controlEl, slotWrap, {
			ariaLabel: `${meta.label} font`,
			placeholder: `Plugin Default (${meta.defaultLabel})`,
			defaultOptionLabel: meta.defaultLabel,
			defaultSearchKeyword: meta.defaultLabel,
			initialValue: this.plugin.settings.customFonts[meta.key],
			cssVar: meta.cssVar,
			fallbackStack: meta.fallbackStack,
			swatchClass: `hb-font-swatch-${meta.key}`,
			getLabelText: () => {
				const configured = this.plugin.settings.customFonts[meta.key].trim();
				if (configured) return configured;
				if (meta.inheritsFrom) {
					const parentConfigured = this.plugin.settings.customFonts[meta.inheritsFrom].trim();
					if (parentConfigured) return `Inherited: ${parentConfigured}`;
				}
				return `Default (${meta.defaultLabel})`;
			},
			onApply: async (val) => {
				this.plugin.settings.customFonts[meta.key] = val;
				await this.plugin.saveSettings();
			},
		});
	}

	private renderFontTagControl(containerEl: HTMLElement, slot: FontTagSlot, idx: number): void {
		const slotWrap = containerEl.createDiv({ cls: "hb-font-slot-group" });
		const setting = new Setting(slotWrap)
			.setName(`Font Tag ${idx + 1}`)
			.setDesc(`Use {{${slot.name || "tagName"} text}} for inline or block custom typography.`);
		setting.settingEl.addClass("hb-font-setting");

		setting.addText((text) =>
			text
				.setPlaceholder("tag name")
				.setValue(slot.name)
				.onChange(async (value) => {
					const name = value.trim();
					if (name !== "" && !isValidTagName(name)) return;
					slot.name = name;
					setting.setDesc(`Use {{${name || "tagName"} text}} for inline or block custom typography.`);
					await this.plugin.saveSettings();
					void this.plugin.refreshOpenPreviews();
				}),
		);

		this.createSearchableFontPicker(setting.controlEl, slotWrap, {
			ariaLabel: `Font Tag ${idx + 1} font`,
			placeholder: "Inherit surrounding font",
			defaultOptionLabel: "Inherit Surrounding Font",
			defaultSearchKeyword: "default inherit",
			initialValue: slot.font,
			cssVar: `--hb-custom-font-${idx + 1}`,
			fallbackStack: "inherit",
			swatchClass: `hb-font-swatch-tag-${idx + 1}`,
			getLabelText: () => (slot.font.trim() ? slot.font.trim() : "Unset (inherits surrounding font)"),
			onApply: async (val) => {
				slot.font = val;
				await this.plugin.saveSettings();
			},
		});
	}
}
