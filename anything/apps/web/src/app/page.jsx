import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Calendar,
  FileText,
  Sparkles,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import AppShell from "../components/AppShell";
import Ring from "../components/Ring";
import LanguageFilter from "../components/LanguageFilter";
import {
  OutlinePill,
  StatusPill,
  PrimaryButton,
  SecondaryButton,
} from "../components/Pills";
import { useLocale, formatDate, formatDateTime } from "../utils/i18n";

function StatCard({ label, value, sub, ring }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            {label}
          </div>
          <div className="mt-2 text-2xl font-semibold text-gray-900 tracking-tight">
            {value}
          </div>
          {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
        </div>
        {ring}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { t, locale } = useLocale();
  const [language, setLanguage] = useState("all");
  const [error, setError] = useState(null);
  const queryClient = useQueryClient();

  const statsQuery = useQuery({
    queryKey: ["stats"],
    queryFn: async () => {
      const r = await fetch("/api/stats");
      if (!r.ok) throw new Error(`stats ${r.status}`);
      return r.json();
    },
  });

  const reportsQuery = useQuery({
    queryKey: ["reports", language],
    queryFn: async () => {
      const r = await fetch(
        `/api/reports?language=${encodeURIComponent(language)}`,
      );
      if (!r.ok) throw new Error(`reports ${r.status}`);
      const j = await r.json();
      return j.reports || [];
    },
    refetchInterval: (query) => {
      const rows = query.state.data || [];
      return rows.some((report) => report.status === "pending") ? 5000 : false;
    },
  });

  const generateMutation = useMutation({
    mutationFn: async ({ mode }) => {
      const endpoint =
        mode === "mock"
          ? "/api/reports/generate-mock"
          : "/api/reports/generate";
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, date_range: "当日" }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `Generation failed: ${r.status}`);
      return j;
    },
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (err) => {
      console.error(err);
      setError(err.message || "Generation failed");
    },
  });

  const stats = statsQuery.data;
  const reports = reportsQuery.data || [];
  const empty = !reportsQuery.isLoading && reports.length === 0;

  const topLangLabel = stats?.top_language
    ? stats.top_language === "all"
      ? t("lang.all")
      : t(`lang.${stats.top_language}`)
    : "—";

  return (
    <AppShell>
      <div className="flex flex-col gap-8">
        {/* 头部 */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 tracking-tight">
              {t("dashboard.title")}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {t("dashboard.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SecondaryButton
              onClick={() => generateMutation.mutate({ mode: "mock" })}
              disabled={generateMutation.isPending}
            >
              <Sparkles size={14} /> {t("dashboard.btn.sample")}
            </SecondaryButton>
            <PrimaryButton
              onClick={() => generateMutation.mutate({ mode: "dify" })}
              disabled={generateMutation.isPending}
            >
              <Plus size={14} />{" "}
              {generateMutation.isPending
                ? t("dashboard.btn.generating")
                : t("dashboard.btn.generate")}
            </PrimaryButton>
          </div>
        </div>

        {error && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle size={16} className="text-orange-600 mt-0.5" />
            <div className="text-sm text-gray-700">
              <div className="font-medium text-gray-900">
                {t("dashboard.error.title")}
              </div>
              <div className="text-gray-500 mt-0.5">{error}</div>
              <div className="text-gray-500 mt-1">
                {t("dashboard.error.tip")}{" "}
                <span className="font-medium text-gray-700">
                  {t("dashboard.error.tip_btn")}
                </span>{" "}
                {t("dashboard.error.tip_end")}
              </div>
            </div>
          </div>
        )}

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label={t("dashboard.stats.total")}
            value={stats?.total ?? "—"}
            sub={t("dashboard.stats.total_sub")}
          />
          <StatCard
            label={t("dashboard.stats.this_week")}
            value={stats?.this_week ?? "—"}
            sub={
              stats
                ? t("dashboard.stats.week_delta", {
                    sign: stats.week_delta >= 0 ? "+" : "",
                    value: stats.week_delta,
                  })
                : ""
            }
            ring={<Ring percent={stats?.week_percent ?? 0} size={44} />}
          />
          <StatCard
            label={t("dashboard.stats.top_lang")}
            value={
              <span className="inline-flex items-center gap-2">
                <OutlinePill className="!text-sm !py-1">
                  {topLangLabel}
                </OutlinePill>
              </span>
            }
            sub={t("dashboard.stats.top_lang_sub")}
          />
          <StatCard
            label={t("dashboard.stats.next_run")}
            value={
              <span className="text-base font-semibold text-gray-900">
                {stats?.schedule_enabled
                  ? formatDateTime(stats?.next_run_at, locale)
                  : t("common.disabled")}
              </span>
            }
            sub={
              stats?.schedule_enabled
                ? t("dashboard.stats.next_run_sub_on")
                : t("dashboard.stats.next_run_sub_off")
            }
          />
        </div>

        {/* 筛选 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            {t("dashboard.filter.label")}
          </div>
          <LanguageFilter value={language} onChange={setLanguage} />
        </div>

        {/* 报告列表 */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-900">
              {t("dashboard.list.title")}
            </div>
            <div className="text-xs font-medium text-gray-500">
              {t("common.total", { n: reports.length })}
            </div>
          </div>

          {reportsQuery.isLoading && (
            <div className="p-10 text-center text-sm text-gray-500">
              {t("common.loading")}
            </div>
          )}

          {empty && (
            <div className="p-10">
              <div className="max-w-md mx-auto text-center">
                <div className="w-12 h-12 mx-auto rounded-full border border-gray-200 flex items-center justify-center text-gray-400">
                  <FileText size={20} />
                </div>
                <h3 className="mt-3 text-base font-semibold text-gray-900">
                  {t("dashboard.empty.title")}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {t("dashboard.empty.desc")}
                </p>
                <ul className="mt-3 text-left inline-block">
                  <li className="text-sm text-gray-600 py-0.5 flex gap-2">
                    <span className="text-gray-400">-</span>{" "}
                    {t("dashboard.empty.bullet1")}
                  </li>
                  <li className="text-sm text-gray-600 py-0.5 flex gap-2">
                    <span className="text-gray-400">-</span>{" "}
                    {t("dashboard.empty.bullet2")}
                  </li>
                  <li className="text-sm text-gray-600 py-0.5 flex gap-2">
                    <span className="text-gray-400">-</span>{" "}
                    {t("dashboard.empty.bullet3")}
                  </li>
                </ul>
                <div className="mt-5 flex justify-center gap-2">
                  <SecondaryButton
                    onClick={() => generateMutation.mutate({ mode: "mock" })}
                  >
                    <Sparkles size={14} /> {t("dashboard.empty.btn_sample")}
                  </SecondaryButton>
                  <PrimaryButton
                    onClick={() => generateMutation.mutate({ mode: "dify" })}
                  >
                    <Plus size={14} /> {t("dashboard.empty.btn_dify")}
                  </PrimaryButton>
                </div>
              </div>
            </div>
          )}

          {!empty && !reportsQuery.isLoading && (
            <ul className="divide-y divide-gray-200">
              {reports.map((r) => (
                <ReportRow key={r.id} report={r} t={t} locale={locale} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function ReportRow({ report, t, locale }) {
  const topRepos = Array.isArray(report.top_repos)
    ? report.top_repos.slice(0, 3)
    : [];
  const lang = report.language_filter || "all";
  const langLabel =
    lang === "all" ? t("dashboard.row.all_languages") : t(`lang.${lang}`);
  return (
    <li>
      <a
        href={`/reports/${report.id}`}
        className="block px-5 py-4 hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-gray-400" />
                <span className="text-sm font-semibold text-gray-900">
                  {formatDate(report.created_at, locale)}
                </span>
              </div>
              <span className="text-xs text-gray-500 mt-0.5">
                {t("dashboard.row.report_id", { id: report.id })}
              </span>
            </div>
            <div className="hidden md:flex items-center gap-1.5 flex-wrap">
              <OutlinePill>{langLabel}</OutlinePill>
              {topRepos.map((repo) => (
                <OutlinePill key={repo.name}>{repo.name}</OutlinePill>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <StatusPill status={report.status} />
            <span className="hidden sm:inline-flex items-center gap-1 text-sm text-blue-600 font-medium">
              {t("common.view")} <ChevronRight size={14} />
            </span>
          </div>
        </div>
      </a>
    </li>
  );
}
