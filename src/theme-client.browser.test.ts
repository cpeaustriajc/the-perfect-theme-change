import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { commands } from "vitest/browser";
import "./browser-commands.js";
import { setTheme, subscribeToSystemSchemeChange } from "./theme-client.js";

const root = document.documentElement;

async function clearCookies(): Promise<void> {
	for (const cookie of await cookieStore.getAll()) {
		if (cookie.name) await cookieStore.delete(cookie.name);
	}
}

async function cookieValue(name: string): Promise<string | null> {
	return (await cookieStore.get(name))?.value ?? null;
}

function collectUnhandledRejections(): { reasons: unknown[]; stop(): void } {
	const reasons: unknown[] = [];
	const onRejection = (event: PromiseRejectionEvent) => {
		reasons.push(event.reason);
		event.preventDefault();
	};
	window.addEventListener("unhandledrejection", onRejection);
	return {
		reasons,
		stop: () => window.removeEventListener("unhandledrejection", onRejection),
	};
}

function settle(ms = 500): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

beforeEach(async () => {
	await commands.emulateMedia({
		colorScheme: "light",
		reducedMotion: "no-preference",
	});
	await clearCookies();
	root.className = "";
});

afterEach(clearCookies);

describe("setTheme", () => {
	it("writes the explicit cookie and the class for light and dark", async () => {
		setTheme("dark");
		expect(await cookieValue("theme")).toBe("dark");
		expect([...root.classList]).toEqual(["dark"]);

		setTheme("light");
		expect(await cookieValue("theme")).toBe("light");
		expect([...root.classList]).toEqual(["light"]);
	});

	it("deletes the explicit cookie and applies the OS theme for system", async () => {
		setTheme("light");
		await commands.emulateMedia({ colorScheme: "dark" });

		setTheme("system");

		expect(await cookieValue("theme")).toBeNull();
		expect([...root.classList]).toEqual(["dark"]);
	});

	it("applies the class inside a view transition", async () => {
		expect(typeof document.startViewTransition).toBe("function");

		setTheme("dark", { viewTransition: true });
		await settle();

		expect([...root.classList]).toEqual(["dark"]);
	});

	it("leaves no unhandled rejection when a second switch skips the first transition", async () => {
		const rejections = collectUnhandledRejections();

		setTheme("dark", { viewTransition: true });
		setTheme("light", { viewTransition: true });
		await settle();
		rejections.stop();

		expect(rejections.reasons).toEqual([]);
		expect([...root.classList]).toEqual(["light"]);
	});

	it("applies the class at once when the user prefers reduced motion", async () => {
		await commands.emulateMedia({ reducedMotion: "reduce" });

		setTheme("dark", { viewTransition: true });

		expect([...root.classList]).toEqual(["dark"]);
	});
});

describe("subscribeToSystemSchemeChange", () => {
	it("refreshes the hint cookie before it calls back", async () => {
		const seen: { theme: string; cookie: string | null }[] = [];
		const unsubscribe = subscribeToSystemSchemeChange((theme) => {
			const match = document.cookie.match(/ch-prefers-color-scheme=(\w+)/);
			seen.push({ theme, cookie: match?.[1] ?? null });
		});

		await commands.emulateMedia({ colorScheme: "dark" });
		await settle(100);
		unsubscribe();
		await commands.emulateMedia({ colorScheme: "light" });
		await settle(100);

		expect(seen).toEqual([{ theme: "dark", cookie: "dark" }]);
	});
});
