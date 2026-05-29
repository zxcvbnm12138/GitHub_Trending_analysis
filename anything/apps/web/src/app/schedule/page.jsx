import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Clock, Info } from "lucide-react";
import AppShell from "../../components/AppShell";
import { PrimaryButton } from "../../components/Pills";
import { fetchAuthStatus } from "../../utils/auth-client";
import { useLocale, formatDateTime } from "../../utils/i18n";

const DEFAULT_CRON_TIMES = ["09:00", "14:00", "22:00"];
const DEFAULT_TIMEZONE = "Asia/Shanghai";
const TIMEZONE_OPTIONS = [
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Singapore",
  "UTC",
  "Europe/Amsterdam",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
];
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

function normalizeTimes(value) {
  const source = Array.isArray(value) && value.length ? value : DEFAULT_CRON_TIMES;
  return [...source, ...DEFAULT_CRON_TIMES]
    .slice(0, 3)
    .map((time, index) => {
      const [hour = "09", minute = "00"] = String(time).split(":");
      const safeHour = HOURS.includes(hour) ? hour : DEFAULT_CRON_TIMES[index].slice(0, 2);
      const safeMinute = MINUTES.includes(minute) ? minute : "00";
      return `${safeHour}:${safeMinute}`;
    });
}

export default function SchedulePage() {
  const { t, locale } = useLocale();
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(false);
  const [cronTimes, setCronTimes] = useState(DEFAULT_CRON_TIMES);
  const [timeZone, setTimeZone] = useState(DEFAULT_TIMEZONE);
  const [saved, setSaved] = useState(false);
  const authQuery = useQuery({
    queryKey: ["auth-me"],
    queryFn: fetchAuthStatus,
    staleTime: 30000,
  });
  const authenticated = Boolean(authQuery.data?.authenticated);
  const timezoneOptions = TIMEZONE_OPTIONS.includes(timeZone)
    ? TIMEZONE_OPTIONS
    : [timeZone, ...TIMEZONE_OPTIONS];

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
      setCronTimes(
        normalizeTimes(data.schedule.cron_times || [data.schedule.cron_time]),
      );
      setTimeZone(data.schedule.timezone || DEFAULT_TIMEZONE);
    }
  }, [data]);

  const updateCronTime = (index, nextTime) => {
    setCronTimes((current) =>
      current.map((time, i) => (i === index ? nextTime : time)),
    );
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          cron_times: cronTimes,
          timezone: timeZone,
          languages: ["all"],
        }),
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

          <div className="flex flex-col gap-3">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {t("schedule.form.time_label")}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {cronTimes.map((time, index) => (
                <TimeSelect
                  key={index}
                  label={t(`schedule.form.slot_${index + 1}`)}
                  value={time}
                  onChange={(nextTime) => updateCronTime(index, nextTime)}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {t("schedule.form.timezone_label")}
            </label>
            <select
              value={timeZone}
              onChange={(e) => setTimeZone(e.target.value)}
              className="max-w-sm rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus-visible:ring-offset-gray-900"
            >
              {timezoneOptions.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {t("schedule.form.timezone", { timezone: timeZone })}
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
              <li className="text-sm text-gray-600 dark:text-gray-400 py-0.5 flex gap-2">
                <span className="text-gray-400">-</span>{" "}
                {t("schedule.status.times", {
                  times: normalizeTimes(data.schedule.cron_times).join(", "),
                })}
              </li>
              <li className="text-sm text-gray-600 dark:text-gray-400 py-0.5 flex gap-2">
                <span className="text-gray-400">-</span>{" "}
                {t("schedule.status.timezone", {
                  timezone: data.schedule.timezone || timeZone,
                })}
              </li>
            </ul>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function TimeSelect({ label, value, onChange }) {
  const [hour, minute] = value.split(":");
  const setPart = (nextHour, nextMinute) => {
    onChange(`${nextHour}:${nextMinute}`);
  };

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3 bg-gray-50 dark:bg-gray-950/40">
      <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
        <Clock size={14} className="text-gray-400 dark:text-gray-500" />
        {label}
      </div>
      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <select
          value={hour}
          onChange={(e) => setPart(e.target.value, minute)}
          className="rounded-md border border-gray-200 bg-white px-2 py-2 text-sm font-medium text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        >
          {HOURS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <span className="text-sm font-semibold text-gray-400">:</span>
        <select
          value={minute}
          onChange={(e) => setPart(hour, e.target.value)}
          className="rounded-md border border-gray-200 bg-white px-2 py-2 text-sm font-medium text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        >
          {MINUTES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
