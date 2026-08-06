import React, { useState } from "react";
import { Bell, Send, CheckCircle2, ShieldAlert, Mail, Slack, Webhook, Clock } from "lucide-react";
import { HealthReportData } from "../types";

interface AlertEngineTabProps {
  health: HealthReportData | null;
}

export const AlertEngineTab: React.FC<AlertEngineTabProps> = ({ health }) => {
  const [channel, setChannel] = useState<string>("Slack");
  const [dispatchLog, setDispatchLog] = useState<any[]>([]);
  const [sending, setSending] = useState<boolean>(false);

  const handleTestAlert = async () => {
    setSending(true);
    try {
      const res = await fetch("/api/alerts/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          rule_id: health?.rule_results.find((r) => r.severity !== "OK")?.rule_id || "RULE_TABLESPACE_USERS"
        })
      });
      const data = await res.json();
      setDispatchLog((prev) => [data, ...prev]);
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#161618] text-[#e0e0e0] p-6 rounded-sm border border-[#242426]">
        <div className="flex items-center space-x-3 mb-2">
          <Bell className="w-5 h-5 text-red-500" />
          <h2 className="text-sm font-bold uppercase tracking-wider font-mono">Multi-Channel Alert Engine & Deduplication (Part 5)</h2>
        </div>
        <p className="text-xs text-zinc-400 max-w-3xl">
          Filters WARNING and CRITICAL threshold breaches and dispatches notifications via Slack, Email (SMTP), and Generic Webhooks. Includes stateful deduplication to prevent alert fatigue.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Test Dispatch Panel */}
        <div className="bg-[#161618] p-6 rounded-sm border border-[#242426] space-y-4">
          <h3 className="text-xs uppercase font-bold tracking-wider font-mono text-white flex items-center space-x-2">
            <Send className="w-4 h-4 text-amber-400" />
            <span>Dispatch Test Notification</span>
          </h3>

          <div>
            <label className="block text-[10px] uppercase font-bold tracking-wider font-mono text-zinc-400 mb-1.5">Notification Channel</label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="w-full bg-[#0c0c0d] border border-[#242426] rounded-sm p-2.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
            >
              <option value="Slack">💬 Slack Webhook Channel</option>
              <option value="Email">📧 SMTP Email Channel</option>
              <option value="GenericWebhook">🌐 Generic HTTP Webhook (OpsGenie)</option>
            </select>
          </div>

          <div className="p-3.5 bg-[#0c0c0d] rounded-sm border border-[#242426] text-xs font-mono space-y-1">
            <p className="font-bold text-zinc-300">Alert Cooldown Policy:</p>
            <p className="text-zinc-400">
              Cooldown window: <strong className="text-white">15 minutes (900s)</strong>
            </p>
            <p className="text-zinc-500 text-[11px] leading-relaxed mt-1">
              Repeated identical alerts are suppressed during cooldown unless severity escalates from WARNING to CRITICAL.
            </p>
          </div>

          <button
            onClick={handleTestAlert}
            disabled={sending}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold font-mono text-xs py-3 rounded-sm transition-all flex items-center justify-center space-x-2 shadow-[0_0_8px_rgba(37,99,235,0.4)] cursor-pointer disabled:opacity-50 uppercase tracking-wider"
          >
            <Bell className="w-4 h-4" />
            <span>{sending ? "Dispatching..." : `Test ${channel} Alert`}</span>
          </button>
        </div>

        {/* Live Payload Preview */}
        <div className="lg:col-span-2 bg-[#161618] text-zinc-200 p-6 rounded-sm border border-[#242426]">
          <div className="flex items-center justify-between mb-3 border-b border-[#242426] pb-3">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider font-mono flex items-center space-x-2">
              <Slack className="w-4 h-4 text-green-500" />
              <span>Notification Payload Log</span>
            </h3>
            <span className="text-[10px] text-zinc-500 font-mono">Deduplication State: ACTIVE</span>
          </div>

          {dispatchLog.length > 0 ? (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {dispatchLog.map((log, idx) => (
                <div key={idx} className="bg-[#0c0c0d] p-4 rounded-sm border border-[#242426] font-mono text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-green-400 font-bold">
                      ✅ [{log.channel}] {log.dispatch_status}
                    </span>
                    <span className="text-zinc-500">{log.timestamp}</span>
                  </div>
                  <p className="text-zinc-300">{log.message}</p>
                  <div className="p-2 bg-[#161618] rounded border border-[#242426] text-[11px] text-amber-400">
                    Rule ID: {log.rule_id} | Severity: {log.severity} | Cooldown Suppressed: {log.cooldown_active ? "YES" : "NO"}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-[#0c0c0d] p-8 rounded-sm border border-[#242426] text-center text-zinc-500 text-xs font-mono">
              No test alerts dispatched yet. Click "Test Alert" to trigger notification dispatch.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
