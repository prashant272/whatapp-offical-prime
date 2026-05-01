import React, { useState, useEffect } from "react";
import api from "../api";
import { Plus, Trash2, Save, Play, MessageSquare, ChevronDown, ChevronUp, Edit2, CheckCircle2 } from "lucide-react";
import { useWhatsAppAccount } from "../WhatsAppAccountContext";

const API_ENDPOINT = "/smart-flows";

const FlowManager = () => {
  const { activeAccount, accounts } = useWhatsAppAccount();
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingFlowId, setEditingFlowId] = useState(null);
  
  const [newFlow, setNewFlow] = useState({
    name: "",
    triggerKeyword: "",
    successMessage: "Dhanyawad! Aapki saari details save ho gayi hain. 🙏",
    steps: [{ question: "", saveToField: "", delay: 2 }],
    whatsappAccountIds: []
  });

  useEffect(() => {
    fetchFlows();
  }, [activeAccount]);

  const fetchFlows = async () => {
    try {
      setLoading(true);
      const res = await api.get(API_ENDPOINT);
      setFlows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching flows:", err);
      setFlows([]);
    } finally {
      setLoading(false);
    }
  };

  const addStep = () => {
    setNewFlow({
      ...newFlow,
      steps: [...newFlow.steps, { question: "", saveToField: "", delay: 2 }]
    });
  };

  const removeStep = (index) => {
    const updatedSteps = newFlow.steps.filter((_, i) => i !== index);
    setNewFlow({ ...newFlow, steps: updatedSteps });
  };

  const handleStepChange = (index, field, value) => {
    const updatedSteps = [...newFlow.steps];
    updatedSteps[index][field] = value;
    setNewFlow({ ...newFlow, steps: updatedSteps });
  };

  const saveFlow = async () => {
    if (!newFlow.name || !newFlow.triggerKeyword || newFlow.steps.some(s => !s.question || !s.saveToField)) {
      alert("Please fill all fields and steps correctly.");
      return;
    }

    try {
      if (editingFlowId) {
        await api.put(`${API_ENDPOINT}/${editingFlowId}`, newFlow);
      } else {
        await api.post(API_ENDPOINT, newFlow);
      }
      setShowAddForm(false);
      setEditingFlowId(null);
      setNewFlow({ name: "", triggerKeyword: "", successMessage: "Dhanyawad! Aapki saari details save ho gayi hain. 🙏", steps: [{ question: "", saveToField: "", delay: 2 }], whatsappAccountIds: [] });
      fetchFlows();
    } catch (err) {
      console.error("Error saving flow:", err);
    }
  };

  const handleEdit = (flow) => {
    setEditingFlowId(flow._id);
    setNewFlow({
      name: flow.name,
      triggerKeyword: flow.triggerKeyword,
      successMessage: flow.successMessage || "Dhanyawad! Aapki saari details save ho gayi hain. 🙏",
      steps: flow.steps.map(s => ({ question: s.question, saveToField: s.saveToField, delay: s.delay || 2 })),
      whatsappAccountIds: flow.whatsappAccountIds || []
    });
    setShowAddForm(true);
  };

  const deleteFlow = async (id) => {
    if (!window.confirm("Are you sure you want to delete this flow?")) return;
    try {
      await api.delete(`${API_ENDPOINT}/${id}`);
      fetchFlows();
    } catch (err) {
      console.error("Error deleting flow:", err);
    }
  };

  return (
    <div style={{ padding: "24px", background: "#f8fafc", minHeight: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.5rem", color: "#1e293b", fontWeight: "700" }}>Smart Flows</h2>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "0.9rem" }}>Create multi-step automated conversations</p>
        </div>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          style={{ 
            background: "#00a884", 
            color: "white", 
            border: "none", 
            padding: "10px 20px", 
            borderRadius: "12px", 
            fontWeight: "600", 
            display: "flex", 
            alignItems: "center", 
            gap: "8px",
            cursor: "pointer",
            boxShadow: "0 4px 6px -1px rgba(0, 168, 132, 0.2)"
          }}
        >
          <Plus size={20} /> {showAddForm ? "Cancel" : "Create New Flow"}
        </button>
      </div>

      {showAddForm && (
        <div style={{ background: "white", padding: "24px", borderRadius: "16px", marginBottom: "24px", boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)", border: "1px solid #e2e8f0" }}>
          <h3 style={{ marginTop: 0, marginBottom: "20px", fontSize: "1.1rem", color: "#1e293b" }}>{editingFlowId ? "Edit Your Flow" : "Design Your Flow"}</h3>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "24px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "#64748b", marginBottom: "8px" }}>Flow Name</label>
              <input 
                type="text" 
                placeholder="e.g. Lead Qualification"
                value={newFlow.name}
                onChange={(e) => setNewFlow({ ...newFlow, name: e.target.value })}
                style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0", outline: "none" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "#64748b", marginBottom: "8px" }}>Trigger Keyword</label>
              <input 
                type="text" 
                placeholder="e.g. register"
                value={newFlow.triggerKeyword}
                onChange={(e) => setNewFlow({ ...newFlow, triggerKeyword: e.target.value })}
                style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0", outline: "none" }}
              />
            </div>
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "#64748b", marginBottom: "12px" }}>Active For Accounts</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
              {accounts.map(acc => (
                <div 
                  key={acc._id}
                  onClick={() => {
                    const ids = newFlow.whatsappAccountIds.includes(acc._id)
                      ? newFlow.whatsappAccountIds.filter(id => id !== acc._id)
                      : [...newFlow.whatsappAccountIds, acc._id];
                    setNewFlow({ ...newFlow, whatsappAccountIds: ids });
                  }}
                  style={{ 
                    padding: "8px 16px", 
                    borderRadius: "20px", 
                    fontSize: "0.8rem", 
                    fontWeight: "600",
                    cursor: "pointer",
                    border: "1px solid",
                    borderColor: newFlow.whatsappAccountIds.includes(acc._id) ? "#00a884" : "#e2e8f0",
                    background: newFlow.whatsappAccountIds.includes(acc._id) ? "rgba(0, 168, 132, 0.1)" : "white",
                    color: newFlow.whatsappAccountIds.includes(acc._id) ? "#00a884" : "#64748b",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    transition: "all 0.2s"
                  }}
                >
                  <CheckCircle2 size={16} opacity={newFlow.whatsappAccountIds.includes(acc._id) ? 1 : 0.3} />
                  {acc.name} ({acc.phoneNumberId})
                </div>
              ))}
              {accounts.length === 0 && <p style={{ fontSize: "0.8rem", color: "#ef4444" }}>No accounts found. Please add an account first.</p>}
            </div>
            <p style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "8px" }}>If no accounts are selected, this flow will be available for ALL accounts.</p>
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "#64748b", marginBottom: "8px" }}>Success Message (End of Flow)</label>
            <textarea 
              placeholder="Message to send when flow is complete..."
              value={newFlow.successMessage}
              onChange={(e) => setNewFlow({ ...newFlow, successMessage: e.target.value })}
              style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0", outline: "none", resize: "none", height: "80px" }}
            />
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "#64748b", marginBottom: "12px" }}>Conversation Steps</label>
            {newFlow.steps.map((step, index) => (
              <div key={index} style={{ display: "flex", gap: "12px", marginBottom: "12px", alignItems: "flex-start", padding: "16px", background: "#f1f5f9", borderRadius: "12px" }}>
                <div style={{ background: "#00a884", color: "white", width: "28px", height: "28px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "0.8rem", fontWeight: "bold" }}>
                  {index + 1}
                </div>
                <div style={{ flex: 2 }}>
                  <textarea 
                    placeholder="Ask a question..."
                    value={step.question}
                    onChange={(e) => handleStepChange(index, "question", e.target.value)}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0", outline: "none", resize: "none", height: "60px", fontSize: "0.9rem" }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <input 
                    type="text" 
                    placeholder="Save answer as (e.g. city)"
                    value={step.saveToField}
                    onChange={(e) => handleStepChange(index, "saveToField", e.target.value)}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0", outline: "none" }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <input 
                    type="number" 
                    placeholder="Delay (s)"
                    title="Delay in seconds"
                    value={step.delay}
                    onChange={(e) => handleStepChange(index, "delay", e.target.value)}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0", outline: "none" }}
                  />
                </div>
                {newFlow.steps.length > 1 && (
                  <button onClick={() => removeStep(index)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", paddingTop: "10px" }}>
                    <Trash2 size={20} />
                  </button>
                )}
              </div>
            ))}
            <button 
              onClick={addStep}
              style={{ background: "none", border: "1px dashed #cbd5e1", color: "#64748b", padding: "10px", width: "100%", borderRadius: "10px", cursor: "pointer", fontSize: "0.85rem", fontWeight: "600", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
            >
              <Plus size={16} /> Add Another Step
            </button>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
            <button onClick={() => { setShowAddForm(false); setEditingFlowId(null); setNewFlow({ name: "", triggerKeyword: "", successMessage: "Dhanyawad! Aapki saari details save ho gayi hain. 🙏", steps: [{ question: "", saveToField: "", delay: 2 }], whatsappAccountIds: [] }); }} style={{ background: "none", border: "none", color: "#64748b", fontWeight: "600", cursor: "pointer" }}>Discard</button>
            <button 
              onClick={saveFlow}
              style={{ background: "#00a884", color: "white", border: "none", padding: "10px 30px", borderRadius: "10px", fontWeight: "600", cursor: "pointer" }}
            >
              {editingFlowId ? "Update Flow" : "Save Flow"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>Loading flows...</div>
      ) : flows.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px", background: "white", borderRadius: "20px", border: "2px dashed #e2e8f0" }}>
          <MessageSquare size={48} color="#cbd5e1" style={{ marginBottom: "16px" }} />
          <h3 style={{ margin: 0, color: "#475569" }}>No Smart Flows Yet</h3>
          <p style={{ color: "#94a3b8", fontSize: "0.9rem" }}>Create your first multi-step automation to collect lead data.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "20px" }}>
          {flows.map(flow => (
            <div key={flow._id} style={{ background: "white", padding: "20px", borderRadius: "16px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: "1.1rem", color: "#1e293b" }}>{flow.name}</h4>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                    <Play size={14} color="#00a884" fill="#00a884" />
                    <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: "600" }}>Trigger: <code>{flow.triggerKeyword}</code></span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={() => handleEdit(flow)} style={{ background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: "8px", padding: "6px", cursor: "pointer" }}>
                    <Edit2 size={18} />
                  </button>
                  <button onClick={() => deleteFlow(flow._id)} style={{ background: "#fee2e2", color: "#ef4444", border: "none", borderRadius: "8px", padding: "6px", cursor: "pointer" }}>
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "12px" }}>
                <p style={{ fontSize: "0.75rem", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", marginBottom: "8px", letterSpacing: "0.05em" }}>Flow Sequence ({flow.steps.length} Steps)</p>
                {flow.steps.map((step, idx) => (
                  <div key={idx} style={{ display: "flex", gap: "10px", marginBottom: "8px", fontSize: "0.85rem" }}>
                    <span style={{ color: "#00a884", fontWeight: "bold" }}>Q{idx + 1}:</span>
                    <span style={{ color: "#475569" }}>{step.question}</span>
                    <span style={{ fontSize: "0.75rem", background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px", color: "#64748b" }}>{step.delay || 2}s delay</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FlowManager;
