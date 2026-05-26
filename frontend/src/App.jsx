import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Send, FileText, BarChart3, MessageCircle, UserPlus, History, Zap, Settings, Bot, GitBranch, Layers } from "lucide-react";
import io from "socket.io-client";
import api from "./api";
import TemplateManager from "./components/TemplateManager";
import CampaignManager from "./components/CampaignManager";
import ChatModule from "./components/ChatModule";
import UserManager from "./components/UserManager";
import ActivityLog from "./components/ActivityLog/ActivityManager";
import Login from "./components/Login";
import Sidebar from "./components/Sidebar";
import DashboardHome from "./components/DashboardHome";
import AutoReplyManager from "./components/AutoReplyManager";
import WhatsAppAccountSettings from "./components/WhatsAppAccountSettings";
import FlowManager from "./components/FlowManager";
import ContactManager from "./components/ContactManager/ContactManagerMain";
import CustomFieldManager from "./components/CustomFieldManager";
import { WhatsAppAccountProvider, useWhatsAppAccount } from "./WhatsAppAccountContext";

function AppContent() {
  const [user, setUser] = useState(() => {
    const userInfo = localStorage.getItem("userInfo");
    return userInfo ? JSON.parse(userInfo) : null;
  });
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [forceLogoutCountdown, setForceLogoutCountdown] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem("userInfo");
    localStorage.removeItem("adminUserInfo");
    setUser(null);
    navigate("/login");
  };

  const handleLogin = (u) => {
    setUser(u);
    navigate("/");
  };

  const handleRevertImpersonate = () => {
    const adminInfo = localStorage.getItem("adminUserInfo");
    if (adminInfo) {
      localStorage.setItem("userInfo", adminInfo);
      localStorage.removeItem("adminUserInfo");
      const parsed = JSON.parse(adminInfo);
      setUser(parsed);
      window.location.href = "/users";
    }
  };

  // Socket listener for force_logout
  useEffect(() => {
    if (!user) return;

    const socketUrl = import.meta.env.VITE_API_URL || window.location.origin;
    const socket = io(socketUrl, { query: { userId: user._id, role: user.role } });

    socket.on("force_logout", (data) => {
      setForceLogoutCountdown(10);
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  // Countdown timer for force logout
  useEffect(() => {
    if (forceLogoutCountdown === null) return;
    if (forceLogoutCountdown === 0) {
      handleLogout();
      setForceLogoutCountdown(null);
      return;
    }
    const timer = setTimeout(() => {
      setForceLogoutCountdown(prev => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [forceLogoutCountdown]);


  if (!user && location.pathname !== "/login") {
    return <Navigate to="/login" />;
  }

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/", roles: ["Admin", "Manager"] },
    { id: "templates", label: "Templates", icon: FileText, path: "/templates", roles: ["Admin", "Manager"] },
    { id: "campaigns", label: "Campaigns", icon: Send, path: "/campaigns", roles: ["Admin", "Manager"] },
    { id: "chats", label: "Chats", icon: MessageCircle, path: "/chats", roles: ["Admin", "Manager", "Executive"] },
    { id: "automation", label: "Auto Replies", icon: Bot, path: "/automation", roles: ["Admin", "Manager"] },
    { id: "flows", label: "Smart Flows", icon: GitBranch, path: "/flows", roles: ["Admin", "Manager"] },
    { id: "settings", label: "WhatsApp Setup", icon: Settings, path: "/settings", roles: ["Admin"] },
    { id: "contacts", label: "Contacts", icon: UserPlus, path: "/contacts", roles: ["Admin", "Manager", "Executive"] },
    { id: "custom-fields", label: "Custom Fields", icon: Layers, path: "/custom-fields", roles: ["Admin", "Manager"] },
    { id: "activity", label: "Activity", icon: History, path: "/activity", roles: ["Admin", "Manager"] },
    { id: "users", label: "Team", icon: UserPlus, path: "/users", roles: ["Admin"] },
  ];

  const isChatTab = location.pathname.startsWith("/chats");

  const hasAdminBackup = !!localStorage.getItem("adminUserInfo");

  return (
    <div style={{ position: "relative" }}>
      {/* Sleek Impersonation Revert Banner */}
      {hasAdminBackup && (
        <div style={{
          background: "linear-gradient(135deg, #f59e0b, #d97706)",
          color: "white",
          padding: "10px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "0.9rem",
          fontWeight: "600",
          boxShadow: "0 4px 15px rgba(217, 119, 6, 0.25)",
          position: "sticky",
          top: 0,
          zIndex: 9999
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "1.1rem" }}>⚠️</span>
            <span>You are currently logged in as <strong>{user?.name}</strong> ({user?.role}). Actions you perform will be logged as this user.</span>
          </div>
          <button
            onClick={handleRevertImpersonate}
            style={{
              background: "white",
              color: "#d97706",
              border: "none",
              padding: "6px 14px",
              borderRadius: "20px",
              cursor: "pointer",
              fontWeight: "700",
              fontSize: "0.82rem",
              boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
              transition: "transform 0.2s"
            }}
            onMouseOver={e => e.currentTarget.style.transform = "scale(1.05)"}
            onMouseOut={e => e.currentTarget.style.transform = "scale(1)"}
          >
            Revert to Admin
          </button>
        </div>
      )}

      {/* Force Logout Countdown Overlay */}
      {forceLogoutCountdown !== null && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          background: "rgba(15, 23, 42, 0.96)",
          backdropFilter: "blur(12px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 99999,
          color: "white",
          textAlign: "center",
          boxShadow: "inset 0 0 100px rgba(239, 68, 68, 0.35)",
          animation: "pulseGlow 2s infinite alternate"
        }}>
          <style>{`
            @keyframes pulseGlow {
              from { box-shadow: inset 0 0 80px rgba(239, 68, 68, 0.3); }
              to { box-shadow: inset 0 0 150px rgba(239, 68, 68, 0.55); }
            }
            @keyframes countdownScale {
              0% { transform: scale(0.9); }
              50% { transform: scale(1.08); }
              100% { transform: scale(0.9); }
            }
          `}</style>
          <div style={{
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            padding: "3rem",
            borderRadius: "24px",
            maxWidth: "500px",
            boxShadow: "0 25px 50px -12px rgba(239, 68, 68, 0.25)"
          }}>
            <div style={{
              width: "100px",
              height: "100px",
              borderRadius: "50%",
              border: "4px solid #ef4444",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "3rem",
              fontWeight: "800",
              color: "#ef4444",
              margin: "0 auto 2rem",
              textShadow: "0 0 15px rgba(239, 68, 68, 0.6)",
              animation: "countdownScale 1s ease-in-out infinite"
            }}>
              {forceLogoutCountdown}
            </div>
            <h2 style={{ fontSize: "1.8rem", fontWeight: "800", margin: "0 0 1rem 0", color: "#f87171" }}>Account Deactivated</h2>
            <p style={{ color: "#94a3b8", fontSize: "1.05rem", lineHeight: "1.6", margin: 0 }}>
              Your account has been disabled by the administrator. You will be logged out automatically in {forceLogoutCountdown} seconds.
            </p>
          </div>
        </div>
      )}

      <Routes>
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="/*" element={
          <div className="dashboard-container" style={{ display: "flex" }}>
            <Sidebar
              user={user}
              menuItems={menuItems}
              handleLogout={handleLogout}
              isCollapsed={isCollapsed}
              setIsCollapsed={setIsCollapsed}
            />

            <main className="main-content" style={{
              marginLeft: isCollapsed ? "70px" : "240px",
              padding: isChatTab ? "0" : "1rem",
              height: "100vh",
              width: `calc(100% - ${isCollapsed ? "70px" : "240px"})`,
              overflow: isChatTab ? "hidden" : "auto",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              flex: 1
            }}>
              <Routes>
                <Route path="/" element={<DashboardHome user={user} />} />
                <Route path="/templates" element={<TemplateManager />} />
                <Route path="/campaigns" element={<CampaignManager />} />
                <Route path="/chats" element={<ChatModule />} />
                <Route path="/chats/:chatId" element={<ChatModule />} />
                <Route path="/users" element={<UserManager />} />
                <Route path="/activity" element={<ActivityLog />} />
                <Route path="/automation" element={<AutoReplyManager />} />
                <Route path="/flows" element={<FlowManagerWrapper />} />
                <Route path="/contacts" element={<ContactManager />} />
                <Route path="/custom-fields" element={<CustomFieldManager />} />
                <Route path="/settings" element={<WhatsAppAccountSettings />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </main>
          </div>
        } />
      </Routes>
    </div>
  );
}

function FlowManagerWrapper() {
  const { activeAccount } = useWhatsAppAccount();
  return <FlowManager activeAccount={activeAccount} />;
}

function App() {
  return (
    <WhatsAppAccountProvider>
      <AppContent />
    </WhatsAppAccountProvider>
  );
}

export default App;
