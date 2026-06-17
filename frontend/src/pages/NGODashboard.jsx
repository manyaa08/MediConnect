import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { PlusCircle, ClipboardList, CheckCircle, Package, Search } from "lucide-react";
import Swal from "sweetalert2";

const NGODashboard = () => {
  const [requests, setRequests] = useState([]);
  const [received, setReceived] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  useEffect(() => {
    fetchNGODashboardData();
  }, []);

  const fetchNGODashboardData = async () => {
    try {
      setLoading(true);
      const res = await api.get("/dashboard/ngo");
      const { requests, received } = res.data;

      setRequests(requests || []);
      setReceived(received || []);
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to load NGO dashboard data.", "error");
    } finally {
      setLoading(false);
    }
  };

  const totalProcuredItems = received.reduce((sum, item) => sum + item.quantity_transferred, 0);

  const handleFilterRequests = () => {
    return requests.filter((req) => {
      const matchesSearch = req.medicine_name.toLowerCase().includes(search.toLowerCase());

      let matchesUrgency = true;
      if (urgencyFilter !== "All") {
        matchesUrgency = req.urgency === urgencyFilter;
      }

      let matchesStatus = true;
      if (statusFilter !== "All") {
        matchesStatus = req.status === statusFilter;
      }

      return matchesSearch && matchesUrgency && matchesStatus;
    });
  };

  const filteredRequests = handleFilterRequests();

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-slate-200 animate-pulse rounded-lg"></div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => (
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
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">NGO Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Track community requests and incoming medicine shipments</p>
        </div>
        <Link
          to="/request-medicine"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          <PlusCircle size={18} />
          New Request
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {/* Active Quotas */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Active Requests</span>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-500">
              <ClipboardList size={20} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-900">{requests.filter(r => r.remaining_quantity > 0).length}</h3>
            <p className="text-xs text-slate-500 mt-1">Open requests looking for matches</p>
          </div>
        </div>

        {/* Shipments Received */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Shipments Received</span>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <CheckCircle size={20} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-900">{received.length}</h3>
            <p className="text-xs text-slate-500 mt-1">Individual transfers received</p>
          </div>
        </div>

        {/* Items Procured */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Items Procured</span>
            <div className="rounded-lg bg-green-50 p-2 text-green-600">
              <Package size={20} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-900">{totalProcuredItems}</h3>
            <p className="text-xs text-slate-500 mt-1">Total units of medicine received</p>
          </div>
        </div>
      </div>

      {/* Active Quotas Section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold text-slate-900">Active Requests List</h2>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-64">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Search size={16} />
              </span>
              <input
                type="text"
                placeholder="Search requests..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 pl-9 pr-4 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <select
              value={urgencyFilter}
              onChange={(e) => setUrgencyFilter(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            >
              <option value="All">All Urgencies</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Partially Fulfilled">Partially Fulfilled</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
        </div>

        {/* Requests Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-slate-500">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-700 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-semibold">Medicine Needed</th>
                <th className="px-6 py-4 font-semibold text-center">Required (Units)</th>
                <th className="px-6 py-4 font-semibold text-center">Remaining (Units)</th>
                <th className="px-6 py-4 font-semibold text-center">Urgency</th>
                <th className="px-6 py-4 font-semibold text-end">Fulfillment Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 border-t border-slate-100">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-slate-400">
                    No active requests found.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => {
                  const progress = req.required_quantity > 0
                    ? Math.round(((req.required_quantity - req.remaining_quantity) / req.required_quantity) * 100)
                    : 0;

                  let urgencyBadge = "";
                  if (req.urgency === "High") {
                    urgencyBadge = (
                      <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
                        High
                      </span>
                    );
                  } else if (req.urgency === "Medium") {
                    urgencyBadge = (
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                        Medium
                      </span>
                    );
                  } else {
                    urgencyBadge = (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                        {req.urgency || "Normal"}
                      </span>
                    );
                  }

                  let statusBadge = "";
                  if (req.status === "Completed") {
                    statusBadge = <span className="text-green-600 font-bold text-xs bg-green-50 px-2 py-0.5 rounded">Completed</span>;
                  } else if (req.status === "Partially Fulfilled") {
                    statusBadge = <span className="text-blue-600 font-bold text-xs bg-blue-50 px-2 py-0.5 rounded">Partial</span>;
                  } else {
                    statusBadge = <span className="text-slate-500 font-medium text-xs bg-slate-50 px-2 py-0.5 rounded">Pending</span>;
                  }

                  return (
                    <tr key={req.request_id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-semibold text-slate-900">{req.medicine_name}</td>
                      <td className="px-6 py-4 text-center font-bold text-slate-900">{req.required_quantity}</td>
                      <td className="px-6 py-4 text-center font-bold text-blue-600">{req.remaining_quantity}</td>
                      <td className="px-6 py-4 text-center">{urgencyBadge}</td>
                      <td className="px-6 py-4 text-end">
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-2">
                            {statusBadge}
                            <span className="text-xs font-semibold text-slate-700">{progress}%</span>
                          </div>
                          <div className="h-1.5 w-24 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              style={{ width: `${progress}%` }}
                              className={`h-full ${progress === 100 ? "bg-green-600" : "bg-blue-600"}`}
                            ></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Received Shipments Section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Received Shipments History</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-slate-500">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-700 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-semibold">Medicine Name</th>
                <th className="px-6 py-4 font-semibold">Generous Donor</th>
                <th className="px-6 py-4 font-semibold text-center">Quantity</th>
                <th className="px-6 py-4 font-semibold text-center">Expiry Date</th>
                <th className="px-6 py-4 font-semibold text-end">Transfer Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 border-t border-slate-100">
              {received.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-slate-400">
                    No shipments received yet.
                  </td>
                </tr>
              ) : (
                received.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-semibold text-slate-900">{item.medicine_name}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">{item.donor_name || "Unknown Donor"}</td>
                    <td className="px-6 py-4 text-center font-bold text-green-600">+{item.quantity_transferred}</td>
                    <td className="px-6 py-4 text-center text-xs font-semibold">
                      {item.expiry_date ? item.expiry_date.split("T")[0] : "N/A"}
                    </td>
                    <td className="px-6 py-4 text-end text-xs">
                      {new Date(item.transfer_date).toLocaleDateString()}
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

export default NGODashboard;
