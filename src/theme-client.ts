import {
	DEFAULT_COOKIE_NAMES,
	type Theme,
	type ThemeCookieNames,
	type ThemeMode,
} from "./theme-core.js";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function resolveNames(partial?: Partial<ThemeCookieNames>): ThemeCookieNames {
	return { ...DEFAULT_COOKIE_NAMES, ...partial };
}

function writeCookie(
	name: string,
	value: string,
	maxAge: number,
	path: string,
): void {
	document.cookie = `${name}=${value}; path=${path}; max-age=${maxAge}; samesite=lax`;
}

function rethrowUnlessSkipped(reason: unknown): void {
	if (reason instanceof DOMException && reason.name === "AbortError") return;
	throw reason;
}

function applyClass(mode: ThemeMode): void {
	const root = document.documentElement;
	if (mode === "light") {
		root.classList.add("light");
		root.classList.remove("dark");
	} else if (mode === "dark") {
		root.classList.add("dark");
		root.classList.remove("light");
	} else if (
		typeof window !== "undefined" &&
		typeof window.matchMedia === "function"
	) {
		const resolved: Theme = window.matchMedia("(prefers-color-scheme: dark)")
			.matches
			? "dark"
			: "light";
		root.classList.add(resolved);
		root.classList.remove(resolved === "dark" ? "light" : "dark");
	} else {
		root.classList.remove("light");
		root.classList.remove("dark");
	}
}

export function setTheme(
	mode: ThemeMode,
	opts?: {
		cookieNames?: Partial<ThemeCookieNames>;
		viewTransition?: boolean;
		cookieMaxAge?: number;
		cookiePath?: string;
	},
): void {
	if (typeof document === "undefined") return;

	const names = resolveNames(opts?.cookieNames);
	const maxAge = opts?.cookieMaxAge ?? ONE_YEAR_SECONDS;
	const path = opts?.cookiePath ?? "/";

	if (mode === "light" || mode === "dark") {
		writeCookie(names.explicit, mode, maxAge, path);
	} else {
		writeCookie(names.explicit, "", 0, path);
	}

	const swap = () => applyClass(mode);

	const canViewTransition =
		opts?.viewTransition === true &&
		typeof document.startViewTransition === "function" &&
		!(
			typeof window !== "undefined" &&
			typeof window.matchMedia === "function" &&
			window.matchMedia("(prefers-reduced-motion: reduce)").matches
		);

	if (canViewTransition) {
		document.startViewTransition(swap).ready.catch(rethrowUnlessSkipped);
	} else {
		swap();
	}
}

export function subscribeToSystemSchemeChange(
	cb: (theme: Theme) => void,
	opts?: { cookieNames?: Partial<ThemeCookieNames> },
): () => void {
	if (
		typeof window === "undefined" ||
		typeof window.matchMedia !== "function"
	) {
		return () => {};
	}

	const names = resolveNames(opts?.cookieNames);
	const mql = window.matchMedia("(prefers-color-scheme: dark)");

	const handler = (event: MediaQueryListEvent) => {
		const theme: Theme = event.matches ? "dark" : "light";
		if (typeof document !== "undefined") {
			writeCookie(names.hint, theme, ONE_YEAR_SECONDS, "/");
		}
		cb(theme);
	};

	mql.addEventListener("change", handler);
	return () => mql.removeEventListener("change", handler);
}
