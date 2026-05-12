import React, { memo } from "react";
import { MessageSquare, Clock, Send, Paperclip, Smile, Zap, Loader2, MoreVertical, Plus, Phone, Video } from "lucide-react";
import MessageBubble from "./MessageBubble";
import api from "../../api";

const COMMON_EMOJIS = ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗", "🤔", "🤭", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄", "😯", "😦", "😧", "😮", "😲", "🥱", "😴", "🤤", "😪", "😵", "🤐", "🥴", "🤢", "🤮", "🤧", "😷", "🤒", "🤕", "🤑", "🤠", "😈", "👿", "👹", "👺", "🤡", "👻", "💀", "☠️", "👽", "👾", "🤖", "🎃", "😺", "😸", "😹", "😻", "😼", "😽", "🙀", "😿", "😾", "🤲", "👐", "🙌", "👏", "🤝", "👍", "👎", "👊", "✊", "🤛", "🤜", "🤞", "✌️", "🤟", "🤘", "👌", "🤌", "🤏", "👈", "👉", "👆", "👇", "☝️", "✋", "🤚", "🖐", "🖖", "👋", "🤙", "💪", "🦾", "🖕", "✍️", "🙏", "FOOT", "🦵", "🦿", "💄", "💋", "👄", "🦷", "👅", "👂", "🦻", "👃", "👣", "👁", "👀", "🧠", "🫀", "🫁", "🦴", "💩", "🔥", "✨", "🌟", "⭐", "🌈", "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟"];

