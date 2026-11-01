import ts from "typescript";

export interface CommentHit {
	file: string;
	line: number;
	text: string;
}

const SCRIPT_KINDS: Record<string, ts.ScriptKind> = {
	".ts": ts.ScriptKind.TS,
	".mts": ts.ScriptKind.TS,
	".cts": ts.ScriptKind.TS,
	".tsx": ts.ScriptKind.TSX,
	".js": ts.ScriptKind.JS,
	".mjs": ts.ScriptKind.JS,
	".cjs": ts.ScriptKind.JS,
	".jsx": ts.ScriptKind.JSX,
};

function extensionOf(file: string): string {
	const dot = file.lastIndexOf(".");
	return dot === -1 ? "" : file.slice(dot).toLowerCase();
}

export function canRead(file: string): boolean {
	const extension = extensionOf(file);
	return extension === ".css" || extension in SCRIPT_KINDS;
}

function lineAt(source: string, offset: number): number {
	let line = 1;
	for (let i = 0; i < offset; i++) {
		if (source.charCodeAt(i) === 10) line++;
	}
	return line;
}

function commentEnd(source: string, start: number): number {
	if (source.startsWith("//", start)) {
		const newline = source.indexOf("\n", start);
		return newline === -1 ? source.length : newline;
	}
	const close = source.indexOf("*/", start + 2);
	return close === -1 ? source.length : close + 2;
}

function hit(file: string, source: string, start: number): CommentHit {
	const end = commentEnd(source, start);
	const text = source.slice(start, end).split("\n")[0]?.trim() ?? "";
	return { file, line: lineAt(source, start), text };
}

function triviaComments(
	file: string,
	source: string,
	from: number,
	to: number,
): CommentHit[] {
	const hits: CommentHit[] = [];
	let i = from;
	while (i < to) {
		if (source.startsWith("//", i) || source.startsWith("/*", i)) {
			hits.push(hit(file, source, i));
			i = commentEnd(source, i);
		} else {
			i++;
		}
	}
	return hits;
}

function isJSDocNode(node: ts.Node): boolean {
	return (
		node.kind >= ts.SyntaxKind.FirstJSDocNode &&
		node.kind <= ts.SyntaxKind.LastJSDocNode
	);
}

function scriptComments(
	file: string,
	source: string,
	kind: ts.ScriptKind,
): CommentHit[] {
	const sourceFile = ts.createSourceFile(
		file,
		source,
		ts.ScriptTarget.Latest,
		true,
		kind,
	);
	const hits: CommentHit[] = [];
	const visit = (node: ts.Node): void => {
		if (isJSDocNode(node)) return;
		const children = node.getChildren(sourceFile);
		if (children.length === 0) {
			hits.push(
				...triviaComments(
					file,
					source,
					node.getFullStart(),
					node.getStart(sourceFile),
				),
			);
			return;
		}
		for (const child of children) visit(child);
	};
	visit(sourceFile);
	return hits;
}

function cssComments(file: string, source: string): CommentHit[] {
	const hits: CommentHit[] = [];
	let quote: string | null = null;
	let i = 0;
	while (i < source.length) {
		const char = source[i];
		if (quote) {
			if (char === "\\") i++;
			else if (char === quote) quote = null;
			i++;
		} else if (char === '"' || char === "'") {
			quote = char;
			i++;
		} else if (source.startsWith("/*", i)) {
			hits.push(hit(file, source, i));
			i = commentEnd(source, i);
		} else {
			i++;
		}
	}
	return hits;
}

export function findComments(file: string, source: string): CommentHit[] {
	const extension = extensionOf(file);
	if (extension === ".css") return cssComments(file, source);
	const kind = SCRIPT_KINDS[extension];
	if (kind === undefined) {
		throw new Error(`find-comments cannot read ${file}`);
	}
	return scriptComments(file, source, kind);
}
