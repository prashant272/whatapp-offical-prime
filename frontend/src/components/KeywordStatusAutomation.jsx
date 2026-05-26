import React, { useState, useEffect } from "react";
import axios from "axios";
import { Trash2, Plus, Loader2, Key, CheckCircle2, Search, Pencil, X } from "lucide-react";
import { useWhatsAppAccount } from "../WhatsAppAccountContext";

const API_BASE = import.meta.env.VITE_API_URL || "";

const KeywordStatusAutomation = ({ users = [], statusOptions = [] }) => {
  const { accounts, activeAccount } = useWhatsAppAccount();
  const [rules, setRules] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({
    keyword: "",
    targetStatus: statusOptions[0]?.name || "",
    assignedTo: "",
    whatsappAccountIds: []
  });

  const currentUser = JSON.parse(localStorage.getItem("userInfo"));
  const config = { headers: { Authorization: `Bearer ${currentUser?.token}` } };

  useEffect(() => {
    fetchRules();
  }, [activeAccount]);

  const fetchRules = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get(`${API_BASE}/api/keyword-rules`, {
        headers: {
          ...config.headers,
          "x-whatsapp-account-id": activeAccount?._id || "all"
        }
      });
      setRules(res.data);
    } catch (err) {
      console.error("Error fetching rules:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.keyword.trim() || !formData.targetStatus) return;

    try {
      setIsSaving(true);
      const payload = {
        ...formData,
        keyword: formData.keyword.trim().toLowerCase(),
        assignedTo: formData.assignedTo || null
      };

      if (editingId) {
        await axios.put(`${API_BASE}/api/keyword-rules/${editingId}`, payload, config);
      } else {
        await axios.post(`${API_BASE}/api/keyword-rules`, payload, config);
      }
      
      resetForm();
      fetchRules();
    } catch (err) {
      alert("Error saving rule: " + (err.response?.data?.error || err.message));
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (rule) => {
    setEditingId(rule._id);
    setFormData({
      keyword: rule.keyword,
      targetStatus: rule.targetStatus,
      assignedTo: rule.assignedTo?._id || rule.assignedTo || "",
      whatsappAccountIds: rule.whatsappAccountIds || []
    });
    // Scroll to form
    const formElement = document.getElementById("automation-form");
    if (formElement) formElement.scrollIntoView({ behavior: 'smooth' });
  };

  const resetForm = () => {
    setFormData({
      keyword: "",
      targetStatus: statusOptions[0]?.name || "",
      assignedTo: "",
      whatsappAccountIds: []
    });
    setEditingId(null);
  };

  const handleDeleteRule = async (id) => {
    if (!window.confirm("Are you sure you want to delete this rule?")) return;
    try {
      await axios.delete(`${API_BASE}/api/keyword-rules/${id}`, config);
      fetchRules();
    } catch (err) {
      alert("Error deleting rule");
    }
  };

  const toggleRuleActive = async (rule) => {
    try {
      await axios.put(`${API_BASE}/api/keyword-rules/${rule._id}`, { active: !rule.active }, config);
      fetchRules();
    } catch (err) {
      alert("Error updating rule");
    }
  };

  const filteredRules = rules.filter(r => 
    r.keyword.toLowerCase().includes(search.toLowerCase()) ||
    r.targetStatus.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div id="automation-form" style={{ background: "white", padding: "30px", borderRadius: "20px", boxShadow: "0 4px 20px rgba(0,0,0,0.05)", marginBottom: "30px", border: editingId ? "2px solid #00a884" : "1px solid #e2e8f0", position: "relative" }}>
        {editingId && (
          <button 
            onClick={resetForm}
            style={{ position: "absolute", top: "20px", right: "20px", background: "#f1f5f9", border: "none", borderRadius: "50%", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#64748b" }}
          >
            <X size={18} />
          </button>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: "15px", marginBottom: "20px" }}>
          <div style={{ background: editingId ? "rgba(0,168,132,0.1)" : "rgba(0,168,132,0.1)", padding: "10px", borderRadius: "12px", color: "#00a884" }}>
            <Key size={24} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#1e293b" }}>{editingId ? "Edit Automation Rule" : "Add New Keyword Automation"}</h3>
            <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>{editingId ? "Update your existing keyword rule settings." : "Define keywords to auto-update status and assign chats."}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px", marginBottom: "20px" }}>
            <div>
              <label style={{ fontSize: "12px", fontWeight: "800", color: "#94a3b8", display: "block", marginBottom: "8px", textTransform: "uppercase" }}>KEYWORD</label>
              <input 
                type="text" 
                placeholder="e.g. interested, call me, or * for any message" 
                value={formData.keyword}
                onChange={(e) => setFormData({ ...formData, keyword: e.target.value })}
                style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1.5px solid #e2e8f0", outline: "none", fontSize: "15px" }}
                required
              />
              <p style={{ fontSize: "11px", color: "#94a3b8", marginTop: "5px", fontStyle: "italic" }}>
                Use <strong>*</strong> to match <strong>any</strong> incoming message.
              </p>
            </div>
            <div>
              <label style={{ fontSize: "12px", fontWeight: "800", color: "#94a3b8", display: "block", marginBottom: "8px", textTransform: "uppercase" }}>TARGET STATUS</label>
              <select 
                value={formData.targetStatus}
                onChange={(e) => setFormData({ ...formData, targetStatus: e.target.value })}
                style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1.5px solid #e2e8f0", outline: "none", fontSize: "15px", background: "white" }}
                required
              >
                <option value="">Select Status</option>
                {statusOptions.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: "12px", fontWeight: "800", color: "#94a3b8", display: "block", marginBottom: "8px", textTransform: "uppercase" }}>AUTO-ASSIGNEE</label>
              <select 
                value={formData.assignedTo}
                onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1.5px solid #e2e8f0", outline: "none", fontSize: "15px", background: "white" }}
              >
                <option value="">No Auto-assignment</option>
                {users.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: "25px" }}>
            <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "12px", fontWeight: "800", textTransform: "uppercase" }}>ACTIVE FOR ACCOUNTS</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
              {accounts.map(acc => (
                <div 
                  key={acc._id}
                  onClick={() => {
                    const ids = formData.whatsappAccountIds.includes(acc._id)
                      ? formData.whatsappAccountIds.filter(id => id !== acc._id)
                      : [...formData.whatsappAccountIds, acc._id];
                    setFormData({ ...formData, whatsappAccountIds: ids });
                  }}
                  style={{ 
                    padding: "8px 16px", 
                    borderRadius: "20px", 
                    fontSize: "12px", 
                    fontWeight: "700",
                    cursor: "pointer",
                    border: "2px solid",
                    borderColor: formData.whatsappAccountIds.includes(acc._id) ? "#00a884" : "#e2e8f0",
                    background: formData.whatsappAccountIds.includes(acc._id) ? "#e7fce3" : "white",
                    color: formData.whatsappAccountIds.includes(acc._id) ? "#008069" : "#64748b",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    transition: "all 0.2s ease"
                  }}
                >
                  <CheckCircle2 size={16} style={{ opacity: formData.whatsappAccountIds.includes(acc._id) ? 1 : 0.3 }} />
                  {acc.name}
                </div>
              ))}
              {accounts.length === 0 && <span style={{ color: "#94a3b8", fontSize: "13px" }}>No accounts found.</span>}
            </div>
            <p style={{ fontSize: "11px", color: "#94a3b8", marginTop: "8px", fontStyle: "italic" }}>Leave empty for Global (all accounts).</p>
          </div>

          <div style={{ display: "flex", gap: "12px" }}>
            {editingId && (
              <button 
                type="button" 
                onClick={resetForm}
                style={{ flex: 1, padding: "14px", background: "white", color: "#64748b", border: "1.5px solid #e2e8f0", borderRadius: "12px", fontWeight: "700", fontSize: "15px", cursor: "pointer" }}
              >
                Cancel Edit
              </button>
            )}
            <button 
              type="submit" 
              disabled={isSaving || !formData.keyword.trim()}
              style={{ flex: 2, padding: "14px", background: "#00a884", color: "white", border: "none", borderRadius: "12px", fontWeight: "700", fontSize: "15px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", boxShadow: "0 4px 12px rgba(0,168,132,0.2)" }}
            >
              {isSaving ? <Loader2 size={20} className="animate-spin" /> : (editingId ? <CheckCircle2 size={20} /> : <Plus size={20} />)}
              {editingId ? "Update Rule" : "Create Automation Rule"}
            </button>
          </div>
        </form>
      </div>

      <div style={{ position: "relative", marginBottom: "20px" }}>
        <Search style={{ position: "absolute", left: "15px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} size={20} />
        <input 
          type="text" 
          placeholder="Search rules..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: "100%", padding: "12px 15px 12px 45px", borderRadius: "12px", border: "1.5px solid #e2e8f0", outline: "none", background: "white" }}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "20px" }}>
        {isLoading ? (
          <div style={{ textAlign: "center", padding: "50px", gridColumn: "1/-1" }}><Loader2 className="animate-spin" color="#00a884" /></div>
        ) : filteredRules.length === 0 ? (
          <div style={{ textAlign: "center", padding: "50px", gridColumn: "1/-1", background: "white", borderRadius: "20px", color: "#94a3b8", border: "1px dashed #cbd5e1" }}>No automation rules found.</div>
        ) : (
          filteredRules.map(rule => (
            <div key={rule._id} style={{ background: "white", padding: "20px", borderRadius: "16px", border: editingId === rule._id ? "2px solid #00a884" : "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "15px", opacity: rule.active || editingId === rule._id ? 1 : 0.7, transform: editingId === rule._id ? "scale(1.02)" : "scale(1)", transition: "all 0.2s ease" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "18px", fontWeight: "800", color: "#1e293b" }}>"{rule.keyword}"</span>
                    <span style={{ color: "#94a3b8" }}>→</span>
                    <span style={{ background: "#e7fce3", color: "#008069", padding: "4px 10px", borderRadius: "8px", fontSize: "13px", fontWeight: "700" }}>{rule.targetStatus}</span>
                  </div>
                  {rule.assignedTo && (
                    <div style={{ fontSize: "12px", color: "#64748b", marginTop: "8px", display: "flex", alignItems: "center", gap: "5px" }}>
                      👤 Auto-assign: <strong style={{ color: "#1e293b" }}>{rule.assignedTo.name || (typeof rule.assignedTo === 'string' ? users.find(u => u._id === rule.assignedTo)?.name : "")}</strong>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div 
                    onClick={() => toggleRuleActive(rule)}
                    style={{ 
                      width: "40px", 
                      height: "22px", 
                      background: rule.active ? "#00a884" : "#cbd5e1", 
                      borderRadius: "20px", 
                      position: "relative", 
                      cursor: "pointer",
                      transition: "all 0.3s"
                    }}
                  >
                    <div style={{ 
                      width: "16px", 
                      height: "16px", 
                      background: "white", 
                      borderRadius: "50%", 
                      position: "absolute", 
                      top: "3px", 
                      left: rule.active ? "21px" : "3px",
                      transition: "all 0.3s"
                    }}></div>
                  </div>
                  <div style={{ display: "flex", gap: "5px" }}>
                    <button onClick={() => handleEdit(rule)} style={{ border: "none", background: "#f0f9ff", color: "#0ea5e9", padding: "8px", borderRadius: "8px", cursor: "pointer" }}>
                      <Pencil size={18} />
                    </button>
                    <button onClick={() => handleDeleteRule(rule._id)} style={{ border: "none", background: "#fff1f2", color: "#ef4444", padding: "8px", borderRadius: "8px", cursor: "pointer" }}>
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", borderTop: "1px solid #f1f5f9", paddingTop: "12px" }}>
                {(!rule.whatsappAccountIds || rule.whatsappAccountIds.length === 0) ? (
                  <span style={{ fontSize: "10px", color: "#00a884", fontWeight: "800", background: "#e7fce3", padding: "3px 8px", borderRadius: "6px", textTransform: "uppercase" }}>Global (All)</span>
                ) : (
                  rule.whatsappAccountIds.map(id => (
                    <span key={id} style={{ fontSize: "10px", color: "#1976d2", fontWeight: "800", background: "#e3f2fd", padding: "3px 8px", borderRadius: "6px", textTransform: "uppercase" }}>
                      {accounts.find(a => a._id === id)?.name || "Account"}
                    </span>
                  ))
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default KeywordStatusAutomation;
