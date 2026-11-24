// Coordinate mode survives a Janus restart. Coordinators bake the socket path
// into their environment at spawn, so the path depends only on the Herdr
// workspace, not on the Janus process. The registry of spawned coordinators is
// saved per workspace, and a coordinator that cannot reach Janus spools its
// result next to the socket for the next Janus to pick up.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createConnection } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type SavedCoordinator = { name: string; repo: string; tabId: string; paneId: string; startedAt: number };
export type SpooledReport = { id: string; result: string };

const safe = (workspaceId: string) => workspaceId.replace(/[^a-zA-Z0-9_-]/g, "_");

export const socketPathFor = (workspaceId: string, dir = tmpdir()) => join(dir, `janus-coordinate-${safe(workspaceId)}.sock`);
/** Must match the coordinator's janus-report extension: `${socketPath}.spool`. */
export const spoolDirFor = (socketPath: string) => `${socketPath}.spool`;
export const registryPathFor = (registryDir: string, workspaceId: string) => join(registryDir, `${safe(workspaceId)}.json`);

export function loadRegistry(path: string): Record<string, SavedCoordinator> {
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return parsed && typeof parsed === "object" ? parsed.coordinators ?? {} : {};
  } catch {
    return {};
  }
}

export function saveRegistry(path: string, coordinators: Record<string, SavedCoordinator>) {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ coordinators }, null, 2)}\n`);
}

/** Read and delete spooled reports, oldest first. Malformed files are dropped. */
export function drainSpool(spoolDir: string): SpooledReport[] {
  if (!existsSync(spoolDir)) return [];
  const reports: SpooledReport[] = [];
  for (const file of readdirSync(spoolDir).filter(f => f.endsWith(".json")).sort()) {
    const path = join(spoolDir, file);
    try {
      const report = JSON.parse(readFileSync(path, "utf8"));
      if (typeof report?.id === "string" && typeof report?.result === "string") reports.push(report);
    } catch {
      // Skip unreadable files; they are removed below.
    }
    rmSync(path, { force: true });
  }
  return reports;
}

/** True when another Janus is listening on the socket; a dead socket file is removed. */
export function claimSocket(socketPath: string): Promise<"free" | "taken"> {
  if (!existsSync(socketPath)) return Promise.resolve("free");
  return new Promise(resolve => {
    const socket = createConnection(socketPath);
    socket.once("connect", () => { socket.destroy(); resolve("taken"); });
    socket.once("error", () => { rmSync(socketPath, { force: true }); resolve("free"); });
  });
}
