import { beforeEach, expect, it } from "vitest";
import { commands } from "vitest/browser";
import "./browser-commands.js";
import { polyfillColorSchemeHint } from "./theme-polyfill.js";
import { getClientHintCheckScript } from "./theme-script.js";

beforeEach(async () => {
	for (const cookie of await cookieStore.getAll()) {
		if (cookie.name) await cookieStore.delete(cookie.name);
	}
});

for (const scheme of ["light", "dark"] as const) {
	it(`carries an OS ${scheme} preference from the inline script to the header`, async () => {
		await commands.emulateMedia({ colorScheme: scheme });

		new Function(getClientHintCheckScript())();
		const headers = polyfillColorSchemeHint({ cookie: document.cookie });

		expect(headers.get("sec-ch-prefers-color-scheme")).toBe(scheme);
	});
}
