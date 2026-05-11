import React, { useState } from "react";
import { X, Send } from "lucide-react";

const NewChatModal = ({ isOpen, onClose, onStart }) => {
  const [phone, setPhone] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!phone.trim()) return;
    onStart(phone);
    setPhone("");
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
      <div style={{ background: "white", borderRadius: "12px", width: "400px", maxWidth: "90%", padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h3 style={{ margin: 0 }}>Start New Chat</h3>
          <X cursor="pointer" onClick={onClose} />
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", fontSize: "0.85rem", color: "#667781", marginBottom: "5px" }}>Phone Number (with country code)</label>
            <input
              type="text"
              placeholder="e.g. 919876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ddd" }}
              autoFocus
            />
          </div>
          <button
            type="submit"
            style={{ width: "100%", padding: "12px", background: "#00a884", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}
          >
            <Send size={18} /> Start Chat
          </button>
        </form>
      </div>
    </div>
  );
};

export default NewChatModal;
