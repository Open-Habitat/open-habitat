import type { Preview } from "@storybook/react-vite";
import React from "react";
import { MemoryRouter } from "react-router";
import "../../design-system/styles.css";
import "../src/app.css";
import { setPersonalLanguage } from "../src/i18n";

const preview: Preview = {
  globalTypes: {
    language: {
      description: "Käyttöliittymän kieli / Interface language",
      defaultValue: "fi",
      toolbar: { icon: "globe", items: ["fi", "en"] },
    },
    theme: {
      description: "Tuotantoteema",
      defaultValue: "light",
      toolbar: { icon: "paintbrush", items: ["light", "dark"] },
    },
  },
  decorators: [
    (Story, context) => {
      // A story renders in the toolbar's language; the key remounts it on
      // a change, since a story has no app frame that would rerender it.
      setPersonalLanguage(context.globals.language === "en" ? "en" : "fi");
      return React.createElement(
        React.Fragment,
        { key: context.globals.language },
        React.createElement(
          MemoryRouter,
          undefined,
          React.createElement(
            "div",
            {
              "data-theme": context.globals.theme,
              style: {
                minHeight: "100vh",
                background: "var(--ah-bg)",
                color: "var(--ah-ink)",
              },
            },
            React.createElement(Story),
          ),
        ),
      );
    },
  ],
  parameters: { a11y: { test: "error" }, controls: { expanded: true } },
};
export default preview;
