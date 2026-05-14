import React, { memo } from "react";
import { User, Smartphone, Layers, ExternalLink, Pencil, Trash2, Send, Star, StickyNote, Bell } from "lucide-react";

const ContactRow = memo(({ 
  contact, isSelected, toggleSelect, handleContactClick, 
  getStatusColor, customFields, navigate, handleDeleteContact, 
  setEditingContact, setShowEditModal 
}) => {
  const priorityColors = {
    Hot: { bg: "#fee2e2", text: "#dc2626", border: "#fca5a5" },
    Warm: { bg: "#fef3c7", text: "#d97706", border: "#fcd34d" },
    Cold: { bg: "#f1f5f9", text: "#475569", border: "#e2e8f0" }
  };

  return (
    <tr style={{ 
      borderBottom: "1px solid #f0f0f0", 
      transition: "0.1s", 
      background: isSelected ? "#f0fdf4" : "white" 
    }}>
      <td style={{ padding: "15px 24px" }}>
        <input 
          type="checkbox" 
          checked={isSelected} 
          onChange={() => toggleSelect(contact._id)} 
          style={{ cursor: "pointer", transform: "scale(1.2)" }} 
        />
      </td>
      <td style={{ padding: "15px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ 
            width: "40px", height: "40px", borderRadius: "12px", 
            background: contact.priority ? priorityColors[contact.priority].bg : "#f8fafc", 
            display: "flex", alignItems: "center", justifyContent: "center",
            border: contact.priority ? `1px solid ${priorityColors[contact.priority].border}` : "none"
          }}>
            <User size={20} color={contact.priority ? priorityColors[contact.priority].text : "#94a3b8"} />
          </div>
          <div onClick={() => handleContactClick(contact)} style={{ cursor: "pointer" }}>
            <div style={{ fontWeight: "900", color: "#1a1a1a", fontSize: "0.9rem" }}>
              {contact.name}
              {contact.priority && (
                <span style={{ 
                  marginLeft: "8px", fontSize: "0.65rem", padding: "2px 6px", 
                  borderRadius: "6px", background: priorityColors[contact.priority].bg, 
                  color: priorityColors[contact.priority].text, border: `1px solid ${priorityColors[contact.priority].border}`
                }}>
                  {contact.priority.toUpperCase()}
                </span>
              )}
            </div>
            <div style={{ color: "#666", display: "flex", alignItems: "center", gap: "5px", fontSize: "0.75rem", fontWeight: "600", marginTop: "2px" }}>
              <Smartphone size={12} /> {contact.phone}
            </div>
          </div>
        </div>
      </td>
      <td style={{ padding: "15px 24px" }}>
        <div style={{ fontWeight: "800", color: "#00a884", fontSize: "0.75rem" }}>{contact.whatsappAccountId?.name || "Global"}</div>
        <div style={{ color: "#999", fontSize: "0.7rem", fontWeight: "600" }}>{contact.sector || "Unassigned"}</div>
      </td>
      <td style={{ padding: "15px 24px" }}>
        {contact.status && (
          <span style={{ 
            padding: "4px 10px", borderRadius: "10px", fontSize: "0.7rem", 
            fontWeight: "900", background: getStatusColor(contact.status).bg, 
            color: getStatusColor(contact.status).text, border: `1px solid ${getStatusColor(contact.status).text}20`
          }}>
            {contact.status.toUpperCase()}
          </span>
        )}
      </td>
      <td style={{ padding: "15px 24px" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          {contact.internalNotes?.length > 0 && <StickyNote size={14} color="#6366f1" title="Has Notes" />}
          {contact.reminders?.some(r => !r.isCompleted) && <Bell size={14} color="#f59e0b" title="Pending Reminder" />}
        </div>
      </td>
      {customFields.map(field => (
        <td key={field._id} style={{ padding: "15px 24px", color: "#1a1a1a", fontSize: "0.85rem", fontWeight: "600" }}>
          {contact.customFields?.[field.name] || "-"}
        </td>
      ))}
      <td style={{ padding: "15px 24px", textAlign: "right" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button 
            onClick={() => navigate(`/chats/${contact.conversationId || `new:${contact.phone}`}`)} 
            style={{ background: "#e7fce3", border: "1px solid #dcfce7", borderRadius: "8px", padding: "6px", color: "#008069", cursor: "pointer" }}
            title="Open WhatsApp Chat"
          >
            <Send size={16} />
          </button>
          <button 
            onClick={() => { setEditingContact({ ...contact }); setShowEditModal(true); }} 
            style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "6px", color: "#475569", cursor: "pointer" }}
            title="Edit Contact"
          >
            <Pencil size={16} />
          </button>
          <button 
            onClick={() => handleDeleteContact(contact._id)} 
            style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: "8px", padding: "6px", color: "#dc2626", cursor: "pointer" }}
            title="Delete Lead"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </td>
    </tr>
  );
});

const ContactTable = ({ 
  contacts, loading, selectedContactIds, toggleSelect, 
  isAllSelectedOnPage, handleSelectAllOnPage, total, 
  isUniversalSelect, setIsUniversalSelect, setSelectedContactIds,
  handleContactClick, getStatusColor, customFields, navigate,
  handleDeleteContact, setEditingContact, setShowEditModal
}) => {
  return (
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
              <th style={{ padding: "15px 24px", textAlign: "left" }}>Channel / Sector</th>
              <th style={{ padding: "15px 24px", textAlign: "left" }}>Status</th>
              <th style={{ padding: "15px 24px", textAlign: "left" }}>Indicators</th>
              {customFields.map(f => <th key={f._id} style={{ padding: "15px 24px", textAlign: "left" }}>{f.label}</th>)}
              <th style={{ padding: "15px 24px", textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map(c => (
              <ContactRow 
                key={c._id}
                contact={c}
                isSelected={selectedContactIds.has(c._id)}
                toggleSelect={toggleSelect}
                handleContactClick={handleContactClick}
                getStatusColor={getStatusColor}
                customFields={customFields}
                navigate={navigate}
                handleDeleteContact={handleDeleteContact}
                setEditingContact={setEditingContact}
                setShowEditModal={setShowEditModal}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ContactTable;
