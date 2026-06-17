import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { ArrowLeft, Megaphone } from "lucide-react";
import Swal from "sweetalert2";

const RequestMedicine = () => {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [urgency, setUrgency] = useState("Normal");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post("/requests/create", {
        medicine_name: name,
        required_quantity: parseInt(quantity, 10),
        urgency,
      });

      Swal.fire({
        icon: "success",
        title: "Request Created",
        text: "Medicine request created successfully!",
        timer: 1500,
        showConfirmButton: false,
      }).then(() => {
        navigate("/");
      });
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "Request Failed",
        text: err.response?.data?.message || "Failed to create request.",
        confirmButtonColor: "#2563EB",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 font-medium"
      >
        <ArrowLeft size={16} />
        Back to Dashboard
      </button>

      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Request Medicine</h1>
        <p className="text-sm text-slate-500 mt-1 mb-6">Create a public demand request for local donor matching</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Medicine Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              placeholder="e.g. Insulin or Amoxicillin"
            />
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Required Quantity (Units)
              </label>
              <input
                type="number"
                required
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                placeholder="e.g. 200"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Urgency Tier
              </label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none bg-white"
              >
                <option value="Low">Low</option>
                <option value="Normal">Normal</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-blue-700 disabled:opacity-50 mt-4"
          >
            <Megaphone size={16} />
            {loading ? "Submitting Request..." : "Broadcast Request"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default RequestMedicine;
