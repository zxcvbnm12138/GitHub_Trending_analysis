import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Download,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Star,
  Sparkles,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import AppShell from "../../../components/AppShell";
import Ring from "../../../components/Ring";
import MarkdownLite from "../../../components/MarkdownLite";
import {
  OutlinePill,
  PrimaryButton,
  SecondaryButton,
} from "../../../components/Pills";
import { useLocale, formatDate, formatDateTime } from "../../../utils/i18n";

export default function ReportDetailPage(props) {
  const { t, locale } = useLocale();
  const id = props?.params?.id;
  const [tab, setTab] = useState("analysis");

  const { data, isLoading, error } = useQuery({
    queryKey: ["report", id],
    queryFn: async () => {
      const r = await fetch(`/api/reports/${id}`);
      if (!r.ok) throw new Error(`report ${r.status}`);
      const j = await r.json();
      return j.report;
    },
    enabled: !!id,
    refetchInterval: (query) =>
      query.state.data?.status === "pending" ? 5000 : false,
  });

  const TABS = [
    { key: "analysis", label: t("report.tab.analysis") },
    { key: "slides", label: t("report.tab.slides") },
  ];

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        {/* 面包屑 + 操作 */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <a
              href="/"
              className="text-gray-500 hover:text-gray-900 inline-flex items-center gap-1"
            >
              <ArrowLeft size={14} /> {t("report.breadcrumb")}
            </a>
            <span className="text-gray-300">/</span>
            <span className="text-gray-900 font-medium">
              {data ? formatDate(data.created_at, locale) : t("common.loading")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {data && (
              <>
                <SecondaryButton
                  onClick={() =>
                    window.open(`/api/reports/${id}/export-html`, "_blank")
                  }
                >
                  <Download size={14} /> {t("report.btn.download")}
                </SecondaryButton>
                <PrimaryButton onClick={() => setTab("slides")}>
                  <Maximize2 size={14} /> {t("report.btn.open_slideshow")}
                </PrimaryButton>
              </>
            )}
          </div>
        </div>

        {/* 标签 */}
        <div className="border-b border-gray-200">
          <div className="flex items-center gap-6">
            {TABS.map((it) => {
              const active = tab === it.key;
              return (
                <button
                  key={it.key}
                  type="button"
                  onClick={() => setTab(it.key)}
                  className={`pb-3 text-sm transition-colors -mb-[1px] border-b-2 ${
                    active
                      ? "text-gray-900 font-medium border-blue-600"
                      : "text-gray-500 font-normal border-transparent hover:text-gray-700"
                  }`}
                >
                  {it.label}
                </button>
              );
            })}
          </div>
        </div>

        {isLoading && (
          <div className="text-sm text-gray-500">{t("report.loading")}</div>
        )}
        {error && (
          <div className="text-sm text-red-600">
            {String(error.message || error)}
          </div>
        )}

        {data && tab === "analysis" && (
          <AnalysisTab report={data} t={t} locale={locale} />
        )}
        {data && tab === "slides" && (
          <SlideshowTab report={data} t={t} locale={locale} />
        )}
      </div>
    </AppShell>
  );
}

function AnalysisTab({ report, t, locale }) {
  const raw = report.raw_data || {};
  const topRepos = Array.isArray(raw.top_repos) ? raw.top_repos : [];
  const breakdown = Array.isArray(raw.language_breakdown)
    ? raw.language_breakdown
    : [];
  const keyTrends = Array.isArray(raw.key_trends) ? raw.key_trends : [];

  const langLabel = report.language_filter
    ? t(`lang.${report.language_filter}`)
    : t("dashboard.row.all_languages");

  if (report.status === "failed") {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} className="text-orange-600 mt-0.5" />
          <div>
            <div className="text-base font-semibold text-gray-900">
              {t("report.failed.title")}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {report.error_message || t("report.failed.unknown")}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (report.status === "pending") {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start gap-3">
          <Loader2 size={18} className="text-blue-600 mt-0.5 animate-spin" />
          <div>
            <div className="text-base font-semibold text-gray-900">
              {t("report.pending.title")}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {t("report.pending.desc")}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 flex flex-col gap-5">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-gray-900">
              {t("report.summary.title")}
            </h2>
            <OutlinePill>{langLabel}</OutlinePill>
          </div>
          <p className="mt-3 text-sm text-gray-600 leading-relaxed">
            {report.summary || raw.summary || t("report.summary.empty")}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900">
            {t("report.repos.title")}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {t("report.repos.subtitle")}
          </p>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {topRepos.length === 0 && (
              <div className="text-sm text-gray-500">
                {t("report.repos.empty")}
              </div>
            )}
            {topRepos.map((repo, i) => (
              <div
                key={repo.name || i}
                className="rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">
                      {repo.name || `#${i + 1}`}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                      {repo.description || ""}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                  {repo.language && <OutlinePill>{repo.language}</OutlinePill>}
                  {typeof repo.stars === "number" && (
                    <OutlinePill
                      icon={<Star size={10} className="text-gray-400" />}
                    >
                      {repo.stars.toLocaleString()}
                    </OutlinePill>
                  )}
                  {typeof repo.stars_today === "number" && (
                    <OutlinePill>
                      {t("report.repos.stars_today", { n: repo.stars_today })}
                    </OutlinePill>
                  )}
                </div>
                {Array.isArray(repo.why_trending) &&
                  repo.why_trending.length > 0 && (
                    <ul className="mt-3 space-y-0.5">
                      {repo.why_trending.map((w, j) => (
                        <li
                          key={j}
                          className="text-xs text-gray-600 py-0.5 flex gap-2"
                        >
                          <span className="text-gray-400">-</span> {w}
                        </li>
                      ))}
                    </ul>
                  )}
              </div>
            ))}
          </div>
        </div>

        {keyTrends.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900">
              {t("report.trends.title")}
            </h2>
            <ul className="mt-3 space-y-1">
              {keyTrends.map((trend, i) => (
                <li key={i} className="text-sm text-gray-600 py-1 flex gap-2">
                  <span className="text-gray-400">-</span> {trend}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-5">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900">
            {t("report.lang.title")}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {t("report.lang.subtitle")}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {breakdown.length === 0 && (
              <div className="col-span-2 text-sm text-gray-500">
                {t("report.lang.empty")}
              </div>
            )}
            {breakdown.map((l, i) => (
              <div
                key={i}
                className="rounded-lg border border-gray-200 p-3 flex items-center gap-3"
              >
                <Ring percent={l.percentage || 0} size={40} />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wider truncate">
                    {l.language}
                  </div>
                  <div className="text-sm font-semibold text-gray-900">
                    {l.percentage}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Sparkles size={14} className="text-blue-600" />{" "}
            {t("report.about.title")}
          </h2>
          <ul className="mt-3 space-y-1">
            <li className="text-sm text-gray-600 py-0.5 flex gap-2">
              <span className="text-gray-400">-</span>{" "}
              {t("report.about.generated", {
                time: formatDateTime(report.created_at, locale),
              })}
            </li>
            <li className="text-sm text-gray-600 py-0.5 flex gap-2">
              <span className="text-gray-400">-</span>{" "}
              {t("report.about.status", {
                status: t(`status.${report.status}`) || report.status,
              })}
            </li>
            <li className="text-sm text-gray-600 py-0.5 flex gap-2">
              <span className="text-gray-400">-</span>{" "}
              {t("report.about.filter", { filter: langLabel })}
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function SlideshowTab({ report, t, locale }) {
  const raw = report.raw_data || {};
  const htmlPpt = extractHtmlDocument(
    typeof raw.html_ppt === "string" && raw.html_ppt.trim()
      ? raw.html_ppt
      : null,
  );

  if (htmlPpt) {
    return <HtmlPptSlideshow report={report} t={t} html={htmlPpt} />;
  }

  return <GeneratedSlideshow report={report} t={t} locale={locale} />;
}

function extractHtmlDocument(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
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

function HtmlPptSlideshow({ report, t, html }) {
  const containerRef = useRef(null);

  const goFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen?.();
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium text-gray-500 truncate">
          {report.summary || t("report.tab.slides")}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <SecondaryButton
            onClick={() =>
              window.open(`/api/reports/${report.id}/export-html`, "_blank")
            }
          >
            <Download size={14} /> {t("slides.btn.download")}
          </SecondaryButton>
          <SecondaryButton onClick={goFullscreen}>
            <Maximize2 size={14} /> {t("slides.btn.present")}
          </SecondaryButton>
        </div>
      </div>

      <div
        ref={containerRef}
        className="bg-white rounded-xl border border-gray-200 overflow-hidden"
        style={{ aspectRatio: "16 / 9" }}
      >
        <iframe
          title={report.summary || "Dify HTML presentation"}
          srcDoc={html}
          className="w-full h-full border-0 bg-white"
          sandbox="allow-scripts allow-forms allow-popups"
          allow="fullscreen"
        />
      </div>
    </div>
  );
}

function GeneratedSlideshow({ report, t, locale }) {
  const raw = report.raw_data || {};
  const slides = useMemo(() => {
    if (Array.isArray(raw.slides) && raw.slides.length > 0) return raw.slides;
    return [{ title: "Report", content_markdown: report.summary || "" }];
  }, [raw, report]);

  const [idx, setIdx] = useState(0);
  const containerRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        setIdx((i) => Math.min(slides.length - 1, i + 1));
      } else if (e.key === "ArrowLeft") {
        setIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "Home") {
        setIdx(0);
      } else if (e.key === "End") {
        setIdx(slides.length - 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [slides.length]);

  const progress = ((idx + 1) / slides.length) * 100;
  const slide = slides[idx];
  const langLabel = report.language_filter
    ? t(`lang.${report.language_filter}`)
    : t("dashboard.row.all_languages");

  const goFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen?.();
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-gray-500">
          {t("slides.counter", { current: idx + 1, total: slides.length })}
        </div>
        <div className="flex items-center gap-2">
          <SecondaryButton
            onClick={() =>
              window.open(`/api/reports/${report.id}/export-html`, "_blank")
            }
          >
            <Download size={14} /> {t("slides.btn.download")}
          </SecondaryButton>
          <SecondaryButton onClick={goFullscreen}>
            <Maximize2 size={14} /> {t("slides.btn.present")}
          </SecondaryButton>
        </div>
      </div>

      <div className="h-[2px] w-full bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div
        ref={containerRef}
        className="bg-white rounded-xl border border-gray-200 relative"
        style={{ aspectRatio: "16 / 9" }}
      >
        <div className="absolute inset-0 p-8 md:p-12 flex flex-col">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            {langLabel} · {formatDate(report.created_at, locale)}
          </div>
          <h2 className="mt-3 text-2xl md:text-4xl font-semibold tracking-tight text-gray-900 leading-tight">
            {slide?.title || `#${idx + 1}`}
          </h2>
          <div className="mt-4 md:mt-6 flex-1 overflow-auto">
            <MarkdownLite content={slide?.content_markdown || ""} />
          </div>
          <div className="pt-4 border-t border-gray-200 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">
              {idx + 1} / {slides.length}
            </span>
            <span className="text-xs text-gray-400">{t("slides.tip")}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2">
        <SecondaryButton
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
        >
          <ChevronLeft size={14} /> {t("common.previous")}
        </SecondaryButton>
        <span className="text-xs font-medium text-gray-500 px-3">
          {idx + 1} / {slides.length}
        </span>
        <PrimaryButton
          onClick={() => setIdx((i) => Math.min(slides.length - 1, i + 1))}
          disabled={idx === slides.length - 1}
        >
          {t("common.next")} <ChevronRight size={14} />
        </PrimaryButton>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-3 overflow-x-auto">
        <div className="flex items-center gap-2">
          {slides.map((s, i) => {
            const active = i === idx;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setIdx(i)}
                className={`shrink-0 w-32 h-20 rounded-md border text-left p-2 transition-colors ${
                  active
                    ? "border-blue-600 bg-blue-50"
                    : "border-gray-200 bg-white hover:bg-gray-50"
                }`}
              >
                <div
                  className={`text-[10px] font-medium uppercase tracking-wider ${
                    active ? "text-blue-600" : "text-gray-500"
                  }`}
                >
                  #{i + 1}
                </div>
                <div className="mt-1 text-xs font-semibold text-gray-900 line-clamp-2">
                  {s.title || `#${i + 1}`}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
