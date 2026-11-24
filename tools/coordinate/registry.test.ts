import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { claimSocket, drainSpool, loadRegistry, registryPathFor, saveRegistry, socketPathFor, spoolDirFor } from "../../.pi/extensions/coordinate/registry.ts";

const dir = () => mkdtempSync(join(tmpdir(), "jc-"));

describe("coordinate registry", () => {
  it("derives the socket path from the workspace, not the process", () => {
    expect(socketPathFor("w1", "/t")).toBe("/t/janus-coordinate-w1.sock");
    expect(socketPathFor("w1:x", "/t")).toBe("/t/janus-coordinate-w1_x.sock");
    expect(spoolDirFor("/t/a.sock")).toBe("/t/a.sock.spool");
  });

  it("round-trips the registry and tolerates a missing or corrupt file", () => {
    const path = registryPathFor(join(dir(), "nested"), "w1");
    expect(loadRegistry(path)).toEqual({});
    const entry = { name: "n", repo: "/r", tabId: "w1:t2", paneId: "w1:p3", startedAt: 1 };
    saveRegistry(path, { abc: entry });
    expect(loadRegistry(path)).toEqual({ abc: entry });
    writeFileSync(path, "{not json");
    expect(loadRegistry(path)).toEqual({});
  });

  it("drains spooled results oldest first and deletes them", () => {
    const spool = join(dir(), "s.sock.spool");
    mkdirSync(spool);
    writeFileSync(join(spool, "2-b.json"), JSON.stringify({ id: "b", result: "second" }));
    writeFileSync(join(spool, "1-a.json"), JSON.stringify({ id: "a", result: "first" }));
    writeFileSync(join(spool, "3-x.json"), "garbage");
    expect(drainSpool(spool)).toEqual([{ id: "a", result: "first" }, { id: "b", result: "second" }]);
    expect(drainSpool(spool)).toEqual([]);
  });

  it("removes a dead socket file but refuses a live one", async () => {
    const stale = join(dir(), "stale.sock");
    writeFileSync(stale, "");
    expect(await claimSocket(stale)).toBe("free");
    expect(existsSync(stale)).toBe(false);

    const live = join(dir(), "live.sock");
    const server = createServer(s => s.end());
    await new Promise<void>(r => server.listen(live, r));
    expect(await claimSocket(live)).toBe("taken");
    server.close();
  });
});
