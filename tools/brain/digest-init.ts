import { initializeDigestLedger, resolveRepositoryRoot } from "./lib/index.js";

async function main(): Promise<void> {
  const reset = process.argv.includes("--reset");

  try {
    const repositoryRoot = await resolveRepositoryRoot();
    const result = await initializeDigestLedger(repositoryRoot, { reset });

    if (result.action === "resumed") {
      console.log(`Resuming existing ${result.ledger_path}; ${result.inbox_count} inbox note(s) currently queued. Use --reset to regenerate.`);
      return;
    }

    const verb = result.action === "reset" ? "Reset" : "Created";
    console.log(`${verb} ${result.ledger_path} with ${result.inbox_count} inbox note(s).`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

await main();
