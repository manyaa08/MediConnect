import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { ArrowLeft, Plus } from "lucide-react";
import Swal from "sweetalert2";

const AddMedicine = () => {
  const [name, setName] = useState("");
  const [batch, setBatch] = useState("");
  const [expiry, setExpiry] = useState("");
  const [quantity, setQuantity] = useState("");
  const [category, setCategory] = useState("Tablet");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post("/medicines/add", {
        medicine_name: name,
        batch_number: batch,
        expiry_date: expiry,
        quantity: parseInt(quantity, 10),
        category,
      });

      Swal.fire({
        icon: "success",
        title: "Success",
        text: "Medicine added to stock successfully!",
        timer: 1500,
        showConfirmButton: false,
      }).then(() => {
        navigate("/");
      });
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "Failing to Add",
        text: err.response?.data?.message || "Failed to add medicine batch.",
        confirmButtonColor: "#2563EB",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back Link */}
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 font-medium"
      >
        <ArrowLeft size={16} />
        Back to Inventory
      </button>

      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Add Medicine Batch</h1>
        <p className="text-sm text-slate-500 mt-1 mb-6">List a new available batch for NGO match redistribution</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
                placeholder="e.g. Paracetamol"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Batch Number
              </label>
              <input
                type="text"
                required
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                placeholder="e.g. B1234"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Quantity (Units)
              </label>
              <input
                type="number"
                required
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                placeholder="e.g. 500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Medicine Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none bg-white"
              >
                <option value="Tablet">Tablet</option>
                <option value="Capsule">Capsule</option>
                <option value="Syrup">Syrup</option>
                <option value="Ointment">Ointment</option>
                <option value="Drops">Drops</option>
                <option value="Injection">Injection</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Expiry Date
            </label>
            <input
              type="date"
              required
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-blue-700 disabled:opacity-50 mt-4"
          >
            <Plus size={16} />
            {loading ? "Adding Batch..." : "Add to Stock"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddMedicine;
