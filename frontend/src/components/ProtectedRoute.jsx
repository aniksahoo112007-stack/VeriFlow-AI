import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Loading from "./Loading";
export default function ProtectedRoute({ roles }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <Loading label="Restoring your secure session" />;
  if (!user)
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role))
    return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
