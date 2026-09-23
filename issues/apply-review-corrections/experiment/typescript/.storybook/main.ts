const config = {
  stories: ["../src/**/*.stories.tsx"],
  addons: ["@storybook/addon-a11y"],
  framework: "@storybook/react-vite",
  typescript: { reactDocgen: "react-docgen" },
};
export default config;
