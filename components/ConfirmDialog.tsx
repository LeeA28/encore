"use client";

// Encore's own "are you sure?" pop-up, replacing the browser's built-in confirm() box (which can't be styled).
//
// How to use it in any component inside <ConfirmProvider>:
//   const confirm = useConfirm();
//   if (!(await confirm({ title: "Delete this list?", confirmLabel: "Delete", danger: true }))) return;
//
// confirm() returns a Promise: JavaScript's way of saying "the answer arrives later". It resolves to
// true when the confirm button is clicked, or false for Cancel, Escape, or clicking outside.

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string; // name the action ("Disconnect", "Delete list") instead of a vague "OK"
  cancelLabel?: string;
  danger?: boolean; // red confirm button, for actions that delete things
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

// Context lets any component deep inside the app reach confirm(), without passing it down as a prop
const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return confirm;
}

type Request = ConfirmOptions & { resolve: (answer: boolean) => void };

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<Request | null>(null);

  // Opens the pop-up, and hands back a promise that resolves once a button is clicked
  const confirm = useCallback<ConfirmFn>(
    (options) => new Promise<boolean>((resolve) => setRequest({ ...options, resolve })),
    []
  );

  const answer = useCallback(
    (value: boolean) => {
      request?.resolve(value);
      setRequest(null);
    },
    [request]
  );

  // Escape key = Cancel
  useEffect(() => {
    if (!request) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") answer(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey); // stop listening once it closes
  }, [request, answer]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request && (
        // "on-top": sits above other pop-ups (like the playlist builder), since it can be opened from them
        <div className="modal-backdrop on-top" onClick={() => answer(false)}>
          <div
            className="card modal"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
          >
            <h2 id="confirm-title" className="card-title" style={{ fontSize: 24, marginBottom: 8 }}>
              {request.title}
            </h2>
            {request.message && <p className="card-desc">{request.message}</p>}
            <div className="form-row" style={{ justifyContent: "flex-end", marginTop: request.message ? 0 : 16 }}>
              <button className="btn btn-ghost" onClick={() => answer(false)}>
                {request.cancelLabel ?? "Cancel"}
              </button>
              {/* autoFocus: pressing Enter right away confirms */}
              <button
                className={`btn ${request.danger ? "btn-danger" : "btn-light"}`}
                onClick={() => answer(true)}
                autoFocus
              >
                {request.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
