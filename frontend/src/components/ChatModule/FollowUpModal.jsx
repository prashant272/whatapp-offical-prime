import React, { useState } from "react";
import { X, Calendar, Clock, Send } from "lucide-react";

const FollowUpModal = ({ isOpen, onClose, onConfirm, initialDate, initialTime }) => {
  const [date, setDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(initialTime || "10:00");
  const [activity, setActivity] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const followUpTime = new Date(`${date}T${time}`).toISOString();
    onConfirm(followUpTime, activity);
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
      <div style={{ background: "white", borderRadius: "12px", width: "400px", maxWidth: "90%", padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h3 style={{ margin: 0 }}>Schedule Follow-up</h3>
          <X cursor="pointer" onClick={onClose} />
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", fontSize: "0.85rem", color: "#667781", marginBottom: "5px" }}>Date</label>
            <div style={{ position: "relative" }}>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ddd" }}
              />
            </div>
          </div>
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", fontSize: "0.85rem", color: "#667781", marginBottom: "5px" }}>Time</label>
            <div style={{ position: "relative" }}>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ddd" }}
              />
            </div>
          </div>
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", fontSize: "0.85rem", color: "#667781", marginBottom: "5px" }}>Activity/Note</label>
            <textarea
              placeholder="e.g. Call client for feedback"
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ddd", minHeight: "80px", resize: "none" }}
            />
          </div>
          <button
            type="submit"
            style={{ width: "100%", padding: "12px", background: "#00a884", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}
          >
            Confirm Follow-up
          </button>
        </form>
      </div>
    </div>
  );
};

export default FollowUpModal;
