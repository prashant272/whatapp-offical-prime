import React from "react";
import { Search, Filter, Layers, List, LayoutGrid, Download, Upload, Plus } from "lucide-react";

const ContactFilters = ({ 
  filters, setFilters, handleSearch, viewMode, setViewMode, 
  customStatuses, sectors, total, showImportModal, setShowImportModal,
  isUniversalSelect, selectedCount, handleSendCampaign
}) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1rem" }}>
      {/* Integrated Header & Filter Toolbar */}
      <div style={{ 
        display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", 
        background: "white", padding: "12px 20px", borderRadius: "16px", 
        boxShadow: "0 4px 20px rgba(0,0,0,0.03)", border: "1px solid #e2e8f0" 
      }}>
        <div style={{ flexShrink: 0, marginRight: "10px" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: "900", color: "#1e293b", margin: 0, display: "flex", alignItems: "center", gap: "10px" }}>
            Leads <span style={{ fontSize: "0.75rem", background: "#f1f5f9", padding: "2px 8px", borderRadius: "20px", color: "#64748b" }}>{total.toLocaleString()}</span>
          </h2>
        </div>

        {/* Search Bar */}
        <div style={{ flex: 1, minWidth: "250px", position: "relative" }}>
          <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
          <input 
            type="text" 
            placeholder="Search by name, phone or tags..." 
            style={{ width: "100%", padding: "8px 12px 8px 32px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "0.8rem", fontWeight: "600", outline: "none", color: "#1e293b", background: "#f8fafc" }} 
            value={filters.search} 
            onChange={e => setFilters({ ...filters, search: e.target.value })} 
            onKeyDown={e => e.key === "Enter" && handleSearch()}
          />
        </div>

        {/* Quick Selects */}
        <select 
          style={{ padding: "8px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "0.75rem", fontWeight: "700", color: "#334155", background: "white", cursor: "pointer" }} 
          value={filters.status} 
          onChange={e => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">Status</option>
          {customStatuses.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
        </select>

        <select 
          style={{ padding: "8px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "0.75rem", fontWeight: "700", color: "#334155", background: "white", cursor: "pointer" }} 
          value={filters.sector} 
          onChange={e => setFilters({ ...filters, sector: e.target.value })}
        >
          <option value="">Sector</option>
          {sectors.map(s => <option key={s._id} value={s.name}>{s.name}</option>)}
        </select>

        {/* Actions */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <div style={{ display: "flex", background: "#f1f5f9", padding: "2px", borderRadius: "8px" }}>
            <button onClick={() => setViewMode("list")} style={{ padding: "6px 12px", borderRadius: "6px", border: "none", background: viewMode === "list" ? "white" : "transparent", boxShadow: viewMode === "list" ? "0 2px 4px rgba(0,0,0,0.05)" : "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontWeight: "800", fontSize: "0.7rem", color: viewMode === "list" ? "#1e293b" : "#64748b" }}><List size={14} /> List</button>
            <button onClick={() => setViewMode("kanban")} style={{ padding: "6px 12px", borderRadius: "6px", border: "none", background: viewMode === "kanban" ? "white" : "transparent", boxShadow: viewMode === "kanban" ? "0 2px 4px rgba(0,0,0,0.05)" : "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontWeight: "800", fontSize: "0.7rem", color: viewMode === "kanban" ? "#1e293b" : "#64748b" }}><LayoutGrid size={14} /> Board</button>
          </div>

          <button onClick={() => setShowImportModal(true)} style={{ padding: "8px 14px", borderRadius: "10px", border: "1px solid #10b981", color: "#10b981", background: "white", fontSize: "0.75rem", fontWeight: "800", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
            <Upload size={14} /> Import
          </button>
          
          {selectedCount > 0 && (
            <button onClick={handleSendCampaign} style={{ padding: "8px 16px", borderRadius: "10px", background: "#10b981", color: "white", border: "none", fontSize: "0.75rem", fontWeight: "900", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
              <Send size={14} /> Action ({selectedCount})
            </button>
          )}
        </div>
      </div>
    </div>
  );
};


export default ContactFilters;
