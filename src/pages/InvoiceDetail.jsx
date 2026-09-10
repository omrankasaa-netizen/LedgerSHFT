import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { db } from "@/api/entities";
import { PageHeader, Table, Loading, Badge } from "@/components/ui/common";
import { formatMoney, statusColor, invoiceOutstanding } from "@/lib/finance";
import { ArrowLeft, Pencil, Wallet, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";

export default function InvoiceDetail() {
  const { t } = useI18n();
  const { id } = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState(null);
  const [lines, setLines] = useState([]);
  const [payments, setPayments] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [partner, setPartner] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const inv = await db.entities.Invoice.get(id);
      setInvoice(inv);
      // Line items and payments come embedded with the invoice.
      setLines(inv.line_items || []);
      setPayments(inv.payments || []);
      const [customers, partners] = await Promise.all([
        db.entities.Customer.list(),
        db.entities.Partner.list(),
      ]);
      setCustomer(customers.find((c) => c.id === inv.customer_id));
      setPartner(partners.find((p) => p.id === inv.partner_id));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  if (loading) return <div className="p-6"><Loading /></div>;
  if (!invoice) return <div className="p-6 text-muted-foreground">{t("common.notFound")}</div>;

  const paid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const outstanding = invoiceOutstanding(invoice, payments);

  const deletePayment = async (pid) => {
    await db.entities.Payment.delete(pid);
    toast({ title: t("toast.paymentDeleted") });
    load();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link to="/invoices" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-3">
        <ArrowLeft className="h-4 w-4 me-1 rtl:rotate-180" /> {t("invoiceDetail.back")}
      </Link>

      <PageHeader
        title={invoice.invoice_number || `Invoice #${invoice.id.slice(0, 8)}`}
        subtitle={`${customer?.name || "—"} · ${invoice.date} · ${invoice.currency}`}
        actions={
          <>
            <Link to={`/invoices/${invoice.id}/edit`}>
              <Button size="sm" variant="outline"><Pencil className="h-4 w-4 ms-1" /> {t("action.edit")}</Button>
            </Link>
            <Link to={`/payments/new?customer=${invoice.customer_id}&invoice=${invoice.id}`}>
              <Button size="sm"><Wallet className="h-4 w-4 ms-1" /> {t("action.recordPayment")}</Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg border border-border bg-card p-4 lg:col-span-1">
          <h3 className="font-heading font-semibold text-sm mb-3">{t("invoiceDetail.header")}</h3>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">{t("invoiceDetail.label.status")}</dt><dd><Badge className={statusColor(invoice.status)}>{t(`status.${invoice.status}`)}</Badge></dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">{t("invoiceDetail.label.customer")}</dt><dd className="font-medium">{customer?.name || "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">{t("invoiceDetail.label.partner")}</dt><dd>{partner?.name || "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">{t("invoiceDetail.label.currency")}</dt><dd>{invoice.currency}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">{t("invoiceDetail.label.date")}</dt><dd>{invoice.date}</dd></div>
          </dl>
          {invoice.notes && <div className="mt-3 pt-3 border-t border-border text-sm text-muted-foreground">{invoice.notes}</div>}
        </div>

        <div className="rounded-lg border border-border bg-card p-4 lg:col-span-2">
          <h3 className="font-heading font-semibold text-sm mb-3">{t("invoiceDetail.summary")}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <SummaryBox label={t("invoiceDetail.box.total")} value={formatMoney(invoice.total_amount, invoice.currency)} />
            <SummaryBox label={t("invoiceDetail.box.totalCost")} value={formatMoney(invoice.total_cost_amount, invoice.currency)} />
            <SummaryBox label={t("invoiceDetail.box.grossProfit")} value={formatMoney(invoice.gross_profit_amount, invoice.currency)} accent="emerald" />
            <SummaryBox label={t("invoiceDetail.box.partnerShare")} value={formatMoney(invoice.partner_share_amount, invoice.currency)} accent="blue" />
            <SummaryBox label={t("invoiceDetail.box.paid")} value={formatMoney(paid, invoice.currency)} accent="emerald" />
            <SummaryBox label={t("invoiceDetail.box.outstanding")} value={formatMoney(outstanding, invoice.currency)} accent="amber" />
          </div>
        </div>
      </div>

      <h3 className="font-heading font-semibold mb-2">{t("invoiceDetail.lineItems")}</h3>
      <Table headers={[t("invoiceDetail.col.product"), t("invoiceDetail.col.code"), t("invoiceDetail.col.qty"), t("invoiceDetail.col.unitPrice"), t("invoiceDetail.col.unitCost"), t("invoiceDetail.col.lineTotal"), t("invoiceDetail.col.lineCost")]}>
        {lines.map((l) => (
          <tr key={l.id} className="hover:bg-muted/40">
            <td className="px-4 py-2.5 font-medium">{l.product_name}</td>
            <td className="px-4 py-2.5 text-muted-foreground">{l.product_code || "—"}</td>
            <td className="px-4 py-2.5">{l.quantity}</td>
            <td className="px-4 py-2.5">{formatMoney(l.unit_price, invoice.currency)}</td>
            <td className="px-4 py-2.5">{formatMoney(l.unit_cost, invoice.currency)}</td>
            <td className="px-4 py-2.5 font-medium">{formatMoney(l.line_total, invoice.currency)}</td>
            <td className="px-4 py-2.5 text-muted-foreground">{formatMoney(l.line_cost_total, invoice.currency)}</td>
          </tr>
        ))}
      </Table>

      <h3 className="font-heading font-semibold mt-6 mb-2">{t("invoiceDetail.payments")} ({payments.length})</h3>
      {payments.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">{t("invoiceDetail.noPayments")}</p>
      ) : (
        <Table headers={[t("invoiceDetail.col.date"), t("invoiceDetail.col.amount"), t("invoiceDetail.col.method"), t("invoiceDetail.col.reference"), ""]}>
          {payments.sort((a, b) => String(b.date).localeCompare(String(a.date))).map((p) => (
            <tr key={p.id} className="hover:bg-muted/40">
              <td className="px-4 py-2.5">{p.date}</td>
              <td className="px-4 py-2.5 font-semibold text-emerald-600">{formatMoney(p.amount, p.currency)}</td>
              <td className="px-4 py-2.5">{t(`method.${p.method}`)}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{p.reference || "—"}</td>
              <td className="px-4 py-2.5 text-end"><button onClick={() => deletePayment(p.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button></td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

function SummaryBox({ label, value, accent }) {
  const color = accent === "emerald" ? "text-emerald-600" : accent === "blue" ? "text-blue-600" : accent === "amber" ? "text-amber-600" : "";
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-xs text-muted-foreground uppercase">{label}</div>
      <div className={`font-heading text-base font-bold mt-0.5 ${color}`}>{value}</div>
    </div>
  );
}