import React, { useState, useEffect } from "react";
import { Bell, Send, Mail, Slack, Trash2, Plus, Users, ShieldAlert } from "lucide-react";
import { HealthReportData } from "../types";
import { useTheme } from "../context/ThemeContext";

interface AlertEngineTabProps {
  health: HealthReportData | null;
}

export const AlertEngineTab: React.FC<AlertEngineTabProps> = ({ health }) => {
  const { theme } = useTheme();
  const isLight = theme === "light";

  const [channel, setChannel] = useState<string>("Slack");
  const [dispatchLog, setDispatchLog] = useState<any[]>([]);
  const [sending, setSending] = useState<boolean>(false);
  const [staticRecipients, setStaticRecipients] = useState<string[]>([]);
  const [dynamicRecipients, setDynamicRecipients] = useState<any[]>([]);
  const [newEmail, setNewEmail] = useState<string>("");
  const [recipientStatus, setRecipientStatus] = useState<string>("");
  const [loadingRecipients, setLoadingRecipients] = useState<boolean>(false);

  const fetchRecipients = async () => {
    try {
      setLoadingRecipients(true);
      const res = await fetch("/api/alerts/recipients");
      if (res.ok) {
        const data = await res.json();
        setStaticRecipients(data.static_recipients || []);
        setDynamicRecipients(data.dynamic_recipients || []);
      }
    } catch (e) {
      console.error("Failed to load recipients", e);
    } finally {
      setLoadingRecipients(false);
    }
  };

  useEffect(() => {
    fetchRecipients();
  }, []);

  const handleAddRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    try {
      const res = await fetch("/api/alerts/recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setRecipientStatus(`Successfully added ${newEmail.trim()}`);
        setNewEmail("");
        fetchRecipients();
      } else {
        setRecipientStatus(`Error: ${data.detail || "Failed to add"}`);
      }
    } catch (e) {
      setRecipientStatus("Error connecting to server");
    }
  };

  const handleRemoveRecipient = async (email: string) => {
    try {
      const res = await fetch(`/api/alerts/recipients/${encodeURIComponent(email)}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setRecipientStatus(`Removed ${email}`);
        fetchRecipients();
      } else {
        const data = await res.json();
        setRecipientStatus(`Error: ${data.detail || "Failed to remove"}`);
      }
    } catch (e) {
      setRecipientStatus("Error connecting to server");
    }
  };

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
      <div className={`p-6 rounded-sm border shadow-sm transition-colors ${
        isLight ? "bg-white border-slate-200 text-slate-800" : "bg-[#161618] text-[#e0e0e0] border-[#242426]"
      }`}>
        <div className="flex items-center space-x-3 mb-2">
          <Bell className="w-5 h-5 text-red-500" />
          <h2 className={`text-sm font-bold uppercase tracking-wider font-mono ${isLight ? "text-slate-900" : "text-white"}`}>
            Multi-Channel Alert Engine & Notifications
          </h2>
        </div>
        <p className={`text-xs max-w-3xl font-mono ${isLight ? "text-slate-600" : "text-zinc-400"}`}>
          Monitors Oracle DB health continuously and dispatches automated alerts across Slack, Email (SMTP), and Generic Webhooks with intelligent deduplication.
        </p>
      </div>

      {/* Recipient Management Section */}
      <div className={`p-6 rounded-sm border space-y-4 shadow-sm transition-colors ${
        isLight ? "bg-white border-slate-200" : "bg-[#161618] border-[#242426]"
      }`}>
        <div className={`flex items-center justify-between border-b pb-3 ${
          isLight ? "border-slate-200" : "border-[#242426]"
        }`}>
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-blue-500" />
            <h3 className={`text-xs uppercase font-bold tracking-wider font-mono ${isLight ? "text-slate-900" : "text-white"}`}>
              Email Alert Recipients (Self-Service)
            </h3>
          </div>
          <span className={`text-[10px] font-mono ${isLight ? "text-slate-500" : "text-zinc-500"}`}>
            Takes effect on next cycle without service restart
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Static Baseline */}
          <div className="space-y-2">
            <span className={`text-[11px] font-mono uppercase font-bold ${isLight ? "text-slate-600" : "text-zinc-400"}`}>
              Admin Baseline (.env)
            </span>
            <div className={`p-3 rounded-sm border min-h-[100px] text-xs font-mono ${
              isLight ? "bg-slate-50 border-slate-200 text-slate-800" : "bg-[#0c0c0d] border-[#242426] text-zinc-300"
            }`}>
              {staticRecipients.length > 0 ? (
                <ul className="space-y-1.5">
                  {staticRecipients.map((r, idx) => (
                    <li key={idx} className="flex items-center justify-between">
                      <span>{r}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                        isLight ? "bg-slate-200 text-slate-600 border-slate-300" : "text-zinc-500 bg-[#161618] border-[#242426]"
                      }`}>
                        fixed
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className={isLight ? "text-slate-400 italic" : "text-zinc-600 italic"}>No static emails defined in .env</span>
              )}
            </div>
          </div>

          {/* Dynamic Self-Service */}
          <div className="space-y-2">
            <span className={`text-[11px] font-mono uppercase font-bold ${isLight ? "text-slate-600" : "text-zinc-400"}`}>
              Self-Added DBA Recipients
            </span>
            <div className={`p-3 rounded-sm border min-h-[100px] text-xs font-mono ${
              isLight ? "bg-slate-50 border-slate-200 text-slate-800" : "bg-[#0c0c0d] border-[#242426] text-zinc-300"
            }`}>
              {dynamicRecipients.length > 0 ? (
                <ul className="space-y-1.5">
                  {dynamicRecipients.map((r, idx) => (
                    <li key={idx} className="flex items-center justify-between">
                      <span>{r.email}</span>
                      <div className="flex items-center space-x-2">
                        <span className={`text-[10px] ${isLight ? "text-slate-500" : "text-zinc-500"}`}>added {r.added_at?.slice(0, 10)}</span>
                        <button
                          onClick={() => handleRemoveRecipient(r.email)}
                          className="text-rose-500 hover:text-rose-700 p-1 hover:bg-rose-100 rounded cursor-pointer transition-colors"
                          title="Remove email"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className={isLight ? "text-slate-400 italic" : "text-zinc-600 italic"}>No self-added recipients yet</span>
              )}
            </div>
          </div>
        </div>

        {/* Add Email Form */}
        <form onSubmit={handleAddRecipient} className="flex flex-wrap gap-2 pt-2">
          <input
            type="email"
            placeholder="dba.name@bankofabyssinia.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
            className={`flex-1 min-w-[240px] border rounded-sm px-3 py-2 text-xs font-mono focus:outline-none focus:border-blue-500 ${
              isLight ? "bg-white text-slate-900 border-slate-300" : "bg-[#0c0c0d] text-white border-[#242426]"
            }`}
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-bold px-4 py-2 rounded-sm transition-all flex items-center space-x-1.5 shadow-[0_0_8px_rgba(37,99,235,0.4)] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add My Email</span>
          </button>
        </form>
        {recipientStatus && (
          <div className={`text-xs font-mono font-bold ${isLight ? "text-amber-700" : "text-amber-400"}`}>
            {recipientStatus}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Test Dispatch Panel */}
        <div className={`p-6 rounded-sm border space-y-4 shadow-sm transition-colors ${
          isLight ? "bg-white border-slate-200" : "bg-[#161618] border-[#242426]"
        }`}>
          <h3 className={`text-xs uppercase font-bold tracking-wider font-mono flex items-center space-x-2 ${
            isLight ? "text-slate-900" : "text-white"
          }`}>
            <Send className="w-4 h-4 text-amber-500" />
            <span>Dispatch Test Notification</span>
          </h3>

          <div>
            <label className={`block text-[10px] uppercase font-bold tracking-wider font-mono mb-1.5 ${
              isLight ? "text-slate-600" : "text-zinc-400"
            }`}>
              Notification Channel
            </label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className={`w-full border rounded-sm p-2.5 text-xs font-mono focus:outline-none focus:border-blue-500 ${
                isLight ? "bg-slate-50 text-slate-800 border-slate-300" : "bg-[#0c0c0d] text-white border-[#242426]"
              }`}
            >
              <option value="Slack">💬 Slack Webhook Channel</option>
              <option value="Email">📧 SMTP Email Channel</option>
              <option value="GenericWebhook">🌐 Generic HTTP Webhook (OpsGenie)</option>
            </select>
          </div>

          <div className={`p-3.5 rounded-sm border text-xs font-mono space-y-1 ${
            isLight ? "bg-slate-50 border-slate-200 text-slate-700" : "bg-[#0c0c0d] border-[#242426] text-zinc-300"
          }`}>
            <p className={`font-bold ${isLight ? "text-slate-900" : "text-zinc-300"}`}>Alert Cooldown Policy:</p>
            <p className={isLight ? "text-slate-600" : "text-zinc-400"}>
              Cooldown window: <strong className={isLight ? "text-slate-900" : "text-white"}>15 minutes (900s)</strong>
            </p>
            <p className={`text-[11px] leading-relaxed mt-1 ${isLight ? "text-slate-500" : "text-zinc-500"}`}>
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
        <div className={`lg:col-span-2 p-6 rounded-sm border shadow-sm transition-colors ${
          isLight ? "bg-white border-slate-200 text-slate-800" : "bg-[#161618] text-zinc-200 border-[#242426]"
        }`}>
          <div className={`flex items-center justify-between mb-3 border-b pb-3 ${
            isLight ? "border-slate-200" : "border-[#242426]"
          }`}>
            <h3 className={`font-bold text-xs uppercase tracking-wider font-mono flex items-center space-x-2 ${
              isLight ? "text-slate-900" : "text-white"
            }`}>
              <Slack className="w-4 h-4 text-green-500" />
              <span>Notification Payload Log</span>
            </h3>
            <span className={`text-[10px] font-mono ${isLight ? "text-slate-500" : "text-zinc-500"}`}>
              Deduplication State: ACTIVE
            </span>
          </div>

          {dispatchLog.length > 0 ? (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {dispatchLog.map((log, idx) => (
                <div key={idx} className={`p-4 rounded-sm border font-mono text-xs space-y-2 ${
                  isLight ? "bg-slate-50 border-slate-200 text-slate-800" : "bg-[#0c0c0d] border-[#242426]"
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`font-bold ${isLight ? "text-emerald-700" : "text-green-400"}`}>
                      ✅ [{log.channel}] {log.dispatch_status}
                    </span>
                    <span className={isLight ? "text-slate-500" : "text-zinc-500"}>{log.timestamp}</span>
                  </div>
                  <p className={isLight ? "text-slate-700" : "text-zinc-300"}>{log.message}</p>
                  <div className={`p-2 rounded border text-[11px] font-mono ${
                    isLight ? "bg-white border-slate-200 text-amber-700" : "bg-[#161618] border-[#242426] text-amber-400"
                  }`}>
                    Rule ID: {log.rule_id} | Severity: {log.severity} | Cooldown Suppressed: {log.cooldown_active ? "YES" : "NO"}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={`p-8 rounded-sm border text-center text-xs font-mono ${
              isLight ? "bg-slate-50 border-slate-200 text-slate-500" : "bg-[#0c0c0d] border-[#242426] text-zinc-500"
            }`}>
              No test alerts dispatched yet. Click "Test Alert" to trigger notification dispatch.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
