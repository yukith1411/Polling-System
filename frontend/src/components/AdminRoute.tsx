import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AdminRoute() {
  const { teacher } = useAuth();
  return teacher?.role === "ADMIN" ? <Outlet /> : <Navigate to="/dashboard" replace />;
}