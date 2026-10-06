import { createConnection } from "node:net";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const STATUS_LINE = /^STATUS: (completed|blocked|needs_input|failed)$/;
const REQUIRED_SECTIONS = ["OUTCOME", "CHANGES", "VERIFICATION", "REMAINING_CONCERNS", "IMPLICATIONS"];
const MAX_FORMAT_REMINDERS = 2;

function formatProblems(result: string): string[] {
  const [firstLine = "", ...rest] = result.split("\n");
  const status = STATUS_LINE.exec(firstLine.trim())?.[1];
  const problems = status ? [] : ["the first line is not exactly `STATUS: completed | blocked | needs_input | failed`"];
  const sections = status === "needs_input" ? [...REQUIRED_SECTIONS, "DECISION_NEEDED"] : REQUIRED_SECTIONS;
  const missing = sections.filter(section => !rest.some(line => line.startsWith(`${section}:`)));
  if (missing.length) problems.push(`missing sections: ${missing.join(", ")}`);
  return problems;
}

const failureReport = (outcome: string) => `STATUS: failed\n\nOUTCOME:\n${outcome}`;

// Runs only in coordinators spawned by Janus's `/coordinate` mode, which sets
// both variables; a handoff passes them on. Each session tells Janus which
// pane it runs in, and every stop that is not an abort reports back to Janus.
export default function janusReport(pi: ExtensionAPI): void {
  const socketPath = process.env.JANUS_COORDINATE_SOCKET;
  const coordinatorId = process.env.JANUS_COORDINATOR_ID;
  if (!socketPath || !coordinatorId) return;

  let remindersSent = 0;

  const sendToJanus = (report: { result: string } | { pane: string }) =>
    new Promise<void>((resolve, reject) => {
      const socket = createConnection(socketPath, () => socket.end(JSON.stringify({ id: coordinatorId, ...report })));
      socket.on("close", () => resolve());
      socket.on("error", reject);
    });

  pi.on("session_start", async (_event, ctx) => {
    const pane = process.env.HERDR_PANE_ID;
    if (!pane) return;
    try {
      await sendToJanus({ pane });
    } catch (error) {
      ctx.ui.notify(`Could not reach Janus at ${socketPath}: ${(error as Error).message}`, "error");
    }
  });

  pi.on("agent_before_settle", async (event, ctx) => {
    if (event.outcome === "aborted" || event.continue) return;

    const lastReply = event.context.llmMessages.findLast(message => message.role === "assistant");
    let result: string;
    if (event.outcome === "error") {
      result = failureReport(`The coordinator stopped with an error: ${lastReply?.errorMessage ?? "unknown error"}`);
    } else {
      const text = (lastReply?.content ?? []).flatMap(block => (block.type === "text" ? [block.text] : [])).join("\n").trim();
      const problems = formatProblems(text);
      if (problems.length && remindersSent < MAX_FORMAT_REMINDERS) {
        remindersSent++;
        const reminder = `<system-reminder>The output doesn't follow the result format: ${problems.join("; ")}. Rewrite your final message as the result block from your system prompt, starting with the STATUS line and with nothing before it. Do no further work.</system-reminder>`;
        return { entries: [{ type: "custom_message", customType: "janus-result-format", content: reminder, display: true }], continue: true };
      }
      result = problems.length
        ? failureReport(`The coordinator's final message did not follow the result format after ${remindersSent} reminders (${problems.join("; ")}). Its final message was:\n\n${text}`)
        : text;
    }

    remindersSent = 0;
    try {
      await sendToJanus({ result });
    } catch (error) {
      ctx.ui.notify(`Could not report to Janus at ${socketPath}: ${(error as Error).message}`, "error");
    }
  });
}
