import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Clock, Info } from "lucide-react";
import AppShell from "../../components/AppShell";
import { PrimaryButton } from "../../components/Pills";
import { fetchAuthStatus } from "../../utils/auth-client";
import { useLocale, formatDateTime } from "../../utils/i18n";

export default function SchedulePage() {
  const { t, locale } = useLocale();
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(false);
  const [cronTime, setCronTime] = useState("09:00");
  const [saved, setSaved] = useState(false);
  const authQuery = useQuery({
    queryKey: ["auth-me"],
    queryFn: fetchAuthStatus,
    staleTime: 30000,
  });
  const authenticated = Boolean(authQuery.data?.authenticated);

  const { data } = useQuery({
    queryKey: ["schedule"],
    queryFn: async () => {
      const r = await fetch("/api/schedule");
      if (!r.ok) throw new Error(`schedule ${r.status}`);
      return r.json();
    },
    enabled: authenticated,
  });

  useEffect(() => {
    if (data?.schedule) {
      setEnabled(!!data.schedule.enabled);
      setCronTime(data.schedule.cron_time || "09:00");
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, cron_time: cronTime, languages: ["all"] }),
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

  return (
    <AppShell>
      <div className="flex flex-col gap-6 max-w-3xl">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
            {t("schedule.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("schedule.subtitle")}</p>
        </div>

        {/* 计划表单 */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {t("schedule.form.auto_title")}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {t("schedule.form.auto_desc")}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEnabled((v) => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                enabled ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
              }`}
              aria-pressed={enabled}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white dark:bg-gray-100 border border-gray-200 dark:border-gray-600 rounded-full transition-transform ${
                  enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {t("schedule.form.time_label")}
            </label>
            <div className="relative max-w-[200px]">
              <Clock
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
              />
              <input
                type="time"
                value={cronTime}
                onChange={(e) => setCronTime(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-800 pt-4">
            <div className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
              <Info size={14} className="mt-0.5 text-gray-400 dark:text-gray-500" />
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
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {t("schedule.status.title")}
            </h2>
            <ul className="mt-3 space-y-1">
              <li className="text-sm text-gray-600 dark:text-gray-400 py-0.5 flex gap-2">
                <span className="text-gray-400">-</span>{" "}
                {t("schedule.status.next", {
                  time: data.schedule.next_run_at
                    ? formatDateTime(data.schedule.next_run_at, locale)
                    : "—",
                })}
              </li>
              <li className="text-sm text-gray-600 dark:text-gray-400 py-0.5 flex gap-2">
                <span className="text-gray-400">-</span>{" "}
                {t("schedule.status.last", {
                  time: data.schedule.last_run_at
                    ? formatDateTime(data.schedule.last_run_at, locale)
                    : t("common.never"),
                })}
              </li>
            </ul>
          </div>
        )}
      </div>
    </AppShell>
  );
}
