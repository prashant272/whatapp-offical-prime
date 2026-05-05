import React, { useState, useEffect } from "react";
import api from "../api";
import { Trash2, Plus, Loader2, Key } from "lucide-react";

const KeywordRuleModal = ({ isOpen, onClose, users, statusOptions }) => {
  const [rules, setRules] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // New Rule State
  const [newKeyword, setNewKeyword] = useState("");
  const [newStatus, setNewStatus] = useState(statusOptions[0]?.name || "");
  const [newAssignee, setNewAssignee] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchRules();
    }
  }, [isOpen]);

  const fetchRules = async () => {
    try {
      setIsLoading(true);
      const res = await api.get("/keyword-rules");
      setRules(res.data);
    } catch (err) {
      console.error("Error fetching rules:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddRule = async (e) => {
    e.preventDefault();
    if (!newKeyword.trim() || !newStatus) return;

    try {
      setIsSaving(true);
      await api.post("/keyword-rules", {
        keyword: newKeyword.trim().toLowerCase(),
        targetStatus: newStatus,
        assignedTo: newAssignee || null
      });
      setNewKeyword("");
      setNewAssignee("");
      fetchRules();
    } catch (err) {
      alert("Error adding rule: " + (err.response?.data?.error || err.message));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRule = async (id) => {
    if (!window.confirm("Are you sure you want to delete this rule?")) return;
    try {
      await api.delete(`/keyword-rules/${id}`);
      setRules(rules.filter(r => r._id !== id));
    } catch (err) {
      alert("Error deleting rule");
    }
  };

  const toggleRuleActive = async (rule) => {
    try {
      await api.put(`/keyword-rules/${rule._id}`, { active: !rule.active });
      setRules(rules.map(r => r._id === rule._id ? { ...r, active: !rule.active } : r));
    } catch (err) {
      alert("Error updating rule");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, backdropFilter: "blur(5px)" }}>
      <div className="glass-card" style={{ width: "600px", padding: "2rem", position: "relative", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ background: "rgba(0,168,132,0.1)", padding: "8px", borderRadius: "10px", color: "#00a884" }}>
              <Key size={20} />
            </div>
            <h3 style={{ margin: 0 }}>Keyword Automations</h3>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "1.2rem" }}>✕</button>
        </div>

        <p style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: "1.5rem" }}>
          Define keywords that automatically update a contact's status and assign them to an executive when received.
        </p>

        {/* Add Rule Form */}
        <form onSubmit={handleAddRule} style={{ background: "#f8fafc", padding: "1.5rem", borderRadius: "16px", border: "1px solid #e2e8f0", marginBottom: "1.5rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "1rem" }}>
            <div>
              <label style={{ fontSize: "0.7rem", fontWeight: "800", color: "#94a3b8", display: "block", marginBottom: "6px" }}>KEYWORD</label>
              <input 
                type="text" 
                placeholder="e.g. yes" 
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ddd" }}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: "0.7rem", fontWeight: "800", color: "#94a3b8", display: "block", marginBottom: "6px" }}>SET STATUS</label>
              <select 
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ddd" }}
              >
                {statusOptions.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: "0.7rem", fontWeight: "800", color: "#94a3b8", display: "block", marginBottom: "6px" }}>ASSIGN TO (OPTIONAL)</label>
              <select 
                value={newAssignee}
                onChange={(e) => setNewAssignee(e.target.value)}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ddd" }}
              >
                <option value="">No Auto-assignment</option>
                {users.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
              </select>
            </div>
          </div>
          <button 
            type="submit" 
            disabled={isSaving || !newKeyword.trim()}
            className="btn-primary" 
            style={{ width: "100%", padding: "10px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
            Add Automation Rule
          </button>
        </form>

        {/* Rules List */}
        <div style={{ flex: 1, overflowY: "auto", paddingRight: "5px" }}>
          {isLoading ? (
            <div style={{ textAlign: "center", padding: "2rem" }}><Loader2 className="animate-spin" /></div>
          ) : rules.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "#94a3b8", fontStyle: "italic" }}>No rules defined yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {rules.map(rule => (
                <div key={rule._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: rule.active ? "#ffffff" : "#f1f5f9", borderRadius: "12px", border: "1px solid #e2e8f0", opacity: rule.active ? 1 : 0.7 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontWeight: "700", color: "#1e293b", fontSize: "1rem" }}>"{rule.keyword}"</span>
                      <span style={{ fontSize: "0.75rem", color: "#64748b" }}>→</span>
                      <span style={{ background: "#e7fce3", color: "#008069", padding: "2px 8px", borderRadius: "6px", fontSize: "0.75rem", fontWeight: "700" }}>{rule.targetStatus}</span>
                    </div>
                    {rule.assignedTo && (
                      <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "4px" }}>
                        👤 Auto-assign to: <strong>{rule.assignedTo.name}</strong>
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                    <div 
                      onClick={() => toggleRuleActive(rule)}
                      style={{ 
                        width: "36px", 
                        height: "20px", 
                        background: rule.active ? "#00a884" : "#cbd5e1", 
                        borderRadius: "20px", 
                        position: "relative", 
                        cursor: "pointer",
                        transition: "all 0.3s"
                      }}
                    >
                      <div style={{ 
                        width: "14px", 
                        height: "14px", 
                        background: "white", 
                        borderRadius: "50%", 
                        position: "absolute", 
                        top: "3px", 
                        left: rule.active ? "19px" : "3px",
                        transition: "all 0.3s"
                      }}></div>
                    </div>
                    <button onClick={() => handleDeleteRule(rule._id)} style={{ border: "none", background: "none", cursor: "pointer", color: "#ef4444", padding: "5px" }}>
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button onClick={onClose} className="btn-secondary" style={{ width: "100%", marginTop: "1.5rem" }}>Close</button>
      </div>
    </div>
  );
};

export default KeywordRuleModal;
