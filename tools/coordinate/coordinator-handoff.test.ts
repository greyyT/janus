import { describe, expect, it } from "vitest";
import contextHandoff, { HANDOFF_THRESHOLD } from "../../coordinator/.pi/extensions/context-handoff/index.ts";

type Handler = (event: { outcome: string }, ctx: { getContextUsage: () => { tokens: number } | undefined }) => unknown;

function setup() {
  let handler: Handler | undefined;
  contextHandoff({ on: (_name: string, callback: Handler) => { handler = callback; } } as Parameters<typeof contextHandoff>[0]);
  if (!handler) throw new Error("turn_end handler not registered");
  const turn = (outcome: string, tokens?: number) => handler!({ outcome }, { getContextUsage: () => tokens === undefined ? undefined : { tokens } });
  return turn;
}

describe("coordinator context handoff reminder", () => {
  it("continues once at the threshold and rearms below it", () => {
    const turn = setup();
    expect(turn("completed", HANDOFF_THRESHOLD - 1)).toBeUndefined();
    const result = turn("completed", HANDOFF_THRESHOLD) as { entries: { content: string }[]; continue: boolean };
    expect(result.continue).toBe(true);
    expect(result.entries[0].content).toContain("handoff skill");
    expect(result.entries[0].content).not.toContain("200,000");
    expect(turn("completed", HANDOFF_THRESHOLD + 1)).toBeUndefined();
    expect(turn("completed", HANDOFF_THRESHOLD - 1)).toBeUndefined();
    expect(turn("completed", HANDOFF_THRESHOLD)).toEqual(result);
  });

  it("does not warn on abort, error, or unknown usage", () => {
    const turn = setup();
    expect(turn("aborted", HANDOFF_THRESHOLD)).toBeUndefined();
    expect(turn("error", HANDOFF_THRESHOLD)).toBeUndefined();
    expect(turn("completed")).toBeUndefined();
    expect(turn("completed", HANDOFF_THRESHOLD)).toBeDefined();
  });
});
