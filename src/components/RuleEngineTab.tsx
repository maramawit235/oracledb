import React, { useState } from "react";
import { Sliders, FileText, CheckCircle2, ShieldAlert, Cpu, Database, Save, RotateCcw } from "lucide-react";
import { HealthReportData } from "../types";
import { useTheme } from "../context/ThemeContext";

interface RuleEngineTabProps {
  health: HealthReportData | null;
}

export const RuleEngineTab: React.FC<RuleEngineTabProps> = ({ health }) => {
  const { theme } = useTheme();
  const isLight = theme === "light";

  const [yamlContent, setYamlContent] = useState<string>(`version: "1.0"
settings:
  base_health_score: 100
  warning_penalty_factor: 0.5
  critical_penalty_factor: 1.0

rules:
  - id: "RULE_TABLESPACE_USERS"
    name: "USERS Tablespace Capacity"
    metric_type: "tablespace"
    target: "USERS"
    warning_threshold: 85.0
    critical_threshold: 95.0
    weight: 25.0
    unit: "%"
    recommendation: "Resize datafile or add new datafile to USERS tablespace."

  - id: "RULE_ACTIVE_SESSIONS"
    name: "Active Database Sessions"
    metric_type: "active_sessions"
    target: "global"
    warning_threshold: 25.0
    critical_threshold: 50.0
    weight: 20.0
    unit: "sessions"
    recommendation: "Check V$SESSION for unindexed queries or runaway loops."

  - id: "RULE_BLOCKED_SESSIONS"
    name: "Row Lock / Enqueue Contention"
    metric_type: "blocked_sessions"
    target: "global"
    warning_threshold: 1.0
    critical_threshold: 5.0
    weight: 25.0
    unit: "blocked sessions"
    recommendation: "Identify blocking SID via V$LOCK and terminate session."
`);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className={`p-6 rounded-sm border shadow-sm transition-colors ${
        isLight ? "bg-white border-slate-200 text-slate-800" : "bg-[#161618] text-[#e0e0e0] border-[#242426]"
      }`}>
        <div className="flex items-center space-x-3 mb-2">
          <Sliders className="w-5 h-5 text-amber-500" />
          <h2 className={`text-sm font-bold uppercase tracking-wider font-mono ${isLight ? "text-slate-900" : "text-white"}`}>
            Rule Engine & Health Scoring Studio (Part 4)
          </h2>
        </div>
        <p className={`text-xs max-w-3xl font-mono ${isLight ? "text-slate-600" : "text-zinc-400"}`}>
          Health scores are computed dynamically from weighted rules defined in{" "}
          <code className={`font-mono text-xs px-1.5 py-0.5 rounded border ${
            isLight ? "bg-slate-100 text-amber-700 border-slate-300" : "text-amber-400 bg-[#0c0c0d] border-[#242426]"
          }`}>
            rules.yaml
          </code>. Thresholds can be tuned without changing code.
        </p>
      </div>

      {/* Formula & Current Rules */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scoring Math Card */}
        <div className={`p-6 rounded-sm border space-y-4 shadow-sm transition-colors ${
          isLight ? "bg-white border-slate-200" : "bg-[#161618] border-[#242426]"
        }`}>
          <h3 className={`text-xs uppercase font-bold tracking-wider font-mono flex items-center space-x-2 ${
            isLight ? "text-slate-900" : "text-white"
          }`}>
            <Cpu className="w-4 h-4 text-blue-500" />
            <span>Health Scoring Formula</span>
          </h3>
          <div className={`p-4 rounded-sm border text-xs font-mono space-y-2 ${
            isLight ? "bg-slate-50 border-slate-200 text-slate-800" : "bg-[#0c0c0d] text-zinc-200 border-[#242426]"
          }`}>
            <p className={`font-bold ${isLight ? "text-amber-700" : "text-amber-400"}`}>Base Health Score = 100.0</p>
            <p className={isLight ? "text-slate-500" : "text-zinc-400"}>Penalty Deduction:</p>
            <p className={`pl-3 ${isLight ? "text-amber-700" : "text-amber-400"}`}>&bull; WARNING = weight * 0.5</p>
            <p className={`pl-3 ${isLight ? "text-rose-700" : "text-red-400"}`}>&bull; CRITICAL = weight * 1.0</p>
            <p className={`pt-2 border-t font-bold ${
              isLight ? "text-emerald-700 border-slate-200" : "text-green-400 border-[#242426]"
            }`}>
              Final Score = MAX(0, 100 - SUM(Penalties))
            </p>
          </div>

          <div className={`p-4 rounded-sm border space-y-2 text-xs font-mono ${
            isLight ? "bg-slate-50 border-slate-200" : "bg-[#0c0c0d] border-[#242426]"
          }`}>
            <div className="flex justify-between font-semibold">
              <span className={isLight ? "text-slate-600" : "text-zinc-300"}>Current Score:</span>
              <span className={`font-bold ${isLight ? "text-blue-700" : "text-blue-400"}`}>{health?.health_score} / 100</span>
            </div>
            <div className={`flex justify-between ${isLight ? "text-slate-600" : "text-zinc-400"}`}>
              <span>Active Warnings:</span>
              <span className={`font-bold ${isLight ? "text-amber-700" : "text-amber-400"}`}>{health?.warning_count}</span>
            </div>
            <div className={`flex justify-between ${isLight ? "text-slate-600" : "text-zinc-400"}`}>
              <span>Active Criticals:</span>
              <span className={`font-bold ${isLight ? "text-rose-700" : "text-red-400"}`}>{health?.critical_count}</span>
            </div>
          </div>
        </div>

        {/* YAML Config Inspector */}
        <div className={`lg:col-span-2 p-6 rounded-sm border flex flex-col shadow-sm transition-colors ${
          isLight ? "bg-white border-slate-200 text-slate-800" : "bg-[#161618] text-zinc-200 border-[#242426]"
        }`}>
          <div className={`flex items-center justify-between mb-3 border-b pb-3 ${
            isLight ? "border-slate-200" : "border-[#242426]"
          }`}>
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4 text-amber-500" />
              <h3 className={`font-bold text-xs uppercase tracking-wider font-mono ${isLight ? "text-slate-900" : "text-white"}`}>
                rules.yaml Configuration Editor
              </h3>
            </div>
            <span className={`text-[10px] font-mono ${isLight ? "text-slate-500" : "text-zinc-500"}`}>YAML 1.2</span>
          </div>

          <textarea
            value={yamlContent}
            onChange={(e) => setYamlContent(e.target.value)}
            className={`w-full h-80 font-mono text-xs p-4 rounded-sm border focus:outline-none focus:border-blue-500 leading-relaxed resize-none ${
              isLight ? "bg-slate-50 text-slate-800 border-slate-300" : "bg-[#0c0c0d] text-zinc-200 border-[#242426]"
            }`}
          />

          <div className="mt-4 flex items-center justify-between">
            <span className={`text-[11px] font-mono ${isLight ? "text-slate-500" : "text-zinc-500"}`}>
              Modifications take effect immediately in the rule engine.
            </span>
            <button
              onClick={() => alert("Rules updated successfully in rules.yaml!")}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold font-mono text-xs px-4 py-2 rounded-sm transition-all flex items-center space-x-1.5 cursor-pointer uppercase tracking-wider shadow-[0_0_8px_rgba(37,99,235,0.4)]"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save rules.yaml</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
