import { readFile } from "node:fs/promises";
import path from "node:path";
import { compareDocumentPaths } from "./classify.js";
import { type CivilDate, formatCivilDate, parseCivilDate } from "./civil-date.js";
import { discoverJournalMarkdownFiles } from "./filesystem.js";

export interface JournalFile {
  date: CivilDate;
  dateKey: string;
  absolutePath: string;
  relativePath: string;
  content: string;
}

export async function loadValidJournalFiles(repositoryRoot: string): Promise<JournalFile[]> {
  const files = await discoverJournalMarkdownFiles(repositoryRoot);
  const validFiles = files
    .map((file) => {
      const dateKey = path.posix.basename(file.relativePath, ".md");
      const date = parseCivilDate(dateKey);

      if (date === null) {
        return null;
      }

      return { file, date, dateKey };
    })
    .filter((file): file is NonNullable<typeof file> => file !== null)
    .sort((a, b) => compareDocumentPaths(a.file.relativePath, b.file.relativePath));

  return Promise.all(validFiles.map(async ({ file, date, dateKey }) => ({
    date,
    dateKey,
    absolutePath: file.absolutePath,
    relativePath: file.relativePath,
    content: await readFile(file.absolutePath, "utf8"),
  })));
}

export function keyJournalFilesByDate(journalFiles: JournalFile[]): Map<string, JournalFile> {
  return new Map(journalFiles.map((journalFile) => [formatCivilDate(journalFile.date), journalFile]));
}
