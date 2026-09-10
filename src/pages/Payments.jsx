import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { PageHeader, Table, Loading, EmptyState } from "@/components/ui/common";
import { formatMoney } from "@/lib/finance";
import { Plus, Wallet, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";

export default function Payments() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [pays, custs, inv] = await Promise.all([
          base44.entities.Payment.list(),
          base44.entities.Customer.list(),
          base44.entities.Invoice.list(),
        ]);
        setPayments(pays);
        setCustomers(custs);
        setInvoices(inv);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="p-6"><Loading /></div>;

  const custName = (cid) => customers.find((c) => c.id === cid)?.name || "—";
  const invNumber = (iid) => invoices.find((i) => i.id === iid)?.invoice_number || (iid ? iid.slice(0, 8) : "—");

  const rows = payments
    .filter((p) => search ? (custName(p.customer_id) + " " + (p.reference || "") + " " + p.method).toLowerCase().includes(search.toLowerCase()) : true)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const total = rows.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        titleKey="payments.title"
        subtitle={`${t("payments.collected")}: ${formatMoney(total)}`}
        actions={<Link to="/payments/new"><Button size="sm"><Plus className="h-4 w-4 ms-1" /> {t("action.recordPayment")}</Button></Link>}
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground start-3" />
        <Input placeholder={t("payments.search")} value={search} onChange={(e) => setSearch(e.target.value)} className="ps-9" />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Wallet} title={t("payments.empty.title")} subtitle={t("payments.empty.subtitle")}
          action={<Link to="/payments/new"><Button size="sm"><Plus className="h-4 w-4 ms-1" /> {t("action.recordPayment")}</Button></Link>} />
      ) : (
        <Table headers={[t("payments.col.date"), t("payments.col.customer"), t("payments.col.invoice"), t("payments.col.amount"), t("payments.col.method"), t("payments.col.reference"), t("payments.col.notes")]}>
          {rows.map((p) => (
            <tr key={p.id} className="hover:bg-muted/40">
              <td className="px-4 py-2.5">{p.date}</td>
              <td className="px-4 py-2.5 font-medium">{custName(p.customer_id)}</td>
              <td className="px-4 py-2.5">
                {p.invoice_id ? <Link to={`/invoices/${p.invoice_id}`} className="text-primary hover:underline">{invNumber(p.invoice_id)}</Link> : <span className="text-muted-foreground">{t("common.balance")}</span>}
              </td>
              <td className="px-4 py-2.5 font-semibold text-emerald-600">{formatMoney(p.amount, p.currency)}</td>
              <td className="px-4 py-2.5">{t(`method.${p.method}`)}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{p.reference || "—"}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{p.notes || "—"}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}