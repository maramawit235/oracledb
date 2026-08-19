import React, { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { DashboardTab } from "./components/DashboardTab";
import { RuleEngineTab } from "./components/RuleEngineTab";
import { AlertEngineTab } from "./components/AlertEngineTab";
import { ReportTab } from "./components/ReportTab";
import { AlertToastCenter } from "./components/AlertToastCenter";
import { useAlertToasts } from "./hooks/useAlertToasts";
import { useTheme } from "./context/ThemeContext";
import { HealthReportData } from "./types";
import { Activity, Sliders, Bell, FileCode } from "lucide-react";

export default function App() {
  const { theme } = useTheme();
  const isLight = theme === "light";

  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [loadScenario, setLoadScenario] = useState<string>("NORMAL");
  const [providerMode, setProviderMode] = useState<string>("FALLBACK_AUTO");
  const [activeProvider, setActiveProvider] = useState<string>("PrometheusProvider");
  const [healthData, setHealthData] = useState<HealthReportData | null>(null);
  const [metricsData, setMetricsData] = useState<any | null>(null);
  const { toasts, dismissToast, dismissAll } = useAlertToasts(healthData);

  // Fetch live health evaluation
  const fetchHealth = async () => {
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      setHealthData(data);
      if (data.active_provider) {
        setActiveProvider(data.active_provider);
      }
    } catch (e) {
      console.error("Failed fetching health data:", e);
    }
  };

  // Fetch live metrics
  const fetchMetrics = async () => {
    try {
      const res = await fetch("/api/metrics");
      const data = await res.json();
      setMetricsData(data);
    } catch (e) {
      console.error("Failed fetching raw metrics:", e);
    }
  };

  // Poll metrics every 3.5 seconds
  useEffect(() => {
    fetchHealth();
    fetchMetrics();
    const interval = setInterval(() => {
      fetchHealth();
      fetchMetrics();
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  // Handle Scenario Change
  const handleSelectScenario = async (scenario: string) => {
    setLoadScenario(scenario);
    try {
      await fetch("/api/metrics/scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario })
      });
      fetchHealth();
      fetchMetrics();
    } catch (e) {
      console.error(e);
    }
  };

  // Handle Provider Mode Toggle
  const handleSelectProviderMode = async (mode: string) => {
    setProviderMode(mode);
    try {
      const res = await fetch("/api/provider/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode })
      });
      const data = await res.json();
      if (data.active_provider) {
        setActiveProvider(data.active_provider);
      }
      fetchHealth();
      fetchMetrics();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors ${
      isLight ? "bg-slate-100 text-slate-900 selection:bg-blue-500/20" : "bg-[#0c0c0d] text-[#e0e0e0] selection:bg-blue-500/30"
    }`}>
      {/* Global alert popups — visible on every tab, independent of which view the DBA is looking at */}
      <AlertToastCenter toasts={toasts} onDismiss={dismissToast} onDismissAll={dismissAll} />
      {/* Header */}
      <Header
        health={healthData}
        loadScenario={loadScenario}
        onSelectScenario={handleSelectScenario}
        providerMode={providerMode}
        onSelectProviderMode={handleSelectProviderMode}
        activeProvider={activeProvider}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Navigation Tabs Bar */}
        <div className={`p-1.5 rounded-sm border shadow-sm flex flex-wrap gap-2 ${
          isLight ? "bg-white border-slate-200" : "bg-[#161618] border-[#242426]"
        }`}>
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-sm text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "dashboard"
                ? isLight
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-blue-600 text-white shadow-[0_0_8px_rgba(37,99,235,0.4)]"
                : isLight
                ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                : "text-zinc-400 hover:text-white hover:bg-[#242426]"
            }`}
          >
            <Activity className={`w-4 h-4 ${isLight ? (activeTab === "dashboard" ? "text-white" : "text-emerald-600") : "text-emerald-400"}`} />
            <span>Health Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab("rules")}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-sm text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "rules"
                ? isLight
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-blue-600 text-white shadow-[0_0_8px_rgba(37,99,235,0.4)]"
                : isLight
                ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                : "text-zinc-400 hover:text-white hover:bg-[#242426]"
            }`}
          >
            <Sliders className={`w-4 h-4 ${isLight ? (activeTab === "rules" ? "text-white" : "text-amber-600") : "text-amber-400"}`} />
            <span>Rule Engine & Scoring</span>
          </button>

          <button
            onClick={() => setActiveTab("alerts")}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-sm text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "alerts"
                ? isLight
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-blue-600 text-white shadow-[0_0_8px_rgba(37,99,235,0.4)]"
                : isLight
                ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                : "text-zinc-400 hover:text-white hover:bg-[#242426]"
            }`}
          >
            <Bell className={`w-4 h-4 ${isLight ? (activeTab === "alerts" ? "text-white" : "text-rose-600") : "text-rose-400"}`} />
            <span>Alert Engine & Notifications</span>
          </button>

          <button
            onClick={() => setActiveTab("report")}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-sm text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "report"
                ? isLight
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-blue-600 text-white shadow-[0_0_8px_rgba(37,99,235,0.4)]"
                : isLight
                ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                : "text-zinc-400 hover:text-white hover:bg-[#242426]"
            }`}
          >
            <FileCode className={`w-4 h-4 ${isLight ? (activeTab === "report" ? "text-white" : "text-purple-600") : "text-purple-400"}`} />
            <span>Executive Report</span>
          </button>
        </div>

        {/* Active Tab View */}
        {activeTab === "dashboard" && <DashboardTab health={healthData} metrics={metricsData} />}
        {activeTab === "rules" && <RuleEngineTab health={healthData} />}
        {activeTab === "alerts" && <AlertEngineTab health={healthData} />}
        {activeTab === "report" && <ReportTab />}
      </main>

      {/* Footer */}
      <footer className={`h-10 border-t flex items-center px-6 justify-between text-xs mt-12 transition-colors ${
        isLight ? "bg-white border-slate-200" : "bg-[#0a0a0b] border-[#242426]"
      }`}>
        <div className="flex gap-4 text-[10px] uppercase tracking-widest font-mono">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            <span className={isLight ? "text-slate-600" : "text-zinc-400"}>XE Node: local.db.internal</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_6px_#22c55e]"></span>
            <span className={isLight ? "text-slate-600" : "text-zinc-400"}>19c Node: prod.db.hq</span>
          </span>
        </div>
        <div className={`text-[10px] font-mono hidden sm:block ${isLight ? "text-slate-500" : "text-zinc-600"}`}>
          &copy; 2026 BANK OF ABYSSINIA &bull; ORACLE DB MONITORING SUITE
        </div>
      </footer>
    </div>
  );
}
