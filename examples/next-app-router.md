# Next.js App Router wiring

## The honest trilemma

Reading `cookies()` / `headers()` in a Server Component opts the route into
**dynamic rendering**. For theming you can pick any two of these three:

1. **No flash** of the wrong theme.
2. **No `suppressHydrationWarning`** (server renders the real class).
3. **Fully static HTML** (no per-request rendering).

This module optimises for (1) + (2): the server reads the cookie and renders
the class, which forfeits (3) for that route. If you must keep (3), fall back
to the CSS-first classless first paint (drop the server class and let
`@media (prefers-color-scheme: dark)` drive the first paint) — you keep (1) and
(3) but the server no longer knows the theme on first paint.

## Layout

```tsx
// app/layout.tsx
import { cookies, headers } from "next/headers";
import { getClientHintCheckScript } from "the-perfect-theme-change/theme-script";
import { readTheme } from "the-perfect-theme-change/theme-server";

export default async function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	// Build a plain record readTheme understands from Next's async stores.
	// readTheme fills a missing header from the hint cookie (the polyfill).
	const cookieHeader = (await cookies()).toString();
	const nativeHint =
		(await headers()).get("sec-ch-prefers-color-scheme") ?? undefined;
	const { resolved } = readTheme({
		cookie: cookieHeader,
		"sec-ch-prefers-color-scheme": nativeHint,
	});

	return (
		<html className={resolved === "unknown" ? undefined : resolved}>
			<head>
				<script
					// Client half of the Sec-CH-Prefers-Color-Scheme polyfill: never
					// touches the DOM; only maintains the hint cookie.
					dangerouslySetInnerHTML={{ __html: getClientHintCheckScript() }}
				/>
			</head>
			<body>{children}</body>
		</html>
	);
}
```

## Native fast path

Advertise the client hint so Chromium sends it on the first request. Either via
middleware or `next.config` headers:

```ts
// middleware.ts
import { NextResponse } from "next/server";
import { acceptCHHeaders } from "the-perfect-theme-change/theme-server";

export function middleware() {
	const res = NextResponse.next();
	for (const [k, v] of Object.entries(acceptCHHeaders())) res.headers.set(k, v);
	return res;
}
```

## Switcher (client component)

```tsx
"use client";
import { useRouter } from "next/navigation";
import {
	setTheme,
	subscribeToSystemSchemeChange,
} from "the-perfect-theme-change/theme-client";
import { useEffect } from "react";

export function ThemeSwitcher() {
	const router = useRouter();
	useEffect(() => subscribeToSystemSchemeChange(() => router.refresh()), [router]);
	const choose = (m: "light" | "dark" | "system") => {
		setTheme(m, { viewTransition: true });
		router.refresh(); // re-render the server tree so it owns the class
	};
	return (
		<div>
			<button onClick={() => choose("light")}>Light</button>
			<button onClick={() => choose("dark")}>Dark</button>
			<button onClick={() => choose("system")}>System</button>
		</div>
	);
}
```
