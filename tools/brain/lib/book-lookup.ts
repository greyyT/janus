export type BookLookupStatus = "found" | "ambiguous" | "not_found";
export type BookLookupConfidence = "high" | "medium" | "low";

export interface BookLookupInput {
  query?: string;
  isbn?: string;
  url?: string;
  maxDepth?: number;
}

export interface BookSource {
  label: string;
  url: string;
  provides: Array<"identity" | "contents">;
}

export interface TocNode {
  title: string;
  children: TocNode[];
}

export interface BookCandidate {
  title: string;
  subtitle?: string;
  authors: string[];
  publisher?: string;
  published?: string;
  isbn10?: string;
  isbn13?: string;
  language?: string;
  topics: string[];
  sourceUrls: string[];
  googleVolumeId?: string;
  openLibraryWorkKey?: string;
  openLibraryEditionKey?: string;
  score: number;
}

export interface BookLookupResult {
  status: BookLookupStatus;
  input: BookLookupInput;
  book?: Omit<BookCandidate, "score" | "googleVolumeId" | "openLibraryWorkKey" | "openLibraryEditionKey" | "sourceUrls">;
  candidates: Array<Omit<BookCandidate, "score" | "googleVolumeId" | "openLibraryWorkKey" | "openLibraryEditionKey">>;
  contents?: {
    tree: TocNode[];
    complete: boolean;
    source: string;
  };
  sources: BookSource[];
  confidence: BookLookupConfidence;
  warnings: string[];
}

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

interface RawTocEntry {
  title: string;
  level: number;
}

const GOOGLE_API = "https://www.googleapis.com/books/v1/volumes";
const OPEN_LIBRARY_API = "https://openlibrary.org";

export async function lookupBookOnline(input: BookLookupInput, fetchImpl: FetchLike = fetch): Promise<BookLookupResult> {
  validateInput(input);
  const normalizedInput = normalizeInput(input);
  const warnings: string[] = [];
  const sources: BookSource[] = [];

  if (normalizedInput.url) {
    const direct = await lookupKnownUrl(normalizedInput, fetchImpl, warnings);
    if (direct) return direct;
  }

  const searchTerm = normalizedInput.isbn ? `isbn:${normalizedInput.isbn}` : normalizedInput.query!;
  const [googleResult, openLibraryResult] = await Promise.allSettled([
    searchGoogleBooks(searchTerm, normalizedInput, fetchImpl),
    searchOpenLibrary(searchTerm, normalizedInput, fetchImpl),
  ]);

  const candidates: BookCandidate[] = [];
  if (googleResult.status === "fulfilled") candidates.push(...googleResult.value);
  else warnings.push(`Google Books unavailable: ${errorMessage(googleResult.reason)}`);
  if (openLibraryResult.status === "fulfilled") candidates.push(...openLibraryResult.value);
  else warnings.push(`Open Library unavailable: ${errorMessage(openLibraryResult.reason)}`);

  const ranked = mergeAndRankCandidates(candidates, normalizedInput);
  if (ranked.length === 0) {
    return { status: "not_found", input: normalizedInput, candidates: [], sources, confidence: "low", warnings };
  }

  const selection = selectCandidate(ranked, normalizedInput);
  if (selection.status === "ambiguous") {
    return {
      status: "ambiguous",
      input: normalizedInput,
      candidates: selection.candidates.slice(0, 5).map(publicCandidate),
      sources,
      confidence: "low",
      warnings: [...warnings, "Multiple plausible books or editions matched. Select one by ISBN or a more specific query."],
    };
  }

  const selected = selection.candidate;
  const identitySources = selected.sourceUrls.map((url) => ({ label: sourceLabel(url), url, provides: ["identity"] as Array<"identity" | "contents"> }));
  sources.push(...identitySources);

  const toc = await retrieveOpenLibraryToc(selected, fetchImpl, warnings);
  if (toc) {
    sources.push({ label: "Open Library", url: toc.source, provides: ["contents"] });
  } else {
    warnings.push("TOC unavailable from the supported trustworthy online sources; no contents were invented.");
  }

  if (!normalizedInput.isbn && (selected.isbn10 || selected.isbn13)) {
    warnings.push("Edition was inferred from search results. Use an ISBN to pin the exact edition when edition-specific contents matter.");
  }

  return {
    status: "found",
    input: normalizedInput,
    book: publicBook(selected),
    candidates: ranked.slice(1, 5).map(publicCandidate),
    contents: toc ? { tree: toc.tree, complete: toc.complete, source: toc.source } : undefined,
    sources: dedupeSources(sources),
    confidence: normalizedInput.isbn ? "high" : selected.score >= 90 ? "medium" : "low",
    warnings,
  };
}

