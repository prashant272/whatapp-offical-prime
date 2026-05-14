import React from "react";
import { User, History, Send, CheckCircle, Clock, Info, UserPlus, Trash2, LogOut } from "lucide-react";

const ActivityTable = ({ logs, loading, hasMore, onFetchMore }) => {
  const getActionIcon = (action) => {
    switch (action) {
      case "LOGIN": return <History size={16} color="#3498db" />;
      case "LOGOUT": return <LogOut size={16} color="#e67e22" />;
      case "SEND_MESSAGE": return <Send size={16} color="var(--accent-primary)" />;
      case "SEND_TEMPLATE": return <CheckCircle size={16} color="var(--accent-primary)" />;
      case "UPDATE_STATUS": return <Clock size={16} color="#f1c40f" />;
      case "ASSIGN_CHAT": return <UserPlus size={16} color="#2ecc71" />;
      case "CREATE_USER": return <UserPlus size={16} color="#2ecc71" />;
      case "DELETE_USER": return <Trash2 size={16} color="#e74c3c" />;
      default: return <Info size={16} color="var(--text-secondary)" />;
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case "Admin": return "#ff4757";
      case "Manager": return "var(--accent-primary)";
      default: return "#3498db";
    }
  };

  return (
    <div
      className="chat-scroll"
      style={{ background: "#ffffff", borderRadius: "15px", border: "1px solid #e0e0e0", overflowY: "auto", maxHeight: "60vh", boxShadow: "0 4px 15px rgba(0,0,0,0.05)" }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", fontSize: "0.85rem", color: "#666", borderBottom: "2px solid #f0f0f0", position: "sticky", top: 0, background: "#f8f9fa", zIndex: 10 }}>
            <th style={{ padding: "18px", fontWeight: "800" }}>USER</th>
            <th style={{ padding: "18px", fontWeight: "800" }}>ACTION</th>
            <th style={{ padding: "18px", fontWeight: "800" }}>DETAILS</th>
            <th style={{ padding: "18px", fontWeight: "800" }}>TARGET</th>
            <th style={{ padding: "18px", fontWeight: "800" }}>TIME</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log._id} style={{ borderBottom: "1px solid #f0f0f0", fontSize: "0.9rem", transition: "background 0.2s" }} className="table-row-hover">
              <td style={{ padding: "15px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "35px", height: "35px", borderRadius: "10px", background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${getRoleColor(log.user?.role)}` }}>
                    <User size={16} style={{ color: getRoleColor(log.user?.role) }} />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: "800", color: "#1a1a1a" }}>{log.user?.name || "Deleted User"}</p>
                    <span style={{ fontSize: "0.7rem", color: getRoleColor(log.user?.role), fontWeight: "900", textTransform: "uppercase" }}>{log.user?.role}</span>
                  </div>
                </div>
              </td>
              <td style={{ padding: "15px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {getActionIcon(log.action)}
                  <span style={{ fontWeight: "700", fontSize: "0.85rem", color: "#1a1a1a" }}>{log.action}</span>
                </div>
              </td>
              <td style={{ padding: "15px", color: "#444", fontSize: "0.9rem", fontWeight: "500" }}>{log.details}</td>
              <td style={{ padding: "15px", color: "#2ecc71", fontSize: "0.95rem", fontWeight: "800", fontFamily: "monospace" }}>{log.target || "-"}</td>
              <td style={{ padding: "15px", fontSize: "0.85rem", color: "#666", fontWeight: "600" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Clock size={14} />
                  {new Date(log.timestamp).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                </div>
              </td>
            </tr>
          ))}
          {logs.length === 0 && !loading && (
            <tr>
              <td colSpan="5" style={{ textAlign: "center", padding: "3rem", color: "var(--text-secondary)" }}>No activity matching filters.</td>
            </tr>
          )}
          {hasMore && (
            <tr>
              <td colSpan="5" style={{ textAlign: "center", padding: "1rem" }}>
                <button 
                  onClick={onFetchMore} 
                  disabled={loading}
                  style={{ background: "transparent", border: "1px solid var(--glass-border)", color: "var(--text-secondary)", padding: "5px 15px", borderRadius: "20px", cursor: "pointer", fontSize: "0.8rem" }}
                >
                  {loading ? "Loading..." : "Load More Activity"}
                </button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ActivityTable;
