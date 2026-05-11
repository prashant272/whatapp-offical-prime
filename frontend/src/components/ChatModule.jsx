import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import axios from "axios";
import { Loader2, Clock, Check } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { io } from "socket.io-client";

import {
  setFilter as setReduxFilter,
  setStatusFilter as setReduxStatusFilter,
  setSectorFilter as setReduxSectorFilter,
  setUserFilter as setReduxUserFilter,
  setSearchQuery as setReduxSearchQuery,
  setSelectedAccountIds as setReduxSelectedAccountIds,
  setActiveChat,
  addMessage,
  updateMessageStatus,
  fetchMessages as fetchReduxMessages,
  fetchConversations as fetchReduxConversations,
  sendMessage as sendReduxMessage,
  sendImage as sendReduxImage,
  updateConversationStatus as updateReduxStatus
} from "../redux/slices/chatSlice";

import api, { API_BASE } from "../api";
import { useWhatsAppAccount } from "../WhatsAppAccountContext";
import { startFollowUpAlarm } from "../utils/beep_sound";

// Import Refactored Components
import ChatSidebar from "./ChatModule/ChatSidebar";
import ChatArea from "./ChatModule/ChatArea";
import ContactDetailSidebar from "./ChatModule/ContactDetailSidebar";
import TemplateModal from "./ChatModule/TemplateModal";
import TimelineModal from "./ChatModule/TimelineModal";
import ManageStatusSectorModal from "./ChatModule/ManageStatusSectorModal";
import NewChatModal from "./ChatModule/NewChatModal";
import FollowUpModal from "./ChatModule/FollowUpModal";

