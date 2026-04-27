import React, { createContext, useState, useContext, useEffect } from "react";
import api from "./api";

const WhatsAppAccountContext = createContext();

export const WhatsAppAccountProvider = ({ children }) => {
  const [accounts, setAccounts] = useState([]);
  const [activeAccount, setActiveAccount] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAccounts = async () => {
    try {
      const res = await api.get("/whatsapp-accounts");
      setAccounts(res.data);
      
      const savedAccountId = localStorage.getItem("whatsappAccountId");
      const savedAccount = res.data.find(a => a._id === savedAccountId);
      
      if (savedAccount) {
        setActiveAccount(savedAccount);
      } else if (res.data.length > 0) {
        const defaultAccount = res.data.find(a => a.isDefault) || res.data[0];
        setActiveAccount(defaultAccount);
        localStorage.setItem("whatsappAccountId", defaultAccount._id);
        // No reload here to avoid loops, just set it
      }
    } catch (err) {
      console.error("Error fetching WhatsApp accounts:", err);
    } finally {
      setLoading(false);
    }
  };

  const switchAccount = (account) => {
    setActiveAccount(account);
    localStorage.setItem("whatsappAccountId", account._id);
    // Reload to clear states and trigger re-fetches with new header
    window.location.reload();
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  return (
    <WhatsAppAccountContext.Provider value={{ accounts, activeAccount, switchAccount, loading, refreshAccounts: fetchAccounts }}>
      {children}
    </WhatsAppAccountContext.Provider>
  );
};

export const useWhatsAppAccount = () => useContext(WhatsAppAccountContext);
