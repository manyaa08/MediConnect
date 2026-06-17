import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { PlusCircle, ShieldAlert, CheckCircle, Package, ArrowRightLeft } from "lucide-react";
import Swal from "sweetalert2";

const DonorDashboard = () => {
  const [summary, setSummary] = useState({});
  const [inventory, setInventory] = useState([]);
  const [recentTransfers, setRecentTransfers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [expiryFilter, setExpiryFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await api.get("/dashboard/donor");
      const { summary, inventory, recent_transfers } = res.data;

      setSummary(summary || {});
      setInventory(inventory || []);
      setRecentTransfers(recent_transfers || []);

      // Extract unique categories for filter
      const uniqueCats = [...new Set((inventory || []).map((m) => m.category).filter(Boolean))];
      setCategories(uniqueCats);
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to load dashboard data.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    return inventory.filter((med) => {
      const matchesSearch =
        med.medicine_name.toLowerCase().includes(search.toLowerCase()) ||
        med.batch_number?.toLowerCase().includes(search.toLowerCase());

      let matchesExpiry = true;
      if (expiryFilter !== "All") {
        matchesExpiry = med.expiry_status === expiryFilter;
      }

      let matchesCategory = true;
      if (categoryFilter !== "All") {
        matchesCategory = med.category === categoryFilter;
      }

      return matchesSearch && matchesExpiry && matchesCategory;
    });
  };

  const filteredInventory = handleFilter();

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-slate-200 animate-pulse rounded-lg"></div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-200 animate-pulse rounded-2xl"></div>
          ))}
        </div>
        <div className="h-64 bg-slate-200 animate-pulse rounded-2xl"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Donor Inventory</h1>
          <p className="text-sm text-slate-500 mt-1">Track your listed medicine stock and donation history</p>
        </div>
        <Link
          to="/add-medicine"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          <PlusCircle size={18} />
          Add Medicine
        </Link>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-4">
        {/* Total Medicines Listed */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Total Types Listed</span>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <Package size={20} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-900">{summary.total_medicines_listed || 0}</h3>
            <p className="text-xs text-slate-500 mt-1">Total batches uploaded</p>
          </div>
        </div>

        {/* Available Units */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Available Units</span>
            <div className="rounded-lg bg-green-50 p-2 text-green-600">
              <CheckCircle size={20} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-900">{summary.current_available_units || 0}</h3>
            <p className="text-xs text-slate-500 mt-1">Units ready for redistribution</p>
          </div>
        </div>

        {/* Expiring Count */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Near Expiry (30 Days)</span>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-500">
              <ShieldAlert size={20} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-900">{summary.near_expiry_count || 0}</h3>
            <p className="text-xs text-slate-500 mt-1">Urgent fulfillment needed</p>
          </div>
        </div>

        {/* Expired Count */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Expired Batches</span>
            <div className="rounded-lg bg-red-50 p-2 text-red-600">
              <ShieldAlert size={20} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-900">{summary.expired_count || 0}</h3>
            <p className="text-xs text-slate-500 mt-1">Classified unavailable</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold text-slate-900">Current Stock</h2>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Search medicine name, batch..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 w-full sm:w-64"
            />
            <select
              value={expiryFilter}
              onChange={(e) => setExpiryFilter(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            >
              <option value="All">All Expiry Statuses</option>
              <option value="Available">Available (Safe)</option>
              <option value="Near Expiry">Near Expiry</option>
              <option value="Expired">Expired</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            >
              <option value="All">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Inventory Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-slate-500">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-700 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-semibold">Medicine Name</th>
                <th className="px-6 py-4 font-semibold">Batch</th>
                <th className="px-6 py-4 font-semibold">Category</th>
                <th className="px-6 py-4 font-semibold">Quantity (Units)</th>
                <th className="px-6 py-4 font-semibold">Expiry Date</th>
                <th className="px-6 py-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 border-t border-slate-100">
              {filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-slate-400">
                    No matching medicines in stock.
                  </td>
                </tr>
              ) : (
                filteredInventory.map((med) => {
                  let statusBadge = "";
                  if (med.expiry_status === "Expired") {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                        Expired
                      </span>
                    );
                  } else if (med.expiry_status === "Near Expiry") {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                        Near Expiry
                      </span>
                    );
                  } else {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                        Active Stock
                      </span>
                    );
                  }

                  return (
                    <tr key={med.medicine_id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-semibold text-slate-900">{med.medicine_name}</td>
                      <td className="px-6 py-4 font-mono text-xs">{med.batch_number || "N/A"}</td>
                      <td className="px-6 py-4">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          {med.category || "General"}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900">{med.quantity}</td>
                      <td className="px-6 py-4 text-xs font-semibold">
                        {med.expiry_date ? med.expiry_date.split("T")[0] : "N/A"}
                      </td>
                      <td className="px-6 py-4">{statusBadge}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Transfers History */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <ArrowRightLeft size={18} className="text-blue-600" />
          Recent Transfer History
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-slate-500">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-700 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-semibold">Medicine</th>
                <th className="px-6 py-4 font-semibold">Recipient NGO</th>
                <th className="px-6 py-4 font-semibold">Quantity Transferred</th>
                <th className="px-6 py-4 font-semibold">Transfer Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 border-t border-slate-100">
              {recentTransfers.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-slate-400">
                    No recent transfers completed.
                  </td>
                </tr>
              ) : (
                recentTransfers.map((trans) => (
                  <tr key={trans.transfer_id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-semibold text-slate-900">{trans.medicine_name}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">{trans.ngo_name}</td>
                    <td className="px-6 py-4 font-bold text-green-600">+{trans.quantity_transferred}</td>
                    <td className="px-6 py-4 text-xs">
                      {new Date(trans.transfer_date).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DonorDashboard;
