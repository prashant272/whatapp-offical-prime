import React, { useState, useEffect, useRef } from "react";
import {
  Send, CheckCheck, Eye, MessageSquare, XCircle,
  Users, MessageCircle, Zap, ChevronRight,
  Activity, Phone, X, RefreshCw
} from "lucide-react";
import api from "../api";

/* ─── tiny SVG bar chart ─────────────────────────────────────── */
const MiniBarChart = ({ data, color }) => {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <svg viewBox={`0 0 ${data.length * 14} 40`} style={{ width: "100%", height: "40px" }}>
      {data.map((d, i) => {
        const h = Math.max((d.value / max) * 36, 2);
        return (
          <rect
            key={i}
            x={i * 14 + 2}
            y={40 - h}
            width={10}
            height={h}
            rx={3}
            fill={color}
            opacity={0.75}
          />
        );
      })}
    </svg>
  );
};

/* ─── SVG Line chart with hover tooltip ─────────────────────── */
const LineChart = ({ data, keys, colors, labels }) => {
  const [hover, setHover] = useState(null); // { index, x, y }
  const svgRef = useRef();

  if (!data || data.length === 0) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "180px", color: "#94a3b8", fontSize: "0.85rem" }}>
      No data yet
    </div>
  );

  const W = 600, H = 180, PAD = { t: 16, r: 16, b: 35, l: 44 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const maxVal = Math.max(...keys.flatMap(k => data.map(d => d[k] || 0)), 1);
  const xStep  = innerW / Math.max(data.length - 1, 1);

  const px = (i) => PAD.l + i * xStep;
  const py = (i, key) => PAD.t + innerH - ((data[i][key] || 0) / maxVal) * innerH;

  // smooth curve using bezier control points
  const smoothPath = (key) =>
    data.map((_, i) => {
      const x0 = px(i), y0 = py(i, key);
      if (i === 0) return `M ${x0} ${y0}`;
      const xp = px(i - 1), yp = py(i - 1, key);
      const cpx = (xp + x0) / 2;
      return `C ${cpx} ${yp}, ${cpx} ${y0}, ${x0} ${y0}`;
    }).join(" ");

  // filled area under curve
  const areaPath = (key) => {
    const line = data.map((_, i) => {
      const x0 = px(i), y0 = py(i, key);
      if (i === 0) return `M ${x0} ${y0}`;
      const xp = px(i - 1), yp = py(i - 1, key);
      const cpx = (xp + x0) / 2;
      return `C ${cpx} ${yp}, ${cpx} ${y0}, ${x0} ${y0}`;
    }).join(" ");
    return `${line} L ${px(data.length - 1)} ${H - PAD.b} L ${px(0)} ${H - PAD.b} Z`;
  };

  const ticks = [0, Math.round(maxVal / 2), maxVal];

  // find nearest index from SVG X coordinate
  const handleMouseMove = (e) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (W / rect.width);
    const idx = Math.round((mouseX - PAD.l) / xStep);
    const clamped = Math.max(0, Math.min(data.length - 1, idx));
    setHover({ index: clamped, x: px(clamped) });
  };

  const hd = hover !== null ? data[hover.index] : null;
  // position tooltip so it doesn't overflow right edge
  const tooltipX = hover ? (hover.x > W * 0.65 ? hover.x - 130 : hover.x + 12) : 0;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: "180px", cursor: "crosshair" }}
      preserveAspectRatio="none"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHover(null)}
    >
      <defs>
        {keys.map((key, ki) => (
          <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={colors[ki]} stopOpacity="0.18" />
            <stop offset="100%" stopColor={colors[ki]} stopOpacity="0.01" />
          </linearGradient>
        ))}
      </defs>

      {/* grid lines */}
      {ticks.map((t, i) => {
        const y = PAD.t + innerH - (t / maxVal) * innerH;
        return (
          <g key={i}>
            <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="#f0f4f8" strokeWidth="1" strokeDasharray="4 3" />
            <text x={PAD.l - 6} y={y + 4} textAnchor="end" fontSize="9" fill="#cbd5e1" fontWeight="600">
              {t >= 1000 ? `${(t / 1000).toFixed(1)}k` : t}
            </text>
          </g>
        );
      })}

      {/* filled areas */}
      {keys.map((key, ki) => (
        <path key={`area-${key}`} d={areaPath(key)} fill={`url(#grad-${key})`} />
      ))}

      {/* lines */}
      {keys.map((key, ki) => (
        <path
          key={`line-${key}`}
          d={smoothPath(key)}
          fill="none"
          stroke={colors[ki]}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}

      {/* x-axis labels */}
      {data.map((d, i) => (
        <text key={i} x={px(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="#94a3b8" fontWeight="600">
          {d.date ? d.date.slice(5) : ""}
        </text>
      ))}

      {/* hover crosshair + tooltip */}
      {hover !== null && hd && (
        <g>
          {/* vertical line */}
          <line
            x1={hover.x} y1={PAD.t}
            x2={hover.x} y2={H - PAD.b}
            stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 3"
          />

          {/* dots at hover index for each key */}
          {keys.map((key, ki) => (
            <circle
              key={key}
              cx={hover.x}
              cy={py(hover.index, key)}
              r="5"
              fill={colors[ki]}
              stroke="white"
              strokeWidth="2"
            />
          ))}

          {/* tooltip box */}
          <g transform={`translate(${tooltipX}, ${PAD.t})`}>
            <rect x={0} y={0} width={120} height={keys.length * 20 + 28} rx={8} ry={8}
              fill="#1e293b" opacity="0.93" />
            {/* date */}
            <text x={10} y={16} fontSize="10" fill="#94a3b8" fontWeight="700">
              {hd.date?.replace(/-/g, "/")}
            </text>
            {keys.map((key, ki) => (
              <g key={key} transform={`translate(10, ${28 + ki * 20})`}>
                <rect x={0} y={-9} width={8} height={8} rx={2} fill={colors[ki]} />
                <text x={12} y={0} fontSize="10" fill="white" fontWeight="600">
                  {labels?.[ki] || key}:
                </text>
                <text x={112} y={0} fontSize="10" fill="white" fontWeight="800" textAnchor="end">
                  {(hd[key] || 0).toLocaleString()}
                </text>
              </g>
            ))}
          </g>
        </g>
      )}
    </svg>
  );
};


/* ─── Donut Chart ─────────────────────────────────────────────── */
const DonutChart = ({ segments, size = 100 }) => {
  const r = 38, cx = 50, cy = 50;
  const circumference = 2 * Math.PI * r;
  const total = segments.reduce((a, b) => a + b.value, 0) || 1;
  let offset = 0;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth="14" />
      {segments.map((seg, i) => {
        const dash = (seg.value / total) * circumference;
        const el = (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth="14"
            strokeDasharray={`${dash} ${circumference}`}
            strokeDashoffset={-offset}
            strokeLinecap="round"
            style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}
          />
        );
        offset += dash;
        return el;
      })}
      <text x={50} y={50} textAnchor="middle" dominantBaseline="middle" fontSize="13" fontWeight="800" fill="#1e293b">
        {total.toLocaleString()}
      </text>
    </svg>
  );
};

