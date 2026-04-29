import React from "react";
import { Link, useLocation } from "react-router-dom";
import { LogOut, ChevronUp, Smartphone } from "lucide-react";
import { useWhatsAppAccount } from "../WhatsAppAccountContext";

const Sidebar = ({ user, menuItems, handleLogout }) => {
  const location = useLocation();
  const isChatTab = location.pathname.startsWith("/chats");
  const { accounts, activeAccount, switchAccount } = useWhatsAppAccount();
  const [showAccountSwitcher, setShowAccountSwitcher] = React.useState(false);

  const visibleMenu = user ? menuItems.filter(item => item.roles.includes(user.role)) : [];

  return (
    <aside className={`sidebar ${isChatTab ? "mini-sidebar" : ""}`} style={{ 
      width: isChatTab ? "70px" : "240px", 
      transition: "all 0.3s ease",
      padding: isChatTab ? "0.5rem 0" : "0.5rem 0.5rem",
      display: "flex",
      flexDirection: "column",
      zIndex: 100,
      background: "#ffffff",
      borderRight: "1px solid rgba(0,0,0,0.05)"
    }}>
      {/* Premium Header Area */}
      <div style={{ 
        padding: isChatTab ? "0" : "12px 10px",
        marginBottom: "0.5rem",
        background: isChatTab ? "transparent" : "linear-gradient(145deg, #f8fafc, #ffffff)",
        borderRadius: "16px",
        border: isChatTab ? "none" : "1px solid rgba(0,0,0,0.03)",
        boxShadow: isChatTab ? "none" : "0 4px 12px rgba(0,0,0,0.02)"
      }}>
        <div style={{ marginBottom: isChatTab ? "0.8rem" : "12px", textAlign: isChatTab ? "center" : "left" }}>
          <h2 style={{ display: "flex", flexDirection: "column", gap: "0px", margin: 0 }}>
            {isChatTab ? (
              <div style={{ width: "35px", height: "35px", background: "var(--accent-primary)", borderRadius: "10px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "900", fontSize: "1.2rem" }}>W</div>
            ) : (
              <>
                <span style={{ 
                  fontSize: "1.1rem", 
                  fontWeight: "900", 
                  letterSpacing: "0.5px", 
                  lineHeight: 1, 
                  background: "linear-gradient(90deg, var(--accent-primary), #00d2ff)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}>WHATSAPP</span>
                <span style={{ fontSize: "0.55rem", color: "#94a3b8", letterSpacing: "1.5px", fontWeight: "800", textTransform: "uppercase", marginTop: "2px" }}>PRO DASHBOARD</span>
              </>
            )}
          </h2>
        </div>

        <div style={{ position: "relative" }}>
          {activeAccount && !isChatTab && (
            <div 
              onClick={() => setShowAccountSwitcher(!showAccountSwitcher)}
              style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "8px", 
                padding: "8px 12px", 
                borderRadius: "12px", 
                background: "rgba(0, 168, 132, 0.04)", 
                cursor: "pointer", 
                border: "1px solid rgba(0, 168, 132, 0.1)",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
              onMouseOver={e => {
                e.currentTarget.style.background = "rgba(0, 168, 132, 0.08)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseOut={e => {
                e.currentTarget.style.background = "rgba(0, 168, 132, 0.04)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <div style={{ width: "24px", height: "24px", borderRadius: "8px", background: "white", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 5px rgba(0,0,0,0.05)" }}>
                <Smartphone size={14} color="#00a884" />
              </div>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <p style={{ fontSize: "0.8rem", fontWeight: "700", margin: 0, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{activeAccount.name}</p>
              </div>
              <ChevronUp size={14} color="#94a3b8" style={{ transform: showAccountSwitcher ? "rotate(180deg)" : "none", transition: "0.3s" }} />
            </div>
          )}

          {isChatTab && activeAccount && (
            <div 
              onClick={() => setShowAccountSwitcher(!showAccountSwitcher)}
              style={{ width: "45px", height: "45px", background: "rgba(0, 168, 132, 0.1)", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", margin: "0 auto" }}
              title={activeAccount.name}
            >
              <Smartphone size={18} color="#00a884" />
            </div>
          )}

          {showAccountSwitcher && (
            <div style={{ 
              position: "absolute", 
              top: "calc(100% + 8px)", 
              left: isChatTab ? "50%" : "0", 
              transform: isChatTab ? "translateX(-50%)" : "none",
              width: isChatTab ? "200px" : "260px",
              background: "rgba(255, 255, 255, 0.98)", 
              borderRadius: "16px", 
              boxShadow: "0 10px 40px rgba(0,0,0,0.2)", 
              padding: "8px", 
              zIndex: 9999, 
              border: "1px solid rgba(0,0,0,0.05)",
              backdropFilter: "blur(20px)",
              animation: "slideIn 0.2s ease-out"
            }}>
              <p style={{ fontSize: "0.65rem", color: "#94a3b8", padding: "8px 12px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "1px" }}>Switch Instance</p>
              <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                {accounts.map(acc => (
                  <div 
                    key={acc._id} 
                    onClick={() => { switchAccount(acc); setShowAccountSwitcher(false); }}
                    style={{ 
                      padding: "10px 12px", 
                      borderRadius: "10px", 
                      cursor: "pointer", 
                      display: "flex", 
                      alignItems: "center", 
                      gap: "12px", 
                      marginBottom: "4px",
                      background: activeAccount?._id === acc._id ? "rgba(0, 168, 132, 0.08)" : "transparent",
                      transition: "all 0.2s"
                    }}
                    onMouseOver={e => e.currentTarget.style.background = activeAccount?._id === acc._id ? "rgba(0, 168, 132, 0.1)" : "#f8fafc"}
                    onMouseOut={e => e.currentTarget.style.background = activeAccount?._id === acc._id ? "rgba(0, 168, 132, 0.08)" : "transparent"}
                  >
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: activeAccount?._id === acc._id ? "#00a884" : "#cbd5e1" }} />
                    <span style={{ fontSize: "0.85rem", fontWeight: activeAccount?._id === acc._id ? "700" : "600", color: activeAccount?._id === acc._id ? "#00a884" : "#475569" }}>{acc.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>


      <nav style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.8rem",
        alignItems: isChatTab ? "center" : "stretch",
        overflowY: "auto",
        overflowX: "hidden",
        flex: 1,
        paddingRight: isChatTab ? "0" : "5px"
      }}>
        {(() => {
          const contactItems = visibleMenu.filter(item => ["contacts", "custom-fields"].includes(item.id));
          const otherItems = visibleMenu.filter(item => !["contacts", "custom-fields"].includes(item.id));

          return (
            <>
              {otherItems.map(item => (
                <Link
                  key={item.id}
                  to={item.path}
                  className={`nav-link ${location.pathname === item.path ? "active" : ""}`}
                  style={{
                    textDecoration: "none",
                    justifyContent: isChatTab ? "center" : "flex-start",
                    padding: isChatTab ? "0.8rem" : "0.7rem 12px",
                    width: isChatTab ? "45px" : "100%",
                    height: isChatTab ? "45px" : "auto",
                    borderRadius: "10px",
                    display: "flex",
                    alignItems: "center",
                    flexShrink: 0
                  }}
                  title={item.label}
                >
                  <item.icon size={22} />
                  {!isChatTab && <span style={{ marginLeft: "12px", fontWeight: "600" }}>{item.label}</span>}
                </Link>
              ))}

              {!isChatTab && contactItems.length > 0 && (
                <div style={{ marginTop: "1rem" }}>
                  <p style={{ fontSize: "0.7rem", color: "#667781", padding: "0 1rem", marginBottom: "0.5rem", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "1px" }}>Lead Management</p>
                  {contactItems.map(item => (
                    <Link
                      key={item.id}
                      to={item.path}
                      className={`nav-link ${location.pathname === item.path ? "active" : ""}`}
                      style={{
                        textDecoration: "none",
                        padding: "0.7rem 1rem",
                        borderRadius: "10px",
                        display: "flex",
                        alignItems: "center",
                        marginBottom: "4px"
                      }}
                    >
                      <item.icon size={18} />
                      <span style={{ marginLeft: "12px", fontSize: "0.85rem", fontWeight: "600" }}>{item.label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </>
          );
        })()}
      </nav>

      <div style={{ marginTop: "auto", borderTop: "1px solid var(--border-color)", paddingTop: "1.5rem", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, position: "relative" }}>


        <div style={{ marginTop: "auto", borderTop: "1px solid #e2e8f0", paddingTop: "1rem", width: "100%", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div
            onClick={handleLogout}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: isChatTab ? "10px" : "10px 12px",
              borderRadius: "12px",
              cursor: "pointer",
              transition: "all 0.2s",
              background: "rgba(255, 71, 87, 0.05)"
            }}
            className="logout-btn"
            onMouseOver={e => e.currentTarget.style.background = "rgba(255, 71, 87, 0.1)"}
            onMouseOut={e => e.currentTarget.style.background = "rgba(255, 71, 87, 0.05)"}
            title="Logout"
          >
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "var(--accent-primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "bold", fontSize: "0.9rem", flexShrink: 0 }}>
              {user?.name?.charAt(0)}
            </div>
            {!isChatTab && (
              <div style={{ flex: 1, overflow: "hidden" }}>
                <p style={{ fontSize: "0.85rem", fontWeight: "700", color: "#1e293b", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.name}</p>
                <p style={{ fontSize: "0.65rem", color: "#94a3b8", margin: 0, fontWeight: "600" }}>{user?.role} • Logout</p>
              </div>
            )}
            <LogOut size={18} color="#ff4757" />
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
