import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Calendar,
  FileText,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Trash2,
} from "lucide-react";
import AppShell from "../components/AppShell";
import {
  OutlinePill,
  StatusPill,
  PrimaryButton,
} from "../components/Pills";
import { useLocale, formatDate, formatDateTime } from "../utils/i18n";

function StatCard({ label, value, sub, ring }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 hover:border-gray-300 dark:hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {label}
          </div>
          <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
            {value}
          </div>
          {sub && <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{sub}</div>}
        </div>
        {ring}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { t, locale } = useLocale();
  const [dateRange, setDateRange] = useState("当日");
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
    queryKey: ["reports"],
    queryFn: async () => {
      const r = await fetch("/api/reports");
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
        body: JSON.stringify({ language: "all", date_range: dateRange }),
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
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedReportIds, setSelectedReportIds] = useState(() => new Set());

  const filteredReports = selectedDate
    ? reports.filter((r) => r.created_at && r.created_at.slice(0, 10) === selectedDate)
    : reports;

  const filteredReportIds = useMemo(
    () => filteredReports.map((report) => report.id),
    [filteredReports],
  );
  const selectedCount = selectedReportIds.size;
  const allFilteredSelected =
    filteredReportIds.length > 0 &&
    filteredReportIds.every((id) => selectedReportIds.has(id));

  useEffect(() => {
    const validIds = new Set(reports.map((report) => report.id));
    setSelectedReportIds((current) => {
      const next = new Set([...current].filter((id) => validIds.has(id)));
      const unchanged =
        next.size === current.size && [...next].every((id) => current.has(id));
      return unchanged ? current : next;
    });
  }, [reports]);

  useEffect(() => {
    setSelectedReportIds(new Set());
  }, [selectedDate]);

  const toggleReportSelection = (id) => {
    setSelectedReportIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    setSelectedReportIds((current) => {
      const next = new Set(current);
      if (allFilteredSelected) {
        filteredReportIds.forEach((id) => next.delete(id));
      } else {
        filteredReportIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const deleteMutation = useMutation({
    mutationFn: async (ids) => {
      await Promise.all(
        ids.map(async (id) => {
          const r = await fetch(`/api/reports/${id}`, { method: "DELETE" });
          if (!r.ok) throw new Error(`delete ${id}: ${r.status}`);
        }),
      );
    },
    onSuccess: () => {
      setSelectedReportIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  const handleDeleteSelected = () => {
    if (selectedCount === 0 || deleteMutation.isPending) return;
    const confirmed = window.confirm(
      t("dashboard.delete.confirm", { n: selectedCount }),
    );
    if (!confirmed) return;
    deleteMutation.mutate([...selectedReportIds]);
  };

  const empty = !reportsQuery.isLoading && filteredReports.length === 0;

  return (
    <AppShell>
      <div className="flex flex-col gap-8">
        {/* 头部 */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
              {t("dashboard.title")}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("dashboard.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-0.5">
              {[
                { value: "当日", label: t("dashboard.date_range.today") },
                { value: "当周", label: t("dashboard.date_range.week") },
                { value: "当月", label: t("dashboard.date_range.month") },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDateRange(opt.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    dateRange === opt.value
                      ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
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
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle size={16} className="text-orange-600 mt-0.5" />
            <div className="text-sm text-gray-700 dark:text-gray-300">
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {t("dashboard.error.title")}
              </div>
              <div className="text-gray-500 dark:text-gray-400 mt-0.5">{error}</div>
              <div className="text-gray-500 dark:text-gray-400 mt-1">
                {t("dashboard.error.tip")}{" "}
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {t("dashboard.error.tip_btn")}
                </span>{" "}
                {t("dashboard.error.tip_end")}
              </div>
            </div>
          </div>
        )}

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard
            label={t("dashboard.stats.total")}
            value={stats?.total ?? "—"}
            sub={t("dashboard.stats.total_sub")}
          />
          <StatCard
            label={t("dashboard.stats.next_run")}
            value={
              <span className="text-base font-semibold text-gray-900 dark:text-gray-100">
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

        {/* 日历卡片 */}
        <CalendarCard
          reports={reports}
          locale={locale}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />

        {/* 报告列表 */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4 min-w-0">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {t("dashboard.list.title")}
              </div>
              {!empty && !reportsQuery.isLoading && (
                <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAllFiltered}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                  />
                  {t("dashboard.list.select_all")}
                </label>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDeleteSelected}
                disabled={selectedCount === 0 || deleteMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/60 dark:bg-gray-900 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                <Trash2 size={13} />
                {deleteMutation.isPending
                  ? t("dashboard.list.deleting")
                  : selectedCount > 0
                    ? t("dashboard.list.delete_selected", { n: selectedCount })
                    : t("dashboard.list.delete")}
              </button>
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("common.total", { n: filteredReports.length })}
              </div>
            </div>
          </div>

          {reportsQuery.isLoading && (
            <div className="p-10 text-center text-sm text-gray-500 dark:text-gray-400">
              {t("common.loading")}
            </div>
          )}

          {empty && (
            <div className="p-10">
              <div className="max-w-md mx-auto text-center">
                <div className="w-12 h-12 mx-auto rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500">
                  <FileText size={20} />
                </div>
                <h3 className="mt-3 text-base font-semibold text-gray-900 dark:text-gray-100">
                  {t("dashboard.empty.title")}
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {t("dashboard.empty.desc")}
                </p>
                <ul className="mt-3 text-left inline-block">
                  <li className="text-sm text-gray-600 dark:text-gray-400 py-0.5 flex gap-2">
                    <span className="text-gray-400">-</span>{" "}
                    {t("dashboard.empty.bullet1")}
                  </li>
                  <li className="text-sm text-gray-600 dark:text-gray-400 py-0.5 flex gap-2">
                    <span className="text-gray-400">-</span>{" "}
                    {t("dashboard.empty.bullet2")}
                  </li>
                  <li className="text-sm text-gray-600 dark:text-gray-400 py-0.5 flex gap-2">
                    <span className="text-gray-400">-</span>{" "}
                    {t("dashboard.empty.bullet3")}
                  </li>
                </ul>
              </div>
            </div>
          )}

          {!empty && !reportsQuery.isLoading && (
            <ul className="divide-y divide-gray-200 dark:divide-gray-800">
              {filteredReports.map((r) => (
                <ReportRow
                  key={r.id}
                  report={r}
                  t={t}
                  locale={locale}
                  selected={selectedReportIds.has(r.id)}
                  onToggleSelected={() => toggleReportSelection(r.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function CalendarCard({ reports, locale, selectedDate, onSelectDate }) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const { t } = useLocale();

  const reportDates = useMemo(() => {
    const dates = new Set();
    for (const r of reports) {
      if (r.created_at) {
        dates.add(r.created_at.slice(0, 10));
      }
    }
    return dates;
  }, [reports]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(d);
  }

  const monthLabel = currentDate.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "long",
  });

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 max-w-sm">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={prevMonth}
          className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {monthLabel}
        </div>
        <button
          type="button"
          onClick={nextMonth}
          className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="text-center text-[10px] font-medium text-gray-400 dark:text-gray-500 py-0.5"
          >
            {day}
          </div>
        ))}

        {days.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} />;
          }
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const hasReport = reportDates.has(dateStr);
          const isSelected = selectedDate === dateStr;
          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelectDate(isSelected ? null : dateStr)}
              className={`aspect-square flex items-center justify-center rounded text-xs font-medium transition-colors cursor-pointer ${
                isSelected
                  ? "bg-blue-600 text-white"
                  : hasReport
                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ReportRow({ report, t, locale, selected, onToggleSelected }) {
  const topRepos = Array.isArray(report.top_repos)
    ? report.top_repos.slice(0, 3)
    : [];
  const lang = report.language_filter || "all";
  const langLabel =
    lang === "all" ? t("dashboard.row.all_languages") : t(`lang.${lang}`);
  return (
    <li className="flex items-stretch">
      <div className="flex w-12 shrink-0 items-center justify-center">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelected}
          aria-label={t("dashboard.list.select_report", { id: report.id })}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
        />
      </div>
      <a
        href={`/reports/${report.id}`}
        className="block flex-1 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-gray-400 dark:text-gray-500" />
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {formatDate(report.created_at, locale)}
                </span>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
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
            <span className="hidden sm:inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 font-medium">
              {t("common.view")} <ChevronRight size={14} />
            </span>
          </div>
        </div>
      </a>
    </li>
  );
}
