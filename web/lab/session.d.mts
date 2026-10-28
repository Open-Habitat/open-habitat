import type { Browser, BrowserContext, Page } from "@playwright/test";

export const origin: string;
export function openLab(options?: {
  identity?: "alice" | "bob";
  width?: number;
  height?: number;
  deviceScaleFactor?: number;
}): Promise<{ browser: Browser; context: BrowserContext; page: Page }>;
export function snapshot(
  page: Page,
  outBase: string,
  options?: { html?: boolean; region?: string; labOrigin?: string },
): Promise<void>;
