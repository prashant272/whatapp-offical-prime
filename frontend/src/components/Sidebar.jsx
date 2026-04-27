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
      width: isChatTab ? "70px" : "260px", 
      transition: "all 0.3s ease",
      padding: isChatTab ? "1.5rem 0" : "2rem 1rem",
      display: "flex",
      flexDirection: "column",
      zIndex: 100
    }}>
      <div style={{ marginBottom: "2rem", textAlign: "center" }}>
        <h2 style={{ display: "flex", flexDirection: "column", gap: "2px", color: "var(--accent-primary)", alignItems: "center" }}>
          {isChatTab ? (
            <span style={{ fontSize: "1.5rem", fontWeight: "900" }}>W</span>
          ) : (
            <div style={{ textAlign: "left", width: "100%" }}>
              <span style={{ fontSize: "1.2rem", fontWeight: "900" }}>WHATSAPP</span>
              <span style={{ fontSize: "0.6rem", color: "var(--text-secondary)", letterSpacing: "1px", display: "block" }}>PROFESSIONAL PANEL</span>
            </div>
          )}
        </h2>
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
        {visibleMenu.map(item => (
          <Link 
            key={item.id}
            to={item.path} 
            className={`nav-link ${location.pathname === item.path ? "active" : ""}`}
            style={{ 
              textDecoration: "none", 
              justifyContent: isChatTab ? "center" : "flex-start",
              padding: isChatTab ? "0.8rem" : "0.8rem 1rem",
              width: isChatTab ? "45px" : "100%",
              height: isChatTab ? "45px" : "auto",
              borderRadius: "12px",
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
      </nav>

      <div style={{ marginTop: "auto", borderTop: "1px solid var(--border-color)", paddingTop: "1.5rem", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, position: "relative" }}>
        
        {/* Account Switcher Popup */}
        {showAccountSwitcher && (
          <div style={{ 
            position: "absolute", 
            bottom: "100%", 
            left: isChatTab ? "10px" : "0", 
            right: isChatTab ? "auto" : "0", 
            width: isChatTab ? "200px" : "100%",
            background: "white", 
            borderRadius: "16px", 
            boxShadow: "0 -10px 25px rgba(0,0,0,0.1)", 
            padding: "10px", 
            marginBottom: "10px", 
            zIndex: 1000, 
            border: "1px solid #e1e1e1" 
          }}>
            <p style={{ fontSize: "0.75rem", color: "#667781", padding: "8px", fontWeight: "bold", borderBottom: "1px solid #f0f0f0" }}>SWITCH NUMBER</p>
            {accounts.map(acc => (
              <div 
                key={acc._id} 
                onClick={() => { switchAccount(acc); setShowAccountSwitcher(false); }}
                style={{ padding: "12px", borderRadius: "10px", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", background: activeAccount?._id === acc._id ? "#f0fdf4" : "transparent" }}
              >
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: activeAccount?._id === acc._id ? "#00a884" : "#ccc" }} />
                <span style={{ fontSize: "0.85rem", fontWeight: activeAccount?._id === acc._id ? "bold" : "normal", color: "#111b21" }}>{acc.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Active Account Display (Compact for Mini Sidebar) */}
        {activeAccount && (
          <div 
            onClick={() => setShowAccountSwitcher(!showAccountSwitcher)}
            title={`Switch from: ${activeAccount.name}`}
            style={{ 
              display: "flex", 
              alignItems: "center", 
              justifyContent: isChatTab ? "center" : "flex-start",
              gap: "10px", 
              padding: isChatTab ? "10px" : "12px", 
              width: isChatTab ? "45px" : "100%",
              height: isChatTab ? "45px" : "auto",
              borderRadius: "12px", 
              background: "#f8f9fa", 
              marginBottom: "1rem", 
              cursor: "pointer", 
              border: "1px solid #e1e1e1" 
            }}
          >
            <Smartphone size={18} color="#00a884" />
            {!isChatTab && (
              <>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <p style={{ fontSize: "0.75rem", fontWeight: "bold", margin: 0, color: "#111b21" }}>{activeAccount.name}</p>
                  <p style={{ fontSize: "0.65rem", color: "#667781", margin: 0 }}>Active</p>
                </div>
                <ChevronUp size={16} color="#667781" style={{ transform: showAccountSwitcher ? "rotate(180deg)" : "none", transition: "0.2s" }} />
              </>
            )}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: isChatTab ? "0" : "0 10px", marginBottom: "1.5rem" }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "var(--accent-primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "bold", fontSize: "1.2rem", flexShrink: 0 }}>
            {user?.name?.charAt(0)}
          </div>
          {!isChatTab && (
            <div style={{ overflow: "hidden" }}>
              <p style={{ fontSize: "0.9rem", fontWeight: "800", color: "var(--text-primary)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.name}</p>
              <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", margin: 0 }}>{user?.role}</p>
            </div>
          )}
        </div>

        <div 
          className="nav-link" 
          style={{ 
            cursor: "pointer", 
            color: "#ff4757", 
            justifyContent: isChatTab ? "center" : "flex-start", 
            padding: isChatTab ? "0.8rem" : "0.8rem 1rem",
            width: isChatTab ? "45px" : "100%",
            height: isChatTab ? "45px" : "auto",
            display: "flex",
            alignItems: "center",
            borderRadius: "12px",
            flexShrink: 0
          }} 
          onClick={handleLogout}
          title="Logout"
        >
          <LogOut size={22} />
          {!isChatTab && <span style={{ marginLeft: "12px", fontWeight: "600" }}>Logout</span>}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
