import React from "react";
import { Server, Database, CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck, Cpu } from "lucide-react";

interface ProviderTabProps {
  providerMode: string;
  onSelectProviderMode: (mode: string) => void;
  activeProvider: string;
}

export const ProviderTab: React.FC<ProviderTabProps> = ({
  providerMode,
  onSelectProviderMode,
  activeProvider
}) => {
  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-[#161618] text-[#e0e0e0] p-6 rounded-sm border border-[#242426]">
        <div className="flex items-center space-x-3 mb-2">
          <Server className="w-5 h-5 text-blue-500" />
          <h2 className="text-sm font-bold tracking-wider uppercase font-mono">MetricsProvider Abstraction Layer (Part 2)</h2>
        </div>
        <p className="text-xs text-zinc-400 max-w-3xl leading-relaxed">
          Implements the Provider Pattern via an Abstract Base Class (<code className="text-amber-400 font-mono text-xs bg-[#0c0c0d] px-1.5 py-0.5 rounded border border-[#242426]">MetricsProvider</code>).
          The factory dynamically probes Prometheus on startup; if unreachable or firewalled, it automatically seamlessly falls back to direct Oracle SQL queries via <code className="text-amber-400 font-mono text-xs bg-[#0c0c0d] px-1.5 py-0.5 rounded border border-[#242426]">python-oracledb</code> thin mode.
        </p>
      </div>

      {/* Mode Controls & Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Primary Source */}
        <div className={`p-6 rounded-sm border ${
          activeProvider === "PrometheusProvider" ? "bg-[#161618] border-blue-500/50" : "bg-[#161618] border-[#242426]"
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-blue-500/10 text-blue-400 rounded">
                <Server className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white text-xs uppercase tracking-wider font-mono">1. PrometheusProvider</h3>
            </div>
            {activeProvider === "PrometheusProvider" && (
              <span className="bg-green-500/10 text-green-500 border border-green-500/30 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_6px_#22c55e]"></span> ACTIVE
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 mb-4">
            Queries Prometheus HTTP REST API (<code className="font-mono text-zinc-300">/api/v1/query</code>) using PromQL instant queries against metrics exported by <code className="font-mono text-zinc-300">oracledb_exporter</code>.
          </p>
          <div className="bg-[#0c0c0d] text-zinc-200 p-3 rounded border border-[#242426] font-mono text-xs space-y-1">
            <p className="text-zinc-500"># Sample PromQL Query:</p>
            <p className="text-amber-300">oracledb_sessions_value&#123;status="ACTIVE"&#125;</p>
            <p className="text-blue-400">oracledb_tablespace_used_percentage</p>
          </div>
        </div>

        {/* Fallback Source */}
        <div className={`p-6 rounded-sm border ${
          activeProvider === "OracleSQLProvider" ? "bg-[#161618] border-amber-500/50" : "bg-[#161618] border-[#242426]"
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-amber-500/10 text-amber-400 rounded">
                <Database className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white text-xs uppercase tracking-wider font-mono">2. OracleSQLProvider (Fallback)</h3>
            </div>
            {activeProvider === "OracleSQLProvider" && (
              <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> ACTIVE (FALLBACK)
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 mb-4">
            Connects directly to Oracle Database (XE / 19c) in python-oracledb thin mode using the <code className="font-mono font-bold text-zinc-300">monitor</code> account created in Part 1.
          </p>
          <div className="bg-[#0c0c0d] text-zinc-200 p-3 rounded border border-[#242426] font-mono text-xs space-y-1">
            <p className="text-zinc-500">-- Direct V$ View Query:</p>
            <p className="text-green-400">SELECT COUNT(*) FROM V$SESSION WHERE STATUS = 'ACTIVE'</p>
          </div>
        </div>
      </div>

      {/* Thin Mode Timeout Warning Box */}
      <div className="bg-[#161618] border border-amber-500/30 rounded-sm p-6">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-amber-400 text-xs font-mono uppercase tracking-wider">
              CRITICAL ARCHITECTURAL REQUIREMENT: Oracle Thin-Mode Timeout Handling
            </h3>
            <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
              In <code className="font-mono font-bold text-amber-300">python-oracledb</code> thin mode, connecting to an unreachable or firewalled host without specifying explicit socket timeouts can cause Python to block indefinitely or fail silently without raising a connection exception.
            </p>
            <div className="mt-3 bg-[#0c0c0d] text-zinc-200 p-3.5 rounded border border-[#242426] font-mono text-xs space-y-1">
              <p className="text-zinc-500"># Enforcing explicit connection timeout & probe test in providers.py:</p>
              <p className="text-amber-300">
                conn = oracledb.connect(user=user, password=pass, dsn=dsn, <span className="text-red-400 font-bold underline">tcp_connect_timeout=5</span>, expire_time=2)
              </p>
              <p className="text-green-400">
                # Connectivity Probe:
              </p>
              <p className="text-zinc-300">
                cursor.execute("SELECT 1 FROM DUAL")
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Source Simulator */}
      <div className="bg-[#161618] p-6 rounded-sm border border-[#242426]">
        <h3 className="font-bold text-white text-xs uppercase tracking-wider font-mono mb-2">Simulate Provider Outage & Failover</h3>
        <p className="text-xs text-zinc-400 mb-4">
          Select a provider mode below to simulate a Prometheus network outage or test direct Oracle SQL fallback behavior in real-time.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => onSelectProviderMode("FALLBACK_AUTO")}
            className={`p-4 rounded-sm border text-left transition-all cursor-pointer ${
              providerMode === "FALLBACK_AUTO"
                ? "bg-blue-600/10 border-blue-500 text-white"
                : "bg-[#0c0c0d] text-zinc-400 border-[#242426] hover:bg-[#242426]"
            }`}
          >
            <div className="font-bold text-xs font-mono uppercase text-blue-400">🔄 Auto-Fallback Mode</div>
            <div className="text-[11px] text-zinc-400 mt-1">Default behavior: Probe Prometheus first, fall back to Oracle SQL if down.</div>
          </button>

          <button
            onClick={() => onSelectProviderMode("PROMETHEUS")}
            className={`p-4 rounded-sm border text-left transition-all cursor-pointer ${
              providerMode === "PROMETHEUS"
                ? "bg-blue-600/10 border-blue-500 text-white"
                : "bg-[#0c0c0d] text-zinc-400 border-[#242426] hover:bg-[#242426]"
            }`}
          >
            <div className="font-bold text-xs font-mono uppercase text-blue-400">📊 Prometheus PromQL Only</div>
            <div className="text-[11px] text-zinc-400 mt-1">Force metric collection via Prometheus exporter REST API.</div>
          </button>

          <button
            onClick={() => onSelectProviderMode("ORACLE_SQL")}
            className={`p-4 rounded-sm border text-left transition-all cursor-pointer ${
              providerMode === "ORACLE_SQL"
                ? "bg-amber-600/10 border-amber-500 text-white"
                : "bg-[#0c0c0d] text-zinc-400 border-[#242426] hover:bg-[#242426]"
            }`}
          >
            <div className="font-bold text-xs font-mono uppercase text-amber-400">🛢️ Direct Oracle SQL Only</div>
            <div className="text-[11px] text-zinc-400 mt-1">Force direct Oracle SQL queries via python-oracledb.</div>
          </button>
        </div>
      </div>
    </div>
  );
};
