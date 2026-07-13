import React, { useState, useEffect } from "react";
import axios from "axios";
import { Bot, AlertCircle, Save } from "lucide-react";
import { useWhatsAppAccount } from "../WhatsAppAccountContext";

const API_BASE = import.meta.env.VITE_API_URL || "";

const AIHintAutomation = () => {
  const { activeAccount, refreshAccounts } = useWhatsAppAccount();
  const [aiHint, setAiHint] = useState("");
  const [saving, setSaving] = useState(false);
  const currentUser = JSON.parse(localStorage.getItem("userInfo"));
  const config = { headers: { Authorization: `Bearer ${currentUser?.token}` } };

  useEffect(() => {
    if (activeAccount) {
      setAiHint(activeAccount.aiHint || "");
    }
  }, [activeAccount]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!activeAccount) return;
    
    setSaving(true);
    try {
      await axios.put(`${API_BASE}/api/whatsapp-accounts/${activeAccount._id}`, { aiHint }, config);
      await refreshAccounts(); // Refresh global context so the updated hint is reflected
      alert("AI Hint saved successfully!");
    } catch (err) {
      alert("Error saving AI Hint: " + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ background: "white", padding: "30px", borderRadius: "16px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
      <h2 style={{ margin: "0 0 10px 0", fontSize: "18px", fontWeight: "700", color: "#111b21", display: "flex", alignItems: "center", gap: "8px" }}>
        <Bot color="#00a884" size={24} /> AI Fallback Settings
      </h2>
      <p style={{ color: "#667781", fontSize: "14px", margin: "0 0 25px 0" }}>
        Set custom instructions for the AI to follow when a user message doesn't match any specific automation flow or keyword.
      </p>

      {/* Info alerts */}
      <div style={{ display: "flex", gap: "12px", background: "#e3f2fd", borderLeft: "4px solid #1976d2", padding: "15px", borderRadius: "8px", marginBottom: "30px" }}>
        <AlertCircle color="#1976d2" size={20} style={{ minWidth: "20px" }} />
        <div style={{ fontSize: "13px", color: "#1976d2", lineHeight: "1.5" }}>
          <strong>Tip:</strong> Provide clear instructions about your business, the tone of voice, and what the AI should ask the customer. Example: <em>"You are a helpful assistant for a pizza shop. Always ask what kind of pizza they want and keep answers short."</em>
        </div>
      </div>

      <form onSubmit={handleSave}>
        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", fontSize: "14px", color: "#111b21", marginBottom: "8px", fontWeight: "600" }}>
            AI Instructions (For account: {activeAccount?.name || "None Selected"})
          </label>
          <textarea
            rows="6"
            placeholder="Enter AI instructions here..."
            value={aiHint}
            onChange={e => setAiHint(e.target.value)}
            style={{ 
              width: "100%", 
              padding: "15px", 
              borderRadius: "12px", 
              border: "1px solid #d1d7db", 
              resize: "vertical",
              fontSize: "15px",
              outline: "none",
              fontFamily: "inherit"
            }}
          />
        </div>

        <button
          type="submit"
          disabled={saving || !activeAccount}
          style={{
            background: "#00a884",
            color: "white",
            border: "none",
            padding: "12px 24px",
            borderRadius: "8px",
            fontWeight: "600",
            cursor: (saving || !activeAccount) ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            opacity: (saving || !activeAccount) ? 0.7 : 1
          }}
        >
          <Save size={18} />
          {saving ? "Saving..." : "Save AI Hint"}
        </button>
      </form>
    </div>
  );
};

export default AIHintAutomation;
