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
			Cookie: ["ch-prefers-color-scheme=dark", "theme=light"],
			"X-Other": "1",
			"X-Missing": undefined,
		});
		expect(out.get(HEADER)).toBe("dark");
		// Arrays keep only their first value, as readTheme always did.
		expect(out.get("cookie")).toBe("ch-prefers-color-scheme=dark");
		expect(out.get("x-other")).toBe("1");
		expect(out.has("x-missing")).toBe(false);
	});

	it("keeps the first of two keys that differ only in case", () => {
		const out = polyfillColorSchemeHint({
			"Sec-CH-Prefers-Color-Scheme": "light",
			[HEADER]: "dark",
		});
		expect(out.get(HEADER)).toBe("light");
	});

	it("lets a first key with an undefined value hide a later one", () => {
		const out = polyfillColorSchemeHint({
			"Sec-CH-Prefers-Color-Scheme": undefined,
			[HEADER]: "dark",
		});
		expect(out.has(HEADER)).toBe(false);
	});

	it("drops a header name that Headers rejects", () => {
		const out = polyfillColorSchemeHint({
			"bad name": "x",
			cookie: "ch-prefers-color-scheme=dark",
		});
		expect(out.get(HEADER)).toBe("dark");
	});

	it("reads a custom hint cookie name", () => {
		const out = polyfillColorSchemeHint(
			{ cookie: "scheme=light; ch-prefers-color-scheme=dark" },
			{ cookieNames: { hint: "scheme" } },
		);
		expect(out.get(HEADER)).toBe("light");
	});

	it("returns Headers that accept a sec- name in this runtime", () => {
		// Fetch forbids `Sec-` request headers only for request-guarded Headers;
		// a bare `new Headers()` has no guard. Prove it, don't assume it.
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
