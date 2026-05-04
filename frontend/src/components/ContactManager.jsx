import React, { useState, useEffect, useMemo, useCallback, memo } from "react";
import * as XLSX from 'xlsx';
import api from "../api";
import { Search, UserPlus, Filter, Download, Trash2, ChevronLeft, ChevronRight, Loader2, Layers, ExternalLink, Upload, FileSpreadsheet, User, Smartphone, History, Clock, Calendar, Pencil, Send } from "lucide-react";
import { useWhatsAppAccount } from "../WhatsAppAccountContext";
import { Link, useNavigate } from "react-router-dom";

// Optimized Row Component to prevent full table re-renders
const ContactRow = memo(({ contact, isSelected, toggleSelect, handleContactClick, getStatusColor, customFields, navigate, activeAccount, switchAccount, handleDeleteContact, setEditingContact, setShowEditModal }) => {
  return (
    <tr style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.1s", background: isSelected ? "#f0fdf4" : "transparent" }}>
      <td style={{ padding: "12px 24px" }}>
        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(contact._id)} style={{ cursor: "pointer", transform: "scale(1.1)" }} />
      </td>
      <td style={{ padding: "12px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: "#00a884" }}><User size={16} /></div>
          <div onClick={() => handleContactClick(contact)} style={{ cursor: "pointer" }}>
            <div style={{ fontWeight: "700", color: "#1e293b", fontSize: "0.85rem" }}>{contact.name}</div>
            <div style={{ color: "#94a3b8", display: "flex", alignItems: "center", gap: "4px", fontSize: "0.75rem" }}><Smartphone size={10} /> {contact.phone}</div>
          </div>
        </div>
      </td>
      <td style={{ padding: "12px 24px" }}>
        <div style={{ fontWeight: "700", color: "#00a884", fontSize: "0.75rem" }}>{contact.whatsappAccountId?.name || "Global"}</div>
        <div style={{ color: "#94a3b8", fontSize: "0.7rem" }}>{contact.sourceCampaign || "Lead Database"}</div>
      </td>
      <td style={{ padding: "12px 24px" }}><div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "600", fontSize: "0.8rem" }}><Layers size={14} color="#6366f1" /> {contact.sector || "Unassigned"}</div></td>
      <td style={{ padding: "12px 24px" }}>
        {contact.status && <span style={{ padding: "3px 8px", borderRadius: "12px", fontSize: "0.7rem", fontWeight: "700", background: getStatusColor(contact.status).bg, color: getStatusColor(contact.status).text }}>{contact.status}</span>}
      </td>
      <td style={{ padding: "12px 24px" }}>
        <span style={{ padding: "3px 8px", borderRadius: "12px", fontSize: "0.7rem", fontWeight: "700", background: contact.isCampaignSent ? "#e7fce3" : "#f1f5f9", color: contact.isCampaignSent ? "#008069" : "#64748b" }}>{contact.isCampaignSent ? "SENT" : "NEW"}</span>
      </td>
      <td style={{ padding: "12px 24px" }}><div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>{contact.tags?.slice(0, 2).map((tag, i) => (<span key={i} style={{ background: "#f1f5f9", padding: "1px 6px", borderRadius: "4px", color: "#475569", fontSize: "0.65rem" }}>{tag}</span>))}{contact.tags?.length > 2 && <span style={{ fontSize: "0.65rem", color: "#94a3b8" }}>+{contact.tags.length - 2}</span>}</div></td>
      {customFields.map(field => (<td key={field._id} style={{ padding: "12px 24px", color: "#475569", fontSize: "0.8rem" }}>{contact.customFields?.[field.name] || "-"}</td>))}
      <td style={{ padding: "12px 24px", textAlign: "right" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
          <button onClick={() => navigate(contact.conversationId ? `/chats/${contact.conversationId._id || contact.conversationId}` : `/chats/new:${contact.phone}`)} style={{ background: "transparent", border: "1px solid #00a884", borderRadius: "6px", padding: "4px", color: "#00a884", cursor: "pointer" }}><ExternalLink size={12} /></button>
          <button onClick={() => { setEditingContact({ ...contact }); setShowEditModal(true); }} style={{ background: "transparent", border: "1px solid #6366f1", borderRadius: "6px", padding: "4px", color: "#6366f1", cursor: "pointer" }}><Pencil size={12} /></button>
          <button onClick={() => handleDeleteContact(contact._id)} style={{ background: "transparent", border: "1px solid #ef4444", borderRadius: "6px", padding: "4px", color: "#ef4444", cursor: "pointer" }}><Trash2 size={12} /></button>
        </div>
      </td>
    </tr>
  );
});

const ContactManager = () => {
  const navigate = useNavigate();
  const { activeAccount, switchAccount } = useWhatsAppAccount();
  const [contacts, setContacts] = useState([]);
  const [selectedContactIds, setSelectedContactIds] = useState(new Set());
  const [customFields, setCustomFields] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [customStatuses, setCustomStatuses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAllAccounts, setShowAllAccounts] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importTag, setImportTag] = useState(`Campaign_${new Date().toLocaleDateString().replace(/\//g, '_')}`);
  const [importSector, setImportSector] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(500);
  const [total, setTotal] = useState(0);
  const [isUniversalSelect, setIsUniversalSelect] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [showTimelineDrawer, setShowTimelineDrawer] = useState(false);
  const [timelineEntries, setTimelineEntries] = useState([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [filters, setFilters] = useState({ search: "", status: "", tag: "", sector: "" });

  const fetchContacts = useCallback(async (pageNum) => {
    if (!activeAccount && !showAllAccounts) return;
    setLoading(true);
    try {
      const queryParams = new URLSearchParams(filters);
      queryParams.append("page", pageNum);
      queryParams.append("limit", limit);
      if (showAllAccounts) queryParams.append("showAllAccounts", "true");
      const res = await api.get(`/contacts?${queryParams.toString()}`);
      setContacts(res.data.contacts || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [activeAccount, showAllAccounts, filters, limit]);

  useEffect(() => {
    fetchContacts(page);
  }, [page, limit, activeAccount, showAllAccounts, filters]);

  const handleSelectAllOnPage = (e) => {
    const isChecked = e.target.checked;
    const newSelected = new Set(selectedContactIds);
    if (isChecked) {
      contacts.forEach(c => newSelected.add(c._id));
    } else {
      contacts.forEach(c => newSelected.delete(c._id));
      setIsUniversalSelect(false);
    }
    setSelectedContactIds(newSelected);
  };

  const isAllSelectedOnPage = useMemo(() => {
    return contacts.length > 0 && contacts.every(c => selectedContactIds.has(c._id));
  }, [contacts, selectedContactIds]);

  const fetchFieldsAndSectors = async () => {
    if (!activeAccount) return;
    try {
      const [fieldsRes, sectorsRes, statusRes] = await Promise.all([
        api.get("/custom-fields"),
        api.get("/sectors"),
        api.get("/statuses")
      ]);
      setCustomFields(fieldsRes.data);
      setSectors(sectorsRes.data);
      setCustomStatuses(statusRes.data);
    } catch (err) {
      console.error("Metadata error:", err);
    }
  };

  useEffect(() => {
    fetchFieldsAndSectors();
  }, [activeAccount]);

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    setPage(1);
    fetchContacts(1);
  };

  const getStatusColor = useCallback((status) => {
    const custom = customStatuses.find(s => s.name === status);
    if (custom && custom.color) return { bg: `${custom.color}15`, text: custom.color };
    switch (status) {
      case "Interested": return { bg: "#f0fdf4", text: "#16a34a" };
      case "Pending": return { bg: "#fefce8", text: "#ca8a04" };
      case "No Reply": return { bg: "#fef2f2", text: "#dc2626" };
      default: return { bg: "#f8fafc", text: "#64748b" };
    }
  }, [customStatuses]);

  const toggleSelect = useCallback((id) => {
    setSelectedContactIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setIsUniversalSelect(false);
  }, []);

  const handleSendCampaign = async () => {
    setLoading(true);
    try {
      let selectedPhones = [];
      if (isUniversalSelect) {
        const queryParams = new URLSearchParams(filters);
        queryParams.append("limit", 1000000);
        if (showAllAccounts) queryParams.append("showAllAccounts", "true");
        const res = await api.get(`/contacts?${queryParams.toString()}`);
        selectedPhones = (res.data.contacts || []).map(c => c.phone);
      } else {
        if (selectedContactIds.size === 0) return;
        const res = await api.post("/contacts/bulk-details", { ids: Array.from(selectedContactIds) });
        selectedPhones = (res.data || []).map(c => c.phone);
      }
      if (selectedPhones.length === 0) { alert("No contacts selected!"); return; }
      navigate("/campaigns", { state: { numbers: selectedPhones.join("\n") } });
    } catch (err) {
      console.error("Bulk error:", err);
      alert("Error preparing campaign.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteContact = useCallback(async (id) => {
    if (!window.confirm("Delete this contact?")) return;
    try {
      await api.delete(`/contacts/${id}`);
      fetchContacts(page);
    } catch (err) { alert("Delete failed"); }
  }, [page, fetchContacts]);

  const processImport = async () => {
    if (importData.length === 0) return;
    setImporting(true);
    try {
      const contactsToImport = importData.map(item => ({
        name: item.name || item.Name || "Unknown",
        phone: String(item.phone || item.Phone || "").replace(/[^0-9]/g, ""),
        sector: importSector || item.sector || "Unassigned",
        tags: [importTag],
        customFields: {}
      })).filter(c => c.phone.length >= 10);
      await api.post("/contacts/import", { contacts: contactsToImport, whatsappAccountId: showAllAccounts ? null : activeAccount?._id });
      alert("Imported!");
      setShowImportModal(false);
      fetchContacts(1);
    } catch (err) { alert("Import failed"); } finally { setImporting(false); }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' });
      setImportData(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]));
    };
    reader.readAsBinaryString(file);
  };

  const handleContactClick = useCallback(async (contact) => {
    setSelectedContact(contact);
    setShowTimelineDrawer(true);
    setLoadingTimeline(true);
    try {
      const res = await api.get(`/timeline/${contact._id}`);
      setTimelineEntries(res.data);
    } catch (err) { console.error("Timeline error:", err); } finally { setLoadingTimeline(false); }
  }, []);

  return (
    <div className="contact-manager" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <h3 style={{ fontSize: "1.2rem", fontWeight: "800" }}>All Contacts ({total.toLocaleString()})</h3>
          <p style={{ color: "#64748b", fontSize: "0.75rem" }}>Manage leads across your connected accounts.</p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button onClick={() => setShowAllAccounts(!showAllAccounts)} style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", background: showAllAccounts ? "#f0fdf4" : "white", fontSize: "0.75rem", color: showAllAccounts ? "#16a34a" : "#64748b", fontWeight: "600", cursor: "pointer" }}>
            {showAllAccounts ? "Showing All Accounts" : "Show All Accounts"}
          </button>
          <button onClick={() => setShowImportModal(true)} style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #00a884", color: "#00a884", background: "white", fontSize: "0.75rem", fontWeight: "700", cursor: "pointer" }}>
            <Upload size={14} style={{ marginRight: "6px" }} /> Import
          </button>
          {selectedContactIds.size > 0 && (
            <button onClick={handleSendCampaign} style={{ padding: "8px 16px", borderRadius: "8px", background: "#00a884", color: "white", border: "none", fontSize: "0.75rem", fontWeight: "800", cursor: "pointer", boxShadow: "0 4px 12px rgba(0,168,132,0.2)" }}>
              <Send size={14} style={{ marginRight: "6px" }} /> Campaign ({isUniversalSelect ? total.toLocaleString() : selectedContactIds.size.toLocaleString()})
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: "15px", flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div className="glass-card" style={{ padding: "10px 15px", marginBottom: "1rem", display: "flex", gap: "10px", alignItems: "center" }}>
            <form onSubmit={handleSearch} style={{ flex: 1, position: "relative" }}>
              <Search size={16} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
              <input type="text" placeholder="Search..." style={{ width: "100%", padding: "8px 8px 8px 32px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.8rem" }} value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} />
            </form>
            <select style={{ padding: "8px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.8rem", color: "#64748b" }} value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All Status</option>
              {customStatuses.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
            </select>
            <button onClick={handleSearch} className="btn-primary" style={{ padding: "8px 15px", fontSize: "0.8rem" }}>Apply</button>
          </div>

          <div className="glass-card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ flex: 1, overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", minWidth: "1000px" }}>
                <thead style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, zIndex: 10 }}>
                  {isAllSelectedOnPage && total > contacts.length && (
                    <tr>
                      <th colSpan={10} style={{ background: "#f0fdf4", padding: "8px", textAlign: "center", borderBottom: "1px solid #dcfce7" }}>
                        {isUniversalSelect ? (
                          <span style={{ fontSize: "0.75rem", color: "#16a34a", fontWeight: "600" }}>
                            ✅ All {total.toLocaleString()} selected. <button onClick={() => { setIsUniversalSelect(false); setSelectedContactIds(new Set()); }} style={{ color: "#dc2626", border: "none", background: "none", cursor: "pointer", textDecoration: "underline" }}>Clear</button>
                          </span>
                        ) : (
                          <span style={{ fontSize: "0.75rem", color: "#475569" }}>
                            All {contacts.length} on page selected. <button onClick={() => setIsUniversalSelect(true)} style={{ color: "#00a884", border: "none", background: "none", cursor: "pointer", textDecoration: "underline", fontWeight: "700" }}>Select all {total.toLocaleString()}</button>
                          </span>
                        )}
                      </th>
                    </tr>
                  )}
                  <tr style={{ color: "#94a3b8", fontSize: "0.7rem", fontWeight: "800", textTransform: "uppercase" }}>
                    <th style={{ padding: "12px 24px", width: "40px" }}><input type="checkbox" checked={isAllSelectedOnPage} onChange={handleSelectAllOnPage} /></th>
                    <th style={{ padding: "12px 12px", textAlign: "left" }}>Contact</th>
                    <th style={{ padding: "12px 24px", textAlign: "left" }}>Account</th>
                    <th style={{ padding: "12px 24px", textAlign: "left" }}>Sector</th>
                    <th style={{ padding: "12px 24px", textAlign: "left" }}>Status</th>
                    <th style={{ padding: "12px 24px", textAlign: "left" }}>Mark</th>
                    <th style={{ padding: "12px 24px", textAlign: "left" }}>Tags</th>
                    {customFields.map(f => <th key={f._id} style={{ padding: "12px 24px", textAlign: "left" }}>{f.label}</th>)}
                    <th style={{ padding: "12px 24px", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={10} style={{ textAlign: "center", padding: "40px" }}><Loader2 className="animate-spin" size={32} color="#00a884" /></td></tr>
                  ) : contacts.length === 0 ? (
                    <tr><td colSpan={10} style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>No contacts found.</td></tr>
                  ) : (
                    contacts.map(c => (
                      <ContactRow 
                        key={c._id}
                        contact={c}
                        isSelected={selectedContactIds.has(c._id)}
                        toggleSelect={toggleSelect}
                        handleContactClick={handleContactClick}
                        getStatusColor={getStatusColor}
                        customFields={customFields}
                        navigate={navigate}
                        activeAccount={activeAccount}
                        switchAccount={switchAccount}
                        handleDeleteContact={handleDeleteContact}
                        setEditingContact={setEditingContact}
                        setShowEditModal={setShowEditModal}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px", background: "#f8fafc", borderTop: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Rows:</span>
                <input type="number" value={limit} onChange={e => { setLimit(Number(e.target.value)); setPage(1); }} style={{ width: "60px", padding: "4px 8px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "0.75rem" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Page</span>
                <input type="number" value={page} onChange={e => setPage(Number(e.target.value))} style={{ width: "50px", padding: "4px", borderRadius: "6px", border: "1px solid #e2e8f0", textAlign: "center", fontSize: "0.75rem" }} />
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>of {Math.ceil(total / limit) || 1}</span>
                <div style={{ display: "flex", gap: "4px" }}>
                  <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: "4px", borderRadius: "6px", border: "1px solid #e2e8f0", background: "white" }}><ChevronLeft size={14} /></button>
                  <button disabled={contacts.length < limit} onClick={() => setPage(p => p + 1)} style={{ padding: "4px", borderRadius: "6px", border: "1px solid #e2e8f0", background: "white" }}><ChevronRight size={14} /></button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ width: "220px", display: "flex", flexDirection: "column" }}>
          <div className="glass-card" style={{ padding: "1rem", flex: 1, display: "flex", flexDirection: "column" }}>
            <h4 style={{ fontSize: "0.8rem", fontWeight: "800", color: "#1e293b", marginBottom: "1rem" }}><Layers size={14} color="#00a884" style={{ marginRight: "6px" }} /> Sectors</h4>
            <div className="chat-scroll" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
              <button onClick={() => setFilters({ ...filters, sector: "" })} style={{ width: "100%", textAlign: "left", padding: "8px 12px", borderRadius: "8px", border: "none", background: filters.sector === "" ? "#00a884" : "transparent", color: filters.sector === "" ? "white" : "#475569", fontSize: "0.75rem", fontWeight: "600" }}>All Sectors</button>
              {sectors.map(s => (
                <button key={s._id} onClick={() => setFilters({ ...filters, sector: s.name })} style={{ width: "100%", textAlign: "left", padding: "8px 12px", borderRadius: "8px", border: "none", background: filters.sector === s.name ? "#6366f1" : "transparent", color: filters.sector === s.name ? "white" : "#475569", fontSize: "0.75rem" }}>{s.name}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showImportModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 5000 }}>
          <div className="glass-card" style={{ width: "500px", padding: "2rem" }}>
            <h3 style={{ marginBottom: "1rem" }}>Import Contacts</h3>
            <div style={{ border: "2px dashed #e2e8f0", padding: "30px", textAlign: "center", borderRadius: "10px", cursor: "pointer" }} onClick={() => document.getElementById('import-file').click()}>
              <Upload size={32} color="#00a884" style={{ marginBottom: "10px" }} />
              <p style={{ fontSize: "0.9rem" }}>{importData.length > 0 ? `${importData.length} rows loaded` : "Select Excel/CSV"}</p>
              <input id="import-file" type="file" accept=".xlsx, .xls, .csv" hidden onChange={handleFileUpload} />
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
              <button onClick={() => setShowImportModal(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button disabled={importData.length === 0 || importing} onClick={processImport} className="btn-primary" style={{ flex: 1 }}>{importing ? "Importing..." : "Start Import"}</button>
            </div>
          </div>
        </div>
      )}

      {showTimelineDrawer && (
        <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, background: "rgba(0,0,0,0.3)", zIndex: 6000, display: "flex", justifyContent: "flex-end" }} onClick={() => setShowTimelineDrawer(false)}>
          <div style={{ width: "400px", background: "white", height: "100%", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
            <div style={{ background: "#00a884", color: "white", padding: "20px" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>{selectedContact?.name}</h3>
              <p style={{ margin: 0, fontSize: "0.8rem" }}>{selectedContact?.phone}</p>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "15px" }}>
              {loadingTimeline ? <Loader2 className="animate-spin" /> : timelineEntries.map(e => (
                <div key={e._id} style={{ padding: "10px", borderBottom: "1px solid #f1f5f9" }}>
                  <div style={{ fontSize: "0.8rem" }}>{e.content}</div>
                  <div style={{ fontSize: "0.65rem", color: "#94a3b8" }}>{new Date(e.timestamp).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactManager;
