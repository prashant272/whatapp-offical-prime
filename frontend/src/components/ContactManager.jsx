import React, { useState, useEffect, useMemo, useCallback, memo } from "react";
import * as XLSX from 'xlsx';
import api from "../api";
import { Search, UserPlus, Filter, Download, Trash2, ChevronLeft, ChevronRight, Loader2, Layers, ExternalLink, Upload, FileSpreadsheet, User, Smartphone, History, Clock, Calendar, Pencil, Send } from "lucide-react";
import { useWhatsAppAccount } from "../WhatsAppAccountContext";
import { Link, useNavigate } from "react-router-dom";
import ImportMapperModal from "./ContactManager/ImportMapperModal";


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
  const [showAllAccounts, setShowAllAccounts] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showMapper, setShowMapper] = useState(false);
  const [tempImportData, setTempImportData] = useState([]);
  const [importData, setImportData] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importTag, setImportTag] = useState(`Campaign_${new Date().toLocaleDateString().replace(/\//g, '_')}`);
  const [importSector, setImportSector] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(100);
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
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      setTempImportData(data);
      setShowImportModal(false);
      setShowMapper(true);
    };
    reader.readAsBinaryString(file);
  };

  const handleMappingComplete = async (processedContacts) => {
    setImporting(true);
    try {
      await api.post("/contacts/import", { 
        contacts: processedContacts, 
        whatsappAccountId: showAllAccounts ? null : activeAccount?._id 
      });
      alert(`Successfully imported ${processedContacts.length} contacts!`);
      setShowMapper(false);
      fetchContacts(1);
    } catch (err) {
      console.error("Import error:", err);
      alert("Import failed. Please check the data format.");
    } finally {
      setImporting(false);
    }
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
    <div className="contact-manager" style={{ height: "100%", display: "flex", flexDirection: "column", background: "#f8f9fa", padding: "1.5rem" }}>
      {/* Header Section */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", background: "white", padding: "1.5rem", borderRadius: "15px", boxShadow: "0 4px 20px rgba(0,0,0,0.05)", border: "1px solid #eef2f6" }}>
        <div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: "900", color: "#1a1a1a", margin: 0, letterSpacing: "-0.5px" }}>Contact Directory</h2>
          <p style={{ color: "#666", fontSize: "0.9rem", margin: "5px 0 0", fontWeight: "600" }}>Manage <span style={{ color: "#2ecc71" }}>{total.toLocaleString()}</span> leads across all connected channels</p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <button 
            onClick={() => setShowAllAccounts(!showAllAccounts)} 
            style={{ padding: "10px 18px", borderRadius: "10px", border: "2px solid #eee", background: showAllAccounts ? "#e7fce3" : "white", fontSize: "0.85rem", color: showAllAccounts ? "#008069" : "#1a1a1a", fontWeight: "800", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", transition: "0.2s" }}
          >
            <Layers size={16} /> {showAllAccounts ? "All Accounts View" : "Filtered Account"}
          </button>
          <button 
            onClick={() => setShowImportModal(true)} 
            style={{ padding: "10px 18px", borderRadius: "10px", border: "2px solid #2ecc71", color: "#2ecc71", background: "white", fontSize: "0.85rem", fontWeight: "800", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
          >
            <Upload size={16} /> Import
          </button>
          {selectedContactIds.size > 0 && (
            <button 
              onClick={handleSendCampaign} 
              style={{ padding: "10px 22px", borderRadius: "10px", background: "#2ecc71", color: "white", border: "none", fontSize: "0.85rem", fontWeight: "900", cursor: "pointer", boxShadow: "0 6px 15px rgba(46, 204, 113, 0.3)", display: "flex", alignItems: "center", gap: "8px" }}
            >
              <Send size={16} /> Campaign ({isUniversalSelect ? total.toLocaleString() : selectedContactIds.size.toLocaleString()})
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: "20px", flex: 1, minHeight: 0 }}>
        {/* Main Content Area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {/* Filter Bar */}
          <div style={{ padding: "12px 20px", marginBottom: "1rem", display: "flex", gap: "12px", alignItems: "center", background: "white", borderRadius: "12px", border: "1px solid #eef2f6", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
            <form onSubmit={handleSearch} style={{ flex: 1, position: "relative" }}>
              <Search size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#999" }} />
              <input 
                type="text" 
                placeholder="Search by name or phone..." 
                style={{ width: "100%", padding: "10px 12px 10px 40px", borderRadius: "10px", border: "2px solid #f0f0f0", fontSize: "0.9rem", fontWeight: "600", outline: "none", color: "#1a1a1a" }} 
                value={filters.search} 
                onChange={e => setFilters({ ...filters, search: e.target.value })} 
              />
            </form>
            <select 
              style={{ padding: "10px", borderRadius: "10px", border: "2px solid #f0f0f0", fontSize: "0.85rem", fontWeight: "700", color: "#444", background: "#fff", cursor: "pointer" }} 
              value={filters.status} 
              onChange={e => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">All Statuses</option>
              {customStatuses.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
            </select>
            <button onClick={handleSearch} style={{ background: "#1a1a1a", color: "white", padding: "10px 20px", borderRadius: "10px", border: "none", fontWeight: "800", fontSize: "0.85rem", cursor: "pointer" }}>Apply</button>
          </div>

          {/* Contacts Table */}
          <div style={{ background: "white", borderRadius: "15px", border: "1px solid #eef2f6", display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
            <div className="chat-scroll" style={{ flex: 1, overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", minWidth: "1100px" }}>
                <thead style={{ background: "#f8fafc", borderBottom: "2px solid #f0f0f0", position: "sticky", top: 0, zIndex: 10 }}>
                  {isAllSelectedOnPage && total > contacts.length && (
                    <tr>
                      <th colSpan={12} style={{ background: "#e7fce3", padding: "10px", textAlign: "center", borderBottom: "1px solid #dcfce7" }}>
                        {isUniversalSelect ? (
                          <span style={{ fontSize: "0.8rem", color: "#008069", fontWeight: "800" }}>
                            ✅ ALL {total.toLocaleString()} CONTACTS SELECTED. <button onClick={() => { setIsUniversalSelect(false); setSelectedContactIds(new Set()); }} style={{ color: "#e74c3c", border: "none", background: "none", cursor: "pointer", textDecoration: "underline", fontWeight: "800", marginLeft: "10px" }}>Clear All</button>
                          </span>
                        ) : (
                          <span style={{ fontSize: "0.8rem", color: "#475569", fontWeight: "700" }}>
                            All {contacts.length} on this page selected. <button onClick={() => setIsUniversalSelect(true)} style={{ color: "#2ecc71", border: "none", background: "none", cursor: "pointer", textDecoration: "underline", fontWeight: "900", marginLeft: "10px" }}>Select all {total.toLocaleString()} leads</button>
                          </span>
                        )}
                      </th>
                    </tr>
                  )}
                  <tr style={{ color: "#666", fontSize: "0.75rem", fontWeight: "900", textTransform: "uppercase", letterSpacing: "1px" }}>
                    <th style={{ padding: "15px 24px", width: "50px" }}><input type="checkbox" checked={isAllSelectedOnPage} onChange={handleSelectAllOnPage} style={{ transform: "scale(1.2)" }} /></th>
                    <th style={{ padding: "15px 12px", textAlign: "left" }}>Lead Info</th>
                    <th style={{ padding: "15px 24px", textAlign: "left" }}>Channel</th>
                    <th style={{ padding: "15px 24px", textAlign: "left" }}>Sector</th>
                    <th style={{ padding: "15px 24px", textAlign: "left" }}>Status</th>
                    <th style={{ padding: "15px 24px", textAlign: "left" }}>Mark</th>
                    <th style={{ padding: "15px 24px", textAlign: "left" }}>Tags</th>
                    {customFields.map(f => <th key={f._id} style={{ padding: "15px 24px", textAlign: "left" }}>{f.label}</th>)}
                    <th style={{ padding: "15px 24px", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={12} style={{ textAlign: "center", padding: "60px" }}><div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}><Loader2 className="animate-spin" size={40} color="#2ecc71" /><p style={{ fontWeight: "700", color: "#666" }}>Loading leads...</p></div></td></tr>
                  ) : contacts.length === 0 ? (
                    <tr><td colSpan={12} style={{ textAlign: "center", padding: "60px", color: "#999" }}><p style={{ fontSize: "1.1rem", fontWeight: "700" }}>No matching leads found.</p></td></tr>
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

            {/* Premium Pagination */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 25px", background: "#fdfdfd", borderTop: "2px solid #f0f0f0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "0.85rem", color: "#666", fontWeight: "700" }}>Items per page:</span>
                <select 
                  value={limit} 
                  onChange={e => { setLimit(Number(e.target.value)); setPage(1); }} 
                  style={{ padding: "6px 12px", borderRadius: "8px", border: "2px solid #eee", fontSize: "0.85rem", fontWeight: "800", color: "#1a1a1a", cursor: "pointer" }}
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={500}>500</option>
                  <option value={1000}>1000</option>
                </select>
                <span style={{ fontSize: "0.85rem", color: "#999", fontWeight: "600", marginLeft: "15px" }}>
                  Showing {((page - 1) * limit) + 1} - {Math.min(page * limit, total)} of {total.toLocaleString()}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button 
                  disabled={page === 1} 
                  onClick={() => setPage(1)} 
                  style={{ padding: "8px 12px", borderRadius: "8px", border: "2px solid #eee", background: "white", cursor: page === 1 ? "not-allowed" : "pointer", color: page === 1 ? "#ccc" : "#1a1a1a" }}
                  title="First Page"
                >
                  <ChevronLeft size={16} strokeWidth={3} /><ChevronLeft size={16} strokeWidth={3} style={{ marginLeft: "-10px" }} />
                </button>
                <button 
                  disabled={page === 1} 
                  onClick={() => setPage(p => p - 1)} 
                  style={{ padding: "8px 14px", borderRadius: "8px", border: "2px solid #eee", background: "white", cursor: page === 1 ? "not-allowed" : "pointer", color: page === 1 ? "#ccc" : "#1a1a1a", fontWeight: "800", display: "flex", alignItems: "center", gap: "5px" }}
                >
                  <ChevronLeft size={16} strokeWidth={3} /> Prev
                </button>
                
                <div style={{ display: "flex", gap: "5px", margin: "0 10px" }}>
                  {[...Array(Math.min(5, Math.ceil(total / limit)))].map((_, i) => {
                    let pageNum;
                    const totalPages = Math.ceil(total / limit);
                    if (totalPages <= 5) pageNum = i + 1;
                    else if (page <= 3) pageNum = i + 1;
                    else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = page - 2 + i;

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        style={{
                          width: "35px", height: "35px", borderRadius: "8px", border: "2px solid",
                          borderColor: page === pageNum ? "#2ecc71" : "#eee",
                          background: page === pageNum ? "#2ecc71" : "white",
                          color: page === pageNum ? "white" : "#1a1a1a",
                          fontWeight: "900", cursor: "pointer", fontSize: "0.85rem"
                        }}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button 
                  disabled={page >= Math.ceil(total / limit)} 
                  onClick={() => setPage(p => p + 1)} 
                  style={{ padding: "8px 14px", borderRadius: "8px", border: "2px solid #eee", background: "white", cursor: page >= Math.ceil(total / limit) ? "not-allowed" : "pointer", color: page >= Math.ceil(total / limit) ? "#ccc" : "#1a1a1a", fontWeight: "800", display: "flex", alignItems: "center", gap: "5px" }}
                >
                  Next <ChevronRight size={16} strokeWidth={3} />
                </button>
                <button 
                  disabled={page >= Math.ceil(total / limit)} 
                  onClick={() => setPage(Math.ceil(total / limit))} 
                  style={{ padding: "8px 12px", borderRadius: "8px", border: "2px solid #eee", background: "white", cursor: page >= Math.ceil(total / limit) ? "not-allowed" : "pointer", color: page >= Math.ceil(total / limit) ? "#ccc" : "#1a1a1a" }}
                  title="Last Page"
                >
                  <ChevronRight size={16} strokeWidth={3} /><ChevronRight size={16} strokeWidth={3} style={{ marginLeft: "-10px" }} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar - Quick Filters */}
        <div style={{ width: "240px", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ background: "white", borderRadius: "15px", padding: "1.5rem", border: "1px solid #eef2f6", boxShadow: "0 4px 15px rgba(0,0,0,0.03)", flex: 1, display: "flex", flexDirection: "column" }}>
            <h4 style={{ fontSize: "0.9rem", fontWeight: "900", color: "#1a1a1a", marginBottom: "1.2rem", display: "flex", alignItems: "center", gap: "8px", textTransform: "uppercase", letterSpacing: "1px" }}>
              <Layers size={18} color="#2ecc71" /> Sectors
            </h4>
            <div className="chat-scroll" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
              <button 
                onClick={() => setFilters({ ...filters, sector: "" })} 
                style={{ width: "100%", textAlign: "left", padding: "10px 15px", borderRadius: "10px", border: "none", background: filters.sector === "" ? "#1a1a1a" : "#f8fafc", color: filters.sector === "" ? "white" : "#444", fontSize: "0.85rem", fontWeight: "800", cursor: "pointer", transition: "0.2s" }}
              >
                Show All Leads
              </button>
              {sectors.map(s => (
                <button 
                  key={s._id} 
                  onClick={() => setFilters({ ...filters, sector: s.name })} 
                  style={{ width: "100%", textAlign: "left", padding: "10px 15px", borderRadius: "10px", border: "2px solid", borderColor: filters.sector === s.name ? "#2ecc71" : "#f0f0f0", background: filters.sector === s.name ? "#e7fce3" : "white", color: filters.sector === s.name ? "#008069" : "#666", fontSize: "0.85rem", fontWeight: "700", cursor: "pointer", transition: "0.2s" }}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modals & Overlays */}
      {showImportModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 5000, backdropFilter: "blur(4px)" }}>
          <div style={{ width: "550px", padding: "2.5rem", background: "white", borderRadius: "20px", boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}>
            <h3 style={{ marginBottom: "0.5rem", fontWeight: "900", fontSize: "1.5rem" }}>Import Contacts</h3>
            <p style={{ color: "#666", marginBottom: "2rem", fontWeight: "600" }}>Upload your Excel or CSV file to populate leads.</p>
            <div 
              style={{ border: "3px dashed #eef2f6", padding: "40px", textAlign: "center", borderRadius: "15px", cursor: "pointer", background: "#f8fafc", transition: "0.2s" }} 
              onClick={() => document.getElementById('import-file').click()}
              onMouseOver={e => e.currentTarget.style.borderColor = "#2ecc71"}
              onMouseOut={e => e.currentTarget.style.borderColor = "#eef2f6"}
            >
              <div style={{ width: "60px", height: "60px", background: "rgba(46, 204, 113, 0.1)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 15px" }}>
                <Upload size={30} color="#2ecc71" />
              </div>
              <p style={{ fontSize: "1rem", fontWeight: "800", color: "#1a1a1a" }}>Click to select Excel/CSV file</p>
              <p style={{ fontSize: "0.8rem", color: "#999", marginTop: "5px" }}>Supports .xlsx, .xls, .csv</p>
              <input id="import-file" type="file" accept=".xlsx, .xls, .csv" hidden onChange={handleFileUpload} />
            </div>
            <div style={{ display: "flex", gap: "15px", marginTop: "2.5rem" }}>
              <button onClick={() => setShowImportModal(false)} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "2px solid #eee", background: "white", fontWeight: "800", cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Import Mapper Modal */}
      <ImportMapperModal 
        isOpen={showMapper}
        onClose={() => setShowMapper(false)}
        rawData={tempImportData}
        onComplete={handleMappingComplete}
        customFields={customFields}
        sectors={sectors}
      />


      {/* Contact History Drawer (Side Panel) */}
      {showTimelineDrawer && (
        <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, background: "rgba(0,0,0,0.4)", zIndex: 6000, display: "flex", justifyContent: "flex-end", backdropFilter: "blur(2px)" }} onClick={() => setShowTimelineDrawer(false)}>
          <div style={{ width: "450px", background: "white", height: "100%", display: "flex", flexDirection: "column", boxShadow: "-10px 0 30px rgba(0,0,0,0.1)", animation: "slideInRight 0.3s ease-out" }} onClick={e => e.stopPropagation()}>
            <div style={{ background: "#1a1a1a", color: "white", padding: "2.5rem 2rem", position: "relative" }}>
              <div onClick={() => setShowTimelineDrawer(false)} style={{ position: "absolute", top: "20px", left: "20px", cursor: "pointer", opacity: 0.7 }}><ChevronRight size={24} /></div>
              <div style={{ width: "60px", height: "60px", borderRadius: "15px", background: "#2ecc71", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "15px" }}>
                <User size={30} color="white" />
              </div>
              <h3 style={{ margin: 0, fontSize: "1.4rem", fontWeight: "900" }}>{selectedContact?.name}</h3>
              <p style={{ margin: "5px 0 0", fontSize: "0.95rem", color: "#999", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px" }}><Smartphone size={16} /> {selectedContact?.phone}</p>
            </div>
            
            <div style={{ flex: 1, overflowY: "auto", padding: "2rem" }} className="chat-scroll">
              <h4 style={{ fontSize: "0.85rem", fontWeight: "900", textTransform: "uppercase", color: "#1a1a1a", letterSpacing: "1px", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "10px" }}>
                <History size={18} color="#2ecc71" /> Interaction Timeline
              </h4>
              {loadingTimeline ? (
                <div style={{ textAlign: "center", padding: "40px" }}><Loader2 className="animate-spin" color="#2ecc71" /></div>
              ) : timelineEntries.length === 0 ? (
                <p style={{ textAlign: "center", color: "#999", padding: "40px", fontWeight: "600" }}>No history found for this lead.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  {timelineEntries.map((e, idx) => (
                    <div key={idx} style={{ position: "relative", paddingLeft: "30px", borderLeft: "2px solid #f0f0f0" }}>
                      <div style={{ position: "absolute", left: "-7px", top: "0", width: "12px", height: "12px", borderRadius: "50%", background: "#2ecc71", border: "3px solid white" }}></div>
                      <div style={{ fontSize: "0.9rem", fontWeight: "700", color: "#333" }}>{e.content}</div>
                      <div style={{ fontSize: "0.75rem", color: "#999", marginTop: "4px", fontWeight: "600" }}>{new Date(e.timestamp).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ padding: "1.5rem", borderTop: "1px solid #f0f0f0", display: "flex", gap: "10px" }}>
              <button 
                onClick={() => navigate(selectedContact.conversationId ? `/chats/${selectedContact.conversationId._id || selectedContact.conversationId}` : `/chats/new:${selectedContact.phone}`)}
                style={{ flex: 1, padding: "12px", borderRadius: "10px", background: "#2ecc71", color: "white", border: "none", fontWeight: "900", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
              >
                <Send size={18} /> Open Chat
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
};

export default ContactManager;
