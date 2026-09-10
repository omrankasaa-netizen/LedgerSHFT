import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { PageHeader, Table, Loading, EmptyState, Badge } from "@/components/ui/common";
import { formatMoney, customerOutstanding, customerStatus } from "@/lib/finance";
import { Plus, Search, Users, FileText, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import CustomerFormDialog from "@/components/CustomerFormDialog";
import { useI18n } from "@/lib/i18n";

const TYPE_VALUES = ["shop", "pharmacy", "supermarket", "restaurant", "other"];

export default function Customers() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [newOpen, setNewOpen] = useState(false);

  const load = async () => {
    try {
      const [custs, inv, pays] = await Promise.all([
        base44.entities.Customer.list(),
        base44.entities.Invoice.list(),
        base44.entities.Payment.list(),
      ]);
      setCustomers(custs);
      setInvoices(inv);
      setPayments(pays);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const cities = [...new Set(customers.map((c) => c.city).filter(Boolean))].sort();

  const rows = customers
    .filter((c) => (typeFilter === "all" ? true : c.type === typeFilter))
    .filter((c) => (cityFilter === "all" ? true : c.city === cityFilter))
    .filter((c) => (search ? (c.name + " " + (c.contact_person || "") + " " + (c.phone || "")).toLowerCase().includes(search.toLowerCase()) : true))
    .map((c) => {
      const cInvoices = invoices.filter((i) => i.customer_id === c.id);
      const cPayments = payments.filter((p) => p.customer_id === c.id);
      const outstanding = customerOutstanding(cInvoices, cPayments);
      const lastInvoice = cInvoices.sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
      return { ...c, outstanding, lastInvoiceDate: lastInvoice?.date };
    })
    .sort((a, b) => b.outstanding - a.outstanding);

  if (loading) return <div className="p-6"><Loading /></div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        titleKey="customers.title"
        subtitle={t("customers.subtitle")}
        actions={
          <Button size="sm" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4 ms-1" /> {t("action.newCustomer")}</Button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground start-3" />
          <Input
            placeholder={t("customers.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder={t("customers.col.type")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filter.allTypes")}</SelectItem>
            {TYPE_VALUES.map((v) => <SelectItem key={v} value={v}>{t(`type.${v}`)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={cityFilter} onValueChange={setCityFilter}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder={t("customers.col.city")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filter.allCities")}</SelectItem>
            {cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Users} title={t("customers.empty.title")} subtitle={t("customers.empty.subtitle")}
          action={<Button size="sm" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4 ms-1" /> {t("action.newCustomer")}</Button>} />
      ) : (
        <Table headers={[
          t("customers.col.name"), t("customers.col.type"), t("customers.col.city"),
          t("customers.col.phone"), t("customers.col.status"), t("customers.col.outstanding"),
          t("customers.col.lastInvoice"), t("customers.col.actions"),
        ]}>
          {rows.map((c) => {
            const cInv = invoices.filter((i) => i.customer_id === c.id);
            const cPay = payments.filter((p) => p.customer_id === c.id);
            const st = customerStatus(cInv, cPay);
            return (
              <tr key={c.id} className="hover:bg-muted/40">
                <td className="px-4 py-2.5 font-medium text-foreground">{c.name}</td>
                <td className="px-4 py-2.5"><span className="text-muted-foreground">{t(`type.${c.type}`)}</span></td>
                <td className="px-4 py-2.5 text-muted-foreground">{c.city || "—"}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{c.phone || "—"}</td>
                <td className="px-4 py-2.5"><Badge className={st.color}>{t(`customerStatus.${st.key}`)}</Badge></td>
                <td className={`px-4 py-2.5 font-semibold ${c.outstanding > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                  {formatMoney(c.outstanding)}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{c.lastInvoiceDate || "—"}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1">
                    <Link to={`/invoices/new?customer=${c.id}`} title={t("action.newInvoice")}>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-primary"><FileText className="h-4 w-4" /></Button>
                    </Link>
                    <Link to={`/payments/new?customer=${c.id}`} title={t("action.recordPayment")}>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600"><Wallet className="h-4 w-4" /></Button>
                    </Link>
                    <Link to={`/customers/${c.id}`} className="text-primary text-xs font-medium hover:underline ms-1">{t("action.view")}</Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </Table>
      )}

      <CustomerFormDialog open={newOpen} onOpenChange={setNewOpen} onSaved={load} />
    </div>
  );
}