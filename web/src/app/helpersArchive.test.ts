import { afterEach, describe, expect, it } from "vitest";
import { resetLanguageForTests, textNow } from "../i18n";
import { archiveNoticeText } from "../text/archiveNotice";
import { helpersArchiveDetail } from "./helpersArchive";
import type { Spinoff } from "./spinoffs";

const run = (edit: Partial<Spinoff>): Spinoff => ({
  run_id: "01m53wnktnxb4w2xgdd79a66de",
  title: "README",
  created_at: "2026-10-16T10:00:00Z",
  state: "waiting_parent",
  preserved: false,
  branch: "",
  worktree: "",
  source_branch: "main",
  summary: "",
  ...edit,
});

afterEach(() => resetLanguageForTests());

describe.each(["fi", "en-US", "en-GB"] as const)(
  "the archive notice's helpers (%s)",
  (language) => {
    it("is silent for idle helpers regardless of landing history", () => {
      resetLanguageForTests(language);
      expect(
        helpersArchiveDetail([
          run({}),
          run({
            resident: {
              name: "landed",
              round_state: "waiting",
              rounds: 2,
              landed_round: 2,
            },
          }),
          run({
            resident: {
              name: "unconfirmed",
              round_state: "waiting",
              rounds: 2,
            },
          }),
          run({
            resident: {
              name: "kept",
              round_state: "waiting",
              rounds: 3,
              unlanded: true,
            },
          }),
          run({
            resident: { name: "asleep", round_state: "dormant", rounds: 2 },
          }),
          run({
            state: "merged",
            resident: { name: "finished", round_state: "working", rounds: 2 },
          }),
        ]),
      ).toBeUndefined();
    });
    it("selects only the busy-round message and only live busy helpers", () => {
      resetLanguageForTests(language);
      expect(
        helpersArchiveDetail([
          run({
            resident: { name: "idle", round_state: "waiting", rounds: 2 },
          }),
          run({
            state: "working",
            resident: {
              name: "fix-a",
              round_state: "working",
              rounds: 2,
              unlanded: true,
            },
          }),
          run({
            state: "working",
            resident: { name: "fix-b", round_state: "working", rounds: 1 },
          }),
        ]),
      ).toBe(textNow(archiveNoticeText).helpersWorking("fix-a, fix-b"));
    });
  },
);
