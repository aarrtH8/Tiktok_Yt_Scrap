"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  if (!mounted) {
    return (
      <div className="inline-flex items-center rounded-full border border-border/60 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Theme
      </div>
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="inline-flex items-center gap-2 rounded-full border border-border/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition hover:border-primary/50 hover:text-primary"
      aria-label="Basculer le thème"
    >
      {isDark ? (
        <>
          <Sun className="h-4 w-4 text-amber-300" />
          Mode clair
        </>
      ) : (
        <>
          <Moon className="h-4 w-4 text-sky-200" />
          Mode sombre
        </>
      )}
    </button>
  );
}
