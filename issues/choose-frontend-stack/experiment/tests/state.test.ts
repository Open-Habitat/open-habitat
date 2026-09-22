import { actions, draftKey, draftRepository, makeStore } from '../src/state';

describe('single event and acknowledgement store', () => {
  it('deduplicates replayed cursor events and preserves uncertainty', () => {
    const store = makeStore();
    const event = { id: 'event-1', cursor: 1, kind: 'assistant' as const, text: 'hei' };
    store.dispatch(actions.eventReceived(event));
    store.dispatch(actions.eventReceived(event));
    store.dispatch(actions.commandPosted('command-1'));
    store.dispatch(actions.commandAcknowledged({ id: 'command-1', state: 'uncertain' }));
    expect(store.getState().agent.events).toHaveLength(1);
    expect(store.getState().agent.commands['command-1']?.state).toBe('uncertain');

    store.dispatch(actions.snapshotReceived({ cursor: 4, events: [{ ...event, cursor: 4 }] }));
    expect(store.getState().agent.commands['command-1']?.state).toBe('uncertain');
    expect(store.getState().agent.sync).toBe('current');

    store.dispatch(actions.eventReceived({ ...event, id: 'gap-event', cursor: 6 }));
    expect(store.getState().agent.sync).toBe('stale');
    expect(store.getState().agent.cursor).toBe(4);
  });

  it('keeps drafts tab-, identity-, server- and agent-local', () => {
    const first = draftKey('alder', 'jari', 'agent-a');
    const second = draftKey('alder', 'jari', 'agent-b');
    draftRepository.write(first, 'ensimmäinen');
    draftRepository.write(second, 'toinen');
    expect(draftRepository.read(first)).toBe('ensimmäinen');
    draftRepository.clearIdentity('alder', 'jari');
    expect(draftRepository.read(first)).toBe('');
    expect(draftRepository.read(second)).toBe('');
  });
});
