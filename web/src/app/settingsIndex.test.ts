import { describe, expect, it } from "vitest";
import paths from "../../../internal/uiroutes/settings.json";
import { highlight, searchSettings, settingsSections } from "./settingsIndex";

const first = (query: string, admin = false) =>
  searchSettings(query, { admin })[0];

describe("settings index", () => {
  it("names every routed section once and gives each row a unique fragment id", () => {
    expect(settingsSections.map((s) => s.id).sort()).toEqual(
      Object.keys(paths).sort(),
    );
    const ids = settingsSections.flatMap((s) => s.rows.map((r) => r.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    // A folded row lands on a row of its own section.
    for (const s of settingsSections)
      for (const r of s.rows)
        if ("within" in r)
          expect(s.rows.map((x) => x.id as string)).toContain(r.within);
  });
});

describe("settings search", () => {
  it("finds a row by synonym, compound part, folded accents and service", () => {
    expect(first("tumma")).toMatchObject({
      row: "theme",
      synonym: expect.any(String),
    });
    expect(first("dark mode")).toMatchObject({ row: "theme" });
    expect(first("gmail")).toMatchObject({ section: "tiedot", row: "google" });
    // "malli" sits inside Oletusmalli; four letters may match inside a word.
    expect(searchSettings("malli", { admin: false }).map((h) => h.row)).toEqual(
      expect.arrayContaining(["default-model", "recap-model"]),
    );
    // Sound settings and dictation remain searchable without an experiment.
    const aani = searchSettings("aani", { admin: false });
    expect(aani[0]).toMatchObject({ section: "aanet" });
    expect(aani.some((h) => h.section === "kokeelliset")).toBe(false);
    expect(first("agents.md")).toMatchObject({
      section: "tili",
      row: "instructions",
    });
    expect(aani).toContainEqual(
      expect.objectContaining({ kind: "section", section: "sanelu" }),
    );
    expect(first("recap")).toMatchObject({
      kind: "section",
      section: "tilannekatsaus",
    });
    expect(first("kiintiö")).toMatchObject({ row: "usage" });
    expect(searchSettings("lomake", { admin: false })).toEqual([]);
    expect(searchSettings("   ", { admin: false })).toEqual([]);
  });

  it("matches inside a word only from four letters", () => {
    const rows = (q: string) =>
      searchSettings(q, { admin: false }).map((h) => h.row);
    expect(rows("tus")).not.toContain("default-model");
    expect(rows("tusm")).toContain("default-model");
  });

  it("needs every typed word, and a section name narrows to its rows", () => {
    expect(first("tekoäly")).toMatchObject({
      kind: "section",
      section: "tekoaly",
    });
    // A section name alone finds the section, not every row in it.
    expect(
      searchSettings("tekoäly", { admin: false }).filter(
        (h) => h.section === "tekoaly" && h.kind === "row",
      ),
    ).toEqual([]);
    expect(first("tilannekatsaus malli")).toMatchObject({ row: "recap-model" });
    expect(searchSettings("teema soniox", { admin: false })).toEqual([]);
  });

  it("lists the server's settings only for an administrator, after the person's own", () => {
    const person = searchSettings("soniox", { admin: false });
    expect(person.map((h) => h.row)).not.toContain("site-speech-key");
    const admin = searchSettings("soniox", { admin: true });
    const own = admin.findIndex((h) => h.row === "speech-key");
    const site = admin.findIndex((h) => h.row === "site-speech-key");
    expect(own).toBeGreaterThanOrEqual(0);
    expect(site).toBeGreaterThan(own);
  });

  it("finds the web search key on Tiedot agenteille, and the site's only for an administrator", () => {
    const person = searchSettings("hakuavain", { admin: false });
    expect(person.map((h) => h.row)).toContain("web-search");
    expect(person.map((h) => h.row)).not.toContain("server-brave");
    const admin = searchSettings("brave", { admin: true }).map((h) => h.row);
    expect(admin.indexOf("server-brave")).toBeGreaterThan(
      admin.indexOf("web-search"),
    );
  });

  it("marks what the query matched in the original text", () => {
    expect(highlight("Sanelu ääni", "aani")).toEqual([
      { text: "Sanelu ", hit: false },
      { text: "ääni", hit: true },
    ]);
  });
});
