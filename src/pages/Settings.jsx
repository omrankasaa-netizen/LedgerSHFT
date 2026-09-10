import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { PageHeader, Table, Loading, Badge } from "@/components/ui/common";
import { UserPlus, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";
import FieldLabel from "@/components/FieldLabel";

export default function Settings() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [company, setCompany] = useState({ name: "", base_currency: "USD", usd_lbp_rate: 89500 });
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const u = await base44.entities.User.list();
        setUsers(u);
      } catch (e) {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const invite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await base44.users.inviteUser(inviteEmail.trim(), inviteRole);
      toast({ title: t("toast.inviteSent"), description: inviteEmail.trim() });
      setInviteEmail("");
      const u = await base44.entities.User.list();
      setUsers(u);
    } catch (e) {
      toast({ title: t("toast.inviteFail"), description: String(e), variant: "destructive" });
    } finally {
      setInviting(false);
    }
  };

  if (loading) return <div className="p-6"><Loading /></div>;

  const roleLabel = (r) => t(`userRole.${(r || "user")}`);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader         titleKey="settings.title" subtitle={t("settings.subtitle")} />

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
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Mail className="absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground start-3" />
            <Input placeholder={t("settings.inviteEmail")} value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="ps-9" />
          </div>
          <Select value={inviteRole} onValueChange={setInviteRole}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="user">{t("userRole.user")}</SelectItem>
              <SelectItem value="admin">{t("userRole.admin")}</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={invite} disabled={inviting || !inviteEmail.trim()}>
            <UserPlus className="h-4 w-4 ms-1" /> {inviting ? t("settings.inviting") : t("settings.invite")}
          </Button>
        </div>

        {users.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">{t("settings.noUsers")}</p>
        ) : (
          <Table headers={[t("settings.col.name"), t("settings.col.email"), t("settings.col.role")]}>
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-muted/40">
                <td className="px-4 py-2.5 font-medium">{u.full_name || "—"}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-2.5"><Badge className="border-border">{roleLabel(u.role)}</Badge></td>
              </tr>
            ))}
          </Table>
        )}
      </div>
    </div>
  );
}