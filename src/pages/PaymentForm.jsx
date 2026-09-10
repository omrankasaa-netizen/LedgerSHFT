import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { PageHeader, Loading } from "@/components/ui/common";
import { formatMoney, invoiceOutstanding } from "@/lib/finance";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";
import FieldLabel from "@/components/FieldLabel";

const METHOD_VALUES = ["cash", "bank_transfer", "cheque", "remittance", "other"];

export default function PaymentForm() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);

  const [form, setForm] = useState({
    customer_id: params.get("customer") || "",
    invoice_id: params.get("invoice") || "",
    date: new Date().toISOString().slice(0, 10),
    currency: "USD", amount: 0, method: "cash", reference: "", notes: "",
  });

  useEffect(() => {
    (async () => {
      const [custs, inv, pays] = await Promise.all([
        base44.entities.Customer.list(),
        base44.entities.Invoice.list(),
        base44.entities.Payment.list(),
      ]);
      setCustomers(custs);
      setInvoices(inv);
      setPayments(pays);
      if (params.get("invoice")) {
        const inv0 = inv.find((i) => i.id === params.get("invoice"));
        if (inv0) setForm((f) => ({ ...f, currency: inv0.currency, amount: invoiceOutstanding(inv0, pays) }));
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="p-6"><Loading /></div>;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const customerInvoices = invoices.filter((i) => i.customer_id === form.customer_id);
  const selectedInvoice = invoices.find((i) => i.id === form.invoice_id);

  const onCustomerChange = (v) => setForm((f) => ({ ...f, customer_id: v, invoice_id: "" }));
  const onInvoiceChange = (v) => {
    const inv = invoices.find((i) => i.id === v);
    setForm((f) => ({
      ...f, invoice_id: v, currency: inv?.currency || f.currency,
      amount: inv ? invoiceOutstanding(inv, payments) : f.amount,
    }));
  };

  const save = async () => {
    if (!form.customer_id) { toast({ title: t("paymentForm.err.customer"), variant: "destructive" }); return; }
    if (!form.amount || Number(form.amount) <= 0) { toast({ title: t("paymentForm.err.amount"), variant: "destructive" }); return; }
    setSaving(true);
    try {
      const data = { ...form, invoice_id: form.invoice_id || null, amount: Number(form.amount) };
      await base44.entities.Payment.create(data);
      if (form.invoice_id) {
        const inv = invoices.find((i) => i.id === form.invoice_id);
        const newPaid = payments.filter((p) => p.invoice_id === form.invoice_id).reduce((s, p) => s + (Number(p.amount) || 0), 0) + Number(form.amount);
        if (inv) {
          let status = inv.status;
          if (newPaid >= (Number(inv.total_amount) || 0)) status = "Paid";
          else if (newPaid > 0) status = "Partially Paid";
          if (status !== inv.status) await base44.entities.Invoice.update(form.invoice_id, { status });
        }
      }
      toast({ title: t("paymentForm.saved") });
      navigate("/payments");
    } catch (e) {
      toast({ title: t("paymentForm.err.save") || "Error", description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Link to="/payments" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-3">
        <ArrowLeft className="h-4 w-4 me-1 rtl:rotate-180" /> {t("paymentForm.back")}
      </Link>
      <PageHeader title={t("paymentForm.title")} subtitle={t("paymentForm.subtitle")} />

      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div>
          <FieldLabel k="paymentForm.customer" required />
          <Select value={form.customer_id} onValueChange={onCustomerChange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <FieldLabel k="paymentForm.invoice" />
          <Select value={form.invoice_id || "none"} onValueChange={(v) => onInvoiceChange(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("paymentForm.invoiceNone")}</SelectItem>
              {customerInvoices.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.invoice_number || i.id.slice(0, 8)} — {formatMoney(i.total_amount, i.currency)} ({t(`status.${i.status}`)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><FieldLabel k="paymentForm.date" required /><Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} /></div>
          <div>
            <FieldLabel k="paymentForm.currency" />
            <Select value={form.currency} onValueChange={(v) => set("currency", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="LBP">LBP</SelectItem></SelectContent>
            </Select>
          </div>
          <div><FieldLabel k="paymentForm.amount" required /><Input type="number" value={form.amount} onChange={(e) => set("amount", Number(e.target.value))} /></div>
          <div>
            <FieldLabel k="paymentForm.method" />
            <Select value={form.method} onValueChange={(v) => set("method", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {METHOD_VALUES.map((m) => <SelectItem key={m} value={m}>{t(`method.${m}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><FieldLabel k="paymentForm.reference" /><Input value={form.reference} onChange={(e) => set("reference", e.target.value)} /></div>
          <div className="col-span-2"><FieldLabel k="paymentForm.notes" /><Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></div>
        </div>
        {selectedInvoice && (
          <div className="text-xs text-muted-foreground bg-muted/40 rounded-md p-2">
            {t("paymentForm.outstanding")}: {formatMoney(invoiceOutstanding(selectedInvoice, payments), selectedInvoice.currency)}
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-4">
        <Button onClick={save} disabled={saving}><Save className="h-4 w-4 ms-1" /> {saving ? t("paymentForm.saving") : t("paymentForm.save")}</Button>
        <Link to="/payments"><Button variant="ghost">{t("paymentForm.cancel")}</Button></Link>
      </div>
    </div>
  );
}