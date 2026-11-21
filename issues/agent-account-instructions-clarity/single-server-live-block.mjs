// Experiment only. No Microsoft tool executes; no shell/file fallback is allowed.
import {appendFileSync} from 'node:fs';
export default function (pi) {
    pi.on('tool_call', async event => {
        appendFileSync(process.env.EXP_LOG, JSON.stringify({tool: event.toolName, input: event.input, parent: event.parentToolCallId ?? null}) + '\n');
        if (event.toolName !== 'codemode') return {block: true, reason: 'Not signed in to Microsoft (experiment). Report which tool you would use and stop.'};
    });
    pi.on('tool_result', async event => {
        if (event.toolName === 'codemode') appendFileSync(process.env.EXP_LOG, JSON.stringify({result: event.content}) + '\n');
    });
}
