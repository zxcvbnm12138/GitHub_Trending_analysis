import { describe, expect, it } from "vitest";
import { normalizeDifyResponse } from "./dify";

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head><title>GitHub Trending 每日热门项目分析</title></head>
<body><h1>Deck</h1></body>
</html>`;

describe("normalizeDifyResponse", () => {
  it("keeps direct html_ppt output from Dify workflow responses", () => {
    const result = normalizeDifyResponse({
      task_id: "task-1",
      data: {
        id: "run-1",
        status: "succeeded",
        outputs: { html_ppt: html },
      },
    });

    expect(result.data.html_ppt).toBe(html);
    expect(result.summary).toBe("GitHub Trending 每日热门项目分析");
    expect(result.data.dify_task_id).toBe("task-1");
    expect(result.data.dify_workflow_run_id).toBe("run-1");
  });

  it("parses JSON strings nested in result outputs", () => {
    const result = normalizeDifyResponse({
      data: {
        outputs: {
          result: JSON.stringify({ html_ppt: html, summary: "Daily deck" }),
        },
      },
    });

    expect(result.data.html_ppt).toBe(html);
    expect(result.summary).toBe("Daily deck");
  });

  it("removes model thinking text before the HTML document", () => {
    const result = normalizeDifyResponse({
      data: {
        outputs: {
          html_ppt: `<think>drafting</think>\n${html}\nextra text`,
        },
      },
    });

    expect(result.data.html_ppt).toBe(html);
  });

  it("normalizes repos_json into top_repos and language breakdown", () => {
    const result = normalizeDifyResponse({
      data: {
        outputs: {
          html_ppt: html,
          repos_json: JSON.stringify([
            {
              rank: 1,
              name: "owner/repo",
              language: "TypeScript",
              stars: 1234,
              forks: 12,
              period_stars: "99 stars today",
            },
          ]),
        },
      },
    });

    expect(result.data.top_repos).toEqual([
      expect.objectContaining({
        rank: 1,
        name: "owner/repo",
        language: "TypeScript",
        stars: 1234,
        forks: 12,
        stars_today: 99,
      }),
    ]);
    expect(result.data.language_breakdown).toEqual([
      { language: "TypeScript", count: 1, percentage: 100 },
    ]);
  });

  it("keeps the legacy structured report shape", () => {
    const payload = {
      summary: "Summary",
      top_repos: [{ name: "owner/repo" }],
      slides: [{ title: "Slide", content_markdown: "Body" }],
    };
    const result = normalizeDifyResponse({ data: { outputs: payload } });

    expect(result.data.top_repos).toEqual([
      expect.objectContaining({ name: "owner/repo" }),
    ]);
    expect(result.data.slides).toEqual(payload.slides);
    expect(result.summary).toBe("Summary");
  });
});
