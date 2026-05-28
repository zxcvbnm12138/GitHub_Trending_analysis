import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Github, KeyRound, LogIn, Mail, UserPlus } from "lucide-react";
import { PrimaryButton, SecondaryButton } from "./Pills";
import { useLocale } from "../utils/i18n";

function FieldLabel({ children }) {
  return (
    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
      {children}
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

export default function AuthScreen({ authState }) {
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState(authState?.allow_first_admin ? "register" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  useEffect(() => {
    if (authState?.allow_first_admin) setMode("register");
  }, [authState?.allow_first_admin]);

  const isRegister = mode === "register";
  const isFirstAdmin = Boolean(authState?.allow_first_admin);
  const databaseReady =
    Boolean(authState?.database_configured) &&
    authState?.database_available !== false;

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        isRegister ? "/api/auth/register" : "/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            invite_code: inviteCode,
          }),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || `auth ${response.status}`);
      return body;
    },
    onSuccess: () => {
      setPassword("");
      setInviteCode("");
      queryClient.invalidateQueries({ queryKey: ["auth-me"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
    },
  });

  const canSubmit =
    email.trim() &&
    password.length >= 8 &&
    (!isRegister || isFirstAdmin || inviteCode.trim());

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
      <div className="mx-auto flex min-h-screen max-w-[1100px] flex-col px-6">
        <header className="flex h-16 items-center">
          <a href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900">
              <Github size={16} />
            </div>
            <span className="text-sm font-semibold tracking-tight">
              {t("nav.brand")}
            </span>
          </a>
        </header>

        <main className="flex flex-1 items-center py-10">
          <div className="grid w-full grid-cols-1 gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
            <div className="max-w-xl">
              <div className="inline-flex items-center rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-500 dark:border-gray-800 dark:text-gray-400">
                {isFirstAdmin ? t("auth.badge.setup") : t("auth.badge.login")}
              </div>
              <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight text-gray-900 dark:text-gray-100">
                {isFirstAdmin ? t("auth.setup.title") : t("auth.title")}
              </h1>
              <p className="mt-3 text-base leading-7 text-gray-500 dark:text-gray-400">
                {isFirstAdmin ? t("auth.setup.desc") : t("auth.desc")}
              </p>
            </div>

            <section className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
              {!databaseReady && (
                <Notice tone="error">
                  {authState?.database_configured
                    ? t("auth.database_unavailable", {
                        message: authState?.message || t("common.unknown"),
                      })
                    : t("auth.database_required")}
                </Notice>
              )}

              <div className="mb-5 flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800">
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  disabled={isFirstAdmin}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    !isRegister
                      ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100"
                      : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  }`}
                >
                  {t("auth.login.tab")}
                </button>
                <button
                  type="button"
                  onClick={() => setMode("register")}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isRegister
                      ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100"
                      : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  }`}
                >
                  {isFirstAdmin ? t("auth.setup.tab") : t("auth.register.tab")}
                </button>
              </div>

              <form
                className="flex flex-col gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (canSubmit) mutation.mutate();
                }}
              >
                <div className="flex flex-col gap-2">
                  <FieldLabel>{t("auth.email")}</FieldLabel>
                  <div className="relative">
                    <Mail
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      type="email"
                      aria-label={t("auth.email")}
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="email"
                      className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus-visible:ring-offset-gray-900"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <FieldLabel>{t("auth.password")}</FieldLabel>
                  <div className="relative">
                    <KeyRound
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      type="password"
                      aria-label={t("auth.password")}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete={isRegister ? "new-password" : "current-password"}
                      className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus-visible:ring-offset-gray-900"
                    />
                  </div>
                </div>

                {isRegister && !isFirstAdmin && (
                  <div className="flex flex-col gap-2">
                    <FieldLabel>{t("auth.invite_code")}</FieldLabel>
                    <input
                      type="text"
                      aria-label={t("auth.invite_code")}
                      value={inviteCode}
                      onChange={(event) => setInviteCode(event.target.value)}
                      autoComplete="one-time-code"
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm uppercase tracking-wide text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus-visible:ring-offset-gray-900"
                    />
                  </div>
                )}

                {mutation.error && (
                  <Notice tone="error">
                    {String(mutation.error.message || mutation.error)}
                  </Notice>
                )}

                <div className="flex items-center justify-between gap-3 pt-1">
                  <SecondaryButton
                    type="button"
                    onClick={() => {
                      setMode(isRegister ? "login" : "register");
                      setInviteCode("");
                    }}
                    disabled={isFirstAdmin}
                  >
                    {isRegister ? <LogIn size={14} /> : <UserPlus size={14} />}
                    {isRegister ? t("auth.switch_login") : t("auth.switch_register")}
                  </SecondaryButton>
                  <PrimaryButton
                    type="submit"
                    disabled={!canSubmit || mutation.isPending || !databaseReady}
                  >
                    {isRegister ? <UserPlus size={14} /> : <LogIn size={14} />}
                    {mutation.isPending
                      ? t("common.saving")
                      : isRegister
                        ? isFirstAdmin
                          ? t("auth.setup.submit")
                          : t("auth.register.submit")
                        : t("auth.login.submit")}
                  </PrimaryButton>
                </div>
              </form>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
