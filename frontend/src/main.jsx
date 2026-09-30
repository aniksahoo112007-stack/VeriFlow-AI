import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "./contexts/AuthContext";
import { ToastProvider } from "./contexts/ToastContext";
import { config } from "./config/env";
import ProtectedRoute from "./components/ProtectedRoute";
import Loading from "./components/Loading";
import AppLayout from "./layouts/AppLayout";
import "./index.css";

const LandingPage = lazy(() => import("./pages/LandingPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const SignupPage = lazy(() => import("./pages/SignupPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const DocumentsPage = lazy(() => import("./pages/DocumentsPage"));
const UploadPage = lazy(() => import("./pages/UploadPage"));
const ProcessingPage = lazy(() => import("./pages/ProcessingPage"));
const DocumentDetailPage = lazy(() => import("./pages/DocumentDetailPage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const ReviewQueuePage = lazy(() => import("./pages/ReviewQueuePage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Suspense fallback={<Loading label="Opening VeriFlow" />}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/documents" element={<DocumentsPage />} />
                  <Route path="/upload" element={<UploadPage />} />
                  <Route
                    path="/documents/:id/processing"
                    element={<ProcessingPage />}
                  />
                  <Route
                    path="/documents/:id"
                    element={<DocumentDetailPage />}
                  />
                  <Route path="/analytics" element={<AnalyticsPage />} />
                  <Route
                    path="/notifications"
                    element={<NotificationsPage />}
                  />
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>
              </Route>
              <Route element={<ProtectedRoute roles={["reviewer", "admin"]} />}>
                <Route element={<AppLayout />}>
                  <Route path="/review" element={<ReviewQueuePage />} />
                </Route>
              </Route>
              <Route element={<ProtectedRoute roles={["admin"]} />}>
                <Route element={<AppLayout />}>
                  <Route path="/admin" element={<AdminPage />} />
                </Route>
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
const app = config.googleClientId ? (
  <GoogleOAuthProvider clientId={config.googleClientId}>
    <App />
  </GoogleOAuthProvider>
) : (
  <App />
);
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>{app}</React.StrictMode>,
);
