import { useEffect, useRef, useState } from "react";
import { HealthReportData, RuleResultData } from "../types";

export interface AlertToast {
  toastId: string;       // unique per occurrence, used as React key / dismiss target
  ruleId: string;
  ruleName: string;
  severity: "WARNING" | "CRITICAL";
  message: string;
  recommendation: string;
  currentValue: number;
  unit: string;
  healthScore: number;
  firstSeenAt: number;   // epoch ms
}

interface RuleTrackState {
  lastSeverity: "WARNING" | "CRITICAL";
  lastShownAt: number;
}

const DEFAULT_COOLDOWN_MS = 15 * 60 * 1000; // 15 min, mirrors AlertEngine's default cooldown_seconds=900

/**
 * Client-side mirror of AlertEngine._should_suppress_alert().
 * A rule breach becomes a toast when:
 *   - it's the first time we've seen this rule breach, OR
 *   - it escalated from WARNING -> CRITICAL, OR
 *   - the cooldown window has elapsed since it last toasted
 * A rule dropping back to OK clears its tracked state so the next
 * breach (even the same severity) is treated as fresh.
 */
export function useAlertToasts(health: HealthReportData | null, cooldownMs: number = DEFAULT_COOLDOWN_MS) {
  const [toasts, setToasts] = useState<AlertToast[]>([]);
  const ruleStateRef = useRef<Map<string, RuleTrackState>>(new Map());

  useEffect(() => {
    if (!health || !health.rule_results) return;

    const now = Date.now();
    const ruleState = ruleStateRef.current;
    const seenThisPoll = new Set<string>();
    const newToasts: AlertToast[] = [];

    for (const result of health.rule_results as RuleResultData[]) {
      if (result.severity !== "WARNING" && result.severity !== "CRITICAL") continue;
      seenThisPoll.add(result.rule_id);

      const state = ruleState.get(result.rule_id);
      let shouldShow = false;

      if (!state) {
        shouldShow = true; // brand new breach
      } else if (result.severity === "CRITICAL" && state.lastSeverity === "WARNING") {
        shouldShow = true; // escalation fires immediately, same as backend
      } else if (now - state.lastShownAt >= cooldownMs) {
        shouldShow = true; // cooldown expired, remind DBA it's still breached
      }

      if (shouldShow) {
        newToasts.push({
          toastId: `${result.rule_id}-${now}`,
          ruleId: result.rule_id,
          ruleName: result.rule_name,
          severity: result.severity,
          message: result.message,
          recommendation: result.recommendation,
          currentValue: result.current_value,
          unit: result.unit,
          healthScore: health.health_score,
          firstSeenAt: now,
        });
        ruleState.set(result.rule_id, { lastSeverity: result.severity, lastShownAt: now });
      }
    }

    // Any rule that was tracked but is no longer WARNING/CRITICAL has resolved.
    // Clear it so a future breach is treated as new, not a stale cooldown.
    for (const trackedRuleId of Array.from(ruleState.keys()) as string[]) {
      if (!seenThisPoll.has(trackedRuleId)) {
        ruleState.delete(trackedRuleId);
      }
    }

    if (newToasts.length > 0) {
      setToasts((prev) => [...newToasts, ...prev]);
    }
    // health is replaced wholesale each poll, so identity comparison is enough
  }, [health, cooldownMs]);

  const dismissToast = (toastId: string) => {
    setToasts((prev) => prev.filter((t) => t.toastId !== toastId));
  };

  const dismissAll = () => setToasts([]);

  return { toasts, dismissToast, dismissAll };
}
