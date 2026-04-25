import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Send, List, UserPlus, Play, CheckCircle2, AlertCircle, Eye, Type, MousePointer2, FileUp, UploadCloud } from "lucide-react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { io } from "socket.io-client";

import { API_BASE } from "../api";

const CampaignManager = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [presets, setPresets] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState("");
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleImageUpload = async (e, key) => {
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
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateVars, setTemplateVars] = useState({});
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [selectedLogs, setSelectedLogs] = useState([]);
  const [newCampaign, setNewCampaign] = useState({
    name: "",
    templateName: "",
    contactsRaw: ""
  });
  const fileInputRef = useRef(null);

  const currentUser = JSON.parse(localStorage.getItem("userInfo"));
  const config = { headers: { Authorization: `Bearer ${currentUser?.token}` } };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [campRes, tempRes, presetRes] = await Promise.all([
        axios.get(`${API_BASE}/campaigns`, config),
        axios.get(`${API_BASE}/templates`, config),
        axios.get(`${API_BASE}/presets`, config)
      ]);
      setCampaigns(Array.isArray(campRes.data) ? campRes.data : []);
      const templatesList = Array.isArray(tempRes.data) ? tempRes.data : [];
      setTemplates(templatesList.filter(t => t.status === "APPROVED"));
      setPresets(Array.isArray(presetRes.data) ? presetRes.data : []);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Socket for real-time progress
    const socketUrl = import.meta.env.VITE_API_URL || window.location.origin;
    const socket = io(socketUrl);

    socket.on("campaign_progress", ({ campaignId, sentCount, failedCount, status, logs }) => {
      setCampaigns(prev => prev.map(c => 
        c._id === campaignId 
          ? { ...c, sentCount, failedCount, status, logs } 
          : c
      ));
    });

    return () => socket.disconnect();
  }, []);

  const handleTemplateChange = (e) => {
    const name = e.target.value;
    const template = templates.find(t => t.name === name);
    setSelectedTemplate(template);
    setNewCampaign({ ...newCampaign, templateName: name });
    
    // Initialize variables
    const vars = {};
    if (template) {
      template.components.forEach(comp => {
        if (comp.type === "HEADER" && ["IMAGE", "VIDEO", "DOCUMENT"].includes(comp.format)) {
          vars[`HEADER_${comp.format}`] = "";
        }
        const text = comp.text || "";
        const matches = text.match(/{{(\d+)}}/g);
        if (matches) {
          matches.forEach(m => {
            const num = m.replace(/{{|}}/g, "");
            vars[`${comp.type}_${num}`] = "";
          });
        }
      });
    }
    setTemplateVars(vars);
  };

  const handlePresetChange = (pId) => {
    const preset = presets.find(p => p._id === pId);
    if (!preset) return;
    
    setSelectedPreset(pId);
    setSelectedTemplate(preset.template);
    setNewCampaign({ ...newCampaign, templateName: preset.template.name });
    setTemplateVars(preset.config || {});
  };

  const verifyNumbers = async () => {
    const phones = newCampaign.contactsRaw.split("\n").map(p => p.trim()).filter(p => p.length > 5);
    if (phones.length === 0) return alert("No numbers to verify.");
    
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/contacts/verify`, { phones }, config);
      const results = res.data.results;
      const valid = results.filter(r => r.status === "valid").map(r => r.wa_id);
      const invalid = results.filter(r => r.status === "invalid").length;
      
      if (window.confirm(`Verification Done!\n✅ Valid: ${valid.length}\n❌ Invalid: ${invalid}\n\nDo you want to remove invalid numbers from the list?`)) {
        setNewCampaign({ ...newCampaign, contactsRaw: valid.join("\n") });
      }
    } catch (err) {
      alert("Verification failed: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    const extension = file.name.split(".").pop().toLowerCase();

    reader.onload = (event) => {
      let numbers = [];

      if (extension === "csv") {
        const result = Papa.parse(event.target.result, { header: false });
        numbers = result.data.flat().map(n => String(n).replace(/[^0-9]/g, "")).filter(n => n.length >= 10);
      } else if (extension === "xlsx" || extension === "xls") {
        const workbook = XLSX.read(event.target.result, { type: "binary" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        numbers = json.flat().map(n => String(n).replace(/[^0-9]/g, "")).filter(n => n.length >= 10);
      } else {
        // Plain text
        const text = event.target.result;
        numbers = text.split(/\s+/).map(n => String(n).replace(/[^0-9]/g, "")).filter(n => n.length >= 10);
      }

      const uniqueNumbers = [...new Set(numbers)];
      setNewCampaign({ ...newCampaign, contactsRaw: uniqueNumbers.join("\n") });
      alert(`✅ Extracted ${uniqueNumbers.length} unique phone numbers from the file.`);
    };

    if (extension === "xlsx" || extension === "xls") {
      reader.readAsBinaryString(file);
    } else {
      reader.readAsText(file);
    }
  };

  const handleVarChange = (key, value) => {
    setTemplateVars(prev => ({ ...prev, [key]: value }));
  };

  const handleStartCampaign = async (e) => {
    e.preventDefault();
    const phones = newCampaign.contactsRaw.split("\n").map(p => p.trim()).filter(p => p.length > 5);
    
    if (phones.length === 0) return alert("Please add at least one valid phone number.");
    if (!newCampaign.templateName) return alert("Please select an approved template.");

    // Construct components for Meta API
    const templateComponents = [];
    if (selectedTemplate) {
      const bodyParams = [];
      const headerParams = [];

      Object.entries(templateVars).forEach(([key, val]) => {
        if (key.startsWith("BODY_")) {
          bodyParams.push({ type: "text", text: val });
        } else if (key.startsWith("HEADER_")) {
          if (["IMAGE", "VIDEO", "DOCUMENT"].some(type => key.includes(type))) {
            const type = key.split("_")[1].toLowerCase();
            headerParams.push({ type, [type]: { link: val } });
          } else {
            headerParams.push({ type: "text", text: val });
          }
        }
      });

      if (headerParams.length > 0) {
        templateComponents.push({ type: "header", parameters: headerParams });
      }
      if (bodyParams.length > 0) {
        templateComponents.push({ type: "body", parameters: bodyParams });
      }
    }

    try {
      await axios.post(`${API_BASE}/campaigns`, {
        name: newCampaign.name,
        templateName: newCampaign.templateName,
        contacts: phones.map(p => ({ phone: p })),
        templateComponents
      }, config);
      setShowCreate(false);
      fetchData();
      alert("Campaign started successfully!");
    } catch (err) {
      alert("Error: " + (err.response?.data?.error || err.message));
    }
  };

  const formatPreviewText = (text, type) => {
    if (!text) return "";
    const parts = text.split(/({{\d+}})/g);
    return parts.map((part, i) => {
      const match = part.match(/{{\d+}}/);
      if (match) {
        const num = match[0].replace(/{{|}}/g, "");
        const val = templateVars[`${type}_${num}`];
        return <strong key={i} style={{ color: "var(--accent-primary)", background: "rgba(37, 211, 102, 0.1)", padding: "0 4px", borderRadius: "4px" }}>{val || `{{${num}}}`}</strong>;
      }
      return part;
    });
  };

  const renderTemplatePreview = () => {
    if (!selectedTemplate) return null;
    if (!selectedTemplate.components || selectedTemplate.components.length === 0) {
      return (
        <div style={{ marginTop: "2rem", color: "#ff4757", textAlign: "center", padding: "1rem", background: "rgba(255, 71, 87, 0.1)", borderRadius: "8px" }}>
          <AlertCircle size={20} style={{ marginBottom: "5px" }} />
          <p>This template has no components or hasn't been synced correctly. Please sync templates first.</p>
        </div>
      );
    }

    return (
      <div className="template-preview-container" style={{ marginTop: "2rem", borderTop: "1px solid var(--glass-border)", paddingTop: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h4 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Eye size={18} /> Message Preview
          </h4>
          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
            Real-time preview of what will be sent
          </span>
        </div>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "2rem" }}>
          {/* Visual Preview */}
          <div className="whatsapp-preview-box" style={{ 
            background: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')", // WhatsApp wallpaper
            backgroundSize: "cover",
            borderRadius: "15px", 
            padding: "20px",
            minHeight: "200px",
            display: "flex",
            alignItems: "flex-start",
            border: "1px solid var(--glass-border)"
          }}>
            <div style={{ 
              background: "#ffffff", 
              color: "#303030", 
              padding: "12px", 
              borderRadius: "0 15px 15px 15px", 
              maxWidth: "90%", 
              fontSize: "0.95rem", 
              boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
              position: "relative"
            }}>
              {selectedTemplate.components.map((comp, idx) => {
                if (comp.type === "HEADER") return (
                  <div key={idx} style={{ fontWeight: "bold", borderBottom: "1px solid #f0f0f0", marginBottom: "8px", paddingBottom: "4px", fontSize: "1.05rem" }}>
                    {formatPreviewText(comp.text, "HEADER")}
                  </div>
                );
                if (comp.type === "BODY") return (
                  <div key={idx} style={{ whiteSpace: "pre-wrap", lineHeight: "1.4" }}>
                    {formatPreviewText(comp.text, "BODY")}
                  </div>
                );
                if (comp.type === "FOOTER") return (
                  <div key={idx} style={{ fontSize: "0.8rem", color: "#888", marginTop: "8px" }}>
                    {comp.text}
                  </div>
                );
                if (comp.type === "BUTTONS") return (
                  <div key={idx} style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "2px" }}>
                    {comp.buttons.map((btn, bIdx) => (
                      <div key={bIdx} style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        gap: "8px", 
                        color: "#00a884", 
                        fontSize: "0.9rem", 
                        justifyContent: "center", 
                        padding: "8px",
                        background: "rgba(0, 168, 132, 0.05)",
                        borderTop: "1px solid #f0f0f0",
                        fontWeight: "500"
                      }}>
                        {btn.type === "PHONE_NUMBER" ? <Send size={14} /> : <MousePointer2 size={14} />} 
                        {btn.text}
                      </div>
                    ))}
                  </div>
                );
                return null;
              })}
              <div style={{ fontSize: "0.65rem", color: "#999", textAlign: "right", marginTop: "4px" }}>
                10:59 AM
              </div>
            </div>
          </div>

          {/* Variable Inputs */}
          <div>
            <div style={{ background: "var(--bg-tertiary)", padding: "1.5rem", borderRadius: "12px", border: "1px solid var(--glass-border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "1.5rem" }}>
                <div style={{ background: "var(--accent-primary)", padding: "8px", borderRadius: "8px" }}>
                  <Type size={20} color="black" />
                </div>
                <div>
                  <h5 style={{ margin: 0 }}>Custom Variables</h5>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-secondary)" }}>Fill values for placeholders</p>
                </div>
              </div>

              {Object.keys(templateVars).length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                  {Object.keys(templateVars).sort().map(key => {
                    const isMedia = ["IMAGE", "VIDEO", "DOCUMENT"].some(type => key.includes(type));
                    const label = isMedia ? `${key.split("_")[1]} URL` : `${key.split("_")[0]} Variable ${key.split("_")[1]}`;
                    const placeholder = isMedia ? `https://example.com/image.jpg` : `Value for {{${key.split("_")[1]}}}`;
                    
                    return (
                      <div key={key}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                          <label style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--text-secondary)" }}>
                            {label}
                          </label>
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <input 
                            type="text"
                            style={{ flex: 1, padding: "12px", background: "var(--bg-secondary)", border: "1px solid var(--glass-border)", color: "white", borderRadius: "8px", fontSize: "0.9rem" }}
                            placeholder={placeholder}
                            value={templateVars[key]}
                            onChange={(e) => handleVarChange(key, e.target.value)}
                            required
                          />
                          {isMedia && (
                            <>
                              <input type="file" id={`campaign-upload-${key}`} style={{ display: "none" }} onChange={(e) => handleImageUpload(e, key)} accept="image/*,video/*,application/pdf" />
                              <button 
                                type="button"
                                onClick={() => document.getElementById(`campaign-upload-${key}`).click()}
                                disabled={isUploading}
                                style={{ padding: "0 15px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--glass-border)", color: "white", borderRadius: "8px", fontSize: "0.7rem", cursor: "pointer" }}
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
              ) : (
                <div style={{ padding: "2rem", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px dashed var(--glass-border)", textAlign: "center", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                  No dynamic variables detected in this template.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const contactCount = newCampaign.contactsRaw.split("\n").map(p => p.trim()).filter(p => p.length > 5).length;

  return (
    <div className="campaign-manager">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2rem" }}>
        <h3>Bulk Send Campaigns</h3>
        <button className="btn-primary" onClick={() => {
          setShowCreate(!showCreate);
          setSelectedTemplate(null);
          setTemplateVars({});
        }}>
          {showCreate ? "View Campaigns" : "Start New Campaign"}
        </button>
      </div>

      {showCreate ? (
        <form className="glass-card" onSubmit={handleStartCampaign}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1rem" }}>
            <div>
              <label>Campaign Name</label>
              <input 
                type="text" 
                style={{ width: "100%", padding: "10px", background: "var(--bg-tertiary)", border: "1px solid var(--glass-border)", color: "white", borderRadius: "8px", marginTop: "5px" }}
                placeholder="e.g. Festival Greeting April"
                value={newCampaign.name}
                onChange={e => setNewCampaign({...newCampaign, name: e.target.value})}
                required
              />
            </div>
            
            <div>
              <label style={{ display: "flex", justifyContent: "space-between" }}>
                Select Setup 
                <span style={{ fontSize: "0.7rem", color: "var(--accent-primary)" }}>Presets auto-fill everything</span>
              </label>
              <select 
                style={{ width: "100%", padding: "10px", background: "rgba(37, 211, 102, 0.1)", border: "1px solid var(--accent-primary)", color: "white", borderRadius: "8px", marginTop: "5px", marginBottom: "10px" }}
                value={selectedPreset}
                onChange={(e) => handlePresetChange(e.target.value)}
              >
                <option value="">-- Use a Saved Preset (Optional) --</option>
                {presets.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>

              <select 
                style={{ width: "100%", padding: "10px", background: "var(--bg-tertiary)", border: "1px solid var(--glass-border)", color: "white", borderRadius: "8px" }}
                value={newCampaign.templateName}
                onChange={(e) => {
                  handleTemplateChange(e);
                  setSelectedPreset("");
                }}
                required
              >
                <option value="">-- Or Choose Raw Template --</option>
                {templates.map(t => <option key={t._id} value={t.name}>{t.name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
              <label>Contacts (Paste phone numbers or upload file)</label>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <span style={{ fontSize: "0.75rem", background: "var(--accent-primary)", color: "black", padding: "2px 8px", borderRadius: "10px", fontWeight: "bold" }}>
                  {contactCount} Numbers
                </span>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  style={{ display: "none" }} 
                  accept=".csv,.xlsx,.xls,.txt"
                  onChange={handleFileUpload}
                />
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current.click()}
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--glass-border)", color: "white", padding: "4px 12px", borderRadius: "6px", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "5px", cursor: "pointer" }}
                >
                  <FileUp size={14} /> Upload File
                </button>
                <button 
                  type="button" 
                  onClick={verifyNumbers}
                  disabled={loading || contactCount === 0}
                  style={{ background: "rgba(37, 211, 102, 0.1)", border: "1px solid var(--accent-primary)", color: "var(--accent-primary)", padding: "4px 12px", borderRadius: "6px", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "5px", cursor: "pointer", opacity: (loading || contactCount === 0) ? 0.5 : 1 }}
                >
                  <CheckCircle2 size={14} /> Check WhatsApp
                </button>
              </div>
            </div>
            <textarea 
              rows="6" 
              style={{ width: "100%", padding: "10px", background: "var(--bg-tertiary)", border: "1px solid var(--glass-border)", color: "white", borderRadius: "8px", marginTop: "5px", fontFamily: "monospace", fontSize: "0.9rem" }}
              placeholder="919801017333&#10;917004455666"
              value={newCampaign.contactsRaw}
              onChange={e => setNewCampaign({...newCampaign, contactsRaw: e.target.value})}
              required
            ></textarea>
            <p style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: "5px" }}>
              <UploadCloud size={10} /> Supports CSV, Excel (.xlsx), and Text (.txt) files.
            </p>
          </div>

          {renderTemplatePreview()}

          <button type="submit" className="btn-primary" style={{ width: "100%", marginTop: "2rem", display: "flex", justifyContent: "center", alignItems: "center", gap: "10px" }}>
            <Play size={18} fill="currentColor" /> Launch Campaign
          </button>
        </form>
      ) : (
        <div style={{ display: "grid", gap: "1.5rem" }}>
          {campaigns.map(camp => (
            <div key={camp._id} className="glass-card">
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
                <div>
                  <h4 style={{ fontSize: "1.1rem" }}>{camp.name}</h4>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{camp.template?.name} • {new Date(camp.createdAt).toLocaleDateString()}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(37, 211, 102, 0.1)", color: "var(--accent-primary)", padding: "4px 12px", borderRadius: "15px", fontSize: "0.75rem", fontWeight: "700" }}>
                  {camp.status === "COMPLETED" ? <CheckCircle2 size={14} /> : <div className="animate-pulse" style={{ background: "var(--accent-primary)", width: "6px", height: "6px", borderRadius: "50%" }}></div>}
                  {camp.status}
                </div>
              </div>

              {/* Progress Bar */}
              <div style={{ background: "var(--bg-tertiary)", height: "8px", borderRadius: "10px", overflow: "hidden", marginBottom: "1rem" }}>
                <div style={{ 
                  background: "var(--accent-primary)", 
                  width: `${(camp.sentCount / camp.totalContacts) * 100}%`, 
                  height: "100%", 
                  transition: "width 0.5s ease" 
                }}></div>
              </div>

              <div style={{ display: "flex", gap: "2rem", alignItems: "center" }}>
                <div>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Total</span>
                  <p style={{ fontWeight: "700" }}>{camp.totalContacts}</p>
                </div>
                <div>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Sent</span>
                  <p style={{ fontWeight: "700", color: "var(--accent-primary)" }}>{camp.sentCount}</p>
                </div>
                <div>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Failed</span>
                  <p style={{ fontWeight: "700", color: "#ff4757" }}>{camp.failedCount}</p>
                </div>
                <button 
                  onClick={() => {
                    setSelectedLogs(camp.logs || []);
                    setShowLogsModal(true);
                  }}
                  style={{ marginLeft: "auto", background: "rgba(255,255,255,0.05)", border: "1px solid var(--glass-border)", color: "white", padding: "6px 15px", borderRadius: "8px", fontSize: "0.8rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}
                >
                  <List size={14} /> View Details
                </button>
              </div>
            </div>
          ))}
          {campaigns.length === 0 && !loading && (
            <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-secondary)" }}>
              No campaigns launched yet. Start one to see growth in action.
            </div>
          )}
        </div>
      )}

      {/* Logs Modal */}
      {showLogsModal && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="glass-card" style={{ width: "600px", maxWidth: "90%", padding: "2rem", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}>
              <h3>Campaign Details</h3>
              <button onClick={() => setShowLogsModal(false)} style={{ background: "transparent", border: "none", color: "white", cursor: "pointer", fontSize: "1.2rem" }}>X</button>
            </div>
            
            <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
              <div style={{ flex: 1, padding: "1rem", background: "rgba(37, 211, 102, 0.1)", borderRadius: "10px", textAlign: "center" }}>
                <h4 style={{ color: "var(--accent-primary)", margin: 0 }}>{selectedLogs.filter(l => l.status === "sent").length}</h4>
                <span style={{ fontSize: "0.7rem", opacity: 0.7 }}>Successful</span>
              </div>
              <div style={{ flex: 1, padding: "1rem", background: "rgba(255, 71, 87, 0.1)", borderRadius: "10px", textAlign: "center" }}>
                <h4 style={{ color: "#ff4757", margin: 0 }}>{selectedLogs.filter(l => l.status === "failed").length}</h4>
                <span style={{ fontSize: "0.7rem", opacity: 0.7 }}>Failed (Not on WA)</span>
              </div>
            </div>

            <div className="chat-scroll" style={{ flex: 1, overflowY: "auto", background: "rgba(0,0,0,0.2)", borderRadius: "10px", padding: "1rem" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", fontSize: "0.8rem", color: "var(--text-secondary)", borderBottom: "1px solid var(--glass-border)" }}>
                    <th style={{ padding: "10px" }}>Phone</th>
                    <th style={{ padding: "10px" }}>Status</th>
                    <th style={{ padding: "10px" }}>Error/Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedLogs.map((log, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.02)", fontSize: "0.85rem" }}>
                      <td style={{ padding: "10px" }}>{log.phone}</td>
                      <td style={{ padding: "10px" }}>
                        <span style={{ color: log.status === "sent" ? "var(--accent-primary)" : "#ff4757", fontWeight: "bold" }}>
                          {log.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: "10px", color: "var(--text-secondary)", fontSize: "0.75rem" }}>
                        {log.error || "-"}
                      </td>
                    </tr>
                  ))}
                  {selectedLogs.length === 0 && (
                    <tr>
                      <td colSpan="3" style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>No logs available for this campaign.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignManager;
