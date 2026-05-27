const OUTPUT_KEYS_TO_PARSE = ["result", "output", "answer", "text", "data"];

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stripCodeFence(value) {
  const trimmed = String(value ?? "").trim();
  const match = trimmed.match(/^```(?:json|html)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : trimmed;
}

function tryParseJson(value) {
  if (typeof value !== "string") return value;
  const text = stripCodeFence(value);
  if (!text || (!text.startsWith("{") && !text.startsWith("["))) return value;

  try {
    return JSON.parse(text);
  } catch {
    return value;
  }
}

function parseInteger(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const match = String(value ?? "").match(/[\d,]+/);
  if (!match) return null;
  const parsed = Number.parseInt(match[0].replace(/,/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function looksLikeHtmlDocument(value) {
  return Boolean(extractHtmlDocument(value));
}

function extractHtmlDocument(value) {
  if (typeof value !== "string") return null;

  const text = stripCodeFence(value);
  const lower = text.toLowerCase();
  const doctypeIndex = lower.indexOf("<!doctype html");
  const htmlIndex = lower.indexOf("<html");
  const start =
    doctypeIndex >= 0
      ? doctypeIndex
      : htmlIndex >= 0
        ? htmlIndex
        : -1;

  if (start < 0) return null;

  const end = lower.lastIndexOf("</html>");
  return text.slice(start, end >= start ? end + "</html>".length : undefined).trim();
}

function parseNestedOutputs(outputs) {
  const parsed = tryParseJson(outputs);

  if (!isObject(parsed)) {
    return parsed;
  }

  for (const key of OUTPUT_KEYS_TO_PARSE) {
    if (typeof parsed[key] !== "string") continue;
    const inner = tryParseJson(parsed[key]);
    if (isObject(inner)) return { ...parsed, ...inner };
    const html = extractHtmlDocument(inner);
    if (html) return { ...parsed, html_ppt: html };
  }

  return parsed;
}

function extractOutputs(difyJson) {
  return (
    difyJson?.data?.outputs ??
    difyJson?.outputs ??
    difyJson?.data ??
    difyJson
  );
}

function findHtmlPpt(value, depth = 0) {
  if (depth > 4 || value == null) return null;
  const html = extractHtmlDocument(value);
  if (html) return html;
  if (!isObject(value) && !Array.isArray(value)) return null;

  if (typeof value.html_ppt === "string" && value.html_ppt.trim()) {
    return extractHtmlDocument(value.html_ppt) || value.html_ppt;
  }

  if (isObject(value)) {
    for (const key of OUTPUT_KEYS_TO_PARSE) {
      const nested = findHtmlPpt(tryParseJson(value[key]), depth + 1);
      if (nested) return nested;
    }
  }

  for (const nestedValue of Object.values(value)) {
    const nested = findHtmlPpt(tryParseJson(nestedValue), depth + 1);
    if (nested) return nested;
  }

  return null;
}

function stripTags(value) {
  return String(value ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html) {
  if (typeof html !== "string") return "";
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? stripTags(match[1]) : "";
}

function pickSummary(data, htmlPpt) {
  const candidates = [
    data?.summary,
    data?.overview,
    data?.trends_overview,
    data?.title,
    data?.result,
    data?.output,
    data?.answer,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      if (looksLikeHtmlDocument(candidate)) continue;
      const parsedCandidate = tryParseJson(candidate);
      if (isObject(parsedCandidate) || Array.isArray(parsedCandidate)) continue;
      return stripTags(candidate).slice(0, 2000);
    }
  }

  const title = extractTitle(htmlPpt);
  if (title) return title;

  return htmlPpt ? "Dify HTML presentation generated." : "";
}

function normalizeRepo(repo, index) {
  if (!isObject(repo)) return null;
  const starsToday = parseInteger(repo.stars_today ?? repo.period_stars);
  return {
    rank: parseInteger(repo.rank) ?? index + 1,
    name: repo.name || [repo.owner, repo.repo].filter(Boolean).join("/") || `#${index + 1}`,
    owner: repo.owner || null,
    repo: repo.repo || null,
    url: repo.url || null,
    description: repo.description || "",
    language: repo.language && repo.language !== "Unknown" ? repo.language : null,
    stars: parseInteger(repo.stars),
    forks: parseInteger(repo.forks),
    stars_today: starsToday,
    period_stars: repo.period_stars || null,
  };
}

