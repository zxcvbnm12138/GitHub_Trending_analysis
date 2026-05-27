import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { GitCompareArrows, ArrowUpRight, Star } from "lucide-react";
import AppShell from "../../components/AppShell";
import { OutlinePill } from "../../components/Pills";
import { fetchAuthStatus } from "../../utils/auth-client";
import { useLocale, formatDate } from "../../utils/i18n";

export default function ComparePage() {
  const { t, locale } = useLocale();
  const [selected, setSelected] = useState([null, null]);
  const authQuery = useQuery({
    queryKey: ["auth-me"],
    queryFn: fetchAuthStatus,
    staleTime: 30000,
  });
  const authenticated = Boolean(authQuery.data?.authenticated);

  const { data: reports = [] } = useQuery({
    queryKey: ["reports", "all-compare"],
    queryFn: async () => {
      const r = await fetch(`/api/reports?language=all`);
      if (!r.ok) throw new Error(`reports ${r.status}`);
      const j = await r.json();
      return j.reports || [];
    },
    enabled: authenticated,
  });

  const a = useFullReport(selected[0], authenticated);
  const b = useFullReport(selected[1], authenticated);

  const reposA = extractRepos(a.data);
  const reposB = extractRepos(b.data);

  const common = useMemo(() => {
    const setB = new Set(reposB.map((r) => r.name));
    return reposA.filter((r) => setB.has(r.name));
  }, [reposA, reposB]);

  const onlyA = useMemo(() => {
    const setB = new Set(reposB.map((r) => r.name));
    return reposA.filter((r) => !setB.has(r.name));
  }, [reposA, reposB]);

  const onlyB = useMemo(() => {
    const setA = new Set(reposA.map((r) => r.name));
    return reposB.filter((r) => !setA.has(r.name));
  }, [reposA, reposB]);

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 tracking-tight">
            {t("compare.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500">{t("compare.subtitle")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ReportPicker
            label={t("compare.picker.a")}
            placeholder={t("compare.picker.placeholder")}
            reports={reports}
            value={selected[0]}
            onChange={(v) => setSelected(([_, bb]) => [v, bb])}
            t={t}
            locale={locale}
          />
          <ReportPicker
            label={t("compare.picker.b")}
            placeholder={t("compare.picker.placeholder")}
            reports={reports}
            value={selected[1]}
            onChange={(v) => setSelected(([aa]) => [aa, v])}
            t={t}
            locale={locale}
          />
        </div>

        {(!selected[0] || !selected[1]) && (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
            <div className="w-12 h-12 mx-auto rounded-full border border-gray-200 flex items-center justify-center text-gray-400">
              <GitCompareArrows size={20} />
            </div>
            <h3 className="mt-3 text-base font-semibold text-gray-900">
              {t("compare.empty.title")}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {t("compare.empty.desc")}
            </p>
          </div>
        )}

        {selected[0] && selected[1] && (
          <>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-900">
                {t("compare.common.title")}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {t("compare.common.desc")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {common.length === 0 && (
                  <span className="text-sm text-gray-500">
                    {t("compare.common.empty")}
                  </span>
                )}
                {common.map((repo) => (
                  <OutlinePill key={repo.name}>
                    <Star size={10} className="text-gray-400" /> {repo.name}
                  </OutlinePill>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ColumnList
                title={t("compare.only_a")}
                report={a.data}
                repos={onlyA}
                t={t}
                locale={locale}
              />
              <ColumnList
                title={t("compare.only_b")}
                report={b.data}
                repos={onlyB}
                t={t}
                locale={locale}
              />
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function ReportPicker({
  label,
  placeholder,
  reports,
  value,
  onChange,
  t,
  locale,
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
        {label}
      </div>
      <select
        value={value || ""}
        onChange={(e) =>
          onChange(e.target.value ? parseInt(e.target.value, 10) : null)
        }
        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
      >
        <option value="">{placeholder}</option>
        {reports.map((r) => {
          const langLabel = r.language_filter
            ? t(`lang.${r.language_filter}`)
            : t("lang.all");
          return (
            <option key={r.id} value={r.id}>
              #{r.id} · {formatDate(r.created_at, locale)} · {langLabel}
            </option>
          );
        })}
      </select>
    </div>
  );
}

function ColumnList({ title, report, repos, t, locale }) {
  const langLabel = report
    ? report.language_filter
      ? t(`lang.${report.language_filter}`)
      : t("lang.all")
    : "";
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {report && (
          <a
            href={`/reports/${report.id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
          >
            {t("compare.column.view")} <ArrowUpRight size={12} />
          </a>
        )}
      </div>
      {report && (
        <div className="mt-1 text-xs text-gray-500">
          {formatDate(report.created_at, locale)} · {langLabel}
        </div>
      )}
      <ul className="mt-3 space-y-1">
        {repos.length === 0 && (
          <li className="text-sm text-gray-500">{t("compare.column.empty")}</li>
        )}
        {repos.map((r) => (
          <li
            key={r.name}
            className="text-sm text-gray-600 py-1 flex items-center gap-2 flex-wrap"
          >
            <span className="text-gray-400">-</span>
            <span className="font-medium text-gray-900">{r.name}</span>
            {r.language && (
              <OutlinePill className="!py-0.5">{r.language}</OutlinePill>
            )}
            {typeof r.stars_today === "number" && (
              <OutlinePill className="!py-0.5">
                {t("compare.column.stars_today", { n: r.stars_today })}
              </OutlinePill>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function useFullReport(id, enabled) {
  return useQuery({
    queryKey: ["report", id],
    queryFn: async () => {
      const r = await fetch(`/api/reports/${id}`);
      if (!r.ok) throw new Error("Could not load");
      const j = await r.json();
      return j.report;
    },
    enabled: !!id && enabled,
  });
}

function extractRepos(report) {
  if (!report) return [];
  const repos = report?.raw_data?.top_repos;
  return Array.isArray(repos) ? repos : [];
}
