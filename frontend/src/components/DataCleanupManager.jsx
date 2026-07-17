import React, { useState, useEffect } from "react";
import { Database, Trash2, AlertTriangle, CheckCircle2, Calculator, Calendar } from "lucide-react";
import api from "../api";

const DataCleanupManager = () => {
  const [stats, setStats] = useState(null);
  const [statuses, setStatuses] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [olderThanDays, setOlderThanDays] = useState(0); // 0 means all time
  
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [message, setMessage] = useState(null);
  
  const [estimate, setEstimate] = useState(null);
  const [loadingEstimate, setLoadingEstimate] = useState(false);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const res = await api.get("/dashboard/db-stats");
      setStats(res.data);
    } catch (err) {
      console.error("Error fetching db stats", err);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchStatuses = async () => {
    try {
      const res = await api.get("/statuses");
      if (res.data) {
        setStatuses(res.data);
      }
    } catch (err) {
      console.error("Error fetching statuses", err);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchStatuses();
  }, []);

  useEffect(() => {
    const fetchEstimate = async () => {
      if (selectedStatuses.length === 0) {
        setEstimate(null);
        return;
      }
      setLoadingEstimate(true);
      try {
        const res = await api.post("/dashboard/bulk-delete-estimate", { 
          statuses: selectedStatuses,
          olderThanDays
        });
        setEstimate(res.data);
      } catch (error) {
        console.error("Error fetching estimate", error);
      } finally {
        setLoadingEstimate(false);
      }
    };
    
    // Add small delay to avoid spamming the API while clicking fast
    const timer = setTimeout(() => {
      fetchEstimate();
    }, 500);
    return () => clearTimeout(timer);
  }, [selectedStatuses, olderThanDays]);

  const toggleStatus = (statusName) => {
    if (selectedStatuses.includes(statusName)) {
      setSelectedStatuses(selectedStatuses.filter(s => s !== statusName));
    } else {
      setSelectedStatuses([...selectedStatuses, statusName]);
    }
  };

  const handleDelete = async () => {
    if (selectedStatuses.length === 0) {
      alert("Please select at least one status.");
      return;
    }
    
    const timeText = olderThanDays === 0 ? "ALL TIME" : `OLDER THAN ${olderThanDays} DAYS`;
    if (window.confirm(`WARNING: Are you sure you want to permanently delete messages (${timeText}) for contacts with statuses: ${selectedStatuses.join(", ")}? This cannot be undone.`)) {
      setLoadingDelete(true);
      setMessage(null);
      try {
        const res = await api.post("/dashboard/bulk-delete-by-status", { 
          statuses: selectedStatuses,
          olderThanDays
        });
        setMessage({ type: "success", text: res.data.message });
        setSelectedStatuses([]);
        fetchStats(); // refresh stats
      } catch (err) {
        setMessage({ type: "error", text: err.response?.data?.message || "Failed to delete messages." });
      } finally {
        setLoadingDelete(false);
      }
    }
  };

  return (
    <div style={{ background: "white", borderRadius: "16px", padding: "1.5rem", border: "1px solid #e1e1e1", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", marginTop: "2rem" }}>
      <h3 style={{ fontSize: "1.3rem", color: "#111b21", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "10px" }}>
        <Database size={24} color="#00a884" /> Data Management & Cleanup
      </h3>

      {/* Storage Stats */}
      <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "1.5rem" }}>
        <h4 style={{ margin: "0 0 0.5rem 0", color: "#334155", fontSize: "1rem" }}>Database Storage</h4>
        {loadingStats ? (
          <p style={{ margin: 0, color: "#64748b" }}>Loading stats...</p>
        ) : stats ? (
          <div style={{ display: "flex", gap: "2rem", color: "#475569", fontSize: "0.95rem", flexWrap: "wrap" }}>
            <div>
              <span style={{ fontWeight: "600", display: "block" }}>Logical Size</span>
              <span style={{ fontSize: "1.2rem", color: "#00a884", fontWeight: "700" }}>{stats.logicalSizeMB} MB</span>
            </div>
            <div>
              <span style={{ fontWeight: "600", display: "block" }}>Storage Size (Allocated)</span>
              <span style={{ fontSize: "1.2rem", color: "#3b82f6", fontWeight: "700" }}>{stats.storageSizeMB} MB</span>
            </div>
            <div>
              <span style={{ fontWeight: "600", display: "block" }}>Total Objects</span>
              <span style={{ fontSize: "1.2rem", color: "#8b5cf6", fontWeight: "700" }}>{stats.objects}</span>
            </div>
          </div>
        ) : (
          <p style={{ margin: 0, color: "#ef4444" }}>Failed to load storage stats.</p>
        )}
      </div>

      {/* Bulk Delete UI */}
      <div>
        <h4 style={{ margin: "0 0 0.5rem 0", color: "#334155", fontSize: "1rem" }}>Bulk Delete Messages by Status</h4>
        <p style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: "1rem" }}>Select one or more contact statuses. All chat messages for contacts with these statuses will be permanently deleted to free up space.</p>
        
        {/* Time Filter Dropdown */}
        <div style={{ marginBottom: "1.2rem", display: "flex", alignItems: "center", gap: "10px" }}>
          <Calendar size={18} color="#475569" />
          <span style={{ fontWeight: "600", color: "#334155" }}>Time Filter: </span>
          <select 
            value={olderThanDays}
            onChange={(e) => setOlderThanDays(Number(e.target.value))}
            style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "white", color: "#334155", outline: "none", cursor: "pointer" }}
          >
            <option value={0}>All Time (Delete Everything)</option>
            <option value={7}>Older than 7 Days</option>
            <option value={30}>Older than 30 Days</option>
            <option value={90}>Older than 90 Days</option>
            <option value={180}>Older than 6 Months</option>
          </select>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "1.5rem" }}>
          {statuses.map(s => {
            const isSelected = selectedStatuses.includes(s.name);
            return (
              <div 
                key={s._id} 
                onClick={() => toggleStatus(s.name)}
                style={{ 
                  padding: "8px 16px", 
                  borderRadius: "20px", 
                  border: isSelected ? "2px solid #ef4444" : "1px solid #cbd5e1",
                  background: isSelected ? "#fef2f2" : "white",
                  color: isSelected ? "#ef4444" : "#475569",
                  cursor: "pointer",
                  fontWeight: isSelected ? "600" : "400",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.2s"
                }}
              >
                {isSelected && <CheckCircle2 size={16} />}
                {s.name}
              </div>
            );
          })}
          {statuses.length === 0 && <p style={{ color: "#94a3b8", fontStyle: "italic" }}>No statuses found.</p>}
        </div>
        
        {/* Estimate Box */}
        {selectedStatuses.length > 0 && (
          <div style={{ background: "#f1f5f9", padding: "1rem", borderRadius: "8px", marginBottom: "1rem", display: "flex", gap: "1rem", alignItems: "center" }}>
            <Calculator size={24} color="#64748b" />
            <div style={{ flex: 1 }}>
              <h5 style={{ margin: "0 0 4px 0", color: "#334155" }}>Deletion Estimate {olderThanDays > 0 && `(Older than ${olderThanDays} Days)`}</h5>
              {loadingEstimate ? (
                <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem" }}>Calculating...</p>
              ) : estimate ? (
                <p style={{ margin: 0, color: "#475569", fontSize: "0.9rem" }}>
                  <strong>{estimate.contactCount}</strong> numbers have these statuses. 
                  Deleting their {olderThanDays > 0 ? "old " : ""}messages will remove approx <strong>{estimate.messageCount}</strong> messages 
                  and free up <strong style={{ color: "#ef4444" }}>{estimate.estimatedSizeMB} MB</strong>.
                </p>
              ) : null}
            </div>
          </div>
        )}

        {message && (
          <div style={{ 
            padding: "12px", 
            borderRadius: "8px", 
            marginBottom: "1rem", 
            background: message.type === "success" ? "#f0fdf4" : "#fef2f2", 
            color: message.type === "success" ? "#166534" : "#991b1b",
            border: `1px solid ${message.type === "success" ? "#bbf7d0" : "#fecaca"}`,
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            {message.type === "success" ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
            {message.text}
          </div>
        )}

        <button
          onClick={handleDelete}
          disabled={loadingDelete || selectedStatuses.length === 0}
          style={{ 
            background: selectedStatuses.length === 0 ? "#f1f5f9" : "#ef4444", 
            color: selectedStatuses.length === 0 ? "#94a3b8" : "white", 
            border: "none", 
            padding: "12px 24px", 
            borderRadius: "8px", 
            cursor: selectedStatuses.length === 0 ? "not-allowed" : "pointer", 
            fontWeight: "600", 
            display: "flex", 
            alignItems: "center", 
            gap: "8px",
            transition: "0.2s"
          }}
        >
          <Trash2 size={20} /> {loadingDelete ? "Deleting..." : "Delete Messages for Selected"}
        </button>
      </div>
    </div>
  );
};

export default DataCleanupManager;
