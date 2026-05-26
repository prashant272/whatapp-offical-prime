import React, { useState } from "react";
import { ChevronRight, User, Smartphone, History, Send, StickyNote, Bell, CheckCircle, Plus, Loader2, Trash2, MessageSquare } from "lucide-react";
import api from "../../api";

const ContactDrawer = ({
  contact, onClose, loadingTimeline, timelineEntries,
  navigate, currentUser, onUpdateContact, onOpenChat
}) => {
  const [activeTab, setActiveTab] = useState("timeline"); // timeline, notes, alarms
  const [noteContent, setNoteContent] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [alarmTitle, setAlarmTitle] = useState("");
  const [alarmTime, setAlarmTime] = useState("");
  const [addingAlarm, setAddingAlarm] = useState(false);

  const handleAddNote = async () => {
    if (!noteContent.trim()) return;
    setAddingNote(true);
    try {
      const res = await api.post(`/contacts/${contact._id}/notes`, { content: noteContent });
      onUpdateContact(res.data);
      setNoteContent("");
    } catch (err) {
      console.error("Note error:", err);
      alert("Failed to add note");
    } finally {
      setAddingNote(false);
    }
  };

  const handleAddAlarm = async () => {
    if (!alarmTitle.trim() || !alarmTime) return;
    setAddingAlarm(true);
    try {
      const res = await api.post(`/contacts/${contact._id}/reminders`, { title: alarmTitle, time: alarmTime });
      onUpdateContact(res.data);
      setAlarmTitle("");
      setAlarmTime("");
    } catch (err) {
      console.error("Alarm error:", err);
      alert("Failed to set alarm");
    } finally {
      setAddingAlarm(false);
    }
  };

  const toggleReminder = async (reminderId) => {
    try {
      const res = await api.patch(`/contacts/${contact._id}/reminders/${reminderId}/toggle`);
      onUpdateContact(res.data);
    } catch (err) {
      console.error("Toggle alarm error:", err);
    }
  };

  return (
    <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, background: "rgba(0,0,0,0.4)", zIndex: 6000, display: "flex", justifyContent: "flex-end", backdropFilter: "blur(2px)" }} onClick={onClose}>
      <div style={{ width: "480px", background: "white", height: "100%", display: "flex", flexDirection: "column", boxShadow: "-10px 0 30px rgba(0,0,0,0.1)", animation: "slideInRight 0.3s ease-out" }} onClick={e => e.stopPropagation()}>

        {/* Drawer Header (Sticky) */}
        <div style={{ background: "#1a1a1a", color: "white", padding: "1.8rem 1.5rem 1.2rem", position: "relative", flexShrink: 0 }}>
          <div onClick={onClose} style={{ position: "absolute", top: "16px", left: "16px", cursor: "pointer", opacity: 0.7 }}><ChevronRight size={24} /></div>
          <div style={{ display: "flex", gap: "16px", alignItems: "center", marginTop: "10px" }}>
            <div style={{ width: "60px", height: "60px", borderRadius: "16px", background: "#2ecc71", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <User size={30} color="white" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.35rem", fontWeight: "900" }}>{contact.name}</h3>
              <p style={{ margin: "4px 0 0", fontSize: "0.9rem", color: "#aaa", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}>
                <Smartphone size={16} /> {contact.phone}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px", marginTop: "1.5rem" }}>
            <button onClick={() => setActiveTab("timeline")} style={{ flex: 1, padding: "8px", borderRadius: "8px", border: "none", background: activeTab === "timeline" ? "#2ecc71" : "rgba(255,255,255,0.1)", color: "white", fontWeight: "800", cursor: "pointer", fontSize: "0.8rem", transition: "background 0.2s" }}>Timeline</button>
            <button onClick={() => setActiveTab("notes")} style={{ flex: 1, padding: "8px", borderRadius: "8px", border: "none", background: activeTab === "notes" ? "#6366f1" : "rgba(255,255,255,0.1)", color: "white", fontWeight: "800", cursor: "pointer", fontSize: "0.8rem", transition: "background 0.2s" }}>Notes</button>
            <button onClick={() => setActiveTab("alarms")} style={{ flex: 1, padding: "8px", borderRadius: "8px", border: "none", background: activeTab === "alarms" ? "#f59e0b" : "rgba(255,255,255,0.1)", color: "white", fontWeight: "800", cursor: "pointer", fontSize: "0.8rem", transition: "background 0.2s" }}>Alarms</button>
          </div>
        </div>

        {/* Drawer Scrollable Body (Single Unified Scroll Container) */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }} className="chat-scroll">
          
          {/* Associated Accounts section (Always visible) */}
          {contact.accountsData && contact.accountsData.length > 0 && (
            <div style={{ padding: "1.5rem 1.5rem 0.5rem", borderBottom: "1px solid #f1f5f9" }}>
              <h4 style={{ fontSize: "0.85rem", fontWeight: "900", textTransform: "uppercase", color: "#1a1a1a", letterSpacing: "1px", margin: "0 0 1rem 0", display: "flex", alignItems: "center", gap: "10px" }}>
                <MessageSquare size={18} color="#2ecc71" /> Associated Conversations
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "1rem" }}>
                {contact.accountsData.map((acc, index) => {
                  const waba = acc.whatsappAccountId;
                  const wabaName = waba?.name || "WhatsApp Account";
                  const wabaNum = waba?.phoneNumber || waba?.phoneNumberId || "";

                  return (
                    <div key={index} style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 15px",
                      background: "#f8fafc",
                      borderRadius: "12px",
                      border: "1px solid #eef2f6",
                      transition: "transform 0.2s, box-shadow 0.2s"
                    }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: "800", fontSize: "0.88rem", color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {wabaName}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "600", marginTop: "2px" }}>
                          {wabaNum}
                        </div>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "6px" }}>
                          {acc.status && (
                            <span style={{
                              background: acc.status === "failed" || acc.isCampaignFailed ? "#fee2e2" : "#e0f2fe",
                              color: acc.status === "failed" || acc.isCampaignFailed ? "#ef4444" : "#0369a1",
                              padding: "2px 8px",
                              borderRadius: "6px",
                              fontSize: "0.68rem",
                              fontWeight: "800"
                            }}>
                              {acc.status.toUpperCase()}
                            </span>
                          )}
                          {acc.assignedTo?.name && (
                            <span style={{ background: "#e2e8f0", color: "#475569", padding: "2px 8px", borderRadius: "6px", fontSize: "0.68rem", fontWeight: "800" }}>
                              👤 {acc.assignedTo.name}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          const accId = waba?._id || waba;
                          if (acc.conversationId) {
                            navigate(`/chats/${acc.conversationId}`);
                          } else {
                            navigate(`/chats/new:${contact.phone}?accountId=${accId}`);
                          }
                          if (onClose) onClose();
                        }}
                        title="Open chat for this account"
                        style={{
                          background: "rgba(46, 204, 113, 0.1)",
                          border: "none",
                          color: "#2ecc71",
                          width: "36px",
                          height: "36px",
                          borderRadius: "10px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "background 0.2s"
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(46, 204, 113, 0.2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(46, 204, 113, 0.1)'}
                      >
                        <MessageSquare size={18} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab Content (Flowing naturally inside the scroll wrapper) */}
          <div style={{ padding: "1.5rem" }}>
            {activeTab === "timeline" && (
              <>
                <h4 style={{ fontSize: "0.85rem", fontWeight: "900", textTransform: "uppercase", color: "#1a1a1a", letterSpacing: "1px", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "10px" }}>
                  <History size={18} color="#2ecc71" /> Interaction History
                </h4>
                {loadingTimeline ? (
                  <div style={{ textAlign: "center", padding: "40px" }}><Loader2 className="animate-spin" color="#2ecc71" /></div>
                ) : timelineEntries.length === 0 ? (
                  <p style={{ textAlign: "center", color: "#999", padding: "40px", fontWeight: "600" }}>No history found.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    {timelineEntries.map((e, idx) => (
                      <div key={idx} style={{ position: "relative", paddingLeft: "30px", borderLeft: "2px solid #f0f0f0" }}>
                        <div style={{ position: "absolute", left: "-7px", top: "0", width: "12px", height: "12px", borderRadius: "50%", background: e.isCampaign ? "#6366f1" : "#2ecc71", border: "3px solid white" }}></div>
                        <div style={{ fontSize: "0.9rem", fontWeight: "700", color: "#333", whiteSpace: "pre-wrap" }}>{e.content}</div>
                        <div style={{ fontSize: "0.75rem", color: "#999", marginTop: "6px", fontWeight: "600", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                          <span>{new Date(e.timestamp).toLocaleString()}</span>
                          {e.whatsappAccountName && <span style={{ background: e.isCampaign ? "#e0e7ff" : "#f1f5f9", color: e.isCampaign ? "#4338ca" : "#475569", padding: "2px 8px", borderRadius: "8px", fontWeight: "700" }}>📱 {e.whatsappAccountName}</span>}
                          {e.createdBy?.name && <span style={{ color: "#64748b", fontWeight: "700" }}>👤 {e.createdBy.name}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === "notes" && (
              <>
                <h4 style={{ fontSize: "0.85rem", fontWeight: "900", textTransform: "uppercase", color: "#1a1a1a", letterSpacing: "1px", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "10px" }}>
                  <StickyNote size={18} color="#6366f1" /> Internal Notes
                </h4>
                <div style={{ marginBottom: "2rem" }}>
                  <textarea
                    placeholder="Write a private note about this lead..."
                    style={{ width: "100%", height: "80px", padding: "12px", borderRadius: "12px", border: "2px solid #f0f0f0", outline: "none", fontSize: "0.9rem", fontWeight: "600", resize: "none" }}
                    value={noteContent}
                    onChange={e => setNoteContent(e.target.value)}
                  />
                  <button
                    onClick={handleAddNote}
                    disabled={addingNote}
                    style={{ width: "100%", marginTop: "10px", padding: "10px", borderRadius: "10px", background: "#6366f1", color: "white", border: "none", fontWeight: "800", cursor: "pointer" }}
                  >
                    {addingNote ? "Adding..." : "Save Note"}
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                  {contact.internalNotes?.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map((n, i) => (
                    <div key={i} style={{ padding: "15px", background: "#f8fafc", borderRadius: "12px", border: "1px solid #eef2f6" }}>
                      <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: "600", color: "#333" }}>{n.content}</p>
                      <div style={{ marginTop: "10px", fontSize: "0.7rem", color: "#999", fontWeight: "700", display: "flex", justifyContent: "space-between" }}>
                        <span>By {n.createdBy?.name || "User"}</span>
                        <span>{new Date(n.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {activeTab === "alarms" && (
              <>
                <h4 style={{ fontSize: "0.85rem", fontWeight: "900", textTransform: "uppercase", color: "#1a1a1a", letterSpacing: "1px", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "10px" }}>
                  <Bell size={18} color="#f59e0b" /> Follow-up Alarms
                </h4>
                <div style={{ marginBottom: "2rem", background: "#fffbeb", padding: "15px", borderRadius: "15px", border: "1px solid #fef3c7" }}>
                  <input
                    type="text"
                    placeholder="Reminder Title (e.g. Call back)"
                    style={{ width: "100%", padding: "10px", borderRadius: "10px", border: "2px solid #fde68a", outline: "none", fontSize: "0.85rem", fontWeight: "700", marginBottom: "10px" }}
                    value={alarmTitle}
                    onChange={e => setAlarmTitle(e.target.value)}
                  />
                  <input
                    type="datetime-local"
                    style={{ width: "100%", padding: "10px", borderRadius: "10px", border: "2px solid #fde68a", outline: "none", fontSize: "0.85rem", fontWeight: "700", marginBottom: "10px" }}
                    value={alarmTime}
                    onChange={e => setAlarmTime(e.target.value)}
                  />
                  <button
                    onClick={handleAddAlarm}
                    disabled={addingAlarm}
                    style={{ width: "100%", padding: "10px", borderRadius: "10px", background: "#f59e0b", color: "white", border: "none", fontWeight: "900", cursor: "pointer" }}
                  >
                    {addingAlarm ? "Setting..." : "Set Alarm"}
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {contact.reminders?.sort((a, b) => new Date(a.time) - new Date(b.time)).map((r, i) => (
                    <div key={i} style={{ padding: "12px 15px", background: r.isCompleted ? "#f1f5f9" : "white", borderRadius: "12px", border: "2px solid", borderColor: r.isCompleted ? "#e2e8f0" : "#fde68a", display: "flex", alignItems: "center", gap: "12px", opacity: r.isCompleted ? 0.7 : 1 }}>
                      <div onClick={() => toggleReminder(r._id)} style={{ cursor: "pointer", color: r.isCompleted ? "#2ecc71" : "#ccc" }}>
                        <CheckCircle size={24} fill={r.isCompleted ? "#2ecc71" : "none"} color={r.isCompleted ? "white" : "currentColor"} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "0.9rem", fontWeight: "800", color: "#1a1a1a", textDecoration: r.isCompleted ? "line-through" : "none" }}>{r.title}</div>
                        <div style={{ fontSize: "0.75rem", color: "#666", fontWeight: "700", marginTop: "2px" }}>{new Date(r.time).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

        </div>

        {/* Footer Actions (Sticky) */}
        <div style={{ padding: "1.2rem 1.5rem", borderTop: "1px solid #f0f0f0", display: "flex", gap: "12px", background: "white", flexShrink: 0 }}>
          <button
            onClick={() => onOpenChat ? onOpenChat(contact) : navigate(`/chats/${contact.conversationId || `new:${contact.phone}`}`)}
            style={{ flex: 1, padding: "14px", borderRadius: "12px", background: "#2ecc71", color: "white", border: "none", fontWeight: "900", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", boxShadow: "0 4px 12px rgba(46, 204, 113, 0.2)" }}
          >
            <Send size={20} /> Open WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContactDrawer;
