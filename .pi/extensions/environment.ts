import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { PROTECTED_ROOT_FILES, isMarkdownBasename } from "../../tools/brain/lib/classify";

const ENVIRONMENT_OPEN = "[ENVIRONMENT]";
const ENVIRONMENT_CLOSE = "[/ENVIRONMENT]";
const USER_PROFILE_OPEN = "<user-profile>";
const USER_PROFILE_CLOSE = "</user-profile>";
const REPO_RULES_SENTINEL = "<!-- Janus environment extension repo rules -->";
const REPO_RULES_CLOSE = "</repo-rules>";

interface LocalDateParts {
	year: number;
	month: number;
	day: number;
	weekday: string;
}

function localDateParts(now: Date, timeZone: string): LocalDateParts {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		weekday: "long",
	}).formatToParts(now);
	const lookup = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
	return {
		year: Number(lookup("year")),
		month: Number(lookup("month")),
		day: Number(lookup("day")),
		weekday: lookup("weekday"),
	};
}

function isoDate({ year, month, day }: LocalDateParts): string {
	const pad = (value: number) => String(value).padStart(2, "0");
	return `${year}-${pad(month)}-${pad(day)}`;
}

function isoWeek({ year, month, day }: LocalDateParts): string {
	// UTC noon avoids day shifts from timezone math on the local calendar date.
	const date = new Date(Date.UTC(year, month - 1, day, 12));
	const dayOfWeek = date.getUTCDay() || 7;
	date.setUTCDate(date.getUTCDate() + 4 - dayOfWeek);
	const weekYear = date.getUTCFullYear();
	const yearStart = Date.UTC(weekYear, 0, 1, 12);
	const week = Math.ceil(((date.getTime() - yearStart) / 86_400_000 + 1) / 7);
	return `${weekYear}-W${String(week).padStart(2, "0")}`;
}

function journalStatus(root: string, date: string): string {
	const relativePath = `journal/${date}.md`;
	return `${relativePath} (${existsSync(join(root, relativePath)) ? "exists" : "missing"})`;
}

function inboxStatus(root: string): string {
	const inboxNotes = readdirSync(root, { withFileTypes: true }).filter(
		(entry) =>
			entry.isFile() && isMarkdownBasename(entry.name) && !PROTECTED_ROOT_FILES.has(entry.name),
	).length;
	return `${inboxNotes} note${inboxNotes === 1 ? "" : "s"}`;
}

/** Session-stable half of the environment block; must not embed clock or repo state. */
export function environmentContext(modelName = "unavailable", root = process.cwd()): string {
	const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "unknown";

	return `
${ENVIRONMENT_OPEN}
## Runtime Environment

- Time zone: ${timeZone}
- Working directory: ${root}
- Model: ${modelName}

The current date, time, and Janus state arrive in a separate per-turn
environment message. Use the most recent one and do not infer a different
date or time unless the user supplies one.
${ENVIRONMENT_CLOSE}
`;
}

/** Per-turn half; delivered as a message so it never invalidates the cached prefix. */
export function environmentTurnContext(now = new Date(), root = process.cwd()): string {
	const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "unknown";
	const localTime = new Intl.DateTimeFormat("en-CA", {
		dateStyle: "full",
		timeStyle: "long",
		timeZone,
	}).format(now);
	const dateParts = localDateParts(now, timeZone);
	const today = isoDate(dateParts);

	let janusState: string;
	try {
		janusState = [
			`- Today's journal: ${journalStatus(root, today)}`,
			`- Root inbox: ${inboxStatus(root)}`,
		].join("\n");
	} catch (error) {
		janusState = `- Janus state unavailable: ${error instanceof Error ? error.message : String(error)}`;
	}

	return `## Current Turn Context

- Current local date and time: ${localTime}
- Today (ISO): ${today} · ${isoWeek(dateParts)} · ${dateParts.weekday}
${janusState}

Treat this as the authoritative current-time context for this turn. Use the
ISO date for journal paths, task fields, and command --date arguments. The
Janus state lines are cheap signals, not full context; read the underlying
files before acting on them.`;
}

function userProfileContext(root: string): string {
	const profilePath = join(root, ".pi", "profile.md");
	if (!existsSync(profilePath)) return "";

	const profile = readFileSync(profilePath, "utf8");
	const trailingNewline = profile.endsWith("\n") ? "" : "\n";
	return `
${USER_PROFILE_OPEN}
${profile}${trailingNewline}${USER_PROFILE_CLOSE}
`;
}

function repoRulesContext(root: string): string {
	const rulesPath = join(root, "AGENTS.md");
	if (!existsSync(rulesPath)) return "";

	const rules = readFileSync(rulesPath, "utf8");
	const trailingNewline = rules.endsWith("\n") ? "" : "\n";
	return `
${REPO_RULES_SENTINEL}
<repo-rules>
You MUST follow the context files below for all tasks:
<file path="${rulesPath}">
${rules}${trailingNewline}</file>
${REPO_RULES_CLOSE}
`;
}

function removePreviousContext(systemPrompt: string): string {
	const environmentOpenIndex = systemPrompt.indexOf(ENVIRONMENT_OPEN);
	const environmentCloseIndex = systemPrompt.indexOf(ENVIRONMENT_CLOSE);
	let basePrompt =
		environmentOpenIndex === -1 || environmentCloseIndex === -1
			? systemPrompt
			: `${systemPrompt.slice(0, environmentOpenIndex)}${systemPrompt.slice(environmentCloseIndex + ENVIRONMENT_CLOSE.length)}`;

	const profileOpenIndex = basePrompt.indexOf(USER_PROFILE_OPEN);
	const profileCloseIndex = basePrompt.indexOf(USER_PROFILE_CLOSE, profileOpenIndex);
	if (profileOpenIndex !== -1 && profileCloseIndex !== -1) {
		basePrompt = `${basePrompt.slice(0, profileOpenIndex)}${basePrompt.slice(profileCloseIndex + USER_PROFILE_CLOSE.length)}`;
	}

	const rulesOpenIndex = basePrompt.indexOf(REPO_RULES_SENTINEL);
	const rulesCloseIndex = basePrompt.indexOf(REPO_RULES_CLOSE, rulesOpenIndex);
	if (rulesOpenIndex !== -1 && rulesCloseIndex !== -1) {
		basePrompt = `${basePrompt.slice(0, rulesOpenIndex)}${basePrompt.slice(rulesCloseIndex + REPO_RULES_CLOSE.length)}`;
	}

	return basePrompt.trimEnd();
}

/**
 * Splits local context so the system prompt stays byte-identical for the whole
 * session: static halves are memoized, volatile state rides a per-turn message.
 */
export default function environmentExtension(pi: ExtensionAPI) {
	let frozenContext: string | undefined;

	pi.on("session_start", () => {
		frozenContext = undefined;
	});

	pi.on("before_agent_start", (event, ctx) => {
		const root = ctx.cwd;
		if (frozenContext === undefined) {
			frozenContext = [
				userProfileContext(root),
				environmentContext(ctx.model?.name ?? "unavailable", root),
				repoRulesContext(root),
			]
				.filter(Boolean)
				.join("\n");
		}

		return {
			systemPrompt: `${removePreviousContext(event.systemPrompt)}\n${frozenContext}`,
			message: {
				customType: "environment",
				content: environmentTurnContext(new Date(), root),
				display: false,
			},
		};
	});
}
