import React from "react";
import { useAuth } from "../context/AuthContext";
import { LogOut, User, ShieldCheck } from "lucide-react";
import Swal from "sweetalert2";

const Navbar = () => {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Swal.fire({
      title: "Log Out?",
      text: "Are you sure you want to sign out of MediConnect?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#2563EB",
      cancelButtonColor: "#64748B",
      confirmButtonText: "Yes, logout",
    }).then((result) => {
      if (result.isConfirmed) {
        logout();
      }
    });
  };

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .substring(0, 2)
    : "U";

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-2">
          {/* Logo */}
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white shadow-md shadow-blue-500/20">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              fill="currentColor"
              className="bi bi-heart-pulse-fill"
              viewBox="0 0 16 16"
            >
              <path d="M1.475 9C2.702 10.84 4.779 12.871 8 15c3.221-2.129 5.298-4.16 6.525-6H12a.5.5 0 0 1-.464-.314l-1.457-3.642-1.598 5.593a.5.5 0 0 1-.945.049L5.889 6.568l-1.473 2.21A.5.5 0 0 1 4 9H1.475Z" />
              <path d="M.88 8C-2.427 1.68 4.41-2 7.823 1.143q.09.083.176.171a3 3 0 0 1 .176-.171C11.59-2 18.426 1.68 15.12 8h-2.783l-1.874-4.686a.5.5 0 0 0-.945.049L7.921 8.956 6.464 5.314a.5.5 0 0 0-.88-.091L3.732 8H.88Z" />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">
            Medi<span className="text-blue-600">Connect</span>
          </span>
        </div>

        {/* Profile / Right section */}
        <div className="flex items-center gap-4">
          <div className="hidden text-right md:block">
            <p className="text-sm font-semibold text-slate-900">{user?.name}</p>
            <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">
              {user?.role}
            </p>
          </div>

          <div className="group relative">
            <button className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-sm font-semibold text-white shadow-sm ring-2 ring-white hover:opacity-90">
              {initials}
            </button>

            {/* Profile Dropdown */}
            <div className="absolute right-0 mt-2 w-56 origin-top-right scale-95 rounded-xl border border-slate-100 bg-white p-2 opacity-0 shadow-lg transition-all duration-150 group-hover:scale-100 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto">
              <div className="px-3 py-2 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-900">{user?.name}</p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                <span className="mt-2 inline-flex items-center gap-1 rounded bg-green-50 px-1.5 py-0.5 text-2xs font-medium text-green-700">
                  <ShieldCheck size={12} /> Verified
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <LogOut size={16} />
                Log Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
