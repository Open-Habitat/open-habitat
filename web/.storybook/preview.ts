import React from "react";
import type { Preview } from "@storybook/react-vite";
import { MemoryRouter } from "react-router";
import "../../design-system/styles.css";
import "../src/app.css";

const preview: Preview = {
  globalTypes: {
    theme: {
      description: "Tuotantoteema",
      defaultValue: "light",
      toolbar: { icon: "paintbrush", items: ["light", "dark"] },
    },
  },
  decorators: [
    (Story, context) =>
      React.createElement(
        MemoryRouter,
        undefined,
        React.createElement(
          "div",
          {
            "data-theme": context.globals.theme,
            style: { minHeight: "100vh" },
          },
          React.createElement(Story),
        ),
      ),
  ],
  parameters: { a11y: { test: "error" }, controls: { expanded: true } },
};
export default preview;
