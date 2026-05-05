import React, { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import {
  Send, User, Search, MoreVertical, MessageSquare, Clock,
  Calendar, Tag, ChevronDown, Check, AlertCircle, FileText,
  Plus, Paperclip, Loader2, Trash2, Pencil, Key, Smile, Zap
} from "lucide-react";
import { io } from "socket.io-client";
import KeywordRuleModal from "./KeywordRuleModal";

import { useParams, useNavigate } from "react-router-dom";
import api, { API_BASE } from "../api";
import { useWhatsAppAccount } from "../WhatsAppAccountContext";
import { startFollowUpAlarm } from "../utils/beep_sound";
import { useCallback } from "react";

const COMMON_EMOJIS = ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗", "🤔", "🤭", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄", "😯", "😦", "😧", "😮", "😲", "🥱", "😴", "🤤", "😪", "😵", "🤐", "🥴", "🤢", "🤮", "🤧", "😷", "🤒", "🤕", "🤑", "🤠", "😈", "👿", "👹", "👺", "🤡", "👻", "💀", "☠️", "👽", "👾", "🤖", "🎃", "😺", "😸", "😹", "😻", "😼", "😽", "🙀", "😿", "😾", "🤲", "👐", "🙌", "👏", "🤝", "👍", "👎", "👊", "✊", "🤛", "🤜", "🤞", "✌️", "🤟", "🤘", "👌", "🤌", "🤏", "👈", "👉", "👆", "👇", "☝️", "✋", "🤚", "🖐", "🖖", "👋", "🤙", "💪", "🦾", "🖕", "✍️", "🙏", "🦶", "🦵", "🦿", "💄", "💋", "👄", "🦷", "👅", "👂", "🦻", "👃", "👣", "👁", "👀", "🧠", "🫀", "🫁", "🦴", "💩", "🔥", "✨", "🌟", "⭐", "🌈", "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟"];

