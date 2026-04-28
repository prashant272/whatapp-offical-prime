import React, { useState, useEffect, useRef } from "react";
import api, { API_BASE } from "../api";
import { Send, List, UserPlus, Play, CheckCircle2, AlertCircle, Eye, Type, MousePointer2, FileUp, UploadCloud, Smartphone } from "lucide-react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { io } from "socket.io-client";
import { useWhatsAppAccount } from "../WhatsAppAccountContext";

const CampaignManager = () => {
  const { activeAccount } = useWhatsAppAccount();
  const [campaigns, setCampaigns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [presets, setPresets] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState("");
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateVars, setTemplateVars] = useState({});
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [selectedLogs, setSelectedLogs] = useState([]);
  const [newCampaign, setNewCampaign] = useState({
    name: "",
    templateName: "",
    contactsRaw: "",
    delay: 2
  });
  const fileInputRef = useRef(null);

  const fetchData = async () => {
    if (!activeAccount) return;
    setLoading(true);
    try {
      const [campRes, tempRes, presetRes] = await Promise.all([
        api.get("/campaigns"),
        api.get("/templates"),
        api.get("/presets")
      ]);
      setCampaigns(Array.isArray(campRes.data) ? campRes.data : []);
      // Templates are already filtered by account in the backend thanks to our middleware
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
  }, [activeAccount]);

  const handleImageUpload = async (e, key) => {
    const file = e.target.files[0];
    if (!file) return;
    const uploadData = new FormData();
    uploadData.append("file", file);
    try {
      setIsUploading(true);
      const res = await api.post("/upload", uploadData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setTemplateVars({ ...templateVars, [key]: res.data.url });
    } catch (err) {
      alert("Upload failed: " + (err.response?.data?.error || err.message));
    } finally {
      setIsUploading(false);
    }
  };

  const handleTemplateChange = (e) => {
    const name = e.target.value;
    const template = templates.find(t => t.name === name);
    setSelectedTemplate(template);
    setNewCampaign({ ...newCampaign, templateName: name });
    
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
      const res = await api.post("/contacts/verify", { phones });
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

    const templateComponents = [];
    if (selectedTemplate) {
      const bodyParams = [];
      const headerParams = [];

      Object.entries(templateVars).forEach(([key, val]) => {
        if (key.startsWith("BODY_")) {
          bodyParams.push({ type: "text", text: val });
        } else if (key.startsWith("HEADER_")) {
          // Check if template has a media header
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
    }

    try {
      await api.post("/campaigns", {
        name: newCampaign.name,
        templateName: newCampaign.templateName,
        contacts: phones.map(p => ({ phone: p })),
        templateComponents,
        whatsappAccountId: activeAccount?._id, // Link campaign to account
        delay: Number(newCampaign.delay)
      });
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
    return (
      <div className="template-preview-container" style={{ marginTop: "2rem", borderTop: "1px solid var(--glass-border)", paddingTop: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h4 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Eye size={18} /> Message Preview
          </h4>
        </div>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "2rem" }}>
          <div className="whatsapp-preview-box" style={{ 
            background: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')",
            backgroundSize: "cover", borderRadius: "15px", padding: "20px", minHeight: "200px", display: "flex", alignItems: "flex-start", border: "1px solid var(--glass-border)"
          }}>
            <div style={{ background: "#ffffff", color: "#303030", padding: "12px", borderRadius: "0 15px 15px 15px", maxWidth: "90%", fontSize: "0.95rem", boxShadow: "0 2px 5px rgba(0,0,0,0.1)" }}>
              {selectedTemplate.components.map((comp, idx) => {
                if (comp.type === "HEADER") {
                  if (["IMAGE", "VIDEO", "DOCUMENT"].includes(comp.format)) {
                    // Try to find URL in templateVars (check both new and legacy keys)
                    const imgUrl = templateVars[`HEADER_${comp.format}`] || templateVars[`HEADER_HANDLE`] || templateVars[`Variable_HANDLE`];
                    return (
                      <div key={idx} style={{ background: "#ddd", height: "140px", borderRadius: "8px", marginBottom: "10px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {imgUrl ? <img src={imgUrl} alt="Header" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ fontSize: "0.7rem", color: "#888" }}>[{comp.format} PREVIEW]</div>}
                      </div>
                    );
                  }
                  return <div key={idx} style={{ fontWeight: "bold", borderBottom: "1px solid #f0f0f0", marginBottom: "8px", paddingBottom: "4px" }}>{formatPreviewText(comp.text, "HEADER")}</div>;
                }
                if (comp.type === "BODY") return <div key={idx} style={{ whiteSpace: "pre-wrap", lineHeight: "1.4" }}>{formatPreviewText(comp.text, "BODY")}</div>;
                if (comp.type === "FOOTER") return <div key={idx} style={{ fontSize: "0.8rem", color: "#888", marginTop: "8px" }}>{comp.text}</div>;
                if (comp.type === "BUTTONS") return (
                  <div key={idx} style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "2px" }}>
                    {comp.buttons.map((btn, bIdx) => (
                      <div key={bIdx} style={{ display: "flex", alignItems: "center", gap: "8px", color: "#00a884", fontSize: "0.9rem", justifyContent: "center", padding: "8px", background: "rgba(0, 168, 132, 0.05)", borderTop: "1px solid #f0f0f0", fontWeight: "500" }}>
                        {btn.type === "PHONE_NUMBER" ? <Send size={14} /> : <MousePointer2 size={14} />} {btn.text}
                      </div>
                    ))}
                  </div>
                );
                return null;
              })}
            </div>
          </div>

          <div style={{ background: "var(--bg-tertiary)", padding: "1.5rem", borderRadius: "12px", border: "1px solid var(--glass-border)" }}>
            <h5 style={{ margin: "0 0 1rem 0" }}>Custom Variables</h5>
            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              {Object.keys(templateVars).sort().map(key => {
                // Smart Media Detection for Label
                const headerComp = selectedTemplate.components.find(c => c.type === "HEADER");
                const isMedia = (["IMAGE", "VIDEO", "DOCUMENT"].some(type => key.includes(type))) || (key.includes("HANDLE") && headerComp && ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerComp.format));
                
                let label = `Variable ${key.split("_")[1]}`;
                if (isMedia) {
                  label = `${headerComp?.format || "Media"} URL`;
                }

                return (
                  <div key={key}>
                    <label style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--text-secondary)", display: "block", marginBottom: "5px" }}>{label}</label>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <input type="text" style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "1px solid #ddd" }} value={templateVars[key]} onChange={(e) => handleVarChange(key, e.target.value)} />
                      {isMedia && (
                        <>
                          <input type="file" id={`camp-upload-${key}`} style={{ display: "none" }} onChange={(e) => handleImageUpload(e, key)} />
                          <button type="button" onClick={() => document.getElementById(`camp-upload-${key}`).click()} style={{ padding: "0 15px", background: "#00a884", color: "white", borderRadius: "10px", border: "none" }}>{isUploading ? "..." : "Upload"}</button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const contactCount = newCampaign.contactsRaw.split("\n").map(p => p.trim()).filter(p => p.length > 5).length;

  return (
    <div className="campaign-manager">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2rem", alignItems: "center" }}>
        <div>
          <h3>Bulk Send Campaigns</h3>
          {activeAccount && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", color: "#00a884", fontWeight: "bold", background: "#f0fdf4", padding: "4px 12px", borderRadius: "20px", marginTop: "5px" }}>
              <Smartphone size={14} /> Broadcasting from: {activeAccount.name}
            </div>
          )}
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? "View History" : "New Campaign"}
        </button>
      </div>

      {showCreate ? (
        <form className="glass-card" onSubmit={handleStartCampaign}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1rem" }}>
            <div>
              <label>Campaign Name</label>
              <input type="text" style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginTop: "8px" }} placeholder="Festival Greeting" value={newCampaign.name} onChange={e => setNewCampaign({...newCampaign, name: e.target.value})} required />
            </div>
            <div>
              <label>Select Preset (Optional)</label>
              <select 
                style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #00a884", marginTop: "8px", background: "#f0fdf4" }} 
                value={selectedPreset} 
                onChange={(e) => handlePresetChange(e.target.value)}
              >
                <option value="">-- Use a Saved Preset --</option>
                {presets.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label>Or Choose Template ({activeAccount?.name})</label>
              <select style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginTop: "8px" }} value={newCampaign.templateName} onChange={(e) => {
                handleTemplateChange(e);
                setSelectedPreset("");
              }} required>
                <option value="">-- Choose Template --</option>
                {templates.map(t => <option key={t._id} value={t.name}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label>Delay Per Message (Sec)</label>
              <input type="number" min="0" step="1" style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginTop: "8px" }} value={newCampaign.delay} onChange={e => setNewCampaign({...newCampaign, delay: e.target.value})} required />
            </div>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <label>Contacts ({contactCount})</label>
              <div style={{ display: "flex", gap: "10px" }}>
                <input type="file" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileUpload} />
                <button type="button" onClick={() => fileInputRef.current.click()} style={{ fontSize: "0.75rem", padding: "4px 10px", borderRadius: "6px", background: "#f0f2f5" }}>Upload File</button>
                <button type="button" onClick={verifyNumbers} style={{ fontSize: "0.75rem", padding: "4px 10px", borderRadius: "6px", background: "#e7fce3", color: "#008069" }}>Verify Numbers</button>
              </div>
            </div>
            <textarea rows="4" style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", fontFamily: "monospace" }} placeholder="919876543210..." value={newCampaign.contactsRaw} onChange={e => setNewCampaign({...newCampaign, contactsRaw: e.target.value})} required></textarea>
          </div>

          {renderTemplatePreview()}

          <button type="submit" className="btn-primary" style={{ width: "100%", marginTop: "2rem", padding: "1rem" }}>Launch Campaign from {activeAccount?.name}</button>
        </form>
      ) : (
        <div style={{ display: "grid", gap: "1.5rem" }}>
          {campaigns.map(camp => (
            <div key={camp._id} className="glass-card">
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
                <div>
                  <h4 style={{ margin: 0 }}>{camp.name}</h4>
                  <span style={{ fontSize: "0.75rem", color: "#667781" }}>Template: {camp.templateName}</span>
                </div>
                <div style={{ fontSize: "0.75rem", background: "#f0f2f5", padding: "4px 10px", borderRadius: "10px" }}>{camp.status}</div>
              </div>
              <div style={{ background: "#eee", height: "6px", borderRadius: "3px", overflow: "hidden", marginBottom: "1rem" }}>
                <div style={{ background: "#00a884", height: "100%", width: `${(camp.sentCount / camp.totalContacts) * 100}%` }}></div>
              </div>
              <div style={{ display: "flex", gap: "1.5rem", fontSize: "0.85rem" }}>
                <div>Total: <strong>{camp.totalContacts}</strong></div>
                <div>Sent: <strong style={{ color: "#00a884" }}>{camp.sentCount}</strong></div>
                <div>Failed: <strong style={{ color: "#ff4757" }}>{camp.failedCount}</strong></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CampaignManager;
