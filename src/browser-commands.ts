export interface EmulatedMedia {
	colorScheme?: "light" | "dark";
	reducedMotion?: "reduce" | "no-preference";
}

declare module "vitest/browser" {
	interface BrowserCommands {
		emulateMedia(media: EmulatedMedia): Promise<void>;
	}
}
