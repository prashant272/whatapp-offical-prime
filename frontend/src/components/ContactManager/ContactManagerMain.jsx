import React, { useState, useEffect, useMemo, useCallback } from "react";
import * as XLSX from 'xlsx';
import api from "../../api";
import { ChevronLeft, ChevronRight, Loader2, Send, X, AlertTriangle, FileSpreadsheet, Trash2, Edit3, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useWhatsAppAccount } from "../../WhatsAppAccountContext";
import { useGoogleLogin } from "@react-oauth/google";

// Sub-components
import ContactTable from "./ContactTable";
import ContactKanban from "./ContactKanban";
import ContactFilters from "./ContactFilters";
import ContactDrawer from "./ContactDrawer";
import ImportMapperModal from "./ImportMapperModal";
import EditContactModal from "./EditContactModal";
import AddContactModal from "./AddContactModal";

const ContactManagerMain = ({ deleted = false }) => {
  const navigate = useNavigate();
  const { activeAccount, accounts } = useWhatsAppAccount();

  // States
  const [viewMode, setViewMode] = useState("list"); // list or kanban
  const [contacts, setContacts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(100);
  const [filters, setFilters] = useState({ search: "", status: "", sector: "", winner: "", gender: "", tag: "" });

  // Metadata
  const [customFields, setCustomFields] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [sources, setSources] = useState([]);
  const [winners, setWinners] = useState([]);
  const [customStatuses, setCustomStatuses] = useState([]);
  const [users, setUsers] = useState([]);
  const [presets, setPresets] = useState([]);

  // Selection
  const [selectedContactIds, setSelectedContactIds] = useState(new Set());
  const [isUniversalSelect, setIsUniversalSelect] = useState(false);

  // Modals & Drawers
  const [selectedContact, setSelectedContact] = useState(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [timelineEntries, setTimelineEntries] = useState([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingContact, setEditingContact] = useState(null);

  // Import state
  const [showMapper, setShowMapper] = useState(false);
  const [tempImportData, setTempImportData] = useState([]);
  const [importData, setImportData] = useState([]);
  const [importing, setImporting] = useState(false);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [registeredSheets, setRegisteredSheets] = useState([]);
  const [availableSheetTabs, setAvailableSheetTabs] = useState([]);
  const [selectedSheetTab, setSelectedSheetTab] = useState("");
  const [editingSyncConfig, setEditingSyncConfig] = useState(null);
  const [syncingAllSheets, setSyncingAllSheets] = useState(false);
  const [sheetToMessage, setSheetToMessage] = useState(null);
  const [selectedPresetForSend, setSelectedPresetForSend] = useState("");
  const [selectedAccountForSend, setSelectedAccountForSend] = useState("");
  const [sendIntervalSeconds, setSendIntervalSeconds] = useState(5);
  const [onlyUnsentLeads, setOnlyUnsentLeads] = useState(false);
  const [sendingMessages, setSendingMessages] = useState(false);

  const handleTriggerSync = async () => {
    try {
      setSyncingAllSheets(true);
      await api.post("/contacts/sheets/sync");
      alert("🔄 Auto-sync triggered! Updated rows will reflect in contacts & conversations.");
      setTimeout(fetchRegisteredSheets, 4000);
    } catch (err) {
      alert("Failed to start sync: " + (err.response?.data?.error || err.message));
    } finally {
      setSyncingAllSheets(false);
    }
  };

  const handleSendSheetMessages = async () => {
    if (!sheetToMessage) return;
    if (!selectedAccountForSend) return alert("Please select a WhatsApp Sender Account");
    if (!selectedPresetForSend) return alert("Please select a Template Preset");
    
    setSendingMessages(true);
    try {
      const res = await api.post(`/contacts/sheets/${sheetToMessage._id}/send-messages`, {
        whatsappAccountId: selectedAccountForSend,
        templatePresetId: selectedPresetForSend,
        intervalSeconds: sendIntervalSeconds,
        onlyUnsent: onlyUnsentLeads
      });
      alert(`🚀 ${res.data.message}`);
      setSheetToMessage(null);
      fetchRegisteredSheets();
    } catch (err) {
      alert("Failed to start message broadcast: " + (err.response?.data?.error || err.message));
    } finally {
      setSendingMessages(false);
    }
  };

  useEffect(() => {
    // Check google auth status
    api.get("/google-auth/status").then(res => setIsGoogleConnected(res.data.isAuthenticated)).catch(() => {});
    fetchRegisteredSheets();
  }, []);

  const fetchRegisteredSheets = async () => {
    try {
      const res = await api.get("/contacts/sheets");
      setRegisteredSheets(res.data.sheets || []);
    } catch (err) {}
  };

  const loginGoogle = useGoogleLogin({
    flow: 'auth-code',
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.readonly',
    onSuccess: async (codeResponse) => {
      try {
        await api.post("/google-auth/callback", { code: codeResponse.code });
        setIsGoogleConnected(true);
        alert("Google Account Connected! Background auto-sync is now active for your Live Sheets.");
      } catch (err) {
        alert("Failed to connect Google Account.");
      }
    },
  });

  const handleGoogleSheetSync = async () => {
    if (!sheetUrl) return;
    try {
      setImporting(true);
      const match = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (!match) {
        alert("Invalid Google Sheet URL. Please copy the full link.");
        return;
      }
      
      if (isGoogleConnected) {
        // Fetch headers to allow mapping
        const res = await api.get(`/contacts/sheets/headers?sheetUrl=${encodeURIComponent(sheetUrl)}`);
        if (res.data.headers) {
          const mockData = {};
          res.data.headers.forEach(h => {
             mockData[h] = "9999999999 Test Contact Data";
          });
          setTempImportData([mockData]); // Pass single mock row for mapper
          setAvailableSheetTabs(res.data.sheetNames || []);
          setSelectedSheetTab(res.data.selectedSheet || "");
          setEditingSyncConfig(null);
          setShowImportModal(false);
          setShowMapper(true);
        }
        return;
      }

      const sheetId = match[1];
      const res = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`);
      if (!res.ok) {
        throw new Error("Cannot access sheet. Make sure it is set to 'Anyone with the link can view' under Share settings.");
      }
      
      const csvText = await res.text();
      const wb = XLSX.read(csvText, { type: 'string' });
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      
      if (data.length === 0) {
        alert("Sheet is empty or invalid format.");
        return;
      }
      
      setTempImportData(data);
      setShowImportModal(false);
      setShowMapper(true);
    } catch(err) {
      alert(err.response?.data?.error || err.message);
    } finally {
      setImporting(false);
    }
  };


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
      const [fieldsRes, sectorsRes, sourcesRes, statusRes, winnersRes, usersRes, presetsRes] = await Promise.all([
        api.get("/custom-fields"),
        api.get("/sectors"),
        api.get("/sources"),
        api.get("/statuses"),
        api.get("/winners").catch(() => ({ data: [] })),
        api.get("/users").catch(() => ({ data: { users: [] } })),
        api.get("/presets?all=true").catch(() => ({ data: { presets: [] } }))
      ]);
      setCustomFields(fieldsRes.data);
      setSectors(sectorsRes.data);
      setSources(Array.isArray(sourcesRes.data) ? sourcesRes.data : []);
      setWinners(Array.isArray(winnersRes.data) ? winnersRes.data : []);
      setCustomStatuses(statusRes.data);
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
      setPresets(Array.isArray(presetsRes.data) ? presetsRes.data : []);
    } catch (err) {
      console.error("Meta fetch error:", err);
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

  const handleMappingComplete = async (processedContacts, standardMappings, customMappings, defaultAssignedTo, templatePreset, defaultWhatsAppAccount, defaultSource, defaultSector, messageInterval, selectedSheetTab, syncName) => {
    console.log("handleMappingComplete called with:", { defaultSource, defaultSector, defaultAssignedTo, messageInterval, selectedSheetTab });
    setImporting(true);
    try {
      if (isGoogleConnected && sheetUrl) {
        // Prepare the mapping for the backend
        let fieldMapping = {};
        if (standardMappings) {
          Object.entries(standardMappings).forEach(([crmKey, sheetHeader]) => {
            if (sheetHeader) fieldMapping[crmKey] = sheetHeader;
          });
        }
        if (customMappings) {
          Object.entries(customMappings).forEach(([crmKey, sheetHeader]) => {
            if (sheetHeader) fieldMapping[`customFields.${crmKey}`] = sheetHeader;
          });
        }

        await api.post("/contacts/sheets", { 
          sheetUrl, 
          sheetName: selectedSheetTab,
          syncName: syncName,
          whatsappAccountId: defaultWhatsAppAccount || activeAccount?._id,
          fieldMapping,
          assignedTo: defaultAssignedTo || null,
          templatePreset: templatePreset || null,
          defaultSource: defaultSource || null,
          defaultSector: defaultSector || null,
          messageInterval: messageInterval || 0
        });
        alert("Google Sheet successfully mapped and registered for Auto-Sync!");
        setSheetUrl("");
        fetchRegisteredSheets();
      } else {
        await api.post("/contacts/import", { contacts: processedContacts });
        alert(`Successfully imported ${processedContacts.length} leads!`);
      }
      setShowMapper(false);
      fetchContacts(1);
    } catch (err) {
      alert("Import/Sync setup failed. Please check your data format.");
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
        winners={winners}
        total={total}
        showImportModal={showImportModal}
        setShowImportModal={setShowImportModal}
        showAddModal={showAddModal}
        setShowAddModal={setShowAddModal}
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

      {/* Modals */}
      <AddContactModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        sectors={sectors}
        sources={sources}
        winners={winners}
        onSuccess={() => fetchContacts(1)}
      />

      {/* Drawer */}
      {showDrawer && selectedContact && (
        <ContactDrawer
          contact={selectedContact}
          onClose={() => setShowDrawer(false)}
          onEdit={() => setShowEditModal(true)}
          loadingTimeline={loadingTimeline}
          timelineEntries={timelineEntries}
          sectors={sectors}
          sources={sources}
          customStatuses={customStatuses}
          customFields={customFields}
          navigate={navigate}
          onOpenChat={handleOpenChat}
          onUpdateContact={handleUpdateContact}
        />
      )}

      {/* Import Modal - Step 1: Select File */}
      {showImportModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 7000, backdropFilter: "blur(4px)" }}>
          <div style={{ width: "550px", maxHeight: "95vh", overflowY: "auto", padding: "2rem", background: "white", borderRadius: "20px", boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}>
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

            <div style={{ margin: "2rem 0", display: "flex", alignItems: "center", gap: "15px" }}>
              <div style={{ flex: 1, height: "1px", background: "#eee" }}></div>
              <span style={{ fontSize: "0.85rem", color: "#999", fontWeight: "700", textTransform: "uppercase" }}>OR IMPORT FROM</span>
              <div style={{ flex: 1, height: "1px", background: "#eee" }}></div>
            </div>

            <div style={{ background: "#f8fafc", padding: "20px", borderRadius: "15px", border: "1px solid #eef2f6" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "15px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <FileSpreadsheet size={20} color="#0f9d58" />
                  <h4 style={{ margin: 0, color: "#1a1a1a", fontSize: "1rem", fontWeight: "800" }}>Live Google Sheet</h4>
                </div>
                {!isGoogleConnected ? (
                  <button onClick={() => loginGoogle()} style={{ background: "white", border: "1px solid #ddd", padding: "6px 12px", borderRadius: "6px", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "0.8rem", fontWeight: "700" }}>
                    <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="G" style={{ width: "14px" }} />
                    Connect Account
                  </button>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "0.75rem", background: "#e7fce3", color: "#008069", padding: "4px 8px", borderRadius: "12px", fontWeight: "800" }}>✓ Connected</span>
                    <button 
                      onClick={async () => {
                        if(window.confirm('Disconnect Google Account?')) {
                          try { await api.post('/google-auth/disconnect'); setIsGoogleConnected(false); } catch(err) { console.error(err); }
                        }
                      }} 
                      style={{ background: "none", border: "none", color: "#ef4444", fontSize: "0.75rem", fontWeight: "700", cursor: "pointer", textDecoration: "underline", padding: 0 }}
                    >
                      Disconnect
                    </button>
                  </div>
                )}
              </div>
              
              <p style={{ fontSize: "0.8rem", color: "#666", marginBottom: "15px" }}>
                {isGoogleConnected 
                  ? "Your sheets will automatically sync every 5 minutes in the background." 
                  : "Make sure your Google Sheet is set to \"Anyone with the link can view\" OR connect your Google account for private auto-sync."}
              </p>
              
              <div style={{ display: "flex", gap: "10px" }}>
                <input 
                  type="text" 
                  value={sheetUrl}
                  onChange={e => setSheetUrl(e.target.value)}
                  placeholder="Paste Google Sheet URL here..."
                  style={{ flex: 1, padding: "10px 15px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "0.9rem", outline: "none" }}
                />
                <button 
                  onClick={handleGoogleSheetSync}
                  disabled={importing || !sheetUrl}
                  style={{ padding: "10px 20px", borderRadius: "8px", background: "#0f9d58", color: "white", border: "none", fontWeight: "800", cursor: importing || !sheetUrl ? "not-allowed" : "pointer", opacity: importing || !sheetUrl ? 0.7 : 1 }}
                >
                  {importing ? "Processing..." : "Sync Now"}
                </button>
              </div>

              {registeredSheets.length > 0 && (
                <div style={{ marginTop: "20px", borderTop: "1px solid #eef2f6", paddingTop: "15px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <h5 style={{ fontSize: "0.85rem", fontWeight: "800", color: "#1e293b", margin: 0 }}>Currently Auto-Syncing ({registeredSheets.length})</h5>
                    <button
                      type="button"
                      disabled={syncingAllSheets}
                      onClick={handleTriggerSync}
                      style={{ padding: "4px 10px", fontSize: "0.72rem", fontWeight: "700", background: syncingAllSheets ? "#94a3b8" : "#00a884", color: "white", border: "none", borderRadius: "6px", cursor: syncingAllSheets ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "5px" }}
                    >
                      <RefreshCw size={12} className={syncingAllSheets ? "animate-spin" : ""} /> {syncingAllSheets ? "Syncing..." : "Sync Now"}
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "240px", overflowY: "auto" }}>
                    {registeredSheets.map(s => {
                      const isTemplateMissing = s.templatePreset && !s.templatePreset.template;
                      return (
                        <div key={s._id} 
                          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "white", borderRadius: "10px", border: "1px solid #e2e8f0", cursor: "pointer", transition: "all 0.2s" }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "#f8fafc"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "white"}
                          onClick={(e) => {
                            if (e.target.closest('a') || e.target.closest('button') || e.target.closest('svg')) return;
                            setFilters(prev => ({ ...prev, tag: `sheet_msg_${s._id}` }));
                            setShowImportModal(false);
                          }}
                        >
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ fontSize: "0.85rem", fontWeight: "800", color: "#1e293b" }}>{s.name || `Sheet (${s.spreadsheetId?.substring(0,6)}...)`}</span>
                              <a href={s.spreadsheetUrl} target="_blank" rel="noreferrer" style={{ fontSize: "0.7rem", fontWeight: "700", color: "#00a884", textDecoration: "none" }}>{s.sheetName}</a>
                            </div>
                            <div style={{ fontSize: "0.68rem", color: "#64748b", display: "flex", gap: "10px", alignItems: "center" }}>
                              <span>Leads: <strong>{s.taggedContactsCount || 0}</strong></span>
                              <span>Sent: <strong style={{ color: s.sentContactsCount > 0 ? "#059669" : "#64748b" }}>{s.sentContactsCount || 0}</strong></span>
                              <span>Added: <strong>{s.syncStats?.totalAdded || 0}</strong></span>
                            </div>
                            <div>
                              {s.templatePreset ? (
                                isTemplateMissing ? (
                                  <span style={{ fontSize: "0.62rem", color: "#dc2626", fontWeight: "800", background: "#fef2f2", padding: "1px 6px", borderRadius: "4px", border: "1px solid #fecaca" }}>
                                    ⚠️ Preset template missing in Meta!
                                  </span>
                                ) : (
                                  <span style={{ fontSize: "0.62rem", color: "#059669", fontWeight: "700", background: "#f0fdf4", padding: "1px 6px", borderRadius: "4px", border: "1px solid #bbf7d0" }}>
                                    💬 {s.templatePreset.name}
                                  </span>
                                )
                              ) : (
                                <span style={{ fontSize: "0.62rem", color: "#94a3b8" }}>No Preset</span>
                              )}
                            </div>
                          </div>
                          
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "0.65rem", fontWeight: "700", color: s.active ? "#0f9d58" : "#ef4444" }}>
                              {s.lastSyncedAt ? new Date(s.lastSyncedAt).toLocaleTimeString() : "Pending"}
                            </span>
                            
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSheetToMessage(s);
                                setSelectedAccountForSend(s.whatsappAccountId?._id || (activeAccount && !activeAccount.isAll ? activeAccount._id : ""));
                                setSelectedPresetForSend(s.templatePreset?._id || "");
                                setSendIntervalSeconds(s.messageInterval || 5);
                                setOnlyUnsentLeads(false);
                              }}
                              style={{
                                padding: "5px 10px",
                                fontSize: "0.7rem",
                                fontWeight: "800",
                                background: "#25d366",
                                color: "white",
                                border: "none",
                                borderRadius: "6px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px"
                              }}
                              title="Send WhatsApp Template Message to Sheet Leads"
                            >
                              <Send size={11} /> Send Msg
                            </button>

                            <Edit3
                              size={16}
                              color="#1d4ed8"
                              style={{ cursor: "pointer" }}
                              onClick={async (e) => {
                                e.stopPropagation();
                                setImporting(true);
                                try {
                                  const res = await api.get(`/contacts/sheets/headers?sheetUrl=${encodeURIComponent(s.spreadsheetUrl)}&sheetName=${encodeURIComponent(s.sheetName)}`);
                                  if (res.data.headers) {
                                    const mockData = {};
                                    res.data.headers.forEach(h => { mockData[h] = "9999999999 Test Contact Data"; });
                                    setTempImportData([mockData]);
                                    setAvailableSheetTabs(res.data.sheetNames || [s.sheetName]);
                                    setSelectedSheetTab(res.data.selectedSheet || s.sheetName);
                                    setEditingSyncConfig(s);
                                    setSheetUrl(s.spreadsheetUrl);
                                    setShowImportModal(false);
                                    setShowMapper(true);
                                  }
                                } catch(err) {
                                  alert("Failed to fetch sheet configuration.");
                                } finally {
                                  setImporting(false);
                                }
                              }}
                            />
                            <Trash2 
                              size={16} 
                              color="#ef4444" 
                              style={{ cursor: "pointer" }} 
                              onClick={async (e) => {
                                e.stopPropagation();
                                if(window.confirm('Stop auto-sync and remove this sheet?')) {
                                  try {
                                    await api.delete(`/contacts/sheets/${s._id}`);
                                    fetchRegisteredSheets();
                                  } catch(err) {
                                    alert('Failed to delete sheet');
                                  }
                                }
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: "15px", marginTop: "1.5rem" }}>
              <button onClick={() => setShowImportModal(false)} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "2px solid #eee", background: "white", fontWeight: "800", cursor: "pointer" }}>Cancel</button>
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
        sources={sources}
        winners={winners}
        users={users}
        presets={presets}
        accounts={accounts}
        activeAccount={activeAccount}
        availableSheetTabs={availableSheetTabs}
        selectedSheetTab={selectedSheetTab}
        initialConfig={editingSyncConfig}
        onSheetTabChange={async (newTab) => {
          setImporting(true);
          try {
            const res = await api.get(`/contacts/sheets/headers?sheetUrl=${encodeURIComponent(sheetUrl)}&sheetName=${encodeURIComponent(newTab)}`);
            if (res.data.headers) {
              const mockData = {};
              res.data.headers.forEach(h => {
                 mockData[h] = "9999999999 Test Contact Data";
              });
              setTempImportData([mockData]);
              setSelectedSheetTab(res.data.selectedSheet || newTab);
            }
          } catch(err) {
            alert("Failed to fetch headers for the selected sheet.");
          } finally {
            setImporting(false);
          }
        }}
      />

      {/* Sheet Send Message Modal */}
      {sheetToMessage && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }}>
          <div style={{ background: "white", borderRadius: "16px", padding: "24px", width: "480px", maxWidth: "90%", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "800", color: "#1e293b", display: "flex", alignItems: "center", gap: "8px" }}>
                <Send size={18} color="#25d366" /> Send Message to Sheet Leads
              </h3>
              <button onClick={() => setSheetToMessage(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ background: "#f8fafc", borderRadius: "10px", padding: "12px", marginBottom: "16px", border: "1px solid #e2e8f0" }}>
              <div style={{ fontWeight: "700", color: "#0f172a", fontSize: "0.9rem" }}>{sheetToMessage.name}</div>
              <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "4px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <span>Tab: <strong>{sheetToMessage.sheetName}</strong></span>
                <span>Total Leads: <strong>{sheetToMessage.taggedContactsCount || 0}</strong></span>
                <span>Already Messaged: <strong style={{ color: "#059669" }}>{sheetToMessage.sentContactsCount || 0}</strong></span>
              </div>
            </div>

            {sheetToMessage.templatePreset && !sheetToMessage.templatePreset.template && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", padding: "10px 12px", marginBottom: "16px", display: "flex", gap: "8px", alignItems: "center" }}>
                <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0 }} />
                <div style={{ fontSize: "0.75rem", color: "#991b1b" }}>
                  The previously saved preset (<strong>{sheetToMessage.templatePreset.name}</strong>) has a missing template in Meta. Please choose a valid preset below.
                </div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "0.72rem", fontWeight: "800", color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                  📱 WhatsApp Sender Account
                </label>
                <select
                  value={selectedAccountForSend}
                  onChange={(e) => {
                    setSelectedAccountForSend(e.target.value);
                    setSelectedPresetForSend("");
                  }}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1.5px solid #cbd5e1", fontSize: "0.85rem", fontWeight: "600", outline: "none", background: "white" }}
                >
                  <option value="">-- Select Sender Account --</option>
                  {accounts.filter(a => !a.isAll).map(a => (
                    <option key={a._id} value={a._id}>{a.name} (+{a.phoneNumberId})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "0.72rem", fontWeight: "800", color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                  💬 Template Preset
                </label>
                <select
                  value={selectedPresetForSend}
                  onChange={(e) => setSelectedPresetForSend(e.target.value)}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1.5px solid #cbd5e1", fontSize: "0.85rem", fontWeight: "600", outline: "none", background: "white" }}
                >
                  <option value="">-- Select Template Preset --</option>
                  {presets.map(p => {
                    const matches = !p.whatsappAccountId || p.whatsappAccountId === selectedAccountForSend || p.whatsappAccountId?._id === selectedAccountForSend;
                    if (!matches) return null;
                    const hasTpl = !!p.template?.name;
                    return (
                      <option key={p._id} value={p._id} disabled={!hasTpl}>
                        {p.name} {hasTpl ? `(Template: ${p.template.name})` : "❌ (Template Missing)"}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "0.72rem", fontWeight: "800", color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                  ⏱️ Message Interval (Seconds between messages)
                </label>
                <input
                  type="number"
                  min="1"
                  value={sendIntervalSeconds}
                  onChange={(e) => setSendIntervalSeconds(Number(e.target.value))}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1.5px solid #cbd5e1", fontSize: "0.85rem", fontWeight: "600", outline: "none" }}
                />
                <div style={{ fontSize: "0.68rem", color: "#64748b", marginTop: "4px" }}>
                  Interval between messages helps avoid Meta spam blocks. (Default: 5s)
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#f8fafc", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <input
                  type="checkbox"
                  id="onlyUnsentCheckbox"
                  checked={onlyUnsentLeads}
                  onChange={(e) => setOnlyUnsentLeads(e.target.checked)}
                  style={{ width: "16px", height: "16px", cursor: "pointer" }}
                />
                <label htmlFor="onlyUnsentCheckbox" style={{ fontSize: "0.78rem", fontWeight: "600", color: "#334155", cursor: "pointer" }}>
                  Only send to leads who haven't received message yet ({Math.max((sheetToMessage.taggedContactsCount || 0) - (sheetToMessage.sentContactsCount || 0), 0)} leads)
                </label>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
              <button
                type="button"
                onClick={() => setSheetToMessage(null)}
                disabled={sendingMessages}
                style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1.5px solid #cbd5e1", background: "white", fontWeight: "700", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={sendingMessages || !selectedAccountForSend || !selectedPresetForSend}
                onClick={handleSendSheetMessages}
                style={{
                  flex: 2,
                  padding: "10px",
                  borderRadius: "8px",
                  border: "none",
                  background: sendingMessages || !selectedAccountForSend || !selectedPresetForSend ? "#94a3b8" : "#25d366",
                  color: "white",
                  fontWeight: "800",
                  cursor: sendingMessages || !selectedAccountForSend || !selectedPresetForSend ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px"
                }}
              >
                {sendingMessages ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Starting Broadcast...
                  </>
                ) : (
                  <>
                    <Send size={16} /> Send Messages ({onlyUnsentLeads ? Math.max((sheetToMessage.taggedContactsCount || 0) - (sheetToMessage.sentContactsCount || 0), 0) : (sheetToMessage.taggedContactsCount || 0)})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <EditContactModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingContact(null);
          }}
          contact={editingContact || selectedContact}
          onUpdate={handleUpdateContact}
          sectors={sectors}
          sources={sources}
          winners={winners}
          customFields={customFields}
          customStatuses={customStatuses}
        />
      )}


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
