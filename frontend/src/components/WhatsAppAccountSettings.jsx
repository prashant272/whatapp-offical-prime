import React, { useState } from "react";
import { Plus, Trash2, CheckCircle2, Phone, Key, Hash, ShieldCheck, Globe, Pencil } from "lucide-react";
import api from "../api";
import { useWhatsAppAccount } from "../WhatsAppAccountContext";

const WhatsAppAccountSettings = () => {
  const { accounts, activeAccount, switchAccount, refreshAccounts } = useWhatsAppAccount();
  const [showAddModal, setShowAddModal] = useState(false);
  const [isEditing, setIsEditing] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    phoneNumberId: "",
    wabaId: "",
    accessToken: "",
    phoneNumber: ""
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEditing) {
        await api.put(`/whatsapp-accounts/${isEditing}`, formData);
      } else {
        await api.post("/whatsapp-accounts", formData);
      }
      setShowAddModal(false);
      setIsEditing(null);
      setFormData({ name: "", phoneNumberId: "", wabaId: "", accessToken: "", phoneNumber: "" });
      refreshAccounts();
    } catch (err) {
      alert("Error saving account: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (acc) => {
    setIsEditing(acc._id);
    setFormData({
      name: acc.name,
      phoneNumberId: acc.phoneNumberId,
      wabaId: acc.wabaId,
      accessToken: acc.accessToken,
      phoneNumber: acc.phoneNumber || ""
    });
    setShowAddModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this account? This will hide all associated chats.")) {
      try {
        await api.delete(`/whatsapp-accounts/${id}`);
        refreshAccounts();
      } catch (err) {
        alert("Error deleting account");
      }
    }
  };

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h2 style={{ fontSize: "1.8rem", color: "#111b21", marginBottom: "0.5rem" }}>WhatsApp Accounts</h2>
          <p style={{ color: "#667781" }}>Manage multiple phone numbers and APIs</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          style={{ display: "flex", alignItems: "center", gap: "8px", background: "#00a884", color: "white", border: "none", padding: "12px 20px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", transition: "0.2s" }}
        >
          <Plus size={20} /> Add New Number
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.5rem" }}>
        {accounts.map(acc => (
          <div
            key={acc._id}
            style={{
              background: "white",
              borderRadius: "16px",
              padding: "1.5rem",
              border: activeAccount?._id === acc._id ? "2px solid #00a884" : "1px solid #e1e1e1",
              boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
              position: "relative"
            }}
          >
            {activeAccount?._id === acc._id && (
              <div style={{ position: "absolute", top: "1.5rem", right: "1.5rem", color: "#00a884" }}>
                <CheckCircle2 size={24} />
              </div>
            )}

            <h3 style={{ fontSize: "1.2rem", color: "#111b21", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "10px" }}>
              <Phone size={20} color="#00a884" /> {acc.name}
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", color: "#667781", fontSize: "0.9rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Globe size={16} /> <span>PNID: {acc.phoneNumberId}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Hash size={16} /> <span>WABA: {acc.wabaId}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Key size={16} /> <span>Token: {acc.accessToken.substring(0, 15)}...</span>
              </div>
            </div>

            <div style={{ marginTop: "1.5rem", display: "flex", gap: "10px" }}>
              <button
                onClick={() => switchAccount(acc)}
                disabled={activeAccount?._id === acc._id}
                style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #00a884", background: activeAccount?._id === acc._id ? "#f0fdf4" : "white", color: "#00a884", fontWeight: "600", cursor: "pointer" }}
              >
                {activeAccount?._id === acc._id ? "Active" : "Switch to this"}
              </button>
              <button
                onClick={() => handleEdit(acc)}
                style={{ padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", cursor: "pointer" }}
                title="Edit Account"
              >
                <Pencil size={20} />
              </button>
              <button
                onClick={() => handleDelete(acc._id)}
                style={{ padding: "10px", borderRadius: "8px", border: "1px solid #fee2e2", background: "#fef2f2", color: "#ef4444", cursor: "pointer" }}
                title="Delete Account"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showAddModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}>
          <div style={{ background: "white", padding: "2rem", borderRadius: "20px", width: "100%", maxWidth: "500px", boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
            <h2 style={{ marginBottom: "1.5rem", fontSize: "1.5rem" }}>{isEditing ? "Edit WhatsApp Account" : "Add WhatsApp Account"}</h2>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
              <div className="input-group">
                <label style={{ display: "block", marginBottom: "6px", fontWeight: "600", fontSize: "0.9rem" }}>Account Name</label>
                <input
                  required
                  placeholder="e.g. Sales Team"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #e1e1e1" }}
                />
              </div>
              <div className="input-group">
                <label style={{ display: "block", marginBottom: "6px", fontWeight: "600", fontSize: "0.9rem" }}>Phone Number ID</label>
                <input
                  required
                  placeholder="Meta Phone Number ID"
                  value={formData.phoneNumberId}
                  onChange={e => setFormData({ ...formData, phoneNumberId: e.target.value })}
                  style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #e1e1e1" }}
                />
              </div>
              <div className="input-group">
                <label style={{ display: "block", marginBottom: "6px", fontWeight: "600", fontSize: "0.9rem" }}>WABA ID</label>
                <input
                  required
                  placeholder="WhatsApp Business Account ID"
                  value={formData.wabaId}
                  onChange={e => setFormData({ ...formData, wabaId: e.target.value })}
                  style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #e1e1e1" }}
                />
              </div>
              <div className="input-group">
                <label style={{ display: "block", marginBottom: "6px", fontWeight: "600", fontSize: "0.9rem" }}>Access Token</label>
                <textarea
                  required
                  rows="3"
                  placeholder="Meta Access Token"
                  value={formData.accessToken}
                  onChange={e => setFormData({ ...formData, accessToken: e.target.value })}
                  style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #e1e1e1", resize: "none" }}
                />
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "1rem" }}>
                <button type="button" onClick={() => { setShowAddModal(false); setIsEditing(null); setFormData({ name: "", phoneNumberId: "", wabaId: "", accessToken: "", phoneNumber: "" }); }} style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #e1e1e1", background: "none", cursor: "pointer" }}>Cancel</button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{ flex: 2, padding: "12px", borderRadius: "8px", background: "#00a884", color: "white", border: "none", fontWeight: "600", cursor: "pointer" }}
                >
                  {loading ? "Saving..." : (isEditing ? "Update Account" : "Add Account")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsAppAccountSettings;
