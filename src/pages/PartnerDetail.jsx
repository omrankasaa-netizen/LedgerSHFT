import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { PageHeader, Table, Loading } from "@/components/ui/common";
import { formatMoney } from "@/lib/finance";
import { ArrowLeft, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import PartnerFormDialog from "@/components/PartnerFormDialog";
import { useI18n } from "@/lib/i18n";

export default function PartnerDetail() {
  const { t } = useI18n();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [partner, setPartner] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [editOpen, setEditOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [p, inv, pays, custs] = await Promise.all([
        base44.entities.Partner.get(id),
        base44.entities.Invoice.list(),
        base44.entities.Payment.list(),
        base44.entities.Customer.list(),
      ]);
      setPartner(p);
      setInvoices(inv.filter((i) => i.partner_id === id));
      setPayments(pays);
      setCustomers(custs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  if (loading) return <div className="p-6"><Loading /></div>;
  if (!partner) return <div className="p-6 text-muted-foreground">{t("common.notFound")}</div>;

  const shareDue = invoices.reduce((s, i) => s + (Number(i.partner_share_amount) || 0), 0);
  const sharePaid = invoices.reduce((s, inv) => {
    const invPaid = payments.filter((pay) => pay.invoice_id === inv.id).reduce((s, pay) => s + (Number(pay.amount) || 0), 0);
    const ratio = (Number(inv.total_amount) || 0) > 0 ? invPaid / inv.total_amount : 0;
    return s + (Number(inv.partner_share_amount) || 0) * ratio;
  }, 0);

  const custName = (cid) => customers.find((c) => c.id === cid)?.name || "—";
  const shareLabel = partner.default_share_type === "percentage"
    ? `${partner.default_share_value}${t("shareLabel.percentage")}`
    : partner.default_share_type === "fixed_amount"
      ? formatMoney(partner.default_share_value)
      : t("shareLabel.none");

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Link to="/partners" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-3">
        <ArrowLeft className="h-4 w-4 me-1 rtl:rotate-180" /> {t("partnerDetail.back")}
      </Link>

      <PageHeader
        title={partner.name}
        subtitle={`${t(`role.${partner.role}`)} · ${partner.contact || "—"} · ${partner.phone || "—"}`}
        actions={<Button size="sm" variant="outline" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4 ms-1" /> {t("action.edit")}</Button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground uppercase">{t("partnerDetail.defaultShare")}</div>
          <div className="font-heading text-lg font-bold mt-1">{shareLabel}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground uppercase">{t("partnerDetail.shareDue")}</div>
          <div className="font-heading text-lg font-bold mt-1">{formatMoney(shareDue)}</div>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
          <div className="text-xs text-muted-foreground uppercase">{t("partnerDetail.sharePaid")}</div>
          <div className="font-heading text-lg font-bold mt-1 text-emerald-600">{formatMoney(sharePaid)}</div>
        </div>
      </div>

      <h2 className="font-heading font-semibold mb-3">{t("partnerDetail.linkedInvoices")} ({invoices.length})</h2>
      {invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">{t("partnerDetail.noInvoices")}</p>
      ) : (
        <Table headers={[t("partnerDetail.col.invoiceNumber"), t("partnerDetail.col.customer"), t("partnerDetail.col.date"), t("partnerDetail.col.total"), t("partnerDetail.col.grossProfit"), t("partnerDetail.col.partnerShare")]}>
          {invoices.sort((a, b) => String(b.date).localeCompare(String(a.date))).map((inv) => (
            <tr key={inv.id} className="hover:bg-muted/40">
              <td className="px-4 py-2.5">
                <Link to={`/invoices/${inv.id}`} className="text-primary font-medium hover:underline">
                  {inv.invoice_number || inv.id.slice(0, 8)}
                </Link>
              </td>
              <td className="px-4 py-2.5">{custName(inv.customer_id)}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{inv.date}</td>
              <td className="px-4 py-2.5">{formatMoney(inv.total_amount, inv.currency)}</td>
              <td className="px-4 py-2.5">{formatMoney(inv.gross_profit_amount, inv.currency)}</td>
              <td className="px-4 py-2.5 font-semibold">{formatMoney(inv.partner_share_amount, inv.currency)}</td>
            </tr>
          ))}
        </Table>
      )}

      <PartnerFormDialog open={editOpen} onOpenChange={setEditOpen} onSaved={load} partner={partner} />
    </div>
  );
}