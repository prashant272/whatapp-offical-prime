import React from "react";
import { LogIn, Send, CheckCircle, Clock, AlertCircle } from "lucide-react";

const ActivityStats = ({ stats, followUpStats }) => {
  if (!stats || !followUpStats) return null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.5rem", marginBottom: "2rem" }}>
      <div className="glass-card" style={{ padding: "1.5rem", background: "#ffffff", border: "1px solid #e0e0e0", borderLeft: "6px solid #2ecc71", boxShadow: "0 4px 15px rgba(0,0,0,0.05)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "#666", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.5px" }}>Work Sessions</p>
            <h3 style={{ margin: "8px 0 0", fontSize: "1.8rem", color: "#1a1a1a", fontWeight: "900" }}>{stats.logins} <span style={{ fontSize: "0.9rem", color: "#666", fontWeight: "600" }}>Logins</span></h3>
          </div>
          <div style={{ padding: "10px", background: "rgba(46, 204, 113, 0.1)", borderRadius: "10px" }}>
            <LogIn size={24} color="#2ecc71" />
          </div>
        </div>
      </div>

      <div className="glass-card" style={{ padding: "1.5rem", background: "#ffffff", border: "1px solid #e0e0e0", borderLeft: "6px solid var(--accent-primary)", boxShadow: "0 4px 15px rgba(0,0,0,0.05)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "#666", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.5px" }}>Messages Sent</p>
            <h3 style={{ margin: "8px 0 0", fontSize: "1.8rem", color: "#1a1a1a", fontWeight: "900" }}>{stats.messagesSent}</h3>
          </div>
          <div style={{ padding: "10px", background: "rgba(37, 211, 102, 0.1)", borderRadius: "10px" }}>
            <Send size={24} color="var(--accent-primary)" />
          </div>
        </div>
      </div>

      <div className="glass-card" style={{ padding: "1.5rem", background: "#ffffff", border: "1px solid #e0e0e0", borderLeft: "6px solid #f1c40f", boxShadow: "0 4px 15px rgba(0,0,0,0.05)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "#666", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.5px" }}>Pending Followups</p>
            <h3 style={{ margin: "8px 0 0", fontSize: "1.8rem", color: "#1a1a1a", fontWeight: "900" }}>{followUpStats.pending}</h3>
          </div>
          <div style={{ padding: "10px", background: "rgba(241, 196, 15, 0.1)", borderRadius: "10px" }}>
            <Clock size={24} color="#f1c40f" />
          </div>
        </div>
      </div>

      <div className="glass-card" style={{ padding: "1.5rem", background: "#ffffff", border: "1px solid #e0e0e0", borderLeft: "6px solid #e74c3c", boxShadow: "0 4px 15px rgba(0,0,0,0.05)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "#666", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.5px" }}>Missed Followups</p>
            <h3 style={{ margin: "8px 0 0", fontSize: "1.8rem", color: followUpStats.missed > 0 ? "#e74c3c" : "#1a1a1a", fontWeight: "900" }}>{followUpStats.missed}</h3>
          </div>
          <div style={{ padding: "10px", background: "rgba(231, 76, 60, 0.1)", borderRadius: "10px" }}>
            <AlertCircle size={24} color="#e74c3c" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityStats;
