import path from "node:path";
import { createIndexSummary, formatIndexHuman, loadBrainDocuments, resolveRepositoryRoot, writeJsonAtomically, type BrainIndex } from "./lib/index.js";

const OUTPUT_PATH = "data/brain-index.json";

async function main(): Promise<void> {
  const isJson = process.argv.includes("--json");

  try {
    const repositoryRoot = await resolveRepositoryRoot();
    const loadedDocuments = await loadBrainDocuments(repositoryRoot);
    const documents = loadedDocuments.map((loadedDocument) => loadedDocument.document);
    const index: BrainIndex = {
      schema_version: 2,
      documents,
    };

    await writeJsonAtomically(path.join(repositoryRoot, OUTPUT_PATH), index);

    const summary = createIndexSummary(OUTPUT_PATH, documents);

    if (isJson) {
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    console.log(formatIndexHuman(summary));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

await main();
