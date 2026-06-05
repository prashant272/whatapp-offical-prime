import React, { useState, useEffect, useMemo, useCallback } from "react";
import * as XLSX from 'xlsx';
import api from "../../api";
import { ChevronLeft, ChevronRight, Loader2, Send, X, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useWhatsAppAccount } from "../../WhatsAppAccountContext";

// Sub-components
import ContactTable from "./ContactTable";
import ContactKanban from "./ContactKanban";
import ContactFilters from "./ContactFilters";
import ContactDrawer from "./ContactDrawer";
import ImportMapperModal from "./ImportMapperModal";
import EditContactModal from "./EditContactModal";

const ContactManagerMain = ({ deleted = false }) => {
  const navigate = useNavigate();
  const { activeAccount } = useWhatsAppAccount();
  
  // States
  const [viewMode, setViewMode] = useState("list"); // list or kanban
  const [contacts, setContacts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(100);
  const [filters, setFilters] = useState({ search: "", status: "", sector: "", tag: "" });
  
  // Metadata
  const [customFields, setCustomFields] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [customStatuses, setCustomStatuses] = useState([]);
  
  // Selection
  const [selectedContactIds, setSelectedContactIds] = useState(new Set());
  const [isUniversalSelect, setIsUniversalSelect] = useState(false);
  
  // Modals & Drawers
  const [selectedContact, setSelectedContact] = useState(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [timelineEntries, setTimelineEntries] = useState([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  
  // Import state
  const [showMapper, setShowMapper] = useState(false);
  const [tempImportData, setTempImportData] = useState([]);
  const [importData, setImportData] = useState([]);
  const [importing, setImporting] = useState(false);


  const fetchContacts = useCallback(async (pageNum) => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams(filters);
      queryParams.append("page", pageNum);
      queryParams.append("limit", limit);
      queryParams.append("showAllAccounts", "true");
      if (deleted) {
        queryParams.append("deleted", "true");
      }
      
      const res = await api.get(`/contacts?${queryParams.toString()}`);
      setContacts(res.data.contacts || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [filters, limit, deleted]);

  useEffect(() => {
    fetchContacts(page);
  }, [page, limit, filters, deleted]);

  useEffect(() => {
    setPage(1);
    setSelectedContactIds(new Set());
    setIsUniversalSelect(false);
  }, [deleted]);

  const handleRestoreContact = async (id) => {
    try {
      await api.patch(`/contacts/${id}`, { isDeleted: false });
      fetchContacts(page);
    } catch (err) {
      alert("Failed to restore contact");
    }
  };

  const fetchMetadata = async () => {
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
    fetchMetadata();
  }, []);

  const handleUpdateStatus = async (contactId, newStatus) => {
    try {
      const res = await api.patch(`/contacts/${contactId}`, { status: newStatus });
      setContacts(prev => prev.map(c => c._id === contactId ? { ...c, status: newStatus } : c));
      
      // Update drawer if open
      if (selectedContact?._id === contactId) {
        setSelectedContact(res.data);
      }
    } catch (err) {
      alert("Failed to update status");
    }
  };

  const handleContactClick = useCallback(async (contact) => {
    setSelectedContact(contact);
    setShowDrawer(true);
    setLoadingTimeline(true);
    try {
      const res = await api.get(`/timeline/${contact._id}`);
      setTimelineEntries(res.data);
    } catch (err) {
      console.error("Timeline error:", err);
    } finally {
      setLoadingTimeline(false);
    }
  }, []);

  const getContactAccountId = (contact) => {
    const account = contact?.whatsappAccountId;
    return typeof account === "object" ? account?._id : account;
  };

  const handleOpenChat = useCallback(async (contact) => {
    const phone = contact?.phone;
    if (!phone) return;

    if (contact.conversationId) {
      navigate(`/chats/${contact.conversationId._id || contact.conversationId}`);
      return;
    }

    try {
      const res = await api.get("/conversations/resolve", {
        params: { phone },
        headers: { "x-whatsapp-account-id": "all" }
      });
      const conversation = res.data?.conversation;
      if (conversation?._id) {
        navigate(`/chats/${conversation._id}`);
        return;
      }
    } catch (err) {
      console.error("Conversation resolve error:", err);
    }

    const accountId = getContactAccountId(contact) || activeAccount?._id;
    const accountQuery = accountId ? `?accountId=${accountId}` : "";
    navigate(`/chats/new:${phone}${accountQuery}`);
  }, [activeAccount?._id, navigate]);

  const handleUpdateContact = (updated) => {
    setContacts(prev => prev.map(c => c._id === updated._id ? updated : c));
    setSelectedContact(updated);
  };

  const getStatusColor = (status) => {
    const s = customStatuses.find(cs => cs.name === status);
    return s ? { bg: `${s.color}20`, text: s.color } : { bg: "#f1f5f9", text: "#64748b" };
  };

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
      await api.post("/contacts/import", { contacts: processedContacts });
      alert(`Successfully imported ${processedContacts.length} leads!`);
      setShowMapper(false);
      fetchContacts(1);
    } catch (err) {
      alert("Import failed. Please check your data format.");
    } finally {
      setImporting(false);
    }
  };


  const processImport = async () => {
    if (importData.length === 0) return;
    setImporting(true);
    try {
      const contactsToImport = importData.map(item => ({
        name: item.name || item.Name || "Unknown",
        phone: String(item.phone || item.Phone || "").replace(/[^0-9]/g, ""),
        sector: item.sector || "Unassigned",
        tags: item.tags ? item.tags.split(',') : [],
        customFields: item.customFields || {}
      })).filter(c => c.phone.length >= 10);
      
      await api.post("/contacts/import", { contacts: contactsToImport });
      alert(`Successfully imported ${contactsToImport.length} leads!`);
      setShowImportModal(false);
      fetchContacts(1);
    } catch (err) {
      alert("Import failed. Please check your file format.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="contact-manager-nextgen" style={{ height: "100%", display: "flex", flexDirection: "column", background: "#f8fafc", padding: "1.5rem" }}>
      
      <ContactFilters 
        filters={filters}
        setFilters={setFilters}
        handleSearch={() => setPage(1)}
        viewMode={viewMode}
        setViewMode={setViewMode}
        customStatuses={customStatuses}
        sectors={sectors}
        total={total}
        showImportModal={showImportModal}
        setShowImportModal={setShowImportModal}
        selectedCount={isUniversalSelect ? total : selectedContactIds.size}
        handleSendCampaign={() => navigate("/campaigns", { state: { bulkIds: Array.from(selectedContactIds), isUniversal: isUniversalSelect, filters } })}
        deleted={deleted}
      />

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {loading ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "15px" }}>
            <Loader2 className="animate-spin" size={48} color="#2ecc71" />
            <p style={{ fontWeight: "800", color: "#64748b" }}>Synchronizing Leads...</p>
          </div>
        ) : viewMode === "list" ? (
          <ContactTable 
            contacts={contacts}
            loading={loading}
            selectedContactIds={selectedContactIds}
            toggleSelect={(id) => {
              const next = new Set(selectedContactIds);
              if (next.has(id)) next.delete(id); else next.add(id);
              setSelectedContactIds(next);
              setIsUniversalSelect(false);
            }}
            isAllSelectedOnPage={isAllSelectedOnPage}
            handleSelectAllOnPage={handleSelectAllOnPage}
            total={total}
            isUniversalSelect={isUniversalSelect}
            setIsUniversalSelect={setIsUniversalSelect}
            setSelectedContactIds={setSelectedContactIds}
            handleContactClick={handleContactClick}
            getStatusColor={getStatusColor}
            customFields={customFields}
            navigate={navigate}
            onOpenChat={handleOpenChat}
            handleDeleteContact={async (id) => {
              if (window.confirm(deleted ? "Are you sure you want to permanently delete this lead? This cannot be undone." : "Are you sure you want to delete this lead?")) {
                await api.delete(`/contacts/${id}`);
                fetchContacts(page);
              }
            }}
            setEditingContact={setEditingContact}
            setShowEditModal={setShowEditModal}
            deleted={deleted}
            handleRestoreContact={handleRestoreContact}
          />
        ) : (
          <ContactKanban 
            contacts={contacts}
            customStatuses={customStatuses}
            handleContactClick={handleContactClick}
            navigate={navigate}
            onOpenChat={handleOpenChat}
            onUpdateStatus={handleUpdateStatus}
          />
        )}
      </div>

      {/* Pagination Footer (Only for List View) */}
      {viewMode === "list" && !loading && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 25px", background: "white", borderTop: "2px solid #f0f0f0", marginTop: "1rem", borderRadius: "12px", boxShadow: "0 -4px 20px rgba(0,0,0,0.02)" }}>
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
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: "8px 15px", borderRadius: "8px", border: "2px solid #eee", background: "white", fontWeight: "800", cursor: page === 1 ? "not-allowed" : "pointer" }}>Prev</button>
            <div style={{ display: "flex", gap: "5px", margin: "0 10px" }}>
              <span style={{ fontWeight: "900", color: "#1a1a1a" }}>Page {page} of {Math.ceil(total / limit)}</span>
            </div>
            <button disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(p => p + 1)} style={{ padding: "8px 15px", borderRadius: "8px", border: "2px solid #eee", background: "white", fontWeight: "800", cursor: page >= Math.ceil(total / limit) ? "not-allowed" : "pointer" }}>Next</button>
          </div>
        </div>
      )}

      {/* Drawer */}
      {showDrawer && selectedContact && (
        <ContactDrawer 
          contact={selectedContact}
          onClose={() => setShowDrawer(false)}
          loadingTimeline={loadingTimeline}
          timelineEntries={timelineEntries}
          navigate={navigate}
          onOpenChat={handleOpenChat}
          onUpdateContact={handleUpdateContact}
        />
      )}

      {/* Import Modal - Step 1: Select File */}
      {showImportModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 7000, backdropFilter: "blur(4px)" }}>
          <div style={{ width: "550px", padding: "2.5rem", background: "white", borderRadius: "20px", boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h3 style={{ margin: 0, fontWeight: "900", fontSize: "1.5rem" }}>Import Leads</h3>
              <X size={24} style={{ cursor: "pointer" }} onClick={() => setShowImportModal(false)} />
            </div>
            <div 
              style={{ border: "3px dashed #eef2f6", padding: "40px", textAlign: "center", borderRadius: "15px", cursor: "pointer", background: "#f8fafc" }} 
              onClick={() => document.getElementById('import-file').click()}
            >
              <p style={{ fontWeight: "800", color: "#1a1a1a" }}>Click to select Excel/CSV file</p>
              <input id="import-file" type="file" accept=".xlsx, .xls, .csv" hidden onChange={handleFileUpload} />
            </div>
            <div style={{ display: "flex", gap: "15px", marginTop: "2.5rem" }}>
              <button onClick={() => setShowImportModal(false)} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "2px solid #eee", background: "white", fontWeight: "800" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Import Mapper - Step 2: Mapping Fields */}
      <ImportMapperModal 
        isOpen={showMapper}
        onClose={() => setShowMapper(false)}
        rawData={tempImportData}
        onComplete={handleMappingComplete}
        customFields={customFields}
        sectors={sectors}
      />

      <EditContactModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingContact(null);
        }}
        contact={editingContact}
        onUpdate={handleUpdateContact}
        sectors={sectors}
        customFields={customFields}
        customStatuses={customStatuses}
      />


      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default ContactManagerMain;
