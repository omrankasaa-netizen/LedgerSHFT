import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { db } from "@/api/entities";
import { PageHeader, Table, Loading, Badge } from "@/components/ui/common";
import { formatMoney, statusColor, customerBalancesByCurrency } from "@/lib/finance";
import { ArrowLeft, Pencil, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import CustomerFormDialog from "@/components/CustomerFormDialog";
import { useI18n } from "@/lib/i18n";

export default function CustomerDetail() {
  const { t } = useI18n();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [editOpen, setEditOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [c, inv, pays] = await Promise.all([
        db.entities.Customer.get(id),
        db.entities.Invoice.list(),
        db.entities.Payment.list(),
      ]);
      setCustomer(c);
      setInvoices(inv.filter((i) => i.customer_id === id));
      setPayments(pays.filter((p) => p.customer_id === id));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  if (loading) return <div className="p-6"><Loading /></div>;
  if (!customer) return <div className="p-6 text-muted-foreground">{t("common.notFound")}</div>;

  // Balances stay per currency — USD and LBP are never summed together.
  const balances = customerBalancesByCurrency(invoices, payments);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Link to="/customers" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-3">
        <ArrowLeft className="h-4 w-4 me-1 rtl:rotate-180" /> {t("customerDetail.back")}
      </Link>

      <PageHeader
        title={customer.name}
        subtitle={`${t(`type.${customer.type}`)} · ${customer.city || "—"} · ${customer.phone || "—"}`}
        actions={
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 ms-1" /> {t("action.edit")}
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground uppercase">{t("customerDetail.totalInvoiced")}</div>
          <div className="font-heading text-xl font-bold mt-1">
            {balances.length === 0 ? formatMoney(0) : balances.map((b) => (
              <div key={b.currency}>{formatMoney(b.totalInvoiced, b.currency)}</div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground uppercase">{t("customerDetail.totalPaid")}</div>
          <div className="font-heading text-xl font-bold mt-1 text-emerald-600">
            {balances.length === 0 ? formatMoney(0) : balances.map((b) => (
              <div key={b.currency}>{formatMoney(b.totalPaid, b.currency)}</div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
          <div className="text-xs text-muted-foreground uppercase">{t("customerDetail.outstanding")}</div>
          <div className="font-heading text-xl font-bold mt-1 text-amber-600">
            {balances.length === 0 ? formatMoney(0) : balances.map((b) => (
              <div key={b.currency}>{formatMoney(b.outstanding, b.currency)}</div>
            ))}
          </div>
        </div>
      </div>

      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices">{t("customerDetail.tabs.invoices")} ({invoices.length})</TabsTrigger>
          <TabsTrigger value="payments">{t("customerDetail.tabs.payments")} ({payments.length})</TabsTrigger>
          <TabsTrigger value="balance">{t("customerDetail.tabs.balance")}</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="mt-4">
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">{t("customerDetail.noInvoices")}</p>
          ) : (
            <Table headers={[
              t("customerDetail.col.invoiceNumber"), t("customerDetail.col.date"), t("customerDetail.col.status"),
              t("customerDetail.col.total"), t("customerDetail.col.paid"), t("customerDetail.col.outstanding"),
            ]}>
              {invoices.sort((a, b) => String(b.date).localeCompare(String(a.date))).map((inv) => {
                // Only same-currency payments net against the invoice.
                const paid = payments.filter((p) => p.invoice_id === inv.id && p.currency === inv.currency).reduce((s, p) => s + (Number(p.amount) || 0), 0);
                const out = Math.max(0, (Number(inv.total_amount) || 0) - paid);
                return (
                  <tr key={inv.id} className="hover:bg-muted/40">
                    <td className="px-4 py-2.5">
                      <Link to={`/invoices/${inv.id}`} className="text-primary font-medium hover:underline">
                        {inv.invoice_number || inv.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{inv.date}</td>
                    <td className="px-4 py-2.5"><Badge className={statusColor(inv.status)}>{t(`status.${inv.status}`)}</Badge></td>
                    <td className="px-4 py-2.5">{formatMoney(inv.total_amount, inv.currency)}</td>
                    <td className="px-4 py-2.5 text-emerald-600">{formatMoney(paid, inv.currency)}</td>
                    <td className="px-4 py-2.5 font-semibold text-amber-600">{formatMoney(out, inv.currency)}</td>
                  </tr>
                );
              })}
            </Table>
          )}
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">{t("customerDetail.noPayments")}</p>
          ) : (
            <Table headers={[
              t("customerDetail.col.date"), t("customerDetail.col.amount"), t("customerDetail.col.method"),
              t("customerDetail.col.reference"), t("customerDetail.col.notes"),
            ]}>
              {payments.sort((a, b) => String(b.date).localeCompare(String(a.date))).map((p) => (
                <tr key={p.id} className="hover:bg-muted/40">
                  <td className="px-4 py-2.5">{p.date}</td>
                  <td className="px-4 py-2.5 font-semibold text-emerald-600">{formatMoney(p.amount, p.currency)}</td>
                  <td className="px-4 py-2.5">{t(`method.${p.method}`)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{p.reference || "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{p.notes || "—"}</td>
                </tr>
              ))}
            </Table>
          )}
        </TabsContent>

        <TabsContent value="balance" className="mt-4">
          <div className="rounded-lg border border-border bg-card p-6 max-w-md">
            <div className="space-y-3">
              {balances.length === 0 ? (
                <Row label={t("customerDetail.outstandingBalance")} value={formatMoney(0)} bold />
              ) : balances.map((b) => (
                <div key={b.currency} className="space-y-3">
                  <Row label={`${t("customerDetail.totalInvoiced")} · ${b.currency}`} value={formatMoney(b.totalInvoiced, b.currency)} />
                  <Row label={`${t("customerDetail.totalPaid")} · ${b.currency}`} value={formatMoney(b.totalPaid, b.currency)} />
                  <Row label={`${t("customerDetail.outstandingBalance")} · ${b.currency}`} value={formatMoney(b.outstanding, b.currency)} bold />
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Link to={`/payments/new?customer=${customer.id}`}>
                <Button size="sm" variant="outline"><Wallet className="h-4 w-4 ms-1" /> {t("action.recordPayment")}</Button>
              </Link>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <CustomerFormDialog open={editOpen} onOpenChange={setEditOpen} onSaved={load} customer={customer} />
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`font-medium ${bold ? "font-heading text-lg text-amber-600" : ""}`}>{value}</span>
    </div>
  );
}
