export type FrontmatterWarningCode = "malformed_frontmatter" | "duplicate_frontmatter_key";

export interface FrontmatterWarning {
  code: FrontmatterWarningCode;
  message: string;
  line?: number;
}

export interface FrontmatterParseResult {
  frontmatter: Record<string, string>;
  body: string;
  warnings: FrontmatterWarning[];
}

const KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;

export function parseFrontmatter(content: string): FrontmatterParseResult {
  const lines = splitLines(content);

  if (lines[0] !== "---") {
    return {
      frontmatter: {},
      body: content,
      warnings: [],
    };
  }

  const closingIndex = lines.findIndex((line, index) => index > 0 && line === "---");

  if (closingIndex === -1) {
    return {
      frontmatter: {},
      body: content,
      warnings: [{ code: "malformed_frontmatter", message: "unclosed frontmatter block" }],
    };
  }

  const frontmatter: Record<string, string> = {};
  const warnings: FrontmatterWarning[] = [];

  for (let index = 1; index < closingIndex; index += 1) {
    const line = lines[index] ?? "";

    if (line.trim() === "") {
      continue;
    }

    const separatorIndex = line.indexOf(":");

    if (separatorIndex === -1) {
      warnings.push({
        code: "malformed_frontmatter",
        line: index + 1,
        message: "expected key: value",
      });
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (!KEY_PATTERN.test(key)) {
      warnings.push({
        code: "malformed_frontmatter",
        line: index + 1,
        message: `invalid frontmatter key "${key}"`,
      });
      continue;
    }

    if (Object.hasOwn(frontmatter, key)) {
      warnings.push({
        code: "duplicate_frontmatter_key",
        line: index + 1,
        message: `duplicate frontmatter key "${key}"; last value wins`,
      });
    }

    frontmatter[key] = value;
  }

  return {
    frontmatter,
    body: lines.slice(closingIndex + 1).join("\n"),
    warnings,
  };
}

function splitLines(content: string): string[] {
  return content.split("\n").map((line) => line.endsWith("\r") ? line.slice(0, -1) : line);
}
