import React, { useEffect, useState } from "react";
import { searchImportLineItems } from "@/api/purchaseInvoices";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { formatMoney, formatNumber } from "@/lib/finance";
import { Search, PackageOpen } from "lucide-react";

/**
 * Dialog that lets the user pick an imported line item (from a purchase
 * invoice) to auto-fill a sales invoice line's product + landed unit cost.
 */
export default function PickFromImportsDialog({ open, onClose, onPick }) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const timer = setTimeout(() => {
      searchImportLineItems(search)
        .then(setItems)
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    }, 250); // debounce keystrokes
    return () => clearTimeout(timer);
  }, [search, open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("pickFromImports.title")}</DialogTitle>
        </DialogHeader>
        <div className="relative mb-3">
          <Search className="absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground start-3" />
          <Input
            autoFocus
            className="ps-9"
            placeholder={t("pickFromImports.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="max-h-80 overflow-y-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-start font-medium text-muted-foreground">{t("pickFromImports.col.code")}</th>
                <th className="px-3 py-2 text-start font-medium text-muted-foreground">{t("pickFromImports.col.product")}</th>
                <th className="px-3 py-2 text-start font-medium text-muted-foreground">{t("pickFromImports.col.supplier")}</th>
                <th className="px-3 py-2 text-start font-medium text-muted-foreground">{t("pickFromImports.col.qty")}</th>
                <th className="px-3 py-2 text-start font-medium text-muted-foreground">{t("pickFromImports.col.landedUnit")}</th>
                <th className="px-3 py-2 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-muted/40">
                  <td className="px-3 py-2 text-muted-foreground">{item.productCode || "—"}</td>
                  <td className="px-3 py-2">{item.productName}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {item.purchaseInvoice?.supplierName || "—"}
                    {item.purchaseInvoice?.supplierInvoiceNumber ? ` · ${item.purchaseInvoice.supplierInvoiceNumber}` : ""}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{formatNumber(item.quantityImported)}</td>
                  <td className="px-3 py-2 font-medium">
                    {formatMoney(item.allocatedUnitLandedCost ?? item.unitPurchasePrice, item.purchaseInvoice?.currency)}
                  </td>
                  <td className="px-3 py-2 text-end">
                    <Button size="sm" variant="outline" onClick={() => onPick(item)}>
                      {t("pickFromImports.use")}
                    </Button>
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    <PackageOpen className="h-6 w-6 mx-auto mb-2 text-muted-foreground/40" />
                    {t("pickFromImports.empty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
