import React, { useState, useEffect } from "react";
import api from "../services/api";
import { Check, ShieldAlert, Search } from "lucide-react";
import Swal from "sweetalert2";

const MatchingNeeds = () => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    try {
      setLoading(true);
      const res = await api.get("/requests/matching-needs");
      setMatches(res.data || []);
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to load matching needs.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleFulfill = async (reqId, remainingQty, medicineName, totalAvailable) => {
    const maxDonation = Math.min(remainingQty, totalAvailable);

    const { value: qty } = await Swal.fire({
      title: `Fulfill ${medicineName} Need`,
      input: "number",
      inputLabel: `Enter quantity to donate (Maximum: ${maxDonation})`,
      inputValue: maxDonation,
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value || parseInt(value, 10) <= 0) {
          return "Please enter a valid amount greater than 0.";
        }
        if (parseInt(value, 10) > maxDonation) {
          return `You can donate up to ${maxDonation} units.`;
        }
      },
    });

    if (!qty) return;

    try {
      // 1. Fetch FEFO allocation preview
      Swal.fire({
        title: "Calculating FEFO Allocation...",
        text: "Please wait while we lock and analyze matching batches.",
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      const previewRes = await api.get(`/transfers/preview-allocation?request_id=${reqId}&quantity=${qty}`);
      const { allocations, remainingUnallocated } = previewRes.data;

      if (!allocations || allocations.length === 0) {
        Swal.fire("Allocation Failed", "No available batches match this request.", "error");
        return;
      }

      // 2. Generate preview HTML
      const previewHtml = `
        <div class="text-left font-sans text-xs sm:text-sm text-slate-600">
          <p class="font-semibold text-slate-800 mb-3">The system will automatically allocate stock from the following earliest-expiry batches (FEFO):</p>
          <div class="border border-slate-200 rounded-xl bg-slate-50/50 overflow-hidden mb-4">
            <table class="w-full text-xs text-left border-collapse">
              <thead>
                <tr class="bg-slate-100 border-b border-slate-250">
                  <th class="px-3 py-2 font-semibold text-slate-700">Batch Number</th>
                  <th class="px-3 py-2 font-semibold text-slate-700">Quantity Allocated</th>
                  <th class="px-3 py-2 font-semibold text-slate-700">Expiry Date</th>
                  <th class="px-3 py-2 font-semibold text-slate-700 text-center">Status</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200">
                ${allocations.map(a => {
                  const days = a.days_left;
                  let badge = "";
                  if (days < 0) {
                    badge = `<span class="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-3xs font-medium text-red-800">Expired</span>`;
                  } else if (days <= 30) {
                    badge = `<span class="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-3xs font-medium text-amber-800">Expiring Soon (${days}d)</span>`;
                  } else {
                    badge = `<span class="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-3xs font-medium text-green-800">Safe (${days}d)</span>`;
                  }
                  return `
                    <tr class="hover:bg-slate-50">
                      <td class="px-3 py-2.5 font-mono font-medium text-slate-900">${a.batch_number || 'N/A'}</td>
                      <td class="px-3 py-2.5 font-bold text-slate-900">${a.quantity_allocated} units</td>
                      <td class="px-3 py-2.5 text-slate-500">${a.expiry_date ? a.expiry_date.split('T')[0] : 'N/A'}</td>
                      <td class="px-3 py-2.5 text-center">${badge}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
          ${remainingUnallocated > 0 ? `
            <div class="rounded-lg bg-red-50 p-3 mb-4 text-xs font-semibold text-red-800 border border-red-200">
              Warning: ${remainingUnallocated} units could not be allocated due to insufficient stock.
            </div>
          ` : ''}
          <p class="text-3xs text-slate-400 italic mt-1">This transaction-safe allocation secures early-expiry inventory first to prevent medicine waste.</p>
        </div>
      `;

      // 3. Confirm with user
      const confirmFulfill = await Swal.fire({
        title: "Confirm Donation Fulfill",
        html: previewHtml,
        icon: "info",
        showCancelButton: true,
        confirmButtonColor: "#2563EB",
        cancelButtonColor: "#64748B",
        confirmButtonText: "Confirm & Donate",
        cancelButtonText: "Cancel",
        width: '560px'
      });

      if (!confirmFulfill.isConfirmed) return;

      // 4. Submit fulfillment
      Swal.fire({
        title: "Processing Donation...",
        text: "Please wait.",
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      const res = await api.post("/transfers/create", {
        request_id: reqId,
        quantity: parseInt(qty, 10),
      });

      Swal.fire({
        icon: "success",
        title: "Fulfillment Created!",
        text: res.data.message || "Thank you for your donation support.",
        timer: 1500,
        showConfirmButton: false,
      }).then(() => {
        fetchMatches();
      });
    } catch (err) {
      console.error(err);
      Swal.fire("Fulfillment Failed", err.response?.data?.message || "Error processing fulfillment.", "error");
    }
  };

  const filteredMatches = matches.filter((match) =>
    match.medicine_name.toLowerCase().includes(search.toLowerCase()) ||
    match.ngo_name.toLowerCase().includes(search.toLowerCase())
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
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Matching Needs</h1>
        <p className="text-sm text-slate-500 mt-1">
          Review local NGO medicine requests in your city that match your inventory stock
        </p>
      </div>

      {/* Filter and Search */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:w-80">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search size={16} />
            </span>
            <input
              type="text"
              placeholder="Search by medicine or NGO..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Matches list table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-slate-500">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-700 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-semibold">Medicine Needed</th>
                <th className="px-6 py-4 font-semibold">NGO Name</th>
                <th className="px-6 py-4 font-semibold">City Matching</th>
                <th className="px-6 py-4 font-semibold text-center">Required (Remaining)</th>
                <th className="px-6 py-4 font-semibold text-center">Urgency</th>
                <th className="px-6 py-4 font-semibold text-end">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 border-t border-slate-100">
              {filteredMatches.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-slate-400">
                    No matching NGO requests found in your city.
                  </td>
                </tr>
              ) : (
                filteredMatches.map((match) => {
                  let urgencyBadge = "";
                  if (match.urgency === "High") {
                    urgencyBadge = (
                      <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                        High
                      </span>
                    );
                  } else if (match.urgency === "Medium") {
                    urgencyBadge = (
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                        Medium
                      </span>
                    );
                  } else {
                    urgencyBadge = (
                      <span className="inline-flex items-center rounded-full bg-slate-150 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {match.urgency || "Normal"}
                      </span>
                    );
                  }

                  const canFulfillAll = match.total_available >= match.remaining_quantity;

                  return (
                    <tr key={match.request_id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">{match.medicine_name}</div>
                        <div className="mt-1 text-2xs text-slate-400">
                          {canFulfillAll ? "Full stock available" : `Partial fulfillment (${match.total_available} units in stock)`}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-800">{match.ngo_name}</td>
                      <td className="px-6 py-4 text-xs font-semibold uppercase">{match.city}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-slate-900 font-bold">{match.required_quantity}</span>
                        <span className="text-slate-400 font-medium"> ({match.remaining_quantity})</span>
                      </td>
                      <td className="px-6 py-4 text-center">{urgencyBadge}</td>
                      <td className="px-6 py-4 text-end">
                        <button
                          onClick={() =>
                            handleFulfill(
                              match.request_id,
                              match.remaining_quantity,
                              match.medicine_name,
                              match.total_available
                            )
                          }
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700 transition-colors"
                        >
                          <Check size={14} />
                          Fulfill
                        </button>
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

export default MatchingNeeds;
