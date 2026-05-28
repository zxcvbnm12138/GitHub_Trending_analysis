import { existsSync, readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";

const { Client } = pg;

const CONFIG_PATH = join(process.cwd(), ".data", "app-config.json");
const DATA_DIR = join(process.cwd(), ".data", "postgres");

function readDatabaseUrl() {
  const envUrl = process.env.DATABASE_URL?.trim();
  if (envUrl) return envUrl;

  if (!existsSync(CONFIG_PATH)) {
    throw new Error(`Missing ${CONFIG_PATH}. Configure database.url first.`);
  }

  const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  const configUrl = config?.database?.url?.trim();
  if (!configUrl) {
    throw new Error("database.url is empty in .data/app-config.json.");
  }
  return configUrl;
}

function parseLocalDatabaseUrl(rawUrl) {
  const url = new URL(rawUrl);
  const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);
  if (!localHosts.has(url.hostname)) {
    throw new Error(
      `Refusing to start local Postgres for non-local host: ${url.hostname}`,
    );
  }
  if (!url.username || !url.password) {
    throw new Error("Local database URL must include a username and password.");
  }

  return {
    databaseUrl: rawUrl,
    database: decodeURIComponent(url.pathname.replace(/^\/+/, "")),
    host: url.hostname,
    password: decodeURIComponent(url.password),
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username),
  };
}

function log(message) {
  const text = String(message || "").trim();
  if (text) console.log(`[local-postgres] ${text}`);
}

function logPostgres(message) {
  const text = String(message || "").trim();
  if (text) console.log(`[postgres] ${text}`);
}

async function ensureDatabaseExists(server, database) {
  try {
    await server.createDatabase(database);
    log(`Created database ${database}.`);
  } catch (error) {
    if (error?.code === "42P04" || /already exists/i.test(error?.message || "")) {
      log(`Database ${database} already exists.`);
      return;
    }
    throw error;
  }
}

async function verifyConnection(databaseUrl) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  await client.query("SELECT 1 AS ok");
  await client.end();
}

async function main() {
  const settings = parseLocalDatabaseUrl(readDatabaseUrl());
  if (!settings.database) {
    throw new Error("Local database URL must include a database name.");
  }

  await mkdir(DATA_DIR, { recursive: true });

  const server = new EmbeddedPostgres({
    authMethod: "password",
    databaseDir: DATA_DIR,
    password: settings.password,
    persistent: true,
    port: settings.port,
    user: settings.user,
    onLog: logPostgres,
    onError: logPostgres,
  });

  if (!existsSync(join(DATA_DIR, "PG_VERSION"))) {
    log(`Initialising PostgreSQL data directory at ${DATA_DIR}.`);
    await server.initialise();
  } else {
    log(`Using existing PostgreSQL data directory at ${DATA_DIR}.`);
  }

  await server.start();
  log(`Listening on 127.0.0.1:${settings.port}.`);
  await ensureDatabaseExists(server, settings.database);
  await verifyConnection(settings.databaseUrl);
  log(`Verified app connection to database ${settings.database}.`);

  let stopping = false;
  async function stop() {
    if (stopping) return;
    stopping = true;
    log("Stopping PostgreSQL.");
    await server.stop();
    process.exit(0);
  }

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  setInterval(() => {}, 2 ** 31 - 1);
}

main().catch((error) => {
  console.error(`[local-postgres] ${error?.stack || error}`);
  process.exit(1);
});
