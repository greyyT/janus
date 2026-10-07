import type { BoundaryResult, ExtensionAPI } from "@earendil-works/pi-coding-agent";

export const CLAUDE_COMPACTION_THRESHOLD = 150_000;
export const COMPACTION_REMINDER =
  "<system-reminder>Your context is getting large. Finish your current work and checkpoint progress, then immediately call compact with a reviewed resume packet. Start any next work only after compaction.</system-reminder>";

/** Warn and compact at a safe boundary without waiting for another user input. */
export function coordinateCompaction(pi: ExtensionAPI) {
  let pending: string | undefined;
  let warned = false;

  pi.on("session_compact", () => { warned = false; });
  pi.on("turn_end", (event, ctx): BoundaryResult | undefined => {
    if (pending !== undefined) {
      const summary = pending;
      pending = undefined;
      if (event.outcome !== "completed") {
        ctx.ui.notify("Selected-context compaction cancelled: the tool turn did not complete. History was retained.", "warning");
        return;
      }
      warned = false;
      // Pi persists this entry and refreshes model context before the next request.
      // null retains only the packet, not an arbitrary tail of the old conversation.
      // Unlike ctx.compact(), this does not abort the active run or call a summarizer.
      return {
        entries: [{ type: "compaction", summary, firstKeptEntryId: null }],
        continue: true,
      };
    }
    if (event.outcome !== "completed") return;
    const model = ctx.model;
    if (!model || !/claude/i.test(`${model.id} ${model.name}`)) return;
    const tokens = ctx.getContextUsage()?.tokens;
    if (tokens == null) return;
    if (tokens < CLAUDE_COMPACTION_THRESHOLD) {
      warned = false;
      return;
    }
    if (warned) return;
    warned = true;
    return {
      entries: [{
        type: "custom_message",
        customType: "coordinate-context-limit",
        content: COMPACTION_REMINDER,
        display: true,
      }],
      continue: true,
    };
  });

  pi.on("agent_settled", () => { pending = undefined; });
  pi.on("session_shutdown", () => { pending = undefined; });

  return (content: string) => {
    if (!content.trim()) throw new Error("compact_content must contain a non-empty resume packet.");
    if (pending !== undefined) throw new Error("A compaction is already queued for this turn.");
    pending = content;
  };
}