const ChatModule = () => {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { accounts, activeAccount, switchAccount } = useWhatsAppAccount();
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

  const [customStatuses, setCustomStatuses] = useState([]);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatusName, setNewStatusName] = useState("");

  const [sectors, setSectors] = useState([]);
  const [showSectorModal, setShowSectorModal] = useState(false);
  const [newSectorName, setNewSectorName] = useState("");

  const [showManageModal, setShowManageModal] = useState(false);
  const [showKeywordModal, setShowKeywordModal] = useState(false);
  const [manageType, setManageType] = useState("status");

  const dispatch = useDispatch();
  const {
    filter,
    statusFilter,
    sectorFilter,
    userFilter,
    searchQuery,
    selectedAccountIds,
    messages,
    hasMoreMsgs,
    msgPage,
    isFetchingMsgs
  } = useSelector(state => state.chat);

  const setFilter = (val) => dispatch(setReduxFilter(val));
  const setStatusFilter = (val) => dispatch(setReduxStatusFilter(val));
  const setSectorFilter = (val) => dispatch(setReduxSectorFilter(val));
  const setUserFilter = (val) => dispatch(setReduxUserFilter(val));
  const setSearchQuery = (val) => dispatch(setReduxSearchQuery(val));
  const setSelectedAccountIds = (val) => dispatch(setReduxSelectedAccountIds(val));

  const [conversations, setConversations] = useState([]);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const accountDropdownRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSendingMsg, setIsSendingMsg] = useState(false);
  const [pendingImage, setPendingImage] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const fileInputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const quickRepliesRef = useRef(null);
  const [activeContact, setActiveContact] = useState(null);
  const alarmRef = useRef(null);

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
  const [followUpActivity, setFollowUpActivity] = useState("");
  const [pendingStatus, setPendingStatus] = useState("");

  const [activeReminders, setActiveReminders] = useState([]);

  // --- Logic Functions ---

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadConversations = useCallback(async (cursor = null) => {
    setIsFetchingNextPage(true);
    const accIds = selectedAccountIds.length > 0 ? selectedAccountIds.join(",") : activeAccount?._id;
    const resultAction = await dispatch(fetchReduxConversations({
      cursor,
      status: statusFilter,
      assignedTo: userFilter,
      sector: sectorFilter,
      search: debouncedSearch,
      accountIds: accIds,
      filter: filter
    }));

    if (fetchReduxConversations.fulfilled.match(resultAction)) {
      const { conversations: newConvs, nextCursor: nCursor, hasMore } = resultAction.payload;
      if (!cursor) {
        setConversations(newConvs);
      } else {
        setConversations(prev => [...prev, ...newConvs]);
      }
      setNextCursor(nCursor);
      setHasNextPage(hasMore);
    }
    setIsFetchingNextPage(false);
  }, [dispatch, selectedAccountIds, activeAccount, statusFilter, userFilter, sectorFilter, debouncedSearch, filter]);

  useEffect(() => {
    if (activeAccount?._id || selectedAccountIds.length > 0) {
      loadConversations();
    }
  }, [loadConversations, activeAccount?._id, selectedAccountIds, statusFilter, userFilter, sectorFilter, debouncedSearch, filter]);

  const fetchNextPage = () => {
    if (hasNextPage && !isFetchingNextPage) {
      loadConversations(nextCursor);
    }
  };

  const refetchConvs = () => loadConversations();

  const selectedChat = useMemo(() => {
    if (!chatId) return null;
    if (chatId.startsWith("new:")) {
      const phone = chatId.split(":")[1];
      return { phone, status: "New", isNew: true, whatsappAccountId: activeAccount?._id };
    }
    const found = conversations.find(c => c._id === chatId);
    if (found) return found;
    return { _id: chatId, isPlaceholder: true };
  }, [chatId, conversations, activeAccount]);

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
    if (scrollRef.current && messages.length > 0) {
      const scrollContainer = scrollRef.current;
      if (prevMsgCount === 0) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      } else {
        const isAtBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < 200;
        if (isAtBottom) {
          scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
        }
      }
      setPrevMsgCount(messages.length);
    }
  }, [messages, prevMsgCount]);

  useEffect(() => {
    setPrevMsgCount(0);
  }, [selectedChat?.phone]);

  useEffect(() => {
    if (activeAccount?._id && selectedAccountIds.length === 0) {
      if (currentUser.role === "Admin" || currentUser.role === "Manager") {
        setSelectedAccountIds(accounts.map(a => a._id));
      } else {
        setSelectedAccountIds([activeAccount._id]);
      }
    }
  }, [activeAccount, accounts]);

  const fetchMessages = useCallback(async (phone, page = 1) => {
    const accId = selectedChat?.whatsappAccountId || (selectedAccountIds && selectedAccountIds.length > 0 ? selectedAccountIds.join(",") : activeAccount?._id);
    if (!phone) return;
    dispatch(fetchReduxMessages({ phone, page, accountId: accId }));
  }, [selectedChat?.whatsappAccountId, selectedAccountIds, activeAccount, dispatch]);

  const fetchMoreMessages = async () => {
    if (!hasMoreMsgs || isFetchingMsgs || !selectedChat) return;
    await fetchMessages(selectedChat.phone, msgPage + 1);
  };

  const handleMessageScroll = (e) => {
    if (e.target.scrollTop === 0 && hasMoreMsgs && !isFetchingMsgs) {
      const oldScrollHeight = e.target.scrollHeight;
      fetchMoreMessages().then(() => {
        setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight - oldScrollHeight;
          }
        }, 100);
      });
    }
  };

  const selectedChatRef = useRef(selectedChat);
  useEffect(() => {
    selectedChatRef.current = selectedChat;
    if (selectedChat) {
      dispatch(setActiveChat(selectedChat));
      if (selectedChat.contact) {
        setActiveContact(selectedChat.contact);
      } else if (selectedChat.isNew) {
        const fetchContactByPhone = async () => {
          try {
            const cleanPhone = selectedChat.phone.replace(/[^0-9]/g, "");
            const last10 = cleanPhone.slice(-10);
            const res = await api.get(`/contacts?search=${last10}`, {
              headers: { "x-whatsapp-account-id": selectedChat.whatsappAccountId }
            });
            const found = res.data.contacts.find(c => (c.phone || "").endsWith(last10));
            if (found) setActiveContact(found);
            else setActiveContact(null);
          } catch (err) {
            console.error("Error searching contact:", err);
            setActiveContact(null);
          }
        };
        fetchContactByPhone();
      } else {
        // Not new, but no contact object attached (e.g. placeholder)
        setActiveContact(null);
      }
      fetchMessages(selectedChat.phone);
      setConversations(prev => prev.map(c =>
        (c._id === selectedChat._id || c.phone === selectedChat.phone)
          ? { ...c, unreadCount: 0 }
          : c
      ));
    }
  }, [selectedChat?.phone, selectedChat?._id, activeAccount]);

  useEffect(() => {
    // If we have a contact ID, fetch full details whenever the chat changes or info is shown
    const contactId = selectedChat?.contact?._id || activeContact?._id;
    if (showContactInfo && contactId) {
      const fetchFullContact = async () => {
        try {
          const res = await api.get(`/contacts/${contactId}`);
          setActiveContact(res.data);
        } catch (err) {
          console.error("Error fetching full contact details:", err);
        }
      };
      fetchFullContact();
    }
  }, [showContactInfo, selectedChat?._id, selectedChat?.phone]);

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

      const updatedConv = res.data.conversation;

      // Update local list
      setConversations(prev => prev.map(c => c._id === updatedConv._id ? { ...c, ...updatedConv } : c));

      if (activeContact && (activeContact._id === updatedConv.contact?._id || activeContact._id === updatedConv.contact)) {
        setActiveContact(prev => ({
          ...prev,
          assignedTo: updatedConv.assignedTo,
          sector: updatedConv.sector
        }));
      }
      // refetchConvs(); // Removed to prevent disappearing from list when filters are active
    } catch (err) {
      alert("Error assigning: " + err.message);
    }
  };

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (isSendingMsg || (!newMessage.trim() && !pendingImage) || !selectedChat) return;

    setIsSendingMsg(true);
    try {
      if (pendingImage) {
        const { file, previewUrl } = pendingImage;
        const caption = newMessage.trim();
        const tempId = "temp-" + Date.now();

        const optimisticMsg = {
          _id: tempId, from: "me", to: selectedChat.phone, body: caption || "Image", type: "image",
          mediaUrl: previewUrl, direction: "outbound", status: "sending", timestamp: new Date()
        };

        dispatch(addMessage(optimisticMsg));
        setNewMessage("");
        setPendingImage(null);

        try {
          setIsUploading(true);
          let imageUrl = "";
          if (pendingImage.isRemote) {
            imageUrl = pendingImage.remoteUrl;
          } else {
            const uploadData = new FormData();
            uploadData.append("file", file);
            const uploadRes = await api.post(`/upload`, uploadData, {
              headers: { "Content-Type": "multipart/form-data" }
            });
            imageUrl = uploadRes.data.url;
          }

          const resultAction = await dispatch(sendReduxImage({
            to: selectedChat.phone, imageUrl, caption, accountId: selectedChat.whatsappAccountId
          }));

          if (sendReduxImage.fulfilled.match(resultAction)) {
            dispatch(updateMessageStatus({ tempId, realMsg: resultAction.payload }));
            refetchConvs();
          } else {
            throw new Error(resultAction.payload || "Failed to send image");
          }
        } catch (err) {
          dispatch(updateMessageStatus({ tempId, realMsg: { ...optimisticMsg, status: "failed" } }));
          alert("Failed to send image: " + (err.response?.data?.error || err.message));
        } finally {
          setIsUploading(false);
        }
      } else {
        const text = newMessage.trim();
        const tempId = "temp-" + Date.now();
        const optimisticMsg = {
          _id: tempId, from: "me", to: selectedChat.phone, body: text, type: "text",
          direction: "outbound", status: "sending", timestamp: new Date()
        };

        dispatch(addMessage(optimisticMsg));
        setNewMessage("");

        try {
          const resultAction = await dispatch(sendReduxMessage({
            to: selectedChat.phone, body: text, accountId: selectedChat.whatsappAccountId
          }));

          if (sendReduxMessage.fulfilled.match(resultAction)) {
            dispatch(updateMessageStatus({ tempId, realMsg: resultAction.payload }));
            refetchConvs();
          } else {
            throw new Error(resultAction.payload || "Failed to send message");
          }
        } catch (err) {
          dispatch(updateMessageStatus({ tempId, realMsg: { ...optimisticMsg, status: "failed" } }));
          alert("Error: " + (err.response?.data?.error || "Failed to send message"));
        }
      }
    } catch (err) {
      console.error("Critical handleSend error:", err);
    } finally {
      setIsSendingMsg(false);
    }
  };

  const handleSendTemplate = async (templateName, templateComponents) => {
    if (!selectedChat) return;
    try {
      const res = await api.post(`/messages/send-template`, {
        to: selectedChat.phone,
        templateName,
        templateComponents
      }, {
        headers: { "x-whatsapp-account-id": selectedChat.whatsappAccountId }
      });
      if (res.data.success) {
        dispatch(addMessage(res.data.message));
        refetchConvs();
      }
    } catch (err) {
      alert("Error sending template: " + (err.response?.data?.error || err.message));
    }
  };

  const handleStartNewChat = async (phone, accountId) => {
    try {
      const cleanPhone = phone.replace(/\D/g, "");
      const res = await api.post(`/messages/send`, {
        to: cleanPhone,
        body: "Hello!"
      }, {
        headers: { "x-whatsapp-account-id": accountId }
      });
      if (res.data.success) {
        refetchConvs();
        navigate(`/chats/${res.data.message.to}`);
      }
    } catch (err) {
      alert("Error starting chat: " + (err.response?.data?.error || err.message));
    }
  };


  const handleAddStatusSector = async (type, data) => {
    try {
      const endpoint = type === "status" ? "/statuses" : "/sectors";
      await api.post(endpoint, data);
      if (type === "status") {
        const sRes = await api.get("/statuses");
        setCustomStatuses(sRes.data);
      } else {
        const secRes = await api.get("/sectors");
        setSectors(secRes.data);
      }
    } catch (err) {
      alert("Error adding: " + (err.response?.data?.error || err.message));
    }
  };

  const handleUpdateStatusSector = async (type, idOrName, data) => {
    try {
      const endpoint = type === "status" ? `/statuses/${idOrName}` : `/sectors/${idOrName}`;
      await api.put(endpoint, data);
      if (type === "status") {
        const sRes = await api.get("/statuses");
        setCustomStatuses(sRes.data);
      } else {
        const secRes = await api.get("/sectors");
        setSectors(secRes.data);
      }
    } catch (err) {
      alert("Error updating: " + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteStatusSector = async (type, idOrName) => {
    if (!window.confirm(`Are you sure you want to delete this ${type}?`)) return;
    try {
      const endpoint = type === "status" ? `/statuses/${idOrName}` : `/sectors/${idOrName}`;
      await api.delete(endpoint);
      if (type === "status") {
        const sRes = await api.get("/statuses");
        setCustomStatuses(sRes.data);
      } else {
        const secRes = await api.get("/sectors");
        setSectors(secRes.data);
      }
    } catch (err) {
      alert("Error deleting: " + (err.response?.data?.error || err.message));
    }
  };

  const handleUpdateStatus = async (status, fTime = null) => {
    if (!selectedChat) return;
    if (status.toLowerCase().includes("follow") && !fTime) {
      setPendingStatus(status);
      setFollowUpDate(new Date().toISOString().split('T')[0]);
      setFollowUpTime(new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' }));
      setShowFollowUpModal(true);
      return;
    }

    try {
      const resultAction = await dispatch(updateReduxStatus({
        conversationId: selectedChat._id,
        status,
        followUpTime: status.toLowerCase().includes("follow") ? fTime : null,
        followUpActivity: status.toLowerCase().includes("follow") ? (fTime ? followUpActivity : null) : null,
        accountId: selectedChat.whatsappAccountId
      }));

      if (updateReduxStatus.fulfilled.match(resultAction)) {
        const updatedConversation = resultAction.payload;
        setConversations(prev => prev.map(c => c._id === updatedConversation._id ? { ...c, ...updatedConversation } : c));

        setShowFollowUpModal(false);
        // refetchConvs(); // Removed to prevent contact from disappearing if filters match
      }
    } catch (err) {
      alert("Error updating status: " + err.message);
    }
  };

  const handleUpdateCustomField = async (contactId, fieldName, value) => {
    if (!contactId) return;
    try {
      setIsUpdatingField(fieldName);
      const currentFields = activeContact?.customFields || {};
      const updatedFields = { ...currentFields, [fieldName]: value };
      const res = await api.put(`/contacts/${contactId}`, { customFields: updatedFields });
      setActiveContact(res.data);
      refetchConvs();
    } catch (err) {
      console.error("Error updating field:", err);
      alert("Failed to save field.");
    } finally {
      setIsUpdatingField(null);
    }
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
    e?.preventDefault();
    if (!newTimelineContent.trim() || !selectedChat?.contact?._id) return;
    try {
      const res = await api.post("/timeline", {
        contactId: selectedChat?.contact?._id,
        whatsappAccountId: selectedChat?.whatsappAccountId,
        content: newTimelineContent
      });
      setTimelineEntries([res.data, ...timelineEntries]);
      setNewTimelineContent("");
    } catch (err) {
      alert("Error adding timeline: " + (err.response?.data?.error || err.message));
    }
  };

  const handleEditTimeline = async (id, content) => {
    try {
      const res = await api.put(`/timeline/${id}`, { content });
      setTimelineEntries(prev => prev.map(e => e._id === id ? res.data : e));
    } catch (err) {
      alert("Error editing timeline: " + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteTimeline = async (id) => {
    if (!window.confirm("Are you sure you want to delete this update?")) return;
    try {
      await api.delete(`/timeline/${id}`);
      setTimelineEntries(prev => prev.filter(e => e._id !== id));
    } catch (err) {
      alert("Error deleting timeline: " + (err.response?.data?.error || err.message));
    }
  };

  // --- Helpers ---

  const formatDateLabel = useCallback((dateStr) => {
    const today = new Date().toLocaleDateString();
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString();
    if (dateStr === today) return "Today";
    if (dateStr === yesterday) return "Yesterday";
    return dateStr;
  }, []);

  const formatWhatsAppText = useCallback((text) => {
    if (!text) return "";
    let formatted = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    formatted = formatted.replace(/\*([^*]+)\*/g, "<strong>$1</strong>");
    formatted = formatted.replace(/_([^_]+)_/g, "<em>$1</em>");
    formatted = formatted.replace(/~([^~]+)~/g, "<del>$1</del>");
    formatted = formatted.replace(/`([^`]+)`/g, "<code>$1</code>");
    formatted = formatted.replace(/\n/g, "<br />");
    return formatted;
  }, []);

  const getProxiedUrl = useCallback((url, accountId) => {
    if (!url) return "";
    if (url.includes("cloudinary.com") || url.startsWith("blob:")) return url;
    const accountParam = accountId ? `&accountId=${accountId}` : "";
    return `${API_BASE}/media/proxy?url=${encodeURIComponent(url)}${accountParam}`;
  }, []);

  const messageGroups = useMemo(() => {
    const groups = {};
    messages.forEach(msg => {
      const date = new Date(msg.timestamp).toLocaleDateString();
      if (!groups[date]) groups[date] = [];
      groups[date].push(msg);
    });
    return groups;
  }, [messages]);

  const templateMap = useMemo(() => {
    const map = {};
    templates.forEach(t => { map[t.name] = t; });
    return map;
  }, [templates]);

  const filteredConversations = useMemo(() => {
    const seen = new Set();
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    const query = searchQuery.trim().toLowerCase();

    return conversations.filter(c => {
      seen.add(c._id);
      if (filter === "unread" && !(c.unreadCount > 0)) return false;
      if (filter === "window") {
        if (!c.lastCustomerMessageAt) return false;
        const lastMsgTime = typeof c.lastCustomerMessageAt === 'number' ? c.lastCustomerMessageAt : new Date(c.lastCustomerMessageAt).getTime();
        if ((now - lastMsgTime) >= twentyFourHours) return false;
      }
      if (statusFilter && statusFilter.toLowerCase() !== "all" && c.status !== statusFilter) return false;
      if (userFilter && userFilter.toLowerCase() !== "all") {
        const assignedId = typeof c.assignedTo === 'object' ? c.assignedTo?._id : c.assignedTo;
        if (userFilter === "Unassigned") {
          if (c.assignedTo) return false;
        } else if (assignedId !== userFilter) return false;
      }
      if (sectorFilter !== "all" && c.sector !== sectorFilter) return false;
      if (query) {
        if (!((c.contact?.name || "").toLowerCase().includes(query) || c.phone.includes(query) || (c.lastMessage || "").toLowerCase().includes(query))) return false;
      }
      return true;
    });
  }, [conversations, filter, statusFilter, sectorFilter, userFilter, searchQuery, chatId]);

  const listData = useMemo(() => {
    const filtered = filteredConversations || [];
    if (hasNextPage) return [...filtered, { _id: "loader-placeholder", isLoader: true }];
    return filtered;
  }, [filteredConversations, hasNextPage]);

  const accountNameMap = useMemo(() => {
    const map = {};
    if (accounts && Array.isArray(accounts)) {
      accounts.forEach(a => { if (a?._id) map[a._id] = a.name; });
    }
    return map;
  }, [accounts]);

  // --- Effects for Data Fetching & Socket ---

  useEffect(() => {
    const fetchGlobalData = async () => {
      try {
        const [execs, stats, sects, cFields] = await Promise.all([
          api.get(`/users`).catch(() => ({ data: [] })),
          api.get(`/statuses`).catch(() => ({ data: [] })),
          api.get(`/sectors`).catch(() => ({ data: [] })),
          api.get(`/custom-fields`).catch(() => ({ data: [] }))
        ]);
        setCustomStatuses(stats.data);
        setSectors(sects.data);
        setCustomFieldsDef(cFields.data);
        setExecutives(Array.isArray(execs.data) ? execs.data.filter(u => u.role === "Executive" || u.role === "Manager" || u.role === "Admin") : []);
      } catch (err) { console.error(err); }
    };
    fetchGlobalData();
  }, []);

  useEffect(() => {
    const fetchAccountData = async () => {
      try {
        const [temps, pres, quicks] = await Promise.all([
          api.get(`/templates`), api.get(`/presets`), api.get(`/quick-replies`)
        ]);
        setTemplates(Array.isArray(temps.data) ? temps.data.filter(t => t.status === "APPROVED") : []);
        setTemplatePresets(Array.isArray(pres.data) ? pres.data : []);
        setQuickReplies(Array.isArray(quicks.data) ? quicks.data : []);
      } catch (err) { console.error(err); }
    };
    fetchAccountData();
  }, [activeAccount]);

  useEffect(() => {
    const socketUrl = import.meta.env.VITE_API_URL || window.location.origin;
    const socket = io(socketUrl, { query: { userId: currentUser._id, role: currentUser.role } });

    socket.on("new_message", ({ message, conversation }) => {
      setConversations(prev => {
        const incoming10 = String(conversation.phone).replace(/\D/g, "").slice(-10);
        const index = prev.findIndex(c => String(c.phone).replace(/\D/g, "").slice(-10) === incoming10);
        const isActiveChat = selectedChatRef.current && String(selectedChatRef.current.phone).replace(/\D/g, "").slice(-10) === incoming10;

        let updatedConv;
        if (index > -1) {
          const existing = prev[index];
          updatedConv = {
            ...existing,
            ...conversation,
            lastMessage: message.body,
            lastMessageTime: message.timestamp,
            lastCustomerMessageAt: message.direction === "inbound" ? message.timestamp : existing.lastCustomerMessageAt
          };

          if (!isActiveChat && message.direction === "inbound") {
            updatedConv.unreadCount = (existing.unreadCount || 0) + 1;
          } else if (isActiveChat) {
            updatedConv.unreadCount = 0;
          }

          const filtered = prev.filter((_, i) => i !== index);
          return [updatedConv, ...filtered];
        } else {
          updatedConv = {
            ...conversation,
            unreadCount: (!isActiveChat && message.direction === "inbound") ? 1 : 0,
            lastMessage: message.body,
            lastMessageTime: message.timestamp,
            lastCustomerMessageAt: message.direction === "inbound" ? message.timestamp : conversation.lastCustomerMessageAt
          };
          return [updatedConv, ...prev];
        }
      });

      if (selectedChatRef.current && String(selectedChatRef.current.phone).replace(/\D/g, "").slice(-10) === String(conversation.phone).replace(/\D/g, "").slice(-10)) {
        dispatch(addMessage(message));
        if (message.direction === "inbound") {
          api.post("/conversations/mark-read", { phone: conversation.phone, whatsappAccountId: conversation.whatsappAccountId }).catch(console.error);
        }
      }
    });

    socket.on("status_update", ({ messageId, status }) => { dispatch(updateMessageStatus({ messageId, status })); });
    socket.on("conversation_status_update", ({ phone, status }) => { refetchConvs(); });

    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    const updateTimer = () => {
      let lastInbound = null;
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].direction === "inbound") { lastInbound = messages[i]; break; }
      }
      if (lastInbound) {
        const diff = (24 * 60 * 60 * 1000) - (Date.now() - new Date(lastInbound.timestamp).getTime());
        if (diff > 0) {
          const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000);
          setWindowTimeLeft(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
        } else setWindowTimeLeft(null);
      } else setWindowTimeLeft(null);
    };
    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [messages]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !selectedChat) return;
    setPendingImage({ file, previewUrl: URL.createObjectURL(file) });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const unreadCountTotal = useMemo(() => conversations.filter(c => c.unreadCount > 0).length, [conversations]);

  return (
    <div className="chat-container" style={{
      display: "grid",
      gridTemplateColumns: showContactInfo ? "350px 1fr 350px" : "350px 1fr",
      height: "100vh", width: "100%", maxWidth: "100%", margin: 0, padding: 0, overflow: "hidden", background: "var(--bg-secondary)", position: "relative"
    }}>
      <style>{`
        .sidebar-list-container { overflow: hidden !important; }
        .chat-scroll::-webkit-scrollbar { width: 6px !important; }
        .chat-scroll::-webkit-scrollbar-track { background: transparent !important; }
        .chat-scroll::-webkit-scrollbar-thumb { background: #ced0d1 !important; border-radius: 10px; }
        .chat-item:hover { background: #f5f6f6 !important; }
        .chat-item.active { background: #f0f2f5 !important; border-left: 4px solid var(--accent-primary) !important; }
        .msg-bubble { max-width: 65%; padding: 8px 12px; font-size: 0.9rem; margin-bottom: 4px; line-height: 1.4; box-shadow: 0 1px 0.5px rgba(0,0,0,0.13); position: relative; }
        .msg-outbound { align-self: flex-end !important; background-color: #d9fdd3 !important; color: #111b21 !important; border-radius: 8px 0 8px 8px; }
        .msg-inbound { align-self: flex-start !important; background-color: #ffffff !important; color: #111b21 !important; border-radius: 0 8px 8px 8px; }
      `}</style>

      <ChatSidebar
        searchQuery={searchQuery} setSearchQuery={setSearchQuery}
        selectedAccountIds={selectedAccountIds} setSelectedAccountIds={setSelectedAccountIds}
        accounts={accounts} activeAccount={activeAccount} switchAccount={switchAccount}
        filter={filter} setFilter={setFilter}
        statusFilter={statusFilter} setStatusFilter={setStatusFilter}
        userFilter={userFilter} setUserFilter={setUserFilter}
        sectorFilter={sectorFilter} setSectorFilter={setSectorFilter}
        allStatusOptions={allStatusOptions} executives={executives} sectors={sectors}
        setShowManageModal={setShowManageModal} setShowNewChatModal={setShowNewChatModal}
        listData={listData} selectedChat={selectedChat} navigate={navigate}
        accountNameMap={accountNameMap} hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage} fetchNextPage={fetchNextPage}
        unreadCountTotal={unreadCountTotal} currentUser={currentUser}
        showAccountDropdown={showAccountDropdown} setShowAccountDropdown={setShowAccountDropdown}
        accountDropdownRef={accountDropdownRef}
      />

      <ChatArea
        selectedChat={selectedChat} accounts={accounts} messages={messages}
        isFetchingMsgs={isFetchingMsgs} messageGroups={messageGroups}
        templateMap={templateMap} formatWhatsAppText={formatWhatsAppText}
        getProxiedUrl={getProxiedUrl} templates={templates}
        windowTimeLeft={windowTimeLeft} handleMessageScroll={handleMessageScroll}
        scrollRef={scrollRef} newMessage={newMessage} setNewMessage={setNewMessage}
        isSendingMsg={isSendingMsg} isUploading={isUploading} handleSend={handleSend}
        showEmojiPicker={showEmojiPicker} setShowEmojiPicker={setShowEmojiPicker}
        emojiPickerRef={emojiPickerRef} showQuickReplies={showQuickReplies}
        setShowQuickReplies={setShowQuickReplies} quickRepliesRef={quickRepliesRef}
        quickReplies={quickReplies} pendingImage={pendingImage}
        setPendingImage={setPendingImage} fileInputRef={fileInputRef}
        handleImageUpload={handleImageUpload} setShowTemplateModal={setShowTemplateModal}
        setShowContactInfo={setShowContactInfo} showContactInfo={showContactInfo}
        formatDateLabel={formatDateLabel}
      />

      <ContactDetailSidebar
        showContactInfo={showContactInfo} setShowContactInfo={setShowContactInfo}
        selectedChat={selectedChat} activeContact={activeContact}
        setShowTimelineModal={setShowTimelineModal} fetchTimelineEntries={fetchTimelineEntries}
        allStatusOptions={allStatusOptions} handleUpdateStatus={handleUpdateStatus}
        sectors={sectors} handleAssign={handleAssign}
        executives={executives} customFieldsDef={customFieldsDef}
        isUpdatingField={isUpdatingField} handleUpdateCustomField={handleUpdateCustomField}
        setActiveContact={setActiveContact}
      />

      <TemplateModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        templates={templates}
        presets={templatePresets}
        selectedChat={selectedChat}
        onSend={handleSendTemplate}
      />

      <TimelineModal
        isOpen={showTimelineModal}
        onClose={() => setShowTimelineModal(false)}
        entries={timelineEntries}
        contactName={activeContact?.name || selectedChat?.phone}
        onAdd={handleAddTimeline}
        onEdit={handleEditTimeline}
        onDelete={handleDeleteTimeline}
        content={newTimelineContent}
        setContent={setNewTimelineContent}
        currentUser={currentUser}
        isLoading={isTimelineLoading}
      />

      <ManageStatusSectorModal
        isOpen={!!showManageModal}
        initialType={showManageModal?.type}
        onClose={() => setShowManageModal(false)}
        allStatusOptions={allStatusOptions}
        sectors={sectors}
        onAdd={handleAddStatusSector}
        onUpdate={handleUpdateStatusSector}
        onDelete={handleDeleteStatusSector}
      />

      <NewChatModal
        isOpen={showNewChatModal}
        onClose={() => setShowNewChatModal(false)}
        accounts={accounts}
        onStart={handleStartNewChat}
      />

      <FollowUpModal
        isOpen={showFollowUpModal}
        onClose={() => setShowFollowUpModal(false)}
        onConfirm={(time, activity) => {
          setFollowUpTime(time);
          setFollowUpActivity(activity);
          handleUpdateStatus(pendingStatus, time);
        }}
        initialDate={followUpDate}
        initialTime={followUpTime}
      />
    </div>
  );
};

export default memo(ChatModule);
