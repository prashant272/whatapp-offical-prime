import React, { useState, useMemo } from "react";
import { User, Smartphone, Send, MoreVertical, Star, GripVertical, Plus } from "lucide-react";

const KanbanCard = ({ contact, handleContactClick, navigate, onDragStart, onOpenChat }) => {
  const priorityColors = {
    Hot: { bg: "#fee2e2", text: "#dc2626", dot: "#ef4444" },
    Warm: { bg: "#fef3c7", text: "#d97706", dot: "#f59e0b" },
    Cold: { bg: "#f1f5f9", text: "#475569", dot: "#94a3b8" }
  };

  return (
    <div 
      draggable
      onDragStart={(e) => onDragStart(e, contact)}
      style={{ 
        background: "white", padding: "1.2rem", borderRadius: "12px", 
        border: "1px solid #eef2f6", boxShadow: "0 2px 8px rgba(0,0,0,0.03)", 
        cursor: "grab", marginBottom: "12px", transition: "0.2s" 
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = "0 6px 15px rgba(0,0,0,0.06)"}
      onMouseLeave={e => e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.03)"}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: contact.priority ? priorityColors[contact.priority].dot : "#cbd5e1" }}></div>
          <span style={{ fontSize: "0.7rem", fontWeight: "900", color: "#94a3b8", textTransform: "uppercase" }}>{contact.sector || "General"}</span>
        </div>
        <GripVertical size={14} color="#cbd5e1" />
      </div>

      <div onClick={() => handleContactClick(contact)} style={{ cursor: "pointer" }}>
        <h5 style={{ margin: "0 0 5px", fontSize: "0.9rem", fontWeight: "900", color: "#1a1a1a" }}>{contact.name}</h5>
        <p style={{ margin: 0, fontSize: "0.75rem", color: "#666", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px" }}>
          <Smartphone size={12} /> {contact.phone}
        </p>
      </div>

      <div style={{ marginTop: "15px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #f8fafc", paddingTop: "10px" }}>
        <div style={{ display: "flex", gap: "5px" }}>
          {contact.priority && (
            <span style={{ fontSize: "0.6rem", padding: "2px 6px", borderRadius: "6px", background: priorityColors[contact.priority].bg, color: priorityColors[contact.priority].text, fontWeight: "900" }}>
              {contact.priority}
            </span>
          )}
        </div>
        <button 
          onClick={() => onOpenChat ? onOpenChat(contact) : navigate(`/chats/${contact.conversationId || `new:${contact.phone}`}`)}
          style={{ padding: "5px", borderRadius: "6px", border: "none", background: "#e7fce3", color: "#008069", cursor: "pointer" }}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
};

const KanbanColumn = ({ status, contacts, handleContactClick, navigate, onDrop, onDragOver, onDragStart, onOpenChat }) => {
  return (
    <div 
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, status)}
      style={{ 
        flex: 1, minWidth: "300px", background: "#f8fafc", borderRadius: "15px", 
        padding: "1.2rem", display: "flex", flexDirection: "column", height: "100%",
        border: "1px solid #eef2f6"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <h4 style={{ margin: 0, fontSize: "0.9rem", fontWeight: "900", color: "#1a1a1a", textTransform: "uppercase", letterSpacing: "0.5px" }}>{status}</h4>
          <span style={{ background: "white", padding: "2px 8px", borderRadius: "10px", fontSize: "0.75rem", fontWeight: "900", color: "#64748b", border: "1px solid #e2e8f0" }}>{contacts.length}</span>
        </div>
        <Plus size={18} color="#94a3b8" style={{ cursor: "pointer" }} />
      </div>

      <div className="chat-scroll" style={{ flex: 1, overflowY: "auto" }}>
        {contacts.map(c => (
          <KanbanCard 
            key={c._id} 
            contact={c} 
            handleContactClick={handleContactClick} 
            navigate={navigate} 
            onDragStart={onDragStart}
            onOpenChat={onOpenChat}
          />
        ))}
      </div>
    </div>
  );
};

const ContactKanban = ({ contacts, customStatuses, handleContactClick, navigate, onUpdateStatus, onOpenChat }) => {
  const columns = useMemo(() => {
    const defaultStatuses = ["New", "Follow-up", "Interested", "Converted", "Closed"];
    const allStatuses = customStatuses.length > 0 ? customStatuses.map(s => s.name) : defaultStatuses;
    
    const grouped = {};
    allStatuses.forEach(s => grouped[s] = []);
    
    contacts.forEach(c => {
      const status = c.status || allStatuses[0];
      if (grouped[status]) grouped[status].push(c);
      else {
        // Fallback for custom statuses not in list
        if (!grouped["Others"]) grouped["Others"] = [];
        grouped["Others"].push(c);
      }
    });
    
    return grouped;
  }, [contacts, customStatuses]);

  const [draggedContact, setDraggedContact] = useState(null);

  const handleDragStart = (e, contact) => {
    setDraggedContact(contact);
    e.dataTransfer.setData("contactId", contact._id);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, newStatus) => {
    e.preventDefault();
    const contactId = e.dataTransfer.getData("contactId");
    if (draggedContact && draggedContact.status !== newStatus) {
      onUpdateStatus(contactId, newStatus);
    }
    setDraggedContact(null);
  };

  return (
    <div style={{ display: "flex", gap: "20px", height: "100%", overflowX: "auto", paddingBottom: "1rem" }} className="chat-scroll">
      {Object.entries(columns).map(([status, items]) => (
        <KanbanColumn 
          key={status}
          status={status}
          contacts={items}
          handleContactClick={handleContactClick}
          navigate={navigate}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onOpenChat={onOpenChat}
        />
      ))}
    </div>
  );
};

export default ContactKanban;
