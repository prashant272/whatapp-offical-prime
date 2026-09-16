import React, { useState, useEffect } from 'react';
import api from '../api';
import { toast } from 'react-hot-toast';

const MetaAdsManager = () => {
  const [appId, setAppId] = useState(localStorage.getItem("meta_app_id") || "1615467726832537");
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [whatsappAccounts, setWhatsappAccounts] = useState([]);
  const [selectedWhatsApp, setSelectedWhatsApp] = useState("");
  const [fbPages, setFbPages] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchConnectedAccounts();
    fetchWhatsAppAccounts();
  }, []);

  const fetchConnectedAccounts = async () => {
    try {
      const res = await api.get('/meta-auth/pages');
      setAccounts(res.data.pages);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchWhatsAppAccounts = async () => {
    try {
      const res = await api.get('/whatsapp-accounts');
      setWhatsappAccounts(res.data);
      if (res.data.length > 0) {
        setSelectedWhatsApp(res.data[0]._id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadFbSdk = () => {
    if (!appId) {
      toast.error("Please enter your Facebook App ID first");
      return;
    }
    
    localStorage.setItem("meta_app_id", appId);

    if (window.FB) {
      setSdkLoaded(true);
      return;
    }

    window.fbAsyncInit = function() {
      window.FB.init({
        appId      : appId,
        cookie     : true,
        xfbml      : true,
        version    : 'v19.0'
      });
      setSdkLoaded(true);
    };

    (function(d, s, id){
       var js, fjs = d.getElementsByTagName(s)[0];
       if (d.getElementById(id)) {return;}
       js = d.createElement(s); js.id = id;
       js.src = "https://connect.facebook.net/en_US/sdk.js";
       fjs.parentNode.insertBefore(js, fjs);
     }(document, 'script', 'facebook-jssdk'));
  };

  const handleLogin = () => {
    if (!window.FB) {
      toast.error("Facebook SDK not loaded yet.");
      return;
    }

    window.FB.login((response) => {
      if (response.authResponse) {
        fetchUserPages();
      } else {
        toast.error('User cancelled login or did not fully authorize.');
      }
    }, {scope: 'pages_show_list,pages_manage_ads,leads_retrieval,pages_manage_metadata,pages_read_engagement'});
  };

  const fetchUserPages = () => {
    setLoading(true);
    window.FB.api('/me/accounts', (response) => {
      setLoading(false);
      if (response && !response.error) {
        setFbPages(response.data);
      } else {
        toast.error("Error fetching pages");
      }
    });
  };

  const connectPage = async (page) => {
    if (!selectedWhatsApp) {
      toast.error("Please select a WhatsApp account to map to");
      return;
    }

    try {
      await api.post('/meta-auth/connect', {
        pages: [page],
        whatsappAccountId: selectedWhatsApp
      });
      toast.success(`${page.name} connected successfully!`);
      fetchConnectedAccounts();
      
      // Remove from available list
      setFbPages(fbPages.filter(p => p.id !== page.id));
    } catch (err) {
      toast.error("Failed to connect page");
    }
  };

  const disconnectPage = async (id) => {
    if (!window.confirm("Are you sure you want to disconnect this page?")) return;
    try {
      await api.delete(`/meta-auth/pages/${id}`);
      toast.success("Page disconnected");
      fetchConnectedAccounts();
    } catch (err) {
      toast.error("Failed to disconnect page");
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ marginBottom: '10px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)' }}>Meta Ads Integration</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '5px' }}>Connect Facebook Pages to automatically sync leads.</p>
      </div>

      {/* App Setup Section */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>1. Facebook App Setup</h2>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: 'var(--text-secondary)' }}>
              Facebook App ID
            </label>
            <input 
              type="text" 
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 15px',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none'
              }}
              placeholder="e.g. 1234567890"
            />
          </div>
          <button 
            onClick={loadFbSdk}
            disabled={sdkLoaded}
            className="btn-primary"
            style={{ 
              background: sdkLoaded ? 'var(--accent-secondary)' : 'var(--accent-primary)',
              opacity: sdkLoaded ? 0.7 : 1,
              cursor: sdkLoaded ? 'not-allowed' : 'pointer'
            }}
          >
            {sdkLoaded ? 'SDK Loaded ✅' : 'Initialize SDK'}
          </button>
        </div>
      </div>

      {/* Connect Pages Section */}
      {sdkLoaded && (
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '15px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>2. Connect Pages</h2>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '5px' }}>Login with Facebook to see your pages.</p>
            </div>
            <button 
              onClick={handleLogin}
              style={{
                background: '#1877F2',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              Login with Facebook
            </button>
          </div>

          {fbPages.length > 0 && (
            <div style={{ background: 'var(--bg-tertiary)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '15px' }}>Available Pages</h3>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: 'var(--text-secondary)', fontWeight: '500' }}>
                  Route incoming leads to WhatsApp Account:
                </label>
                <select 
                  value={selectedWhatsApp}
                  onChange={(e) => setSelectedWhatsApp(e.target.value)}
                  style={{
                    width: '100%',
                    maxWidth: '400px',
                    padding: '10px 15px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    background: 'white'
                  }}
                >
                  <option value="">Select an account...</option>
                  {whatsappAccounts.map(wa => (
                    <option key={wa._id} value={wa._id}>{wa.name} ({wa.phone})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
                {fbPages.map(page => (
                  <div key={page.id} style={{ 
                    background: 'white', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '8px', 
                    padding: '15px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <p style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{page.name}</p>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>ID: {page.id}</p>
                    </div>
                    <button 
                      onClick={() => connectPage(page)}
                      style={{
                        background: '#e6f4ea',
                        color: '#137333',
                        border: '1px solid #ceead6',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontWeight: '600',
                        fontSize: '13px',
                        cursor: 'pointer'
                      }}
                    >
                      Connect
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Connected Pages Section */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>Connected Pages</h2>
        
        {accounts.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', background: 'var(--bg-tertiary)', borderRadius: '8px', color: 'var(--text-secondary)' }}>
            No pages connected yet. Login with Facebook to connect a page.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '12px 15px', fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>Page Name</th>
                  <th style={{ padding: '12px 15px', fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>Page ID</th>
                  <th style={{ padding: '12px 15px', fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>WhatsApp Account</th>
                  <th style={{ padding: '12px 15px', fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((acc, idx) => (
                  <tr key={acc._id} style={{ borderBottom: idx === accounts.length - 1 ? 'none' : '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px 15px', fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>{acc.pageName}</td>
                    <td style={{ padding: '12px 15px', fontSize: '13px', color: 'var(--text-secondary)' }}>{acc.pageId}</td>
                    <td style={{ padding: '12px 15px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {acc.whatsappAccountId ? `${acc.whatsappAccountId.name} (${acc.whatsappAccountId.phone})` : 'Unassigned'}
                    </td>
                    <td style={{ padding: '12px 15px', textAlign: 'right' }}>
                      <button 
                        onClick={() => disconnectPage(acc._id)}
                        style={{
                          background: 'transparent',
                          color: '#d93025',
                          border: 'none',
                          fontWeight: '600',
                          fontSize: '13px',
                          cursor: 'pointer',
                          padding: '6px 12px',
                          borderRadius: '6px'
                        }}
                        onMouseOver={(e) => e.target.style.background = '#fce8e6'}
                        onMouseOut={(e) => e.target.style.background = 'transparent'}
                      >
                        Disconnect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default MetaAdsManager;
