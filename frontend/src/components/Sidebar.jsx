import React from "react";
import { Link, useLocation } from "react-router-dom";
import { LogOut } from "lucide-react";

const Sidebar = ({ user, menuItems, handleLogout }) => {
  const location = useLocation();
  const isChatTab = location.pathname.startsWith("/chats");
  
  const visibleMenu = user ? menuItems.filter(item => item.roles.includes(user.role)) : [];

  return (
    <aside className={`sidebar ${isChatTab ? "mini-sidebar" : ""}`} style={{ 
      width: isChatTab ? "70px" : "260px", 
      transition: "all 0.3s ease",
      padding: isChatTab ? "1.5rem 0" : "2rem 1rem"
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

      <div style={{ marginTop: "auto", borderTop: "1px solid var(--border-color)", paddingTop: "1.5rem", width: "100%", display: "flex", flexDirection: "column", alignItems: isChatTab ? "center" : "stretch", flexShrink: 0 }}>
        {isChatTab ? (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.5rem" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "var(--accent-primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "bold", fontSize: "1.2rem" }}>
              {user?.name?.charAt(0)}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "0 10px", marginBottom: "1.5rem" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "var(--accent-primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "bold", fontSize: "1.2rem" }}>
              {user?.name?.charAt(0)}
            </div>
            <div style={{ overflow: "hidden" }}>
              <p style={{ fontSize: "0.9rem", fontWeight: "800", color: "var(--text-primary)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.name}</p>
              <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", margin: 0 }}>{user?.role}</p>
            </div>
          </div>
        )}
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
