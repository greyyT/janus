import { type LocationClass } from "./classify.js";
import { type BrainDocument, type InboxDocument } from "./documents.js";

export type InboxHygieneStatus = "healthy" | "review_soon" | "action_required";

export interface InboxJsonOutput {
  inbox_count: number;
  hygiene_status: InboxHygieneStatus;
  documents: InboxDocument[];
}

export interface BrainIndex {
  schema_version: 2;
  documents: BrainDocument[];
}

export interface IndexJsonSummary {
  output_path: string;
  document_count: number;
  counts_by_location_class: Record<LocationClass, number>;
  warning_count: number;
}

export function getInboxHygieneStatus(inboxCount: number): InboxHygieneStatus {
  if (inboxCount <= 10) {
    return "healthy";
  }

  if (inboxCount <= 19) {
    return "review_soon";
  }

  return "action_required";
}

export function createInboxJsonOutput(documents: InboxDocument[]): InboxJsonOutput {
  return {
    inbox_count: documents.length,
    hygiene_status: getInboxHygieneStatus(documents.length),
    documents,
  };
}

export function createIndexSummary(outputPath: string, documents: BrainDocument[]): IndexJsonSummary {
  const counts_by_location_class = createEmptyLocationCounts();
  let warningCount = 0;

  for (const document of documents) {
    counts_by_location_class[document.location_class] += 1;
    warningCount += document.warnings.length;
  }

  return {
    output_path: outputPath,
    document_count: documents.length,
    counts_by_location_class,
    warning_count: warningCount,
  };
}

export function formatInboxHuman(output: InboxJsonOutput): string {
  const lines = [
    `Inbox notes: ${output.inbox_count} (${formatHygieneStatus(output.hygiene_status)})`,
  ];

  if (output.documents.length === 0) {
    lines.push("No root inbox notes found.");
    return lines.join("\n");
  }

  for (const document of output.documents) {
    const project = document.project === undefined ? "" : ` [project: ${document.project}]`;
    lines.push(`- ${document.path} — ${document.title} — ${formatAge(document.age_days)}${project}`);

    for (const warning of document.frontmatter_warnings) {
      lines.push(`  warning: ${warning}`);
    }
  }

  return lines.join("\n");
}

export function formatIndexHuman(summary: IndexJsonSummary): string {
  return [
    `Wrote ${summary.output_path}`,
    `Documents: ${summary.document_count}`,
    `protected_root: ${summary.counts_by_location_class.protected_root}`,
    `journal: ${summary.counts_by_location_class.journal}`,
    `inbox: ${summary.counts_by_location_class.inbox}`,
    `wiki: ${summary.counts_by_location_class.wiki}`,
    `archive: ${summary.counts_by_location_class.archive}`,
    `Warnings: ${summary.warning_count}`,
  ].join("\n");
}

function createEmptyLocationCounts(): Record<LocationClass, number> {
  return {
    protected_root: 0,
    journal: 0,
    inbox: 0,
    wiki: 0,
    archive: 0,
  };
}

function formatHygieneStatus(status: InboxHygieneStatus): string {
  if (status === "review_soon") return "review soon";
  if (status === "action_required") return "action required";
  return "healthy";
}

function formatAge(ageDays: number): string {
  return ageDays === 1 ? "1 day old" : `${ageDays} days old`;
}
