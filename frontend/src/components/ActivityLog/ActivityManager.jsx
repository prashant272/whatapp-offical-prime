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
        <ActivityStats stats={reportData.stats} followUpStats={reportData.followUpStats} />
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
    </div>
  );
};

export default ActivityManager;
