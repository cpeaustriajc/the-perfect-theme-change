/**
 * theme-polyfill — server half of the `Sec-CH-Prefers-Color-Scheme` polyfill.
 *
 * Chromium sends the native client hint; WebKit and Gecko do not. A page
 * cannot send it for them: `Sec-` is a forbidden request-header prefix in the
 * Fetch standard, so no page script or service worker can set it. The polyfill
 * therefore has two halves:
 *
 *   1. Client: the inline script from `theme-script.ts` mirrors the OS
 *      preference into the hint cookie.
 *   2. Server: this function copies that cookie into a fresh `Headers` as
 *      `sec-ch-prefers-color-scheme`, before anything reads the request.
 *
 * After that, the rest of the module reads one source for the OS preference:
 * the header. This is the only server code that knows about the hint cookie.
 *
 * When WebKit and Gecko ship the native hint, delete this file and the inline
 * script. Nothing in `theme-core.ts` changes.
 */

import {
	DEFAULT_COOKIE_NAMES,
	isTheme,
	type PlainHeaders,
	parseCookieHeader,
	type ThemeCookieNames,
} from "./theme-core.js";

const HINT_HEADER = "sec-ch-prefers-color-scheme";

/** Copy `headers` into a new `Headers`, without touching the input. */
function toHeaders(
	headers: Headers | PlainHeaders | null | undefined,
): Headers {
	if (!headers) return new Headers();

	if (typeof (headers as Headers).get === "function") {
		return new Headers(headers as Headers);
	}

	const out = new Headers();
	const seen = new Set<string>();
	for (const [key, raw] of Object.entries(headers as PlainHeaders)) {
		// Arrays keep their first value, and the first of two keys that differ
		// only in case wins, even when its value is undefined — the same lookup
		// `readTheme` has always used.
		const lower = key.toLowerCase();
		if (seen.has(lower)) continue;
		seen.add(lower);
		const value = Array.isArray(raw) ? raw[0] : raw;
		if (value === undefined) continue;
		try {
			out.set(key, value);
		} catch {
			// A name or value `Headers` rejects cannot be read by name either;
			// drop it, as the cookie parser drops a corrupt segment.
		}
	}
	return out;
}

/**
 * Return a new `Headers` in which `sec-ch-prefers-color-scheme` holds the OS
 * preference, taken from the hint cookie when the browser did not send it.
 *
 * A valid native header (`light` / `dark`) always wins, because the cookie can
 * be stale during a session. The header is set from the cookie only when it is
 * missing or invalid, and only when the cookie itself is valid.
 */
export function polyfillColorSchemeHint(
	headers: Headers | PlainHeaders | null | undefined,
	opts?: { cookieNames?: Partial<ThemeCookieNames> },
): Headers {
	const out = toHeaders(headers);
	if (isTheme(out.get(HINT_HEADER))) return out;

	const name = opts?.cookieNames?.hint ?? DEFAULT_COOKIE_NAMES.hint;
	const cookieHint = parseCookieHeader(out.get("cookie"))[name];
	if (isTheme(cookieHint)) out.set(HINT_HEADER, cookieHint);

	return out;
}
