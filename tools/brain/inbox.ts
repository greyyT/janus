import { createInboxJsonOutput, formatInboxHuman, loadBrainDocuments, resolveRepositoryRoot, toInboxDocument } from "./lib/index.js";

async function main(): Promise<void> {
  const isJson = process.argv.includes("--json");

  try {
    const repositoryRoot = await resolveRepositoryRoot();
    const loadedDocuments = await loadBrainDocuments(repositoryRoot);
    const documents = loadedDocuments
      .map((document) => toInboxDocument(document, new Date()))
      .filter((document) => document !== null);
    const output = createInboxJsonOutput(documents);

    if (isJson) {
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    console.log(formatInboxHuman(output));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

await main();
