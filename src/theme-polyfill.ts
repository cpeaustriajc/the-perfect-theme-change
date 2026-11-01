import {
	DEFAULT_COOKIE_NAMES,
	isTheme,
	type PlainHeaders,
	parseCookieHeader,
	type ThemeCookieNames,
} from "./theme-core.js";

const HINT_HEADER = "sec-ch-prefers-color-scheme";

function isPseudoHeader(name: string): boolean {
	return name.startsWith(":");
}

function toHeaders(
	headers: Headers | PlainHeaders | null | undefined,
): Headers {
	if (!headers) return new Headers();

	if (typeof (headers as Headers).get === "function") {
		return new Headers(headers as Headers);
	}

	const out = new Headers();
	const cookies: string[] = [];
	for (const [name, value] of Object.entries(headers as PlainHeaders)) {
		if (value === undefined || isPseudoHeader(name)) continue;
		const values = Array.isArray(value) ? value : [value];
		if (name.toLowerCase() === "cookie") {
			cookies.push(...values);
		} else {
			for (const item of values) out.append(name, item);
		}
	}
	if (cookies.length > 0) out.set("cookie", cookies.join("; "));
	return out;
}

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
