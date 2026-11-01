import { describe, expect, it } from "vitest";
import { polyfillColorSchemeHint } from "./theme-polyfill.js";

const HEADER = "sec-ch-prefers-color-scheme";

describe("polyfillColorSchemeHint", () => {
	it("fills a missing header from a valid hint cookie", () => {
		const out = polyfillColorSchemeHint(
			new Headers({ cookie: "ch-prefers-color-scheme=dark" }),
		);
		expect(out.get(HEADER)).toBe("dark");
	});

	it("keeps a valid native header over a different cookie", () => {
		const out = polyfillColorSchemeHint(
			new Headers({
				cookie: "ch-prefers-color-scheme=light",
				[HEADER]: "dark",
			}),
		);
		expect(out.get(HEADER)).toBe("dark");
	});

	it("replaces an invalid native header with a valid cookie", () => {
		const out = polyfillColorSchemeHint(
			new Headers({
				cookie: "ch-prefers-color-scheme=light",
				[HEADER]: "purple",
			}),
		);
		expect(out.get(HEADER)).toBe("light");
	});

	it("adds no header for an invalid cookie", () => {
		const out = polyfillColorSchemeHint(
			new Headers({ cookie: "ch-prefers-color-scheme=purple" }),
		);
		expect(out.has(HEADER)).toBe(false);
	});

	it("adds no header when there is no cookie", () => {
		expect(polyfillColorSchemeHint(new Headers()).has(HEADER)).toBe(false);
		expect(polyfillColorSchemeHint(null).has(HEADER)).toBe(false);
		expect(polyfillColorSchemeHint(undefined).has(HEADER)).toBe(false);
	});

	it("never mutates its input", () => {
		const headers = new Headers({ cookie: "ch-prefers-color-scheme=dark" });
		const record = { cookie: "ch-prefers-color-scheme=dark" };

		const fromHeaders = polyfillColorSchemeHint(headers);
		const fromRecord = polyfillColorSchemeHint(record);

		expect(fromHeaders).not.toBe(headers);
		expect(headers.has(HEADER)).toBe(false);
		expect(record).toEqual({ cookie: "ch-prefers-color-scheme=dark" });
		expect(fromRecord.get(HEADER)).toBe("dark");
	});

	it("copies a plain record with mixed-case keys and array values", () => {
		const out = polyfillColorSchemeHint({
			Cookie: ["theme=light", "ch-prefers-color-scheme=dark"],
			"X-Other": ["1", "2"],
			"X-Missing": undefined,
		});
		expect(out.get(HEADER)).toBe("dark");
		expect(out.get("cookie")).toBe("theme=light; ch-prefers-color-scheme=dark");
		expect(out.get("x-other")).toBe("1, 2");
		expect(out.has("x-missing")).toBe(false);
	});

	it("combines keys that differ only in case into one header", () => {
		const out = polyfillColorSchemeHint({
			cookie: "theme=light",
			COOKIE: "ch-prefers-color-scheme=dark",
			"X-Other": "1",
			"x-other": "2",
		});
		expect(out.get("cookie")).toBe("theme=light; ch-prefers-color-scheme=dark");
		expect(out.get("x-other")).toBe("1, 2");
		expect(out.get(HEADER)).toBe("dark");
	});

	it("treats a header sent twice as invalid and falls back to the cookie", () => {
		const out = polyfillColorSchemeHint({
			"Sec-CH-Prefers-Color-Scheme": "light",
			[HEADER]: "dark",
			cookie: "ch-prefers-color-scheme=dark",
		});
		expect(out.get(HEADER)).toBe("dark");
	});

	it("trims optional whitespace around a native header value", () => {
		const out = polyfillColorSchemeHint({
			[HEADER]: " dark ",
			cookie: "ch-prefers-color-scheme=light",
		});
		expect(out.get(HEADER)).toBe("dark");
	});

	it("skips HTTP/2 pseudo-headers", () => {
		const out = polyfillColorSchemeHint({
			":method": "GET",
			":path": "/",
			":authority": "example.test",
			":scheme": "https",
			cookie: "ch-prefers-color-scheme=dark",
		});
		expect(out.get(HEADER)).toBe("dark");
		expect([...out.keys()]).toEqual(["cookie", HEADER]);
	});

	it("throws a TypeError for a header name that is not a valid token", () => {
		expect(() => polyfillColorSchemeHint({ "bad name": "x" })).toThrow(
			TypeError,
		);
	});

	it("reads a custom hint cookie name", () => {
		const out = polyfillColorSchemeHint(
			{ cookie: "scheme=light; ch-prefers-color-scheme=dark" },
			{ cookieNames: { hint: "scheme" } },
		);
		expect(out.get(HEADER)).toBe("light");
	});

	it("returns Headers that accept a sec- name in this runtime", () => {
		const bare = new Headers();
		bare.set(HEADER, "dark");
		expect(bare.get(HEADER)).toBe("dark");

		const out = polyfillColorSchemeHint({
			cookie: "ch-prefers-color-scheme=dark",
		});
		expect(out).toBeInstanceOf(Headers);
		expect(out.get(HEADER)).toBe("dark");
	});
});
