import React, { useState, useEffect } from "react";
import { X, Check, AlertCircle, FileText, ChevronRight, Layers, Smartphone, User, Loader2, Info } from "lucide-react";
import api from "../../api";


const ImportMapperModal = ({ isOpen, onClose, rawData, onComplete, customFields, sectors }) => {
  const [headers, setHeaders] = useState([]);
  const [mappings, setMappings] = useState({
    name: "",
    phone: "",
    sector: "",
    tags: ""
  });
  const [customMappings, setCustomMappings] = useState({});
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [duplicateResult, setDuplicateResult] = useState(null);
  const [showDuplicateResolver, setShowDuplicateResolver] = useState(false);
  const [showDuplicateReviewer, setShowDuplicateReviewer] = useState(false);
  const [finalProcessedContacts, setFinalProcessedContacts] = useState([]);

  // Auto-generate a batch tag for this import session
  const today = new Date();
  const defaultBatchTag = `import-${today.getDate()}-${today.toLocaleString('en', { month: 'short' }).toLowerCase()}-${today.getFullYear()}`;
  const [batchTag, setBatchTag] = useState(defaultBatchTag);

  useEffect(() => {
    if (rawData && rawData.length > 0) {
      const detectedHeaders = Object.keys(rawData[0]);
      setHeaders(detectedHeaders);

      const newMappings = { ...mappings };
      detectedHeaders.forEach(h => {
        const lowerH = h.toLowerCase();
        if (lowerH.includes("name")) newMappings.name = h;
        if (lowerH.includes("phone") || lowerH.includes("mobile") || lowerH.includes("contact")) newMappings.phone = h;
        if (lowerH.includes("sector") || lowerH.includes("department")) newMappings.sector = h;
      });
      setMappings(newMappings);
    }
  }, [rawData]);

  const handleImport = async () => {
    if (!mappings.name || !mappings.phone) {
      alert("Please map at least Name and Phone columns!");
      return;
    }

    const processed = rawData.map(row => {
      const phone = String(row[mappings.phone] || "").replace(/[^0-9]/g, "");
      // Get tags from Excel column (if mapped) + always add the batch tag
      const excelTags = row[mappings.tags] ? row[mappings.tags].split(",").map(t => t.trim()) : [];
      const allTags = [...new Set([...excelTags, ...(batchTag.trim() ? [batchTag.trim()] : [])])];

      const contact = {
        name: row[mappings.name] || "Unknown",
        phone: phone,
        sector: row[mappings.sector] || "Unassigned",
        tags: allTags,
        customFields: {}
      };

      Object.entries(customMappings).forEach(([crmField, excelHeader]) => {
        if (excelHeader) contact.customFields[crmField] = row[excelHeader];
      });

      return contact;
    }).filter(c => c.phone.length >= 10);

    if (processed.length === 0) { alert("No valid contacts found (check phone numbers)!"); return; }

    setCheckingDuplicates(true);
    try {
      const phones = processed.map(c => c.phone);
      const res = await api.post("/contacts/check-import-duplicates", { phones });
      
      if (res.data.existingCount > 0) {
        setDuplicateResult(res.data);
        setFinalProcessedContacts(processed);
        setShowDuplicateResolver(true);
      } else {
        onComplete(processed);
      }
    } catch (err) {
      console.error("Duplicate check error:", err);
      onComplete(processed); 
    } finally {
      setCheckingDuplicates(false);
    }
  };

  const resolveAndImport = (action) => {
    let finalContacts = [...finalProcessedContacts];
    const duplicatePhones = new Set(duplicateResult.duplicates.map(d => d.phone));

    if (action === "skip") {
      finalContacts = finalContacts.filter(c => !duplicatePhones.has(c.phone));
    }

    onComplete(finalContacts);
    setShowDuplicateResolver(false);
    setShowDuplicateReviewer(false);
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(11, 27, 33, 0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 8000, backdropFilter: "blur(8px)" }}>
      <div style={{ width: showDuplicateReviewer ? "1000px" : "800px", maxWidth: "95%", maxHeight: "90vh", background: "white", borderRadius: "24px", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)", transition: "0.3s" }}>
        
        {/* Header */}
        <div style={{ padding: "24px 30px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: "900", color: "#1e293b" }}>
              {showDuplicateReviewer ? "Review Duplicate Conflicts" : showDuplicateResolver ? "Duplicate Records Found" : "Map Excel Columns"}
            </h3>
            <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "0.85rem", fontWeight: "600" }}>
              {showDuplicateReviewer ? "Compare existing database info with your Excel data" : "Link your Excel headers to CRM contact fields"}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}><X size={24} /></button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "30px", position: "relative" }} className="chat-scroll">
          
          {showDuplicateReviewer ? (
            /* STEP 3: DETAILED REVIEW VIEW */
            <div style={{ animation: "slideIn 0.3s ease" }}>
              <div style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: "0.9rem", color: "#64748b", fontWeight: "600" }}>
                  Showing <strong style={{ color: "#1e293b" }}>{duplicateResult?.existingCount}</strong> conflicting records
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button onClick={() => setShowDuplicateReviewer(false)} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "white", fontSize: "0.85rem", fontWeight: "700", cursor: "pointer" }}>Back</button>
                </div>
              </div>

              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 8px" }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "#64748b", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px" }}>
                    <th style={{ padding: "0 15px" }}>Phone Number</th>
                    <th style={{ padding: "0 15px" }}>Existing Data (DB)</th>
                    <th style={{ padding: "0 15px" }}>Incoming Data (Excel)</th>
                  </tr>
                </thead>
                <tbody>
                  {duplicateResult?.duplicates.map(dup => {
                    const incoming = finalProcessedContacts.find(c => String(c.phone) === String(dup.phone));
                    return (
                      <tr key={dup.phone} style={{ background: "#f8fafc", borderRadius: "12px" }}>
                        <td style={{ padding: "15px", fontWeight: "800", color: "#1e293b", borderTopLeftRadius: "12px", borderBottomLeftRadius: "12px" }}>
                          +{dup.phone}
                        </td>
                        <td style={{ padding: "15px", fontSize: "0.85rem" }}>
                          <div style={{ fontWeight: "700", color: "#64748b" }}>{dup.name}</div>
                          <div style={{ color: "#94a3b8", fontSize: "0.75rem" }}>{dup.sector || "No Sector"}</div>
                        </td>
                        <td style={{ padding: "15px", fontSize: "0.85rem", borderTopRightRadius: "12px", borderBottomRightRadius: "12px" }}>
                          <div style={{ fontWeight: "700", color: "#00a884" }}>{incoming?.name}</div>
                          <div style={{ color: "#00a884", fontSize: "0.75rem" }}>{incoming?.sector || "No Sector"}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div style={{ marginTop: "40px", padding: "25px", background: "#f1f5f9", borderRadius: "20px", display: "flex", justifyContent: "center", gap: "20px" }}>
                <button onClick={() => resolveAndImport("skip")} style={{ padding: "12px 30px", borderRadius: "12px", border: "2px solid #00a884", background: "white", color: "#00a884", fontWeight: "800", cursor: "pointer" }}>Skip All Duplicates</button>
                <button onClick={() => resolveAndImport("merge")} style={{ padding: "12px 30px", borderRadius: "12px", background: "#00a884", color: "white", border: "none", fontWeight: "800", cursor: "pointer" }}>Merge & Overwrite All</button>
              </div>
            </div>
          ) : showDuplicateResolver ? (
            /* STEP 2: CHOICE VIEW */
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 0", animation: "slideIn 0.3s ease" }}>
              <div style={{ width: "64px", height: "64px", borderRadius: "20px", background: "#fffbeb", color: "#d97706", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "20px" }}>
                <AlertCircle size={32} />
              </div>
              <h3 style={{ fontSize: "1.4rem", fontWeight: "900", color: "#1e293b", marginBottom: "10px" }}>Conflict Detected</h3>
              <p style={{ color: "#64748b", fontSize: "1rem", marginBottom: "30px", fontWeight: "600", textAlign: "center", maxWidth: "450px", lineHeight: "1.5" }}>
                We detected <span style={{ color: "#d97706", fontWeight: "900" }}>{duplicateResult?.existingCount}</span> contacts that already exist. What would you like to do?
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "15px", width: "100%", maxWidth: "500px" }}>
                <div onClick={() => resolveAndImport("skip")} style={{ padding: "18px", borderRadius: "16px", border: "2px solid #e2e8f0", background: "white", cursor: "pointer", transition: "0.2s", display: "flex", alignItems: "center", gap: "15px" }} onMouseOver={e => e.currentTarget.style.borderColor = "#00a884"} onMouseOut={e => e.currentTarget.style.borderColor = "#e2e8f0"}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#f0fdf4", color: "#00a884", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={18} /></div>
                  <div style={{ flex: 1 }}><div style={{ fontWeight: "800", color: "#1e293b" }}>Skip Duplicates</div><div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Only import brand new leads</div></div>
                  <ChevronRight size={18} color="#cbd5e1" />
                </div>

                <div onClick={() => resolveAndImport("merge")} style={{ padding: "18px", borderRadius: "16px", border: "2px solid #e2e8f0", background: "white", cursor: "pointer", transition: "0.2s", display: "flex", alignItems: "center", gap: "15px" }} onMouseOver={e => e.currentTarget.style.borderColor = "#6366f1"} onMouseOut={e => e.currentTarget.style.borderColor = "#e2e8f0"}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#eef2ff", color: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center" }}><Layers size={18} /></div>
                  <div style={{ flex: 1 }}><div style={{ fontWeight: "800", color: "#1e293b" }}>Merge & Overwrite</div><div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Update existing contacts info</div></div>
                  <ChevronRight size={18} color="#cbd5e1" />
                </div>

                <div onClick={() => setShowDuplicateReviewer(true)} style={{ padding: "18px", borderRadius: "16px", border: "2px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", transition: "0.2s", display: "flex", alignItems: "center", gap: "15px" }} onMouseOver={e => e.currentTarget.style.borderColor = "#64748b"} onMouseOut={e => e.currentTarget.style.borderColor = "#e2e8f0"}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "white", color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #e2e8f0" }}><FileText size={18} /></div>
                  <div style={{ flex: 1 }}><div style={{ fontWeight: "800", color: "#1e293b" }}>Review Detailed List</div><div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>See side-by-side comparison</div></div>
                  <ChevronRight size={18} color="#cbd5e1" />
                </div>
              </div>
            </div>
          ) : (
            /* STEP 1: MAPPING VIEW */
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px" }}>
                <div>
                  <h4 style={{ fontSize: "0.9rem", fontWeight: "800", color: "#1e293b", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    <User size={18} color="#00a884" /> Standard Fields
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <MappingRow label="Lead Name *" icon={<User size={14} />} value={mappings.name} onChange={(v) => setMappings({ ...mappings, name: v })} headers={headers} required />
                    <MappingRow label="Phone / Mobile *" icon={<Smartphone size={14} />} value={mappings.phone} onChange={(v) => setMappings({ ...mappings, phone: v })} headers={headers} required />
                    <MappingRow label="Sector" icon={<Layers size={14} />} value={mappings.sector} onChange={(v) => setMappings({ ...mappings, sector: v })} headers={headers} />
                  </div>

                  {/* Batch Tag Section */}
                  <div style={{ marginTop: "20px", padding: "16px", background: "linear-gradient(135deg, #f0fdf4, #ecfdf5)", borderRadius: "14px", border: "1.5px solid #86efac" }}>
                    <label style={{ fontSize: "0.7rem", fontWeight: "800", color: "#16a34a", textTransform: "uppercase", letterSpacing: "1px", display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                      🏷️ Campaign Batch Tag
                    </label>
                    <input
                      type="text"
                      value={batchTag}
                      onChange={e => setBatchTag(e.target.value)}
                      placeholder="e.g. import-may-2026"
                      style={{ width: "100%", padding: "9px 12px", borderRadius: "10px", border: "1.5px solid #86efac", fontSize: "0.85rem", fontWeight: "700", color: "#15803d", outline: "none", background: "white", boxSizing: "border-box" }}
                    />
                    <p style={{ margin: "6px 0 0", fontSize: "0.72rem", color: "#4ade80", fontWeight: "600" }}>
                      ✅ This tag will be added to ALL imported leads — filter by it in Campaigns!
                    </p>
                  </div>
                </div>
                <div>
                  <h4 style={{ fontSize: "0.9rem", fontWeight: "800", color: "#1e293b", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    <Check size={18} color="#6366f1" /> Custom Fields
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {customFields.map(field => (
                      <MappingRow key={field._id} label={field.label} value={customMappings[field.name] || ""} onChange={(v) => setCustomMappings({ ...customMappings, [field.name]: v })} headers={headers} />
                    ))}
                  </div>
                </div>
              </div>
            </>

          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "20px 30px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc" }}>
          <div style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: "600" }}>
            {showDuplicateReviewer ? "Step 3: Comparison" : showDuplicateResolver ? "Step 2: Choice" : `Step 1: ${rawData.length} rows detected`}
          </div>
          {!showDuplicateResolver && !showDuplicateReviewer && (
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={onClose} style={{ padding: "10px 20px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "white", color: "#64748b", fontWeight: "700", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleImport} disabled={checkingDuplicates} style={{ padding: "10px 30px", borderRadius: "10px", background: "#00a884", color: "white", border: "none", fontWeight: "800", cursor: "pointer", boxShadow: "0 4px 12px rgba(0,168,132,0.3)", display: "flex", alignItems: "center", gap: "8px" }}>
                {checkingDuplicates ? <Loader2 className="animate-spin" size={18} /> : "Finish & Import"}
              </button>
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

const MappingRow = ({ label, icon, value, onChange, headers, required }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
    <label style={{ fontSize: "0.7rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "6px" }}>
      {icon} {label}
    </label>
    <select 
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: "100%", padding: "10px", borderRadius: "10px", border: "1.5px solid #e2e8f0", fontSize: "0.85rem", fontWeight: "600", color: value ? "#1e293b" : "#94a3b8", outline: "none", background: value ? "#f0fdf4" : "white", transition: "0.2s" }}
    >
      <option value="">-- Ignore / Select Column --</option>
      {headers.map(h => <option key={h} value={h}>{h}</option>)}
    </select>
  </div>
);

export default ImportMapperModal;
