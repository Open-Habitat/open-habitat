// The rail's synthetic worlds for the lab: the lab's snapshot rewritten on
// the wire into a number of waiting, running and quiet conversations and
// workspaces (rail-scroll-region and adaptive-rail specs).

export type World = {
  yours: number;
  running: number;
  quiet: number;
  workspaces: number;
};

const hex = (n: number) => n.toString(16).padStart(12, "0");
const MARK_AT = "2026-11-20T08:00:00.000Z";

type Json = Record<string, unknown>;

/** The lab's snapshot as the world: its own unarchived conversations fill
 * the first places (the first one waits and is the one opened), invented
 * ones the rest; its own workspaces come first, invented ones after. */
export function rewrite(
  body: { agents: Json[]; workspaces: Json[] },
  w: World,
) {
  const listed = body.workspaces.filter(
    (ws) => ws.presence === "present" && ws.visibility === "visible",
  );
  const workspaces = [...body.workspaces];
  for (let i = listed.length; i < w.workspaces; i++)
    workspaces.push({
      ...listed[0],
      workspace_id: `ws_railscroll${hex(i)}`,
      name: `tyotila-${String(i).padStart(2, "0")}`,
      display_name: `tyotila-${String(i).padStart(2, "0")}`,
      path: `/nonexistent/rail-scroll/tyotila-${i}`,
    });
  const own = body.agents.filter((a) => a.archive !== "archived");
  const archived = body.agents.filter((a) => a.archive === "archived");
  const template = own[0] ?? archived[0];
  const total = w.yours + w.running + w.quiet;
  const agents: Json[] = [...archived];
  for (let i = 0; i < total; i++) {
    const base =
      own[i] ??
      ({
        ...template,
        agent_id: `pi:0000a11e-0000-4000-8000-${hex(i)}`,
        title: {
          display: `Keskustelu ${i}`,
          generation_state: "not_requested",
          replaceable: true,
          source: "first_message_fallback",
        },
        workspace_id:
          workspaces[(i * 7 + 3) % w.workspaces].workspace_id ??
          listed[0].workspace_id,
        history_query: undefined,
      } as Json);
    const a: Json = { ...base };
    for (const k of [
      "archive",
      "archived_at",
      "last_reply",
      "turn_mark",
      "agent_section",
      "failure",
      "rest",
      "interrupted_turn",
      "waiting_on",
      "non_waking_processes",
      "spinoffs_working",
      "spinoffs_idle",
      "history_query",
    ])
      delete a[k];
    if (base.history_query && own[i]) a.history_query = base.history_query;
    a.changed_at = new Date(Date.parse(MARK_AT) - i * 60000).toISOString();
    a.process = "not_observed";
    a.run_active = false;
    a.history = "readable";
    if (i < w.yours) a.turn_mark = { state: "raised", at: MARK_AT };
    else if (i < w.yours + w.running)
      Object.assign(a, {
        process: "terminal_observed_live",
        control: "read_only",
        run_active: true,
      });
    agents.push(a);
  }
  return { ...body, workspaces, agents };
}
