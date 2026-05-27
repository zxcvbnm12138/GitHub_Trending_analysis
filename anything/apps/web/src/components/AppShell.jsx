import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Github,
  LayoutGrid,
  GitCompareArrows,
  Clock,
  Languages,
  Sun,
  Moon,
  Settings,
  LogOut,
  UserRound,
} from "lucide-react";
import { useLocale } from "../utils/i18n";
import { useTheme } from "../hooks/useTheme";
import AuthScreen from "./AuthScreen";
import { fetchAuthStatus } from "../utils/auth-client";

function LangSwitcher() {
  const { locale, setLocale, t } = useLocale();
  return (
    <div
      className="inline-flex items-center gap-0.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full p-0.5"
      role="group"
      aria-label={t("lang.switch")}
    >
      <button
        type="button"
        onClick={() => setLocale("zh")}
        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs transition-colors ${
          locale === "zh"
            ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium"
            : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 font-normal"
        }`}
      >
        中文
      </button>
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs transition-colors ${
          locale === "en"
            ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium"
            : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 font-normal"
        }`}
      >
        EN
      </button>
    </div>
  );
}

export default function AppShell({ children }) {
  const { t } = useLocale();
  const { dark, toggle } = useTheme();
  const [path, setPath] = useState("/");
  const queryClient = useQueryClient();

  const authQuery = useQuery({
    queryKey: ["auth-me"],
    queryFn: fetchAuthStatus,
    staleTime: 30000,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await fetch("/api/auth/logout", { method: "POST" });
    },
    onSuccess: () => {
      queryClient.clear();
      window.location.href = "/";
    },
  });

  useEffect(() => {
    setPath(window.location.pathname);
  }, []);

  if (authQuery.isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-500 dark:text-gray-400 flex items-center justify-center text-sm">
        {t("common.loading")}
      </div>
    );
  }

  const auth = authQuery.data;
  if (!auth?.authenticated) {
    return <AuthScreen authState={auth} />;
  }

  const isAdmin = auth.user?.role === "admin";

  const NAV = [
    {
      to: "/",
      label: t("nav.dashboard"),
      icon: LayoutGrid,
      match: (p) => p === "/" || p.startsWith("/reports"),
    },
    {
      to: "/compare",
      label: t("nav.compare"),
      icon: GitCompareArrows,
      match: (p) => p.startsWith("/compare"),
    },
    {
      to: "/schedule",
      label: t("nav.schedule"),
      icon: Clock,
      match: (p) => p.startsWith("/schedule"),
    },
    ...(isAdmin
      ? [
          {
            to: "/settings",
            label: t("nav.settings"),
            icon: Settings,
            match: (p) => p.startsWith("/settings"),
          },
        ]
      : []),
  ];

  const accessDenied = path.startsWith("/settings") && !isAdmin;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 font-inter text-gray-900 dark:text-gray-100 transition-colors">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 sticky top-0 z-30 transition-colors">
        <div className="max-w-[1200px] mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 flex items-center justify-center">
              <Github size={16} />
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
              {t("nav.brand")}
            </span>
          </a>
          <div className="flex items-center gap-3">
            <nav className="flex items-center gap-1">
              {NAV.map((item) => {
                const Icon = item.icon;
                const active = item.match(path);
                return (
                  <a
                    key={item.to}
                    href={item.to}
                    aria-label={item.label}
                    title={item.label}
                    className={`inline-flex items-center gap-0 md:gap-1.5 px-2.5 md:px-3 py-1.5 rounded-full text-sm transition-colors ${
                      active
                        ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 font-normal"
                    }`}
                  >
                    <Icon size={14} />
                    <span className="hidden md:inline">{item.label}</span>
                  </a>
                );
              })}
            </nav>
            <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-gray-200 dark:border-gray-700">
              <div className="hidden lg:flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 max-w-[180px]">
                <UserRound size={14} />
                <span className="truncate">{auth.user?.email}</span>
              </div>
              <button
                type="button"
                onClick={toggle}
                className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
              >
                {dark ? <Sun size={14} /> : <Moon size={14} />}
              </button>
              <Languages size={14} className="text-gray-400 dark:text-gray-500" />
              <LangSwitcher />
              <button
                type="button"
                onClick={() => logoutMutation.mutate()}
                className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                aria-label={t("auth.logout")}
                title={t("auth.logout")}
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </div>
        <div className="sm:hidden border-t border-gray-200 dark:border-gray-800 px-6 py-2 flex justify-end">
          <LangSwitcher />
        </div>
      </header>
      <main className="max-w-[1200px] mx-auto px-6 py-8 transition-colors">
        {accessDenied ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
            {t("auth.forbidden")}
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
