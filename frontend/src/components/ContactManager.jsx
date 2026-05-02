import React, { useState, useEffect, useRef, useCallback } from "react";
import * as XLSX from 'xlsx';
import api from "../api";
import { Search, UserPlus, Filter, Download, Trash2, ChevronLeft, ChevronRight, Loader2, Layers, ExternalLink, Upload, FileSpreadsheet, User, Smartphone, History, Clock, Calendar, Pencil, Send } from "lucide-react";
import { useWhatsAppAccount } from "../WhatsAppAccountContext";
import { Link, useNavigate } from "react-router-dom";

const ContactManager = () => {
  const navigate = useNavigate();
  const { activeAccount } = useWhatsAppAccount();
  const [contacts, setContacts] = useState([]);
  const [selectedContactIds, setSelectedContactIds] = useState(new Set());
  const [customFields, setCustomFields] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [customStatuses, setCustomStatuses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [showAllAccounts, setShowAllAccounts] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importTag, setImportTag] = useState(`Campaign_${new Date().toLocaleDateString().replace(/\//g, '_')}`);
  const [importSector, setImportSector] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [selectedContact, setSelectedContact] = useState(null);
  const [showTimelineDrawer, setShowTimelineDrawer] = useState(false);
  const [timelineEntries, setTimelineEntries] = useState([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingContact, setEditingContact] = useState(null);

  const [filters, setFilters] = useState({
    search: "",
    status: "",
    tag: "",
    sector: ""
  });

  const observer = useRef();
  const lastContactElementRef = useCallback(node => {
    if (loading || fetchingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, fetchingMore, hasMore]);

  const fetchContacts = async (pageNum, isNewSearch = false) => {
    if (!activeAccount && !showAllAccounts) return;
    
    if (pageNum === 1) setLoading(true);
    else setFetchingMore(true);

    try {
      const queryParams = new URLSearchParams(filters);
      queryParams.append("page", pageNum);
      queryParams.append("limit", 50);
      if (showAllAccounts) queryParams.append("showAllAccounts", "true");
      
      const res = await api.get(`/contacts?${queryParams.toString()}`);
      const newContacts = res.data.contacts || [];
      
      if (isNewSearch) {
        setContacts(newContacts);
      } else {
        setContacts(prev => [...(Array.isArray(prev) ? prev : []), ...newContacts]);
      }
      
      setHasMore(res.data.hasMore || false);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error("Error fetching contacts:", err);
    } finally {
      setLoading(false);
      setFetchingMore(false);
    }
  };

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
      console.error("Error fetching metadata:", err);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchContacts(1, true);
    fetchFieldsAndSectors();
  }, [activeAccount, showAllAccounts, filters.sector]); // Refetch when sector filter changes

  useEffect(() => {
    if (page > 1) {
      fetchContacts(page);
    }
  }, [page]);

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    setPage(1);
    fetchContacts(1, true);
  };

  const getStatusColor = (status) => {
    const custom = customStatuses.find(s => s.name === status);
    if (custom && custom.color) return { bg: `${custom.color}15`, text: custom.color }; // Add 15 for transparency
    
    switch (status) {
      case "Interested": return { bg: "#f0fdf4", text: "#16a34a" };
      case "Pending": return { bg: "#fefce8", text: "#ca8a04" };
      case "No Reply": return { bg: "#fef2f2", text: "#dc2626" };
      default: return { bg: "#f8fafc", text: "#64748b" };
    }
  };

  const fetchTimelineEntries = async (contactId) => {
    setLoadingTimeline(true);
    try {
      const res = await api.get(`/timeline/${contactId}`);
      setTimelineEntries(res.data);
    } catch (err) {
      console.error("Timeline error:", err);
    } finally {
      setLoadingTimeline(false);
    }
  };

  const handleContactClick = (contact) => {
    setSelectedContact(contact);
    setShowTimelineDrawer(true);
    fetchTimelineEntries(contact._id);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      setImportData(data);
    };
    reader.readAsBinaryString(file);
  };

  const processImport = async () => {
    if (importData.length === 0) return;
    setImporting(true);
    try {
      const contactsToImport = importData.map(item => {
        const contact = { 
          name: item.name || item.Name || item.fullname || item.FullName || "Unknown",
          phone: String(item.phone || item.Phone || item.mobile || item.Mobile || item.number || item.Number || "").replace(/[^0-9]/g, ""),
          sector: importSector || item.sector || item.Sector || item.category || "Unassigned",
          tags: [importTag || "Imported"],
          customFields: {}
        };
        
        // Dynamic Mapping: Match against existing custom fields from state
        Object.keys(item).forEach(key => {
          const lowerKey = key.toLowerCase();
          // Find if this column matches any defined custom field (by name or label)
          const matchedField = customFields.find(f => 
            f.name.toLowerCase() === lowerKey || f.label.toLowerCase() === lowerKey
          );

          if (matchedField) {
            contact.customFields[matchedField.name] = item[key];
          } else if (lowerKey !== "name" && lowerKey !== "phone" && lowerKey !== "sector" && lowerKey !== "mobile" && lowerKey !== "number" && lowerKey !== "category") {
            // Even if not defined in manager, save it in customFields for future use
            contact.customFields[key] = item[key];
          }
        });

        return contact;
      }).filter(c => c.phone.length >= 10);

      const res = await api.post("/contacts/import", { 
        contacts: contactsToImport,
        whatsappAccountId: activeAccount?._id 
      });

      alert(`✅ Successfully imported ${res.data.count} contacts!`);
      setImportData([]);
      setShowImportModal(false);
      fetchContacts(1, true);
    } catch (err) {
      alert("Import failed: " + (err.response?.data?.error || err.message));
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteContact = async (id) => {
    if (!window.confirm("Are you sure you want to delete this contact? This action cannot be undone.")) return;
    try {
      await api.delete(`/contacts/${id}`);
      fetchContacts(1, true);
    } catch (err) {
      alert("Delete failed: " + (err.response?.data?.error || err.message));
    }
  };

  const handleUpdateContact = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/contacts/${editingContact._id}`, editingContact);
      setShowEditModal(false);
      fetchContacts(1, true);
      alert("Contact updated successfully!");
    } catch (err) {
      alert("Update failed: " + (err.response?.data?.error || err.message));
    }
  };

  const exportContacts = () => {
    const headers = ["Name", "Phone", "Account", "Campaign", "Sector", "Status", "Tags", ...customFields.map(f => f.label)];
    const rows = contacts.map(c => [
      c.name,
      c.phone,
      c.whatsappAccountId?.name || "N/A",
      c.sourceCampaign || "N/A",
      c.sector || "Unassigned",
      c.status || "N/A",
      c.tags?.join(", ") || "",
      ...customFields.map(f => c.customFields?.[f.name] || "")
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + rows.map(r => r.join(",")).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `contacts_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  const toggleSelectAll = () => {
    if (selectedContactIds.size === contacts.length && contacts.length > 0) {
      setSelectedContactIds(new Set());
    } else {
      setSelectedContactIds(new Set(contacts.map(c => c._id)));
    }
  };

  const toggleSelect = (id) => {
    const newSelected = new Set(selectedContactIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedContactIds(newSelected);
  };

  const handleSendCampaign = () => {
    const selectedPhones = contacts
      .filter(c => selectedContactIds.has(c._id))
      .map(c => c.phone);
    
    if (selectedPhones.length === 0) return;
    
    navigate("/campaigns", { state: { numbers: selectedPhones.join("\n") } });
  };

  return (
    <div className="contact-manager" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h3 style={{ fontSize: "1.5rem", fontWeight: "700" }}>All Contacts ({total})</h3>
          <p style={{ color: "#64748b", fontSize: "0.85rem" }}>Manage your lead database across all connected WhatsApp accounts.</p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", fontWeight: "600", cursor: "pointer", background: showAllAccounts ? "#f0fdf4" : "#f1f5f9", padding: "8px 16px", borderRadius: "10px", border: showAllAccounts ? "1px solid #25d366" : "1px solid #e2e8f0", color: showAllAccounts ? "#16a34a" : "#64748b", transition: "0.3s" }}>
            <input 
              type="checkbox" 
              checked={showAllAccounts} 
              onChange={() => setShowAllAccounts(!showAllAccounts)}
              style={{ display: "none" }}
            />
            {showAllAccounts ? "Showing All Accounts" : "Show All Accounts"}
          </label>
          <button 
              onClick={() => setShowImportModal(true)}
              style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", borderRadius: "10px", border: "1px solid #00a884", color: "#00a884", background: "white", fontSize: "0.85rem", fontWeight: "700", cursor: "pointer" }}
            >
              <Upload size={16} /> Import Excel/CSV
            </button>
            <button 
              className="btn-secondary" 
              onClick={exportContacts}
              style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", fontSize: "0.85rem" }}
            >
              <Download size={16} /> Export CSV
            </button>
            {selectedContactIds.size > 0 && (
              <button 
                onClick={handleSendCampaign}
                style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 20px", borderRadius: "10px", background: "linear-gradient(135deg, #00a884, #00c399)", color: "white", border: "none", fontSize: "0.85rem", fontWeight: "800", cursor: "pointer", boxShadow: "0 4px 15px rgba(0,168,132,0.3)", animation: "popIn 0.3s ease-out" }}
              >
                <Send size={16} /> Send Campaign to ({selectedContactIds.size})
              </button>
            )}
        </div>
      </div>

      <div style={{ display: "flex", gap: "20px", flex: 1, minHeight: 0 }}>
        {/* Main Content Area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {/* Filters Bar */}
          <div className="glass-card" style={{ padding: "12px 20px", marginBottom: "1.5rem", display: "flex", gap: "12px", alignItems: "center" }}>
            <form onSubmit={handleSearch} style={{ flex: 1, position: "relative" }}>
              <Search size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
              <input 
                type="text" 
                placeholder="Search name or phone..." 
                style={{ width: "100%", padding: "8px 8px 8px 40px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "0.85rem" }}
                value={filters.search}
                onChange={e => setFilters({ ...filters, search: e.target.value })}
              />
            </form>

            <select 
              style={{ padding: "8px 12px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "0.85rem", color: "#64748b" }}
              value={filters.status}
              onChange={e => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">All Status</option>
              {customStatuses.map(s => (
                <option key={s.name} value={s.name}>{s.name}</option>
              ))}
            </select>

            <button onClick={handleSearch} className="btn-primary" style={{ padding: "8px 20px", fontSize: "0.85rem" }}>
              Apply
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "4rem" }}><Loader2 className="animate-spin" size={40} color="#00a884" /></div>
          ) : (
            <div className="glass-card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", flex: 1 }}>
              <div style={{ flex: 1, overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", minWidth: "1200px" }}>
                  <thead style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, zIndex: 10 }}>
                    <tr>
                      <th style={{ textAlign: "left", padding: "16px 24px", width: "50px" }}>
                        <input 
                          type="checkbox" 
                          checked={selectedContactIds.size === contacts.length && contacts.length > 0} 
                          onChange={toggleSelectAll}
                          style={{ cursor: "pointer", transform: "scale(1.2)" }}
                        />
                      </th>
                      <th style={{ textAlign: "left", padding: "16px 12px", color: "#64748b", fontWeight: "600" }}>Contact Info</th>
                      <th style={{ textAlign: "left", padding: "16px 24px", color: "#64748b", fontWeight: "600" }}>Account / Campaign</th>
                      <th style={{ textAlign: "left", padding: "16px 24px", color: "#64748b", fontWeight: "600" }}>Sector</th>
                      <th style={{ textAlign: "left", padding: "16px 24px", color: "#64748b", fontWeight: "600" }}>Status</th>
                      <th style={{ textAlign: "left", padding: "16px 24px", color: "#64748b", fontWeight: "600" }}>Mark</th>
                      <th style={{ textAlign: "left", padding: "16px 24px", color: "#64748b", fontWeight: "600" }}>Tags</th>
                      {customFields.map(field => (
                        <th key={field._id} style={{ textAlign: "left", padding: "16px 24px", color: "#64748b", fontWeight: "600" }}>{field.label}</th>
                      ))}
                      <th style={{ textAlign: "right", padding: "16px 24px", color: "#64748b", fontWeight: "600" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!contacts || contacts.length === 0) ? (
                      <tr>
                        <td colSpan={6 + customFields.length} style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>No contacts found matching the filters.</td>
                      </tr>
                    ) : (
                      contacts.map((contact, index) => {
                        const isLastElement = contacts.length === index + 1;
                        return (
                          <tr 
                            key={contact._id} 
                            ref={isLastElement ? lastContactElementRef : null}
                            style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.2s", background: selectedContactIds.has(contact._id) ? "#f0fdf4" : "transparent" }} 
                            onMouseOver={e => e.currentTarget.style.background = selectedContactIds.has(contact._id) ? "#ecfdf5" : "#fcfdfe"} 
                            onMouseOut={e => e.currentTarget.style.background = selectedContactIds.has(contact._id) ? "#f0fdf4" : "transparent"}
                          >
                            <td style={{ padding: "16px 24px" }}>
                              <input 
                                type="checkbox" 
                                checked={selectedContactIds.has(contact._id)} 
                                onChange={() => toggleSelect(contact._id)}
                                style={{ cursor: "pointer", transform: "scale(1.2)" }}
                              />
                            </td>
                            <td style={{ padding: "16px 12px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: "#00a884" }}>
                                  <User size={18} />
                                </div>
                                <div 
                                  onClick={() => handleContactClick(contact)}
                                  style={{ cursor: "pointer", transition: "transform 0.2s" }}
                                  onMouseOver={e => e.currentTarget.style.transform = "translateX(5px)"}
                                  onMouseOut={e => e.currentTarget.style.transform = "translateX(0)"}
                                >
                                  <div style={{ fontWeight: "700", color: "#1e293b", fontSize: "0.9rem" }}>{contact.name}</div>
                                  <div style={{ color: "#94a3b8", display: "flex", alignItems: "center", gap: "4px" }}>
                                    <Smartphone size={12} /> {contact.phone}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: "16px 24px" }}>
                              <div style={{ fontWeight: "700", color: "#00a884", fontSize: "0.75rem" }}>{contact.whatsappAccountId?.name || "N/A"}</div>
                              <div style={{ color: "#94a3b8", fontSize: "0.7rem", marginTop: "2px" }}>
                                 {contact.sourceCampaign ? `Campaign: ${contact.sourceCampaign}` : "Manual Chat"}
                              </div>
                            </td>
                            <td style={{ padding: "16px 24px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#475569", fontWeight: "600" }}>
                                <Layers size={14} color="#6366f1" />
                                {contact.sector || "Unassigned"}
                              </div>
                            </td>
                            <td style={{ padding: "16px 24px" }}>
                              {contact.status ? (
                                <span style={{ 
                                  padding: "4px 10px", 
                                  borderRadius: "20px", 
                                  fontSize: "0.75rem", 
                                  fontWeight: "700",
                                  background: getStatusColor(contact.status).bg,
                                  color: getStatusColor(contact.status).text
                                }}>
                                  {contact.status}
                                </span>
                              ) : <span style={{ color: "#cbd5e1" }}>-</span>}
                            </td>
                            <td style={{ padding: "16px 24px" }}>
                              <span style={{ 
                                padding: "4px 10px", 
                                borderRadius: "20px", 
                                fontSize: "0.75rem", 
                                fontWeight: "700",
                                background: contact.isCampaignSent ? "#e7fce3" : "#f1f5f9",
                                color: contact.isCampaignSent ? "#008069" : "#64748b",
                                border: `1px solid ${contact.isCampaignSent ? "#00a884" : "#e2e8f0"}`
                              }}>
                                {contact.isCampaignSent ? "SENT" : "NEW"}
                              </span>
                            </td>
                            <td style={{ padding: "16px 24px" }}>
                              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                                {contact.tags?.map((tag, i) => (
                                  <span key={i} style={{ background: "#f1f5f9", padding: "2px 8px", borderRadius: "4px", color: "#475569", fontSize: "0.7rem" }}>{tag}</span>
                                )) || "-"}
                              </div>
                            </td>
                            {customFields.map(field => (
                              <td key={field._id} style={{ padding: "16px 24px", color: "#475569" }}>
                                {contact.customFields?.[field.name] || <span style={{ color: "#cbd5e1" }}>-</span>}
                              </td>
                            ))}
                            <td style={{ padding: "16px 24px", textAlign: "right" }}>
                              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                                <Link 
                                  to={contact.conversationId ? `/chats/${contact.conversationId._id || contact.conversationId}` : `/chats/new:${contact.phone}`} 
                                  style={{ color: "#00a884", textDecoration: "none" }}
                                >
                                  <button title="Open Chat" style={{ background: "transparent", border: "1px solid #00a884", borderRadius: "8px", padding: "6px", color: "#00a884", cursor: "pointer" }}>
                                    <ExternalLink size={14} />
                                  </button>
                                </Link>
                                
                                <button 
                                  onClick={() => { setEditingContact({...contact}); setShowEditModal(true); }}
                                  title="Edit Contact" 
                                  style={{ background: "transparent", border: "1px solid #6366f1", borderRadius: "8px", padding: "6px", color: "#6366f1", cursor: "pointer" }}
                                >
                                  <Pencil size={14} />
                                </button>
                                
                                <button 
                                  onClick={() => handleDeleteContact(contact._id)}
                                  title="Delete Contact" 
                                  style={{ background: "transparent", border: "1px solid #ef4444", borderRadius: "8px", padding: "6px", color: "#ef4444", cursor: "pointer" }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {fetchingMore && (
                <div style={{ textAlign: "center", padding: "12px", background: "#f8fafc", borderTop: "1px solid #e2e8f0" }}>
                  <Loader2 className="animate-spin" size={20} color="#00a884" />
                  <span style={{ marginLeft: "10px", color: "#64748b", fontSize: "0.85rem" }}>Loading more leads...</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Sidebar - Sectors */}
        <div style={{ width: "260px", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="glass-card" style={{ padding: "1.2rem", flex: 1, display: "flex", flexDirection: "column" }}>
            <h4 style={{ fontSize: "0.9rem", fontWeight: "800", color: "#1e293b", marginBottom: "1.2rem", display: "flex", alignItems: "center", gap: "8px" }}>
              <Layers size={18} color="#00a884" /> Filter by Sector
            </h4>
            
            <div className="chat-scroll" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
              <button 
                onClick={() => setFilters({ ...filters, sector: "" })}
                style={{ 
                  width: "100%", textAlign: "left", padding: "10px 14px", borderRadius: "10px", border: "none", cursor: "pointer",
                  background: filters.sector === "" ? "linear-gradient(135deg, #00a884, #00c399)" : "transparent",
                  color: filters.sector === "" ? "white" : "#475569",
                  fontSize: "0.85rem", fontWeight: "600", display: "flex", justifyContent: "space-between", alignItems: "center"
                }}
              >
                All Sectors {filters.sector === "" && <ChevronRight size={14} />}
              </button>

              {sectors.map(sector => (
                <button 
                  key={sector._id}
                  onClick={() => setFilters({ ...filters, sector: sector.name })}
                  style={{ 
                    width: "100%", textAlign: "left", padding: "10px 14px", borderRadius: "10px", border: "none", cursor: "pointer",
                    background: filters.sector === sector.name ? "linear-gradient(135deg, #6366f1, #818cf8)" : "transparent",
                    color: filters.sector === sector.name ? "white" : "#475569",
                    fontSize: "0.85rem", fontWeight: "600", display: "flex", justifyContent: "space-between", alignItems: "center",
                    transition: "all 0.2s"
                  }}
                  onMouseOver={e => !filters.sector === sector.name && (e.currentTarget.style.background = "#f1f5f9")}
                  onMouseOut={e => !filters.sector === sector.name && (e.currentTarget.style.background = "transparent")}
                >
                  {sector.name} {filters.sector === sector.name && <ChevronRight size={14} />}
                </button>
              ))}

              <button 
                onClick={() => setFilters({ ...filters, sector: "Unassigned" })}
                style={{ 
                  width: "100%", textAlign: "left", padding: "10px 14px", borderRadius: "10px", border: "none", cursor: "pointer",
                  background: filters.sector === "Unassigned" ? "linear-gradient(135deg, #64748b, #94a3b8)" : "transparent",
                  color: filters.sector === "Unassigned" ? "white" : "#475569",
                  fontSize: "0.85rem", fontWeight: "600", display: "flex", justifyContent: "space-between", alignItems: "center"
                }}
              >
                Unassigned {filters.sector === "Unassigned" && <ChevronRight size={14} />}
              </button>
            </div>
            
            <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #f1f5f9" }}>
              <p style={{ fontSize: "0.75rem", color: "#94a3b8", textAlign: "center" }}>
                Add more sectors from the Chat Module management.
              </p>
            </div>
          </div>
        </div>
      </div>
      {/* Import Modal */}
      {showImportModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(11, 20, 26, 0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
          <div style={{ background: "white", width: "600px", borderRadius: "20px", padding: "32px", boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ background: "#e7fce3", padding: "10px", borderRadius: "12px", color: "#00a884" }}>
                  <FileSpreadsheet size={24} />
                </div>
                <h3 style={{ margin: 0, fontSize: "1.25rem", color: "#111b21" }}>Import Leads</h3>
              </div>
              <button onClick={() => setShowImportModal(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.5rem", color: "#8696a0" }}>✕</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "700", color: "#54656f", marginBottom: "8px" }}>Campaign / Source Tag</label>
                <input 
                  type="text" 
                  value={importTag}
                  onChange={(e) => setImportTag(e.target.value)}
                  placeholder="e.g. Hyderabad_Awards_2026"
                  style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e9edef", outline: "none", fontSize: "0.95rem" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "700", color: "#54656f", marginBottom: "8px" }}>Assign to Sector</label>
                <select 
                  value={importSector}
                  onChange={(e) => setImportSector(e.target.value)}
                  style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e9edef", outline: "none", fontSize: "0.95rem" }}
                >
                  <option value="">Default (From File)</option>
                  {sectors.map(s => (
                    <option key={s._id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <p style={{ fontSize: "0.75rem", color: "#8696a0", marginTop: "-12px", marginBottom: "24px" }}>These settings help you group and filter leads in Campaigns and Chat modules.</p>

            <div style={{ 
              border: "2px dashed #e9edef", 
              borderRadius: "15px", 
              padding: "40px", 
              textAlign: "center", 
              background: "#f8fafc",
              marginBottom: "24px",
              cursor: "pointer"
            }} onClick={() => document.getElementById('import-file').click()}>
              <Upload size={32} color="#00a884" style={{ marginBottom: "12px" }} />
              <p style={{ margin: 0, fontSize: "0.9rem", color: "#111b21", fontWeight: "600" }}>
                {importData.length > 0 ? `${importData.length} rows loaded from file` : "Click to upload Excel or CSV file"}
              </p>
              <p style={{ margin: "4px 0 0 0", fontSize: "0.75rem", color: "#8696a0" }}>Support: .xlsx, .xls, .csv</p>
              <input 
                id="import-file" 
                type="file" 
                accept=".xlsx, .xls, .csv" 
                hidden 
                onChange={handleFileUpload} 
              />
            </div>

            {importData.length > 0 && (
              <div style={{ maxHeight: "150px", overflowY: "auto", border: "1px solid #e9edef", borderRadius: "10px", padding: "12px", marginBottom: "24px", background: "#ffffff" }}>
                <p style={{ fontSize: "0.75rem", fontWeight: "700", color: "#8696a0", textTransform: "uppercase", marginBottom: "8px" }}>Preview (First 3 rows)</p>
                {importData.slice(0, 3).map((row, i) => (
                  <div key={i} style={{ fontSize: "0.8rem", color: "#54656f", borderBottom: "1px solid #f8fafc", padding: "4px 0" }}>
                    {JSON.stringify(row).substring(0, 100)}...
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: "12px" }}>
              <button 
                className="btn-secondary" 
                style={{ flex: 1, padding: "12px" }}
                onClick={() => setShowImportModal(false)}
              >
                Cancel
              </button>
              <button 
                className="btn-primary" 
                style={{ flex: 1, padding: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                disabled={importData.length === 0 || importing}
                onClick={processImport}
              >
                {importing ? <Loader2 className="animate-spin" size={18} /> : <UserPlus size={18} />}
                {importing ? "Importing..." : `Import ${importData.length} Contacts`}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Timeline Drawer */}
      {showTimelineDrawer && (
        <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, background: "rgba(11, 20, 26, 0.4)", zIndex: 3000, display: "flex", justifyContent: "flex-end" }} onClick={() => setShowTimelineDrawer(false)}>
          <div 
            style={{ width: "450px", background: "#f0f2f5", height: "100%", boxShadow: "-10px 0 30px rgba(0,0,0,0.1)", display: "flex", flexDirection: "column", animation: "slideIn 0.3s ease-out" }} 
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ background: "#00a884", color: "white", padding: "24px", display: "flex", alignItems: "center", gap: "16px" }}>
              <button onClick={() => setShowTimelineDrawer(false)} style={{ background: "none", border: "none", color: "white", cursor: "pointer", fontSize: "1.2rem" }}>✕</button>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Contact Details</h3>
                <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.9 }}>{selectedContact?.phone}</p>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
              {/* Profile Card */}
              <div style={{ background: "white", borderRadius: "15px", padding: "20px", marginBottom: "20px", boxShadow: "0 2px 5px rgba(0,0,0,0.05)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "15px", marginBottom: "15px" }}>
                  <div style={{ width: "50px", height: "50px", borderRadius: "25px", background: "#e7fce3", display: "flex", alignItems: "center", justifyContent: "center", color: "#00a884" }}>
                    <User size={24} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, color: "#111b21" }}>{selectedContact?.name || "Unknown User"}</h4>
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "#667781" }}>Joined: {new Date(selectedContact?.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                  <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "10px" }}>
                    <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: "700", textTransform: "uppercase" }}>Sector</div>
                    <div style={{ fontSize: "0.9rem", color: "#1e293b", fontWeight: "600" }}>{selectedContact?.sector || "Unassigned"}</div>
                  </div>
                  <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "10px" }}>
                    <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: "700", textTransform: "uppercase" }}>Status</div>
                    <div style={{ fontSize: "0.9rem", color: "#1e293b", fontWeight: "600" }}>{selectedContact?.status || "New"}</div>
                  </div>
                </div>

                <div style={{ background: "#eef2ff", padding: "12px", borderRadius: "10px", border: "1px solid #e0e7ff" }}>
                  <div style={{ fontSize: "0.7rem", color: "#6366f1", fontWeight: "700", textTransform: "uppercase", marginBottom: "4px" }}>Assigned To</div>
                  <div style={{ fontSize: "0.95rem", color: "#1e293b", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px" }}>
                    <User size={14} /> {selectedContact?.assignedTo?.name || "Unassigned"}
                  </div>
                </div>
              </div>

              {/* Custom Details Section */}
              {selectedContact?.customFields && Object.keys(selectedContact.customFields).length > 0 && (
                <div style={{ background: "white", borderRadius: "15px", padding: "20px", marginBottom: "20px", boxShadow: "0 2px 5px rgba(0,0,0,0.05)" }}>
                  <h5 style={{ margin: "0 0 12px 0", fontSize: "0.85rem", color: "#111b21", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>Lead Attributes</h5>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                    {Object.entries(selectedContact.customFields).map(([key, val]) => (
                      <div key={key}>
                        <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: "600" }}>{key}</div>
                        <div style={{ fontSize: "0.85rem", color: "#111b21" }}>{val || "-"}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Timeline Section */}
              <div style={{ marginBottom: "15px", display: "flex", alignItems: "center", gap: "8px", color: "#111b21", fontWeight: "700" }}>
                <History size={18} /> Activity Timeline
              </div>

              {loadingTimeline ? (
                <div style={{ textAlign: "center", padding: "40px" }}><Loader2 className="animate-spin" size={24} color="#00a884" /></div>
              ) : (
                <div style={{ position: "relative", paddingLeft: "30px" }}>
                  {/* Vertical Line */}
                  <div style={{ position: "absolute", left: "7px", top: "5px", bottom: "5px", width: "2px", background: "#e9edef" }}></div>
                  
                  {timelineEntries.length === 0 ? (
                    <p style={{ color: "#8696a0", fontSize: "0.85rem" }}>No activity logs found for this contact.</p>
                  ) : (
                    timelineEntries.map((entry, idx) => (
                      <div key={entry._id} style={{ position: "relative", marginBottom: "24px" }}>
                        {/* Dot */}
                        <div style={{ position: "absolute", left: "-27px", top: "5px", width: "10px", height: "10px", borderRadius: "5px", background: idx === 0 ? "#00a884" : "#cbd5e1", border: "2px solid white", zIndex: 1 }}></div>
                        
                        <div style={{ background: "white", padding: "12px", borderRadius: "12px", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                            <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "#00a884" }}>LOG</span>
                            <span style={{ fontSize: "0.7rem", color: "#8696a0", display: "flex", alignItems: "center", gap: "4px" }}>
                              <Clock size={10} /> {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div style={{ fontSize: "0.85rem", color: "#111b21", marginBottom: "4px" }}>{entry.content}</div>
                          <div style={{ fontSize: "0.7rem", color: "#8696a0", display: "flex", alignItems: "center", gap: "4px" }}>
                            <User size={10} /> By: <strong>{entry.createdBy?.name || "System"}</strong>
                          </div>
                        </div>
                        <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "4px", paddingLeft: "4px" }}>
                          {new Date(entry.timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            
            {/* Action Footer */}
            <div style={{ padding: "20px", background: "white", borderTop: "1px solid #e9edef" }}>
              <Link 
                to={selectedContact?.conversationId ? `/chats/${selectedContact.conversationId._id || selectedContact.conversationId}` : `/chats/new:${selectedContact?.phone}`}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", width: "100%", padding: "12px", background: "#00a884", color: "white", borderRadius: "10px", textDecoration: "none", fontWeight: "700", fontSize: "0.9rem" }}
              >
                Go to Chat <ExternalLink size={16} />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Edit Contact Modal */}
      {showEditModal && editingContact && (
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 4000 }}>
          <div className="glass-card" style={{ width: "500px", padding: "2rem", maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ marginBottom: "1.5rem", color: "#1e293b", display: "flex", alignItems: "center", gap: "10px" }}>
              <Pencil size={20} color="#6366f1" /> Edit Lead Details
            </h3>
            
            <form onSubmit={handleUpdateContact} style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "#64748b", marginBottom: "5px", fontWeight: "600" }}>Contact Name</label>
                <input 
                  type="text" 
                  value={editingContact.name} 
                  onChange={e => setEditingContact({...editingContact, name: e.target.value})}
                  style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0" }}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "#64748b", marginBottom: "5px", fontWeight: "600" }}>Sector</label>
                  <select 
                    value={editingContact.sector} 
                    onChange={e => setEditingContact({...editingContact, sector: e.target.value})}
                    style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0" }}
                  >
                    <option value="Unassigned">Unassigned</option>
                    {sectors.map(s => <option key={s._id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "#64748b", marginBottom: "5px", fontWeight: "600" }}>Status</label>
                  <select 
                    value={editingContact.status || ""} 
                    onChange={e => setEditingContact({...editingContact, status: e.target.value})}
                    style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0" }}
                  >
                    <option value="">New / None</option>
                    {customStatuses.map(s => <option key={s._id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Custom Fields in Edit Modal */}
              {customFields.length > 0 && (
                <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "1rem", marginTop: "0.5rem" }}>
                  <h4 style={{ fontSize: "0.85rem", color: "#1e293b", marginBottom: "1rem" }}>Custom Attributes</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {customFields.map(field => (
                      <div key={field._id}>
                        <label style={{ display: "block", fontSize: "0.75rem", color: "#64748b", marginBottom: "4px" }}>{field.label}</label>
                        <input 
                          type="text"
                          value={editingContact.customFields?.[field.name] || ""}
                          onChange={e => setEditingContact({
                            ...editingContact, 
                            customFields: { ...editingContact.customFields, [field.name]: e.target.value }
                          })}
                          style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.85rem" }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: "10px", marginTop: "1rem" }}>
                <button 
                  type="button" 
                  onClick={() => setShowEditModal(false)}
                  style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "white", cursor: "pointer", fontWeight: "600" }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  style={{ flex: 2, padding: "12px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "white", cursor: "pointer", fontWeight: "700" }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
};

export default ContactManager;
