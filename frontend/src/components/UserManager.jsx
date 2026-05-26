import React, { useState, useEffect } from "react";
import axios from "axios";
import { UserPlus, Trash2, Shield, User, Mail, Plus, X, Pencil, Power, LogIn } from "lucide-react";

import { API_BASE } from "../api";

const UserManager = () => {
  const [users, setUsers] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "Executive" });
  const [editingUser, setEditingUser] = useState(null); // { _id, name, email, role, password, isActive }
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

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setLoading(true);
    try {
      const userInfo = JSON.parse(localStorage.getItem("userInfo"));
      const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
      
      const payload = {
        name: editingUser.name,
        email: editingUser.email,
        role: editingUser.role,
        isActive: editingUser.isActive
      };
      if (editingUser.password && editingUser.password.trim()) {
        payload.password = editingUser.password;
      }

      await axios.put(`${API_BASE}/users/${editingUser._id}`, payload, config);
      setShowEditModal(false);
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.error || "Error updating user");
    } finally {
      setLoading(false);
    }
  };

  const toggleUserStatus = async (userObj) => {
    try {
      const userInfo = JSON.parse(localStorage.getItem("userInfo"));
      const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
      const nextActiveState = userObj.isActive === false ? true : false;
      
      await axios.put(`${API_BASE}/users/${userObj._id}`, { isActive: nextActiveState }, config);
      fetchUsers();
    } catch (err) {
      alert("Error changing user status");
    }
  };

  const handleImpersonate = async (targetUser) => {
    if (!window.confirm(`Are you sure you want to log in directly into ${targetUser.name}'s panel?`)) return;
    try {
      const userInfo = JSON.parse(localStorage.getItem("userInfo"));
      const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
      
      const res = await axios.post(`${API_BASE}/users/${targetUser._id}/impersonate`, {}, config);
      
      // Save original admin token to revert back later
      localStorage.setItem("adminUserInfo", JSON.stringify(userInfo));
      // Save impersonated token as primary user
      localStorage.setItem("userInfo", JSON.stringify(res.data));
      
      // Redirect to reload context
      window.location.href = "/";
    } catch (err) {
      alert(err.response?.data?.error || "Direct login failed");
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
          <div key={u._id} className="glass-card" style={{ 
            padding: "1.5rem", 
            position: "relative",
            background: u.isActive === false ? "#f8fafc" : "white",
            borderRadius: "20px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
            border: u.isActive === false ? "1.5px dashed #cbd5e1" : "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minHeight: "190px",
            transition: "transform 0.2s, box-shadow 0.2s",
            opacity: u.isActive === false ? 0.75 : 1
          }}>
            {/* Top Row: Avatar and User Details */}
            <div style={{ display: "flex", gap: "15px", alignItems: "flex-start", marginBottom: "1.5rem" }}>
              <div style={{ 
                width: "52px", 
                height: "52px", 
                borderRadius: "14px", 
                background: u.isActive === false ? "#f1f5f9" : `${getRoleColor(u.role)}10`, 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center", 
                border: u.isActive === false ? "1.5px solid #cbd5e1" : `1.5px solid ${getRoleColor(u.role)}25`,
                flexShrink: 0
              }}>
                <User size={24} style={{ color: u.isActive === false ? "#94a3b8" : getRoleColor(u.role) }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "700", color: u.isActive === false ? "#64748b" : "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.name}</h4>
                <p style={{ margin: "2px 0 0", fontSize: "0.85rem", color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.email}</p>
                <div style={{ display: "inline-flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: u.isActive === false ? "#e2e8f0" : `${getRoleColor(u.role)}15`, padding: "4px 10px", borderRadius: "20px" }}>
                    <Shield size={12} style={{ color: u.isActive === false ? "#64748b" : getRoleColor(u.role) }} />
                    <span style={{ fontSize: "0.7rem", fontWeight: "800", color: u.isActive === false ? "#64748b" : getRoleColor(u.role), letterSpacing: "0.5px" }}>{u.role.toUpperCase()}</span>
                  </div>
                  {u.isActive === false && (
                    <div style={{ display: "inline-flex", alignItems: "center", background: "#fee2e2", color: "#ef4444", padding: "4px 10px", borderRadius: "20px", fontSize: "0.7rem", fontWeight: "800", letterSpacing: "0.5px" }}>
                      DEACTIVATED
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Row: Actions Bar */}
            <div style={{ 
              display: "flex", 
              justifyContent: "flex-end", 
              gap: "8px", 
              borderTop: "1px solid #f1f5f9", 
              paddingTop: "1rem",
              marginTop: "auto"
            }}>
              {u.role !== "Admin" ? (
                <>
                  {/* Impersonate Button (Only clickable if active) */}
                  <button
                    onClick={() => u.isActive !== false && handleImpersonate(u)}
                    disabled={u.isActive === false}
                    title={u.isActive === false ? "Cannot login to a deactivated user" : "Direct Login to user panel"}
                    style={{ 
                      background: u.isActive === false ? "rgba(226, 232, 240, 0.5)" : "rgba(0, 168, 132, 0.08)", 
                      border: "none", 
                      color: u.isActive === false ? "#cbd5e1" : "#00a884", 
                      width: "36px", 
                      height: "36px", 
                      borderRadius: "10px", 
                      cursor: u.isActive === false ? "not-allowed" : "pointer", 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "center",
                      transition: "background 0.2s" 
                    }}
                  >
                    <LogIn size={16} />
                  </button>

                  {/* Enable/Disable status toggle (ALWAYS ACTIVE) */}
                  <button
                    onClick={() => toggleUserStatus(u)}
                    title={u.isActive === false ? "Activate/Enable User" : "Deactivate/Disable User"}
                    style={{ 
                      background: u.isActive === false ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.08)", 
                      border: "none", 
                      color: u.isActive === false ? "#10b981" : "#ef4444", 
                      width: "36px", 
                      height: "36px", 
                      borderRadius: "10px", 
                      cursor: "pointer", 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "center",
                      transition: "background 0.2s" 
                    }}
                  >
                    <Power size={16} style={{ filter: u.isActive === false ? "drop-shadow(0 0 4px rgba(16, 185, 129, 0.3))" : "none" }} />
                  </button>

                  {/* Edit button */}
                  <button
                    onClick={() => {
                      setEditingUser({
                        _id: u._id,
                        name: u.name,
                        email: u.email,
                        role: u.role,
                        isActive: u.isActive !== false,
                        password: ""
                      });
                      setShowEditModal(true);
                    }}
                    title="Edit User Info"
                    style={{ 
                      background: "rgba(59, 130, 246, 0.08)", 
                      border: "none", 
                      color: "#3b82f6", 
                      width: "36px", 
                      height: "36px", 
                      borderRadius: "10px", 
                      cursor: "pointer", 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "center",
                      transition: "background 0.2s" 
                    }}
                  >
                    <Pencil size={16} />
                  </button>

                  {/* Delete button */}
                  <button
                    onClick={() => handleDelete(u._id)}
                    title="Delete User"
                    style={{ 
                      background: "rgba(239, 68, 68, 0.08)", 
                      border: "none", 
                      color: "#ef4444", 
                      width: "36px", 
                      height: "36px", 
                      borderRadius: "10px", 
                      cursor: "pointer", 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "center",
                      transition: "background 0.2s" 
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              ) : (
                <span style={{ fontSize: "0.8rem", color: "#94a3b8", fontStyle: "italic", padding: "8px 0" }}>System Administrator (Locked)</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add New User Modal */}
      {showAddModal && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(15, 23, 42, 0.85)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="glass-card" style={{ width: "450px", padding: "2.5rem", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2rem", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "1.3rem" }}>Add New Team Member</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}><X size={24} /></button>
            </div>

            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: "1.2rem" }}>
                <label style={{ fontSize: "0.8rem", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase" }}>Full Name</label>
                <input
                  type="text"
                  style={{ width: "100%", padding: "12px", background: "var(--bg-tertiary)", border: "1.5px solid #e2e8f0", color: "black", borderRadius: "10px", marginTop: "5px", outline: "none" }}
                  value={newUser.name}
                  onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                  required
                />
              </div>
              <div style={{ marginBottom: "1.2rem" }}>
                <label style={{ fontSize: "0.8rem", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase" }}>Email Address</label>
                <input
                  type="email"
                  style={{ width: "100%", padding: "12px", background: "var(--bg-tertiary)", border: "1.5px solid #e2e8f0", color: "black", borderRadius: "10px", marginTop: "5px", outline: "none" }}
                  value={newUser.email}
                  onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                  required
                />
              </div>
              <div style={{ marginBottom: "1.2rem" }}>
                <label style={{ fontSize: "0.8rem", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase" }}>Password</label>
                <input
                  type="password"
                  style={{ width: "100%", padding: "12px", background: "var(--bg-tertiary)", border: "1.5px solid #e2e8f0", color: "black", borderRadius: "10px", marginTop: "5px", outline: "none" }}
                  value={newUser.password}
                  onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                  required
                />
              </div>
              <div style={{ marginBottom: "2rem" }}>
                <label style={{ fontSize: "0.8rem", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase" }}>Role</label>
                <select
                  style={{ width: "100%", padding: "12px", background: "white", border: "1.5px solid #e2e8f0", color: "black", borderRadius: "10px", marginTop: "5px", outline: "none" }}
                  value={newUser.role}
                  onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                >
                  <option value="Manager">Manager</option>
                  <option value="Executive">Executive</option>
                </select>
              </div>

              <button type="submit" className="btn-primary" style={{ width: "100%", padding: "14px", borderRadius: "12px", fontWeight: "700", fontSize: "0.95rem" }} disabled={loading}>
                {loading ? "Adding..." : "Create User"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(15, 23, 42, 0.85)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="glass-card" style={{ width: "450px", padding: "2.5rem", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2rem", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "1.3rem" }}>Edit Team Member</h3>
              <button onClick={() => { setShowEditModal(false); setEditingUser(null); }} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}><X size={24} /></button>
            </div>

            <form onSubmit={handleUpdate}>
              <div style={{ marginBottom: "1.2rem" }}>
                <label style={{ fontSize: "0.8rem", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase" }}>Full Name</label>
                <input
                  type="text"
                  style={{ width: "100%", padding: "12px", background: "var(--bg-tertiary)", border: "1.5px solid #e2e8f0", color: "black", borderRadius: "10px", marginTop: "5px", outline: "none" }}
                  value={editingUser.name}
                  onChange={e => setEditingUser({ ...editingUser, name: e.target.value })}
                  required
                />
              </div>
              <div style={{ marginBottom: "1.2rem" }}>
                <label style={{ fontSize: "0.8rem", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase" }}>Email Address</label>
                <input
                  type="email"
                  style={{ width: "100%", padding: "12px", background: "var(--bg-tertiary)", border: "1.5px solid #e2e8f0", color: "black", borderRadius: "10px", marginTop: "5px", outline: "none" }}
                  value={editingUser.email}
                  onChange={e => setEditingUser({ ...editingUser, email: e.target.value })}
                  required
                />
              </div>
              <div style={{ marginBottom: "1.2rem" }}>
                <label style={{ fontSize: "0.8rem", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase" }}>Password (Leave blank to keep same)</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  style={{ width: "100%", padding: "12px", background: "var(--bg-tertiary)", border: "1.5px solid #e2e8f0", color: "black", borderRadius: "10px", marginTop: "5px", outline: "none" }}
                  value={editingUser.password}
                  onChange={e => setEditingUser({ ...editingUser, password: e.target.value })}
                />
              </div>
              <div style={{ marginBottom: "1.2rem" }}>
                <label style={{ fontSize: "0.8rem", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase" }}>Role</label>
                <select
                  style={{ width: "100%", padding: "12px", background: "white", border: "1.5px solid #e2e8f0", color: "black", borderRadius: "10px", marginTop: "5px", outline: "none" }}
                  value={editingUser.role}
                  onChange={e => setEditingUser({ ...editingUser, role: e.target.value })}
                >
                  <option value="Manager">Manager</option>
                  <option value="Executive">Executive</option>
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "2rem" }}>
                <input 
                  type="checkbox" 
                  id="edit-user-active" 
                  checked={editingUser.isActive !== false} 
                  onChange={e => setEditingUser({ ...editingUser, isActive: e.target.checked })}
                  style={{ width: "18px", height: "18px", accentColor: "#00a884" }}
                />
                <label htmlFor="edit-user-active" style={{ fontSize: "0.9rem", fontWeight: "700", color: "#64748b", cursor: "pointer", userSelect: "none" }}>Account is Active</label>
              </div>

              <button type="submit" className="btn-primary" style={{ width: "100%", padding: "14px", borderRadius: "12px", fontWeight: "700", fontSize: "0.95rem" }} disabled={loading}>
                {loading ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManager;
