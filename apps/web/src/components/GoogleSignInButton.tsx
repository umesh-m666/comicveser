"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth, User } from "./AuthProvider";

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            ux_mode?: "popup" | "redirect";
            auto_select?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with";
              shape?: "rectangular" | "pill";
              width?: number;
            },
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

interface GoogleSignInButtonProps {
  mode: "login" | "register";
  onSuccess: (user: User | null) => void;
  onError: (message: string) => void;
}

export default function GoogleSignInButton({ mode, onSuccess, onError }: GoogleSignInButtonProps) {
  const auth = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const [clientId, setClientId] = useState<string | null>(
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || null,
  );
  const [scriptReady, setScriptReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [renderedGsi, setRenderedGsi] = useState(false);

  // Discover GOOGLE_CLIENT_ID from backend if not baked into NEXT_PUBLIC_GOOGLE_CLIENT_ID
  useEffect(() => {
    if (clientId) return;
    let active = true;
    api<{ googleEnabled: boolean; googleClientId: string | null }>("/auth/config")
      .then((cfg) => {
        if (active && cfg?.googleClientId) {
          setClientId(cfg.googleClientId);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [clientId]);

  // Load Google Identity Services script
  useEffect(() => {
    if (!clientId || typeof window === "undefined") return;
    if (window.google?.accounts?.id) {
      setScriptReady(true);
      return;
    }
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]',
    );
    if (existingScript) {
      const onLoad = () => setScriptReady(true);
      existingScript.addEventListener("load", onLoad);
      return () => existingScript.removeEventListener("load", onLoad);
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => setScriptReady(true);
    script.onerror = () => onError("Could not load Google Sign-In script. Check your internet connection.");
    document.head.appendChild(script);
  }, [clientId, onError]);

  // Initialize and render the Google Identity Services button
  useEffect(() => {
    if (!clientId || !scriptReady || !containerRef.current || !window.google?.accounts?.id) return;
    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        ux_mode: "popup",
        callback: async (response) => {
          if (!response?.credential) {
            onError("Google Sign-In was cancelled or did not return a credential.");
            return;
          }
          setSubmitting(true);
          onError("");
          try {
            const res = await api<{ ok: boolean; token?: string; user?: User; isNewUser?: boolean }>(
              "/auth/google",
              {
                method: "POST",
                body: JSON.stringify({ credential: response.credential }),
              },
            );
            const loggedInUser = await auth.applyLogin(res?.user ?? null, res?.token ?? null);
            onSuccess(loggedInUser);
          } catch (err) {
            onError((err as Error).message || "Google authentication failed.");
          } finally {
            setSubmitting(false);
          }
        },
      });
      containerRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(containerRef.current, {
        theme: "filled_black",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        width: 360,
      });
      setRenderedGsi(true);
    } catch {
      setRenderedGsi(false);
    }
  }, [clientId, scriptReady, mode, auth, onSuccess, onError]);

  const handleFallbackClick = () => {
    if (!clientId) {
      onError(
        "Google Sign-In is not configured yet. Set GOOGLE_CLIENT_ID and NEXT_PUBLIC_GOOGLE_CLIENT_ID in your environment variables.",
      );
      return;
    }
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    } else {
      onError("Google Sign-In is still loading. Please try again in a moment.");
    }
  };

  return (
    <div className="w-full">
      <div
        ref={containerRef}
        className={renderedGsi ? "flex w-full justify-center" : "hidden"}
        aria-label="Continue with Google"
      />
      {!renderedGsi && (
        <button
          type="button"
          disabled={submitting}
          onClick={handleFallbackClick}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-fg transition hover:bg-card disabled:opacity-50"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path
              fill="#EA4335"
              d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
            />
            <path
              fill="#4285F4"
              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
            />
            <path
              fill="#FBBC05"
              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
            />
            <path
              fill="#34A853"
              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
            />
          </svg>
          <span>{submitting ? "Signing in with Google..." : "Continue with Google"}</span>
        </button>
      )}
    </div>
  );
}
