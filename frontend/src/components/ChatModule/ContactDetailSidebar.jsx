import React, { memo, useState, useCallback } from "react";
import { User, Clock, ChevronDown, Pencil, Loader2, Plus, X, ShieldAlert } from "lucide-react";

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
  const [isFocused, setIsFocused] = useState(false);

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
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {/* Dropdown */}
      <div style={{ position: "relative" }}>
        <select
          style={{
            width: "100%",
            padding: "10px 14px",
            background: "#f8fafc",
            border: isFocused ? "1.5px solid #4f46e5" : "1.5px solid #e2e8f0",
            borderRadius: "10px",
            fontSize: "0.9rem",
            color: "#1e293b",
            fontWeight: "600",
            outline: "none",
            cursor: "pointer",
            appearance: "none",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
          }}
          value={localOption}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onChange={e => handleOptionChange(e.target.value)}
          disabled={disabled}
        >
          <option value="">-- Select Option --</option>
          {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <ChevronDown size={15} style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }} />
      </div>

      {/* Sub-inputs (only when option selected) */}
      {localOption && (
        <div style={{ paddingLeft: "14px", borderLeft: "2.5px solid #4f46e5", display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
          {localNotes.map((note, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="text"
                value={note}
                onChange={e => handleNoteChange(idx, e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleNoteBlur()}
                placeholder={`Detail ${idx + 1}...`}
                disabled={disabled}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  border: "1.5px solid #e2e8f0",
                  borderRadius: "8px",
                  fontSize: "0.85rem",
                  fontWeight: "500",
                  color: "#334155",
                  outline: "none",
                  background: "#f8fafc",
                  transition: "all 0.2s ease"
                }}
                onFocus={e => {
                  e.target.style.borderColor = "#4f46e5";
                  e.target.style.background = "#ffffff";
                }}
                onBlur={e => {
                  e.target.style.borderColor = "#e2e8f0";
                  e.target.style.background = "#f8fafc";
                  handleNoteBlur();
                }}
              />
              {localNotes.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeNote(idx)}
                  style={{
                    background: "#fff5f5",
                    border: "1px solid #fee2e2",
                    borderRadius: "8px",
                    padding: "8px",
                    cursor: "pointer",
                    color: "#ef4444",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s ease"
                  }}
                  onMouseOver={e => e.currentTarget.style.background = "#fee2e2"}
                  onMouseOut={e => e.currentTarget.style.background = "#fff5f5"}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addNote}
            style={{
              alignSelf: "flex-start",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              background: "#eeebff",
              border: "1.5px solid #e0d9ff",
              borderRadius: "8px",
              padding: "6px 12px",
              fontSize: "0.75rem",
              fontWeight: "600",
              color: "#4f46e5",
              cursor: "pointer",
              marginTop: "2px",
              transition: "all 0.2s ease"
            }}
            onMouseOver={e => e.currentTarget.style.background = "#e0d9ff"}
            onMouseOut={e => e.currentTarget.style.background = "#eeebff"}
          >
            <Plus size={12} /> Add Detail
          </button>
        </div>
      )}
    </div>
  );
};

// ── Smart CUSTOM FIELD ITEM: Handles local focus states ──────────────────────
const CustomFieldItem = ({ field, activeContact, isUpdatingField, handleUpdateCustomField, setActiveContact }) => {
  const [isFocusedField, setIsFocusedField] = useState(false);

  return (
    <div style={{
      background: "#ffffff",
      borderRadius: "14px",
      padding: "14px 16px",
      border: "1.5px solid",
      borderColor: isUpdatingField === field.name ? "#4f46e5" : isFocusedField ? "#6366f1" : "#edf2f7",
      position: "relative",
      transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
      boxShadow: isUpdatingField === field.name ? "0 4px 12px rgba(99, 102, 241, 0.05)" : "0 1px 2px rgba(0,0,0,0.01)"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <label style={{ color: "#64748b", fontSize: "0.7rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em" }}>{field.label}</label>
        {isUpdatingField === field.name ? (
          <Loader2 size={12} className="animate-spin" color="#4f46e5" />
        ) : (
          <Pencil size={11} color="#94a3b8" />
        )}
      </div>

      {field.type === "SELECT" ? (
        <div style={{ position: "relative" }}>
          <select
            style={{
              width: "100%",
              padding: "10px 14px",
              background: "#f8fafc",
              border: isFocusedField ? "1.5px solid #4f46e5" : "1.5px solid #e2e8f0",
              borderRadius: "10px",
              fontSize: "0.9rem",
              color: "#1e293b",
              fontWeight: "600",
              outline: "none",
              cursor: "pointer",
              appearance: "none",
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
            }}
            value={activeContact?.customFields?.[field.name] || ""}
            onFocus={() => setIsFocusedField(true)}
            onBlur={() => setIsFocusedField(false)}
            onChange={(e) => handleUpdateCustomField(activeContact?._id, field.name, e.target.value)}
            disabled={isUpdatingField === field.name || !activeContact}
          >
            <option value="">Select Option</option>
            {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          <ChevronDown size={15} style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }} />
        </div>
      ) : field.type === "COMBOBOX" ? (
        <ComboboxWithNotes
          field={field}
          value={activeContact?.customFields?.[field.name] || ""}
          onChange={(val) => {
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
          style={{
            width: "100%",
            padding: "10px 14px",
            background: "#f8fafc",
            border: isFocusedField ? "1.5px solid #4f46e5" : "1.5px solid #e2e8f0",
            borderRadius: "10px",
            fontSize: "0.9rem",
            color: "#1e293b",
            fontWeight: "600",
            outline: "none",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
          }}
          placeholder={field.type === "DATE" ? "DD/MM/YYYY" : `Enter ${field.label.toLowerCase()}...`}
          value={activeContact?.customFields?.[field.name] || ""}
          onFocus={() => setIsFocusedField(true)}
          onBlur={(e) => {
            setIsFocusedField(false);
            handleUpdateCustomField(activeContact?._id, field.name, e.target.value);
          }}
          onChange={(e) => {
            const val = e.target.value;
            setActiveContact(prev => ({
              ...prev,
              customFields: { ...prev.customFields, [field.name]: val }
            }));
          }}
          onKeyDown={(e) => e.key === "Enter" && handleUpdateCustomField(activeContact?._id, field.name, e.target.value)}
          disabled={isUpdatingField === field.name || !activeContact}
        />
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
  setActiveContact, handleToggleBlock
}) => {
  if (!showContactInfo || !selectedChat) return null;

  return (
    <div style={{
      background: "#ffffff",
      borderLeft: "1px solid #edf2f7",
      display: "flex",
      flexDirection: "column",
      width: "380px",
      height: "100%",
      position: "relative",
      animation: "slideInRight 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
      zIndex: 50,
      boxShadow: "-10px 0 30px rgba(15, 23, 42, 0.03)",
      overflow: "hidden"
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 24px",
        background: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: "64px",
        borderBottom: "1px solid #edf2f7",
        flexShrink: 0
      }}>
        <span style={{ color: "#0f172a", fontSize: "1.05rem", fontWeight: "700", letterSpacing: "-0.01em" }}>Contact Details</span>
        <button
          onClick={() => setShowContactInfo(false)}
          style={{
            background: "#f1f5f9",
            border: "none",
            color: "#64748b",
            cursor: "pointer",
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s ease"
          }}
          onMouseOver={e => {
            e.currentTarget.style.background = "#e2e8f0";
            e.currentTarget.style.color = "#0f172a";
          }}
          onMouseOut={e => {
            e.currentTarget.style.background = "#f1f5f9";
            e.currentTarget.style.color = "#64748b";
          }}
        >
          ✕
        </button>
      </div>

      <div className="chat-scroll" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Profile Header */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", paddingBottom: "10px", borderBottom: "1px solid #edf2f7" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {/* Left: Photo */}
            <div style={{
              width: "64px",
              height: "64px",
              borderRadius: "20px",
              background: "linear-gradient(135deg, #6366f1, #4f46e5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: "1.75rem",
              fontWeight: "700",
              boxShadow: "0 8px 16px -4px rgba(99, 102, 241, 0.2)",
              border: "2px solid #ffffff",
              outline: "1px solid #e2e8f0",
              flexShrink: 0
            }}>
              {(activeContact?.name || selectedChat?.phone || "U").charAt(0).toUpperCase()}
            </div>
            {/* Right: Info */}
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <h3 style={{ color: "#0f172a", margin: "0", fontSize: "1.2rem", fontWeight: "700", letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {activeContact?.name || "New Contact"}
              </h3>
              <p style={{ color: "#64748b", margin: "4px 0 0 0", fontSize: "0.9rem", fontWeight: "500", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {selectedChat.phone}
              </p>
            </div>
          </div>

          {/* Timeline Button below */}
          <button
            onClick={() => {
              setShowTimelineModal(true);
              fetchTimelineEntries(activeContact?._id);
            }}
            style={{
              alignSelf: "flex-start",
              background: "#eeebff",
              color: "#4f46e5",
              border: "none",
              borderRadius: "30px",
              padding: "8px 18px",
              fontSize: "0.8rem",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
            }}
            onMouseOver={e => {
              e.currentTarget.style.background = "#e0d9ff";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseOut={e => {
              e.currentTarget.style.background = "#eeebff";
              e.currentTarget.style.transform = "none";
            }}
          >
            <Clock size={13} style={{ color: "#4f46e5" }} /> Activity History
          </button>
        </div>

        {/* Basic Info Card */}
        <div style={{
          background: "#ffffff",
          borderRadius: "18px",
          padding: "20px",
          border: "1.5px solid #edf2f7",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.01)"
        }}>
          <p style={{
            fontSize: "0.75rem",
            color: "#64748b",
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            margin: 0,
            borderBottom: "1.5px solid #f1f5f9",
            paddingBottom: "10px"
          }}>
            Status & Assignment
          </p>

          {(() => {
            const isJobsStatus = (selectedChat.status || "").toLowerCase() === "jobs";
            return (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ color: "#334155", fontSize: "0.7rem", fontWeight: "800", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Lead Status</label>
                    <div style={{ position: "relative" }}>
                      <select
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          background: "#f8fafc",
                          border: "1.5px solid #e2e8f0",
                          borderRadius: "10px",
                          color: "#1e293b",
                          fontSize: "0.9rem",
                          fontWeight: "600",
                          outline: "none",
                          cursor: "pointer",
                          appearance: "none",
                          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
                        }}
                        value={selectedChat.status || "New"}
                        onChange={(e) => handleUpdateStatus(e.target.value)}
                        onFocus={e => {
                          e.target.style.borderColor = "#4f46e5";
                          e.target.style.background = "#ffffff";
                        }}
                        onBlur={e => {
                          e.target.style.borderColor = "#e2e8f0";
                          e.target.style.background = "#f8fafc";
                        }}
                      >
                        {[...allStatusOptions]
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map(s => (
                            <option key={s.name} value={s.name}>{s.name}</option>
                          ))}
                      </select>
                      <ChevronDown size={15} style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }} />
                    </div>
                  </div>

                  {isJobsStatus ? (
                    <div>
                      <label style={{ color: "#334155", fontSize: "0.7rem", fontWeight: "800", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Specialist</label>
                      <div style={{ position: "relative" }}>
                        <select
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            background: "#f8fafc",
                            border: "1.5px solid #e2e8f0",
                            borderRadius: "12px",
                            color: "#1e293b",
                            fontSize: "0.85rem",
                            fontWeight: "600",
                            outline: "none",
                            cursor: "pointer",
                            appearance: "none",
                            transition: "all 0.2s ease"
                          }}
                          value={typeof selectedChat.assignedTo === 'object' ? selectedChat.assignedTo?._id : (selectedChat.assignedTo || "")}
                          onChange={(e) => handleAssign(e.target.value, undefined)}
                          onFocus={e => {
                            e.target.style.borderColor = "#4f46e5";
                            e.target.style.background = "#ffffff";
                          }}
                          onBlur={e => {
                            e.target.style.borderColor = "#e2e8f0";
                            e.target.style.background = "#f8fafc";
                          }}
                        >
                          <option value="">Nil (Unassigned)</option>
                          {[...executives]
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map(ex => (
                              <option key={ex._id} value={ex._id}>{ex.name}</option>
                            ))}
                        </select>
                        <User size={14} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label style={{ color: "#334155", fontSize: "0.7rem", fontWeight: "800", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Sector</label>
                      <div style={{ position: "relative" }}>
                        <select
                          style={{
                            width: "100%",
                            padding: "10px 14px",
                            background: "#f8fafc",
                            border: "1.5px solid #e2e8f0",
                            borderRadius: "10px",
                            color: "#1e293b",
                            fontSize: "0.9rem",
                            fontWeight: "600",
                            outline: "none",
                            cursor: "pointer",
                            appearance: "none",
                            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
                          }}
                          value={activeContact?.sector || selectedChat.sector || "Unassigned"}
                          onChange={(e) => handleAssign(undefined, e.target.value, "Unassigned")}
                          onFocus={e => {
                            e.target.style.borderColor = "#4f46e5";
                            e.target.style.background = "#ffffff";
                          }}
                          onBlur={e => {
                            e.target.style.borderColor = "#e2e8f0";
                            e.target.style.background = "#f8fafc";
                          }}
                        >
                          <option value="Unassigned">Unassigned</option>
                          {[...sectors]
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map(s => (
                              <option key={s._id} value={s.name}>{s.name}</option>
                            ))}
                        </select>
                        <ChevronDown size={15} style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }} />
                      </div>
                    </div>
                  )}
                </div>

                {(selectedChat.followUpTime || (selectedChat.status && selectedChat.status.toLowerCase().includes("follow"))) && (
                  <div style={{
                    padding: "10px 14px",
                    background: "#fffbeb",
                    border: "1px solid #fef3c7",
                    borderRadius: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px"
                  }}>
                    <Clock size={14} color="#d97706" />
                    <span style={{ fontSize: "0.75rem", color: "#b45309", fontWeight: "600" }}>
                      Due: {selectedChat.followUpTime ? new Date(selectedChat.followUpTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "Not Scheduled"}
                      {selectedChat.followUpActivity && ` - ${selectedChat.followUpActivity}`}
                    </span>
                  </div>
                )}

                {/* Subsector and Specialist grid layout (only when not Jobs status) */}
                {!isJobsStatus && (
                  <div style={{ display: "grid", gridTemplateColumns: (activeContact?.sector || selectedChat.sector) && (activeContact?.sector || selectedChat.sector) !== "Unassigned" ? "1fr 1fr" : "1fr", gap: "12px" }}>
                    {(activeContact?.sector || selectedChat.sector) && (activeContact?.sector || selectedChat.sector) !== "Unassigned" && (
                      <div>
                        <label style={{ color: "#334155", fontSize: "0.7rem", fontWeight: "800", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Subsector</label>
                        <div style={{ position: "relative" }}>
                          <select
                            style={{
                              width: "100%",
                              padding: "10px 12px",
                              background: "#f8fafc",
                              border: "1.5px solid #e2e8f0",
                              borderRadius: "12px",
                              color: "#1e293b",
                              fontSize: "0.85rem",
                              fontWeight: "600",
                              outline: "none",
                              cursor: "pointer",
                              appearance: "none",
                              transition: "all 0.2s ease"
                            }}
                            value={activeContact?.subsector || selectedChat.subsector || "Unassigned"}
                            onChange={(e) => handleAssign(undefined, undefined, e.target.value)}
                            onFocus={e => {
                              e.target.style.borderColor = "#4f46e5";
                              e.target.style.background = "#ffffff";
                            }}
                            onBlur={e => {
                              e.target.style.borderColor = "#e2e8f0";
                              e.target.style.background = "#f8fafc";
                            }}
                          >
                            <option value="Unassigned">Unassigned</option>
                            {[...(sectors.find(s => s.name === (activeContact?.sector || selectedChat.sector))?.subsectors || [])]
                              .sort((a, b) => a.localeCompare(b))
                              .map(sub => (
                                <option key={sub} value={sub}>{sub}</option>
                              ))}
                          </select>
                          <ChevronDown size={14} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
                        </div>
                      </div>
                    )}

                    <div>
                      <label style={{ color: "#334155", fontSize: "0.7rem", fontWeight: "800", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Specialist</label>
                      <div style={{ position: "relative" }}>
                        <select
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            background: "#f8fafc",
                            border: "1.5px solid #e2e8f0",
                            borderRadius: "12px",
                            color: "#1e293b",
                            fontSize: "0.85rem",
                            fontWeight: "600",
                            outline: "none",
                            cursor: "pointer",
                            appearance: "none",
                            transition: "all 0.2s ease"
                          }}
                          value={typeof selectedChat.assignedTo === 'object' ? selectedChat.assignedTo?._id : (selectedChat.assignedTo || "")}
                          onChange={(e) => handleAssign(e.target.value, undefined)}
                          onFocus={e => {
                            e.target.style.borderColor = "#4f46e5";
                            e.target.style.background = "#ffffff";
                          }}
                          onBlur={e => {
                            e.target.style.borderColor = "#e2e8f0";
                            e.target.style.background = "#f8fafc";
                          }}
                        >
                          <option value="">Nil (Unassigned)</option>
                          {[...executives]
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map(ex => (
                              <option key={ex._id} value={ex._id}>{ex.name}</option>
                            ))}
                        </select>
                        <User size={14} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
                      </div>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* CRM Attributes Section */}
        {(() => {
          const isJobsStatus = (selectedChat.status || "").toLowerCase() === "jobs";
          
          const filteredFields = customFieldsDef.filter(field => {
            const fieldStatus = (field.applicableStatus || "All").toLowerCase();
            if (isJobsStatus) {
              return fieldStatus === "jobs";
            } else {
              return fieldStatus !== "jobs";
            }
          });

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
                  {isJobsStatus ? "Job Details" : "Lead Intelligence"}
                </p>
                <div style={{ height: "1px", flex: 1, background: "#edf2f7", marginLeft: "12px" }}></div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {filteredFields.length === 0 ? (
                  <p style={{ fontSize: "0.85rem", color: "#94a3b8", textAlign: "center", fontStyle: "italic", background: "#f8fafc", padding: "20px", borderRadius: "16px", border: "1px dashed #e2e8f0" }}>
                    {isJobsStatus ? "No job fields configured." : "No custom attributes found."}
                  </p>
                ) : (
                  [...filteredFields]
                    .sort((a, b) => {
                      if (a.sortOrder === 0 && b.sortOrder === 0) return 0;
                      if (a.sortOrder === 0) return 1;
                      if (b.sortOrder === 0) return -1;
                      return a.sortOrder - b.sortOrder;
                    })
                    .map(field => (
                      <CustomFieldItem
                        key={field._id}
                        field={field}
                        activeContact={activeContact}
                        isUpdatingField={isUpdatingField}
                        handleUpdateCustomField={handleUpdateCustomField}
                        setActiveContact={setActiveContact}
                      />
                    ))
                )}
              </div>
            </div>
          );
        })()}

        {/* Footer Actions */}
        <div style={{ marginTop: "auto", paddingTop: "8px" }}>
          <button
            onClick={() => handleToggleBlock(activeContact?._id, !activeContact?.isBlocked)}
            style={{
              width: "100%",
              padding: "12px",
              background: activeContact?.isBlocked ? "#f0fdf4" : "transparent",
              border: activeContact?.isBlocked ? "1.5px solid #86efac" : "1.5px solid #fca5a5",
              color: activeContact?.isBlocked ? "#15803d" : "#ef4444",
              borderRadius: "12px",
              cursor: "pointer",
              fontSize: "0.85rem",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
            }}
            onMouseOver={e => {
              e.currentTarget.style.background = activeContact?.isBlocked ? "#dcfce7" : "#fff5f5";
              e.currentTarget.style.borderColor = activeContact?.isBlocked ? "#22c55e" : "#ef4444";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseOut={e => {
              e.currentTarget.style.background = activeContact?.isBlocked ? "#f0fdf4" : "transparent";
              e.currentTarget.style.borderColor = activeContact?.isBlocked ? "#86efac" : "#fca5a5";
              e.currentTarget.style.transform = "none";
            }}
          >
            <ShieldAlert size={16} /> {activeContact?.isBlocked ? "Unblock Contact" : "Block Contact"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default memo(ContactDetailSidebar);
