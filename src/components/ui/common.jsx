import React from "react";
import { translations } from "@/lib/i18n";

export function PageHeader({ title, subtitle, actions, titleKey }) {
  const en = titleKey ? (translations.en[titleKey] ?? title) : null;
  const ar = titleKey ? (translations.ar[titleKey] ?? null) : null;
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-5">
      <div>
        {titleKey ? (
          <div className="flex items-baseline gap-2 flex-wrap">
            <h1 className="font-heading text-xl font-bold text-foreground">{en}</h1>
            {ar && <span className="text-sm font-medium text-muted-foreground" dir="rtl">{ar}</span>}
          </div>
        ) : (
          <h1 className="font-heading text-xl font-bold text-foreground">{title}</h1>
        )}
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, sub, accent = "default" }) {
  const accents = {
    default: "border-border",
    blue: "border-blue-200 bg-blue-50/50",
    emerald: "border-emerald-200 bg-emerald-50/50",
    amber: "border-amber-200 bg-amber-50/50",
    red: "border-red-200 bg-red-50/50",
  };
  return (
    <div className={`rounded-lg border p-4 ${accents[accent]}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-heading text-2xl font-bold text-foreground">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function Badge({ children, className = "" }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

export function EmptyState({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && <Icon className="h-10 w-10 text-muted-foreground/40 mb-3" />}
      <div className="font-medium text-foreground">{title}</div>
      {subtitle && <div className="text-sm text-muted-foreground mt-1">{subtitle}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Loading() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-8 w-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
    </div>
  );
}

export function Table({ headers, children }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-start">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap text-start">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

export function Th({ children, className = "" }) {
  return <th className={`px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap text-start ${className}`}>{children}</th>;
}

export function Td({ children, className = "" }) {
  return <td className={`px-4 py-2.5 whitespace-nowrap ${className}`}>{children}</td>;
}