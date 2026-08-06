import React from "react";
import { FileCode, Download, ExternalLink, ShieldCheck, Printer } from "lucide-react";

export const ReportTab: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#161618] text-[#e0e0e0] p-6 rounded-sm border border-[#242426] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <FileCode className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider font-mono text-white">Executive Report Generator (Part 6)</h2>
          </div>
          <p className="text-xs text-zinc-400 mt-1 max-w-2xl font-mono">
            Generates standalone production HTML executive summary reports with embedded tablespace capacity progress bars, rule breach analysis, and DBA action plans.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <a
            href="/api/report/html"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold font-mono text-xs px-4 py-2.5 rounded-sm transition-all flex items-center space-x-2 shadow-[0_0_8px_rgba(37,99,235,0.4)] cursor-pointer uppercase tracking-wider"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Open Standalone HTML Report</span>
          </a>
        </div>
      </div>

      {/* Embedded Live Report Preview Frame */}
      <div className="bg-[#161618] rounded-sm border border-[#242426] overflow-hidden">
        <div className="bg-[#111112] px-5 py-3 border-b border-[#242426] flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs text-zinc-400 font-mono">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_6px_#22c55e]"></span>
            <span>Live Generated Executive HTML Report Preview</span>
          </div>
          <span className="text-xs text-zinc-500 font-mono">GET /api/report/html</span>
        </div>

        <div className="p-2 h-[650px] bg-[#0c0c0d]">
          <iframe
            src="/api/report/html"
            title="Oracle DB Health Executive Report"
            className="w-full h-full rounded-sm border border-[#242426] bg-white"
          />
        </div>
      </div>
    </div>
  );
};
