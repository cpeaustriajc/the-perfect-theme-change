import { describe, expect, it } from "vitest";
import {
	DEFAULT_COOKIE_NAMES,
	isTheme,
	parseCookieHeader,
	resolveTheme,
} from "./theme-core.js";

describe("parseCookieHeader", () => {
	it("returns {} for null/undefined/empty", () => {
		expect(parseCookieHeader(null)).toEqual({});
		expect(parseCookieHeader(undefined)).toEqual({});
		expect(parseCookieHeader("")).toEqual({});
	});

	it("parses a single cookie", () => {
		expect(parseCookieHeader("theme=dark")).toEqual({ theme: "dark" });
	});

	it("parses multiple cookies with whitespace", () => {
		expect(
			parseCookieHeader("theme=dark; ch-prefers-color-scheme=light"),
		).toEqual({ theme: "dark", "ch-prefers-color-scheme": "light" });
	});

	it("keeps '=' inside values", () => {
		expect(parseCookieHeader("token=a=b=c; theme=light")).toEqual({
			token: "a=b=c",
			theme: "light",
		});
	});

	it("URI-decodes values", () => {
		expect(parseCookieHeader("name=hello%20world")).toEqual({
			name: "hello world",
		});
	});

	it("falls back to raw value when decoding throws", () => {
		expect(parseCookieHeader("bad=%E0%A4%A")).toEqual({ bad: "%E0%A4%A" });
	});

	it("strips surrounding double quotes", () => {
		expect(parseCookieHeader('theme="dark"')).toEqual({ theme: "dark" });
	});

	it("ignores segments without '=' and empty names", () => {
		expect(parseCookieHeader("; =nokey; theme=dark; junk")).toEqual({
			theme: "dark",
		});
	});
});

describe("isTheme", () => {
	it("accepts light and dark", () => {
		expect(isTheme("light")).toBe(true);
		expect(isTheme("dark")).toBe(true);
	});

	it("rejects everything else", () => {
		for (const v of ["system", "", null, undefined, 0, {}, "Dark"]) {
			expect(isTheme(v)).toBe(false);
		}
	});
});

describe("resolveTheme ladder", () => {
	it("explicit beats native and cookie hint", () => {
		expect(
			resolveTheme({
				explicit: "light",
				nativeHint: "dark",
				cookieHint: "dark",
			}),
		).toEqual({ mode: "light", resolved: "light" });
	});

	it("native hint beats cookie hint when explicit absent", () => {
		expect(
			resolveTheme({
				explicit: null,
				nativeHint: "dark",
				cookieHint: "light",
			}),
		).toEqual({ mode: "system", resolved: "dark" });
	});

	it("cookie hint used when explicit + native absent", () => {
		expect(
			resolveTheme({
				explicit: undefined,
				nativeHint: undefined,
				cookieHint: "dark",
			}),
		).toEqual({ mode: "system", resolved: "dark" });
	});

	it("invalid explicit falls through to hints", () => {
		expect(
			resolveTheme({
				explicit: "purple",
				nativeHint: "dark",
				cookieHint: null,
			}),
		).toEqual({ mode: "system", resolved: "dark" });
	});

	it("invalid native falls through to cookie hint", () => {
		expect(
			resolveTheme({
				explicit: null,
				nativeHint: "no-preference",
				cookieHint: "light",
			}),
		).toEqual({ mode: "system", resolved: "light" });
	});

	it("all absent -> unknown / system", () => {
		expect(
			resolveTheme({ explicit: null, nativeHint: null, cookieHint: null }),
		).toEqual({ mode: "system", resolved: "unknown" });
	});

	it("all invalid -> unknown / system", () => {
		expect(
			resolveTheme({
				explicit: "x",
				nativeHint: "y",
				cookieHint: "z",
			}),
		).toEqual({ mode: "system", resolved: "unknown" });
	});
});

describe("DEFAULT_COOKIE_NAMES", () => {
	it("has the documented defaults", () => {
		expect(DEFAULT_COOKIE_NAMES).toEqual({
			explicit: "theme",
			hint: "ch-prefers-color-scheme",
		});
	});
});
