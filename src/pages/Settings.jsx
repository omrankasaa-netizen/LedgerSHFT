import React, { useEffect, useState } from "react";
import { db } from "@/api/entities";
import { useAuth } from "@/lib/AuthContext";
import { PageHeader, Table, Loading, Badge } from "@/components/ui/common";
import { UserPlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";
import FieldLabel from "@/components/FieldLabel";

const ROLES = ["viewer", "accountant", "manager", "admin"];

export default function Settings() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { user: me } = useAuth();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [company, setCompany] = useState({ name: "", base_currency: "USD", usd_lbp_rate: 89500 });
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "viewer" });
  const [saving, setSaving] = useState(false);

  const loadUsers = async () => {
    try {
      setUsers(await db.users.list());
    } catch {
      // non-managers can't list users — the card just stays empty
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  // Self-hosted replacement for email invites: create the account directly.
  const addUser = async () => {
    if (!form.name.trim() || !form.email.trim() || form.password.length < 8) return;
    setSaving(true);
    try {
      await db.users.create({
        name: form.name.trim(), email: form.email.trim(),
        password: form.password, role: form.role,
      });
      toast({ title: t("toast.userAdded"), description: form.email.trim() });
      setForm({ name: "", email: "", password: "", role: "viewer" });
      await loadUsers();
    } catch (e) {
      toast({ title: t("toast.userFail"), description: String(e?.message || e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const removeUser = async (u) => {
    try {
      await db.users.remove(u.id);
      toast({ title: t("toast.userDeleted"), description: u.email });
      await loadUsers();
    } catch (e) {
      toast({ title: t("toast.userFail"), description: String(e?.message || e), variant: "destructive" });
    }
  };

  if (loading) return <div className="p-6"><Loading /></div>;

  const roleLabel = (r) => t(`userRole.${r || "viewer"}`);
  const canSubmit = form.name.trim() && form.email.trim() && form.password.length >= 8;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader titleKey="settings.title" subtitle={t("settings.subtitle")} />

      <div className="rounded-lg border border-border bg-card p-4 mb-6">
        <h2 className="font-heading font-semibold mb-3 text-sm">{t("settings.companyProfile")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><FieldLabel k="settings.companyName" /><Input value={company.name} onChange={(e) => setCompany((c) => ({ ...c, name: e.target.value }))} /></div>
          <div>
            <FieldLabel k="settings.baseCurrency" />
            <Select value={company.base_currency} onValueChange={(v) => setCompany((c) => ({ ...c, base_currency: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="LBP">LBP</SelectItem></SelectContent>
            </Select>
          </div>
          <div><FieldLabel k="settings.usdLbpRate" /><Input type="number" value={company.usd_lbp_rate} onChange={(e) => setCompany((c) => ({ ...c, usd_lbp_rate: Number(e.target.value) }))} /></div>
        </div>
        <div className="mt-3">
          <Button size="sm" onClick={() => toast({ title: t("toast.profileSaved") })}>{t("settings.saveProfile")}</Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="font-heading font-semibold mb-3 text-sm">{t("settings.userMgmt")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 mb-4">
          <Input placeholder={t("settings.col.name")} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Input type="email" placeholder={t("settings.inviteEmail")} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <Input type="password" placeholder={t("settings.password")} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
          <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={addUser} disabled={saving || !canSubmit}>
            <UserPlus className="h-4 w-4 ms-1" /> {saving ? t("settings.inviting") : t("settings.addUser")}
          </Button>
        </div>

        {users.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">{t("settings.noUsers")}</p>
        ) : (
          <Table headers={[t("settings.col.name"), t("settings.col.email"), t("settings.col.role"), ""]}>
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-muted/40">
                <td className="px-4 py-2.5 font-medium">{u.full_name || "—"}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-2.5"><Badge className="border-border">{roleLabel(u.role)}</Badge></td>
                <td className="px-4 py-2.5 text-end">
                  {me?.id !== u.id && (
                    <button onClick={() => removeUser(u)} className="text-muted-foreground hover:text-destructive" title={t("action.delete")}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>
    </div>
  );
}
