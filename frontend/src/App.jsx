import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Send, FileText, BarChart3, MessageCircle, UserPlus, History, Zap, Settings, Bot, GitBranch, Layers } from "lucide-react";
import api from "./api";
import TemplateManager from "./components/TemplateManager";
import CampaignManager from "./components/CampaignManager";
import ChatModule from "./components/ChatModule";
import UserManager from "./components/UserManager";
import ActivityLog from "./components/ActivityLog";
import Login from "./components/Login";
import Sidebar from "./components/Sidebar";
import DashboardHome from "./components/DashboardHome";
import AutoReplyManager from "./components/AutoReplyManager";
import WhatsAppAccountSettings from "./components/WhatsAppAccountSettings";
import FlowManager from "./components/FlowManager";
import ContactManager from "./components/ContactManager";
import CustomFieldManager from "./components/CustomFieldManager";
import { WhatsAppAccountProvider, useWhatsAppAccount } from "./WhatsAppAccountContext";

function AppContent() {
  const [user, setUser] = useState(() => {
    const userInfo = localStorage.getItem("userInfo");
    return userInfo ? JSON.parse(userInfo) : null;
  });
  const [stats, setStats] = useState({ sent: 0, delivered: 0, failed: 0 });
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem("userInfo");
    setUser(null);
    navigate("/login");
  };

  const handleLogin = (u) => {
    setUser(u);
    navigate("/");
  };

  useEffect(() => {
    if (!user) return;
    
    const fetchStats = async () => {
      try {
        const res = await api.get("/campaigns");
        const allCampaigns = Array.isArray(res.data) ? res.data : [];
        const sums = allCampaigns.reduce((acc, curr) => ({
          sent: acc.sent + (curr.sentCount || 0),
          delivered: acc.delivered + (curr.deliveredCount || 0),
          failed: acc.failed + (curr.failedCount || 0)
        }), { sent: 0, delivered: 0, failed: 0 });
        setStats(sums);
      } catch (err) {
        console.error("Error fetching stats:", err);
      }
    };
    fetchStats();
  }, [location.pathname, user]);

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

  return (
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
              <Route path="/" element={<DashboardHome stats={stats} user={user} />} />
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
