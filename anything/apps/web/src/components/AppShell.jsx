import { useEffect, useState } from "react";
import {
  Github,
  LayoutGrid,
  GitCompareArrows,
  Clock,
  Languages,
} from "lucide-react";
import { useLocale } from "../utils/i18n";

function LangSwitcher() {
  const { locale, setLocale, t } = useLocale();
  return (
    <div
      className="inline-flex items-center gap-0.5 bg-white border border-gray-200 rounded-full p-0.5"
      role="group"
      aria-label={t("lang.switch")}
    >
      <button
        type="button"
        onClick={() => setLocale("zh")}
        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs transition-colors ${
          locale === "zh"
            ? "bg-blue-50 text-blue-600 font-medium"
            : "text-gray-500 hover:text-gray-900 font-normal"
        }`}
      >
        中文
      </button>
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs transition-colors ${
          locale === "en"
            ? "bg-blue-50 text-blue-600 font-medium"
            : "text-gray-500 hover:text-gray-900 font-normal"
        }`}
      >
        EN
      </button>
    </div>
  );
}

export default function AppShell({ children }) {
  const { t } = useLocale();
  const [path, setPath] = useState("/");

  useEffect(() => {
    setPath(window.location.pathname);
  }, []);

  // Fire scheduled tick once per session
  useEffect(() => {
    const KEY = "schedule-tick-last";
    const last = sessionStorage.getItem(KEY);
    if (!last) {
      sessionStorage.setItem(KEY, String(Date.now()));
      fetch("/api/schedule/tick", { method: "POST" }).catch(() => {});
    }
  }, []);

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
  ];

  return (
    <div className="min-h-screen bg-white font-inter text-gray-900">
      <header className="border-b border-gray-200 bg-white sticky top-0 z-30">
        <div className="max-w-[1200px] mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-gray-900 text-white flex items-center justify-center">
              <Github size={16} />
            </div>
            <span className="text-sm font-semibold text-gray-900 tracking-tight">
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
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
                      active
                        ? "bg-blue-50 text-blue-600 font-medium"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50 font-normal"
                    }`}
                  >
                    <Icon size={14} />
                    {item.label}
                  </a>
                );
              })}
            </nav>
            <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-gray-200">
              <Languages size={14} className="text-gray-400" />
              <LangSwitcher />
            </div>
          </div>
        </div>
        <div className="sm:hidden border-t border-gray-200 px-6 py-2 flex justify-end">
          <LangSwitcher />
        </div>
      </header>
      <main className="max-w-[1200px] mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
