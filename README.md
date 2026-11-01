# the-perfect-theme-change

A zero-runtime-dependency, vendorable (copy-paste, "shadcn-style") TypeScript/CSS
theming module for React SSR apps. It fixes dark-mode hydration mismatches at
the root cause — no `suppressHydrationWarning`, no flash of the wrong theme,
no pre-hydration DOM mutation — and it doubles as a living tracker of the best
known solution to this problem class, including the platform proposal that
will eventually make the whole module unnecessary.

- [1. The problem](#1-the-problem)
- [2. The trilemma](#2-the-trilemma)
- [3. Solution landscape](#3-solution-landscape)
- [4. Platform proposal tracker](#4-platform-proposal-tracker)
- [5. How this module works](#5-how-this-module-works)
- [6. What this improves over existing packages](#6-what-this-improves-over-existing-packages)
- [7. Usage](#7-usage)
- [8. For AI agents](#8-for-ai-agents)
- [9. Sources / prior art](#9-sources--prior-art)

## 1. The problem

React hydration demands a three-way equality, on every attribute React
manages:

```
server-rendered HTML  ==  pre-hydration DOM  ==  client-rendered React tree
```

If any two of those disagree, React logs a hydration mismatch. Dark mode is
the canonical way to break this equality by accident. The classic "no flash
of wrong theme" pattern is a synchronous inline `<script>` in `<head>`, before
`<body>`, that reads `localStorage` or `matchMedia` and sets
`document.documentElement.className` immediately. It works for the *paint* —
the browser shows the right theme before anything renders — but it does so by
mutating the DOM between when the server's HTML string was generated and when
React hydrates it. The server said `<html>`; the script changed it to
`<html class="dark">`; React's client-rendered tree (built from server-sent
props, which don't know about the script) says `<html>` again. Two of the
three trees now disagree.

`suppressHydrationWarning` does not restore the equality. It is a flag on a
specific node telling React "don't warn if this one's attributes don't
match" — a suppression of the *symptom* (the console warning), not a fix for
the *cause* (the DOM mutation). The mismatch is still there; React just stops
telling you about it, and stops reconciling that attribute, which is exactly
what makes the pattern usable in practice but is also why it feels like
cheating.

## 2. The trilemma

For any given render, you can have at most two of these three:

- **No flash** of the wrong theme on first paint.
- **No `suppressHydrationWarning`** — the server renders the theme React will
  also render, so the trees actually agree.
- **Static, cacheable HTML** — no per-request cookie/header read, so the
  response can be a CDN-cached static file.

Picking two forces a specific trade-off:

| Ecosystem choice | Picks | Forced trade-off |
| --- | --- | --- |
| `next-themes`, MUI, shadcn/ui | No flash + static | Must suppress. Their constraint is structural: Next.js static rendering can't read cookies, so the only way to get the right paint is a pre-hydration script mutating the DOM, which `suppressHydrationWarning` then has to hide. |
| Epic Stack client-hint cookies (`@epic-web/client-hints`) | No flash + no suppression | Dynamic HTML (every response reads the request), plus a first-visit reload to get the hint cookie in place before the very first paint. |
| Pure CSS (`prefers-color-scheme` / `light-dark()`) | All three | But the server and any JS running before mount can never know the *resolved* theme — there is no header, no cookie, nothing to read. Anything theme-dependent that isn't pure CSS (charts, code editors, `<img>` swaps) breaks, and an explicit user override ("always dark, ignore my OS") still needs one of the other two approaches layered on top. |

This module targets **no flash + no suppression** for SSR apps — the same
corner as Epic Stack — and then uses the CSS corner as a fallback to also
eliminate Epic Stack's first-visit reload.

## 3. Solution landscape

| Approach | First-paint correctness | Hydration warnings | Server knows resolved theme | Static HTML | First-visit reload | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Inline script + `suppressHydrationWarning` (next-themes, MUI, shadcn/ui) | Yes | Suppressed, not fixed | No (unless also wired to a cookie) | Yes | No | The script mutates `<html>` between server HTML and hydration — a real mismatch, hidden rather than resolved. |
| Client-hint cookies with reload (`@epic-web/client-hints`, Epic Stack ADR 005) | Yes, after the reload | None | Yes | No — reads the cookie on every request | Yes, once, on first visit | Correct and honest, but that first visitor pays for a full reload before seeing the app. |
| Pure CSS (`prefers-color-scheme` media query, `light-dark()`) | Yes | None | No — server/JS never see the OS preference | Yes | No | Only the paint is solved. Any JS-driven theming (canvas/charts, editors, theme-specific images) has no signal to key off, and explicit overrides need a cookie/script anyway. |
| Native `Sec-CH-Prefers-Color-Scheme` client hint | Yes, on supporting browsers | None | Yes, on supporting browsers | No — must vary the response on the hint header | Browser-level pre-paint retry, Chromium only; no fallback elsewhere | Not yet universal (see §4) — needs a fallback for Safari/Firefox. |
| **This module** | Yes | None | Yes, once an explicit cookie or the hint header exists; `"unknown"` only on a cookie-less first visit | No for explicit/hinted requests | None by default (`firstVisit: "css"`); opt-in one-time reload (`firstVisit: "reload"`) with a loop guard | Polyfills `Sec-CH-Prefers-Color-Scheme` from a hint cookie where the browser does not send it, so the server reads one source for the OS preference: the header. |

## 4. Platform proposal tracker

*(status as of 2026-07 — this table is intentionally a living document; open a
PR if any of these have moved)*

The native, no-JS answer to this whole problem class is the W3C **User
Preference Media Features Client Hints Headers** proposal:
`Sec-CH-Prefers-Color-Scheme`, opted into with `Accept-CH` and made
pre-paint-blocking with `Critical-CH` — the browser retries the very first
request, hint attached, before it paints anything. If every engine shipped
this, the entire client-hint-cookie / reload dance in this module would be
unnecessary.

**Migration when WebKit and Gecko ship the native hint:** delete
`src/theme-polyfill.ts` and `src/theme-script.ts`, and remove the
`polyfillColorSchemeHint` call from `readTheme`. `theme-core.ts` does not
change, because it already reads only the header.

| Engine | Status |
| --- | --- |
| Chromium (Chrome, Edge) | Shipped since Chrome 93 (2021). ~76% global browser share per caniuse. |
| WebKit (Safari) | Not implemented through Safari 27. |
| Gecko (Firefox) | Not implemented through Firefox 155. |

Watch:

- Spec: [WICG User Preference Media Features Client Hints Headers](https://wicg.github.io/user-preference-media-features-headers/)
- [MDN — `Sec-CH-Prefers-Color-Scheme`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-CH-Prefers-Color-Scheme)
- [caniuse — `Sec-CH-Prefers-Color-Scheme`](https://caniuse.com/mdn-http_headers_sec-ch-prefers-color-scheme)
- [mozilla/standards-positions](https://github.com/mozilla/standards-positions) and [WebKit/standards-positions](https://github.com/WebKit/standards-positions) — the places engine intent gets posted before ship dates do.

The other half of the native story is already universal: CSS `light-dark()`
is Baseline 2024 across all three engines, which is why this module's
recommended CSS strategy (§5, §7) leans on it for the classless first paint.

## 5. How this module works

**Server resolution ladder** (`resolveTheme` in `src/theme-core.ts`, exposed
via `readTheme` in `src/theme-server.ts`):

```
explicit user cookie  >  Sec-CH-Prefers-Color-Scheme header  >  "unknown"
```

The header is the one source for the OS preference. Chromium sends it
natively. For WebKit and Gecko, this module polyfills it in two halves:

- **Client half** (`getClientHintCheckScript` in `src/theme-script.ts`): the
  inline script mirrors `matchMedia("(prefers-color-scheme: dark)")` into the
  `ch-prefers-color-scheme` hint cookie.
- **Server half** (`polyfillColorSchemeHint` in `src/theme-polyfill.ts`):
  `readTheme` first copies the request headers into a fresh `Headers` and,
  when `sec-ch-prefers-color-scheme` is missing or not `light`/`dark`, sets it
  from the hint cookie. A valid native header always wins, because the cookie
  can be stale during a session.

A page cannot simply send the header itself: `Sec-` is a forbidden
request-header prefix in the Fetch standard, so no page script or service
worker can set it. Only the server can add it, to its own copy of the
headers — a bare `new Headers()` has no forbidden-name guard
(`theme-polyfill.test.ts` proves this for the runtime it runs on).

- **Explicit choice** (`theme` cookie is `"light"` or `"dark"`): the server
  and React both render `class="light"` or `class="dark"` on `<html>`. All
  three trees in §1's equality agree — zero warnings, zero suppression.
- **System mode, resolved** (the header, native or polyfilled, says `"light"`/`"dark"`,
  no explicit cookie): server and React still render that class. Still zero
  warnings — the server just learned the preference from a hint instead of a
  choice.
- **System mode, unresolved** (`resolved === "unknown"`, i.e. genuinely first
  visit — no cookies, no native header): **no class is ever rendered.** CSS
  alone (`light-dark()` tokens plus the dual Tailwind `dark:` variant in
  `theme.css`) resolves the paint from the OS preference, live, with no class
  and no JS. There is nothing for React to disagree with because neither side
  claimed a class.
- **Closing the gap, silently:** on that same first visit, the inline script
  from `getClientHintCheckScript()` reads `matchMedia` and writes the hint
  cookie — but with the default `firstVisit: "css"` it never reloads. The
  *next* navigation is server-resolved. This is strictly better than
  `@epic-web/client-hints`, which reloads on that first visit to get the same
  outcome one page sooner. `firstVisit: "reload"` opts back into that
  epic-web-style behavior for apps that need the server to know the theme on
  the very first paint, with a loop guard (cookie read-back plus a
  `sessionStorage` flag) that `@epic-web/client-hints` does not have.
- **The invariant, enforced by `theme-script.test.ts`:** the generated script
  never touches the DOM — no `documentElement`, `classList`, `setAttribute`,
  no `querySelector`. It only reads `matchMedia` and reads/writes
  `document.cookie`. That is the entire reason it's hydration-safe: nothing
  it does can put the pre-hydration DOM out of sync with the server HTML.
- **Mid-session OS changes:** `subscribeToSystemSchemeChange` listens for
  `prefers-color-scheme` changes, refreshes the hint cookie first, then
  invokes your callback so you can revalidate the route and let the server
  re-render with the new value.
- **User-initiated switches:** `setTheme` writes (or, for `"system"`, deletes)
  the explicit cookie, then does an optimistic class swap on `<html>` —
  wrapped in `document.startViewTransition` when `viewTransition: true`,
  feature-detected, and skipped under `prefers-reduced-motion: reduce`. The
  swap is a post-hydration DOM mutation, which is safe: the server will own
  the class again on the very next request, from the cookie this call just
  wrote.
- **Native fast path:** `acceptCHHeaders()` returns the `Accept-CH` /
  `Critical-CH` / `Vary` headers that opt Chromium into sending
  `Sec-CH-Prefers-Color-Scheme` on the first request, skipping the client-hint
  cookie round-trip entirely on browsers that support it (§4).

## 6. What this improves over existing packages

**vs. `@epic-web/client-hints`:**

- Zero-reload by default via the CSS-first fallback — epic-web's approach
  always reloads once on a cookie-less first visit; this module only reloads
  if you explicitly opt into `firstVisit: "reload"`.
- A native `Sec-CH-Prefers-Color-Scheme` + `Critical-CH` fast path
  (`acceptCHHeaders`) that epic-web does not offer, for browsers that support
  it (Chromium today).
- A reload-loop guard (cookie read-back plus a `sessionStorage` flag) for
  `firstVisit: "reload"` mode, so a browser that blocks cookies can't be sent
  into a reload loop — a case `@epic-web/client-hints` doesn't guard against.

**vs. `next-themes`:**

- No `suppressHydrationWarning`, anywhere, ever — this module doesn't have an
  escape hatch for it because the design never produces a real mismatch to
  suppress.
- The server knows the resolved theme on every request except the single
  cookie-less first visit in `css` mode (where it deliberately renders no
  class instead of guessing).
- View Transitions are built into `setTheme`, feature-detected and
  motion-aware, rather than left to the consumer.

**Honest trade-offs, stated plainly:**

- Once a theme is explicit or hinted, the response depends on request
  headers/cookies — that route is no longer static, cacheable HTML. This is
  the same trade-off Epic Stack makes and the same one `next-themes`-style
  static rendering explicitly avoids by suppressing instead.
- In `css` mode, the one class-less first paint is CSS-only truth: any
  JS-only theme consumer mounted before the hint cookie round-trip (a chart
  library, a code editor) has no class or cookie to read yet and must fall
  back to its own `matchMedia` check post-mount.
- `light-dark()` is colors-only and strictly two-scheme (light/dark) — it
  can't express a third theme or non-color tokens. `theme.css` includes the
  classic `.dark` class + duplicated `@media` block as Strategy 2 for apps
  that need more than what `light-dark()` can express, or that must support
  browsers predating it.

## 7. Usage

### Vendoring model

This is not published to a registry — there is nothing to `npm install`. Copy
the files you need out of `src/` into your app (a `shadcn/ui`-style workflow):
at minimum `theme-core.ts`, plus whichever of `theme-server.ts` (which needs
`theme-polyfill.ts`), `theme-script.ts`, and `theme-client.ts` your framework
calls for, plus `theme.css`. Update the relative `./theme-core.js` import inside the files you
copy to match wherever you put them. The code samples below and in
`examples/*.md` write imports as `the-perfect-theme-change/theme-server` etc.
for readability — treat that as a placeholder for your actual path (a
relative import, or a `@/` alias if your app has one) once vendored.

### Quickstart (TanStack Start)

Condensed from [`examples/tanstack-start.md`](./examples/tanstack-start.md),
which also covers the theme switcher.

```ts
// src/lib/theme.server.ts
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { readTheme } from "./theme-server.js";

export const getThemeInfo = createServerFn({ method: "GET" }).handler(() =>
	readTheme(getRequestHeaders()),
);
```

```tsx
// src/routes/__root.tsx
import {
	createRootRoute,
	HeadContent,
	Outlet,
	Scripts,
	useMatch,
} from "@tanstack/react-router";
import { getClientHintCheckScript } from "./theme-script.js";
import { getThemeInfo } from "../lib/theme.server";

export const Route = createRootRoute({
	loader: () => getThemeInfo(),
	head: () => ({
		scripts: [{ children: getClientHintCheckScript() }],
	}),
	shellComponent: RootDocument,
});

function RootDocument() {
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

Other frameworks: [`examples/next-app-router.md`](./examples/next-app-router.md)
(App Router, including the honest static-vs-dynamic trade-off) and
[`examples/react-router.md`](./examples/react-router.md) (React Router v7
framework mode / Remix).

### API reference

Everything below is the actual exported surface — names, signatures, and
defaults match the source files exactly.

#### `theme-core.ts` — pure logic, no browser or server APIs

```ts
type Theme = "light" | "dark";
type ThemeMode = Theme | "system";
type ResolvedServerTheme = Theme | "unknown";

interface ThemeCookieNames {
	explicit: string; // default "theme"
	hint: string; // default "ch-prefers-color-scheme"
}

type PlainHeaders = Record<string, string | string[] | undefined>;

const DEFAULT_COOKIE_NAMES: ThemeCookieNames;

function parseCookieHeader(
	header: string | null | undefined,
): Record<string, string>;

function isTheme(v: unknown): v is Theme;

function resolveTheme(input: {
	explicit: string | null | undefined; // the explicit cookie
	hint: string | null | undefined; // the Sec-CH-Prefers-Color-Scheme header
}): { mode: ThemeMode; resolved: ResolvedServerTheme };
```

- `DEFAULT_COOKIE_NAMES` is `{ explicit: "theme", hint: "ch-prefers-color-scheme" }`.
- `parseCookieHeader` tolerates a null/undefined/empty header, whitespace,
  `=` inside values, quoted values, and percent-encoding (falling back to the
  raw value if decoding throws).
- `resolveTheme` applies the ladder from §5: an invalid value at any rung
  (e.g. `"purple"`) is treated as absent and falls through to the next rung.
  It knows nothing about the hint cookie; `polyfillColorSchemeHint` puts that
  value into the header before `resolveTheme` runs.

#### `theme-server.ts` — read the resolved theme from a request

```ts
interface ThemeInfo {
	explicit: Theme | null;
	hint: Theme | null;
	mode: ThemeMode;
	resolved: ResolvedServerTheme;
}

function readTheme(
	headers: Headers | PlainHeaders | null | undefined,
	opts?: { cookieNames?: Partial<ThemeCookieNames> },
): ThemeInfo;

function acceptCHHeaders(): {
	"Accept-CH": string;
	"Critical-CH": string;
	Vary: string;
};
```

- `readTheme` accepts either a WHATWG `Headers` instance or a plain
  Node-style headers record (header-name lookup is case-insensitive; an
  array header value uses the first entry). It runs `polyfillColorSchemeHint`
  first, then reads only the explicit cookie and the
  `sec-ch-prefers-color-scheme` header. Existing callers do not need to wire
  the polyfill in themselves.
- `acceptCHHeaders()` always returns
  `{ "Accept-CH": "Sec-CH-Prefers-Color-Scheme", "Critical-CH": "Sec-CH-Prefers-Color-Scheme", Vary: "Sec-CH-Prefers-Color-Scheme" }`.

#### `theme-polyfill.ts` — server half of the client-hint polyfill

```ts
function polyfillColorSchemeHint(
	headers: Headers | PlainHeaders | null | undefined,
	opts?: { cookieNames?: Partial<ThemeCookieNames> },
): Headers;
```

- Returns a new `Headers`; it never mutates its input. A plain record is
  copied with the same lookup `readTheme` always used: case-insensitive
  names, the first of two keys that differ only in case, and the first entry
  of an array value. A name or value `Headers` rejects is dropped.
- Sets `sec-ch-prefers-color-scheme` from the hint cookie (default
  `ch-prefers-color-scheme`, overridable via `cookieNames.hint`) only when the
  header is missing or is not `light`/`dark`, and only when the cookie is
  valid. A valid native header always wins.
- It is the only server code that knows about the hint cookie. Delete it,
  with `theme-script.ts`, when WebKit and Gecko ship the native hint.

#### `theme-script.ts` — the inline `<head>` script (client half of the polyfill)

```ts
interface ClientHintCheckOptions {
	hintCookieName?: string; // default "ch-prefers-color-scheme"
	firstVisit?: "css" | "reload"; // default "css"
	cookieMaxAge?: number; // default one year (60 * 60 * 24 * 365)
	cookiePath?: string; // default "/"
}

function getClientHintCheckScript(opts?: ClientHintCheckOptions): string;
```

- Returns a self-executing script **string** for you to inline (e.g.
  `dangerouslySetInnerHTML` or a framework `head.scripts` entry) — it is not
  auto-injected.
- All options are embedded via `JSON.stringify`, so a cookie name containing
  quotes cannot break out of the script or inject code.
- `firstVisit: "css"` (default): writes the hint cookie when stale, never
  reloads. `firstVisit: "reload"`: additionally reloads once, guarded by a
  cookie read-back plus a `sessionStorage` flag keyed to the cookie name, so a
  browser that blocks cookies can't loop.
- Invariant (enforced by `theme-script.test.ts`): the generated string never
  contains `documentElement`, `classList`, `setAttribute`, or `querySelector`
  in either mode.

#### `theme-client.ts` — browser-side helpers

```ts
function setTheme(
	mode: ThemeMode,
	opts?: {
		cookieNames?: Partial<ThemeCookieNames>;
		viewTransition?: boolean; // default false
		cookieMaxAge?: number; // default one year
		cookiePath?: string; // default "/"
	},
): void;

function subscribeToSystemSchemeChange(
	cb: (theme: Theme) => void,
	opts?: { cookieNames?: Partial<ThemeCookieNames> },
): () => void;
```

- `setTheme("light" | "dark")` writes the explicit cookie and swaps the
  `<html>` class; `setTheme("system")` deletes the explicit cookie and swaps
  the class to the OS scheme resolved via `matchMedia` (not a clear to no
  class), because that's what the next server render produces from the hint
  cookie — matching it exactly is what keeps React's className prop-diffing
  from leaving the real DOM out of sync with its virtual tree. With
  `viewTransition: true`, the swap runs inside `document.startViewTransition`
  when the browser supports it and the user has not requested reduced
  motion; otherwise it applies directly. Aborted/skipped transitions (e.g. a
  rapid second call) are swallowed so they never surface as unhandled
  rejections.
- `subscribeToSystemSchemeChange` attaches a `prefers-color-scheme` listener,
  refreshes the hint cookie on every change (before calling back), and
  returns an unsubscribe function.
- Both functions guard on `typeof document`/`window === "undefined"` and are
  safe no-ops when imported or called during SSR.

#### `theme.css`

Copy-paste CSS with two mutually exclusive strategies (pick one) plus an
optional Tailwind v4 snippet:

- **Strategy 1 (recommended): `light-dark()`.** One token definition per
  variable; `color-scheme: light dark` on `:root` drives the automatic branch
  when no class is present, and `.light`/`.dark` pin `color-scheme` for an
  explicit choice. Active by default in the file.
- **Strategy 2 (classic, commented out):** plain custom properties duplicated
  under `.dark` and under `@media (prefers-color-scheme: dark)` scoped to
  `:root:not(.light)`. Use only if you can't adopt `light-dark()` (older
  target browsers, or tokens that aren't colors).
- **Tailwind v4 dual `dark:` variant (commented out):** a `@custom-variant
  dark` that makes `dark:` utilities respond to both the explicit `.dark`
  class and the classless OS preference, compatible with either strategy
  above.

## 8. For AI agents

If you are vendoring this module into an app on someone's behalf, read this
first.

**File map:**

| File | Role |
| --- | --- |
| `src/theme-core.ts` | Pure logic: types, cookie parsing, the resolution ladder (explicit cookie > `Sec-CH-Prefers-Color-Scheme` header > `"unknown"`). No browser/server APIs — import this from both server and client code. |
| `src/theme-polyfill.ts` | `polyfillColorSchemeHint` — server half of the client-hint polyfill: copies the hint cookie into a fresh `Headers` as `sec-ch-prefers-color-scheme` when the browser did not send a valid one. The only server code that reads the hint cookie. Server-only. |
| `src/theme-server.ts` | `readTheme` (request → `ThemeInfo`, runs the polyfill first) and `acceptCHHeaders` (native client-hint opt-in headers). Server-only. |
| `src/theme-script.ts` | `getClientHintCheckScript` — client half of the polyfill: builds the inline `<head>` script string that writes the hint cookie. Runs in both server (to build the string) and browser (as the emitted script) contexts. |
| `src/theme-client.ts` | `setTheme` and `subscribeToSystemSchemeChange` — browser-only DOM/cookie mutation, guarded to no-op under SSR. |
| `src/theme.css` | Copy-paste CSS: token strategies + optional Tailwind variant. |
| `examples/*.md` | Framework-specific wiring (TanStack Start, Next.js App Router, React Router v7 / Remix). |

**Invariants that must never be violated when adapting this to a new
framework or app:**

1. The script produced by `getClientHintCheckScript` must never mutate the
   DOM — no `documentElement`, `classList`, `setAttribute`, `style`, or any
   other node write. It may only touch `matchMedia` and `document.cookie`.
   This is what makes it hydration-safe; a single DOM write here reintroduces
   the exact bug this module exists to fix.
2. The `<html>` class (`"light"` / `"dark"` / absent) must only ever be
   rendered by the framework's normal render path — the server response and
   React's client tree, from the same `resolved` value — never by
   pre-hydration JavaScript. If you find yourself writing a `<script>` that
   sets a class before hydration, you have reintroduced the pattern from §1.
3. Do not reintroduce `suppressHydrationWarning` anywhere in this flow. If a
   mismatch appears, the bug is upstream (something set a class or attribute
   the server didn't render) — fix that, don't suppress it.
4. In `firstVisit: "css"` mode, the classless first paint depends on the CSS
   in `theme.css` working correctly with **no class present at all**. When
   adapting the CSS (new tokens, a different strategy), verify the no-class
   case still resolves via `prefers-color-scheme` / `light-dark()` before
   shipping — that's the one case with no server or script backstop.
5. Read the OS preference on the server only from the
   `sec-ch-prefers-color-scheme` header (via `readTheme`, or after
   `polyfillColorSchemeHint`). Do not read the hint cookie anywhere else on
   the server: `theme-polyfill.ts` is the one place that knows it, so that
   deleting it and `theme-script.ts` is the whole migration once WebKit and
   Gecko ship the native hint.

## 9. Sources / prior art

- [Epic Stack ADR 005 — client preference cookies](https://github.com/epicweb-dev/epic-stack/blob/main/docs/decisions/005-client-pref-cookies.md) — the decision record this module's cookie ladder is closest to.
- [`@epic-web/client-hints`](https://github.com/epicweb-dev/client-hints) — the reference implementation of the reload-based approach; see §6 for the specific deltas.
- [Chance Strickland — "Preferred color schemes on the server with HTTP client hint headers"](https://chance.dev/blog/preferred-color-schemes-on-the-server-with-http-client-hint-headers) — native `Sec-CH-Prefers-Color-Scheme` walkthrough.
- [Matt Stobbs — "Remix Dark Mode" (2024)](https://www.mattstobbs.com/remix-dark-mode-2024/) — cookie-based dark mode in a Remix/React Router loader.
- [`next-themes`](https://github.com/pacocoursey/next-themes) — the ubiquitous inline-script + `suppressHydrationWarning` implementation this module avoids.
- [Josh Comeau — "The Quest for the Perfect Dark Mode"](https://www.joshwcomeau.com/react/dark-mode/) — the essay this repo's name riffs on; a thorough walk through the flash-of-wrong-theme problem.
- [MDN — `light-dark()`](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark) and [MDN — `Sec-CH-Prefers-Color-Scheme`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-CH-Prefers-Color-Scheme).
- [caniuse — `Sec-CH-Prefers-Color-Scheme`](https://caniuse.com/mdn-http_headers_sec-ch-prefers-color-scheme) — support data behind §4.
