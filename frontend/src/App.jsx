import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import AuthLayout from "./layouts/AuthLayout";
import MainLayout from "./layouts/MainLayout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import DonorDashboard from "./pages/DonorDashboard";
import NGODashboard from "./pages/NGODashboard";
import AdminDashboard from "./pages/AdminDashboard";
import AddMedicine from "./pages/AddMedicine";
import MatchingNeeds from "./pages/MatchingNeeds";
import RequestMedicine from "./pages/RequestMedicine";
import AllMedicines from "./pages/AllMedicines";
import TransferTrackingList from "./pages/TransferTrackingList";
import TransferTrackingDetail from "./pages/TransferTrackingDetail";
import ActivityLogs from "./pages/ActivityLogs";

// Role gatekeeper
const RoleBasedHome = () => {
  const { user } = useAuth();

  if (user?.role === "Donor") {
    return <DonorDashboard />;
  } else if (user?.role === "NGO") {
    return <NGODashboard />;
  } else if (user?.role === "Admin") {
    return <AdminDashboard />;
  }
  return <Navigate to="/login" replace />;
};

const RoleRoute = ({ children, allowedRoles }) => {
  const { user } = useAuth();
  
  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Auth Routes */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Route>

          {/* Secure App Routes */}
          <Route element={<MainLayout />}>
            {/* Dynamic Home dashboard based on role */}
            <Route path="/" element={<RoleBasedHome />} />
            
            {/* Donor specific routes */}
            <Route
              path="/add-medicine"
              element={
                <RoleRoute allowedRoles={["Donor"]}>
                  <AddMedicine />
                </RoleRoute>
              }
            />
            <Route
              path="/matching-needs"
              element={
                <RoleRoute allowedRoles={["Donor"]}>
                  <MatchingNeeds />
                </RoleRoute>
              }
            />

            {/* NGO specific routes */}
            <Route
              path="/request-medicine"
              element={
                <RoleRoute allowedRoles={["NGO"]}>
                  <RequestMedicine />
                </RoleRoute>
              }
            />

            {/* Admin specific routes */}
            <Route
              path="/verify-users"
              element={
                <RoleRoute allowedRoles={["Admin"]}>
                  <AdminDashboard />
                </RoleRoute>
              }
            />
            <Route
              path="/activity-feed"
              element={
                <RoleRoute allowedRoles={["Admin"]}>
                  <ActivityLogs />
                </RoleRoute>
              }
            />

            {/* Shared accessible routes */}
            <Route path="/all-medicines" element={<AllMedicines />} />
            <Route path="/transfers" element={<TransferTrackingList />} />
            <Route path="/transfers/:id" element={<TransferTrackingDetail />} />
          </Route>

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
