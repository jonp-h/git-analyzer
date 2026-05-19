import { useState, useEffect } from "react";
import type { RepoStats } from "./types";
import { RepoDashboard } from "./pages/RepoDashboard";
import { GitBranch, FolderOpen } from "lucide-react";

export default function App() {
  const [repos, setRepos] = useState<string[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [stats, setStats] = useState<RepoStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/repos")
      .then((r) => r.json())
      .then(setRepos)
      .catch(() => {});
  }, []);

  const loadRepo = async (name: string) => {
    setSelectedRepo(name);
    setLoading(true);
    setError(null);
    setStats(null);
    try {
      const res = await fetch(`/api/repos/${encodeURIComponent(name)}/stats`);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data: RepoStats = await res.json();
      setStats(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      <aside className="w-56 flex-shrink-0 bg-zinc-900 border-r border-zinc-800 flex flex-col">
        <div className="p-4 border-b border-zinc-800">
          <div className="flex items-center gap-2 font-semibold text-zinc-100 text-sm">
            <GitBranch className="w-4 h-4 text-blue-400" />
            Git Analyzer
          </div>
          <p className="text-xs text-zinc-600 mt-1">Drop repos in /repos</p>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {repos.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-6 text-zinc-600">
              <FolderOpen className="w-7 h-7" />
              <p className="text-xs text-center leading-relaxed">
                No repos found.
                <br />
                Add git folders to /repos
              </p>
            </div>
          ) : (
            repos.map((name) => (
              <button
                key={name}
                onClick={() => loadRepo(name)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2 ${
                  selectedRepo === name
                    ? "bg-zinc-700 text-zinc-100"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                }`}
              >
                <GitBranch className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
                <span className="truncate">{name}</span>
              </button>
            ))
          )}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center h-full text-zinc-500">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-sm">Loading repository…</p>
            </div>
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center h-full">
            <p className="text-red-400 text-sm">Error: {error}</p>
          </div>
        )}
        {!loading && !error && stats && <RepoDashboard stats={stats} />}
        {!loading && !error && !stats && (
          <div className="flex items-center justify-center h-full text-zinc-700">
            <div className="text-center">
              <GitBranch className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Select a repository from the sidebar</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
