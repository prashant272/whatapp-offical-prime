import React from "react";
import { BarChart3 } from "lucide-react";

const DashboardHome = ({ stats, user }) => {
  return (
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
          <h2 style={{ fontSize: "2.2rem", marginTop: "0.5rem", fontWeight: "800" }}>{user?.role}</h2>
          <div style={{ color: "var(--accent-primary)", fontSize: "0.8rem", marginTop: "0.5rem" }}>Permissions Active</div>
        </div>
      </div>
      
      <div className="glass-card" style={{ padding: "2rem", textAlign: "center" }}>
        <BarChart3 size={48} color="var(--accent-secondary)" style={{ marginBottom: "1rem" }} />
        <h3>Platform Connectivity</h3>
        <p style={{ color: "var(--text-secondary)", maxWidth: "400px", margin: "0.5rem auto" }}>Your WhatsApp Business API is connected and ready for high-volume messaging.</p>
      </div>
    </div>
  );
};

export default DashboardHome;
