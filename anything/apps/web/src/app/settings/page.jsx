import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Database,
  KeyRound,
  PlayCircle,
  RefreshCw,
  Save,
  UploadCloud,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  Wrench,
} from "lucide-react";
import AppShell from "../../components/AppShell";
import { PrimaryButton, SecondaryButton } from "../../components/Pills";
import { fetchAuthStatus } from "../../utils/auth-client";
import { useLocale } from "../../utils/i18n";

function FieldLabel({ children }) {
  return (
    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
      {children}
    </label>
  );
}

function StatusBadge({ ok, children }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        ok
          ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300"
          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
      }`}
    >
      {ok ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
      {children}
    </span>
  );
}

function SourceBadge({ source, t }) {
  const labels = {
    env: t("settings.source.env"),
    config: t("settings.source.config"),
    unset: t("settings.source.unset"),
  };
  return (
    <span className="inline-flex rounded-full border border-gray-200 dark:border-gray-700 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
      {labels[source] || source}
    </span>
  );
}

const RESTART_COMMAND = "pm2 reload ecosystem.config.cjs --update-env";

export default function SettingsPage() {
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const [difyBaseUrl, setDifyBaseUrl] = useState("");
  const [difyAppKey, setDifyAppKey] = useState("");
  const [clearDifyAppKey, setClearDifyAppKey] = useState(false);
  const [databaseUrl, setDatabaseUrl] = useState("");
  const [clearDatabaseUrl, setClearDatabaseUrl] = useState(false);
  const [saved, setSaved] = useState(false);
  const [checkingTarget, setCheckingTarget] = useState(null);
  const authQuery = useQuery({
    queryKey: ["auth-me"],
    queryFn: fetchAuthStatus,
    staleTime: 30000,
  });
  const isAdmin = authQuery.data?.user?.role === "admin";

  const configQuery = useQuery({
    queryKey: ["admin-config"],
    queryFn: async () => {
      const response = await fetch("/api/admin/config");
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || `config ${response.status}`);
      return body;
    },
    enabled: isAdmin,
  });

  const data = configQuery.data;

  useEffect(() => {
    if (!data?.authenticated) return;
    setDifyBaseUrl(data.saved?.dify_base_url || "");
    setDifyAppKey("");
    setClearDifyAppKey(false);
    setDatabaseUrl("");
    setClearDatabaseUrl(false);
  }, [data?.authenticated, data?.saved?.dify_base_url]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        dify_base_url: difyBaseUrl.trim(),
        clear_dify_app_key: clearDifyAppKey,
        clear_database_url: clearDatabaseUrl,
      };
      if (!clearDifyAppKey && difyAppKey.trim()) {
        body.dify_app_key = difyAppKey.trim();
      }
      if (!clearDatabaseUrl && databaseUrl.trim()) {
        body.database_url = databaseUrl.trim();
      }

      const response = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || `save ${response.status}`);
      return result;
    },
    onSuccess: () => {
      setSaved(true);
      setDifyAppKey("");
      setDatabaseUrl("");
      setClearDifyAppKey(false);
      setClearDatabaseUrl(false);
      setTimeout(() => setSaved(false), 1800);
      queryClient.invalidateQueries({ queryKey: ["admin-config"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  const checkMutation = useMutation({
    mutationFn: async (target) => {
      if (
        (target === "dify" || target === "all") &&
        data?.effective?.dify_app_key_configured
      ) {
        const confirmed = window.confirm(t("settings.check.confirm_dify"));
        if (!confirmed) return null;
      }

      if (target === "init_database") {
        const confirmed = window.confirm(t("settings.check.confirm_init"));
        if (!confirmed) return null;
      }

      if (target === "migrate_local") {
        const confirmed = window.confirm(t("settings.check.confirm_migrate"));
        if (!confirmed) return null;
      }

      setCheckingTarget(target);
      const response = await fetch("/api/admin/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target,
          confirm_external_call:
            target === "dify" || target === "all"
              ? data?.effective?.dify_app_key_configured
              : false,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || `check ${response.status}`);
      return result;
    },
    onSuccess: (result) => {
      setCheckingTarget(null);
      if (result) {
        queryClient.invalidateQueries({ queryKey: ["admin-config"] });
      }
    },
    onError: () => {
      setCheckingTarget(null);
    },
  });

  return (
    <AppShell>
      <div className="max-w-4xl flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
              {t("settings.title")}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("settings.subtitle")}
            </p>
          </div>
        </div>

        {configQuery.isLoading && (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {t("common.loading")}
          </div>
        )}

        {configQuery.error && (
          <Notice tone="error">
            {String(configQuery.error.message || configQuery.error)}
          </Notice>
        )}

        {data?.authenticated && (
          <>
            <AdminManagementPanel t={t} />
            <StatusPanel data={data} t={t} />
            <DiagnosticsPanel
              data={data}
              t={t}
              onRun={(target) => checkMutation.mutate(target)}
              pending={checkMutation.isPending}
              checkingTarget={checkingTarget}
            />
            <DeploymentRestartPanel
              t={t}
              onRecheck={() => checkMutation.mutate("database")}
              pending={checkMutation.isPending}
              checking={checkingTarget === "database"}
            />

            <div className="grid grid-cols-1 gap-5">
              <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-950/40 p-2 text-blue-600 dark:text-blue-300">
                    <KeyRound size={18} />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      {t("settings.dify.title")}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {t("settings.dify.desc")}
                    </p>

                    <div className="mt-5 grid grid-cols-1 gap-4">
                      <div className="flex flex-col gap-2">
                        <FieldLabel>{t("settings.dify.base_url")}</FieldLabel>
                        <input
                          type="url"
                          value={difyBaseUrl}
                          onChange={(event) => setDifyBaseUrl(event.target.value)}
                          placeholder="https://api.dify.ai/v1"
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus-visible:ring-offset-gray-900"
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <FieldLabel>{t("settings.dify.app_key")}</FieldLabel>
                        <input
                          type="password"
                          value={difyAppKey}
                          onChange={(event) => setDifyAppKey(event.target.value)}
                          disabled={clearDifyAppKey}
                          placeholder={
                            data.saved?.dify_app_key_configured
                              ? t("settings.secret.keep", {
                                  value: data.saved.dify_app_key_masked,
                                })
                              : "app-..."
                          }
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus-visible:ring-offset-gray-900"
                        />
                        <ClearCheckbox
                          checked={clearDifyAppKey}
                          onChange={setClearDifyAppKey}
                          label={t("settings.dify.clear_key")}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-purple-50 dark:bg-purple-950/40 p-2 text-purple-600 dark:text-purple-300">
                    <Database size={18} />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      {t("settings.database.title")}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {t("settings.database.desc")}
                    </p>

                    <div className="mt-5 flex flex-col gap-2">
                      <FieldLabel>{t("settings.database.url")}</FieldLabel>
                      <input
                        type="password"
                        value={databaseUrl}
                        onChange={(event) => setDatabaseUrl(event.target.value)}
                        disabled={clearDatabaseUrl}
                        placeholder={
                          data.saved?.database_url_configured
                            ? t("settings.secret.keep", {
                                value: data.saved.database_url_masked,
                              })
                            : "postgresql://user:password@host/database"
                        }
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus-visible:ring-offset-gray-900"
                      />
                      <ClearCheckbox
                        checked={clearDatabaseUrl}
                        onChange={setClearDatabaseUrl}
                        label={t("settings.database.clear_url")}
                      />
                      <Notice>{t("settings.database.restart_note")}</Notice>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {saveMutation.error && (
              <Notice tone="error">
                {String(saveMutation.error.message || saveMutation.error)}
              </Notice>
            )}

            {checkMutation.error && (
              <Notice tone="error">
                {String(checkMutation.error.message || checkMutation.error)}
              </Notice>
            )}

            <div className="flex items-center justify-end gap-3">
              {saved && (
                <span className="text-xs font-medium text-green-600">
                  {t("common.saved")}
                </span>
              )}
              <PrimaryButton
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
              >
                <Save size={14} />{" "}
                {saveMutation.isPending ? t("common.saving") : t("settings.save")}
              </PrimaryButton>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function DeploymentRestartPanel({ t, onRecheck, pending, checking }) {
  const [copied, setCopied] = useState(false);

  const copyCommand = async () => {
    try {
      await navigator.clipboard?.writeText(RESTART_COMMAND);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-gray-100 dark:bg-gray-800 p-2 text-gray-700 dark:text-gray-300">
              <Wrench size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {t("settings.runtime.title")}
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {t("settings.runtime.desc")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SecondaryButton onClick={copyCommand}>
              <Copy size={14} />
              {copied ? t("common.copied") : t("settings.runtime.copy_reload")}
            </SecondaryButton>
            <PrimaryButton onClick={onRecheck} disabled={pending}>
              {checking ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Database size={14} />
              )}
              {t("settings.runtime.recheck_database")}
            </PrimaryButton>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {t("settings.runtime.command_label")}
          </div>
          <code className="mt-2 block overflow-x-auto whitespace-nowrap rounded-lg bg-gray-950 px-3 py-2 text-xs text-gray-100">
            {RESTART_COMMAND}
          </code>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {t("settings.runtime.command_hint")}
          </p>
        </div>

        <Notice>{t("settings.runtime.safe_note")}</Notice>
      </div>
    </section>
  );
}

function AdminManagementPanel({ t }) {
  const queryClient = useQueryClient();
  const [role, setRole] = useState("user");
  const [maxUses, setMaxUses] = useState(1);
  const [expiresDays, setExpiresDays] = useState(7);

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const response = await fetch("/api/admin/users");
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || `users ${response.status}`);
      return body.users || [];
    },
  });

  const invitesQuery = useQuery({
    queryKey: ["admin-invites"],
    queryFn: async () => {
      const response = await fetch("/api/admin/invites");
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || `invites ${response.status}`);
      return body.invites || [];
    },
  });

  const createInviteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          max_uses: Number(maxUses) || 1,
          expires_in_days: Number(expiresDays) || null,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || `invite ${response.status}`);
      return body;
    },
    onSuccess: (body) => {
      queryClient.invalidateQueries({ queryKey: ["admin-invites"] });
    },
  });

  const userStatusMutation = useMutation({
    mutationFn: async ({ id, disabled }) => {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabled }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || `user ${response.status}`);
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["auth-me"] });
    },
  });

  const inviteStatusMutation = useMutation({
    mutationFn: async ({ id, disabled }) => {
      const response = await fetch(`/api/admin/invites/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabled }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || `invite ${response.status}`);
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-invites"] });
    },
  });

  const users = usersQuery.data || [];
  const invites = invitesQuery.data || [];

  return (
    <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-green-50 dark:bg-green-950/40 p-2 text-green-600 dark:text-green-300">
            <Users size={18} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {t("settings.users.title")}
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("settings.users.desc")}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {t("settings.invites.create")}
            </div>
            <div className="mt-4 flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <FieldLabel>{t("settings.invites.role")}</FieldLabel>
                <select
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus-visible:ring-offset-gray-900"
                >
                  <option value="user">{t("settings.role.user")}</option>
                  <option value="admin">{t("settings.role.admin")}</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <FieldLabel>{t("settings.invites.max_uses")}</FieldLabel>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={maxUses}
                    onChange={(event) => setMaxUses(event.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus-visible:ring-offset-gray-900"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <FieldLabel>{t("settings.invites.expires")}</FieldLabel>
                  <input
                    type="number"
                    min="1"
                    value={expiresDays}
                    onChange={(event) => setExpiresDays(event.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus-visible:ring-offset-gray-900"
                  />
                </div>
              </div>
              <PrimaryButton
                onClick={() => createInviteMutation.mutate()}
                disabled={createInviteMutation.isPending}
              >
                <UserPlus size={14} />
                {createInviteMutation.isPending
                  ? t("common.saving")
                  : t("settings.invites.create_btn")}
              </PrimaryButton>
            </div>

            {createInviteMutation.error && (
              <div className="mt-3">
                <Notice tone="error">
                  {String(createInviteMutation.error.message || createInviteMutation.error)}
                </Notice>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-900 dark:border-gray-800 dark:text-gray-100">
                {t("settings.users.list")}
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-800">
                {usersQuery.isLoading && (
                  <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
                    {t("common.loading")}
                  </div>
                )}
                {!usersQuery.isLoading && users.length === 0 && (
                  <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
                    {t("settings.users.empty")}
                  </div>
                )}
                {users.map((user) => {
                  const disabled = user.status === "disabled";
                  return (
                    <div
                      key={user.id}
                      className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                          {user.email}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <span>{t(`settings.role.${user.role}`)}</span>
                          <span>{disabled ? t("settings.users.disabled") : t("settings.users.active")}</span>
                        </div>
                      </div>
                      <SecondaryButton
                        onClick={() =>
                          userStatusMutation.mutate({
                            id: user.id,
                            disabled: !disabled,
                          })
                        }
                        disabled={userStatusMutation.isPending}
                      >
                        {disabled ? <UserCheck size={14} /> : <UserX size={14} />}
                        {disabled
                          ? t("settings.users.enable")
                          : t("settings.users.disable")}
                      </SecondaryButton>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-900 dark:border-gray-800 dark:text-gray-100">
                {t("settings.invites.list")}
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-800">
                {invitesQuery.isLoading && (
                  <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
                    {t("common.loading")}
                  </div>
                )}
                {!invitesQuery.isLoading && invites.length === 0 && (
                  <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
                    {t("settings.invites.empty")}
                  </div>
                )}
                {invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="grid grid-cols-2 gap-3 px-4 py-3 text-sm text-gray-600 dark:text-gray-300 md:grid-cols-[minmax(180px,1.4fr)_0.55fr_0.55fr_1fr_0.65fr_0.75fr]"
                  >
                    <div className="min-w-0">
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {t("settings.invites.code")}
                      </div>
                      {invite.code ? (
                        <div className="mt-1 flex items-center gap-2">
                          <code className="min-w-0 flex-1 truncate rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-900 dark:bg-gray-800 dark:text-gray-100">
                            {invite.code}
                          </code>
                          <button
                            type="button"
                            onClick={() => navigator.clipboard?.writeText(invite.code)}
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                            title={t("common.copy")}
                            aria-label={t("common.copy")}
                          >
                            <Copy size={13} />
                          </button>
                        </div>
                      ) : (
                        <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                          {t("settings.invites.code_unavailable")}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {t("settings.invites.role")}
                      </div>
                      {t(`settings.role.${invite.role}`)}
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {t("settings.invites.usage")}
                      </div>
                      {invite.used_count} / {invite.max_uses}
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {t("settings.invites.expires_at")}
                      </div>
                      {invite.expires_at ? formatDiagnosticTime(invite.expires_at) : t("common.never")}
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {t("settings.invites.status")}
                      </div>
                      {invite.disabled
                        ? t("settings.invites.disabled")
                        : Number(invite.used_count) >= Number(invite.max_uses)
                          ? t("settings.invites.used_up")
                          : t("common.enabled")}
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {t("settings.invites.action")}
                      </div>
                      <div className="mt-1">
                        <SecondaryButton
                          onClick={() =>
                            inviteStatusMutation.mutate({
                              id: invite.id,
                              disabled: !invite.disabled,
                            })
                          }
                          disabled={inviteStatusMutation.isPending}
                        >
                          {invite.disabled ? (
                            <UserCheck size={14} />
                          ) : (
                            <UserX size={14} />
                          )}
                          {invite.disabled
                            ? t("settings.invites.enable")
                            : t("settings.invites.disable")}
                        </SecondaryButton>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {userStatusMutation.error && (
              <Notice tone="error">
                {String(userStatusMutation.error.message || userStatusMutation.error)}
              </Notice>
            )}

            {inviteStatusMutation.error && (
              <Notice tone="error">
                {String(inviteStatusMutation.error.message || inviteStatusMutation.error)}
              </Notice>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ClearCheckbox({ checked, onChange, label }) {
  return (
    <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
      />
      {label}
    </label>
  );
}

function Notice({ tone = "info", children }) {
  const error = tone === "error";
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-sm ${
        error
          ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
          : "border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300"
      }`}
    >
      {children}
    </div>
  );
}

function StatusPanel({ data, t }) {
  return (
    <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {t("settings.status.title")}
          </h2>
          <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {data.config_path}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <StatusItem
            label={t("settings.status.dify_url")}
            ok={Boolean(data.effective?.dify_base_url)}
            value={data.effective?.dify_base_url || t("common.disabled")}
            source={data.effective?.dify_base_url_source}
            t={t}
          />
          <StatusItem
            label={t("settings.status.dify_key")}
            ok={Boolean(data.effective?.dify_app_key_configured)}
            value={
              data.effective?.dify_app_key_masked || t("settings.status.not_set")
            }
            source={data.effective?.dify_app_key_source}
            t={t}
          />
          <StatusItem
            label={t("settings.status.database")}
            ok={Boolean(data.effective?.database_url_configured)}
            value={
              data.effective?.database_url_masked || t("settings.status.local_file")
            }
            source={data.effective?.database_url_source}
            t={t}
          />
        </div>
      </div>
    </section>
  );
}

function StatusItem({ label, ok, value, source, t }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {label}
        </div>
        <SourceBadge source={source} t={t} />
      </div>
      <div className="mt-2">
        <StatusBadge ok={ok}>
          <span className="truncate max-w-[220px]">{value}</span>
        </StatusBadge>
      </div>
    </div>
  );
}

function DiagnosticsPanel({ data, t, onRun, pending, checkingTarget }) {
  const diagnostics = data.diagnostics || {};
  const buttons = [
    {
      target: "all",
      label: t("settings.check.run_all"),
      icon: Activity,
      primary: true,
    },
    {
      target: "dify",
      label: t("settings.check.test_dify"),
      icon: PlayCircle,
    },
    {
      target: "database",
      label: t("settings.check.test_database"),
      icon: Database,
    },
    {
      target: "init_database",
      label: t("settings.check.init_database"),
      icon: Wrench,
    },
    {
      target: "migrate_local",
      label: t("settings.check.migrate_local"),
      icon: UploadCloud,
    },
  ];

  return (
    <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {t("settings.check.title")}
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("settings.check.desc")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {buttons.map((item) => {
              const Icon = item.icon;
              const Button = item.primary ? PrimaryButton : SecondaryButton;
              const busy = pending && checkingTarget === item.target;
              return (
                <Button
                  key={item.target}
                  onClick={() => onRun(item.target)}
                  disabled={pending}
                  className="!px-3"
                >
                  {busy ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Icon size={14} />
                  )}
                  {item.label}
                </Button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <DiagnosticCard
            title={t("settings.check.last_all")}
            result={diagnostics.all}
            empty={t("settings.check.never")}
            t={t}
          />
          <DiagnosticCard
            title={t("settings.check.last_dify")}
            result={diagnostics.dify}
            empty={t("settings.check.never")}
            t={t}
          />
          <DiagnosticCard
            title={t("settings.check.last_database")}
            result={diagnostics.database}
            empty={t("settings.check.never")}
            t={t}
          />
          <DiagnosticCard
            title={t("settings.check.last_migration")}
            result={diagnostics.migration}
            empty={t("settings.check.never")}
            t={t}
          />
        </div>
      </div>
    </section>
  );
}

function DiagnosticCard({ title, result, empty, t }) {
  if (!result) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </div>
        <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {empty}
        </div>
      </div>
    );
  }

  const statusMeta = {
    success: {
      label: t("settings.check.status_success"),
      className:
        "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300",
      icon: Check,
    },
    warning: {
      label: t("settings.check.status_warning"),
      className:
        "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
      icon: AlertCircle,
    },
    error: {
      label: t("settings.check.status_error"),
      className:
        "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
      icon: AlertCircle,
    },
  };
  const meta = statusMeta[result.status] || statusMeta.warning;
  const Icon = meta.icon;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </div>
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {formatDiagnosticTime(result.checked_at)} ·{" "}
            {t("settings.check.duration", { n: result.duration_ms || 0 })}
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${meta.className}`}
        >
          <Icon size={12} />
          {meta.label}
        </span>
      </div>

      <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
        {result.summary}
      </p>

      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-medium text-blue-600 dark:text-blue-400">
          {t("settings.check.details")}
        </summary>
        <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-gray-950 p-3 text-xs text-gray-100">
          {JSON.stringify(result.details || {}, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function formatDiagnosticTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}
