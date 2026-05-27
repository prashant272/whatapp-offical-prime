import React, { memo, useState, useCallback } from "react";
import { User, Clock, ChevronDown, Pencil, Loader2, Plus, X } from "lucide-react";

// ── Smart COMBOBOX: Dropdown + Dynamic Sub-Inputs ──────────────────────────
const ComboboxWithNotes = ({ field, value, onChange, disabled }) => {
  // Parse stored JSON value
  let parsed = { option: "", notes: [""] };
  try {
    if (value && value.startsWith("{")) {
      parsed = JSON.parse(value);
      if (!parsed.notes || parsed.notes.length === 0) parsed.notes = [""];
    } else if (value) {
      parsed = { option: value, notes: [""] };
    }
  } catch { parsed = { option: value || "", notes: [""] }; }

  const [localOption, setLocalOption] = useState(parsed.option);
  const [localNotes, setLocalNotes] = useState(parsed.notes);

  const commit = useCallback((opt, notes) => {
    const jsonVal = JSON.stringify({ option: opt, notes });
    onChange(jsonVal);
  }, [onChange]);

  const handleOptionChange = (opt) => {
    setLocalOption(opt);
    commit(opt, localNotes);
  };

  const handleNoteChange = (idx, val) => {
    const updated = [...localNotes];
    updated[idx] = val;
    setLocalNotes(updated);
  };

  const handleNoteBlur = () => commit(localOption, localNotes);

  const addNote = () => {
    const updated = [...localNotes, ""];
    setLocalNotes(updated);
  };

  const removeNote = (idx) => {
    const updated = localNotes.filter((_, i) => i !== idx);
    const final = updated.length === 0 ? [""] : updated;
    setLocalNotes(final);
    commit(localOption, final);
  };

  return (
    <div>
      {/* Dropdown */}
      <div style={{ position: "relative", marginBottom: localOption ? "10px" : 0 }}>
        <select
          style={{ width: "100%", padding: "4px 0", background: "transparent", border: "none", borderBottom: "1.5px solid #f1f5f9", fontSize: "0.95rem", color: "#1e293b", fontWeight: "700", outline: "none", cursor: "pointer", appearance: "none" }}
          value={localOption}
          onChange={e => handleOptionChange(e.target.value)}
          disabled={disabled}
        >
          <option value="">-- Select Option --</option>
          {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <ChevronDown size={14} style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
      </div>

      {/* Sub-inputs (only when option selected) */}
      {localOption && (
        <div style={{ paddingLeft: "10px", borderLeft: "2px solid #e0f2fe", display: "flex", flexDirection: "column", gap: "6px" }}>
          {localNotes.map((note, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <input
                type="text"
                value={note}
                onChange={e => handleNoteChange(idx, e.target.value)}
                onBlur={handleNoteBlur}
                onKeyDown={e => e.key === "Enter" && handleNoteBlur()}
                placeholder={`Detail ${idx + 1}...`}
                disabled={disabled}
                style={{ flex: 1, padding: "5px 8px", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "0.85rem", fontWeight: "600", color: "#1e293b", outline: "none", background: "#f8fafc" }}
              />
              {localNotes.length > 1 && (
                <button type="button" onClick={() => removeNote(idx)} style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", padding: "4px", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center" }}>
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={addNote} style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: "4px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "4px 10px", fontSize: "0.75rem", fontWeight: "700", color: "#16a34a", cursor: "pointer", marginTop: "2px" }}>
            <Plus size={12} /> Add Detail
          </button>
        </div>
      )}
    </div>
  );
};
// ───────────────────────────────────────────────────────────────────────────

const ContactDetailSidebar = ({
  showContactInfo, setShowContactInfo,
  selectedChat, activeContact,
  setShowTimelineModal, fetchTimelineEntries,
  allStatusOptions, handleUpdateStatus,
  sectors, handleAssign,
  executives, customFieldsDef,
  isUpdatingField, handleUpdateCustomField,
  setActiveContact
}) => {
  if (!showContactInfo || !selectedChat) return null;

  return (
    <div style={{
      background: "white",
      borderLeft: "1px solid #e2e8f0",
      display: "flex",
      flexDirection: "column",
      width: "350px",
      height: "100%",
      position: "relative",
      animation: "slideInRight 0.3s ease",
      zIndex: 50,
      boxShadow: "-4px 0 15px rgba(0,0,0,0.05)",
      overflow: "hidden"
    }}>
      <div style={{ padding: "12px 16px", background: "#f8fafc", display: "flex", alignItems: "center", gap: "20px", height: "60px", borderBottom: "1px solid #e2e8f0", flexShrink: 0 }}>
        <button onClick={() => setShowContactInfo(false)} style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", fontSize: "1.2rem" }}>✕</button>
        <span style={{ color: "#1e293b", fontSize: "0.95rem", fontWeight: "700" }}>Contact Details</span>
      </div>

      <div className="chat-scroll" style={{ flex: 1, overflowY: "scroll", overflowX: "hidden", padding: "24px", display: "flex", flexDirection: "column" }}>
        {/* Profile Header */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "30px" }}>
          <div style={{
            width: "110px",
            height: "110px",
            borderRadius: "35px",
            background: "linear-gradient(135deg, #00a884, #05cd99)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: "3rem",
            fontWeight: "800",
            marginBottom: "15px",
            boxShadow: "0 10px 30px rgba(0,168,132,0.25)",
            textShadow: "0 2px 4px rgba(0,0,0,0.1)"
          }}>
            {(activeContact?.name || selectedChat?.phone || "U").charAt(0).toUpperCase()}
          </div>
          <h3 style={{ textAlign: "center", color: "#1e293b", margin: "0", fontSize: "1.25rem", fontWeight: "800", letterSpacing: "-0.5px" }}>
            {activeContact?.name || "New Contact"}
          </h3>
          <p style={{ textAlign: "center", color: "#64748b", margin: "4px 0 15px 0", fontSize: "0.95rem", fontWeight: "600" }}>
            {selectedChat.phone}
          </p>

          <button
            onClick={() => {
              setShowTimelineModal(true);
              fetchTimelineEntries(activeContact?._id);
            }}
            style={{
              background: "rgba(0, 168, 132, 0.08)",
              color: "#00a884",
              border: "1.5px solid rgba(0, 168, 132, 0.2)",
              borderRadius: "25px",
              padding: "10px 24px",
              fontSize: "0.85rem",
              fontWeight: "700",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.2s"
            }}
            onMouseOver={e => e.currentTarget.style.background = "rgba(0, 168, 132, 0.15)"}
            onMouseOut={e => e.currentTarget.style.background = "rgba(0, 168, 132, 0.08)"}
          >
            <Clock size={16} /> Activity History
          </button>
        </div>

        {/* Basic Info Section */}
        <div style={{ marginBottom: "30px", background: "#f8fafc", borderRadius: "20px", padding: "20px", border: "1px solid #f1f5f9" }}>
          <p style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "800", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "16px", borderBottom: "1px solid #e2e8f0", paddingBottom: "8px" }}>Status & Team</p>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ color: "#64748b", fontSize: "0.65rem", fontWeight: "800", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Lead Status</label>
            <div style={{ position: "relative" }}>
              <select
                style={{ width: "100%", padding: "10px 12px", background: "#ffffff", border: "1.5px solid #e2e8f0", borderRadius: "12px", color: "#1e293b", fontSize: "0.9rem", fontWeight: "600", outline: "none", cursor: "pointer", appearance: "none" }}
                value={selectedChat.status || "New"}
                onChange={(e) => handleUpdateStatus(e.target.value)}
              >
                {allStatusOptions.map(s => (
                  <option key={s.name} value={s.name}>{s.name}</option>
                ))}
              </select>
              <ChevronDown size={14} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
            </div>
            {(selectedChat.followUpTime || (selectedChat.status && selectedChat.status.toLowerCase().includes("follow"))) && (
              <div style={{ marginTop: "8px", padding: "8px 12px", background: "#fffbeb", border: "1px solid #fef3c7", borderRadius: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Clock size={12} color="#d97706" />
                <span style={{ fontSize: "0.7rem", color: "#d97706", fontWeight: "700" }}>
                  Due: {selectedChat.followUpTime ? new Date(selectedChat.followUpTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "Not Scheduled"}
                  {selectedChat.followUpActivity && ` - ${selectedChat.followUpActivity}`}
                </span>
              </div>
            )}
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ color: "#64748b", fontSize: "0.65rem", fontWeight: "800", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Sector</label>
            <div style={{ position: "relative" }}>
              <select
                style={{ width: "100%", padding: "10px 12px", background: "#ffffff", border: "1.5px solid #e2e8f0", borderRadius: "12px", color: "#1e293b", fontSize: "0.9rem", fontWeight: "600", outline: "none", cursor: "pointer", appearance: "none" }}
                value={activeContact?.sector || selectedChat.sector || "Unassigned"}
                onChange={(e) => handleAssign(undefined, e.target.value)}
              >
                <option value="Unassigned">Unassigned</option>
                {sectors.map(s => (
                  <option key={s._id} value={s.name}>{s.name}</option>
                ))}
              </select>
              <ChevronDown size={14} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
            </div>
          </div>

          <div>
            <label style={{ color: "#64748b", fontSize: "0.65rem", fontWeight: "800", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Assigned Specialist</label>
            <div style={{ position: "relative" }}>
              <select
                style={{ width: "100%", padding: "10px 12px", background: "#ffffff", border: "1.5px solid #e2e8f0", borderRadius: "12px", color: "#1e293b", fontSize: "0.9rem", fontWeight: "600", outline: "none", cursor: "pointer", appearance: "none" }}
                value={typeof selectedChat.assignedTo === 'object' ? selectedChat.assignedTo?._id : (selectedChat.assignedTo || "")}
                onChange={(e) => handleAssign(e.target.value, undefined)}
              >
                <option value="">Nil (Unassigned)</option>
                {executives.map(ex => (
                  <option key={ex._id} value={ex._id}>{ex.name} ({ex.role})</option>
                ))}
              </select>
              <User size={14} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
            </div>
          </div>
        </div>

        {/* CRM Attributes Section */}
        <div style={{ marginBottom: "25px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <p style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "800", textTransform: "uppercase", letterSpacing: "1px", margin: 0 }}>Lead Intelligence</p>
            <div style={{ height: "1px", flex: 1, background: "#e2e8f0", marginLeft: "12px" }}></div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {customFieldsDef.length === 0 ? (
              <p style={{ fontSize: "0.8rem", color: "#94a3b8", textAlign: "center", fontStyle: "italic", background: "#f8fafc", padding: "20px", borderRadius: "15px" }}>No custom attributes found.</p>
            ) : (
              [...customFieldsDef]
                .sort((a, b) => {
                  // Fields with sortOrder=0 go last, others sort ascending
                  if (a.sortOrder === 0 && b.sortOrder === 0) return 0;
                  if (a.sortOrder === 0) return 1;
                  if (b.sortOrder === 0) return -1;
                  return a.sortOrder - b.sortOrder;
                })
                .map(field => (
                <div key={field._id} style={{
                  background: "#ffffff",
                  borderRadius: "16px",
                  padding: "16px",
                  border: "1.5px solid #e2e8f0",
                  position: "relative",
                  transition: "all 0.3s ease",
                  boxShadow: isUpdatingField === field.name ? "0 4px 12px rgba(0,0,0,0.05)" : "none",
                  borderColor: isUpdatingField === field.name ? "#00a884" : "#e2e8f0"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <label style={{ color: "#64748b", fontSize: "0.65rem", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.5px" }}>{field.label}</label>
                    {isUpdatingField === field.name ? (
                      <Loader2 size={12} className="animate-spin" color="#00a884" />
                    ) : (
                      <Pencil size={11} color="#cbd5e1" />
                    )}
                  </div>

                  {field.type === "SELECT" ? (
                    <div style={{ position: "relative" }}>
                      <select
                        style={{ width: "100%", padding: "4px 0", background: "transparent", border: "none", borderBottom: "1.5px solid #f1f5f9", fontSize: "0.95rem", color: "#1e293b", fontWeight: "700", outline: "none", cursor: "pointer", appearance: "none" }}
                        value={activeContact?.customFields?.[field.name] || ""}
                        onChange={(e) => handleUpdateCustomField(activeContact?._id, field.name, e.target.value)}
                        disabled={isUpdatingField === field.name || !activeContact}
                      >
                        <option value="">Select Option</option>
                        {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                      <ChevronDown size={14} style={{ position: "absolute", right: "0", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
                    </div>
                  ) : field.type === "COMBOBOX" ? (
                    <ComboboxWithNotes
                      field={field}
                      value={activeContact?.customFields?.[field.name] || ""}
                      onChange={(val) => {
                        // Optimistically update local state
                        setActiveContact(prev => ({
                          ...prev,
                          customFields: { ...prev.customFields, [field.name]: val }
                        }));
                        handleUpdateCustomField(activeContact?._id, field.name, val);
                      }}
                      disabled={isUpdatingField === field.name || !activeContact}
                    />
                  ) : (
                    <input
                      type="text"
                      style={{ width: "100%", padding: "4px 0", background: "transparent", border: "none", borderBottom: "1.5px solid #f1f5f9", fontSize: "0.95rem", color: "#1e293b", fontWeight: "700", outline: "none" }}
                      placeholder={field.type === "DATE" ? "DD/MM/YYYY" : `Enter ${field.label.toLowerCase()}...`}
                      value={activeContact?.customFields?.[field.name] || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setActiveContact(prev => ({
                          ...prev,
                          customFields: { ...prev.customFields, [field.name]: val }
                        }));
                      }}
                      onBlur={(e) => handleUpdateCustomField(activeContact?._id, field.name, e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleUpdateCustomField(activeContact?._id, field.name, e.target.value)}
                      disabled={isUpdatingField === field.name || !activeContact}
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ marginTop: "auto", paddingTop: "20px" }}>
          <button
            onClick={() => alert("Notes feature coming soon!")}
            style={{ width: "100%", padding: "12px", background: "#fff1f2", border: "1px solid #fee2e2", color: "#e11d48", borderRadius: "10px", cursor: "pointer", fontSize: "0.85rem", fontWeight: "700", transition: "all 0.2s" }}
            onMouseOver={e => e.currentTarget.style.background = "#ffe4e6"}
            onMouseOut={e => e.currentTarget.style.background = "#fff1f2"}
          >
            Block Contact
          </button>
        </div>
      </div>
    </div>
  );
};

export default memo(ContactDetailSidebar);
