import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { Truck, Search, Eye } from "lucide-react";
import Swal from "sweetalert2";

const TransferTrackingList = () => {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchTransfers();
  }, []);

  const fetchTransfers = async () => {
    try {
      setLoading(true);
      const res = await api.get("/transfers");
      setTransfers(res.data || []);
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to load transfer history.", "error");
    } finally {
      setLoading(false);
    }
  };

  const filteredTransfers = transfers.filter((t) =>
    t.medicine_name.toLowerCase().includes(search.toLowerCase()) ||
    (t.ngo_name && t.ngo_name.toLowerCase().includes(search.toLowerCase())) ||
    (t.donor_name && t.donor_name.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-slate-200 animate-pulse rounded-lg"></div>
        <div className="h-64 bg-slate-200 animate-pulse rounded-2xl"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Truck size={24} className="text-blue-600" />
          Transfer Tracker
        </h1>
        <p className="text-sm text-slate-500 mt-1">Monitor real-time progress and delivery status of medicine shipments</p>
      </div>

      {/* Filter and search */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:w-80">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search size={16} />
            </span>
            <input
              type="text"
              placeholder="Search by medicine, sender or recipient..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Transfers table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-slate-500">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-700 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-semibold">Transfer ID</th>
                <th className="px-6 py-4 font-semibold">Medicine</th>
                <th className="px-6 py-4 font-semibold">Connected Member</th>
                <th className="px-6 py-4 font-semibold text-center">Quantity</th>
                <th className="px-6 py-4 font-semibold text-center">Status</th>
                <th className="px-6 py-4 font-semibold text-center">Date Init</th>
                <th className="px-6 py-4 font-semibold text-end">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 border-t border-slate-100">
              {filteredTransfers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-slate-400">
                    No active transfers found.
                  </td>
                </tr>
              ) : (
                filteredTransfers.map((trans) => {
                  let statusColor = "bg-blue-50 text-blue-700";
                  if (trans.status === "Delivered") {
                    statusColor = "bg-green-50 text-green-700";
                  } else if (trans.status === "In Transit") {
                    statusColor = "bg-amber-50 text-amber-700";
                  }

                  return (
                    <tr key={trans.transfer_id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-mono text-xs text-slate-400">#{trans.transfer_id}</td>
                      <td className="px-6 py-4 font-semibold text-slate-900">{trans.medicine_name}</td>
                      <td className="px-6 py-4 font-medium text-slate-800">
                        {trans.ngo_name ? `NGO: ${trans.ngo_name}` : `Donor: ${trans.donor_name}`}
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-slate-900">{trans.quantity_transferred}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor}`}>
                          {trans.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-xs">
                        {new Date(trans.transfer_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-end">
                        <Link
                          to={`/transfers/${trans.transfer_id}`}
                          className="inline-flex items-center justify-center gap-1 rounded-lg bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                        >
                          <Eye size={14} />
                          Track Timeline
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TransferTrackingList;
