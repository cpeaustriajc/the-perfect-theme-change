/**
 * theme-client — browser-side helpers.
 *
 * Every export is safe to import in an SSR bundle: each guards on
 * `typeof document === "undefined"` (and `window`) so importing or calling
 * them during server rendering is a no-op rather than a crash.
 *
 * Post-hydration DOM mutation here is safe: the server owns the `<html>` class
 * on the NEXT request (from the explicit cookie we write), so the optimistic
 * class swap below never fights hydration.
 */

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
	// biome-ignore lint/suspicious/noDocumentCookie: deliberate — Cookie Store API is async and unsupported in Safari; a synchronous zero-dependency document.cookie write is the whole point of this module.
	document.cookie = `${name}=${value}; path=${path}; max-age=${maxAge}; samesite=lax`;
}

/**
 * Apply `mode` to the `<html>` class list.
 *
 * For "system" this must apply the RESOLVED class (the OS scheme's theme),
 * not strip both classes: the server ladder renders the resolved hint class
 * even in system mode, so the optimistic swap here must equal the next
 * server-rendered class. If it doesn't, React's className prop-diffing can
 * see no change (e.g. explicit "dark" → system-with-dark-OS both render
 * "dark") and never rewrite the attribute, leaving the real DOM diverged
 * from React's virtual tree.
 */
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

/**
 * Set the user's explicit theme choice.
 *
 * Writes the explicit cookie for `"light"`/`"dark"`, deletes it for
 * `"system"`, and optimistically swaps the class on `<html>`. For "system"
 * the swap applies the resolved OS-scheme class (see `applyClass`) so it
 * matches the next server render exactly. With `viewTransition: true` the
 * swap is wrapped in `document.startViewTransition` when available and the
 * user has not requested reduced motion.
 */
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
		// Delete the explicit cookie so the server falls back to system mode.
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
		const transition = document.startViewTransition(swap);
		// An aborted/skipped transition (DOM churn during capture, a rapid
		// second transition) rejects `ready`/`finished`; the class swap still
		// applies, so these rejections must not surface as unhandled errors.
		transition.ready.catch(() => {});
		transition.finished.catch(() => {});
		transition.updateCallbackDone.catch(() => {});
	} else {
		swap();
	}
}

/**
 * Subscribe to OS colour-scheme changes.
 *
 * On each change it FIRST refreshes the hint cookie to the new value (so the
 * next server render is correct), THEN invokes the callback. Returns an
 * unsubscribe function. No-op (returns a noop) during SSR.
 */
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
