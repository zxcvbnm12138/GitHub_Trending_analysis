import { useEffect, useState, useCallback } from "react";

// 翻译字典
const dict = {
  zh: {
    // 通用
    "common.loading": "加载中…",
    "common.save": "保存",
    "common.saving": "保存中…",
    "common.saved": "已保存",
    "common.cancel": "取消",
    "common.confirm": "确认",
    "common.delete": "删除",
    "common.download": "下载",
    "common.view": "查看",
    "common.back": "返回",
    "common.next": "下一个",
    "common.previous": "上一个",
    "common.total": "共 {n} 条",
    "common.enabled": "已启用",
    "common.disabled": "已关闭",
    "common.never": "从未",
    "common.unknown": "未知",
    "common.all": "全部",
    "common.tip": "提示",

    // 导航
    "nav.dashboard": "仪表盘",
    "nav.compare": "对比",
    "nav.schedule": "计划",
    "nav.brand": "趋势报告",

    // 状态
    "status.completed": "已完成",
    "status.pending": "生成中",
    "status.failed": "失败",

    // 仪表盘
    "dashboard.title": "GitHub 趋势报告",
    "dashboard.subtitle":
      "每日 GitHub Trending 仓库的智能分析，自动整理成可演示的幻灯片报告。",
    "dashboard.date_range.today": "当天",
    "dashboard.date_range.week": "当周",
    "dashboard.date_range.month": "当月",
    "dashboard.btn.generate": "生成报告",
    "dashboard.btn.generating": "生成中…",
    "dashboard.stats.total": "报告总数",
    "dashboard.stats.total_sub": "所有时间",
    "dashboard.stats.this_week": "本周新增",
    "dashboard.stats.week_delta": "{sign}{value}% 较上周",
    "dashboard.stats.top_lang": "最关注语言",
    "dashboard.stats.top_lang_sub": "按报告数量统计",
    "dashboard.stats.next_run": "下次计划执行",
    "dashboard.stats.next_run_sub_on": "打开仪表盘时自动触发",
    "dashboard.stats.next_run_sub_off": "前往计划页面启用",
    "dashboard.filter.label": "按语言筛选",
    "dashboard.list.title": "全部报告",
    "dashboard.list.delete": "删除报告",
    "dashboard.list.deleting": "删除中…",
    "dashboard.list.delete_selected": "删除 {n} 条",
    "dashboard.list.select_all": "全选",
    "dashboard.list.select_report": "选择报告 #{id}",
    "dashboard.delete.confirm": "确认删除选中的 {n} 条报告？此操作不可撤销。",
    "dashboard.empty.title": "还没有报告",
    "dashboard.empty.desc":
      "每份报告包含热门仓库、AI 分析总结和可下载的 HTML 幻灯片。",
    "dashboard.empty.bullet1": "热门趋势仓库",
    "dashboard.empty.bullet2": "AI 总结与关键趋势",
    "dashboard.empty.bullet3": "可下载的演示文稿",
    "dashboard.empty.btn_generate": "通过 Dify 生成",
    "dashboard.row.report_id": "报告 #{id}",
    "dashboard.row.all_languages": "全部语言",
    "dashboard.error.title": "无法通过 Dify 生成报告",
    "dashboard.error.tip": "请检查 DIFY_API_URL 和 DIFY_API_KEY 环境变量是否已配置。",
    "dashboard.error.tip_btn": "",
    "dashboard.error.tip_end": "",

    // 报告详情
    "report.breadcrumb": "报告列表",
    "report.loading": "正在加载报告…",
    "report.btn.download": "下载 HTML",
    "report.btn.open_slideshow": "打开幻灯片",
    "report.tab.analysis": "分析报告",
    "report.tab.slides": "幻灯片",
    "report.failed.title": "报告生成失败",
    "report.failed.unknown": "未知错误。",
    "report.pending.title": "报告正在生成",
    "report.pending.desc": "Dify 工作流正在后台运行，完成后页面会自动刷新。",
    "report.summary.title": "整体总结",
    "report.summary.empty": "暂无总结。",
    "report.repos.title": "热门趋势仓库",
    "report.repos.subtitle": "按关注度排序。",
    "report.repos.empty": "未返回任何仓库。",
    "report.repos.stars_today": "今日新增 {n}",
    "report.trends.title": "关键趋势",
    "report.lang.title": "语言分布",
    "report.lang.subtitle": "热门活动的语言占比。",
    "report.lang.empty": "暂无数据。",
    "report.about.title": "关于此报告",
    "report.about.generated": "生成时间：{time}",
    "report.about.status": "状态：{status}",
    "report.about.filter": "筛选：{filter}",

    // 幻灯片
    "slides.counter": "第 {current} / {total} 页",
    "slides.btn.download": "下载 HTML",
    "slides.btn.present": "演示模式",
    "slides.tip": "使用 ← → 方向键切换",

    // 计划
    "schedule.title": "计划设置",
    "schedule.subtitle":
      "配置自动报告生成计划，并下载 Dify 工作流文件一键导入。",
    "schedule.dify.title": "Dify 工作流文件",
    "schedule.dify.subtitle":
      "下载现成的 .yml 工作流文件，直接导入 Dify，无需手动搭建节点。",
    "schedule.dify.download": "下载 .yml 文件",
    "schedule.dify.step1.title": "导入工作流",
    "schedule.dify.step1.desc":
      "登录 Dify → 点击「创建应用」→ 选择「从 DSL 文件导入」→ 上传下载的 .yml 文件",
    "schedule.dify.step1.link": "打开 Dify",
    "schedule.dify.step2.title": "选择 LLM 模型",
    "schedule.dify.step2.desc":
      "导入后点击 LLM 节点，选择你已配置好的模型（GPT-4o、Claude、通义千问等均可）",
    "schedule.dify.step3.title": "填入 API 信息",
    "schedule.dify.step3.desc":
      "点击右上角「发布」后进入 API 页面，将密钥和地址填入应用的 DIFY_API_KEY 与 DIFY_API_URL 环境变量",
    "schedule.dify.info":
      "工作流内含：HTTP 抓取节点（自动请求 GitHub Trending 页面）+ LLM 分析节点（输出结构化 JSON 报告，包含摘要、热门仓库、语言分布、幻灯片内容）。导入后只需选择模型，无需手动写提示词或连线。",
    "schedule.form.auto_title": "自动生成报告",
    "schedule.form.auto_desc": "启用后，每日会在指定时间自动生成报告。",
    "schedule.form.time_label": "每日执行时间",
    "schedule.form.lang_label": "跟踪的语言",
    "schedule.form.lang_hint": "每个语言每次执行会生成一份独立报告。",
    "schedule.form.runs_when": "运行时机：后台任务队列会在指定时间自动触发。",
    "schedule.status.title": "当前状态",
    "schedule.status.next": "下次执行：{time}",
    "schedule.status.last": "上次执行：{time}",
    "schedule.status.langs": "跟踪语言：",

    // 对比
    "compare.title": "对比趋势",
    "compare.subtitle": "选择两份报告，查看哪些仓库重合，哪些仓库各自独有。",
    "compare.picker.a": "报告 A",
    "compare.picker.b": "报告 B",
    "compare.picker.placeholder": "选择一份报告…",
    "compare.empty.title": "请选择两份报告",
    "compare.empty.desc": "选择后将显示共同仓库和差异仓库。",
    "compare.common.title": "共同仓库",
    "compare.common.desc": "在两份报告中均出现。",
    "compare.common.empty": "没有重合的仓库。",
    "compare.only_a": "仅在报告 A 中",
    "compare.only_b": "仅在报告 B 中",
    "compare.column.empty": "没有独有仓库。",
    "compare.column.stars_today": "今日新增 {n}",
    "compare.column.view": "查看",

    // 语言
    "lang.all": "全部",
    "lang.python": "Python",
    "lang.javascript": "JavaScript",
    "lang.typescript": "TypeScript",
    "lang.go": "Go",
    "lang.rust": "Rust",
    "lang.java": "Java",
    "lang.cpp": "C++",
    "lang.switch": "语言",
  },
  en: {
    "common.loading": "Loading…",
    "common.save": "Save",
    "common.saving": "Saving…",
    "common.saved": "Saved",
    "common.cancel": "Cancel",
    "common.confirm": "Confirm",
    "common.delete": "Delete",
    "common.download": "Download",
    "common.view": "View",
    "common.back": "Back",
    "common.next": "Next",
    "common.previous": "Previous",
    "common.total": "{n} total",
    "common.enabled": "Enabled",
    "common.disabled": "Disabled",
    "common.never": "Never",
    "common.unknown": "Unknown",
    "common.all": "All",
    "common.tip": "Tip",

    "nav.dashboard": "Dashboard",
    "nav.compare": "Compare",
    "nav.schedule": "Schedule",
    "nav.brand": "Trending Reports",

    "status.completed": "Completed",
    "status.pending": "Running",
    "status.failed": "Failed",

    "dashboard.title": "GitHub Trending Reports",
    "dashboard.subtitle":
      "Daily AI-powered analysis of GitHub trending repositories, packaged into presentations.",
    "dashboard.date_range.today": "Today",
    "dashboard.date_range.week": "This week",
    "dashboard.date_range.month": "This month",
    "dashboard.btn.generate": "Generate report",
    "dashboard.btn.generating": "Generating…",
    "dashboard.stats.total": "Total reports",
    "dashboard.stats.total_sub": "All time",
    "dashboard.stats.this_week": "This week",
    "dashboard.stats.week_delta": "{sign}{value}% vs last week",
    "dashboard.stats.top_lang": "Most tracked",
    "dashboard.stats.top_lang_sub": "By report count",
    "dashboard.stats.next_run": "Next scheduled run",
    "dashboard.stats.next_run_sub_on": "Auto-runs on dashboard visit",
    "dashboard.stats.next_run_sub_off": "Enable in Schedule",
    "dashboard.filter.label": "Filter by language",
    "dashboard.list.title": "All reports",
    "dashboard.list.delete": "Delete reports",
    "dashboard.list.deleting": "Deleting…",
    "dashboard.list.delete_selected": "Delete {n}",
    "dashboard.list.select_all": "Select all",
    "dashboard.list.select_report": "Select report #{id}",
    "dashboard.delete.confirm": "Delete {n} selected reports? This cannot be undone.",
    "dashboard.empty.title": "No reports yet",
    "dashboard.empty.desc":
      "Each report includes trending repositories, an AI-written analysis, and a downloadable HTML presentation.",
    "dashboard.empty.bullet1": "Top trending repositories",
    "dashboard.empty.bullet2": "AI summary and key trends",
    "dashboard.empty.bullet3": "Downloadable slideshow",
    "dashboard.empty.btn_generate": "Generate via Dify",
    "dashboard.row.report_id": "Report #{id}",
    "dashboard.row.all_languages": "All languages",
    "dashboard.error.title": "Could not generate via Dify",
    "dashboard.error.tip": "Please check that DIFY_API_URL and DIFY_API_KEY are configured.",
    "dashboard.error.tip_btn": "",
    "dashboard.error.tip_end": "",

    "report.breadcrumb": "Reports",
    "report.loading": "Loading report…",
    "report.btn.download": "Download HTML",
    "report.btn.open_slideshow": "Open slideshow",
    "report.tab.analysis": "Analysis",
    "report.tab.slides": "Slideshow",
    "report.failed.title": "Report failed to generate",
    "report.failed.unknown": "Unknown error.",
    "report.pending.title": "Report is generating",
    "report.pending.desc":
      "The Dify workflow is running in the background. This page will refresh automatically.",
    "report.summary.title": "Executive summary",
    "report.summary.empty": "No summary available.",
    "report.repos.title": "Top trending repositories",
    "report.repos.subtitle": "Ranked by attention across the trending window.",
    "report.repos.empty": "No repositories returned.",
    "report.repos.stars_today": "+{n} today",
    "report.trends.title": "Key trends",
    "report.lang.title": "Language breakdown",
    "report.lang.subtitle": "Share of trending activity.",
    "report.lang.empty": "No data.",
    "report.about.title": "About this report",
    "report.about.generated": "Generated {time}",
    "report.about.status": "Status: {status}",
    "report.about.filter": "Filter: {filter}",

    "slides.counter": "Slide {current} of {total}",
    "slides.btn.download": "Download HTML",
    "slides.btn.present": "Present",
    "slides.tip": "Use ← → keys to navigate",

    "schedule.title": "Schedule",
    "schedule.subtitle":
      "Configure automatic report generation and download the Dify workflow file.",
    "schedule.dify.title": "Dify workflow file",
    "schedule.dify.subtitle":
      "Download a ready-made .yml workflow and import it into Dify — no manual node setup needed.",
    "schedule.dify.download": "Download .yml",
    "schedule.dify.step1.title": "Import workflow",
    "schedule.dify.step1.desc":
      "Log in to Dify → Create app → Import from DSL → upload the .yml file you downloaded.",
    "schedule.dify.step1.link": "Open Dify",
    "schedule.dify.step2.title": "Select LLM model",
    "schedule.dify.step2.desc":
      "After import, click the LLM node and select a model you have configured (GPT-4o, Claude, Qwen, etc.).",
    "schedule.dify.step3.title": "Fill in API info",
    "schedule.dify.step3.desc":
      "Publish, open the API page, and put the key + URL into DIFY_API_KEY and DIFY_API_URL env vars.",
    "schedule.dify.info":
      "The workflow contains: an HTTP node (fetches GitHub Trending page) + an LLM node (returns structured JSON with summary, repos, language breakdown, and slides). Just select a model after import.",
    "schedule.form.auto_title": "Automatic reports",
    "schedule.form.auto_desc":
      "When enabled, reports are generated daily at the chosen time.",
    "schedule.form.time_label": "Daily run time",
    "schedule.form.lang_label": "Languages to track",
    "schedule.form.lang_hint": "One report is generated per language each run.",
    "schedule.form.runs_when":
      "A background job queue triggers runs automatically at the scheduled time.",
    "schedule.status.title": "Status",
    "schedule.status.next": "Next run: {time}",
    "schedule.status.last": "Last run: {time}",
    "schedule.status.langs": "Tracked languages: ",

    "compare.title": "Compare trends",
    "compare.subtitle":
      "Select two reports to see which repositories overlap and which are unique.",
    "compare.picker.a": "Report A",
    "compare.picker.b": "Report B",
    "compare.picker.placeholder": "Select a report…",
    "compare.empty.title": "Pick two reports",
    "compare.empty.desc":
      "Once selected, common and diverging repositories will appear here.",
    "compare.common.title": "Common repositories",
    "compare.common.desc": "Appear in both selected reports.",
    "compare.common.empty": "No overlap.",
    "compare.only_a": "Only in Report A",
    "compare.only_b": "Only in Report B",
    "compare.column.empty": "No unique repositories.",
    "compare.column.stars_today": "+{n} today",
    "compare.column.view": "View",

    "lang.all": "All",
    "lang.python": "Python",
    "lang.javascript": "JavaScript",
    "lang.typescript": "TypeScript",
    "lang.go": "Go",
    "lang.rust": "Rust",
    "lang.java": "Java",
    "lang.cpp": "C++",
    "lang.switch": "Language",
  },
};

