import { describe, expect, test } from "vitest";
import { DEFAULT_SILENT_MS, parseSilentArg } from "../../.pi/extensions/lib/silent.ts";

const now = new Date(2026, 10, 24, 14, 0, 0).getTime();
const at = (h: number, m: number, dayOffset = 0) => new Date(2026, 10, 24 + dayOffset, h, m, 0).getTime();

describe("parseSilentArg", () => {
  test("defaults to 3h", () => {
    expect(parseSilentArg("", now)).toEqual({ kind: "until", until: now + DEFAULT_SILENT_MS });
  });
  test.each([
    ["90m", now + 90 * 60_000],
    ["2h", now + 2 * 3_600_000],
    ["1h30m", now + 90 * 60_000],
    ["until 17:00", at(17, 0)],
    ["17:00", at(17, 0)],
    ["until 01:00", at(1, 0, 1)],
  ])("%s", (arg, until) => {
    expect(parseSilentArg(arg, now)).toEqual({ kind: "until", until });
  });
  test("off and status", () => {
    expect(parseSilentArg("off", now).kind).toBe("off");
    expect(parseSilentArg(" Status ", now).kind).toBe("status");
  });
  test.each(["0m", "13h", "25:00", "soon", "until"])("rejects %s", (arg) => {
    expect(parseSilentArg(arg, now).kind).toBe("error");
  });
});
