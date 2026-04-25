import React, { useState } from "react";
import axios from "axios";
import { Lock, Mail, LogIn } from "lucide-react";

import { API_BASE } from "../api";

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await axios.post(`${API_BASE}/auth/login`, { email, password });
      localStorage.setItem("userInfo", JSON.stringify(res.data));
      onLogin(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-primary)" }}>
      <div className="glass-card" style={{ width: "400px", padding: "2.5rem", background: "var(--bg-secondary)", border: "1px solid var(--border-color)", boxShadow: "0 10px 40px rgba(0,0,0,0.05)" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ width: "60px", height: "60px", background: "var(--accent-primary)", borderRadius: "15px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", color: "white" }}>
            <LogIn size={32} />
          </div>
          <h2 style={{ margin: 0, color: "var(--text-primary)" }}>Welcome Back</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginTop: "5px" }}>Log in to manage your WhatsApp dashboard</p>
        </div>

        {error && (
          <div style={{ padding: "10px", background: "rgba(255, 71, 87, 0.1)", color: "#ff4757", borderRadius: "8px", fontSize: "0.85rem", marginBottom: "1.5rem", textAlign: "center", border: "1px solid rgba(255, 71, 87, 0.2)" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "8px" }}>Email Address</label>
            <div style={{ position: "relative" }}>
              <Mail size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
              <input 
                type="email" 
                placeholder="admin@example.com"
                style={{ width: "100%", padding: "12px 12px 12px 40px", background: "var(--bg-tertiary)", border: "1px solid var(--glass-border)", color: "var(--text-primary)", borderRadius: "10px" }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: "2rem" }}>
            <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "8px" }}>Password</label>
            <div style={{ position: "relative" }}>
              <Lock size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
              <input 
                type="password" 
                placeholder="••••••••"
                style={{ width: "100%", padding: "12px 12px 12px 40px", background: "var(--bg-tertiary)", border: "1px solid var(--glass-border)", color: "var(--text-primary)", borderRadius: "10px" }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn-primary" 
            style={{ width: "100%", padding: "12px", display: "flex", justifyContent: "center", alignItems: "center", gap: "10px" }}
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login to Dashboard"}
          </button>
        </form>

        <div style={{ marginTop: "2rem", textAlign: "center", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
          <p>Default credentials: admin@example.com / adminpassword</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
