import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — SearchGrid Console" },
      { name: "description", content: "Sign in to open the SearchGrid flight search console." },
      { property: "og:title", content: "Sign in — SearchGrid Console" },
      { property: "og:description", content: "Sign in to open the SearchGrid flight search console." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Login,
});

function displayNameFromUser(user: { email?: string | null; user_metadata?: Record<string, unknown> }): string {
  const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string };
  const fromMeta = meta.full_name || meta.name;
  if (fromMeta && fromMeta.trim()) return fromMeta.trim();
  const email = user.email ?? "";
  const local = email.split("@")[0];
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : "User";
}

function Login() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled || !data?.user) return;
      localStorage.setItem("sg_user", displayNameFromUser(data.user));
      sessionStorage.removeItem("sg_next");
      navigate({ to: "/console", replace: true });
    };
    check();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    sessionStorage.setItem("sg_next", "/console");
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      setError(result.error.message || "Google sign-in failed. Please try again.");
      return;
    }
    if (result.redirected) return; // full-page redirect to Google; we resume back on this origin
    setBusy(false);
    const { data } = await supabase.auth.getUser();
    if (!data?.user) {
      setError("Sign-in did not complete. Please try again.");
      return;
    }
    localStorage.setItem("sg_user", displayNameFromUser(data.user));
    sessionStorage.removeItem("sg_next");
    navigate({ to: "/console" });
  };

  return (
    <main className="grid min-h-screen bg-paper font-display text-ink md:grid-cols-[1fr_0.8fr]">
      <section className="flex flex-col justify-between p-8 md:p-14">
        <a href="/" className="font-mono text-xs uppercase tracking-[0.3em] text-ink/60">← Lastfix</a>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-signal">Console access</p>
          <h1 className="mt-3 text-5xl font-black leading-[0.9] tracking-tight md:text-7xl">SIGN IN.</h1>
          <p className="mt-4 max-w-sm text-ink/60">Sign in with Google to open the live flight map and search planner.</p>

          <button
            onClick={signIn}
            disabled={busy}
            className="mt-10 inline-flex items-center gap-3 border border-ink bg-paper px-6 py-4 font-mono text-xs uppercase tracking-[0.2em] transition-colors hover:bg-ink hover:text-paper disabled:opacity-50"
          >
            <span className="font-black">G</span> {busy ? "Connecting…" : "Continue with Google"}
          </button>
          {error && <p className="mt-4 max-w-sm font-mono text-[11px] text-signal">{error}</p>}
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/40">SearchGrid · Console</span>
      </section>
      <aside className="hidden flex-col justify-end bg-navy p-14 text-navy-foreground md:flex" style={{ borderTopLeftRadius: "40% 100%" }}>
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-signal">Signal lost</p>
        <p className="mt-3 text-3xl font-black tracking-tight">Narrow the search.</p>
      </aside>
    </main>
  );
}
