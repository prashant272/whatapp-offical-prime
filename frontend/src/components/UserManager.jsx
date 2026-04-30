import React, { useState, useEffect } from "react";
import axios from "axios";
import { UserPlus, Trash2, Shield, User, Mail, Plus, X } from "lucide-react";

import { API_BASE } from "../api";

const UserManager = () => {
  const [users, setUsers] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "Executive" });
  const [loading, setLoading] = useState(false);

  const fetchUsers = async () => {
    try {
      const userInfo = JSON.parse(localStorage.getItem("userInfo"));
      const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
      const res = await axios.get(`${API_BASE}/users`, config);
      setUsers(res.data);
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userInfo = JSON.parse(localStorage.getItem("userInfo"));
      const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
      await axios.post(`${API_BASE}/users`, newUser, config);
      setShowAddModal(false);
      setNewUser({ name: "", email: "", password: "", role: "Executive" });
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.error || "Error creating user");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      const userInfo = JSON.parse(localStorage.getItem("userInfo"));
      const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
      await axios.delete(`${API_BASE}/users/${id}`, config);
      fetchUsers();
    } catch (err) {
      alert("Error deleting user");
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case "Admin": return "#ff4757";
      case "Manager": return "var(--accent-primary)";
      case "Executive": return "#3498db";
      default: return "white";
    }
  };

  return (
    <div style={{ padding: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h3 style={{ margin: 0 }}>Team Management</h3>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>Manage roles and access for your team</p>
        </div>
        <button className="btn-primary" onClick={() => setShowAddModal(true)} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <UserPlus size={18} /> Add New User
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.5rem" }}>
        {users.map(u => (
          <div key={u._id} className="glass-card" style={{ padding: "1.5rem", position: "relative" }}>
            <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
              <div style={{ width: "50px", height: "50px", borderRadius: "12px", background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${getRoleColor(u.role)}33` }}>
                <User size={24} style={{ color: getRoleColor(u.role) }} />
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: 0 }}>{u.name}</h4>
                <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "var(--text-secondary)" }}>{u.email}</p>
                <div style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "8px" }}>
                  <Shield size={12} style={{ color: getRoleColor(u.role) }} />
                  <span style={{ fontSize: "0.75rem", fontWeight: "700", color: getRoleColor(u.role), letterSpacing: "0.5px" }}>{u.role.toUpperCase()}</span>
                </div>
              </div>
              {u.role !== "Admin" && (
                <button
                  onClick={() => handleDelete(u._id)}
                  style={{ background: "rgba(255, 71, 87, 0.1)", border: "none", color: "#ff4757", padding: "8px", borderRadius: "8px", cursor: "pointer" }}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showAddModal && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="glass-card" style={{ width: "450px", padding: "2rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2rem" }}>
              <h3>Add New Team Member</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: "transparent", border: "none", color: "white", cursor: "pointer" }}><X /></button>
            </div>

            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Full Name</label>
                <input
                  type="text"
                  style={{ width: "100%", padding: "12px", background: "var(--bg-tertiary)", border: "1px solid var(--glass-border)", color: "white", borderRadius: "10px", marginTop: "5px" }}
                  value={newUser.name}
                  onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                  required
                />
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Email Address</label>
                <input
                  type="email"
                  style={{ width: "100%", padding: "12px", background: "var(--bg-tertiary)", border: "1px solid var(--glass-border)", color: "white", borderRadius: "10px", marginTop: "5px" }}
                  value={newUser.email}
                  onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                  required
                />
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Password</label>
                <input
                  type="password"
                  style={{ width: "100%", padding: "12px", background: "var(--bg-tertiary)", border: "1px solid var(--glass-border)", color: "white", borderRadius: "10px", marginTop: "5px" }}
                  value={newUser.password}
                  onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                  required
                />
              </div>
              <div style={{ marginBottom: "2rem" }}>
                <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Role</label>
                <select
                  style={{ width: "100%", padding: "12px", background: "var(--bg-tertiary)", border: "1px solid var(--glass-border)", color: "white", borderRadius: "10px", marginTop: "5px" }}
                  value={newUser.role}
                  onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                >
                  <option value="Manager">Manager</option>
                  <option value="Executive">Executive</option>
                </select>
              </div>

              <button type="submit" className="btn-primary" style={{ width: "100%", padding: "12px" }} disabled={loading}>
                {loading ? "Adding..." : "Create User"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManager;
