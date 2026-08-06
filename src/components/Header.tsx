import React from "react";
import { Database, Zap, Server } from "lucide-react";
import { HealthReportData } from "../types";

interface HeaderProps {
  health: HealthReportData | null;
  loadScenario: string;
  onSelectScenario: (scenario: string) => void;
  providerMode: string;
  onSelectProviderMode: (mode: string) => void;
  activeProvider: string;
}

export const Header: React.FC<HeaderProps> = ({
  health,
  loadScenario,
  onSelectScenario,
  providerMode,
  onSelectProviderMode,
  activeProvider
}) => {
  const getScoreColor = (score: number = 100) => {
    if (score >= 88) return "text-blue-400";
    if (score >= 70) return "text-amber-400";
    return "text-red-400";
  };

  const getStatusBadge = (status: string = "HEALTHY") => {
    if (status === "HEALTHY") return "bg-green-500/10 text-green-500 border-green-500/30";
    if (status === "DEGRADED") return "bg-amber-500/10 text-amber-500 border-amber-500/30";
    return "bg-red-500/10 text-red-500 border-red-500/30";
  };

  return (
    <header className="h-16 flex items-center justify-between px-6 border-b border-[#242426] bg-[#111112] text-[#e0e0e0] sticky top-0 z-50">
      {/* Branding */}
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 bg-blue-600 flex items-center justify-center rounded-sm shrink-0 shadow-[0_0_10px_rgba(37,99,235,0.4)]">
          <span className="text-white font-bold text-xs">BA</span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold tracking-wider uppercase text-white">
              Oracle DB Health Suite <span className="text-blue-500">v1.2.0</span>
            </h1>
            <span className="text-[10px] bg-[#161618] text-zinc-400 font-mono px-2 py-0.5 rounded-sm border border-[#242426]">
              Oracle 19c & XE
            </span>
          </div>
          <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-tighter">
            Environment: Bank of Abyssinia / Production (19c)
          </p>
        </div>
      </div>

      {/* Center Controls */}
      <div className="hidden lg:flex items-center gap-3">
        {/* Load Scenario Selector */}
        <div className="flex items-center gap-2 bg-[#161618] px-3 py-1.5 rounded-sm border border-[#242426]">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[10px] text-zinc-500 uppercase font-mono">Load Scenario:</span>
          <select
            value={loadScenario}
            onChange={(e) => onSelectScenario(e.target.value)}
            className="bg-[#0c0c0d] text-zinc-200 text-xs font-mono rounded px-2 py-0.5 border border-[#242426] focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="NORMAL">🟢 Normal Operation</option>
            <option value="HIGH_IO_WAIT">⚡ High I/O Wait Spike</option>
            <option value="LOCK_CONTENTION">🔒 Lock Contention (Enq: TX)</option>
            <option value="TABLESPACE_CRITICAL">🚨 Tablespace Critical (&gt;95%)</option>
          </select>
        </div>

        {/* Data Source Switcher */}
        <div className="flex items-center gap-2 bg-[#161618] px-3 py-1.5 rounded-sm border border-[#242426]">
          <Server className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-[10px] text-zinc-500 uppercase font-mono">Provider:</span>
          <select
            value={providerMode}
            onChange={(e) => onSelectProviderMode(e.target.value)}
            className="bg-[#0c0c0d] text-zinc-200 text-xs font-mono rounded px-2 py-0.5 border border-[#242426] focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="FALLBACK_AUTO">🔄 Auto (Prometheus w/ SQL Fallback)</option>
            <option value="PROMETHEUS">📊 Prometheus PromQL Only</option>
            <option value="ORACLE_SQL">🛢️ Direct Oracle SQL Only</option>
          </select>
        </div>
      </div>

      {/* Right Provider Status & Score */}
      <div className="flex items-center gap-6">
        <div className="hidden sm:flex flex-col items-end">
          <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Provider Status</span>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]"></span>
            <span className="text-[11px] font-mono text-green-500 tracking-wider uppercase">{activeProvider}</span>
          </div>
        </div>

        <div className="w-px h-8 bg-[#242426] hidden sm:block"></div>

        <div className="flex items-center gap-3">
          <div className="bg-[#161618] border border-[#242426] px-3 py-1 rounded-sm flex items-center gap-2">
            <div className="flex flex-col items-end">
              <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-mono">Score</span>
              <span className={`text-xl font-mono font-bold ${getScoreColor(health?.health_score)}`}>
                {health ? health.health_score : "--"}
                <span className="text-xs text-zinc-600">/100</span>
              </span>
            </div>
            <span className={`text-[9px] font-mono uppercase font-bold px-1.5 py-0.5 rounded border ${getStatusBadge(health?.status)}`}>
              {health ? health.status : "INIT"}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

