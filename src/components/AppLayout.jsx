import React, { useState } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import {
  LayoutDashboard, Users, Handshake, FileText, Wallet,
  BarChart3, Settings, Menu, X, BookOpen,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import LanguageToggle from "@/components/LanguageToggle";

const navItems = [
  { labelKey: "nav.dashboard", path: "/", icon: LayoutDashboard },
  { labelKey: "nav.customers", path: "/customers", icon: Users },
  { labelKey: "nav.partners", path: "/partners", icon: Handshake },
  { labelKey: "nav.invoices", path: "/invoices", icon: FileText },
  { labelKey: "nav.payments", path: "/payments", icon: Wallet },
  { labelKey: "nav.reports", path: "/reports", icon: BarChart3 },
  { labelKey: "nav.settings", path: "/settings", icon: Settings },
];

export default function AppLayout() {
  const location = useLocation();
  const { t } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-5 py-5 border-b border-sidebar-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <BookOpen className="h-5 w-5" />
        </div>
        <div>
          <div className="font-heading text-base font-bold leading-tight text-sidebar-foreground">
            LedgerShift
          </div>
          <div className="text-[11px] text-muted-foreground">{t("app.tagline")}</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-3 text-[11px] text-muted-foreground border-t border-sidebar-border">
        v1.0 · Prototype
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar (flips to the right automatically in RTL via dir) */}
      <aside className="hidden md:flex w-60 shrink-0 bg-sidebar border-r border-sidebar-border rtl:border-r-0 rtl:border-l">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute top-0 h-full w-64 bg-sidebar border-r border-sidebar-border rtl:left-auto rtl:right-0 rtl:border-r-0 rtl:border-l">
            <button
              className="absolute top-3 text-muted-foreground rtl:left-3 rtl:right-auto right-3"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar with language toggle (top-right) */}
        <header className="flex items-center justify-between border-b border-border bg-background px-4 py-2.5">
          <div className="md:hidden flex items-center gap-2">
            <button onClick={() => setMobileOpen(true)} aria-label="Menu">
              <Menu className="h-5 w-5" />
            </button>
            <span className="font-heading font-bold">LedgerShift</span>
          </div>
          <div className="hidden md:block" />
          <LanguageToggle />
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}