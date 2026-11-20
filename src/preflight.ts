/**
 * Pure preflight diagnostics for the Homebrew Preview toolbar pill.
 */

export interface PreflightReport {
	/** 1-based source line numbers of `{{...` blocks that are never closed. */
	unclosedBlocks: number[];
	/** Image links that could not be resolved in the vault. */
	missingImages: string[];
	/** 1-based page numbers with 3rd-column overflow. */
	overflowPages: number[];
}

export function emptyPreflightReport(): PreflightReport {
	return { unclosedBlocks: [], missingImages: [], overflowPages: [] };
}

export function countPreflightWarnings(report: PreflightReport): number {
	return report.unclosedBlocks.length + report.missingImages.length + report.overflowPages.length;
}

/** Finds multi-line `{{name` openers without a matching closing `}}` line. Skips fenced code. */
export function findUnclosedBlocks(markdown: string): number[] {
	const stack: number[] = [];
	let inFence = false;
	const lines = markdown.split(/\r?\n/);

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] ?? "";
		if (/^\s*(```|~~~)/.test(line)) {
			inFence = !inFence;
			continue;
		}
		if (inFence) continue;

		if (/^\s*\}\}\s*$/.test(line)) {
			stack.pop();
		} else if (/^\s*\{\{[^}]*$/.test(line)) {
			stack.push(i + 1);
		}
	}
	return stack;
}
