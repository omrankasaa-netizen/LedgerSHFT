import React from "react";
import { useI18n } from "@/lib/i18n";

export default function LanguageToggle() {
  const { lang, setLang } = useI18n();
  return (
    <div className="inline-flex items-center rounded-md border border-border bg-card text-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setLang("en")}
        className={`px-2.5 py-1 font-medium transition-colors ${
          lang === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
        }`}
        aria-pressed={lang === "en"}
      >
        EN
      </button>
      <span className="text-muted-foreground/40 select-none">|</span>
      <button
        type="button"
        onClick={() => setLang("ar")}
        className={`px-2.5 py-1 font-medium transition-colors ${
          lang === "ar" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
        }`}
        aria-pressed={lang === "ar"}
        dir="rtl"
      >
        ع
      </button>
    </div>
  );
}