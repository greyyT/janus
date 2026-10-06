import { describe, expect, test, vi } from "vitest";
import { formatBookLookupHuman, lookupBookOnline, renderTocTree } from "./book-lookup.js";

function json(value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });
}

describe("lookupBookOnline", () => {
  test("reconciles metadata and renders a sourced nested Open Library TOC", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.startsWith("https://www.googleapis.com/books/v1/volumes?")) {
        return json({ items: [{ id: "google-1", volumeInfo: {
          title: "Designing Data-Intensive Applications",
          authors: ["Martin Kleppmann"],
          publisher: "O'Reilly Media",
          publishedDate: "2017",
          industryIdentifiers: [{ type: "ISBN_13", identifier: "9781449373320" }],
          categories: ["Distributed systems"],
          language: "en",
        } }] });
      }
      if (url.startsWith("https://openlibrary.org/search.json?")) {
        return json({ docs: [{
          key: "/works/OL-work",
          title: "Designing Data-Intensive Applications",
          author_name: ["Martin Kleppmann"],
          first_publish_year: 2017,
          isbn: ["9781449373320"],
          cover_edition_key: "OL-edition-M",
          subject: ["Distributed systems"],
        }] });
      }
      if (url === "https://openlibrary.org/books/OL-edition-M.json") {
        return json({ works: [{ key: "/works/OL-work" }] });
      }
      if (url === "https://openlibrary.org/works/OL-work.json") {
        return json({ table_of_contents: [
          { title: "Part I — Foundations", level: 1 },
          { title: "Chapter 1 — Reliable Systems", level: 2 },
          { title: "Reliability", level: 3 },
          { title: "Chapter 2 — Data Models", level: 2 },
          { title: "Part II — Distributed Data", level: 1 },
        ] });
      }
      return new Response("missing", { status: 404 });
    });

    const result = await lookupBookOnline({ isbn: "978-1-4493-7332-0" }, fetchImpl);

    expect(result.status).toBe("found");
    expect(result.book).toMatchObject({
      title: "Designing Data-Intensive Applications",
      authors: ["Martin Kleppmann"],
      isbn13: "9781449373320",
    });
    expect(result.contents?.tree).toEqual([
      { title: "Part I — Foundations", children: [
        { title: "Chapter 1 — Reliable Systems", children: [{ title: "Reliability", children: [] }] },
        { title: "Chapter 2 — Data Models", children: [] },
      ] },
      { title: "Part II — Distributed Data", children: [] },
    ]);
    expect(formatBookLookupHuman(result)).toContain("├── Part I — Foundations\n│   ├── Chapter 1 — Reliable Systems\n│   │   └── Reliability");
    expect(result.sources.some((source) => source.provides.includes("contents"))).toBe(true);
  });

  test("returns ambiguity instead of silently selecting similarly ranked editions", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.startsWith("https://www.googleapis.com/books/v1/volumes?")) {
        return json({ items: [
          { id: "one", volumeInfo: { title: "The Pragmatic Programmer", authors: ["David Thomas"], publishedDate: "1999", industryIdentifiers: [{ type: "ISBN_13", identifier: "9780201616224" }] } },
          { id: "two", volumeInfo: { title: "The Pragmatic Programmer", authors: ["David Thomas"], publishedDate: "2019", industryIdentifiers: [{ type: "ISBN_13", identifier: "9780135957059" }] } },
        ] });
      }
      if (url.startsWith("https://openlibrary.org/search.json?")) return json({ docs: [] });
      return new Response("missing", { status: 404 });
    });

    const result = await lookupBookOnline({ query: "The Pragmatic Programmer" }, fetchImpl);

    expect(result.status).toBe("ambiguous");
    expect(result.candidates).toHaveLength(2);
    expect(result.warnings[0]).toContain("Select one by ISBN");
  });

  test("keeps a found identity and explicitly reports unavailable TOC", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.startsWith("https://www.googleapis.com/books/v1/volumes?")) {
        return json({ items: [{ id: "one", volumeInfo: { title: "A Unique Book", authors: ["An Author"] } }] });
      }
      if (url.startsWith("https://openlibrary.org/search.json?")) return json({ docs: [] });
      return new Response("missing", { status: 404 });
    });

    const result = await lookupBookOnline({ query: "A Unique Book" }, fetchImpl);

    expect(result.status).toBe("found");
    expect(result.contents).toBeUndefined();
    expect(result.warnings).toContain("TOC unavailable from the supported trustworthy online sources; no contents were invented.");
  });

  test("rejects invalid input contracts", async () => {
    await expect(lookupBookOnline({ query: "Book", isbn: "9781449373320" }, vi.fn())).rejects.toThrow("provide exactly one");
    await expect(lookupBookOnline({ isbn: "123" }, vi.fn())).rejects.toThrow("invalid ISBN");
    await expect(lookupBookOnline({ url: "http://example.com/book" }, vi.fn())).rejects.toThrow("must use https");
  });
});

describe("renderTocTree", () => {
  test("caps visual depth without losing the indication of deeper contents", () => {
    expect(renderTocTree("Book", [{ title: "Part", children: [{ title: "Chapter", children: [{ title: "Section", children: [] }] }] }], 2)).toEqual([
      "Book",
      "└── Part",
      "    └── Chapter",
      "        └── …",
    ]);
  });
});
