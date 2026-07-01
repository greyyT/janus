import { listActiveTasks, resolveRepositoryRoot } from "./lib/index.js";

async function main(): Promise<void> {
  const isJson = process.argv.includes("--json");

  try {
    const repositoryRoot = await resolveRepositoryRoot();
    const tasks = await listActiveTasks(repositoryRoot);
    const output = {
      active_task_count: tasks.length,
      tasks: tasks.map((task) => ({
        id: task.id,
        title: task.title,
        checked: task.checked,
        path: task.path,
        location: task.path === "backlog.md" ? "backlog" : task.path,
        start_line: task.startLine,
        end_line: task.endLine,
      })),
    };

    if (isJson) {
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    if (tasks.length === 0) {
      console.log("No active tasks.");
      return;
    }

    for (const task of tasks) console.log(`${task.id}  ${task.path}  ${task.title}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

await main();
