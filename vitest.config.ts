import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import type { BrowserCommand } from "vitest/node";
import type { EmulatedMedia } from "./src/browser-commands.js";

const emulateMedia: BrowserCommand<[EmulatedMedia]> = async (ctx, media) => {
	await ctx.page.emulateMedia(media);
};

export default defineConfig({
	test: {
		projects: [
			{
				test: {
					name: "node",
					environment: "node",
					include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
					exclude: ["src/**/*.browser.test.ts"],
				},
			},
			{
				test: {
					name: "browser",
					include: ["src/**/*.browser.test.ts"],
					browser: {
						enabled: true,
						headless: true,
						provider: playwright(),
						commands: { emulateMedia },
						instances: [{ browser: "chromium" }, { browser: "webkit" }],
					},
				},
			},
		],
	},
});
