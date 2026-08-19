import React, { useState, useEffect } from "react";
import { Database, Zap, Server, Sun, Moon, Clock, RefreshCw } from "lucide-react";
import { HealthReportData } from "../types";
import { useTheme } from "../context/ThemeContext";

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
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";

  const [secondsAgo, setSecondsAgo] = useState<number | null>(null);

  // Track relative seconds since last background evaluation
  useEffect(() => {
    if (!health?.evaluated_at) {
      setSecondsAgo(null);
      return;
    }

    const updateAge = () => {
      const evalTimestamp = new Date(health.evaluated_at).getTime();
      if (!isNaN(evalTimestamp)) {
        const diff = Math.max(0, Math.floor((Date.now() - evalTimestamp) / 1000));
        setSecondsAgo(diff);
      }
    };

    updateAge();
    const interval = setInterval(updateAge, 1000);
    return () => clearInterval(interval);
  }, [health?.evaluated_at]);

  const formatEvaluatedTime = (isoString?: string) => {
    if (!isoString) return "--:--:--";
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      });
    } catch {
      return "--:--:--";
    }
  };

  const getScoreColor = (score: number = 100) => {
    if (score >= 88) return isLight ? "text-blue-600" : "text-blue-400";
    if (score >= 70) return isLight ? "text-amber-600" : "text-amber-400";
    return isLight ? "text-red-600" : "text-red-400";
  };

  const getStatusBadge = (status: string = "HEALTHY") => {
    if (status === "HEALTHY") return isLight ? "bg-emerald-100 text-emerald-700 border-emerald-300" : "bg-green-500/10 text-green-500 border-green-500/30";
    if (status === "DEGRADED") return isLight ? "bg-amber-100 text-amber-700 border-amber-300" : "bg-amber-500/10 text-amber-500 border-amber-500/30";
    return isLight ? "bg-rose-100 text-rose-700 border-rose-300" : "bg-red-500/10 text-red-500 border-red-500/30";
  };

  return (
    <header className={`h-16 flex items-center justify-between px-6 border-b sticky top-0 z-50 transition-colors ${
      isLight ? "bg-white border-slate-200 text-slate-800 shadow-sm" : "bg-[#111112] border-[#242426] text-[#e0e0e0]"
    }`}>
      {/* Branding */}
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 bg-blue-600 flex items-center justify-center rounded-sm shrink-0 shadow-[0_0_10px_rgba(37,99,235,0.4)]">
          <span className="text-white font-bold text-xs">BA</span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className={`text-sm font-bold tracking-wider uppercase ${isLight ? "text-slate-900" : "text-white"}`}>
              Oracle DB Health Suite <span className="text-blue-500">v1.2.0</span>
            </h1>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-sm border ${
              isLight ? "bg-slate-100 text-slate-600 border-slate-200" : "bg-[#161618] text-zinc-400 border-[#242426]"
            }`}>
              Oracle 19c & XE
            </span>
          </div>
          <p className={`text-[10px] font-mono uppercase tracking-tighter ${isLight ? "text-slate-500" : "text-zinc-500"}`}>
            Environment: Bank of Abyssinia / Production (19c)
          </p>
        </div>
      </div>

      {/* Center Controls */}
      <div className="hidden lg:flex items-center gap-3">
        {/* Load Scenario Selector */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-sm border ${
          isLight ? "bg-slate-100 border-slate-200" : "bg-[#161618] border-[#242426]"
        }`}>
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          <span className={`text-[10px] uppercase font-mono ${isLight ? "text-slate-500" : "text-zinc-500"}`}>Load Scenario:</span>
          <select
            value={loadScenario}
            onChange={(e) => onSelectScenario(e.target.value)}
            className={`text-xs font-mono rounded px-2 py-0.5 border focus:outline-none focus:border-blue-500 cursor-pointer ${
              isLight ? "bg-white text-slate-800 border-slate-300" : "bg-[#0c0c0d] text-zinc-200 border-[#242426]"
            }`}
          >
            <option value="NORMAL">🟢 Normal Operation</option>
            <option value="HIGH_IO_WAIT">⚡ High I/O Wait Spike</option>
            <option value="LOCK_CONTENTION">🔒 Lock Contention (Enq: TX)</option>
            <option value="TABLESPACE_CRITICAL">🚨 Tablespace Critical (&gt;95%)</option>
          </select>
        </div>

        {/* Data Source Switcher */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-sm border ${
          isLight ? "bg-slate-100 border-slate-200" : "bg-[#161618] border-[#242426]"
        }`}>
          <Server className="w-3.5 h-3.5 text-blue-500" />
          <span className={`text-[10px] uppercase font-mono ${isLight ? "text-slate-500" : "text-zinc-500"}`}>Provider:</span>
          <select
            value={providerMode}
            onChange={(e) => onSelectProviderMode(e.target.value)}
            className={`text-xs font-mono rounded px-2 py-0.5 border focus:outline-none focus:border-blue-500 cursor-pointer ${
              isLight ? "bg-white text-slate-800 border-slate-300" : "bg-[#0c0c0d] text-zinc-200 border-[#242426]"
            }`}
          >
            <option value="FALLBACK_AUTO">🔄 Auto (Prometheus w/ SQL Fallback)</option>
            <option value="PROMETHEUS">📊 Prometheus PromQL Only</option>
            <option value="ORACLE_SQL">🛢️ Direct Oracle SQL Only</option>
          </select>
        </div>
      </div>

      {/* Right Provider Status, Last Evaluated, Theme Toggle & Score */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Last Evaluated Timestamp Display */}
        <div
          title={health?.evaluated_at ? `Full Timestamp: ${health.evaluated_at}` : "Awaiting health evaluation..."}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-sm border transition-colors ${
            isLight ? "bg-slate-50 border-slate-200 text-slate-700" : "bg-[#161618] border-[#242426] text-zinc-300"
          }`}
        >
          <Clock className={`w-3.5 h-3.5 shrink-0 ${isLight ? "text-blue-600" : "text-blue-400"}`} />
          <div className="flex flex-col">
            <span className={`text-[9px] uppercase font-mono tracking-wider ${isLight ? "text-slate-500" : "text-zinc-500"}`}>
              Last Evaluated
            </span>
            <div className="flex items-center gap-1.5">
              <span className={`text-xs font-mono font-bold ${isLight ? "text-slate-800" : "text-zinc-200"}`}>
                {health?.evaluated_at ? formatEvaluatedTime(health.evaluated_at) : "--:--:--"}
              </span>
              {secondsAgo !== null && (
                <span
                  className={`text-[9px] font-mono font-semibold px-1 py-0.2 rounded border hidden sm:inline-block ${
                    secondsAgo < 10
                      ? isLight
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                        : "bg-emerald-950/40 text-emerald-400 border-emerald-500/30"
                      : isLight
                      ? "bg-amber-50 text-amber-700 border-amber-300"
                      : "bg-amber-950/40 text-amber-400 border-amber-500/30"
                  }`}
                >
                  {secondsAgo === 0 ? "just now" : `${secondsAgo}s ago`}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          aria-label={isLight ? "Switch to Dark Mode" : "Switch to Light Mode"}
          className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-sm border text-xs font-mono font-bold transition-all cursor-pointer ${
            isLight
              ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300 shadow-sm"
              : "bg-[#161618] hover:bg-[#242426] text-amber-400 border-[#242426]"
          }`}
          title={isLight ? "Switch to Dark Mode" : "Switch to Light Mode"}
        >
          {isLight ? (
            <>
              <Moon className="w-3.5 h-3.5 text-slate-700" />
              <span className="text-[11px] uppercase tracking-wider hidden sm:inline">Dark</span>
            </>
          ) : (
            <>
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] uppercase tracking-wider text-zinc-200 hidden sm:inline">Light</span>
            </>
          )}
        </button>

        <div className={`hidden xl:flex flex-col items-end ${isLight ? "text-slate-600" : "text-zinc-400"}`}>
          <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Provider</span>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]"></span>
            <span className={`text-[11px] font-mono tracking-wider uppercase ${isLight ? "text-emerald-700 font-bold" : "text-green-500"}`}>
              {activeProvider}
            </span>
          </div>
        </div>

        <div className={`w-px h-8 hidden sm:block ${isLight ? "bg-slate-200" : "bg-[#242426]"}`}></div>

        <div className="flex items-center gap-3">
          <div className={`border px-3 py-1 rounded-sm flex items-center gap-2 ${
            isLight ? "bg-slate-50 border-slate-200" : "bg-[#161618] border-[#242426]"
          }`}>
            <div className="flex flex-col items-end">
              <span className={`text-[9px] uppercase tracking-widest font-mono ${isLight ? "text-slate-500" : "text-zinc-500"}`}>Score</span>
              <span className={`text-xl font-mono font-bold ${getScoreColor(health?.health_score)}`}>
                {health ? health.health_score : "--"}
                <span className={`text-xs ${isLight ? "text-slate-400" : "text-zinc-600"}`}>/100</span>
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

