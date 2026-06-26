import { createInboxJsonOutput, formatInboxHuman, listInboxDocuments, resolveRepositoryRoot } from "./lib/index.js";

async function main(): Promise<void> {
  const isJson = process.argv.includes("--json");

  try {
    const repositoryRoot = await resolveRepositoryRoot();
    const documents = await listInboxDocuments(repositoryRoot);
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
