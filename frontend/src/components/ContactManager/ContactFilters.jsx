import React from "react";
import { Search, Filter, Layers, List, LayoutGrid, Download, Upload, Plus } from "lucide-react";

const ContactFilters = ({ 
  filters, setFilters, handleSearch, viewMode, setViewMode, 
  customStatuses, sectors, total, showImportModal, setShowImportModal,
  isUniversalSelect, selectedCount, handleSendCampaign
}) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginBottom: "1.5rem" }}>
      {/* Header Info */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "white", padding: "1.5rem", borderRadius: "15px", boxShadow: "0 4px 20px rgba(0,0,0,0.05)", border: "1px solid #eef2f6" }}>
        <div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: "900", color: "#1a1a1a", margin: 0, letterSpacing: "-0.5px" }}>Lead Management</h2>
          <p style={{ color: "#666", fontSize: "0.9rem", margin: "5px 0 0", fontWeight: "600" }}>
            Viewing <span style={{ color: "#2ecc71" }}>{total.toLocaleString()}</span> leads in Database
          </p>
        </div>
        
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          {/* View Switcher */}
          <div style={{ display: "flex", background: "#f1f5f9", padding: "4px", borderRadius: "10px", marginRight: "10px" }}>
            <button 
              onClick={() => setViewMode("list")} 
              style={{ padding: "8px 15px", borderRadius: "8px", border: "none", background: viewMode === "list" ? "white" : "transparent", boxShadow: viewMode === "list" ? "0 2px 5px rgba(0,0,0,0.1)" : "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontWeight: "800", fontSize: "0.8rem", color: viewMode === "list" ? "#1a1a1a" : "#64748b" }}
            >
              <List size={16} /> List
            </button>
            <button 
              onClick={() => setViewMode("kanban")} 
              style={{ padding: "8px 15px", borderRadius: "8px", border: "none", background: viewMode === "kanban" ? "white" : "transparent", boxShadow: viewMode === "kanban" ? "0 2px 5px rgba(0,0,0,0.1)" : "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontWeight: "800", fontSize: "0.8rem", color: viewMode === "kanban" ? "#1a1a1a" : "#64748b" }}
            >
              <LayoutGrid size={16} /> Board
            </button>
          </div>

          <button onClick={() => setShowImportModal(true)} style={{ padding: "10px 18px", borderRadius: "10px", border: "2px solid #2ecc71", color: "#2ecc71", background: "white", fontSize: "0.85rem", fontWeight: "800", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
            <Upload size={16} /> Import
          </button>
          
          {selectedCount > 0 && (
            <button onClick={handleSendCampaign} style={{ padding: "10px 22px", borderRadius: "10px", background: "#2ecc71", color: "white", border: "none", fontSize: "0.85rem", fontWeight: "900", cursor: "pointer", boxShadow: "0 6px 15px rgba(46, 204, 113, 0.3)", display: "flex", alignItems: "center", gap: "8px" }}>
              Bulk Action ({selectedCount})
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div style={{ padding: "12px 20px", display: "flex", gap: "12px", alignItems: "center", background: "white", borderRadius: "12px", border: "1px solid #eef2f6", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
        <div style={{ flex: 1, position: "relative" }}>
          <Search size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#999" }} />
          <input 
            type="text" 
            placeholder="Search leads by name, phone or tags..." 
            style={{ width: "100%", padding: "10px 12px 10px 40px", borderRadius: "10px", border: "2px solid #f0f0f0", fontSize: "0.9rem", fontWeight: "600", outline: "none", color: "#1a1a1a" }} 
            value={filters.search} 
            onChange={e => setFilters({ ...filters, search: e.target.value })} 
            onKeyDown={e => e.key === "Enter" && handleSearch()}
          />
        </div>

        <select 
          style={{ padding: "10px", borderRadius: "10px", border: "2px solid #f0f0f0", fontSize: "0.85rem", fontWeight: "700", color: "#444", background: "#fff", cursor: "pointer" }} 
          value={filters.status} 
          onChange={e => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">All Statuses</option>
          {customStatuses.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
        </select>

        <select 
          style={{ padding: "10px", borderRadius: "10px", border: "2px solid #f0f0f0", fontSize: "0.85rem", fontWeight: "700", color: "#444", background: "#fff", cursor: "pointer" }} 
          value={filters.sector} 
          onChange={e => setFilters({ ...filters, sector: e.target.value })}
        >
          <option value="">All Sectors</option>
          {sectors.map(s => <option key={s._id} value={s.name}>{s.name}</option>)}
        </select>

        <button onClick={handleSearch} style={{ background: "#1a1a1a", color: "white", padding: "10px 24px", borderRadius: "10px", border: "none", fontWeight: "800", fontSize: "0.85rem", cursor: "pointer", transition: "0.2s" }}>Apply Filters</button>
      </div>
    </div>
  );
};

export default ContactFilters;
