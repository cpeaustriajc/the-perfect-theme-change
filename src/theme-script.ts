export interface ClientHintCheckOptions {
	hintCookieName?: string;
	firstVisit?: "css" | "reload";
	cookieMaxAge?: number;
	cookiePath?: string;
}

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function getClientHintCheckScript(
	opts: ClientHintCheckOptions = {},
): string {
	const hintCookieName = opts.hintCookieName ?? "ch-prefers-color-scheme";
	const firstVisit = opts.firstVisit ?? "css";
	const cookieMaxAge = opts.cookieMaxAge ?? ONE_YEAR_SECONDS;
	const cookiePath = opts.cookiePath ?? "/";

	const NAME = JSON.stringify(hintCookieName);
	const PATH = JSON.stringify(cookiePath);
	const MAX_AGE = JSON.stringify(cookieMaxAge);
	const FLAG = JSON.stringify(`tptc:reloaded:${hintCookieName}`);

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
