import { useEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import parseDiff from 'parse-diff';
import { Button, TextArea } from 'react-aria-components';
import ReactMarkdown from 'react-markdown';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useParams } from 'react-router';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { actions, draftKey, draftRepository, type RootState, type TimelineEvent } from './state';
import './styles.css';

const unsafeMarkdown = `# Turvallinen Markdown\n\n[väärä linkki](javascript:alert(1))\n\n<script>alert('x')</script>\n\n\`\`\`ts\nconst tervehdys = '<b>hei</b>';\n\`\`\``;
const samplePatch = `diff --git a/fixture.txt b/fixture.txt\nindex 1111111..2222222 100644\n--- a/fixture.txt\n+++ b/fixture.txt\n@@ -1 +1 @@\n-before\n+after`;

export function SafeMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSanitize]}
      components={{
        a: ({ children: linkChildren, href }) => (
          <a href={href} rel="noreferrer noopener">{linkChildren}</a>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}

export function DiffView({ patch = samplePatch }: { patch?: string }) {
  const files = parseDiff(patch);
  return (
    <section aria-label="Muutos">
      {files.map((file) => (
        <div key={`${file.from}-${file.to}`}>
          <h2>{file.to ?? file.from ?? 'Tuntematon tiedosto'}</h2>
          {/* Scrollable output must be keyboard-focusable. */}
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
          <pre tabIndex={0} role="region" aria-label="Unified diff">
            {file.chunks.flatMap((chunk) => chunk.changes).map((change, index) => (
              <span className={`diff-${change.type}`} key={`${index}-${change.content}`}>
                {change.content}{'\n'}
              </span>
            ))}
          </pre>
        </div>
      ))}
    </section>
  );
}

function EventRow({ event }: { event: TimelineEvent }) {
  if (event.kind.startsWith('tool')) {
    return (
      <details>
        <summary>{event.kind}: {event.toolCallId}</summary>
        <pre>{event.text}</pre>
      </details>
    );
  }
  return <article aria-label={event.kind}><SafeMarkdown>{event.text}</SafeMarkdown></article>;
}

function DraftEditor({ storageKey }: { storageKey: string }) {
  const [draft, setDraft] = useState(() => draftRepository.read(storageKey));
  useEffect(() => draftRepository.write(storageKey, draft), [draft, storageKey]);
  return (
    <>
      <label htmlFor="draft">Luonnos</label>
      <TextArea id="draft" value={draft} onChange={(event) => setDraft(event.target.value)} />
    </>
  );
}

export function Conversation() {
  const { serverId = 'alder', agentId = 'pi-redacted' } = useParams();
  const events = useSelector((state: RootState) => state.agent.events);
  const command = useSelector((state: RootState) => state.agent.commands['cmd-1']);
  const dispatch = useDispatch();
  const parentRef = useRef<HTMLDivElement>(null);
  const key = draftKey(serverId, 'test-user', agentId);
  const virtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 74,
    overscan: 8,
  });

  const items = virtualizer.getVirtualItems();
  const streamEvent = () => {
    const cursor = events.length + 1;
    dispatch(actions.eventReceived({
      id: `stream-${cursor}`,
      cursor,
      kind: 'tool-update',
      toolCallId: 'redacted-tool-1',
      text: `stream update ${cursor}`,
    }));
  };
  const uncertainSend = () => {
    dispatch(actions.commandPosted('cmd-1'));
    dispatch(actions.commandAcknowledged({ id: 'cmd-1', state: 'uncertain' }));
  };

  return (
    <main>
      <nav aria-label="Koevalinnat">
        <Link to="/servers/alder/workspaces/redacted/agents/pi-redacted">Keskustelu</Link>
      </nav>
      <h1>Pi-keskustelun renderöintikoe</h1>
      <p aria-live="polite">{events.length} tapahtumaa. Komento: {command?.state ?? 'ei lähetetty'}.</p>
      <div className="actions">
        <Button onPress={streamEvent}>Lisää stream-tapahtuma</Button>
        <Button onPress={uncertainSend}>Simuloi epävarma lähetys</Button>
      </div>
      {/* Scrollable virtual history must be keyboard-focusable. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
      <div ref={parentRef} className="timeline" role="region" aria-label="Keskusteluhistoria" tabIndex={0}>
        <div className="virtual" style={{ height: virtualizer.getTotalSize() }}>
          {items.map((item) => {
            const event = events[item.index];
            return (
              <div
                className="event"
                data-index={item.index}
                key={event.id}
                ref={virtualizer.measureElement}
                style={{ transform: `translateY(${item.start}px)` }}
              >
                <EventRow event={event} />
              </div>
            );
          })}
        </div>
      </div>
      <SafeMarkdown>{unsafeMarkdown}</SafeMarkdown>
      <DiffView />
      <DraftEditor key={key} storageKey={key} />
    </main>
  );
}

export function makeLongHistory(count = 2_500): TimelineEvent[] {
  const seed: TimelineEvent[] = [
    { id: 'redacted-user-1', cursor: 1, kind: 'user', text: 'Call probe_stream exactly once.' },
    { id: 'redacted-tool-start', cursor: 2, kind: 'tool-start', toolCallId: 'redacted-tool-1', text: 'probe_stream' },
    { id: 'redacted-tool-update', cursor: 3, kind: 'tool-update', toolCallId: 'redacted-tool-1', text: 'synthetic step 1/2' },
    { id: 'redacted-tool-end', cursor: 4, kind: 'tool-end', toolCallId: 'redacted-tool-1', text: 'synthetic stream complete' },
    { id: 'redacted-assistant-1', cursor: 5, kind: 'assistant', text: 'STREAM_DONE STEER_SEEN' },
  ];
  return Array.from({ length: count }, (_, index) => seed[index] ?? ({
    id: `long-${index}`,
    cursor: index + 1,
    kind: index % 20 === 0 ? 'unknown' : 'assistant',
    text: `Pitkän historian redaktoitu tapahtuma ${index}: ${'output '.repeat(24)}`,
  }));
}

export const fixtureState = {
  agent: { cursor: 2_500, events: makeLongHistory(), sync: 'current' as const, commands: {} },
};
