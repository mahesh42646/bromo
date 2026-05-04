"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import type { WebAppearanceMode } from "@/config/appearance";
import {
  applyAppearanceToDocument,
  persistAppearanceMode,
  readStoredAppearanceMode,
} from "@/lib/web-appearance";

const options: { value: WebAppearanceMode; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

export function AdminAppearanceSelect() {
  const [mode, setMode] = useState<WebAppearanceMode>("system");

  useEffect(() => {
    setMode(readStoredAppearanceMode());
  }, []);

  const onChange = (next: WebAppearanceMode) => {
    setMode(next);
    persistAppearanceMode(next);
    applyAppearanceToDocument(next);
  };

  return (
    <div
      className="flex items-center rounded-lg border border-border bg-muted/30 p-0.5"
      role="group"
      aria-label="Color theme"
    >
      {options.map(({ value, label, Icon }) => {
        const active = mode === value;
        return (
          <button
            key={value}
            type="button"
            title={label}
            aria-pressed={active}
            onClick={() => onChange(value)}
            className={`inline-flex size-8 items-center justify-center rounded-md transition-colors ${
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="size-3.5" aria-hidden />
            <span className="sr-only">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