const ChatArea = ({
  selectedChat, accounts, messages, isFetchingMsgs,
  messageGroups, templateMap, formatWhatsAppText, getProxiedUrl, templates,
  windowTimeLeft, handleMessageScroll, scrollRef,
  newMessage, setNewMessage, isSendingMsg, isUploading, handleSend,
  showEmojiPicker, setShowEmojiPicker, emojiPickerRef,
  showQuickReplies, setShowQuickReplies, quickRepliesRef, quickReplies,
  pendingImage, setPendingImage, fileInputRef, handleImageUpload,
  setShowTemplateModal, setShowContactInfo, showContactInfo,
  formatDateLabel
}) => {
  const handleInitiateCall = async (type) => {
    try {
      const res = await api.post("/calls/initiate", {
        conversationId: selectedChat._id,
        type
      });
      if (res.data.success) {
        alert(`${type === "video" ? "Video" : "Voice"} call initiated successfully!`);
      }
    } catch (error) {
      console.error("Call initiation failed:", error);
      alert(`Failed to initiate ${type} call. Please check Meta Cloud API settings.`);
    }
  };

  if (!selectedChat) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#8696a0", background: "#f8f9fa" }}>
        <div style={{ width: "250px", height: "250px", borderRadius: "50%", background: "rgba(0,0,0,0.03)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "2rem" }}>
          <MessageSquare size={100} style={{ opacity: 0.1 }} />
        </div>
        <h2 style={{ color: "var(--text-primary)", fontWeight: "300" }}>Prime Impact Solutions</h2>
        <p style={{ maxWidth: "400px", textAlign: "center", lineHeight: "1.6", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
          Power your business with the official WhatsApp Business API.
          <br />
          Prime Impact Solutions helps you automate conversations, run campaigns, and scale customer engagement effortlessly.
        </p>
        <div style={{ marginTop: "auto", paddingBottom: "2rem", display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
          <Clock size={14} /> End-to-end encrypted
        </div>
      </div>
    );
  }

  return (
    <div className="chat-area-container" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Chat Header */}
      <div style={{
        padding: "0 16px",
        background: "#f0f2f5",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        zIndex: 10,
        flexShrink: 0,
        height: "58px",
        borderBottom: "1px solid rgba(0,0,0,0.08)"
      }}>
        <div
          style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", minWidth: 0, flex: 1 }}
          onClick={() => setShowContactInfo(!showContactInfo)}
        >
          <div style={{ 
            width: "40px", 
            height: "40px", 
            borderRadius: "50%", 
            background: "#00a884", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            color: "white", 
            fontSize: "1.2rem", 
            fontWeight: "bold",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            flexShrink: 0
          }}>
            {(selectedChat?.contact?.name || selectedChat?.phone || "U").charAt(0).toUpperCase()}
          </div>
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h4 style={{ 
                margin: 0, 
                fontSize: "1rem", 
                fontWeight: "700", 
                color: "#111b21",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}>
                {selectedChat.contact?.name || selectedChat.phone}
              </h4>
              <span style={{ 
                fontSize: "0.55rem", 
                color: "#00a884", 
                fontWeight: "800", 
                background: "rgba(0, 168, 132, 0.08)", 
                padding: "2px 8px", 
                borderRadius: "6px", 
                border: "1px solid rgba(0, 168, 132, 0.15)", 
                textTransform: "uppercase",
                flexShrink: 0
              }}>
                {accounts.find(a => a._id === selectedChat.whatsappAccountId)?.name || "Primary"}
              </span>
            </div>
            <span style={{ fontSize: "0.7rem", color: "#667781" }}>
              {selectedChat.contact?.name ? selectedChat.phone : "Online"}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexShrink: 0 }}>
          {windowTimeLeft && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "#d9fdd3",
              color: "#008069",
              padding: "4px 12px",
              borderRadius: "20px",
              fontSize: "0.75rem",
              fontWeight: "700",
              border: "1px solid rgba(0, 128, 105, 0.15)",
              whiteSpace: "nowrap"
            }}>
              <Clock size={14} />
              <span>{windowTimeLeft}</span>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "20px", marginRight: "8px", marginLeft: "8px" }}>
            <Phone 
              size={20} 
              style={{ color: "#54656f", cursor: "pointer", transition: "0.2s" }} 
              onMouseOver={e => e.currentTarget.style.color = "#00a884"}
              onMouseOut={e => e.currentTarget.style.color = "#54656f"}
              onClick={() => handleInitiateCall("audio")}
              title="Voice Call"
            />
            <Video 
              size={22} 
              style={{ color: "#54656f", cursor: "pointer", transition: "0.2s" }} 
              onMouseOver={e => e.currentTarget.style.color = "#00a884"}
              onMouseOut={e => e.currentTarget.style.color = "#54656f"}
              onClick={() => handleInitiateCall("video")}
              title="Video Call"
            />
          </div>
          
          {!showContactInfo && (
            <button 
              onClick={() => setShowTemplateModal(true)} 
              style={{ 
                background: "#00a884", 
                border: "none", 
                color: "#ffffff", 
                padding: "8px 18px", 
                borderRadius: "20px", 
                fontSize: "0.8rem", 
                fontWeight: "700", 
                cursor: "pointer", 
                boxShadow: "0 2px 6px rgba(0, 168, 132, 0.3)", 
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                whiteSpace: "nowrap"
              }} 
              onMouseOver={e => {
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 4px 10px rgba(0, 168, 132, 0.4)";
              }} 
              onMouseOut={e => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 2px 6px rgba(0, 168, 132, 0.3)";
              }}
            >
              Send Template
            </button>
          )}
          <MoreVertical size={20} style={{ color: "#54656f", cursor: "pointer", opacity: 0.8 }} />
        </div>
      </div>

      {/* Messages List */}
      <div
        ref={scrollRef}
        className="chat-scroll"
        onScroll={handleMessageScroll}
        style={{ height: "calc(100% - 120px)", padding: "20px", overflowY: "scroll", display: "flex", flexDirection: "column", background: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')", backgroundBlendMode: "soft-light", backgroundColor: "#efeae2" }}
      >
        {isFetchingMsgs && <div style={{ textAlign: "center", padding: "10px", color: "#8696a0", fontSize: "0.8rem", background: "rgba(255,255,255,0.8)", borderRadius: "8px", margin: "0 auto 10px auto", width: "fit-content" }}>Loading older messages...</div>}
        {Object.entries(messageGroups).map(([date, msgs]) => (
          <div key={date} style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "center", margin: "15px 0" }}>
              <div style={{ background: "#ffe600", padding: "6px 14px", borderRadius: "8px", fontSize: "0.75rem", color: "#000000", fontWeight: "700", boxShadow: "0 2px 5px rgba(0,0,0,0.1)", border: "1px solid rgba(0,0,0,0.05)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {formatDateLabel(date)}
              </div>
            </div>
            {msgs.map((msg, idx) => (
              <MessageBubble
                key={msg._id || `temp-${idx}`}
                msg={msg}
                templateMap={templateMap}
                formatWhatsAppText={formatWhatsAppText}
                getProxiedUrl={getProxiedUrl}
                templates={templates}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Input Area */}
      {windowTimeLeft ? (
        <div style={{ background: "#f0f2f5", display: "flex", flexDirection: "column", position: "relative" }}>

          {/* Emoji Picker Popover */}
          {showEmojiPicker && (
            <div ref={emojiPickerRef} style={{ position: "absolute", bottom: "100%", left: "10px", background: "white", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "10px", boxShadow: "0 -4px 12px rgba(0,0,0,0.1)", width: "300px", zIndex: 1000 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", borderBottom: "1px solid #f0f2f5", paddingBottom: "5px" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: "700", color: "#667781" }}>Emojis</span>
                <button onClick={() => setShowEmojiPicker(false)} style={{ background: "none", border: "none", color: "#667781", cursor: "pointer" }}><Plus size={18} style={{ transform: "rotate(45deg)" }} /></button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: "5px", maxHeight: "200px", overflowY: "auto" }}>
                {COMMON_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      setNewMessage(prev => prev + emoji);
                    }}
                    style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", padding: "5px" }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Replies Popover */}
          {showQuickReplies && (
            <div ref={quickRepliesRef} style={{ position: "absolute", bottom: "100%", left: "50px", background: "white", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "10px", boxShadow: "0 -4px 12px rgba(0,0,0,0.1)", width: "320px", maxHeight: "350px", overflowY: "auto", zIndex: 1000 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", borderBottom: "1px solid #f0f2f5", paddingBottom: "5px" }}>
                <h4 style={{ margin: 0, fontSize: "0.85rem", color: "#111b21" }}>Quick Replies</h4>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button onClick={() => setShowQuickReplies(false)} style={{ background: "none", border: "none", color: "#667781", cursor: "pointer" }}><Plus size={18} style={{ transform: "rotate(45deg)" }} /></button>
                </div>
              </div>
              {quickReplies.length === 0 ? (
                <p style={{ fontSize: "0.8rem", color: "#8696a0" }}>No quick replies found. You can add them to send Image + Text quickly.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {quickReplies.map(p => (
                    <button
                      key={p._id}
                      type="button"
                      onClick={() => {
                        if (p.mediaUrl) {
                          setPendingImage({
                            previewUrl: p.mediaUrl,
                            remoteUrl: p.mediaUrl,
                            isRemote: true
                          });
                        }
                        setNewMessage(p.content || "");
                        setShowQuickReplies(false);
                      }}
                      style={{ textAlign: "left", background: "#f8f9fa", border: "1px solid #e9edef", padding: "8px 12px", borderRadius: "8px", cursor: "pointer", display: "flex", gap: "10px", alignItems: "center" }}
                    >
                      {p.mediaUrl && (
                        <img src={p.mediaUrl} alt="" style={{ width: "40px", height: "40px", borderRadius: "4px", objectFit: "cover" }} />
                      )}
                      <div style={{ flex: 1, overflow: "hidden" }}>
                        <span style={{ fontWeight: "600", display: "block", fontSize: "0.85rem", color: "#111b21" }}>{p.name}</span>
                        <span style={{ fontSize: "0.75rem", color: "#667781", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>{p.content || "Image only"}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Image Preview Area */}
          {pendingImage && (
            <div style={{ padding: "10px 16px", background: "#f0f2f5", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: "15px" }}>
              <div style={{ position: "relative", width: "80px", height: "80px", borderRadius: "10px", overflow: "hidden", border: "2px solid #00a884", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
                <img src={pendingImage.previewUrl} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <button
                  onClick={() => setPendingImage(null)}
                  style={{ position: "absolute", top: "2px", right: "2px", background: "rgba(0,0,0,0.6)", color: "white", border: "none", borderRadius: "50%", width: "18px", height: "18px", cursor: "pointer", fontSize: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}
                >✕</button>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: "700", color: "#111b21" }}>Image selected</p>
                <p style={{ margin: 0, fontSize: "0.75rem", color: "#667781" }}>Type a caption below and press send</p>
              </div>
            </div>
          )}
          <form onSubmit={handleSend} style={{ padding: "10px 16px", display: "flex", gap: "10px", alignItems: "center" }}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              style={{ display: "none" }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              style={{ background: "transparent", border: "none", color: "#667781", cursor: "pointer", padding: "5px" }}
            >
              {isUploading ? <Loader2 size={24} className="animate-spin" /> : <Paperclip size={24} />}
            </button>

            {/* Emoji Button */}
            <button
              type="button"
              onClick={() => {
                setShowEmojiPicker(!showEmojiPicker);
                setShowQuickReplies(false);
              }}
              style={{ background: "transparent", border: "none", color: showEmojiPicker ? "#00a884" : "#667781", cursor: "pointer", padding: "5px" }}
              title="Emojis"
            >
              <Smile size={24} />
            </button>

            {/* Quick Replies Button */}
            <button
              type="button"
              onClick={() => {
                setShowQuickReplies(!showQuickReplies);
                setShowEmojiPicker(false);
              }}
              style={{ background: "transparent", border: "none", color: showQuickReplies ? "#00a884" : "#667781", cursor: "pointer", padding: "5px" }}
              title="Quick Replies"
            >
              <Zap size={24} />
            </button>

            <textarea
              placeholder={pendingImage ? "Add a caption..." : "Type a message"}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.keyCode === 13) && !e.shiftKey) {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSend();
                }
              }}
              rows="1"
              style={{
                flex: 1,
                padding: "10px 12px",
                background: "#ffffff",
                border: "none",
                color: "var(--text-primary)",
                borderRadius: "8px",
                outline: "none",
                resize: "none",
                fontFamily: "inherit",
                fontSize: "0.9rem",
                lineHeight: "1.4",
                maxHeight: "100px",
                overflowY: "auto"
              }}
            />
            <button type="submit" disabled={isUploading || isSendingMsg} style={{ background: "transparent", border: "none", color: (isUploading || isSendingMsg) ? "#cbd5e1" : "#00a884", cursor: (isUploading || isSendingMsg) ? "not-allowed" : "pointer", padding: "5px" }}>
              {(isUploading || isSendingMsg) ? <Loader2 size={24} className="animate-spin" /> : <Send size={24} />}
            </button>
          </form>
        </div>
      ) : (
        <div style={{ padding: "15px 20px", background: "#f0f2f5", display: "flex", flexDirection: "column", alignItems: "center", borderTop: "1px solid rgba(0,0,0,0.05)" }}>
          <p style={{ fontSize: "0.85rem", color: "#667781", margin: "0 0 10px 0", textAlign: "center" }}>
            <Clock size={14} style={{ verticalAlign: "middle", marginRight: "5px" }} />
            The 24-hour service window is closed. You can only send Template Messages.
          </p>
          <button
            onClick={() => setShowTemplateModal(true)}
            style={{ background: "#00a884", border: "none", color: "white", padding: "8px 24px", borderRadius: "20px", fontSize: "0.85rem", fontWeight: "700", cursor: "pointer" }}
          >
            Send Template to Re-open Window
          </button>
        </div>
      )}
    </div>
  );
};

export default memo(ChatArea);
