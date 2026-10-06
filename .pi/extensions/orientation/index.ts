import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadCalendarDay, orient } from "../../../tools/brain/lib/index.js";

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));

// Tells Janus, after it answers, what needs Greyy today: once on his first
// prompt of the day, then whenever something new needs him (tools/brain/lib/orientation.ts).
export default function orientation(pi: ExtensionAPI): void {
  if (process.env.JANUS_DREAM) return;
  let pending: string | null = null;

  pi.on("input", async (event, ctx) => {
    if (event.source === "extension") return;
    try {
      pending = await orient(ROOT, {
        now: new Date(),
        loadCalendar: (date) => loadCalendarDay(ROOT, date),
        isPullRequestOpen: async (url) => {
          const { code, stdout } = await pi.exec("gh", ["pr", "view", url, "--json", "state", "--jq", ".state"], { timeout: 5_000 });
          return code === 0 ? stdout.trim() === "OPEN" : null;
        },
      });
    } catch (error) {
      ctx.ui.notify(`Orientation skipped: ${(error as Error).message}`, "warning");
    }
  });

  pi.on("before_agent_start", (event) => {
    if (pending === null) return;
    event.systemPromptOptions.sections.orientation = pending;
    pending = null;
  });
}
