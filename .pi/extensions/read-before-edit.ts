/**
 * Read-before-edit guard.
 *
 * Blocks an `edit` (or a `write` over an existing file) when this session has
 * not read the file, or when the file changed on disk since Janus last read or
 * wrote it, e.g. another session or a `git pull` touched it. A stale edit can
 * succeed silently in the wrong place; this turns it into a loud, cheap block.
 *
 * State is per session and in memory: path -> sha256 of the whole file as of
 * the last successful read, edit, or write. A partial read (offset/limit)
 * still records the hash of the whole file.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

function resolvePath(cwd: string, raw: unknown): string | undefined {
	if (typeof raw !== "string" || raw.length === 0) return undefined;
	let path = raw.startsWith("@") ? raw.slice(1) : raw;
	if (path === "~" || path.startsWith("~/")) path = homedir() + path.slice(1);
	return resolve(cwd, path);
}

function hashFile(path: string): string | undefined {
	try {
		return createHash("sha256").update(readFileSync(path)).digest("hex");
	} catch {
		return undefined;
	}
}

export default function readBeforeEditExtension(pi: ExtensionAPI) {
	const seen = new Map<string, string>();

	pi.on("session_start", () => {
		seen.clear();
	});

	pi.on("tool_call", (event, ctx) => {
		if (event.toolName !== "edit" && event.toolName !== "write") return;
		const path = resolvePath(ctx.cwd, (event.input as { path?: unknown }).path);
		if (!path) return;
		// Creating a new file needs no prior read.
		if (event.toolName === "write" && !existsSync(path)) return;

		const known = seen.get(path);
		if (known === undefined) {
			return {
				block: true,
				reason: `read-before-edit: ${path} has not been read in this session. Read it first, then retry the ${event.toolName}.`,
			};
		}
		if (hashFile(path) !== known) {
			return {
				block: true,
				reason: `read-before-edit: ${path} changed on disk since you last read it (another session, a git operation, or a bash command). Re-read it, then rebuild the ${event.toolName} against the current content.`,
			};
		}
	});

	pi.on("tool_result", (event, ctx) => {
		if (event.isError) return;
		if (event.toolName !== "read" && event.toolName !== "edit" && event.toolName !== "write") return;
		const path = resolvePath(ctx.cwd, event.input.path);
		if (!path) return;
		const hash = hashFile(path);
		if (hash === undefined) seen.delete(path);
		else seen.set(path, hash);
	});
}
