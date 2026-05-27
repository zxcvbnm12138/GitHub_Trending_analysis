import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const APP_CONFIG_PATH = join(process.cwd(), ".data", "app-config.json");

function defaultConfig() {
  return {
    version: 1,
    admin: null,
    dify: {
      base_url: "",
      app_key: "",
    },
    database: {
      url: "",
    },
    diagnostics: {
      all: null,
      dify: null,
      database: null,
      migration: null,
    },
    updated_at: null,
  };
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeAppConfig(value) {
  const base = defaultConfig();
  const raw = value && typeof value === "object" ? value : {};
  const rawAdmin = raw.admin && typeof raw.admin === "object" ? raw.admin : null;
  const rawDify = raw.dify && typeof raw.dify === "object" ? raw.dify : {};
  const rawDatabase =
    raw.database && typeof raw.database === "object" ? raw.database : {};
  const rawDiagnostics =
    raw.diagnostics && typeof raw.diagnostics === "object"
      ? raw.diagnostics
      : {};

  return {
    ...base,
    version: 1,
    admin: rawAdmin
      ? {
          password_hash: normalizeString(rawAdmin.password_hash),
          password_salt: normalizeString(rawAdmin.password_salt),
          password_iterations: Number(rawAdmin.password_iterations) || 120000,
          session_secret: normalizeString(rawAdmin.session_secret),
        }
      : null,
    dify: {
      base_url: normalizeString(rawDify.base_url),
      app_key: normalizeString(rawDify.app_key),
    },
    database: {
      url: normalizeString(rawDatabase.url),
    },
    diagnostics: {
      all: rawDiagnostics.all || null,
      dify: rawDiagnostics.dify || null,
      database: rawDiagnostics.database || null,
      migration: rawDiagnostics.migration || null,
    },
    updated_at: normalizeString(raw.updated_at) || null,
  };
}

export async function readAppConfig() {
  try {
    const content = (await readFile(APP_CONFIG_PATH, "utf8")).replace(/^\uFEFF/, "");
    return normalizeAppConfig(JSON.parse(content));
  } catch (error) {
    if (error?.code === "ENOENT") return defaultConfig();
    throw error;
  }
}

export function readAppConfigSync() {
  if (!existsSync(APP_CONFIG_PATH)) return defaultConfig();
  const content = readFileSync(APP_CONFIG_PATH, "utf8").replace(/^\uFEFF/, "");
  return normalizeAppConfig(JSON.parse(content));
}

export async function writeAppConfig(config) {
  const next = normalizeAppConfig({
    ...config,
    updated_at: new Date().toISOString(),
  });
  await mkdir(dirname(APP_CONFIG_PATH), { recursive: true });
  const tempPath = `${APP_CONFIG_PATH}.${process.pid}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  await rename(tempPath, APP_CONFIG_PATH);
  return next;
}

export async function mutateAppConfig(mutator) {
  const current = await readAppConfig();
  const result = await mutator(current);
  return writeAppConfig(result || current);
}

function envValue(name) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function valueSource(envName, fileValue) {
  return envValue(envName) ? "env" : fileValue ? "config" : "unset";
}

export function getConfiguredDatabaseUrlSync() {
  const envDatabaseUrl = envValue("DATABASE_URL");
  if (envDatabaseUrl) return envDatabaseUrl;
  return readAppConfigSync().database.url;
}

export function hasConfiguredDatabaseSync() {
  return Boolean(getConfiguredDatabaseUrlSync());
}

export async function getRuntimeConfig() {
  const config = await readAppConfig();
  const difyBaseUrl = envValue("DIFY_API_URL") || config.dify.base_url;
  const difyAppKey = envValue("DIFY_API_KEY") || config.dify.app_key;
  const databaseUrl = envValue("DATABASE_URL") || config.database.url;

  return {
    dify: {
      baseUrl: difyBaseUrl,
      appKey: difyAppKey,
      configured: Boolean(difyBaseUrl && difyAppKey),
      baseUrlSource: valueSource("DIFY_API_URL", config.dify.base_url),
      appKeySource: valueSource("DIFY_API_KEY", config.dify.app_key),
    },
    database: {
      url: databaseUrl,
      configured: Boolean(databaseUrl),
      source: valueSource("DATABASE_URL", config.database.url),
    },
  };
}

function maskSecret(value) {
  const text = normalizeString(value);
  if (!text) return "";
  const suffix = text.slice(-4);
  return `${"*".repeat(Math.max(8, Math.min(text.length, 16)))}${suffix}`;
}

export async function getAdminConfigPayload({ authenticated }) {
  const config = await readAppConfig();
  const runtime = await getRuntimeConfig();

  return {
    authenticated,
    initialized: Boolean(config.admin?.password_hash),
    config_path: APP_CONFIG_PATH,
    saved: {
      dify_base_url: config.dify.base_url,
      dify_app_key_configured: Boolean(config.dify.app_key),
      dify_app_key_masked: maskSecret(config.dify.app_key),
      database_url_configured: Boolean(config.database.url),
      database_url_masked: maskSecret(config.database.url),
    },
    effective: {
      dify_base_url: runtime.dify.baseUrl,
      dify_base_url_source: runtime.dify.baseUrlSource,
      dify_app_key_configured: Boolean(runtime.dify.appKey),
      dify_app_key_masked: maskSecret(runtime.dify.appKey),
      dify_app_key_source: runtime.dify.appKeySource,
      database_url_configured: Boolean(runtime.database.url),
      database_url_masked: maskSecret(runtime.database.url),
      database_url_source: runtime.database.source,
    },
    rules: {
      env_overrides_config: true,
      dify_applies_immediately: true,
      database_requires_restart: true,
    },
    diagnostics: config.diagnostics,
  };
}

export async function recordDiagnostic(kind, result) {
  return mutateAppConfig((current) => ({
    ...current,
    diagnostics: {
      ...current.diagnostics,
      [kind]: result,
    },
  }));
}
