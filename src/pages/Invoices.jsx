import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { PageHeader, Table, Loading, EmptyState, Badge } from "@/components/ui/common";
import { formatMoney, statusColor, invoiceOutstanding } from "@/lib/finance";
import { Plus, Search, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";

const STATUS_VALUES = ["Draft", "Issued", "Partially Paid", "Paid", "Overdue"];

export default function Invoices() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [inv, custs, pays] = await Promise.all([
          base44.entities.Invoice.list(),
          base44.entities.Customer.list(),
          base44.entities.Payment.list(),
        ]);
        setInvoices(inv);
        setCustomers(custs);
        setPayments(pays);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="p-6"><Loading /></div>;

  const custName = (cid) => customers.find((c) => c.id === cid)?.name || "—";

  const rows = invoices
    .filter((i) => statusFilter === "all" ? true : i.status === statusFilter)
    .filter((i) => customerFilter === "all" ? true : i.customer_id === customerFilter)
    .filter((i) => fromDate ? String(i.date) >= fromDate : true)
    .filter((i) => toDate ? String(i.date) <= toDate : true)
    .filter((i) => search ? (i.invoice_number + " " + custName(i.customer_id)).toLowerCase().includes(search.toLowerCase()) : true)
    .map((i) => ({ ...i, outstanding: invoiceOutstanding(i, payments) }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        titleKey="invoices.title"
        subtitle={t("invoices.subtitle")}
        actions={<Link to="/invoices/new"><Button size="sm"><Plus className="h-4 w-4 ms-1" /> {t("action.newInvoice")}</Button></Link>}
      />

      <div className="flex flex-col lg:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground start-3" />
          <Input placeholder={t("invoices.search")} value={search} onChange={(e) => setSearch(e.target.value)} className="ps-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full lg:w-40"><SelectValue placeholder={t("invoices.col.status")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("invoices.filter.allStatuses")}</SelectItem>
            {STATUS_VALUES.map((s) => <SelectItem key={s} value={s}>{t(`status.${s}`)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={customerFilter} onValueChange={setCustomerFilter}>
          <SelectTrigger className="w-full lg:w-48"><SelectValue placeholder={t("invoices.col.customer")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("invoices.filter.allCustomers")}</SelectItem>
            {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full lg:w-40" />
        <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full lg:w-40" />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={FileText} title={t("invoices.empty.title")} subtitle={t("invoices.empty.subtitle")}
          action={<Link to="/invoices/new"><Button size="sm"><Plus className="h-4 w-4 ms-1" /> {t("action.newInvoice")}</Button></Link>} />
      ) : (
        <Table headers={[t("invoices.col.invoiceNumber"), t("invoices.col.customer"), t("invoices.col.date"), t("invoices.col.currency"), t("invoices.col.total"), t("invoices.col.status"), t("invoices.col.outstanding"), ""]}>
          {rows.map((i) => (
            <tr key={i.id} className="hover:bg-muted/40">
              <td className="px-4 py-2.5">
                <Link to={`/invoices/${i.id}`} className="text-primary font-medium hover:underline">{i.invoice_number || i.id.slice(0, 8)}</Link>
              </td>
              <td className="px-4 py-2.5">{custName(i.customer_id)}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{i.date}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{i.currency}</td>
              <td className="px-4 py-2.5 font-medium">{formatMoney(i.total_amount, i.currency)}</td>
              <td className="px-4 py-2.5"><Badge className={statusColor(i.status)}>{t(`status.${i.status}`)}</Badge></td>
              <td className={`px-4 py-2.5 font-semibold ${i.outstanding > 0 ? "text-amber-600" : "text-emerald-600"}`}>{formatMoney(i.outstanding, i.currency)}</td>
              <td className="px-4 py-2.5 text-end">
                <Link to={`/invoices/${i.id}`} className="text-primary text-xs font-medium hover:underline">{t("action.view")}</Link>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}