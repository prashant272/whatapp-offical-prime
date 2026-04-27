import React, { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import { Send, User, Search, MoreVertical, MessageSquare, Clock, Calendar, Tag, ChevronDown, Check, AlertCircle, FileText, Plus, Paperclip, Loader2 } from "lucide-react";
import { io } from "socket.io-client";

import { useParams, useNavigate } from "react-router-dom";
import api, { API_BASE } from "../api";
import { useWhatsAppAccount } from "../WhatsAppAccountContext";

const STATUS_OPTIONS = ["New", "Interested", "Not Interested", "Follow-up", "Closed"];

const ChatModule = () => {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { accounts, activeAccount, switchAccount } = useWhatsAppAccount();
  const [conversations, setConversations] = useState([]);
  const [convPage, setConvPage] = useState(1);
  const [hasMoreConvs, setHasMoreConvs] = useState(true);
  const [isFetchingConvs, setIsFetchingConvs] = useState(false);

  const [messages, setMessages] = useState([]);
  const [msgPage, setMsgPage] = useState(1);
  const [hasMoreMsgs, setHasMoreMsgs] = useState(true);
  const [isFetchingMsgs, setIsFetchingMsgs] = useState(false);

  // Derived active chat for perfect real-time sync
  const selectedChat = useMemo(() => {
    if (!chatId) return null;
    if (chatId.startsWith("new:")) {
      const phone = chatId.split(":")[1];
      return { phone, status: "New", isNew: true, whatsappAccountId: activeAccount?._id };
    }
    const chat = conversations.find(c => c._id === chatId);
    if (chat && !chat.whatsappAccountId) {
      // Fallback for legacy chats
      chat.whatsappAccountId = activeAccount?._id;
    }
    return chat;
  }, [chatId, conversations, activeAccount]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
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
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [windowTimeLeft, setWindowTimeLeft] = useState(null);

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

  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const fetchMessages = async (phone, page = 1) => {
    try {
      if (page === 1) setLoading(true);
      // Pass the specific account ID for this chat to ensure we get the right messages
      const res = await api.get(`/messages/${phone}?page=${page}&limit=50`, {
        headers: { "x-whatsapp-account-id": selectedChat?.whatsappAccountId }
      });
      const newMsgs = res.data.messages || [];
      
      if (page === 1) {
        setMessages(newMsgs);
        setMsgPage(1);
      } else {
        setMessages(prev => [...newMsgs, ...prev]);
      }
      setHasMoreMsgs(res.data.hasMore);
    } catch (err) {
      console.error("Error fetching messages:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMoreMessages = async () => {
    if (!hasMoreMsgs || isFetchingMsgs || !selectedChat) return;
    setIsFetchingMsgs(true);
    const nextPage = msgPage + 1;
    await fetchMessages(selectedChat.phone, nextPage);
    setMsgPage(nextPage);
    setIsFetchingMsgs(false);
  };

  const fetchConversations = async (page = 1) => {
    try {
      const res = await api.get(`/conversations?page=${page}&limit=50`);
      const newData = res.data.conversations || [];
      
      if (page === 1) {
        setConversations(newData);
        setConvPage(1);
      } else {
        setConversations(prev => [...prev, ...newData]);
      }
      setHasMoreConvs(res.data.hasMore);
      // We no longer need to manually update selectedChat because it's derived from conversations
    } catch (err) {
      console.error("Error fetching conversations:", err);
    }
  };

  const fetchMoreConversations = async () => {
    if (!hasMoreConvs || isFetchingConvs) return;
    setIsFetchingConvs(true);
    const nextPage = convPage + 1;
    await fetchConversations(nextPage);
    setConvPage(nextPage);
    setIsFetchingConvs(false);
  };

  const handleSidebarScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    // Trigger when user is within 200px of bottom
    if (scrollHeight - scrollTop - clientHeight < 200 && !isFetchingConvs && hasMoreConvs) {
      fetchMoreConversations();
    }
  };

  const handleMessageScroll = (e) => {
    if (e.target.scrollTop === 0 && hasMoreMsgs && !isFetchingMsgs) {
      const oldScrollHeight = e.target.scrollHeight;
      fetchMoreMessages().then(() => {
        // Maintain scroll position after loading more
        setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight - oldScrollHeight;
          }
        }, 100);
      });
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await api.get("/templates");
      setTemplates(res.data.filter(t => t.status === "APPROVED"));
    } catch (err) {
      console.error("Error fetching templates:", err);
    }
  };

  // Sync active chat state with ref for socket
  const selectedChatRef = useRef(selectedChat);
  useEffect(() => {
    selectedChatRef.current = selectedChat;
    if (selectedChat) {
      // SECURITY CHECK: If the selected chat belongs to a different account, clear it
      // (Unless we are in 'All' view where activeAccount might be null)
      if (activeAccount && selectedChat.whatsappAccountId && String(selectedChat.whatsappAccountId) !== String(activeAccount._id)) {
        console.warn("🚫 Chat account mismatch! Redirecting...");
        navigate("/chats");
        return;
      }
      fetchMessages(selectedChat.phone);
      // Reset unreadCount locally on select
      setConversations(prev => prev.map(c => 
        c.phone === selectedChat.phone ? { ...c, unreadCount: 0 } : c
      ));
    }
  }, [selectedChat?.phone, selectedChat?._id, activeAccount]);

  const fetchExecutives = async () => {
    if (currentUser.role === "Executive") return;
    try {
      const res = await api.get("/users");
      setExecutives(res.data.filter(u => u.role === "Executive" || u.role === "Manager"));
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  };

  // Socket.io Real-time connection
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [convs, temps, pres, execs] = await Promise.all([
          api.get(`/conversations?page=1&limit=20`),
          api.get(`/templates`),
          api.get(`/presets`),
          api.get(`/users`).catch(() => ({ data: [] }))
        ]);
        
        const initialConvs = Array.isArray(convs.data.conversations) ? convs.data.conversations : [];
        setConversations(initialConvs);
        setHasMoreConvs(convs.data.hasMore);
        setConvPage(1);
        
        setTemplates(Array.isArray(temps.data) ? temps.data.filter(t => t.status === "APPROVED") : []);
        setPresets(Array.isArray(pres.data) ? pres.data : []);
        if (currentUser.role !== "Executive") {
          setExecutives(Array.isArray(execs.data) ? execs.data.filter(u => u.role === "Executive" || u.role === "Manager") : []);
        }
      } catch (err) {
        console.error("Initial fetch error:", err);
      }
    };

    fetchInitialData();

    const socketUrl = import.meta.env.VITE_API_URL || window.location.origin;
    const socket = io(socketUrl, {
      query: { userId: currentUser._id, role: currentUser.role }
    });

    socket.on("new_message", ({ message, conversation }) => {
      // 1. Update Conversations List (STRICT MATCH: Phone AND Account ID)
      setConversations(prev => {
        // We find the exact match for this message
        const index = prev.findIndex(c => 
          c.phone === conversation.phone && 
          String(c.whatsappAccountId) === String(conversation.whatsappAccountId)
        );
        
        let updatedConvData = { ...conversation };

        // Reset unreadCount only if it's the EXACT active chat on the EXACT account
        const isActive = selectedChatRef.current?.phone === conversation.phone && 
                        String(selectedChatRef.current?.whatsappAccountId) === String(conversation.whatsappAccountId);

        if (isActive) {
          updatedConvData.unreadCount = 0;
          api.post("/conversations/mark-read", { 
            phone: conversation.phone, 
            whatsappAccountId: conversation.whatsappAccountId 
          }).catch(() => {});
        }

        if (index !== -1) {
          // Update the SPECIFIC conversation only
          const updated = [...prev];
          const finalConv = { ...updated[index], ...updatedConvData };
          updated[index] = finalConv;
          // Sort to move updated chat to top
          return updated.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));
        } else {
          // IMPORTANT: Only add to sidebar if it matches the CURRENTLY VIEWED account
          const matchesAccount = !activeAccount || String(conversation.whatsappAccountId) === String(activeAccount._id);
          
          if (matchesAccount) {
            return [updatedConvData, ...prev];
          }
          return prev;
        }
      });

      // 2. Update Messages if current chat is open (Match by Phone AND Account)
      console.log(`📩 Socket New Message: Phone ${conversation.phone} | Account ${conversation.whatsappAccountId}`);
      
      const isActiveChat = selectedChatRef.current && 
                          selectedChatRef.current.phone === conversation.phone && 
                          String(selectedChatRef.current.whatsappAccountId) === String(conversation.whatsappAccountId);

      if (isActiveChat) {
        console.log("💎 Appending message to ACTIVE chat window");
        setMessages(prev => {
          const exists = prev.find(m => m._id === message._id || (m.messageId && m.messageId === message.messageId));
          if (exists) return prev;
          return [...prev, message];
        });
      }
    });

    socket.on("status_update", ({ messageId, status }) => {
      setMessages(prev => prev.map(m => m.messageId === messageId ? { ...m, status } : m));
    });

    return () => socket.disconnect();
  }, []);

  // 24-Hour Window Timer Logic - Simple & Reliable (Derived from messages)
  useEffect(() => {
    const updateTimer = () => {
      // Find the latest inbound message from the current messages list
      const lastInbound = [...messages].reverse().find(m => m.direction === "inbound");
      
      if (lastInbound) {
        const lastMsgTime = new Date(lastInbound.timestamp).getTime();
        const now = new Date().getTime();
        const diff = (24 * 60 * 60 * 1000) - (now - lastMsgTime);
        
        if (diff > 0) {
          const h = Math.floor(diff / (1000 * 60 * 60));
          const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const s = Math.floor((diff % (1000 * 60)) / 1000);
          setWindowTimeLeft(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
        } else {
          setWindowTimeLeft(null);
        }
      } else {
        setWindowTimeLeft(null);
      }
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [messages]); // Updates whenever messages update

  // Socket.io selectedChat tracking is now handled by derived state



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
      navigate(`/chats/${existing._id}`);
    } else {
      // For completely new numbers, we use a special prefix
      navigate(`/chats/new:${phone}`);
    }

    setShowNewChatModal(false);
    setNewChatPhone("");
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat) return;

    try {
      const res = await api.post(`/messages/send`, {
        to: selectedChat.phone,
        body: newMessage
      }, {
        headers: { "x-whatsapp-account-id": selectedChat.whatsappAccountId }
      });

      setMessages([...messages, res.data.message]);
      setNewMessage("");

      if (selectedChat.isNew) {
        await fetchConversations();
      } else {
        fetchConversations();
      }
    } catch (err) {
      console.error("Error sending message:", err);
      const errorMsg = err.response?.data?.error || "Failed to send message";
      if (errorMsg.includes("24-hour") || err.response?.status === 400) {
        alert("WhatsApp Rule: You can only send a Template message to this number right now (24-hour window closed).");
      } else {
        alert("Error: " + errorMsg);
      }
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedChat) return;

    // 0. CREATE INSTANT PREVIEW (Optimistic UI)
    const previewUrl = URL.createObjectURL(file);
    const tempId = "temp-" + Date.now();
    const optimisticMsg = {
      _id: tempId,
      from: "me",
      to: selectedChat.phone,
      body: newMessage || "Image",
      type: "image",
      mediaUrl: previewUrl,
      direction: "outbound",
      status: "sending",
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, optimisticMsg]);
    setNewMessage(""); // Clear text input immediately

    try {
      setIsUploading(true);
      const uploadData = new FormData();
      uploadData.append("file", file);

      // 1. Upload to Cloudinary in background
      const uploadRes = await api.post(`/upload`, uploadData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      const imageUrl = uploadRes.data.url;

      // 2. Send Image Message via WhatsApp
      const res = await axios.post(`${API_BASE}/messages/send-image`, {
        to: selectedChat.phone,
        imageUrl: imageUrl,
        caption: optimisticMsg.body
      }, config);

      // 3. Replace Temp Message with Real Message
      setMessages(prev => prev.map(m => m._id === tempId ? res.data.message : m));
      
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      console.error("Error uploading/sending image:", err);
      // Mark as failed in UI
      setMessages(prev => prev.map(m => m._id === tempId ? { ...m, status: "failed" } : m));
      alert("Failed to send image: " + (err.response?.data?.error || err.message));
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpdateStatus = async (status) => {
    if (!selectedChat) return;
    try {
      await api.post(`/conversations/status`, {
        phone: selectedChat.phone,
        status
      }, {
        headers: { "x-whatsapp-account-id": selectedChat.whatsappAccountId }
      });
      fetchConversations();
    } catch (err) {
      alert("Error updating status: " + err.message);
    }
  };
  
  const handleTemplateImageUpload = async (e, key) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      setIsUploading(true);
      const uploadData = new FormData();
      uploadData.append("file", file);
      const res = await api.post("/upload", uploadData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setTemplateVars(prev => ({ ...prev, [key]: res.data.url }));
    } catch (err) {
      alert("Upload failed: " + err.message);
    } finally {
      setIsUploading(false);
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
      if (key.startsWith("BODY_")) {
        bodyParams.push({ type: "text", text: val });
      } else if (key.startsWith("HEADER_") || key.includes("HANDLE")) {
        // Smart detect header type from template structure
        const headerComp = selectedTemplate.components.find(c => c.type === "HEADER");
        if (headerComp && ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerComp.format)) {
          const type = headerComp.format.toLowerCase();
          headerParams.push({ type, [type]: { link: val } });
        } else {
          headerParams.push({ type: "text", text: val });
        }
      }
    });

    if (headerParams.length > 0) templateComponents.push({ type: "header", parameters: headerParams });
    if (bodyParams.length > 0) templateComponents.push({ type: "body", parameters: bodyParams });

    try {
      const res = await api.post(`/messages/send-template`, {
        to: selectedChat.phone,
        templateName: selectedTemplate.name,
        templateComponents
      }, {
        headers: { "x-whatsapp-account-id": selectedChat.whatsappAccountId }
      });
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

  const formatWhatsAppText = (text) => {
    if (!text) return "";
    // Escaping HTML to prevent XSS
    let formatted = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Bold: *text*
    formatted = formatted.replace(/\*([^*]+)\*/g, "<strong>$1</strong>");
    // Italic: _text_
    formatted = formatted.replace(/_([^_]+)_/g, "<em>$1</em>");
    // Strikethrough: ~text~
    formatted = formatted.replace(/~([^~]+)~/g, "<del>$1</del>");
    // Monospace: `text`
    formatted = formatted.replace(/`([^`]+)`/g, "<code>$1</code>");
    // Line breaks
    formatted = formatted.replace(/\n/g, "<br />");

    return formatted;
  };

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
  const [filter, setFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("All");
  const [userFilter, setUserFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const unreadCountTotal = useMemo(() => conversations.filter(c => c.unreadCount > 0).length, [conversations]);

  const getProxiedUrl = (url, accountId) => {
    if (!url) return "";
    if (url.includes("cloudinary.com") || url.startsWith("blob:")) return url;
    const accountParam = accountId ? `&accountId=${accountId}` : "";
    return `${API_BASE}/media/proxy?url=${encodeURIComponent(url)}${accountParam}`;
  };

  const filteredConversations = useMemo(() => {
    let result = conversations;

    // 1. Unread/All/Window Filter
    if (filter === "unread") {
      result = result.filter(c => c.unreadCount > 0);
    } else if (filter === "window") {
      const now = new Date().getTime();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      result = result.filter(c => {
        if (!c.lastCustomerMessageAt) return false;
        return (now - new Date(c.lastCustomerMessageAt).getTime()) < twentyFourHours;
      });
    }

    // 2. Status Filter
    if (statusFilter !== "All") {
      result = result.filter(c => c.status === statusFilter);
    }

    // 3. User Filter
    if (userFilter !== "All") {
      if (userFilter === "Unassigned") {
        result = result.filter(c => !c.assignedTo);
      } else {
        result = result.filter(c => 
          (typeof c.assignedTo === 'object' ? c.assignedTo?._id : c.assignedTo) === userFilter
        );
      }
    }

    // 4. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c => 
        (c.contact?.name || "").toLowerCase().includes(q) || 
        c.phone.includes(q) ||
        (c.lastMessage || "").toLowerCase().includes(q)
      );
    }

    return result;
  }, [conversations, filter, statusFilter, userFilter, searchQuery]);

  return (
    <div className="chat-container" style={{
      display: "grid",
      gridTemplateColumns: showContactInfo ? "350px 1fr 300px" : "350px 1fr",
      height: "100vh",
      width: "100%",
      maxWidth: "100%",
      margin: 0,
      padding: 0,
      overflow: "hidden",
      background: "var(--bg-secondary)",
      position: "relative"
    }}>
      <style>{`
        .chat-scroll::-webkit-scrollbar { width: 12px !important; }
        .chat-scroll::-webkit-scrollbar-track { background: var(--bg-secondary) !important; }
        .chat-scroll::-webkit-scrollbar-thumb { background: #8696a0 !important; border-radius: 6px; border: 2px solid var(--bg-secondary); }
        .chat-scroll::-webkit-scrollbar-thumb:hover { background: var(--accent-primary) !important; }
        
        .chat-scroll {
          overflow-y: scroll !important;
          scrollbar-width: auto;
          scrollbar-color: #8696a0 var(--bg-secondary);
        }
        
        .chat-item:hover { background: #f5f6f6 !important; }
        .chat-item.active { background: #f0f2f5 !important; border-left: 4px solid var(--accent-primary) !important; }
        
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
          background-color: #d9fdd3 !important;
          color: #111b21 !important;
          border-radius: 8px 0 8px 8px;
        }
        
        .msg-inbound {
          align-self: flex-start !important;
          background-color: #ffffff !important;
          color: #111b21 !important;
          border-radius: 0 8px 8px 8px;
        }

        .sidebar-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          border-right: 1px solid var(--border-color);
          background: var(--bg-secondary);
        }

        .chat-area-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #efeae2;
          position: relative;
        }
      `}</style>

      {/* Sidebar */}
      <div className="sidebar-container" style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "12px", background: "#f0f2f5", flexShrink: 0, height: "200px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h3 style={{ margin: 0, fontSize: "1.1rem", color: "var(--text-primary)" }}>Chats</h3>
            <div style={{ display: "flex", gap: "15px", color: "var(--text-secondary)" }}>
              <Plus size={20} cursor="pointer" onClick={() => setShowNewChatModal(true)} />
              <MoreVertical size={20} cursor="pointer" />
            </div>
          </div>
          <div style={{ position: "relative" }}>
            <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
            <input
              type="text"
              placeholder="Search or start new chat"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: "100%", padding: "8px 12px 8px 40px", background: "#ffffff", border: "none", color: "var(--text-primary)", borderRadius: "8px", fontSize: "0.85rem", outline: "none" }}
            />
          </div>

          {/* New Prominent Account Selector */}
          <div style={{ marginTop: "12px", background: "#ffffff", padding: "8px", borderRadius: "10px", border: "1px solid #e9edef" }}>
            <p style={{ fontSize: "0.65rem", color: "#667781", fontWeight: "bold", margin: "0 0 4px 4px", textTransform: "uppercase" }}>Active Number</p>
            <select 
              value={activeAccount?._id || ""} 
              onChange={(e) => {
                const acc = accounts.find(a => a._id === e.target.value);
                if (acc) switchAccount(acc);
              }}
              style={{ width: "100%", padding: "8px", border: "none", background: "none", outline: "none", fontWeight: "700", color: "#111b21", cursor: "pointer", fontSize: "0.9rem" }}
            >
              {accounts.map(acc => (
                <option key={acc._id} value={acc._id}>{acc.name} ({acc.phoneNumberId})</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
            <button 
              onClick={() => setFilter("all")}
              style={{ 
                padding: "6px 16px", 
                borderRadius: "20px", 
                background: filter === "all" ? "#e7fce3" : "#ffffff", 
                color: filter === "all" ? "#008069" : "#667781", 
                fontSize: "0.8rem", 
                cursor: "pointer",
                fontWeight: "600",
                border: filter === "all" ? "1px solid #00a884" : "1px solid #e9edef"
              }}
            >
              All
            </button>
            <button 
              onClick={() => setFilter("unread")}
              style={{ 
                padding: "6px 16px", 
                borderRadius: "20px", 
                background: filter === "unread" ? "#e7fce3" : "#ffffff", 
                color: filter === "unread" ? "#008069" : "#667781", 
                fontSize: "0.8rem", 
                cursor: "pointer",
                fontWeight: "600",
                border: filter === "unread" ? "1px solid #00a884" : "1px solid #e9edef",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              Unread {unreadCountTotal > 0 && <span style={{ background: "#00a884", color: "#ffffff", borderRadius: "50%", padding: "1px 6px", fontSize: "0.7rem", fontWeight: "bold" }}>{unreadCountTotal}</span>}
            </button>
            <button 
              onClick={() => setFilter("window")}
              style={{ 
                padding: "6px 16px", 
                borderRadius: "20px", 
                background: filter === "window" ? "#e7fce3" : "#ffffff", 
                color: filter === "window" ? "#008069" : "#667781", 
                fontSize: "0.8rem", 
                cursor: "pointer",
                fontWeight: "600",
                border: filter === "window" ? "1px solid #00a884" : "1px solid #e9edef",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              Window
            </button>
          </div>

          <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ 
                flex: 1, 
                padding: "8px 10px", 
                background: "#ffffff", 
                border: "1px solid #e9edef", 
                borderRadius: "8px", 
                fontSize: "0.75rem", 
                color: "#54656f",
                outline: "none",
                cursor: "pointer",
                fontWeight: "500"
              }}
            >
              <option value="All">Status: All</option>
              <option value="New">New</option>
              <option value="Interested">Interested</option>
              <option value="Not Interested">Not Interested</option>
              <option value="Follow-up">Follow-up</option>
              <option value="Closed">Closed</option>
            </select>

            {currentUser.role !== "Executive" && (
              <select 
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                style={{ 
                  flex: 1, 
                  padding: "8px 10px", 
                  background: "#ffffff", 
                  border: "1px solid #e9edef", 
                  borderRadius: "8px", 
                  fontSize: "0.75rem", 
                  color: "#54656f",
                  outline: "none",
                  cursor: "pointer",
                  fontWeight: "500"
                }}
              >
                <option value="All">User: All</option>
                <option value="Unassigned">Unassigned</option>
                {executives.map(ex => (
                  <option key={ex._id} value={ex._id}>{ex.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div 
          className="chat-scroll" 
          onScroll={handleSidebarScroll}
          style={{ height: "calc(100% - 260px)", overflowY: "scroll", overflowX: "hidden", display: "block", background: "white" }}
        >
          {filteredConversations.map((chat) => {
            const isActive = (selectedChat?._id === chat._id || selectedChat?.phone === chat.phone);
            return (
              <div
                key={chat._id}
                className={`chat-item ${isActive ? "active" : ""}`}
                onClick={() => navigate(`/chats/${chat._id}`)}
                style={{ 
                  padding: "12px 16px", 
                  cursor: "pointer", 
                  display: "flex", 
                  gap: "14px", 
                  alignItems: "center", 
                  background: isActive ? "#f0f2f5" : "transparent",
                  borderBottom: "1px solid #f5f6f6",
                  transition: "background 0.2s"
                }}
                onMouseOver={e => !isActive && (e.currentTarget.style.background = "#f5f6f6")}
                onMouseOut={e => !isActive && (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ 
                  width: "48px", 
                  height: "48px", 
                  borderRadius: "50%", 
                  background: isActive ? "#d1d7db" : "#dfe5e7", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  color: "#54656f",
                  fontWeight: "700",
                  fontSize: "1.1rem",
                  flexShrink: 0
                }}>
                  {(chat.contact?.name || chat.phone).charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                    <span style={{ fontWeight: isActive ? "700" : "600", color: "#111b21", fontSize: "1rem" }}>{chat.contact?.name || chat.phone}</span>
                    <span style={{ fontSize: "0.75rem", color: isActive ? "#008069" : "#667781", fontWeight: isActive ? "600" : "normal" }}>
                      {chat.lastMessageTime ? new Date(chat.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <p style={{ 
                      fontSize: "0.85rem", 
                      color: "#667781", 
                      margin: 0, 
                      whiteSpace: "nowrap", 
                      overflow: "hidden", 
                      textOverflow: "ellipsis", 
                      flex: 1,
                      fontWeight: chat.unreadCount > 0 ? "700" : "400"
                    }}>
                      {chat.lastMessage || "No messages"}
                    </p>
                    {chat.unreadCount > 0 && (
                      <span style={{ 
                        background: "#25d366", 
                        color: "white", 
                        borderRadius: "50%", 
                        padding: "2px 6px", 
                        fontSize: "0.75rem", 
                        fontWeight: "800",
                        minWidth: "20px",
                        height: "20px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginLeft: "8px"
                      }}>
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chat Area */}
      <div className="chat-area-container" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        {selectedChat ? (
          <>
            <div style={{ padding: "10px 16px", background: "#f0f2f5", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 10, flexShrink: 0, height: "60px" }}>
              <div 
                style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}
                onClick={() => setShowContactInfo(!showContactInfo)}
              >
                <div style={{ width: "38px", height: "38px", borderRadius: "50%", background: "#dfe5e7", display: "flex", alignItems: "center", justifyContent: "center", color: "#8696a0", fontSize: "1.2rem", fontWeight: "bold" }}>
                  {(selectedChat.contact?.name || selectedChat.phone).charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: "0.95rem", color: "var(--text-primary)" }}>{selectedChat.contact?.name || selectedChat.phone}</h4>
                  <span style={{ fontSize: "0.7rem", color: "#667781" }}>
                    {selectedChat.contact?.name ? selectedChat.phone : "Online"}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                {/* Assignment Dropdown */}
                {currentUser.role !== "Executive" && (
                  <select 
                    style={{ background: "#ffffff", color: "var(--text-primary)", border: "1px solid #e9edef", padding: "6px 10px", borderRadius: "8px", fontSize: "0.75rem", outline: "none" }}
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
                  style={{ background: getStatusColor(selectedChat.status), color: "#ffffff", border: "none", padding: "6px 10px", borderRadius: "8px", fontSize: "0.75rem", fontWeight: "600", outline: "none" }}
                  value={selectedChat.status || "New"}
                  onChange={(e) => handleUpdateStatus(e.target.value)}
                >
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>

                <button onClick={() => setShowTemplateModal(true)} style={{ background: "#00a884", border: "none", color: "#ffffff", padding: "6px 12px", borderRadius: "8px", fontSize: "0.75rem", fontWeight: "600", cursor: "pointer" }}>
                  Send Template
                </button>
                <MoreVertical size={20} style={{ color: "#8696a0", cursor: "pointer" }} />
              </div>
            </div>

            {/* 24h Window Timer Bar */}
            {windowTimeLeft && (
              <div style={{ background: "#f0f2f5", padding: "4px 16px", borderBottom: "1px solid rgba(0,0,0,0.05)", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", fontSize: "0.75rem", color: "#008069", fontWeight: "600" }}>
                <Clock size={14} /> 24h Service Window: {windowTimeLeft} remaining
              </div>
            )}

            <div 
              ref={scrollRef}
              className="chat-scroll"
              onScroll={handleMessageScroll}
              style={{ height: "calc(100% - 120px)", padding: "20px", overflowY: "scroll", display: "flex", flexDirection: "column", background: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')", backgroundBlendMode: "soft-light", backgroundColor: "#efeae2" }}
            >
              {isFetchingMsgs && <div style={{ textAlign: "center", padding: "10px", color: "#8696a0", fontSize: "0.8rem", background: "rgba(255,255,255,0.8)", borderRadius: "8px", margin: "0 auto 10px auto", width: "fit-content" }}>Loading older messages...</div>}
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
                      style={{ 
                        opacity: msg.status === "sending" ? 0.6 : 1,
                        position: "relative"
                      }}
                    >
                      {msg.status === "sending" && (
                        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 10 }}>
                          <Loader2 className="animate-spin" size={24} color="#00a884" />
                        </div>
                      )}
                      {msg.type === "template" && msg.templateData ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {/* Image rendering if available */}
                          {msg.templateData.components.find(c => c.type === "header")?.parameters?.[0]?.image?.link && (
                            <img 
                              src={getProxiedUrl(msg.templateData.components.find(c => c.type === "header")?.parameters?.[0]?.image?.link, msg.whatsappAccountId)} 
                              alt="Template" 
                              style={{ width: "100%", borderRadius: "8px", maxHeight: "180px", objectFit: "cover", marginBottom: "5px" }} 
                            />
                          )}
                          
                          <div 
                            style={{ whiteSpace: "pre-wrap", fontSize: "0.9rem" }}
                            dangerouslySetInnerHTML={{
                              __html: (() => {
                                const template = templates.find(t => t.name === msg.templateData.name);
                                let text = template?.components.find(c => c.type === "BODY")?.text || msg.body;
                                const params = msg.templateData.components.find(c => c.type === "body")?.parameters || [];
                                params.forEach((p, i) => {
                                  text = text.replace(`{{${i+1}}}`, p.text || "");
                                });
                                return formatWhatsAppText(text);
                              })()
                            }}
                          />

                          {/* Rendering Buttons from the template structure in DB */}
                          {templates.find(t => t.name === msg.templateData.name)?.components.find(c => c.type === "BUTTONS")?.buttons?.map((btn, i) => (
                            <div key={i} style={{ padding: "8px", background: "rgba(255,255,255,0.05)", borderRadius: "6px", textAlign: "center", fontSize: "0.75rem", border: "1px solid rgba(255,255,255,0.1)", marginTop: "2px", color: "#53bdeb" }}>
                              {btn.text}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                          {msg.mediaUrl && (
                            <div style={{ marginBottom: "5px" }}>
                              {msg.type === "image" ? (
                                <img 
                                  src={getProxiedUrl(msg.mediaUrl, msg.whatsappAccountId)} 
                                  alt="Received" 
                                  style={{ width: "100%", borderRadius: "8px", maxHeight: "250px", objectFit: "cover", cursor: "pointer" }} 
                                  onDoubleClick={() => window.open(getProxiedUrl(msg.mediaUrl, msg.whatsappAccountId), "_blank")}
                                />
                              ) : msg.type === "video" ? (
                                <video 
                                  src={getProxiedUrl(msg.mediaUrl, msg.whatsappAccountId)} 
                                  controls 
                                  style={{ width: "100%", borderRadius: "8px", maxHeight: "250px" }} 
                                />
                              ) : msg.type === "audio" ? (
                                <audio 
                                  src={getProxiedUrl(msg.mediaUrl, msg.whatsappAccountId)} 
                                  controls 
                                  style={{ width: "100%" }} 
                                />
                              ) : (
                                <div style={{ background: "rgba(0,0,0,0.05)", padding: "12px", borderRadius: "8px", display: "flex", alignItems: "center", gap: "10px" }}>
                                  <FileText size={24} color="#8696a0" />
                                  <div style={{ flex: 1, overflow: "hidden" }}>
                                    <p style={{ margin: 0, fontSize: "0.85rem", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{msg.body || "Document"}</p>
                                    <a href={getProxiedUrl(msg.mediaUrl, msg.whatsappAccountId)} target="_blank" rel="noreferrer" style={{ fontSize: "0.75rem", color: "#00a884", textDecoration: "none", fontWeight: "600" }}>Download File</a>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          <div 
                            style={{ whiteSpace: "pre-wrap" }}
                            dangerouslySetInnerHTML={{ __html: formatWhatsAppText(msg.body) }}
                          />
                        </div>
                      )}

                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "2px", gap: "2px", alignItems: "center" }}>
                        <span style={{ fontSize: "0.6rem", opacity: 0.6 }}>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {msg.direction === "outbound" && (
                          <div style={{ display: "flex", marginLeft: "2px" }}>
                            {msg.status === "read" ? (
                              <div style={{ display: "flex" }}>
                                <Check size={15} style={{ color: "#53bdeb" }} />
                                <Check size={15} style={{ color: "#53bdeb", marginLeft: "-11px" }} />
                              </div>
                            ) : msg.status === "delivered" ? (
                              <div style={{ display: "flex" }}>
                                <Check size={15} style={{ color: "#8696a0" }} />
                                <Check size={15} style={{ color: "#8696a0", marginLeft: "-11px" }} />
                              </div>
                            ) : msg.status === "failed" ? (
                              <AlertCircle size={14} style={{ color: "#ff4757" }} />
                            ) : (
                              <Check size={15} style={{ color: "#8696a0" }} />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {windowTimeLeft ? (
              <form onSubmit={handleSend} style={{ padding: "10px 16px", background: "#f0f2f5", display: "flex", gap: "10px", alignItems: "center" }}>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageUpload} 
                  accept="image/*" 
                  style={{ display: "none" }} 
                />
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  style={{ background: "transparent", border: "none", color: "#667781", cursor: "pointer", padding: "5px" }}
                >
                  {isUploading ? <Loader2 size={24} className="animate-spin" /> : <Paperclip size={24} />}
                </button>
                
                <textarea
                  placeholder="Type a message"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(e);
                    }
                    
                    // Keyboard Shortcuts: Ctrl+B or Cmd+B for Bold
                    if ((e.ctrlKey || e.metaKey) && e.key === "b") {
                      e.preventDefault();
                      const start = e.target.selectionStart;
                      const end = e.target.selectionEnd;
                      const text = newMessage;
                      const selected = text.substring(start, end);
                      const before = text.substring(0, start);
                      const after = text.substring(end);
                      setNewMessage(`${before}*${selected}*${after}`);
                    }
                    
                    // Keyboard Shortcuts: Ctrl+I or Cmd+I for Italic
                    if ((e.ctrlKey || e.metaKey) && e.key === "i") {
                      e.preventDefault();
                      const start = e.target.selectionStart;
                      const end = e.target.selectionEnd;
                      const text = newMessage;
                      const selected = text.substring(start, end);
                      const before = text.substring(0, start);
                      const after = text.substring(end);
                      setNewMessage(`${before}_${selected}_${after}`);
                    }

                    // Keyboard Shortcut: Ctrl+N for New Line
                    if ((e.ctrlKey || e.metaKey) && e.key === "n") {
                      e.preventDefault();
                      const start = e.target.selectionStart;
                      const end = e.target.selectionEnd;
                      const text = newMessage;
                      const before = text.substring(0, start);
                      const after = text.substring(end);
                      setNewMessage(`${before}\n${after}`);
                    }
                  }}
                  rows="1"
                  style={{ 
                    flex: 1, 
                    padding: "10px 12px", 
                    background: "#ffffff", 
                    border: "none", 
                    color: "var(--text-primary)", 
                    borderRadius: "8px", 
                    outline: "none", 
                    resize: "none",
                    fontFamily: "inherit",
                    fontSize: "0.9rem",
                    lineHeight: "1.4",
                    maxHeight: "100px",
                    overflowY: "auto"
                  }}
                />
                <button type="submit" style={{ background: "transparent", border: "none", color: "#00a884", cursor: "pointer", padding: "5px" }}>
                  <Send size={24} />
                </button>
              </form>
            ) : (
              <div style={{ padding: "15px 20px", background: "#f0f2f5", display: "flex", flexDirection: "column", alignItems: "center", borderTop: "1px solid rgba(0,0,0,0.05)" }}>
                <p style={{ fontSize: "0.85rem", color: "#667781", margin: "0 0 10px 0", textAlign: "center" }}>
                  <Clock size={14} style={{ verticalAlign: "middle", marginRight: "5px" }} />
                  The 24-hour service window is closed. You can only send Template Messages.
                </p>
                <button 
                  onClick={() => setShowTemplateModal(true)}
                  style={{ background: "#00a884", border: "none", color: "white", padding: "8px 24px", borderRadius: "20px", fontSize: "0.85rem", fontWeight: "700", cursor: "pointer" }}
                >
                  Send Template to Re-open Window
                </button>
              </div>
            )}
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#8696a0", background: "#f8f9fa" }}>
            <div style={{ width: "250px", height: "250px", borderRadius: "50%", background: "rgba(0,0,0,0.03)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "2rem" }}>
              <MessageSquare size={100} style={{ opacity: 0.1 }} />
            </div>
            <h2 style={{ color: "var(--text-primary)", fontWeight: "300" }}>Prime Impact Solutions</h2>
            <p style={{ maxWidth: "400px", textAlign: "center", lineHeight: "1.6", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
              Power your business with the official WhatsApp Business API.
              <br />
              Prime Impact Solutions helps you automate conversations, run campaigns, and scale customer engagement effortlessly.
            </p>
            <div style={{ marginTop: "auto", paddingBottom: "2rem", display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              <Clock size={14} /> End-to-end encrypted
            </div>
          </div>
        )}
      </div>

      {/* Contact Info Sidebar */}
      {showContactInfo && selectedChat && (
        <div style={{ background: "#111b21", borderLeft: "1px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px 16px", background: "#202c33", display: "flex", alignItems: "center", gap: "20px", height: "60px" }}>
            <button onClick={() => setShowContactInfo(false)} style={{ background: "transparent", border: "none", color: "#aebac1", cursor: "pointer" }}>✕</button>
            <span style={{ color: "#e9edef", fontSize: "0.95rem" }}>Contact Info</span>
          </div>
          
          <div className="chat-scroll" style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ width: "200px", height: "200px", borderRadius: "50%", background: "#4f5e67", display: "flex", alignItems: "center", justifyContent: "center", color: "#dfe5e7", fontSize: "5rem", marginBottom: "20px", boxShadow: "0 4px 10px rgba(0,0,0,0.3)" }}>
              {(selectedChat.contact?.name || selectedChat.phone).charAt(0).toUpperCase()}
            </div>
            <h3 style={{ color: "#e9edef", margin: "0 0 5px 0", fontSize: "1.2rem" }}>{selectedChat.contact?.name || "Unknown"}</h3>
            <p style={{ color: "#8696a0", margin: "0 0 30px 0", fontSize: "0.9rem" }}>{selectedChat.phone}</p>
            
            <div style={{ width: "100%", background: "#202c33", borderRadius: "12px", padding: "20px", marginBottom: "20px" }}>
              <label style={{ color: "#00a884", fontSize: "0.8rem", display: "block", marginBottom: "10px" }}>Status</label>
              <div style={{ color: "#e9edef", fontSize: "0.95rem" }}>{selectedChat.status || "New"}</div>
            </div>

            <div style={{ width: "100%", background: "#202c33", borderRadius: "12px", padding: "20px" }}>
              <label style={{ color: "#00a884", fontSize: "0.8rem", display: "block", marginBottom: "10px" }}>Assigned To</label>
              <div style={{ color: "#e9edef", fontSize: "0.95rem" }}>{selectedChat.assignedTo?.name || "Unassigned"}</div>
            </div>

            <div style={{ width: "100%", marginTop: "30px" }}>
              <button 
                onClick={() => alert("Notes feature coming soon!")}
                style={{ width: "100%", padding: "12px", background: "rgba(255,255,255,0.05)", border: "1px solid #3b4a54", color: "#ff4757", borderRadius: "8px", cursor: "pointer", fontSize: "0.9rem" }}
              >
                Block Contact
              </button>
            </div>
          </div>
        </div>
      )}

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
                    const isMedia = ["IMAGE", "VIDEO", "DOCUMENT"].some(type => key.includes(type)) || key.includes("HANDLE");
                    const label = isMedia ? "HEADER MEDIA (IMAGE URL)" : `${key.split("_")[0]} {{${key.split("_")[1]}}}`;

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
                              <input type="file" id={`chat-upload-${key}`} style={{ display: "none" }} onChange={(e) => handleTemplateImageUpload(e, key)} />
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
