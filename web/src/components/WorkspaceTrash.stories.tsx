import type { Meta, StoryObj } from "@storybook/react-vite";
import { TrashList } from "./WorkspaceTrash";

const meta = { title: "Production/Trash", component: TrashList } satisfies Meta<
  typeof TrashList
>;
export default meta;
type Story = StoryObj<typeof meta>;
export const MixedOrigins: Story = {
  args: {
    rows: [
      {
        entry: "notes",
        name: "notes",
        kind: "workspace",
        original_path: "~/src/notes",
        restore: "available",
        size_bytes: 8192,
        size_complete: true,
      },
      {
        entry: "person@example.test",
        name: "person@example.test",
        kind: "directory",
        original_path: "~/cloud/onedrive/person@example.test",
        restore: "available",
        size_bytes: 1048576,
        size_complete: true,
      },
      {
        entry: "unavailable-parent",
        name: "unavailable-parent",
        kind: "directory",
        original_path: "~/cloud/removed-provider/unavailable-parent",
        restore: "parent_missing",
      },
      { entry: "recovered", kind: "unlabelled", restore: "unavailable" },
    ],
    onRestore: () => {},
    onPurge: () => {},
  },
};