function parseRepos(value) {
  const parsed = tryParseJson(value);
  if (!Array.isArray(parsed)) return null;
  return parsed
    .map((repo, index) => normalizeRepo(repo, index))
    .filter(Boolean);
}

function buildLanguageBreakdown(repos) {
  if (!Array.isArray(repos) || repos.length === 0) return [];

  const counts = new Map();
  for (const repo of repos) {
    const language = repo.language || "Unknown";
    counts.set(language, (counts.get(language) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([language, count]) => ({
      language,
      count,
      percentage: Math.round((count / repos.length) * 100),
    }));
}

function enrichStructuredData(data) {
  const repos =
    parseRepos(data.repos_json) ||
    parseRepos(data.top_repos) ||
    parseRepos(data.repositories);

  if (repos?.length) {
    data.top_repos = repos;
    if (!Array.isArray(data.language_breakdown)) {
      data.language_breakdown = buildLanguageBreakdown(repos);
    }
  }

  return data;
}

export function normalizeDifyResponse(difyJson) {
  const outputs = extractOutputs(difyJson);
  const parsed = parseNestedOutputs(outputs);
  const htmlPpt = findHtmlPpt(parsed);
  const data = isObject(parsed)
    ? { ...parsed }
    : { summary: typeof parsed === "string" ? parsed : JSON.stringify(parsed) };

  if (htmlPpt) {
    data.html_ppt = htmlPpt;
  }

  enrichStructuredData(data);

  const summary = pickSummary(data, htmlPpt);
  if (summary && !data.summary) {
    data.summary = summary;
  }

  if (difyJson?.task_id) data.dify_task_id = difyJson.task_id;
  if (difyJson?.workflow_run_id) data.dify_workflow_run_id = difyJson.workflow_run_id;
  if (difyJson?.data?.id) data.dify_workflow_run_id = difyJson.data.id;
  if (difyJson?.data?.status) data.dify_status = difyJson.data.status;

  return { data, summary };
}

function parseSseEvent(rawEvent) {
  const dataLines = rawEvent
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim());

  if (dataLines.length === 0) return null;

  const data = dataLines.join("\n");
  if (!data || data === "[DONE]") return null;

  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function readStreamingWorkflow(response) {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Dify streaming response did not include a readable body.");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let finishedEvent = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() || "";

    for (const rawEvent of events) {
      const event = parseSseEvent(rawEvent);
      if (!event) continue;

      if (event.event === "error") {
        throw new Error(event.message || event.error || "Dify streaming workflow failed.");
      }

      if (event.event === "workflow_finished") {
        finishedEvent = event;
      }
    }
  }

  if (buffer.trim()) {
    const event = parseSseEvent(buffer);
    if (event?.event === "error") {
      throw new Error(event.message || event.error || "Dify streaming workflow failed.");
    }
    if (event?.event === "workflow_finished") {
      finishedEvent = event;
    }
  }

  if (!finishedEvent) {
    throw new Error("Dify streaming workflow ended without a workflow_finished event.");
  }

  if (finishedEvent.data?.status && finishedEvent.data.status !== "succeeded") {
    throw new Error(
      finishedEvent.data?.error ||
        `Dify workflow finished with status ${finishedEvent.data.status}.`,
    );
  }

  return finishedEvent;
}

export async function runDifyWorkflow({
  difyUrl,
  difyKey,
  user,
  dateRange = "当日",
}) {
  const endpoint = `${difyUrl.replace(/\/$/, "")}/workflows/run`;
  const difyRes = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${difyKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: {
        date_range: dateRange,
      },
      response_mode: "streaming",
      user,
    }),
  });

  if (!difyRes.ok) {
    const errText = await difyRes.text();
    throw new Error(
      `Dify responded ${difyRes.status} ${difyRes.statusText}: ${errText.slice(0, 300)}`,
    );
  }

  const contentType = difyRes.headers.get("content-type") || "";
  const difyJson = contentType.includes("text/event-stream")
    ? await readStreamingWorkflow(difyRes)
    : await difyRes.json();
  return normalizeDifyResponse(difyJson);
}
