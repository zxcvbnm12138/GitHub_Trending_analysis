import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Clock, Info, Download, ExternalLink } from "lucide-react";
import AppShell from "../../components/AppShell";
import { LANGUAGE_VALUES } from "../../components/LanguageFilter";
import { OutlinePill, PrimaryButton } from "../../components/Pills";
import { useLocale, formatDateTime } from "../../utils/i18n";

export default function SchedulePage() {
  const { t, locale } = useLocale();
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(false);
  const [cronTime, setCronTime] = useState("09:00");
  const [languages, setLanguages] = useState(["all"]);
  const [saved, setSaved] = useState(false);

  const { data } = useQuery({
    queryKey: ["schedule"],
    queryFn: async () => {
      const r = await fetch("/api/schedule");
      if (!r.ok) throw new Error(`schedule ${r.status}`);
      return r.json();
    },
  });

  useEffect(() => {
    if (data?.schedule) {
      setEnabled(!!data.schedule.enabled);
      setCronTime(data.schedule.cron_time || "09:00");
      setLanguages(
        Array.isArray(data.schedule.languages) && data.schedule.languages.length
          ? data.schedule.languages
          : ["all"],
      );
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, cron_time: cronTime, languages }),
      });
      if (!r.ok) throw new Error(`save ${r.status}`);
      return r.json();
    },
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  const toggleLanguage = (val) => {
    setLanguages((prev) => {
      if (prev.includes(val)) {
        const next = prev.filter((v) => v !== val);
        return next.length ? next : ["all"];
      }
      return [...prev, val];
    });
  };

  const steps = [
    {
      step: "1",
      title: t("schedule.dify.step1.title"),
      desc: t("schedule.dify.step1.desc"),
      link: "https://dify.ai",
      linkText: t("schedule.dify.step1.link"),
    },
    {
      step: "2",
      title: t("schedule.dify.step2.title"),
      desc: t("schedule.dify.step2.desc"),
    },
    {
      step: "3",
      title: t("schedule.dify.step3.title"),
      desc: t("schedule.dify.step3.desc"),
    },
  ];

  return (
    <AppShell>
      <div className="flex flex-col gap-6 max-w-3xl">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 tracking-tight">
            {t("schedule.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500">{t("schedule.subtitle")}</p>
        </div>

        {/* Dify 工作流卡片 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                {t("schedule.dify.title")}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {t("schedule.dify.subtitle")}
              </p>
            </div>
            <a
              href="/api/dify-workflow"
              download="github-trending-workflow.yml"
              className="inline-flex shrink-0 items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              <Download size={14} /> {t("schedule.dify.download")}
            </a>
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {steps.map((item) => (
              <div
                key={item.step}
                className="rounded-lg border border-gray-200 p-4"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-semibold flex items-center justify-center shrink-0">
                    {item.step}
                  </div>
                  <div className="text-sm font-semibold text-gray-900">
                    {item.title}
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500 leading-relaxed">
                  {item.desc}
                </p>
                {item.link && (
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                  >
                    {item.linkText} <ExternalLink size={11} />
                  </a>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-start gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg p-3 border border-gray-200">
            <Info size={13} className="mt-0.5 text-gray-400 shrink-0" />
            {t("schedule.dify.info")}
          </div>
        </div>

        {/* 计划表单 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-base font-semibold text-gray-900">
                {t("schedule.form.auto_title")}
              </div>
              <div className="text-sm text-gray-500 mt-0.5">
                {t("schedule.form.auto_desc")}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEnabled((v) => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                enabled ? "bg-blue-600" : "bg-gray-200"
              }`}
              aria-pressed={enabled}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white border border-gray-200 rounded-full transition-transform ${
                  enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t("schedule.form.time_label")}
            </label>
            <div className="relative max-w-[200px]">
              <Clock
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="time"
                value={cronTime}
                onChange={(e) => setCronTime(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t("schedule.form.lang_label")}
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {LANGUAGE_VALUES.map((v) => {
                const active = languages.includes(v);
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => toggleLanguage(v)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-colors ${
                      active
                        ? "bg-blue-50 text-blue-600 font-medium border border-blue-100"
                        : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-normal"
                    }`}
                  >
                    {t(`lang.${v}`)}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {t("schedule.form.lang_hint")}
            </p>
          </div>

          <div className="flex items-center justify-between border-t border-gray-200 pt-4">
            <div className="flex items-start gap-2 text-xs text-gray-500">
              <Info size={14} className="mt-0.5 text-gray-400" />
              {t("schedule.form.runs_when")}
            </div>
            <div className="flex items-center gap-2">
              {saved && (
                <span className="text-xs font-medium text-green-600">
                  {t("common.saved")}
                </span>
              )}
              <PrimaryButton
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
              >
                <Save size={14} />{" "}
                {mutation.isPending ? t("common.saving") : t("common.save")}
              </PrimaryButton>
            </div>
          </div>
        </div>

        {data?.schedule && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900">
              {t("schedule.status.title")}
            </h2>
            <ul className="mt-3 space-y-1">
              <li className="text-sm text-gray-600 py-0.5 flex gap-2">
                <span className="text-gray-400">-</span>{" "}
                {t("schedule.status.next", {
                  time: data.schedule.next_run_at
                    ? formatDateTime(data.schedule.next_run_at, locale)
                    : "—",
                })}
              </li>
              <li className="text-sm text-gray-600 py-0.5 flex gap-2">
                <span className="text-gray-400">-</span>{" "}
                {t("schedule.status.last", {
                  time: data.schedule.last_run_at
                    ? formatDateTime(data.schedule.last_run_at, locale)
                    : t("common.never"),
                })}
              </li>
              <li className="text-sm text-gray-600 py-0.5 flex gap-2">
                <span className="text-gray-400">-</span>{" "}
                {t("schedule.status.langs")}
                <span className="inline-flex items-center gap-1 flex-wrap">
                  {(data.schedule.languages || []).map((l) => (
                    <OutlinePill key={l}>{t(`lang.${l}`)}</OutlinePill>
                  ))}
                </span>
              </li>
            </ul>
          </div>
        )}
      </div>
    </AppShell>
  );
}