const LS_KEY = "app-locale";

function detectInitialLocale() {
  if (typeof window === "undefined") return "zh";
  try {
    const saved = window.localStorage.getItem(LS_KEY);
    if (saved === "zh" || saved === "en") return saved;
  } catch {}
  const browser =
    (typeof navigator !== "undefined" && navigator.language) || "";
  return browser.toLowerCase().startsWith("zh") ? "zh" : "en";
}

// 简单的事件订阅，跨组件同步语言切换
const listeners = new Set();
let currentLocale = "zh";

export function getLocale() {
  return currentLocale;
}

export function setLocale(loc) {
  if (loc !== "zh" && loc !== "en") return;
  currentLocale = loc;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(LS_KEY, loc);
      document.documentElement.setAttribute(
        "lang",
        loc === "zh" ? "zh-CN" : "en",
      );
    } catch {}
  }
  listeners.forEach((fn) => fn(loc));
}

export function useLocale() {
  const [locale, setLocaleState] = useState(currentLocale);

  // 初始化（仅在客户端首次挂载时同步一次）
  useEffect(() => {
    const initial = detectInitialLocale();
    currentLocale = initial;
    setLocaleState(initial);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute(
        "lang",
        initial === "zh" ? "zh-CN" : "en",
      );
    }
    const handler = (loc) => setLocaleState(loc);
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  const t = useCallback(
    (key, params) => {
      const table = dict[locale] || dict.zh;
      let text = table[key] ?? dict.zh[key] ?? key;
      if (params && typeof params === "object") {
        Object.keys(params).forEach((k) => {
          text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(params[k]));
        });
      }
      return text;
    },
    [locale],
  );

  return { locale, setLocale, t };
}

// 日期/时间格式化（按语言）
export function formatDate(iso, locale) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(iso, locale) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(locale === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
