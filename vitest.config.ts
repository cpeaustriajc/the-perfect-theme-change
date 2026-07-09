import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// Node environment (no jsdom): theme-client tests assert the SSR guards.
		environment: "node",
		include: ["src/**/*.test.ts"],
	},
});
