import React, { useState, useEffect } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { Search, MapPin, Tag, Box, Calendar, Plus } from "lucide-react";
import Swal from "sweetalert2";

const AllMedicines = () => {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Search & Filters state
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [city, setCity] = useState("All");
  const [expiry, setExpiry] = useState("All");
  const [minQty, setMinQty] = useState("");
  const [sortBy, setSortBy] = useState("expiry-asc");

  // Dynamic filter values lists
  const [categories, setCategories] = useState([]);
  const [cities, setCities] = useState([]);

  useEffect(() => {
    fetchMedicines();
  }, []);

  const fetchMedicines = async () => {
    try {
      setLoading(true);
      const res = await api.get("/medicines/all-available");
      const data = res.data || [];
      setMedicines(data);

      // Extract filter options dynamically
      setCategories([...new Set(data.map((m) => m.category).filter(Boolean))]);
      setCities([...new Set(data.map((m) => m.city).filter(Boolean))]);
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to load global medicines list.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async (medId, medicineName, quantity) => {
    if (user?.role !== "NGO") {
      Swal.fire("Access Denied", "Only NGOs can claim medicines from the global directory.", "warning");
      return;
    }

    const confirm = await Swal.fire({
      title: `Claim ${medicineName}?`,
      text: `Are you sure you want to claim this entire batch of ${quantity} units?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#2563EB",
      cancelButtonColor: "#64748B",
      confirmButtonText: "Yes, Claim",
    });

    if (!confirm.isConfirmed) return;

    try {
      const res = await api.post("/medicines/claim", { medicine_id: medId });
      Swal.fire({
        icon: "success",
        title: "Claim Processed!",
        text: res.data.message || "Medicine batch claimed successfully.",
        timer: 1500,
        showConfirmButton: false,
      }).then(() => {
        fetchMedicines();
      });
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "Claim Failed",
        text: err.response?.data || "Verification error or database constraint issue.",
        confirmButtonColor: "#2563EB",
      });
    }
  };

  // Processing client-side filter & search
  const getFilteredMedicines = () => {
    let result = [...medicines];

    // Search query match
    if (search) {
      const query = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.medicine_name.toLowerCase().includes(query) ||
          m.batch_number?.toLowerCase().includes(query) ||
          m.donor_name?.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (category !== "All") {
      result = result.filter((m) => m.category === category);
    }

    // City filter
    if (city !== "All") {
      result = result.filter((m) => m.city === city);
    }

    // Expiry status filter
    if (expiry !== "All") {
      result = result.filter((m) => m.expiry_status === expiry);
    }

    // Quantity filter
    if (minQty) {
      result = result.filter((m) => m.quantity >= parseInt(minQty, 10));
    }

    // Sorting logic
    result.sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return a.medicine_name.localeCompare(b.medicine_name);
        case "name-desc":
          return b.medicine_name.localeCompare(a.medicine_name);
        case "expiry-asc":
          return new Date(a.expiry_date) - new Date(b.expiry_date);
        case "expiry-desc":
          return new Date(b.expiry_date) - new Date(a.expiry_date);
        case "qty-desc":
          return b.quantity - a.quantity;
        case "qty-asc":
          return a.quantity - b.quantity;
        default:
          return 0;
      }
    });

    return result;
  };

  const filteredMedicines = getFilteredMedicines();

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-slate-200 animate-pulse rounded-lg"></div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 bg-slate-200 animate-pulse rounded-2xl"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Global Inventory</h1>
        <p className="text-sm text-slate-500 mt-1">
          Explore and search for available medicine donations across the system
        </p>
      </div>

      {/* Advanced Filter Interface */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search size={18} />
            </span>
            <input
              type="text"
              placeholder="Search by name, batch, or donor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none"
            >
              <option value="All">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none"
            >
              <option value="All">All Cities</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none"
            >
              <option value="All">All Expiry Statuses</option>
              <option value="Available">Available (Safe)</option>
              <option value="Near Expiry">Near Expiry</option>
              <option value="Expired">Expired</option>
            </select>

            <input
              type="number"
              placeholder="Min Qty"
              value={minQty}
              onChange={(e) => setMinQty(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none w-24"
            />

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none"
            >
              <option value="expiry-asc">Expiry: Soonest first</option>
              <option value="expiry-desc">Expiry: Latest first</option>
              <option value="qty-desc">Quantity: High to Low</option>
              <option value="qty-asc">Quantity: Low to High</option>
              <option value="name-asc">Name: A to Z</option>
              <option value="name-desc">Name: Z to A</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid of Medicine Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filteredMedicines.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed border-slate-200 py-16 text-center text-slate-400">
            No medicine stock matched your current filters.
          </div>
        ) : (
          filteredMedicines.map((med) => {
            let statusBadge = "";
            let badgeClass = "bg-green-50 text-green-700";

            if (med.expiry_status === "Expired") {
              badgeClass = "bg-red-50 text-red-700";
              statusBadge = "Expired";
            } else if (med.expiry_status === "Near Expiry") {
              badgeClass = "bg-amber-50 text-amber-700";
              statusBadge = "Near Expiry";
            } else {
              statusBadge = "Available";
            }

            return (
              <div
                key={med.medicine_id}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <span className={`inline-flex items-center rounded px-2 py-0.5 text-2xs font-semibold uppercase tracking-wider ${badgeClass}`}>
                      {statusBadge}
                    </span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-2xs font-semibold text-slate-500">
                      {med.category || "General"}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 mt-3">{med.medicine_name}</h3>
                  <p className="text-2xs font-mono text-slate-400 mt-0.5">Batch: {med.batch_number || "N/A"}</p>

                  <div className="mt-5 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Box size={14} className="text-slate-400" />
                      <span>
                        Quantity: <span className="font-bold text-slate-900">{med.quantity} units</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Calendar size={14} className="text-slate-400" />
                      <span>
                        Expiry Date:{" "}
                        <span className="font-semibold text-slate-900">
                          {med.expiry_date ? med.expiry_date.split("T")[0] : "N/A"}
                        </span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <MapPin size={14} className="text-slate-400" />
                      <span className="capitalize">
                        Location: <span className="font-semibold text-slate-900">{med.city}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 mt-6 pt-4 flex items-center justify-between">
                  <div className="text-left">
                    <p className="text-4xs font-semibold text-slate-400 uppercase tracking-wider">Donated by</p>
                    <p className="text-xs font-bold text-slate-800 truncate max-w-[120px]">{med.donor_name}</p>
                  </div>
                  {user?.role === "NGO" && (
                    <button
                      onClick={() => handleClaim(med.medicine_id, med.medicine_name, med.quantity)}
                      className="inline-flex items-center justify-center gap-1 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700 transition-colors"
                    >
                      <Plus size={14} />
                      Claim Batch
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AllMedicines;
