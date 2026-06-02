import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Plus,
  Trash2,
  Edit2,
  Search,
  Bot,
  Zap,
  CheckCircle2,
  XCircle,
  MessageSquare,
  AlertCircle,
  Clock,
  Key,
  Image as ImageIcon,
  PlusCircle,
  ArrowUp,
  ArrowDown,
  Loader2,
  Link
} from "lucide-react";
import FollowUpAutomation from "./FollowUpAutomation";
import QuickReplyManager from "./QuickReplyManager";
import KeywordStatusAutomation from "./KeywordStatusAutomation";
import { useWhatsAppAccount } from "../WhatsAppAccountContext";

const API_BASE = import.meta.env.VITE_API_URL || "";

const AutoReplyManager = () => {
  const { accounts } = useWhatsAppAccount();
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("keywords");
  
  const [executives, setExecutives] = useState([]);
  const [customStatuses, setCustomStatuses] = useState([]);
  const [quickReplies, setQuickReplies] = useState([]);
  const [uploadingIndex, setUploadingIndex] = useState(null);

  const [formData, setFormData] = useState({
    keyword: "",
    response: "",
    matchType: "CONTAINS",
    isActive: true,
    delay: 0,
    whatsappAccountIds: [],
    replies: [{ type: "text", text: "", mediaUrl: "", quickReplyId: "", delay: 0 }]
  });
  const [editingId, setEditingId] = useState(null);

  const currentUser = JSON.parse(localStorage.getItem("userInfo"));
  const config = { headers: { Authorization: `Bearer ${currentUser?.token}` } };

  useEffect(() => {
    fetchReplies();
    fetchExecutives();
    fetchCustomStatuses();
    fetchQuickReplies();
  }, []);

  const fetchExecutives = async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/api/users`, config);
      setExecutives(data.filter(u => u.role === "Executive" || u.role === "Admin"));
    } catch (err) { console.error(err); }
  };

  const fetchCustomStatuses = async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/api/statuses`, config);
      setCustomStatuses(data);
    } catch (err) { console.error(err); }
  };

  const fetchQuickReplies = async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/api/quick-replies`, config);
      setQuickReplies(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
  };

  const fetchReplies = async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/api/auto-replies`, config);
      setReplies(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setReplies([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Validate that keyword is set
      if (!formData.keyword.trim()) {
        alert("Please specify a trigger keyword.");
        return;
      }

      // Sanitize replies to avoid sending empty string ObjectIds or unneeded fields
      const sanitizedReplies = formData.replies.map(reply => {
        const r = { ...reply };
        if (!r.quickReplyId || r.quickReplyId.trim() === "") {
          delete r.quickReplyId;
        }
        if (r.type !== "quick_reply") {
          delete r.quickReplyId;
        }
        if (r.type !== "image") {
          delete r.mediaUrl;
        }
        return r;
      });

      // Sync the main response field with the first reply for fallback compatibility
      const mainResponse = sanitizedReplies.length > 0 ? (sanitizedReplies[0].text || "Media Reply") : "";
      const mainDelay = sanitizedReplies.length > 0 ? (sanitizedReplies[0].delay || 0) : 0;
      
      const payload = {
        ...formData,
        response: mainResponse,
        delay: mainDelay,
        replies: sanitizedReplies
      };

      if (editingId) {
        await axios.put(`${API_BASE}/api/auto-replies/${editingId}`, payload, config);
      } else {
        await axios.post(`${API_BASE}/api/auto-replies`, payload, config);
      }
      setShowModal(false);
      resetForm();
      fetchReplies();
    } catch (err) {
      alert(err.response?.data?.error || "Something went wrong");
    }
  };

  const handleEdit = (reply) => {
    setEditingId(reply._id);
    let initialReplies = reply.replies || [];
    if (initialReplies.length === 0 && reply.response) {
      initialReplies = [{ type: "text", text: reply.response, mediaUrl: "", quickReplyId: "", delay: reply.delay || 0 }];
    }
    if (initialReplies.length === 0) {
      initialReplies = [{ type: "text", text: "", mediaUrl: "", quickReplyId: "", delay: 0 }];
    }
    setFormData({
      keyword: reply.keyword,
      response: reply.response || "",
      matchType: reply.matchType,
      isActive: reply.isActive,
      delay: reply.delay || 0,
      whatsappAccountIds: reply.whatsappAccountIds || [],
      replies: initialReplies
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this auto-reply?")) return;
    try {
      await axios.delete(`${API_BASE}/api/auto-replies/${id}`, config);
      fetchReplies();
    } catch (err) {
      console.error(err);
    }
  };

  const toggleStatus = async (reply) => {
    try {
      await axios.put(`${API_BASE}/api/auto-replies/${reply._id}`, { isActive: !reply.isActive }, config);
      fetchReplies();
    } catch (err) {
      console.error(err);
    }
  };

  const resetForm = () => {
    setFormData({
      keyword: "",
      response: "",
      matchType: "CONTAINS",
      isActive: true,
      delay: 0,
      whatsappAccountIds: [],
      replies: [{ type: "text", text: "", mediaUrl: "", quickReplyId: "", delay: 0 }]
    });
    setEditingId(null);
  };

  const handleAddReply = () => {
    setFormData({
      ...formData,
      replies: [...formData.replies, { type: "text", text: "", mediaUrl: "", quickReplyId: "", delay: 2 }]
    });
  };

  const handleRemoveReply = (index) => {
    const updated = formData.replies.filter((_, i) => i !== index);
    setFormData({ ...formData, replies: updated });
  };

  const handleReplyChange = (index, field, value) => {
    const updated = [...formData.replies];
    updated[index][field] = value;
    setFormData({ ...formData, replies: updated });
  };

  const handleMoveReply = (index, direction) => {
    const updated = [...formData.replies];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= updated.length) return;
    // Swap
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setFormData({ ...formData, replies: updated });
  };

  const handleFileChange = async (index, e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingIndex(index);
    try {
      const uploadData = new FormData();
      uploadData.append("file", file);
      const uploadRes = await axios.post(`${API_BASE}/api/upload`, uploadData, {
        headers: { 
          ...config.headers,
          "Content-Type": "multipart/form-data" 
        }
      });
      handleReplyChange(index, "mediaUrl", uploadRes.data.url);
    } catch (err) {
      alert("Error uploading image: " + (err.response?.data?.error || err.message));
    } finally {
      setUploadingIndex(null);
    }
  };

  const filteredReplies = replies.filter(r => {
    const term = search.toLowerCase();
    const keywordMatch = r.keyword.toLowerCase().includes(term);
    const mainResponseMatch = (r.response || "").toLowerCase().includes(term);
    const subRepliesMatch = r.replies && r.replies.some(sub => 
      (sub.text || "").toLowerCase().includes(term)
    );
    return keywordMatch || mainResponseMatch || subRepliesMatch;
  });

  return (
    <div style={{ padding: "30px", background: "#f0f2f5", minHeight: "100vh", fontFamily: "Segoe UI, sans-serif" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>

        {/* Header Section */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "24px", fontWeight: "700", color: "#111b21", display: "flex", alignItems: "center", gap: "12px" }}>
              <Bot color="#00a884" size={32} />
              Automation Manager
            </h1>
            <p style={{ color: "#667781", marginTop: "5px", fontSize: "14px" }}>Configure automatic replies for your WhatsApp Business account</p>
          </div>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            style={{
              display: activeTab === "keywords" ? "flex" : "none",
              alignItems: "center",
              gap: "10px",
              background: "#00a884",
              color: "white",
              border: "none",
              padding: "12px 24px",
              borderRadius: "24px",
              fontWeight: "600",
              cursor: "pointer",
              boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
              transition: "all 0.2s"
            }}
            onMouseOver={e => e.currentTarget.style.background = "#008f72"}
            onMouseOut={e => e.currentTarget.style.background = "#00a884"}
          >
            <Plus size={20} />
            Add New Rule
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "30px", borderBottom: "1px solid #e9edef", paddingBottom: "10px" }}>
          <button
            onClick={() => setActiveTab("keywords")}
            style={{
              background: activeTab === "keywords" ? "#00a884" : "transparent",
              color: activeTab === "keywords" ? "white" : "#54656f",
              border: "none",
              padding: "10px 20px",
              borderRadius: "20px",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <MessageSquare size={18} />
            Keyword Replies
          </button>
          <button
            onClick={() => setActiveTab("followups")}
            style={{
              background: activeTab === "followups" ? "#00a884" : "transparent",
              color: activeTab === "followups" ? "white" : "#54656f",
              border: "none",
              padding: "10px 20px",
              borderRadius: "20px",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <Clock size={18} />
            Follow-ups
          </button>
          <button
            onClick={() => setActiveTab("quickreplies")}
            style={{
              background: activeTab === "quickreplies" ? "#00a884" : "transparent",
              color: activeTab === "quickreplies" ? "white" : "#54656f",
              border: "none",
              padding: "10px 20px",
              borderRadius: "20px",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <Zap size={18} />
            Quick Replies
          </button>
          <button
            onClick={() => setActiveTab("status_automation")}
            style={{
              background: activeTab === "status_automation" ? "#00a884" : "transparent",
              color: activeTab === "status_automation" ? "white" : "#54656f",
              border: "none",
              padding: "10px 20px",
              borderRadius: "20px",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <Key size={18} />
            Status Automations
          </button>
        </div>

        {activeTab === "keywords" ? (
          <>
            {/* Stats Row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "20px", marginBottom: "30px" }}>
              {[
                { label: "Active Rules", val: replies.filter(r => r.isActive).length, icon: <Zap size={22} />, color: "#e7fce3", text: "#008069" },
                { label: "Total Triggers", val: replies.reduce((acc, r) => acc + (r.useCount || 0), 0), icon: <MessageSquare size={22} />, color: "#e3f2fd", text: "#1976d2" },
                { label: "System Status", val: "Online", icon: <CheckCircle2 size={22} />, color: "#fff9c4", text: "#fbc02d" }
              ].map((stat, i) => (
                <div key={i} style={{ background: "white", padding: "20px", borderRadius: "12px", display: "flex", alignItems: "center", gap: "15px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                  <div style={{ background: stat.color, color: stat.text, padding: "12px", borderRadius: "10px" }}>{stat.icon}</div>
                  <div>
                    <p style={{ margin: 0, fontSize: "13px", color: "#667781" }}>{stat.label}</p>
                    <h3 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#111b21" }}>{stat.val}</h3>
                  </div>
                </div>
              ))}
            </div>

            {/* Search Bar */}
            <div style={{ position: "relative", marginBottom: "25px" }}>
              <Search style={{ position: "absolute", left: "15px", top: "50%", transform: "translateY(-50%)", color: "#8696a0" }} size={20} />
              <input
                type="text"
                placeholder="Search by keywords or responses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "15px 15px 15px 50px",
                  background: "white",
                  border: "1px solid #d1d7db",
                  borderRadius: "12px",
                  fontSize: "15px",
                  outline: "none",
                  color: "#111b21"
                }}
              />
            </div>

            {/* Rules Table */}
            <div style={{ background: "white", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead style={{ background: "#f8f9fa", borderBottom: "1px solid #e9edef" }}>
                  <tr>
                    <th style={{ padding: "15px 20px", fontSize: "13px", color: "#667781", fontWeight: "600" }}>KEYWORD</th>
                    <th style={{ padding: "15px 20px", fontSize: "13px", color: "#667781", fontWeight: "600" }}>MATCH</th>
                    <th style={{ padding: "15px 20px", fontSize: "13px", color: "#667781", fontWeight: "600" }}>AUTOMATED RESPONSE(S)</th>
                    <th style={{ padding: "15px 20px", fontSize: "13px", color: "#667781", fontWeight: "600", textAlign: "center" }}>STATUS</th>
                    <th style={{ padding: "15px 20px", fontSize: "13px", color: "#667781", fontWeight: "600", textAlign: "right" }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="5" style={{ padding: "40px", textAlign: "center", color: "#8696a0" }}>Loading automation rules...</td></tr>
                  ) : filteredReplies.length === 0 ? (
                    <tr><td colSpan="5" style={{ padding: "40px", textAlign: "center", color: "#8696a0" }}>No matching rules found.</td></tr>
                  ) : (
                    filteredReplies.map(reply => {
                      const displayReplies = reply.replies && reply.replies.length > 0 
                        ? reply.replies 
                        : [{ type: "text", text: reply.response, delay: reply.delay }];
                      
                      return (
                        <tr key={reply._id} style={{ borderBottom: "1px solid #f0f2f5" }}>
                          <td style={{ padding: "15px 20px" }}>
                            <span style={{ background: "#e7fce3", color: "#008069", padding: "4px 10px", borderRadius: "6px", fontSize: "13px", fontWeight: "700" }}>
                              {reply.keyword}
                            </span>
                          </td>
                          <td style={{ padding: "15px 20px" }}>
                            <span style={{ fontSize: "11px", fontWeight: "700", background: "#f0f2f5", color: "#54656f", padding: "3px 8px", borderRadius: "4px" }}>
                              {reply.matchType}
                            </span>
                          </td>
                          <td style={{ padding: "15px 20px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                              {displayReplies.map((sub, idx) => (
                                <div 
                                  key={idx} 
                                  style={{ 
                                    display: "flex", 
                                    alignItems: "center", 
                                    gap: "8px", 
                                    fontSize: "13px", 
                                    color: "#54656f",
                                    background: "#f8f9fa",
                                    padding: "6px 12px",
                                    borderRadius: "8px",
                                    maxWidth: "500px"
                                  }}
                                >
                                  <span style={{ fontWeight: "700", color: "#00a884" }}>#{idx + 1}</span>
                                  {sub.type === "image" && <ImageIcon size={14} color="#008069" />}
                                  {sub.type === "quick_reply" && <Zap size={14} color="#1976d2" />}
                                  {sub.type === "text" && <MessageSquare size={14} color="#54656f" />}
                                  <span style={{ 
                                    overflow: "hidden", 
                                    textOverflow: "ellipsis", 
                                    whiteSpace: "nowrap",
                                    flex: 1
                                  }}>
                                    {sub.type === "quick_reply" 
                                      ? `[Quick Reply] ${quickReplies.find(q => q._id === sub.quickReplyId)?.name || "Linked message"}`
                                      : sub.type === "image" 
                                        ? `[Image] ${sub.text || "No Caption"}`
                                        : sub.text
                                    }
                                  </span>
                                  {sub.delay > 0 && (
                                    <span style={{ fontSize: "11px", background: "#e3f2fd", color: "#1976d2", padding: "2px 6px", borderRadius: "10px", fontWeight: "600" }}>
                                      +{sub.delay}s
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>
                          <td style={{ padding: "15px 20px", textAlign: "center" }}>
                            <div
                              onClick={() => toggleStatus(reply)}
                              style={{ cursor: "pointer", color: reply.isActive ? "#00a884" : "#d1d7db" }}
                            >
                              {reply.isActive ? <CheckCircle2 size={22} /> : <XCircle size={22} />}
                            </div>
                          </td>
                          <td style={{ padding: "15px 20px", textAlign: "right" }}>
                            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                              <button onClick={() => handleEdit(reply)} style={{ border: "none", background: "none", color: "#1976d2", cursor: "pointer", padding: "5px" }}>
                                <Edit2 size={18} />
                              </button>
                              <button onClick={() => handleDelete(reply._id)} style={{ border: "none", background: "none", color: "#ff4757", cursor: "pointer", padding: "5px" }}>
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : activeTab === "followups" ? (
          <FollowUpAutomation />
        ) : activeTab === "status_automation" ? (
          <KeywordStatusAutomation users={executives} statusOptions={customStatuses} />
        ) : (
          <QuickReplyManager />
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(11, 20, 26, 0.85)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "20px"
        }}>
          <div style={{
            background: "white",
            width: "100%",
            maxWidth: "650px",
            borderRadius: "16px",
            overflow: "hidden",
            boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            display: "flex",
            flexDirection: "column",
            maxHeight: "90vh"
          }}>
            {/* Modal Header */}
            <div style={{ padding: "20px 24px", background: "#00a884", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "600" }}>{editingId ? "Edit Keyword Rule" : "Create Auto-Reply"}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", color: "white", fontSize: "24px", cursor: "pointer" }}>✕</button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSubmit} style={{ padding: "24px", overflowY: "auto", flex: 1 }}>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", color: "#667781", marginBottom: "8px", fontWeight: "600" }}>TRIGGER KEYWORD</label>
                  <input
                    required
                    type="text"
                    value={formData.keyword}
                    onChange={(e) => setFormData({ ...formData, keyword: e.target.value })}
                    placeholder="e.g. price, menu, address"
                    style={{ width: "100%", padding: "12px", border: "1px solid #d1d7db", borderRadius: "8px", outline: "none", fontSize: "15px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "13px", color: "#667781", marginBottom: "12px", fontWeight: "600" }}>MATCHING LOGIC</label>
                  <div style={{ display: "flex", gap: "10px" }}>
                    {["CONTAINS", "EXACT"].map(type => (
                      <label key={type} style={{
                        flex: 1,
                        padding: "10px",
                        borderRadius: "8px",
                        border: "1px solid",
                        borderColor: formData.matchType === type ? "#00a884" : "#d1d7db",
                        background: formData.matchType === type ? "#e7fce3" : "transparent",
                        color: formData.matchType === type ? "#008069" : "#54656f",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: "600"
                      }}>
                        <input
                          type="radio"
                          style={{ display: "none" }}
                          checked={formData.matchType === type}
                          onChange={() => setFormData({ ...formData, matchType: type })}
                        />
                        {type}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "13px", color: "#667781", marginBottom: "12px", fontWeight: "600" }}>ACTIVE FOR ACCOUNTS</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {accounts.map(acc => (
                    <div 
                      key={acc._id}
                      onClick={() => {
                        const ids = formData.whatsappAccountIds.includes(acc._id)
                          ? formData.whatsappAccountIds.filter(id => id !== acc._id)
                          : [...formData.whatsappAccountIds, acc._id];
                        setFormData({ ...formData, whatsappAccountIds: ids });
                      }}
                      style={{ 
                        padding: "6px 12px", 
                        borderRadius: "16px", 
                        fontSize: "12px", 
                        fontWeight: "600",
                        cursor: "pointer",
                        border: "1px solid",
                        borderColor: formData.whatsappAccountIds.includes(acc._id) ? "#00a884" : "#d1d7db",
                        background: formData.whatsappAccountIds.includes(acc._id) ? "#e7fce3" : "white",
                        color: formData.whatsappAccountIds.includes(acc._id) ? "#008069" : "#667781",
                        display: "flex",
                        alignItems: "center",
                        gap: "5px"
                      }}
                    >
                      <CheckCircle2 size={14} style={{ opacity: formData.whatsappAccountIds.includes(acc._id) ? 1 : 0.3 }} />
                      {acc.name}
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: "11px", color: "#8696a0", marginTop: "6px" }}>Leave empty to make this reply global for all accounts.</p>
              </div>

              {/* Multi-Message Sequence Builder */}
              <div style={{ borderTop: "1px solid #e9edef", paddingTop: "20px", marginBottom: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
                  <label style={{ fontSize: "14px", color: "#111b21", fontWeight: "700" }}>REPLY SEQUENCE</label>
                  <button
                    type="button"
                    onClick={handleAddReply}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      background: "none",
                      border: "none",
                      color: "#00a884",
                      fontSize: "13px",
                      fontWeight: "700",
                      cursor: "pointer"
                    }}
                  >
                    <PlusCircle size={16} /> Add Message
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                  {formData.replies.map((reply, index) => (
                    <div 
                      key={index} 
                      style={{ 
                        background: "#f8f9fa", 
                        border: "1px solid #e9edef", 
                        borderRadius: "12px", 
                        padding: "16px",
                        position: "relative"
                      }}
                    >
                      {/* Reply header controls */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                        <span style={{ fontSize: "13px", fontWeight: "700", color: "#00a884" }}>
                          Message #{index + 1}
                        </span>
                        
                        <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => handleMoveReply(index, -1)}
                            style={{ background: "none", border: "none", color: index === 0 ? "#d1d7db" : "#667781", cursor: index === 0 ? "not-allowed" : "pointer" }}
                          >
                            <ArrowUp size={16} />
                          </button>
                          <button
                            type="button"
                            disabled={index === formData.replies.length - 1}
                            onClick={() => handleMoveReply(index, 1)}
                            style={{ background: "none", border: "none", color: index === formData.replies.length - 1 ? "#d1d7db" : "#667781", cursor: index === formData.replies.length - 1 ? "not-allowed" : "pointer" }}
                          >
                            <ArrowDown size={16} />
                          </button>
                          {formData.replies.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveReply(index)}
                              style={{ background: "none", border: "none", color: "#ff4757", cursor: "pointer", marginLeft: "10px" }}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Reply Type Toggle */}
                      <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                        {["text", "image", "quick_reply"].map(type => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => handleReplyChange(index, "type", type)}
                            style={{
                              flex: 1,
                              padding: "8px",
                              fontSize: "12px",
                              fontWeight: "600",
                              borderRadius: "8px",
                              border: "1px solid",
                              borderColor: reply.type === type ? "#00a884" : "#d1d7db",
                              background: reply.type === type ? "#e7fce3" : "white",
                              color: reply.type === type ? "#008069" : "#667781",
                              cursor: "pointer"
                            }}
                          >
                            {type === "text" && "Text Message"}
                            {type === "image" && "Image/Caption"}
                            {type === "quick_reply" && "Quick Reply Link"}
                          </button>
                        ))}
                      </div>

                      {/* Type-Specific Fields */}
                      {reply.type === "text" && (
                        <textarea
                          required
                          rows="3"
                          value={reply.text}
                          onChange={(e) => handleReplyChange(index, "text", e.target.value)}
                          placeholder="Type message text here..."
                          style={{ width: "100%", padding: "10px", border: "1px solid #d1d7db", borderRadius: "8px", outline: "none", fontSize: "14px", resize: "none" }}
                        />
                      )}

                      {reply.type === "image" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          <textarea
                            rows="2"
                            value={reply.text}
                            onChange={(e) => handleReplyChange(index, "text", e.target.value)}
                            placeholder="Image caption (optional)..."
                            style={{ width: "100%", padding: "10px", border: "1px solid #d1d7db", borderRadius: "8px", outline: "none", fontSize: "14px", resize: "none" }}
                          />
                          
                          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                            {reply.mediaUrl ? (
                              <div style={{ position: "relative" }}>
                                <img src={reply.mediaUrl} alt="Upload Preview" style={{ width: "60px", height: "60px", borderRadius: "8px", objectFit: "cover" }} />
                                <button
                                  type="button"
                                  onClick={() => handleReplyChange(index, "mediaUrl", "")}
                                  style={{ position: "absolute", top: "-5px", right: "-5px", background: "#ff4757", color: "white", border: "none", borderRadius: "50%", width: "18px", height: "18px", fontSize: "10px", cursor: "pointer" }}
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <div style={{ width: "60px", height: "60px", borderRadius: "8px", background: "#e9edef", display: "flex", alignItems: "center", justifyContent: "center", color: "#8696a0" }}>
                                <ImageIcon size={20} />
                              </div>
                            )}

                            <div style={{ flex: 1 }}>
                              <input
                                type="text"
                                value={reply.mediaUrl}
                                onChange={(e) => handleReplyChange(index, "mediaUrl", e.target.value)}
                                placeholder="Paste Image URL or upload below..."
                                style={{ width: "100%", padding: "8px", border: "1px solid #d1d7db", borderRadius: "6px", fontSize: "12px", outline: "none", marginBottom: "4px" }}
                              />
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleFileChange(index, e)}
                                  style={{ fontSize: "11px", color: "#667781" }}
                                />
                                {uploadingIndex === index && <Loader2 className="animate-spin" size={14} color="#00a884" />}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {reply.type === "quick_reply" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          <label style={{ fontSize: "11px", color: "#667781", fontWeight: "700" }}>LINKED QUICK REPLY</label>
                          <select
                            required
                            value={reply.quickReplyId}
                            onChange={(e) => handleReplyChange(index, "quickReplyId", e.target.value)}
                            style={{ width: "100%", padding: "10px", border: "1px solid #d1d7db", borderRadius: "8px", outline: "none", fontSize: "14px", background: "white" }}
                          >
                            <option value="">-- Choose a Quick Reply --</option>
                            {quickReplies.map(qr => (
                              <option key={qr._id} value={qr._id}>
                                {qr.name} ({qr.mediaUrl ? "Image" : "Text Only"})
                              </option>
                            ))}
                          </select>
                          <p style={{ fontSize: "11px", color: "#8696a0", margin: 0 }}>
                            Linking this will trigger the message content and images configured in that quick reply.
                          </p>
                        </div>
                      )}

                      {/* Reply delay setting */}
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "12px", borderTop: "1px dashed #e9edef", paddingTop: "10px" }}>
                        <Clock size={14} color="#667781" />
                        <span style={{ fontSize: "12px", color: "#667781" }}>Wait</span>
                        <input
                          type="number"
                          value={reply.delay}
                          onChange={(e) => handleReplyChange(index, "delay", parseInt(e.target.value) || 0)}
                          min="0"
                          style={{ width: "60px", padding: "4px 8px", border: "1px solid #d1d7db", borderRadius: "4px", fontSize: "12px", textAlign: "center" }}
                        />
                        <span style={{ fontSize: "12px", color: "#667781" }}>seconds before sending.</span>
                      </div>

                    </div>
                  ))}
                </div>
              </div>

              {/* Form Actions */}
              <div style={{ display: "flex", gap: "12px", marginTop: "30px", borderTop: "1px solid #e9edef", paddingTop: "20px" }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ flex: 1, padding: "12px", background: "white", border: "1px solid #d1d7db", borderRadius: "8px", color: "#54656f", fontWeight: "600", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: "12px", background: "#00a884", border: "none", borderRadius: "8px", color: "white", fontWeight: "600", cursor: "pointer" }}
                >
                  {editingId ? "Update Rule" : "Save Automation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutoReplyManager;
