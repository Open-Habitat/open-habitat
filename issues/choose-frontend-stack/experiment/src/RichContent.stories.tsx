import type { Meta, StoryObj } from '@storybook/react-vite';
import { DiffView, SafeMarkdown } from './App';

function RichContent() {
  return (
    <main>
      <SafeMarkdown>{'# Esimerkki\n\nKoodi: `const vastaus = 42`.'}</SafeMarkdown>
      <DiffView />
    </main>
  );
}

const meta = { title: 'Agent/RichContent', component: RichContent } satisfies Meta<typeof RichContent>;
export default meta;
export const Default: StoryObj<typeof meta> = {};
