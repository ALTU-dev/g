"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useI18n } from "@/lib/i18n";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { copy } = useI18n();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";
  const nextTheme = isDark ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme)}
      className={`inline-flex items-center rounded-full border border-border bg-card/80 text-sm font-medium text-foreground shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-accent ${
        compact ? "h-10 w-10 justify-center" : "h-10 gap-2 px-4"
      }`}
      aria-label={copy.common.toggleTheme}
      title={copy.common.toggleTheme}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {!compact && (
        <span>{isDark ? copy.common.lightTheme : copy.common.darkTheme}</span>
      )}
    </button>
  );
}
