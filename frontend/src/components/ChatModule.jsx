import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import axios from "axios";
import { Loader2, Clock, Check } from "lucide-react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
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
  updateMessageReaction,
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
  const location = useLocation();
  const { accounts, activeAccount, switchAccount } = useWhatsAppAccount();
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [templatePresets, setTemplatePresets] = useState([]);
  const [quickReplies, setQuickReplies] = useState([]);
  const [replyToMessage, setReplyToMessage] = useState(null);
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

  const lastFetchParamsRef = useRef(null);
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
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [currentReminder, setCurrentReminder] = useState(null);
  const [uiNotifications, setUiNotifications] = useState([]);

  const markNotificationsAsRead = () => {
    setUiNotifications([]);
  };

  const handleReminderAction = (action, reminder) => {
    if (action === "chat") {
      handleNotificationClick(reminder);
      setShowReminderModal(false);
    } else {
      // Later - keep it in uiNotifications but close modal
      setShowReminderModal(false);
    }
  };

  const handleNotificationClick = (notif) => {
    if (notif.conversation) {
      const target = notif.conversation;

      // 1. Auto-switch account if the chat belongs to a different instance
      if (activeAccount && target.whatsappAccountId && target.whatsappAccountId !== activeAccount._id) {
        const targetAcc = accounts.find(a => a._id === target.whatsappAccountId);
        if (targetAcc) switchAccount(targetAcc);
      }

      // 2. Clear filters to ensure the chat is visible
      dispatch(setReduxFilter("all"));
      dispatch(setReduxStatusFilter("all"));
      dispatch(setReduxSearchQuery(""));

      // 3. Select and Navigate
      if (target._id) {
        navigate(`/chats/${target._id}`);
      }
    }
  };

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // --- Logic Functions ---

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadConversations = useCallback(async (cursor = null) => {
    const accIds = selectedAccountIds.length > 0 ? selectedAccountIds.join(",") : activeAccount?._id;
    
    // Skip redundant fresh loads if the query parameters haven't changed
    const currentParams = {
      accIds,
      statusFilter,
      userFilter,
      sectorFilter,
      debouncedSearch,
      filter
    };

    if (!cursor && lastFetchParamsRef.current && 
        JSON.stringify(lastFetchParamsRef.current) === JSON.stringify(currentParams)) {
      return;
    }

    if (!cursor) {
      lastFetchParamsRef.current = currentParams;
    }

    setIsFetchingNextPage(true);
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

      let finalConvs = newConvs;
      const currentChatId = window.location.pathname.split("/").pop();

      if (!cursor && currentChatId) {
        const cleanCurrentChatId = currentChatId.replace(/\D/g, "");
        const isPresent = newConvs.find(c => {
          if (c._id === currentChatId) return true;
          const cleanPhone = c.phone ? c.phone.replace(/\D/g, "") : "";
          if (cleanPhone && cleanPhone === cleanCurrentChatId) return true;
          if (currentChatId.startsWith("new:") && cleanPhone === currentChatId.split(":")[1].replace(/\D/g, "")) return true;
          return false;
        });

        if (!isPresent && currentChatId.length > 5) {
          try {
            let res;
            if (/^[0-9a-fA-F]{24}$/.test(currentChatId)) {
              res = await api.get(`/conversations/${currentChatId}`);
            } else {
              res = await api.get(`/conversations/resolve?phone=${currentChatId.replace("new:", "")}&accountId=${activeAccount?._id}`);
            }
            const chatData = res.data?.conversation || res.data;
            if (chatData && chatData._id) {
              const chatToInsert = chatData;
              // Find the correct sorted position (by lastMessageTime)
              const insertIndex = newConvs.findIndex(c =>
                new Date(c.lastMessageTime) < new Date(chatToInsert.lastMessageTime)
              );
              if (insertIndex === -1) {
                finalConvs = [...newConvs, chatToInsert];
              } else {
                finalConvs = [
                  ...newConvs.slice(0, insertIndex),
                  chatToInsert,
                  ...newConvs.slice(insertIndex)
                ];
              }
            }
          } catch (err) {
            console.error("Could not fetch missing chat", err);
          }
        }
      }

      if (!cursor) {
        setConversations(finalConvs);
      } else {
        setConversations(prev => [...(Array.isArray(prev) ? prev : []), ...newConvs]);
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

  const refetchConvs = () => {
    lastFetchParamsRef.current = null;
    loadConversations();
  };

  const selectedChat = useMemo(() => {
    if (!chatId) return null;
    if (chatId.startsWith("new:")) {
      const phone = chatId.split(":")[1];
      const params = new URLSearchParams(location.search);
      const accountId = params.get("accountId") || activeAccount?._id;
      return { phone, status: "New", isNew: true, whatsappAccountId: accountId };
    }
    const found = conversations.find(c => c._id === chatId || c.phone === chatId);
    if (found) return found;
    
    // If it's a phone number (not a 24-char ObjectId)
    if (!/^[0-9a-fA-F]{24}$/.test(chatId)) {
      return { phone: chatId, status: "New", isPlaceholder: true, whatsappAccountId: activeAccount?._id };
    }
    return { _id: chatId, isPlaceholder: true };
  }, [chatId, conversations, activeAccount, location.search]);

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
      if (selectedChat.whatsappAccountId && selectedChat.whatsappAccountId !== activeAccount?._id) {
        const targetAcc = accounts.find(a => a._id === selectedChat.whatsappAccountId);
        if (targetAcc) switchAccount(targetAcc);
      }
      if (selectedChat.contact) {
        // If it's already an object, just use it
        if (typeof selectedChat.contact === 'object') {
          setActiveContact(selectedChat.contact);
        } else {
          // If it's a string ID, try to keep the old object if it matches, otherwise we might need a fetch
          setActiveContact(prev => (prev && prev._id === selectedChat.contact) ? prev : { _id: selectedChat.contact });
        }
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
        setActiveContact(null);
      }
      if (!selectedChat.phone) return;
      fetchMessages(selectedChat.phone);

      // Mark as read in the BACKGROUND (backend only)
      // This ensures that after a refresh, it will be seen as read.
      if (!selectedChat.isNew) {
        api.post("/conversations/mark-read", {
          phone: selectedChat.phone
        }, {
          headers: { "x-whatsapp-account-id": selectedChat.whatsappAccountId }
        }).catch(console.error);
      }
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

  const handleAssign = async (userId, sector, subsector) => {
    if (!selectedChat) return;
    try {
      const payload = { phone: selectedChat.phone };
      if (userId !== undefined) payload.userId = userId;
      if (sector !== undefined) payload.sector = sector;
      if (subsector !== undefined) payload.subsector = subsector;

      const res = await api.patch(`/conversations/assign`, payload, {
        headers: { "x-whatsapp-account-id": selectedChat.whatsappAccountId }
      });

      const updatedConv = res.data.conversation;

      // Update local list
      setConversations(prev => prev.map(c => c._id === updatedConv._id ? { ...c, ...updatedConv } : c));

      if (activeContact && (activeContact._id === updatedConv.contact?._id || activeContact._id === updatedConv.contact)) {
        const updatedContactObj = typeof updatedConv.contact === 'object' ? updatedConv.contact : {};
        setActiveContact(prev => ({
          ...prev,
          ...updatedContactObj,
          assignedTo: updatedConv.assignedTo,
          sector: updatedContactObj.sector || updatedConv.sector || prev.sector,
          subsector: updatedContactObj.subsector || updatedConv.subsector || prev.subsector
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
          mediaUrl: previewUrl, direction: "outbound", status: "sending", timestamp: new Date().toISOString()
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

          let isDocument = false;
          let filename = "image.jpg";

          if (file) {
            isDocument = file.type !== "image/jpeg" && file.type !== "image/png" && file.type !== "image/webp";
            filename = file.name;
          } else if (pendingImage.isRemote) {
            const urlLower = pendingImage.remoteUrl.toLowerCase();
            if (urlLower.endsWith(".pdf") || urlLower.endsWith(".doc") || urlLower.endsWith(".docx") || urlLower.endsWith(".xls") || urlLower.endsWith(".xlsx")) {
              isDocument = true;
              filename = "document.file";
            } else {
              isDocument = false;
              filename = "image.jpg";
            }
          }

          const resultAction = await dispatch(sendReduxImage({
            to: selectedChat.phone,
            imageUrl,
            caption,
            accountId: selectedChat.whatsappAccountId,
            type: isDocument ? "document" : "image",
            filename: filename
          }));

          if (sendReduxImage.fulfilled.match(resultAction)) {
            const { message, conversation } = resultAction.payload;
            dispatch(updateMessageStatus({ tempId, realMsg: message }));

            // Instantly update local conversations list to clear unread and move to top
            if (conversation) {
              setConversations(prev => {
                const filtered = prev.filter(c => c._id !== conversation._id);
                return [conversation, ...filtered];
              });
            }
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
          direction: "outbound", status: "sending", timestamp: new Date().toISOString(),
          quotedMessageId: replyToMessage ? replyToMessage.messageId : undefined,
          quotedMessageBody: replyToMessage ? replyToMessage.body : undefined
        };

        dispatch(addMessage(optimisticMsg));
        setNewMessage("");
        const replyId = replyToMessage ? replyToMessage.messageId : null;
        console.log("DEBUG SENDING REPLY: replyToMessage is", replyToMessage, "replyId is", replyId);
        setReplyToMessage(null);

        try {
          const resultAction = await dispatch(sendReduxMessage({
            to: selectedChat.phone, body: text, accountId: selectedChat.whatsappAccountId,
            quotedMessageId: replyId
          }));

          if (sendReduxMessage.fulfilled.match(resultAction)) {
            const { message, conversation } = resultAction.payload;
            dispatch(updateMessageStatus({ tempId, realMsg: message }));

            // Instantly update local conversations list to clear unread and move to top
            if (conversation) {
              setConversations(prev => {
                const filtered = prev.filter(c => c._id !== conversation._id);
                return [conversation, ...filtered];
              });
            }
            refetchConvs();

            // NEW: Clear follow-up notifications when message is sent
            setUiNotifications(prev => prev.filter(n =>
              !n.conversation || (String(n.conversation.phone).replace(/\D/g, "").slice(-10) !== String(selectedChat.phone).replace(/\D/g, "").slice(-10))
            ));

            // NEW: If Admin replies to an assigned chat, notify the specialist
            const assignedToId = typeof conversation.assignedTo === 'object' ? conversation.assignedTo?._id : conversation.assignedTo;
            if (currentUser.role === "Admin" && assignedToId && String(assignedToId) !== String(currentUser._id)) {
              api.post("/messages/notify-admin-reply", {
                phone: selectedChat.phone,
                assignedTo: assignedToId,
                adminName: currentUser.name
              }).catch(console.error);
            }
          } else {
            throw new Error(resultAction.payload || "Failed to send message");
          }
        } catch (err) {
          dispatch(updateMessageStatus({ tempId, realMsg: { ...optimisticMsg, status: "failed" } }));
          alert("Error: " + (err.response?.data?.error || "Failed to send message"));
        }

        // NEW: Clear assignment notifications for this chat because executive replied
        setUiNotifications(prev => prev.filter(n =>
          !n.conversation || String(n.conversation.phone).replace(/\D/g, "").slice(-10) !== String(selectedChat.phone).replace(/\D/g, "").slice(-10)
        ));
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
        const { message, conversation } = res.data;
        dispatch(addMessage(message));

        // Instantly update local conversations list to clear unread and move to top
        if (conversation) {
          setConversations(prev => {
            const filtered = prev.filter(c => c._id !== conversation._id);
            return [conversation, ...filtered];
          });
        }
        refetchConvs();

        // Clear assignment notifications on template reply too
        setUiNotifications(prev => prev.filter(n =>
          !n.conversation || String(n.conversation.phone).replace(/\D/g, "").slice(-10) !== String(selectedChat.phone).replace(/\D/g, "").slice(-10)
        ));
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

    // Check if status is Follow-up (case-insensitive check for 'follow')
    const isFollowUp = status.toLowerCase().includes("follow");

    if (isFollowUp && !fTime) {
      setPendingStatus(status);

      // Set default date to TODAY (YYYY-MM-DD)
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      setFollowUpDate(today);

      // Set default time to NOW (HH:mm)
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      setFollowUpTime(`${hours}:${minutes}`);

      // Reset activity
      setFollowUpActivity("");

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
      // Only update local contact state — do NOT refetchConvs() here as it causes
      // the chat to scroll to the last message unnecessarily.
      setActiveContact(res.data);
    } catch (err) {
      console.error("Error updating field:", err);
      alert("Failed to save field.");
    } finally {
      setIsUpdatingField(null);
    }
  };

  const fetchTimelineEntries = async (idFromProp) => {
    // Priority: 1. ID passed from prop, 2. activeContact ID/string, 3. selectedChat contact ID/string
    const contactId = idFromProp || activeContact?._id || activeContact || selectedChat?.contact?._id || selectedChat?.contact;
    if (!contactId || typeof contactId !== 'string' && !contactId?._id) return;

    const finalId = typeof contactId === 'string' ? contactId : contactId._id;

    try {
      setIsTimelineLoading(true);
      const res = await api.get(`/timeline/${finalId}`, {
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
    const contactId = selectedChat?.contact?._id || selectedChat?.contact;
    if (!newTimelineContent.trim() || !contactId) return;
    try {
      const res = await api.post("/timeline", {
        contactId,
        whatsappAccountId: selectedChat?.whatsappAccountId,
        content: newTimelineContent
      });
      setTimelineEntries(prev => [res.data, ...prev]);
      setNewTimelineContent("");

      // NEW: Clear follow-up notification when timeline is added
      setUiNotifications(prev => prev.filter(n =>
        !n.conversation || (String(n.conversation.phone).replace(/\D/g, "").slice(-10) !== String(selectedChat.phone).replace(/\D/g, "").slice(-10))
      ));
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

    // Hyperlink matching: format http/https/ftp or standard domains as clickable <a> tags
    const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    formatted = formatted.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #039be5; text-decoration: underline; word-break: break-all;">$1</a>');

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
        if (userFilter === "unassigned") {
          if (assignedId) return false;
        } else if (assignedId !== userFilter) return false;
      }
      if (sectorFilter && sectorFilter.toLowerCase() !== "all" && c.sector !== sectorFilter) return false;
      if (query) {
        if (!((c.contact?.name || "").toLowerCase().includes(query) || c.phone.includes(query) || (c.lastMessage || "").toLowerCase().includes(query))) return false;
      }
      if (c._id === chatId) return true;
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
    setReplyToMessage(null);
  }, [chatId]);

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
      // RBAC: Executives should only see chats assigned to them
      if (currentUser.role === "Executive") {
        const assignedId = conversation.assignedTo?._id || conversation.assignedTo;
        if (String(assignedId) !== String(currentUser._id)) {
          return; // Ignore updates for chats not assigned to this executive
        }
      }

      setConversations(prev => {
        const incoming10 = String(conversation.phone).replace(/\D/g, "").slice(-10);
        const index = prev.findIndex(c => String(c.phone).replace(/\D/g, "").slice(-10) === incoming10);
        const isActiveChat = selectedChatRef.current && String(selectedChatRef.current.phone).replace(/\D/g, "").slice(-10) === incoming10;

        let updatedConv;
        if (index > -1) {
          const existing = prev[index];
          updatedConv = {
            ...existing,
            ...conversation, // This includes the new unreadCount from DB
            contact: conversation.contact?._id ? conversation.contact : (existing.contact || conversation.contact), // Don't de-populate
            lastMessage: message.body,
            lastMessageTime: message.timestamp,
            lastCustomerMessageAt: message.direction === "inbound" ? message.timestamp : existing.lastCustomerMessageAt
          };

          // If it's an inbound message and NOT the active chat, ensure unreadCount is at least incremented
          // But since 'conversation' from socket already has updated count, we just use it.
          // We only force increment if for some reason conversation object didn't have it.
          if (message.direction === "inbound" && !isActiveChat && updatedConv.unreadCount <= existing.unreadCount) {
            updatedConv.unreadCount = (existing.unreadCount || 0) + 1;
          } else if (isActiveChat) {
            updatedConv.unreadCount = 0;
          }

          const filtered = prev.filter((_, i) => i !== index);
          return [updatedConv, ...filtered];
        } else {
          updatedConv = {
            ...conversation,
            unreadCount: (message.direction === "inbound" && !isActiveChat) ? (conversation.unreadCount || 1) : 0,
            lastMessage: message.body,
            lastMessageTime: message.timestamp,
            lastCustomerMessageAt: message.direction === "inbound" ? message.timestamp : conversation.lastCustomerMessageAt
          };
          return [updatedConv, ...prev];
        }
      });

      if (selectedChatRef.current && String(selectedChatRef.current.phone).replace(/\D/g, "").slice(-10) === String(conversation.phone).replace(/\D/g, "").slice(-10)) {
        dispatch(addMessage(message));
        // Mark as read in backend background for active chat
        if (message.direction === "inbound") {
          api.post("/conversations/mark-read", { phone: conversation.phone }, {
            headers: { "x-whatsapp-account-id": conversation.whatsappAccountId }
          }).catch(console.error);
        }
      }
    });

    socket.on("status_update", ({ messageId, status }) => { dispatch(updateMessageStatus({ messageId, status })); });
    socket.on("message_reaction", ({ messageId, reaction }) => { dispatch(updateMessageReaction({ messageId, reaction })); });
    socket.on("conversation_status_update", ({ phone, status }) => { refetchConvs(); });

    socket.on("chat_assigned", ({ conversation, isNewAssignment = true }) => {
      const assignedToId = typeof conversation.assignedTo === 'object' ? conversation.assignedTo?._id : conversation.assignedTo;
      if (assignedToId === currentUser._id && isNewAssignment) {
        const contactName = conversation.contact?.name || conversation.phone;

        // 1. Browser Notification
        if (Notification.permission === "granted") {
          new Notification("New Chat Assigned", {
            body: `Admin assigned a chat to you: ${contactName}`,
          });
        }

        // 2. Sound Alert
        try {
          startFollowUpAlarm();
        } catch (e) { console.error("Sound error", e); }

        // 3. UI Notification
        const newNotif = {
          id: Date.now(),
          message: `New Chat Assigned: ${contactName}`,
          conversation: conversation
        };
        setUiNotifications(prev => [newNotif, ...prev]);
      }
      // Local update instead of full refetch to keep list order stable
      setConversations(prev => prev.map(c => c._id === conversation._id ? { ...c, ...conversation } : c));
    });

    socket.on("followup_reminder", ({ conversation }) => {
      // Logic: Admins do NOT see followup reminders. Only the assigned specialist sees theirs.
      if (currentUser.role === "Admin") return;

      const assignedToId = typeof conversation.assignedTo === 'object' ? conversation.assignedTo?._id : conversation.assignedTo;
      const isMyReminder = assignedToId && String(assignedToId) === String(currentUser._id);

      if (!isMyReminder) return;

      const contactName = conversation.contact?.name || conversation.phone;

      // 1. Sound Alert
      try {
        startFollowUpAlarm();
      } catch (e) { console.error("Sound error", e); }

      // 2. Browser Notification
      if (Notification.permission === "granted") {
        new Notification("🔔 Follow-up Due!", {
          body: `Time to follow up with: ${contactName}`,
          icon: "/favicon.ico"
        });
      }

      // 3. UI Notification Popup
      const newNotif = {
        id: Date.now(),
        message: `🔔 Follow-up Due: ${contactName}`,
        conversation: conversation,
        type: "reminder"
      };
      setUiNotifications(prev => [newNotif, ...prev]);

      // 4. Show BIG Center Modal
      setCurrentReminder(newNotif);
      setShowReminderModal(true);
    });

    socket.on("admin_replied_alert", ({ phone, adminName, conversation }) => {
      // Logic: Don't show to the Admin who just replied
      if (adminName === currentUser.name) return;

      // Only show to the assigned specialist or other admins (if needed)
      const assignedToId = typeof conversation?.assignedTo === 'object' ? conversation.assignedTo?._id : conversation?.assignedTo;
      if (currentUser.role !== "Admin" && String(assignedToId) !== String(currentUser._id)) return;

      const newNotif = {
        id: Date.now(),
        message: `👤 Admin (${adminName}) has replied to chat: ${phone}`,
        type: "admin_reply"
      };
      setUiNotifications(prev => [newNotif, ...prev]);

      // Auto-remove admin reply alert after 30s
      setTimeout(() => {
        setUiNotifications(prev => prev.filter(n => n.id !== newNotif.id));
      }, 30000);
    });

    socket.on("missed_followup_alert", ({ conversation }) => {
      // Admins see all, Executives see theirs
      const assignedToId = typeof conversation.assignedTo === 'object' ? conversation.assignedTo?._id : conversation.assignedTo;
      if (currentUser.role !== "Admin" && String(assignedToId) !== String(currentUser._id)) return;

      const contactName = conversation.contact?.name || conversation.phone;

      // 1. Heavy Sound Alert
      try {
        startFollowUpAlarm();
      } catch (e) { console.error("Sound error", e); }

      // 2. Persistent Notification
      const newNotif = {
        id: Date.now(),
        message: `⚠️ MISSED Follow-up: ${contactName}`,
        conversation: conversation,
        type: "missed_alert"
      };
      setUiNotifications(prev => [newNotif, ...prev]);
    });

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

  const handleMediaUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !selectedChat) return;
    const isImage = file.type.startsWith("image/");
    setPendingImage({
      file,
      previewUrl: isImage ? URL.createObjectURL(file) : null,
      isImage,
      name: file.name
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const unreadCountTotal = useMemo(() => conversations.filter(c => c.unreadCount > 0).length, [conversations]);

  return (
    <div className="chat-container" style={{
      display: "grid",
      gridTemplateColumns: showContactInfo ? "350px 1fr 350px" : "350px 1fr",
      height: "100vh", width: "100%", maxWidth: "100%", margin: 0, padding: 0, overflow: "hidden", background: "var(--bg-secondary)", position: "relative"
    }}>
      {/* UI Notifications Overlay */}
      <div style={{ position: "fixed", top: "20px", right: "20px", zIndex: 10000, display: "flex", flexDirection: "column", gap: "10px" }}>
        {uiNotifications.map(n => (
          <div key={n.id} style={{
            background: "#00a884", color: "white", padding: "12px 24px", borderRadius: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)", fontWeight: "bold", animation: "slideIn 0.3s ease-out"
          }}>
            {n.message}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .sidebar-list-container { overflow: hidden !important; }
        .chat-scroll::-webkit-scrollbar { width: 6px !important; }
        .chat-scroll::-webkit-scrollbar-track { background: transparent !important; }
        .chat-scroll::-webkit-scrollbar-thumb { background: #ced0d1 !important; border-radius: 10px; }
        .chat-item:hover { background: #f0f2f5 !important; }
        .chat-item.active { background: #e7fce3 !important; border-left: 4px solid #00a884 !important; }
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
        uiNotifications={uiNotifications}
        markNotificationsAsRead={markNotificationsAsRead}
        handleNotificationClick={handleNotificationClick}
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
        handleMediaUpload={handleMediaUpload} setShowTemplateModal={setShowTemplateModal}
        setShowContactInfo={setShowContactInfo} showContactInfo={showContactInfo}
        formatDateLabel={formatDateLabel}
        replyToMessage={replyToMessage} setReplyToMessage={setReplyToMessage}
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

      {/* NEW: Center Reminder Modal */}
      {showReminderModal && currentReminder && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 11000, backdropFilter: "blur(4px)" }}>
          <div style={{ background: "white", borderRadius: "20px", width: "420px", padding: "30px", textAlign: "center", boxShadow: "0 20px 40px rgba(0,0,0,0.2)", animation: "popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>
            <div style={{ width: "80px", height: "80px", borderRadius: "50%", background: "#fff1f2", color: "#e11d48", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <Clock size={40} />
            </div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: "800", color: "#1e293b", marginBottom: "10px" }}>Follow-up Due!</h2>
            <p style={{ color: "#64748b", fontSize: "1rem", marginBottom: "25px", lineHeight: "1.5" }}>
              It's time to follow up with <br />
              <strong style={{ color: "#1e293b", fontSize: "1.1rem" }}>{currentReminder.message.split(": ")[1]}</strong>
            </p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => handleReminderAction("later", currentReminder)}
                style={{ flex: 1, padding: "14px", borderRadius: "12px", border: "1.5px solid #e2e8f0", background: "white", color: "#64748b", fontWeight: "700", cursor: "pointer", transition: "all 0.2s" }}
                onMouseOver={e => e.currentTarget.style.background = "#f8fafc"}
                onMouseOut={e => e.currentTarget.style.background = "white"}
              >
                Later
              </button>
              <button
                onClick={() => handleReminderAction("chat", currentReminder)}
                style={{ flex: 1, padding: "14px", borderRadius: "12px", border: "none", background: "#00a884", color: "white", fontWeight: "700", cursor: "pointer", boxShadow: "0 4px 12px rgba(0,168,132,0.3)", transition: "all 0.2s" }}
                onMouseOver={e => e.currentTarget.style.transform = "translateY(-2px)"}
                onMouseOut={e => e.currentTarget.style.transform = "translateY(0)"}
              >
                Chat Now
              </button>
            </div>
          </div>
          <style>{`
              @keyframes popIn {
                from { transform: scale(0.8); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
              }
           `}</style>
        </div>
      )}
    </div>
  );
};

export default memo(ChatModule);
