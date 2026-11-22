import { execFile } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function git(cwd: string, ...args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		execFile("git", ["-C", cwd, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
			if (error) {
				reject(new Error(String(stderr).trim() || error.message));
				return;
			}
			resolve(String(stdout).trim());
		});
	});
}

export interface Fixture {
	root: string;
	project: string;
	agentDir: string;
	sessionFile: string;
}

/** A repository with one commit, an ignored directory and an agent directory beside it. */
export async function createFixture(name: string): Promise<Fixture> {
	const root = await mkdtemp(join(tmpdir(), `better-pi-rewind-${name}-`));
	const project = join(root, "project");
	const agentDir = join(root, "agent");
	await mkdir(project, { recursive: true });
	await mkdir(join(agentDir, "sessions"), { recursive: true });
	const sessionFile = join(agentDir, "sessions", "session.jsonl");
	await writeFile(sessionFile, "");
	await git(project, "init", "--quiet", "--initial-branch=main");
	await git(project, "config", "user.name", "Snapshot Test");
	await git(project, "config", "user.email", "snapshot@example.test");
	await git(project, "config", "commit.gpgsign", "false");
	await writeFile(join(project, ".gitignore"), "ignored/\n");
	await writeFile(join(project, "a.txt"), "one\ntwo\nthree\n");
	await writeFile(join(project, "keep.txt"), "unchanged\n");
	await mkdir(join(project, "src"));
	await writeFile(join(project, "src", "move-me.txt"), "a file that will be renamed\nwith enough lines\nto be detected\n");
	await git(project, "add", ".");
	await git(project, "commit", "--quiet", "-m", "initial");
	return { root, project, agentDir, sessionFile };
}
