import React, { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { db } from "@/api/entities";
import { useI18n } from "@/lib/i18n";
import FieldLabel from "@/components/FieldLabel";

const TYPE_VALUES = ["shop", "pharmacy", "supermarket", "restaurant", "other"];

export default function CustomerFormDialog({ open, onOpenChange, onSaved, customer = null }) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    name: "", type: "shop", contact_person: "", phone: "", email: "", city: "", notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (customer) {
      setForm({
        name: customer.name || "", type: customer.type || "shop",
        contact_person: customer.contact_person || "", phone: customer.phone || "",
        email: customer.email || "", city: customer.city || "", notes: customer.notes || "",
      });
    } else {
      setForm({ name: "", type: "shop", contact_person: "", phone: "", email: "", city: "", notes: "" });
    }
  }, [customer, open]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (customer?.id) {
        await db.entities.Customer.update(customer.id, form);
      } else {
        await db.entities.Customer.create(form);
      }
      onSaved?.();
      onOpenChange?.(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{customer ? t("customerForm.editTitle") : t("customerForm.newTitle")}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="col-span-2">
            <FieldLabel k="customerForm.name" required />
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <FieldLabel k="customerForm.type" />
            <Select value={form.type} onValueChange={(v) => set("type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPE_VALUES.map((v) => <SelectItem key={v} value={v}>{t(`type.${v}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <FieldLabel k="customerForm.city" />
            <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
          </div>
          <div>
            <FieldLabel k="customerForm.contactPerson" />
            <Input value={form.contact_person} onChange={(e) => set("contact_person", e.target.value)} />
          </div>
          <div>
            <FieldLabel k="customerForm.phone" />
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+961..." />
          </div>
          <div className="col-span-2">
            <FieldLabel k="customerForm.email" />
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="col-span-2">
            <FieldLabel k="customerForm.notes" />
            <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange?.(false)}>{t("action.cancel")}</Button>
          <Button onClick={save} disabled={saving || !form.name.trim()}>{saving ? t("customerForm.saving") : t("action.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}