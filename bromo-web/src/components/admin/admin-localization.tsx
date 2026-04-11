"use client";

import { useState } from "react";
import { Globe, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface Locale {
  code: string;
  name: string;
  flag: string;
  totalKeys: number;
  translated: number;
  status: "complete" | "in_progress" | "draft";
  default: boolean;
}

const LOCALES: Locale[] = [
  { code: "en", name: "English", flag: "🇺🇸", totalKeys: 842, translated: 842, status: "complete", default: true },
  { code: "hi", name: "Hindi", flag: "🇮🇳", totalKeys: 842, translated: 780, status: "in_progress", default: false },
  { code: "es", name: "Spanish", flag: "🇪🇸", totalKeys: 842, translated: 612, status: "in_progress", default: false },
  { code: "pt", name: "Portuguese", flag: "🇧🇷", totalKeys: 842, translated: 280, status: "draft", default: false },
  { code: "fr", name: "French", flag: "🇫🇷", totalKeys: 842, translated: 440, status: "in_progress", default: false },
];

const SAMPLE_STRINGS = [
  { key: "auth.login.title", en: "Welcome back", hi: "वापस स्वागत है", es: "Bienvenido de vuelta" },
  { key: "auth.login.subtitle", en: "Sign in to continue", hi: "जारी रखने के लिए साइन इन करें", es: "Inicia sesión para continuar" },
  { key: "profile.edit.save", en: "Save changes", hi: "परिवर्तन सहेजें", es: "Guardar cambios" },
  { key: "feed.empty.title", en: "Nothing here yet", hi: "अभी यहाँ कुछ नहीं है", es: "Aún no hay nada aquí" },
  { key: "error.network", en: "No internet connection", hi: "इंटरनेट कनेक्शन नहीं", es: "Sin conexión a internet" },
];

const STATUS_STYLES: Record<Locale["status"], string> = {
  complete: "bg-success/15 text-success",
  in_progress: "bg-accent/15 text-accent",
  draft: "bg-muted text-muted-foreground",
};

export function AdminLocalization() {
  const [activeLocale, setActiveLocale] = useState("en");
  const [search, setSearch] = useState("");

  const filtered = SAMPLE_STRINGS.filter((s) =>
    !search || s.key.includes(search.toLowerCase()) || s.en.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">Localization</h1>
          <p className="text-muted-foreground mt-1 text-sm">Locale packs, translation status, and fallbacks for multi-language rollout.</p>
        </div>
        <button className="bg-accent text-accent-foreground flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium hover:opacity-90">
          <Plus className="size-4" />
          Add locale
        </button>
      </div>

      {/* Locale cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {LOCALES.map((locale) => {
          const pct = Math.round((locale.translated / locale.totalKeys) * 100);
          return (
            <button
              key={locale.code}
              onClick={() => setActiveLocale(locale.code)}
              className={cn(
                "border-border bg-background brand-surface rounded-2xl border p-4 text-left shadow-sm transition-all",
                activeLocale === locale.code ? "ring-2 ring-ring" : "hover:bg-muted/30",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{locale.flag}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-foreground font-semibold">{locale.name}</p>
                      {locale.default && <span className="bg-accent/15 text-accent rounded-full px-1.5 py-0.5 text-[10px] font-medium">Default</span>}
                    </div>
                    <p className="text-muted-foreground text-xs uppercase">{locale.code}</p>
                  </div>
                </div>
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_STYLES[locale.status])}>
                  {locale.status.replace("_", " ")}
                </span>
              </div>
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-muted-foreground">{locale.translated} / {locale.totalKeys} strings</span>
                  <span className={cn("font-semibold", pct === 100 ? "text-success" : pct > 60 ? "text-warning" : "text-destructive")}>{pct}%</span>
                </div>
                <div className="bg-muted h-1.5 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full", pct === 100 ? "bg-success" : "bg-accent")}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* String editor */}
      <div className="border-border bg-background brand-surface rounded-2xl border shadow-sm">
        <div className="border-border flex items-center justify-between gap-4 border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <Globe className="text-accent size-4" />
            <h2 className="text-foreground font-semibold">
              Translation strings — {LOCALES.find((l) => l.code === activeLocale)?.name}
            </h2>
          </div>
          <div className="relative">
            <Search className="text-muted-foreground absolute left-3 top-1/2 size-3.5 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search strings…"
              className="border-input bg-background text-foreground placeholder:text-placeholder rounded-xl border py-1.5 pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border border-b">
                <th className="text-muted-foreground px-5 py-3 text-left text-xs font-medium uppercase tracking-wide">Key</th>
                <th className="text-muted-foreground px-5 py-3 text-left text-xs font-medium uppercase tracking-wide">English (base)</th>
                <th className="text-muted-foreground px-5 py-3 text-left text-xs font-medium uppercase tracking-wide">
                  {LOCALES.find((l) => l.code === activeLocale)?.name || "Translation"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {filtered.map((s) => {
                const translation = s[activeLocale as keyof typeof s] as string | undefined;
                return (
                  <tr key={s.key} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3">
                      <code className="text-muted-foreground text-xs">{s.key}</code>
                    </td>
                    <td className="text-foreground px-5 py-3">{s.en}</td>
                    <td className="px-5 py-3">
                      {activeLocale === "en" ? (
                        <span className="text-muted-foreground text-xs italic">Base language</span>
                      ) : (
                        <input
                          defaultValue={translation ?? ""}
                          placeholder={translation ? "" : "Missing translation…"}
                          className={cn(
                            "border-input bg-background text-foreground placeholder:text-destructive/60 w-full rounded-lg border px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring",
                            !translation && "border-warning/50",
                          )}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-border border-t px-5 py-4">
          <button className="bg-accent text-accent-foreground rounded-xl px-5 py-2 text-sm font-medium hover:opacity-90">
            Save translations
          </button>
        </div>
      </div>
    </div>
  );
}