export function formatBookLookupHuman(result: BookLookupResult, maxDepth = result.input.maxDepth ?? 4): string {
  const lines: string[] = ["# Book lookup", ""];
  if (result.status === "not_found") {
    lines.push("No matching book found.");
  } else if (result.status === "ambiguous") {
    lines.push("Multiple plausible matches found:", "");
    result.candidates.forEach((candidate, index) => {
      const author = candidate.authors.join(", ") || "Unknown author";
      const edition = candidate.published ? ` · ${candidate.published}` : "";
      const isbn = candidate.isbn13 ?? candidate.isbn10;
      lines.push(`${index + 1}. **${candidate.title}** — ${author}${edition}${isbn ? ` · ISBN ${isbn}` : ""}`);
    });
  } else if (result.book) {
    const book = result.book;
    lines.push(`## ${book.title}`, "");
    lines.push(`- Author: ${book.authors.join(", ") || "Unknown"}`);
    if (book.subtitle) lines.push(`- Subtitle: ${book.subtitle}`);
    if (book.publisher) lines.push(`- Publisher: ${book.publisher}`);
    if (book.published) lines.push(`- Published: ${book.published}`);
    if (book.isbn13) lines.push(`- ISBN-13: ${book.isbn13}`);
    if (book.isbn10) lines.push(`- ISBN-10: ${book.isbn10}`);
    if (book.language) lines.push(`- Language: ${book.language}`);
    if (book.topics.length > 0) lines.push(`- Topics: ${book.topics.join(", ")}`);
    lines.push(`- Confidence: ${result.confidence}`);

    lines.push("", "## Table of contents", "");
    if (result.contents && result.contents.tree.length > 0) {
      lines.push("```text", ...renderTocTree(book.title, result.contents.tree, maxDepth), "```");
      if (!result.contents.complete) lines.push("", "Contents may be partial according to the source.");
    } else {
      lines.push("TOC unavailable from trustworthy supported sources.");
    }
  }

  if (result.sources.length > 0) {
    lines.push("", "## Sources", "");
    for (const source of result.sources) lines.push(`- ${source.label} (${source.provides.join(", ")}): ${source.url}`);
  }
  if (result.warnings.length > 0) {
    lines.push("", "## Warnings", "");
    for (const warning of result.warnings) lines.push(`- ${warning}`);
  }
  return `${lines.join("\n")}\n`;
}

export function renderTocTree(rootTitle: string, nodes: TocNode[], maxDepth = 4): string[] {
  const lines = [rootTitle];
  const walk = (items: TocNode[], prefix: string, depth: number): void => {
    items.forEach((node, index) => {
      const last = index === items.length - 1;
      lines.push(`${prefix}${last ? "└──" : "├──"} ${node.title}`);
      if (node.children.length === 0) return;
      const childPrefix = `${prefix}${last ? "    " : "│   "}`;
      if (depth >= maxDepth) lines.push(`${childPrefix}└── …`);
      else walk(node.children, childPrefix, depth + 1);
    });
  };
  walk(nodes, "", 1);
  return lines;
}

function validateInput(input: BookLookupInput): void {
  const values = [input.query, input.isbn, input.url].filter((value) => value !== undefined);
  if (values.length !== 1) throw new Error("provide exactly one of --query, --isbn, or --url");
  if (values[0]!.trim() === "") throw new Error("book lookup input must not be blank");
  if (input.maxDepth !== undefined && (!Number.isInteger(input.maxDepth) || input.maxDepth < 1 || input.maxDepth > 10)) {
    throw new Error("--max-depth must be an integer from 1 through 10");
  }
}

function normalizeInput(input: BookLookupInput): BookLookupInput {
  const normalized: BookLookupInput = { maxDepth: input.maxDepth ?? 4 };
  if (input.query) normalized.query = input.query.trim();
  if (input.isbn) normalized.isbn = normalizeIsbn(input.isbn);
  if (input.url) {
    const url = new URL(input.url);
    if (url.protocol !== "https:") throw new Error("--url must use https://");
    normalized.url = url.toString();
  }
  return normalized;
}

