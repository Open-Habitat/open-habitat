import compactionSchema from "../../../contracts/v1/compaction.schema.json";
import type { CompactionControl } from "../components/ContextView";
import type { BrowserAction } from "../components/composer/Composer";
import { liveText } from "../i18n";
import { composerBuiltinsText } from "../text/composerBuiltins";

const txt = liveText(composerBuiltinsText);

/** RPC prompts do not interpret Pi's interactive built-ins. These names
 * use Habitat's existing actions, not an invented native command catalog. */
export function conversationBuiltins(
  compaction: CompactionControl,
  onNew: () => void,
): BrowserAction[] {
  const reason = compaction.running
    ? txt.compacting
    : compaction.offer === "busy"
      ? txt.busy
      : compaction.offer === "none"
        ? txt.unavailable
        : undefined;
  return [
    {
      name: "compact",
      description: txt.compact,
      acceptsArguments: true,
      validateArguments: (text) => {
        const limit =
          compactionSchema.$defs.request.properties.instructions.maxLength;
        if ([...text].length > limit) return txt.instructionsLong(limit);
        if (text.includes("\u0000")) return txt.instructionsInvalid;
        return undefined;
      },
      availability: reason
        ? { state: "disabled", reason }
        : { state: "enabled" },
      run: compaction.onCompact,
    },
    { name: "new", description: txt.new, run: onNew },
  ];
}
