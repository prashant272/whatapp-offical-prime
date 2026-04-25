import React, { useState, useEffect } from "react";
import axios from "axios";
import { Plus, CheckCircle, Clock, XCircle, RefreshCw, Filter, Info, AlertTriangle, Trash2 } from "lucide-react";

import { API_BASE } from "../api";

const TemplateManager = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [presets, setPresets] = useState([]);
  const [selectedTemplateForPreset, setSelectedTemplateForPreset] = useState(null);
  const [presetName, setPresetName] = useState("");
  const [templateVars, setTemplateVars] = useState({});
  const [filter, setFilter] = useState("ALL");
  const currentUser = JSON.parse(localStorage.getItem("userInfo"));
  const config = { headers: { Authorization: `Bearer ${currentUser?.token}` } };

  const [formData, setFormData] = useState({
    name: "",
    category: "UTILITY",
    language: "en_US",
    body: "",
    headerType: "NONE", // NONE, TEXT, IMAGE, VIDEO, DOCUMENT
    headerText: "",
    footerText: ""
  });
  const [buttons, setButtons] = useState([]);

  const addButton = (type) => {
    if (buttons.length >= 3) return alert("Maximum 3 buttons allowed.");
    if (type === "QUICK_REPLY") {
      setButtons([...buttons, { type: "QUICK_REPLY", text: "" }]);
    } else if (type === "URL") {
      setButtons([...buttons, { type: "URL", text: "", url: "" }]);
    } else if (type === "PHONE_NUMBER") {
      setButtons([...buttons, { type: "PHONE_NUMBER", text: "", phone_number: "" }]);
    }
  };

  const removeButton = (index) => {
    setButtons(buttons.filter((_, i) => i !== index));
  };

  const updateButton = (index, field, value) => {
    const newButtons = [...buttons];
    newButtons[index][field] = value;
    setButtons(newButtons);
  };

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/templates`, config);
      setTemplates(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching templates:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/templates/sync`, {}, config);
      setTemplates(Array.isArray(res.data) ? res.data : []);
      alert("✅ Templates synced with Meta successfully!");
    } catch (err) {
      alert("❌ Sync failed: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (name) => {
    if (!window.confirm(`Are you sure you want to delete template "${name}"? This will remove it from both Meta and your dashboard.`)) return;
    
    setLoading(true);
    try {
      await axios.delete(`${API_BASE}/templates/${name}`, config);
      alert("✅ Template deleted successfully!");
      fetchTemplates();
    } catch (err) {
      alert("❌ Delete failed: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const fetchPresets = async () => {
    try {
      const res = await axios.get(`${API_BASE}/presets`, config);
      setPresets(res.data);
    } catch (err) {
      console.error("Error fetching presets:", err);
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchPresets();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const components = [];

      // 1. Header
      if (formData.headerType !== "NONE") {
        const headerComp = { type: "HEADER", format: formData.headerType };
        if (formData.headerType === "TEXT") {
          headerComp.text = formData.headerText;
          const matches = formData.headerText.match(/{{(\d+)}}/g);
          if (matches) {
            headerComp.example = { header_text: [ "Example Header" ] };
          }
        } else {
          // Media headers (IMAGE, VIDEO, DOCUMENT) need an example handle/file
          // For simplicity, we just set the format, Meta often needs an example file but sometimes accepts without
          headerComp.example = { header_handle: [ "https://example.com/file.jpg" ] };
        }
        components.push(headerComp);
      }

      // 2. Body
      const bodyComp = { type: "BODY", text: formData.body };
      const bodyMatches = formData.body.match(/\{\{\d+\}\}/g);
      if (bodyMatches) {
        bodyComp.example = { body_text: [ bodyMatches.map((_, i) => `Sample ${i + 1}`) ] };
      }
      components.push(bodyComp);

      // 3. Footer
      if (formData.footerText) {
        components.push({ type: "FOOTER", text: formData.footerText });
      }

      // 4. Buttons
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

      const templateData = {
        name: formData.name,
        category: formData.category,
        language: formData.language,
        components
      };

      await axios.post(`${API_BASE}/templates`, templateData, config);
      alert("✅ Template submitted for approval!");
      setShowForm(false);
      fetchTemplates();
    } catch (err) {
      alert("❌ Submission failed: " + (err.response?.data?.error || err.message));
    }
  };

  const handleOpenPresetModal = (tpl, existingPreset = null) => {
    setSelectedTemplateForPreset(tpl);
    if (existingPreset) {
      setPresetName(existingPreset.name);
      setTemplateVars(existingPreset.config || {});
      // Set _id for edit mode
      setSelectedTemplateForPreset({ ...tpl, _id_preset: existingPreset._id });
    } else {
      setPresetName("");
      const vars = {};
      tpl.components.forEach(comp => {
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
    }
    setShowPresetModal(true);
  };

  const handleSavePreset = async () => {
    if (!presetName) return alert("Please enter a preset name.");
    try {
      const isEdit = !!selectedTemplateForPreset._id_preset;
      if (isEdit) {
        await axios.put(`${API_BASE}/presets/${selectedTemplateForPreset._id_preset}`, {
          name: presetName,
          config: templateVars
        }, config);
        alert("✅ Preset updated successfully!");
      } else {
        await axios.post(`${API_BASE}/presets`, {
          name: presetName,
          template: selectedTemplateForPreset._id,
          config: templateVars
        }, config);
        alert("✅ Preset saved successfully!");
      }
      setShowPresetModal(false);
      setPresetName("");
      fetchPresets();
    } catch (err) {
      alert("❌ Failed to save preset: " + (err.response?.data?.error || err.message));
    }
  };

  const handleDeletePreset = async (id) => {
    if (!window.confirm("Are you sure you want to delete this preset?")) return;
    try {
      await axios.delete(`${API_BASE}/presets/${id}`, config);
      fetchPresets();
    } catch (err) {
      alert("Error deleting preset: " + (err.response?.data?.error || err.message));
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

  const [localPreviews, setLocalPreviews] = useState({});

  const handleFileUpload = async (e, targetKey, isFormData = false) => {
    const file = e.target.files[0];
    if (!file) return;

    // Show instant local preview
    const localUrl = URL.createObjectURL(file);
    setLocalPreviews(prev => ({ ...prev, [targetKey]: localUrl }));

    const uploadData = new FormData();
    uploadData.append("file", file);

    try {
      setLoading(true);
      const res = await axios.post(`${API_BASE}/upload`, uploadData, {
        headers: { 
          ...config.headers,
          "Content-Type": "multipart/form-data" 
        }
      });
      
      if (isFormData) {
        setFormData({ ...formData, [targetKey]: res.data.url });
      } else {
        setTemplateVars(prev => ({ ...prev, [targetKey]: res.data.url }));
      }
      // Clean up local preview after success if you want, or just let the new URL override it
    } catch (err) {
      console.error("❌ Upload error:", err);
      alert("❌ Upload failed: " + (err.response?.data?.error || err.message));
      // Remove local preview on failure
      const newPreviews = { ...localPreviews };
      delete newPreviews[targetKey];
      setLocalPreviews(newPreviews);
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = templates.filter(t => {
    if (filter === "ALL") return true;
    return t.status === filter;
  });

  return (
    <div className="template-manager">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h3 style={{ fontSize: "1.5rem", fontWeight: "700" }}>WhatsApp Templates</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>Manage and monitor your message templates.</p>
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

      {/* Filter Bar */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "2rem", overflowX: "auto", paddingBottom: "10px" }}>
        {["ALL", "APPROVED", "PENDING", "REJECTED", "PRESETS"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "8px 16px",
              borderRadius: "20px",
              border: "1px solid var(--glass-border)",
              background: filter === f ? "var(--accent-primary)" : "var(--bg-secondary)",
              color: filter === f ? "var(--bg-primary)" : "var(--text-primary)",
              fontSize: "0.8rem",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
          >
            {f === "PRESETS" ? `My Presets (${presets.length})` : `${f} (${templates.filter(t => f === "ALL" || t.status === f).length})`}
          </button>
        ))}
      </div>

      {showForm && (
        <form className="glass-card" style={{ marginBottom: "2rem", animation: "slideDown 0.3s ease-out" }} onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem", color: "var(--text-secondary)" }}>Template Name</label>
              <input 
                type="text" 
                placeholder="e.g. promotional_offer" 
                style={{ width: "100%", padding: "12px", background: "var(--bg-tertiary)", border: "1px solid var(--glass-border)", color: "var(--text-primary)", borderRadius: "10px" }}
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")})}
                required
              />
              <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: "5px", display: "block" }}>Lowercase letters, numbers, and underscores only.</span>
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem", color: "var(--text-secondary)" }}>Category</label>
              <select 
                style={{ width: "100%", padding: "12px", background: "var(--bg-tertiary)", border: "1px solid var(--glass-border)", color: "var(--text-primary)", borderRadius: "10px" }}
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
              >
                <option value="MARKETING">Marketing</option>
                <option value="UTILITY">Utility</option>
                <option value="AUTHENTICATION">Authentication</option>
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem", color: "var(--text-secondary)" }}>Header Type</label>
              <select 
                style={{ width: "100%", padding: "12px", background: "var(--bg-tertiary)", border: "1px solid var(--glass-border)", color: "var(--text-primary)", borderRadius: "10px" }}
                value={formData.headerType}
                onChange={(e) => setFormData({...formData, headerType: e.target.value})}
              >
                <option value="NONE">None</option>
                <option value="TEXT">Text</option>
                <option value="IMAGE">Image</option>
                <option value="VIDEO">Video</option>
                <option value="DOCUMENT">Document</option>
              </select>
            </div>
            {formData.headerType === "TEXT" && (
              <div>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem", color: "var(--text-secondary)" }}>Header Text</label>
                <input 
                  type="text" 
                  style={{ width: "100%", padding: "12px", background: "var(--bg-tertiary)", border: "1px solid var(--glass-border)", color: "var(--text-primary)", borderRadius: "10px" }}
                  value={formData.headerText}
                  onChange={(e) => setFormData({...formData, headerText: e.target.value})}
                />
              </div>
            )}
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem", color: "var(--text-secondary)" }}>Message Body</label>
            <textarea 
              rows="4" 
              style={{ width: "100%", padding: "12px", background: "var(--bg-tertiary)", border: "1px solid var(--glass-border)", color: "var(--text-primary)", borderRadius: "10px", fontFamily: "inherit" }}
              placeholder="Hi {{1}}, here is your code {{2}}."
              value={formData.body}
              onChange={(e) => setFormData({...formData, body: e.target.value})}
              required
            ></textarea>
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem", color: "var(--text-secondary)" }}>Footer Text (Optional)</label>
            <input 
              type="text" 
              style={{ width: "100%", padding: "12px", background: "var(--bg-tertiary)", border: "1px solid var(--glass-border)", color: "var(--text-primary)", borderRadius: "10px" }}
              value={formData.footerText}
              onChange={(e) => setFormData({...formData, footerText: e.target.value})}
            />
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <label style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>Buttons (Max 3)</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <button type="button" onClick={() => addButton("QUICK_REPLY")} style={{ fontSize: "0.7rem", padding: "4px 8px", background: "rgba(0,0,0,0.05)", border: "1px solid var(--glass-border)", color: "var(--text-primary)", borderRadius: "5px" }}>+ Quick Reply</button>
                <button type="button" onClick={() => addButton("URL")} style={{ fontSize: "0.7rem", padding: "4px 8px", background: "rgba(0,0,0,0.05)", border: "1px solid var(--glass-border)", color: "var(--text-primary)", borderRadius: "5px" }}>+ Website Link</button>
              </div>
            </div>
            
            {buttons.map((btn, idx) => (
              <div key={idx} style={{ display: "flex", gap: "10px", background: "rgba(0,0,0,0.2)", padding: "10px", borderRadius: "8px", marginBottom: "10px", alignItems: "center" }}>
                <span style={{ fontSize: "0.7rem", color: "var(--accent-primary)", fontWeight: "bold", width: "80px" }}>{btn.type.replace("_", " ")}</span>
                <input 
                  type="text" 
                  placeholder="Button Label"
                  style={{ flex: 1, padding: "8px", background: "var(--bg-tertiary)", border: "1px solid var(--glass-border)", color: "var(--text-primary)", borderRadius: "6px", fontSize: "0.85rem" }}
                  value={btn.text}
                  onChange={(e) => updateButton(idx, "text", e.target.value)}
                />
                {btn.type === "URL" && (
                  <input 
                    type="text" 
                    placeholder="https://example.com"
                    style={{ flex: 1.5, padding: "8px", background: "var(--bg-tertiary)", border: "1px solid var(--glass-border)", color: "var(--text-primary)", borderRadius: "6px", fontSize: "0.85rem" }}
                    value={btn.url}
                    onChange={(e) => updateButton(idx, "url", e.target.value)}
                  />
                )}
                <button type="button" onClick={() => removeButton(idx)} style={{ background: "transparent", border: "none", color: "#e74c3c" }}><Trash2 size={16} /></button>
              </div>
            ))}
          </div>

          <button type="submit" className="btn-primary" style={{ width: "100%", padding: "14px" }}>
            Submit to Meta for Approval
          </button>
        </form>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "4rem" }}>
          <RefreshCw className="animate-spin" size={40} color="var(--accent-primary)" style={{ opacity: 0.5 }} />
          <p style={{ marginTop: "1rem", color: "var(--text-secondary)" }}>Syncing with Meta Cloud...</p>
        </div>
      ) : filter === "PRESETS" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "1.5rem" }}>
          {presets.map(p => (
            <div key={p._id} className="glass-card" style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h4 style={{ color: "var(--accent-primary)", margin: 0 }}>{p.name}</h4>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button 
                    onClick={() => handleOpenPresetModal(p.template, p)} 
                    style={{ background: "transparent", border: "none", color: "var(--accent-primary)", cursor: "pointer", fontSize: "0.75rem", fontWeight: "bold" }}
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => handleDeletePreset(p._id)} 
                    style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer" }}
                    onMouseOver={e => e.currentTarget.style.color = "#ef4444"}
                    onMouseOut={e => e.currentTarget.style.color = "#64748b"}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                Base Template: <span style={{ color: "var(--text-primary)" }}>{p.template?.name}</span>
              </div>

              {/* Minimal Preview */}
              <div style={{ 
                background: "#e5ddd5", 
                borderRadius: "10px", 
                padding: "10px",
                fontSize: "0.85rem",
                color: "#303030",
                boxShadow: "inset 0 2px 4px rgba(0,0,0,0.1)",
                minHeight: "150px"
              }}>
                {p.template?.components?.map((comp, idx) => {
                  if (comp.type === "HEADER") {
                    if (comp.format === "IMAGE") {
                      const imgUrl = p.config?.[`HEADER_IMAGE`];
                      return (
                        <div key={idx} style={{ background: "#ddd", height: "100px", borderRadius: "5px", marginBottom: "8px", overflow: "hidden" }}>
                          {imgUrl ? (
                            <img src={imgUrl} alt="Header" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", color: "#888" }}>[IMAGE MISSING]</div>
                          )}
                        </div>
                      );
                    }
                    return <div key={idx} style={{ fontWeight: "bold", fontSize: "0.9rem", marginBottom: "5px" }}>{formatPreviewText(comp.text, "HEADER", p.config)}</div>;
                  }
                  if (comp.type === "BODY") return <div key={idx} style={{ whiteSpace: "pre-wrap" }}>{formatPreviewText(comp.text, "BODY", p.config)}</div>;
                  return null;
                })}
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                {Object.entries(p.config || {}).map(([k, v]) => (
                  <span key={k} style={{ fontSize: "0.65rem", background: "rgba(255,255,255,0.05)", padding: "2px 6px", borderRadius: "4px", color: "var(--text-secondary)" }}>
                    {k}: {v?.length > 15 ? v.substring(0, 15) + "..." : v}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {presets.length === 0 && (
            <div style={{ textAlign: "center", gridColumn: "1/-1", padding: "4rem", opacity: 0.5 }}>
              <Info size={40} style={{ marginBottom: "1rem" }} />
              <p>No presets saved. Create one from an Approved template!</p>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gap: "1.2rem" }}>
          {filteredTemplates.map((tpl) => (
            <div key={tpl._id} className="glass-card" style={{ transition: "transform 0.2s" }}>
              {/* ... (rest of the code remains same) ... */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "5px" }}>
                    <h4 style={{ fontSize: "1.1rem", fontWeight: "700" }}>{tpl.name}</h4>
                    <span style={{ fontSize: "0.7rem", background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: "10px", color: "var(--text-secondary)" }}>{tpl.category}</span>
                  </div>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Language: {tpl.language}</p>
                  {tpl.status === "APPROVED" && (
                    <button 
                      onClick={() => handleOpenPresetModal(tpl)}
                      style={{ marginTop: "10px", fontSize: "0.7rem", padding: "5px 12px", background: "rgba(37, 211, 102, 0.1)", border: "1px solid var(--accent-primary)", color: "var(--accent-primary)", borderRadius: "5px", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}
                    >
                      <Plus size={12} /> Create Preset
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(255,255,255,0.03)", padding: "6px 14px", borderRadius: "20px", border: "1px solid var(--glass-border)" }}>
                    {getStatusIcon(tpl.status)}
                    <span style={{ fontSize: "0.75rem", fontWeight: "800", letterSpacing: "0.5px" }}>{tpl.status}</span>
                  </div>
                  <button 
                    onClick={() => handleDelete(tpl.name)} 
                    style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", padding: "5px", transition: "color 0.2s" }}
                    onMouseOver={(e) => e.currentTarget.style.color = "#ef4444"}
                    onMouseOut={(e) => e.currentTarget.style.color = "#64748b"}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {tpl.status === "REJECTED" && tpl.rejectionReason && (
                <div style={{ marginTop: "1.2rem", padding: "12px", background: "rgba(231, 76, 60, 0.1)", borderLeft: "4px solid #e74c3c", borderRadius: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#ff6b6b", fontWeight: "700", fontSize: "0.85rem", marginBottom: "5px" }}>
                    <AlertTriangle size={16} /> REJECTION REASON
                  </div>
                  <p style={{ fontSize: "0.85rem", color: "#ffb8b8" }}>{tpl.rejectionReason}</p>
                </div>
              )}
            </div>
          ))}
          
          {filteredTemplates.length === 0 && (
            <div style={{ textAlign: "center", padding: "4rem", background: "rgba(255,255,255,0.01)", borderRadius: "20px", border: "2px dashed var(--glass-border)" }}>
              <Filter size={40} style={{ opacity: 0.2, marginBottom: "1rem" }} />
              <p style={{ color: "var(--text-secondary)" }}>No {filter.toLowerCase()} templates found.</p>
            </div>
          )}
        </div>
      )}

      {/* Preset Creation Modal */}
      {showPresetModal && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="glass-card" style={{ 
            width: "95%", 
            maxWidth: "1000px", 
            height: "85vh", 
            padding: "1.5rem", 
            display: "flex", 
            gap: "1.5rem", 
            overflow: "hidden",
            position: "relative"
          }}>
            <button 
              onClick={() => setShowPresetModal(false)}
              className="close-modal-btn"
              style={{ 
                position: "absolute", 
                top: "15px", 
                right: "15px", 
                background: "rgba(0,0,0,0.05)", 
                border: "none", 
                color: "var(--text-primary)", 
                cursor: "pointer", 
                zIndex: 10,
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s"
              }}
            >
              <Plus size={20} style={{ transform: "rotate(45deg)" }} />
            </button>
            <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", flex: 1.2 }}>
              <h3 style={{ marginBottom: "1rem", fontSize: "1.2rem", flexShrink: 0 }}>{selectedTemplateForPreset?._id_preset ? "Edit Template Preset" : "Save Template Preset"}</h3>
              
              <div style={{ overflowY: "auto", paddingRight: "10px", flex: 1, marginBottom: "1rem" }}>
                <div style={{ marginBottom: "1rem" }}>
                  <label style={{ display: "block", marginBottom: "5px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>Preset Name</label>
                  <input 
                    type="text" 
                    style={{ width: "100%", padding: "10px", background: "var(--bg-tertiary)", border: "1px solid var(--glass-border)", color: "var(--text-primary)", borderRadius: "8px" }}
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="e.g. Order_Confirmed_Offer"
                  />
                </div>

                <div style={{ marginBottom: "1rem" }}>
                  <p style={{ fontSize: "0.85rem", fontWeight: "700", color: "var(--text-primary)", marginBottom: "0.8rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "5px" }}>Variables & Media</p>
                  {Object.keys(templateVars).map(key => {
                    const isMedia = ["IMAGE", "VIDEO", "DOCUMENT"].some(type => key.includes(type));
                    return (
                      <div key={key} style={{ marginBottom: "12px" }}>
                        <label style={{ fontSize: "0.75rem", color: "var(--accent-primary)", display: "block", marginBottom: "4px", fontWeight: "700" }}>{isMedia ? `${key.split("_")[1]} URL` : `BODY Var ${key.split("_")[1]}`}</label>
                        <div style={{ display: "flex", gap: "8px", flexDirection: isMedia ? "row" : "column" }}>
                          {isMedia ? (
                            <input 
                              type="text" 
                              style={{ flex: 1, padding: "10px", background: "var(--bg-secondary)", border: "1px solid var(--glass-border)", color: "var(--text-primary)", borderRadius: "8px", fontSize: "0.85rem" }}
                              value={templateVars[key]}
                              onChange={(e) => setTemplateVars({...templateVars, [key]: e.target.value})}
                              placeholder="https://..."
                            />
                          ) : (
                            <input 
                              type="text" 
                              style={{ flex: 1, padding: "10px", background: "var(--bg-secondary)", border: "1px solid var(--glass-border)", color: "var(--text-primary)", borderRadius: "8px", fontSize: "0.85rem" }}
                              value={templateVars[key]}
                              onChange={(e) => setTemplateVars({...templateVars, [key]: e.target.value})}
                              placeholder="Value (Single line only)"
                            />
                          )}
                          {isMedia && (
                            <>
                              <input 
                                type="file" 
                                id={`upload-${key}`} 
                                style={{ display: "none" }} 
                                onChange={(e) => handleFileUpload(e, key)}
                                accept="image/*,video/*,application/pdf"
                              />
                              <button 
                                onClick={() => document.getElementById(`upload-${key}`).click()}
                                style={{ padding: "0 15px", background: "var(--accent-primary)", border: "none", color: "white", borderRadius: "8px", fontSize: "0.75rem", cursor: "pointer", fontWeight: "600" }}
                              >
                                Upload
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "auto", paddingTop: "1rem", borderTop: "1px solid var(--border-color)", flexShrink: 0 }}>
                <button className="btn-secondary" style={{ flex: 1, padding: "12px" }} onClick={() => setShowPresetModal(false)}>Cancel</button>
                <button className="btn-primary" style={{ flex: 2, padding: "12px" }} onClick={handleSavePreset}>
                  {selectedTemplateForPreset?._id_preset ? "Update Preset" : "Save Preset"}
                </button>
              </div>
            </div>

            {/* LIVE PREVIEW SIDE */}
            <div style={{ background: "#e5ddd5", borderRadius: "15px", padding: "15px", display: "flex", flexDirection: "column", border: "1px solid rgba(0,0,0,0.1)", overflowY: "auto", flex: 0.8 }}>
              <div style={{ fontSize: "0.75rem", color: "#667781", marginBottom: "10px", textAlign: "center", background: "#d1d7db", padding: "4px 10px", borderRadius: "5px", alignSelf: "center" }}>PREVIEW</div>
              
              <div style={{ background: "white", padding: "10px", borderRadius: "0 10px 10px 10px", maxWidth: "90%", alignSelf: "flex-start", boxShadow: "0 1px 2px rgba(0,0,0,0.2)", position: "relative" }}>
                {selectedTemplateForPreset?.components.map((comp, idx) => {
                  if (comp.type === "HEADER") {
                    if (comp.format === "IMAGE") {
                      const url = localPreviews[`HEADER_IMAGE`] || templateVars[`HEADER_IMAGE`];
                      return (
                        <div key={idx} style={{ background: "#f0f0f0", height: "150px", borderRadius: "5px", marginBottom: "8px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                          {url ? <img src={url} alt="Header" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => e.target.style.display = "none"} /> : <span style={{ color: "#aaa", fontSize: "0.8rem" }}>Image Preview</span>}
                          {loading && <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}><RefreshCw className="animate-spin" size={24} color="white" /></div>}
                        </div>
                      );
                    }
                    return <div key={idx} style={{ fontWeight: "bold", fontSize: "1rem", marginBottom: "5px", color: "#111" }}>{formatPreviewText(comp.text, "HEADER", templateVars)}</div>;
                  }
                  if (comp.type === "BODY") {
                    return <div key={idx} style={{ whiteSpace: "pre-wrap", color: "#303030", lineHeight: "1.4" }}>{formatPreviewText(comp.text, "BODY", templateVars)}</div>;
                  }
                  if (comp.type === "FOOTER") {
                    return <div key={idx} style={{ fontSize: "0.75rem", color: "#667781", marginTop: "5px" }}>{comp.text}</div>;
                  }
                  if (comp.type === "BUTTONS") {
                    return (
                      <div key={idx} style={{ marginTop: "10px", borderTop: "1px solid #f0f0f0", paddingTop: "5px" }}>
                        {comp.buttons.map((btn, bIdx) => (
                          <div key={bIdx} style={{ textAlign: "center", padding: "8px", color: "#00a884", fontWeight: "600", borderBottom: bIdx < comp.buttons.length - 1 ? "1px solid #f0f0f0" : "none" }}>{btn.text}</div>
                        ))}
                      </div>
                    );
                  }
                  return null;
                })}
                <div style={{ fontSize: "0.65rem", color: "#667781", textAlign: "right", marginTop: "4px" }}>10:59 AM</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateManager;
