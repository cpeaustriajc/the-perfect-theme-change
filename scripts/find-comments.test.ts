import { describe, expect, it } from "vitest";
import { findComments } from "./find-comments.js";

const lines = (file: string, source: string) =>
	findComments(file, source).map((hit) => hit.line);

describe("findComments in TypeScript", () => {
	it("finds a line comment", () => {
		expect(lines("a.ts", "const a = 1;\n// note\n")).toEqual([2]);
	});

	it("finds a trailing line comment", () => {
		expect(lines("a.ts", "const a = 1; // note\n")).toEqual([1]);
	});

	it("finds a block comment and a JSDoc comment", () => {
		expect(lines("a.ts", "/* a */\n/** b */\nexport const c = 1;\n")).toEqual([
			1, 2,
		]);
	});

	it("finds a comment before a closing brace", () => {
		expect(lines("a.ts", "function f() {\n\tf();\n\t// note\n}\n")).toEqual([
			3,
		]);
	});

	it("finds a comment at the end of the file", () => {
		expect(lines("a.ts", "const a = 1;\n/* end */")).toEqual([2]);
	});

	it("finds a comment inside a template expression", () => {
		expect(lines("a.ts", "const a = `x${/* c */ 1}y`;\n")).toEqual([1]);
	});

	it("finds a biome-ignore directive", () => {
		expect(
			lines("a.ts", "// biome-ignore lint/x: y\ndocument.title = '';\n"),
		).toEqual([1]);
	});

	it("ignores comment markers inside strings, templates and regexes", () => {
		const source = [
			'const a = "// not a comment";',
			"const b = 'https://example.test/*x*/';",
			"const c = `// ${a} /* ${b} */`;",
			"const d = /\\/\\/|\\/\\*/;",
			"const e = <div>// text</div>;",
		].join("\n");
		expect(lines("a.tsx", source)).toEqual([]);
	});

	it("reports each comment once", () => {
		expect(lines("a.ts", "f(/* a */ 1, /* b */ 2);\n")).toEqual([1, 1]);
	});
});

describe("findComments in CSS", () => {
	it("finds a block comment", () => {
		expect(lines("a.css", "a {\n\tcolor: red; /* note */\n}\n")).toEqual([2]);
	});

	it("finds a comment that spans lines once", () => {
		expect(lines("a.css", "/*\n a\n*/\nb {}\n")).toEqual([1]);
	});

	it("ignores comment markers inside strings", () => {
		expect(
			lines(
				"a.css",
				"a::before { content: \"/* no */\"; }\nb { content: '\\'/*'; }\n",
			),
		).toEqual([]);
	});
});

describe("findComments for other files", () => {
	it("rejects a file type it cannot read", () => {
		expect(() => findComments("a.md", "<!-- x -->")).toThrow(/a\.md/);
	});
});
