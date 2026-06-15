import React, { memo } from "react";
import { Plus, Search, ChevronDown, Check, MoreVertical, Bell } from "lucide-react";
import { List } from "react-window";

// In react-window v2.2.x, the Row component receives props directly from rowProps
const ChatRow = memo(({ index, style, conversations, selectedId, selectedPhone, navigate, accountNameMap, selectedAccountIds }) => {
  const chat = conversations?.[index];
  if (!chat) return null;


  const isActive = (selectedId === chat._id || selectedPhone === chat.phone);

  return (
    <div style={{ ...style, borderBottom: "1px solid #f5f6f6" }}>
      <div
        className={`chat-item ${isActive ? "active" : ""}`}
        onClick={() => navigate(`/chats/${chat._id}`)}
        style={{
          padding: "12px 16px",
          cursor: "pointer",
          display: "flex",
          gap: "14px",
          alignItems: "center",
          height: "100%",
          background: isActive ? "#e7fce3" : "transparent",
          transition: "all 0.2s"
        }}
      >
        <div style={{
          width: "48px",
          height: "48px",
          borderRadius: "50%",
          background: isActive ? "#d1f4cc" : "#dfe5e7",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#54656f",
          fontWeight: "700",
          fontSize: "1.1rem",
          flexShrink: 0
        }}>
          {(chat.contact?.name || chat.phone || "U").charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
            <span style={{
              fontWeight: isActive ? "700" : "600",
              color: "#1b1b1b",
              fontSize: "0.95rem",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1
            }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {String(chat.contact?.name || chat.phone || "Unknown").replace(/^User\s+/i, "")}
              </span>
              {selectedAccountIds && selectedAccountIds.length > 1 && (
                <span style={{
                  fontSize: "0.55rem",
                  background: "rgba(0, 168, 132, 0.08)",
                  color: "#00a884",
                  padding: "2px 8px",
                  borderRadius: "6px",
                  fontWeight: "800",
                  textTransform: "uppercase",
                  border: "1px solid rgba(0, 168, 132, 0.15)",
                  flexShrink: 0
                }}>
                  {accountNameMap[chat.whatsappAccountId] || "Primary"}
                </span>
              )}
            </span>
            <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px", flexShrink: 0, marginLeft: "8px" }}>
              {chat.lastMessageTime ? (
                <>
                  <span style={{ fontSize: "0.7rem", fontWeight: "700", color: isActive ? "#00a884" : "#667781" }}>
                    {new Date(chat.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span style={{ fontSize: "0.6rem", color: "#667781", fontWeight: "500", opacity: 0.8 }}>
                    {new Date(chat.lastMessageTime).toLocaleDateString([], { day: '2-digit', month: 'short' })}
                  </span>
                </>
              ) : ""}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{
              fontSize: "0.85rem",
              color: "#667781",
              margin: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              flex: 1,
              fontWeight: (chat.unreadCount > 0 || isActive) ? "700" : "400"
            }}>
              {chat.lastMessage || "No More messege "}
            </p>
            {chat.unreadCount > 0 && (
              <span style={{
                background: "#25d366",
                color: "white",
                borderRadius: "50%",
                padding: "2px 6px",
                fontSize: "0.75rem",
                fontWeight: "800",
                minWidth: "20px",
                height: "20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginLeft: "8px"
              }}>
                {chat.unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

const SidebarList = memo(({ listData, selectedId, selectedPhone, navigate, accountNameMap, selectedAccountIds, hasNextPage, isFetchingNextPage, fetchNextPage }) => {
  // In react-window v2.2.x, rowProps must be an object and will be spread into the Row component
  const rowProps = React.useMemo(() => ({
    conversations: listData || [],
    selectedId,
    selectedPhone,
    navigate,
    accountNameMap: accountNameMap || {},
    selectedAccountIds: selectedAccountIds || []
  }), [listData, selectedId, selectedPhone, navigate, accountNameMap, selectedAccountIds]);

  return (
    <List
      className="chat-scroll"
      rowCount={listData?.length || 0}
      rowHeight={72}
      height={window.innerHeight - 200}
      style={{ width: "100%" }}
      rowComponent={ChatRow}
      rowProps={rowProps}
      onRowsRendered={(visibleRange) => {
        const { stopIndex } = visibleRange;
        if (stopIndex >= (listData?.length || 0) - 5 && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      }}
    />
  );
});

const ChatSidebar = ({
  searchQuery, setSearchQuery,
  selectedAccountIds, setSelectedAccountIds,
  accounts, activeAccount, switchAccount,
  filter, setFilter,
  statusFilter, setStatusFilter,
  userFilter, setUserFilter,
  sectorFilter, setSectorFilter,
  allStatusOptions, executives, sectors,
  setShowManageModal, setShowNewChatModal,
  listData, selectedChat, navigate,
  accountNameMap, hasNextPage, isFetchingNextPage, fetchNextPage,
  unreadCountTotal, currentUser,
  showAccountDropdown, setShowAccountDropdown, accountDropdownRef,
  uiNotifications, markNotificationsAsRead, handleNotificationClick
}) => {
  const [showNotifList, setShowNotifList] = React.useState(false);
  const notifRef = React.useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifList(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  return (
    <div className="sidebar-container" style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "12px", background: "#f0f2f5", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h3 style={{ margin: 0, fontSize: "1.1rem", color: "var(--text-primary)" }}>Chats</h3>
          <div style={{ display: "flex", gap: "15px", color: "var(--text-secondary)" }}>
            <Plus size={20} cursor="pointer" onClick={() => setShowNewChatModal(true)} />
            <div
              style={{ position: "relative", cursor: "pointer", zIndex: 11000 }}
              ref={notifRef}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowNotifList(!showNotifList);
                }}
                style={{ background: "none", border: "none", padding: "8px", cursor: "pointer", color: "inherit", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <Bell size={20} />
              </button>
              {uiNotifications?.length > 0 && (
                <div style={{
                  position: "absolute", top: "0px", right: "0px", background: "#ff4757",
                  width: "18px", height: "18px", borderRadius: "50%", border: "2px solid #f0f2f5",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem",
                  color: "white", fontWeight: "bold", pointerEvents: "none"
                }}>
                  {uiNotifications.length}
                </div>
              )}
              {showNotifList && uiNotifications?.length > 0 && (
                <div style={{
                  position: "absolute", top: "40px", right: "0", background: "white", width: "280px",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.2)", borderRadius: "12px", padding: "12px",
                  zIndex: 11001, border: "1px solid #eee", maxHeight: "400px", overflowY: "auto"
                }}>
                  <p style={{ margin: "0 0 12px 0", fontSize: "0.85rem", fontWeight: "800", color: "#111b21", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>Notifications</p>
                  {uiNotifications.map(n => (
                    <div
                      key={n.id}
                      onClick={() => { handleNotificationClick(n); setShowNotifList(false); }}
                      style={{ padding: "10px", borderRadius: "10px", fontSize: "0.85rem", marginBottom: "8px", cursor: "pointer", background: "#f8f9fa", border: "1px solid #f1f5f9", transition: "all 0.2s" }}
                      onMouseOver={e => { e.currentTarget.style.background = "#e7fce3"; e.currentTarget.style.borderColor = "#00a884"; }}
                      onMouseOut={e => { e.currentTarget.style.background = "#f8f9fa"; e.currentTarget.style.borderColor = "#f1f5f9"; }}
                    >
                      <div style={{ fontWeight: "600", color: "#111b21", marginBottom: "4px" }}>{n.message}</div>
                      <p style={{ margin: 0, fontSize: "0.7rem", color: "#00a884", fontWeight: "700" }}>Tap to view chat →</p>
                    </div>
                  ))}
                  <button
                    onClick={markNotificationsAsRead}
                    style={{ width: "100%", padding: "5px", fontSize: "0.7rem", border: "none", background: "none", color: "#00a884", cursor: "pointer", fontWeight: "bold", textAlign: "center" }}
                  >
                    Clear All
                  </button>
                </div>
              )}
            </div>
            <MoreVertical size={20} cursor="pointer" />
          </div>
        </div>
        <div style={{ position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
          <input
            type="text"
            placeholder="Search or start new chat"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: "100%", padding: "8px 12px 8px 40px", background: "#ffffff", border: "none", color: "var(--text-primary)", borderRadius: "8px", fontSize: "0.85rem", outline: "none" }}
          />
        </div>

        <div style={{ marginTop: "12px", position: "relative" }} ref={accountDropdownRef}>
          <p style={{ fontSize: "0.65rem", color: "#667781", fontWeight: "bold", margin: "0 0 6px 4px", textTransform: "uppercase" }}>Active Accounts</p>
          <div
            onClick={() => setShowAccountDropdown(!showAccountDropdown)}
            style={{
              background: "#ffffff",
              padding: "10px 12px",
              borderRadius: "10px",
              border: "1.5px solid #e9edef",
              cursor: "pointer",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              transition: "all 0.2s"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
              <div style={{ background: "#00a884", color: "white", borderRadius: "50%", width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", fontWeight: "bold" }}>
                {selectedAccountIds?.length || 0}
              </div>
              <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "#111b21", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {selectedAccountIds?.length === accounts?.length
                  ? "All Accounts"
                  : selectedAccountIds?.length === 1
                    ? accounts?.find(a => a._id === selectedAccountIds[0])?.name || "Selected Account"
                    : `${selectedAccountIds?.length || 0} Accounts Selected`}
              </span>
            </div>
            <ChevronDown size={16} style={{ color: "#667781", transform: showAccountDropdown ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
          </div>

          {showAccountDropdown && (
            <div style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              marginTop: "6px",
              background: "white",
              borderRadius: "12px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
              border: "1px solid #e9edef",
              zIndex: 1000,
              maxHeight: "300px",
              overflowY: "auto",
              padding: "8px"
            }}>
              <div
                onClick={() => {
                  const allIds = accounts.map(a => a._id);
                  setSelectedAccountIds(selectedAccountIds.length === accounts.length ? [accounts[0]._id] : allIds);
                }}
                style={{ padding: "8px 12px", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px", background: "#f8fafc" }}
              >
                <div style={{ width: "16px", height: "16px", border: "2px solid #00a884", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", background: selectedAccountIds.length === accounts.length ? "#00a884" : "transparent" }}>
                  {selectedAccountIds.length === accounts.length && <Check size={12} color="white" />}
                </div>
                <span style={{ fontSize: "0.85rem", fontWeight: "700", color: "#00a884" }}>Select All Accounts</span>
              </div>

              <div style={{ height: "1px", background: "#f1f5f9", margin: "4px 0" }} />

              {accounts?.map(acc => {
                const isSelected = selectedAccountIds?.includes(acc._id);
                return (
                  <div
                    key={acc._id}
                    onClick={() => {
                      let newIds;
                      if (isSelected) {
                        newIds = selectedAccountIds.filter(id => id !== acc._id);
                      } else {
                        newIds = [...selectedAccountIds, acc._id];
                      }
                      if (newIds.length === 0) return;
                      setSelectedAccountIds(newIds);
                      const firstAcc = accounts.find(a => a._id === newIds[0]);
                      if (firstAcc) switchAccount(firstAcc);
                    }}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "8px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      background: isSelected ? "#f0fdf4" : "transparent",
                      transition: "background 0.2s"
                    }}
                  >
                    <div style={{
                      width: "16px",
                      height: "16px",
                      border: "2px solid",
                      borderColor: isSelected ? "#00a884" : "#cbd5e1",
                      borderRadius: "4px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: isSelected ? "#00a884" : "transparent"
                    }}>
                      {isSelected && <Check size={12} color="white" />}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: isSelected ? "600" : "500", color: isSelected ? "#111b21" : "#64748b" }}>{acc.name}</span>
                      <span style={{ fontSize: "0.65rem", color: "#94a3b8" }}>{acc.phoneNumberId}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
          <button
            onClick={() => setFilter("all")}
            style={{
              padding: "6px 16px",
              borderRadius: "20px",
              background: filter === "all" ? "#e7fce3" : "#ffffff",
              color: filter === "all" ? "#008069" : "#667781",
              fontSize: "0.8rem",
              cursor: "pointer",
              fontWeight: "600",
              border: filter === "all" ? "1px solid #00a884" : "1px solid #e9edef"
            }}
          >
            All
          </button>
          <button
            onClick={() => setFilter("unread")}
            style={{
              padding: "6px 16px",
              borderRadius: "20px",
              background: filter === "unread" ? "#e7fce3" : "#ffffff",
              color: filter === "unread" ? "#008069" : "#667781",
              fontSize: "0.8rem",
              cursor: "pointer",
              fontWeight: "600",
              border: filter === "unread" ? "1px solid #00a884" : "1px solid #e9edef",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            Unread {unreadCountTotal > 0 && <span style={{ background: "#00a884", color: "#ffffff", borderRadius: "50%", padding: "1px 6px", fontSize: "0.7rem", fontWeight: "bold" }}>{unreadCountTotal}</span>}
          </button>
          <button
            onClick={() => setFilter("window")}
            style={{
              padding: "6px 16px",
              borderRadius: "20px",
              background: filter === "window" ? "#e7fce3" : "#ffffff",
              color: filter === "window" ? "#008069" : "#667781",
              fontSize: "0.8rem",
              cursor: "pointer",
              fontWeight: "600",
              border: filter === "window" ? "1px solid #00a884" : "1px solid #e9edef",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            Window
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "10px", padding: "0 4px" }}>
          <div
            id="sidebar-filter-slider"
            style={{
              display: "flex",
              gap: "8px",
              overflowX: "auto",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              flex: 1,
              padding: "4px 0"
            }}
          >
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ minWidth: "110px", padding: "6px 10px", border: "1px solid #e9edef", borderRadius: "12px", fontSize: "0.75rem", color: "#54656f", outline: "none", cursor: "pointer", fontWeight: "600", background: "#f0f2f5" }}
            >
              <option value="all">Status: All</option>
              {allStatusOptions?.map(s => (
                <option key={s.name} value={s.name}>{s.name}</option>
              ))}
            </select>

            {currentUser.role !== "Executive" && (
              <>
                <select
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                  style={{ minWidth: "110px", padding: "6px 10px", border: "1px solid #e9edef", borderRadius: "12px", fontSize: "0.75rem", color: "#54656f", outline: "none", cursor: "pointer", fontWeight: "600", background: "#f0f2f5" }}
                >
                  <option value="all">User: All</option>
                  <option value="unassigned">Unassigned</option>
                  {executives?.map(ex => (
                    <option key={ex._id} value={ex._id}>{ex.name}</option>
                  ))}
                </select>

                <select
                  value={sectorFilter}
                  onChange={(e) => setSectorFilter(e.target.value)}
                  style={{ minWidth: "110px", padding: "6px 10px", border: "1px solid #e9edef", borderRadius: "12px", fontSize: "0.75rem", color: "#54656f", outline: "none", cursor: "pointer", fontWeight: "600", background: "#f0f2f5" }}
                >
                  <option value="all">Sector: All</option>
                  <option value="unassigned">Unassigned</option>
                  {sectors?.filter(s => s.name?.toLowerCase() !== "unassigned")?.map(s => (
                    <option key={s.name} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </>
            )}
          </div>

          <button
            onClick={() => setShowManageModal(true)}
            style={{ background: "#f0f2f5", color: "#54656f", border: "1px solid #e9edef", borderRadius: "50%", width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
            title="Add Status or Sector"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div
        className="sidebar-list-container"
        style={{ flex: 1, background: "white" }}
      >
        {listData?.length === 0 && !isFetchingNextPage ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "#667781" }}>
            <p style={{ fontSize: "0.9rem", margin: "0 0 8px 0" }}>No contacts found</p>
            <p style={{ fontSize: "0.8rem" }}>Try a different search or filter</p>
          </div>
        ) : (
          <SidebarList
            listData={listData}
            selectedId={selectedChat?._id}
            selectedPhone={selectedChat?.phone}
            navigate={navigate}
            accountNameMap={accountNameMap}
            selectedAccountIds={selectedAccountIds}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            fetchNextPage={fetchNextPage}
          />
        )}
      </div>
    </div>
  );
};

export default memo(ChatSidebar);
