import React, { useState, useEffect } from "react";
import { X, Search, Plus, Trash2, Clock, Send, Check, Loader2, Pencil } from "lucide-react";
import api from "../../api";

export const TemplateModal = ({ isOpen, onClose, templates, presets = [], selectedChat, onSend }) => {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("presets"); // "presets" or "meta"
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [variables, setVariables] = useState({});

  if (!isOpen) return null;

  const filteredTemplates = templates.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
  const filteredPresets = presets.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  const handleSelectTemplate = (t) => {
    setSelectedTemplate(t);
    const body = t.components.find(c => c.type === "BODY");
    if (body) {
      const matches = body.text.match(/{{(\d+)}}/g) || [];
      const newVars = {};
      matches.forEach(m => {
        const num = m.match(/\d+/)[0];
        newVars[num] = "";
      });
      setVariables(newVars);
    }
  };

  const handleSelectPreset = (p) => {
    // Find the corresponding Meta template
    const template = templates.find(t => t.name === p.templateName);
    if (!template) {
      alert("Base template not found for this preset!");
      return;
    }

    const components = [];
    if (p.variables && p.variables.length > 0) {
      components.push({
        type: "body",
        parameters: p.variables.map(val => ({ type: "text", text: val }))
      });
    }

    if (p.mediaUrl) {
      // Check if template has a header that supports images
      const header = template.components.find(c => c.type === "HEADER");
      if (header && header.format === "IMAGE") {
        components.unshift({
          type: "header",
          parameters: [{ type: "image", image: { link: p.mediaUrl } }]
        });
      }
    }

    onSend(p.templateName, components);
    onClose();
  };

  const handleSend = () => {
    const components = [];
    if (Object.keys(variables).length > 0) {
      components.push({
        type: "body",
        parameters: Object.keys(variables).sort((a, b) => a - b).map(key => ({
          type: "text",
          text: variables[key]
        }))
      });
    }
    onSend(selectedTemplate.name, components);
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
      <div style={{ background: "white", borderRadius: "12px", width: "500px", maxWidth: "90%", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>Send Template</h3>
          <X cursor="pointer" onClick={onClose} />
        </div>

        <div style={{ padding: "16px", flex: 1, overflowY: "auto" }}>
          {!selectedTemplate ? (
            <>
              {/* Tabs */}
              <div style={{ display: "flex", borderBottom: "1px solid #eee", marginBottom: "15px" }}>
                <button
                  onClick={() => setActiveTab("presets")}
                  style={{ flex: 1, padding: "10px", background: "none", border: "none", borderBottom: activeTab === "presets" ? "3px solid #00a884" : "none", fontWeight: activeTab === "presets" ? "bold" : "normal", color: activeTab === "presets" ? "#00a884" : "#667781", cursor: "pointer" }}
                >
                  Presets
                </button>
                <button
                  onClick={() => setActiveTab("meta")}
                  style={{ flex: 1, padding: "10px", background: "none", border: "none", borderBottom: activeTab === "meta" ? "3px solid #00a884" : "none", fontWeight: activeTab === "meta" ? "bold" : "normal", color: activeTab === "meta" ? "#00a884" : "#667781", cursor: "pointer" }}
                >
                  Meta Templates
                </button>
              </div>

              <div style={{ position: "relative", marginBottom: "15px" }}>
                <Search style={{ position: "absolute", left: "10px", top: "10px", color: "#8696a0" }} size={18} />
                <input
                  type="text"
                  placeholder={`Search ${activeTab === "presets" ? "presets" : "templates"}...`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px 8px 35px", borderRadius: "8px", border: "1px solid #ddd" }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {activeTab === "presets" ? (
                  filteredPresets.length > 0 ? (
                    filteredPresets.map(p => (
                      <div key={p._id} onClick={() => handleSelectPreset(p)} style={{ padding: "12px", border: "1px solid #eee", borderRadius: "8px", cursor: "pointer", background: "#fdfdfd", display: "flex", gap: "10px", alignItems: "center" }}>
                        {p.mediaUrl && <img src={p.mediaUrl} alt="" style={{ width: "50px", height: "50px", borderRadius: "4px", objectFit: "cover" }} />}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: "bold" }}>{p.name}</div>
                          <div style={{ fontSize: "0.75rem", color: "#667781" }}>Template: {p.templateName}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ textAlign: "center", padding: "20px", color: "#8696a0" }}>No presets found. Go to Templates to create one.</div>
                  )
                ) : (
                  filteredTemplates.map(t => (
                    <div key={t.name} onClick={() => handleSelectTemplate(t)} style={{ padding: "12px", border: "1px solid #eee", borderRadius: "8px", cursor: "pointer", hover: { background: "#f8f9fa" } }}>
                      <div style={{ fontWeight: "bold" }}>{t.name}</div>
                      <div style={{ fontSize: "0.8rem", color: "#667781" }}>{t.language} • {t.category}</div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div>
              <button onClick={() => setSelectedTemplate(null)} style={{ background: "none", border: "none", color: "#00a884", cursor: "pointer", marginBottom: "10px" }}>← Back to list</button>
              <h4>{selectedTemplate.name}</h4>
              <div style={{ background: "#f8f9fa", padding: "12px", borderRadius: "8px", marginBottom: "15px", whiteSpace: "pre-wrap", fontSize: "0.9rem" }}>
                {selectedTemplate.components.find(c => c.type === "BODY")?.text}
              </div>
              {Object.keys(variables).length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <p style={{ fontWeight: "bold", fontSize: "0.85rem" }}>Variables:</p>
                  {Object.keys(variables).map(num => (
                    <div key={num}>
                      <label style={{ fontSize: "0.75rem", color: "#667781" }}>Variable {"{{" + num + "}}"}</label>
                      <input
                        type="text"
                        value={variables[num]}
                        onChange={(e) => setVariables({ ...variables, [num]: e.target.value })}
                        style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ddd" }}
                      />
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={handleSend}
                style={{ width: "100%", marginTop: "20px", padding: "12px", background: "#00a884", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}
              >
                Send to {selectedChat?.phone}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const TimelineModal = ({
  isOpen, onClose, entries, contactName, 
  onAdd, onEdit, onDelete,
  content, setContent,
  currentUser, isLoading
}) => {
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState("");

  if (!isOpen) return null;

  const handleEditStart = (entry) => {
    setEditingId(entry._id);
    setEditContent(entry.content);
  };

  const handleEditSave = () => {
    onEdit(editingId, editContent);
    setEditingId(null);
    setEditContent("");
  };

  return (
    <div style={{ 
      position: "fixed", inset: 0, 
      background: "rgba(11, 27, 33, 0.75)", 
      display: "flex", alignItems: "center", justifyContent: "center", 
      zIndex: 2000, backdropFilter: "blur(8px)" 
    }}>
      <div style={{ 
        background: "#ffffff", 
        borderRadius: "28px", 
        width: "600px", maxWidth: "95%", 
        maxHeight: "85vh", 
        display: "flex", flexDirection: "column", 
        overflow: "hidden", 
        boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
        border: "1px solid rgba(255,255,255,0.1)"
      }}>
        
        {/* Header - Premium Gradient */}
        <div style={{ 
          padding: "30px", 
          background: "linear-gradient(135deg, #00a884 0%, #05cd99 100%)", 
          color: "white", 
          position: "relative",
          boxShadow: "0 4px 20px rgba(0,168,132,0.2)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
            <div style={{ 
              background: "rgba(255,255,255,0.15)", 
              padding: "14px", 
              borderRadius: "20px",
              backdropFilter: "blur(4px)",
              boxShadow: "inset 0 0 10px rgba(255,255,255,0.1)"
            }}>
              <Clock size={32} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.5rem", fontWeight: "900", letterSpacing: "-0.5px" }}>Interaction Timeline</h3>
              <p style={{ margin: "4px 0 0 0", opacity: 0.85, fontSize: "0.9rem", fontWeight: "600" }}>Logging updates for {contactName}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            style={{ 
              position: "absolute", top: "25px", right: "25px", 
              background: "rgba(0,0,0,0.1)", border: "none", color: "white",
              width: "36px", height: "36px", borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", transition: "all 0.2s"
            }}
            onMouseOver={e => e.currentTarget.style.background = "rgba(0,0,0,0.2)"}
            onMouseOut={e => e.currentTarget.style.background = "rgba(0,0,0,0.1)"}
          >
            <X size={20} />
          </button>
        </div>

        {/* Post Update Section - Enhanced UI */}
        <div style={{ padding: "28px", borderBottom: "1px solid #f1f5f9", background: "#fcfdfe" }}>
          <div style={{ 
            background: "white", 
            borderRadius: "22px", 
            padding: "20px", 
            boxShadow: "0 4px 15px rgba(0,0,0,0.04)", 
            border: "1.5px solid #eef2f6",
            transition: "all 0.3s ease"
          }}>
            <textarea
              placeholder="What happened? (e.g. Client asked for price list, Visited site...)"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              style={{ 
                width: "100%", border: "none", outline: "none", resize: "none", 
                fontSize: "1rem", color: "#1e293b", minHeight: "90px", 
                fontFamily: "inherit", lineHeight: "1.6", fontWeight: "500"
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "15px" }}>
              <button
                onClick={onAdd}
                disabled={!content.trim() || isLoading}
                style={{
                  background: "#00a884",
                  color: "white",
                  border: "none",
                  borderRadius: "16px",
                  padding: "12px 28px",
                  fontSize: "0.95rem",
                  fontWeight: "800",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  boxShadow: "0 8px 20px rgba(0,168,132,0.25)",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                }}
                onMouseOver={e => !isLoading && (e.currentTarget.style.transform = "translateY(-2px)")}
                onMouseOut={e => !isLoading && (e.currentTarget.style.transform = "translateY(0)")}
              >
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                Post Update
              </button>
            </div>
          </div>
        </div>

        {/* Timeline List - High Fidelity */}
        <div className="chat-scroll" style={{ padding: "30px", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "25px", background: "#ffffff" }}>
          {entries.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#cbd5e1" }}>
              <div style={{ background: "#f8fafc", width: "80px", height: "80px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                <Clock size={40} style={{ opacity: 0.3 }} />
              </div>
              <p style={{ fontSize: "1.1rem", fontWeight: "600" }}>No activity recorded yet.</p>
              <p style={{ fontSize: "0.85rem", marginTop: "4px" }}>Start by posting a new update above.</p>
            </div>
          ) : (
            entries.map((entry, idx) => (
              <div key={entry._id} style={{ display: "flex", gap: "25px", position: "relative" }}>
                {/* Dynamic Visual Line */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "32px", flexShrink: 0 }}>
                  <div style={{ 
                    width: "16px", height: "16px", borderRadius: "50%", 
                    background: idx === 0 ? "#00a884" : "#e2e8f0", 
                    border: idx === 0 ? "4px solid #e7fce3" : "2px solid white",
                    zIndex: 2,
                    boxShadow: idx === 0 ? "0 0 0 2px #00a884" : "none"
                  }}></div>
                  {idx !== entries.length - 1 && <div style={{ 
                    flex: 1, width: "3px", 
                    background: "linear-gradient(to bottom, #f1f5f9, #f8fafc)", 
                    margin: "6px 0", borderRadius: "3px" 
                  }}></div>}
                </div>

                {/* Entry Card */}
                <div style={{ 
                  flex: 1, background: "#ffffff", borderRadius: "24px", padding: "20px", 
                  border: "1.5px solid #f1f5f9", position: "relative",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
                  transition: "all 0.3s ease"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: "rgba(0,168,132,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#00a884" }}>
                        <User size={16} />
                      </div>
                      <div>
                        <div style={{ fontWeight: "800", color: "#1e293b", fontSize: "1rem", letterSpacing: "-0.3px" }}>{entry.createdBy?.name || "System"}</div>
                        <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "700", textTransform: "uppercase" }}>
                          {new Date(entry.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                    {currentUser?.role === "Admin" && (
                      <div style={{ display: "flex", gap: "4px" }}>
                        <button 
                          onClick={() => handleEditStart(entry)} 
                          style={{ padding: "8px", background: "none", border: "none", color: "#94a3b8", cursor: "pointer", borderRadius: "8px", transition: "all 0.2s" }}
                          onMouseOver={e => { e.currentTarget.style.color = "#00a884"; e.currentTarget.style.background = "#f0fdf4"; }}
                          onMouseOut={e => { e.currentTarget.style.color = "#94a3b8"; e.currentTarget.style.background = "none"; }}
                        >
                          <Pencil size={14} />
                        </button>
                        <button 
                          onClick={() => onDelete(entry._id)} 
                          style={{ padding: "8px", background: "none", border: "none", color: "#94a3b8", cursor: "pointer", borderRadius: "8px", transition: "all 0.2s" }}
                          onMouseOver={e => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.background = "#fef2f2"; }}
                          onMouseOut={e => { e.currentTarget.style.color = "#94a3b8"; e.currentTarget.style.background = "none"; }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  {editingId === entry._id ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "10px" }}>
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        style={{ 
                          width: "100%", padding: "14px", borderRadius: "14px", 
                          border: "2px solid #00a884", fontSize: "0.95rem", 
                          outline: "none", background: "#f0fdf4", minHeight: "80px" 
                        }}
                      />
                      <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                        <button 
                          onClick={() => setEditingId(null)} 
                          style={{ padding: "8px 18px", borderRadius: "10px", border: "none", background: "#f1f5f9", color: "#64748b", fontWeight: "700", cursor: "pointer" }}
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={handleEditSave} 
                          style={{ padding: "8px 18px", borderRadius: "10px", border: "none", background: "#00a884", color: "white", fontWeight: "700", cursor: "pointer", boxShadow: "0 4px 10px rgba(0,168,132,0.2)" }}
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ 
                      fontSize: "1rem", color: "#334155", lineHeight: "1.6", 
                      whiteSpace: "pre-wrap", padding: "4px 0", fontWeight: "500" 
                    }}>
                      {entry.content}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export const ManageStatusSectorModal = ({ isOpen, onClose, type, allStatusOptions, sectors, onAdd, onDelete }) => {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#00a884");

  if (!isOpen) return null;

  const list = type === "status" ? allStatusOptions : sectors;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({ name, color });
    setName("");
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
      <div style={{ background: "white", borderRadius: "12px", width: "400px", maxWidth: "90%", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>Manage {type === "status" ? "Statuses" : "Sectors"}</h3>
          <X cursor="pointer" onClick={onClose} />
        </div>
        <div style={{ padding: "16px", flex: 1, overflowY: "auto" }}>
          <form onSubmit={handleSubmit} style={{ marginBottom: "20px", display: "flex", gap: "8px" }}>
            <input
              type="text"
              placeholder={`Add new ${type}...`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid #ddd" }}
            />
            {type === "status" && (
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                style={{ width: "40px", height: "35px", border: "none", borderRadius: "4px", padding: 0 }}
              />
            )}
            <button type="submit" style={{ padding: "8px 12px", background: "#00a884", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}>
              <Plus size={18} />
            </button>
          </form>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {list.map(item => (
              <div key={item._id || item.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px", background: "#f8f9fa", borderRadius: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {type === "status" && <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: item.color }}></div>}
                  <span style={{ fontWeight: "500" }}>{item.name}</span>
                </div>
                <Trash2 size={16} color="#ef4444" cursor="pointer" onClick={() => onDelete(item._id || item.name)} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const NewChatModal = ({ isOpen, onClose, accounts, onStart }) => {
  const [phone, setPhone] = useState("");
  const [selectedAcc, setSelectedAcc] = useState(accounts[0]?._id || "");

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!phone.trim()) return;
    onStart(phone, selectedAcc);
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
      <div style={{ background: "white", borderRadius: "12px", width: "400px", maxWidth: "90%", padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h3 style={{ margin: 0 }}>Start New Chat</h3>
          <X cursor="pointer" onClick={onClose} />
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "5px", fontSize: "0.85rem", fontWeight: "bold" }}>Account</label>
            <select
              value={selectedAcc}
              onChange={(e) => setSelectedAcc(e.target.value)}
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ddd" }}
            >
              {accounts.map(acc => (
                <option key={acc._id} value={acc._id}>{acc.name} ({acc.phoneNumberId})</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "5px", fontSize: "0.85rem", fontWeight: "bold" }}>Phone Number</label>
            <input
              type="text"
              placeholder="e.g. 919876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ddd" }}
            />
          </div>
          <button type="submit" style={{ width: "100%", padding: "12px", background: "#00a884", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", marginTop: "10px" }}>
            Start Chat
          </button>
        </form>
      </div>
    </div>
  );
};
