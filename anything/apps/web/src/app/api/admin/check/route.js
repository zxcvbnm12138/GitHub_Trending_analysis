import { runDifyWorkflow } from "../../reports/dify.js";
import {
  getRuntimeConfig,
  recordDiagnostic,
} from "../../utils/app-config.js";
import { requireAdminUser } from "../../utils/user-auth.js";
import {
  ensureDatabaseSchema,
  getLocalStoreSummary,
  inspectDatabaseSchema,
  migrateLocalStoreToDatabase,
  schemaIsReady,
} from "../../utils/db-admin.js";

function elapsed(start) {
  return Date.now() - start;
}

function maskSecret(value) {
  const text = String(value || "");
  if (!text) return "";
  return `${"*".repeat(Math.max(8, Math.min(text.length, 16)))}${text.slice(-4)}`;
}

function sanitize(value, secrets = []) {
  let text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  for (const secret of secrets) {
    if (secret && String(secret).length > 3) {
      text = text.split(String(secret)).join(maskSecret(secret));
    }
  }
  text = text.replace(
    /(postgres(?:ql)?:\/\/[^:\s/]+:)[^@\s]+(@)/gi,
    "$1****$2",
  );
  text = text.replace(/(authorization:\s*bearer\s+)[^\s"']+/gi, "$1****");
  text = text.replace(/(Bearer\s+)[A-Za-z0-9._-]+/g, "$1****");
  return text;
}

function result({ kind, status, summary, durationMs, details }) {
  return {
    kind,
    status,
    summary,
    checked_at: new Date().toISOString(),
    duration_ms: durationMs,
    details: details || {},
  };
}

async function guarded(kind, secrets, fn) {
  const start = Date.now();
  try {
    return await fn(start);
  } catch (error) {
    return result({
      kind,
      status: "error",
      summary: error.message || "Check failed.",
      durationMs: elapsed(start),
      details: {
        error: sanitize(error.message || error, secrets),
      },
    });
  }
}

async function checkDify({ confirmed }) {
  const runtime = await getRuntimeConfig();
  const secrets = [runtime.dify.appKey, runtime.database.url];
  const start = Date.now();

  if (!runtime.dify.baseUrl || !runtime.dify.appKey) {
    return result({
      kind: "dify",
      status: "error",
      summary: "Dify Base URL or App Key is not configured.",
      durationMs: elapsed(start),
      details: {
        base_url_source: runtime.dify.baseUrlSource,
        app_key_source: runtime.dify.appKeySource,
      },
    });
  }

  if (!confirmed) {
    return result({
      kind: "dify",
      status: "error",
      summary: "Dify test requires confirmation because it runs the workflow.",
      durationMs: elapsed(start),
      details: { requires_confirmation: true },
    });
  }

  return guarded("dify", secrets, async (guardStart) => {
    const { data, summary } = await runDifyWorkflow({
      difyUrl: runtime.dify.baseUrl,
      difyKey: runtime.dify.appKey,
      user: "trending-dashboard-settings-check",
      dateRange: "当日",
    });

    const topRepos = Array.isArray(data?.top_repos) ? data.top_repos.length : 0;
    const slides = Array.isArray(data?.slides) ? data.slides.length : 0;
    const hasHtml = Boolean(data?.html_ppt);
    const recognizable = Boolean(summary || topRepos || slides || hasHtml);

    return result({
      kind: "dify",
      status: recognizable ? "success" : "warning",
      summary: recognizable
        ? "Dify workflow ran successfully and returned parseable output."
        : "Dify workflow ran, but the output did not match the expected report shape.",
      durationMs: elapsed(guardStart),
      details: {
        base_url: runtime.dify.baseUrl,
        base_url_source: runtime.dify.baseUrlSource,
        app_key_source: runtime.dify.appKeySource,
        summary: summary ? String(summary).slice(0, 300) : "",
        top_repos: topRepos,
        slides,
        has_html_ppt: hasHtml,
      },
    });
  });
}

async function checkDatabase() {
  const runtime = await getRuntimeConfig();
  const start = Date.now();
  const localSummary = await getLocalStoreSummary();

  if (!runtime.database.url) {
    return result({
      kind: "database",
      status: "warning",
      summary: "Database URL is not configured. The app is using local file storage.",
      durationMs: elapsed(start),
      details: {
        storage_mode: "local_file",
        local_store: localSummary,
      },
    });
  }

  return guarded("database", [runtime.database.url], async (guardStart) => {
    const schema = await inspectDatabaseSchema(runtime.database.url);
    const ready = schemaIsReady(schema);
    return result({
      kind: "database",
      status: ready ? "success" : "warning",
      summary: ready
        ? "Database connection and schema are ready."
        : "Database is reachable, but tables, columns, or indexes are missing.",
      durationMs: elapsed(guardStart),
      details: {
        source: runtime.database.source,
        schema,
        local_store: localSummary,
      },
    });
  });
}

async function initializeDatabase() {
  const runtime = await getRuntimeConfig();
  const start = Date.now();

  if (!runtime.database.url) {
    return result({
      kind: "database",
      status: "error",
      summary: "Database URL is not configured.",
      durationMs: elapsed(start),
      details: {},
    });
  }

  return guarded("database", [runtime.database.url], async (guardStart) => {
    const schema = await ensureDatabaseSchema(runtime.database.url);
    return result({
      kind: "database",
      status: schemaIsReady(schema) ? "success" : "warning",
      summary: "Database initialization finished.",
      durationMs: elapsed(guardStart),
      details: {
        source: runtime.database.source,
        schema,
      },
    });
  });
}

async function migrateLocalData() {
  const runtime = await getRuntimeConfig();
  const start = Date.now();

  if (!runtime.database.url) {
    return result({
      kind: "migration",
      status: "error",
      summary: "Database URL is not configured.",
      durationMs: elapsed(start),
      details: {},
    });
  }

  return guarded("migration", [runtime.database.url], async (guardStart) => {
    const migration = await migrateLocalStoreToDatabase(runtime.database.url);
    return result({
      kind: "migration",
      status: migration.reports.failed || migration.jobs.failed ? "warning" : "success",
      summary: "Local data migration finished.",
      durationMs: elapsed(guardStart),
      details: migration,
    });
  });
}

function overallStatus(results) {
  if (results.some((item) => item.status === "error")) return "error";
  if (results.some((item) => item.status === "warning")) return "warning";
  return "success";
}

export async function POST(request) {
  const guard = await requireAdminUser(request);
  if (!guard.ok) return guard.response;

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const target = body.target || "all";
  const confirmed = body.confirm_external_call === true;

  if (target === "dify") {
    const dify = await checkDify({ confirmed });
    await recordDiagnostic("dify", dify);
    return Response.json({ result: dify });
  }

  if (target === "database") {
    const database = await checkDatabase();
    await recordDiagnostic("database", database);
    return Response.json({ result: database });
  }

  if (target === "init_database") {
    const database = await initializeDatabase();
    await recordDiagnostic("database", database);
    return Response.json({ result: database });
  }

  if (target === "migrate_local") {
    const migration = await migrateLocalData();
    await recordDiagnostic("migration", migration);
    return Response.json({ result: migration });
  }

  if (target === "all") {
    const results = [await checkDatabase()];
    const runtime = await getRuntimeConfig();
    if (runtime.dify.configured) {
      results.push(await checkDify({ confirmed }));
    } else {
      results.push(await checkDify({ confirmed: false }));
    }

    const all = result({
      kind: "all",
      status: overallStatus(results),
      summary: "Self-check finished.",
      durationMs: results.reduce((sum, item) => sum + (item.duration_ms || 0), 0),
      details: { results },
    });
    await recordDiagnostic("database", results[0]);
    await recordDiagnostic("dify", results[1]);
    await recordDiagnostic("all", all);
    return Response.json({ result: all, results });
  }

  return Response.json({ error: "unknown_target" }, { status: 400 });
}