async function lookupKnownUrl(input: BookLookupInput, fetchImpl: FetchLike, warnings: string[]): Promise<BookLookupResult | null> {
  const url = new URL(input.url!);
  const googleId = /(?:^|[?&])id=([^&]+)/.exec(url.search)?.[1];
  if (url.hostname.endsWith("google.com") && googleId) {
    const value = await fetchJson<GoogleVolume>(`${GOOGLE_API}/${encodeURIComponent(googleId)}`, fetchImpl);
    const candidate = googleCandidate(value, input);
    if (!candidate) return { status: "not_found", input, candidates: [], sources: [], confidence: "low", warnings };
    return finishDirectCandidate(candidate, input, fetchImpl, warnings);
  }

  const openLibraryMatch = /^\/(books|works)\/(OL\d+[MW])/.exec(url.pathname);
  if (url.hostname === "openlibrary.org" && openLibraryMatch) {
    const key = `/${openLibraryMatch[1]}/${openLibraryMatch[2]}`;
    const data = await fetchJson<OpenLibraryRecord>(`${OPEN_LIBRARY_API}${key}.json`, fetchImpl);
    const candidate = openLibraryRecordCandidate(key, data, input);
    return finishDirectCandidate(candidate, input, fetchImpl, warnings);
  }

  const isbn = extractIsbn(input.url!);
  if (isbn) return lookupBookOnline({ isbn, maxDepth: input.maxDepth }, fetchImpl);
  throw new Error("unsupported --url; use a Google Books/Open Library URL or a URL containing an ISBN");
}

async function finishDirectCandidate(candidate: BookCandidate, input: BookLookupInput, fetchImpl: FetchLike, warnings: string[]): Promise<BookLookupResult> {
  const toc = await retrieveOpenLibraryToc(candidate, fetchImpl, warnings);
  const sources: BookSource[] = candidate.sourceUrls.map((url) => ({ label: sourceLabel(url), url, provides: ["identity"] }));
  if (toc) sources.push({ label: "Open Library", url: toc.source, provides: ["contents"] });
  else warnings.push("TOC unavailable from the supported trustworthy online sources; no contents were invented.");
  return {
    status: "found",
    input,
    book: publicBook(candidate),
    candidates: [],
    contents: toc ? { tree: toc.tree, complete: toc.complete, source: toc.source } : undefined,
    sources: dedupeSources(sources),
    confidence: "high",
    warnings,
  };
}

async function searchGoogleBooks(term: string, input: BookLookupInput, fetchImpl: FetchLike): Promise<BookCandidate[]> {
  const data = await fetchJson<GoogleResponse>(`${GOOGLE_API}?q=${encodeURIComponent(term)}&maxResults=10&printType=books`, fetchImpl);
  return (data.items ?? []).map((item) => googleCandidate(item, input)).filter((candidate): candidate is BookCandidate => candidate !== null);
}

async function searchOpenLibrary(term: string, input: BookLookupInput, fetchImpl: FetchLike): Promise<BookCandidate[]> {
  const exactCandidates: BookCandidate[] = [];
  if (input.isbn) {
    try {
      const edition = await fetchJson<OpenLibraryRecord>(`${OPEN_LIBRARY_API}/isbn/${input.isbn}.json`, fetchImpl);
      if (edition.title) {
        const candidate = openLibraryRecordCandidate(edition.key ?? `/isbn/${input.isbn}`, edition, input);
        candidate.isbn10 = input.isbn.length === 10 ? input.isbn : candidate.isbn10;
        candidate.isbn13 = input.isbn.length === 13 ? input.isbn : candidate.isbn13;
        candidate.authors = await loadOpenLibraryAuthors(edition.authors ?? [], fetchImpl);
        exactCandidates.push(candidate);
      }
    } catch {
      // The search endpoint remains a useful fallback when the direct edition record is absent.
    }
  }
  const query = term.startsWith("isbn:") ? `isbn=${encodeURIComponent(term.slice(5))}` : `q=${encodeURIComponent(term)}`;
  const fields = "key,title,subtitle,author_name,first_publish_year,publisher,isbn,language,subject,edition_key,cover_edition_key";
  const data = await fetchJson<OpenLibrarySearchResponse>(`${OPEN_LIBRARY_API}/search.json?${query}&limit=10&fields=${fields}`, fetchImpl);
  return [...exactCandidates, ...(data.docs ?? []).map((doc) => openLibrarySearchCandidate(doc, input))];
}

async function loadOpenLibraryAuthors(authors: Array<{ key: string }>, fetchImpl: FetchLike): Promise<string[]> {
  const results = await Promise.allSettled(authors.slice(0, 8).map((author) => fetchJson<OpenLibraryRecord>(`${OPEN_LIBRARY_API}${author.key}.json`, fetchImpl)));
  return results.flatMap((result) => result.status === "fulfilled" && result.value.name ? [result.value.name] : []);
}

