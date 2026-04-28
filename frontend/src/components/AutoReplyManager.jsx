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
  Hash,
  Clock
} from "lucide-react";
import FollowUpAutomation from "./FollowUpAutomation";

const API_BASE = import.meta.env.VITE_API_URL || "";

const AutoReplyManager = () => {
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("keywords");
  
  const [formData, setFormData] = useState({
    keyword: "",
    response: "",
    matchType: "CONTAINS",
    isActive: true
  });
  const [editingId, setEditingId] = useState(null);

  const currentUser = JSON.parse(localStorage.getItem("userInfo"));
  const config = { headers: { Authorization: `Bearer ${currentUser?.token}` } };

  useEffect(() => {
    fetchReplies();
  }, []);

  const fetchReplies = async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/api/auto-replies`, config);
      setReplies(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await axios.put(`${API_BASE}/api/auto-replies/${editingId}`, formData, config);
      } else {
        await axios.post(`${API_BASE}/api/auto-replies`, formData, config);
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
    setFormData({
      keyword: reply.keyword,
      response: reply.response,
      matchType: reply.matchType,
      isActive: reply.isActive
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
    setFormData({ keyword: "", response: "", matchType: "CONTAINS", isActive: true });
    setEditingId(null);
  };

  const filteredReplies = replies.filter(r => 
    r.keyword.toLowerCase().includes(search.toLowerCase()) || 
    r.response.toLowerCase().includes(search.toLowerCase())
  );

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
        </div>

        {activeTab === "keywords" ? (
          <>
            {/* Stats Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "20px", marginBottom: "30px" }}>
          {[
            { label: "Active Rules", val: replies.filter(r => r.isActive).length, icon: <Zap size={22}/>, color: "#e7fce3", text: "#008069" },
            { label: "Total Triggers", val: replies.reduce((acc, r) => acc + (r.useCount || 0), 0), icon: <MessageSquare size={22}/>, color: "#e3f2fd", text: "#1976d2" },
            { label: "System Status", val: "Online", icon: <CheckCircle2 size={22}/>, color: "#fff9c4", text: "#fbc02d" }
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
                <th style={{ padding: "15px 20px", fontSize: "13px", color: "#667781", fontWeight: "600" }}>AUTOMATED RESPONSE</th>
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
                filteredReplies.map(reply => (
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
                      <div style={{ 
                        fontSize: "14px", 
                        color: "#111b21", 
                        maxWidth: "400px", 
                        whiteSpace: "pre-wrap", // Support multi-line display
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical"
                      }}>
                        {reply.response}
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
                ))
              )}
            </tbody>
          </table>
        </div>
        </>
        ) : (
          <FollowUpAutomation />
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
            maxWidth: "500px", 
            borderRadius: "16px", 
            overflow: "hidden",
            boxShadow: "0 10px 25px rgba(0,0,0,0.2)"
          }}>
            <div style={{ padding: "20px 24px", background: "#00a884", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "600" }}>{editingId ? "Edit Rule" : "Create Auto-Reply"}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", color: "white", fontSize: "24px", cursor: "pointer" }}>✕</button>
            </div>
            
            <form onSubmit={handleSubmit} style={{ padding: "24px" }}>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "13px", color: "#667781", marginBottom: "8px", fontWeight: "600" }}>TRIGGER KEYWORD</label>
                <input 
                  required
                  type="text"
                  value={formData.keyword}
                  onChange={(e) => setFormData({...formData, keyword: e.target.value})}
                  placeholder="e.g. price, menu, address"
                  style={{ width: "100%", padding: "12px", border: "1px solid #d1d7db", borderRadius: "8px", outline: "none", fontSize: "15px" }}
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
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
                        onChange={() => setFormData({...formData, matchType: type})}
                      />
                      {type}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "13px", color: "#667781", marginBottom: "8px", fontWeight: "600" }}>AUTOMATED RESPONSE (Supports Multi-line)</label>
                <textarea 
                  required
                  rows="5"
                  value={formData.response}
                  onChange={(e) => setFormData({...formData, response: e.target.value})}
                  placeholder="Type your answer here... Press Enter for new lines."
                  style={{ 
                    width: "100%", 
                    padding: "12px", 
                    border: "1px solid #d1d7db", 
                    borderRadius: "8px", 
                    outline: "none", 
                    fontSize: "15px", 
                    resize: "none",
                    lineHeight: "1.5",
                    whiteSpace: "pre-wrap" // Preserve new lines in textarea
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "30px" }}>
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
