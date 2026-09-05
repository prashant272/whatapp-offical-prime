import React, { useState } from "react";
import { X, UserPlus, Phone, Briefcase, Tag } from "lucide-react";
import api from "../../api";

const AddContactModal = ({ isOpen, onClose, sectors, sources, winners, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    sector: "",
    source: "",
    winners: [],
  });
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const cleanPhone = String(formData.phone).replace(/\D/g, "");
      if (cleanPhone.length < 10) {
        alert("Please enter a valid phone number with country code.");
        setLoading(false);
        return;
      }

      await api.post("/contacts/import", {
        contacts: [{
          name: formData.name || `Lead ${cleanPhone.slice(-4)}`,
          phone: cleanPhone,
          sector: formData.sector || "Unassigned",
          source: formData.source || "Unassigned",
          winners: formData.winners || [],
          tags: ["Manual Entry"]
        }],
        whatsappAccountId: "all" // Global by default or specify if needed
      });

      onSuccess();
      onClose();
      setFormData({ name: "", phone: "", sector: "", source: "", winners: [] });
    } catch (error) {
      console.error(error);
      alert("Failed to add contact.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
      <div style={{ background: "white", width: "100%", maxWidth: "400px", borderRadius: "20px", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)", overflow: "hidden", animation: "slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)" }}>

        <div style={{ padding: "20px 24px", background: "linear-gradient(135deg, #00a884, #008069)", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "800", display: "flex", alignItems: "center", gap: "10px" }}>
            <UserPlus size={20} /> Add New Lead
          </h3>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "white", width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "24px" }}>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "700", color: "#64748b", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Full Name</label>
            <div style={{ position: "relative" }}>
              <UserPlus size={16} color="#94a3b8" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="text"
                placeholder="e.g. John Doe"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: "10px", border: "1.5px solid #e2e8f0", fontSize: "0.9rem", color: "#1e293b", boxSizing: "border-box", outline: "none", transition: "0.2s" }}
                onFocus={e => e.target.style.borderColor = "#00a884"}
                onBlur={e => e.target.style.borderColor = "#e2e8f0"}
              />
            </div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "700", color: "#64748b", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Phone Number *</label>
            <div style={{ position: "relative" }}>
              <Phone size={16} color="#94a3b8" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="text"
                required
                placeholder="e.g. 919876543210"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: "10px", border: "1.5px solid #e2e8f0", fontSize: "0.9rem", color: "#1e293b", boxSizing: "border-box", outline: "none", transition: "0.2s" }}
                onFocus={e => e.target.style.borderColor = "#00a884"}
                onBlur={e => e.target.style.borderColor = "#e2e8f0"}
              />
            </div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "700", color: "#64748b", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Sector</label>
            <div style={{ position: "relative" }}>
              <Briefcase size={16} color="#94a3b8" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              <select
                value={formData.sector}
                onChange={e => setFormData({ ...formData, sector: e.target.value })}
                style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: "10px", border: "1.5px solid #e2e8f0", fontSize: "0.9rem", color: "#1e293b", boxSizing: "border-box", outline: "none", transition: "0.2s", appearance: "none", cursor: "pointer", background: "white" }}
                onFocus={e => e.target.style.borderColor = "#00a884"}
                onBlur={e => e.target.style.borderColor = "#e2e8f0"}
              >
                <option value="">Unassigned</option>
                {sectors.map(s => <option key={s._id || s.name} value={s.name}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "700", color: "#64748b", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Source</label>
            <div style={{ position: "relative" }}>
              <Tag size={16} color="#94a3b8" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              <select
                value={formData.source}
                onChange={e => setFormData({ ...formData, source: e.target.value })}
                style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: "10px", border: "1.5px solid #e2e8f0", fontSize: "0.9rem", color: "#1e293b", boxSizing: "border-box", outline: "none", transition: "0.2s", appearance: "none", cursor: "pointer", background: "white" }}
                onFocus={e => e.target.style.borderColor = "#00a884"}
                onBlur={e => e.target.style.borderColor = "#e2e8f0"}
              >
                <option value="">Unassigned</option>
                {sources.map(s => <option key={s._id || s.name} value={s.name}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "700", color: "#64748b", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Winners</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
              {(formData.winners || []).map(winner => (
                <span key={winner} style={{ background: "#00a884", color: "white", padding: "4px 10px", borderRadius: "12px", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "6px" }}>
                  {winner}
                  <X size={12} style={{ cursor: "pointer" }} onClick={() => setFormData({ ...formData, winners: formData.winners.filter(w => w !== winner) })} />
                </span>
              ))}
            </div>
            <select
              value=""
              onChange={e => {
                const val = e.target.value;
                if (val && !(formData.winners || []).includes(val)) {
                  setFormData({ ...formData, winners: [...(formData.winners || []), val] });
                }
              }}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1.5px solid #e2e8f0", fontSize: "0.9rem", color: "#1e293b", outline: "none", cursor: "pointer", background: "white" }}
            >
              <option value="">+ Add Winner</option>
              {(winners || []).map(w => <option key={w._id || w.name} value={w.name}>{w.name}</option>)}
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ width: "100%", padding: "12px", background: loading ? "#94a3b8" : "#00a884", color: "white", border: "none", borderRadius: "10px", fontWeight: "800", fontSize: "0.95rem", cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", transition: "0.2s" }}
          >
            {loading ? "Adding..." : "Save Contact"}
          </button>
        </form>

      </div>
    </div>
  );
};

export default AddContactModal;
