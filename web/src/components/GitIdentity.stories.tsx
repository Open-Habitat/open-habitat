import type { Meta, StoryObj } from "@storybook/react-vite";
import { GitIdentity } from "../app/GitIdentity";

const meta = {
  title: "Production/Git identity",
  component: GitIdentity,
  args: {
    onboarding: true,
    preferredName: "Aino Esimerkki",
    preferredEmail: "aino@example.invalid",
  },
  // Synthetic read only; without CSRF, confirmation cannot write anything.
  beforeEach: () => {
    const original = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      if (input === "/api/v1/account/git-identity") {
        return Response.json({
          schema_version: 1,
          name: "",
          email: "",
          source: "~/.gitconfig",
          suggested_name: "GitHub Example",
          suggested_email: "42+aino@users.noreply.github.com",
          emails: ["42+aino@users.noreply.github.com"],
        });
      }
      return original(input, init);
    };
    return () => {
      globalThis.fetch = original;
    };
  },
} satisfies Meta<typeof GitIdentity>;
export default meta;
type Story = StoryObj<typeof meta>;
export const ProfileNamePrefilled: Story = {};
export const WithoutProfileName: Story = { args: { preferredName: "" } };
