import React, { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { useI18n } from "@/lib/i18n";
import FieldLabel from "@/components/FieldLabel";

const ROLE_VALUES = ["investor", "co-owner", "supplier", "other"];
const SHARE_TYPE_VALUES = ["none", "percentage", "fixed_amount"];

export default function PartnerFormDialog({ open, onOpenChange, onSaved, partner = null }) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    name: "", role: "investor", contact: "", phone: "", email: "",
    default_share_type: "none", default_share_value: 0,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (partner) {
      setForm({
        name: partner.name || "", role: partner.role || "investor",
        contact: partner.contact || "", phone: partner.phone || "", email: partner.email || "",
        default_share_type: partner.default_share_type || "none",
        default_share_value: partner.default_share_value || 0,
      });
    } else {
      setForm({ name: "", role: "investor", contact: "", phone: "", email: "", default_share_type: "none", default_share_value: 0 });
    }
  }, [partner, open]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (partner?.id) {
        await base44.entities.Partner.update(partner.id, form);
      } else {
        await base44.entities.Partner.create(form);
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
          <DialogTitle>{partner ? t("partnerForm.editTitle") : t("partnerForm.newTitle")}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="col-span-2">
            <FieldLabel k="partnerForm.name" required />
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <FieldLabel k="partnerForm.role" />
            <Select value={form.role} onValueChange={(v) => set("role", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLE_VALUES.map((v) => <SelectItem key={v} value={v}>{t(`role.${v}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <FieldLabel k="partnerForm.contact" />
            <Input value={form.contact} onChange={(e) => set("contact", e.target.value)} />
          </div>
          <div>
            <FieldLabel k="partnerForm.phone" />
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div>
            <FieldLabel k="partnerForm.email" />
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div>
            <FieldLabel k="partnerForm.defaultShareType" />
            <Select value={form.default_share_type} onValueChange={(v) => set("default_share_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SHARE_TYPE_VALUES.map((v) => <SelectItem key={v} value={v}>{t(`shareType.${v}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <FieldLabel k="partnerForm.defaultShareValue" />
            <Input
              type="number"
              value={form.default_share_value}
              onChange={(e) => set("default_share_value", Number(e.target.value))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange?.(false)}>{t("action.cancel")}</Button>
          <Button onClick={save} disabled={saving || !form.name.trim()}>{saving ? t("partnerForm.saving") : t("action.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}