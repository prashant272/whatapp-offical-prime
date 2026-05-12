import React, { useState, useEffect } from "react";
import api, { API_BASE } from "../api";
import { Plus, CheckCircle, Clock, XCircle, RefreshCw, Filter, Info, AlertTriangle, Trash2 } from "lucide-react";
import { useWhatsAppAccount } from "../WhatsAppAccountContext";

const TemplateManager = () => {
  const { activeAccount } = useWhatsAppAccount();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [presets, setPresets] = useState([]);
  const [selectedTemplateForPreset, setSelectedTemplateForPreset] = useState(null);
  const [presetName, setPresetName] = useState("");
  const [templateVars, setTemplateVars] = useState({});
  const [editingPresetId, setEditingPresetId] = useState(null);
  const [filter, setFilter] = useState("ALL");
  const [localPreviews, setLocalPreviews] = useState({});

  const [formData, setFormData] = useState({
    name: "",
    category: "UTILITY",
    language: "en_US",
    body: "",
    headerType: "NONE",
    headerText: "",
    headerSampleUrl: "",
    footerText: ""
  });
  const [buttons, setButtons] = useState([]);
  
  const handleAddButton = () => {
    if (buttons.length >= 10) return alert("Maximum 10 buttons allowed.");
    setButtons([...buttons, { type: "QUICK_REPLY", text: "" }]);
  };

  const handleRemoveButton = (idx) => {
    setButtons(buttons.filter((_, i) => i !== idx));
  };

  const handleButtonChange = (idx, field, value) => {
    const newButtons = [...buttons];
    newButtons[idx][field] = value;
    // Reset secondary fields if type changes
    if (field === "type") {
      delete newButtons[idx].url;
      delete newButtons[idx].phone_number;
    }
    setButtons(newButtons);
  };

  const fetchTemplates = async () => {
    if (!activeAccount) return;
    setLoading(true);
    try {
      const res = await api.get("/templates");
      setTemplates(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching templates:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPresets = async () => {
    if (!activeAccount) return;
    try {
      const res = await api.get("/presets");
      setPresets(res.data);
    } catch (err) {
      console.error("Error fetching presets:", err);
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchPresets();
  }, [activeAccount]);

  const handleSync = async () => {
    if (!activeAccount) return;
    setLoading(true);
    try {
      const res = await api.post("/templates/sync");
      setTemplates(Array.isArray(res.data.templates) ? res.data.templates : []);
      alert(`✅ ${res.data.message}`);
    } catch (err) {
      const msg = err.response?.data?.details || err.response?.data?.error || err.message;
      alert("❌ Sync failed: " + msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (tplId, name) => {
    if (!window.confirm(`Are you sure you want to delete template "${name}"? This will remove it from both Meta and your dashboard.`)) return;
    setLoading(true);
    try {
      await api.delete(`/templates/${tplId}`);
      alert("✅ Template deleted successfully!");
      fetchTemplates();
    } catch (err) {
      alert("❌ Delete failed: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const components = [];
      if (formData.headerType !== "NONE") {
        const headerComp = { type: "HEADER", format: formData.headerType };
        if (formData.headerType === "TEXT") {
          headerComp.text = formData.headerText;
          const matches = formData.headerText.match(/{{(\d+)}}/g);
          if (matches) headerComp.example = { header_text: [ "Example Header" ] };
        } else {
          headerComp.example = { header_url: [ formData.headerSampleUrl || "https://images.unsplash.com/photo-1575936123452-b67c3203c357?fm=jpg&q=60&w=3000&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8aW1hZ2V8ZW58MHx8MHx8fDA%3D" ] };
        }
        components.push(headerComp);
      }
      const bodyComp = { type: "BODY", text: formData.body };
      const bodyMatches = formData.body.match(/\{\{\d+\}\}/g);
      if (bodyMatches) bodyComp.example = { body_text: [ bodyMatches.map((_, i) => `Sample ${i + 1}`) ] };
      components.push(bodyComp);
      if (formData.footerText) components.push({ type: "FOOTER", text: formData.footerText });
      if (buttons.length > 0) {
        components.push({
          type: "BUTTONS",
          buttons: buttons.map(btn => {
            const b = { type: btn.type, text: btn.text };
            if (btn.type === "URL") b.url = btn.url;
            if (btn.type === "PHONE_NUMBER") b.phone_number = btn.phone_number;
            return b;
          })
        });
      }

      await api.post("/templates", {
        name: formData.name,
        category: formData.category,
        language: formData.language,
        components
      });
      alert("✅ Template submitted for approval!");
      setShowForm(false);
      fetchTemplates();
    } catch (err) {
      alert("❌ Submission failed: " + (err.response?.data?.error || err.message));
    }
  };

  const handleSavePreset = async () => {
    if (!presetName) return alert("Please enter a preset name.");
    try {
      if (editingPresetId) {
        await api.put(`/presets/${editingPresetId}`, {
          name: presetName,
          config: templateVars
        });
        alert("✅ Preset updated successfully!");
      } else {
        await api.post("/presets", {
          name: presetName,
          template: selectedTemplateForPreset._id,
          config: templateVars
        });
        alert("✅ Preset saved successfully!");
      }
      setShowPresetModal(false);
      setEditingPresetId(null);
      fetchPresets();
    } catch (err) {
      alert("❌ Failed to save preset: " + (err.response?.data?.error || err.message));
    }
  };

  const handleEditPreset = (p) => {
    setSelectedTemplateForPreset(p.template);
    setPresetName(p.name);
    setTemplateVars(p.config || {});
    setEditingPresetId(p._id);
    setShowPresetModal(true);
  };

  const handleDeletePreset = async (id) => {
    if (!window.confirm("Are you sure you want to delete this preset?")) return;
    try {
      await api.delete(`/presets/${id}`);
      fetchPresets();
    } catch (err) {
      alert("Error deleting preset: " + (err.response?.data?.error || err.message));
    }
  };

  const handleFileUpload = async (e, targetKey, isFormData = false) => {
    const file = e.target.files[0];
    if (!file) return;
    const localUrl = URL.createObjectURL(file);
    setLocalPreviews(prev => ({ ...prev, [targetKey]: localUrl }));
    const uploadData = new FormData();
    uploadData.append("file", file);
    try {
      setLoading(true);
      const res = await api.post("/upload", uploadData, { headers: { "Content-Type": "multipart/form-data" } });
      if (isFormData) setFormData({ ...formData, [targetKey]: res.data.url });
      else setTemplateVars(prev => ({ ...prev, [targetKey]: res.data.url }));
    } catch (err) {
      alert("❌ Upload failed: " + (err.response?.data?.error || err.message));
      const newPreviews = { ...localPreviews };
      delete newPreviews[targetKey];
      setLocalPreviews(newPreviews);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "APPROVED": return <CheckCircle size={16} color="#25d366" />;
      case "PENDING": return <Clock size={16} color="#f1c40f" />;
      case "REJECTED": return <XCircle size={16} color="#e74c3c" />;
      default: return <RefreshCw size={16} color="#94a3b8" className="animate-spin" />;
    }
  };

  const formatPreviewText = (text, type, vars) => {
    if (!text) return "";
    let formatted = text;
    const matches = text.match(/{{(\d+)}}/g);
    if (matches) {
      matches.forEach(m => {
        const num = m.replace(/{{|}}/g, "");
        const val = vars[`${type}_${num}`];
        formatted = formatted.replace(m, val || m);
      });
    }
    return formatted;
  };

  const filteredTemplates = templates.filter(t => filter === "ALL" || t.status === filter);

  return (
    <div className="template-manager">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h3 style={{ fontSize: "1.5rem", fontWeight: "700" }}>WhatsApp Templates</h3>
          {activeAccount && <p style={{ color: "#00a884", fontSize: "0.85rem", fontWeight: "bold" }}>Managing: {activeAccount.name} ({activeAccount.phoneNumberId})</p>}
        </div>
        <div style={{ display: "flex", gap: "1rem" }}>
          <button className="btn-primary" onClick={handleSync} style={{ background: "transparent", border: "1px solid var(--accent-primary)", color: "var(--accent-primary)" }}>
            <RefreshCw size={18} /> Sync with Meta
          </button>
          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : <><Plus size={18} /> New Template</>}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "2rem", overflowX: "auto" }}>
        {["ALL", "APPROVED", "PENDING", "REJECTED", "PRESETS"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "8px 16px", borderRadius: "20px", border: "1px solid var(--glass-border)", background: filter === f ? "var(--accent-primary)" : "var(--bg-secondary)", color: filter === f ? "var(--bg-primary)" : "var(--text-primary)", fontSize: "0.8rem", fontWeight: "600", cursor: "pointer" }}>
            {f === "PRESETS" ? `My Presets (${presets.length})` : `${f} (${templates.filter(t => f === "ALL" || t.status === f).length})`}
          </button>
        ))}
      </div>

      {showForm && (
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "2rem", marginBottom: "2rem" }}>
          {/* Left: Inputs */}
          <form className="glass-card" style={{ border: "1px solid var(--accent-primary)" }} onSubmit={handleSubmit}>
            <h4 style={{ marginBottom: "1.5rem", color: "var(--accent-primary)" }}>Create New Template</h4>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
              <div>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>Template Name</label>
                <input type="text" style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd" }} value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")})} placeholder="e.g. welcome_message" required />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>Category</label>
                <select style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd" }} value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}>
                  <option value="MARKETING">Marketing</option>
                  <option value="UTILITY">Utility</option>
                  <option value="AUTHENTICATION">Authentication</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
              <div>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>Header Type</label>
                <select style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd" }} value={formData.headerType} onChange={(e) => setFormData({...formData, headerType: e.target.value})}>
                  <option value="NONE">None</option>
                  <option value="TEXT">Text</option>
                  <option value="IMAGE">Image</option>
                  <option value="VIDEO">Video</option>
                  <option value="DOCUMENT">Document</option>
                </select>
              </div>
              {formData.headerType === "TEXT" && (
                <div>
                  <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>Header Text</label>
                  <input type="text" style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd" }} value={formData.headerText} onChange={(e) => setFormData({...formData, headerText: e.target.value})} placeholder="e.g. Welcome to our store" />
                </div>
              )}
              {["IMAGE", "VIDEO", "DOCUMENT"].includes(formData.headerType) && (
                <div>
                  <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>Sample {formData.headerType}</label>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <input type="text" style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "1px solid #ddd" }} value={formData.headerSampleUrl} readOnly placeholder="Upload sample file..." />
                    <label className="btn-primary" style={{ padding: "10px 20px", cursor: "pointer", fontSize: "0.8rem", display: "flex", alignItems: "center" }}>
                      Upload
                      <input type="file" hidden onChange={(e) => handleFileUpload(e, "headerSampleUrl", true)} />
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>Body Content (Use {"{{1}}"}, {"{{2}}"} for variables)</label>
              <textarea rows="4" style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd" }} value={formData.body} onChange={(e) => setFormData({...formData, body: e.target.value})} placeholder="Hello {{1}}, thanks for your order!" required />
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>Footer Text (Optional)</label>
              <input type="text" style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd" }} value={formData.footerText} onChange={(e) => setFormData({...formData, footerText: e.target.value})} placeholder="e.g. Reply STOP to opt out" />
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <label style={{ fontWeight: "600" }}>Buttons (Optional, Max 10)</label>
                {buttons.length < 10 && (
                  <button type="button" onClick={handleAddButton} className="btn-primary" style={{ padding: "5px 15px", fontSize: "0.8rem" }}>
                    <Plus size={14} /> Add Button
                  </button>
                )}
              </div>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxHeight: "300px", overflowY: "auto", paddingRight: "10px" }}>
                {buttons.map((btn, idx) => (
                  <div key={idx} className="glass-card" style={{ padding: "1rem", background: "#f8f9fa", border: "1px dashed #ccc" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 40px", gap: "10px", alignItems: "end" }}>
                      <div>
                        <label style={{ fontSize: "0.75rem", fontWeight: "700" }}>Type</label>
                        <select style={{ width: "100%", padding: "8px", borderRadius: "6px" }} value={btn.type} onChange={(e) => handleButtonChange(idx, "type", e.target.value)}>
                          <option value="QUICK_REPLY">Quick Reply</option>
                          <option value="URL">Call to Action (URL)</option>
                          <option value="PHONE_NUMBER">Call to Action (Phone)</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: "0.75rem", fontWeight: "700" }}>Button Text</label>
                        <input type="text" style={{ width: "100%", padding: "8px", borderRadius: "6px" }} value={btn.text} onChange={(e) => handleButtonChange(idx, "text", e.target.value)} placeholder="e.g. Visit Website" required />
                      </div>
                      {btn.type === "URL" && (
                        <div>
                          <label style={{ fontSize: "0.75rem", fontWeight: "700" }}>URL</label>
                          <input type="text" style={{ width: "100%", padding: "8px", borderRadius: "6px" }} value={btn.url} onChange={(e) => handleButtonChange(idx, "url", e.target.value)} placeholder="https://..." required />
                        </div>
                      )}
                      {btn.type === "PHONE_NUMBER" && (
                        <div>
                          <label style={{ fontSize: "0.75rem", fontWeight: "700" }}>Phone Number</label>
                          <input type="text" style={{ width: "100%", padding: "8px", borderRadius: "6px" }} value={btn.phone_number} onChange={(e) => handleButtonChange(idx, "phone_number", e.target.value)} placeholder="+91..." required />
                        </div>
                      )}
                      <button type="button" onClick={() => handleRemoveButton(idx)} style={{ color: "#ef4444", background: "none", border: "none", cursor: "pointer", paddingBottom: "10px" }}>
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ width: "100%", padding: "14px", marginTop: "1rem" }}>
              Submit for Approval from {activeAccount?.name}
            </button>
          </form>

          {/* Right: Live Preview */}
          <div style={{ position: "sticky", top: "20px", height: "fit-content" }}>
            <div style={{ background: "#e5ddd5", borderRadius: "20px", padding: "20px", display: "flex", flexDirection: "column", border: "1px solid #ddd", boxShadow: "0 10px 25px rgba(0,0,0,0.1)" }}>
              <div style={{ textAlign: "center", color: "#667781", fontSize: "0.7rem", marginBottom: "15px", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "700" }}>Live Preview</div>
              
              <div className="wa-bubble" style={{ background: "white", padding: "10px", borderRadius: "0 15px 15px 15px", boxShadow: "0 1px 0.5px rgba(0,0,0,0.13)", maxWidth: "100%", position: "relative" }}>
                {/* Header Preview */}
                {formData.headerType !== "NONE" && (
                  <div style={{ marginBottom: "8px" }}>
                    {formData.headerType === "TEXT" ? (
                      <div style={{ fontWeight: "700", fontSize: "0.95rem", color: "#111b21" }}>{formData.headerText || "Header Text Placeholder"}</div>
                    ) : (
                      <div style={{ width: "100%", aspectRatio: "16/9", background: "#f0f2f5", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                        {formData.headerSampleUrl ? (
                          <img src={formData.headerSampleUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <span style={{ color: "#94a3b8", fontSize: "0.8rem" }}>{formData.headerType} Preview</span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Body Preview */}
                <div style={{ fontSize: "0.9rem", color: "#111b21", whiteSpace: "pre-wrap", lineHeight: "1.4" }}>
                  {formData.body || "Your message body content will appear here..."}
                </div>

                {/* Footer Preview */}
                {formData.footerText && (
                  <div style={{ fontSize: "0.75rem", color: "#667781", marginTop: "5px" }}>
                    {formData.footerText}
                  </div>
                )}

                {/* Buttons Preview */}
                {buttons.length > 0 && (
                  <div style={{ marginTop: "12px", borderTop: "1px solid #f0f2f5" }}>
                    {buttons.map((btn, i) => (
                      <div key={i} style={{ padding: "10px", textAlign: "center", color: "#00a884", fontSize: "0.9rem", fontWeight: "600", borderBottom: i < buttons.length - 1 ? "1px solid #f0f2f5" : "none" }}>
                        {btn.text || "Button Text"}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div className="glass-card" style={{ marginTop: "1rem", padding: "1rem", fontSize: "0.8rem", color: "#64748b", background: "white" }}>
              <h5 style={{ marginBottom: "8px", color: "var(--accent-primary)" }}>Preview Tips:</h5>
              <ul style={{ paddingLeft: "1.2rem" }}>
                <li>Variables like {"{{1}}"} will be replaced with real data when sending.</li>
                <li>Media headers require a sample file for Meta approval.</li>
                <li>Buttons are interactive and will appear at the bottom.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "4rem" }}><RefreshCw className="animate-spin" size={40} color="var(--accent-primary)" /></div>
      ) : filter === "PRESETS" ? (
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 450px), 1fr))", 
          gap: "1.5rem" 
        }}>
          {presets.map(p => {
            const bodyComp = p.template?.components?.find(c => c.type === "BODY");
            const headerComp = p.template?.components?.find(c => c.type === "HEADER");
            const imageUrl = p.config?.HEADER_IMAGE || p.config?.HEADER_VIDEO || p.config?.HEADER_DOCUMENT;
            
            return (
              <div key={p._id} className="glass-card" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h4 style={{ margin: 0, color: "var(--accent-primary)" }}>{p.name}</h4>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button onClick={() => handleEditPreset(p)} style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b" }} title="Edit Preset"><RefreshCw size={16} /></button>
                    <button onClick={() => handleDeletePreset(p._id)} style={{ border: "none", background: "none", cursor: "pointer" }}><Trash2 size={16} color="#ef4444" /></button>
                  </div>
                </div>
                
                {imageUrl && (
                  <div style={{ width: "100%", height: "200px", borderRadius: "10px", overflow: "hidden", background: "#f1f5f9" }}>
                    <img src={imageUrl} style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }} alt="Preset" />
                  </div>
                )}
                
                <div style={{ 
                  background: "#f8fafc", 
                  padding: "12px", 
                  borderRadius: "8px", 
                  fontSize: "0.95rem", 
                  color: "#334155",
                  maxHeight: "300px",
                  overflowY: "auto",
                  borderLeft: "4px solid var(--accent-primary)",
                  lineHeight: "1.5"
                }}>
                  {bodyComp ? formatPreviewText(bodyComp.text, "BODY", p.config || {}) : "No body text"}
                </div>
                
                <p style={{ fontSize: "0.7rem", color: "#94a3b8", margin: 0 }}>Template: {p.template?.name}</p>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: "grid", gap: "1.2rem" }}>
          {filteredTemplates.map((tpl) => (
            <div key={tpl._id} className="glass-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h4 style={{ margin: 0 }}>{tpl.name}</h4>
                  <span style={{ fontSize: "0.75rem", color: "#667781" }}>{tpl.category} • {tpl.language}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>{getStatusIcon(tpl.status)} <strong>{tpl.status}</strong></div>
                  
                  {/* Preset Button Wapas Add Kiya */}
                  {tpl.status === "APPROVED" && (
                    <button 
                      onClick={() => {
                        setSelectedTemplateForPreset(tpl);
                        setPresetName(tpl.name + "_preset");
                        const vars = {};
                        tpl.components.forEach(comp => {
                          if (comp.type === "HEADER" && ["IMAGE", "VIDEO", "DOCUMENT"].includes(comp.format)) {
                            vars[`HEADER_${comp.format}`] = "";
                          }
                          const matches = comp.text?.match(/{{(\d+)}}/g);
                          if (matches) matches.forEach(m => vars[`${comp.type}_${m.replace(/{{|}}/g, "")}`] = "");
                        });
                        setTemplateVars(vars);
                        setShowPresetModal(true);
                      }}
                      className="btn-icon" 
                      title="Make Preset"
                    >
                      <Plus size={18} />
                    </button>
                  )}

                  <button onClick={() => handleDelete(tpl._id, tpl.name)} style={{ border: "none", background: "none", cursor: "pointer" }}><Trash2 size={18} color="#ef4444" /></button>
                </div>
              </div>
            </div>
          ))}
          {filteredTemplates.length === 0 && <div style={{ textAlign: "center", padding: "3rem", color: "#667781" }}>No templates found for this account. Click "Sync" to fetch from Meta.</div>}
        </div>
      )}
      {showPresetModal && selectedTemplateForPreset && (
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(10px)" }}>
          <div className="glass-card" style={{ width: "95%", maxWidth: "1150px", display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "1.5rem", padding: "3.5rem 1.5rem 1.5rem 1.5rem", height: "85vh", overflow: "hidden", position: "relative", border: "2px solid #00a884" }}>
            
            {/* Close Button */}
            <button 
              onClick={() => setShowPresetModal(false)} 
              style={{ position: "absolute", top: "15px", right: "15px", border: "2px solid #00a884", background: "white", borderRadius: "50%", padding: "5px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, color: "#00a884", boxShadow: "0 4px 15px rgba(0,0,0,0.2)" }}
            >
              <XCircle size={35} weight="bold" />
            </button>

            {/* Left Side: Inputs */}
            <div style={{ height: "calc(85vh - 100px)", overflowY: "scroll", paddingRight: "1rem", borderRight: "2px solid #e2e8f0" }}>
              <h3 style={{ marginBottom: "1.5rem" }}>Save Template Preset</h3>
              
              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ fontWeight: "600" }}>Preset Name</label>
                <input type="text" style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginTop: "8px" }} placeholder="e.g. Order_Confirmed_Offer" value={presetName} onChange={e => setPresetName(e.target.value)} />
              </div>

              <h4 style={{ fontSize: "0.9rem", color: "#667781", marginBottom: "1rem", textTransform: "uppercase", letterSpacing: "1px" }}>Variables & Media</h4>

              {selectedTemplateForPreset.components.map((comp, idx) => {
                if (comp.type === "HEADER" && ["IMAGE", "VIDEO", "DOCUMENT"].includes(comp.format)) {
                  const key = `HEADER_${comp.format}`;
                  return (
                    <div key={idx} style={{ marginBottom: "1.5rem" }}>
                      <label style={{ color: "#00a884", fontWeight: "700", fontSize: "0.75rem" }}>{comp.format} URL</label>
                      <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                        <input type="text" style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #ddd" }} value={templateVars[key] || ""} onChange={e => setTemplateVars({ ...templateVars, [key]: e.target.value })} placeholder="https://..." />
                        <label className="btn-primary" style={{ padding: "10px 20px", cursor: "pointer", fontSize: "0.8rem" }}>
                          Upload
                          <input type="file" hidden onChange={(e) => handleFileUpload(e, key)} />
                        </label>
                      </div>
                    </div>
                  );
                }

                const matches = comp.text?.match(/{{(\d+)}}/g);
                if (!matches) return null;

                return (
                  <div key={idx}>
                    {matches.map(m => {
                      const num = m.replace(/{{|}}/g, "");
                      const key = `${comp.type}_${num}`;
                      return (
                        <div key={key} style={{ marginBottom: "1rem" }}>
                          <label style={{ color: "#00a884", fontWeight: "700", fontSize: "0.75rem" }}>{comp.type} Var {num}</label>
                          <input 
                            type="text" 
                            style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginTop: "8px" }} 
                            value={templateVars[key] || ""} 
                            onChange={e => setTemplateVars({ ...templateVars, [key]: e.target.value })}
                            placeholder="Value (Single line only)"
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              <div style={{ display: "flex", gap: "1rem", marginTop: "2rem" }}>
                <button onClick={() => setShowPresetModal(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button onClick={handleSavePreset} className="btn-primary" style={{ flex: 2 }}>Save Preset</button>
              </div>
            </div>

            {/* Right Side: Preview */}
            <div style={{ background: "#e5ddd5", borderRadius: "20px", padding: "20px", display: "flex", flexDirection: "column", height: "calc(85vh - 100px)", border: "1px solid #ddd", overflowY: "scroll" }}>
              <div style={{ textAlign: "center", color: "#667781", fontSize: "0.7rem", marginBottom: "10px", textTransform: "uppercase" }}>Preview</div>
              <div className="wa-bubble" style={{ background: "white", padding: "10px", borderRadius: "0 15px 15px 15px", boxShadow: "0 1px 0.5px rgba(0,0,0,0.13)", maxWidth: "100%" }}>
                
                {/* Header Preview */}
                {(() => {
                  const headerComp = selectedTemplateForPreset.components.find(c => c.type === "HEADER");
                  if (headerComp && ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerComp.format)) {
                    const key = `HEADER_${headerComp.format}`;
                    const mediaUrl = localPreviews[key] || templateVars[key];
                    return (
                      <div style={{ width: "100%", aspectRatio: "16/9", background: "#f0f2f5", borderRadius: "10px", marginBottom: "10px", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                        {mediaUrl ? (
                          <img src={mediaUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <span style={{ color: "#94a3b8", fontSize: "0.8rem" }}>{headerComp.format} Preview</span>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Body Preview */}
                <div style={{ fontSize: "0.9rem", color: "#111b21", whiteSpace: "pre-wrap", lineHeight: "1.5" }}>
                  {selectedTemplateForPreset.components.filter(c => c.type === "BODY").map(c => formatPreviewText(c.text, "BODY", templateVars))}
                </div>

                {/* Footer Preview */}
                <div style={{ fontSize: "0.75rem", color: "#667781", marginTop: "5px" }}>
                  {selectedTemplateForPreset.components.find(c => c.type === "FOOTER")?.text}
                </div>

                {/* Buttons Preview */}
                <div style={{ marginTop: "10px", borderTop: "1px solid #f0f2f5" }}>
                  {selectedTemplateForPreset.components.find(c => c.type === "BUTTONS")?.buttons.map((btn, i) => (
                    <div key={i} style={{ padding: "8px", textAlign: "center", color: "#00a884", fontSize: "0.85rem", fontWeight: "600", borderBottom: i < selectedTemplateForPreset.components.find(c => c.type === "BUTTONS").buttons.length - 1 ? "1px solid #f0f2f5" : "none" }}>
                      {btn.text}
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateManager;
