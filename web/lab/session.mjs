// Synthetic lab only. Never reuse a personal browser profile or real Chrome.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { labOrigin } from "../test-ports.mjs";

const portFile = fileURLToPath(
  new URL("../../.cache/lab/port", import.meta.url),
);
let port;
try {
  port = readFileSync(portFile, "utf8").trim();
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
if (port && (!/^[0-9]+$/.test(port) || +port < 1024 || +port > 65535))
  throw new Error("Invalid lab port in .cache/lab/port");
export const origin = port ? `https://127.0.0.1:${port}` : labOrigin;
export async function openLab({
  identity = "alice",
  width = 1440,
  height = 900,
  deviceScaleFactor = 1,
  locale = "fi-FI",
} = {}) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width, height },
    deviceScaleFactor,
    locale,
  });
  const page = await context.newPage();
  await page.goto(`${origin}/workspaces`);
  await page
    .getByRole("button", {
      name: /^(Kirjaudu GitHubilla|Sign in with GitHub)$/,
    })
    .click();
  await page
    .getByRole("link", {
      name: identity === "bob" ? "Bob" : "Alice",
      exact: true,
    })
    .click();
  return { browser, context, page };
}

// A static, inert twin of a synthetic lab screenshot. Never call on a live host.
export async function snapshot(
  page,
  outBase,
  { html = true, region, labOrigin: lab = origin } = {},
) {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { dirname } = await import("node:path");
  // A lab started with sibling host names (the editor) is named explicitly;
  // its marker still has to answer.
  if (new URL(page.url()).origin !== lab)
    throw new Error("Snapshot refused: page is outside the synthetic lab");
  const marker = await page.request.get(`${lab}/fixture/lab-marker`);
  if (marker.status() !== 204)
    throw new Error("Snapshot refused: host is not the synthetic lab");
  await page.evaluate(() => document.fonts.ready);
  await mkdir(dirname(outBase), { recursive: true });
  if (region) {
    await page.locator(region).first().waitFor();
    await page
      .locator(region)
      .first()
      .screenshot({ path: `${outBase}.png` });
  } else await page.screenshot({ path: `${outBase}.png`, fullPage: true });
  if (!html) return;
  const captured = await page.evaluate(async (region) => {
    const root = document.documentElement.cloneNode(true);
    // Retain the original ancestor chain (theme and layout context) while
    // discarding siblings from the *clone*, never modifying the live app.
    const omit = new Set();
    if (region) {
      let node = document.querySelector(region);
      if (!node || !document.body.contains(node))
        throw new Error(`Missing fragment region: ${region}`);
      while (node !== document.body) {
        for (const sibling of node.parentElement.children)
          if (sibling !== node) omit.add(sibling);
        node = node.parentElement;
      }
    }
    const live = [...document.documentElement.querySelectorAll("*")];
    const copies = [...root.querySelectorAll("*")];
    const inline = async (reference, base = location.href) => {
      const url = new URL(reference, base);
      if (url.protocol === "data:") return url.href;
      if (url.origin !== location.origin)
        throw new Error(`Non-lab asset: ${url.origin}`);
      const response = await fetch(url.href);
      if (!response.ok) throw new Error(`Asset unavailable: ${url.pathname}`);
      const blob = await response.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    };
    const cssUrls = async (text, base) => {
      const matches = [...text.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)];
      for (const match of matches.reverse()) {
        const url = match[2].trim();
        const replacement = url.startsWith("#") ? url : await inline(url, base);
        text = `${text.slice(0, match.index)}url("${replacement}")${text.slice(match.index + match[0].length)}`;
      }
      return text;
    };
    const ruleText = async (rules, base) => {
      let result = "";
      for (const rule of rules) {
        if (rule.type === CSSRule.IMPORT_RULE) {
          result += await ruleText(rule.styleSheet.cssRules, rule.href || base);
        } else result += `${await cssUrls(rule.cssText, base)}\n`;
      }
      return result;
    };
    let css = "";
    for (const sheet of document.styleSheets)
      css += await ruleText(sheet.cssRules, sheet.href || location.href);
    for (let i = 0; i < live.length; i++) {
      const src = live[i],
        dst = copies[i];
      if (src instanceof HTMLInputElement) {
        if (src.type === "password" || src.type === "hidden")
          dst.removeAttribute("value");
        else dst.setAttribute("value", src.value);
        if (src.checked) dst.setAttribute("checked", "");
        else dst.removeAttribute("checked");
      }
      if (src instanceof HTMLTextAreaElement) dst.textContent = src.value;
      if (src instanceof HTMLSelectElement) {
        [...src.options].forEach((option, index) => {
          const clone = dst.options[index];
          if (option.selected) clone.setAttribute("selected", "");
          else clone.removeAttribute("selected");
        });
      }
      if (src instanceof HTMLDetailsElement || src instanceof HTMLDialogElement)
        dst.open = src.open;
      if (src.scrollTop)
        dst.setAttribute("data-snapshot-scroll-top", String(src.scrollTop));
      if (src.scrollLeft)
        dst.setAttribute("data-snapshot-scroll-left", String(src.scrollLeft));
      if (src instanceof HTMLCanvasElement) {
        const image = document.createElement("img");
        image.src = src.toDataURL();
        dst.replaceWith(image);
      }
      if (dst.hasAttribute("style"))
        dst.setAttribute(
          "style",
          await cssUrls(dst.getAttribute("style"), location.href),
        );
      // A frame of another origin (the workspace editor) is not lab content:
      // the twin keeps its box, not its page.
      if (src instanceof HTMLIFrameElement) {
        dst.removeAttribute("src");
        dst.setAttribute("data-snapshot-frame", "omitted");
      }
      for (const attr of ["src", "poster"]) {
        if (dst.hasAttribute(attr))
          dst.setAttribute(attr, await inline(dst.getAttribute(attr)));
      }
      if (dst.hasAttribute("srcset")) dst.removeAttribute("srcset"); // src is already embedded.
    }
    for (const node of omit) {
      const placeholder = copies[live.indexOf(node)];
      // The shell uses :has(.ah-rail) to switch its main-column sizing.
      // Keep an empty rail as a layout anchor, not its captured content.
      const rail = placeholder.querySelector(".ah-rail");
      placeholder.replaceChildren();
      if (rail) {
        rail.replaceChildren();
        placeholder.append(rail);
      }
      placeholder.setAttribute("aria-hidden", "true");
      placeholder.style.visibility = "hidden";
    }
    for (const element of [...root.querySelectorAll("*")]) {
      if (
        [
          "SCRIPT",
          "IFRAME",
          "OBJECT",
          "EMBED",
          "BASE",
          "LINK",
          "META",
          "NOSCRIPT",
        ].includes(element.tagName)
      ) {
        element.remove();
        continue;
      }
      for (const attr of [...element.attributes]) {
        if (
          /^on/i.test(attr.name) ||
          [
            "href",
            "action",
            "formaction",
            "xlink:href",
            "integrity",
            "nonce",
          ].includes(attr.name)
        )
          element.removeAttribute(attr.name);
      }
      if (element instanceof HTMLInputElement && element.type === "hidden")
        element.remove();
    }
    const style = document.createElement("style");
    style.textContent = css.replace(/<\/style/gi, "<\\/style");
    root.querySelector("head").append(style);
    // CSP also disables submission, navigation and network if opened locally.
    const meta = document.createElement("meta");
    meta.setAttribute("http-equiv", "Content-Security-Policy");
    meta.setAttribute(
      "content",
      "default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline' data:; form-action 'none'; navigate-to 'none'",
    );
    root.querySelector("head").prepend(meta);
    return `<!doctype html>\n${root.outerHTML}`;
  }, region);
  // Captures also run from source exports without Git metadata. The caller
  // may identify the revision; keep it inert inside the HTML comment.
  const commit = (process.env.OH_LAB_REVISION || "unknown")
    .replaceAll("--", "-")
    .replaceAll(">", "");
  const header = `<!-- Synthetic lab | commit ${commit} | route ${new URL(page.url()).pathname.replaceAll("--", "-")} | viewport ${page.viewportSize().width}x${page.viewportSize().height} | theme ${await page.evaluate(() => document.documentElement.dataset.theme || "system")} | ${new Date().toISOString()} -->\n`;
  const contents = header + captured;
  if (Buffer.byteLength(contents) > 2 * 1024 * 1024)
    console.warn(
      `Snapshot exceeds 2 MB: ${outBase}.html (${Buffer.byteLength(contents)} bytes)`,
    );
  await writeFile(`${outBase}.html`, contents);
}
