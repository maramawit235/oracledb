import React, { useState } from "react";
import { Terminal, Play, CheckCircle2, Server, Globe } from "lucide-react";

export const ApiConsoleTab: React.FC = () => {
  const [activeEndpoint, setActiveEndpoint] = useState<string>("/api/health");
  const [responseJson, setResponseJson] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const fetchEndpoint = async (endpoint: string) => {
    setActiveEndpoint(endpoint);
    setLoading(true);
    try {
      const res = await fetch(endpoint);
      if (endpoint.includes("report")) {
        const text = await res.text();
        setResponseJson(text.slice(0, 1500) + "\n\n... [Truncated HTML Response] ...");
      } else {
        const data = await res.json();
        setResponseJson(JSON.stringify(data, null, 2));
      }
    } catch (e) {
      setResponseJson(JSON.stringify({ error: String(e) }, null, 2));
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchEndpoint("/api/health");
  }, []);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#161618] text-[#e0e0e0] p-6 rounded-sm border border-[#242426]">
        <div className="flex items-center space-x-3 mb-2">
          <Globe className="w-5 h-5 text-blue-500" />
          <h2 className="text-sm font-bold uppercase tracking-wider font-mono text-white">FastAPI REST Console & Swagger API Tester (Part 6)</h2>
        </div>
        <p className="text-xs text-zinc-400 max-w-3xl font-mono">
          The monitoring suite exposes production REST API endpoints (<code className="font-mono text-xs text-amber-400 bg-[#0c0c0d] px-1.5 py-0.5 rounded border border-[#242426]">api.py</code>) built with FastAPI & Uvicorn. Test endpoints live below.
        </p>
      </div>

      {/* Endpoint Selector Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => fetchEndpoint("/api/health")}
          className={`px-4 py-2 rounded-sm font-bold font-mono text-xs flex items-center space-x-2 border transition-all cursor-pointer ${
            activeEndpoint === "/api/health"
              ? "bg-blue-600/10 text-blue-400 border-blue-500 shadow-[0_0_8px_rgba(37,99,235,0.3)]"
              : "bg-[#161618] text-zinc-400 border-[#242426] hover:bg-[#242426]"
          }`}
        >
          <span className="bg-blue-500/10 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded text-[10px] uppercase font-mono">GET</span>
          <span>/health</span>
        </button>

        <button
          onClick={() => fetchEndpoint("/api/metrics")}
          className={`px-4 py-2 rounded-sm font-bold font-mono text-xs flex items-center space-x-2 border transition-all cursor-pointer ${
            activeEndpoint === "/api/metrics"
              ? "bg-blue-600/10 text-blue-400 border-blue-500 shadow-[0_0_8px_rgba(37,99,235,0.3)]"
              : "bg-[#161618] text-zinc-400 border-[#242426] hover:bg-[#242426]"
          }`}
        >
          <span className="bg-blue-500/10 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded text-[10px] uppercase font-mono">GET</span>
          <span>/metrics</span>
        </button>

        <button
          onClick={() => fetchEndpoint("/api/alerts")}
          className={`px-4 py-2 rounded-sm font-bold font-mono text-xs flex items-center space-x-2 border transition-all cursor-pointer ${
            activeEndpoint === "/api/alerts"
              ? "bg-blue-600/10 text-blue-400 border-blue-500 shadow-[0_0_8px_rgba(37,99,235,0.3)]"
              : "bg-[#161618] text-zinc-400 border-[#242426] hover:bg-[#242426]"
          }`}
        >
          <span className="bg-blue-500/10 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded text-[10px] uppercase font-mono">GET</span>
          <span>/alerts</span>
        </button>

        <button
          onClick={() => fetchEndpoint("/api/report/html")}
          className={`px-4 py-2 rounded-sm font-bold font-mono text-xs flex items-center space-x-2 border transition-all cursor-pointer ${
            activeEndpoint === "/api/report/html"
              ? "bg-blue-600/10 text-blue-400 border-blue-500 shadow-[0_0_8px_rgba(37,99,235,0.3)]"
              : "bg-[#161618] text-zinc-400 border-[#242426] hover:bg-[#242426]"
          }`}
        >
          <span className="bg-blue-500/10 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded text-[10px] uppercase font-mono">GET</span>
          <span>/report</span>
        </button>
      </div>

      {/* JSON Response Window */}
      <div className="bg-[#0c0c0d] text-zinc-100 rounded-sm border border-[#242426] overflow-hidden font-mono text-xs">
        <div className="bg-[#111112] px-4 py-2.5 border-b border-[#242426] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_6px_#22c55e]"></span>
            <span className="text-zinc-300 font-bold">{activeEndpoint}</span>
          </div>
          <span className="text-green-400 font-bold">200 OK</span>
        </div>

        <pre className="p-5 overflow-x-auto text-amber-300 leading-relaxed max-h-[500px]">
          {loading ? "Fetching endpoint response..." : responseJson}
        </pre>
      </div>
    </div>
  );
};
