import React from "react";
import { AlertTriangle, ShieldAlert, X } from "lucide-react";
import { AlertToast } from "../hooks/useAlertToasts";

interface AlertToastCenterProps {
  toasts: AlertToast[];
  onDismiss: (toastId: string) => void;
  onDismissAll: () => void;
}

export const AlertToastCenter: React.FC<AlertToastCenterProps> = ({ toasts, onDismiss, onDismissAll }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 w-full max-w-sm space-y-2.5">
      {toasts.length > 1 && (
        <button
          onClick={onDismissAll}
          className="w-full text-right text-[10px] uppercase font-mono tracking-wider text-zinc-400 hover:text-white pr-1 cursor-pointer"
        >
          Dismiss All ({toasts.length})
        </button>
      )}

      {toasts.map((toast) => {
        const isCritical = toast.severity === "CRITICAL";
        return (
          <div
            key={toast.toastId}
            role="alert"
            className={`bg-[#161618] border rounded-sm shadow-lg overflow-hidden animate-[fadeIn_0.2s_ease-out] ${
              isCritical ? "border-red-500/60" : "border-amber-500/50"
            }`}
            style={{
              boxShadow: isCritical
                ? "0 0 16px rgba(239,68,68,0.25)"
                : "0 0 12px rgba(245,158,11,0.18)",
            }}
          >
            <div className={`flex items-center justify-between px-3.5 py-2 ${isCritical ? "bg-red-950/40" : "bg-amber-950/30"}`}>
              <div className="flex items-center space-x-2">
                {isCritical ? (
                  <ShieldAlert className="w-4 h-4 text-red-500" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                )}
                <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${isCritical ? "text-red-400" : "text-amber-400"}`}>
                  {toast.severity} &bull; DB Health Alert
                </span>
              </div>
              <button
                onClick={() => onDismiss(toast.toastId)}
                aria-label="Dismiss alert"
                className="text-zinc-500 hover:text-white cursor-pointer transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="px-3.5 py-3 space-y-2 font-mono">
              <p className="text-xs font-bold text-white">{toast.ruleName}</p>
              <p className="text-[11px] text-zinc-400 leading-relaxed">{toast.message}</p>

              <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1">
                <span>
                  Value: <span className="text-zinc-300">{toast.currentValue}{toast.unit}</span>
                </span>
                <span>
                  Health Score: <span className="text-zinc-300">{toast.healthScore}/100</span>
                </span>
              </div>

              <div className={`text-[11px] p-2 rounded-sm border-l-2 ${isCritical ? "bg-red-950/20 border-red-500 text-red-200" : "bg-amber-950/20 border-amber-500 text-amber-200"}`}>
                {toast.recommendation}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
