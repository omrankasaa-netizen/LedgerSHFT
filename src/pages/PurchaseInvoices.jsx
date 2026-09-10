import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader, Table, Loading, EmptyState } from "@/components/ui/common";
import BackendGate from "@/components/BackendGate";
import { listPurchaseInvoices } from "@/api/purchaseInvoices";
import { formatMoney } from "@/lib/finance";
import { Plus, Search, Ship } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";

function PurchaseInvoicesInner() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setInvoices(await listPurchaseInvoices());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="p-6"><Loading /></div>;

  const rows = invoices
    .filter((i) => {
      if (!search) return true;
      const haystack = `${i.supplierName} ${i.supplierInvoiceNumber || ""}`.toLowerCase();
      return haystack.includes(search.toLowerCase());
    })
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        titleKey="purchases.title"
        subtitle={t("purchases.subtitle")}
        actions={
          <Link to="/imports/purchase-invoices/new">
            <Button size="sm"><Plus className="h-4 w-4 ms-1" /> {t("purchases.new")}</Button>
          </Link>
        }
      />

      <div className="relative mb-4 max-w-md">
        <Search className="absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground start-3" />
        <Input
          placeholder={t("purchases.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ps-9"
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Ship}
          title={t("purchases.empty.title")}
          subtitle={t("purchases.empty.subtitle")}
          action={
            <Link to="/imports/purchase-invoices/new">
              <Button size="sm"><Plus className="h-4 w-4 ms-1" /> {t("purchases.new")}</Button>
            </Link>
          }
        />
      ) : (
        <Table
          headers={[
            t("purchases.col.supplier"),
            t("purchases.col.invoiceNumber"),
            t("purchases.col.date"),
            t("purchases.col.currency"),
            t("purchases.col.items"),
            t("purchases.col.totalLanded"),
            "",
          ]}
        >
          {rows.map((i) => (
            <tr key={i.id} className="hover:bg-muted/40">
              <td className="px-4 py-2.5">
                <Link to={`/imports/purchase-invoices/${i.id}/edit`} className="text-primary font-medium hover:underline">
                  {i.supplierName}
                </Link>
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">{i.supplierInvoiceNumber || "—"}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{String(i.date).slice(0, 10)}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{i.currency}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{i.lineItems?.length ?? 0}</td>
              <td className="px-4 py-2.5 font-medium">{formatMoney(i.totalLandedCostAmount, i.currency)}</td>
              <td className="px-4 py-2.5 text-end">
                <Link to={`/imports/purchase-invoices/${i.id}/edit`} className="text-primary text-xs font-medium hover:underline">
                  {t("action.view")}
                </Link>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

export default function PurchaseInvoices() {
  return (
    <BackendGate>
      <PurchaseInvoicesInner />
    </BackendGate>
  );
}
