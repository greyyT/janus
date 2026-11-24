import type { BoundaryResult, ExtensionAPI } from "@earendil-works/pi-coding-agent";

export const HANDOFF_THRESHOLD = 200_000;
export const HANDOFF_REMINDER =
  "<system-reminder>Your context is getting large. Finish the current work and checkpoint progress, then hand off to a fresh coordinator session using the handoff skill before starting any next work. Preserve the execution state and live resources in the reviewed resume packet. If the work is complete, report the result instead of handing off.</system-reminder>";

export default function contextHandoff(pi: ExtensionAPI): void {
  let warned = false;
  pi.on("turn_end", (event, ctx): BoundaryResult | undefined => {
    if (event.outcome !== "completed") return;
    const tokens = ctx.getContextUsage()?.tokens;
    if (tokens == null) return;
    if (tokens < HANDOFF_THRESHOLD) {
      warned = false;
      return;
    }
    if (warned) return;
    warned = true;
    return {
      entries: [{ type: "custom_message", customType: "coordinator-context-handoff", content: HANDOFF_REMINDER, display: true }],
      continue: true,
    };
  });
}
