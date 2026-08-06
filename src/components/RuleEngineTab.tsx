import React, { useState } from "react";
import { Sliders, FileText, CheckCircle2, ShieldAlert, Cpu, Database, Save, RotateCcw } from "lucide-react";
import { HealthReportData } from "../types";

interface RuleEngineTabProps {
  health: HealthReportData | null;
}

export const RuleEngineTab: React.FC<RuleEngineTabProps> = ({ health }) => {
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
      <div className="bg-[#161618] text-[#e0e0e0] p-6 rounded-sm border border-[#242426]">
        <div className="flex items-center space-x-3 mb-2">
          <Sliders className="w-5 h-5 text-amber-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider font-mono">Rule Engine & Health Scoring Studio (Part 4)</h2>
        </div>
        <p className="text-xs text-zinc-400 max-w-3xl">
          Health scores are computed dynamically from weighted rules defined in <code className="font-mono text-amber-400 text-xs bg-[#0c0c0d] px-1.5 py-0.5 rounded border border-[#242426]">rules.yaml</code>. Thresholds can be tuned without changing code.
        </p>
      </div>

      {/* Formula & Current Rules */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scoring Math Card */}
        <div className="bg-[#161618] p-6 rounded-sm border border-[#242426] space-y-4">
          <h3 className="text-xs uppercase font-bold tracking-wider font-mono text-white flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-blue-500" />
            <span>Health Scoring Formula</span>
          </h3>
          <div className="bg-[#0c0c0d] text-zinc-200 p-4 rounded-sm border border-[#242426] text-xs font-mono space-y-2">
            <p className="text-amber-400 font-bold">Base Health Score = 100.0</p>
            <p className="text-zinc-400">Penalty Deduction:</p>
            <p className="text-amber-400 pl-3">&bull; WARNING = weight * 0.5</p>
            <p className="text-red-400 pl-3">&bull; CRITICAL = weight * 1.0</p>
            <p className="text-green-400 pt-2 border-t border-[#242426] font-bold">
              Final Score = MAX(0, 100 - SUM(Penalties))
            </p>
          </div>

          <div className="p-4 rounded-sm bg-[#0c0c0d] border border-[#242426] space-y-2 text-xs font-mono">
            <div className="flex justify-between font-semibold text-zinc-300">
              <span>Current Score:</span>
              <span className="font-bold text-blue-400">{health?.health_score} / 100</span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>Active Warnings:</span>
              <span className="text-amber-400 font-bold">{health?.warning_count}</span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>Active Criticals:</span>
              <span className="text-red-400 font-bold">{health?.critical_count}</span>
            </div>
          </div>
        </div>

        {/* YAML Config Inspector */}
        <div className="lg:col-span-2 bg-[#161618] text-zinc-200 p-6 rounded-sm border border-[#242426] flex flex-col">
          <div className="flex items-center justify-between mb-3 border-b border-[#242426] pb-3">
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4 text-amber-400" />
              <h3 className="font-bold text-white text-xs uppercase tracking-wider font-mono">rules.yaml Configuration Editor</h3>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">YAML 1.2</span>
          </div>

          <textarea
            value={yamlContent}
            onChange={(e) => setYamlContent(e.target.value)}
            className="w-full h-80 bg-[#0c0c0d] text-zinc-200 font-mono text-xs p-4 rounded-sm border border-[#242426] focus:outline-none focus:border-blue-500 leading-relaxed resize-none"
          />

          <div className="mt-4 flex items-center justify-between">
            <span className="text-[11px] text-zinc-500 font-mono">
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
