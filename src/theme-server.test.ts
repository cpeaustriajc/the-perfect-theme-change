import { describe, expect, it } from "vitest";
import { acceptCHHeaders, readTheme } from "./theme-server.js";

describe("readTheme with a Headers object", () => {
	it("reads explicit cookie", () => {
		const h = new Headers({ cookie: "theme=dark" });
		expect(readTheme(h)).toEqual({
			explicit: "dark",
			hint: null,
			mode: "dark",
			resolved: "dark",
		});
	});

	it("reads native header as hint in system mode", () => {
		const h = new Headers({ "sec-ch-prefers-color-scheme": "dark" });
		expect(readTheme(h)).toEqual({
			explicit: null,
			hint: "dark",
			mode: "system",
			resolved: "dark",
		});
	});

	it("native header outranks cookie hint", () => {
		const h = new Headers({
			cookie: "ch-prefers-color-scheme=light",
			"sec-ch-prefers-color-scheme": "dark",
		});
		expect(readTheme(h)).toEqual({
			explicit: null,
			hint: "dark",
			mode: "system",
			resolved: "dark",
		});
	});

	it("explicit cookie outranks everything", () => {
		const h = new Headers({
			cookie: "theme=light; ch-prefers-color-scheme=dark",
			"sec-ch-prefers-color-scheme": "dark",
		});
		expect(readTheme(h)).toEqual({
			explicit: "light",
			hint: "dark",
			mode: "light",
			resolved: "light",
		});
	});

	it("returns unknown when nothing is present", () => {
		expect(readTheme(new Headers())).toEqual({
			explicit: null,
			hint: null,
			mode: "system",
			resolved: "unknown",
		});
	});
});

describe("readTheme with a plain record", () => {
	it("is case-insensitive on header names", () => {
		expect(
			readTheme({
				Cookie: "theme=dark",
				"Sec-CH-Prefers-Color-Scheme": "light",
			}),
		).toEqual({
			explicit: "dark",
			hint: "light",
			mode: "dark",
			resolved: "dark",
		});
	});

	it("handles string[] header values", () => {
		expect(readTheme({ cookie: ["theme=dark", "other=1"] })).toEqual({
			explicit: "dark",
			hint: null,
			mode: "dark",
			resolved: "dark",
		});
	});

	it("native header from a plain record outranks the cookie hint", () => {
		expect(
			readTheme({
				cookie: "ch-prefers-color-scheme=light",
				"sec-ch-prefers-color-scheme": "dark",
			}),
		).toEqual({
			explicit: null,
			hint: "dark",
			mode: "system",
			resolved: "dark",
		});
	});

	it("reads a theme cookie from any entry of a string[] cookie", () => {
		expect(readTheme({ cookie: ["other=1", "theme=dark"] })).toEqual({
			explicit: "dark",
			hint: null,
			mode: "dark",
			resolved: "dark",
		});
	});

	it("reads Node HTTP/2 headers, which include pseudo-headers", () => {
		expect(
			readTheme({
				":method": "GET",
				":path": "/",
				":authority": "example.test",
				":scheme": "https",
				cookie: "ch-prefers-color-scheme=dark",
			}),
		).toEqual({
			explicit: null,
			hint: "dark",
			mode: "system",
			resolved: "dark",
		});
	});

	it("returns unknown for undefined/null headers", () => {
		const expected = {
			explicit: null,
			hint: null,
			mode: "system",
			resolved: "unknown",
		};
		expect(readTheme(undefined)).toEqual(expected);
		expect(readTheme(null)).toEqual(expected);
	});
});

describe("readTheme with custom cookie names", () => {
	it("reads the configured cookie names", () => {
		expect(
			readTheme(
				{ cookie: "mode=dark; scheme=light" },
				{ cookieNames: { explicit: "mode", hint: "scheme" } },
			),
		).toEqual({
			explicit: "dark",
			hint: "light",
			mode: "dark",
			resolved: "dark",
		});
	});

	it("supports a partial override (only explicit)", () => {
		expect(
			readTheme(
				{ cookie: "mode=light; ch-prefers-color-scheme=dark" },
				{ cookieNames: { explicit: "mode" } },
			),
		).toEqual({
			explicit: "light",
			hint: "dark",
			mode: "light",
			resolved: "light",
		});
	});
});

describe("acceptCHHeaders", () => {
	it("asks for the scheme hint and varies on every input of readTheme", () => {
		expect(acceptCHHeaders()).toEqual({
			"Accept-CH": "Sec-CH-Prefers-Color-Scheme",
			"Critical-CH": "Sec-CH-Prefers-Color-Scheme",
			Vary: "Sec-CH-Prefers-Color-Scheme, Cookie",
		});
	});

	it("gives a distinct cache key to requests that resolve differently", () => {
		const varyNames = acceptCHHeaders()
			.Vary.split(",")
			.map((name) => name.trim().toLowerCase());
		const cacheKey = (headers: Record<string, string>) =>
			varyNames.map((name) => headers[name] ?? "").join("\n");
		const requests: Record<string, string>[] = [
			{},
			{ cookie: "theme=dark" },
			{ cookie: "ch-prefers-color-scheme=light" },
			{ "sec-ch-prefers-color-scheme": "light" },
			{ cookie: "theme=dark", "sec-ch-prefers-color-scheme": "light" },
		];
		const resolvedByKey = new Map<string, string>();
		for (const headers of requests) {
			const key = cacheKey(headers);
			const { resolved } = readTheme(headers);
			expect(resolvedByKey.get(key) ?? resolved).toBe(resolved);
			resolvedByKey.set(key, resolved);
		}
	});
});
