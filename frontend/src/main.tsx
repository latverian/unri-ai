import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./styles/index.css";
import { ToastProvider } from "./components/Toast";
import { PrefsProvider } from "./lib/prefs";
import ChatPage from "./pages/ChatPage";

// Halaman admin dimuat terpisah supaya halaman chat tetap ringan.
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminLayout = lazy(() => import("./pages/AdminLayout"));
const AdminDocuments = lazy(() => import("./pages/AdminDocuments"));
const AdminInsights = lazy(() => import("./pages/AdminInsights"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PrefsProvider>
    <ToastProvider>
      <BrowserRouter>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<ChatPage />} />
            <Route path="/pengaturan" element={<SettingsPage />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDocuments />} />
              <Route path="insights" element={<AdminInsights />} />
            </Route>
            <Route path="*" element={<ChatPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ToastProvider>
    </PrefsProvider>
  </StrictMode>,
);
