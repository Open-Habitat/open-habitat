import { expect, it } from "vitest";
import { giteaAddress } from "./gitea";

it("infers https only when no scheme is given and corrects nothing else", () => {
  expect(giteaAddress(" git.exxample.org ")).toBe("https://git.exxample.org");
  expect(giteaAddress("git.example.org:3000/gitea")).toBe(
    "https://git.example.org:3000/gitea",
  );
  expect(giteaAddress("[fd00::5]:3000")).toBe("https://[fd00::5]:3000");
  expect(giteaAddress("//git.example.org")).toBe("https://git.example.org");
  expect(giteaAddress("https://aaa")).toBe("https://aaa");
  // An explicit other scheme is left for validation, never upgraded.
  expect(giteaAddress("http://git.example.org")).toBe("http://git.example.org");
  expect(giteaAddress("ssh://git@git.example.org")).toBe(
    "ssh://git@git.example.org",
  );
  expect(giteaAddress("")).toBe("");
});
