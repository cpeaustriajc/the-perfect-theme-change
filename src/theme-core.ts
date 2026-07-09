/**
 * theme-core — pure logic with no browser or server APIs.
 *
 * Everything here is a plain function over plain data, so it is fully
 * unit-testable and shared by both the server and client entry points.
 */

/** A concrete, resolved theme. */
export type Theme = "light" | "dark";

/** The user-selectable mode. `"system"` follows the OS preference. */
export type ThemeMode = Theme | "system";

/**
 * The theme the server decides to render.
 *
 * `"unknown"` means the server has no basis to pick a theme yet (first visit,
 * no cookies, no native hint) — the caller renders NO class and lets CSS
 * handle the first paint via `@media (prefers-color-scheme: dark)`.
 */
export type ResolvedServerTheme = Theme | "unknown";

/** The two cookie names this module reads and writes. */
export interface ThemeCookieNames {
	/** Explicit user choice ("light" | "dark"); absent means "system". */
	explicit: string;
	/** Client-hint mirror of the OS `prefers-color-scheme`. */
	hint: string;
}

export const DEFAULT_COOKIE_NAMES: ThemeCookieNames = {
	explicit: "theme",
	hint: "ch-prefers-color-scheme",
};

/**
 * Parse a `Cookie` header into a name→value map.
 *
 * Robust by design: tolerates null/empty input, surrounding whitespace,
 * `=` characters inside values, and percent-encoding (decoded when possible,
 * falling back to the raw value if decoding throws).
 */
export function parseCookieHeader(
	header: string | null | undefined,
): Record<string, string> {
	const out: Record<string, string> = {};
	if (!header) return out;

	for (const part of header.split(";")) {
		const eq = part.indexOf("=");
		if (eq === -1) continue;

		const name = part.slice(0, eq).trim();
		if (!name) continue;

		// Keep everything after the first "=" so values may contain "=".
		let value = part.slice(eq + 1).trim();

		// Cookie values are frequently wrapped in double quotes.
		if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
			value = value.slice(1, -1);
		}

		try {
			out[name] = decodeURIComponent(value);
		} catch {
			out[name] = value;
		}
	}

	return out;
}

/** Type guard: is `v` one of the concrete themes? */
export function isTheme(v: unknown): v is Theme {
	return v === "light" || v === "dark";
}

/**
 * Resolve the theme from the server-side inputs, applying the ladder:
 *
 *   explicit user-choice cookie
 *     > native Sec-CH-Prefers-Color-Scheme header
 *     > client-hint cookie
 *     > "unknown"
 *
 * Any value that is not a valid `Theme` is treated as absent, so a corrupt
 * cookie simply falls through to the next rung.
 */
export function resolveTheme(input: {
	explicit: string | null | undefined;
	nativeHint: string | null | undefined;
	cookieHint: string | null | undefined;
}): { mode: ThemeMode; resolved: ResolvedServerTheme } {
	const explicit = isTheme(input.explicit) ? input.explicit : null;
	if (explicit) {
		return { mode: explicit, resolved: explicit };
	}

	const nativeHint = isTheme(input.nativeHint) ? input.nativeHint : null;
	if (nativeHint) {
		return { mode: "system", resolved: nativeHint };
	}

	const cookieHint = isTheme(input.cookieHint) ? input.cookieHint : null;
	if (cookieHint) {
		return { mode: "system", resolved: cookieHint };
	}

	return { mode: "system", resolved: "unknown" };
}
