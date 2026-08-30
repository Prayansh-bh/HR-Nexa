import { createFileRoute } from "@tanstack/react-router";
import React, { useEffect, useState, useRef } from "react";
import axiosInstance from "../api/axios";
import { useAuth } from "../auth";
import { ShieldAlert, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { OWNER_APP_URL } from "../config/api";

export const Route = createFileRoute("/impersonate")({
  validateSearch: (search: Record<string, unknown>) => ({
    ticket: (search.ticket as string) || "",
  }),
  component: ImpersonateExchangeComponent,
});

// Cache in-flight and completed exchange promises by ticket to guarantee single network execution across any remounts/re-renders
const exchangePromiseCache = new Map<string, Promise<any>>();

function ImpersonateExchangeComponent() {
  const { ticket } = Route.useSearch();
  const { setUser } = useAuth();

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [ownerUrl] = useState<string>(OWNER_APP_URL);

  // Track if this instance has initiated or completed an exchange for the current ticket
  const executedTicketRef = useRef<string | null>(null);
  const isSucceededRef = useRef<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    if (!ticket || !ticket.trim()) {
      setStatus("error");
      setErrorMsg("Missing impersonation ticket parameter. Please initiate impersonation from the Platform Owner console.");
      return;
    }

    // Prevent duplicate dispatch for the same ticket within this component's lifecycle
    if (executedTicketRef.current === ticket && isSucceededRef.current) {
      return;
    }
    executedTicketRef.current = ticket;

    async function executeExchange() {
      try {
        let promise = exchangePromiseCache.get(ticket);
        if (!promise) {
          promise = axiosInstance
            .post("/auth/impersonate/exchange", { ticket })
            .then((res) => res.data);
          exchangePromiseCache.set(ticket, promise);
        }

        const data = await promise;

        if (!data || !data.access_token) {
          throw new Error("Invalid exchange response from authorization server.");
        }

        isSucceededRef.current = true;

        if (typeof window !== "undefined") {
          localStorage.setItem("hrms.token", data.access_token);
          localStorage.setItem("hrms.refreshToken", data.refresh_token);
          localStorage.setItem("hrms.user", JSON.stringify(data.user));
          localStorage.setItem("hrms.impersonator", data.impersonator?.name || "Platform Owner");
          localStorage.setItem(
            "hrms.impersonator.ownerUrl",
            data.impersonator?.ownerAppUrl || OWNER_APP_URL,
          );
          if (data.user?.companyId) {
            localStorage.setItem("hrms.company", JSON.stringify(data.user.name || "Company"));
          }
        }

        setUser(data.user);

        if (isMounted) {
          setStatus("success");
        }

        // Cleanly replace browser history so single-use ticket doesn't remain in URL or back/refresh history
        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", "/dashboard");
          window.location.replace("/dashboard");
        }
      } catch (err: any) {
        // If an earlier execution in this session already succeeded, do NOT overwrite with an error
        if (isSucceededRef.current) {
          return;
        }

        if (isMounted) {
          setStatus("error");
          const msg =
            (Array.isArray(err.response?.data?.message)
              ? err.response.data.message.join(", ")
              : err.response?.data?.message) ||
            err.message ||
            "The impersonation ticket is invalid, expired, or has already been used.";
          setErrorMsg(msg);
        }
      }
    }

    void executeExchange();

    return () => {
      isMounted = false;
    };
  }, [ticket, setUser]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl space-y-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
          <h2 className="text-xl font-bold">Verifying Impersonation Ticket...</h2>
          <p className="text-sm text-slate-400">
            Establishing secure cross-domain authorization session for tenant HRMS.
          </p>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white">
        <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl space-y-4">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
          <h2 className="text-xl font-bold text-emerald-400">Impersonation Session Active</h2>
          <p className="text-sm text-slate-400">Redirecting to Tenant HRMS Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white">
      <div className="bg-slate-900 border border-rose-500/30 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl space-y-6">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-400">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-rose-400">Impersonation Ticket Expired or Invalid</h2>
          <p className="text-sm text-slate-400 leading-relaxed">{errorMsg}</p>
          <p className="text-xs text-slate-500">
            Tickets are single-use, cryptographically signed, and expire in 30 seconds to prevent replay attacks.
          </p>
        </div>
        <a
          href={ownerUrl}
          className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Return to Platform Owner Console
        </a>
      </div>
    </div>
  );
}
