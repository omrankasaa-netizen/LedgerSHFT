import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { PageHeader, Loading } from "@/components/ui/common";
import BackendGate from "@/components/BackendGate";
import FieldLabel from "@/components/FieldLabel";
import {
  createPurchaseInvoice,
  getPurchaseInvoice,
  parsePurchaseInvoiceUpload,
  previewLandedCost,
  updatePurchaseInvoice,
} from "@/api/purchaseInvoices";
import { formatMoney } from "@/lib/finance";
import { ArrowLeft, Plus, Trash2, Save, Calculator, Upload, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";

const CURRENCIES = ["USD", "LBP", "CNY", "EUR"];
const emptyLine = () => ({ productCode: "", productName: "", quantityImported: 1, unitPurchasePrice: 0 });
const num = (v) => Number(v) || 0;

function PurchaseInvoiceFormInner() {
  const { t } = useI18n();
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [calculated, setCalculated] = useState(null); // preview result summary
  const [parsed, setParsed] = useState(null); // AI-parsed candidate under review

  const [header, setHeader] = useState({
    supplierName: "", supplierInvoiceNumber: "", originCountry: "",
    date: new Date().toISOString().slice(0, 10), currency: "USD", notes: "",
  });
  const [lines, setLines] = useState([emptyLine()]);
  const [extras, setExtras] = useState({ freightAmount: 0, dutyAmount: 0, customsFeesAmount: 0, otherFeesAmount: 0 });
  const [method, setMethod] = useState("value");

  useEffect(() => {
    if (!id) return;
    (async () => {
      const inv = await getPurchaseInvoice(id);
      setHeader({
        supplierName: inv.supplierName || "",
        supplierInvoiceNumber: inv.supplierInvoiceNumber || "",
        originCountry: inv.originCountry || "",
        date: String(inv.date).slice(0, 10),
        currency: inv.currency || "USD",
        notes: inv.notes || "",
      });
      setLines(inv.lineItems.map((l) => ({
        productCode: l.productCode || "",
        productName: l.productName,
        quantityImported: l.quantityImported,
        unitPurchasePrice: l.unitPurchasePrice,
        allocatedUnitLandedCost: l.allocatedUnitLandedCost,
      })));
      setExtras({
        freightAmount: inv.freightAmount || 0,
        dutyAmount: inv.dutyAmount || 0,
        customsFeesAmount: inv.customsFeesAmount || 0,
        otherFeesAmount: inv.otherFeesAmount || 0,
      });
      setCalculated({
        productsSubtotalAmount: inv.productsSubtotalAmount,
        totalExtraCosts: (inv.freightAmount || 0) + (inv.dutyAmount || 0) + (inv.customsFeesAmount || 0) + (inv.otherFeesAmount || 0),
        totalLandedCostAmount: inv.totalLandedCostAmount,
      });
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="p-6"><Loading /></div>;

  const setH = (k, v) => { setHeader((h) => ({ ...h, [k]: v })); };
  const setE = (k, v) => { setExtras((e) => ({ ...e, [k]: v })); setCalculated(null); };
  const setLine = (idx, k, v) => {
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, [k]: v } : l)));
    setCalculated(null); // inputs changed → stale allocation
  };
  const addLine = () => setLines((ls) => [...ls, emptyLine()]);
  const removeLine = (idx) => setLines((ls) => ls.filter((_, i) => i !== idx));

  const subtotal = lines.reduce((s, l) => s + num(l.quantityImported) * num(l.unitPurchasePrice), 0);
  const extrasTotal = num(extras.freightAmount) + num(extras.dutyAmount) + num(extras.customsFeesAmount) + num(extras.otherFeesAmount);

  // "Calculate landed cost": ask the backend to allocate extras over the lines.
  const calculate = async () => {
    const validLines = lines.filter((l) => l.productName.trim());
    if (validLines.length === 0) { toast({ title: t("purchaseForm.err.productName"), variant: "destructive" }); return; }
    setCalculating(true);
    try {
      const result = await previewLandedCost({
        lineItems: validLines.map((l) => ({
          productCode: l.productCode || null,
          productName: l.productName,
          quantityImported: num(l.quantityImported),
          unitPurchasePrice: num(l.unitPurchasePrice),
        })),
        ...extras,
        method,
      });
      // Merge allocated unit costs back onto the visible rows.
      setLines((ls) => {
        let i = 0;
        return ls.map((l) => {
          if (!l.productName.trim()) return l;
          const alloc = result.lines[i++];
          return { ...l, allocatedUnitLandedCost: alloc.allocatedUnitLandedCost };
        });
      });
      setCalculated(result);
    } catch (e) {
      toast({ title: t("purchaseForm.err.calculate"), description: String(e?.message || e), variant: "destructive" });
    } finally {
      setCalculating(false);
    }
  };

  // "Upload supplier invoice (beta)": parse via the backend, then review.
  const onUploadFile = async (file) => {
    if (!file) return;
    setParsing(true);
    try {
      const result = await parsePurchaseInvoiceUpload(file);
      setParsed({
        ...result,
        lineItems: result.lineItems.map((l) => ({ ...l })),
      });
    } catch (e) {
      toast({ title: t("purchaseForm.err.parse"), description: String(e?.message || e), variant: "destructive" });
    } finally {
      setParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const setParsedLine = (idx, k, v) =>
    setParsed((p) => ({ ...p, lineItems: p.lineItems.map((l, i) => (i === idx ? { ...l, [k]: v } : l)) }));

  // Copy reviewed parse results into the form for final editing + saving.
  const applyParsed = () => {
    if (!parsed) return;
    setHeader((h) => ({
      ...h,
      supplierName: parsed.supplierName || h.supplierName,
      supplierInvoiceNumber: parsed.supplierInvoiceNumber || h.supplierInvoiceNumber,
      originCountry: parsed.originCountry || h.originCountry,
      date: parsed.date || h.date,
      currency: parsed.currency || h.currency,
    }));
    setExtras((e) => ({
      freightAmount: parsed.freightAmount ?? e.freightAmount,
      dutyAmount: parsed.dutyAmount ?? e.dutyAmount,
      customsFeesAmount: parsed.customsFeesAmount ?? e.customsFeesAmount,
      otherFeesAmount: parsed.otherFeesAmount ?? e.otherFeesAmount,
    }));
    setLines(parsed.lineItems.map((l) => ({
      productCode: l.productCode || "",
      productName: l.productName || "",
      quantityImported: num(l.quantityImported) || 1,
      unitPurchasePrice: num(l.unitPurchasePrice),
    })));
    setCalculated(null);
    setParsed(null);
  };

  const save = async () => {
    if (!header.supplierName.trim()) { toast({ title: t("purchaseForm.err.supplier"), variant: "destructive" }); return; }
    const validLines = lines.filter((l) => l.productName.trim());
    if (validLines.length === 0) { toast({ title: t("purchaseForm.err.productName"), variant: "destructive" }); return; }
    setSaving(true);
    try {
      const payload = {
        ...header,
        supplierInvoiceNumber: header.supplierInvoiceNumber || null,
        originCountry: header.originCountry || null,
        notes: header.notes || null,
        ...extras,
        lineItems: validLines.map((l) => ({
          productCode: l.productCode || null,
          productName: l.productName,
          quantityImported: num(l.quantityImported),
          unitPurchasePrice: num(l.unitPurchasePrice),
        })),
      };
      if (id) await updatePurchaseInvoice(id, payload);
      else await createPurchaseInvoice(payload);
      toast({ title: id ? t("purchaseForm.saved.update") : t("purchaseForm.saved.create") });
      navigate("/imports/purchase-invoices");
    } catch (e) {
      toast({ title: t("purchaseForm.err.save"), description: String(e?.message || e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link to="/imports/purchase-invoices" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-3">
        <ArrowLeft className="h-4 w-4 me-1 rtl:rotate-180" /> {t("purchaseForm.back")}
      </Link>
      <PageHeader
        title={id ? t("purchaseForm.editTitle") : t("purchaseForm.newTitle")}
        subtitle={t("purchaseForm.subtitle")}
        actions={
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => onUploadFile(e.target.files?.[0])}
            />
            <Button size="sm" variant="outline" disabled={parsing} onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 ms-1" /> {parsing ? t("purchaseForm.parsing") : t("purchaseForm.upload")}
            </Button>
          </>
        }
      />

      {/* AI parse review: edit parsed rows before applying them to the form */}
      {parsed && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading font-semibold text-sm">{t("purchaseForm.parsedTitle")}</h2>
            <div className="flex gap-2">
              <Button size="sm" onClick={applyParsed}><Check className="h-4 w-4 ms-1" /> {t("purchaseForm.parsedApply")}</Button>
              <Button size="sm" variant="ghost" onClick={() => setParsed(null)}><X className="h-4 w-4 ms-1" /> {t("purchaseForm.parsedDiscard")}</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-start font-medium text-muted-foreground w-32">{t("purchaseForm.col.code")}</th>
                  <th className="px-3 py-2 text-start font-medium text-muted-foreground">{t("purchaseForm.col.product")}</th>
                  <th className="px-3 py-2 text-start font-medium text-muted-foreground w-24">{t("purchaseForm.col.qty")}</th>
                  <th className="px-3 py-2 text-start font-medium text-muted-foreground w-28">{t("purchaseForm.col.unitPrice")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {parsed.lineItems.map((l, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2"><Input value={l.productCode || ""} onChange={(e) => setParsedLine(idx, "productCode", e.target.value)} /></td>
                    <td className="px-3 py-2"><Input value={l.productName} onChange={(e) => setParsedLine(idx, "productName", e.target.value)} /></td>
                    <td className="px-3 py-2"><Input type="number" value={l.quantityImported} onChange={(e) => setParsedLine(idx, "quantityImported", Number(e.target.value))} /></td>
                    <td className="px-3 py-2"><Input type="number" value={l.unitPurchasePrice} onChange={(e) => setParsedLine(idx, "unitPurchasePrice", Number(e.target.value))} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Step 1: header */}
      <div className="rounded-lg border border-border bg-card p-4 mb-4">
        <h2 className="font-heading font-semibold mb-3 text-sm">{t("purchaseForm.step1")}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <FieldLabel k="purchaseForm.supplier" required />
            <Input value={header.supplierName} onChange={(e) => setH("supplierName", e.target.value)} />
          </div>
          <div>
            <FieldLabel k="purchaseForm.supplierInvoiceNumber" />
            <Input value={header.supplierInvoiceNumber} onChange={(e) => setH("supplierInvoiceNumber", e.target.value)} placeholder="SUP-1042" />
          </div>
          <div>
            <FieldLabel k="purchaseForm.date" required />
            <Input type="date" value={header.date} onChange={(e) => setH("date", e.target.value)} />
          </div>
          <div>
            <FieldLabel k="purchaseForm.currency" />
            <Select value={header.currency} onValueChange={(v) => setH("currency", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <FieldLabel k="purchaseForm.originCountry" />
            <Input value={header.originCountry} onChange={(e) => setH("originCountry", e.target.value)} placeholder="CN" />
          </div>
          <div>
            <FieldLabel k="purchaseForm.notes" />
            <Textarea rows={1} value={header.notes} onChange={(e) => setH("notes", e.target.value)} />
          </div>
        </div>
      </div>

      {/* Step 2: line items */}
      <div className="rounded-lg border border-border bg-card p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading font-semibold text-sm">{t("purchaseForm.step2")}</h2>
          <Button size="sm" variant="outline" onClick={addLine}><Plus className="h-4 w-4 ms-1" /> {t("purchaseForm.addLine")}</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-start font-medium text-muted-foreground w-32">{t("purchaseForm.col.code")}</th>
                <th className="px-3 py-2 text-start font-medium text-muted-foreground">{t("purchaseForm.col.product")}</th>
                <th className="px-3 py-2 text-start font-medium text-muted-foreground w-24">{t("purchaseForm.col.qty")}</th>
                <th className="px-3 py-2 text-start font-medium text-muted-foreground w-28">{t("purchaseForm.col.unitPrice")}</th>
                <th className="px-3 py-2 text-start font-medium text-muted-foreground w-28">{t("purchaseForm.col.lineTotal")}</th>
                <th className="px-3 py-2 text-start font-medium text-muted-foreground w-32">{t("purchaseForm.col.landedUnit")}</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lines.map((l, idx) => (
                <tr key={idx}>
                  <td className="px-3 py-2"><Input value={l.productCode} onChange={(e) => setLine(idx, "productCode", e.target.value)} placeholder="SKU" /></td>
                  <td className="px-3 py-2"><Input value={l.productName} onChange={(e) => setLine(idx, "productName", e.target.value)} /></td>
                  <td className="px-3 py-2"><Input type="number" value={l.quantityImported} onChange={(e) => setLine(idx, "quantityImported", Number(e.target.value))} /></td>
                  <td className="px-3 py-2"><Input type="number" value={l.unitPurchasePrice} onChange={(e) => setLine(idx, "unitPurchasePrice", Number(e.target.value))} /></td>
                  <td className="px-3 py-2 font-medium">{formatMoney(num(l.quantityImported) * num(l.unitPurchasePrice), header.currency)}</td>
                  <td className="px-3 py-2 font-medium text-emerald-700">
                    {l.allocatedUnitLandedCost != null ? formatMoney(l.allocatedUnitLandedCost, header.currency) : "—"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => removeLine(idx)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Step 3: extra costs + landed cost calculation */}
      <div className="rounded-lg border border-border bg-card p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading font-semibold text-sm">{t("purchaseForm.step3")}</h2>
          <Button size="sm" onClick={calculate} disabled={calculating}>
            <Calculator className="h-4 w-4 ms-1" /> {calculating ? t("purchaseForm.calculating") : t("purchaseForm.calculate")}
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div><FieldLabel k="purchaseForm.freight" /><Input type="number" value={extras.freightAmount} onChange={(e) => setE("freightAmount", Number(e.target.value))} /></div>
            <div><FieldLabel k="purchaseForm.duty" /><Input type="number" value={extras.dutyAmount} onChange={(e) => setE("dutyAmount", Number(e.target.value))} /></div>
            <div><FieldLabel k="purchaseForm.customs" /><Input type="number" value={extras.customsFeesAmount} onChange={(e) => setE("customsFeesAmount", Number(e.target.value))} /></div>
            <div><FieldLabel k="purchaseForm.other" /><Input type="number" value={extras.otherFeesAmount} onChange={(e) => setE("otherFeesAmount", Number(e.target.value))} /></div>
            <div className="col-span-2">
              <FieldLabel k="purchaseForm.allocationMethod" />
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="value">{t("purchaseForm.method.value")}</SelectItem>
                  <SelectItem value="quantity">{t("purchaseForm.method.quantity")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="rounded-md bg-muted/40 p-4 space-y-2">
            <SummaryRow label={t("purchaseForm.summary.subtotal")} value={formatMoney(subtotal, header.currency)} />
            <SummaryRow label={t("purchaseForm.summary.extras")} value={`+ ${formatMoney(extrasTotal, header.currency)}`} />
            <div className="border-t border-border pt-2">
              <SummaryRow
                label={t("purchaseForm.summary.totalLanded")}
                value={formatMoney(calculated ? calculated.totalLandedCostAmount : subtotal + extrasTotal, header.currency)}
                bold
                accent="emerald"
              />
            </div>
            {!calculated && <div className="text-xs text-muted-foreground">{t("purchaseForm.calculateHint")}</div>}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={saving}>
          <Save className="h-4 w-4 ms-1" /> {saving ? t("purchaseForm.saving") : t("purchaseForm.save")}
        </Button>
        <Link to="/imports/purchase-invoices"><Button variant="ghost">{t("purchaseForm.cancel")}</Button></Link>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, bold, accent }) {
  const color = accent === "emerald" ? "text-emerald-600" : "";
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${bold ? "font-heading text-lg font-bold" : "font-medium"} ${color}`}>{value}</span>
    </div>
  );
}

export default function PurchaseInvoiceForm() {
  return (
    <BackendGate>
      <PurchaseInvoiceFormInner />
    </BackendGate>
  );
}
