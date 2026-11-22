import { createServer } from "node:http";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

// Opt-in real Xvnc + Chromium; never a personal browser profile.
test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });
for (const mac of [true, false]) {
  test(`Latin keystrokes reach real text and password fields (${mac ? "Cmd" : "Ctrl"})`, async ({
    page,
  }) => {
    test.skip(
      !process.env.BROWSER_HOST_REAL_BROWSER,
      "requires Xvnc and Chrome",
    );
    test.setTimeout(120000);
    await page.clock.install();
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);
    // Linux lab: exercise the Mac viewer mapping with a browser-native Paste
    // editing command. This is not a physical macOS browser qualification.
    await page.addInitScript(
      (mac) =>
        Object.defineProperty(navigator, "platform", {
          get: () => (mac ? "MacIntel" : "Linux"),
        }),
      mac,
    );
    let values = { text: "", password: "", editable: "", multiline: "" };
    let ready = false;
    let sequence = -1;
    const server = createServer((req, res) => {
      if (req.method === "POST") {
        let body = "";
        req.on("data", (b) => {
          body += b;
        });
        req.on("end", () => {
          const next = JSON.parse(body);
          if (next.sequence > sequence) {
            values = next;
            sequence = next.sequence;
          }
          ready = true;
          res.end();
        });
      } else {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(`<!doctype html><input id="text" autofocus><input id="password" type="password"><div id="editable" contenteditable></div><textarea id="multiline"></textarea><script>
        let sequence = 0;
        document.addEventListener('input', () => fetch('/', {method:'POST', body:JSON.stringify({sequence:sequence++,text:document.querySelector('#text').value,password:document.querySelector('#password').value,editable:document.querySelector('#editable').textContent,multiline:document.querySelector('#multiline').value})}));
        window.onload = () => { document.querySelector('#text').focus(); document.dispatchEvent(new Event('input')); };
      </script>`);
      }
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("no port");
      await page.request.get("/fixture/scenario?value=ready");
      await page.goto("/workspaces");
      await page.getByTestId("github-sign-in").click();
      await page
        .getByRole("link")
        .and(page.locator('a[href*="code=42"]'))
        .click();
      const session = await (await page.request.get("/auth/session")).json();
      expect(
        (
          await page.request.put("/api/v1/account/preferences", {
            headers: {
              Origin: new URL(page.url()).origin,
              "X-Agent-Host-CSRF": session.csrf,
            },
            data: { experimental: { "remote-browser": true } },
          })
        ).ok(),
      ).toBe(true);
      await page.reload();
      await page.getByTestId("browser-rail-row").click();
      const viewer = page.getByTestId("browser-viewer");
      await expect(viewer).toHaveAttribute("data-phase", "connected", {
        timeout: 60000,
      });
      const canvas = viewer.locator("canvas");
      await canvas.click();
      await expect(page.getByTestId("browser-sheet")).toHaveAttribute(
        "data-mode",
        "control",
      );
      await page.keyboard.press("Control+l");
      await page.keyboard.type(`http://127.0.0.1:${address.port}/`, {
        delay: 20,
      });
      await page.keyboard.press("Enter");
      // Observe loading via the synthetic site, not a guessed keyboard delay.
      await expect.poll(() => ready).toBe(true);
      const cdp = await page.context().newCDPSession(page);
      async function key(key: string, code: string, modifiers = 0) {
        await cdp.send("Input.dispatchKeyEvent", {
          type: "keyDown",
          key,
          code,
          modifiers,
        });
        await cdp.send("Input.dispatchKeyEvent", {
          type: "keyUp",
          key,
          code,
          modifiers,
        });
      }
      for (const [ch, code] of [
        ["ä", "Quote"],
        ["ö", "Semicolon"],
        ["å", "BracketLeft"],
      ]) {
        await key(ch, code);
      }
      // AltGr output is delivered as the browser-resolved character.
      await cdp.send("Input.dispatchKeyEvent", {
        type: "keyDown",
        key: "AltGraph",
        code: "AltRight",
      });
      await key("€", "KeyE", 2);
      await key("@", "Digit2", 2);
      await cdp.send("Input.dispatchKeyEvent", {
        type: "keyUp",
        key: "AltGraph",
        code: "AltRight",
      });
      await expect.poll(() => values.text).toBe("äöå€@");
      async function paste(value: string) {
        await page.evaluate((v) => navigator.clipboard.writeText(v), value);
        if (!mac) {
          // Real Ctrl+Shift keydowns reach noVNC before the paste event. The
          // pasted letters must stay literal, not turn into browser commands.
          await page.keyboard.press("Control+Shift+V");
          return;
        }
        await cdp.send("Input.dispatchKeyEvent", {
          type: "keyDown",
          key: "v",
          code: "KeyV",
          modifiers: 4,
          commands: ["Paste"],
        });
        await cdp.send("Input.dispatchKeyEvent", {
          type: "keyUp",
          key: "v",
          code: "KeyV",
          modifiers: 4,
        });
      }
      await page.keyboard.press("Control+a");
      await paste("äö€ abc");
      await expect.poll(() => values.text).toBe("äö€ abc");
      if (!mac) {
        // Ctrl stays physically held across paste and the next shortcut.
        await page.evaluate(() => navigator.clipboard.writeText("second"));
        await page.keyboard.down("Control");
        await page.keyboard.press("a");
        await page.keyboard.press("v");
        await expect.poll(() => values.text).toBe("second");
        await page.keyboard.press("a");
        await page.keyboard.up("Control");
        await key("z", "KeyZ");
        await expect.poll(() => values.text).toBe("z");
        await page.keyboard.press("Control+a");
        await paste("äö€ abc");
        await expect.poll(() => values.text).toBe("äö€ abc");
      }
      await page.clock.fastForward(6100);
      await expect(page.getByTestId("browser-toast")).toBeEmpty();
      await paste("prefix😀");
      await expect(page.getByTestId("browser-toast")).toBeVisible();
      // The remote clipboard started empty and stays empty: Shift+Insert on
      // the remote must not duplicate the inserted text (or insert a marker).
      await page.keyboard.press("End");
      await page.keyboard.press("Shift+Insert");
      await key("!", "Digit1");
      await expect.poll(() => values.text).toBe("äö€ abc!");
      await page.keyboard.press("Tab");
      await paste("äö€ abc");
      await expect.poll(() => values.password).toBe("äö€ abc");
      await page.keyboard.press("Control+a");
      await page.keyboard.press("Backspace");
      await expect.poll(() => values.password).toBe("");
      await page.keyboard.press("Tab");
      await paste("äö€ abc");
      await expect.poll(() => values.editable).toBe("äö€ abc");
      await page.keyboard.press("Tab");
      await page.clock.fastForward(6100);
      await expect(page.getByTestId("browser-toast")).toBeEmpty();
      await paste("first\nsecond");
      await expect(page.getByTestId("browser-toast")).toBeVisible();
      await key("!", "Digit1");
      await expect.poll(() => values.multiline).toBe("!");
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Shift+Tab");
      const password = "pässÖÅ€@Łœǿ1";
      await page.getByTestId("browser-clip-toggle").click();
      await page.getByTestId("browser-paste-text").fill(password);
      await page.getByTestId("browser-type-send").click();
      await expect.poll(() => values.password).toBe(password);
      await canvas.focus();
      await key("ä", "Quote");
      await key("ǒ", "KeyO");
      await expect.poll(() => values.password).toBe(`${password}äǒ`);
      // Exercise the entire preloaded repertoire, not only Finnish examples.
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Control+a");
      const latin = `${Array.from({ length: 0x250 - 0xa0 }, (_, i) =>
        String.fromCodePoint(i + 0xa0),
      ).join("")}€`;
      for (const caps of [false, true]) {
        if (caps) {
          await canvas.focus();
          await page.keyboard.press("Control+a");
          await page.keyboard.press("CapsLock");
        }
        for (let i = 0; i < latin.length; i += 4) {
          await page
            .getByTestId("browser-paste-text")
            .fill(latin.slice(i, i + 4));
          await page.getByTestId("browser-type-send").click();
          await expect
            .poll(() => values.text, {
              message: `through U+${(0xa0 + i).toString(16)}, CapsLock=${caps}`,
            })
            .toBe(latin.slice(0, i + 4));
        }
      }
    } finally {
      await new Promise<void>((r, reject) =>
        server.close((e) => (e ? reject(e) : r())),
      );
    }
  });
}
