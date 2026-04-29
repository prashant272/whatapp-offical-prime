import React, { useState, useEffect } from "react";
import api from "../api";
import { Plus, Trash2, Database, List, Type, Hash, Calendar, CheckSquare, Loader2, Pencil } from "lucide-react";
import { useWhatsAppAccount } from "../WhatsAppAccountContext";

const CustomFieldManager = () => {
  const { activeAccount } = useWhatsAppAccount();
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newField, setNewField] = useState({
    label: "",
    name: "",
    type: "TEXT",
    options: ""
  });
  const [editingField, setEditingField] = useState(null);

  const fetchFields = async () => {
    if (!activeAccount) return;
    setLoading(true);
    try {
      const res = await api.get("/custom-fields");
      setFields(res.data);
    } catch (err) {
      console.error("Error fetching fields:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFields();
  }, [activeAccount]);

  const handleAddField = async (e) => {
    e.preventDefault();
    if (!newField.label || !newField.name) return;

    try {
      setLoading(true);
      const payload = {
        ...newField,
        options: newField.type === "SELECT" ? newField.options.split(",").map(o => o.trim()) : []
      };
      await api.post("/custom-fields", payload);
      setNewField({ label: "", name: "", type: "TEXT", options: "" });
      setShowAddForm(false);
      fetchFields();
    } catch (err) {
      alert("Error adding field: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateField = async (e) => {
    e.preventDefault();
    if (!editingField.label) return;

    try {
      setLoading(true);
      const payload = {
        ...editingField,
        options: editingField.type === "SELECT" 
          ? (typeof editingField.options === 'string' ? editingField.options.split(",").map(o => o.trim()) : editingField.options)
          : []
      };
      await api.put(`/custom-fields/${editingField._id}`, payload);
      setEditingField(null);
      fetchFields();
    } catch (err) {
      alert("Error updating field: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteField = async (id) => {
    if (!window.confirm("Are you sure? This will remove the field definition.")) return;
    try {
      await api.delete(`/custom-fields/${id}`);
      fetchFields();
    } catch (err) {
      alert("Error deleting field: " + err.message);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case "TEXT": return <Type size={16} />;
      case "NUMBER": return <Hash size={16} />;
      case "DATE": return <Calendar size={16} />;
      case "SELECT": return <List size={16} />;
      default: return <Database size={16} />;
    }
  };

  return (
    <div className="custom-field-manager">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h3 style={{ fontSize: "1.5rem", fontWeight: "700" }}>Custom CRM Fields</h3>
          <p style={{ color: "#64748b", fontSize: "0.85rem" }}>Define extra information you want to collect for your contacts.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? "Cancel" : <><Plus size={18} /> Add New Field</>}
        </button>
      </div>

      {showAddForm && (
        <form className="glass-card" onSubmit={handleAddField} style={{ marginBottom: "2rem", padding: "24px", border: "2px solid #00a884" }}>
          <h4 style={{ margin: "0 0 1.5rem 0", color: "#00a884" }}>Add New Field</h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
            <div>
              <label style={{ fontSize: "0.85rem", fontWeight: "600", color: "#64748b", display: "block", marginBottom: "8px" }}>Field Label (Display Name)</label>
              <input 
                type="text" 
                placeholder="e.g. Home Address"
                style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0" }} 
                value={newField.label} 
                onChange={e => setNewField({ ...newField, label: e.target.value, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
                required 
              />
            </div>
            <div>
              <label style={{ fontSize: "0.85rem", fontWeight: "600", color: "#64748b", display: "block", marginBottom: "8px" }}>Internal Key (System Name)</label>
              <input 
                type="text" 
                placeholder="e.g. home_address"
                style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "#f8fafc" }} 
                value={newField.name} 
                readOnly 
              />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
            <div>
              <label style={{ fontSize: "0.85rem", fontWeight: "600", color: "#64748b", display: "block", marginBottom: "8px" }}>Field Type</label>
              <select 
                style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0" }} 
                value={newField.type} 
                onChange={e => setNewField({ ...newField, type: e.target.value })}
              >
                <option value="TEXT">Short Text</option>
                <option value="NUMBER">Number</option>
                <option value="DATE">Date</option>
                <option value="SELECT">Dropdown (Options)</option>
              </select>
            </div>
            {newField.type === "SELECT" && (
              <div>
                <label style={{ fontSize: "0.85rem", fontWeight: "600", color: "#64748b", display: "block", marginBottom: "8px" }}>Dropdown Options (Comma separated)</label>
                <input 
                  type="text" 
                  placeholder="Option 1, Option 2, Option 3"
                  style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0" }} 
                  value={newField.options} 
                  onChange={e => setNewField({ ...newField, options: e.target.value })}
                  required 
                />
              </div>
            )}
          </div>
          <button type="submit" className="btn-primary" style={{ width: "100%", padding: "14px" }} disabled={loading}>
            {loading ? <Loader2 size={18} className="animate-spin" /> : "Save Field Definition"}
          </button>
        </form>
      )}

      {editingField && (
        <form className="glass-card" onSubmit={handleUpdateField} style={{ marginBottom: "2rem", padding: "24px", border: "2px solid #6366f1" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <h4 style={{ margin: 0, color: "#6366f1" }}>Edit Field: {editingField.label}</h4>
            <button type="button" onClick={() => setEditingField(null)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontWeight: "bold" }}>Cancel</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
            <div>
              <label style={{ fontSize: "0.85rem", fontWeight: "600", color: "#64748b", display: "block", marginBottom: "8px" }}>Field Label</label>
              <input 
                type="text" 
                style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0" }} 
                value={editingField.label} 
                onChange={e => setEditingField({ ...editingField, label: e.target.value })}
                required 
              />
            </div>
            <div>
              <label style={{ fontSize: "0.85rem", fontWeight: "600", color: "#64748b", display: "block", marginBottom: "8px" }}>Internal Key (Cannot Change)</label>
              <input 
                type="text" 
                style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "#f8fafc", color: "#94a3b8" }} 
                value={editingField.name} 
                readOnly 
              />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
            <div>
              <label style={{ fontSize: "0.85rem", fontWeight: "600", color: "#64748b", display: "block", marginBottom: "8px" }}>Field Type</label>
              <select 
                style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0" }} 
                value={editingField.type} 
                onChange={e => setEditingField({ ...editingField, type: e.target.value })}
              >
                <option value="TEXT">Short Text</option>
                <option value="NUMBER">Number</option>
                <option value="DATE">Date</option>
                <option value="SELECT">Dropdown (Options)</option>
              </select>
            </div>
            {editingField.type === "SELECT" && (
              <div>
                <label style={{ fontSize: "0.85rem", fontWeight: "600", color: "#64748b", display: "block", marginBottom: "8px" }}>Dropdown Options (Comma separated)</label>
                <input 
                  type="text" 
                  placeholder="Option 1, Option 2, Option 3"
                  style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0" }} 
                  value={Array.isArray(editingField.options) ? editingField.options.join(", ") : editingField.options} 
                  onChange={e => setEditingField({ ...editingField, options: e.target.value })}
                  required 
                />
              </div>
            )}
          </div>
          <button type="submit" className="btn-primary" style={{ width: "100%", padding: "14px", background: "#6366f1" }} disabled={loading}>
            {loading ? <Loader2 size={18} className="animate-spin" /> : "Update Field Definition"}
          </button>
        </form>
      )}

      {loading && fields.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem" }}><Loader2 className="animate-spin" size={40} color="#00a884" /></div>
      ) : (
        <div className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              <tr>
                <th style={{ textAlign: "left", padding: "16px 24px", color: "#64748b", fontWeight: "600" }}>Field Details</th>
                <th style={{ textAlign: "left", padding: "16px 24px", color: "#64748b", fontWeight: "600" }}>Type</th>
                <th style={{ textAlign: "left", padding: "16px 24px", color: "#64748b", fontWeight: "600" }}>Options</th>
                <th style={{ textAlign: "right", padding: "16px 24px", color: "#64748b", fontWeight: "600" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {fields.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>No custom fields defined yet.</td>
                </tr>
              ) : (
                fields.map((field) => (
                  <tr key={field._id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "16px 24px" }}>
                      <div style={{ fontWeight: "700", color: "#1e293b" }}>{field.label}</div>
                      <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Key: {field.name}</div>
                    </td>
                    <td style={{ padding: "16px 24px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#64748b" }}>
                        {getIcon(field.type)}
                        {field.type}
                      </div>
                    </td>
                    <td style={{ padding: "16px 24px", color: "#64748b" }}>
                      {field.type === "SELECT" ? field.options.join(", ") : "-"}
                    </td>
                    <td style={{ padding: "16px 24px", textAlign: "right" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                        <button 
                          onClick={() => {
                            setEditingField(field);
                            setShowAddForm(false);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          style={{ background: "transparent", border: "none", color: "#6366f1", cursor: "pointer" }}
                          title="Edit Field"
                        >
                          <Pencil size={18} />
                        </button>
                        <button 
                          onClick={() => handleDeleteField(field._id)}
                          style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer" }}
                          title="Delete Field"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CustomFieldManager;
