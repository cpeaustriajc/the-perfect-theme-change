/**
 * theme-script — client half of the `Sec-CH-Prefers-Color-Scheme` polyfill.
 *
 * Generates the tiny inline `<head>` script that captures the OS colour-scheme
 * preference into the hint cookie. A page cannot send the `Sec-` header itself
 * (Fetch forbids that prefix), so on the server `polyfillColorSchemeHint`
 * (theme-polyfill.ts) copies this cookie into the header. Chromium sends the
 * header natively, and a valid native header wins over the cookie.
 *
 * When WebKit and Gecko ship the native hint, delete this file together with
 * theme-polyfill.ts.
 *
 * THE HYDRATION-SAFETY INVARIANT: the generated script NEVER touches the DOM.
 * It only reads `matchMedia` and reads/writes `document.cookie`. Because it
 * never mutates `documentElement` (no class, no attribute, no style), the
 * server-rendered tree, the DOM, and the client-rendered tree stay identical,
 * so there is no hydration mismatch and no `suppressHydrationWarning`.
 */

export interface ClientHintCheckOptions {
	/** Name of the client-hint cookie. Default `"ch-prefers-color-scheme"`. */
	hintCookieName?: string;
	/**
	 * What to do on the first visit when the hint cookie is missing/stale.
	 *
	 * - `"css"` (default): only write the cookie; never reload. Relies on CSS
	 *   whose dark tokens activate under `@media (prefers-color-scheme: dark)`
	 *   when no theme class is present — correct first paint, zero reload.
	 * - `"reload"`: write the cookie then reload once (guarded) so the server
	 *   knows the resolved theme on the next, pre-paint render.
	 */
	firstVisit?: "css" | "reload";
	/** Cookie max-age in seconds. Default one year. */
	cookieMaxAge?: number;
	/** Cookie path. Default `"/"`. */
	cookiePath?: string;
}

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Build the self-executing inline-script string for the document `<head>`.
 *
 * All configurable values are injected via `JSON.stringify`, so a cookie name
 * containing quotes cannot break out of the string or inject code.
 */
export function getClientHintCheckScript(
	opts: ClientHintCheckOptions = {},
): string {
	const hintCookieName = opts.hintCookieName ?? "ch-prefers-color-scheme";
	const firstVisit = opts.firstVisit ?? "css";
	const cookieMaxAge = opts.cookieMaxAge ?? ONE_YEAR_SECONDS;
	const cookiePath = opts.cookiePath ?? "/";

	// Serialized literals — never string-concatenated raw into the source.
	const NAME = JSON.stringify(hintCookieName);
	const PATH = JSON.stringify(cookiePath);
	const MAX_AGE = JSON.stringify(cookieMaxAge);
	const FLAG = JSON.stringify(`tptc:reloaded:${hintCookieName}`);

	// The reload block is only emitted in "reload" mode, so "css" output
	// provably contains no `location.reload`.
	const reloadBlock =
		firstVisit === "reload"
			? `
			if (stale) {
				var readback = read(name);
				if (readback === actual) {
					var already = false;
					try { already = window.sessionStorage.getItem(flag) === "1"; } catch (e) {}
					if (!already) {
						try { window.sessionStorage.setItem(flag, "1"); } catch (e) {}
						window.location.reload();
					}
				}
			} else {
				try { window.sessionStorage.removeItem(flag); } catch (e) {}
			}`
			: "";

	return `(function () {
	try {
		var name = ${NAME};
		var path = ${PATH};
		var maxAge = ${MAX_AGE};
		var flag = ${FLAG};
		function read(n) {
			var parts = document.cookie ? document.cookie.split(";") : [];
			for (var i = 0; i < parts.length; i++) {
				var p = parts[i];
				var eq = p.indexOf("=");
				if (eq === -1) continue;
				var k = p.slice(0, eq).trim();
				if (k === n) return p.slice(eq + 1).trim();
			}
			return null;
		}
		var actual = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
		var current = read(name);
		var stale = current !== actual;
		if (stale) {
			document.cookie = name + "=" + actual + "; path=" + path + "; max-age=" + maxAge + "; samesite=lax";
		}${reloadBlock}
	} catch (e) {}
})();`;
}
