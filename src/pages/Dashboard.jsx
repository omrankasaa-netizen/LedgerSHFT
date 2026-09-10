import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "@/api/entities";
import { PageHeader, StatCard, Loading, Badge } from "@/components/ui/common";
import { formatMoney, customerOutstanding, isThisMonth, monthLabel } from "@/lib/finance";
import { Plus, Wallet, FileText, Users, ArrowRight, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { useI18n } from "@/lib/i18n";

export default function Dashboard() {
  const { t, isRTL } = useI18n();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [inv, pays, custs] = await Promise.all([
          db.entities.Invoice.list(),
          db.entities.Payment.list(),
          db.entities.Customer.list(),
        ]);
        setInvoices(inv);
        setPayments(pays);
        setCustomers(custs);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="p-6"><Loading /></div>;

  const outstandingByCustomer = customers.map((c) => {
    const cInvoices = invoices.filter((i) => i.customer_id === c.id);
    const cPayments = payments.filter((p) => p.customer_id === c.id);
    return { customer: c, outstanding: customerOutstanding(cInvoices, cPayments) };
  });
  const totalOutstanding = outstandingByCustomer.reduce((s, x) => s + x.outstanding, 0);
  const top5 = [...outstandingByCustomer]
    .filter((x) => x.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding)
    .slice(0, 5);

  const priorities = [...outstandingByCustomer]
    .map((x) => ({
      ...x,
      hasOverdue: invoices.some((i) => i.customer_id === x.customer.id && i.status === "Overdue"),
    }))
    .filter((x) => x.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding)
    .slice(0, 6);

  const collectedThisMonth = payments
    .filter((p) => isThisMonth(p.date))
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const profitThisMonth = invoices
    .filter((i) => isThisMonth(i.date))
    .reduce((s, i) => s + (Number(i.gross_profit_amount) || 0), 0);

  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const chartData = months.map((key) => {
    const monthInvoices = invoices.filter((i) => String(i.date).slice(0, 7) === key);
    return {
      month: monthLabel(key),
      sales: monthInvoices.reduce((s, i) => s + (Number(i.total_amount) || 0), 0),
      profit: monthInvoices.reduce((s, i) => s + (Number(i.gross_profit_amount) || 0), 0),
    };
  });

  const overdueCount = invoices.filter((i) => i.status === "Overdue").length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        titleKey="dashboard.title"
        subtitle={t("dashboard.subtitle")}
        actions={
          <>
            <Link to="/invoices/new">
              <Button size="sm"><Plus className="h-4 w-4 ms-1" /> {t("action.newInvoice")}</Button>
            </Link>
            <Link to="/payments/new">
              <Button size="sm" variant="outline"><Wallet className="h-4 w-4 ms-1" /> {t("action.recordPayment")}</Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label={t("dashboard.totalOutstanding")} value={formatMoney(totalOutstanding)} accent="amber" sub={`${customers.length} ${t("dashboard.customers")}`} />
        <StatCard label={t("dashboard.collectedMonth")} value={formatMoney(collectedThisMonth)} accent="emerald" />
        <StatCard label={t("dashboard.profitMonth")} value={formatMoney(profitThisMonth)} accent="blue" />
        <StatCard label={t("dashboard.totalInvoices")} value={invoices.length} sub={`${overdueCount} ${t("dashboard.overdue")}`} accent="red" />
      </div>

      {/* Today's priorities */}
      <div className="mb-6">
        <h2 className="font-heading font-semibold text-foreground mb-3">{t("dashboard.todayPriorities")}</h2>
        {priorities.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("dashboard.noPriorities")}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {priorities.map(({ customer, outstanding, hasOverdue }) => (
              <Link
                key={customer.id}
                to={`/customers/${customer.id}`}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition"
              >
                <div className="min-w-0">
                  <div className="font-medium text-foreground truncate">{customer.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{customer.city || "—"} · {t(`type.${customer.type}`)}</div>
                  <Badge className={`mt-2 ${hasOverdue ? "bg-red-100 text-red-700 border-red-200" : "bg-amber-100 text-amber-700 border-amber-200"}`}>
                    {hasOverdue ? t("customerStatus.overdue") : t("customerStatus.outstanding")}
                  </Badge>
                </div>
                <div className="text-end ms-3">
                  <div className="font-heading text-lg font-bold text-amber-600">{formatMoney(outstanding)}</div>
                  <div className="text-[11px] text-muted-foreground">{t("customers.col.outstanding")}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading font-semibold text-foreground">{t("dashboard.topCustomers")}</h2>
            <Link to="/customers" className="text-xs text-primary hover:underline flex items-center gap-1">
              {t("dashboard.viewAll")} <ArrowRight className="h-3 w-3 rtl:rotate-180" />
            </Link>
          </div>
          {top5.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">{t("dashboard.noOutstanding")}</p>
          ) : (
            <div className="space-y-2">
              {top5.map(({ customer, outstanding }) => (
                <Link
                  key={customer.id}
                  to={`/customers/${customer.id}`}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-foreground truncate">{customer.name}</div>
                    <div className="text-xs text-muted-foreground">{customer.city || "—"} · {t(`type.${customer.type}`)}</div>
                  </div>
                  <div className="font-semibold text-amber-600 ms-3">{formatMoney(outstanding)}</div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="font-heading font-semibold text-foreground">{t("dashboard.salesProfit")}</h2>
          </div>
          <ResponsiveContainer width="100%" height={220} key={isRTL ? "rtl" : "ltr"}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} reversed={isRTL} />
              <YAxis tick={{ fontSize: 11 }} orientation={isRTL ? "right" : "left"} />
              <Tooltip />
              <Bar dataKey="sales" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="profit" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
        <QuickLink to="/invoices/new" icon={FileText} title={t("dashboard.ql.newInvoice.title")} desc={t("dashboard.ql.newInvoice.desc")} />
        <QuickLink to="/payments/new" icon={Wallet} title={t("dashboard.ql.recordPayment.title")} desc={t("dashboard.ql.recordPayment.desc")} />
        <QuickLink to="/customers" icon={Users} title={t("dashboard.ql.balances.title")} desc={t("dashboard.ql.balances.desc")} />
      </div>
    </div>
  );
}

function QuickLink({ to, icon: Icon, title, desc }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition">
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="font-medium text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </Link>
  );
}