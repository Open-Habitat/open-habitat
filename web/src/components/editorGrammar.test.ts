import { ensureSyntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { classHighlighter, highlightTree } from "@lezer/highlight";
import { describe, expect, it } from "vitest";
import { editorGrammar } from "./editorGrammar";

describe("bundled editor grammars", () => {
  it.each([
    ["main.ts", 'const message: string = "hello";', "const"],
    ["main.js", 'const message = "hello";', "const"],
    ["View.jsx", 'const view = <div title="hello" />;', "div"],
    ["View.tsx", 'const view = <div title="hello" />;', "div"],
    ["main.py", 'def greet():\n    return "hello"', "return"],
    ["index.php", '<?php function greet() { return "hello"; }', "return"],
    ["main.go", 'package main\nfunc main() { println("hello") }', "func"],
    ["main.rs", 'fn main() { let message = "hello"; }', "fn"],
    ["data.json", '{"message": "hello", "count": 42}', '"hello"'],
    ["config.yaml", 'message: "hello"\ncount: 42', '"hello"'],
    ["config.yml", 'message: "hello"\ncount: 42', '"hello"'],
    ["Cargo.toml", '[package]\nname = "hello"\nversion = 42', '"hello"'],
    ["README.md", "# Hello\n\n**world**", "Hello"],
    ["index.html", '<div title="hello">world</div>', "div"],
    ["style.css", "div { color: red; margin: 42px; }", "color"],
    ["query.sql", "SELECT name FROM people WHERE id = 42;", "SELECT"],
    ["script.sh", 'if true; then echo "hello"; fi', "if"],
    ["script.zsh", 'if true; then echo "hello"; fi', "if"],
    ["types.MTS", 'const message: string = "hello";', "string"],
  ])("highlights %s", async (path, doc, expected) => {
    const state = EditorState.create({
      doc,
      extensions: [await editorGrammar(path)],
    });
    const tree = ensureSyntaxTree(state, doc.length, 1000);
    expect(tree).not.toBeNull();
    const highlighted: string[] = [];
    if (tree)
      highlightTree(tree, classHighlighter, (from, to) =>
        highlighted.push(doc.slice(from, to)),
      );
    expect(highlighted.join(" ")).toContain(expected);
  });

  it.each([
    "unknown.xyz",
    "README",
    "directory.ts/unknown",
    "directory.go/plain.txt",
  ])("keeps %s plain", async (path) => {
    expect(await editorGrammar(path)).toEqual([]);
  });
});
