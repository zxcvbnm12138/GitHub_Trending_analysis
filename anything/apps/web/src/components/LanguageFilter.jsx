import { useLocale } from "../utils/i18n";

export const LANGUAGE_VALUES = [
  "all",
  "python",
  "javascript",
  "typescript",
  "go",
  "rust",
  "java",
  "cpp",
];

// 兼容旧导入
const LANGUAGES = LANGUAGE_VALUES.map((v) => ({ value: v, label: v }));

export default function LanguageFilter({ value, onChange }) {
  const { t } = useLocale();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {LANGUAGE_VALUES.map((v) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
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
  );
}

export { LANGUAGES };
