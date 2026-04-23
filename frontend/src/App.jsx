import React, { useState, useEffect } from "react";
import { LayoutDashboard, Send, FileText, Users, Settings, BarChart3, Bell, Search, MessageCircle, LogOut, UserPlus } from "lucide-react";
import axios from "axios";
import { API_BASE } from "./api";
import TemplateManager from "./components/TemplateManager";
import CampaignManager from "./components/CampaignManager";
import ChatModule from "./components/ChatModule";
import UserManager from "./components/UserManager";
import ActivityLog from "./components/ActivityLog";
import Login from "./components/Login";
import { History } from "lucide-react";

// Sidebar Item Component
const NavItem = ({ icon: Icon, label, active, onClick }) => (
  <div className={`nav-link ${active ? "active" : ""}`} onClick={onClick} style={{ cursor: "pointer" }}>
    <Icon size={20} />
    <span>{label}</span>
  </div>
);

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [stats, setStats] = useState({ sent: 0, delivered: 0, failed: 0 });
  const [user, setUser] = useState(null);

  useEffect(() => {
    const userInfo = localStorage.getItem("userInfo");
    if (userInfo) {
      setUser(JSON.parse(userInfo));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("userInfo");
    setUser(null);
  };

  useEffect(() => {
    if (!user) return;
    
    const fetchStats = async () => {
      try {
        const config = { headers: { Authorization: `Bearer ${user.token}` } };
        const res = await axios.get(`${API_BASE}/campaigns`, config);
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
  }, [activeTab, user]);

  if (!user) {
    return <Login onLogin={(u) => setUser(u)} />;
  }

  // Define menu items based on role
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["Admin", "Manager"] },
    { id: "templates", label: "Templates", icon: FileText, roles: ["Admin", "Manager"] },
    { id: "campaigns", label: "Campaigns", icon: Send, roles: ["Admin", "Manager"] },
    { id: "chats", label: "Chats", icon: MessageCircle, roles: ["Admin", "Manager", "Executive"] },
    { id: "activity", label: "Activity", icon: History, roles: ["Admin", "Manager"] },
    { id: "users", label: "Team", icon: UserPlus, roles: ["Admin"] },
    { id: "analytics", label: "Analytics", icon: BarChart3, roles: ["Admin", "Manager"] },
  ];

  const visibleMenu = menuItems.filter(item => item.roles.includes(user.role));

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div style={{ padding: "0 1rem", marginBottom: "1rem" }}>
          <h2 style={{ display: "flex", flexDirection: "column", gap: "2px", color: "var(--accent-primary)" }}>
            <span style={{ fontSize: "1.2rem", fontWeight: "900" }}>WHATSAPP</span>
            <span style={{ fontSize: "0.6rem", color: "var(--text-secondary)", letterSpacing: "1px" }}>PROFESSIONAL PANEL</span>
          </h2>
        </div>
        
        <nav style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {visibleMenu.map(item => (
            <NavItem 
              key={item.id}
              icon={item.icon} 
              label={item.label} 
              active={activeTab === item.id} 
              onClick={() => setActiveTab(item.id)} 
            />
          ))}
        </nav>

        <div style={{ marginTop: "auto" }}>
          <div className="nav-link" style={{ cursor: "pointer", color: "#ff4757" }} onClick={handleLogout}>
            <LogOut size={20} />
            <span>Logout</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2.5rem" }}>
          <div>
            <h1 style={{ fontSize: "1.8rem", fontWeight: "800" }}>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Area</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Logged in as <strong style={{ color: "var(--accent-primary)" }}>{user.name} ({user.role})</strong></p>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
            <div style={{ position: "relative" }}>
              <Search size={18} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
              <input type="text" placeholder="Search..." style={{ padding: "8px 12px 8px 35px", background: "var(--bg-secondary)", border: "1px solid var(--glass-border)", borderRadius: "8px", color: "white" }} />
            </div>
            <Bell size={20} color="var(--text-secondary)" cursor="pointer" />
            <div style={{ width: "35px", height: "35px", borderRadius: "50%", background: "var(--accent-primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "black", fontWeight: "bold" }}>
              {user.name.charAt(0)}
            </div>
          </div>
        </header>

        {/* Views */}
        {activeTab === "dashboard" && (
          <div className="dashboard-view">
            <div className="stats-grid">
              <div className="glass-card">
                <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem", fontWeight: "600" }}>SENT MESSAGES</span>
                <h2 style={{ fontSize: "2.2rem", marginTop: "0.5rem", fontWeight: "800" }}>{stats.sent}</h2>
                <div style={{ color: "var(--accent-primary)", fontSize: "0.8rem", marginTop: "0.5rem" }}>+12% vs last month</div>
              </div>
              <div className="glass-card">
                <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem", fontWeight: "600" }}>DELIVERY RATE</span>
                <h2 style={{ fontSize: "2.2rem", marginTop: "0.5rem", fontWeight: "800" }}>98.4%</h2>
                <div style={{ color: "var(--accent-primary)", fontSize: "0.8rem", marginTop: "0.5rem" }}>Optimized flow</div>
              </div>
              <div className="glass-card">
                <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem", fontWeight: "600" }}>ROLE ACCESS</span>
                <h2 style={{ fontSize: "2.2rem", marginTop: "0.5rem", fontWeight: "800" }}>{user.role}</h2>
                <div style={{ color: "var(--accent-primary)", fontSize: "0.8rem", marginTop: "0.5rem" }}>Permissions Active</div>
              </div>
            </div>
            
            <div className="glass-card" style={{ padding: "2rem", textAlign: "center" }}>
              <BarChart3 size={48} color="var(--accent-secondary)" style={{ marginBottom: "1rem" }} />
              <h3>Platform Connectivity</h3>
              <p style={{ color: "var(--text-secondary)", maxWidth: "400px", margin: "0.5rem auto" }}>Your WhatsApp Business API is connected and ready for high-volume messaging.</p>
            </div>
          </div>
        )}

        {activeTab === "templates" && <TemplateManager />}
        {activeTab === "campaigns" && <CampaignManager />}
        {activeTab === "chats" && <ChatModule />}
        {activeTab === "users" && <UserManager />}
        {activeTab === "activity" && <ActivityLog />}

        {/* Placeholder for other views */}
        {["contacts", "analytics"].includes(activeTab) && (
          <div className="glass-card" style={{ height: "400px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
            <BarChart3 size={64} color="var(--glass-border)" />
            <p style={{ marginTop: "1rem", color: "var(--text-secondary)" }}>{activeTab} module is coming soon in development phase.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
