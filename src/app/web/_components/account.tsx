"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { WEB_BASE } from "@/lib/web/format";
import { IconClose } from "./icons";
import { Sheet } from "./sheet";
import { anonId, sessionId, track } from "./tracker";

type Visitor = {
  name: string | null;
  email: string;
  picture: string | null;
  hasPhone: boolean;
  firstTime: boolean;
  prompt: "first" | "reminder" | null;
  favorites: string[];
};

type Account = {
  enabled: boolean;
  visitor: Visitor | null;
  openLogin: (reason?: string) => void;
  logout: () => void;
  openPhone: () => void;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const FAVORITES_KEY = "jw-favoritas";
const FAVORITES_EVENT = "jw-favoritas-change";
const AccountContext = createContext<Account>({ enabled: false, visitor: null, openLogin: () => {}, logout: () => {}, openPhone: () => {} });

export function useAccount() {
  return useContext(AccountContext);
}

function readFavorites(): string[] {
  try {
    return (localStorage.getItem(FAVORITES_KEY) ?? "").split(",").filter(Boolean);
  } catch {
    return [];
  }
}

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("gsi"));
    document.head.appendChild(script);
  });
}

function LoginSheet({ clientId, open, reason, onClose, onSignedIn }: { clientId: string; open: boolean; reason: string; onClose: () => void; onSignedIn: (visitor: Visitor) => void }) {
  const slot = useRef<HTMLDivElement>(null);
  const marketing = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const [{ nonce }] = await Promise.all([fetch(`${WEB_BASE}/cuenta/nonce`, { cache: "no-store" }).then((response) => response.json()), loadGoogleScript()]);
        if (cancelled || !slot.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          nonce,
          auto_select: false,
          callback: async ({ credential }: { credential: string }) => {
            const response = await fetch(`${WEB_BASE}/cuenta/google`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ credential, anonId: anonId(), sessionId: sessionId(), marketing: marketing.current }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) return setError(data.error ?? "No pudimos ingresar. Probá de nuevo.");
            onSignedIn(data.visitor);
          },
        });
        window.google.accounts.id.renderButton(slot.current, { theme: "outline", size: "large", shape: "pill", text: "continue_with", width: Math.min(slot.current.clientWidth || 320, 400), locale: "es" });
      } catch {
        if (!cancelled) setError("No pudimos cargar Google. Revisá tu conexión y probá de nuevo.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, open, onSignedIn]);

  return (
    <Sheet open={open} onClose={onClose} title="Ingresar">
      <div className="jw-login">
        <p>{reason}</p>
        <div ref={slot} className="jw-google-slot" />
        {error && <p className="jw-form-error" role="alert">{error}</p>}
        <label className="jw-check">
          <input type="checkbox" onChange={(event) => { marketing.current = event.target.checked; }} />
          <span>Quiero recibir novedades de propiedades por email.</span>
        </label>
        <p className="jw-fineprint">Al continuar aceptás que guardemos tu nombre, email y tu actividad en la web para ayudarte con tu búsqueda. <Link href={`${WEB_BASE}/privacidad`} onClick={onClose}>Ver privacidad</Link>.</p>
      </div>
    </Sheet>
  );
}

function PhoneSheet({ open, firstTime, onClose, onSaved }: { open: boolean; firstTime: boolean; onClose: () => void; onSaved: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const phone = String(new FormData(event.currentTarget).get("telefono") ?? "");
    const response = await fetch(`${WEB_BASE}/cuenta/telefono`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone }) });
    setSaving(false);
    if (response.ok) {
      track("phone_added");
      return onSaved();
    }
    const data = await response.json().catch(() => ({}));
    setError(data.error ?? "No pudimos guardarlo. Probá de nuevo.");
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={firstTime ? "¡Bienvenido!" : "Tu teléfono"}
      onSubmit={submit}
      footer={
        <div className="jw-sheet-actions">
          <button type="submit" className="jw-btn jw-btn-primary" disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button>
          <button type="button" className="jw-btn jw-btn-ghost" onClick={onClose}>Ahora no</button>
        </div>
      }
    >
      <p className="jw-sheet-text">Dejanos tu celular para avisarte de propiedades como las que buscás. Es opcional.</p>
      <div className="jw-group">
        <label className="jw-group-input">
          <span>Celular</span>
          <input name="telefono" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="11 5385 4029" required />
        </label>
      </div>
      {error && <p className="jw-form-error" role="alert">{error}</p>}
    </Sheet>
  );
}

