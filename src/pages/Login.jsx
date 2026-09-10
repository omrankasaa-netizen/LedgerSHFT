import React, { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookOpen } from "lucide-react";

// Email/password sign-in against the self-hosted backend (JWT).
export default function Login() {
  const { t } = useI18n();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err?.message || t("backendLogin.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="h-5 w-5 text-primary" />
          <span className="font-heading font-bold">LedgerShift</span>
        </div>
        <p className="text-xs text-muted-foreground mb-4">{t("backendLogin.subtitle")}</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">{t("backendLogin.email")}</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">{t("backendLogin.password")}</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t("backendLogin.signingIn") : t("backendLogin.submit")}
          </Button>
        </div>
      </form>
    </div>
  );
}
