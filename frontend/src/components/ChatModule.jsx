import React, { useState, useEffect, useRef, useMemo } from "react";
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
  const [prevMsgCount, setPrevMsgCount] = useState(0);

  const currentUser = JSON.parse(localStorage.getItem("userInfo"));
  const config = { headers: { Authorization: `Bearer ${currentUser?.token}` } };

  useEffect(() => {
    if (scrollRef.current && messages.length > prevMsgCount) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 150;
      
      // Scroll to bottom ONLY if it's the first load of THIS chat or user is already at bottom
      if (prevMsgCount === 0 || isAtBottom) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
      setPrevMsgCount(messages.length);
    }
  }, [messages, prevMsgCount]);

  // Only reset scroll tracking when we switch to a DIFFERENT phone number
  useEffect(() => {
    setPrevMsgCount(0);
  }, [selectedChat?.phone]);

  const fetchMessages = async (phone) => {
    try {
      const res = await axios.get(`${API_BASE}/messages/${phone}`, config);
      const newMsgs = Array.isArray(res.data) ? res.data : [];
      setMessages(prev => {
        if (prev.length === newMsgs.length && JSON.stringify(prev[prev.length-1]) === JSON.stringify(newMsgs[newMsgs.length-1])) {
          return prev; // No change, don't trigger re-render
        }
        return newMsgs;
      });
    } catch (err) {
      console.error("Error fetching messages:", err);
    }
  };

  const fetchConversations = async () => {
    try {
      const res = await axios.get(`${API_BASE}/conversations`, config);
      const newData = Array.isArray(res.data) ? res.data : [];
      setConversations(prev => {
        if (JSON.stringify(prev) === JSON.stringify(newData)) return prev;
        return newData;
      });
      
      // Only update selected chat if data changed
      if (selectedChat && !selectedChat.isNew) {
        const updated = newData.find(c => c.phone === selectedChat.phone);
        if (updated && JSON.stringify(updated) !== JSON.stringify(selectedChat)) {
          setSelectedChat(updated);
        }
      }
    } catch (err) {
      console.error("Error fetching conversations:", err);
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

  const messageGroups = useMemo(() => groupMessagesByDate(messages), [messages]);

  const getStatusColor = (status) => {
    switch (status) {
      case "Interested": return "#25d366";
      case "Not Interested": return "#ff4757";
      case "Follow-up": return "#f1c40f";
      case "Closed": return "#94a3b8";
      default: return "#3498db";
    }
  };

  const [searchTerm, setSearchTerm] = useState("");

  const filteredConversations = conversations.filter(c => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    const phoneMatch = c.phone.includes(term);
    const nameMatch = c.contact?.name?.toLowerCase().includes(term);
    return phoneMatch || nameMatch;
  });

  return (
    <div className="chat-container glass-card" style={{
      display: "grid",
      gridTemplateColumns: "350px 1fr",
      height: "600px",
      width: "100%",
      maxWidth: "1250px",
      margin: "20px 0",
      padding: 0,
      overflow: "hidden",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "12px",
      background: "#111b21",
      boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
      position: "relative"
    }}>
      <style>{`
        .chat-scroll::-webkit-scrollbar { width: 12px !important; }
        .chat-scroll::-webkit-scrollbar-track { background: #111b21 !important; }
        .chat-scroll::-webkit-scrollbar-thumb { background: #ffffff !important; border-radius: 6px; border: 2px solid #111b21; }
        .chat-scroll::-webkit-scrollbar-thumb:hover { background: #00a884 !important; }
        
        .chat-scroll {
          overflow-y: scroll !important;
          scrollbar-width: auto;
          scrollbar-color: #ffffff #111b21;
        }
        
        .chat-item:hover { background: #202c33 !important; }
        .chat-item.active { background: #2a3942 !important; border-left: 4px solid #00a884 !important; }
        
        .msg-bubble {
          max-width: 65%;
          padding: 8px 12px;
          font-size: 0.9rem;
          margin-bottom: 4px;
          line-height: 1.4;
          box-shadow: 0 1px 0.5px rgba(0,0,0,0.13);
          position: relative;
        }
        
        .msg-outbound {
          align-self: flex-end !important;
          background-color: #005c4b !important;
          color: #e9edef !important;
          border-radius: 8px 0 8px 8px;
        }
        
        .msg-inbound {
          align-self: flex-start !important;
          background-color: #202c33 !important;
          color: #e9edef !important;
          border-radius: 0 8px 8px 8px;
        }

        .sidebar-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          border-right: 1px solid rgba(255,255,255,0.1);
          background: #111b21;
        }

        .chat-area-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #0b141a;
          position: relative;
        }
      `}</style>

      {/* Sidebar */}
      <div className="sidebar-container" style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "12px", background: "#202c33", flexShrink: 0, height: "110px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#e9edef" }}>Chats</h3>
            <div style={{ display: "flex", gap: "15px", color: "#aebac1" }}>
              <Plus size={20} cursor="pointer" onClick={() => setShowNewChatModal(true)} />
              <MoreVertical size={20} cursor="pointer" />
            </div>
          </div>
          <div style={{ position: "relative" }}>
            <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#8696a0" }} />
            <input
              type="text"
              placeholder="Search or start new chat"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: "100%", padding: "8px 12px 8px 40px", background: "#2a3942", border: "none", color: "#d1d7db", borderRadius: "8px", fontSize: "0.85rem", outline: "none" }}
            />
          </div>
        </div>

        <div className="chat-scroll" style={{ height: "calc(100% - 110px)", overflowY: "scroll", overflowX: "hidden", display: "block" }}>
          {filteredConversations.map((chat) => (
            <div
              key={chat._id}
              className={`chat-item ${(selectedChat?._id === chat._id || selectedChat?.phone === chat.phone) ? "active" : ""}`}
              onClick={() => setSelectedChat(chat)}
              style={{ padding: "10px 16px", cursor: "pointer", display: "flex", gap: "12px", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
            >
              <div style={{ width: "45px", height: "45px", borderRadius: "50%", background: "#4f5e67", display: "flex", alignItems: "center", justifyContent: "center", color: "#dfe5e7" }}>
                <User size={24} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                  <span style={{ fontWeight: "600", color: "#e9edef", fontSize: "0.95rem" }}>{chat.contact?.name || chat.phone}</span>
                  <span style={{ fontSize: "0.7rem", color: "#8696a0" }}>{chat.lastMessageTime ? new Date(chat.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}</span>
                </div>
                <p style={{ fontSize: "0.8rem", color: "#8696a0", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {chat.lastMessage || "No messages"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="chat-area-container" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        {selectedChat ? (
          <>
            <div style={{ padding: "10px 16px", background: "#202c33", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 10, flexShrink: 0, height: "60px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "35px", height: "35px", borderRadius: "50%", background: "#4f5e67", display: "flex", alignItems: "center", justifyContent: "center", color: "#dfe5e7" }}>
                  <User size={20} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: "0.95rem", color: "#e9edef" }}>{selectedChat.contact?.name || selectedChat.phone}</h4>
                  <span style={{ fontSize: "0.7rem", color: "#8696a0" }}>Online</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                {/* Assignment Dropdown */}
                {currentUser.role !== "Executive" && (
                  <select 
                    style={{ background: "#2a3942", color: "#dfe5e7", border: "1px solid #3b4a54", padding: "6px 10px", borderRadius: "8px", fontSize: "0.75rem", outline: "none" }}
                    value={selectedChat.assignedTo?._id || selectedChat.assignedTo || ""}
                    onChange={(e) => handleAssign(e.target.value)}
                  >
                    <option value="">Assign To...</option>
                    {executives.map(ex => (
                      <option key={ex._id} value={ex._id}>{ex.name}</option>
                    ))}
                  </select>
                )}

                {/* Status Dropdown */}
                <select 
                  style={{ background: getStatusColor(selectedChat.status), color: "#111b21", border: "none", padding: "6px 10px", borderRadius: "8px", fontSize: "0.75rem", fontWeight: "600", outline: "none" }}
                  value={selectedChat.status || "New"}
                  onChange={(e) => handleUpdateStatus(e.target.value)}
                >
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>

                <button onClick={() => setShowTemplateModal(true)} style={{ background: "#00a884", border: "none", color: "#111b21", padding: "6px 12px", borderRadius: "8px", fontSize: "0.75rem", fontWeight: "600", cursor: "pointer" }}>
                  Send Template
                </button>
                <MoreVertical size={20} style={{ color: "#aebac1", cursor: "pointer" }} />
              </div>
            </div>

            <div 
              ref={scrollRef}
              className="chat-scroll"
              style={{ height: "calc(100% - 120px)", padding: "20px", overflowY: "scroll", display: "flex", flexDirection: "column", background: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')", backgroundBlendMode: "soft-light", backgroundColor: "#0b141a" }}
            >
              {Object.entries(messageGroups).map(([date, msgs]) => (
                <div key={date} style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", justifyContent: "center", margin: "15px 0" }}>
                    <div style={{ background: "#182229", padding: "4px 10px", borderRadius: "6px", fontSize: "0.7rem", color: "#8696a0" }}>
                      {formatDateLabel(date)}
                    </div>
                  </div>
                  {msgs.map((msg) => (
                    <div
                      key={msg._id}
                      className={`msg-bubble ${msg.direction === "outbound" ? "msg-outbound" : "msg-inbound"}`}
                    >
                      {msg.type === "template" && msg.templateData ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {/* Image rendering if available */}
                          {msg.templateData.components.find(c => c.type === "header")?.parameters?.[0]?.image?.link && (
                            <img 
                              src={msg.templateData.components.find(c => c.type === "header")?.parameters?.[0]?.image?.link} 
                              alt="Template" 
                              style={{ width: "100%", borderRadius: "8px", maxHeight: "180px", objectFit: "cover", marginBottom: "5px" }} 
                            />
                          )}
                          
                          <div style={{ whiteSpace: "pre-wrap", fontSize: "0.9rem" }}>
                            {/* Reconstructing template body text if possible, else showing fallback */}
                            {(() => {
                              const template = templates.find(t => t.name === msg.templateData.name);
                              let text = template?.components.find(c => c.type === "BODY")?.text || msg.body;
                              const params = msg.templateData.components.find(c => c.type === "body")?.parameters || [];
                              params.forEach((p, i) => {
                                text = text.replace(`{{${i+1}}}`, p.text || "");
                              });
                              return text;
                            })()}
                          </div>

                          {/* Rendering Buttons from the template structure in DB */}
                          {templates.find(t => t.name === msg.templateData.name)?.components.find(c => c.type === "BUTTONS")?.buttons?.map((btn, i) => (
                            <div key={i} style={{ padding: "8px", background: "rgba(255,255,255,0.05)", borderRadius: "6px", textAlign: "center", fontSize: "0.75rem", border: "1px solid rgba(255,255,255,0.1)", marginTop: "2px", color: "#53bdeb" }}>
                              {btn.text}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ whiteSpace: "pre-wrap" }}>{msg.body}</div>
                      )}

                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "2px", gap: "4px" }}>
                        <span style={{ fontSize: "0.6rem", opacity: 0.6 }}>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {msg.direction === "outbound" && <CheckCircle2 size={10} style={{ color: "#53bdeb" }} />}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <form onSubmit={handleSend} style={{ padding: "10px 16px", background: "#202c33", display: "flex", gap: "10px" }}>
              <input
                type="text"
                placeholder="Type a message"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                style={{ flex: 1, padding: "8px 12px", background: "#2a3942", border: "none", color: "#d1d7db", borderRadius: "8px", outline: "none" }}
              />
              <button type="submit" style={{ background: "transparent", border: "none", color: "#00a884", cursor: "pointer" }}>
                <Send size={24} />
              </button>
            </form>
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#8696a0", background: "#222e35" }}>
            <div style={{ width: "250px", height: "250px", borderRadius: "50%", background: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "2rem" }}>
              <MessageSquare size={100} style={{ opacity: 0.1 }} />
            </div>
            <h2 style={{ color: "#e9edef", fontWeight: "300" }}>WhatsApp for Business</h2>
            <p style={{ maxWidth: "400px", textAlign: "center", lineHeight: "1.6", fontSize: "0.9rem" }}>
              Send and receive messages without keeping your phone online.<br />
              Use WhatsApp on up to 4 linked devices and 1 phone at the same time.
            </p>
            <div style={{ marginTop: "auto", paddingBottom: "2rem", display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8rem" }}>
              <Clock size={14} /> End-to-end encrypted
            </div>
          </div>
        )}
      </div>

      {/* Modals remain same but with better styling */}
      {showTemplateModal && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(11, 20, 26, 0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#222e35", width: "550px", maxHeight: "90vh", overflowY: "auto", borderRadius: "12px", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
            <div style={{ padding: "20px 24px", background: "#202c33", display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: "12px 12px 0 0" }}>
              <h3 style={{ margin: 0, color: "#e9edef" }}>Send Template Message</h3>
              <button onClick={() => setShowTemplateModal(false)} style={{ background: "transparent", border: "none", color: "#aebac1", cursor: "pointer", fontSize: "1.2rem" }}>✕</button>
            </div>

            <div style={{ padding: "24px" }}>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ fontSize: "0.85rem", color: "#00a884", display: "block", marginBottom: "8px" }}>Quick Presets (Auto-fill)</label>
                <select
                  style={{ width: "100%", padding: "12px", background: "#2a3942", border: "1px solid #3b4a54", color: "#d1d7db", borderRadius: "8px", outline: "none" }}
                  onChange={(e) => handlePresetSelect(e.target.value)}
                  value={selectedPreset}
                >
                  <option value="">-- Choose a Saved Preset --</option>
                  {presets.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
              </div>

              <div style={{ textAlign: "center", margin: "20px 0", fontSize: "0.75rem", color: "#8696a0", position: "relative" }}>
                <span style={{ background: "#222e35", padding: "0 10px", position: "relative", zIndex: 1 }}>OR SELECT RAW TEMPLATE</span>
                <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: "1px", background: "#3b4a54" }}></div>
              </div>

              <div style={{ marginBottom: "24px" }}>
                <label style={{ fontSize: "0.85rem", color: "#8696a0", display: "block", marginBottom: "8px" }}>Meta Template</label>
                <select
                  style={{ width: "100%", padding: "12px", background: "#2a3942", border: "1px solid #3b4a54", color: "#d1d7db", borderRadius: "8px", outline: "none" }}
                  onChange={(e) => {
                    handleTemplateSelect(templates.find(t => t.name === e.target.value));
                    setSelectedPreset("");
                  }}
                  value={selectedTemplate?.name || ""}
                >
                  <option value="">-- Select Template --</option>
                  {templates.map(t => <option key={t._id} value={t.name}>{t.name}</option>)}
                </select>
              </div>

              {selectedTemplate && (
                <div style={{ background: "#182229", padding: "16px", borderRadius: "8px", marginBottom: "24px" }}>
                  <p style={{ fontSize: "0.85rem", color: "#00a884", marginBottom: "15px", fontWeight: "600" }}>Customize Variables:</p>
                  {Object.keys(templateVars).map(key => {
                    const isMedia = ["IMAGE", "VIDEO", "DOCUMENT"].some(type => key.includes(type));
                    const label = isMedia ? `${key.split("_")[1]} URL` : `${key.split("_")[0]} {{${key.split("_")[1]}}}`;

                    return (
                      <div key={key} style={{ marginBottom: "15px" }}>
                        <label style={{ fontSize: "0.75rem", color: "#8696a0" }}>{label}</label>
                        <div style={{ display: "flex", gap: "10px", marginTop: "5px" }}>
                          <input
                            type="text"
                            style={{ flex: 1, padding: "10px", background: "#2a3942", border: "1px solid #3b4a54", color: "#d1d7db", borderRadius: "6px", outline: "none", fontSize: "0.85rem" }}
                            value={templateVars[key]}
                            onChange={(e) => setTemplateVars({ ...templateVars, [key]: e.target.value })}
                            placeholder={isMedia ? "https://..." : "Enter text..."}
                          />
                          {isMedia && (
                            <>
                              <input type="file" id={`chat-upload-${key}`} style={{ display: "none" }} onChange={(e) => handleFileUpload(e, key)} />
                              <button
                                onClick={() => document.getElementById(`chat-upload-${key}`).click()}
                                disabled={isUploading}
                                style={{ padding: "0 15px", background: "#3b4a54", border: "none", color: "#e9edef", borderRadius: "6px", fontSize: "0.75rem", cursor: "pointer" }}
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
                style={{
                  width: "100%",
                  padding: "14px",
                  background: selectedTemplate ? "#00a884" : "#3b4a54",
                  color: "#111b21",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: "700",
                  cursor: selectedTemplate ? "pointer" : "not-allowed",
                  fontSize: "1rem"
                }}
              >
                Send Template
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewChatModal && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(11, 20, 26, 0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#222e35", width: "400px", borderRadius: "12px", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
            <div style={{ padding: "20px 24px", background: "#202c33", display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: "12px 12px 0 0" }}>
              <h3 style={{ margin: 0, color: "#e9edef" }}>New Chat</h3>
              <button onClick={() => setShowNewChatModal(false)} style={{ background: "transparent", border: "none", color: "#aebac1", cursor: "pointer", fontSize: "1.2rem" }}>✕</button>
            </div>
            <form onSubmit={handleNewChat} style={{ padding: "24px" }}>
              <label style={{ fontSize: "0.85rem", color: "#8696a0", display: "block", marginBottom: "8px" }}>Phone Number (with country code)</label>
              <input
                type="text"
                placeholder="e.g. 919801017333"
                style={{ width: "100%", padding: "12px", background: "#2a3942", border: "1px solid #3b4a54", color: "#d1d7db", borderRadius: "8px", outline: "none", marginBottom: "20px" }}
                value={newChatPhone}
                onChange={(e) => setNewChatPhone(e.target.value)}
                autoFocus
                required
              />
              <button type="submit" style={{ width: "100%", padding: "12px", background: "#00a884", color: "#111b21", border: "none", borderRadius: "8px", fontWeight: "700", cursor: "pointer" }}>
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

