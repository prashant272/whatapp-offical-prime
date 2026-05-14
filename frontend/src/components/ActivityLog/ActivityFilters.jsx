import React, { useState, useEffect } from "react";
import axios from "axios";
import { Search, Filter, Calendar, User } from "lucide-react";
import { API_BASE } from "../../api";

const ActivityFilters = ({ onFilterChange }) => {
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({
    user: "all",
    action: "all",
    startDate: "",
    endDate: ""
  });

  const fetchUsers = async () => {
    try {
      const userInfo = JSON.parse(localStorage.getItem("userInfo"));
      const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
      const res = await axios.get(`${API_BASE}/users`, config);
      setUsers(res.data);
    } catch (err) {
      console.error("Error fetching users for filter:", err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const newFilters = { ...filters, [name]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  return (
    <div className="glass-card" style={{ padding: "1.5rem", marginBottom: "2rem", display: "flex", gap: "1.5rem", flexWrap: "wrap", alignItems: "flex-end", background: "#ffffff", border: "1px solid #e0e0e0", boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
      <div style={{ flex: 1, minWidth: "220px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8rem", color: "#666", marginBottom: "8px", fontWeight: "700", textTransform: "uppercase" }}>
          <User size={14} /> Team Member
        </label>
        <select 
          name="user" 
          value={filters.user} 
          onChange={handleChange}
          style={{ width: "100%", padding: "12px", background: "#f8f9fa", border: "2px solid #eee", color: "#1a1a1a", borderRadius: "10px", outline: "none", cursor: "pointer", fontWeight: "600" }}
        >
          <option value="all">All Team Members</option>
          {users.map(u => (
            <option key={u._id} value={u._id}>{u.name} ({u.role})</option>
          ))}
        </select>
      </div>

      <div style={{ flex: 1, minWidth: "220px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8rem", color: "#666", marginBottom: "8px", fontWeight: "700", textTransform: "uppercase" }}>
          <Filter size={14} /> Action Type
        </label>
        <select 
          name="action" 
          value={filters.action} 
          onChange={handleChange}
          style={{ width: "100%", padding: "12px", background: "#f8f9fa", border: "2px solid #eee", color: "#1a1a1a", borderRadius: "10px", outline: "none", cursor: "pointer", fontWeight: "600" }}
        >
          <option value="all">All Actions</option>
          <option value="LOGIN">Logins</option>
          <option value="LOGOUT">Logouts</option>
          <option value="SEND_MESSAGE">Messages Sent</option>
          <option value="SEND_TEMPLATE">Templates Sent</option>
          <option value="UPDATE_STATUS">Status Updates</option>
          <option value="ASSIGN_CHAT">Assignments</option>
        </select>
      </div>

      <div style={{ display: "flex", gap: "15px", flex: 2, minWidth: "350px" }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8rem", color: "#666", marginBottom: "8px", fontWeight: "700", textTransform: "uppercase" }}>
            <Calendar size={14} /> From
          </label>
          <input 
            type="date" 
            name="startDate" 
            value={filters.startDate} 
            onChange={handleChange}
            style={{ width: "100%", padding: "12px", background: "#f8f9fa", border: "2px solid #eee", color: "#1a1a1a", borderRadius: "10px", outline: "none", fontWeight: "600" }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8rem", color: "#666", marginBottom: "8px", fontWeight: "700", textTransform: "uppercase" }}>
            <Calendar size={14} /> To
          </label>
          <input 
            type="date" 
            name="endDate" 
            value={filters.endDate} 
            onChange={handleChange}
            style={{ width: "100%", padding: "12px", background: "#f8f9fa", border: "2px solid #eee", color: "#1a1a1a", borderRadius: "10px", outline: "none", fontWeight: "600" }}
          />
        </div>
      </div>
    </div>
  );
};

export default ActivityFilters;
