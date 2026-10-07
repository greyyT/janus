import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { coordinateCompaction } from "./compact.ts";

type Workspace = { workspace_id: string; label: string };
type Mode = { janusPane: string; workspace: Workspace };
type TabCreated = { tab: { tab_id: string }; root_pane: { pane_id: string } };
type Coordinator = { name: string; repo: string; tabId: string; paneId: string };

const NEW_WORKSPACE = "New workspace…";
const COORDINATOR_DIR = fileURLToPath(new URL("../../../coordinator", import.meta.url));
const TAB_STARTUP_MS = 5_000;
const PI_STARTUP_MS = 2_000;
const SOCKET_PATH = join(tmpdir(), `janus-coordinate-${process.pid}.sock`);
const COORDINATE_MODE_PROMPT = new URL("coordinate-mode.md", import.meta.url);

// `/coordinate` is one-way: once on, the mode lasts until the session is killed.
// Coordinators run in the chosen Herdr workspace and report each stop over a
// Unix socket, so results never touch the editor the user types in. A result is
// handed to the model at once when Janus is idle; otherwise it waits for the
// next stop that completes normally (an aborted run keeps the queue).
export default function coordinate(pi: ExtensionAPI): void {
  let mode: Mode | undefined;
  let server: Server | undefined;
  let isJanusIdle = () => false;
  let lastOutcome: string | undefined;
  const coordinators = new Map<string, Coordinator>();
  const pendingResults: string[] = [];

  const herdr = async (args: string[], signal?: AbortSignal) => {
    const { code, stdout, stderr } = await pi.exec("herdr", args, { signal });
    if (code !== 0) throw new Error(`herdr ${args.join(" ")} failed: ${stderr.trim() || `exit ${code}`}`);
    return stdout.trim() ? JSON.parse(stdout).result : undefined;
  };

  const deliverNextResult = () => {
    const next = pendingResults.shift();
    if (next) pi.sendUserMessage(next);
  };

  // A coordinator sends `{ id, pane }` when a session starts, including the
  // fresh session a handoff creates, and `{ id, result }` at each stop.
  const receiveReport = (payload: string, ctx: ExtensionCommandContext) => {
    let report: { id: string; result?: string; pane?: string };
    try {
      report = JSON.parse(payload);
    } catch {
      ctx.ui.notify(`Ignored a malformed coordinator report: ${payload.slice(0, 200)}`, "warning");
      return;
    }
    const coordinator = coordinators.get(report.id);
    if (report.pane !== undefined) {
      if (coordinator && coordinator.paneId !== report.pane) {
        coordinator.paneId = report.pane;
        ctx.ui.notify(`Coordinator ${report.id} (${coordinator.name}) continues in pane ${report.pane}.`, "info");
      }
      return;
    }
    pendingResults.push(`<coordinator_result id="${report.id}" name="${coordinator?.name ?? "unknown"}">\n${report.result}\n</coordinator_result>`);
    if (isJanusIdle()) deliverNextResult();
  };

  const listenForResults = (ctx: ExtensionCommandContext) =>
    new Promise<Server>((resolve, reject) => {
      const resultServer = createServer(socket => {
        let payload = "";
        socket.setEncoding("utf8");
        socket.on("data", chunk => (payload += chunk));
        socket.on("end", () => receiveReport(payload, ctx));
      });
      resultServer.once("error", reject);
      resultServer.listen(SOCKET_PATH, () => resolve(resultServer));
    });

  // Read on every run so edits to coordinate-mode.md apply without a restart.
  pi.on("before_agent_start", event => {
    if (mode) event.systemPromptOptions.sections["system-reminder"] = readFileSync(COORDINATE_MODE_PROMPT, "utf8").trim();
  });
  // pi skips agent_before_settle when a run is aborted, so a run with no
  // recorded outcome by agent_settled was aborted.
  pi.on("agent_start", () => {
    lastOutcome = undefined;
  });
  pi.on("agent_before_settle", event => {
    lastOutcome = event.outcome;
  });
  pi.on("agent_settled", () => {
    if (lastOutcome === "completed") deliverNextResult();
  });
  pi.on("session_shutdown", () => {
    server?.close();
  });

  const registerTools = (workspace: Workspace) => {
    const queueCompaction = coordinateCompaction(pi);
    pi.registerTool({
      name: "compact",
      label: "Compact selected context",
      description:
        "Replace the current conversation context with your own minimal resume packet, verbatim, and continue in this same session. Follow the handoff skill's content-selection criteria, not its transfer script. Call this tool alone after checkpointing durable records; include all active coordination work, live coordinator IDs, unresolved decisions and exact next actions. Coordinator runtime state and queued reports survive. Old conversation remains in the transcript but is no longer model context.",
      parameters: Type.Object({
        compact_content: Type.String({
          minLength: 1,
          description:
            "The complete selected-context resume packet for the next model turn: outcome, actual checkpoint and verification, constraints and decisions, precise next action and stopping point, minimal artifact references, and live resources. At most three initial read files. No secrets, chronological narration, duplicated documents or unrelated context.",
        }),
      }),
      async execute(_toolCallId, { compact_content }) {
        queueCompaction(compact_content);
        return {
          content: [{ type: "text", text: "Compaction queued for the end of this tool turn. The next model turn will resume from compact_content; coordination runtime state is unchanged." }],
          details: undefined,
        };
      },
    });

    pi.registerTool({
      name: "spawn_coordinator",
      label: "Spawn coordinator",
      description:
        "Start a coordinator in a new tab of the coordinator workspace and send it one execution request for one repository. Returns the coordinator ID once the request is sent; it does not wait for the coordinator to finish.",
      parameters: Type.Object({
        name: Type.String({ description: "Short human-readable name for this coordinator's work, shown in list_coordinators." }),
        repo: Type.String({ description: "Absolute path of the target repository or worktree." }),
        request: Type.String({
          description:
            "The execution request: desired outcome, relevant context, scope and constraints, and acceptance or verification requirements. Never include ticket IDs or ticket content.",
        }),
      }),
      async execute(_toolCallId, { name, repo, request }, signal) {
        const id = randomBytes(3).toString("hex");
        const { tab, root_pane: pane }: TabCreated = await herdr(
          [
            "tab", "create", "--workspace", workspace.workspace_id, "--cwd", COORDINATOR_DIR, "--label", id, "--no-focus",
            "--env", `JANUS_COORDINATE_SOCKET=${SOCKET_PATH}`, "--env", `JANUS_COORDINATOR_ID=${id}`,
          ],
          signal,
        );
        coordinators.set(id, { name, repo, tabId: tab.tab_id, paneId: pane.pane_id });
        await sleep(TAB_STARTUP_MS, undefined, { signal });
        await herdr(["pane", "run", pane.pane_id, "pi"], signal);
        await sleep(PI_STARTUP_MS, undefined, { signal });
        await herdr(["pane", "send-text", pane.pane_id, `Target repository: ${repo}\n\n${request}`], signal);
        await herdr(["pane", "send-keys", pane.pane_id, "enter"], signal);
        return {
          content: [{ type: "text", text: `Started ${id} (${name}) in tab ${tab.tab_id} (pane ${pane.pane_id}) and sent the request.` }],
          details: { id, name, tabId: tab.tab_id, paneId: pane.pane_id, repo },
        };
      },
    });

    pi.registerTool({
      name: "list_coordinators",
      label: "List coordinators",
      description: "List the coordinators spawned in this session as `<id>: <name>`.",
      parameters: Type.Object({}),
      async execute() {
        const lines = [...coordinators].map(([id, { name }]) => `${id}: ${name}`);
        return {
          content: [{ type: "text", text: lines.length ? lines.join("\n") : "No coordinators spawned in this session." }],
          details: undefined,
        };
      },
    });

    const findCoordinator = (id: string) => {
      const coordinator = coordinators.get(id);
      if (!coordinator) throw new Error(`Unknown coordinator ID: ${id}. Use list_coordinators to see the IDs.`);
      return coordinator;
    };
    const coordinatorId = Type.String({ description: "Coordinator ID from spawn_coordinator or list_coordinators." });

    pi.registerTool({
      name: "send_to_coordinator",
      label: "Send to coordinator",
      description:
        "Send a message to a running coordinator, for example an answer to its question or a correction. It is typed into the coordinator's pi session and submitted.",
      parameters: Type.Object({ id: coordinatorId, message: Type.String({ description: "The message to send." }) }),
      async execute(_toolCallId, { id, message }, signal) {
        const { name, paneId } = findCoordinator(id);
        await herdr(["pane", "send-text", paneId, message], signal);
        await herdr(["pane", "send-keys", paneId, "enter"], signal);
        return { content: [{ type: "text", text: `Sent the message to ${id} (${name}).` }], details: undefined };
      },
    });

    pi.registerTool({
      name: "stop_coordinator",
      label: "Stop coordinator",
      description: "Stop a coordinator: close its tab, which ends its pi session, and remove it from list_coordinators.",
      parameters: Type.Object({ id: coordinatorId }),
      async execute(_toolCallId, { id }, signal) {
        const { name, tabId } = findCoordinator(id);
        await herdr(["tab", "close", tabId], signal);
        coordinators.delete(id);
        return { content: [{ type: "text", text: `Stopped ${id} (${name}) and closed tab ${tabId}.` }], details: undefined };
      },
    });
  };

  const chooseWorkspace = async (ctx: ExtensionCommandContext): Promise<Workspace | undefined> => {
    const { workspaces }: { workspaces: Workspace[] } = await herdr(["workspace", "list"]);
    const options = [...workspaces.map(w => `${w.label} (${w.workspace_id})`), NEW_WORKSPACE];
    const choice = await ctx.ui.select("Coordinator workspace", options);
    if (choice === undefined) return undefined;
    if (choice !== NEW_WORKSPACE) return workspaces[options.indexOf(choice)];

    const label = (await ctx.ui.input("New workspace name"))?.trim();
    if (!label) return undefined;
    const { workspace }: { workspace: Workspace } = await herdr(["workspace", "create", "--label", label, "--no-focus"]);
    return workspace;
  };

  const describe = ({ janusPane, workspace }: Mode) =>
    `coordinators run in workspace ${workspace.label} (${workspace.workspace_id}); Janus pane ${janusPane} receives results on ${SOCKET_PATH}`;

  pi.registerCommand("coordinate", {
    description: "Turn on coordinator mode for this session (no off), or `/coordinate status`",
    getArgumentCompletions: prefix =>
      "status".startsWith(prefix) ? [{ value: "status", label: "status" }] : null,
    handler: async (args, ctx) => {
      const subcommand = args.trim();

      if (subcommand === "status") {
        ctx.ui.notify(mode ? `Coordinator mode is on; ${describe(mode)}.` : "Coordinator mode is off.", "info");
        return;
      }
      if (subcommand !== "") {
        ctx.ui.notify("Usage: /coordinate, or /coordinate status", "warning");
        return;
      }
      if (mode) {
        ctx.ui.notify(`Coordinator mode is already on; ${describe(mode)}.`, "info");
        return;
      }

      const janusPane = process.env.HERDR_PANE_ID;
      if (!janusPane) {
        ctx.ui.notify("Coordinator mode needs a Herdr pane: HERDR_PANE_ID is not set.", "error");
        return;
      }
      if (!ctx.hasUI) {
        ctx.ui.notify("Coordinator mode needs the interactive UI to choose a workspace.", "error");
        return;
      }

      let workspace: Workspace | undefined;
      try {
        workspace = await chooseWorkspace(ctx);
      } catch (error) {
        ctx.ui.notify(`Coordinator mode stays off: ${(error as Error).message}`, "error");
        return;
      }
      if (!workspace) {
        ctx.ui.notify("Coordinator mode stays off: no workspace chosen.", "info");
        return;
      }

      try {
        server = await listenForResults(ctx);
      } catch (error) {
        ctx.ui.notify(`Coordinator mode stays off: cannot listen on ${SOCKET_PATH}: ${(error as Error).message}`, "error");
        return;
      }
      isJanusIdle = () => ctx.isIdle();
      mode = { janusPane, workspace };
      // Marks the transcript so Dream ignores everything from here on (tools/brain/lib/sessions.ts).
      pi.appendEntry("janus-coordinate");
      registerTools(workspace);
      ctx.ui.notify(`Coordinator mode is on until this session ends; ${describe(mode)}.`, "info");
    },
  });
}
