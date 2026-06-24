export const PROTECTED_ROOT_FILES = new Set([
  "AGENTS.md",
  "CLAUDE.md",
  "README.md",
  "CONTRIBUTING.md",
  "LICENSE.md",
  "CHANGELOG.md",
  "CODE_OF_CONDUCT.md",
  "SECURITY.md",
]);

export type LocationClass = "protected_root" | "inbox" | "wiki" | "archive";

export function isMarkdownBasename(basename: string): boolean {
  return basename.endsWith(".md");
}

export function classifyPath(relativePath: string): LocationClass | null {
  const parts = relativePath.split("/");
  const basename = parts.at(-1) ?? "";

  if (!isMarkdownBasename(basename)) {
    return null;
  }

  if (parts.length === 1) {
    return PROTECTED_ROOT_FILES.has(basename) ? "protected_root" : "inbox";
  }

  if (parts[0] !== "brain") {
    return null;
  }

  if (parts.length >= 3 && parts[1] === "archive") {
    return "archive";
  }

  return "wiki";
}

export function compareDocumentPaths(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
