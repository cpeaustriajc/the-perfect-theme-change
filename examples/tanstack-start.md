# TanStack Start wiring

The server owns the `<html>` class; the inline script only maintains the hint
cookie. Nothing touches the DOM before hydration, so there is no mismatch and
no `suppressHydrationWarning`.

## Server function

```ts
// src/lib/theme.server.ts
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { readTheme } from "the-perfect-theme-change/theme-server";

export const getThemeInfo = createServerFn({ method: "GET" }).handler(() =>
	readTheme(getRequestHeaders()),
);
```

## Root route

```tsx
// src/routes/__root.tsx
import {
	createRootRoute,
	HeadContent,
	Outlet,
	Scripts,
	useMatch,
} from "@tanstack/react-router";
import { getClientHintCheckScript } from "the-perfect-theme-change/theme-script";
import { getThemeInfo } from "../lib/theme.server";

export const Route = createRootRoute({
	loader: () => getThemeInfo(),
	head: () => ({
		scripts: [
			// Client half of the Sec-CH-Prefers-Color-Scheme polyfill: runs before
			// paint, maintains the hint cookie, never touches the DOM.
			{ children: getClientHintCheckScript() },
		],
	}),
	shellComponent: RootDocument,
});

function RootDocument() {
	// useMatch with an explicit `from` selects this route's loader data by id,
	// which is why loader data is available here in the shell component.
	const { resolved } = useMatch({
		from: Route.id,
		select: (m) => m.loaderData!,
	});

	return (
		// "unknown" (first visit) -> render NO class; CSS handles first paint.
		<html className={resolved === "unknown" ? undefined : resolved}>
			<head>
				<HeadContent />
			</head>
			<body>
				<Outlet />
				<Scripts />
			</body>
		</html>
	);
}
```

## Optional native fast path

Return `acceptCHHeaders()` from your server (document response headers) so
Chromium delivers `Sec-CH-Prefers-Color-Scheme` on the first request. In
other browsers, `readTheme` fills that header from the hint cookie, so the
server code is the same either way.

## Theme switcher

```tsx
import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import {
	setTheme,
	subscribeToSystemSchemeChange,
} from "the-perfect-theme-change/theme-client";

function ThemeSwitcher() {
	const router = useRouter();

	// Keep the hint cookie fresh while in system mode, then re-render server-side.
	useEffect(
		() => subscribeToSystemSchemeChange(() => router.invalidate()),
		[router],
	);

	const choose = (mode: "light" | "dark" | "system") => {
		setTheme(mode, { viewTransition: true }); // optimistic swap now
		router.invalidate(); // re-run the loader so the server owns the class
	};

	return (
		<>
			<button onClick={() => choose("light")}>Light</button>
			<button onClick={() => choose("dark")}>Dark</button>
			<button onClick={() => choose("system")}>System</button>
		</>
	);
}
```
