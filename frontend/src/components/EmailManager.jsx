import React, { useState, useEffect } from "react";
import { Mail, Settings, FileText, Send, Trash2, Plus, Edit2, CheckCircle2, XCircle, Info, RefreshCw, Eye, Sparkles, History, Paperclip, Server, Check } from "lucide-react";
import api from "../api";
import { io } from "socket.io-client";
import RichTextEditor from "./RichTextEditor";

const EmailManager = () => {
  const [activeTab, setActiveTab] = useState("inbox"); // "inbox" | "send" | "templates" | "settings" | "history"
  
  // SMTP settings state (Dynamic Profiles list)
  const [smtpSettings, setSmtpSettings] = useState([]);
  const [showSmtpModal, setShowSmtpModal] = useState(false);
  const [editingSmtpId, setEditingSmtpId] = useState(null);
  
  const [smtpForm, setSmtpForm] = useState({
    name: "", // Profile Name
    type: "official", // "gmail" | "official"
    host: "",
    port: 587,
    secure: false,
    user: "",
    pass: "",
    senderName: "WhatsApp Dashboard",
    senderEmail: "",
    imapHost: "",
    imapPort: 993,
    imapSecure: true
  });

  // Inbox/Replies states
  const [inbox, setInbox] = useState([]);
  const [selectedInboxEmail, setSelectedInboxEmail] = useState(null);
  const [showInboxModal, setShowInboxModal] = useState(false);
  const [syncingInbox, setSyncingInbox] = useState(false);
  const [filterProfileId, setFilterProfileId] = useState("all");
  
  // Templates state
  const [templates, setTemplates] = useState([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateForm, setTemplateForm] = useState({ id: null, name: "", subject: "", body: "" });
  
  // Send Email state
  const [sendForm, setSendForm] = useState({
    smtpProfileId: "",
    to: "",
    subject: "",
    body: "",
    selectedTemplateId: ""
  });

  // Attachments state
  const [selectedFiles, setSelectedFiles] = useState([]);

  // History logs state
  const [logs, setLogs] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  const [showLogModal, setShowLogModal] = useState(false);

  // Variables state
  const [detectedVars, setDetectedVars] = useState([]);
  const [varValues, setVarValues] = useState({});

  // UI state
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState({ status: null, message: "" });
  const [feedback, setFeedback] = useState({ type: null, message: "" });

  useEffect(() => {
    fetchSettings();
    fetchTemplates();
    fetchLogs();
    fetchInbox();

    // Setup Socket connection for real-time incoming email notifications!
    const socketUrl = import.meta.env.VITE_API_URL || window.location.origin;
    const socket = io(socketUrl);

    socket.on("new_email", ({ email }) => {
      // Add the new email to the top of the list if it's not already in the state
      setInbox(prev => {
        const exists = prev.some(item => item.messageId === email.messageId);
        if (exists) return prev;
        return [email, ...prev];
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchInbox = async (sync = false) => {
    if (sync) setSyncingInbox(true);
    try {
      const { data } = await api.get(`/email/inbox${sync ? "?sync=true" : ""}`);
      setInbox(data);
    } catch (err) {
      console.error("Failed to fetch email inbox:", err);
      showFeedback("danger", "Failed to load email inbox.");
    } finally {
      if (sync) setSyncingInbox(false);
    }
  };

  const handleMarkAsRead = async (emailId, seenStatus) => {
    try {
      await api.put(`/email/inbox/${emailId}/read`, { seen: seenStatus });
      setInbox(prev => prev.map(item => item._id === emailId ? { ...item, seen: seenStatus } : item));
    } catch (err) {
      console.error("Failed to mark email read status:", err);
    }
  };

  const handleDeleteInboxEmail = async (emailId) => {
    if (!window.confirm("Are you sure you want to delete this email?")) return;
    try {
      await api.delete(`/email/inbox/${emailId}`);
      setInbox(prev => prev.filter(item => item._id !== emailId));
      if (selectedInboxEmail?._id === emailId) {
        setShowInboxModal(false);
        setSelectedInboxEmail(null);
      }
      showFeedback("success", "Email deleted from inbox.");
    } catch (err) {
      console.error("Failed to delete email:", err);
      showFeedback("danger", "Failed to delete email.");
    }
  };

  // Scan for variables in Subject and Body whenever they change
  useEffect(() => {
    const combinedText = sendForm.subject + " " + sendForm.body;
    const regex = /\{\{([a-zA-Z0-9_ -]+)\}\}/g;
    const foundVars = [];
    let match;
    while ((match = regex.exec(combinedText)) !== null) {
      const varName = match[1].trim();
      if (!foundVars.includes(varName)) {
        foundVars.push(varName);
      }
    }
    
    setDetectedVars(foundVars);
    
    setVarValues(prev => {
      const updated = {};
      foundVars.forEach(v => {
        updated[v] = prev[v] !== undefined ? prev[v] : "";
      });
      return updated;
    });
  }, [sendForm.subject, sendForm.body]);

  const fetchSettings = async () => {
    try {
      const { data } = await api.get("/email/settings");
      setSmtpSettings(data);
      // Auto select the first configuration in the Send tab if none selected
      if (data.length > 0 && !sendForm.smtpProfileId) {
        setSendForm(prev => ({ ...prev, smtpProfileId: data[0]._id }));
      }
    } catch (err) {
      showFeedback("danger", "Failed to fetch SMTP settings.");
    }
  };

  const fetchTemplates = async () => {
    try {
      const { data } = await api.get("/email/templates");
      setTemplates(data);
    } catch (err) {
      showFeedback("danger", "Failed to fetch email templates.");
    }
  };

  const fetchLogs = async () => {
    try {
      const { data } = await api.get("/email/logs");
      setLogs(data);
    } catch (err) {
      console.error("Failed to fetch email history:", err);
    }
  };

  const handleSmtpTypeChangeInForm = (type) => {
    setSmtpForm(prev => ({
      ...prev,
      type,
      host: type === "gmail" ? "smtp.gmail.com" : prev.host,
      port: type === "gmail" ? 465 : 587,
      secure: type === "gmail" ? true : false,
      imapHost: type === "gmail" ? "imap.gmail.com" : prev.imapHost,
      imapPort: type === "gmail" ? 993 : prev.imapPort,
      imapSecure: type === "gmail" ? true : prev.imapSecure
    }));
    setTestResult({ status: null, message: "" });
  };

  const showFeedback = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback({ type: null, message: "" }), 5000);
  };

  const handleTestConnection = async () => {
    setLoading(true);
    setTestResult({ status: "testing", message: "Connecting to server..." });
    try {
      const { data } = await api.post("/email/settings/test", {
        id: editingSmtpId,
        ...smtpForm
      });
      setTestResult({ status: "success", message: data.message });
    } catch (err) {
      setTestResult({ status: "error", message: err.response?.data?.error || err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/email/settings", {
        id: editingSmtpId,
        ...smtpForm
      });
      showFeedback("success", `SMTP Profile saved successfully!`);
      setShowSmtpModal(false);
      resetSmtpForm();
      fetchSettings();
    } catch (err) {
      showFeedback("danger", err.response?.data?.error || "Failed to save SMTP profile.");
    } finally {
      setLoading(false);
    }
  };

  const resetSmtpForm = () => {
    setEditingSmtpId(null);
    setSmtpForm({
      name: "",
      type: "official",
      host: "",
      port: 587,
      secure: false,
      user: "",
      pass: "",
      senderName: "WhatsApp Dashboard",
      senderEmail: "",
      imapHost: "",
      imapPort: 993,
      imapSecure: true
    });
    setTestResult({ status: null, message: "" });
  };

  const handleEditSmtp = (profile) => {
    setEditingSmtpId(profile._id);
    setSmtpForm({
      name: profile.name,
      type: profile.type,
      host: profile.host || "",
      port: profile.port || 587,
      secure: profile.secure || false,
      user: profile.user,
      pass: profile.pass,
      senderName: profile.senderName || "WhatsApp Dashboard",
      senderEmail: profile.senderEmail || "",
      imapHost: profile.imapHost || "",
      imapPort: profile.imapPort || 993,
      imapSecure: profile.imapSecure !== undefined ? profile.imapSecure : true
    });
    setTestResult({ status: null, message: "" });
    setShowSmtpModal(true);
  };

  const handleDeleteSmtp = async (id) => {
    if (!window.confirm("Are you sure you want to delete this SMTP profile?")) return;
    try {
      await api.delete(`/email/settings/${id}`);
      showFeedback("success", "SMTP Profile deleted successfully.");
      fetchSettings();
    } catch (err) {
      showFeedback("danger", "Failed to delete SMTP profile.");
    }
  };

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (templateForm.id) {
        await api.put(`/email/templates/${templateForm.id}`, {
          name: templateForm.name,
          subject: templateForm.subject,
          body: templateForm.body
        });
        showFeedback("success", "Template updated successfully.");
      } else {
        await api.post("/email/templates", {
          name: templateForm.name,
          subject: templateForm.subject,
          body: templateForm.body
        });
        showFeedback("success", "Template created successfully.");
      }
      setShowTemplateModal(false);
      setTemplateForm({ id: null, name: "", subject: "", body: "" });
      fetchTemplates();
    } catch (err) {
      showFeedback("danger", err.response?.data?.error || "Failed to save template.");
    } finally {
      setLoading(false);
    }
  };

  const handleEditTemplate = (t) => {
    setTemplateForm({
      id: t._id,
      name: t.name,
      subject: t.subject,
      body: t.body
    });
    setShowTemplateModal(true);
  };

  const handleDeleteTemplate = async (id) => {
    if (!window.confirm("Are you sure you want to delete this template?")) return;
    try {
      await api.delete(`/email/templates/${id}`);
      showFeedback("success", "Template deleted successfully.");
      fetchTemplates();
    } catch (err) {
      showFeedback("danger", "Failed to delete template.");
    }
  };

  const handleTemplateSelect = (e) => {
    const templateId = e.target.value;
    setSendForm(prev => {
      if (!templateId) {
        return { ...prev, selectedTemplateId: "", subject: "", body: "" };
      }
      const selected = templates.find(t => t._id === templateId);
      return {
        ...prev,
        selectedTemplateId: templateId,
        subject: selected ? selected.subject : prev.subject,
        body: selected ? selected.body : prev.body
      };
    });
  };

  const getResolvedContent = (text) => {
    let resolved = text;
    detectedVars.forEach(v => {
      const value = varValues[v] !== undefined ? varValues[v] : `{{${v}}}`;
      const escapedVar = v.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
      const regex = new RegExp(`\\{\\{\\s*${escapedVar}\\s*\\}\\}`, "g");
      resolved = resolved.replace(regex, value || `<span style="color:#ef4444;background:#fef2f2;border:1px dashed #fca5a5;padding:2px 4px;border-radius:4px;font-size:0.8rem">Waiting for ${v}...</span>`);
    });
    return resolved;
  };

  const getPayloadContent = (text) => {
    let resolved = text;
    detectedVars.forEach(v => {
      const value = varValues[v] || "";
      const escapedVar = v.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
      const regex = new RegExp(`\\{\\{\\s*${escapedVar}\\s*\\}\\}`, "g");
      resolved = resolved.replace(regex, value);
    });
    return resolved;
  };

  const handleSendEmail = async (e) => {
    e.preventDefault();
    if (!sendForm.smtpProfileId) {
      showFeedback("danger", "Please configure and select an SMTP profile before sending.");
      return;
    }
    setLoading(true);

    const resolvedSubject = getPayloadContent(sendForm.subject);
    const resolvedBody = getPayloadContent(sendForm.body);

    const formData = new FormData();
    formData.append("smtpProfileId", sendForm.smtpProfileId);
    formData.append("to", sendForm.to);
    formData.append("subject", resolvedSubject);
    formData.append("body", resolvedBody);
    
    selectedFiles.forEach(file => {
      formData.append("attachments", file);
    });

    try {
      await api.post("/email/send", formData, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });
      showFeedback("success", `Email sent successfully to ${sendForm.to}!`);
      setSendForm(prev => ({
        ...prev,
        to: "",
        subject: "",
        body: "",
        selectedTemplateId: ""
      }));
      setSelectedFiles([]);
      setVarValues({});
      fetchLogs();
    } catch (err) {
      showFeedback("danger", err.response?.data?.error || "Failed to send email.");
      fetchLogs();
    } finally {
      setLoading(false);
    }
  };

  // Find active profile sender display info for preview
  const activeProfile = smtpSettings.find(s => s._id === sendForm.smtpProfileId);

  const filteredInbox = filterProfileId === "all"
    ? inbox
    : inbox.filter(item => {
        const itemPid = item.smtpProfileId?._id || item.smtpProfileId;
        return itemPid === filterProfileId;
      });

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "10px" }}>
      {/* Top Banner/Feedback */}
      {feedback.message && (
        <div style={{
          padding: "12px 20px",
          borderRadius: "12px",
          marginBottom: "1.5rem",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          background: feedback.type === "success" ? "#e6fcf5" : "#fff5f5",
          color: feedback.type === "success" ? "#0ca678" : "#f03e3e",
          border: `1px solid ${feedback.type === "success" ? "#c3fae8" : "#ffe3e3"}`,
          fontWeight: "600",
          boxShadow: "0 4px 12px rgba(0,0,0,0.03)"
        }}>
          {feedback.type === "success" ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h2 style={{ fontSize: "1.8rem", color: "#1e293b", fontWeight: "800", marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "10px" }}>
            <Mail size={28} color="var(--accent-primary, #00a884)" /> Email Sending System
          </h2>
          <p style={{ color: "#64748b", fontWeight: "500" }}>Manage your custom SMTP profiles, email templates, and track delivery logs with attachments</p>
        </div>
      </div>

      {/* Modern Tabs */}
      <div style={{
        display: "flex",
        gap: "8px",
        background: "#f1f5f9",
        padding: "6px",
        borderRadius: "14px",
        marginBottom: "2rem",
        width: "fit-content",
        border: "1px solid #e2e8f0"
      }}>
        <button
          onClick={() => { setActiveTab("inbox"); fetchInbox(); }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 20px",
            borderRadius: "10px",
            border: "none",
            background: activeTab === "inbox" ? "white" : "transparent",
            color: activeTab === "inbox" ? "#1e293b" : "#64748b",
            fontWeight: "700",
            cursor: "pointer",
            boxShadow: activeTab === "inbox" ? "0 4px 10px rgba(0,0,0,0.05)" : "none",
            transition: "all 0.2s"
          }}
        >
          <Mail size={16} /> Replies / Inbox
          {inbox.filter(i => !i.seen).length > 0 && (
            <span style={{
              background: "#ff4d4f",
              color: "white",
              fontSize: "0.75rem",
              padding: "2px 6px",
              borderRadius: "10px",
              fontWeight: "800",
              marginLeft: "4px"
            }}>
              {inbox.filter(i => !i.seen).length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("send")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 20px",
            borderRadius: "10px",
            border: "none",
            background: activeTab === "send" ? "white" : "transparent",
            color: activeTab === "send" ? "#1e293b" : "#64748b",
            fontWeight: "700",
            cursor: "pointer",
            boxShadow: activeTab === "send" ? "0 4px 10px rgba(0,0,0,0.05)" : "none",
            transition: "all 0.2s"
          }}
        >
          <Send size={16} /> Send Email
        </button>
        <button
          onClick={() => setActiveTab("templates")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 20px",
            borderRadius: "10px",
            border: "none",
            background: activeTab === "templates" ? "white" : "transparent",
            color: activeTab === "templates" ? "#1e293b" : "#64748b",
            fontWeight: "700",
            cursor: "pointer",
            boxShadow: activeTab === "templates" ? "0 4px 10px rgba(0,0,0,0.05)" : "none",
            transition: "all 0.2s"
          }}
        >
          <FileText size={16} /> Email Templates
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 20px",
            borderRadius: "10px",
            border: "none",
            background: activeTab === "settings" ? "white" : "transparent",
            color: activeTab === "settings" ? "#1e293b" : "#64748b",
            fontWeight: "700",
            cursor: "pointer",
            boxShadow: activeTab === "settings" ? "0 4px 10px rgba(0,0,0,0.05)" : "none",
            transition: "all 0.2s"
          }}
        >
          <Settings size={16} /> SMTP Config
        </button>
        <button
          onClick={() => { setActiveTab("history"); fetchLogs(); }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 20px",
            borderRadius: "10px",
            border: "none",
            background: activeTab === "history" ? "white" : "transparent",
            color: activeTab === "history" ? "#1e293b" : "#64748b",
            fontWeight: "700",
            cursor: "pointer",
            boxShadow: activeTab === "history" ? "0 4px 10px rgba(0,0,0,0.05)" : "none",
            transition: "all 0.2s"
          }}
        >
          <History size={16} /> Email History
        </button>
      </div>

      {/* Tab Panel: REPLIES / INBOX */}
      {activeTab === "inbox" && (
        <div style={{
          background: "white",
          borderRadius: "20px",
          padding: "2rem",
          boxShadow: "0 10px 30px rgba(0,0,0,0.03)",
          border: "1px solid #f1f5f9"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <div>
              <h3 style={{ fontSize: "1.25rem", color: "#1e293b", fontWeight: "700", marginBottom: "0.25rem" }}>Incoming Email Replies</h3>
              <p style={{ color: "#64748b", fontSize: "0.9rem" }}>View responses to your sent campaigns and emails</p>
            </div>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <select
                value={filterProfileId}
                onChange={e => setFilterProfileId(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem", background: "white", fontWeight: "600", color: "#475569" }}
              >
                <option value="all">All SMTP Profiles</option>
                {smtpSettings.map(s => (
                  <option key={s._id} value={s._id}>{s.name} ({s.type === "gmail" ? "Gmail" : "Custom"})</option>
                ))}
              </select>
              <button
                onClick={() => fetchInbox(true)}
                disabled={syncingInbox}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "var(--accent-primary, #00a884)",
                  color: "white",
                  border: "none",
                  padding: "10px 18px",
                  borderRadius: "10px",
                  fontWeight: "700",
                  cursor: "pointer",
                  transition: "0.2s"
                }}
              >
                <RefreshCw size={16} className={syncingInbox ? "animate-spin" : ""} style={{ animation: syncingInbox ? "spin 1s linear infinite" : "none" }} />
                {syncingInbox ? "Syncing..." : "Sync Now"}
              </button>
            </div>
          </div>

          {filteredInbox.length === 0 ? (
            <div style={{
              textAlign: "center",
              padding: "3rem",
              background: "#f8fafc",
              borderRadius: "16px",
              color: "#64748b"
            }}>
              <Mail size={48} style={{ margin: "0 auto 1rem", opacity: 0.5 }} />
              <p style={{ fontWeight: "600", fontSize: "1.1rem" }}>No emails found</p>
              <p style={{ fontSize: "0.9rem", color: "#94a3b8", marginBottom: "1rem" }}>No inbound email replies match this filter. Click "Sync Now" to fetch latest replies.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {filteredInbox.map(item => (
                <div
                  key={item._id}
                  onClick={() => {
                    setSelectedInboxEmail(item);
                    setShowInboxModal(true);
                    if (!item.seen) {
                      handleMarkAsRead(item._id, true);
                    }
                  }}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.2fr 2fr 1.2fr",
                    alignItems: "center",
                    gap: "20px",
                    padding: "1rem 1.5rem",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    background: item.seen ? "white" : "rgba(0,168,132,0.02)",
                    borderLeft: item.seen ? "1px solid #e2e8f0" : "4px solid #00a884",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.01)"
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", minWidth: "150px" }}>
                    <span style={{ fontWeight: item.seen ? "600" : "800", color: "#1e293b", fontSize: "0.95rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.fromName || item.from}
                    </span>
                    <span style={{ fontSize: "0.8rem", color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.from}</span>
                    {item.smtpProfileId?.name && (
                      <span style={{
                        marginTop: "6px",
                        padding: "2px 6px",
                        background: "rgba(0,168,132,0.08)",
                        color: "#00a884",
                        borderRadius: "4px",
                        fontSize: "0.7rem",
                        width: "fit-content",
                        fontWeight: "700"
                      }}>
                        {item.smtpProfileId.name}
                      </span>
                    )}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    <span style={{ fontWeight: item.seen ? "600" : "800", color: "#1e293b", fontSize: "0.95rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.subject || "(No Subject)"}
                    </span>
                    <span style={{ fontSize: "0.85rem", color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.bodyText || "HTML content"}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "15px" }}>
                    <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                      {new Date(item.date).toLocaleString()}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteInboxEmail(item._id);
                      }}
                      style={{
                        padding: "6px",
                        borderRadius: "6px",
                        border: "none",
                        background: "none",
                        color: "#ef4444",
                        cursor: "pointer"
                      }}
                      title="Delete Email"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* View Inbox Email Detail Modal */}
          {showInboxModal && selectedInboxEmail && (
            <div style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.4)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999
            }}>
              <div style={{
                background: "white",
                padding: "2rem",
                borderRadius: "20px",
                width: "90%",
                maxWidth: "800px",
                boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
                display: "flex",
                flexDirection: "column",
                maxHeight: "85vh"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid #e2e8f0", paddingBottom: "12px", marginBottom: "1rem" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <h3 style={{ fontSize: "1.25rem", fontWeight: "800", color: "#1e293b", margin: 0 }}>
                      {selectedInboxEmail.subject || "(No Subject)"}
                    </h3>
                    <div style={{ fontSize: "0.85rem", color: "#475569" }}>
                      <strong>From:</strong> {selectedInboxEmail.fromName ? `"${selectedInboxEmail.fromName}" <${selectedInboxEmail.from}>` : selectedInboxEmail.from}
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#475569" }}>
                      <strong>To:</strong> {selectedInboxEmail.to}
                    </div>
                  </div>
                  <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                    {new Date(selectedInboxEmail.date).toLocaleString()}
                  </span>
                </div>

                <div style={{ flex: 1, overflowY: "auto", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "20px", background: "white" }}>
                  {selectedInboxEmail.bodyHtml ? (
                    <div dangerouslySetInnerHTML={{ __html: selectedInboxEmail.bodyHtml }} />
                  ) : (
                    <div style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{selectedInboxEmail.bodyText}</div>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1.5rem" }}>
                  <button
                    onClick={() => handleDeleteInboxEmail(selectedInboxEmail._id)}
                    style={{
                      padding: "10px 18px",
                      borderRadius: "8px",
                      background: "#fef2f2",
                      color: "#ef4444",
                      border: "1px solid #fee2e2",
                      fontWeight: "700",
                      cursor: "pointer"
                    }}
                  >
                    Delete Email
                  </button>
                  <button
                    onClick={() => { setShowInboxModal(false); setSelectedInboxEmail(null); }}
                    style={{
                      padding: "10px 20px",
                      borderRadius: "8px",
                      background: "var(--accent-primary, #00a884)",
                      color: "white",
                      border: "none",
                      fontWeight: "700",
                      cursor: "pointer"
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab Panel 1: SEND EMAIL */}
      {activeTab === "send" && (
        <div style={{
          background: "white",
          borderRadius: "20px",
          padding: "2rem",
          boxShadow: "0 10px 30px rgba(0,0,0,0.03)",
          border: "1px solid #f1f5f9"
        }}>
          <h3 style={{ fontSize: "1.25rem", color: "#1e293b", marginBottom: "1.5rem", fontWeight: "700" }}>Compose Outbound Email</h3>
          
          {smtpSettings.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem", background: "#f8fafc", borderRadius: "16px", color: "#64748b" }}>
              <Server size={48} style={{ margin: "0 auto 1rem", opacity: 0.5 }} />
              <p style={{ fontWeight: "600", fontSize: "1.1rem" }}>No SMTP Profiles Configured</p>
              <p style={{ fontSize: "0.9rem", color: "#94a3b8", marginBottom: "1.5rem" }}>You must create at least one SMTP configuration profile (Gmail or Custom) to send emails.</p>
              <button
                onClick={() => setActiveTab("settings")}
                style={{ background: "var(--accent-primary, #00a884)", color: "white", border: "none", padding: "10px 20px", borderRadius: "8px", fontWeight: "700", cursor: "pointer" }}
              >
                Go to SMTP Config
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "2rem" }}>
              {/* Form Column */}
              <div>
                <form onSubmit={handleSendEmail} style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div className="input-group">
                      <label style={{ display: "block", marginBottom: "6px", fontWeight: "600", color: "#475569", fontSize: "0.85rem" }}>Select Sender SMTP Profile</label>
                      <select
                        value={sendForm.smtpProfileId}
                        onChange={e => setSendForm({ ...sendForm, smtpProfileId: e.target.value })}
                        style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem" }}
                      >
                        {smtpSettings.map(s => (
                          <option key={s._id} value={s._id}>{s.name} ({s.type === "gmail" ? "Gmail" : "Custom"})</option>
                        ))}
                      </select>
                    </div>

                    <div className="input-group">
                      <label style={{ display: "block", marginBottom: "6px", fontWeight: "600", color: "#475569", fontSize: "0.85rem" }}>Select Template</label>
                      <select
                        value={sendForm.selectedTemplateId}
                        onChange={handleTemplateSelect}
                        style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem" }}
                      >
                        <option value="">-- None (Write Custom) --</option>
                        {templates.map(t => (
                          <option key={t._id} value={t._id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Dynamically detected template variables */}
                  {detectedVars.length > 0 && (
                    <div style={{
                      background: "rgba(0,168,132,0.03)",
                      border: "1px solid rgba(0,168,132,0.15)",
                      borderRadius: "12px",
                      padding: "1.25rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#00a884", fontWeight: "700", fontSize: "0.9rem" }}>
                        <Sparkles size={16} /> Template Variables Detected
                      </div>
                      <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }}>Please provide values for the placeholders in your template:</p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "4px" }}>
                        {detectedVars.map(v => (
                          <div key={v} className="input-group">
                            <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", fontSize: "0.8rem", color: "#475569" }}>{v}</label>
                            <input
                              type="text"
                              required
                              placeholder={`Enter value for ${v}`}
                              value={varValues[v] || ""}
                              onChange={e => setVarValues({ ...varValues, [v]: e.target.value })}
                              style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="input-group">
                    <label style={{ display: "block", marginBottom: "6px", fontWeight: "600", color: "#475569", fontSize: "0.85rem" }}>Recipient (To)</label>
                    <input
                      type="email"
                      required
                      placeholder="receiver@domain.com"
                      value={sendForm.to}
                      onChange={e => setSendForm({ ...sendForm, to: e.target.value })}
                      style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem" }}
                    />
                  </div>

                  <div className="input-group">
                    <label style={{ display: "block", marginBottom: "6px", fontWeight: "600", color: "#475569", fontSize: "0.85rem" }}>Subject</label>
                    <input
                      type="text"
                      required
                      placeholder="Use {{variable}} to make it dynamic"
                      value={sendForm.subject}
                      onChange={e => setSendForm({ ...sendForm, subject: e.target.value })}
                      style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem" }}
                    />
                  </div>

                  <div className="input-group">
                    <label style={{ display: "block", marginBottom: "6px", fontWeight: "600", color: "#475569", fontSize: "0.85rem" }}>Body Content (Rich Text / HTML Formatting)</label>
                    <RichTextEditor
                      placeholder="Write content here. Use double curly brackets for variables, e.g. {{name}} or {{otp}}"
                      value={sendForm.body}
                      onChange={html => setSendForm({ ...sendForm, body: html })}
                    />
                  </div>

                  {/* Attachments Section */}
                  <div className="input-group" style={{ border: "1px dashed #cbd5e1", padding: "15px", borderRadius: "12px", background: "#f8fafc" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", color: "#475569", fontSize: "0.85rem", cursor: "pointer", marginBottom: "10px" }}>
                      <Paperclip size={18} color="#64748b" /> Attach Documents / Images (Multiple Supported)
                    </label>
                    <input
                      type="file"
                      multiple
                      onChange={e => {
                        const files = Array.from(e.target.files);
                        setSelectedFiles(prev => [...prev, ...files]);
                      }}
                      style={{ display: "block", width: "100%", fontSize: "0.85rem", color: "#64748b" }}
                    />
                    {selectedFiles.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", background: "white", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", marginTop: "10px" }}>
                        {selectedFiles.map((file, idx) => (
                          <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem", color: "#1e293b" }}>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "250px" }}>
                              📄 {file.name} <span style={{ color: "#94a3b8" }}>({(file.size / 1024).toFixed(1)} KB)</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}
                              style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontWeight: "700", fontSize: "0.8rem" }}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      background: "var(--accent-primary, #00a884)",
                      color: "white",
                      border: "none",
                      padding: "12px 24px",
                      borderRadius: "8px",
                      fontWeight: "700",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "10px",
                      fontSize: "0.95rem",
                      width: "100%",
                      boxShadow: "0 6px 15px rgba(0,168,132,0.15)",
                      transition: "0.2s"
                    }}
                  >
                    <Send size={16} /> {loading ? "Sending..." : "Send Email Now"}
                  </button>
                </form>
              </div>

              {/* Live HTML Preview Column */}
              <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <Eye size={18} color="#64748b" />
                  <span style={{ fontWeight: "700", color: "#475569", fontSize: "0.9rem" }}>Live HTML Email Preview</span>
                </div>
                <div style={{
                  flex: 1,
                  border: "1px solid #cbd5e1",
                  borderRadius: "12px",
                  background: "#f8fafc",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  minHeight: "400px",
                  boxShadow: "inset 0 2px 8px rgba(0,0,0,0.03)"
                }}>
                  {/* Simulated Email Client Header */}
                  <div style={{ background: "#edf2f7", padding: "12px 16px", borderBottom: "1px solid #cbd5e1", fontSize: "0.8rem", color: "#4a5568" }}>
                    <div><strong>From:</strong> {activeProfile?.senderName || "WhatsApp Dashboard"} &lt;{activeProfile?.senderEmail || activeProfile?.user || "sender@domain.com"}&gt;</div>
                    <div style={{ marginTop: "4px" }}><strong>To:</strong> {sendForm.to || "recipient@example.com"}</div>
                    <div style={{ marginTop: "4px", fontSize: "0.9rem", color: "#1a202c" }}><strong>Subject:</strong> {getResolvedContent(sendForm.subject) || "(No Subject)"}</div>
                    
                    {/* Visual indication of attachments in preview */}
                    {selectedFiles.length > 0 && (
                      <div style={{ marginTop: "6px", display: "flex", flexWrap: "wrap", gap: "6px", fontSize: "0.75rem", background: "rgba(0,0,0,0.02)", padding: "6px 8px", borderRadius: "4px" }}>
                        <strong>Attachments ({selectedFiles.length}):</strong>
                        {selectedFiles.map((f, i) => (
                          <span key={i} style={{ background: "#e2e8f0", padding: "2px 6px", borderRadius: "4px" }}>📎 {f.name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Renders HTML exactly as user drafts it, with filled variables */}
                  <div style={{ flex: 1, padding: "16px", background: "white", overflowY: "auto" }}>
                    {sendForm.body ? (
                      <div dangerouslySetInnerHTML={{ __html: getResolvedContent(sendForm.body) }} />
                    ) : (
                      <div style={{ color: "#94a3b8", fontStyle: "italic", textAlign: "center", marginTop: "4rem" }}>
                        Start typing HTML body content. Use variables like {"{{name}}"} to activate dynamic input fields.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab Panel 2: EMAIL TEMPLATES */}
      {activeTab === "templates" && (
        <div style={{
          background: "white",
          borderRadius: "20px",
          padding: "2rem",
          boxShadow: "0 10px 30px rgba(0,0,0,0.03)",
          border: "1px solid #f1f5f9"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <h3 style={{ fontSize: "1.25rem", color: "#1e293b", fontWeight: "700" }}>Manage Email Templates</h3>
            <button
              onClick={() => { setTemplateForm({ id: null, name: "", subject: "", body: "" }); setShowTemplateModal(true); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "var(--accent-primary, #00a884)",
                color: "white",
                border: "none",
                padding: "10px 18px",
                borderRadius: "10px",
                fontWeight: "700",
                cursor: "pointer",
                transition: "0.2s"
              }}
            >
              <Plus size={18} /> Add New Template
            </button>
          </div>

          {templates.length === 0 ? (
            <div style={{
              textAlign: "center",
              padding: "3rem",
              background: "#f8fafc",
              borderRadius: "16px",
              color: "#64748b"
            }}>
              <FileText size={48} style={{ margin: "0 auto 1rem", opacity: 0.5 }} />
              <p style={{ fontWeight: "600", fontSize: "1.1rem" }}>No email templates found</p>
              <p style={{ fontSize: "0.9rem", color: "#94a3b8" }}>Create reusable templates to easily populate subject and body when drafting emails.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.5rem" }}>
              {templates.map(t => (
                <div
                  key={t._id}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "16px",
                    padding: "1.5rem",
                    background: "white",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between"
                  }}
                >
                  <div>
                    <h4 style={{ fontSize: "1.1rem", fontWeight: "700", color: "#1e293b", marginBottom: "8px" }}>{t.name}</h4>
                    <p style={{ fontSize: "0.85rem", color: "#64748b", margin: "0 0 12px 0" }}>
                      <strong>Subject:</strong> {t.subject}
                    </p>
                    <div style={{
                      padding: "10px 14px",
                      borderRadius: "8px",
                      fontSize: "0.85rem",
                      color: "#475569",
                      height: "120px",
                      overflowY: "auto",
                      border: "1px solid #e2e8f0",
                      background: "white"
                    }}>
                      <div dangerouslySetInnerHTML={{ __html: t.body }} />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "8px", marginTop: "1.5rem" }}>
                    <button
                      onClick={() => handleEditTemplate(t)}
                      style={{
                        flex: 1,
                        padding: "8px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        background: "#f8fafc",
                        color: "#475569",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        fontWeight: "600",
                        fontSize: "0.85rem"
                      }}
                    >
                      <Edit2 size={14} /> Edit
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(t._id)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid #fee2e2",
                        background: "#fef2f2",
                        color: "#ef4444",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Template Edit/Create Modal with split HTML Preview */}
          {showTemplateModal && (
            <div style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.4)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999
            }}>
              <div style={{
                background: "white",
                padding: "2rem",
                borderRadius: "20px",
                width: "95%",
                maxWidth: "1000px",
                boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
                display: "flex",
                flexDirection: "column",
                maxHeight: "90vh"
              }}>
                <h3 style={{ fontSize: "1.3rem", fontWeight: "800", color: "#1e293b", marginBottom: "1.5rem" }}>
                  {templateForm.id ? "Edit Email Template" : "Add Email Template"}
                </h3>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", overflowY: "auto", flex: 1, paddingBottom: "1.5rem" }}>
                  {/* Editor Side */}
                  <form style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div className="input-group">
                      <label style={{ display: "block", marginBottom: "6px", fontWeight: "600", fontSize: "0.85rem" }}>Template Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g., Welcome Email"
                        value={templateForm.name}
                        onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })}
                        style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                      />
                    </div>

                    <div className="input-group">
                      <label style={{ display: "block", marginBottom: "6px", fontWeight: "600", fontSize: "0.85rem" }}>Subject Line</label>
                      <input
                        type="text"
                        required
                        placeholder="Subject Line (can contain placeholders like {{name}})"
                        value={templateForm.subject}
                        onChange={e => setTemplateForm({ ...templateForm, subject: e.target.value })}
                        style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                      />
                    </div>

                    <div className="input-group">
                      <label style={{ display: "block", marginBottom: "6px", fontWeight: "600", fontSize: "0.85rem" }}>Body Content (Rich Text / HTML Formatting)</label>
                      <RichTextEditor
                        placeholder="Template Body. Use placeholders like {{name}}, {{otp}} to render inputs when sending."
                        value={templateForm.body}
                        onChange={html => setTemplateForm({ ...templateForm, body: html })}
                      />
                    </div>
                  </form>

                  {/* HTML Live Preview Side */}
                  <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                      <Eye size={16} color="#64748b" />
                      <span style={{ fontWeight: "700", color: "#475569", fontSize: "0.85rem" }}>Visual HTML Preview</span>
                    </div>
                    <div style={{
                      flex: 1,
                      border: "1px solid #cbd5e1",
                      borderRadius: "8px",
                      background: "white",
                      padding: "16px",
                      overflowY: "auto",
                      minHeight: "250px",
                      boxShadow: "inset 0 2px 4px rgba(0,0,0,0.02)"
                    }}>
                      {templateForm.body ? (
                        <div dangerouslySetInnerHTML={{ __html: templateForm.body }} />
                      ) : (
                        <span style={{ color: "#94a3b8", fontStyle: "italic", fontSize: "0.9rem" }}>No content to preview yet. Start typing HTML tags.</span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "10px", marginTop: "1rem", borderTop: "1px solid #e2e8f0", paddingTop: "1rem" }}>
                  <button
                    type="button"
                    onClick={() => setShowTemplateModal(false)}
                    style={{
                      flex: 1,
                      padding: "12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      background: "none",
                      cursor: "pointer",
                      fontWeight: "600"
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveTemplate}
                    disabled={loading || !templateForm.name || !templateForm.subject || !templateForm.body}
                    style={{
                      flex: 2,
                      padding: "12px",
                      borderRadius: "8px",
                      background: "var(--accent-primary, #00a884)",
                      color: "white",
                      border: "none",
                      fontWeight: "700",
                      cursor: "pointer"
                    }}
                  >
                    {loading ? "Saving..." : (templateForm.id ? "Update Template" : "Save Template")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab Panel 3: SMTP CONFIGURATION (Dynamic Card list and popup modal) */}
      {activeTab === "settings" && (
        <div style={{
          background: "white",
          borderRadius: "20px",
          padding: "2rem",
          boxShadow: "0 10px 30px rgba(0,0,0,0.03)",
          border: "1px solid #f1f5f9"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
            <div>
              <h3 style={{ fontSize: "1.25rem", color: "#1e293b", fontWeight: "700", marginBottom: "0.25rem" }}>SMTP Dispatch Profiles</h3>
              <p style={{ color: "#64748b", fontSize: "0.9rem" }}>Configure multiple Gmail or Custom SMTP servers for sending emails</p>
            </div>
            <button
              onClick={() => { resetSmtpForm(); setShowSmtpModal(true); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "var(--accent-primary, #00a884)",
                color: "white",
                border: "none",
                padding: "10px 18px",
                borderRadius: "10px",
                fontWeight: "700",
                cursor: "pointer",
                transition: "0.2s"
              }}
            >
              <Plus size={18} /> Add SMTP Profile
            </button>
          </div>

          {smtpSettings.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem", background: "#f8fafc", borderRadius: "16px", color: "#64748b" }}>
              <Server size={48} style={{ margin: "0 auto 1rem", opacity: 0.5 }} />
              <p style={{ fontWeight: "600", fontSize: "1.1rem" }}>No SMTP Profiles Configured</p>
              <p style={{ fontSize: "0.9rem", color: "#94a3b8" }}>Create your custom email sender profiles to start sending emails.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.5rem" }}>
              {smtpSettings.map(profile => (
                <div
                  key={profile._id}
                  style={{
                    background: "white",
                    borderRadius: "16px",
                    padding: "1.5rem",
                    border: sendForm.smtpProfileId === profile._id ? "2px solid #00a884" : "1px solid #e2e8f0",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
                    position: "relative"
                  }}
                >
                  {sendForm.smtpProfileId === profile._id && (
                    <div style={{ position: "absolute", top: "1.2rem", right: "1.2rem", color: "#00a884", background: "rgba(0,168,132,0.1)", borderRadius: "50%", padding: "4px" }}>
                      <Check size={16} strokeWidth={3} />
                    </div>
                  )}

                  <h4 style={{ fontSize: "1.15rem", fontWeight: "700", color: "#1e293b", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "8px" }}>
                    <Server size={18} color="#00a884" /> {profile.name}
                  </h4>

                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.85rem", color: "#64748b", marginBottom: "1.25rem" }}>
                    <div><strong>Type:</strong> <span style={{ textTransform: "capitalize" }}>{profile.type === "gmail" ? "Gmail SMTP" : "Official SMTP"}</span></div>
                    {profile.type === "official" && <div><strong>Host:</strong> {profile.host}</div>}
                    <div><strong>Port:</strong> {profile.port} {profile.secure ? "(SSL)" : ""}</div>
                    <div><strong>Username:</strong> {profile.user}</div>
                    <div><strong>Sender Name:</strong> {profile.senderName}</div>
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => setSendForm(prev => ({ ...prev, smtpProfileId: profile._id }))}
                      disabled={sendForm.smtpProfileId === profile._id}
                      style={{
                        flex: 1.5,
                        padding: "8px",
                        borderRadius: "8px",
                        border: "1px solid #00a884",
                        background: sendForm.smtpProfileId === profile._id ? "#f0fdf4" : "white",
                        color: "#00a884",
                        fontWeight: "700",
                        fontSize: "0.85rem",
                        cursor: "pointer"
                      }}
                    >
                      {sendForm.smtpProfileId === profile._id ? "Active Profile" : "Set Active"}
                    </button>
                    <button
                      onClick={() => handleEditSmtp(profile)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        background: "#f8fafc",
                        color: "#475569",
                        cursor: "pointer"
                      }}
                      title="Edit Profile"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteSmtp(profile._id)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid #fee2e2",
                        background: "#fef2f2",
                        color: "#ef4444",
                        cursor: "pointer"
                      }}
                      title="Delete Profile"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add / Edit SMTP Modal Popup */}
          {showSmtpModal && (
            <div style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.4)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999
            }}>
              <div style={{
                background: "white",
                padding: "2rem",
                borderRadius: "20px",
                width: "90%",
                maxWidth: "600px",
                boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
                display: "flex",
                flexDirection: "column",
                maxHeight: "90vh",
                overflowY: "auto"
              }}>
                <h3 style={{ fontSize: "1.3rem", fontWeight: "800", color: "#1e293b", marginBottom: "1.5rem" }}>
                  {editingSmtpId ? "Edit SMTP Profile" : "Add SMTP Profile"}
                </h3>

                {/* Subtabs for Gmail vs Official inside Modal */}
                <div style={{ display: "flex", gap: "10px", borderBottom: "1px solid #e2e8f0", paddingBottom: "12px", marginBottom: "1.5rem" }}>
                  <button
                    type="button"
                    onClick={() => handleSmtpTypeChangeInForm("official")}
                    style={{
                      padding: "6px 12px",
                      border: "none",
                      background: "transparent",
                      color: smtpForm.type === "official" ? "var(--accent-primary, #00a884)" : "#64748b",
                      fontWeight: "700",
                      fontSize: "0.9rem",
                      borderBottom: smtpForm.type === "official" ? "2px solid var(--accent-primary, #00a884)" : "none",
                      cursor: "pointer"
                    }}
                  >
                    Official / Custom SMTP
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSmtpTypeChangeInForm("gmail")}
                    style={{
                      padding: "6px 12px",
                      border: "none",
                      background: "transparent",
                      color: smtpForm.type === "gmail" ? "var(--accent-primary, #00a884)" : "#64748b",
                      fontWeight: "700",
                      fontSize: "0.9rem",
                      borderBottom: smtpForm.type === "gmail" ? "2px solid var(--accent-primary, #00a884)" : "none",
                      cursor: "pointer"
                    }}
                  >
                    Gmail SMTP
                  </button>
                </div>

                {/* Test Connection Result message */}
                {testResult.message && (
                  <div style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    marginBottom: "1rem",
                    fontSize: "0.85rem",
                    fontWeight: "600",
                    background: testResult.status === "success" ? "#e6fcf5" : testResult.status === "testing" ? "#f1f5f9" : "#fff5f5",
                    color: testResult.status === "success" ? "#0ca678" : testResult.status === "testing" ? "#475569" : "#f03e3e"
                  }}>
                    {testResult.message}
                  </div>
                )}

                <form onSubmit={handleSaveSettings} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div className="input-group">
                    <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", fontSize: "0.85rem" }}>Profile Display Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Brevo Official, Support Team"
                      value={smtpForm.name}
                      onChange={e => setSmtpForm({ ...smtpForm, name: e.target.value })}
                      style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                    />
                  </div>

                  {smtpForm.type === "gmail" && (
                    <div style={{ background: "#f8fafc", padding: "10px 12px", borderRadius: "8px", fontSize: "0.8rem", color: "#64748b", display: "flex", gap: "8px" }}>
                      <Info size={16} color="#3b82f6" style={{ flexShrink: 0 }} />
                      <span>Gmail requires a <strong>Google App Password</strong> (16 digit code) instead of your standard account password.</span>
                    </div>
                  )}

                  {smtpForm.type === "official" && (
                    <>
                      <div className="input-group">
                        <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", fontSize: "0.85rem" }}>SMTP Host URL</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. smtp-relay.brevo.com"
                          value={smtpForm.host}
                          onChange={e => setSmtpForm({ ...smtpForm, host: e.target.value })}
                          style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                        />
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                        <div className="input-group">
                          <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", fontSize: "0.85rem" }}>SMTP Port</label>
                          <input
                            type="number"
                            required
                            placeholder="587 or 465"
                            value={smtpForm.port}
                            onChange={e => setSmtpForm({ ...smtpForm, port: parseInt(e.target.value) || 587 })}
                            style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                          />
                        </div>
                        <div className="input-group" style={{ display: "flex", alignItems: "center", marginTop: "1.8rem" }}>
                          <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontWeight: "600", fontSize: "0.8rem" }}>
                            <input
                              type="checkbox"
                              checked={smtpForm.secure}
                              onChange={e => setSmtpForm({ ...smtpForm, secure: e.target.checked })}
                            />
                            Use SSL/TLS (Port 465)
                          </label>
                        </div>
                      </div>
                    </>
                  )}

                  {/* IMAP Incoming Config */}
                  <div style={{ marginTop: "0.5rem", borderTop: "1px dashed #cbd5e1", paddingTop: "0.75rem", paddingBottom: "0.5rem" }}>
                    <h5 style={{ margin: "0 0 10px 0", fontSize: "0.9rem", color: "#1e293b", fontWeight: "700" }}>Inbound Mail Settings (IMAP)</h5>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                      <div className="input-group">
                        <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", fontSize: "0.85rem" }}>IMAP Host</label>
                        <input
                          type="text"
                          required
                          placeholder={smtpForm.type === "gmail" ? "imap.gmail.com" : "e.g. imap.yourdomain.com"}
                          value={smtpForm.imapHost}
                          onChange={e => setSmtpForm({ ...smtpForm, imapHost: e.target.value })}
                          style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                        />
                      </div>
                      <div className="input-group">
                        <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", fontSize: "0.85rem" }}>IMAP Port</label>
                        <input
                          type="number"
                          required
                          placeholder="993"
                          value={smtpForm.imapPort}
                          onChange={e => setSmtpForm({ ...smtpForm, imapPort: parseInt(e.target.value) || 993 })}
                          style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                        />
                      </div>
                    </div>
                    <div className="input-group" style={{ marginTop: "10px" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontWeight: "600", fontSize: "0.8rem" }}>
                        <input
                          type="checkbox"
                          checked={smtpForm.imapSecure}
                          onChange={e => setSmtpForm({ ...smtpForm, imapSecure: e.target.checked })}
                        />
                        Use IMAP SSL/TLS (Recommended: Port 993)
                      </label>
                    </div>
                  </div>

                  <div className="input-group">
                    <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", fontSize: "0.85rem" }}>Username / Email ID</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. sender@yourdomain.com"
                      value={smtpForm.user}
                      onChange={e => setSmtpForm({ ...smtpForm, user: e.target.value })}
                      style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                    />
                  </div>

                  <div className="input-group">
                    <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", fontSize: "0.85rem" }}>Password / API Key</label>
                    <input
                      type="password"
                      required
                      placeholder="Enter SMTP password"
                      value={smtpForm.pass}
                      onChange={e => setSmtpForm({ ...smtpForm, pass: e.target.value })}
                      style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                    />
                  </div>

                  <div className="input-group">
                    <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", fontSize: "0.85rem" }}>Sender Display Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Sales Team"
                      value={smtpForm.senderName}
                      onChange={e => setSmtpForm({ ...smtpForm, senderName: e.target.value })}
                      style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                    />
                  </div>

                  <div className="input-group">
                    <label style={{ display: "block", marginBottom: "4px", fontWeight: "600", fontSize: "0.85rem" }}>Sender Email Address (Optional)</label>
                    <input
                      type="email"
                      placeholder="Leave blank to use Username"
                      value={smtpForm.senderEmail}
                      onChange={e => setSmtpForm({ ...smtpForm, senderEmail: e.target.value })}
                      style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                    />
                  </div>

                  <div style={{ display: "flex", gap: "10px", marginTop: "1rem" }}>
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={loading || !smtpForm.user || !smtpForm.pass}
                      style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "white", color: "#475569", fontWeight: "600", cursor: "pointer" }}
                    >
                      Test Connection
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowSmtpModal(false); resetSmtpForm(); }}
                      style={{ padding: "12px 18px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "none", cursor: "pointer" }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !smtpForm.name || !smtpForm.user || !smtpForm.pass}
                      style={{ flex: 2, padding: "12px", borderRadius: "8px", background: "var(--accent-primary, #00a884)", color: "white", border: "none", fontWeight: "700", cursor: "pointer" }}
                    >
                      {loading ? "Saving..." : "Save Profile"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab Panel 4: EMAIL HISTORY / LOGS */}
      {activeTab === "history" && (
        <div style={{
          background: "white",
          borderRadius: "20px",
          padding: "2rem",
          boxShadow: "0 10px 30px rgba(0,0,0,0.03)",
          border: "1px solid #f1f5f9"
        }}>
          <h3 style={{ fontSize: "1.25rem", color: "#1e293b", marginBottom: "1.5rem", fontWeight: "700" }}>Outbound Email History</h3>

          {logs.length === 0 ? (
            <div style={{
              textAlign: "center",
              padding: "3rem",
              background: "#f8fafc",
              borderRadius: "16px",
              color: "#64748b"
            }}>
              <History size={48} style={{ margin: "0 auto 1rem", opacity: 0.5 }} />
              <p style={{ fontWeight: "600", fontSize: "1.1rem" }}>No email history found</p>
              <p style={{ fontSize: "0.9rem", color: "#94a3b8" }}>Emails sent through this dashboard will be tracked here.</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e2e8f0", color: "#475569", fontSize: "0.85rem", fontWeight: "700" }}>
                    <th style={{ padding: "12px" }}>Sent To</th>
                    <th style={{ padding: "12px" }}>Subject</th>
                    <th style={{ padding: "12px" }}>SMTP Profile</th>
                    <th style={{ padding: "12px" }}>Attachments</th>
                    <th style={{ padding: "12px" }}>Status</th>
                    <th style={{ padding: "12px" }}>Sent At</th>
                    <th style={{ padding: "12px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log._id} style={{ borderBottom: "1px solid #edf2f7", fontSize: "0.9rem", color: "#1e293b" }}>
                      <td style={{ padding: "12px", fontWeight: "600" }}>{log.to}</td>
                      <td style={{ padding: "12px", maxWidth: "250px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.subject}</td>
                      <td style={{ padding: "12px", fontWeight: "600", color: "#00a884" }}>{log.smtpProfileName}</td>
                      <td style={{ padding: "12px", fontSize: "0.8rem", color: "#64748b" }}>
                        {log.attachments && log.attachments.length > 0 ? (
                          <span style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px" }}>
                            📎 {log.attachments.length} files
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td style={{ padding: "12px" }}>
                        <span style={{
                          padding: "4px 8px",
                          borderRadius: "20px",
                          fontSize: "0.75rem",
                          fontWeight: "700",
                          background: log.status === "success" ? "#e6fcf5" : "#fff5f5",
                          color: log.status === "success" ? "#0ca678" : "#f03e3e"
                        }}>
                          {log.status}
                        </span>
                        {log.errorMessage && (
                          <div style={{ fontSize: "0.75rem", color: "#f03e3e", marginTop: "4px", maxWidth: "200px" }} title={log.errorMessage}>
                            Error: {log.errorMessage.substring(0, 50)}...
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "12px", color: "#64748b" }}>
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td style={{ padding: "12px" }}>
                        <button
                          onClick={() => { setSelectedLog(log); setShowLogModal(true); }}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "6px",
                            border: "1px solid #cbd5e1",
                            background: "white",
                            color: "#475569",
                            fontSize: "0.8rem",
                            fontWeight: "600",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px"
                          }}
                        >
                          <Eye size={12} /> View Body
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* View Log Body Modal */}
          {showLogModal && selectedLog && (
            <div style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.4)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999
            }}>
              <div style={{
                background: "white",
                padding: "2rem",
                borderRadius: "20px",
                width: "90%",
                maxWidth: "700px",
                boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
                display: "flex",
                flexDirection: "column",
                maxHeight: "85vh"
              }}>
                <h3 style={{ fontSize: "1.2rem", fontWeight: "800", color: "#1e293b", marginBottom: "1rem" }}>
                  Sent Email Content Details
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.85rem", color: "#475569", borderBottom: "1px solid #e2e8f0", paddingBottom: "12px", marginBottom: "1rem" }}>
                  <div><strong>To:</strong> {selectedLog.to}</div>
                  <div><strong>Subject:</strong> {selectedLog.subject}</div>
                  <div><strong>SMTP Profile:</strong> {selectedLog.smtpProfileName}</div>
                  <div><strong>Sent At:</strong> {new Date(selectedLog.createdAt).toLocaleString()}</div>
                  {selectedLog.attachments && selectedLog.attachments.length > 0 && (
                    <div style={{ marginTop: "4px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
                      <strong>Attached Files:</strong>
                      {selectedLog.attachments.map((file, idx) => (
                        <span key={idx} style={{ background: "#e2e8f0", padding: "2px 6px", borderRadius: "4px", fontSize: "0.75rem" }}>📎 {file}</span>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ flex: 1, overflowY: "auto", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "16px", background: "#f8fafc" }}>
                  <div dangerouslySetInnerHTML={{ __html: selectedLog.body }} />
                </div>

                <button
                  onClick={() => { setShowLogModal(false); setSelectedLog(null); }}
                  style={{
                    marginTop: "1.5rem",
                    padding: "10px 20px",
                    borderRadius: "8px",
                    background: "var(--accent-primary, #00a884)",
                    color: "white",
                    border: "none",
                    fontWeight: "700",
                    cursor: "pointer",
                    alignSelf: "flex-end"
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EmailManager;
