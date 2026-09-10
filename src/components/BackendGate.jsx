import React, { useState } from "react";
import { backendLogin, isBackendAuthenticated } from "@/api/backendClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { Lock } from "lucide-react";

/**
 * Gate for pages that talk to the self-hosted backend. Shows a small
 * sign-in card when no JWT is stored, and renders children otherwise.
 * (The app shell already requires login, so this is mostly a fallback.)
 */
export default function BackendGate({ children }) {
  const { t } = useI18n();
  const [authed, setAuthed] = useState(isBackendAuthenticated());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (authed) return children;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await backendLogin(email, password);
      setAuthed(true);
    } catch (err) {
      setError(err?.message || t("backendLogin.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 max-w-sm mx-auto mt-10">
      <form onSubmit={submit} className="rounded-lg border border-border bg-card p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <div className="font-heading font-semibold text-sm">{t("backendLogin.title")}</div>
        </div>
        <p className="text-xs text-muted-foreground">{t("backendLogin.subtitle")}</p>
        <Input
          type="email"
          required
          placeholder={t("backendLogin.email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          type="password"
          required
          placeholder={t("backendLogin.password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <div className="text-xs text-destructive">{error}</div>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? t("backendLogin.signingIn") : t("backendLogin.submit")}
        </Button>
      </form>
    </div>
  );
}