async function retrieveOpenLibraryToc(candidate: BookCandidate, fetchImpl: FetchLike, warnings: string[]): Promise<{ tree: TocNode[]; complete: boolean; source: string } | null> {
  const keys: string[] = [];
  if (candidate.openLibraryEditionKey) keys.push(`/books/${candidate.openLibraryEditionKey}`);
  if (candidate.openLibraryWorkKey) keys.push(candidate.openLibraryWorkKey);

  if (candidate.isbn13 || candidate.isbn10) {
    try {
      const isbn = candidate.isbn13 ?? candidate.isbn10!;
      const edition = await fetchJson<OpenLibraryRecord>(`${OPEN_LIBRARY_API}/isbn/${isbn}.json`, fetchImpl);
      const exactKeys = [edition.key, edition.works?.[0]?.key].filter((key): key is string => Boolean(key));
      keys.unshift(...exactKeys);
    } catch (error) {
      warnings.push(`Open Library TOC lookup failed: ${errorMessage(error)}`);
    }
  }

  for (const key of [...new Set(keys)]) {
    try {
      const record = await fetchJson<OpenLibraryRecord>(`${OPEN_LIBRARY_API}${key}.json`, fetchImpl);
      const entries = normalizeTocEntries(record.table_of_contents);
      if (entries.length > 0) return { tree: tocEntriesToTree(entries), complete: true, source: `${OPEN_LIBRARY_API}${key}` };
      const workKey = record.works?.[0]?.key;
      if (workKey && !keys.includes(workKey)) keys.push(workKey);
    } catch (error) {
      warnings.push(`Open Library TOC source ${key} unavailable: ${errorMessage(error)}`);
    }
  }
  return null;
}

