import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard,
  PlusCircle,
  HeartHandshake,
  Globe,
  Megaphone,
  Users,
  Activity,
  Truck
} from "lucide-react";

const Sidebar = () => {
  const { user } = useAuth();
  const role = user?.role;

  const getLinks = () => {
    switch (role) {
      case "Donor":
        return [
          { to: "/", label: "Inventory", icon: LayoutDashboard },
          { to: "/add-medicine", label: "Add Medicine", icon: PlusCircle },
          { to: "/matching-needs", label: "Matching Needs", icon: HeartHandshake },
          { to: "/all-medicines", label: "Global Inventory", icon: Globe },
          { to: "/transfers", label: "Transfer Tracker", icon: Truck },
        ];
      case "NGO":
        return [
          { to: "/", label: "Dashboard", icon: LayoutDashboard },
          { to: "/request-medicine", label: "Request Medicine", icon: Megaphone },
          { to: "/all-medicines", label: "Global Inventory", icon: Globe },
          { to: "/transfers", label: "Transfer Tracker", icon: Truck },
        ];
      case "Admin":
        return [
          { to: "/", label: "System Overview", icon: LayoutDashboard },
          { to: "/verify-users", label: "Verify Users", icon: Users },
          { to: "/activity-feed", label: "Activity Logs", icon: Activity },
          { to: "/transfers", label: "Transfer Tracker", icon: Truck },
        ];
      default:
        return [];
    }
  };

  const links = getLinks();

  return (
    <aside className="w-64 border-r border-slate-200 bg-white min-h-[calc(100vh-4rem)] p-4 flex flex-col justify-between">
      <div className="space-y-1">
        <p className="px-3 text-2xs font-semibold uppercase tracking-wider text-slate-400">
          Navigation
        </p>
        <nav className="mt-4 space-y-1">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                    isActive
                      ? "bg-blue-50 text-blue-600"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`
                }
              >
                <Icon size={18} />
                {link.label}
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
        <p className="text-xs font-semibold text-slate-900">MediConnect Pro</p>
        <p className="mt-1 text-2xs text-slate-500">
          Redistributing critical resources safely and transparently.
        </p>
      </div>
    </aside>
  );
};

export default Sidebar;
