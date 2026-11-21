// Test hook for the permission question: guards every bash call whose command
// says "guarded" the way an account hook guards a deletion, through the
// companion's API (process-extension.mjs askPermission). The account and
// wording are synthetic.
export default function (pi) {
  pi.on('tool_call', async (event, ctx) => {
    if (event.toolName !== 'bash' || !String(event.input?.command ?? '').includes('guarded')) return undefined;
    const habitat = globalThis[Symbol.for('open-habitat.permission')];
    if (!habitat) return { block: true, reason: 'The Habitat permission API is not loaded.' };
    return habitat.block(ctx, {
      action: 'Delete the mail folder ‘Invoices 2024’',
      consequence: 'The folder and its 37 messages are removed from the mailbox.',
      account: { provider: 'Microsoft', address: 'person@example.test' },
      call: { area: 'fixture', tool: 'bash', arguments: event.input },
    });
  });
}
