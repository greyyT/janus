import { constants } from "node:fs";
import { access, lstat, mkdir, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export interface DiscoveredMarkdownFile {
  absolutePath: string;
  relativePath: string;
  mtime: Date;
}

export async function resolveRepositoryRoot(startDirectory = process.cwd()): Promise<string> {
  let current = path.resolve(startDirectory);

  while (true) {
    if (await containsRepositoryMarkers(current)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error("Could not resolve Janus repository root");
    }

    current = parent;
  }
}

export async function discoverMarkdownFiles(repositoryRoot: string): Promise<DiscoveredMarkdownFile[]> {
  const rootFiles = await discoverRootMarkdownFiles(repositoryRoot);
  const journalFiles = await discoverJournalMarkdownFiles(repositoryRoot);
  const brainFiles = await discoverBrainMarkdownFiles(repositoryRoot);
  return [...rootFiles, ...journalFiles, ...brainFiles];
}

export async function discoverJournalMarkdownFiles(repositoryRoot: string): Promise<DiscoveredMarkdownFile[]> {
  const journalPath = path.join(repositoryRoot, "journal");

  try {
    const stats = await lstat(journalPath);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      return [];
    }
  } catch (error) {
    if (isNotFoundError(error)) {
      return [];
    }
    throw error;
  }

  const entries = await readdir(journalPath, { withFileTypes: true });
  const files: DiscoveredMarkdownFile[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) {
      continue;
    }

    const absolutePath = path.join(journalPath, entry.name);
    const stats = await lstat(absolutePath);

    if (!stats.isFile() || stats.isSymbolicLink()) {
      continue;
    }

    files.push({
      absolutePath,
      relativePath: toPosixRelativePath(repositoryRoot, absolutePath),
      mtime: stats.mtime,
    });
  }

  return files;
}

export function toPosixRelativePath(repositoryRoot: string, absolutePath: string): string {
  return path.relative(repositoryRoot, absolutePath).split(path.sep).join("/");
}

export async function writeJsonAtomically(outputPath: string, value: unknown): Promise<void> {
  const outputDirectory = path.dirname(outputPath);
  await mkdir(outputDirectory, { recursive: true });

  const temporaryPath = path.join(
    outputDirectory,
    `.tmp-${path.basename(outputPath)}-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );

  try {
    await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(temporaryPath, outputPath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

async function containsRepositoryMarkers(directory: string): Promise<boolean> {
  const packageJson = path.join(directory, "package.json");
  const agentsFile = path.join(directory, "AGENTS.md");

  return await canRead(packageJson) && await canRead(agentsFile);
}

async function canRead(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function discoverRootMarkdownFiles(repositoryRoot: string): Promise<DiscoveredMarkdownFile[]> {
  const entries = await readdir(repositoryRoot, { withFileTypes: true });
  const files: DiscoveredMarkdownFile[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) {
      continue;
    }

    const absolutePath = path.join(repositoryRoot, entry.name);
    const stats = await lstat(absolutePath);

    if (!stats.isFile() || stats.isSymbolicLink()) {
      continue;
    }

    files.push({
      absolutePath,
      relativePath: entry.name,
      mtime: stats.mtime,
    });
  }

  return files;
}

async function discoverBrainMarkdownFiles(repositoryRoot: string): Promise<DiscoveredMarkdownFile[]> {
  const brainPath = path.join(repositoryRoot, "brain");

  try {
    const stats = await lstat(brainPath);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      return [];
    }
  } catch (error) {
    if (isNotFoundError(error)) {
      return [];
    }
    throw error;
  }

  return walkBrainDirectory(repositoryRoot, brainPath);
}

async function walkBrainDirectory(repositoryRoot: string, directory: string): Promise<DiscoveredMarkdownFile[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: DiscoveredMarkdownFile[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    const stats = await lstat(absolutePath);

    if (stats.isSymbolicLink()) {
      continue;
    }

    if (stats.isDirectory()) {
      files.push(...await walkBrainDirectory(repositoryRoot, absolutePath));
      continue;
    }

    if (!stats.isFile() || !entry.name.endsWith(".md")) {
      continue;
    }

    files.push({
      absolutePath,
      relativePath: toPosixRelativePath(repositoryRoot, absolutePath),
      mtime: stats.mtime,
    });
  }

  return files;
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
