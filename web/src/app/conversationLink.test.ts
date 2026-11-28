import { afterEach, describe, expect, it } from "vitest";
import {
  appendLinkMessage,
  conversationLinkAt,
  findLinkWorkspace,
  forgetConversationLink,
  keepConversationLinkForSignIn,
  linkMessageLimit,
  linkWorkspaceName,
  parseLinkFragment,
  takeConversationLink,
  watchConversationLinks,
} from "./conversationLink";

/** A link as an agent makes it: URL-encoded, `n` in code points. */
const fragment = (text: string, n = [...text].length) =>
  `#n=${n}&draft=${encodeURIComponent(text)}`;

describe("parseLinkFragment", () => {
  it("decodes the message and checks its length in code points", () => {
    const text = "Selvitä yöajon virhe 🙂\nloki: logs/a+b.txt & muu";
    expect(parseLinkFragment(fragment(text))).toEqual({ kind: "text", text });
    // `+` is a space, as in a form-encoded link; a literal plus is %2B.
    expect(parseLinkFragment("n=3&draft=a+b")).toEqual({
      kind: "text",
      text: "a b",
    });
  });

  it("drops a message a chat app cut short", () => {
    const text = "Korjaa testit ja kerro tulos";
    const cut = fragment(text).slice(0, -8);
    expect(parseLinkFragment(cut)).toEqual({ kind: "dropped", reason: "cut" });
    // Counting UTF-16 units instead of characters is a mismatch too.
    expect(parseLinkFragment(fragment("🙂", 2))).toEqual({
      kind: "dropped",
      reason: "cut",
    });
    // Cut inside a character: invalid UTF-8 is not a replacement character
    // that would still count as one.
    expect(parseLinkFragment("#n=1&draft=%C3")).toEqual({
      kind: "dropped",
      reason: "cut",
    });
    expect(parseLinkFragment("n=12")).toEqual({
      kind: "dropped",
      reason: "cut",
    });
    expect(parseLinkFragment(`draft=${encodeURIComponent(text)}`)).toEqual({
      kind: "dropped",
      reason: "cut",
    });
  });

  it("drops a message over the limit, even when it is whole", () => {
    const longest = "a".repeat(linkMessageLimit);
    expect(parseLinkFragment(fragment(longest))).toEqual({
      kind: "text",
      text: longest,
    });
    expect(parseLinkFragment(fragment(`${longest}b`))).toEqual({
      kind: "dropped",
      reason: "long",
      length: linkMessageLimit + 1,
    });
    // A cut link that says it was longer reports what it said.
    expect(parseLinkFragment("n=12480&draft=Analysoi")).toEqual({
      kind: "dropped",
      reason: "long",
      length: 12480,
    });
  });

  it("opens without a message when there is none", () => {
    expect(parseLinkFragment("")).toEqual({ kind: "none" });
    expect(parseLinkFragment("#n=0&draft=")).toEqual({ kind: "none" });
  });
});

describe("the link's address", () => {
  afterEach(() => {
    forgetConversationLink();
    sessionStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  it("names the workspace as encoded in the path", () => {
    expect(linkWorkspaceName("/new/kotisivu")).toBe("kotisivu");
    expect(linkWorkspaceName("/new/Oma%20sivu%C3%A4")).toBe("Oma sivuä");
    expect(linkWorkspaceName("/new/")).toBeUndefined();
    expect(linkWorkspaceName("/new/a/b")).toBeUndefined();
    expect(linkWorkspaceName("/workspaces")).toBeUndefined();
  });

  it("prefers the sidebar's name to a directory name", () => {
    const ws = [
      { name: "kotisivu", display_name: "Sivusto", presence: "present" },
      { name: "Sivusto", presence: "present" },
      { name: "poissa", presence: "missing" },
    ];
    expect(findLinkWorkspace(ws, "Sivusto")).toBe(ws[0]);
    expect(findLinkWorkspace(ws, "kotisivu")).toBe(ws[0]);
    expect(findLinkWorkspace(ws, "poissa")).toBeUndefined();
  });

  it("takes the message out of the address bar and keeps it once", () => {
    const text = "Katso yöajo";
    window.history.replaceState(null, "", `/new/kotisivu${fragment(text)}`);
    takeConversationLink();
    expect(window.location.hash).toBe("");
    expect(window.location.pathname).toBe("/new/kotisivu");
    expect(conversationLinkAt("/new/kotisivu").message).toEqual({
      kind: "text",
      text,
    });
    // Another address does not get it.
    expect(conversationLinkAt("/new/muu").message).toEqual({ kind: "none" });
    expect(sessionStorage.length).toBe(0);
    forgetConversationLink();
    expect(conversationLinkAt("/new/kotisivu").message).toEqual({
      kind: "none",
    });
  });

  it("takes a link opened again at the address the tab already shows", () => {
    window.history.replaceState(null, "", "/new/kotisivu");
    takeConversationLink();
    watchConversationLinks();
    window.history.replaceState(null, "", `/new/kotisivu${fragment("Uusi")}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    expect(window.location.hash).toBe("");
    expect(conversationLinkAt("/new/kotisivu").message).toEqual({
      kind: "text",
      text: "Uusi",
    });
  });

  it("keeps the link across a sign-in in this tab only, once", () => {
    const text = "Katso yöajo & julkaise";
    window.history.replaceState(null, "", `/new/kotisivu${fragment(text)}`);
    takeConversationLink();
    keepConversationLinkForSignIn("/new/kotisivu");
    forgetConversationLink();
    // The sign-in returns to /workspaces.
    window.history.replaceState(null, "", "/workspaces");
    takeConversationLink();
    expect(window.location.pathname).toBe("/new/kotisivu");
    expect(conversationLinkAt("/new/kotisivu").message).toEqual({
      kind: "text",
      text,
    });
    expect(sessionStorage.length).toBe(0);
    forgetConversationLink();
    window.history.replaceState(null, "", "/workspaces");
    takeConversationLink();
    expect(window.location.pathname).toBe("/workspaces");
  });

  it("forgets a kept link that is too old", () => {
    sessionStorage.setItem(
      "nah:conversation-link",
      JSON.stringify({
        path: "/new/kotisivu",
        fragment: "n=1&draft=a",
        at: Date.now() - 60 * 60 * 1000,
      }),
    );
    window.history.replaceState(null, "", "/workspaces");
    takeConversationLink();
    expect(window.location.pathname).toBe("/workspaces");
    expect(sessionStorage.length).toBe(0);
  });
});

it("appends the link's message after the person's text", () => {
  expect(appendLinkMessage("Oma teksti  \n", "Linkin")).toBe(
    "Oma teksti\n\nLinkin",
  );
  expect(appendLinkMessage("  ", "Linkin")).toBe("Linkin");
});
