import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const DREAM = fileURLToPath(new URL("../../../tools/dream/dream.sh", import.meta.url));

// Catches up a missed 03:00 Dream before Greyy's prompt reaches Janus: the
// script returns at once when no dream is due, otherwise once the uncommitted
// changes have moved to the dream worktree; the rest runs in the background.
// It also reports a failed dream that nobody has seen yet.
export default function dream(pi: ExtensionAPI): void {
  if (process.env.JANUS_DREAM) return;

  pi.on("input", async (event, ctx) => {
    if (event.source === "extension") return;
    const { code, stdout, stderr } = await pi.exec(DREAM, ["catch-up"]);
    if (code !== 0) ctx.ui.notify(stderr.trim() || `Dream catch-up exited with ${code}.`, "warning");
    else if (stdout.trim()) ctx.ui.notify(stdout.trim(), "info");
  });
}
