import React, { useState } from "react";
import { X, Trash2, Plus, Pencil, Check, Settings2, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";

const ManageStatusSectorModal = ({ isOpen, onClose, initialType = "status", allStatusOptions, sectors, onAdd, onDelete, onUpdate }) => {
  const [activeTab, setActiveTab] = useState(initialType || "status");
  const [name, setName] = useState("");
  const [color, setColor] = useState("#00a884");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#00a884");

  // Subsector local states
  const [expandedSectorId, setExpandedSectorId] = useState(null);
  const [newSubsector, setNewSubsector] = useState("");

  if (!isOpen) return null;

  const list = activeTab === "status" ? allStatusOptions : sectors;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd(activeTab, { name, color });
    setName("");
  };

  const handleEditStart = (item) => {
    setEditingId(item._id || item.name);
    setEditName(item.name);
    setEditColor(item.color || "#00a884");
  };

  const handleEditSave = (id) => {
    const item = list.find(x => (x._id || x.name) === id);
    const updatePayload = { name: editName };
    if (activeTab === "status") {
      updatePayload.color = editColor;
    } else {
      updatePayload.subsectors = item.subsectors || [];
    }
    onUpdate(activeTab, id, updatePayload);
    setEditingId(null);
  };

  const toggleExpandSector = (id) => {
    setExpandedSectorId(prev => prev === id ? null : id);
    setNewSubsector("");
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(11, 27, 33, 0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, backdropFilter: "blur(8px)" }}>
      <div style={{ background: "white", borderRadius: "24px", width: "520px", maxWidth: "90%", maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 25px 60px rgba(0,0,0,0.3)" }}>
        
        {/* Header */}
        <div style={{ padding: "24px", background: "linear-gradient(135deg, #1e293b, #334155)", color: "white", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <div style={{ background: "rgba(255,255,255,0.1)", padding: "10px", borderRadius: "12px" }}>
              <Settings2 size={24} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: "800" }}>System Configuration</h3>
              <p style={{ margin: 0, opacity: 0.7, fontSize: "0.8rem" }}>Manage lead statuses and business sectors</p>
            </div>
          </div>
          <button onClick={onClose} style={{ position: "absolute", top: "20px", right: "20px", background: "none", border: "none", color: "white", cursor: "pointer", opacity: 0.7 }}>
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", background: "#f8fafc", padding: "8px", gap: "8px" }}>
          <button
            onClick={() => setActiveTab("status")}
            style={{ 
              flex: 1, padding: "12px", borderRadius: "12px", border: "none", 
              background: activeTab === "status" ? "white" : "transparent",
              color: activeTab === "status" ? "#1e293b" : "#64748b",
              fontWeight: "700", cursor: "pointer", transition: "all 0.2s",
              boxShadow: activeTab === "status" ? "0 4px 12px rgba(0,0,0,0.05)" : "none"
            }}
          >
            Lead Statuses
          </button>
          <button
            onClick={() => setActiveTab("sector")}
            style={{ 
              flex: 1, padding: "12px", borderRadius: "12px", border: "none", 
              background: activeTab === "sector" ? "white" : "transparent",
              color: activeTab === "sector" ? "#1e293b" : "#64748b",
              fontWeight: "700", cursor: "pointer", transition: "all 0.2s",
              boxShadow: activeTab === "sector" ? "0 4px 12px rgba(0,0,0,0.05)" : "none"
            }}
          >
            Business Sectors
          </button>
        </div>

        <div style={{ padding: "24px", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Add Form */}
          <form onSubmit={handleSubmit} style={{ display: "flex", gap: "10px", alignItems: "center", background: "#f1f5f9", padding: "12px", borderRadius: "16px" }}>
            <input
              type="text"
              placeholder={`Add new ${activeTab === "status" ? "status" : "sector"}...`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ flex: 1, padding: "10px 14px", borderRadius: "10px", border: "1.5px solid #e2e8f0", outline: "none", fontSize: "0.95rem" }}
            />
            {activeTab === "status" && (
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                style={{ width: "40px", height: "40px", border: "none", borderRadius: "8px", padding: 0, cursor: "pointer" }}
              />
            )}
            <button type="submit" style={{ width: "40px", height: "40px", background: "#00a884", color: "white", border: "none", borderRadius: "10px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Plus size={20} />
            </button>
          </form>

          {/* Items List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {list.map(item => {
              const itemId = item._id || item.name;
              const isExpanded = expandedSectorId === itemId;

              return (
                <div key={itemId} style={{ 
                  borderRadius: "16px", border: "1px solid #f1f5f9", 
                  background: "#ffffff", display: "flex", flexDirection: "column",
                  transition: "all 0.2s",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
                  overflow: "hidden"
                }}>
                  {/* Main row */}
                  <div style={{ 
                    padding: "12px 16px", display: "flex", justifyContent: "space-between", 
                    alignItems: "center"
                  }}>
                    {editingId === itemId ? (
                      <div style={{ flex: 1, display: "flex", gap: "10px", alignItems: "center" }}>
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          style={{ flex: 1, padding: "6px 10px", borderRadius: "8px", border: "1.5px solid #00a884", outline: "none" }}
                        />
                        {activeTab === "status" && (
                          <input
                            type="color"
                            value={editColor}
                            onChange={(e) => setEditColor(e.target.value)}
                            style={{ width: "30px", height: "30px", border: "none", borderRadius: "6px" }}
                          />
                        )}
                        <button onClick={() => handleEditSave(itemId)} style={{ background: "#00a884", color: "white", border: "none", padding: "6px", borderRadius: "8px", cursor: "pointer" }}>
                          <Check size={16} />
                        </button>
                        <button onClick={() => setEditingId(null)} style={{ background: "#f1f5f9", color: "#64748b", border: "none", padding: "6px", borderRadius: "8px", cursor: "pointer" }}>
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          {activeTab === "status" ? (
                            <div style={{ width: "14px", height: "14px", borderRadius: "50%", background: item.color || "#00a884", boxShadow: `0 0 0 3px ${item.color}15` }}></div>
                          ) : (
                            <button 
                              onClick={() => toggleExpandSector(itemId)}
                              style={{ background: "#f1f5f9", border: "none", padding: "6px", borderRadius: "8px", color: "#64748b", display: "flex", alignItems: "center", cursor: "pointer" }}
                            >
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          )}
                          <span 
                            style={{ fontWeight: "600", color: "#1e293b", cursor: activeTab === "sector" ? "pointer" : "default" }}
                            onClick={() => activeTab === "sector" && toggleExpandSector(itemId)}
                          >
                            {item.name}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                          {activeTab === "sector" && (
                            <span style={{ fontSize: "0.75rem", background: "#f1f5f9", color: "#64748b", padding: "4px 8px", borderRadius: "20px", fontWeight: "700", display: "flex", alignItems: "center" }}>
                              {(item.subsectors || []).length} subs
                            </span>
                          )}
                          <button onClick={() => handleEditStart(item)} style={{ padding: "6px", background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}>
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => onDelete(activeTab, itemId)} style={{ padding: "6px", background: "none", border: "none", color: "#f87171", cursor: "pointer" }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Subsector Panel */}
                  {activeTab === "sector" && isExpanded && (
                    <div style={{ padding: "16px", background: "#f8fafc", borderTop: "1px solid #f1f5f9", display: "flex", flexDirection: "column", gap: "10px" }}>
                      <label style={{ fontSize: "0.7rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Subsectors</label>
                      
                      {/* Subsectors List */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {(!item.subsectors || item.subsectors.length === 0) ? (
                          <span style={{ fontSize: "0.8rem", color: "#94a3b8", fontStyle: "italic" }}>No subsectors created. Add one below.</span>
                        ) : (
                          item.subsectors.map(sub => (
                            <div key={sub} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "white", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                              <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "#1e293b" }}>{sub}</span>
                              <button
                                onClick={() => {
                                  const updatedSubs = item.subsectors.filter(s => s !== sub);
                                  onUpdate("sector", itemId, { name: item.name, subsectors: updatedSubs });
                                }}
                                style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", padding: "4px", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center" }}
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Add Subsector Input */}
                      <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                        <input
                          type="text"
                          placeholder="New subsector name..."
                          value={newSubsector}
                          onChange={(e) => setNewSubsector(e.target.value)}
                          style={{ flex: 1, padding: "8px 12px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "0.85rem", outline: "none" }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (!newSubsector.trim()) return;
                              const updatedSubs = [...(item.subsectors || []), newSubsector.trim()];
                              onUpdate("sector", itemId, { name: item.name, subsectors: updatedSubs });
                              setNewSubsector("");
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!newSubsector.trim()) return;
                            const updatedSubs = [...(item.subsectors || []), newSubsector.trim()];
                            onUpdate("sector", itemId, { name: item.name, subsectors: updatedSubs });
                            setNewSubsector("");
                          }}
                          style={{ padding: "8px 14px", background: "#00a884", color: "white", border: "none", borderRadius: "10px", cursor: "pointer", fontSize: "0.8rem", fontWeight: "700" }}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManageStatusSectorModal;
