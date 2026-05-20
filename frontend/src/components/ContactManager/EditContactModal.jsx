import React, { useState, useEffect } from "react";
import { X, User, Smartphone, Save } from "lucide-react";
import api from "../../api";

const EditContactModal = ({ isOpen, onClose, contact, onUpdate, sectors, customFields }) => {
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (contact) {
      setFormData({
        name: contact.name || "",
        phone: contact.phone || "",
        sector: contact.sector || "",
        priority: contact.priority || "",
        status: contact.status || "",
        customFields: contact.customFields || {}
      });
    }
  }, [contact]);

  if (!isOpen || !contact) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put(`/contacts/${contact._id}`, formData);
      onUpdate(res.data);
      onClose();
    } catch (err) {
      alert("Failed to update contact");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9000, backdropFilter: "blur(2px)" }}>
      <div style={{ background: "white", width: "500px", borderRadius: "16px", padding: "24px", boxShadow: "0 10px 40px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: "800", color: "#1e293b" }}>Edit Lead</h2>
          <X size={20} cursor="pointer" onClick={onClose} color="#64748b" />
        </div>
        
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: "700", color: "#475569", marginBottom: "4px", display: "block" }}>Name</label>
            <input 
              type="text" 
              value={formData.name} 
              onChange={e => setFormData({...formData, name: e.target.value})}
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0", outline: "none" }}
              required 
            />
          </div>
          
          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: "700", color: "#475569", marginBottom: "4px", display: "block" }}>Phone</label>
            <input 
              type="text" 
              value={formData.phone} 
              onChange={e => setFormData({...formData, phone: e.target.value})}
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0", outline: "none" }}
              required 
            />
          </div>
          
          <div style={{ display: "flex", gap: "16px" }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: "0.8rem", fontWeight: "700", color: "#475569", marginBottom: "4px", display: "block" }}>Sector</label>
              <select 
                value={formData.sector} 
                onChange={e => setFormData({...formData, sector: e.target.value})}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0", outline: "none" }}
              >
                <option value="">Unassigned</option>
                {sectors.map(s => <option key={s._id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: "0.8rem", fontWeight: "700", color: "#475569", marginBottom: "4px", display: "block" }}>Priority</label>
              <select 
                value={formData.priority} 
                onChange={e => setFormData({...formData, priority: e.target.value})}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0", outline: "none" }}
              >
                <option value="">None</option>
                <option value="Hot">Hot</option>
                <option value="Warm">Warm</option>
                <option value="Cold">Cold</option>
              </select>
            </div>
          </div>

          {customFields && customFields.length > 0 && (
            <div style={{ marginTop: "10px", borderTop: "1px solid #e2e8f0", paddingTop: "15px" }}>
              <h3 style={{ fontSize: "0.9rem", fontWeight: "700", color: "#1e293b", marginBottom: "12px" }}>Custom Fields</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {customFields.map(field => (
                  <div key={field._id}>
                    <label style={{ fontSize: "0.8rem", fontWeight: "600", color: "#475569", display: "block", marginBottom: "4px" }}>{field.label}</label>
                    <input 
                      type="text" 
                      value={formData.customFields?.[field.name] || ""} 
                      onChange={e => setFormData({
                        ...formData, 
                        customFields: { ...formData.customFields, [field.name]: e.target.value }
                      })}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #e2e8f0", outline: "none" }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
            <button type="button" onClick={onClose} style={{ padding: "10px 16px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "white", cursor: "pointer", fontWeight: "600", color: "#64748b" }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding: "10px 16px", borderRadius: "8px", border: "none", background: "#10b981", color: "white", cursor: "pointer", fontWeight: "700", display: "flex", alignItems: "center", gap: "6px" }}>
              <Save size={16} /> {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditContactModal;
