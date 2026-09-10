import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "@/api/entities";
import { PageHeader, Table, Loading, EmptyState } from "@/components/ui/common";
import { formatMoney } from "@/lib/finance";
import { Plus, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import PartnerFormDialog from "@/components/PartnerFormDialog";
import { useI18n } from "@/lib/i18n";

export default function Partners() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [partners, setPartners] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [newOpen, setNewOpen] = useState(false);

  const load = async () => {
    try {
      const [p, inv, pays] = await Promise.all([
        db.entities.Partner.list(),
        db.entities.Invoice.list(),
        db.entities.Payment.list(),
      ]);
      setPartners(p);
      setInvoices(inv);
      setPayments(pays);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="p-6"><Loading /></div>;

  const rows = partners.map((p) => {
    const pInvoices = invoices.filter((i) => i.partner_id === p.id);
    const shareDue = pInvoices.reduce((s, i) => s + (Number(i.partner_share_amount) || 0), 0);
    const sharePaid = pInvoices.reduce((s, inv) => {
      const invPaid = payments.filter((pay) => pay.invoice_id === inv.id).reduce((s, pay) => s + (Number(pay.amount) || 0), 0);
      const ratio = (Number(inv.total_amount) || 0) > 0 ? invPaid / inv.total_amount : 0;
      return s + (Number(inv.partner_share_amount) || 0) * ratio;
    }, 0);
    return { ...p, shareDue, sharePaid };
  });

  const shareLabel = (p) => {
    if (p.default_share_type === "percentage") return `${p.default_share_value}${t("shareLabel.percentage")}`;
    if (p.default_share_type === "fixed_amount") return formatMoney(p.default_share_value);
    return t("shareLabel.none");
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        titleKey="partners.title"
        subtitle={t("partners.subtitle")}
        actions={<Button size="sm" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4 ms-1" /> {t("action.newPartner")}</Button>}
      />

      {rows.length === 0 ? (
        <EmptyState icon={Handshake} title={t("partners.empty.title")} subtitle={t("partners.empty.subtitle")}
          action={<Button size="sm" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4 ms-1" /> {t("action.newPartner")}</Button>} />
      ) : (
        <Table headers={[t("partners.col.name"), t("partners.col.role"), t("partners.col.defaultShare"), t("partners.col.shareDue"), t("partners.col.sharePaid"), ""]}>
          {rows.map((p) => (
            <tr key={p.id} className="hover:bg-muted/40">
              <td className="px-4 py-2.5 font-medium text-foreground">{p.name}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{t(`role.${p.role}`)}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{shareLabel(p)}</td>
              <td className="px-4 py-2.5 font-semibold">{formatMoney(p.shareDue)}</td>
              <td className="px-4 py-2.5 text-emerald-600">{formatMoney(p.sharePaid)}</td>
              <td className="px-4 py-2.5 text-end">
                <Link to={`/partners/${p.id}`} className="text-primary text-xs font-medium hover:underline">{t("action.view")}</Link>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <PartnerFormDialog open={newOpen} onOpenChange={setNewOpen} onSaved={load} />
    </div>
  );
}