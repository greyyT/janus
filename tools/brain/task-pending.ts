import { initializeTaskCreateFile, resolveRepositoryRoot } from "./lib/index.js";

async function main(): Promise<void> {
  const isJson = process.argv.includes("--json");

  try {
    const repositoryRoot = await resolveRepositoryRoot();
    const result = await initializeTaskCreateFile(repositoryRoot);
    const output = {
      action: result.action === "created" ? "created_task_pending" : "resumed_task_pending",
      path: result.path,
      project_slugs: result.projectSlugs,
    };

    if (isJson) {
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    if (result.action === "created") {
      console.log(`Created ${result.path}. Fill it, then reply done.`);
      return;
    }

    console.log(`Resuming existing ${result.path}. Fill it, then reply done.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

await main();
