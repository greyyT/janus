import { existsSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// The coordinator works with six built-in tools. Tools registered by other
// extensions stay inactive and are blocked if called; agents are spawned
// through the herdr-delegation skill instead.
const ALLOWED_TOOLS = ["read", "grep", "find", "write", "edit", "bash"];

// The nearest ancestor containing .git, or the start directory when none does.
function repositoryRoot(start: string): string {
  for (let dir = start; ; dir = dirname(dir)) {
    if (existsSync(join(dir, ".git"))) return dir;
    if (dirname(dir) === dir) return start;
  }
}

export default function harness(pi: ExtensionAPI): void {
  const pin = async () => {
    const available = new Set(pi.getAllTools().map(tool => tool.name));
    await pi.setActiveTools(ALLOWED_TOOLS.filter(name => available.has(name)));
  };

  pi.on("session_start", pin);

  pi.on("before_agent_start", async (event, ctx) => {
    await pin();
    // Advertise only skills that live in this repository, not user-level ones.
    const root = repositoryRoot(ctx.cwd) + sep;
    const options = event.systemPromptOptions;
    options.skills = options.skills.filter(skill => skill.filePath.startsWith(root));
  });

  pi.on("tool_call", event => {
    if (ALLOWED_TOOLS.includes(event.toolName)) return;
    return { block: true, reason: `The coordinator harness only allows: ${ALLOWED_TOOLS.join(", ")}.` };
  });
}
