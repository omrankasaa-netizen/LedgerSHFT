import React from "react";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";

// Bilingual form label. In Arabic, shows the Arabic label first with the
// English label in smaller text below it.
export default function FieldLabel({ k, required = false }) {
  const { t, tEn, lang } = useI18n();
  const mark = required ? " *" : "";
  if (lang === "ar") {
    return (
      <div className="flex flex-col">
        <Label>{t(k)}{mark}</Label>
        <span className="text-[11px] leading-tight text-muted-foreground -mt-0.5">{tEn(k)}{mark}</span>
      </div>
    );
  }
  return <Label>{t(k)}{mark}</Label>;
}