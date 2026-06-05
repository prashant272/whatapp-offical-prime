import React, { useState, useEffect } from "react";
import axios from "axios";
import { Plus, Trash2, Edit2, Search, Zap, FileText, Loader2, Image as ImageIcon, CheckCircle2, Bold, Italic, Strikethrough, Code, X } from "lucide-react";
import { useWhatsAppAccount } from "../WhatsAppAccountContext";

const API_BASE = import.meta.env.VITE_API_URL || "";

const QuickReplyManager = () => {
  const { accounts, activeAccount } = useWhatsAppAccount();
  const [quickReplies, setQuickReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    content: "",
    mediaUrl: "",
    whatsappAccountIds: []
  });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [editingId, setEditingId] = useState(null);

  const currentUser = JSON.parse(localStorage.getItem("userInfo"));
  const config = { headers: { Authorization: `Bearer ${currentUser?.token}` } };

  useEffect(() => {
    fetchQuickReplies();
  }, [activeAccount]);

  const fetchQuickReplies = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/api/quick-replies`, {
        headers: { 
          ...config.headers,
          "x-whatsapp-account-id": activeAccount?._id || "all"
        }
      });
      setQuickReplies(res.data);
    } catch (err) {
      console.error("Error fetching quick replies:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

  const applyFormat = (symbol) => {
    const textarea = document.getElementById("qr-content-textarea");
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData.content;
    const selected = text.substring(start, end);
    const before = text.substring(0, start);
    const after = text.substring(end);
    
    const newContent = `${before}${symbol}${selected}${symbol}${after}`;
    setFormData({ ...formData, content: newContent });
    
    // Reset focus and selection
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + symbol.length, end + symbol.length);
    }, 10);
  };

  const formatWhatsAppText = (text) => {
    if (!text) return "";
    let formatted = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Hyperlink matching: format http/https/ftp or standard domains as clickable <a> tags
    const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    formatted = formatted.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #039be5; text-decoration: underline; word-break: break-all;">$1</a>');

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      let mediaUrl = formData.mediaUrl;

      if (file) {
        const uploadData = new FormData();
        uploadData.append("file", file);
        const uploadRes = await axios.post(`${API_BASE}/api/upload`, uploadData, {
          headers: { 
            ...config.headers,
            "Content-Type": "multipart/form-data" 
          }
        });
        mediaUrl = uploadRes.data.url;
      }

      const payload = {
        name: formData.name,
        content: formData.content,
        mediaUrl,
        whatsappAccountIds: formData.whatsappAccountIds
      };

      if (editingId) {
        await axios.put(`${API_BASE}/api/quick-replies/${editingId}`, payload, config);
      } else {
        await axios.post(`${API_BASE}/api/quick-replies`, payload, config);
      }

      setShowModal(false);
      resetForm();
      fetchQuickReplies();
    } catch (err) {
      alert(err.response?.data?.error || "Error saving quick reply");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (qr) => {
    setEditingId(qr._id);
    setFormData({
      name: qr.name,
      content: qr.content || "",
      mediaUrl: qr.mediaUrl || "",
      whatsappAccountIds: qr.whatsappAccountIds || []
    });
    setPreview(qr.mediaUrl || "");
    setFile(null);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this quick reply?")) return;
    try {
      await axios.delete(`${API_BASE}/api/quick-replies/${id}`, config);
      fetchQuickReplies();
    } catch (err) {
      console.error(err);
    }
  };

  const resetForm = () => {
    setFormData({ name: "", content: "", mediaUrl: "", whatsappAccountIds: [] });
    setFile(null);
    setPreview("");
    setEditingId(null);
  };

  const filtered = quickReplies.filter(qr =>
    qr.name.toLowerCase().includes(search.toLowerCase()) ||
    (qr.content || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .qr-card:hover { transform: translateY(-5px); box-shadow: 0 8px 24px rgba(0,0,0,0.12) !important; }
        .wa-preview-bubble { position: relative; background: #ffffff; border-radius: 0 15px 15px 15px; padding: 8px; box-shadow: 0 1px 0.5px rgba(0,0,0,0.13); max-width: 90%; margin-bottom: 10px; }
        .wa-preview-bubble::before { content: ""; position: absolute; left: -8px; top: 0; width: 0; height: 0; border-top: 10px solid #ffffff; border-left: 10px solid transparent; }
      `}</style>

      {/* Header & Add Button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
        <div style={{ position: "relative", flex: 1, maxWidth: "500px" }}>
          <Search style={{ position: "absolute", left: "15px", top: "50%", transform: "translateY(-50%)", color: "#8696a0" }} size={20} />
          <input
            type="text"
            placeholder="Search quick replies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", padding: "12px 15px 12px 45px", borderRadius: "12px", border: "1px solid #d1d7db", outline: "none", fontSize: "15px", transition: "border 0.2s" }}
          />
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          style={{ background: "linear-gradient(135deg, #00a884, #008069)", color: "white", border: "none", padding: "12px 25px", borderRadius: "25px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", boxShadow: "0 4px 12px rgba(0,168,132,0.2)" }}
        >
          <Plus size={22} /> New Quick Reply
        </button>
      </div>

      {/* Grid of Quick Replies */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "100px" }}><Loader2 className="animate-spin" size={40} color="#00a884" /></div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "100px", background: "white", borderRadius: "20px", color: "#8696a0", border: "2px dashed #d1d7db" }}>
          <Zap size={48} style={{ marginBottom: "15px", opacity: 0.3 }} />
          <p>No quick replies found. Create one to speed up your chats!</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "25px" }}>
          {filtered.map(qr => (
            <div key={qr._id} className="qr-card" style={{ background: "white", borderRadius: "16px", padding: "18px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", border: "1px solid #e9edef", transition: "all 0.3s ease", cursor: "default" }}>
              <div style={{ display: "flex", gap: "15px", marginBottom: "15px" }}>
                {qr.mediaUrl ? (
                  <img src={qr.mediaUrl} alt="" style={{ width: "70px", height: "70px", borderRadius: "12px", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: "70px", height: "70px", borderRadius: "12px", background: "#f0f2f5", display: "flex", alignItems: "center", justifyContent: "center", color: "#8696a0" }}>
                    <ImageIcon size={28} />
                  </div>
                )}
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <h4 style={{ margin: "0 0 6px 0", fontSize: "16px", color: "#111b21", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: "700" }}>{qr.name}</h4>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                    {(!qr.whatsappAccountIds || qr.whatsappAccountIds.length === 0) ? (
                      <span style={{ fontSize: "10px", color: "#00a884", fontWeight: "800", background: "#e7fce3", padding: "3px 8px", borderRadius: "6px", textTransform: "uppercase" }}>Global</span>
                    ) : (
                      qr.whatsappAccountIds.map(id => (
                        <span key={id} style={{ fontSize: "10px", color: "#1976d2", fontWeight: "800", background: "#e3f2fd", padding: "3px 8px", borderRadius: "6px", textTransform: "uppercase" }}>
                          {accounts.find(a => a._id === id)?.name || "Account"}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
              <div style={{ 
                margin: "0 0 18px 0", 
                fontSize: "13px", 
                color: "#54656f", 
                display: "-webkit-box", 
                WebkitLineClamp: 3, 
                WebkitBoxOrient: "vertical", 
                overflow: "hidden", 
                minHeight: "58px", 
                lineHeight: "1.5",
                background: "#f8f9fa",
                padding: "10px",
                borderRadius: "10px",
                borderLeft: "4px solid #00a884"
              }} dangerouslySetInnerHTML={{ __html: formatWhatsAppText(qr.content) }} />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", borderTop: "1px solid #f0f2f5", paddingTop: "12px" }}>
                <button onClick={() => handleEdit(qr)} style={{ border: "none", background: "#f0f2f5", color: "#1976d2", cursor: "pointer", padding: "8px", borderRadius: "8px", display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", fontWeight: "600" }}><Edit2 size={16} /> Edit</button>
                <button onClick={() => handleDelete(qr._id)} style={{ border: "none", background: "#fff0f0", color: "#ff4757", cursor: "pointer", padding: "8px", borderRadius: "8px", display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", fontWeight: "600" }}><Trash2 size={16} /> Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal - Advanced 2-Column Layout */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(11, 20, 26, 0.8)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "20px" }}>
          <div style={{ background: "white", width: "100%", maxWidth: "1000px", borderRadius: "24px", overflow: "hidden", display: "flex", flexDirection: "column", height: "90vh", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            
            {/* Modal Header */}
            <div style={{ padding: "20px 30px", background: "#00a884", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Zap size={24} />
                <h3 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>{editingId ? "Edit Quick Reply" : "New Quick Reply"}</h3>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "white", width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s" }}><X size={20} /></button>
            </div>

            {/* Modal Body - 2 Columns */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", flex: 1, overflow: "hidden" }}>
              
              {/* Left Column: Form Inputs */}
              <div style={{ padding: "30px", overflowY: "auto", borderRight: "1px solid #e9edef" }}>
                <form onSubmit={handleSubmit}>
                  <div style={{ marginBottom: "20px" }}>
                    <label style={{ display: "block", fontSize: "13px", color: "#00a884", marginBottom: "8px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "1px" }}>Name / Alias</label>
                    <input
                      required
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Price List"
                      style={{ width: "100%", padding: "12px 15px", border: "2px solid #e9edef", borderRadius: "12px", outline: "none", fontSize: "16px", transition: "border 0.2s" }}
                      onFocus={(e) => e.target.style.borderColor = "#00a884"}
                      onBlur={(e) => e.target.style.borderColor = "#e9edef"}
                    />
                  </div>

                  <div style={{ marginBottom: "25px" }}>
                    <label style={{ display: "block", fontSize: "13px", color: "#00a884", marginBottom: "12px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "1px" }}>Available On Accounts</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
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
                            padding: "8px 16px", 
                            borderRadius: "20px", 
                            fontSize: "12px", 
                            fontWeight: "700",
                            cursor: "pointer",
                            border: "2px solid",
                            borderColor: formData.whatsappAccountIds.includes(acc._id) ? "#00a884" : "#e9edef",
                            background: formData.whatsappAccountIds.includes(acc._id) ? "#e7fce3" : "white",
                            color: formData.whatsappAccountIds.includes(acc._id) ? "#008069" : "#667781",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            transition: "all 0.2s ease"
                          }}
                        >
                          <CheckCircle2 size={16} style={{ opacity: formData.whatsappAccountIds.includes(acc._id) ? 1 : 0.3 }} />
                          {acc.name}
                        </div>
                      ))}
                    </div>
                    <p style={{ fontSize: "11px", color: "#8696a0", marginTop: "8px", fontStyle: "italic" }}>Tip: Selecting no accounts makes it available for ALL accounts.</p>
                  </div>

                  <div style={{ marginBottom: "25px" }}>
                    <label style={{ display: "block", fontSize: "13px", color: "#00a884", marginBottom: "12px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "1px" }}>Rich Media (Image)</label>
                    <div style={{ display: "flex", gap: "15px", alignItems: "center", background: "#f8f9fa", padding: "15px", borderRadius: "16px", border: "1px dashed #d1d7db" }}>
                      {preview ? (
                        <div style={{ position: "relative" }}>
                          <img src={preview} alt="Preview" style={{ width: "80px", height: "80px", borderRadius: "12px", objectFit: "cover", border: "3px solid white", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
                          <button type="button" onClick={() => { setFile(null); setPreview(""); setFormData({...formData, mediaUrl: ""}); }} style={{ position: "absolute", top: -8, right: -8, background: "#ff4757", color: "white", border: "none", borderRadius: "50%", width: "22px", height: "22px", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px rgba(0,0,0,0.2)" }}>✕</button>
                        </div>
                      ) : (
                        <div style={{ width: "80px", height: "80px", borderRadius: "12px", background: "#e9edef", display: "flex", alignItems: "center", justifyContent: "center", color: "#8696a0" }}>
                          <ImageIcon size={32} />
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#54656f" }}>Select an image to send with this reply.</p>
                        <input type="file" accept="image/*" onChange={handleFileChange} style={{ fontSize: "12px", width: "100%" }} />
                      </div>
                    </div>
                  </div>

                  <div style={{ marginBottom: "30px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <label style={{ fontSize: "13px", color: "#00a884", fontWeight: "800", textTransform: "uppercase", letterSpacing: "1px" }}>Message Body</label>
                      
                      {/* Formatting Toolbar */}
                      <div style={{ display: "flex", gap: "5px", background: "#f0f2f5", padding: "4px", borderRadius: "8px" }}>
                        <button type="button" onClick={() => applyFormat("*")} style={{ background: "none", border: "none", cursor: "pointer", padding: "5px", borderRadius: "5px", color: "#54656f" }} title="Bold (*text*)"><Bold size={16} /></button>
                        <button type="button" onClick={() => applyFormat("_")} style={{ background: "none", border: "none", cursor: "pointer", padding: "5px", borderRadius: "5px", color: "#54656f" }} title="Italic (_text_)"><Italic size={16} /></button>
                        <button type="button" onClick={() => applyFormat("~")} style={{ background: "none", border: "none", cursor: "pointer", padding: "5px", borderRadius: "5px", color: "#54656f" }} title="Strikethrough (~text~)"><Strikethrough size={16} /></button>
                        <button type="button" onClick={() => applyFormat("`")} style={{ background: "none", border: "none", cursor: "pointer", padding: "5px", borderRadius: "5px", color: "#54656f" }} title="Monospace (`text`)"><Code size={16} /></button>
                      </div>
                    </div>
                    
                    <textarea
                      id="qr-content-textarea"
                      rows="6"
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      placeholder="Type your message here... Use *bold*, _italic_, etc."
                      style={{ width: "100%", padding: "15px", border: "2px solid #e9edef", borderRadius: "16px", outline: "none", fontSize: "15px", resize: "none", fontFamily: "inherit", lineHeight: "1.6" }}
                      onFocus={(e) => e.target.style.borderColor = "#00a884"}
                      onBlur={(e) => e.target.style.borderColor = "#e9edef"}
                    />
                  </div>

                  <div style={{ display: "flex", gap: "15px" }}>
                    <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: "14px", borderRadius: "12px", border: "none", background: "#f0f2f5", color: "#54656f", fontWeight: "700", cursor: "pointer" }}>Cancel</button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      style={{ flex: 2, padding: "14px", borderRadius: "12px", border: "none", background: "#00a884", color: "white", fontWeight: "700", cursor: "pointer", boxShadow: "0 4px 12px rgba(0,168,132,0.3)" }}
                    >
                      {isSaving ? "Saving..." : "Save Quick Reply"}
                    </button>
                  </div>
                </form>
              </div>

              {/* Right Column: Live WhatsApp Preview */}
              <div style={{ background: "#e5ddd5", padding: "30px", overflowY: "auto", display: "flex", flexDirection: "column" }}>
                <div style={{ textAlign: "center", color: "#667781", fontSize: "12px", fontWeight: "700", marginBottom: "20px", textTransform: "uppercase", letterSpacing: "1px" }}>Live Preview</div>
                
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div className="wa-preview-bubble">
                    {preview && (
                      <div style={{ width: "100%", marginBottom: "5px", borderRadius: "8px", overflow: "hidden" }}>
                        <img src={preview} alt="" style={{ width: "100%", maxHeight: "250px", objectFit: "cover" }} />
                      </div>
                    )}
                    <div style={{ 
                      fontSize: "14.2px", 
                      color: "#111b21", 
                      lineHeight: "1.5", 
                      whiteSpace: "pre-wrap", 
                      padding: "4px 7px 0 7px" 
                    }} dangerouslySetInnerHTML={{ __html: formatWhatsAppText(formData.content || "Your message will appear here...") }} />
                    
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "2px" }}>
                      <span style={{ fontSize: "11px", color: "#667781" }}>15:06 ✅✅</span>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: "auto", padding: "20px", background: "rgba(255,255,255,0.5)", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.5)", fontSize: "12px", color: "#54656f" }}>
                  <p style={{ margin: "0 0 5px 0", fontWeight: "700", color: "#00a884" }}>Advanced Formatting Tips:</p>
                  <ul style={{ margin: 0, paddingLeft: "15px" }}>
                    <li><strong>*bold*</strong> for bold text</li>
                    <li><em>_italic_</em> for italic text</li>
                    <li><del>~strike~</del> for strikethrough</li>
                    <li><code>`code`</code> for monospace</li>
                  </ul>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickReplyManager;
