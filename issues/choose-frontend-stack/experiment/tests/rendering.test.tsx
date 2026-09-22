import { render, screen } from '@testing-library/react';
import { codeToTokens } from 'shiki';
import { DiffView, SafeMarkdown } from '../src/App';

describe('untrusted rich content boundary', () => {
  it('does not enable raw HTML or javascript links', () => {
    const { container } = render(
      <SafeMarkdown>{`[bad](javascript:alert(1))\n\n<script>alert(1)</script>`}</SafeMarkdown>,
    );
    expect(container.querySelector('script')).not.toBeInTheDocument();
    expect(container.querySelector('a')).not.toHaveAttribute('href');
    expect(container).not.toHaveTextContent('alert(1)');
  });

  it('renders parsed diff text through escaped React nodes', () => {
    render(<DiffView patch={'--- a/a.txt\n+++ b/a.txt\n@@ -1 +1 @@\n-<script>\n+safe'} />);
    expect(screen.getByLabelText('Unified diff')).toHaveTextContent('<script>');
    expect(document.querySelector('script')).not.toBeInTheDocument();
  });

  it('tokenizes code without accepting generated markup', async () => {
    const result = await codeToTokens(`const value = '<img onerror=alert(1)>';`, {
      lang: 'typescript',
      theme: 'github-light',
    });
    expect(result.tokens.flat().map((token) => token.content).join('')).toContain('<img');
  });
});
