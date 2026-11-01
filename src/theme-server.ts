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
	type PlainHeaders,
	parseCookieHeader,
	type ResolvedServerTheme,
	resolveTheme,
	type Theme,
	type ThemeCookieNames,
	type ThemeMode,
} from "./theme-core.js";
import { polyfillColorSchemeHint } from "./theme-polyfill.js";

export interface ThemeInfo {
	/** Explicit user choice, or `null` when in system mode. */
	explicit: Theme | null;
	/** The OS preference from the (polyfilled) header, or `null`. */
	hint: Theme | null;
	/** `"light"` / `"dark"` when explicit is set, otherwise `"system"`. */
	mode: ThemeMode;
	/** The theme to render on `<html>`; `"unknown"` → render no class. */
	resolved: ResolvedServerTheme;
}

/**
 * Resolve the theme for a request.
 *
 * Runs `polyfillColorSchemeHint` first, so the `sec-ch-prefers-color-scheme`
 * header holds the OS preference in every browser. Then it reads only the
 * explicit cookie and that header, and applies the ladder: explicit cookie
 * beats the header.
 */
export function readTheme(
	headers: Headers | PlainHeaders | null | undefined,
	opts?: { cookieNames?: Partial<ThemeCookieNames> },
): ThemeInfo {
	const names: ThemeCookieNames = {
		...DEFAULT_COOKIE_NAMES,
		...opts?.cookieNames,
	};

	const polyfilled = polyfillColorSchemeHint(headers, opts);
	const explicitRaw = parseCookieHeader(polyfilled.get("cookie"))[
		names.explicit
	];
	const hintRaw = polyfilled.get("sec-ch-prefers-color-scheme");

	const { mode, resolved } = resolveTheme({
		explicit: explicitRaw,
		hint: hintRaw,
	});

	const explicit = isTheme(explicitRaw) ? explicitRaw : null;
	const hint = isTheme(hintRaw) ? hintRaw : null;

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
