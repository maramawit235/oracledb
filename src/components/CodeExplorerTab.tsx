import React, { useState, useEffect } from "react";
import { ProjectFile } from "../types";
import { FileCode, Copy, Check, Folder, Code2, Download, Search, FileText } from "lucide-react";

export const CodeExplorerTab: React.FC = () => {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/files")
      .then((res) => res.json())
      .then((data) => {
        if (data.files && data.files.length > 0) {
          setFiles(data.files);
          setSelectedFile(data.files[0]);
        }
      })
      .catch((err) => console.error(err));
  }, []);

  const handleCopy = () => {
    if (selectedFile) {
      navigator.clipboard.writeText(selectedFile.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const filteredFiles = files.filter(
    (f) =>
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#161618] text-[#e0e0e0] p-6 rounded-sm border border-[#242426]">
        <div className="flex items-center space-x-3 mb-2">
          <Code2 className="w-5 h-5 text-amber-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider font-mono text-white">Complete Suite Codebase Explorer (Parts 1 - 7)</h2>
        </div>
        <p className="text-xs text-zinc-400 max-w-3xl font-mono">
          Browse, inspect, and copy all production-quality Python, SQL, YAML, Docker, and Markdown files created across Parts 1 to 7. Every file includes type hints, docstrings, and comments explaining DB monitoring logic.
        </p>
      </div>

      {/* Main Explorer View */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[600px]">
        {/* Left Sidebar: File List */}
        <div className="bg-[#161618] rounded-sm border border-[#242426] p-4 flex flex-col">
          <div className="relative mb-3">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Filter files..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#0c0c0d] border border-[#242426] rounded-sm pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[500px]">
            {filteredFiles.map((file) => {
              const isSelected = selectedFile?.path === file.path;

              return (
                <button
                  key={file.path}
                  onClick={() => setSelectedFile(file)}
                  className={`w-full text-left p-3 rounded-sm border text-xs transition-all cursor-pointer font-mono ${
                    isSelected
                      ? "bg-blue-600/10 text-white border-blue-500 shadow-[0_0_8px_rgba(37,99,235,0.3)]"
                      : "bg-[#0c0c0d] text-zinc-400 border-[#242426] hover:bg-[#242426]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs truncate">{file.name}</span>
                    <span
                      className={`text-[9px] uppercase px-1.5 py-0.2 rounded font-mono font-bold border ${
                        file.type === "sql"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          : file.type === "python"
                          ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                          : file.type === "yaml"
                          ? "bg-green-500/10 text-green-400 border-green-500/30"
                          : "bg-purple-500/10 text-purple-400 border-purple-500/30"
                      }`}
                    >
                      {file.type}
                    </span>
                  </div>
                  <div className={`text-[10px] mt-1 ${isSelected ? "text-zinc-400" : "text-zinc-500"}`}>
                    {file.category}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Pane: Code Viewer */}
        <div className="lg:col-span-3 bg-[#0c0c0d] text-zinc-100 rounded-sm border border-[#242426] overflow-hidden flex flex-col font-mono text-xs">
          {/* Header Bar */}
          <div className="bg-[#111112] px-5 py-3 border-b border-[#242426] flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <FileCode className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-white text-sm">{selectedFile?.name || "Select a file"}</span>
              </div>
              <span className="text-[11px] text-zinc-500">{selectedFile?.category}</span>
            </div>

            <button
              onClick={handleCopy}
              className="bg-[#161618] hover:bg-[#242426] text-zinc-200 font-mono px-3 py-1.5 rounded-sm border border-[#242426] transition-all flex items-center space-x-1.5 text-xs cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-green-400" />
                  <span className="text-green-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-zinc-400" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>

          {/* Code Viewer Body */}
          <div className="p-5 flex-1 overflow-x-auto text-zinc-300 leading-relaxed font-mono max-h-[550px]">
            <pre className="whitespace-pre">{selectedFile?.content}</pre>
          </div>
        </div>
      </div>
    </div>
  );
};
