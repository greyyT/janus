import { sep } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// The coordinator works with six built-in tools. Tools registered by other
// extensions stay inactive and are blocked if called; agents are spawned
// through the herdr-delegation skill instead.
const ALLOWED_TOOLS = ["read", "grep", "find", "write", "edit", "bash"];

export default function harness(pi: ExtensionAPI): void {
  const pin = async () => {
    const available = new Set(pi.getAllTools().map(tool => tool.name));
    await pi.setActiveTools(ALLOWED_TOOLS.filter(name => available.has(name)));
  };

  pi.on("session_start", pin);

  pi.on("before_agent_start", async (event, ctx) => {
    await pin();
    // Load only skills and context files inside the coordinator directory, not
    // the enclosing repository's or the user's.
    const own = ctx.cwd + sep;
    const options = event.systemPromptOptions;
    options.skills = options.skills.filter(skill => skill.filePath.startsWith(own));
    options.contextFiles = options.contextFiles.filter(file => file.path.startsWith(own));
  });

  pi.on("tool_call", event => {
    if (ALLOWED_TOOLS.includes(event.toolName)) return;
    return { block: true, reason: `The coordinator harness only allows: ${ALLOWED_TOOLS.join(", ")}.` };
  });
}
