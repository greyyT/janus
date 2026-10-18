import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const WEEKLY = fileURLToPath(new URL("../../../tools/weekly/weekly.sh", import.meta.url));

// Catches up a missed Monday 04:00 weekly review before the user's prompt: the
// script returns at once when no review is due, otherwise starts it in the
// background. It also reports a failed review nobody has seen yet.
export default function weekly(pi: ExtensionAPI): void {
  if (process.env.JANUS_DREAM) return;

  pi.on("input", async (event, ctx) => {
    if (event.source === "extension") return;
    const { code, stdout, stderr } = await pi.exec(WEEKLY, ["catch-up"]);
    if (code !== 0) ctx.ui.notify(stderr.trim() || `Weekly catch-up exited with ${code}.`, "warning");
    else if (stdout.trim()) ctx.ui.notify(stdout.trim(), "info");
  });
}