const STATUS_OPTIONS = ["New", "Interested", "Not Interested", "Follow-up", "Missed Follow-up", "Closed"];

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
    if (!chat) return null;

    const normalized = { ...chat };
    if (!normalized.whatsappAccountId && activeAccount?.isDefault) {
      normalized.whatsappAccountId = activeAccount._id;
    }
    return normalized;
  }, [chatId, conversations, activeAccount]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [templatePresets, setTemplatePresets] = useState([]);
  const [quickReplies, setQuickReplies] = useState([]);
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

  const [customStatuses, setCustomStatuses] = useState([]);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatusName, setNewStatusName] = useState("");

  const [sectors, setSectors] = useState([]);
  const [showSectorModal, setShowSectorModal] = useState(false);
  const [newSectorName, setNewSectorName] = useState("");

  const [showManageModal, setShowManageModal] = useState(false);
  const [showKeywordModal, setShowKeywordModal] = useState(false);
  const [manageType, setManageType] = useState("status"); // 'status' or 'sector'

  // Filters State
  const [filter, setFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [timelineEntries, setTimelineEntries] = useState([]);
  const [newTimelineContent, setNewTimelineContent] = useState("");
  const [isTimelineLoading, setIsTimelineLoading] = useState(false);
  const [editingTimelineId, setEditingTimelineId] = useState(null);
  const [editingTimelineContent, setEditingTimelineContent] = useState("");

  const [customFieldsDef, setCustomFieldsDef] = useState([]);
  const [isUpdatingField, setIsUpdatingField] = useState(null);

  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpTime, setFollowUpTime] = useState("");
  const [pendingStatus, setPendingStatus] = useState("");

  const [activeReminders, setActiveReminders] = useState([]);
  const [shownReminders, setShownReminders] = useState(new Set());
  const [isGlobalView, setIsGlobalView] = useState(false);
  const alarmRef = useRef(null);

  const allStatusOptions = useMemo(() => {
    const combined = [...customStatuses];
    const essential = ["New", "Interested", "Not Interested", "Follow-up", "Missed Follow-up", "Closed"];
    essential.forEach(status => {
      if (!combined.find(s => s.name === status)) {
        combined.push({ name: status, isDefault: true });
      }
    });
    return combined;
  }, [customStatuses]);

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
  const [pendingImage, setPendingImage] = useState(null); // { file, previewUrl }
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showAddQuickReplyModal, setShowAddQuickReplyModal] = useState(false);
  const [newQR, setNewQR] = useState({ name: "", content: "", file: null, preview: "" });
  const [isSavingQR, setIsSavingQR] = useState(false);
  const fileInputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const quickRepliesRef = useRef(null);
  const [activeContact, setActiveContact] = useState(null);
  const conversationsRef = useRef(conversations);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const fetchMessages = async (phone, page = 1) => {
    try {
      if (page === 1) setLoading(true);
      // Pass the specific account ID for this chat to ensure we get the right messages
      const res = await api.get(`/messages/${phone}?page=${page}&limit=50`, {
        headers: { "x-whatsapp-account-id": isGlobalView ? "all" : (selectedChat?.whatsappAccountId || activeAccount?._id) }
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

  const fetchConversations = useCallback(async (page = 1) => {
    try {
      setIsFetchingConvs(true);
      const res = await api.get(`/conversations?page=${page}&limit=100&status=${statusFilter}&assignedTo=${userFilter}&sector=${sectorFilter}${isGlobalView ? "&showAllAccounts=true" : ""}`, {
        headers: { "x-whatsapp-account-id": isGlobalView ? "all" : activeAccount?._id }
      });
      const newData = res.data.conversations || [];

      if (page === 1) {
        setConversations(newData);
        setConvPage(1);
      } else {
        setConversations(prev => {
          // Prevent duplicates
          const existingIds = new Set(prev.map(c => c._id));
          const uniqueNew = newData.filter(c => !existingIds.has(c._id));
          return [...prev, ...uniqueNew];
        });
      }
      setHasMoreConvs(res.data.hasMore);
    } catch (err) {
      console.error("Error fetching conversations:", err);
    } finally {
      setIsFetchingConvs(false);
    }
  }, [statusFilter, userFilter, sectorFilter, activeAccount, isGlobalView]);

  const fetchMoreConversations = async () => {
    if (!hasMoreConvs || isFetchingConvs) return;

    const nextPage = convPage + 1;
    console.log(`📜 Infinite Scroll: Loading page ${nextPage}...`);

    // Set fetching flag IMMEDIATELY to prevent double-triggers
    setIsFetchingConvs(true);

    try {
      const res = await api.get(`/conversations?page=${nextPage}&limit=100&status=${statusFilter}&assignedTo=${userFilter}&sector=${sectorFilter}${isGlobalView ? "&showAllAccounts=true" : ""}`, {
        headers: { "x-whatsapp-account-id": isGlobalView ? "all" : activeAccount?._id }
      });
      const newData = res.data.conversations || [];

      setConversations(prev => {
        const existingIds = new Set(prev.map(c => c._id));
        const uniqueNew = newData.filter(c => !existingIds.has(c._id));
        return [...prev, ...uniqueNew];
      });

      setConvPage(nextPage);
      setHasMoreConvs(res.data.hasMore);
    } catch (err) {
      console.error("Error fetching more conversations:", err);
    } finally {
      setIsFetchingConvs(false);
    }
  };

  const handleSidebarScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    // Trigger when user is within 200px of bottom
    if (scrollHeight - scrollTop - clientHeight < 200 && !isFetchingConvs && hasMoreConvs) {
      console.log("📜 Infinite Scroll: Loading more chats...");
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
      // FETCH CONTACT INFO: Smart Lookup
      if (selectedChat.isNew || !selectedChat.contact) {
        const fetchContactByPhone = async () => {
          try {
            // Get last 10 digits for fuzzy matching (to handle 91 or no 91)
            const cleanPhone = selectedChat.phone.replace(/[^0-9]/g, "");
            const last10 = cleanPhone.slice(-10);

            const res = await api.get(`/contacts?search=${last10}`, {
              headers: { "x-whatsapp-account-id": selectedChat.whatsappAccountId }
            });

            // Find best match (ending with the same 10 digits)
            const found = res.data.contacts.find(c => {
              const cPhone = (c.phone || "").replace(/[^0-9]/g, "");
              return cPhone.endsWith(last10);
            });

            if (found) {
              console.log("🔍 Found existing contact record:", found.name);
              setActiveContact(found);
            } else {
              setActiveContact(null);
            }
          } catch (err) {
            console.error("Error searching contact:", err);
          }
        };
        fetchContactByPhone();
      } else {
        setActiveContact(selectedChat.contact);
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
      setExecutives(res.data.filter(u => u.role === "Executive" || u.role === "Manager" || u.role === "Admin"));
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  };

  const fetchStatuses = async () => {
    try {
      const res = await api.get("/statuses");
      setCustomStatuses(res.data);
    } catch (err) {
      console.error("Error fetching statuses:", err);
    }
  };

  const handleAddStatus = async () => {
    if (!newStatusName.trim()) return;
    try {
      await api.post("/statuses", { name: newStatusName });
      setNewStatusName("");
      setShowStatusModal(false);
      fetchStatuses();
    } catch (err) {
      alert("Error adding status: " + err.message);
    }
  };

  const handleDeleteStatus = async (id) => {
    if (!window.confirm("Delete this status?")) return;
    try {
      await api.delete(`/statuses/${id}`);
      fetchStatuses();
    } catch (err) {
      alert("Error deleting status: " + err.message);
    }
  };

  const fetchSectors = async () => {
    try {
      const res = await api.get("/sectors");
      setSectors(res.data);
    } catch (err) {
      console.error("Error fetching sectors:", err);
    }
  };

  const fetchCustomFieldsDef = async () => {
    try {
      const res = await api.get("/custom-fields");
      setCustomFieldsDef(res.data);
    } catch (err) {
      console.error("Error fetching field definitions:", err);
    }
  };

  const handleUpdateCustomField = async (contactId, fieldName, value) => {
    if (!contactId) return;
    try {
      setIsUpdatingField(fieldName);
      // Merge with existing custom fields from the active contact record
      const currentFields = activeContact?.customFields || {};
      const updatedFields = { ...currentFields, [fieldName]: value };

      const res = await api.put(`/contacts/${contactId}`, {
        customFields: updatedFields
      });

      // Update local state
      setActiveContact(res.data);
      setConversations(prev => prev.map(c =>
        (c.contact?._id === contactId || c.contact === contactId) ? { ...c, contact: res.data } : c
      ));
      console.log(`✅ Field ${fieldName} updated to: ${value}`);
    } catch (err) {
      console.error("Error updating field:", err);
      alert("Failed to save field. Please try again.");
    } finally {
      setIsUpdatingField(null);
    }
  };

  const handleAddSector = async () => {
    if (!newSectorName.trim()) return;
    try {
      await api.post("/sectors", { name: newSectorName });
      setNewSectorName("");
      setShowSectorModal(false);
      fetchSectors();
    } catch (err) {
      alert("Error adding sector: " + err.message);
    }
  };

  const handleDeleteSector = async (id) => {
    if (!window.confirm("Delete this sector?")) return;
    try {
      await api.delete(`/sectors/${id}`);
      fetchSectors();
    } catch (err) {
      alert("Error deleting sector: " + err.message);
    }
  };

  // Trigger fresh fetch when filters or account change
  useEffect(() => {
    setConversations([]); // Clear list for fresh start
    setConvPage(1);
    fetchConversations(1);
  }, [statusFilter, userFilter, sectorFilter, activeAccount, isGlobalView]);

  // Click outside to close popovers
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
      if (quickRepliesRef.current && !quickRepliesRef.current.contains(event.target)) {
        setShowQuickReplies(false);
      }
    };
    if (showEmojiPicker || showQuickReplies) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojiPicker, showQuickReplies]);

  const handleCreateQuickReply = async (e) => {
    e.preventDefault();
    if (!newQR.name || (!newQR.content && !newQR.file)) return;

    try {
      setIsSavingQR(true);
      let mediaUrl = "";
      if (newQR.file) {
        const formData = new FormData();
        formData.append("file", newQR.file);
        const uploadRes = await api.post("/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        mediaUrl = uploadRes.data.url;
      }

      const res = await api.post("/quick-replies", {
        name: newQR.name,
        content: newQR.content,
        mediaUrl
      });

      setQuickReplies([res.data, ...quickReplies]);
      setShowAddQuickReplyModal(false);
      setNewQR({ name: "", content: "", file: null, preview: "" });
    } catch (err) {
      console.error("Error creating quick reply:", err);
      alert("Error: " + (err.response?.data?.error || err.message));
    } finally {
      setIsSavingQR(false);
    }
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [temps, pres, quicks, execs, stats, sects, cFields] = await Promise.all([
          api.get(`/templates`),
          api.get(`/presets`),
          api.get(`/quick-replies`),
          api.get(`/users`).catch(() => ({ data: [] })),
          api.get(`/statuses`).catch(() => ({ data: [] })),
          api.get(`/sectors`).catch(() => ({ data: [] })),
          api.get(`/custom-fields`).catch(() => ({ data: [] }))
        ]);

        setCustomStatuses(stats.data);
        setSectors(sects.data);
        setCustomFieldsDef(cFields.data);

        setTemplates(Array.isArray(temps.data) ? temps.data.filter(t => t.status === "APPROVED") : []);
        setTemplatePresets(Array.isArray(pres.data) ? pres.data : []);
        setQuickReplies(Array.isArray(quicks.data) ? quicks.data : []);
        if (currentUser.role !== "Executive") {
          setExecutives(Array.isArray(execs.data) ? execs.data.filter(u => u.role === "Executive" || u.role === "Manager" || u.role === "Admin") : []);
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
      // This ensures we only show the new message in the sidebar if it belongs to the exact account we are viewing.
      setConversations(prev => {
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
          }).catch(() => { });
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
          const matchesAccount = !activeAccount || (function (conv, active) {
            const chatAccountId = conv.whatsappAccountId ? String(conv.whatsappAccountId) : null;
            const activeAccountId = String(active._id);
            if (!chatAccountId && active.name.toLowerCase().includes("primary")) return true;
            return chatAccountId === activeAccountId;
          })(conversation, activeAccount);

          if (matchesAccount) {
            return [updatedConvData, ...prev];
          }
          return prev;
        }
      });

      // 2. Update Messages if current chat is open (Match by Phone AND Account)
      const isActiveChat = selectedChatRef.current &&
        selectedChatRef.current.phone === conversation.phone &&
        String(selectedChatRef.current.whatsappAccountId) === String(conversation.whatsappAccountId);

      if (isActiveChat) {
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

    socket.on("followup_reminder", ({ conversation }) => {
      console.log("🔔 Backend Reminder received:", conversation.phone);
      setActiveReminders(prev => {
        if (prev.find(p => p._id === conversation._id)) return prev;
        return [...prev, conversation];
      });

      // Browser Native Notification
      if (Notification.permission === "granted") {
        new Notification(`Follow-up Reminder: ${conversation.contact?.name || conversation.phone}`, {
          body: `Scheduled for ${new Date(conversation.followUpTime).toLocaleTimeString()}`,
          icon: "/favicon.ico"
        });
      }

      // Start alarm
      if (!alarmRef.current) {
        alarmRef.current = startFollowUpAlarm();
      }
    });

    socket.on("conversation_status_update", ({ phone, status }) => {
      console.log(`🔄 Conversation status sync: ${phone} -> ${status}`);
      setConversations(prev => prev.map(c =>
        c.phone === phone ? { ...c, status } : c
      ));
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

  // Alarm Management
  useEffect(() => {
    if (activeReminders.length === 0 && alarmRef.current) {
      alarmRef.current();
      alarmRef.current = null;
    }
  }, [activeReminders]);

  // Handle cleanup on unmount
  useEffect(() => {
    return () => {
      if (alarmRef.current) {
        alarmRef.current();
        alarmRef.current = null;
      }
    };
  }, []);

  // Socket.io selectedChat tracking is now handled by derived state

  const handleAssign = async (userId, sector) => {
    if (!selectedChat) return;
    try {
      const res = await api.post(`/conversations/assign`, {
        phone: selectedChat.phone,
        userId: userId !== undefined ? userId : selectedChat.assignedTo?._id,
        sector: sector !== undefined ? sector : selectedChat.sector
      }, {
        headers: { "x-whatsapp-account-id": selectedChat.whatsappAccountId }
      });
      // Update local state
      setConversations(prev => prev.map(c =>
        c.phone === selectedChat.phone ? { ...c, assignedTo: res.data.conversation.assignedTo, sector: res.data.conversation.sector } : c
      ));
      if (activeContact && (activeContact._id === res.data.conversation.contact?._id || activeContact._id === res.data.conversation.contact)) {
        setActiveContact(prev => ({ ...prev, assignedTo: res.data.conversation.assignedTo, sector: res.data.conversation.sector }));
      }
    } catch (err) {
      alert("Error assigning: " + err.message);
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
    if (e) e.preventDefault();
    if ((!newMessage.trim() && !pendingImage) || !selectedChat) return;

    if (pendingImage) {
      // 🖼️ CASE 1: SEND IMAGE (WITH CAPTION)
      const { file, previewUrl } = pendingImage;
      const caption = newMessage.trim();
      const tempId = "temp-" + Date.now();

      const optimisticMsg = {
        _id: tempId,
        from: "me",
        to: selectedChat.phone,
        body: caption || "Image",
        type: "image",
        mediaUrl: previewUrl,
        direction: "outbound",
        status: "sending",
        timestamp: new Date()
      };

      setMessages(prev => [...prev, optimisticMsg]);
      setNewMessage("");
      setPendingImage(null); // Clear preview IMMEDIATELY

      try {
        setIsUploading(true);
        let imageUrl = "";

        if (pendingImage.isRemote) {
          imageUrl = pendingImage.remoteUrl;
        } else {
          const uploadData = new FormData();
          uploadData.append("file", file);

          // 1. Upload to Cloudinary
          const uploadRes = await api.post(`/upload`, uploadData, {
            headers: { "Content-Type": "multipart/form-data" }
          });
          imageUrl = uploadRes.data.url;
        }

        // 2. Send Image Message via WhatsApp
        const res = await api.post("/messages/send-image", {
          to: selectedChat.phone,
          imageUrl: imageUrl,
          caption: caption
        });

        // 3. Replace Temp Message with Real Message
        setMessages(prev => prev.map(m => m._id === tempId ? res.data.message : m));
        fetchConversations();
      } catch (err) {
        console.error("Error sending image:", err);
        setMessages(prev => prev.map(m => m._id === tempId ? { ...m, status: "failed" } : m));
        alert("Failed to send image: " + (err.response?.data?.error || err.message));
      } finally {
        setIsUploading(false);
      }
    } else {
      // 💬 CASE 2: NORMAL TEXT SEND
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
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !selectedChat) return;

    // 0. Set Preview instead of sending immediately
    const previewUrl = URL.createObjectURL(file);
    setPendingImage({ file, previewUrl });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpdateStatus = async (status, fTime = null) => {
    if (!selectedChat) return;

    // If changing to Follow-up and no time provided, show modal
    if (status.toLowerCase().includes("follow") && !fTime) {
      setPendingStatus(status);
      setFollowUpDate(new Date().toISOString().split('T')[0]);
      setFollowUpTime(new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' }));
      setShowFollowUpModal(true);
      return;
    }

    try {
      await api.post(`/conversations/status`, {
        phone: selectedChat.phone,
        status,
        followUpTime: status.toLowerCase().includes("follow") ? fTime : null
      }, {
        headers: { "x-whatsapp-account-id": selectedChat.whatsappAccountId }
      });
      // Update local state instead of full fetch
      setConversations(prev => prev.map(c =>
        c.phone === selectedChat.phone ? { ...c, status, followUpTime: status.toLowerCase().includes("follow") ? fTime : null } : c
      ));
      setShowFollowUpModal(false);
    } catch (err) {
      alert("Error updating status: " + err.message);
    }
  };

  const handleSaveFollowUp = () => {
    if (!followUpDate || !followUpTime) {
      alert("Please select date and time");
      return;
    }
    const combined = new Date(`${followUpDate}T${followUpTime}`);
    handleUpdateStatus(pendingStatus, combined);
  };

  const fetchTimelineEntries = async (contactId) => {
    if (!contactId) return;
    try {
      setIsTimelineLoading(true);
      const res = await api.get(`/timeline/${contactId}`, {
        headers: { "x-whatsapp-account-id": selectedChat?.whatsappAccountId }
      });
      setTimelineEntries(res.data);
    } catch (err) {
      console.error("Error fetching timeline:", err);
    } finally {
      setIsTimelineLoading(false);
    }
  };

  const handleAddTimeline = async (e) => {
    e.preventDefault();
    if (!newTimelineContent.trim() || !selectedChat?.contact?._id) {
      if (!selectedChat?.contact?._id) alert("Wait for contact to be initialized or first message to be sent.");
      return;
    }
    try {
      const res = await api.post("/timeline", {
        contactId: selectedChat?.contact?._id,
        whatsappAccountId: selectedChat?.whatsappAccountId,
        content: newTimelineContent
      });
      setTimelineEntries([res.data, ...timelineEntries]);
      setNewTimelineContent("");
    } catch (err) {
      alert("Error adding timeline: " + err.message);
    }
  };

  const handleEditTimeline = async (id) => {
    if (!editingTimelineContent.trim()) return;
    try {
      const res = await api.put(`/timeline/${id}`, { content: editingTimelineContent });
      setTimelineEntries(timelineEntries.map(entry => entry._id === id ? res.data : entry));
      setEditingTimelineId(null);
      setEditingTimelineContent("");
    } catch (err) {
      alert("Error editing timeline: " + err.message);
    }
  };

  const handleDeleteTimeline = async (id) => {
    if (!window.confirm("Are you sure you want to delete this entry?")) return;
    try {
      await api.delete(`/timeline/${id}`);
      setTimelineEntries(timelineEntries.filter(entry => entry._id !== id));
    } catch (err) {
      alert("Error deleting timeline: " + err.message);
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
    const custom = customStatuses.find(s => s.name === status);
    if (custom && custom.color) return custom.color;
    switch (status) {
      case "Interested": return "#25d366";
      case "Not Interested": return "#ff4757";
      case "Follow-up": return "#f1c40f";
      case "Closed": return "#94a3b8";
      default: return "#3498db";
    }
  };

  const [searchTerm, setSearchTerm] = useState("");

  const unreadCountTotal = useMemo(() => conversations.filter(c => c.unreadCount > 0).length, [conversations]);

  const getProxiedUrl = (url, accountId) => {
    if (!url) return "";
    if (url.includes("cloudinary.com") || url.startsWith("blob:")) return url;
    const accountParam = accountId ? `&accountId=${accountId}` : "";
    return `${API_BASE}/media/proxy?url=${encodeURIComponent(url)}${accountParam}`;
  };

  const filteredConversations = useMemo(() => {
    const seen = new Set();
    return conversations.filter(c => {
      if (!c?._id || seen.has(c._id)) return false;
      seen.add(c._id);
      
      // ALWAYS include the currently open chat in the sidebar
      if (c._id === chatId) return true;

      // 1. Unread/Window Filter
      if (filter === "unread" && !(c.unreadCount > 0)) return false;
      if (filter === "window") {
        const now = new Date().getTime();
        const twentyFourHours = 24 * 60 * 60 * 1000;
        if (!c.lastCustomerMessageAt || (now - new Date(c.lastCustomerMessageAt).getTime()) >= twentyFourHours) return false;
      }

      // 2. Status Filter
      if (statusFilter && statusFilter.toLowerCase() !== "all" && c.status !== statusFilter) return false;

      // 3. User Filter
      if (userFilter && userFilter.toLowerCase() !== "all") {
        const assignedId = typeof c.assignedTo === 'object' ? c.assignedTo?._id : c.assignedTo;
        if (userFilter === "Unassigned") {
          if (c.assignedTo) return false;
        } else if (assignedId !== userFilter) return false;
      }

      // Sector Filter
      if (sectorFilter !== "all" && c.sector !== sectorFilter) return false;

      // 4. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!((c.contact?.name || "").toLowerCase().includes(q) || c.phone.includes(q) || (c.lastMessage || "").toLowerCase().includes(q))) return false;
      }

      return true;
    });
  }, [conversations, filter, statusFilter, sectorFilter, userFilter, searchQuery, chatId]);

  return (
    <div className="chat-container" style={{
      display: "grid",
      gridTemplateColumns: showContactInfo ? "350px 1fr 350px" : "350px 1fr",
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
        <div style={{ padding: "12px", background: "#f0f2f5", flexShrink: 0 }}>
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

          {/* Global View Toggle Button */}
          <button
            onClick={() => {
              const newState = !isGlobalView;
              console.log("🌐 Toggling Global View to:", newState);
              setIsGlobalView(newState);
            }}
            style={{
              width: "100%",
              marginTop: "8px",
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              background: isGlobalView ? "#00a884" : "white",
              color: isGlobalView ? "white" : "#111b21",
              fontWeight: "600",
              fontSize: "0.85rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
          >
            <Search size={16} />
            {isGlobalView ? "Showing All Accounts" : "View All Accounts"}
          </button>

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

          {/* Filter Section - Compact One-Line Slider */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "10px", padding: "0 4px" }}>
            <div
              id="sidebar-filter-slider"
              style={{
                display: "flex",
                gap: "8px",
                overflowX: "auto",
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                flex: 1,
                padding: "4px 0"
              }}
            >
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ minWidth: "110px", padding: "6px 10px", border: "1px solid #e9edef", borderRadius: "12px", fontSize: "0.75rem", color: "#54656f", outline: "none", cursor: "pointer", fontWeight: "600", background: "#f0f2f5" }}
              >
                <option value="all">Status: All</option>
                {allStatusOptions.map(s => (
                  <option key={s.name} value={s.name}>{s.name}</option>
                ))}
              </select>

              {currentUser.role !== "Executive" && (
                <>
                  <select
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                    style={{ minWidth: "110px", padding: "6px 10px", border: "1px solid #e9edef", borderRadius: "12px", fontSize: "0.75rem", color: "#54656f", outline: "none", cursor: "pointer", fontWeight: "600", background: "#f0f2f5" }}
                  >
                    <option value="all">User: All</option>
                    {executives.map(ex => (
                      <option key={ex._id} value={ex._id}>{ex.name}</option>
                    ))}
                  </select>

                  <select
                    value={sectorFilter}
                    onChange={(e) => setSectorFilter(e.target.value)}
                    style={{ minWidth: "110px", padding: "6px 10px", border: "1px solid #e9edef", borderRadius: "12px", fontSize: "0.75rem", color: "#54656f", outline: "none", cursor: "pointer", fontWeight: "600", background: "#f0f2f5" }}
                  >
                    <option value="all">Sector: All</option>
                    {sectors.map(s => (
                      <option key={s.name} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </>
              )}
            </div>

            {/* Unified Manage Button */}
            <button
              onClick={() => setShowManageModal(true)}
              style={{ background: "#f0f2f5", color: "#54656f", border: "1px solid #e9edef", borderRadius: "50%", width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
              title="Add Status or Sector"
            >
              <Plus size={14} />
            </button>

            {/* Keyword Rules Button */}
            {currentUser?.role === "Admin" && (
              <button
                onClick={() => setShowKeywordModal(true)}
                style={{ background: "#00a884", color: "white", border: "none", borderRadius: "50%", width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}
                title="Keyword Automations"
              >
                <Key size={14} />
              </button>
            )}
          </div>
        </div>

        <div
          className="chat-scroll"
          onScroll={handleSidebarScroll}
          style={{ flex: 1, overflowY: "auto", overflowX: "hidden", display: "block", background: "white" }}
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
                    <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
                      {chat.lastMessageTime ? (
                        <>
                          <span style={{ fontSize: "0.75rem", fontWeight: "700", color: isActive ? "#008069" : "#667781" }}>
                            {new Date(chat.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span style={{ fontSize: "0.62rem", color: "#8696a0", fontWeight: "600", textTransform: "uppercase" }}>
                            {new Date(chat.lastMessageTime).toLocaleDateString([], { day: '2-digit', month: 'short' })}
                          </span>
                        </>
                      ) : ""}
                    </div>
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
            <div style={{ padding: "8px 16px", background: "#f0f2f5", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 10, flexShrink: 0, height: "52px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
              <div
                style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}
                onClick={() => setShowContactInfo(!showContactInfo)}
              >
                <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: "#dfe5e7", display: "flex", alignItems: "center", justifyContent: "center", color: "#8696a0", fontSize: "1.1rem", fontWeight: "bold" }}>
                  {(selectedChat.contact?.name || selectedChat.phone).charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: "700", color: "#111b21" }}>{selectedChat.contact?.name || selectedChat.phone}</h4>
                    {windowTimeLeft && (
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", background: "rgba(0, 128, 105, 0.1)", padding: "2px 8px", borderRadius: "10px", fontSize: "0.65rem", color: "#008069", fontWeight: "700" }}>
                        <Clock size={10} /> {windowTimeLeft}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: "0.68rem", color: "#667781" }}>
                    {selectedChat.contact?.name ? selectedChat.phone : "Online"}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                {/* Send Template Button */}
                <button onClick={() => setShowTemplateModal(true)} style={{ background: "#00a884", border: "none", color: "#ffffff", padding: "6px 14px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: "700", cursor: "pointer", boxShadow: "0 2px 4px rgba(0, 168, 132, 0.2)", transition: "0.2s" }} onMouseOver={e => e.currentTarget.style.transform = "translateY(-1px)"} onMouseOut={e => e.currentTarget.style.transform = "translateY(0)"}>
                  Send Template
                </button>
                <MoreVertical size={20} style={{ color: "#8696a0", cursor: "pointer" }} />
              </div>
            </div>

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
                  {msgs.map((msg, idx) => (
                    <div
                      key={msg._id || `temp-${idx}`}
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
                                  text = text.replace(`{{${i + 1}}}`, p.text || "");
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
              <div style={{ background: "#f0f2f5", display: "flex", flexDirection: "column", position: "relative" }}>
                
                {/* Emoji Picker Popover */}
                {showEmojiPicker && (
                  <div ref={emojiPickerRef} style={{ position: "absolute", bottom: "100%", left: "10px", background: "white", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "10px", boxShadow: "0 -4px 12px rgba(0,0,0,0.1)", width: "300px", zIndex: 1000 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", borderBottom: "1px solid #f0f2f5", paddingBottom: "5px" }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: "700", color: "#667781" }}>Emojis</span>
                      <button onClick={() => setShowEmojiPicker(false)} style={{ background: "none", border: "none", color: "#667781", cursor: "pointer" }}><Plus size={18} style={{ transform: "rotate(45deg)" }} /></button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: "5px", maxHeight: "200px", overflowY: "auto" }}>
                      {COMMON_EMOJIS.map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            setNewMessage(prev => prev + emoji);
                          }}
                          style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", padding: "5px" }}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick Replies Popover */}
                {showQuickReplies && (
                  <div ref={quickRepliesRef} style={{ position: "absolute", bottom: "100%", left: "50px", background: "white", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "10px", boxShadow: "0 -4px 12px rgba(0,0,0,0.1)", width: "320px", maxHeight: "350px", overflowY: "auto", zIndex: 1000 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", borderBottom: "1px solid #f0f2f5", paddingBottom: "5px" }}>
                      <h4 style={{ margin: 0, fontSize: "0.85rem", color: "#111b21" }}>Quick Replies</h4>
                      <div style={{ display: "flex", gap: "10px" }}>
                        <button onClick={() => setShowAddQuickReplyModal(true)} style={{ background: "#00a884", border: "none", color: "white", borderRadius: "4px", padding: "2px 8px", fontSize: "0.75rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}><Plus size={12} /> Add</button>
                        <button onClick={() => setShowQuickReplies(false)} style={{ background: "none", border: "none", color: "#667781", cursor: "pointer" }}><Plus size={18} style={{ transform: "rotate(45deg)" }} /></button>
                      </div>
                    </div>
                    {quickReplies.length === 0 ? (
                      <p style={{ fontSize: "0.8rem", color: "#8696a0" }}>No quick replies found. You can add them to send Image + Text quickly.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {quickReplies.map(p => (
                          <button
                            key={p._id}
                            type="button"
                            onClick={async () => {
                              // If it has media, fetch/set it
                              if (p.mediaUrl) {
                                try {
                                  // Clear any existing pending image
                                  setPendingImage(null);
                                  
                                  // We can't directly use URL.createObjectURL on a remote URL easily without fetching
                                  // So for now, we just set the mediaUrl and Type
                                  // BUT the handleSend expects a 'file' object. 
                                  // Let's modify handleSend later to accept either file or mediaUrl.
                                  // FOR NOW: We'll set a special pending state
                                  setPendingImage({ 
                                    previewUrl: p.mediaUrl,
                                    remoteUrl: p.mediaUrl, 
                                    isRemote: true 
                                  });
                                } catch (err) {
                                  console.error("Error loading quick reply media:", err);
                                }
                              }
                              
                              setNewMessage(p.content || "");
                              setShowQuickReplies(false);
                            }}
                            style={{ textAlign: "left", background: "#f8f9fa", border: "1px solid #e9edef", padding: "8px 12px", borderRadius: "8px", cursor: "pointer", display: "flex", gap: "10px", alignItems: "center" }}
                          >
                            {p.mediaUrl && (
                              <img src={p.mediaUrl} alt="" style={{ width: "40px", height: "40px", borderRadius: "4px", objectFit: "cover" }} />
                            )}
                            <div style={{ flex: 1, overflow: "hidden" }}>
                              <span style={{ fontWeight: "600", display: "block", fontSize: "0.85rem", color: "#111b21" }}>{p.name}</span>
                              <span style={{ fontSize: "0.75rem", color: "#667781", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>{p.content || "Image only"}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Image Preview Area */}
                {pendingImage && (
                  <div style={{ padding: "10px 16px", background: "#f0f2f5", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: "15px" }}>
                    <div style={{ position: "relative", width: "80px", height: "80px", borderRadius: "10px", overflow: "hidden", border: "2px solid #00a884", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
                      <img src={pendingImage.previewUrl} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <button
                        onClick={() => setPendingImage(null)}
                        style={{ position: "absolute", top: "2px", right: "2px", background: "rgba(0,0,0,0.6)", color: "white", border: "none", borderRadius: "50%", width: "18px", height: "18px", cursor: "pointer", fontSize: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}
                      >✕</button>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: "700", color: "#111b21" }}>Image selected</p>
                      <p style={{ margin: 0, fontSize: "0.75rem", color: "#667781" }}>Type a caption below and press send</p>
                    </div>
                  </div>
                )}
                <form onSubmit={handleSend} style={{ padding: "10px 16px", display: "flex", gap: "10px", alignItems: "center" }}>
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

                  {/* Emoji Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowEmojiPicker(!showEmojiPicker);
                      setShowQuickReplies(false);
                    }}
                    style={{ background: "transparent", border: "none", color: showEmojiPicker ? "#00a884" : "#667781", cursor: "pointer", padding: "5px" }}
                    title="Emojis"
                  >
                    <Smile size={24} />
                  </button>

                  {/* Quick Replies Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickReplies(!showQuickReplies);
                      setShowEmojiPicker(false);
                    }}
                    style={{ background: "transparent", border: "none", color: showQuickReplies ? "#00a884" : "#667781", cursor: "pointer", padding: "5px" }}
                    title="Quick Replies"
                  >
                    <Zap size={24} />
                  </button>

                  <textarea
                    placeholder={pendingImage ? "Add a caption..." : "Type a message"}
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
                  <button type="submit" disabled={isUploading} style={{ background: "transparent", border: "none", color: isUploading ? "#cbd5e1" : "#00a884", cursor: isUploading ? "not-allowed" : "pointer", padding: "5px" }}>
                    <Send size={24} />
                  </button>
                </form>
              </div>
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
                {(activeContact?.name || selectedChat.phone).charAt(0).toUpperCase()}
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
                {selectedChat.status?.toLowerCase().includes("follow") && selectedChat.followUpTime && (
                  <div style={{ marginTop: "8px", padding: "8px 12px", background: "#fffbeb", border: "1px solid #fef3c7", borderRadius: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <Clock size={12} color="#d97706" />
                    <span style={{ fontSize: "0.7rem", color: "#d97706", fontWeight: "700" }}>
                      Due: {new Date(selectedChat.followUpTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ color: "#64748b", fontSize: "0.65rem", fontWeight: "800", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Sector</label>
                <div style={{ position: "relative" }}>
                  <select
                    style={{ width: "100%", padding: "10px 12px", background: "#ffffff", border: "1.5px solid #e2e8f0", borderRadius: "12px", color: "#1e293b", fontSize: "0.9rem", fontWeight: "600", outline: "none", cursor: "pointer", appearance: "none" }}
                    value={selectedChat.sector || "Unassigned"}
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
                  {currentUser.role !== "Executive" ? (
                    <>
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
                    </>
                  ) : (
                    <div style={{ background: "#ffffff", padding: "10px 12px", borderRadius: "12px", border: "1.5px solid #e2e8f0", color: "#1e293b", fontSize: "0.9rem", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px" }}>
                      <User size={14} color="#00a884" /> {selectedChat.assignedTo?.name || "Unassigned"}
                    </div>
                  )}
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
                  customFieldsDef.map(field => (
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
                        <div style={{ position: "relative" }}>
                          <input
                            list={`list-${field._id}`}
                            style={{ width: "100%", padding: "4px 0", background: "transparent", border: "none", borderBottom: "1.5px solid #f1f5f9", fontSize: "0.95rem", color: "#1e293b", fontWeight: "700", outline: "none" }}
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
                            placeholder={`Select or type ${field.label.toLowerCase()}...`}
                            disabled={isUpdatingField === field.name || !activeContact}
                          />
                          <datalist id={`list-${field._id}`}>
                            {field.options.map(opt => <option key={opt} value={opt} />)}
                          </datalist>
                          <ChevronDown size={14} style={{ position: "absolute", right: "0", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
                        </div>
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
      )}

      {showTimelineModal && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(11, 20, 26, 0.7)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, animation: "fadeIn 0.2s ease" }}>
          <div style={{
            background: "#ffffff",
            width: "550px",
            maxHeight: "85vh",
            display: "flex",
            flexDirection: "column",
            borderRadius: "28px",
            boxShadow: "0 25px 60px rgba(0,0,0,0.2)",
            overflow: "hidden"
          }}>
            {/* Header */}
            <div style={{ padding: "24px 32px", background: "#00a884", color: "white", position: "relative" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={{ background: "rgba(255,255,255,0.25)", padding: "10px", borderRadius: "14px" }}>
                  <Clock size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: "700", letterSpacing: "-0.02em" }}>Interaction Timeline</h3>
                  <p style={{ margin: "2px 0 0 0", fontSize: "0.75rem", opacity: 0.85, fontWeight: "500" }}>Logging updates for {selectedChat?.contact?.name || selectedChat?.phone}</p>
                </div>
              </div>
              <button
                onClick={() => setShowTimelineModal(false)}
                style={{ position: "absolute", top: "24px", right: "24px", background: "rgba(0,0,0,0.1)", border: "none", width: "32px", height: "32px", borderRadius: "50%", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >✕</button>
            </div>

            <div style={{ flex: 1, padding: "32px", overflowY: "auto", background: "#fcfdfe" }}>
              {/* Add New Entry Section */}
              <div style={{ background: "#ffffff", borderRadius: "20px", border: "1px solid #edf2f7", padding: "20px", boxShadow: "0 4px 12px rgba(0,0,0,0.03)", marginBottom: "32px" }}>
                <textarea
                  placeholder="What happened? (e.g. Client asked for price list, Visited site...)"
                  style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "1px solid #e2e8f0", outline: "none", resize: "none", fontSize: "0.9rem", background: "#f8fafc", fontFamily: "inherit" }}
                  rows="2"
                  value={newTimelineContent}
                  onChange={(e) => setNewTimelineContent(e.target.value)}
                />
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px" }}>
                  <button
                    onClick={handleAddTimeline}
                    disabled={!newTimelineContent.trim()}
                    style={{
                      padding: "8px 24px",
                      background: "#00a884",
                      color: "white",
                      border: "none",
                      borderRadius: "10px",
                      fontWeight: "700",
                      fontSize: "0.85rem",
                      cursor: newTimelineContent.trim() ? "pointer" : "not-allowed",
                      boxShadow: "0 4px 10px rgba(0, 168, 132, 0.2)"
                    }}
                  >
                    Post Update
                  </button>
                </div>
              </div>

              {/* Timeline List */}
              <div style={{ position: "relative", paddingLeft: "30px" }}>
                {/* Vertical Line */}
                {timelineEntries.length > 0 && (
                  <div style={{ position: "absolute", left: "7px", top: "0", bottom: "0", width: "2px", background: "linear-gradient(to bottom, #00a884, #e2e8f0)" }}></div>
                )}

                {isTimelineLoading ? (
                  <div style={{ textAlign: "center", padding: "20px" }}><Loader2 className="animate-spin" color="#00a884" /></div>
                ) : timelineEntries.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
                    <MessageSquare size={32} style={{ opacity: 0.2, marginBottom: "12px" }} />
                    <p style={{ fontSize: "0.9rem" }}>No activity logs yet.</p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                    {timelineEntries.map((entry) => (
                      <div key={entry._id} style={{ position: "relative" }}>
                        {/* Dot */}
                        <div style={{ position: "absolute", left: "-30px", top: "4px", width: "16px", height: "16px", borderRadius: "50%", background: "#ffffff", border: "3px solid #00a884", zIndex: 1 }}></div>

                        <div style={{ background: "#ffffff", padding: "16px", borderRadius: "18px", border: "1px solid #f1f5f9", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                            <div>
                              <span style={{ fontSize: "0.85rem", fontWeight: "700", color: "#1e293b" }}>{entry.createdBy?.name}</span>
                              <p style={{ margin: 0, fontSize: "0.7rem", color: "#64748b", fontWeight: "500" }}>
                                {new Date(entry.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                            {currentUser.role === "Admin" && (
                              <div style={{ display: "flex", gap: "8px" }}>
                                <button onClick={() => { setEditingTimelineId(entry._id); setEditingTimelineContent(entry.content); }} style={{ background: "#f1f5f9", border: "none", padding: "4px 8px", borderRadius: "6px", fontSize: "0.7rem", color: "#475569", cursor: "pointer" }}>Edit</button>
                                <button onClick={() => handleDeleteTimeline(entry._id)} style={{ background: "#fff1f2", border: "none", padding: "4px 8px", borderRadius: "6px", fontSize: "0.7rem", color: "#e11d48", cursor: "pointer" }}>Delete</button>
                              </div>
                            )}
                          </div>

                          {editingTimelineId === entry._id ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                              <textarea
                                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #00a884", fontSize: "0.9rem" }}
                                value={editingTimelineContent}
                                onChange={(e) => setEditingTimelineContent(e.target.value)}
                              />
                              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                                <button onClick={() => setEditingTimelineId(null)} style={{ padding: "4px 12px", background: "transparent", fontSize: "0.75rem", border: "1px solid #e2e8f0", borderRadius: "6px" }}>Cancel</button>
                                <button onClick={() => handleEditTimeline(entry._id)} style={{ padding: "4px 12px", background: "#00a884", color: "white", fontSize: "0.75rem", border: "none", borderRadius: "6px" }}>Save</button>
                              </div>
                            </div>
                          ) : (
                            <p style={{ margin: 0, fontSize: "0.9rem", color: "#334155", lineHeight: "1.5", whiteSpace: "pre-wrap" }}>{entry.content}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
      {/* Status Management Modal */}
      {showStatusModal && (
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, backdropFilter: "blur(5px)" }}>
          <div className="glass-card" style={{ width: "400px", padding: "2rem", position: "relative" }}>
            <h3 style={{ marginBottom: "1.5rem" }}>Manage Statuses</h3>

            <div style={{ display: "flex", gap: "10px", marginBottom: "1.5rem" }}>
              <input
                type="text"
                placeholder="New Status Name..."
                value={newStatusName}
                onChange={(e) => setNewStatusName(e.target.value)}
                style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #ddd" }}
              />
              <button onClick={handleAddStatus} className="btn-primary" style={{ padding: "10px 20px" }}>Add</button>
            </div>

            <div style={{ maxHeight: "250px", overflowY: "auto" }}>
              {customStatuses.map(s => (
                <div key={s._id || s.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#f8fafc", borderRadius: "8px", marginBottom: "8px", border: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: "0.9rem", fontWeight: "600" }}>{s.name} {s.isDefault && <small style={{ color: "#94a3b8" }}>(Default)</small>}</span>
                  {!s.isDefault && (
                    <button onClick={() => handleDeleteStatus(s._id)} style={{ border: "none", background: "none", cursor: "pointer", color: "#ef4444" }}>
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button onClick={() => setShowStatusModal(false)} className="btn-secondary" style={{ width: "100%", marginTop: "1.5rem" }}>Close</button>
          </div>
        </div>
      )}
      {/* Unified Management Modal (Status & Sector) */}
      {showManageModal && (
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, backdropFilter: "blur(5px)" }}>
          <div className="glass-card" style={{ width: "450px", padding: "2rem", position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h3 style={{ margin: 0 }}>Global Management</h3>
              <select
                value={manageType}
                onChange={(e) => setManageType(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "0.9rem", fontWeight: "600", background: "#f0f2f5" }}
              >
                <option value="status">Manage Statuses</option>
                <option value="sector">Manage Sectors</option>
              </select>
            </div>

            {manageType === "status" ? (
              <>
                <div style={{ display: "flex", gap: "10px", marginBottom: "1.5rem" }}>
                  <input
                    type="text"
                    placeholder="New Status Name..."
                    value={newStatusName}
                    onChange={(e) => setNewStatusName(e.target.value)}
                    style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #ddd" }}
                  />
                  <button onClick={handleAddStatus} className="btn-primary" style={{ padding: "10px 20px" }}>Add</button>
                </div>
                <div style={{ maxHeight: "250px", overflowY: "auto", border: "1px solid #eee", borderRadius: "10px", padding: "10px" }}>
                  {customStatuses.map(s => (
                    <div key={s._id || s.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px", background: "#f8fafc", borderRadius: "8px", marginBottom: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: s.color || "#3498db" }}></div>
                        <span style={{ fontSize: "0.9rem", fontWeight: "600" }}>{s.name}</span>
                      </div>
                      {!s.isDefault && (
                        <button onClick={() => handleDeleteStatus(s._id)} style={{ border: "none", background: "none", cursor: "pointer", color: "#ef4444" }}>
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div style={{ display: "flex", gap: "10px", marginBottom: "1.5rem" }}>
                  <input
                    type="text"
                    placeholder="New Sector Name..."
                    value={newSectorName}
                    onChange={(e) => setNewSectorName(e.target.value)}
                    style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #ddd" }}
                  />
                  <button onClick={handleAddSector} className="btn-primary" style={{ padding: "10px 20px" }}>Add</button>
                </div>
                <div style={{ maxHeight: "250px", overflowY: "auto", border: "1px solid #eee", borderRadius: "10px", padding: "10px" }}>
                  {sectors.map(s => (
                    <div key={s._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px", background: "#f8fafc", borderRadius: "8px", marginBottom: "8px" }}>
                      <span style={{ fontSize: "0.9rem", fontWeight: "600" }}>{s.name}</span>
                      <button onClick={() => handleDeleteSector(s._id)} style={{ border: "none", background: "none", cursor: "pointer", color: "#ef4444" }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            <button onClick={() => setShowManageModal(false)} className="btn-secondary" style={{ width: "100%", marginTop: "1.5rem" }}>Close</button>
          </div>
        </div>
      )}

      {/* Follow-up Time Picker Modal */}
      {showFollowUpModal && (
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, backdropFilter: "blur(5px)" }}>
          <div className="glass-card" style={{ width: "400px", padding: "2rem" }}>
            <h3 style={{ marginBottom: "1rem" }}>Set Follow-up Reminder</h3>
            <p style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: "1.5rem" }}>When should we remind you to follow up with this lead?</p>

            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "800", color: "#94a3b8", marginBottom: "8px" }}>DATE</label>
              <input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1.5px solid #e2e8f0" }}
              />
            </div>

            <div style={{ marginBottom: "2rem" }}>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "800", color: "#94a3b8", marginBottom: "8px" }}>TIME</label>
              <input
                type="time"
                value={followUpTime}
                onChange={(e) => setFollowUpTime(e.target.value)}
                style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1.5px solid #e2e8f0" }}
              />
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={() => setShowFollowUpModal(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleSaveFollowUp} className="btn-primary" style={{ flex: 1 }}>Save Reminder</button>
            </div>
          </div>
        </div>
      )}

      {/* activeReminders Popup */}
      {activeReminders.length > 0 && (
        <div style={{ position: "fixed", bottom: "30px", right: "30px", zIndex: 9999, display: "flex", flexDirection: "column", gap: "15px" }}>
          {activeReminders.map(rem => (
            <div key={rem._id} className="glass-card" style={{ width: "320px", padding: "20px", borderLeft: "5px solid #00a884", boxShadow: "0 10px 40px rgba(0,0,0,0.15)", animation: "slideInRight 0.3s ease" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
                <span style={{ fontSize: "0.7rem", fontWeight: "800", color: "#00a884", textTransform: "uppercase" }}>⏰ Follow-up Due Now</span>
                <button onClick={() => setActiveReminders(prev => prev.filter(r => r._id !== rem._id))} style={{ background: "none", border: "none", color: "#cbd5e1", cursor: "pointer" }}>✕</button>
              </div>
              <h4 style={{ margin: "0 0 5px 0", fontSize: "1rem" }}>{rem.contact?.name || rem.phone}</h4>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }}>Status: {rem.status}</p>

              <div style={{ marginTop: "15px", display: "flex", gap: "10px" }}>
                <button
                  onClick={() => {
                    navigate(`/chats/${rem._id}`);
                    setActiveReminders(prev => prev.filter(r => r._id !== rem._id));
                  }}
                  style={{ flex: 1, padding: "8px", background: "#00a884", color: "white", border: "none", borderRadius: "8px", fontSize: "0.8rem", fontWeight: "700", cursor: "pointer" }}
                >
                  Go to Chat
                </button>
                <button
                  onClick={() => {
                    setActiveReminders(prev => prev.filter(r => r._id !== rem._id));
                  }}
                  style={{ padding: "8px 12px", background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: "8px", fontSize: "0.8rem", fontWeight: "700", cursor: "pointer" }}
                >
                  Later
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Keyword Automation Modal */}
      <KeywordRuleModal 
        isOpen={showKeywordModal} 
        onClose={() => setShowKeywordModal(false)}
        users={executives}
        statusOptions={customStatuses}
      />
      {/* Add Quick Reply Modal */}
      {showAddQuickReplyModal && (
        <div className="modal-overlay" style={{ zIndex: 10001 }}>
          <div className="modal-content" style={{ width: "450px", padding: "30px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, fontSize: "1.2rem", color: "#111b21" }}>Add Quick Reply</h3>
              <button onClick={() => setShowAddQuickReplyModal(false)} style={{ background: "none", border: "none", color: "#667781", cursor: "pointer" }}><Plus size={24} style={{ transform: "rotate(45deg)" }} /></button>
            </div>
            
            <form onSubmit={handleCreateQuickReply}>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "700", color: "#667781", marginBottom: "5px" }}>NAME / LABEL</label>
                <input 
                  type="text" 
                  placeholder="e.g. Welcome Message"
                  value={newQR.name}
                  onChange={e => setNewQR({...newQR, name: e.target.value})}
                  required
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0", outline: "none" }}
                />
              </div>

              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "700", color: "#667781", marginBottom: "5px" }}>IMAGE (OPTIONAL)</label>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  {newQR.preview && (
                    <img src={newQR.preview} alt="Preview" style={{ width: "60px", height: "60px", borderRadius: "8px", objectFit: "cover", border: "1px solid #e2e8f0" }} />
                  )}
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={e => {
                      const file = e.target.files[0];
                      if(file) {
                        setNewQR({...newQR, file, preview: URL.createObjectURL(file)});
                      }
                    }}
                    style={{ fontSize: "0.8rem" }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "700", color: "#667781", marginBottom: "5px" }}>MESSAGE TEXT</label>
                
                {/* Formatting Toolbar */}
                <div style={{ display: "flex", gap: "5px", marginBottom: "5px", background: "#f8f9fa", padding: "5px", borderRadius: "5px" }}>
                  <button 
                    type="button" 
                    onClick={() => {
                      const textarea = document.getElementById("qr-content-area");
                      if (!textarea) return;
                      const start = textarea.selectionStart;
                      const end = textarea.selectionEnd;
                      const text = newQR.content;
                      const selected = text.substring(start, end);
                      const before = text.substring(0, start);
                      const after = text.substring(end);
                      
                      if (selected) {
                        setNewQR({...newQR, content: `${before}*${selected}*${after}`});
                      } else {
                        setNewQR({...newQR, content: text + "*bold* "});
                      }
                    }} 
                    style={{ padding: "2px 12px", fontSize: "0.85rem", fontWeight: "bold", border: "1px solid #e2e8f0", background: "white", borderRadius: "4px", cursor: "pointer" }}
                  >B</button>
                  <button 
                    type="button" 
                    onClick={() => {
                      const textarea = document.getElementById("qr-content-area");
                      if (!textarea) return;
                      const start = textarea.selectionStart;
                      const end = textarea.selectionEnd;
                      const text = newQR.content || "";
                      const selected = text.substring(start, end);
                      const before = text.substring(0, start);
                      const after = text.substring(end);
                      
                      if (selected) {
                        setNewQR({...newQR, content: `${before}_${selected}_${after}`});
                      } else {
                        setNewQR({...newQR, content: text + "_italic_ "});
                      }
                    }} 
                    style={{ padding: "2px 12px", fontSize: "0.85rem", fontStyle: "italic", border: "1px solid #e2e8f0", background: "white", borderRadius: "4px", cursor: "pointer" }}
                  >I</button>
                  <button type="button" onClick={() => setNewQR({...newQR, content: newQR.content + "\n"})} style={{ padding: "2px 8px", fontSize: "0.75rem", border: "1px solid #e2e8f0", background: "white", borderRadius: "4px", cursor: "pointer" }}>New Line ↵</button>
                </div>

                <textarea 
                  id="qr-content-area"
                  rows="5"
                  placeholder="Type the message here... Use *bold* for Bold and _italic_ for Italic"
                  value={newQR.content}
                  onChange={e => setNewQR({...newQR, content: e.target.value})}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0", outline: "none", resize: "none", fontSize: "0.9rem" }}
                />

                {/* Live Preview */}
                {newQR.content && (
                  <div style={{ marginTop: "10px", padding: "10px", background: "#dcf8c6", borderRadius: "8px", fontSize: "0.85rem", boxShadow: "inset 0 1px 3px rgba(0,0,0,0.05)" }}>
                    <p style={{ margin: "0 0 5px 0", fontSize: "0.65rem", fontWeight: "700", color: "#075e54", textTransform: "uppercase" }}>WhatsApp Preview</p>
                    <div style={{ whiteSpace: "pre-wrap" }} dangerouslySetInnerHTML={{ __html: formatWhatsAppText(newQR.content) }} />
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button type="button" onClick={() => setShowAddQuickReplyModal(false)} style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "white", cursor: "pointer" }}>Cancel</button>
                <button 
                  type="submit" 
                  disabled={isSavingQR || !newQR.name}
                  style={{ flex: 2, padding: "12px", borderRadius: "8px", border: "none", background: "#00a884", color: "white", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                >
                  {isSavingQR ? <Loader2 size={20} className="animate-spin" /> : "Save Quick Reply"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatModule;
