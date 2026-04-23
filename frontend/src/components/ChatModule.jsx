import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Send, User, Search, MoreVertical, MessageSquare, Clock, Calendar, Tag, ChevronDown, CheckCircle2, AlertCircle, FileText, Plus } from "lucide-react";

import { API_BASE } from "../api";

const STATUS_OPTIONS = ["New", "Interested", "Not Interested", "Follow-up", "Closed"];

const ChatModule = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (e, key) => {
    const file = e.target.files[0];
    if (!file) return;
    const uploadData = new FormData();
    uploadData.append("file", file);
    try {
      setIsUploading(true);
      const res = await axios.post(`${API_BASE}/upload`, uploadData, {
        headers: { ...config.headers, "Content-Type": "multipart/form-data" }
      });
      setTemplateVars({ ...templateVars, [key]: res.data.url });
    } catch (err) {
      alert("Upload failed: " + (err.response?.data?.error || err.message));
    } finally {
      setIsUploading(false);
    }
  };
  const [templates, setTemplates] = useState([]);
  const [presets, setPresets] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState("");
  const [executives, setExecutives] = useState([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateVars, setTemplateVars] = useState({});
  const scrollRef = useRef();
  
  const currentUser = JSON.parse(localStorage.getItem("userInfo"));
  const config = { headers: { Authorization: `Bearer ${currentUser?.token}` } };

  const fetchConversations = async () => {
    try {
      const res = await axios.get(`${API_BASE}/conversations`, config);
      setConversations(Array.isArray(res.data) ? res.data : []);
      // Update selected chat data if it's currently open
      if (selectedChat && !selectedChat.isNew) {
        const updated = res.data.find(c => c.phone === selectedChat.phone);
        if (updated) setSelectedChat(updated);
      }
    } catch (err) {
      console.error("Error fetching conversations:", err);
    }
  };

  const fetchMessages = async (phone) => {
    try {
      const res = await axios.get(`${API_BASE}/messages/${phone}`, config);
      setMessages(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching messages:", err);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await axios.get(`${API_BASE}/templates`, config);
      setTemplates(res.data.filter(t => t.status === "APPROVED"));
    } catch (err) {
      console.error("Error fetching templates:", err);
    }
  };

  const fetchExecutives = async () => {
    if (currentUser.role === "Executive") return;
    try {
      const res = await axios.get(`${API_BASE}/users`, config);
      setExecutives(res.data.filter(u => u.role === "Executive" || u.role === "Manager"));
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  };

  useEffect(() => {
    const fetchPresets = async () => {
      try {
        const res = await axios.get(`${API_BASE}/presets`, config);
        setPresets(res.data);
      } catch (err) {
        console.error("Error fetching presets:", err);
      }
    };

    fetchConversations();
    fetchTemplates();
    fetchPresets();
    fetchExecutives();
    const interval = setInterval(fetchConversations, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedChat) {
      fetchMessages(selectedChat.phone);
      const interval = setInterval(() => fetchMessages(selectedChat.phone), 5000);
      return () => clearInterval(interval);
    }
  }, [selectedChat?._id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleAssign = async (userId) => {
    if (!selectedChat) return;
    try {
      await axios.post(`${API_BASE}/conversations/assign`, {
        phone: selectedChat.phone,
        userId: userId || null
      }, config);
      fetchConversations();
    } catch (err) {
      alert("Error assigning conversation");
    }
  };

  const handleNewChat = (e) => {
    e.preventDefault();
    if (!newChatPhone.trim()) return;
    
    const phone = newChatPhone.trim();
    const existing = conversations.find(c => c.phone === phone);
    
    if (existing) {
      setSelectedChat(existing);
    } else {
      setSelectedChat({ phone, status: "New", isNew: true });
      setMessages([]);
    }
    
    setShowNewChatModal(false);
    setNewChatPhone("");
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat) return;

    try {
      const res = await axios.post(`${API_BASE}/messages/send`, {
        to: selectedChat.phone,
        body: newMessage
      }, config);
      
      setMessages([...messages, res.data.message]);
      setNewMessage("");
      
      if (selectedChat.isNew) {
        await fetchConversations();
      } else {
        fetchConversations();
      }
    } catch (err) {
      alert("Error sending message: " + err.message);
    }
  };

  const updateStatus = async (status) => {
    if (!selectedChat) return;
    try {
      await axios.post(`${API_BASE}/conversations/status`, {
        phone: selectedChat.phone,
        status
      });
      fetchConversations();
    } catch (err) {
      alert("Error updating status: " + err.message);
    }
  };

  const handleTemplateSelect = (t) => {
    setSelectedTemplate(t);
    const vars = {};
    t.components.forEach(comp => {
      if (comp.type === "HEADER" && ["IMAGE", "VIDEO", "DOCUMENT"].includes(comp.format)) {
        vars[`HEADER_${comp.format}`] = "";
      }
      const matches = (comp.text || "").match(/{{(\d+)}}/g);
      if (matches) {
        matches.forEach(m => {
          const num = m.replace(/{{|}}/g, "");
          vars[`${comp.type}_${num}`] = "";
        });
      }
    });
    setTemplateVars(vars);
  };

  const handlePresetSelect = (pId) => {
    const preset = presets.find(p => p._id === pId);
    if (!preset) return;
    
    setSelectedPreset(pId);
    setSelectedTemplate(preset.template);
    setTemplateVars(preset.config || {});
  };

  const sendTemplate = async () => {
    if (!selectedTemplate || !selectedChat) return;

    const templateComponents = [];
    const bodyParams = [];
    const headerParams = [];

    Object.entries(templateVars).forEach(([key, val]) => {
      if (key.startsWith("BODY_")) bodyParams.push({ type: "text", text: val });
      else if (key.startsWith("HEADER_")) {
        if (["IMAGE", "VIDEO", "DOCUMENT"].some(type => key.includes(type))) {
          const type = key.split("_")[1].toLowerCase();
          headerParams.push({ type, [type]: { link: val } });
        } else {
          headerParams.push({ type: "text", text: val });
        }
      }
    });

    if (headerParams.length > 0) templateComponents.push({ type: "header", parameters: headerParams });
    if (bodyParams.length > 0) templateComponents.push({ type: "body", parameters: bodyParams });

    try {
      const res = await axios.post(`${API_BASE}/messages/send-template`, {
        to: selectedChat.phone,
        templateName: selectedTemplate.name,
        templateComponents
      }, config);
      setMessages([...messages, res.data.message]);
      setShowTemplateModal(false);
      setSelectedTemplate(null);
      fetchConversations();
    } catch (err) {
      alert("Error sending template: " + err.message);
    }
  };

  const groupMessagesByDate = (msgs) => {
    const groups = {};
    msgs.forEach(msg => {
      const date = new Date(msg.timestamp).toLocaleDateString();
      if (!groups[date]) groups[date] = [];
      groups[date].push(msg);
    });
    return groups;
  };

  const formatDateLabel = (dateStr) => {
    const today = new Date().toLocaleDateString();
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString();
    if (dateStr === today) return "Today";
    if (dateStr === yesterday) return "Yesterday";
    return dateStr;
  };

  const messageGroups = groupMessagesByDate(messages);

  const getStatusColor = (status) => {
    switch (status) {
      case "Interested": return "#25d366";
      case "Not Interested": return "#ff4757";
      case "Follow-up": return "#f1c40f";
      case "Closed": return "#94a3b8";
      default: return "#3498db";
    }
  };

  return (
    <div className="chat-container glass-card" style={{ 
      display: "grid", 
      gridTemplateColumns: "350px 1fr", 
      height: "calc(100vh - 140px)", 
      padding: 0, 
      overflow: "hidden",
      marginTop: "10px"
    }}>
      <style>{`
        .chat-scroll::-webkit-scrollbar { width: 6px; }
        .chat-scroll::-webkit-scrollbar-track { background: transparent; }
        .chat-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); borderRadius: 10px; }
        .chat-scroll::-webkit-scrollbar-thumb:hover { background: var(--accent-primary); }
      `}</style>

      {/* Sidebar */}
      <div style={{ borderRight: "1px solid var(--glass-border)", display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ padding: "1.5rem", borderBottom: "1px solid var(--glass-border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ margin: 0 }}>Conversations</h3>
            <button 
              onClick={() => setShowNewChatModal(true)}
              style={{ background: "var(--accent-primary)", border: "none", color: "black", width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              <Plus size={20} />
            </button>
          </div>
          <div className="search-bar" style={{ position: "relative" }}>
            <Search size={18} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
            <input 
              type="text" 
              placeholder="Search chat..." 
              style={{ width: "100%", padding: "10px 10px 10px 35px", background: "var(--bg-tertiary)", border: "1px solid var(--glass-border)", color: "white", borderRadius: "10px" }}
            />
          </div>
        </div>
        
        <div className="chat-scroll" style={{ flex: 1, overflowY: "auto" }}>
          {conversations.map((chat) => (
            <div 
              key={chat._id} 
              onClick={() => setSelectedChat(chat)}
              style={{ 
                padding: "1rem 1.5rem", 
                cursor: "pointer", 
                background: selectedChat?._id === chat._id || selectedChat?.phone === chat.phone ? "rgba(255,255,255,0.05)" : "transparent",
                borderBottom: "1px solid rgba(255,255,255,0.02)",
                transition: "all 0.2s"
              }}
            >
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <div style={{ position: "relative" }}>
                  <div style={{ width: "45px", height: "45px", borderRadius: "50%", background: "var(--accent-primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "black" }}>
                    <User size={24} />
                  </div>
                  <div style={{ position: "absolute", bottom: 0, right: 0, width: "12px", height: "12px", borderRadius: "50%", background: getStatusColor(chat.status), border: "2px solid var(--bg-secondary)" }}></div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <span style={{ fontWeight: "700", fontSize: "0.9rem" }}>{chat.contact?.name || chat.phone}</span>
                    <span style={{ fontSize: "0.65rem", color: "var(--text-secondary)" }}>{new Date(chat.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "150px" }}>{chat.lastMessage}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      {chat.unreadCount > 0 && (
                        <span style={{ background: "var(--accent-primary)", color: "black", width: "16px", height: "16px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", fontWeight: "700" }}>{chat.unreadCount}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div style={{ display: "flex", flexDirection: "column", background: "rgba(0,0,0,0.2)", height: "100%", overflow: "hidden" }}>
        {selectedChat ? (
          <>
            <div style={{ padding: "0.8rem 2rem", borderBottom: "1px solid var(--glass-border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-secondary)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "var(--accent-secondary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <User size={20} />
                </div>
                <div>
                  <h4 style={{ fontSize: "0.95rem" }}>{selectedChat.contact?.name || selectedChat.phone}</h4>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#25d366" }}></div>
                      <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>Online</span>
                    </div>
                    <div style={{ height: "12px", width: "1px", background: "var(--glass-border)" }}></div>
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <Tag size={12} color={getStatusColor(selectedChat.status)} />
                      <select 
                        value={selectedChat.status || "New"} 
                        onChange={async (e) => {
                          try {
                            await axios.post(`${API_BASE}/conversations/status`, { phone: selectedChat.phone, status: e.target.value }, config);
                            fetchConversations();
                          } catch (err) {
                            alert("Error updating status");
                          }
                        }}
                        style={{ background: "transparent", border: "none", color: "var(--text-secondary)", fontSize: "0.75rem", outline: "none", cursor: "pointer" }}
                      >
                        {STATUS_OPTIONS.map(s => <option key={s} value={s} style={{ background: "var(--bg-secondary)" }}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
                {currentUser.role !== "Executive" && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Assign to:</span>
                    <select 
                      style={{ background: "var(--bg-tertiary)", border: "1px solid var(--glass-border)", color: "white", padding: "4px 8px", borderRadius: "6px", fontSize: "0.75rem" }}
                      value={selectedChat.assignedTo?._id || ""}
                      onChange={(e) => handleAssign(e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {executives.map(u => (
                        <option key={u._id} value={u._id}>{u.name} ({u.role})</option>
                      ))}
                    </select>
                  </div>
                )}
                <button onClick={() => setShowTemplateModal(true)} style={{ background: "rgba(37, 211, 102, 0.1)", border: "1px solid var(--accent-primary)", color: "var(--accent-primary)", padding: "6px 12px", borderRadius: "20px", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "5px", cursor: "pointer" }}>
                  <FileText size={14} /> Send Template
                </button>
                <MoreVertical size={20} style={{ cursor: "pointer", color: "var(--text-secondary)" }} />
              </div>
            </div>

            <div 
              ref={scrollRef}
              className="chat-scroll"
              style={{ flex: 1, padding: "1.5rem 2.5rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: "1.5rem" }}
            >
              {Object.entries(messageGroups).map(([date, msgs]) => (
                <div key={date} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "center", margin: "1rem 0" }}>
                    <div style={{ background: "var(--bg-tertiary)", padding: "4px 15px", borderRadius: "10px", fontSize: "0.65rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "5px", border: "1px solid var(--glass-border)" }}>
                      <Calendar size={12} /> {formatDateLabel(date)}
                    </div>
                  </div>
                  {msgs.map((msg) => (
                    <div 
                      key={msg._id} 
                      style={{ 
                        alignSelf: msg.direction === "outbound" ? "flex-end" : "flex-start",
                        maxWidth: "75%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: msg.direction === "outbound" ? "flex-end" : "flex-start"
                      }}
                    >
                      <div style={{ 
                        padding: "10px 16px", 
                        borderRadius: msg.direction === "outbound" ? "15px 15px 0 15px" : "15px 15px 15px 0",
                        background: msg.direction === "outbound" ? "linear-gradient(135deg, #25d366, #128c7e)" : "var(--bg-tertiary)",
                        color: msg.direction === "outbound" ? "black" : "white",
                        fontSize: "0.9rem",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                        lineHeight: "1.4"
                      }}>
                        {msg.body}
                        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "4px", marginTop: "4px", opacity: 0.7 }}>
                          <span style={{ fontSize: "0.6rem" }}>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {msg.direction === "outbound" && <Clock size={10} />}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <form onSubmit={handleSend} style={{ padding: "1.2rem 2rem", background: "var(--bg-secondary)", borderTop: "1px solid var(--glass-border)" }}>
              <div style={{ display: "flex", gap: "1rem" }}>
                <input 
                  type="text" 
                  placeholder="Type a message..." 
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  style={{ flex: 1, padding: "12px 20px", background: "var(--bg-tertiary)", border: "1px solid var(--glass-border)", color: "white", borderRadius: "30px", outline: "none", fontSize: "0.9rem" }}
                />
                <button type="submit" className="btn-primary" style={{ width: "45px", height: "45px", borderRadius: "50%", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Send size={18} />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}>
            <div style={{ width: "100px", height: "100px", borderRadius: "50%", background: "rgba(255,255,255,0.02)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.5rem" }}>
              <MessageSquare size={48} style={{ opacity: 0.2 }} />
            </div>
            <h3>Select a conversation</h3>
            <p style={{ marginTop: "0.5rem" }}>Connect with your leads in real-time.</p>
          </div>
        )}
      </div>

      {/* Template Modal */}
      {showTemplateModal && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="glass-card" style={{ width: "500px", maxHeight: "80vh", overflowY: "auto", padding: "2rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}>
              <h3 style={{ marginBottom: "1.5rem" }}>Send Template Message</h3>
              <button onClick={() => setShowTemplateModal(false)} style={{ background: "transparent", border: "none", color: "white", cursor: "pointer" }}>X</button>
            </div>
            
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Quick Presets (Auto-fill)</label>
              <select 
                style={{ width: "100%", padding: "12px", background: "rgba(37, 211, 102, 0.1)", border: "1px solid var(--accent-primary)", color: "white", borderRadius: "10px", marginTop: "5px" }}
                onChange={(e) => handlePresetSelect(e.target.value)}
                value={selectedPreset}
              >
                <option value="">-- Choose a Saved Preset --</option>
                {presets.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </div>

            <div style={{ textAlign: "center", margin: "10px 0", fontSize: "0.7rem", color: "var(--text-secondary)" }}>- OR SELECT RAW TEMPLATE -</div>

            <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Meta Template</label>
            <select 
              style={{ width: "100%", padding: "12px", background: "var(--bg-tertiary)", border: "1px solid var(--glass-border)", color: "white", borderRadius: "10px", marginTop: "5px", marginBottom: "1.5rem" }}
              onChange={(e) => {
                handleTemplateSelect(templates.find(t => t.name === e.target.value));
                setSelectedPreset("");
              }}
              value={selectedTemplate?.name || ""}
            >
              <option value="">-- Select Template --</option>
              {templates.map(t => <option key={t._id} value={t.name}>{t.name}</option>)}
            </select>

            {selectedTemplate && (
              <div style={{ marginBottom: "1.5rem" }}>
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>Variables detected:</p>
                {Object.keys(templateVars).map(key => {
                  const isMedia = ["IMAGE", "VIDEO", "DOCUMENT"].some(type => key.includes(type));
                  const label = isMedia ? `${key.split("_")[1]} URL` : `${key.split("_")[0]} Variable ${key.split("_")[1]}`;
                  const placeholder = isMedia ? `https://example.com/${key.split("_")[1].toLowerCase()}.jpg` : `Value for {{${key.split("_")[1]}}}`;
                  
                  return (
                    <div key={key} style={{ marginBottom: "10px" }}>
                      <label style={{ fontSize: "0.75rem", color: "var(--accent-primary)" }}>{label}</label>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <input 
                          type="text" 
                          style={{ flex: 1, padding: "10px", background: "var(--bg-secondary)", border: "1px solid var(--glass-border)", color: "white", borderRadius: "8px", marginTop: "4px" }}
                          value={templateVars[key]}
                          onChange={(e) => setTemplateVars({...templateVars, [key]: e.target.value})}
                          placeholder={placeholder}
                        />
                        {isMedia && (
                          <>
                            <input type="file" id={`chat-upload-${key}`} style={{ display: "none" }} onChange={(e) => handleFileUpload(e, key)} accept="image/*,video/*,application/pdf" />
                            <button 
                              onClick={() => document.getElementById(`chat-upload-${key}`).click()}
                              disabled={isUploading}
                              style={{ marginTop: "4px", padding: "0 15px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--glass-border)", color: "white", borderRadius: "8px", fontSize: "0.7rem", cursor: "pointer" }}
                            >
                              {isUploading ? "..." : "Upload"}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <button 
              onClick={sendTemplate} 
              disabled={!selectedTemplate}
              className="btn-primary" 
              style={{ width: "100%", padding: "12px", opacity: selectedTemplate ? 1 : 0.5 }}
            >
              Send Template Message
            </button>
          </div>
        </div>
      )}
      {/* New Chat Modal */}
      {showNewChatModal && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="glass-card" style={{ width: "400px", padding: "2rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}>
              <h3>Start New Chat</h3>
              <button onClick={() => setShowNewChatModal(false)} style={{ background: "transparent", border: "none", color: "white", cursor: "pointer" }}>X</button>
            </div>
            <form onSubmit={handleNewChat}>
              <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Phone Number (with country code)</label>
              <input 
                type="text" 
                placeholder="e.g. 919801017333"
                style={{ width: "100%", padding: "12px", background: "var(--bg-tertiary)", border: "1px solid var(--glass-border)", color: "white", borderRadius: "10px", marginTop: "5px", marginBottom: "1.5rem" }}
                value={newChatPhone}
                onChange={(e) => setNewChatPhone(e.target.value)}
                required
              />
              <button type="submit" className="btn-primary" style={{ width: "100%", padding: "12px" }}>
                Start Chatting
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatModule;
