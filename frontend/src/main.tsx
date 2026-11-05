import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./styles/index.css";
import { ToastProvider } from "./components/Toast";
import { PrefsProvider } from "./lib/prefs";
import { SessionProvider } from "./lib/session";
import ChatPage from "./pages/ChatPage";

// Halaman admin dimuat terpisah supaya halaman chat tetap ringan.
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminLayout = lazy(() => import("./pages/AdminLayout"));
const AdminDocuments = lazy(() => import("./pages/AdminDocuments"));
const AdminInsights = lazy(() => import("./pages/AdminInsights"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const SharedPage = lazy(() => import("./pages/SharedPage"));
const LoginPage = lazy(() => import("./pages/AuthPages").then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import("./pages/AuthPages").then((m) => ({ default: m.RegisterPage })));
const ForgotPage = lazy(() => import("./pages/AuthPages").then((m) => ({ default: m.ForgotPage })));
const ResetPage = lazy(() => import("./pages/AuthPages").then((m) => ({ default: m.ResetPage })));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PrefsProvider>
    <SessionProvider>
    <ToastProvider>
      <BrowserRouter>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<ChatPage />} />
            <Route path="/pengaturan" element={<SettingsPage />} />
            <Route path="/masuk" element={<LoginPage />} />
            <Route path="/daftar" element={<RegisterPage />} />
            <Route path="/lupa-password" element={<ForgotPage />} />
            <Route path="/reset-password" element={<ResetPage />} />
            <Route path="/bagikan/:token" element={<SharedPage />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDocuments />} />
              <Route path="insights" element={<AdminInsights />} />
              <Route path="pengguna" element={<AdminUsers />} />
            </Route>
            <Route path="*" element={<ChatPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ToastProvider>
    </SessionProvider>
    </PrefsProvider>
  </StrictMode>,
);
