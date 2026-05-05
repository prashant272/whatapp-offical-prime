import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import api, { API_BASE } from "../api";
import { Send, List, UserPlus, Play, CheckCircle2, AlertCircle, Eye, Type, MousePointer2, FileUp, UploadCloud, Smartphone, Calendar, Clock, Trash2, RotateCcw } from "lucide-react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { io } from "socket.io-client";
import { useWhatsAppAccount } from "../WhatsAppAccountContext";

const CampaignManager = () => {
  const location = useLocation();
  const { activeAccount, accounts } = useWhatsAppAccount();
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
  const [logSearch, setLogSearch] = useState("");
  const [showAllCampaigns, setShowAllCampaigns] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: "",
    templateName: "",
    contactsRaw: "",
    delay: 2,
    sector: "",
    whatsappAccountId: activeAccount?._id || ""
  });
  const [tags, setTags] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [selectedSourceType, setSelectedSourceType] = useState(""); // "tag" or "sector"
  const [selectedSourceValue, setSelectedSourceValue] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [loadLimit, setLoadLimit] = useState(100);
  const [loadSkip, setLoadSkip] = useState(0);
  const [loadFromAllAccounts, setLoadFromAllAccounts] = useState(false);
  const [loadCampaignStatus, setLoadCampaignStatus] = useState("all");
  const [customStatuses, setCustomStatuses] = useState([]);
  const [existingNumbers, setExistingNumbers] = useState([]); // Array of { phone, sector }
  const [bulkSector, setBulkSector] = useState("");
  const [showRecampaignModal, setShowRecampaignModal] = useState(false);
  const [recampaignSource, setRecampaignSource] = useState(null);
  const fileInputRef = useRef(null);

  const fetchData = async () => {
    if (!activeAccount) return;
    setLoading(true);
    try {
      const [campRes, tempRes, presetRes, tagRes] = await Promise.all([
        api.get("/campaigns").catch(e => ({ data: [] })),
        api.get("/templates").catch(e => ({ data: [] })),
        api.get("/presets").catch(e => ({ data: [] })),
        api.get("/contacts/tags").catch(e => ({ data: [] }))
      ]);

      const [sectorRes, statusRes] = await Promise.all([
        api.get("/sectors").catch(e => ({ data: [] })),
        api.get("/statuses").catch(e => ({ data: [] }))
      ]);

      setCampaigns(Array.isArray(campRes.data) ? campRes.data : []);
      const templatesList = Array.isArray(tempRes.data) ? tempRes.data : [];
      setTemplates(templatesList.filter(t => t.status === "APPROVED"));
      setPresets(Array.isArray(presetRes.data) ? presetRes.data : []);
      setTags(Array.isArray(tagRes.data) ? tagRes.data : []);
      setSectors(Array.isArray(sectorRes.data) ? sectorRes.data : []);
      setCustomStatuses(Array.isArray(statusRes.data) ? statusRes.data : []);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    if (location.state?.numbers) {
      setNewCampaign(prev => ({ ...prev, contactsRaw: location.state.numbers }));
      setShowCreate(true);
      window.history.replaceState({}, document.title);
    }

    const socketUrl = import.meta.env.VITE_API_URL || window.location.origin;
    const socket = io(socketUrl);

    socket.on("campaign_progress", ({ campaignId, sentCount, failedCount, status, logs }) => {
      setCampaigns(prev => prev.map(c =>
        c._id === campaignId ? { ...c, sentCount, failedCount, status, logs } : c
      ));
    });

    if (activeAccount) {
      setNewCampaign(prev => ({ ...prev, whatsappAccountId: activeAccount._id }));
    }

    return () => socket.disconnect();
  }, [activeAccount, location.state]); 

  const handleImageUpload = async (e, key) => {
    // This function runs when the user selects an image from their computer for a campaign.
    // It uploads the image directly to Cloudinary (our cloud storage) and saves the secure URL.
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

  const handleRecampaign = (camp) => {
    setRecampaignSource(camp);
    setShowRecampaignModal(true);
  };

  const handleRecampaignSelection = (filterType) => {
    if (!recampaignSource) return;
    const camp = recampaignSource;
    const tName = camp.templateName || camp.template?.name || "";
    const template = templates.find(t => t.name === tName);
    
    let targetPhones = [];
    if (filterType === "all") {
      targetPhones = (camp.contacts || []).map(c => c.phone);
    } else if (filterType === "failed") {
      targetPhones = (camp.logs || []).filter(l => l.status === "failed").map(l => l.phone);
    } else if (filterType === "sent") {
      targetPhones = (camp.logs || []).filter(l => l.status !== "failed").map(l => l.phone);
    }

    if (targetPhones.length === 0) {
      alert(`No contacts found matching the filter: ${filterType}`);
      return;
    }

    setSelectedTemplate(template);
    setNewCampaign({
      name: `${camp.name} - ${filterType.toUpperCase()}`,
      templateName: tName,
      contactsRaw: targetPhones.join("\n"),
      delay: 2,
      sector: camp.sector || "",
      whatsappAccountId: activeAccount?._id || camp.whatsappAccountId?._id || ""
    });

    // Reset template variables
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
    setExistingNumbers([]);
    setShowRecampaignModal(false);
    setShowCreate(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
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

    // Find the full template object from the templates list
    const templateName = preset.template?.name || preset.templateName;
    const fullTemplate = templates.find(t => t.name === templateName || t._id === preset.template);

    setSelectedPreset(pId);
    setSelectedTemplate(fullTemplate || preset.template);
    setNewCampaign({ ...newCampaign, templateName: templateName || (fullTemplate?.name) });

    // Initialize all variables the template expects
    const vars = {};
    if (fullTemplate) {
      fullTemplate.components.forEach(comp => {
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

    // Merge with preset config (Preset config overrides default empty strings)
    setTemplateVars({ ...vars, ...(preset.config || {}) });
  };

  const verifyNumbers = async () => {
    // This feature connects directly to WhatsApp to check if the uploaded phone numbers actually have WhatsApp accounts.
    // It automatically filters out invalid numbers so your campaign doesn't fail.
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

  const checkExistingMessages = async () => {
    const phones = newCampaign.contactsRaw.split(/[,\n]/).map(p => p.trim()).filter(p => p.length > 5);
    if (phones.length === 0) return alert("No numbers to check.");

    setLoading(true);
    try {
      const res = await api.post("/contacts/check-existing", { phones });
      const found = res.data.contacts || []; // New format: { phone, sector }
      setExistingNumbers(found);

      if (found.length > 0) {
        alert(`Found ${found.length} numbers that have already been messaged. Check the table below to assign sectors.`);
      } else {
        alert("No previously messaged numbers found (across all accounts).");
      }
    } catch (err) {
      alert("Check failed: " + (err.response?.data?.error || err.message));
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

  const handleUpdateStatus = async (id, status, allowOutsideHours) => {
    try {
      await api.patch(`/campaigns/${id}/status`, { status, allowOutsideHours });
      setCampaigns(prev => prev.map(c => {
        if (c._id === id) {
          const update = { ...c };
          if (status) update.status = status;
          if (allowOutsideHours !== undefined) update.allowOutsideHours = allowOutsideHours;
          return update;
        }
        return c;
      }));
    } catch (err) {
      if (err.response?.data?.error === "MISSING_PARAMETERS") {
        alert(err.response.data.message);
      } else {
        alert("Failed to update status");
      }
    }
  };

  const handleRetry = async (id) => {
    try {
      await api.post(`/campaigns/${id}/retry`);
      alert("Retry started!");
      fetchData();
    } catch (err) {
      alert("Failed to retry campaign");
    }
  };

  const handleDeleteCampaign = async (id) => {
    if (!window.confirm("Are you sure you want to delete this campaign? This action cannot be undone.")) return;
    try {
      await api.delete(`/campaigns/${id}`);
      setCampaigns(prev => prev.filter(c => c._id !== id));
    } catch (err) {
      alert("Error deleting campaign: " + err.message);
    }
  };

  const handleStartCampaign = async (e) => {
    e.preventDefault();
    if (!activeAccount) return alert("Select an account first");
    if (!newCampaign.templateName) return alert("Select a template");
    if (!newCampaign.contactsRaw) return alert("Add contacts");

    const phones = newCampaign.contactsRaw.split(/[,\n]/).map(p => p.trim()).filter(p => p.length > 5);
    if (phones.length === 0) return alert("Please add at least one valid phone number.");

    const templateComponents = [];
    if (selectedTemplate) {
      const bodyParams = [];
      const headerParams = [];

      // Sort keys to ensure variables are added in order (1, 2, 3...)
      const sortedVarKeys = Object.keys(templateVars).sort((a, b) => {
        const numA = parseInt(a.split("_").pop()) || 0;
        const numB = parseInt(b.split("_").pop()) || 0;
        return numA - numB;
      });

      sortedVarKeys.forEach(key => {
        const val = templateVars[key] || "";
        const upperKey = key.toUpperCase();
        
        if (upperKey.startsWith("BODY_") || upperKey.startsWith("VARIABLE_")) {
          bodyParams.push({ type: "text", text: val });
        } else if (upperKey.startsWith("HEADER_")) {
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
      if (!newCampaign.whatsappAccountId || newCampaign.whatsappAccountId === "all") {
        alert("Please select a specific Sender Number (cannot be 'All Accounts').");
        setLoading(false);
        return;
      }

      const payload = {
        name: newCampaign.name,
        templateName: newCampaign.templateName,
        whatsappAccountId: newCampaign.whatsappAccountId,
        contacts: phones,
        templateComponents,
        delay: parseInt(newCampaign.delay),
        sector: newCampaign.sector
      };

      await api.post("/campaigns", payload);
      alert("Campaign launched!");
      setShowCreate(false);
      setNewCampaign({ name: "", templateName: "", contactsRaw: "", delay: 2, sector: "" });
      fetchData();
    } catch (err) {
      alert("Error launching campaign: " + (err.response?.data?.error || err.message));
    }
  };

  const isNightTime = () => {
    const hours = new Date().getHours();
    return hours < 8 || hours >= 19;
  };

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
              <label>Select Sender Number {activeAccount && <span style={{ color: "#00a884", fontSize: "0.75rem", fontWeight: "bold" }}>(Auto-selected from Sidebar)</span>}</label>
              <select 
                style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginTop: "8px", background: activeAccount ? "#f8f9fa" : "white" }}
                value={newCampaign.whatsappAccountId}
                onChange={e => setNewCampaign({ ...newCampaign, whatsappAccountId: e.target.value })}
                required
                disabled={!!activeAccount}
              >
                <option value="">-- Choose Account --</option>
                {accounts.map(acc => (
                  <option key={acc._id} value={acc._id}>{acc.name} ({acc.phoneNumberId})</option>
                ))}
              </select>
            </div>
            <div>
              <label>Campaign Name</label>
              <input type="text" style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginTop: "8px" }} placeholder="Festival Greeting" value={newCampaign.name} onChange={e => setNewCampaign({ ...newCampaign, name: e.target.value })} required />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1rem" }}>
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
              <label>Choose Message Template</label>
              <select style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginTop: "8px" }} value={newCampaign.templateName} onChange={(e) => {
                handleTemplateChange(e);
                setSelectedPreset("");
              }} required>
                <option value="">-- Choose Template --</option>
                {templates.map(t => <option key={t._id} value={t.name}>{t.name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1rem" }}>
            <div>
              <label>Delay Per Message (Sec)</label>
              <input type="number" min="0" step="1" style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginTop: "8px" }} value={newCampaign.delay} onChange={e => setNewCampaign({ ...newCampaign, delay: e.target.value })} required />
            </div>
            <div>
              <label>Assign Sector to Contacts</label>
              <select
                style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginTop: "8px" }}
                value={newCampaign.sector}
                onChange={(e) => setNewCampaign({ ...newCampaign, sector: e.target.value })}
              >
                <option value="">-- Choose Sector (Optional) --</option>
                {sectors.map(s => <option key={s._id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", color: "#667781" }}>Target Contacts</label>

            <div style={{ background: "#f0f2f5", padding: "15px", borderRadius: "12px", border: "1px solid #ddd", marginBottom: "12px" }}>
              <p style={{ margin: "0 0 10px 0", fontSize: "0.85rem", color: "#00a884", fontWeight: "700" }}>Option 1: Load from Database (Tags/Sectors)</p>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <select
                  style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #ddd", minWidth: "120px" }}
                  value={selectedSourceType}
                  onChange={(e) => setSelectedSourceType(e.target.value)}
                >
                  <option value="">Category (All)</option>
                  <option value="tag">By Tag</option>
                  <option value="sector">By Sector</option>
                </select>

                <select
                  style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #ddd", minWidth: "120px" }}
                  value={selectedSourceValue}
                  onChange={(e) => setSelectedSourceValue(e.target.value)}
                  disabled={!selectedSourceType}
                >
                  <option value="">Select Value</option>
                  {selectedSourceType === "tag" ? tags.map(t => <option key={t} value={t}>{t}</option>) :
                    selectedSourceType === "sector" ? sectors.map(s => <option key={s._id} value={s.name}>{s.name}</option>) : null}
                </select>

                <select
                  style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #ddd", minWidth: "120px" }}
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                >
                  <option value="">All Status</option>
                  {customStatuses.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                </select>

                <select
                  style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #ddd", minWidth: "120px" }}
                  value={loadCampaignStatus}
                  onChange={(e) => setLoadCampaignStatus(e.target.value)}
                >
                  <option value="all">All Contacts</option>
                  <option value="unsent">Unsent Only</option>
                  <option value="sent">Already Sent</option>
                </select>

                <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "white", padding: "0 10px", borderRadius: "8px", border: "1px solid #ddd" }}>
                  <span style={{ fontSize: "0.75rem", color: "#667781" }}>Start from:</span>
                  <input 
                    type="number" 
                    value={loadSkip} 
                    onChange={(e) => setLoadSkip(e.target.value)} 
                    style={{ width: "60px", border: "none", outline: "none", fontSize: "0.85rem", padding: "10px 0" }}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "white", padding: "0 10px", borderRadius: "8px", border: "1px solid #ddd" }}>
                  <span style={{ fontSize: "0.75rem", color: "#667781" }}>Limit:</span>
                  <input 
                    type="number" 
                    value={loadLimit} 
                    onChange={(e) => setLoadLimit(e.target.value)} 
                    style={{ width: "60px", border: "none", outline: "none", fontSize: "0.85rem", padding: "10px 0" }}
                  />
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    try {
                      let url = `/contacts?limit=${loadLimit}&skip=${loadSkip}&showAllAccounts=true`;
                      if (selectedSourceType && selectedSourceValue) url += `&${selectedSourceType}=${selectedSourceValue}`;
                      if (selectedStatus) url += `&status=${selectedStatus}`;
                      
                      if (loadCampaignStatus === "unsent") url += `&isCampaignSent=false`;
                      else if (loadCampaignStatus === "sent") url += `&isCampaignSent=true`;

                      const res = await api.get(url, {
                        headers: { "x-whatsapp-account-id": "all" }
                      });
                      const numbers = res.data.contacts.map(c => c.phone).join("\n");
                      setNewCampaign({ ...newCampaign, contactsRaw: numbers });
                      alert(`✅ Loaded ${res.data.contacts.length} contacts starting from #${loadSkip}!`);
                    } catch (err) { alert("Failed to load contacts"); }
                  }}
                  style={{ padding: "10px 20px", background: "#00a884", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "700" }}
                >
                  Load
                </button>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#667781", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px" }}>
                Option 2: Manual / File Upload
                {newCampaign.contactsRaw.split(/[,\n]/).map(p => p.trim()).filter(p => p.length > 5).length > 0 && (
                  <span style={{ background: "#00a884", color: "white", padding: "2px 10px", borderRadius: "10px", fontSize: "0.7rem", fontWeight: "bold" }}>
                    {newCampaign.contactsRaw.split(/[,\n]/).map(p => p.trim()).filter(p => p.length > 5).length} Numbers Detected
                  </span>
                )}
              </p>
              <div style={{ display: "flex", gap: "10px" }}>
                <input type="file" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileUpload} />
                <button type="button" onClick={() => fileInputRef.current.click()} style={{ fontSize: "0.75rem", padding: "4px 10px", borderRadius: "6px", background: "#f0f2f5" }}>Upload File</button>
                <button type="button" onClick={verifyNumbers} style={{ fontSize: "0.75rem", padding: "4px 10px", borderRadius: "6px", background: "#e7fce3", color: "#008069" }}>Verify Numbers</button>
                <button type="button" onClick={checkExistingMessages} style={{ fontSize: "0.75rem", padding: "4px 10px", borderRadius: "6px", background: "#fff5f5", color: "#ff4757" }}>Check Previous Messages</button>
              </div>
            </div>
            <textarea rows="4" style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", fontFamily: "monospace" }} placeholder="919876543210..." value={newCampaign.contactsRaw} onChange={e => setNewCampaign({ ...newCampaign, contactsRaw: e.target.value })} required></textarea>

            {existingNumbers.length > 0 && (
              <div style={{ marginTop: "10px", padding: "12px", background: "rgba(255, 171, 0, 0.05)", borderRadius: "10px", border: "1px solid #ffab00" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <span style={{ fontSize: "0.85rem", color: "#ffab00", fontWeight: "bold" }}>⚠️ {existingNumbers.length} Existing Contacts Found:</span>
                  
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <select 
                      style={{ padding: "6px 10px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "0.75rem" }}
                      value={bulkSector}
                      onChange={(e) => setBulkSector(e.target.value)}
                    >
                      <option value="">-- Bulk Sector --</option>
                      {sectors.map(s => <option key={s._id} value={s.name}>{s.name}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!bulkSector) return alert("Select a sector first");
                        try {
                          await api.post("/contacts/bulk-update", { 
                            phones: existingNumbers.map(n => n.phone), 
                            sector: bulkSector 
                          });
                          alert(`✅ Updated ${existingNumbers.length} contacts to ${bulkSector}!`);
                          setExistingNumbers(prev => prev.map(n => ({ ...n, sector: bulkSector })));
                        } catch (err) { alert("Bulk update failed"); }
                      }}
                      style={{ fontSize: "0.75rem", padding: "6px 12px", borderRadius: "8px", background: "#00a884", color: "white", border: "none", fontWeight: "bold" }}
                    >
                      Assign to All
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const phones = newCampaign.contactsRaw.split(/[,\n]/).map(p => p.trim()).filter(p => p.length > 5);
                        const existingPhonesOnly = existingNumbers.map(n => n.phone);
                        const remaining = phones.filter(p => !existingPhonesOnly.includes(p));
                        setNewCampaign({ ...newCampaign, contactsRaw: remaining.join("\n") });
                        setExistingNumbers([]);
                      }}
                      style={{ fontSize: "0.75rem", padding: "6px 12px", borderRadius: "8px", background: "#ff4757", color: "white", border: "none", fontWeight: "bold" }}
                    >
                      Remove All
                    </button>
                  </div>
                </div>

                <div style={{ maxHeight: "200px", overflowY: "auto", background: "white", borderRadius: "8px", border: "1px solid #eee" }}>
                  <table style={{ width: "100%", fontSize: "0.75rem", borderCollapse: "collapse" }}>
                    <thead style={{ background: "#f8f9fa", position: "sticky", top: 0 }}>
                      <tr>
                        <th style={{ padding: "8px", textAlign: "left", borderBottom: "1px solid #eee" }}>Phone</th>
                        <th style={{ padding: "8px", textAlign: "left", borderBottom: "1px solid #eee" }}>Current Sector</th>
                      </tr>
                    </thead>
                    <tbody>
                      {existingNumbers.map((n, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid #f8f9fa" }}>
                          <td style={{ padding: "6px 8px" }}>{n.phone}</td>
                          <td style={{ padding: "6px 8px" }}>
                            <span style={{ 
                              background: n.sector === "Unassigned" ? "#f1f5f9" : "#e0f2fe", 
                              color: n.sector === "Unassigned" ? "#64748b" : "#0369a1",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              fontWeight: "bold"
                            }}>
                              {n.sector}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {renderTemplatePreview()}

          <button type="submit" className="btn-primary" style={{ width: "100%", marginTop: "2rem", padding: "1rem" }}>Launch Campaign from {activeAccount?.name}</button>
        </form>
      ) : (
        <div style={{ display: "grid", gap: "1.5rem" }}>
          {/* Active Campaigns First */}
          {campaigns.filter(c => ["RUNNING", "PAUSED", "PENDING"].includes(c.status)).map(camp => (
            <div key={camp._id} className="glass-card" style={{ position: "relative", borderLeft: "4px solid #339af0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
                <div>
                  <h4 style={{ margin: 0, color: "#111b21", fontSize: "1.1rem" }}>{camp.name}</h4>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "0.75rem", color: "#667781", background: "#f0f2f5", padding: "2px 8px", borderRadius: "4px" }}>
                      <Type size={14} /> <span>Template: <strong>{camp.templateName || camp.template?.name || "Unknown"}</strong></span>
                    </div>
                    {camp.startedAt && (
                      <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "0.75rem", color: "#339af0", background: "#e7f5ff", padding: "2px 8px", borderRadius: "4px" }}>
                        <Calendar size={14} /> <span>Started: {new Date(camp.startedAt).toLocaleString()}</span>
                      </div>
                    )}
                    {camp.whatsappAccountId && (
                      <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "0.75rem", color: "#00a884", background: "#f0fdf4", padding: "2px 8px", borderRadius: "4px" }}>
                        <Smartphone size={14} /> <span>From: {camp.whatsappAccountId.name || "Primary"}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                  <div style={{
                    fontSize: "0.7rem",
                    background: camp.status === "RUNNING" ? "#e7fce3" : camp.status === "PAUSED" ? "#fff9db" : "#f0f2f5",
                    color: camp.status === "RUNNING" ? "#008069" : camp.status === "PAUSED" ? "#f08c00" : "#667781",
                    padding: "4px 12px",
                    borderRadius: "12px",
                    fontWeight: "bold",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px"
                  }}>
                    {camp.status}
                  </div>
                  {isNightTime() && (camp.status === "RUNNING" || camp.status === "PAUSED") && !camp.allowOutsideHours ? (
                    <div style={{ fontSize: "0.6rem", color: "#339af0", marginTop: "4px", fontWeight: "600" }}>
                      (WAITING FOR 8AM)
                    </div>
                  ) : ""}
                </div>
              </div>
              <div style={{ background: "#eee", height: "6px", borderRadius: "3px", overflow: "hidden", marginBottom: "1rem" }}>
                <div style={{ background: "#00a884", height: "100%", width: `${(camp.sentCount / camp.totalContacts) * 100}%` }}></div>
              </div>
              <div style={{ display: "flex", gap: "1.5rem", fontSize: "0.85rem", alignItems: "center" }}>
                <div>Total: <strong>{camp.totalContacts}</strong></div>
                <div>Sent: <strong style={{ color: "#00a884" }}>{camp.sentCount}</strong></div>
                <div>Failed: <strong style={{ color: "#ff4757" }}>{camp.failedCount}</strong></div>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "1.5rem", borderTop: "1px solid #eee", paddingTop: "1rem" }}>
                {camp.status === "RUNNING" && (
                  <button onClick={() => handleUpdateStatus(camp._id, "PAUSED")} style={{ fontSize: "0.75rem", padding: "6px 12px", borderRadius: "6px", background: "#fff9db", color: "#f08c00", border: "1px solid #fab005", cursor: "pointer" }}>Pause</button>
                )}
                {camp.status === "PAUSED" && (
                  <button onClick={() => handleUpdateStatus(camp._id, "RUNNING")} style={{ fontSize: "0.75rem", padding: "6px 12px", borderRadius: "6px", background: "#e7fce3", color: "#008069", border: "1px solid #00a884", cursor: "pointer" }}>Resume</button>
                )}
                {camp.status === "RUNNING" && isNightTime() && !camp.allowOutsideHours && (
                  <button onClick={() => handleUpdateStatus(camp._id, "RUNNING", true)} style={{ fontSize: "0.75rem", padding: "6px 12px", borderRadius: "6px", background: "#339af0", color: "white", border: "none", cursor: "pointer" }}>Force Send</button>
                )}
                <button onClick={() => { setSelectedLogs(camp.logs || []); setShowLogsModal(true); }} style={{ fontSize: "0.75rem", padding: "6px 12px", borderRadius: "6px", background: "#f0f2f5", color: "#667781", border: "1px solid #ddd", cursor: "pointer", marginLeft: "auto" }}>View Logs</button>

                <button 
                  onClick={() => handleRecampaign(camp)} 
                  style={{ fontSize: "0.75rem", padding: "6px 12px", borderRadius: "6px", background: "#e7f5ff", color: "#339af0", border: "1px solid #a5d8ff", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}
                  title="Re-campaign (Copy Details)"
                >
                  <RotateCcw size={14} /> Re-campaign
                </button>

                <button
                  onClick={() => handleDeleteCampaign(camp._id)}
                  style={{ fontSize: "0.75rem", padding: "6px 12px", borderRadius: "6px", background: "#fff5f5", color: "#ff4757", border: "1px solid #ffe3e3", cursor: "pointer" }}
                  title="Delete Campaign"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}

          {/* Toggle Button for Old Campaigns */}
          {campaigns.some(c => ["COMPLETED", "FAILED"].includes(c.status)) && (
            <div style={{ textAlign: "center", margin: "1rem 0" }}>
              <button
                onClick={() => setShowAllCampaigns(!showAllCampaigns)}
                style={{
                  background: "white", border: "1px solid #ddd", padding: "10px 24px",
                  borderRadius: "24px", cursor: "pointer", fontSize: "0.9rem", color: "#111b21",
                  display: "inline-flex", alignItems: "center", gap: "10px", fontWeight: "bold",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.05)"
                }}
              >
                <List size={18} /> {showAllCampaigns ? "Hide Completed Campaigns" : `Show Old Campaigns (${campaigns.filter(c => ["COMPLETED", "FAILED"].includes(c.status)).length})`}
              </button>
            </div>
          )}

          {/* Old/Completed Campaigns */}
          {showAllCampaigns && campaigns.filter(c => ["COMPLETED", "FAILED"].includes(c.status)).map(camp => (
            <div key={camp._id} className="glass-card" style={{ position: "relative" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
                <div>
                  <h4 style={{ margin: 0, color: "#667781" }}>{camp.name}</h4>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "0.7rem", color: "#999", background: "#f8f9fa", padding: "2px 8px", borderRadius: "4px" }}>
                      <Type size={12} /> <span>Template: {camp.templateName || camp.template?.name || "Unknown"}</span>
                    </div>
                    {camp.startedAt && (
                      <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "0.7rem", color: "#339af0", background: "#e7f5ff", padding: "2px 8px", borderRadius: "4px" }}>
                        <Calendar size={12} /> <span>Started: {new Date(camp.startedAt).toLocaleString()}</span>
                      </div>
                    )}
                    {camp.completedAt && (
                      <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "0.7rem", color: "#008069", background: "#e7fce3", padding: "2px 8px", borderRadius: "4px" }}>
                        <CheckCircle2 size={12} /> <span>Completed: {new Date(camp.completedAt).toLocaleString()}</span>
                      </div>
                    )}
                    {camp.whatsappAccountId && (
                      <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "0.7rem", color: "#00a884", background: "#f0fdf4", padding: "2px 8px", borderRadius: "4px" }}>
                        <Smartphone size={12} /> <span>From: {camp.whatsappAccountId.name || "Primary"}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: "0.65rem", background: "#f0f2f5", color: "#667781", padding: "4px 10px", borderRadius: "10px", fontWeight: "bold" }}>
                  {camp.status}
                </div>
              </div>
              <div style={{ display: "flex", gap: "1.5rem", fontSize: "0.8rem", color: "#667781" }}>
                <div>Total: {camp.totalContacts}</div>
                <div>Sent: {camp.sentCount}</div>
                <div>Failed: {camp.failedCount}</div>
                <button onClick={() => { setSelectedLogs(camp.logs || []); setShowLogsModal(true); }} style={{ marginLeft: "auto", background: "none", border: "none", color: "#339af0", cursor: "pointer", fontSize: "0.8rem", textDecoration: "underline" }}>Logs</button>
                <button 
                  onClick={() => handleRecampaign(camp)} 
                  style={{ marginLeft: "10px", background: "none", border: "none", color: "#00a884", cursor: "pointer", fontSize: "0.8rem", textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: "3px" }}
                >
                  <RotateCcw size={12} /> Re-campaign
                </button>
                <button
                  onClick={() => handleDeleteCampaign(camp._id)}
                  style={{ background: "none", border: "none", color: "#ff4757", cursor: "pointer", marginLeft: "10px" }}
                  title="Delete Campaign"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Logs Modal */}
      {showLogsModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.7)", backdropFilter: "blur(5px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px"
        }}>
          <div style={{
            background: "white", width: "100%", maxWidth: "900px", maxHeight: "85vh",
            borderRadius: "20px", overflow: "hidden", display: "flex", flexDirection: "column",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)"
          }}>
            <div style={{
              padding: "20px 25px", borderBottom: "1px solid #eee",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              background: "#f8f9fa"
            }}>
              <h4 style={{ margin: 0, display: "flex", alignItems: "center", gap: "10px" }}>
                <List size={20} /> Campaign Delivery Logs ({selectedLogs.length})
              </h4>
              <div style={{ display: "flex", gap: "10px" }}>
                <input
                  type="text"
                  placeholder="Search number..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "0.85rem" }}
                />
                <button
                  onClick={() => { setShowLogsModal(false); setLogSearch(""); }}
                  style={{ background: "#eee", border: "none", padding: "8px 15px", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" }}
                >
                  Close
                </button>
              </div>
            </div>

            <div style={{ padding: "0", overflowY: "auto", flex: 1 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead style={{ position: "sticky", top: 0, background: "white", zIndex: 1, boxShadow: "0 1px 0 #eee" }}>
                  <tr>
                    <th style={{ padding: "15px 25px", fontSize: "0.85rem", color: "#667781" }}>Phone Number</th>
                    <th style={{ padding: "15px 25px", fontSize: "0.85rem", color: "#667781" }}>Status</th>
                    <th style={{ padding: "15px 25px", fontSize: "0.85rem", color: "#667781" }}>Info / Meta Error</th>
                    <th style={{ padding: "15px 25px", fontSize: "0.85rem", color: "#667781" }}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedLogs.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ padding: "40px", textAlign: "center", color: "#667781" }}>No logs available for this campaign yet.</td>
                    </tr>
                  ) : (
                    [...selectedLogs]
                      .filter(log => log.phone.toLowerCase().includes(logSearch.toLowerCase()))
                      .reverse()
                      .map((log, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid #f8f9fa" }}>
                          <td style={{ padding: "12px 25px", fontWeight: "600" }}>{log.phone}</td>
                          <td style={{ padding: "12px 25px" }}>
                            <span style={{
                              padding: "4px 8px", borderRadius: "6px", fontSize: "0.75rem", fontWeight: "bold",
                              background: log.status === "sent" ? "#e7fce3" : "#fff5f5",
                              color: log.status === "sent" ? "#008069" : "#ff4757"
                            }}>
                              {log.status.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: "12px 25px", fontSize: "0.85rem", color: log.error ? "#ff4757" : "#667781" }}>
                            {log.error || (log.messageId ? `Message ID: ${log.messageId}` : "Delivered successfully")}
                          </td>
                          <td style={{ padding: "12px 25px", fontSize: "0.75rem", color: "#999" }}>
                            {log.sentAt ? new Date(log.sentAt).toLocaleString() : "-"}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {/* Recampaign Modal */}
      {showRecampaignModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.7)", backdropFilter: "blur(5px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100
        }}>
          <div style={{ background: "white", padding: "30px", borderRadius: "20px", width: "400px", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }}>
            <h4 style={{ margin: "0 0 10px 0" }}>Re-campaign Strategy</h4>
            <p style={{ fontSize: "0.9rem", color: "#667781", marginBottom: "20px" }}>Choose which contacts you want to target from "<b>{recampaignSource?.name}</b>":</p>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button 
                onClick={() => handleRecampaignSelection("all")}
                style={{ padding: "12px", borderRadius: "10px", border: "1px solid #ddd", background: "#f8f9fa", cursor: "pointer", fontWeight: "600", textAlign: "left", display: "flex", justifyContent: "space-between" }}
              >
                <span>All Contacts</span>
                <span style={{ color: "#00a884" }}>{recampaignSource?.totalContacts}</span>
              </button>
              
              <button 
                onClick={() => handleRecampaignSelection("failed")}
                style={{ padding: "12px", borderRadius: "10px", border: "1px solid #ff4757", background: "#fff5f5", color: "#ff4757", cursor: "pointer", fontWeight: "600", textAlign: "left", display: "flex", justifyContent: "space-between" }}
              >
                <span>Only Failed</span>
                <span>{recampaignSource?.failedCount}</span>
              </button>
              
              <button 
                onClick={() => handleRecampaignSelection("sent")}
                style={{ padding: "12px", borderRadius: "10px", border: "1px solid #00a884", background: "#f0fdf4", color: "#00a884", cursor: "pointer", fontWeight: "600", textAlign: "left", display: "flex", justifyContent: "space-between" }}
              >
                <span>Only Sent/Success</span>
                <span>{recampaignSource?.sentCount}</span>
              </button>
            </div>

            <button 
              onClick={() => setShowRecampaignModal(false)}
              style={{ width: "100%", marginTop: "20px", padding: "10px", borderRadius: "10px", border: "none", background: "#eee", cursor: "pointer", fontWeight: "bold" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignManager;
