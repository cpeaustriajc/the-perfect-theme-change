import { describe, expect, it } from "vitest";
import { getClientHintCheckScript } from "./theme-script.js";

const DOM_TOKENS = [
	"documentElement",
	"classList",
	"setAttribute",
	"querySelector",
];

describe("getClientHintCheckScript", () => {
	it("contains the configured cookie name", () => {
		const script = getClientHintCheckScript({ hintCookieName: "my-hint" });
		expect(script).toContain('"my-hint"');
	});

	it("uses the default cookie name when unspecified", () => {
		expect(getClientHintCheckScript()).toContain('"ch-prefers-color-scheme"');
	});

	it("css mode (default) contains NO location.reload", () => {
		expect(getClientHintCheckScript()).not.toContain("location.reload");
		expect(getClientHintCheckScript({ firstVisit: "css" })).not.toContain(
			"location.reload",
		);
	});

	it("reload mode contains location.reload", () => {
		expect(getClientHintCheckScript({ firstVisit: "reload" })).toContain(
			"location.reload",
		);
	});

	it("reload mode guards with sessionStorage", () => {
		const script = getClientHintCheckScript({ firstVisit: "reload" });
		expect(script).toContain("sessionStorage");
	});

	it("INVARIANT: never touches the DOM in either mode", () => {
		for (const mode of ["css", "reload"] as const) {
			const script = getClientHintCheckScript({ firstVisit: mode });
			for (const token of DOM_TOKENS) {
				expect(script).not.toContain(token);
			}
		}
	});

	it("JSON-escapes options so a quote in the name cannot break the script", () => {
		const evil = 'evil";document.title="pwned';
		const script = getClientHintCheckScript({ hintCookieName: evil });
		// The value is embedded as a single JSON string literal, escaped.
		expect(script).toContain(JSON.stringify(evil));
		// And the script is still syntactically valid (see below).
		expect(() => new Function(script)).not.toThrow();
	});

	it("produces a syntactically valid script (both modes)", () => {
		expect(() => new Function(getClientHintCheckScript())).not.toThrow();
		expect(
			() => new Function(getClientHintCheckScript({ firstVisit: "reload" })),
		).not.toThrow();
	});

	it("embeds a custom path and max-age", () => {
		const script = getClientHintCheckScript({
			cookiePath: "/app",
			cookieMaxAge: 42,
		});
		expect(script).toContain('"/app"');
		expect(script).toContain("42");
	});
});
