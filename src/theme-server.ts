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
	explicit: Theme | null;
	hint: Theme | null;
	mode: ThemeMode;
	resolved: ResolvedServerTheme;
}

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

export function acceptCHHeaders(): {
	"Accept-CH": string;
	"Critical-CH": string;
	Vary: string;
} {
	const hint = "Sec-CH-Prefers-Color-Scheme";
	return {
		"Accept-CH": hint,
		"Critical-CH": hint,
		Vary: `${hint}, Cookie`,
	};
}
