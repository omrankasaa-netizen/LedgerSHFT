import React, { useEffect, useState } from "react";
import { db } from "@/api/entities";
import { PageHeader, Table, Loading } from "@/components/ui/common";
import { formatMoney, customerOutstanding, monthKey, monthLabel } from "@/lib/finance";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCSV } from "@/lib/finance";
import { useI18n } from "@/lib/i18n";

export default function Reports() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [partners, setPartners] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [custs, prts, inv, pays] = await Promise.all([
          db.entities.Customer.list(),
          db.entities.Partner.list(),
          db.entities.Invoice.list(),
          db.entities.Payment.list(),
        ]);
        setCustomers(custs);
        setPartners(prts);
        setInvoices(inv);
        setPayments(pays);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="p-6"><Loading /></div>;

  const customerRows = customers.map((c) => {
    const cInv = invoices.filter((i) => i.customer_id === c.id);
    const cPay = payments.filter((p) => p.customer_id === c.id);
    const totalInvoiced = cInv.reduce((s, i) => s + (Number(i.total_amount) || 0), 0);
    const totalPaid = cPay.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    return { name: c.name, city: c.city || "", type: t(`type.${c.type}`),
      total_invoiced: totalInvoiced, total_paid: totalPaid, outstanding: customerOutstanding(cInv, cPay) };
  }).filter((r) => r.total_invoiced > 0 || r.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding);

  const partnerRows = partners.map((p) => {
    const pInv = invoices.filter((i) => i.partner_id === p.id);
    const shareDue = pInv.reduce((s, i) => s + (Number(i.partner_share_amount) || 0), 0);
    const sharePaid = pInv.reduce((s, inv) => {
      const invPaid = payments.filter((pay) => pay.invoice_id === inv.id).reduce((s, pay) => s + (Number(pay.amount) || 0), 0);
      const ratio = (Number(inv.total_amount) || 0) > 0 ? invPaid / inv.total_amount : 0;
      return s + (Number(inv.partner_share_amount) || 0) * ratio;
    }, 0);
    return { name: p.name, role: t(`role.${p.role}`), share_due: shareDue, share_paid: sharePaid };
  });

  const monthMap = {};
  invoices.forEach((i) => {
    const k = monthKey(i.date);
    if (!k) return;
    if (!monthMap[k]) monthMap[k] = { month: k, total_sales: 0, total_costs: 0, gross_profit: 0 };
    monthMap[k].total_sales += Number(i.total_amount) || 0;
    monthMap[k].total_costs += Number(i.total_cost_amount) || 0;
    monthMap[k].gross_profit += Number(i.gross_profit_amount) || 0;
  });
  const monthRows = Object.values(monthMap).sort((a, b) => b.month.localeCompare(a.month)).map((r) => ({
    month: monthLabel(r.month), total_sales: r.total_sales, total_costs: r.total_costs, gross_profit: r.gross_profit,
  }));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader titleKey="reports.title" subtitle={t("reports.subtitle")} />

      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading font-semibold">{t("reports.customerBalances")}</h2>
          <Button size="sm" variant="outline" onClick={() => downloadCSV("customer_balances.csv", customerRows)}>
            <Download className="h-4 w-4 ms-1" /> {t("action.export")}
          </Button>
        </div>
        {customerRows.length === 0 ? <p className="text-sm text-muted-foreground">{t("reports.noData")}</p> : (
          <Table headers={[t("reports.col.name"), t("reports.col.city"), t("reports.col.type"), t("reports.col.totalInvoiced"), t("reports.col.totalPaid"), t("reports.col.outstanding")]}>
            {customerRows.map((r, i) => (
              <tr key={i} className="hover:bg-muted/40">
                <td className="px-4 py-2.5 font-medium">{r.name}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{r.city}</td>
                <td className="px-4 py-2.5">{r.type}</td>
                <td className="px-4 py-2.5">{formatMoney(r.total_invoiced)}</td>
                <td className="px-4 py-2.5 text-emerald-600">{formatMoney(r.total_paid)}</td>
                <td className="px-4 py-2.5 font-semibold text-amber-600">{formatMoney(r.outstanding)}</td>
              </tr>
            ))}
          </Table>
        )}
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading font-semibold">{t("reports.partnerShares")}</h2>
          <Button size="sm" variant="outline" onClick={() => downloadCSV("partner_shares.csv", partnerRows)}>
            <Download className="h-4 w-4 ms-1" /> {t("action.export")}
          </Button>
        </div>
        {partnerRows.length === 0 ? <p className="text-sm text-muted-foreground">{t("reports.noData")}</p> : (
          <Table headers={[t("reports.col.name"), t("reports.col.role"), t("reports.col.shareDue"), t("reports.col.sharePaid"), t("reports.col.remaining")]}>
            {partnerRows.map((r, i) => (
              <tr key={i} className="hover:bg-muted/40">
                <td className="px-4 py-2.5 font-medium">{r.name}</td>
                <td className="px-4 py-2.5">{r.role}</td>
                <td className="px-4 py-2.5">{formatMoney(r.share_due)}</td>
                <td className="px-4 py-2.5 text-emerald-600">{formatMoney(r.share_paid)}</td>
                <td className="px-4 py-2.5 font-semibold text-amber-600">{formatMoney(r.share_due - r.share_paid)}</td>
              </tr>
            ))}
          </Table>
        )}
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading font-semibold">{t("reports.monthlyProfit")}</h2>
          <Button size="sm" variant="outline" onClick={() => downloadCSV("monthly_profit.csv", monthRows)}>
            <Download className="h-4 w-4 ms-1" /> {t("action.export")}
          </Button>
        </div>
        {monthRows.length === 0 ? <p className="text-sm text-muted-foreground">{t("reports.noData")}</p> : (
          <Table headers={[t("reports.col.month"), t("reports.col.totalSales"), t("reports.col.totalCosts"), t("reports.col.grossProfit")]}>
            {monthRows.map((r, i) => (
              <tr key={i} className="hover:bg-muted/40">
                <td className="px-4 py-2.5 font-medium">{r.month}</td>
                <td className="px-4 py-2.5">{formatMoney(r.total_sales)}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{formatMoney(r.total_costs)}</td>
                <td className="px-4 py-2.5 font-semibold text-emerald-600">{formatMoney(r.gross_profit)}</td>
              </tr>
            ))}
          </Table>
        )}
      </div>
    </div>
  );
}