function mergeAndRankCandidates(candidates: BookCandidate[], input: BookLookupInput): BookCandidate[] {
  const merged = new Map<string, BookCandidate>();
  for (const candidate of candidates) {
    const key = candidate.isbn13 ?? candidate.isbn10 ?? `${normalizeText(candidate.title)}|${normalizeText(candidate.authors[0] ?? "")}`;
    const existing = merged.get(key);
    if (!existing) merged.set(key, candidate);
    else merged.set(key, mergeCandidate(existing, candidate));
  }
  return [...merged.values()]
    .map((candidate) => ({ ...candidate, score: scoreCandidate(candidate, input) }))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

function selectCandidate(ranked: BookCandidate[], input: BookLookupInput): { status: "found"; candidate: BookCandidate } | { status: "ambiguous"; candidates: BookCandidate[] } {
  if (input.isbn) {
    const exact = ranked.find((candidate) => candidate.isbn13 === input.isbn || candidate.isbn10 === input.isbn);
    return exact ? { status: "found", candidate: exact } : { status: "ambiguous", candidates: ranked };
  }
  const first = ranked[0]!;
  const second = ranked[1];
  if (first.score < 25 || (second && second.score >= first.score - 4 && differentIdentity(first, second))) {
    return { status: "ambiguous", candidates: ranked };
  }
  return { status: "found", candidate: first };
}

function scoreCandidate(candidate: BookCandidate, input: BookLookupInput): number {
  if (input.isbn) return candidate.isbn13 === input.isbn || candidate.isbn10 === input.isbn ? 250 : 0;
  const query = normalizeText(input.query ?? "");
  const title = normalizeText(candidate.title);
  const haystack = normalizeText(`${candidate.title} ${candidate.subtitle ?? ""} ${candidate.authors.join(" ")}`);
  let score = 0;
  if (query === title) score += 100;
  else if (title.includes(query) || query.includes(title)) score += 70;
  const tokens = query.split(" ").filter((token) => token.length > 1);
  if (tokens.length > 0) score += Math.round(40 * tokens.filter((token) => haystack.includes(token)).length / tokens.length);
  return score;
}

function differentIdentity(a: BookCandidate, b: BookCandidate): boolean {
  const aIsbn = a.isbn13 ?? a.isbn10;
  const bIsbn = b.isbn13 ?? b.isbn10;
  if (aIsbn && bIsbn) return aIsbn !== bIsbn;
  return normalizeText(a.title) !== normalizeText(b.title) || normalizeText(a.authors[0] ?? "") !== normalizeText(b.authors[0] ?? "");
}

function mergeCandidate(a: BookCandidate, b: BookCandidate): BookCandidate {
  const subtitle = a.subtitle ?? b.subtitle;
  const title = subtitle && normalizeText(a.title).startsWith(`${normalizeText(b.title)} `) && b.title.length < a.title.length ? b.title : a.title;
  return {
    ...a,
    title,
    subtitle,
    authors: a.authors.length > 0 ? a.authors : b.authors,
    publisher: a.publisher ?? b.publisher,
    published: a.published ?? b.published,
    isbn10: a.isbn10 ?? b.isbn10,
    isbn13: a.isbn13 ?? b.isbn13,
    language: a.language ?? b.language,
    topics: [...new Set([...a.topics, ...b.topics])].slice(0, 8),
    sourceUrls: [...new Set([...a.sourceUrls, ...b.sourceUrls])],
    googleVolumeId: a.googleVolumeId ?? b.googleVolumeId,
    openLibraryWorkKey: a.openLibraryWorkKey ?? b.openLibraryWorkKey,
    openLibraryEditionKey: a.openLibraryEditionKey ?? b.openLibraryEditionKey,
  };
}

function googleCandidate(item: GoogleVolume, input: BookLookupInput): BookCandidate | null {
  const info = item.volumeInfo;
  if (!info?.title) return null;
  const identifiers = info.industryIdentifiers ?? [];
  const source = item.id ? `https://books.google.com/books?id=${encodeURIComponent(item.id)}` : GOOGLE_API;
  const candidate: BookCandidate = {
    title: info.title,
    subtitle: info.subtitle,
    authors: info.authors ?? [],
    publisher: info.publisher,
    published: info.publishedDate,
    isbn10: identifiers.find((identifier) => identifier.type === "ISBN_10")?.identifier,
    isbn13: identifiers.find((identifier) => identifier.type === "ISBN_13")?.identifier,
    language: info.language,
    topics: (info.categories ?? []).slice(0, 8),
    sourceUrls: [source],
    googleVolumeId: item.id,
    score: 0,
  };
  candidate.score = scoreCandidate(candidate, input);
  return candidate;
}

function openLibrarySearchCandidate(doc: OpenLibrarySearchDoc, input: BookLookupInput): BookCandidate {
  const isbns = (doc.isbn ?? []).map((isbn) => normalizeIsbn(isbn));
  const exactIsbn = input.isbn && isbns.includes(input.isbn) ? input.isbn : undefined;
  const candidate: BookCandidate = {
    title: doc.title,
    subtitle: doc.subtitle,
    authors: doc.author_name ?? [],
    publisher: doc.publisher?.[0],
    published: doc.first_publish_year?.toString(),
    isbn10: exactIsbn?.length === 10 ? exactIsbn : isbns.find((isbn) => isbn.length === 10),
    isbn13: exactIsbn?.length === 13 ? exactIsbn : isbns.find((isbn) => isbn.length === 13),
    language: doc.language?.[0],
    topics: (doc.subject ?? []).slice(0, 8),
    sourceUrls: doc.key ? [`${OPEN_LIBRARY_API}${doc.key}`] : [],
    openLibraryWorkKey: doc.key,
    openLibraryEditionKey: doc.cover_edition_key ?? doc.edition_key?.[0],
    score: 0,
  };
  candidate.score = scoreCandidate(candidate, input);
  return candidate;
}

function openLibraryRecordCandidate(key: string, record: OpenLibraryRecord, input: BookLookupInput): BookCandidate {
  const isbn10 = record.isbn_10?.[0];
  const isbn13 = record.isbn_13?.[0];
  const candidate: BookCandidate = {
    title: record.title ?? "Unknown title",
    subtitle: record.subtitle,
    authors: [],
    publisher: record.publishers?.[0],
    published: record.publish_date,
    isbn10,
    isbn13,
    language: record.languages?.[0]?.key?.split("/").pop(),
    topics: record.subjects?.slice(0, 8) ?? [],
    sourceUrls: [`${OPEN_LIBRARY_API}${key}`],
    openLibraryEditionKey: key.startsWith("/books/") ? key.split("/").pop() : undefined,
    openLibraryWorkKey: key.startsWith("/works/") ? key : record.works?.[0]?.key,
    score: 0,
  };
  candidate.score = scoreCandidate(candidate, input);
  return candidate;
}

function normalizeTocEntries(value: OpenLibraryRecord["table_of_contents"]): RawTocEntry[] {
  if (!Array.isArray(value)) return [];
  const entries = value.flatMap((entry): RawTocEntry[] => {
    if (typeof entry === "string") return entry.trim() ? [{ title: entry.trim(), level: 1 }] : [];
    const title = typeof entry?.title === "string" ? entry.title.trim() : "";
    if (!title) return [];
    const parsedLevel = typeof entry.level === "number" ? entry.level : Number.parseInt(String(entry.level ?? "1"), 10);
    return [{ title, level: Number.isFinite(parsedLevel) ? Math.max(1, parsedLevel) : 1 }];
  });
  if (entries.length === 0) return [];
  const minimum = Math.min(...entries.map((entry) => entry.level));
  return entries.map((entry) => ({ ...entry, level: entry.level - minimum + 1 }));
}

function tocEntriesToTree(entries: RawTocEntry[]): TocNode[] {
  const roots: TocNode[] = [];
  const stack: Array<{ level: number; node: TocNode }> = [];
  for (const entry of entries) {
    while (stack.length > 0 && stack[stack.length - 1]!.level >= entry.level) stack.pop();
    const node: TocNode = { title: entry.title, children: [] };
    const parent = stack[stack.length - 1];
    if (parent) parent.node.children.push(node);
    else roots.push(node);
    stack.push({ level: entry.level, node });
  }
  return roots;
}

async function fetchJson<T>(url: string, fetchImpl: FetchLike): Promise<T> {
  const response = await fetchImpl(url, { headers: { accept: "application/json", "user-agent": "Janus book lookup" }, signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return await response.json() as T;
}

function publicBook(candidate: BookCandidate): BookLookupResult["book"] {
  const { score: _score, sourceUrls: _sourceUrls, googleVolumeId: _googleVolumeId, openLibraryWorkKey: _openLibraryWorkKey, openLibraryEditionKey: _openLibraryEditionKey, ...book } = candidate;
  return book;
}

function publicCandidate(candidate: BookCandidate): BookLookupResult["candidates"][number] {
  const { score: _score, googleVolumeId: _googleVolumeId, openLibraryWorkKey: _openLibraryWorkKey, openLibraryEditionKey: _openLibraryEditionKey, ...book } = candidate;
  return book;
}

function dedupeSources(sources: BookSource[]): BookSource[] {
  const byUrl = new Map<string, BookSource>();
  for (const source of sources) {
    const existing = byUrl.get(source.url);
    if (!existing) byUrl.set(source.url, source);
    else existing.provides = [...new Set([...existing.provides, ...source.provides])];
  }
  return [...byUrl.values()];
}

function sourceLabel(url: string): string {
  if (url.includes("openlibrary.org")) return "Open Library";
  if (url.includes("google.com")) return "Google Books";
  return new URL(url).hostname;
}

function normalizeText(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeIsbn(value: string): string {
  const isbn = value.toUpperCase().replace(/[^0-9X]/g, "");
  if (isbn.length !== 10 && isbn.length !== 13) throw new Error(`invalid ISBN "${value}"`);
  return isbn;
}

function extractIsbn(value: string): string | null {
  const matches = value.match(/(?:97[89][\d-]{10,16}|\d[\d-]{8,14}[\dX])/gi) ?? [];
  for (const match of matches) {
    const normalized = match.toUpperCase().replace(/[^0-9X]/g, "");
    if (normalized.length === 10 || normalized.length === 13) return normalized;
  }
  return null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface GoogleResponse { items?: GoogleVolume[] }
interface GoogleVolume {
  id?: string;
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    industryIdentifiers?: Array<{ type: string; identifier: string }>;
    categories?: string[];
    language?: string;
  };
}
interface OpenLibrarySearchResponse { docs?: OpenLibrarySearchDoc[] }
interface OpenLibrarySearchDoc {
  key?: string;
  title: string;
  subtitle?: string;
  author_name?: string[];
  first_publish_year?: number;
  publisher?: string[];
  isbn?: string[];
  language?: string[];
  subject?: string[];
  edition_key?: string[];
  cover_edition_key?: string;
}
interface OpenLibraryRecord {
  key?: string;
  name?: string;
  title?: string;
  subtitle?: string;
  publishers?: string[];
  publish_date?: string;
  isbn_10?: string[];
  isbn_13?: string[];
  languages?: Array<{ key?: string }>;
  subjects?: string[];
  works?: Array<{ key: string }>;
  authors?: Array<{ key: string }>;
  table_of_contents?: Array<string | { title?: string; level?: number | string }>;
}
