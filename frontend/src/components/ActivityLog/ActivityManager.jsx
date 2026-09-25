import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { History, BarChart2, RefreshCw } from "lucide-react";
import { API_BASE } from "../../api";

import ActivityFilters from "./ActivityFilters";
import ActivityStats from "./ActivityStats";
import ActivityTable from "./ActivityTable";
import UserReportView from "./UserReportView";

const ActivityManager = () => {
  const [logs, setLogs] = useState([]);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    user: "all",
    action: "all",
    startDate: "",
    endDate: ""
  });
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showMessagesModal, setShowMessagesModal] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [showMissedModal, setShowMissedModal] = useState(false);

  const fetchActivities = useCallback(async (p = 1, f = filters) => {
    setLoading(true);
    try {
      const userInfo = JSON.parse(localStorage.getItem("userInfo"));
      const config = { 
        headers: { Authorization: `Bearer ${userInfo.token}` },
        params: { ...f, page: p, limit: 50 }
      };
      
      const res = await axios.get(`${API_BASE}/activities`, config);
      
      if (p === 1) {
        setLogs(res.data.logs);
      } else {
        setLogs(prev => [...prev, ...res.data.logs]);
      }
      setHasMore(res.data.hasMore);
    } catch (err) {
      console.error("Error fetching activities:", err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchUserReport = async (userId, f = filters) => {
    if (!userId || userId === "all") {
      setReportData(null);
      return;
    }
    try {
      const userInfo = JSON.parse(localStorage.getItem("userInfo"));
      const config = { 
        headers: { Authorization: `Bearer ${userInfo.token}` },
        params: { userId, startDate: f.startDate, endDate: f.endDate }
      };
      const res = await axios.get(`${API_BASE}/activities/report`, config);
      setReportData(res.data);
    } catch (err) {
      console.error("Error fetching user report:", err);
    }
  };

  useEffect(() => {
    fetchActivities(1);
    if (filters.user !== "all") {
      fetchUserReport(filters.user);
    } else {
      setReportData(null);
    }
  }, [filters, fetchActivities]);

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    setPage(1);
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchActivities(nextPage);
  };

  return (
    <div className="chat-container" style={{ padding: "1.5rem", overflowY: "auto", height: "100vh" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <div style={{ width: "45px", height: "45px", borderRadius: "12px", background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BarChart2 size={24} color="var(--accent-primary)" />
          </div>
          <div>
            <h3 style={{ margin: 0 }}>Advanced CRM Reporting</h3>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>Track productivity and timeline across your entire team</p>
          </div>
        </div>
        <button 
          className="btn-primary" 
          onClick={() => fetchActivities(1)} 
          disabled={loading}
          style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 20px" }}
        >
          <RefreshCw size={16} className={loading ? "spin" : ""} /> Refresh Data
        </button>
      </div>

      <ActivityFilters onFilterChange={handleFilterChange} />
      
      {reportData && (
        <ActivityStats 
          stats={reportData.stats} 
          followUpStats={reportData.followUpStats} 
          onLoginsClick={() => setShowLoginModal(true)}
          onMessagesClick={() => setShowMessagesModal(true)}
          onPendingClick={() => setShowPendingModal(true)}
          onMissedClick={() => setShowMissedModal(true)}
        />
      )}

      {reportData && filters.user !== "all" && (
        <UserReportView reportData={reportData} userName={logs[0]?.user?.name || "Selected User"} />
      )}

      <div style={{ marginTop: "3rem" }}>
        <h4 style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "1.5rem" }}>
          <History size={18} color="var(--text-secondary)" /> Raw Activity Timeline
        </h4>
        <ActivityTable 
          logs={logs} 
          loading={loading} 
          hasMore={hasMore} 
          onFetchMore={handleLoadMore} 
        />
      </div>

      {showLoginModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
        }}>
          <div style={{ background: "white", padding: "2rem", borderRadius: "12px", width: "100%", maxWidth: "500px", maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}>
              <h3 style={{ margin: 0 }}>Login / Logout History</h3>
              <button onClick={() => setShowLoginModal(false)} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer" }}>&times;</button>
            </div>
            {reportData?.loginTimeline?.length > 0 ? (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {reportData.loginTimeline.map((item, idx) => (
                  <li key={idx} style={{ padding: "12px 0", borderBottom: "1px solid #eee", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: "600", color: item.action === "LOGIN" ? "#2ecc71" : "#e74c3c" }}>
                        {item.action === "LOGIN" ? "Logged In" : "Logged Out"}
                      </span>
                      <span style={{ color: "#666" }}>
                        {new Date(item.timestamp).toLocaleString("en-US", { 
                          month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true 
                        })}
                      </span>
                    </div>
                    {(item.ipAddress || item.location) && (
                      <div style={{ fontSize: "0.8rem", color: "#888", display: "flex", gap: "15px" }}>
                        {item.ipAddress && <span>🌐 IP: {item.ipAddress}</span>}
                        {item.location && <span>📍 Location: {item.location}</span>}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ textAlign: "center", color: "#888" }}>No login history found for this period.</p>
            )}
          </div>
        </div>
      )}

      {showMessagesModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
        }}>
          <div style={{ background: "white", padding: "2rem", borderRadius: "12px", width: "100%", maxWidth: "500px", maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}>
              <h3 style={{ margin: 0 }}>Messages Sent</h3>
              <button onClick={() => setShowMessagesModal(false)} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer" }}>&times;</button>
            </div>
            {reportData?.messagesTimeline?.length > 0 ? (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {reportData.messagesTimeline.map((item, idx) => (
                  <li key={idx} style={{ padding: "12px 0", borderBottom: "1px solid #eee", display: "flex", flexDirection: "column", gap: "5px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: "600", color: "var(--accent-primary)" }}>{item.target}</span>
                      <span style={{ color: "#666", fontSize: "0.85rem" }}>
                        {new Date(item.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}
                      </span>
                    </div>
                    {item.details && <div style={{ fontSize: "0.85rem", color: "#555" }}>{item.details}</div>}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ textAlign: "center", color: "#888" }}>No messages sent in this period.</p>
            )}
          </div>
        </div>
      )}

      {showPendingModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
        }}>
          <div style={{ background: "white", padding: "2rem", borderRadius: "12px", width: "100%", maxWidth: "500px", maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}>
              <h3 style={{ margin: 0 }}>Pending Followups</h3>
              <button onClick={() => setShowPendingModal(false)} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer" }}>&times;</button>
            </div>
            {reportData?.pendingFollowupsList?.length > 0 ? (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {reportData.pendingFollowupsList.map((item, idx) => (
                  <li key={idx} style={{ padding: "12px 0", borderBottom: "1px solid #eee", display: "flex", flexDirection: "column", gap: "5px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: "600", color: "#f39c12" }}>{item.phone || item.contact}</span>
                      <span style={{ color: "#666", fontSize: "0.85rem" }}>
                        {new Date(item.followUpTime).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}
                      </span>
                    </div>
                    {item.followUpActivity && <div style={{ fontSize: "0.85rem", color: "#555" }}>Activity: {item.followUpActivity}</div>}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ textAlign: "center", color: "#888" }}>No pending followups.</p>
            )}
          </div>
        </div>
      )}

      {showMissedModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
        }}>
          <div style={{ background: "white", padding: "2rem", borderRadius: "12px", width: "100%", maxWidth: "500px", maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}>
              <h3 style={{ margin: 0 }}>Missed Followups</h3>
              <button onClick={() => setShowMissedModal(false)} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer" }}>&times;</button>
            </div>
            {reportData?.missedFollowupsList?.length > 0 ? (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {reportData.missedFollowupsList.map((item, idx) => (
                  <li key={idx} style={{ padding: "12px 0", borderBottom: "1px solid #eee", display: "flex", flexDirection: "column", gap: "5px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: "600", color: "#e74c3c" }}>{item.phone || item.contact}</span>
                      <span style={{ color: "#666", fontSize: "0.85rem" }}>
                        {new Date(item.followUpTime).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}
                      </span>
                    </div>
                    {item.followUpActivity && <div style={{ fontSize: "0.85rem", color: "#555" }}>Activity: {item.followUpActivity}</div>}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ textAlign: "center", color: "#888" }}>No missed followups.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityManager;
