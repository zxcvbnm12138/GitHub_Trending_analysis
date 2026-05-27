import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(path) {
  if (!existsSync(path)) return;

  const content = readFileSync(path, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex < 0) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(resolve(process.cwd(), ".env"));
loadEnvFile(resolve(process.cwd(), ".env.local"));

const { bootstrapScheduleJobs, runDueScheduleJobsOnce, startScheduleWorker } =
  await import("../src/app/api/schedule/queue.js");

const args = new Set(process.argv.slice(2));

if (args.has("--bootstrap")) {
  const schedule = await bootstrapScheduleJobs();
  console.log(JSON.stringify({ bootstrapped: true, schedule }));
} else if (args.has("--once")) {
  const result = await runDueScheduleJobsOnce();
  console.log(JSON.stringify(result));
} else {
  await startScheduleWorker();
}