/* ─── Account Breakdown Modal ─────────────────────────────────── */
const AccountModal = ({ onClose, accounts, statKey, title, color }) => {
  const ref = useRef();
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    setTimeout(() => document.addEventListener("mousedown", handler), 100);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const STAT_LABELS = {
    sent: { label: "Sent", icon: Send, color: "#6366f1" },
    delivered: { label: "Delivered", icon: CheckCheck, color: "#10b981" },
    read: { label: "Read / Seen", icon: Eye, color: "#3b82f6" },
    replies: { label: "Replies", icon: MessageSquare, color: "#f59e0b" },
    failed: { label: "Failed", icon: XCircle, color: "#ef4444" },
  };

  const meta = STAT_LABELS[statKey] || {};

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)",
      backdropFilter: "blur(6px)", zIndex: 9000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem"
    }}>
      <div ref={ref} style={{
        background: "white", borderRadius: "24px", width: "100%", maxWidth: "680px",
        maxHeight: "80vh", overflow: "hidden", display: "flex", flexDirection: "column",
        boxShadow: "0 30px 80px rgba(0,0,0,0.2)"
      }}>
        {/* Header */}
        <div style={{
          padding: "24px 28px", borderBottom: "1px solid #f1f5f9",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: `linear-gradient(135deg, ${color}10, ${color}05)`
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "42px", height: "42px", borderRadius: "12px",
              background: `linear-gradient(135deg, ${color}, ${color}cc)`,
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              {meta.icon && <meta.icon size={20} color="white" />}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "900", color: "#0f172a" }}>
                {title} — By Account
              </h2>
              <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "#64748b", fontWeight: "600" }}>
                {accounts.length} WhatsApp account{accounts.length !== 1 ? "s" : ""} connected
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{
            width: "36px", height: "36px", borderRadius: "10px", border: "1px solid #e2e8f0",
            background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <X size={16} color="#64748b" />
          </button>
        </div>

        {/* Account list */}
        <div style={{ overflow: "auto", padding: "20px 28px", display: "flex", flexDirection: "column", gap: "12px" }}>
          {accounts.length === 0 ? (
            <p style={{ textAlign: "center", color: "#94a3b8", padding: "2rem 0" }}>No accounts connected yet.</p>
          ) : accounts.map((acc) => {
            const val = acc[statKey] || 0;
            const total = acc.sent || 1;
            const pct = statKey === "sent" ? 100 : Math.round((val / total) * 100);
            return (
              <div key={acc.accountId} style={{
                padding: "16px 20px", background: "#f8fafc", borderRadius: "16px",
                border: "1px solid #e8edf3", transition: "all 0.2s"
              }}
                onMouseOver={e => e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.06)"}
                onMouseOut={e => e.currentTarget.style.boxShadow = "none"}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                      width: "36px", height: "36px", borderRadius: "10px",
                      background: acc.isActive ? "linear-gradient(135deg, #10b981, #059669)" : "#e2e8f0",
                      display: "flex", alignItems: "center", justifyContent: "center"
                    }}>
                      <Phone size={16} color="white" />
                    </div>
                    <div>
                      <div style={{ fontWeight: "800", fontSize: "0.9rem", color: "#1e293b" }}>{acc.accountName}</div>
                      <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "600" }}>{acc.phoneNumber}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "1.5rem", fontWeight: "900", color, lineHeight: 1 }}>{val.toLocaleString()}</div>
                    <div style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: "700", marginTop: "2px" }}>{pct}% of sent</div>
                  </div>
                </div>
                {/* Progress bar */}
                <div style={{ height: "6px", background: "#e8edf3", borderRadius: "6px", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", width: `${pct}%`, background: color,
                    borderRadius: "6px", transition: "width 0.6s ease"
                  }} />
                </div>
                {/* Mini stats row */}
                <div style={{ display: "flex", gap: "20px", marginTop: "10px" }}>
                  {[
                    { label: "Sent", v: acc.sent, c: "#6366f1" },
                    { label: "Delivered", v: acc.delivered, c: "#10b981" },
                    { label: "Read", v: acc.read, c: "#3b82f6" },
                    { label: "Replies", v: acc.replies, c: "#f59e0b" },
                    { label: "Failed", v: acc.failed, c: "#ef4444" },
                  ].map(s => (
                    <div key={s.label} style={{ textAlign: "center" }}>
                      <div style={{ fontWeight: "800", fontSize: "0.85rem", color: s.c }}>{s.v?.toLocaleString()}</div>
                      <div style={{ fontSize: "0.65rem", color: "#94a3b8", fontWeight: "700" }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ─── Main Dashboard Component ───────────────────────────────── */
const DashboardHome = ({ user }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { statKey, title, color }
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const res = await api.get("/dashboard/stats");
      setData(res.data);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openModal = (statKey, title, color) => setModal({ statKey, title, color });

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "calc(100vh - 2rem)", flexDirection: "column", gap: "16px" }}>
        <div style={{
          width: "48px", height: "48px", borderRadius: "50%",
          border: "4px solid #f1f5f9", borderTop: "4px solid #6366f1",
          animation: "spin 1s linear infinite"
        }} />
        <p style={{ color: "#64748b", fontWeight: "600", fontSize: "0.9rem" }}>Loading dashboard…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const o = data?.overall || {};
  const accounts = data?.accounts || [];
  const daily = data?.dailyChart || [];
  const conversations = data?.conversations || {};
  const campaigns = data?.campaigns || {};
  const contacts = data?.contacts || {};

  const deliveryRate = parseFloat(o.deliveryRate) || 0;
  const readRate = parseFloat(o.readRate) || 0;
  const replyRate = parseFloat(o.replyRate) || 0;

  const STAT_CARDS = [
    {
      key: "sent", label: "Total Sent", value: o.sent || 0,
      icon: Send, gradient: "linear-gradient(135deg, #6366f1, #4f46e5)",
      bg: "#eef2ff", color: "#6366f1", badge: "+messages",
      sparkData: daily.map(d => ({ value: d.sent })),
    },
    {
      key: "delivered", label: "Delivered", value: o.delivered || 0,
      icon: CheckCheck, gradient: "linear-gradient(135deg, #10b981, #059669)",
      bg: "#f0fdf4", color: "#10b981", badge: `${deliveryRate}% rate`,
      sparkData: daily.map(d => ({ value: d.sent })),
    },
    {
      key: "read", label: "Seen / Read", value: o.read || 0,
      icon: Eye, gradient: "linear-gradient(135deg, #3b82f6, #2563eb)",
      bg: "#eff6ff", color: "#3b82f6", badge: `${readRate}% rate`,
      sparkData: daily.map(d => ({ value: d.sent })),
    },
    {
      key: "replies", label: "Replies Received", value: o.replies || 0,
      icon: MessageSquare, gradient: "linear-gradient(135deg, #f59e0b, #d97706)",
      bg: "#fffbeb", color: "#f59e0b", badge: `${replyRate}% reply rate`,
      sparkData: daily.map(d => ({ value: d.received })),
    },
    {
      key: "failed", label: "Failed", value: o.failed || 0,
      icon: XCircle, gradient: "linear-gradient(135deg, #ef4444, #dc2626)",
      bg: "#fef2f2", color: "#ef4444", badge: "errors",
      sparkData: daily.map(d => ({ value: d.sent })),
    },
  ];

  const statusColors = ["#6366f1", "#10b981", "#f59e0b", "#3b82f6", "#ef4444", "#8b5cf6", "#ec4899"];

  return (
    <div style={{ padding: "1.5rem", maxWidth: "1400px", margin: "0 auto", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .stat-card { animation: fadeUp 0.4s ease both; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s !important; }
        .stat-card:hover { transform: translateY(-4px) !important; box-shadow: 0 20px 40px rgba(0,0,0,0.10) !important; }
        .chart-card { animation: fadeUp 0.5s ease both; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.75rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.6rem", fontWeight: "900", color: "#0f172a", letterSpacing: "-0.5px" }}>
            Good {new Date().getHours() < 12 ? "Morning" : new Date().getHours() < 18 ? "Afternoon" : "Evening"}, {user?.name?.split(" ")[0] || "there"} 👋
          </h1>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "0.88rem", fontWeight: "600" }}>
            Here's your WhatsApp messaging overview • {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "10px 18px", border: "1px solid #e2e8f0",
            background: "white", borderRadius: "12px", cursor: "pointer",
            fontWeight: "700", fontSize: "0.82rem", color: "#6366f1",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)", transition: "all 0.2s"
          }}
          onMouseOver={e => e.currentTarget.style.background = "#f5f3ff"}
          onMouseOut={e => e.currentTarget.style.background = "white"}
        >
          <RefreshCw size={14} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
          Refresh
        </button>
      </div>

      {/* ── Top KPI Cards (5 clickable) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
        {STAT_CARDS.map((card, idx) => (
          <div
            key={card.key}
            className="stat-card"
            onClick={() => openModal(card.key, card.label, card.color)}
            style={{
              background: "white", borderRadius: "20px", padding: "20px",
              border: `1px solid ${card.bg}`,
              boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
              animationDelay: `${idx * 0.06}s`,
              position: "relative", overflow: "hidden"
            }}
          >
            {/* soft bg circle */}
            <div style={{
              position: "absolute", top: "-20px", right: "-20px",
              width: "80px", height: "80px", borderRadius: "50%",
              background: card.bg, opacity: 0.7
            }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <div style={{
                width: "38px", height: "38px", borderRadius: "11px",
                background: card.gradient,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 6px 16px ${card.color}30`
              }}>
                <card.icon size={18} color="white" />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.68rem", color: "#94a3b8", fontWeight: "700" }}>
                <ChevronRight size={12} />
                View by account
              </div>
            </div>
            <div style={{ fontSize: "1.8rem", fontWeight: "900", color: "#0f172a", lineHeight: 1, marginBottom: "4px" }}>
              {(card.value).toLocaleString()}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "700", marginBottom: "10px" }}>{card.label}</div>
            <div style={{ fontSize: "0.68rem", color: card.color, fontWeight: "800", background: card.bg, padding: "2px 8px", borderRadius: "20px", display: "inline-block" }}>
              {card.badge}
            </div>
            {/* Sparkline */}
            <div style={{ marginTop: "10px", opacity: 0.7 }}>
              <MiniBarChart data={card.sparkData} color={card.color} />
            </div>
          </div>
        ))}
      </div>

      {/* ── Main Charts Row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "1.25rem", marginBottom: "1.25rem" }}>

        {/* Line Chart — 7-day Activity */}
        <div className="chart-card" style={{
          background: "white", borderRadius: "20px", padding: "24px",
          border: "1px solid #f1f5f9", boxShadow: "0 4px 20px rgba(0,0,0,0.03)"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: "900", color: "#0f172a" }}>
                7-Day Message Activity
              </h2>
              <p style={{ margin: "3px 0 0", fontSize: "0.78rem", color: "#94a3b8", fontWeight: "600" }}>
                Outbound vs inbound trend
              </p>
            </div>
            <div style={{ display: "flex", gap: "16px" }}>
              {[{ label: "Sent", color: "#6366f1" }, { label: "Received", color: "#10b981" }].map(l => (
                <div key={l.label} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", fontWeight: "700", color: "#64748b" }}>
                  <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: l.color }} />
                  {l.label}
                </div>
              ))}
            </div>
          </div>
          <LineChart
            data={daily}
            keys={["sent", "received"]}
            colors={["#6366f1", "#10b981"]}
            labels={["Sent", "Received"]}
          />
        </div>

        {/* Donut — Delivery Breakdown */}
        <div className="chart-card" style={{
          background: "white", borderRadius: "20px", padding: "24px",
          border: "1px solid #f1f5f9", boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
          display: "flex", flexDirection: "column"
        }}>
          <h2 style={{ margin: "0 0 4px", fontSize: "1rem", fontWeight: "900", color: "#0f172a" }}>
            Message Outcomes
          </h2>
          <p style={{ margin: "0 0 20px", fontSize: "0.78rem", color: "#94a3b8", fontWeight: "600" }}>
            Overall delivery pipeline
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flex: 1 }}>
            <DonutChart
              size={120}
              segments={[
                { value: o.read || 0, color: "#3b82f6" },
                { value: Math.max((o.delivered || 0) - (o.read || 0), 0), color: "#10b981" },
                { value: Math.max((o.sent || 0) - (o.delivered || 0), 0), color: "#e2e8f0" },
                { value: o.failed || 0, color: "#ef4444" },
              ]}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1, paddingLeft: "16px" }}>
              {[
                { label: "Read", value: o.read || 0, color: "#3b82f6" },
                { label: "Delivered", value: Math.max((o.delivered || 0) - (o.read || 0), 0), color: "#10b981" },
                { label: "Sent only", value: Math.max((o.sent || 0) - (o.delivered || 0), 0), color: "#94a3b8" },
                { label: "Failed", value: o.failed || 0, color: "#ef4444" },
              ].map(s => (
                <div key={s.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: s.color }} />
                    <span style={{ fontSize: "0.78rem", fontWeight: "700", color: "#64748b" }}>{s.label}</span>
                  </div>
                  <span style={{ fontSize: "0.82rem", fontWeight: "900", color: "#1e293b" }}>{s.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Rate bars */}
          <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
            {[
              { label: "Delivery Rate", pct: deliveryRate, color: "#10b981" },
              { label: "Read Rate", pct: readRate, color: "#3b82f6" },
              { label: "Reply Rate", pct: replyRate, color: "#f59e0b" },
            ].map(r => (
              <div key={r.label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                  <span style={{ fontSize: "0.72rem", fontWeight: "700", color: "#64748b" }}>{r.label}</span>
                  <span style={{ fontSize: "0.72rem", fontWeight: "900", color: r.color }}>{r.pct}%</span>
                </div>
                <div style={{ height: "5px", background: "#f1f5f9", borderRadius: "5px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(r.pct, 100)}%`, background: r.color, borderRadius: "5px", transition: "width 0.8s ease" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Summary Cards Row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "1.25rem", marginBottom: "1.25rem", alignItems: "start" }}>

        {/* Conversations card */}
        <div style={{
          background: "white", borderRadius: "20px", padding: "22px",
          border: "1px solid #f1f5f9", boxShadow: "0 4px 20px rgba(0,0,0,0.03)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <div style={{ width: "34px", height: "34px", borderRadius: "10px", background: "linear-gradient(135deg, #8b5cf6, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MessageCircle size={17} color="white" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: "900", color: "#0f172a" }}>Conversations</h3>
              <p style={{ margin: 0, fontSize: "0.72rem", color: "#94a3b8", fontWeight: "600" }}>All pipeline stages</p>
            </div>
          </div>

          {/* Total + Open mini KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "14px" }}>
            {[
              { label: "Total", value: conversations.total || 0, color: "#8b5cf6" },
              { label: "Open", value: conversations.open || 0, color: "#f59e0b" },
            ].map(s => (
              <div key={s.label} style={{ background: "#f8fafc", borderRadius: "12px", padding: "10px", textAlign: "center" }}>
                <div style={{ fontSize: "1.3rem", fontWeight: "900", color: s.color }}>{s.value.toLocaleString()}</div>
                <div style={{ fontSize: "0.68rem", fontWeight: "700", color: "#94a3b8" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* ALL status breakdown — no slice */}
          <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
            {conversations.statusBreakdown?.length === 0 && (
              <p style={{ margin: 0, fontSize: "0.78rem", color: "#94a3b8", textAlign: "center" }}>No conversations yet</p>
            )}
            {conversations.statusBreakdown?.sort((a, b) => b.count - a.count).map((s, i) => {
              const pct = conversations.total > 0 ? Math.round((s.count / conversations.total) * 100) : 0;
              return (
                <div key={s.status}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: statusColors[i % statusColors.length], flexShrink: 0 }} />
                      <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "#475569" }}>{s.status}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: "600" }}>{pct}%</span>
                      <span style={{ fontSize: "0.8rem", fontWeight: "900", color: "#1e293b", minWidth: "28px", textAlign: "right" }}>{s.count.toLocaleString()}</span>
                    </div>
                  </div>
                  <div style={{ height: "4px", background: "#f1f5f9", borderRadius: "4px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: statusColors[i % statusColors.length], borderRadius: "4px", transition: "width 0.8s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column: Contacts + Campaigns stacked */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {/* Contacts card */}
          <div style={{
            background: "white", borderRadius: "20px", padding: "22px",
            border: "1px solid #f1f5f9", boxShadow: "0 4px 20px rgba(0,0,0,0.03)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <div style={{ width: "34px", height: "34px", borderRadius: "10px", background: "linear-gradient(135deg, #ec4899, #db2777)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Users size={17} color="white" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: "900", color: "#0f172a" }}>Contacts</h3>
                <p style={{ margin: 0, fontSize: "0.72rem", color: "#94a3b8", fontWeight: "600" }}>Total in CRM</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{
                width: "72px", height: "72px", borderRadius: "50%",
                background: "linear-gradient(135deg, #fdf2f8, #fce7f3)",
                border: "3px solid #f9a8d4",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
              }}>
                <Users size={28} color="#ec4899" />
              </div>
              <div>
                <div style={{ fontSize: "2.2rem", fontWeight: "900", color: "#ec4899", lineHeight: 1 }}>{(contacts.total || 0).toLocaleString()}</div>
                <div style={{ fontSize: "0.75rem", fontWeight: "700", color: "#94a3b8", marginTop: "4px" }}>Total Contacts</div>
                <div style={{ fontSize: "0.7rem", fontWeight: "700", color: "#db2777", marginTop: "4px", background: "#fdf2f8", padding: "2px 8px", borderRadius: "8px", display: "inline-block" }}>📋 Stored in CRM</div>
              </div>
            </div>
          </div>

          {/* Campaigns card */}
          <div style={{
            background: "white", borderRadius: "20px", padding: "22px",
            border: "1px solid #f1f5f9", boxShadow: "0 4px 20px rgba(0,0,0,0.03)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <div style={{ width: "34px", height: "34px", borderRadius: "10px", background: "linear-gradient(135deg, #f59e0b, #d97706)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Zap size={17} color="white" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: "900", color: "#0f172a" }}>Campaigns</h3>
                <p style={{ margin: 0, fontSize: "0.72rem", color: "#94a3b8", fontWeight: "600" }}>Broadcast overview</p>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
              {[
                { label: "Total", value: campaigns.total || 0, color: "#f59e0b", bg: "#fffbeb" },
                { label: "Active", value: campaigns.active || 0, color: "#10b981", bg: "#f0fdf4" },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, borderRadius: "14px", padding: "14px", textAlign: "center", border: `1px solid ${s.color}22` }}>
                  <div style={{ fontSize: "1.6rem", fontWeight: "900", color: s.color, lineHeight: 1 }}>{s.value.toLocaleString()}</div>
                  <div style={{ fontSize: "0.7rem", fontWeight: "700", color: "#94a3b8", marginTop: "4px" }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ background: "#fffbeb", borderRadius: "10px", padding: "10px 12px", display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "0.9rem" }}>🚀</span>
              <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "#d97706" }}>
                {campaigns.active || 0} campaign{campaigns.active !== 1 ? "s" : ""} currently running
              </span>
            </div>
          </div>      
          {/* Quick Actions */}
          <div style={{
            background: "white", borderRadius: "20px", padding: "22px",
            border: "1px solid #f1f5f9", boxShadow: "0 4px 20px rgba(0,0,0,0.03)"
          }}>
            <h3 style={{ margin: "0 0 14px", fontSize: "0.9rem", fontWeight: "900", color: "#0f172a" }}>⚡ Quick Actions</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {[
                { label: "New Campaign", emoji: "🚀", href: "/campaigns", color: "#6366f1", bg: "#eef2ff" },
                { label: "View Contacts", emoji: "👥", href: "/contacts", color: "#10b981", bg: "#f0fdf4" },
                { label: "Open Chats", emoji: "💬", href: "/chats", color: "#3b82f6", bg: "#eff6ff" },
                { label: "Create Template", emoji: "📝", href: "/templates", color: "#f59e0b", bg: "#fffbeb" },
                { label: "Auto Replies", emoji: "🤖", href: "/automation", color: "#8b5cf6", bg: "#f5f3ff" },
              ].map(a => (
                <a
                  key={a.label}
                  href={a.href}
                  style={{
                    display: "flex", alignItems: "center", gap: "12px",
                    padding: "10px 14px", borderRadius: "12px",
                    background: a.bg, textDecoration: "none",
                    transition: "all 0.18s", cursor: "pointer",
                    border: `1px solid ${a.color}18`
                  }}
                  onMouseOver={e => { e.currentTarget.style.transform = "translateX(4px)"; e.currentTarget.style.boxShadow = `0 4px 12px ${a.color}20`; }}
                  onMouseOut={e => { e.currentTarget.style.transform = "translateX(0)"; e.currentTarget.style.boxShadow = "none"; }}
                >
                  <span style={{ fontSize: "1.1rem" }}>{a.emoji}</span>
                  <span style={{ fontSize: "0.82rem", fontWeight: "800", color: a.color }}>{a.label}</span>
                  <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: a.color, opacity: 0.6 }}>→</span>
                </a>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── Per-Account Table (full width) ── */}
      <div style={{
        background: "white", borderRadius: "20px", padding: "24px",
        border: "1px solid #f1f5f9", boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
        marginBottom: "1.5rem"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "9px", background: "linear-gradient(135deg, #6366f1, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Activity size={16} color="white" />
          </div>
          <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: "900", color: "#0f172a" }}>Per-Account Breakdown</h2>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <thead>
              <tr>
                {["Account", "Sent", "Delivered", "Read", "Replies", "Failed", "Del. Rate"].map(h => (
                  <th key={h} style={{
                    textAlign: h === "Account" ? "left" : "center",
                    padding: "8px 12px", color: "#94a3b8", fontWeight: "800",
                    fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.5px",
                    borderBottom: "1px solid #f1f5f9"
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>
                    No WhatsApp accounts connected yet.
                  </td>
                </tr>
              ) : accounts.map((acc, i) => (
                <tr key={acc.accountId} style={{ background: i % 2 === 0 ? "white" : "#fafbfc" }}>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{
                        width: "28px", height: "28px", borderRadius: "8px",
                        background: acc.isActive ? "linear-gradient(135deg, #10b981, #059669)" : "#e2e8f0",
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
                      }}>
                        <Phone size={13} color="white" />
                      </div>
                      <div>
                        <div style={{ fontWeight: "800", color: "#1e293b" }}>{acc.accountName}</div>
                        <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{acc.phoneNumber}</div>
                      </div>
                    </div>
                  </td>
                  {[
                    { v: acc.sent, c: "#6366f1" },
                    { v: acc.delivered, c: "#10b981" },
                    { v: acc.read, c: "#3b82f6" },
                    { v: acc.replies, c: "#f59e0b" },
                    { v: acc.failed, c: "#ef4444" },
                  ].map((cell, ci) => (
                    <td key={ci} style={{ textAlign: "center", padding: "10px 12px", fontWeight: "800", color: cell.c }}>
                      {(cell.v || 0).toLocaleString()}
                    </td>
                  ))}
                  <td style={{ textAlign: "center", padding: "10px 12px" }}>
                    <span style={{
                      background: parseFloat(acc.deliveryRate) >= 90 ? "#f0fdf4" : parseFloat(acc.deliveryRate) >= 70 ? "#fffbeb" : "#fef2f2",
                      color: parseFloat(acc.deliveryRate) >= 90 ? "#10b981" : parseFloat(acc.deliveryRate) >= 70 ? "#f59e0b" : "#ef4444",
                      padding: "3px 10px", borderRadius: "20px", fontSize: "0.72rem", fontWeight: "800"
                    }}>
                      {acc.deliveryRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Account Modal ── */}
      {modal && (
        <AccountModal
          onClose={() => setModal(null)}
          accounts={accounts}
          statKey={modal.statKey}
          title={modal.title}
          color={modal.color}
        />
      )}
    </div>
  );
};

export default DashboardHome;
