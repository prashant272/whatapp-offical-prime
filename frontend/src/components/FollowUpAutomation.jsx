import React, { useState, useEffect } from "react";
import api from "../api";
import { useWhatsAppAccount } from "../WhatsAppAccountContext";
import { Plus, Trash2, Clock, MessageSquare, PlayCircle, PauseCircle, Users, Image as ImageIcon, Edit2, CheckCircle2 } from "lucide-react";

const FollowUpAutomation = () => {
  const { accounts, activeAccount, refreshAccounts } = useWhatsAppAccount();
  const [rules, setRules] = useState([]);
  const [windowReminders, setWindowReminders] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [quickReplies, setQuickReplies] = useState([]);
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Forms visibility
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [show24HForm, setShow24HForm] = useState(false);

  const [reminderName, setReminderName] = useState("");
  const [reminderMessage, setReminderMessage] = useState("");
  const [reminderMediaUrl, setReminderMediaUrl] = useState("");
  const [reminderQuickReplyId, setReminderQuickReplyId] = useState("");
  const [reminderTargetStatuses, setReminderTargetStatuses] = useState([]);
  const [isSavingReminder, setIsSavingReminder] = useState(false);
  const [selectedAccountsToApply, setSelectedAccountsToApply] = useState([]);
  const [editingReminderId, setEditingReminderId] = useState(null);

  const [newRule, setNewRule] = useState({
    name: "",
    statuses: ["Interested"],
    messageText: "",
    delayDays: 0,
    delayHours: 0,
    delayMinutes: 30,
    whatsappAccountIds: [],
    quickReplyId: "",
    templatePresetId: "",
    mediaUrl: ""
  });

  const fetchRulesAndStatuses = async () => {
    setLoading(true);
    try {
      const [rulesRes, wrRes, statusesRes, qrRes, presetsRes] = await Promise.all([
        api.get("/follow-ups"),
        api.get("/window-reminders"),
        api.get("/statuses"),
        api.get("/quick-replies").catch(() => ({ data: [] })),
        api.get("/presets").catch(() => ({ data: [] }))
      ]);
      setRules(rulesRes.data);
      setWindowReminders(wrRes.data);
      setStatuses(statusesRes.data);
      setQuickReplies(qrRes.data);
      setPresets(presetsRes.data);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRulesAndStatuses();
  }, []);

  // When activeAccount changes, reset 24H form state
  useEffect(() => {
    setShow24HForm(false);
  }, [activeAccount]);

  const openNewReminderForm = () => {
    setEditingReminderId(null);
    setReminderName("");
    setReminderMessage("Your 24-hour support window is closing in 1 hour. Please reply if you still need assistance.");
    setReminderMediaUrl("");
    setReminderTargetStatuses([]);
    setReminderQuickReplyId("");
    setSelectedAccountsToApply(activeAccount ? [activeAccount._id] : []);
    setShow24HForm(true);
  };

  const openEditReminderForm = (reminder) => {
    setEditingReminderId(reminder._id);
    setReminderName(reminder.name);
    setReminderMessage(reminder.message);
    setReminderMediaUrl(reminder.mediaUrl || "");
    setReminderTargetStatuses(reminder.targetStatuses || []);
    setReminderQuickReplyId("");
    setSelectedAccountsToApply(reminder.whatsappAccountIds.map(a => typeof a === 'object' ? a._id : a));
    setShow24HForm(true);
  };

  const handleSaveReminderSettings = async () => {
    if (!reminderName || !reminderMessage || selectedAccountsToApply.length === 0) return alert("Name, message, and at least one account are required!");
    setIsSavingReminder(true);
    try {
      const payload = {
        name: reminderName,
        message: reminderMessage,
        mediaUrl: reminderMediaUrl,
        targetStatuses: reminderTargetStatuses,
        whatsappAccountIds: selectedAccountsToApply,
        active: true
      };

      if (editingReminderId) {
        await api.put(`/window-reminders/${editingReminderId}`, payload);
      } else {
        await api.post(`/window-reminders`, payload);
      }
      
      await fetchRulesAndStatuses();
      setShow24HForm(false);
    } catch (err) {
      alert("Error saving reminder");
    } finally {
      setIsSavingReminder(false);
    }
  };

  const toggleWindowReminderStatus = async (id, currentStatus) => {
    try {
      await api.put(`/window-reminders/${id}`, { active: !currentStatus });
      fetchRulesAndStatuses();
    } catch (err) {
      alert("Error updating reminder: " + err.message);
    }
  };

  const handleDeleteReminder = async (id) => {
    if (!window.confirm("Are you sure you want to completely remove this 24-Hour Reminder from all accounts?")) return;
    try {
      await api.delete(`/window-reminders/${id}`);
      await fetchRulesAndStatuses();
    } catch (err) {
      alert("Error removing reminder");
    }
  };

  const handleCreateRule = async (e) => {
    e.preventDefault();
    if (!newRule.name) return alert("Name is required!");
    if (!newRule.templatePresetId && !newRule.messageText) return alert("Message Content or a Preset Template is required!");
    if (newRule.statuses.length === 0) return alert("Please select at least one status!");

    // Validation for Preset Templates
    if (newRule.templatePresetId) {
      const selectedPreset = presets.find(p => p._id === newRule.templatePresetId);
      if (selectedPreset && selectedPreset.whatsappAccountId) {
        const presetAccountId = typeof selectedPreset.whatsappAccountId === 'object' ? selectedPreset.whatsappAccountId._id : selectedPreset.whatsappAccountId;
        
        // If applying to all accounts (empty array) or applying to multiple/different accounts
        if (newRule.whatsappAccountIds.length !== 1 || newRule.whatsappAccountIds[0] !== presetAccountId) {
          const accName = accounts.find(a => a._id === presetAccountId)?.name || "its specific account";
          return alert(`This preset template is not for this account. Please select ONLY ${accName}.`);
        }
      }
    }

    try {
      if (editingRuleId) {
        await api.put(`/follow-ups/${editingRuleId}`, newRule);
      } else {
        await api.post("/follow-ups", newRule);
      }
      
      setShowRuleForm(false);
      setEditingRuleId(null);
      setNewRule({ 
        name: "", 
        statuses: ["Interested"], 
        messageText: "", 
        delayDays: 0, 
        delayHours: 0, 
        delayMinutes: 30,
        whatsappAccountIds: [],
        quickReplyId: "",
        templatePresetId: "",
        mediaUrl: ""
      });
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

  const openNewRuleForm = () => {
    setEditingRuleId(null);
    setNewRule({
      name: "",
      statuses: ["Interested"],
      messageText: "",
      delayDays: 0,
      delayHours: 0,
      delayMinutes: 30,
      whatsappAccountIds: activeAccount ? [activeAccount._id] : [],
      quickReplyId: "",
      templatePresetId: "",
      mediaUrl: ""
    });
    setShowRuleForm(true);
  };

  const openEditRuleForm = (rule) => {
    setEditingRuleId(rule._id);
    setNewRule({
      name: rule.name,
      statuses: rule.statuses && rule.statuses.length > 0 ? rule.statuses : [rule.status],
      messageText: rule.messageText,
      delayDays: rule.delayDays,
      delayHours: rule.delayHours,
      delayMinutes: rule.delayMinutes,
      whatsappAccountIds: rule.whatsappAccountIds.map(a => typeof a === 'object' ? a._id : a),
      quickReplyId: rule.quickReplyId || "",
      templatePresetId: rule.templatePresetId ? (typeof rule.templatePresetId === 'object' ? rule.templatePresetId._id : rule.templatePresetId) : "",
      mediaUrl: rule.mediaUrl || ""
    });
    setShowRuleForm(true);
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

  const allStatusOptions = ["Interested", "Not Interested", "Pending", ...statuses.filter(s => !["Interested", "Not Interested", "Pending"].includes(s.name)).map(s => s.name)];

  // Filter rules to show only those applicable to the currently active account
  const visibleRules = rules.filter(r => {
    if (!activeAccount) return false;
    return r.whatsappAccountIds.length === 0 || r.whatsappAccountIds.some(a => (typeof a === 'object' ? a._id : a) === activeAccount._id);
  });

  const visibleWindowReminders = windowReminders.filter(r => {
    if (!activeAccount) return false;
    return r.whatsappAccountIds.length === 0 || r.whatsappAccountIds.some(a => (typeof a === 'object' ? a._id : a) === activeAccount._id);
  });

  if (!activeAccount) {
    return <div>Please select a WhatsApp Account from the sidebar first.</div>;
  }

  return (
    <div className="follow-up-automation">
      {/* 24-HOUR REMINDER SECTION */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <h2 style={{ fontSize: "1.5rem", color: "#111b21", display: "flex", alignItems: "center", gap: "8px" }}>
            <Clock size={24} color="#00a884" /> 24-Hour Window Reminders
          </h2>
          <p style={{ fontSize: "0.9rem", color: "#667781", marginTop: "4px" }}>
            Settings for: <strong>{activeAccount.name}</strong>
          </p>
        </div>
        {!show24HForm && (
          <button className="btn-primary" onClick={openNewReminderForm}>
            <Plus size={18} style={{ marginRight: "8px" }} />
            New 24H Reminder
          </button>
        )}
      </div>

      {show24HForm && (
        <div className="glass-card" style={{ marginBottom: "2rem", padding: "1.5rem", borderLeft: "4px solid #00a884" }}>
          <h3 style={{ marginBottom: "1rem" }}>Create 24-Hour Reminder for {activeAccount.name}</h3>
          <p style={{ fontSize: "0.9rem", color: "#667781", marginBottom: "1rem" }}>
            Automatically send a warning message exactly 1 hour before the 24-hour WhatsApp session closes.
          </p>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", marginBottom: "6px", fontWeight: "500", fontSize: "0.9rem" }}>Reminder Name</label>
            <input
              type="text"
              value={reminderName}
              onChange={e => setReminderName(e.target.value)}
              placeholder="e.g., Interested Follow-up Warning"
              style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd" }}
              required
            />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.9rem", fontWeight: "500", marginBottom: "6px" }}><MessageSquare size={16} /> Use Quick Reply Template (Optional)</label>
            <select
              style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd" }}
              value={reminderQuickReplyId}
              onChange={e => {
                const qr = quickReplies.find(q => q._id === e.target.value);
                if (qr) {
                  setReminderQuickReplyId(qr._id);
                  setReminderMessage(qr.content || "");
                  setReminderMediaUrl(qr.mediaUrl || "");
                } else {
                  setReminderQuickReplyId("");
                  setReminderMediaUrl("");
                }
              }}
            >
              <option value="">-- Select a Quick Reply --</option>
              {quickReplies.map(qr => (
                <option key={qr._id} value={qr._id}>{qr.name}</option>
              ))}
            </select>
          </div>

          <label style={{ display: "block", marginBottom: "6px", fontWeight: "500", fontSize: "0.9rem" }}>Reminder Message</label>
          <textarea
            rows="3"
            value={reminderMessage}
            onChange={e => setReminderMessage(e.target.value)}
            style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", resize: "vertical" }}
          />
          {reminderMediaUrl && (
            <div style={{ marginTop: "15px", borderRadius: "8px", overflow: "hidden", border: "1px solid #ddd", width: "fit-content" }}>
              <div style={{ padding: "8px 12px", background: "#f8f9fa", borderBottom: "1px solid #ddd", fontSize: "0.75rem", fontWeight: "600", color: "#667781", display: "flex", alignItems: "center", gap: "6px" }}>
                <ImageIcon size={14} /> Attached Media
              </div>
              <img src={reminderMediaUrl} alt="Attached Media" style={{ display: "block", maxWidth: "200px", maxHeight: "150px", objectFit: "cover" }} />
            </div>
          )}

          <div style={{ marginTop: "15px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", fontSize: "0.9rem" }}>Target Statuses (Leave empty to send to ALL)</label>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", maxHeight: "100px", overflowY: "auto", border: "1px solid #ddd", padding: "10px", borderRadius: "10px", background: "#f8f9fa" }}>
              {statuses.map(s => (
                <label key={s._id} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.85rem", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={reminderTargetStatuses.includes(s.name)}
                    onChange={e => {
                      const current = reminderTargetStatuses;
                      if (e.target.checked) setReminderTargetStatuses([...current, s.name]);
                      else setReminderTargetStatuses(current.filter(st => st !== s.name));
                    }}
                    style={{ accentColor: "#00a884" }}
                  />
                  {s.name}
                </label>
              ))}
            </div>
          </div>


          <div style={{ marginTop: "15px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "0.9rem" }}>Save this reminder to:</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", padding: "10px", borderRadius: "10px", background: "#f8f9fa", border: "1px solid #eee" }}>
              {accounts.map(acc => {
                const isSelected = selectedAccountsToApply.includes(acc._id);
                const isCurrent = acc._id === activeAccount._id;
                return (
                  <div 
                    key={acc._id}
                    onClick={() => {
                      if (isCurrent) return; // Active account is always checked
                      if (isSelected) {
                        setSelectedAccountsToApply(selectedAccountsToApply.filter(id => id !== acc._id));
                      } else {
                        setSelectedAccountsToApply([...selectedAccountsToApply, acc._id]);
                      }
                    }}
                    style={{ 
                      padding: "8px 16px", 
                      borderRadius: "20px", 
                      fontSize: "0.8rem", 
                      fontWeight: "600",
                      cursor: isCurrent ? "not-allowed" : "pointer",
                      border: "1px solid",
                      borderColor: isSelected ? "#00a884" : "#e2e8f0",
                      background: isSelected ? "rgba(0, 168, 132, 0.1)" : "white",
                      color: isSelected ? "#00a884" : "#64748b",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      transition: "all 0.2s",
                      opacity: isCurrent ? 0.7 : 1
                    }}
                  >
                    <CheckCircle2 size={16} opacity={isSelected ? 1 : 0.3} />
                    {acc.name} {isCurrent && "(Current)"}
                  </div>
                );
              })}
            </div>
          </div>
          
          <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
            <button
              onClick={handleSaveReminderSettings}
              disabled={isSavingReminder}
              className="btn-primary"
            >
              {isSavingReminder ? "Saving..." : "Save Reminder"}
            </button>
            <button
              onClick={() => setShow24HForm(false)}
              style={{ padding: "8px 16px", borderRadius: "8px", background: "#e2e8f0", color: "#111b21", border: "none", fontWeight: "600", cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!show24HForm && (
        <div style={{ marginBottom: "3rem", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.5rem" }}>
          {visibleWindowReminders.length > 0 ? (
            visibleWindowReminders.map(reminder => (
              <div key={reminder._id} className="glass-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", borderTop: "4px solid #00a884" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                    <h4 style={{ margin: 0, fontSize: "1.1rem", color: "#111b21" }}>{reminder.name}</h4>
                    <span style={{ fontSize: "0.75rem", background: reminder.active ? "#e6fce5" : "#ffe5e5", color: reminder.active ? "#008069" : "#d9534f", padding: "4px 8px", borderRadius: "12px", fontWeight: "bold" }}>
                      {reminder.active ? "Active" : "Paused"}
                    </span>
                  </div>
                  
                  <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "8px", marginBottom: "15px" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><Clock size={14} color="#667781" /> Triggers at 23rd Hour</span>
                    <span style={{ display: "flex", alignItems: "flex-start", gap: "6px" }}>
                      <Users size={14} color="#667781" style={{ marginTop: "2px" }} /> 
                      <span style={{ flex: 1 }}>{reminder.whatsappAccountIds && reminder.whatsappAccountIds.length > 0 
                        ? reminder.whatsappAccountIds.map(a => a.name || a).join(", ") 
                        : "All Accounts"}</span>
                    </span>
                    <span style={{ display: "flex", alignItems: "flex-start", gap: "6px" }}>
                      <MessageSquare size={14} color="#667781" style={{ marginTop: "2px" }} />
                      <span style={{ flex: 1 }}><strong>Target:</strong> {reminder.targetStatuses?.length > 0 ? reminder.targetStatuses.join(", ") : "All Statuses"}</span>
                    </span>
                  </div>
                  
                  <div style={{ fontSize: "0.85rem", background: "#f8f9fa", padding: "12px", borderRadius: "8px", borderLeft: "3px solid #00a884", marginBottom: "15px" }}>
                    {reminder.mediaUrl && (
                      <div style={{ marginBottom: "10px" }}>
                        <img src={reminder.mediaUrl} alt="Reminder Media" style={{ display: "block", maxWidth: "100%", maxHeight: "150px", borderRadius: "6px", objectFit: "cover", border: "1px solid #ddd" }} />
                      </div>
                    )}
                    <span style={{ color: "#111b21", lineHeight: "1.4" }}>{reminder.message}</span>
                  </div>
                </div>
                
                <div style={{ display: "flex", gap: "10px", borderTop: "1px solid #eee", paddingTop: "12px", marginTop: "auto", justifyContent: "flex-end" }}>
                  <button
                    style={{ background: "none", border: "none", cursor: "pointer", color: reminder.active ? "#d9534f" : "#008069", display: "flex", alignItems: "center", gap: "4px", fontSize: "0.85rem", fontWeight: "600" }}
                    onClick={() => toggleWindowReminderStatus(reminder._id, reminder.active)}
                    title={reminder.active ? "Pause Reminder" : "Activate Reminder"}
                  >
                    {reminder.active ? <><PauseCircle size={18} /> Pause</> : <><PlayCircle size={18} /> Activate</>}
                  </button>
                  <button
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#008069", display: "flex", alignItems: "center", gap: "4px", fontSize: "0.85rem", fontWeight: "600" }}
                    onClick={() => openEditReminderForm(reminder)}
                    title="Edit Reminder"
                  >
                    <Edit2 size={18} /> Edit
                  </button>
                  <button
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#d9534f", display: "flex", alignItems: "center", gap: "4px", fontSize: "0.85rem", fontWeight: "600" }}
                    onClick={() => handleDeleteReminder(reminder._id)}
                    title="Remove Reminder"
                  >
                    <Trash2 size={18} /> Delete
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="glass-card" style={{ textAlign: "center", padding: "2rem", background: "#f8f9fa" }}>
              <Clock size={32} color="#ccc" style={{ marginBottom: "1rem" }} />
              <h4 style={{ color: "#667781" }}>No 24-Hour Reminder Set</h4>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Set up a warning message to remind customers before their session closes.</p>
            </div>
          )}
        </div>
      )}

      {/* CUSTOM FOLLOW-UP RULES SECTION */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <h2 style={{ fontSize: "1.5rem", color: "#111b21" }}>Custom Follow-up Rules</h2>
          <p style={{ fontSize: "0.9rem", color: "#667781", marginTop: "4px" }}>
            Showing rules applicable to: <strong>{activeAccount.name}</strong>
          </p>
        </div>
        <button className="btn-primary" onClick={() => {
          if (showRuleForm) {
            setShowRuleForm(false);
            setEditingRuleId(null);
          } else {
            openNewRuleForm();
          }
        }}>
          <Plus size={18} style={{ marginRight: "8px" }} />
          {showRuleForm ? "Cancel" : "New Rule"}
        </button>
      </div>

      {showRuleForm && (
        <form className="glass-card" onSubmit={handleCreateRule} style={{ marginBottom: "2rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1rem" }}>
            <div>
              <label>Rule Name</label>
              <input
                type="text"
                style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginTop: "8px" }}
                value={newRule.name}
                onChange={e => setNewRule({ ...newRule, name: e.target.value })}
                placeholder="e.g. 24hr Interested Follow-up"
                required
              />
            </div>
            <div>
              <label>Target Statuses</label>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "8px", maxHeight: "100px", overflowY: "auto", border: "1px solid #ddd", padding: "8px", borderRadius: "10px" }}>
                {allStatusOptions.map(sName => (
                  <label key={sName} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.85rem", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={newRule.statuses.includes(sName)}
                      onChange={e => {
                        const current = newRule.statuses;
                        if (e.target.checked) setNewRule({ ...newRule, statuses: [...current, sName] });
                        else setNewRule({ ...newRule, statuses: current.filter(s => s !== sName) });
                      }}
                      style={{ accentColor: "#00a884" }}
                    />
                    {sName}
                  </label>
                ))}
              </div>
            </div>
            
            <div style={{ gridColumn: "1 / -1" }}>
              <label>Apply to Accounts (Leave empty for all accounts)</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "8px", border: "1px solid #ddd", padding: "10px", borderRadius: "10px", background: "#f8f9fa" }}>
                {accounts.map(acc => {
                  const isSelected = newRule.whatsappAccountIds.includes(acc._id);
                  return (
                    <div 
                      key={acc._id}
                      onClick={() => {
                        const current = newRule.whatsappAccountIds;
                        if (isSelected) {
                          setNewRule({ ...newRule, whatsappAccountIds: current.filter(id => id !== acc._id) });
                        } else {
                          setNewRule({ ...newRule, whatsappAccountIds: [...current, acc._id] });
                        }
                      }}
                      style={{ 
                        padding: "8px 16px", 
                        borderRadius: "20px", 
                        fontSize: "0.8rem", 
                        fontWeight: "600",
                        cursor: "pointer",
                        border: "1px solid",
                        borderColor: isSelected ? "#00a884" : "#e2e8f0",
                        background: isSelected ? "rgba(0, 168, 132, 0.1)" : "white",
                        color: isSelected ? "#00a884" : "#64748b",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        transition: "all 0.2s"
                      }}
                    >
                      <CheckCircle2 size={16} opacity={isSelected ? 1 : 0.3} />
                      {acc.name}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ gridColumn: "1 / -1", borderTop: "1px solid #eee", paddingTop: "1rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: "6px" }}><MessageSquare size={16} /> Use Quick Reply (Optional)</label>
                <select
                  style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginTop: "8px" }}
                  value={newRule.quickReplyId || ""}
                  onChange={e => {
                    const qr = quickReplies.find(q => q._id === e.target.value);
                    if (qr) {
                      setNewRule({ ...newRule, quickReplyId: qr._id, templatePresetId: "", messageText: qr.content || "", mediaUrl: qr.mediaUrl || "" });
                    } else {
                      setNewRule({ ...newRule, quickReplyId: "", mediaUrl: "" });
                    }
                  }}
                  disabled={!!newRule.templatePresetId}
                >
                  <option value="">-- Select a Quick Reply --</option>
                  {quickReplies.map(qr => (
                    <option key={qr._id} value={qr._id}>{qr.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", color: "#00a884" }}><MessageSquare size={16} /> Use Preset Template</label>
                <select
                  style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginTop: "8px", borderColor: newRule.templatePresetId ? "#00a884" : "#ddd" }}
                  value={newRule.templatePresetId || ""}
                  onChange={e => {
                    const presetId = e.target.value;
                    const preset = presets.find(p => p._id === presetId);
                    if (preset) {
                      setNewRule({ 
                        ...newRule, 
                        templatePresetId: presetId, 
                        quickReplyId: "", 
                        mediaUrl: "", 
                        messageText: `[Template Preset: ${preset.name}]` 
                      });
                    } else {
                      setNewRule({ ...newRule, templatePresetId: "", messageText: "" });
                    }
                  }}
                  disabled={!!newRule.quickReplyId}
                >
                  <option value="">-- Select a Preset Template --</option>
                  {presets
                    .filter(p => {
                      const pAcc = typeof p.whatsappAccountId === 'object' ? p.whatsappAccountId?._id : p.whatsappAccountId;
                      return pAcc === activeAccount._id;
                    })
                    .map(p => (
                      <option key={p._id} value={p._id}>{p.name}</option>
                    ))}
                </select>
              </div>
            </div>

            <div>
              <label>Delay (Days)</label>
              <input
                type="number"
                min="0"
                style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginTop: "8px" }}
                value={newRule.delayDays}
                onChange={e => setNewRule({ ...newRule, delayDays: e.target.value })}
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
                onChange={e => setNewRule({ ...newRule, delayHours: e.target.value })}
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
                onChange={e => setNewRule({ ...newRule, delayMinutes: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label>Message Content</label>
            <textarea
              rows="4"
              style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginTop: "8px", resize: "vertical" }}
              value={newRule.messageText}
              onChange={e => setNewRule({ ...newRule, messageText: e.target.value })}
              placeholder="Hi! We noticed you were interested. Do you have any questions?"
              required={!newRule.templatePresetId}
              disabled={!!newRule.templatePresetId}
            ></textarea>
            {newRule.templatePresetId && (
              <div style={{ marginTop: "10px", fontSize: "0.85rem", color: "#00a884", display: "flex", alignItems: "center", gap: "6px" }}>
                <CheckCircle2 size={16} /> Using a Meta-approved Template Preset. Custom text is disabled.
              </div>
            )}
            {newRule.mediaUrl && !newRule.templatePresetId && (
              <div style={{ marginTop: "10px", fontSize: "0.85rem", color: "#00a884", display: "flex", alignItems: "center", gap: "6px" }}>
                <ImageIcon size={16} /> Media attached from Quick Reply
              </div>
            )}
          </div>

          <button type="submit" className="btn-primary" style={{ marginTop: "1.5rem" }}>
            Save Automation Rule
          </button>
        </form>
      )}

      {loading ? (
        <div>Loading rules...</div>
      ) : visibleRules.length === 0 && !showRuleForm ? (
        <div className="glass-card" style={{ textAlign: "center", padding: "3rem" }}>
          <Clock size={48} color="#ccc" style={{ marginBottom: "1rem" }} />
          <h4>No Custom Rules For This Account</h4>
          <p style={{ color: "var(--text-secondary)" }}>Create rules to automatically engage with your audience.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.5rem" }}>
          {visibleRules.map(rule => (
            <div key={rule._id} className="glass-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", borderTop: "4px solid #00a884" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                  <h4 style={{ margin: 0, fontSize: "1.1rem", color: "#111b21" }}>{rule.name}</h4>
                  <span style={{ fontSize: "0.75rem", background: rule.active ? "#e6fce5" : "#ffe5e5", color: rule.active ? "#008069" : "#d9534f", padding: "4px 8px", borderRadius: "12px", fontWeight: "bold" }}>
                    {rule.active ? "Active" : "Paused"}
                  </span>
                </div>
                
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "8px", marginBottom: "15px" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <MessageSquare size={14} color="#667781" /> 
                    <span style={{ flex: 1 }}><strong>Statuses:</strong> {rule.statuses && rule.statuses.length > 0 ? rule.statuses.join(", ") : rule.status}</span>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Clock size={14} color="#667781" /> 
                    <span style={{ flex: 1 }}><strong>Delay:</strong> {rule.delayDays}d {rule.delayHours}h {rule.delayMinutes}m</span>
                  </span>
                  <span style={{ display: "flex", alignItems: "flex-start", gap: "6px" }}>
                    <Users size={14} color="#667781" style={{ marginTop: "2px" }} />
                    <span style={{ flex: 1 }}>{rule.whatsappAccountIds && rule.whatsappAccountIds.length > 0 
                      ? rule.whatsappAccountIds.map(a => a.name).join(", ") 
                      : "All Accounts"}</span>
                  </span>
                </div>
                
                <div style={{ fontSize: "0.85rem", background: "#f8f9fa", padding: "12px", borderRadius: "8px", borderLeft: "3px solid #00a884", marginBottom: "15px" }}>
                  {rule.templatePresetId && (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#00a884", marginBottom: "4px", fontWeight: "600" }}>
                      <CheckCircle2 size={14} /> Preset Template
                    </div>
                  )}
                  {rule.mediaUrl && <ImageIcon size={14} style={{ display: "inline", marginRight: "4px", color: "#667781" }} />}
                  <span style={{ color: "#111b21", lineHeight: "1.4" }}>{rule.messageText}</span>
                </div>
              </div>
              
              <div style={{ display: "flex", gap: "10px", borderTop: "1px solid #eee", paddingTop: "12px", marginTop: "auto", justifyContent: "flex-end" }}>
                <button
                  style={{ background: "none", border: "none", cursor: "pointer", color: rule.active ? "#d9534f" : "#008069", display: "flex", alignItems: "center", gap: "4px", fontSize: "0.85rem", fontWeight: "600" }}
                  onClick={() => toggleRuleStatus(rule._id, rule.active)}
                  title={rule.active ? "Pause Rule" : "Activate Rule"}
                >
                  {rule.active ? <><PauseCircle size={18} /> Pause</> : <><PlayCircle size={18} /> Activate</>}
                </button>
                <button
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#008069", display: "flex", alignItems: "center", gap: "4px", fontSize: "0.85rem", fontWeight: "600" }}
                  onClick={() => openEditRuleForm(rule)}
                  title="Edit Rule"
                >
                  <Edit2 size={18} /> Edit
                </button>
                <button
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#d9534f", display: "flex", alignItems: "center", gap: "4px", fontSize: "0.85rem", fontWeight: "600" }}
                  onClick={() => deleteRule(rule._id)}
                  title="Delete Rule"
                >
                  <Trash2 size={18} /> Delete
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
