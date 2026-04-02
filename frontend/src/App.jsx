import { Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import WorkspaceBoard from "./pages/WorkspaceBoard";
import WorkspaceMembers from "./pages/WorkspaceMembers";
import BoardView from "./pages/BoardView";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  const location = useLocation();
  const { theme, isAuthenticated } = useAuth();

  // Force dark mode only on selected public pages.
  useEffect(() => {
    const darkModeOnlyRoutes = ['/', '/login', '/register', '/forgot-password', '/reset-password'];
    const forceDarkMode = darkModeOnlyRoutes.includes(location.pathname);

    if (forceDarkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
      return;
    }

    // Signed-in users keep their preference elsewhere.
    // Signed-out users get light theme on non-home pages.
    document.documentElement.setAttribute('data-theme', isAuthenticated ? theme : 'light');
  }, [location.pathname, theme, isAuthenticated]);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Protected Routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          } />
          <Route path="/workspace/:workspaceId" element={
            <ProtectedRoute>
              <WorkspaceBoard />
            </ProtectedRoute>
          } />
          <Route path="/workspace/:workspaceId/board/:boardId" element={
            <ProtectedRoute>
              <BoardView />
            </ProtectedRoute>
          } />
          <Route path="/workspace/:id/members" element={
            <ProtectedRoute>
              <WorkspaceMembers />
            </ProtectedRoute>
          } />
        </Routes>
      </main>
    </div>
  );
}

export default App;