export function AccountProvider({ children, clientId }: { children: ReactNode; clientId: string | null }) {
  const enabled = Boolean(clientId);
  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [login, setLogin] = useState<string | null>(null);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [reminder, setReminder] = useState(false);
  const signedIn = useRef(false);

  const markSeen = useCallback(() => {
    void fetch(`${WEB_BASE}/cuenta/telefono`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ seen: true }) }).catch(() => {});
  }, []);

  const syncFavorites = useCallback((server: string[]) => {
    const merged = [...new Set([...readFavorites(), ...server])];
    try {
      localStorage.setItem(FAVORITES_KEY, merged.join(","));
    } catch {
      return;
    }
    window.dispatchEvent(new Event(FAVORITES_EVENT));
    void fetch(`${WEB_BASE}/cuenta/favoritas`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ favorites: merged }) }).catch(() => {});
  }, []);

  const applyPrompt = useCallback((value: Visitor) => {
    if (value.prompt === "first") {
      setPhoneOpen(true);
      markSeen();
    } else if (value.prompt === "reminder") {
      setReminder(true);
      markSeen();
    }
  }, [markSeen]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch(`${WEB_BASE}/cuenta/yo`, { cache: "no-store" })
      .then((response) => response.json())
      .then(({ visitor: value }: { visitor: Visitor | null }) => {
        if (cancelled || !value) return;
        signedIn.current = true;
        setVisitor(value);
        syncFavorites(value.favorites);
        applyPrompt(value);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled, applyPrompt, syncFavorites]);

  useEffect(() => {
    const push = () => {
      if (!signedIn.current) return;
      void fetch(`${WEB_BASE}/cuenta/favoritas`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ favorites: readFavorites() }) }).catch(() => {});
    };
    window.addEventListener(FAVORITES_EVENT, push);
    return () => window.removeEventListener(FAVORITES_EVENT, push);
  }, []);

  const onSignedIn = useCallback((value: Visitor) => {
    signedIn.current = true;
    setVisitor(value);
    setLogin(null);
    syncFavorites(value.favorites);
    applyPrompt(value);
  }, [applyPrompt, syncFavorites]);

  const value = useMemo<Account>(() => ({
    enabled,
    visitor,
    openLogin: (reason = "Guardá tus favoritas en todos tus dispositivos y recibí ayuda con tu búsqueda.") => setLogin(reason),
    openPhone: () => setPhoneOpen(true),
    logout: () => {
      void fetch(`${WEB_BASE}/cuenta/salir`, { method: "POST" }).finally(() => {
        signedIn.current = false;
        setVisitor(null);
      });
    },
  }), [enabled, visitor]);

  return (
    <AccountContext.Provider value={value}>
      {children}
      {clientId && (
        <>
          <LoginSheet clientId={clientId} open={login !== null} reason={login ?? ""} onClose={() => setLogin(null)} onSignedIn={onSignedIn} />
          <PhoneSheet
            open={phoneOpen}
            firstTime={visitor?.firstTime ?? false}
            onClose={() => setPhoneOpen(false)}
            onSaved={() => {
              setPhoneOpen(false);
              setReminder(false);
              setVisitor((current) => (current ? { ...current, hasPhone: true, prompt: null } : current));
            }}
          />
          {reminder && !phoneOpen && (
            <div className="jw-notice" role="status">
              <p>¿Nos dejás tu celular para avisarte de propiedades como las que buscás?</p>
              <button type="button" className="jw-notice-action" onClick={() => setPhoneOpen(true)}>Agregar</button>
              <button type="button" className="jw-icon-btn" aria-label="Cerrar aviso" onClick={() => setReminder(false)}><IconClose width={18} height={18} /></button>
            </div>
          )}
        </>
      )}
    </AccountContext.Provider>
  );
}
