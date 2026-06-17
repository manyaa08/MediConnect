import React, { useState, useEffect } from "react";
import api from "../services/api";
import {
  Users as UsersIcon,
  Package,
  CheckCircle,
  TrendingUp,
  AlertTriangle,
  ArrowRightLeft,
  ShieldCheck,
  ShieldAlert
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import Swal from "sweetalert2";

const COLORS = ["#2563EB", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

const AdminDashboard = () => {
  const [kpis, setKpis] = useState({});
  const [charts, setCharts] = useState({});
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview"); // overview, users

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const [statsRes, usersRes] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/users")
      ]);
      setKpis(statsRes.data.kpis || {});
      setCharts(statsRes.data.charts || {});
      setUsers(usersRes.data || []);
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to load system-wide stats.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVerify = async (userId, currentStatus, userName) => {
    const nextStatus = !currentStatus;
    const actionText = nextStatus ? "Verify" : "Unverify";

    const confirm = await Swal.fire({
      title: `${actionText} User?`,
      text: `Are you sure you want to ${actionText.toLowerCase()} user ${userName}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#2563EB",
      cancelButtonColor: "#64748B",
      confirmButtonText: `Yes, ${actionText}`,
    });

    if (!confirm.isConfirmed) return;

    try {
      const res = await api.put(`/admin/users/${userId}/verify`, {
        is_verified: nextStatus
      });
      Swal.fire({
        icon: "success",
        title: "Success",
        text: res.data.message || "User status updated.",
        timer: 1500,
        showConfirmButton: false
      });
      // Refresh list
      fetchAdminData();
    } catch (err) {
      console.error(err);
      Swal.fire("Error", err.response?.data?.message || "Failed to update user status.", "error");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-slate-200 animate-pulse rounded-lg"></div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 md:grid-cols-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-200 animate-pulse rounded-xl"></div>
          ))}
        </div>
        <div className="h-96 bg-slate-200 animate-pulse rounded-2xl"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header & Tabs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Overview</h1>
          <p className="text-sm text-slate-500 mt-1">Stripe-style dashboard managing global operations</p>
        </div>
        <div className="inline-flex rounded-xl bg-slate-100 p-1.5 border border-slate-200">
          <button
            onClick={() => setActiveTab("overview")}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "overview"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Analytics Stats
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "users"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            User Verification ({users.length})
          </button>
        </div>
      </div>

      {activeTab === "overview" && (
        <>
          {/* KPIs Grid */}
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4 lg:grid-cols-8">
            {/* Total Medicines */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wider">Total Medicines</span>
              <h3 className="text-xl font-bold text-slate-900 mt-2">{kpis.total_medicines || 0}</h3>
              <p className="text-4xs text-slate-400 mt-1">Total items registered</p>
            </div>

            {/* Active Donations */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wider">Active Donations</span>
              <h3 className="text-xl font-bold text-green-600 mt-2">{kpis.active_donations || 0}</h3>
              <p className="text-4xs text-slate-400 mt-1">Available in stock</p>
            </div>

            {/* Active Requests */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wider">Active Requests</span>
              <h3 className="text-xl font-bold text-amber-500 mt-2">{kpis.active_requests || 0}</h3>
              <p className="text-4xs text-slate-400 mt-1">Broadcasted demands</p>
            </div>

            {/* Completed Transfers */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wider">Completed Transfers</span>
              <h3 className="text-xl font-bold text-blue-600 mt-2">{kpis.completed_transfers || 0}</h3>
              <p className="text-4xs text-slate-400 mt-1">Total redistribution count</p>
            </div>

            {/* Fulfillment Rate */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wider">Fulfillment Rate</span>
              <h3 className="text-xl font-bold text-slate-900 mt-2">{kpis.fulfillment_rate || 0}%</h3>
              <p className="text-4xs text-slate-400 mt-1">Completed vs total requests</p>
            </div>

            {/* Expiring Medicines */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs text-red-600 bg-red-50/10">
              <span className="text-2xs font-semibold text-red-500 uppercase tracking-wider">Expiring (30 Days)</span>
              <h3 className="text-xl font-bold mt-2">{kpis.expiring_medicines || 0}</h3>
              <p className="text-4xs text-red-400 mt-1">Urgent attention units</p>
            </div>

            {/* Waste Prevented */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs text-green-700 bg-green-50/10">
              <span className="text-2xs font-semibold text-green-600 uppercase tracking-wider">Waste Prevented</span>
              <h3 className="text-xl font-bold mt-2">{kpis.waste_prevented || 0}</h3>
              <p className="text-4xs text-green-500 mt-1">Near-expiry units claimed</p>
            </div>

            {/* Saved via FEFO */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs text-indigo-700 bg-indigo-50/10">
              <span className="text-2xs font-semibold text-indigo-600 uppercase tracking-wider">Saved via FEFO</span>
              <h3 className="text-xl font-bold mt-2">{kpis.saved_via_fefo || 0}</h3>
              <p className="text-4xs text-indigo-500 mt-1">Allocations via FEFO engine</p>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Monthly Donations */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <h4 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">Monthly Donations (Units)</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={charts.monthly_donations} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorDonations" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="month" stroke="#94A3B8" fontSize={11} />
                    <YAxis stroke="#94A3B8" fontSize={11} />
                    <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #E2E8F0" }} />
                    <Area type="monotone" dataKey="count" stroke="#2563EB" fillOpacity={1} fill="url(#colorDonations)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Monthly Requests */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <h4 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">Monthly Requests (Count)</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={charts.monthly_requests} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="month" stroke="#94A3B8" fontSize={11} />
                    <YAxis stroke="#94A3B8" fontSize={11} />
                    <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #E2E8F0" }} />
                    <Area type="monotone" dataKey="count" stroke="#10B981" fillOpacity={1} fill="url(#colorRequests)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Medicines */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <h4 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">Top Donated Medicines</h4>
              <div className="h-64 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts.top_medicines} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                    <XAxis type="number" stroke="#94A3B8" fontSize={11} />
                    <YAxis dataKey="medicine_name" type="category" stroke="#94A3B8" fontSize={11} width={100} />
                    <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #E2E8F0" }} />
                    <Bar dataKey="count" fill="#2563EB" radius={[0, 4, 4, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Transfer Analytics */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <h4 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">Transfer Analytics by City</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts.transfer_analytics} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="city" stroke="#94A3B8" fontSize={11} />
                    <YAxis stroke="#94A3B8" fontSize={11} />
                    <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #E2E8F0" }} />
                    <Bar dataKey="total_quantity" fill="#8B5CF6" radius={[4, 4, 0, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === "users" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">User Management</h2>
            <span className="text-xs text-slate-400">Verify NGO access permissions</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm text-slate-500">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-semibold">User ID</th>
                  <th className="px-6 py-4 font-semibold">Name / Organization</th>
                  <th className="px-6 py-4 font-semibold">Email</th>
                  <th className="px-6 py-4 font-semibold">Role</th>
                  <th className="px-6 py-4 font-semibold">City</th>
                  <th className="px-6 py-4 font-semibold text-center">Status</th>
                  <th className="px-6 py-4 font-semibold text-end">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 border-t border-slate-100">
                {users.map((u) => {
                  let statusBadge = u.is_verified ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                      <ShieldCheck size={12} />
                      Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
                      <ShieldAlert size={12} />
                      Unverified
                    </span>
                  );

                  return (
                    <tr key={u.user_id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-mono text-xs text-slate-400">#{u.user_id}</td>
                      <td className="px-6 py-4 font-semibold text-slate-900">{u.name}</td>
                      <td className="px-6 py-4 text-xs font-medium">{u.email}</td>
                      <td className="px-6 py-4">
                        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${
                          u.role === "Admin"
                            ? "bg-slate-150 text-slate-800"
                            : u.role === "Donor"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-green-50 text-green-700"
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs uppercase font-semibold">{u.city || "N/A"}</td>
                      <td className="px-6 py-4 text-center">{statusBadge}</td>
                      <td className="px-6 py-4 text-end">
                        {u.role === "Admin" ? (
                          <span className="text-slate-400 text-xs font-medium italic">Immutable</span>
                        ) : (
                          <button
                            onClick={() => handleToggleVerify(u.user_id, u.is_verified, u.name)}
                            className={`inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                              u.is_verified
                                ? "bg-red-50 text-red-600 hover:bg-red-100"
                                : "bg-green-50 text-green-600 hover:bg-green-100"
                            }`}
                          >
                            {u.is_verified ? "Revoke" : "Verify"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
