import React from "react";
import { HealthReportData, TablespaceMetric, WaitEventMetric, BlockedSessionMetric } from "../types";
import { Activity, AlertTriangle, CheckCircle2, Clock, Database, Lock, Server, ShieldAlert, Cpu } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface DashboardTabProps {
  health: HealthReportData | null;
  metrics: {
    active_sessions: number;
    tablespaces: TablespaceMetric[];
    wait_events: WaitEventMetric[];
    blocked_sessions: BlockedSessionMetric[];
    sysstat_execute_count: number;
  } | null;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({ health, metrics }) => {
  if (!health || !metrics) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        <Activity className="w-6 h-6 animate-spin mr-2 text-amber-500" />
        <span>Loading Oracle DB Metrics & Health Evaluation...</span>
      </div>
    );
  }

  const getSeverityBadge = (sev: string) => {
    if (sev === "OK") return "bg-emerald-100 text-emerald-800 border-emerald-300";
    if (sev === "WARNING") return "bg-amber-100 text-amber-800 border-amber-300";
    return "bg-rose-100 text-rose-800 border-rose-300";
  };

  return (
    <div className="space-y-6">
      {/* Top Key Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Health Score */}
        <div className="bg-[#161618] border border-[#242426] p-4 flex flex-col justify-between rounded-sm">
          <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest font-mono">Health Score</span>
          <div className="flex items-end justify-between mt-2">
            <span className="text-4xl font-mono text-blue-400">
              {health.health_score}
              <span className="text-lg text-zinc-600">/100</span>
            </span>
            <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${
              health.status === "HEALTHY" ? "bg-green-500/10 text-green-500 border-green-500/30" :
              health.status === "DEGRADED" ? "bg-amber-500/10 text-amber-500 border-amber-500/30" :
              "bg-red-500/10 text-red-500 border-red-500/30"
            }`}>
              {health.status}
            </span>
          </div>
        </div>

        {/* Active Sessions */}
        <div className="bg-[#161618] border border-[#242426] p-4 flex flex-col justify-between rounded-sm">
          <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest font-mono">Active Sessions</span>
          <div className="flex items-end justify-between mt-2">
            <span className="text-4xl font-mono text-white">{metrics.active_sessions}</span>
            <span className="text-[10px] text-zinc-500 font-mono">V$SESSION</span>
          </div>
        </div>

        {/* Blocked Sessions */}
        <div className="bg-[#161618] border border-[#242426] p-4 flex flex-col justify-between rounded-sm">
          <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest font-mono">Blocked Sessions</span>
          <div className="flex items-end justify-between mt-2">
            <span className={`text-4xl font-mono ${metrics.blocked_sessions.length > 0 ? "text-red-400" : "text-white"}`}>
              {metrics.blocked_sessions.length}
            </span>
            <span className={`text-[10px] font-mono ${metrics.blocked_sessions.length > 0 ? "text-red-400" : "text-zinc-500"}`}>
              {metrics.blocked_sessions.length > 0 ? "Lock Contention" : "Optimal"}
            </span>
          </div>
        </div>

        {/* SYSSTAT Executes */}
        <div className="bg-[#161618] border border-[#242426] p-4 flex flex-col justify-between rounded-sm">
          <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest font-mono">SYSSTAT Executes</span>
          <div className="flex items-end justify-between mt-2">
            <span className="text-4xl font-mono text-white">
              {(metrics.sysstat_execute_count / 1000000).toFixed(2)}
              <span className="text-lg text-zinc-600">M</span>
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">Total SQL</span>
          </div>
        </div>
      </div>

      {/* Tablespaces & Wait Events Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tablespace Usage Distribution */}
        <div className="bg-[#161618] border border-[#242426] rounded-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-[#242426] flex justify-between items-center">
            <h2 className="text-[11px] uppercase font-bold tracking-widest text-zinc-400 flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-500" />
              <span>Tablespace Usage Distribution</span>
            </h2>
            <span className="text-[10px] font-mono text-zinc-500">DBA_TABLESPACE_USAGE_METRICS</span>
          </div>

          <div className="p-5 space-y-5 flex-1">
            {metrics.tablespaces.map((ts) => {
              const isHigh = ts.used_pct >= 90;
              const isWarn = ts.used_pct >= 80;
              const barClass = isHigh
                ? "bg-red-600 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                : isWarn
                ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                : "bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.4)]";

              const textClass = isHigh ? "text-red-400" : isWarn ? "text-amber-400" : "text-zinc-400";

              return (
                <div key={ts.name} className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-mono uppercase">
                    <span className="text-white font-bold flex items-center gap-2">
                      <span>{ts.name}</span>
                      {isHigh && (
                        <span className="text-[9px] bg-red-500/10 text-red-500 px-1.5 py-0.2 rounded border border-red-500/30">
                          CRITICAL
                        </span>
                      )}
                    </span>
                    <span className={textClass}>
                      {ts.total_mb - ts.free_mb}MB / {ts.total_mb}MB ({ts.used_pct}%)
                    </span>
                  </div>
                  <div className="h-2 bg-[#242426] rounded-full overflow-hidden">
                    <div
                      className={`h-full ${barClass} transition-all duration-500`}
                      style={{ width: `${Math.min(100, ts.used_pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* System Wait Events */}
        <div className="bg-[#161618] border border-[#242426] rounded-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-[#242426] flex justify-between items-center">
            <h2 className="text-[11px] uppercase font-bold tracking-widest text-zinc-400 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <span>System Wait Events (Latency ms)</span>
            </h2>
            <span className="text-[10px] font-mono text-zinc-500">V$SYSTEM_EVENT</span>
          </div>

          <div className="p-4 h-64 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.wait_events} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <XAxis type="number" unit=" ms" stroke="#52525b" fontSize={10} fontFamily="monospace" />
                <YAxis dataKey="event_name" type="category" width={140} stroke="#a1a1aa" fontSize={10} fontFamily="monospace" />
                <Tooltip
                  formatter={(val: number) => [`${val} ms`, "Total Wait Time"]}
                  contentStyle={{ backgroundColor: "#0c0c0d", borderRadius: "2px", border: "1px solid #242426", color: "#e0e0e0", fontSize: "11px", fontFamily: "monospace" }}
                />
                <Bar dataKey="total_wait_time_ms" radius={[0, 2, 2, 0]}>
                  {metrics.wait_events.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.total_wait_time_ms > 1000 ? "#ef4444" : "#2563eb"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Lock Contention Table */}
      {metrics.blocked_sessions.length > 0 && (
        <div className="bg-[#161618] border border-red-500/40 rounded-sm overflow-hidden">
          <div className="px-4 py-3 bg-red-500/10 border-b border-red-500/30 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-500" />
            <h2 className="text-[11px] uppercase font-bold tracking-widest text-red-400 font-mono">
              Lock Contention & Blocked Sessions (V$LOCK)
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="text-[9px] uppercase font-mono text-zinc-500 bg-[#111112]">
                <tr>
                  <th className="p-3 border-b border-[#242426]">Blocked SID</th>
                  <th className="p-3 border-b border-[#242426]">Blocking Root SID</th>
                  <th className="p-3 border-b border-[#242426]">Wait Event</th>
                  <th className="p-3 border-b border-[#242426]">Wait Time</th>
                  <th className="p-3 border-b border-[#242426]">DBA Action</th>
                </tr>
              </thead>
              <tbody className="text-[11px] font-mono text-zinc-300">
                {metrics.blocked_sessions.map((b) => (
                  <tr key={b.blocked_sid} className="hover:bg-zinc-800/50 transition-colors border-b border-[#242426]">
                    <td className="p-3 text-red-400 font-bold">SID #{b.blocked_sid}</td>
                    <td className="p-3 text-amber-400 font-bold">SID #{b.blocking_sid}</td>
                    <td className="p-3 text-zinc-300">{b.wait_event}</td>
                    <td className="p-3 text-red-400">{b.sec_in_wait}s</td>
                    <td className="p-3">
                      <code className="bg-[#0c0c0d] text-amber-300 px-2 py-1 rounded border border-[#242426]">
                        ALTER SYSTEM KILL SESSION '{b.blocking_sid},...';
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rule Engine Health Evaluation List */}
      <div className="bg-[#161618] border border-[#242426] rounded-sm p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#242426] pb-3">
          <div>
            <h2 className="text-[11px] uppercase font-bold tracking-widest text-zinc-400 font-mono">
              Rule Engine Diagnostic Results
            </h2>
            <p className="text-[10px] font-mono text-zinc-500 mt-0.5">
              Evaluated at {health.evaluated_at} &bull; Total Rules: {health.total_rules}
            </p>
          </div>
          <span className="text-[10px] font-mono text-blue-400 bg-[#0c0c0d] px-2 py-1 rounded border border-[#242426]">
            rules.yaml
          </span>
        </div>

        <div className="space-y-3">
          {health.rule_results.map((rule) => {
            return (
              <div
                key={rule.rule_id}
                className={`p-4 rounded-sm border transition-all ${
                  rule.severity === "CRITICAL"
                    ? "bg-red-500/5 border-red-500/30"
                    : rule.severity === "WARNING"
                    ? "bg-amber-500/5 border-amber-500/30"
                    : "bg-[#0c0c0d] border-[#242426]"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-start gap-3">
                    {rule.severity === "OK" ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                    ) : rule.severity === "WARNING" ? (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    )}

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-xs text-white font-mono">{rule.rule_name}</h3>
                        <span className="text-[10px] text-zinc-500 font-mono">({rule.rule_id})</span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">{rule.message}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-start sm:self-center font-mono">
                    <span className="text-[10px] text-zinc-500">Weight: {rule.weight}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase border ${
                        rule.severity === "OK"
                          ? "bg-green-500/10 text-green-500 border-green-500/30"
                          : rule.severity === "WARNING"
                          ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
                          : "bg-red-500/10 text-red-500 border-red-500/30"
                      }`}
                    >
                      {rule.severity}
                    </span>
                  </div>
                </div>

                {rule.severity !== "OK" && (
                  <div className="mt-3 pt-3 border-t border-[#242426] text-xs">
                    <span className="font-mono text-[10px] text-amber-400 uppercase tracking-wider block mb-1">
                      💡 DBA Action Plan:
                    </span>
                    <p className="text-zinc-300 bg-[#161618] p-2.5 rounded border border-[#242426] font-mono text-[11px]">
                      {rule.recommendation}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
