"use client";

import { Languages } from "lucide-react";
import { Language, useI18n } from "@/lib/i18n";

const languageOptions: Language[] = ["kk", "en", "ru"];

export function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage, copy, languageLabels } = useI18n();

  return (
    <label
      className={`inline-flex items-center gap-2 rounded-full border border-border bg-card/80 text-sm text-muted-foreground shadow-sm backdrop-blur transition hover:bg-accent ${
        compact ? "px-2 py-1.5" : "px-3 py-2"
      }`}
    >
      <Languages className="h-4 w-4 text-[#10a37f]" />
      <span className={compact ? "sr-only" : "hidden sm:inline"}>
        {copy.common.language}
      </span>
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value as Language)}
        className="cursor-pointer bg-transparent text-sm font-medium text-foreground outline-none"
        aria-label={copy.common.language}
      >
        {languageOptions.map((option) => (
          <option key={option} value={option}>
            {languageLabels[option]}
          </option>
        ))}
      </select>
    </label>
  );
}
