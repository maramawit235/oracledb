import React from "react";
import { AlertTriangle, ShieldAlert, X } from "lucide-react";
import { AlertToast } from "../hooks/useAlertToasts";
import { useTheme } from "../context/ThemeContext";

interface AlertToastCenterProps {
  toasts: AlertToast[];
  onDismiss: (toastId: string) => void;
  onDismissAll: () => void;
}

export const AlertToastCenter: React.FC<AlertToastCenterProps> = ({ toasts, onDismiss, onDismissAll }) => {
  const { theme } = useTheme();
  const isLight = theme === "light";

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 w-full max-w-sm space-y-2.5">
      {toasts.length > 1 && (
        <button
          onClick={onDismissAll}
          className={`w-full text-right text-[10px] uppercase font-mono tracking-wider pr-1 cursor-pointer transition-colors ${
            isLight ? "text-slate-600 hover:text-slate-900" : "text-zinc-400 hover:text-white"
          }`}
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
            className={`border rounded-sm shadow-xl overflow-hidden animate-[fadeIn_0.2s_ease-out] transition-colors ${
              isLight ? "bg-white" : "bg-[#161618]"
            } ${
              isCritical
                ? isLight ? "border-rose-300" : "border-red-500/60"
                : isLight ? "border-amber-300" : "border-amber-500/50"
            }`}
            style={{
              boxShadow: isCritical
                ? (isLight ? "0 10px 15px -3px rgba(225, 29, 72, 0.2)" : "0 0 16px rgba(239,68,68,0.25)")
                : (isLight ? "0 10px 15px -3px rgba(217, 119, 6, 0.15)" : "0 0 12px rgba(245,158,11,0.18)"),
            }}
          >
            <div className={`flex items-center justify-between px-3.5 py-2 ${
              isCritical
                ? isLight ? "bg-rose-50 border-b border-rose-200" : "bg-red-950/40"
                : isLight ? "bg-amber-50 border-b border-amber-200" : "bg-amber-950/30"
            }`}>
              <div className="flex items-center space-x-2">
                {isCritical ? (
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                )}
                <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                  isCritical
                    ? isLight ? "text-rose-800" : "text-red-400"
                    : isLight ? "text-amber-800" : "text-amber-400"
                }`}>
                  {toast.severity} &bull; DB Health Alert
                </span>
              </div>
              <button
                onClick={() => onDismiss(toast.toastId)}
                aria-label="Dismiss alert"
                className={`cursor-pointer transition-colors ${
                  isLight ? "text-slate-400 hover:text-slate-700" : "text-zinc-500 hover:text-white"
                }`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="px-3.5 py-3 space-y-2 font-mono">
              <p className={`text-xs font-bold ${isLight ? "text-slate-900" : "text-white"}`}>{toast.ruleName}</p>
              <p className={`text-[11px] leading-relaxed ${isLight ? "text-slate-600" : "text-zinc-400"}`}>{toast.message}</p>

              <div className={`flex items-center justify-between text-[10px] pt-1 ${isLight ? "text-slate-500" : "text-zinc-500"}`}>
                <span>
                  Value: <span className={isLight ? "text-slate-800 font-bold" : "text-zinc-300"}>{toast.currentValue}{toast.unit}</span>
                </span>
                <span>
                  Health Score: <span className={isLight ? "text-slate-800 font-bold" : "text-zinc-300"}>{toast.healthScore}/100</span>
                </span>
              </div>

              <div className={`text-[11px] p-2 rounded-sm border-l-2 ${
                isCritical
                  ? isLight ? "bg-rose-50/80 border-rose-500 text-rose-900" : "bg-red-950/20 border-red-500 text-red-200"
                  : isLight ? "bg-amber-50/80 border-amber-500 text-amber-900" : "bg-amber-950/20 border-amber-500 text-amber-200"
              }`}>
                {toast.recommendation}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
