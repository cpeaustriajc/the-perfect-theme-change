/**
 * theme-server — read the resolved theme from an incoming request's headers.
 *
 * Accepts either a WHATWG `Headers` object or a Node-style plain headers
 * record, so it works from TanStack Start / Remix / React Router (`Headers`)
 * and from Next.js / raw Node (`IncomingHttpHeaders`) alike.
 */

import {
	DEFAULT_COOKIE_NAMES,
	isTheme,
	parseCookieHeader,
	type ResolvedServerTheme,
	resolveTheme,
	type Theme,
	type ThemeCookieNames,
	type ThemeMode,
} from "./theme-core.js";

export interface ThemeInfo {
	/** Explicit user choice, or `null` when in system mode. */
	explicit: Theme | null;
	/** The OS preference known to the server (native header or cookie), or `null`. */
	hint: Theme | null;
	/** `"light"` / `"dark"` when explicit is set, otherwise `"system"`. */
	mode: ThemeMode;
	/** The theme to render on `<html>`; `"unknown"` → render no class. */
	resolved: ResolvedServerTheme;
}

type PlainHeaders = Record<string, string | string[] | undefined>;

/** Case-insensitive single-value lookup across `Headers` or a plain record. */
function getHeader(
	headers: Headers | PlainHeaders | null | undefined,
	name: string,
): string | null {
	if (!headers) return null;

	if (typeof (headers as Headers).get === "function") {
		return (headers as Headers).get(name);
	}

	const record = headers as PlainHeaders;
	const lower = name.toLowerCase();
	for (const key of Object.keys(record)) {
		if (key.toLowerCase() === lower) {
			const value = record[key];
			if (Array.isArray(value)) return value[0] ?? null;
			return value ?? null;
		}
	}
	return null;
}

/**
 * Resolve the theme for a request.
 *
 * Reads the `cookie` header (explicit + hint cookies) and the native
 * `sec-ch-prefers-color-scheme` header, then applies the ladder: explicit
 * cookie beats the native header, which beats the cookie hint.
 */
export function readTheme(
	headers: Headers | PlainHeaders | null | undefined,
	opts?: { cookieNames?: Partial<ThemeCookieNames> },
): ThemeInfo {
	const names: ThemeCookieNames = {
		...DEFAULT_COOKIE_NAMES,
		...opts?.cookieNames,
	};

	const cookies = parseCookieHeader(getHeader(headers, "cookie"));
	const explicitRaw = cookies[names.explicit];
	const cookieHintRaw = cookies[names.hint];
	const nativeRaw = getHeader(headers, "sec-ch-prefers-color-scheme");

	const { mode, resolved } = resolveTheme({
		explicit: explicitRaw,
		nativeHint: nativeRaw,
		cookieHint: cookieHintRaw,
	});

	const explicit = isTheme(explicitRaw) ? explicitRaw : null;
	const hint = isTheme(nativeRaw)
		? nativeRaw
		: isTheme(cookieHintRaw)
			? cookieHintRaw
			: null;

	return { explicit, hint, mode, resolved };
}

/**
 * Header values that opt into the native `Sec-CH-Prefers-Color-Scheme` client
 * hint. Sending these lets Chromium (93+) do a browser-level pre-paint retry
 * on the first request so the scheme arrives server-side without any reload.
 */
export function acceptCHHeaders(): {
	"Accept-CH": string;
	"Critical-CH": string;
	Vary: string;
} {
	const value = "Sec-CH-Prefers-Color-Scheme";
	return {
		"Accept-CH": value,
		"Critical-CH": value,
		Vary: value,
	};
}
