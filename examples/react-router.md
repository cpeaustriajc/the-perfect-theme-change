# React Router v7 (framework mode) / Remix wiring

The root loader reads the request headers server-side; the `Layout` export
renders the resolved class on `<html>`. No `suppressHydrationWarning`.

## Root loader + Layout

```tsx
// app/root.tsx
import {
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	useLoaderData,
} from "react-router";
import type { Route } from "./+types/root";
import { getClientHintCheckScript } from "the-perfect-theme-change/theme-script";
import { acceptCHHeaders, readTheme } from "the-perfect-theme-change/theme-server";

export function loader({ request }: Route.LoaderArgs) {
	return readTheme(request.headers);
}

// Advertise the native client hint (optional fast path).
export function headers() {
	return acceptCHHeaders();
}

export function Layout({ children }: { children: React.ReactNode }) {
	// loaderData is undefined during the error boundary render, so guard it.
	const data = useLoaderData<typeof loader>() as
		| ReturnType<typeof readTheme>
		| undefined;
	const resolved = data?.resolved ?? "unknown";

	return (
		<html className={resolved === "unknown" ? undefined : resolved}>
			<head>
				<Meta />
				<Links />
				<script
					dangerouslySetInnerHTML={{ __html: getClientHintCheckScript() }}
				/>
			</head>
			<body>
				{children}
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

export default function App() {
	return <Outlet />;
}
```

## Switcher

The simplest switch writes the cookie from the browser and revalidates. You can
also POST to an `action` that sets the cookie via `Set-Cookie` if you prefer the
choice to survive with no client JS.

```tsx
import { useRevalidator } from "react-router";
import { useEffect } from "react";
import {
	setTheme,
	subscribeToSystemSchemeChange,
} from "the-perfect-theme-change/theme-client";

export function ThemeSwitcher() {
	const { revalidate } = useRevalidator();
	useEffect(() => subscribeToSystemSchemeChange(() => revalidate()), [revalidate]);
	const choose = (m: "light" | "dark" | "system") => {
		setTheme(m, { viewTransition: true }); // document.cookie + optimistic swap
		revalidate(); // re-run the loader so the server owns the class
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
