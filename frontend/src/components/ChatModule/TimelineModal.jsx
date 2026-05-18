import React, { useState } from "react";
import { X, Clock, Send, Loader2, User, Pencil, Trash2 } from "lucide-react";

const TimelineModal = ({
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

  const formatRelativeTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} mins ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    
    return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
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
          padding: "24px 30px", 
          background: "linear-gradient(135deg, #00a884 0%, #05cd99 100%)", 
          color: "white", 
          position: "relative",
          boxShadow: "0 4px 20px rgba(0,168,132,0.2)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
            <div style={{ 
              background: "rgba(255,255,255,0.15)", 
              padding: "12px", 
              borderRadius: "18px",
              backdropFilter: "blur(4px)"
            }}>
              <Clock size={28} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.4rem", fontWeight: "900", letterSpacing: "-0.5px" }}>Interaction Timeline</h3>
              <p style={{ margin: "2px 0 0 0", opacity: 0.85, fontSize: "0.85rem", fontWeight: "600" }}>Logging updates for {contactName}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            style={{ 
              position: "absolute", top: "22px", right: "25px", 
              background: "rgba(0,0,0,0.1)", border: "none", color: "white",
              width: "32px", height: "32px", borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", transition: "all 0.2s"
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Post Update Section - Reduced Height */}
        <div style={{ padding: "20px 30px", borderBottom: "1px solid #f1f5f9", background: "#fcfdfe" }}>
          <div style={{ 
            background: "white", 
            borderRadius: "20px", 
            padding: "15px 20px", 
            boxShadow: "0 4px 15px rgba(0,0,0,0.04)", 
            border: "1.5px solid #eef2f6"
          }}>
            <textarea
              placeholder="What happened?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (content.trim() && !isLoading) onAdd();
                }
              }}
              style={{ 
                width: "100%", border: "none", outline: "none", resize: "none", 
                fontSize: "0.95rem", color: "#1e293b", minHeight: "50px", 
                fontFamily: "inherit", lineHeight: "1.5", fontWeight: "500"
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px" }}>
              <button
                onClick={onAdd}
                disabled={!content.trim() || isLoading}
                style={{
                  background: "#00a884",
                  color: "white",
                  border: "none",
                  borderRadius: "14px",
                  padding: "10px 24px",
                  fontSize: "0.9rem",
                  fontWeight: "800",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 6px 15px rgba(0,168,132,0.2)"
                }}
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Post Update
              </button>
            </div>
          </div>
        </div>

        {/* Timeline List */}
        <div className="chat-scroll" style={{ padding: "30px", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "25px", background: "#ffffff" }}>
          {entries.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#cbd5e1" }}>
              <Clock size={40} style={{ opacity: 0.3, marginBottom: "15px" }} />
              <p style={{ fontSize: "1rem", fontWeight: "600" }}>No activity recorded yet.</p>
            </div>
          ) : (
            entries.map((entry, idx) => (
              <div key={entry._id} style={{ display: "flex", gap: "25px", position: "relative" }}>
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
                    background: "#f1f5f9", 
                    margin: "6px 0", borderRadius: "3px" 
                  }}></div>}
                </div>

                <div style={{ 
                  flex: 1, background: "#ffffff", borderRadius: "22px", padding: "18px", 
                  border: "1.5px solid #f1f5f9", position: "relative",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.02)"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ width: "30px", height: "30px", borderRadius: "10px", background: "rgba(0,168,132,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#00a884" }}>
                        <User size={14} />
                      </div>
                      <div>
                        <div style={{ fontWeight: "800", color: "#1e293b", fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <span>{entry.createdBy?.name || "System"}</span>
                          {entry.whatsappAccountName && (
                            <span style={{ fontSize: "0.75rem", background: entry.isCampaign ? "#e0e7ff" : "#f1f5f9", color: entry.isCampaign ? "#4338ca" : "#475569", padding: "2px 8px", borderRadius: "10px", fontWeight: "700" }}>
                              📱 {entry.whatsappAccountName}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "700", marginTop: "2px" }}>
                          {formatRelativeTime(entry.timestamp)}
                        </div>
                      </div>
                    </div>
                    {(currentUser?.role === "Admin" || currentUser?.role === "Manager") && !entry.isCampaign && (
                      <div style={{ display: "flex", gap: "4px" }}>
                        <button onClick={() => handleEditStart(entry)} style={{ padding: "8px", background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}>
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => onDelete(entry._id)} style={{ padding: "8px", background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  {editingId === entry._id ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            if (editContent.trim()) handleEditSave();
                          }
                        }}
                        style={{ width: "100%", padding: "14px", borderRadius: "14px", border: "2px solid #00a884", outline: "none" }}
                      />
                      <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                        <button onClick={() => setEditingId(null)} style={{ padding: "8px 18px", borderRadius: "10px", border: "none", background: "#f1f5f9" }}>Cancel</button>
                        <button onClick={handleEditSave} style={{ padding: "8px 18px", borderRadius: "10px", border: "none", background: "#00a884", color: "white" }}>Save</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: "1rem", color: "#334155", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
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

export default TimelineModal;
