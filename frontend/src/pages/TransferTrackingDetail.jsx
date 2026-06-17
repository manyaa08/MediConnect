import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { ArrowLeft, Check, Compass, Box, Truck, MapPin, Calendar, Clock } from "lucide-react";
import Swal from "sweetalert2";

const STEPS = [
  "Donation Submitted",
  "Verification Complete",
  "NGO Matched",
  "Transfer Approved",
  "Pickup Scheduled",
  "In Transit",
  "Delivered"
];

const TransferTrackingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [transfer, setTransfer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchTransferDetail();
  }, [id]);

  const fetchTransferDetail = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/transfers/${id}/track`);
      setTransfer(res.data);
      setSelectedStatus(res.data.status);
    } catch (err) {
      console.error(err);
      Swal.fire("Access Forbidden", "Record not found or you are not authorized to view this transfer.", "error");
      navigate("/transfers");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    setUpdating(true);
    try {
      await api.put(`/transfers/${id}/status`, { status: selectedStatus });
      Swal.fire({
        icon: "success",
        title: "Status Updated",
        text: `Transfer status changed to: ${selectedStatus}`,
        timer: 1500,
        showConfirmButton: false
      });
      fetchTransferDetail();
    } catch (err) {
      console.error(err);
      Swal.fire("Error", err.response?.data?.message || "Failed to update transfer status.", "error");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-slate-200 animate-pulse rounded-lg"></div>
        <div className="h-96 bg-slate-200 animate-pulse rounded-2xl"></div>
      </div>
    );
  }

  const currentStepIdx = STEPS.indexOf(transfer.status) !== -1 ? STEPS.indexOf(transfer.status) : 0;
  
  // Calculate fake delivery estimate (+3 days from transfer date)
  const transferDateObj = new Date(transfer.transfer_date);
  const estDeliveryDate = new Date(transferDateObj.setDate(transferDateObj.getDate() + 3)).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  // Verify authorization: Is current user the Donor or Admin?
  const isAuthorizedToEdit = user?.role === "Admin" || user?.user_id === transfer.donor_id;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Back Link */}
      <button
        onClick={() => navigate("/transfers")}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 font-medium"
      >
        <ArrowLeft size={16} />
        Back to Tracking List
      </button>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Left column: Info card */}
        <div className="md:col-span-1 space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
            <div>
              <p className="text-4xs font-semibold text-slate-400 uppercase tracking-wider">Redistribution Record</p>
              <h1 className="text-lg font-bold text-slate-900 mt-1">Transfer #{transfer.transfer_id}</h1>
            </div>

            <div className="space-y-3 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2 text-xs">
                <Box size={16} className="text-slate-400" />
                <div>
                  <p className="text-slate-400 text-3xs font-medium uppercase tracking-wider">Medicine</p>
                  <p className="font-bold text-slate-950">{transfer.medicine_name}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <Compass size={16} className="text-slate-400" />
                <div>
                  <p className="text-slate-400 text-3xs font-medium uppercase tracking-wider">Quantity</p>
                  <p className="font-bold text-slate-950">{transfer.quantity_transferred} units</p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <MapPin size={16} className="text-slate-400" />
                <div>
                  <p className="text-slate-400 text-3xs font-medium uppercase tracking-wider">Route</p>
                  <p className="font-bold text-slate-950 truncate">
                    {transfer.donor_city} to {transfer.ngo_city}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <Calendar size={16} className="text-slate-400" />
                <div>
                  <p className="text-slate-400 text-3xs font-medium uppercase tracking-wider">Batch Expiry</p>
                  <p className="font-bold text-slate-950">{transfer.expiry_date ? transfer.expiry_date.split("T")[0] : "N/A"}</p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-1">
              <p className="text-slate-400 text-3xs font-medium uppercase tracking-wider">Donor Pharmacy</p>
              <p className="font-semibold text-slate-900">{transfer.donor_name}</p>
              
              <p className="text-slate-400 text-3xs font-medium uppercase tracking-wider mt-3">Recipient NGO</p>
              <p className="font-semibold text-slate-900">{transfer.ngo_name}</p>
            </div>
          </div>

          {/* Admin / Donor control card */}
          {isAuthorizedToEdit && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Logistics Controls</h3>
              <p className="text-xs text-slate-500">Update transfer tracking status</p>
              
              <div className="space-y-3">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none bg-white"
                >
                  {STEPS.map((step) => (
                    <option key={step} value={step}>
                      {step}
                    </option>
                  ))}
                </select>
                
                <button
                  onClick={handleUpdateStatus}
                  disabled={updating || selectedStatus === transfer.status}
                  className="flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {updating ? "Updating..." : "Update Status"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right columns: Progress Timeline */}
        <div className="md:col-span-2 space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            {/* Estimate panel */}
            <div className="flex items-center gap-3 bg-blue-50/50 rounded-xl p-4 border border-blue-100 mb-6 text-sm">
              <Clock className="text-blue-600 flex-shrink-0" size={20} />
              <div>
                <p className="text-xs font-semibold text-slate-500">Estimated Delivery Date</p>
                <p className="font-bold text-slate-900 mt-0.5">{transfer.status === "Delivered" ? "Delivered successfully" : estDeliveryDate}</p>
              </div>
            </div>

            <h2 className="text-lg font-bold text-slate-900 mb-6">Delivery Progress</h2>

            {/* Timeline element */}
            <div className="relative border-l border-slate-200 ml-4 space-y-8 pb-4">
              {STEPS.map((step, idx) => {
                const isCompleted = idx < currentStepIdx;
                const isActive = idx === currentStepIdx;
                const isPending = idx > currentStepIdx;

                return (
                  <div key={step} className="relative pl-8">
                    {/* Circle icon marker */}
                    <div
                      className={`absolute -left-3.5 top-0 flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all ${
                        isCompleted
                          ? "bg-green-600 border-green-600 text-white"
                          : isActive
                          ? "bg-white border-blue-600 text-blue-600 animate-pulse shadow-md"
                          : "bg-white border-slate-200 text-slate-300"
                      }`}
                    >
                      {isCompleted ? (
                        <Check size={14} />
                      ) : isActive ? (
                        <Truck size={14} />
                      ) : (
                        <div className="h-2 w-2 rounded-full bg-slate-300"></div>
                      )}
                    </div>

                    {/* Step Content */}
                    <div>
                      <h4
                        className={`text-sm font-bold transition-colors ${
                          isActive
                            ? "text-blue-600"
                            : isCompleted
                            ? "text-slate-900"
                            : "text-slate-400"
                        }`}
                      >
                        {step}
                      </h4>
                      {isActive && (
                        <p className="mt-1 text-xs text-slate-500">
                          Active State: Shipment is currently in this logistics stage.
                        </p>
                      )}
                      {isCompleted && (
                        <p className="mt-0.5 text-2xs text-green-600 font-semibold uppercase tracking-wider">
                          Completed stage
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransferTrackingDetail;
