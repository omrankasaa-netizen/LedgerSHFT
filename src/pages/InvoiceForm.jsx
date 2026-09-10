import React, { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { PageHeader, Loading } from "@/components/ui/common";
import { computeInvoiceTotals, formatMoney } from "@/lib/finance";
import { ArrowLeft, Plus, Trash2, Save, CheckCircle2, PackageSearch } from "lucide-react";
import PickFromImportsDialog from "@/components/PickFromImportsDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";
import FieldLabel from "@/components/FieldLabel";

const STATUSES = ["Draft", "Issued", "Partially Paid", "Paid", "Overdue"];

export default function InvoiceForm() {
  const { t } = useI18n();
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [partners, setPartners] = useState([]);
  const [existingLines, setExistingLines] = useState([]);
  // Index of the line row the import picker is targeting (null = closed).
  const [pickerIndex, setPickerIndex] = useState(null);

  const [header, setHeader] = useState({
    invoice_number: "", customer_id: "", partner_id: "",
    date: new Date().toISOString().slice(0, 10), currency: "USD",
    discount_amount: 0, tax_amount: 0, total_cost_amount: 0, status: "Draft", notes: "",
  });
  const [lines, setLines] = useState([
    { product_name: "", product_code: "", quantity: 1, unit_price: 0, unit_cost: 0 },
  ]);

  useEffect(() => {
    (async () => {
      const [custs, prts] = await Promise.all([
        base44.entities.Customer.list(),
        base44.entities.Partner.list(),
      ]);
      setCustomers(custs);
      setPartners(prts);
      if (id) {
        const inv = await base44.entities.Invoice.get(id);
        setHeader({
          invoice_number: inv.invoice_number || "", customer_id: inv.customer_id || "",
          partner_id: inv.partner_id || "", date: inv.date || new Date().toISOString().slice(0, 10),
          currency: inv.currency || "USD", discount_amount: inv.discount_amount || 0,
          tax_amount: inv.tax_amount || 0, total_cost_amount: inv.total_cost_amount || 0,
          status: inv.status || "Draft", notes: inv.notes || "",
        });
        const allLines = await base44.entities.InvoiceLineItem.list();
        setExistingLines(allLines.filter((l) => l.invoice_id === id));
        setLines(allLines.filter((l) => l.invoice_id === id).map((l) => ({
          id: l.id, product_name: l.product_name, product_code: l.product_code || "",
          quantity: l.quantity, unit_price: l.unit_price, unit_cost: l.unit_cost || 0,
          purchase_invoice_line_item_id: l.purchase_invoice_line_item_id || null,
        })));
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="p-6"><Loading /></div>;

  const setH = (k, v) => setHeader((h) => ({ ...h, [k]: v }));
  const setLine = (idx, k, v) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, [k]: v } : l)));
  const addLine = () => setLines((ls) => [...ls, { product_name: "", product_code: "", quantity: 1, unit_price: 0, unit_cost: 0 }]);
  const removeLine = (idx) => setLines((ls) => ls.filter((_, i) => i !== idx));

  // Fill a line from a picked import item: product info + landed unit cost.
  // unit_cost drives computeInvoiceTotals → total cost & gross profit below.
  const applyImportLine = (item) => {
    if (pickerIndex === null) return;
    setLines((ls) => ls.map((l, i) => (i === pickerIndex ? {
      ...l,
      product_name: l.product_name || item.productName,
      product_code: item.productCode || l.product_code,
      unit_cost: item.allocatedUnitLandedCost ?? item.unitPurchasePrice ?? 0,
      purchase_invoice_line_item_id: item.id,
    } : l)));
    setPickerIndex(null);
  };

  const partner = partners.find((p) => p.id === header.partner_id);
  const totals = computeInvoiceTotals(lines, header.discount_amount, header.tax_amount, header.total_cost_amount, partner);

  const save = async (markPaid = false) => {
    if (!header.customer_id) { toast({ title: t("invoiceForm.err.customer"), variant: "destructive" }); return; }
    if (lines.some((l) => !l.product_name.trim())) { toast({ title: t("invoiceForm.err.productName"), variant: "destructive" }); return; }
    setSaving(true);
    try {
      const invoiceData = {
        ...header, partner_id: header.partner_id || null,
        subtotal_amount: totals.subtotal, total_amount: totals.total,
        total_cost_amount: totals.costTotal, gross_profit_amount: totals.grossProfit,
        partner_share_amount: totals.partnerShare, status: markPaid ? "Paid" : header.status,
      };
      let savedId = id;
      if (id) { await base44.entities.Invoice.update(id, invoiceData); }
      else { const created = await base44.entities.Invoice.create(invoiceData); savedId = created.id; }
      const lineData = lines.map((l) => ({
        invoice_id: savedId, product_name: l.product_name, product_code: l.product_code || null,
        quantity: Number(l.quantity) || 0, unit_price: Number(l.unit_price) || 0,
        line_total: (Number(l.quantity) || 0) * (Number(l.unit_price) || 0),
        unit_cost: Number(l.unit_cost) || 0, line_cost_total: (Number(l.quantity) || 0) * (Number(l.unit_cost) || 0),
        purchase_invoice_line_item_id: l.purchase_invoice_line_item_id || null,
      }));
      if (id) { for (const ol of existingLines) { await base44.entities.InvoiceLineItem.delete(ol.id); } }
      await base44.entities.InvoiceLineItem.bulkCreate(lineData);
      if (markPaid) {
        await base44.entities.Payment.create({
          customer_id: header.customer_id, invoice_id: savedId,
          date: new Date().toISOString().slice(0, 10), currency: header.currency,
          amount: totals.total, method: "cash", reference: "Full payment on invoice",
        });
      }
      toast({ title: id ? t("invoiceForm.saved.update") : t("invoiceForm.saved.create") });
      navigate(`/invoices/${savedId}`);
    } catch (e) {
      toast({ title: t("invoiceForm.err.save"), description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link to="/invoices" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-3">
        <ArrowLeft className="h-4 w-4 me-1 rtl:rotate-180" /> {t("invoiceForm.back")}
      </Link>
      <PageHeader title={id ? t("invoiceForm.editTitle") : t("invoiceForm.newTitle")} subtitle={t("invoiceForm.subtitle")} />

      <div className="rounded-lg border border-border bg-card p-4 mb-4">
        <h2 className="font-heading font-semibold mb-3 text-sm">{t("invoiceForm.step1")}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <FieldLabel k="invoiceForm.customer" required />
            <Select value={header.customer_id} onValueChange={(v) => setH("customer_id", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <FieldLabel k="invoiceForm.partner" />
            <Select value={header.partner_id || "none"} onValueChange={(v) => setH("partner_id", v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("common.none")}</SelectItem>
                {partners.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <FieldLabel k="invoiceForm.date" required />
            <Input type="date" value={header.date} onChange={(e) => setH("date", e.target.value)} />
          </div>
          <div>
            <FieldLabel k="invoiceForm.currency" />
            <Select value={header.currency} onValueChange={(v) => setH("currency", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="LBP">LBP</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <FieldLabel k="invoiceForm.invoiceNumber" />
            <Input value={header.invoice_number} onChange={(e) => setH("invoice_number", e.target.value)} placeholder="INV-001" />
          </div>
          <div>
            <FieldLabel k="invoiceForm.status" />
            <Select value={header.status} onValueChange={(v) => setH("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{t(`status.${s}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading font-semibold text-sm">{t("invoiceForm.step2")}</h2>
          <Button size="sm" variant="outline" onClick={addLine}><Plus className="h-4 w-4 ms-1" /> {t("invoiceForm.addLine")}</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-start">
              <tr>
                <th className="px-3 py-2 font-medium text-muted-foreground text-start">{t("invoiceForm.productName")}</th>
                <th className="px-3 py-2 font-medium text-muted-foreground w-28 text-start">{t("invoiceForm.code")}</th>
                <th className="px-3 py-2 font-medium text-muted-foreground w-24 text-start">{t("invoiceForm.qty")}</th>
                <th className="px-3 py-2 font-medium text-muted-foreground w-28 text-start">{t("invoiceForm.unitPrice")}</th>
                <th className="px-3 py-2 font-medium text-muted-foreground w-28 text-start">{t("invoiceForm.unitCost")}</th>
                <th className="px-3 py-2 font-medium text-muted-foreground w-28 text-start">{t("invoiceForm.lineTotal")}</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lines.map((l, idx) => (
                <tr key={idx}>
                  <td className="px-3 py-2"><Input value={l.product_name} onChange={(e) => setLine(idx, "product_name", e.target.value)} /></td>
                  <td className="px-3 py-2"><Input value={l.product_code} onChange={(e) => setLine(idx, "product_code", e.target.value)} placeholder="SKU" /></td>
                  <td className="px-3 py-2"><Input type="number" value={l.quantity} onChange={(e) => setLine(idx, "quantity", Number(e.target.value))} /></td>
                  <td className="px-3 py-2"><Input type="number" value={l.unit_price} onChange={(e) => setLine(idx, "unit_price", Number(e.target.value))} /></td>
                  <td className="px-3 py-2"><Input type="number" value={l.unit_cost} onChange={(e) => setLine(idx, "unit_cost", Number(e.target.value))} /></td>
                  <td className="px-3 py-2 font-medium">{formatMoney((Number(l.quantity) || 0) * (Number(l.unit_price) || 0), header.currency)}</td>
                  <td className="px-3 py-2 text-center whitespace-nowrap">
                    <button
                      onClick={() => setPickerIndex(idx)}
                      title={t("pickFromImports.button")}
                      className="text-muted-foreground hover:text-primary me-2"
                    >
                      <PackageSearch className="h-4 w-4" />
                    </button>
                    <button onClick={() => removeLine(idx)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 mb-4">
        <h2 className="font-heading font-semibold mb-3 text-sm">{t("invoiceForm.step3")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div><FieldLabel k="invoiceForm.discount" /><Input type="number" value={header.discount_amount} onChange={(e) => setH("discount_amount", Number(e.target.value))} /></div>
            <div><FieldLabel k="invoiceForm.tax" /><Input type="number" value={header.tax_amount} onChange={(e) => setH("tax_amount", Number(e.target.value))} /></div>
            <div className="col-span-2"><FieldLabel k="invoiceForm.totalCostOverride" /><Input type="number" value={header.total_cost_amount} onChange={(e) => setH("total_cost_amount", Number(e.target.value))} /></div>
            <div className="col-span-2"><FieldLabel k="invoiceForm.notes" /><Textarea rows={2} value={header.notes} onChange={(e) => setH("notes", e.target.value)} /></div>
          </div>
          <div className="rounded-md bg-muted/40 p-4 space-y-2">
            <SummaryRow label={t("invoiceForm.summary.subtotal")} value={formatMoney(totals.subtotal, header.currency)} />
            <SummaryRow label={t("invoiceForm.summary.discount")} value={`- ${formatMoney(header.discount_amount, header.currency)}`} />
            <SummaryRow label={t("invoiceForm.summary.tax")} value={`+ ${formatMoney(header.tax_amount, header.currency)}`} />
            <div className="border-t border-border pt-2"><SummaryRow label={t("invoiceForm.summary.total")} value={formatMoney(totals.total, header.currency)} bold /></div>
            <SummaryRow label={t("invoiceForm.summary.totalCost")} value={formatMoney(totals.costTotal, header.currency)} />
            <SummaryRow label={t("invoiceForm.summary.grossProfit")} value={formatMoney(totals.grossProfit, header.currency)} accent="emerald" />
            {partner && <SummaryRow label={`${t("invoiceForm.summary.partnerShare")} (${partner.name})`} value={formatMoney(totals.partnerShare, header.currency)} accent="blue" />}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 mb-4">
        <div className="text-sm font-medium text-muted-foreground">{t("invoiceForm.aiTitle")}</div>
        <div className="text-xs text-muted-foreground mt-1">{t("invoiceForm.aiDesc")}</div>
      </div>

      <PickFromImportsDialog
        open={pickerIndex !== null}
        onClose={() => setPickerIndex(null)}
        onPick={applyImportLine}
      />

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => save(false)} disabled={saving}><Save className="h-4 w-4 ms-1" /> {saving ? t("invoiceForm.saving") : t("invoiceForm.save")}</Button>
        <Button variant="outline" onClick={() => save(true)} disabled={saving}><CheckCircle2 className="h-4 w-4 ms-1" /> {t("invoiceForm.saveMarkPaid")}</Button>
        <Link to="/invoices"><Button variant="ghost">{t("invoiceForm.cancel")}</Button></Link>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, bold, accent }) {
  const color = accent === "emerald" ? "text-emerald-600" : accent === "blue" ? "text-blue-600" : "";
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${bold ? "font-heading text-lg font-bold" : "font-medium"} ${color}`}>{value}</span>
    </div>
  );
}
