import { afterEach, beforeEach, expect, it, vi } from "vitest";

// The module records this tab's bundle when it is first evaluated, so each
// case loads it fresh after writing the document it "loaded from".
const loaded = `<script src="/theme-bootstrap.js"></script>
<script type="module" crossorigin src="/assets/index-AAAA.js"></script>
<link rel="modulepreload" crossorigin href="/assets/vendor-BBBB.js">
<link rel="stylesheet" crossorigin href="/assets/index-CCCC.css">`;
const page = (head: string) =>
  `<!doctype html><html><head>${head}</head><body><div id="root"></div></body></html>`;

async function fresh() {
  vi.resetModules();
  return import("./bundleRelease");
}
function serve(...bodies: (string | Response)[]) {
  const spy = vi.spyOn(globalThis, "fetch");
  for (const body of bodies)
    spy.mockResolvedValueOnce(
      typeof body === "string" ? new Response(body, { status: 200 }) : body,
    );
  return spy;
}

beforeEach(() => {
  document.head.innerHTML = loaded;
});
afterEach(() => vi.restoreAllMocks());

it("treats the same entry assets in another order as the same bundle", async () => {
  const m = await fresh();
  // A lazily loaded chunk adds its stylesheet after start-up; it is not part
  // of the identity the server's index.html can be compared with.
  document.head.insertAdjacentHTML(
    "beforeend",
    '<link rel="stylesheet" href="/assets/Lazy-DDDD.css">',
  );
  const reordered = loaded.split("\n").reverse().join("\n");
  const fetchMock = serve(page(reordered));
  await m.checkBundle();
  expect(fetchMock.mock.calls[0][0]).toBe("/");
  expect(fetchMock.mock.calls[0][1]).toMatchObject({
    cache: "no-store",
    redirect: "manual",
    signal: expect.any(AbortSignal),
  });
  expect((await stateOf(m)).status).toBe("current");
});

it("reports a newer bundle when only the stylesheet hash changed", async () => {
  const m = await fresh();
  serve(page(loaded.replace("index-CCCC.css", "index-EEEE.css")));
  await m.checkBundle();
  expect((await stateOf(m)).status).toBe("newer");
});

it("keeps the last answer when a check fails, redirects or is not an index", async () => {
  const m = await fresh();
  const newer = page(loaded.replace("index-AAAA.js", "index-FFFF.js"));
  serve(
    newer,
    new Response("", { status: 503 }),
    new Response(null, { status: 302, headers: { location: "/auth" } }),
    page("<title>login</title>"),
    "x".repeat(300 * 1024),
  );
  expect(await m.checkBundle()).toBe("newer");
  // The state keeps "newer", but each failed check answers that it could not
  // tell: the connection banner offers a reload only on a server that served
  // its index just now, never because an outage left an older answer behind.
  for (let i = 0; i < 4; i++) expect(await m.checkBundle()).toBeUndefined();
  expect((await stateOf(m)).status).toBe("newer");
});

it("Myöhemmin hides the prompt only until yet another bundle is served", async () => {
  const m = await fresh();
  const second = page(loaded.replace("index-AAAA.js", "index-1111.js"));
  const third = page(loaded.replace("index-AAAA.js", "index-2222.js"));
  serve(second, second, third);
  await m.checkBundle();
  m.dismissBundlePrompt();
  expect(await stateOf(m)).toEqual({ status: "newer", dismissed: true });
  await m.checkBundle();
  expect(await stateOf(m)).toEqual({ status: "newer", dismissed: true });
  await m.checkBundle();
  expect(await stateOf(m)).toEqual({ status: "newer", dismissed: false });
});

it("does not check when the document names no entry assets", async () => {
  document.head.innerHTML = "";
  const m = await fresh();
  const fetchMock = vi.spyOn(globalThis, "fetch");
  await m.checkBundle();
  expect(fetchMock).not.toHaveBeenCalled();
  expect((await stateOf(m)).status).toBe("unknown");
});

// Read the store through its React subscription contract without rendering.
async function stateOf(m: typeof import("./bundleRelease")) {
  const { renderHook } = await import("@testing-library/react");
  return renderHook(() => m.useBundleState()).result.current;
}
