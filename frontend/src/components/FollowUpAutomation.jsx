import React, { useState, useEffect } from "react";
import api from "../api";
import { useWhatsAppAccount } from "../WhatsAppAccountContext";
import { Plus, Trash2, Clock, MessageSquare, PlayCircle, PauseCircle } from "lucide-react";

const FollowUpAutomation = () => {
  const [rules, setRules] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  
  const [newRule, setNewRule] = useState({
    name: "",
    status: "Interested", // Default
    messageText: "",
    delayDays: 0,
    delayHours: 0,
    delayMinutes: 30
  });

  const fetchRulesAndStatuses = async () => {
    setLoading(true);
    try {
      const [rulesRes, statusesRes] = await Promise.all([
        api.get("/follow-ups"),
        api.get("/statuses")
      ]);
      setRules(rulesRes.data);
      setStatuses(statusesRes.data);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRulesAndStatuses();
  }, []);

  const handleCreateRule = async (e) => {
    e.preventDefault();
    if (!newRule.name || !newRule.messageText) return alert("Name and Message are required!");
    
    try {
      await api.post("/follow-ups", newRule);
      setShowForm(false);
      setNewRule({ name: "", status: "Interested", messageText: "", delayDays: 0, delayHours: 0, delayMinutes: 30 });
      fetchRulesAndStatuses();
    } catch (err) {
      alert("Error creating rule: " + (err.response?.data?.error || err.message));
    }
  };

  const toggleRuleStatus = async (id, currentStatus) => {
    try {
      await api.put(`/follow-ups/${id}`, { active: !currentStatus });
      fetchRulesAndStatuses();
    } catch (err) {
      alert("Error updating rule: " + err.message);
    }
  };

  const deleteRule = async (id) => {
    if (!window.confirm("Are you sure you want to delete this rule?")) return;
    try {
      await api.delete(`/follow-ups/${id}`);
      fetchRulesAndStatuses();
    } catch (err) {
      alert("Error deleting rule: " + err.message);
    }
  };

  return (
    <div className="follow-up-automation">
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "2rem" }}>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={18} style={{ marginRight: "8px" }} />
          {showForm ? "Cancel" : "New Rule"}
        </button>
      </div>

      {showForm && (
        <form className="glass-card" onSubmit={handleCreateRule} style={{ marginBottom: "2rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1rem" }}>
            <div>
              <label>Rule Name</label>
              <input 
                type="text" 
                style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginTop: "8px" }}
                value={newRule.name}
                onChange={e => setNewRule({...newRule, name: e.target.value})}
                placeholder="e.g. 24hr Interested Follow-up"
                required
              />
            </div>
            <div>
              <label>Target Status</label>
              <select 
                style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginTop: "8px" }}
                value={newRule.status}
                onChange={e => setNewRule({...newRule, status: e.target.value})}
              >
                <option value="Interested">Interested ("Yes" Reply)</option>
                <option value="Not Interested">Not Interested ("No" Reply)</option>
                <option value="Pending">Pending</option>
                {statuses.map(s => (
                  !["Interested", "Not Interested", "Pending"].includes(s.name) && 
                  <option key={s._id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Delay (Days)</label>
              <input 
                type="number" 
                min="0"
                style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginTop: "8px" }}
                value={newRule.delayDays}
                onChange={e => setNewRule({...newRule, delayDays: e.target.value})}
              />
            </div>
            <div>
              <label>Delay (Hours)</label>
              <input 
                type="number" 
                min="0"
                max="23"
                style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginTop: "8px" }}
                value={newRule.delayHours}
                onChange={e => setNewRule({...newRule, delayHours: e.target.value})}
              />
            </div>
            <div>
              <label>Delay (Minutes)</label>
              <input 
                type="number" 
                min="0"
                max="59"
                style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginTop: "8px" }}
                value={newRule.delayMinutes}
                onChange={e => setNewRule({...newRule, delayMinutes: e.target.value})}
              />
            </div>
          </div>
          
          <div>
            <label>Message Content</label>
            <textarea 
              rows="4"
              style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginTop: "8px", resize: "vertical" }}
              value={newRule.messageText}
              onChange={e => setNewRule({...newRule, messageText: e.target.value})}
              placeholder="Hi! We noticed you were interested. Do you have any questions?"
              required
            ></textarea>
          </div>

          <button type="submit" className="btn-primary" style={{ marginTop: "1.5rem" }}>
            Save Automation Rule
          </button>
        </form>
      )}

      {loading ? (
        <div>Loading rules...</div>
      ) : rules.length === 0 && !showForm ? (
        <div className="glass-card" style={{ textAlign: "center", padding: "3rem" }}>
          <Clock size={48} color="#ccc" style={{ marginBottom: "1rem" }} />
          <h4>No Follow-up Rules Yet</h4>
          <p style={{ color: "var(--text-secondary)" }}>Create rules to automatically engage with your audience.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "1rem" }}>
          {rules.map(rule => (
            <div key={rule._id} className="glass-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "5px" }}>
                  <h4 style={{ margin: 0 }}>{rule.name}</h4>
                  <span style={{ fontSize: "0.75rem", background: rule.active ? "#e6fce5" : "#ffe5e5", color: rule.active ? "#008069" : "#d9534f", padding: "2px 8px", borderRadius: "12px", fontWeight: "bold" }}>
                    {rule.active ? "Active" : "Paused"}
                  </span>
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", display: "flex", gap: "15px" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><MessageSquare size={14}/> Status: {rule.status}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><Clock size={14}/> Delay: {rule.delayDays}d {rule.delayHours}h {rule.delayMinutes}m</span>
                </div>
                <div style={{ fontSize: "0.85rem", marginTop: "10px", background: "#f8f9fa", padding: "10px", borderRadius: "8px", borderLeft: "3px solid #00a884" }}>
                  {rule.messageText}
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button 
                  style={{ background: "none", border: "none", cursor: "pointer", color: rule.active ? "#d9534f" : "#008069" }}
                  onClick={() => toggleRuleStatus(rule._id, rule.active)}
                  title={rule.active ? "Pause Rule" : "Activate Rule"}
                >
                  {rule.active ? <PauseCircle size={24} /> : <PlayCircle size={24} />}
                </button>
                <button 
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#d9534f" }}
                  onClick={() => deleteRule(rule._id)}
                  title="Delete Rule"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FollowUpAutomation;
