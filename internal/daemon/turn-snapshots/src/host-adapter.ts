import type {
	ExtensionAPI,
	ExtensionCommandContext,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";

interface BeforeBranchEvent {
	entryId: string;
}

interface BeforeForkEvent extends BeforeBranchEvent {
	position: "before" | "after";
}

interface BranchResult {
	cancelled: boolean;
}

interface OmpCommandContext {
	branch(entryId: string): Promise<BranchResult>;
}

interface PiCommandContext {
	navigateTree(entryId: string): Promise<BranchResult>;
}

type BeforeBranchHandler = (
	event: BeforeBranchEvent,
	ctx: ExtensionContext,
) => Promise<{ cancel?: boolean } | undefined>;

type EventApi = {
	on(
		event: string,
		handler: (event: BeforeForkEvent | BeforeBranchEvent, ctx: ExtensionContext) => Promise<{ cancel?: boolean } | undefined>,
	): void;
};

export function registerBeforeBranchHandler(pi: ExtensionAPI, handler: BeforeBranchHandler): void {
	const events = pi as unknown as EventApi;
	events.on("session_before_fork", async (event, ctx) => {
		const forkEvent = event as BeforeForkEvent;
		if (forkEvent.position !== "before") return undefined;
		return handler(forkEvent, ctx);
	});
	events.on("session_before_branch", handler);
}

export async function rewindConversation(
	ctx: ExtensionCommandContext,
	entryId: string,
	prompt: string,
	notification: string,
	notificationType: "info" | "warning",
): Promise<BranchResult> {
	const candidate = ctx as ExtensionCommandContext & {
		navigateTree?: PiCommandContext["navigateTree"];
		branch?: OmpCommandContext["branch"];
	};
	if (typeof candidate.navigateTree === "function") {
		const result = await candidate.navigateTree(entryId);
		if (!result.cancelled) {
			ctx.ui.setEditorText(prompt);
			ctx.ui.notify(notification, notificationType);
		}
		return result;
	}
	if (typeof candidate.branch === "function") {
		return candidate.branch(entryId);
	}
	throw new Error("The host does not provide an in-place conversation navigation API");
}

type SettledHandler = (ctx: ExtensionContext) => Promise<void>;

interface AgentEndLike {
	willContinue?: boolean;
}

/**
 * OMP's extension API carries module handles that Pi's does not. OMP has no
 * `agent_settled` event; its `agent_end` says through `willContinue` whether
 * the run goes on.
 */
export function isOmpExtensionApi(pi: ExtensionAPI): boolean {
	const candidate = pi as unknown as Record<string, unknown>;
	return typeof candidate.logger === "object" && candidate.logger !== null && typeof candidate.typebox === "object";
}

/**
 * Calls `handler` once a run has settled: no retry, compaction or queued
 * continuation follows. Pi reports this as `agent_settled`; on OMP the
 * terminal `agent_end` is the closest equivalent.
 */
export function registerRunSettledHandler(pi: ExtensionAPI, handler: SettledHandler): void {
	const events = pi as unknown as {
		on(event: string, handler: (event: unknown, ctx: ExtensionContext) => Promise<void>): void;
	};
	if (isOmpExtensionApi(pi)) {
		events.on("agent_end", async (event, ctx) => {
			if ((event as AgentEndLike).willContinue === true) return;
			await handler(ctx);
		});
		return;
	}
	events.on("agent_settled", async (_event, ctx) => handler(ctx));
}
