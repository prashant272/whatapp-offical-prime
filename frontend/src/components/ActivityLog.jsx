import React, { useState, useEffect } from "react";
import axios from "axios";
import { History, User, Clock, Info, Shield, CheckCircle, Send, UserPlus, Trash2 } from "lucide-react";

import { API_BASE } from "../api";

const ActivityLog = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchLogs = async (p = 1) => {
    if (loading) return;
    setLoading(true);
    try {
      const userInfo = JSON.parse(localStorage.getItem("userInfo"));
      const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
      const res = await axios.get(`${API_BASE}/activities?page=${p}&limit=50`, config);
      
      const newLogs = res.data.logs || [];
      if (p === 1) {
        setLogs(newLogs);
      } else {
        setLogs(prev => [...prev, ...newLogs]);
      }
      setHasMore(res.data.hasMore);
    } catch (err) {
      console.error("Error fetching logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, []);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop - clientHeight < 100 && hasMore && !loading) {
      const nextPage = page + 1;
      fetchLogs(nextPage);
      setPage(nextPage);
    }
  };

  const getActionIcon = (action) => {
    switch (action) {
      case "LOGIN": return <History size={16} color="#3498db" />;
      case "SEND_MESSAGE": return <Send size={16} color="var(--accent-primary)" />;
      case "SEND_TEMPLATE": return <CheckCircle size={16} color="var(--accent-primary)" />;
      case "START_CAMPAIGN": return <Send size={16} color="#f1c40f" />;
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
    <div style={{ padding: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h3 style={{ margin: 0 }}>Activity Timeline</h3>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>Track who did what across the dashboard</p>
        </div>
        <button className="btn-primary" onClick={fetchLogs} disabled={loading} style={{ padding: "8px 15px", fontSize: "0.8rem" }}>
          {loading ? "Refreshing..." : "Refresh Logs"}
        </button>
      </div>

      <div 
        className="chat-scroll" 
        onScroll={handleScroll}
        style={{ background: "rgba(255,255,255,0.02)", borderRadius: "15px", border: "1px solid var(--glass-border)", overflowY: "auto", maxHeight: "70vh" }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", fontSize: "0.8rem", color: "var(--text-secondary)", borderBottom: "1px solid var(--glass-border)" }}>
              <th style={{ padding: "15px" }}>User</th>
              <th style={{ padding: "15px" }}>Action</th>
              <th style={{ padding: "15px" }}>Details</th>
              <th style={{ padding: "15px" }}>Target</th>
              <th style={{ padding: "15px" }}>Time</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log._id} style={{ borderBottom: "1px solid rgba(255,255,255,0.02)", fontSize: "0.85rem" }}>
                <td style={{ padding: "15px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <User size={14} style={{ color: getRoleColor(log.user?.role) }} />
                    </div>
                    <div>
                      <p style={{ margin: 0, fontWeight: "600" }}>{log.user?.name || "Deleted User"}</p>
                      <span style={{ fontSize: "0.65rem", color: getRoleColor(log.user?.role), fontWeight: "bold" }}>{log.user?.role?.toUpperCase()}</span>
                    </div>
                  </div>
                </td>
                <td style={{ padding: "15px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {getActionIcon(log.action)}
                    <span style={{ fontWeight: "600", fontSize: "0.8rem" }}>{log.action}</span>
                  </div>
                </td>
                <td style={{ padding: "15px", color: "var(--text-secondary)", fontSize: "0.8rem" }}>{log.details}</td>
                <td style={{ padding: "15px", color: "var(--accent-primary)", fontSize: "0.8rem" }}>{log.target || "-"}</td>
                <td style={{ padding: "15px", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                    <Clock size={12} />
                    {new Date(log.timestamp).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                  </div>
                </td>
              </tr>
            ))}
            {logs.length === 0 && !loading && (
              <tr>
                <td colSpan="5" style={{ textAlign: "center", padding: "3rem", color: "var(--text-secondary)" }}>No activity recorded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ActivityLog;
