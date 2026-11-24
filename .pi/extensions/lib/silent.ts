// `/silent` argument parsing: every silence ends on its own, so a forgotten
// focus block can never mute Janus indefinitely.

export const DEFAULT_SILENT_MS = 3 * 60 * 60_000;
export const MAX_SILENT_MS = 12 * 60 * 60_000;

export type SilentArg =
  | { kind: "until"; until: number }
  | { kind: "off" }
  | { kind: "status" }
  | { kind: "error"; message: string };

const USAGE = "Usage: /silent [90m | 2h | 1h30m | until 17:00 | off | status]";

/** Parse a `/silent` argument relative to `now` (local time). */
export function parseSilentArg(raw: string, now: number): SilentArg {
  const arg = raw.trim().toLowerCase();
  if (arg === "") return { kind: "until", until: now + DEFAULT_SILENT_MS };
  if (arg === "off") return { kind: "off" };
  if (arg === "status") return { kind: "status" };

  const clock = /^(?:until\s+)?(\d{1,2}):(\d{2})$/.exec(arg);
  if (clock) {
    const [hours, minutes] = [Number(clock[1]), Number(clock[2])];
    if (hours > 23 || minutes > 59) return { kind: "error", message: USAGE };
    const end = new Date(now);
    end.setHours(hours, minutes, 0, 0);
    // A time already past today means tomorrow.
    if (end.getTime() <= now) end.setDate(end.getDate() + 1);
    return bounded(end.getTime() - now, now);
  }

  const duration = /^(?:(\d+)h)?\s*(?:(\d+)m)?$/.exec(arg);
  if (duration && (duration[1] || duration[2])) {
    const ms = (Number(duration[1] ?? 0) * 60 + Number(duration[2] ?? 0)) * 60_000;
    return bounded(ms, now);
  }
  return { kind: "error", message: USAGE };
}

function bounded(ms: number, now: number): SilentArg {
  if (ms <= 0) return { kind: "error", message: "The silent window must be longer than zero." };
  if (ms > MAX_SILENT_MS) return { kind: "error", message: "The silent window is capped at 12h." };
  return { kind: "until", until: now + ms };
}

export function formatClock(time: number): string {
  const date = new Date(time);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
