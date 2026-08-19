import React from "react";
import { FileCode, Download, ExternalLink, ShieldCheck, Printer } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

export const ReportTab: React.FC = () => {
  const { theme } = useTheme();
  const isLight = theme === "light";

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className={`p-6 rounded-sm border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm transition-colors ${
        isLight ? "bg-white border-slate-200 text-slate-800" : "bg-[#161618] text-[#e0e0e0] border-[#242426]"
      }`}>
        <div>
          <div className="flex items-center space-x-2">
            <FileCode className="w-5 h-5 text-amber-500" />
            <h2 className={`text-sm font-bold uppercase tracking-wider font-mono ${isLight ? "text-slate-900" : "text-white"}`}>
              Executive Report Generator (Part 6)
            </h2>
          </div>
          <p className={`text-xs mt-1 max-w-2xl font-mono ${isLight ? "text-slate-600" : "text-zinc-400"}`}>
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
      <div className={`rounded-sm border overflow-hidden shadow-sm transition-colors ${
        isLight ? "bg-white border-slate-200" : "bg-[#161618] border-[#242426]"
      }`}>
        <div className={`px-5 py-3 border-b flex items-center justify-between ${
          isLight ? "bg-slate-50 border-slate-200" : "bg-[#111112] border-[#242426]"
        }`}>
          <div className={`flex items-center space-x-2 text-xs font-mono ${isLight ? "text-slate-700" : "text-zinc-400"}`}>
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_6px_#22c55e]"></span>
            <span>Live Generated Executive HTML Report Preview</span>
          </div>
          <span className={`text-xs font-mono ${isLight ? "text-slate-500" : "text-zinc-500"}`}>GET /api/report/html</span>
        </div>

        <div className={`p-2 h-[650px] ${isLight ? "bg-slate-100" : "bg-[#0c0c0d]"}`}>
          <iframe
            src="/api/report/html"
            title="Oracle DB Health Executive Report"
            className={`w-full h-full rounded-sm border bg-white ${
              isLight ? "border-slate-300" : "border-[#242426]"
            }`}
          />
        </div>
      </div>
    </div>
  );
};
