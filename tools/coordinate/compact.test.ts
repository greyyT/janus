import { describe, expect, test, vi } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { coordinateCompaction, CLAUDE_COMPACTION_THRESHOLD, COMPACTION_REMINDER } from "../../.pi/extensions/coordinate/compact.ts";

function harness() {
  const handlers = new Map<string, Function>();
  const pi = { on: (name: string, handler: Function) => handlers.set(name, handler) };
  const queue = coordinateCompaction(pi as unknown as ExtensionAPI);
  const notify = vi.fn();
  const ctx = {
    ui: { notify },
    model: { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
    getContextUsage: vi.fn((): { tokens: number | null } | undefined => ({ tokens: 100 })),
  };
  const emit = (name: string, outcome = "completed") => handlers.get(name)?.({ outcome }, ctx);
  return { queue, emit, notify, ctx };
}

describe("Claude coordinate-mode context warning", () => {
  test("injects a visible reminder and requests an immediate continuation at exactly 150k", () => {
    const { ctx, emit } = harness();
    ctx.getContextUsage.mockReturnValue({ tokens: CLAUDE_COMPACTION_THRESHOLD - 1 });
    expect(emit("turn_end")).toBeUndefined();
    ctx.getContextUsage.mockReturnValue({ tokens: CLAUDE_COMPACTION_THRESHOLD });
    expect(COMPACTION_REMINDER).not.toMatch(/150[,_]?000/);
    expect(emit("turn_end")).toEqual({
      entries: [{ type: "custom_message", customType: "coordinate-context-limit", content: COMPACTION_REMINDER, display: true }],
      continue: true,
    });
    ctx.getContextUsage.mockReturnValue({ tokens: CLAUDE_COMPACTION_THRESHOLD + 5_000 });
    expect(emit("turn_end")).toBeUndefined();
    emit("agent_settled");
    expect(emit("turn_end")).toBeUndefined();
  });

  test("does not warn for non-Claude models or unknown usage", () => {
    const { ctx, emit } = harness();
    ctx.model = { id: "gpt-6.1", name: "GPT 6.1" };
    ctx.getContextUsage.mockReturnValue({ tokens: 200_000 });
    expect(emit("turn_end")).toBeUndefined();
    ctx.model = { id: "claude-opus-4-6", name: "Claude Opus 4.6" };
    ctx.getContextUsage.mockReturnValue({ tokens: null });
    expect(emit("turn_end")).toBeUndefined();
    ctx.getContextUsage.mockReturnValue(undefined);
    expect(emit("turn_end")).toBeUndefined();
  });

  test.each(["aborted", "error"])("does not force continuation after %s", outcome => {
    const { ctx, emit } = harness();
    ctx.getContextUsage.mockReturnValue({ tokens: 200_000 });
    expect(emit("turn_end", outcome)).toBeUndefined();
    expect(emit("turn_end").continue).toBe(true);
  });

  test("compaction takes priority over a warning, then rearms it", () => {
    const { ctx, emit, queue } = harness();
    ctx.getContextUsage.mockReturnValue({ tokens: 200_000 });
    expect(emit("turn_end").entries[0].customType).toBe("coordinate-context-limit");
    queue("reviewed packet");
    expect(emit("turn_end").entries).toEqual([{ type: "compaction", summary: "reviewed packet", firstKeptEntryId: null }]);
    ctx.getContextUsage.mockReturnValue({ tokens: null });
    expect(emit("turn_end")).toBeUndefined();
    ctx.getContextUsage.mockReturnValue({ tokens: 150_000 });
    expect(emit("turn_end").continue).toBe(true);
  });

  test("native compaction and falling below the threshold rearm the warning", () => {
    const { ctx, emit } = harness();
    ctx.getContextUsage.mockReturnValue({ tokens: 150_000 });
    expect(emit("turn_end").continue).toBe(true);
    emit("session_compact");
    expect(emit("turn_end").continue).toBe(true);
    ctx.getContextUsage.mockReturnValue({ tokens: 149_999 });
    expect(emit("turn_end")).toBeUndefined();
    ctx.getContextUsage.mockReturnValue({ tokens: 150_000 });
    expect(emit("turn_end").continue).toBe(true);
  });
});

describe("coordinate selected-context compaction", () => {
  test("does nothing unless the tool queues content", () => {
    expect(harness().emit("turn_end")).toBeUndefined();
  });

  test("commits the exact packet without a retained tail and continues once", () => {
    const { queue, emit } = harness();
    const packet = "# Resume\n\nWait for coordinator abc123.\n";
    queue(packet);
    expect(emit("turn_end")).toEqual({
      entries: [{ type: "compaction", summary: packet, firstKeptEntryId: null }],
      continue: true,
    });
    expect(emit("turn_end")).toBeUndefined();
  });

  test.each(["aborted", "error"])("retains history on %s and permits a fresh request", outcome => {
    const { queue, emit, notify } = harness();
    queue("resume");
    expect(emit("turn_end", outcome)).toBeUndefined();
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("History was retained"), "warning");
    expect(emit("turn_end")).toBeUndefined();
    queue("fresh packet");
    expect(emit("turn_end").entries[0].summary).toBe("fresh packet");
  });

  test("rejects empty packets and duplicate calls without replacing the first packet", () => {
    const { queue, emit } = harness();
    expect(() => queue(" \n\t")).toThrow("non-empty");
    queue("first");
    expect(() => queue("second")).toThrow("already queued");
    expect(emit("turn_end").entries[0].summary).toBe("first");
  });

  test.each(["agent_settled", "session_shutdown"])("clears uncommitted content on %s", event => {
    const { queue, emit } = harness();
    queue("stale");
    emit(event);
    expect(emit("turn_end")).toBeUndefined();
    queue("fresh");
    expect(emit("turn_end").entries[0].summary).toBe("fresh");
  });
});
