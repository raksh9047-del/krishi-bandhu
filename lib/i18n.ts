import en from "@/i18n/en.json";
import mr from "@/i18n/mr.json";
import hi from "@/i18n/hi.json";
import { useAppStore } from "@/store/useAppStore";

const dictionaries = { en, mr, hi } as const;

function getByPath(obj: unknown, path: string): string | undefined {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj) as string | undefined;
}

/**
 * Every component reads strings through this hook — never a hardcoded
 * string. Fallback rule: if a key is missing in `mr`/`hi`, fall back to
 * `en` rather than rendering the raw key string. (Since `mr.json`/`hi.json`
 * are scaffolded from `en.json` in Phase 6 and only get real translations
 * in Phase 9, this fallback also just means "show English" for anything not
 * yet translated — which is the correct interim behavior, not a bug.)
 */
export function useTranslation() {
  const language = useAppStore((s) => s.language);

  function t(key: string): string {
    const value = getByPath(dictionaries[language], key);
    if (value !== undefined) return value;
    const fallback = getByPath(dictionaries.en, key);
    return fallback ?? key;
  }

  return { t, language };
}
