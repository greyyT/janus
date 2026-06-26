import { access } from "node:fs/promises";
import path from "node:path";
import { compareDocumentPaths } from "./classify.js";
import { type InboxDocument, listInboxDocuments } from "./documents.js";
import { writeTextAtomically } from "./filesystem.js";

export const DIGEST_LEDGER_RELATIVE_PATH = ".janus/digest-ledger.md";

export type DigestLedgerDisposition = "clarified" | "parked" | "keep raw" | "proposed discard";

export interface DigestLedgerEntry {
  path: string;
  checked: boolean;
  disposition?: DigestLedgerDisposition;
}

export interface DigestLedgerComparison {
  matches: boolean;
  addedPaths: string[];
  removedPaths: string[];
}

export interface DigestLedgerInitializationResult {
  action: "created" | "resumed" | "reset";
  ledger_path: string;
  inbox_count: number;
}

const LEDGER_LINE_PATTERN = /^- \[([ x])\] (.+?)(?: — (clarified|parked|keep raw|proposed discard))?$/;

export function renderDigestLedger(documents: InboxDocument[]): string {
  const lines = ["# Janus Digest Ledger", ""];

  for (const document of documents) {
    lines.push(`- [ ] ${document.path}`);
  }

  return `${lines.join("\n")}\n`;
}

export function parseDigestLedger(content: string): DigestLedgerEntry[] {
  return content
    .split(/\r?\n/)
    .filter((line) => line.startsWith("- ["))
    .map((line) => {
      const match = LEDGER_LINE_PATTERN.exec(line);
      if (match === null) {
        throw new Error(`Invalid digest ledger line: ${line}`);
      }

      const [, marker, ledgerPath, rawDisposition] = match;
      const entry: DigestLedgerEntry = {
        path: ledgerPath,
        checked: marker === "x",
      };

      if (rawDisposition !== undefined) {
        entry.disposition = rawDisposition as DigestLedgerDisposition;
      }

      return entry;
    });
}

export function compareDigestLedgerPaths(ledgerPaths: string[], currentInboxPaths: string[]): DigestLedgerComparison {
  const ledgerPathSet = new Set(ledgerPaths);
  const currentPathSet = new Set(currentInboxPaths);
  const addedPaths = currentInboxPaths
    .filter((inboxPath) => !ledgerPathSet.has(inboxPath))
    .sort(compareDocumentPaths);
  const removedPaths = ledgerPaths
    .filter((ledgerPath) => !currentPathSet.has(ledgerPath))
    .sort(compareDocumentPaths);

  return {
    matches: addedPaths.length === 0 && removedPaths.length === 0,
    addedPaths,
    removedPaths,
  };
}

export async function initializeDigestLedger(repositoryRoot: string, options: { reset?: boolean } = {}): Promise<DigestLedgerInitializationResult> {
  const ledgerPath = path.join(repositoryRoot, DIGEST_LEDGER_RELATIVE_PATH);
  const ledgerExists = await pathExists(ledgerPath);
  const documents = await listInboxDocuments(repositoryRoot);

  if (ledgerExists && options.reset !== true) {
    return {
      action: "resumed",
      ledger_path: DIGEST_LEDGER_RELATIVE_PATH,
      inbox_count: documents.length,
    };
  }

  await writeTextAtomically(ledgerPath, renderDigestLedger(documents));

  return {
    action: ledgerExists ? "reset" : "created",
    ledger_path: DIGEST_LEDGER_RELATIVE_PATH,
    inbox_count: documents.length,
  };
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
