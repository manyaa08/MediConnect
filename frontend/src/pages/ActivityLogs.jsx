import React, { useState, useEffect } from "react";
import api from "../services/api";
import { Activity, Plus, Megaphone, Truck, ShieldCheck, ChevronLeft, ChevronRight } from "lucide-react";
import Swal from "sweetalert2";

const ActivityLogs = () => {
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, [page]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/dashboard/activity-feed?page=${page}&limit=10`);
      setLogs(res.data.logs || []);
      setTotalPages(res.data.totalPages || 1);
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to load activity log feed.", "error");
    } finally {
      setLoading(false);
    }
  };

  const getLogIcon = (action) => {
    switch (action) {
      case "MEDICINE_DONATED":
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50 text-green-600">
            <Plus size={16} />
          </div>
        );
      case "REQUEST_CREATED":
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-500">
            <Megaphone size={16} />
          </div>
        );
      case "TRANSFER_PROCESSED":
      case "TRANSFER_STATUS_UPDATED":
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Truck size={16} />
          </div>
        );
      case "USER_VERIFICATION":
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <ShieldCheck size={16} />
          </div>
        );
      default:
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
            <Activity size={16} />
          </div>
        );
    }
  };

  if (loading && page === 1) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-slate-200 animate-pulse rounded-lg"></div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-slate-200 animate-pulse rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Activity size={24} className="text-blue-600 animate-pulse" />
          System Activity Logs
        </h1>
        <p className="text-sm text-slate-500 mt-1">Audit log of system activities, donations, requests, and updates</p>
      </div>

      {/* Feed Panel */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <div className="divide-y divide-slate-100">
          {logs.length === 0 ? (
            <p className="py-8 text-center text-slate-400">No activity logged in the system.</p>
          ) : (
            logs.map((log) => (
              <div key={log.log_id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                {getLogIcon(log.action)}
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900 leading-tight">{log.description}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-3xs text-slate-400 font-medium uppercase tracking-wider">
                    <span>{log.action.replace("_", " ")}</span>
                    <span>•</span>
                    <span>{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <span className="text-xs text-slate-500">
              Page <span className="font-semibold text-slate-900">{page}</span> of{" "}
              <span className="font-semibold text-slate-900">{totalPages}</span>
            </span>

            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white"
              >
                <ChevronLeft size={16} />
              </button>

              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityLogs;
