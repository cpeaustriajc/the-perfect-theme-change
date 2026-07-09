# the-perfect-theme-change

A zero-runtime-dependency, copy-pastable theming module for React SSR apps that fixes dark-mode hydration mismatches at the root cause — no `suppressHydrationWarning`, no flash of the wrong theme, and no pre-hydration DOM mutation. It resolves the theme on the server via an explicit-choice cookie, the native `Sec-CH-Prefers-Color-Scheme` client hint, and a DOM-untouching client-hint cookie, with a CSS-first fallback that gives a correct classless first paint with zero reload.

Full documentation coming.
