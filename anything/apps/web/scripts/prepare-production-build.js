import { cp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

const sourceApiDir = join(process.cwd(), "src", "app", "api");
const targetApiDir = join(process.cwd(), "build", "server", "src", "app", "api");
const targetSsrTestDir = join(targetApiDir, "__create", "ssr-test");

await rm(targetApiDir, { recursive: true, force: true });
await mkdir(targetApiDir, { recursive: true });
await cp(sourceApiDir, targetApiDir, { recursive: true });
await rm(targetSsrTestDir, { recursive: true, force: true });

console.log(`Copied API routes to ${targetApiDir}`);
