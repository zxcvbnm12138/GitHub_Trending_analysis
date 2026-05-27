import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import sql, { hasDatabase } from "../utils/sql.js";

const HAS_DATABASE = hasDatabase;
const STORE_PATH = join(process.cwd(), ".data", "trending-dashboard.json");

function today() {
  return new Date().toISOString().slice(0, 10);
}

function defaultStore() {
  return {
    nextReportId: 1,
    nextJobId: 1,
    jobs: [],
    reports: [],
    schedule: null,
  };
}

function normalizeLocalReport(report) {
  return {
    id: report.id,
    user_id: report.user_id ?? null,
    created_at: report.created_at,
    report_date: report.report_date || report.created_at?.slice(0, 10) || today(),
    language_filter: report.language_filter ?? null,
    status: report.status || "pending",
    summary: report.summary || null,
    error_message: report.error_message || null,
    raw_data: report.raw_data || {},
  };
}

function normalizeUserId(userId) {
  return userId == null ? null : String(userId);
}

async function readStore() {
  try {
    const content = await readFile(STORE_PATH, "utf8");
    return { ...defaultStore(), ...JSON.parse(content) };
  } catch (error) {
    if (error?.code === "ENOENT") return defaultStore();
    throw error;
  }
}

async function writeStore(store) {
  await mkdir(dirname(STORE_PATH), { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

async function mutateStore(mutator) {
  const store = await readStore();
  const result = await mutator(store);
  await writeStore(store);
  return result;
}

export async function createPendingReport(userId, languageFilter) {
  const ownerId = normalizeUserId(userId);
  if (HAS_DATABASE) {
    const [row] = await sql`
      INSERT INTO trending_reports (user_id, language_filter, status)
      VALUES (${ownerId}, ${languageFilter}, 'pending')
      RETURNING id
    `;
    return row;
  }

  return mutateStore((store) => {
    const id = store.nextReportId++;
    const now = new Date().toISOString();
    const report = normalizeLocalReport({
      id,
      user_id: ownerId,
      created_at: now,
      report_date: today(),
      language_filter: languageFilter,
      status: "pending",
      raw_data: {},
    });
    store.reports.push(report);
    return { id };
  });
}

export async function createCompletedReport(userId, languageFilter, summary, rawData) {
  const ownerId = normalizeUserId(userId);
  if (HAS_DATABASE) {
    const [row] = await sql`
      INSERT INTO trending_reports (user_id, language_filter, status, summary, raw_data)
      VALUES (${ownerId}, ${languageFilter}, 'completed', ${summary}, ${JSON.stringify(rawData)}::jsonb)
      RETURNING id
    `;
    return row;
  }

  return mutateStore((store) => {
    const id = store.nextReportId++;
    const now = new Date().toISOString();
    const report = normalizeLocalReport({
      id,
      user_id: ownerId,
      created_at: now,
      report_date: today(),
      language_filter: languageFilter,
      status: "completed",
      summary,
      raw_data: rawData,
    });
    store.reports.push(report);
    return { id };
  });
}

export async function findReportForDate(userId, languageFilter, reportDate = today()) {
  const ownerId = normalizeUserId(userId);
  if (HAS_DATABASE) {
    const [row] = await sql`
      SELECT id, status, report_date, language_filter
      FROM trending_reports
      WHERE user_id = ${ownerId}
        AND report_date = ${reportDate}
        AND language_filter IS NOT DISTINCT FROM ${languageFilter}
        AND status IN ('pending', 'completed')
      ORDER BY created_at DESC
      LIMIT 1
    `;
    return row || null;
  }

  const store = await readStore();
  return (
    store.reports
      .map(normalizeLocalReport)
      .filter(
        (report) =>
          report.report_date === reportDate &&
          String(report.user_id ?? "") === String(ownerId ?? "") &&
          report.language_filter === languageFilter &&
          ["pending", "completed"].includes(report.status),
      )
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] ||
    null
  );
}

export async function updateReportCompleted(id, summary, rawData) {
  if (HAS_DATABASE) {
    await sql`
      UPDATE trending_reports
      SET status = 'completed',
          summary = ${summary},
          raw_data = ${JSON.stringify(rawData)}::jsonb
      WHERE id = ${id}
    `;
    return;
  }

  await mutateStore((store) => {
    const report = store.reports.find((item) => item.id === id);
    if (!report) return;
    report.status = "completed";
    report.summary = summary;
    report.raw_data = rawData;
    report.error_message = null;
  });
}

export async function updateReportFailed(id, errorMessage) {
  if (HAS_DATABASE) {
    await sql`
      UPDATE trending_reports
      SET status = 'failed',
          error_message = ${errorMessage}
      WHERE id = ${id}
    `;
    return;
  }

  await mutateStore((store) => {
    const report = store.reports.find((item) => item.id === id);
    if (!report) return;
    report.status = "failed";
    report.error_message = errorMessage;
  });
}

export async function listReports({ userId, language, limit = 100 } = {}) {
  const ownerId = normalizeUserId(userId);
  if (HAS_DATABASE) {
    if (language && language !== "all") {
      return sql`
        SELECT id, created_at, report_date, language_filter, status, summary, error_message,
               raw_data->'top_repos' AS top_repos
        FROM trending_reports
        WHERE user_id = ${ownerId}
          AND language_filter = ${language}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    }

    return sql`
      SELECT id, created_at, report_date, language_filter, status, summary, error_message,
             raw_data->'top_repos' AS top_repos
      FROM trending_reports
      WHERE user_id = ${ownerId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  }

  const store = await readStore();
  return store.reports
    .map(normalizeLocalReport)
    .filter(
      (report) =>
        String(report.user_id ?? "") === String(ownerId ?? "") &&
        (!language || language === "all" || report.language_filter === language),
    )
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit)
    .map((report) => ({
      id: report.id,
      created_at: report.created_at,
      report_date: report.report_date,
      language_filter: report.language_filter,
      status: report.status,
      summary: report.summary,
      error_message: report.error_message,
      top_repos: Array.isArray(report.raw_data?.top_repos) ? report.raw_data.top_repos : null,
    }));
}

export async function getReport(userId, id) {
  const ownerId = normalizeUserId(userId);
  if (HAS_DATABASE) {
    const [row] = await sql`
      SELECT *
      FROM trending_reports
      WHERE id = ${id}
        AND user_id = ${ownerId}
    `;
    return row || null;
  }

  const store = await readStore();
  const report = store.reports.find(
    (item) =>
      String(item.id) === String(id) &&
      String(item.user_id ?? "") === String(ownerId ?? ""),
  );
  return report ? normalizeLocalReport(report) : null;
}

export async function deleteReport(userId, id) {
  const ownerId = normalizeUserId(userId);
  if (HAS_DATABASE) {
    await sql`
      DELETE FROM trending_reports
      WHERE id = ${id}
        AND user_id = ${ownerId}
    `;
    return;
  }

  await mutateStore((store) => {
    store.reports = store.reports.filter(
      (item) =>
        String(item.id) !== String(id) ||
        String(item.user_id ?? "") !== String(ownerId ?? ""),
    );
  });
}

export async function getStats(userId) {
  const ownerId = normalizeUserId(userId);
  if (HAS_DATABASE) {
    const [totals] = await sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS this_week,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days')::int AS last_week
      FROM trending_reports
      WHERE user_id = ${ownerId}
    `;

    const langRows = await sql`
      SELECT COALESCE(language_filter, 'all') AS language, COUNT(*)::int AS count
      FROM trending_reports
      WHERE user_id = ${ownerId}
      GROUP BY COALESCE(language_filter, 'all')
      ORDER BY count DESC
      LIMIT 1
    `;

    const schedule = await getSchedule(ownerId);
    return buildStats(totals, langRows[0]?.language || "—", schedule);
  }

  const store = await readStore();
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const reports = store.reports.map(normalizeLocalReport);
  const userReports = reports.filter(
    (report) => String(report.user_id ?? "") === String(ownerId ?? ""),
  );
  const thisWeek = userReports.filter((report) => now - new Date(report.created_at).getTime() <= sevenDays).length;
  const lastWeek = userReports.filter((report) => {
    const age = now - new Date(report.created_at).getTime();
    return age > sevenDays && age <= sevenDays * 2;
  }).length;
  const counts = new Map();
  for (const report of userReports) {
    const language = report.language_filter || "all";
    counts.set(language, (counts.get(language) || 0) + 1);
  }
  const topLanguage = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

  return buildStats(
    { total: userReports.length, this_week: thisWeek, last_week: lastWeek },
    topLanguage,
    await ensureSchedule(ownerId),
  );
}

function buildStats(totals, topLanguage, schedule) {
  let weekDelta = 0;
  if (totals.last_week > 0) {
    weekDelta = Math.round(((totals.this_week - totals.last_week) / totals.last_week) * 100);
  } else if (totals.this_week > 0) {
    weekDelta = 100;
  }

  return {
    total: totals.total,
    this_week: totals.this_week,
    last_week: totals.last_week,
    week_delta: weekDelta,
    week_percent: Math.min(
      100,
      Math.max(
        0,
        totals.this_week
          ? Math.round((totals.this_week / Math.max(totals.this_week + totals.last_week, 1)) * 100)
          : 0,
      ),
    ),
    top_language: topLanguage,
    next_run_at: schedule?.next_run_at || null,
    schedule_enabled: schedule?.enabled || false,
  };
}

function defaultSchedule(userId) {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setHours(9, 0, 0, 0);
  return {
    id: 1,
    user_id: normalizeUserId(userId),
    enabled: false,
    cron_time: "09:00",
    languages: ["all"],
    last_run_at: null,
    next_run_at: next.toISOString(),
  };
}

export async function ensureSchedule(userId) {
  const ownerId = normalizeUserId(userId);
  if (HAS_DATABASE) {
    const [row] = await sql`
      SELECT *
      FROM report_schedules
      WHERE user_id = ${ownerId}
      ORDER BY id ASC
      LIMIT 1
    `;
    if (row) return row;
    const [created] = await sql`
      INSERT INTO report_schedules (user_id, enabled, cron_time, languages, next_run_at)
      VALUES (${ownerId}, false, '09:00', ARRAY['all']::text[], NOW() + INTERVAL '1 day')
      RETURNING *
    `;
    return created;
  }

  return mutateStore((store) => {
    if (!store.schedule) store.schedule = defaultSchedule(ownerId);
    return store.schedule;
  });
}

export async function getSchedule(userId) {
  const ownerId = normalizeUserId(userId);
  if (HAS_DATABASE) {
    const [row] = await sql`
      SELECT *
      FROM report_schedules
      WHERE user_id = ${ownerId}
      ORDER BY id ASC
      LIMIT 1
    `;
    return row || null;
  }
  return ensureSchedule(ownerId);
}

export async function getScheduleById(id, userId = null) {
  const ownerId = normalizeUserId(userId);
  if (HAS_DATABASE) {
    if (ownerId) {
      const [row] = await sql`
        SELECT *
        FROM report_schedules
        WHERE id = ${id}
          AND user_id = ${ownerId}
      `;
      return row || null;
    }
    const [row] = await sql`SELECT * FROM report_schedules WHERE id = ${id}`;
    return row || null;
  }

  const store = await readStore();
  const schedule = store.schedule || defaultSchedule(ownerId);
  return String(schedule.id) === String(id) ? schedule : null;
}

export async function listEnabledSchedules() {
  if (HAS_DATABASE) {
    return sql`
      SELECT *
      FROM report_schedules
      WHERE enabled = true
        AND user_id IS NOT NULL
      ORDER BY next_run_at ASC NULLS LAST, id ASC
    `;
  }

  const store = await readStore();
  return store.schedule?.enabled ? [store.schedule] : [];
}

export async function updateSchedule({ id, userId, enabled, cronTime, languages, nextRunAt }) {
  const ownerId = normalizeUserId(userId);
  if (HAS_DATABASE) {
    const [updated] = await sql`
      UPDATE report_schedules
      SET enabled = ${enabled},
          cron_time = ${cronTime},
          languages = ${languages},
          next_run_at = ${nextRunAt}
      WHERE id = ${id}
        AND user_id = ${ownerId}
      RETURNING *
    `;
    return updated;
  }

  return mutateStore((store) => {
    if (!store.schedule) store.schedule = defaultSchedule(ownerId);
    store.schedule = {
      ...store.schedule,
      enabled,
      cron_time: cronTime,
      languages,
      next_run_at: nextRunAt,
    };
    return store.schedule;
  });
}

export async function markScheduleRan({ id, userId, nextRunAt }) {
  const ownerId = normalizeUserId(userId);
  if (HAS_DATABASE) {
    await sql`
      UPDATE report_schedules
      SET last_run_at = NOW(), next_run_at = ${nextRunAt}
      WHERE id = ${id}
        AND user_id = ${ownerId}
    `;
    return;
  }

  await mutateStore((store) => {
    if (!store.schedule) store.schedule = defaultSchedule(ownerId);
    store.schedule.last_run_at = new Date().toISOString();
    store.schedule.next_run_at = nextRunAt;
  });
}
