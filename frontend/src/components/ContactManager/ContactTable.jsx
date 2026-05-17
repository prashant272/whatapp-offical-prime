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
      borderBottom: "1px solid #f1f5f9", 
      transition: "0.2s", 
      background: isSelected ? "#f0fdf4" : "white" 
    }}>
      <td style={{ padding: "10px 20px" }}>
        <input 
          type="checkbox" 
          checked={isSelected} 
          onChange={() => toggleSelect(contact._id)} 
          style={{ cursor: "pointer", transform: "scale(1.1)" }} 
        />
      </td>
      <td style={{ padding: "10px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ 
            width: "32px", height: "32px", borderRadius: "10px", 
            background: contact.priority ? priorityColors[contact.priority].bg : "#f8fafc", 
            display: "flex", alignItems: "center", justifyContent: "center",
            border: contact.priority ? `1px solid ${priorityColors[contact.priority].border}` : "none",
            flexShrink: 0
          }}>
            <User size={16} color={contact.priority ? priorityColors[contact.priority].text : "#94a3b8"} />
          </div>
          <div onClick={() => handleContactClick(contact)} style={{ cursor: "pointer", overflow: "hidden" }}>
            <div style={{ fontWeight: "800", color: "#1e293b", fontSize: "0.85rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "200px" }}>
              {contact.name}
            </div>
            <div style={{ color: "#64748b", display: "flex", alignItems: "center", gap: "4px", fontSize: "0.7rem", fontWeight: "600" }}>
              <Smartphone size={10} /> {contact.phone}
            </div>
          </div>
        </div>
      </td>
      <td style={{ padding: "10px 20px" }}>
        <div style={{ fontWeight: "700", color: "#00a884", fontSize: "0.7rem" }}>{contact.whatsappAccountId?.name || "Global"}</div>
        <div style={{ color: "#94a3b8", fontSize: "0.65rem", fontWeight: "600" }}>{contact.sector || "Unassigned"}</div>
      </td>
      <td style={{ padding: "10px 20px" }}>
        {contact.status && (
          <span style={{ 
            padding: "2px 8px", borderRadius: "6px", fontSize: "0.65rem", 
            fontWeight: "800", background: getStatusColor(contact.status).bg, 
            color: getStatusColor(contact.status).text, border: `1px solid ${getStatusColor(contact.status).text}15`
          }}>
            {contact.status.toUpperCase()}
          </span>
        )}
      </td>
      <td style={{ padding: "10px 20px" }}>
        <div style={{ display: "flex", gap: "6px" }}>
          {contact.internalNotes?.length > 0 && <StickyNote size={12} color="#6366f1" title="Has Notes" />}
          {contact.reminders?.some(r => !r.isCompleted) && <Bell size={12} color="#f59e0b" title="Pending Reminder" />}
          {contact.priority && <Star size={12} color={priorityColors[contact.priority].text} fill={priorityColors[contact.priority].text} />}
        </div>
      </td>
      {customFields.map(field => (
        <td key={field._id} style={{ padding: "10px 20px", color: "#334155", fontSize: "0.8rem", fontWeight: "600" }}>
          {contact.customFields?.[field.name] || "-"}
        </td>
      ))}
      <td style={{ padding: "10px 24px", textAlign: "right" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button 
            onClick={() => navigate(`/chats/${contact.conversationId || `new:${contact.phone}`}`)} 
            style={{ background: "#f0fdf4", border: "1px solid #dcfce7", borderRadius: "6px", padding: "5px", color: "#00a884", cursor: "pointer" }}
          >
            <Send size={14} />
          </button>
          <button 
            onClick={() => { setEditingContact({ ...contact }); setShowEditModal(true); }} 
            style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "5px", color: "#475569", cursor: "pointer" }}
          >
            <Pencil size={14} />
          </button>
          <button 
            onClick={() => handleDeleteContact(contact._id)} 
            style={{ background: "#fef2f2", border: "1px solid #fee2e2", borderRadius: "8px", padding: "5px", color: "#ef4444", cursor: "pointer" }}
          >
            <Trash2 size={14} />
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
    <div style={{ background: "white", borderRadius: "16px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,0.04)" }}>
      <div className="chat-scroll" style={{ flex: 1, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", minWidth: "1100px" }}>
          <thead style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, zIndex: 10 }}>
            {isAllSelectedOnPage && total > contacts.length && (
              <tr>
                <th colSpan={20} style={{ background: "#f0fdf4", padding: "8px", textAlign: "center", borderBottom: "1px solid #dcfce7" }}>
                  {isUniversalSelect ? (
                    <span style={{ fontSize: "0.75rem", color: "#166534", fontWeight: "800" }}>
                      ✅ ALL {total.toLocaleString()} CONTACTS SELECTED. <button onClick={() => { setIsUniversalSelect(false); setSelectedContactIds(new Set()); }} style={{ color: "#ef4444", border: "none", background: "none", cursor: "pointer", textDecoration: "underline", fontWeight: "800", marginLeft: "10px" }}>Clear All</button>
                    </span>
                  ) : (
                    <span style={{ fontSize: "0.75rem", color: "#334155", fontWeight: "700" }}>
                      All {contacts.length} on this page selected. <button onClick={() => setIsUniversalSelect(true)} style={{ color: "#10b981", border: "none", background: "none", cursor: "pointer", textDecoration: "underline", fontWeight: "900", marginLeft: "10px" }}>Select all {total.toLocaleString()} leads</button>
                    </span>
                  )}
                </th>
              </tr>
            )}
            <tr style={{ color: "#64748b", fontSize: "0.7rem", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.8px" }}>
              <th style={{ padding: "12px 24px", width: "50px" }}><input type="checkbox" checked={isAllSelectedOnPage} onChange={handleSelectAllOnPage} style={{ transform: "scale(1.1)" }} /></th>
              <th style={{ padding: "12px 12px", textAlign: "left" }}>Lead Info</th>
              <th style={{ padding: "12px 24px", textAlign: "left" }}>Channel / Sector</th>
              <th style={{ padding: "12px 24px", textAlign: "left" }}>Status</th>
              <th style={{ padding: "12px 24px", textAlign: "left" }}>Indicators</th>
              {customFields.map(f => <th key={f._id} style={{ padding: "12px 24px", textAlign: "left" }}>{f.label}</th>)}
              <th style={{ padding: "12px 24px", textAlign: "right" }}>Actions</th>
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
