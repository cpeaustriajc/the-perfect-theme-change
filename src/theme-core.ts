export type Theme = "light" | "dark";

export type ThemeMode = Theme | "system";

export type ResolvedServerTheme = Theme | "unknown";

export interface ThemeCookieNames {
	explicit: string;
	hint: string;
}

export type PlainHeaders = Record<string, string | string[] | undefined>;

export const DEFAULT_COOKIE_NAMES: ThemeCookieNames = {
	explicit: "theme",
	hint: "ch-prefers-color-scheme",
};

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

		let value = part.slice(eq + 1).trim();

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

export function isTheme(v: unknown): v is Theme {
	return v === "light" || v === "dark";
}

export function resolveTheme(input: {
	explicit: string | null | undefined;
	hint: string | null | undefined;
}): { mode: ThemeMode; resolved: ResolvedServerTheme } {
	const explicit = isTheme(input.explicit) ? input.explicit : null;
	if (explicit) {
		return { mode: explicit, resolved: explicit };
	}

	const hint = isTheme(input.hint) ? input.hint : null;
	if (hint) {
		return { mode: "system", resolved: hint };
	}

	return { mode: "system", resolved: "unknown" };
}
