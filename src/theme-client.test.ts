import { describe, expect, it } from "vitest";
import { setTheme, subscribeToSystemSchemeChange } from "./theme-client.js";

// Runs in the vitest "node" environment: there is no `document`/`window`, so
// these assert the SSR guards make every export a safe no-op.

describe("theme-client SSR guards (node env, no DOM)", () => {
	it("document is undefined in this environment", () => {
		expect(typeof document).toBe("undefined");
	});

	it("setTheme does not throw for any mode", () => {
		expect(() => setTheme("light")).not.toThrow();
		expect(() => setTheme("dark")).not.toThrow();
		expect(() => setTheme("system")).not.toThrow();
	});

	it("setTheme does not throw with options", () => {
		expect(() =>
			setTheme("dark", {
				cookieNames: { explicit: "mode" },
				viewTransition: true,
				cookieMaxAge: 100,
				cookiePath: "/app",
			}),
		).not.toThrow();
	});

	it("setTheme does not throw for system mode with viewTransition (SSR no-op guard only — this env has no document.startViewTransition/matchMedia to exercise the resolved-class or abort-catch paths)", () => {
		expect(() => setTheme("system", { viewTransition: true })).not.toThrow();
	});

	it("subscribeToSystemSchemeChange returns a callable noop", () => {
		const unsub = subscribeToSystemSchemeChange(() => {});
		expect(typeof unsub).toBe("function");
		expect(() => unsub()).not.toThrow();
	});
});
