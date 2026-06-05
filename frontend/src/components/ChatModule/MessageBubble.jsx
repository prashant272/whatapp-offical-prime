import React, { memo } from "react";
import { Check, CheckCheck, AlertCircle, FileText, Loader2, CornerUpLeft } from "lucide-react";

const MessageBubble = memo(({ msg, templateMap, formatWhatsAppText, getProxiedUrl, templates, onReply }) => {
  return (
    <div
      className={`msg-bubble ${msg.direction === "outbound" ? "msg-outbound" : "msg-inbound"}`}
      style={{
        opacity: msg.status === "sending" ? 0.6 : 1,
        position: "relative"
      }}
    >
      {msg.reaction && (
        <div style={{
          position: "absolute",
          bottom: "-12px",
          [msg.direction === "outbound" ? "left" : "right"]: "12px",
          background: "white",
          borderRadius: "12px",
          padding: "2px 6px",
          fontSize: "0.85rem",
          boxShadow: "0 2px 5px rgba(0,0,0,0.15)",
          border: "1px solid #e2e8f0",
          zIndex: 5,
          display: "flex",
          alignItems: "center",
          pointerEvents: "none"
        }}>
          {msg.reaction}
        </div>
      )}
      {msg.quotedMessageBody && (
        <div style={{
          background: msg.direction === "outbound" ? "rgba(0,0,0,0.08)" : "rgba(0,0,0,0.04)",
          borderLeft: "4px solid #00a884",
          borderRadius: "6px",
          padding: "6px 10px",
          marginBottom: "8px",
          fontSize: "0.8rem",
          color: "#475569",
          maxWidth: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }}>
          <div style={{ fontWeight: "700", fontSize: "0.7rem", color: "#00a884", marginBottom: "2px" }}>
            Quoted Message
          </div>
          {msg.quotedMessageBody}
        </div>
      )}
      {msg.status === "sending" && (
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 10 }}>
          <Loader2 className="animate-spin" size={24} color="#00a884" />
        </div>
      )}
      {msg.type === "template" && msg.templateData ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {msg.templateData.components?.find(c => c.type === "header")?.parameters?.[0]?.image?.link && (
            <img
              src={getProxiedUrl(msg.templateData.components.find(c => c.type === "header")?.parameters?.[0]?.image?.link, msg.whatsappAccountId)}
              alt="Template"
              style={{ width: "100%", borderRadius: "8px", maxHeight: "180px", objectFit: "cover", marginBottom: "5px" }}
            />
          )}

          <div
            style={{ whiteSpace: "pre-wrap", fontSize: "0.9rem" }}
            dangerouslySetInnerHTML={{
              __html: (() => {
                const template = templateMap[msg.templateData.name];
                let text = template?.components.find(c => c.type === "BODY")?.text || msg.body;
                const params = msg.templateData.components.find(c => c.type === "body")?.parameters || [];
                params.forEach((p, i) => {
                  text = text.replace(`{{${i + 1}}}`, p.text || "");
                });
                return formatWhatsAppText(text);
              })()
            }}
          />

          {templateMap[msg.templateData.name]?.components.find(c => c.type === "BUTTONS")?.buttons?.map((btn, i) => (
            <div key={i} style={{ padding: "8px", background: "rgba(255,255,255,0.05)", borderRadius: "6px", textAlign: "center", fontSize: "0.75rem", border: "1px solid rgba(255,255,255,0.1)", marginTop: "2px", color: "#53bdeb" }}>
              {btn.text}
            </div>
          ))}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "4px", marginTop: "2px" }}>
            <span style={{ fontSize: "0.65rem", color: "#667781" }}>{new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            {msg.direction === "outbound" && (
              <span style={{ 
                color: msg.status === "read" ? "#53bdeb" : (msg.status === "failed" ? "#f15c5c" : "#8696a0"),
                display: "flex",
                alignItems: "center"
              }}>
                {msg.status === "sent" && <Check size={14} />}
                {(msg.status === "delivered" || msg.status === "read") && <CheckCheck size={15} />}
                {msg.status === "failed" && <AlertCircle size={14} />}
              </span>
            )}
            {onReply && msg.status !== "sending" && (
              <button 
                type="button"
                onClick={() => onReply(msg)}
                title="Reply to message"
                style={{
                  background: "none",
                  border: "none",
                  padding: "2px",
                  cursor: "pointer",
                  color: "#8696a0",
                  display: "flex",
                  alignItems: "center",
                  marginLeft: "5px"
                }}
              >
                <CornerUpLeft size={12} />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
          {msg.mediaUrl && (
            <div style={{ marginBottom: "5px" }}>
              {msg.type === "image" ? (
                <img
                  src={getProxiedUrl(msg.mediaUrl, msg.whatsappAccountId)}
                  alt="Received"
                  style={{ width: "100%", borderRadius: "8px", maxHeight: "250px", objectFit: "cover", cursor: "pointer" }}
                  onDoubleClick={() => window.open(getProxiedUrl(msg.mediaUrl, msg.whatsappAccountId), "_blank")}
                />
              ) : msg.type === "video" ? (
                <video
                  src={getProxiedUrl(msg.mediaUrl, msg.whatsappAccountId)}
                  controls
                  style={{ width: "100%", borderRadius: "8px", maxHeight: "250px" }}
                />
              ) : msg.type === "audio" ? (
                <audio
                  src={getProxiedUrl(msg.mediaUrl, msg.whatsappAccountId)}
                  controls
                  style={{ width: "100%" }}
                />
              ) : (
                <div style={{ background: "rgba(0,0,0,0.05)", padding: "12px", borderRadius: "8px", display: "flex", alignItems: "center", gap: "10px" }}>
                  <FileText size={24} color="#8696a0" />
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <p style={{ margin: 0, fontSize: "0.85rem", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{msg.body || "Document"}</p>
                    <a href={getProxiedUrl(msg.mediaUrl, msg.whatsappAccountId)} target="_blank" rel="noreferrer" style={{ fontSize: "0.75rem", color: "#00a884", textDecoration: "none", fontWeight: "600" }}>Download File</a>
                  </div>
                </div>
              )}
            </div>
          )}
          {msg.body && msg.type !== "template" && (
            <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }} dangerouslySetInnerHTML={{ __html: formatWhatsAppText(msg.body) }} />
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "4px", marginTop: "2px" }}>
            <span style={{ fontSize: "0.65rem", color: "#667781" }}>{new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            {msg.direction === "outbound" && (
              <span style={{ 
                color: msg.status === "read" ? "#53bdeb" : (msg.status === "failed" ? "#f15c5c" : "#8696a0"),
                display: "flex",
                alignItems: "center"
              }}>
                {msg.status === "sent" && <Check size={14} />}
                {(msg.status === "delivered" || msg.status === "read") && <CheckCheck size={15} />}
                {msg.status === "failed" && <AlertCircle size={14} />}
              </span>
            )}
            {onReply && msg.status !== "sending" && (
              <button 
                type="button"
                onClick={() => onReply(msg)}
                title="Reply to message"
                style={{
                  background: "none",
                  border: "none",
                  padding: "2px",
                  cursor: "pointer",
                  color: "#8696a0",
                  display: "flex",
                  alignItems: "center",
                  marginLeft: "5px"
                }}
              >
                <CornerUpLeft size={12} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

export default MessageBubble;
