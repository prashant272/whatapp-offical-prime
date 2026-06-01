import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { API_BASE } from "../../api";
import { X, Search, Send, Image as ImageIcon, MessageSquare, Layout, Sparkles, AlertCircle, Upload, Loader2 } from "lucide-react";

const TemplateModal = ({ isOpen, onClose, templates, presets = [], selectedChat, onSend }) => {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("presets"); // "presets" or "meta"
  const [selectedItem, setSelectedItem] = useState(null);
  const [variables, setVariables] = useState({});
  const [itemImageUrl, setItemImageUrl] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const filteredTemplates = templates.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
  const filteredPresets = presets.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  const handleSelectItem = (item, type) => {
    setSelectedItem({ ...item, _type: type });
    setItemImageUrl("");
    if (type === "template") {
      const body = item.components?.find(c => c.type === "BODY");
      if (body) {
        const matches = body.text.match(/{{(\d+)}}/g) || [];
        const newVars = {};
        matches.forEach(m => {
          const num = m.match(/\d+/)[0];
          newVars[num] = "";
        });
        setVariables(newVars);
      }
    } else {
      setVariables({});
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploadingImage(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post(`${API_BASE}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      if (res.data && res.data.url) {
        setItemImageUrl(res.data.url);
      }
    } catch (err) {
      alert("Upload failed: " + (err.response?.data?.error || err.message));
    } finally {
      setIsUploadingImage(false);
    }
  };

  const getTemplateForPreset = (preset) => {
    if (!preset) return null;
    // If template is already populated as an object
    if (preset.template && typeof preset.template === "object") return preset.template;

    const tName = preset.templateName || preset.template; // fallback
    if (!tName) return null;

    let found = templates.find(t => t.name === tName);
    if (!found) {
      found = templates.find(t => t.name.toLowerCase() === tName.toLowerCase());
    }
    return found;
  };

  const getPresetData = (preset) => {
    const template = getTemplateForPreset(preset);
    const config = preset.config || {};

    // Extract variables (BODY_1, BODY_2...)
    const vars = [];
    Object.keys(config).forEach(key => {
      if (key.startsWith("BODY_")) {
        const idx = parseInt(key.split("_")[1]) - 1;
        vars[idx] = config[key];
      }
    });

    return {
      template,
      variables: vars.filter(v => v !== undefined),
      mediaUrl: config.HEADER_IMAGE || config.mediaUrl || preset.mediaUrl
    };
  };

  const hasImageHeader = (template) => {
    if (!template) return false;
    const header = template.components?.find(c => c.type === "HEADER");
    return header && header.format === "IMAGE";
  };

  const handleSend = () => {
    if (!selectedItem) return;

    if (selectedItem._type === "preset") {
      const { template, variables: presetVars, mediaUrl } = getPresetData(selectedItem);
      if (!template) {
        alert("Base Meta template not found for this preset!");
        return;
      }

      const components = [];
      if (presetVars.length > 0) {
        components.push({
          type: "body",
          parameters: presetVars.map(val => ({ type: "text", text: val }))
        });
      }

      if (mediaUrl) {
        const header = template.components?.find(c => c.type === "HEADER");
        if (header && header.format === "IMAGE") {
          components.unshift({
            type: "header",
            parameters: [{ type: "image", image: { link: mediaUrl } }]
          });
        }
      }
      onSend(template.name, components);
    } else {
      const components = [];
      // Handle Body Variables
      if (Object.keys(variables).length > 0) {
        components.push({
          type: "body",
          parameters: Object.keys(variables).sort((a, b) => a - b).map(key => ({
            type: "text",
            text: variables[key]
          }))
        });
      }
      // Handle Image Header
      if (hasImageHeader(selectedItem) && itemImageUrl) {
        components.unshift({
          type: "header",
          parameters: [{ type: "image", image: { link: itemImageUrl } }]
        });
      }
      onSend(selectedItem.name, components);
    }
    onClose();
  };

  const renderPreview = () => {
    if (!selectedItem) {
      return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#94a3b8", gap: "15px", background: "#f8fafc" }}>
          <div style={{ background: "white", padding: "20px", borderRadius: "50%", boxShadow: "0 10px 25px rgba(0,0,0,0.05)" }}>
            <Sparkles size={40} style={{ color: "#00a884" }} />
          </div>
          <p style={{ fontWeight: "600" }}>Select a template to preview</p>
        </div>
      );
    }

    let bodyText = "";
    let mediaUrl = null;
    let isImageRequired = false;

    if (selectedItem._type === "preset") {
      const { template, variables: presetVars, mediaUrl: pMediaUrl } = getPresetData(selectedItem);
      bodyText = template ? (template.components?.find(c => c.type === "BODY")?.text || "") : "Template content not available";
      if (presetVars) {
        presetVars.forEach((val, idx) => {
          bodyText = bodyText.replace(`{{${idx + 1}}}`, val);
        });
      }
      mediaUrl = pMediaUrl;
    } else {
      bodyText = selectedItem.components?.find(c => c.type === "BODY")?.text || "";
      Object.keys(variables).forEach(key => {
        bodyText = bodyText.replace(`{{${key}}}`, variables[key] || `{{${key}}}`);
      });
      isImageRequired = hasImageHeader(selectedItem);
      mediaUrl = isImageRequired ? itemImageUrl : null;
    }

    return (
      <div style={{ flex: 1, background: "#e5ddd5", padding: "30px", display: "flex", flexDirection: "column", gap: "20px", overflowY: "auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "700", textTransform: "uppercase" }}>Preview Mode</span>
          <div style={{ background: "white", padding: "8px 15px", borderRadius: "10px", width: "fit-content", fontSize: "0.8rem", fontWeight: "700", color: "#00a884", border: "1px solid #d1fae5" }}>
            {selectedItem._type === "preset" ? "Preset" : "Meta Template"}
          </div>
        </div>

        {/* WhatsApp Style Bubble */}
        <div style={{ alignSelf: "flex-start", maxWidth: "85%", minWidth: "250px", position: "relative" }}>
          <div style={{ background: "white", borderRadius: "0 12px 12px 12px", padding: "6px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
            {mediaUrl ? (
              <img src={mediaUrl} alt="Preview" style={{ width: "100%", borderRadius: "8px", marginBottom: "8px", maxHeight: "200px", objectFit: "cover" }} />
            ) : isImageRequired ? (
              <div style={{ width: "100%", height: "120px", background: "#f1f5f9", borderRadius: "8px", marginBottom: "8px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "2px dashed #cbd5e1" }}>
                <ImageIcon size={30} color="#94a3b8" />
                <span style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "5px" }}>Image required</span>
              </div>
            ) : null}
            <div style={{ padding: "8px", fontSize: "0.95rem", color: "#111b21", whiteSpace: "pre-wrap", lineHeight: "1.4" }}>
              {bodyText}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", padding: "2px 4px" }}>
              <span style={{ fontSize: "0.7rem", color: "#667781" }}>10:45 AM</span>
            </div>
          </div>
          <div style={{ position: "absolute", top: 0, left: "-8px", width: "0", height: "0", borderTop: "12px solid white", borderLeft: "12px solid transparent" }}></div>
        </div>

        {/* Controls Section */}
        <div style={{ marginTop: "auto", background: "rgba(255,255,255,0.9)", padding: "20px", borderRadius: "18px", backdropFilter: "blur(10px)", border: "1.5px solid #ffffff", boxShadow: "0 10px 30px rgba(0,0,0,0.1)" }}>
          {selectedItem._type === "template" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              {isImageRequired && (
                <div>
                  <label style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "700", marginBottom: "6px", display: "flex", alignItems: "center", gap: "5px" }}>
                    <ImageIcon size={14} /> Image Header
                  </label>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <input
                      type="text"
                      placeholder="Paste image URL..."
                      value={itemImageUrl}
                      onChange={(e) => setItemImageUrl(e.target.value)}
                      style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "1.5px solid #00a884", outline: "none", fontSize: "0.9rem" }}
                    />
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="image/*"
                      style={{ display: "none" }}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingImage}
                      style={{
                        padding: "10px 15px", background: "#f1f5f9", border: "1.5px solid #e2e8f0",
                        borderRadius: "10px", cursor: "pointer", color: "#475569",
                        display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", fontWeight: "700"
                      }}
                    >
                      {isUploadingImage ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                      {isUploadingImage ? "..." : "Upload"}
                    </button>
                  </div>
                </div>
              )}
              {Object.keys(variables).length > 0 && (
                <div>
                  <h4 style={{ margin: "0 0 10px 0", fontSize: "0.85rem", color: "#1e293b", fontWeight: "800" }}>Variables</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {Object.keys(variables).map(num => (
                      <div key={num}>
                        <label style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: "700", marginBottom: "4px", display: "block" }}>{"{{" + num + "}}"}</label>
                        <input
                          type="text"
                          placeholder={`Value for {{${num}}}`}
                          value={variables[num]}
                          onChange={(e) => setVariables({ ...variables, [num]: e.target.value })}
                          style={{ width: "100%", padding: "10px", borderRadius: "10px", border: "1.5px solid #e2e8f0", outline: "none", fontSize: "0.9rem" }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <button
            onClick={handleSend}
            disabled={isImageRequired && !itemImageUrl}
            style={{ width: "100%", marginTop: "20px", padding: "16px", background: (isImageRequired && !itemImageUrl) ? "#cbd5e1" : "#00a884", color: "white", border: "none", borderRadius: "16px", fontWeight: "800", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", boxShadow: "0 10px 20px rgba(0,168,132,0.3)" }}
          >
            <Send size={20} /> Send Template
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(11, 27, 33, 0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, backdropFilter: "blur(8px)" }}>
      <div style={{ background: "white", borderRadius: "28px", width: "900px", maxWidth: "95%", height: "85vh", display: "flex", overflow: "hidden", boxShadow: "0 25px 70px rgba(0,0,0,0.4)" }}>

        {/* Left Side: List */}
        <div style={{ width: "380px", borderRight: "1px solid #f1f5f9", display: "flex", flexDirection: "column", background: "#ffffff" }}>
          <div style={{ padding: "24px", background: "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ background: "#00a884", color: "white", padding: "8px", borderRadius: "10px" }}>
                  <Layout size={20} />
                </div>
                <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: "800", color: "#1e293b" }}>Send Template</h3>
              </div>
              <X cursor="pointer" onClick={onClose} color="#94a3b8" />
            </div>

            <div style={{ display: "flex", background: "#f1f5f9", padding: "4px", borderRadius: "12px", marginBottom: "15px" }}>
              <button
                onClick={() => setActiveTab("presets")}
                style={{ flex: 1, padding: "10px", border: "none", borderRadius: "9px", background: activeTab === "presets" ? "white" : "transparent", color: activeTab === "presets" ? "#00a884" : "#64748b", fontWeight: "700", cursor: "pointer", transition: "all 0.2s", boxShadow: activeTab === "presets" ? "0 2px 8px rgba(0,0,0,0.05)" : "none" }}
              >
                Presets
              </button>
              <button
                onClick={() => setActiveTab("meta")}
                style={{ flex: 1, padding: "10px", border: "none", borderRadius: "9px", background: activeTab === "meta" ? "white" : "transparent", color: activeTab === "meta" ? "#00a884" : "#64748b", fontWeight: "700", cursor: "pointer", transition: "all 0.2s", boxShadow: activeTab === "meta" ? "0 2px 8px rgba(0,0,0,0.05)" : "none" }}
              >
                Meta List
              </button>
            </div>

            <div style={{ position: "relative" }}>
              <Search style={{ position: "absolute", left: "12px", top: "12px", color: "#94a3b8" }} size={18} />
              <input
                type="text"
                placeholder={`Search ${activeTab}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: "100%", padding: "12px 15px 12px 42px", borderRadius: "12px", border: "1.5px solid #e2e8f0", outline: "none", fontSize: "0.9rem" }}
              />
            </div>
          </div>

          <div className="chat-scroll" style={{ flex: 1, overflowY: "auto", padding: "15px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {activeTab === "presets" ? (
              filteredPresets.length > 0 ? (
                filteredPresets.map(p => (
                  <div
                    key={p._id}
                    onClick={() => handleSelectItem(p, "preset")}
                    style={{
                      padding: "14px", borderRadius: "16px", cursor: "pointer", border: "2px solid",
                      borderColor: selectedItem?._id === p._id ? "#00a884" : "#f1f5f9",
                      background: selectedItem?._id === p._id ? "#f0fdf4" : "#ffffff",
                      display: "flex", gap: "12px", alignItems: "center", transition: "all 0.2s"
                    }}
                  >
                    <div style={{ width: "45px", height: "45px", borderRadius: "12px", overflow: "hidden", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {p.mediaUrl ? <img src={p.mediaUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <ImageIcon size={20} color="#cbd5e1" />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: "700", color: "#1e293b", fontSize: "0.95rem" }}>{p.name}</div>
                      <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "600" }}>Using: {p.templateName}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8" }}>
                  <Sparkles size={32} style={{ opacity: 0.2, marginBottom: "10px" }} />
                  <p style={{ fontSize: "0.9rem" }}>No presets found.</p>
                </div>
              )
            ) : (
              filteredTemplates.map(t => (
                <div
                  key={t.name}
                  onClick={() => handleSelectItem(t, "template")}
                  style={{
                    padding: "14px", borderRadius: "16px", cursor: "pointer", border: "2px solid",
                    borderColor: selectedItem?.name === t.name ? "#00a884" : "#f1f5f9",
                    background: selectedItem?.name === t.name ? "#f0fdf4" : "#ffffff",
                    display: "flex", gap: "12px", alignItems: "center", transition: "all 0.2s"
                  }}
                >
                  <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
                    <MessageSquare size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "700", color: "#1e293b", fontSize: "0.95rem" }}>{t.name}</div>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "600" }}>{t.language} • {t.category}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Preview & Variables */}
        {renderPreview()}
      </div>
    </div>
  );
};

export default TemplateModal;
