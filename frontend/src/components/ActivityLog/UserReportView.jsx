import React from "react";
import { User, Phone, Calendar, CheckCircle, Clock, TrendingUp } from "lucide-react";

const UserReportView = ({ reportData, userName }) => {
  if (!reportData) return null;

  const { stats, followUpStats, contactTimeline } = reportData;

  return (
    <div className="glass-card" style={{ padding: "2.5rem", marginTop: "2rem", animation: "fadeIn 0.5s ease", background: "#ffffff", border: "1px solid #e0e0e0", boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2.5rem", borderBottom: "2px solid #f0f0f0", paddingBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div style={{ width: "65px", height: "65px", borderRadius: "18px", background: "rgba(37, 211,  Green102, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #2ecc71" }}>
            <User size={32} color="#2ecc71" />
          </div>
          <div>
            <h2 style={{ margin: 0, letterSpacing: "-1px", color: "#1a1a1a", fontWeight: "900" }}>Activity Report: {userName}</h2>
            <p style={{ margin: "5px 0 0", fontSize: "0.95rem", color: "#666", fontWeight: "600" }}>Comprehensive productivity and timeline analysis</p>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <span style={{ fontSize: "0.75rem", color: "#999", textTransform: "uppercase", fontWeight: "800", letterSpacing: "1px" }}>Report Generated</span>
          <p style={{ margin: "5px 0 0", fontWeight: "800", color: "#1a1a1a", fontSize: "1rem" }}>{new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginBottom: "2.5rem" }}>
        <div className="glass-card" style={{ padding: "2rem", background: "#fdfdfd", border: "1px solid #e0e0e0", borderTop: "5px solid #2ecc71" }}>
          <h4 style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: 0, marginBottom: "1.8rem", color: "#1a1a1a", fontWeight: "900", fontSize: "0.9rem", textTransform: "uppercase" }}>
            <TrendingUp size={18} color="#2ecc71" /> Productivity Summary
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1rem" }}>
              <span style={{ color: "#444", fontWeight: "600" }}>Total Messages Sent</span>
              <span style={{ fontWeight: "900", color: "#2ecc71", fontSize: "1.2rem" }}>{stats.messagesSent}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1rem" }}>
              <span style={{ color: "#444", fontWeight: "600" }}>Status Updates Performed</span>
              <span style={{ fontWeight: "900", color: "#1a1a1a", fontSize: "1.2rem" }}>{stats.statusUpdates}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1rem" }}>
              <span style={{ color: "#444", fontWeight: "600" }}>Total Leads Handled</span>
              <span style={{ fontWeight: "900", color: "#1a1a1a", fontSize: "1.2rem" }}>{followUpStats.totalAssigned}</span>
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: "2rem", background: "#fdfdfd", border: "1px solid #e0e0e0", borderTop: "5px solid #f1c40f" }}>
          <h4 style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: 0, marginBottom: "1.8rem", color: "#1a1a1a", fontWeight: "900", fontSize: "0.9rem", textTransform: "uppercase" }}>
            <Clock size={18} color="#f1c40f" /> Follow-up Performance
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1rem" }}>
              <span style={{ color: "#444", fontWeight: "600" }}>Pending Future Follow-ups</span>
              <span style={{ fontWeight: "900", color: "#f1c40f", fontSize: "1.2rem" }}>{followUpStats.pending}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1rem" }}>
              <span style={{ color: "#444", fontWeight: "600" }}>Missed / Overdue Follow-ups</span>
              <span style={{ fontWeight: "900", color: "#e74c3c", fontSize: "1.2rem" }}>{followUpStats.missed}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1rem" }}>
              <span style={{ color: "#444", fontWeight: "600" }}>Achievement Rate</span>
              <span style={{ fontWeight: "900", color: "#2ecc71", fontSize: "1.2rem" }}>
                {followUpStats.totalAssigned > 0 ? Math.round(((followUpStats.totalAssigned - followUpStats.missed) / followUpStats.totalAssigned) * 100) : 0}%
              </span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: "2rem" }}>
        <h4 style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "1.5rem", color: "#1a1a1a", fontWeight: "900", textTransform: "uppercase", fontSize: "0.9rem" }}>
          <Phone size={18} color="#2ecc71" /> Recent Contact Interactions
        </h4>
        <div style={{ maxHeight: "350px", overflowY: "auto", paddingRight: "15px", background: "#f8f9fa", borderRadius: "12px", border: "1px solid #eee" }} className="chat-scroll">
          {contactTimeline.length > 0 ? (
            contactTimeline.map((item, idx) => (
              <div key={idx} style={{ padding: "18px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                  <div style={{ fontSize: "1rem", fontWeight: "900", color: "#2ecc71", width: "140px", fontFamily: "monospace" }}>{item.target}</div>
                  <div style={{ fontSize: "0.95rem", color: "#333", fontWeight: "600" }}>{item.details}</div>
                </div>
                <div style={{ fontSize: "0.8rem", color: "#888", fontWeight: "700" }}>
                  {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))
          ) : (
            <p style={{ textAlign: "center", color: "#999", padding: "3rem", fontWeight: "600" }}>No contact interactions found for this period.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserReportView;
