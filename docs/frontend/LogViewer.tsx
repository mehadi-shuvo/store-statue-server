"use client";

import { useEffect, useMemo, useState } from "react";

type LogEntry = {
  time: string;
  level: "trace" | "debug" | "info" | "warn" | "error" | "fatal" | string;
  method?: string;
  url?: string;
  status?: number;
  message: string;
};

const levelClassName: Record<string, string> = {
  trace: "bg-slate-100 text-slate-700",
  debug: "bg-zinc-100 text-zinc-700",
  info: "bg-blue-100 text-blue-800",
  warn: "bg-amber-100 text-amber-800",
  error: "bg-red-100 text-red-800",
  fatal: "bg-rose-100 text-rose-900",
};

export function LogViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [limit, setLimit] = useState(100);
  const [level, setLevel] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams({ limit: String(limit) });

    if (level) {
      params.set("level", level);
    }

    return params.toString();
  }, [level, limit]);

  useEffect(() => {
    const controller = new AbortController();

    setIsLoading(true);
    setError(null);

    fetch(`/api/admins/logs?${query}`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to load logs");
        }

        return response.json();
      })
      .then((payload) => setLogs(payload.data || []))
      .catch((fetchError) => {
        if (fetchError.name !== "AbortError") {
          setError(fetchError.message || "Unable to load logs");
        }
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [query]);

  return (
    <section className="w-full">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-950">Application Logs</h2>
        <div className="flex items-center gap-2">
          <select
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
            value={level}
            onChange={(event) => setLevel(event.target.value)}
          >
            <option value="">All levels</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
            <option value="fatal">Fatal</option>
            <option value="debug">Debug</option>
          </select>
          <select
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
            value={limit}
            onChange={(event) => setLimit(Number(event.target.value))}
          >
            <option value={100}>Latest 100</option>
            <option value={250}>Latest 250</option>
            <option value={500}>Latest 500</option>
          </select>
        </div>
      </div>

      {error ? <p className="mb-3 text-sm text-red-700">{error}</p> : null}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["Time", "Level", "Method", "URL", "Status", "Message"].map((header) => (
                  <th
                    key={header}
                    className="px-4 py-3 text-left font-semibold text-slate-700"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={6}>
                    Loading logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={6}>
                    No logs found.
                  </td>
                </tr>
              ) : (
                logs.map((log, index) => (
                  <tr key={`${log.time}-${index}`} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {log.time ? new Date(log.time).toLocaleString() : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                          levelClassName[log.level] || "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {log.level}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">
                      {log.method || "-"}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-slate-700">
                      {log.url || "-"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {log.status || "-"}
                    </td>
                    <td className="min-w-80 px-4 py-3 text-slate-900">
                      {log.message || "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
