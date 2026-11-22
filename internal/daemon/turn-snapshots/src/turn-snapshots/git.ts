import { spawn } from "node:child_process";
import { devNull } from "node:os";

export interface GitResult {
	code: number | null;
	stdout: Buffer;
	stderr: string;
	/** Set when the process could not be started or was stopped. */
	failure?: "unavailable" | "timeout" | "output-limit" | "spawn-error";
	error?: Error;
}

export interface GitRunOptions {
	cwd: string;
	/** Absolute deadline (epoch ms) or a relative timeout; whichever is earlier wins. */
	deadline?: number;
	timeoutMs?: number;
	input?: Buffer | string;
	maxOutputBytes?: number;
	/** Extra environment for this call, applied after the sanitized base. */
	env?: Record<string, string>;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_OUTPUT = 16 * 1024 * 1024;

export const GIT_OBJECT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

export class GitTimeoutError extends Error {
	constructor(message = "Git did not finish within the time budget") {
		super(message);
		this.name = "GitTimeoutError";
	}
}

export class GitUnavailableError extends Error {
	constructor() {
		super("The git executable was not found");
		this.name = "GitUnavailableError";
	}
}

/**
 * The environment for every Git call made here. Inherited GIT_* variables
 * (for example GIT_DIR or GIT_INDEX_FILE set by a hook that started the host)
 * would silently retarget a command, so they are dropped. System and global
 * configuration are not read either: the private store must never run a
 * user's hooks, filters or fsmonitor, and the settings that do affect how a
 * working tree is hashed are copied explicitly from the workspace.
 */
export function baseGitEnv(): Record<string, string> {
	const env: Record<string, string> = {};
	for (const [key, value] of Object.entries(process.env)) {
		if (value === undefined || key.startsWith("GIT_")) continue;
		env[key] = value;
	}
	env.GIT_TERMINAL_PROMPT = "0";
	env.LC_ALL = "C";
	return env;
}

export function isolatedGitEnv(): Record<string, string> {
	return {
		...baseGitEnv(),
		GIT_CONFIG_NOSYSTEM: "1",
		GIT_CONFIG_GLOBAL: devNull,
	};
}

export function runGit(args: readonly string[], options: GitRunOptions, env: Record<string, string>): Promise<GitResult> {
	const now = Date.now();
	const relative = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const budget = options.deadline === undefined ? relative : Math.min(relative, options.deadline - now);
	if (budget <= 0) {
		return Promise.resolve({ code: null, stdout: Buffer.alloc(0), stderr: "", failure: "timeout" });
	}
	const maxOutput = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT;
	return new Promise((resolveResult) => {
		let settled = false;
		let failure: GitResult["failure"];
		let error: Error | undefined;
		const chunks: Buffer[] = [];
		let size = 0;
		let stderr = "";
		const child = spawn("git", args, {
			cwd: options.cwd,
			env: { ...env, ...options.env },
			stdio: ["pipe", "pipe", "pipe"],
			windowsHide: true,
		});
		const timer = setTimeout(() => {
			failure = "timeout";
			child.kill("SIGKILL");
		}, budget);
		const finish = (code: number | null) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			resolveResult({
				// A stopped or truncated command never counts as a success, even if it had already exited 0.
				code: failure ? null : code,
				stdout: Buffer.concat(chunks, size),
				stderr,
				...(failure ? { failure } : {}),
				...(error ? { error } : {}),
			});
		};
		child.on("error", (spawnError: NodeJS.ErrnoException) => {
			failure = spawnError.code === "ENOENT" ? "unavailable" : "spawn-error";
			error = spawnError;
			finish(null);
		});
		child.stdout.on("data", (chunk: Buffer) => {
			if (failure === "output-limit") return;
			const room = maxOutput - size;
			if (chunk.length > room) {
				// Keep a valid prefix of exactly the allowed size, then stop the process.
				if (room > 0) chunks.push(chunk.subarray(0, room));
				size = maxOutput;
				failure = "output-limit";
				child.kill("SIGKILL");
				return;
			}
			size += chunk.length;
			chunks.push(chunk);
		});
		child.stderr.on("data", (chunk: Buffer) => {
			if (stderr.length < 64 * 1024) stderr += chunk.toString("utf8");
		});
		child.on("close", (code) => finish(code));
		child.stdin.on("error", () => {});
		if (options.input !== undefined) child.stdin.end(options.input);
		else child.stdin.end();
	});
}

export function gitError(result: GitResult, fallback: string): Error {
	if (result.failure === "unavailable") return new GitUnavailableError();
	if (result.failure === "timeout") return new GitTimeoutError();
	const message = result.stderr.trim().split("\n").at(-1) || result.error?.message || fallback;
	return new Error(message);
}

/** Splits NUL-terminated Git output, dropping the trailing empty field. */
export function splitNul(output: Buffer | string): string[] {
	const text = typeof output === "string" ? output : output.toString("utf8");
	if (text.length === 0) return [];
	const fields = text.split("\0");
	if (fields.at(-1) === "") fields.pop();
	return fields;
}
