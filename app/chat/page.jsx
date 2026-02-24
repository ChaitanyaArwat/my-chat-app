"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ChatUI() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  // ── Auth check ──────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push("/login");
      } else {
        setCurrentUser(session.user);
      }
    });
  }, []);

  // ── Load all users (to start conversations with) ────────
  useEffect(() => {
    if (!currentUser) return;
    const loadUsers = async () => {
      const { data } = await supabase
        .from("users")
        .select("*")
        .neq("id", currentUser.id);
      setUsers(data || []);
      setLoading(false);
    };

    // Insert current user into users table if not exists
    const upsertUser = async () => {
      await supabase.from("users").upsert({
        id: currentUser.id,
        email: currentUser.email,
        username: currentUser.email.split("@")[0],
        avatar_initials: currentUser.email.slice(0, 2).toUpperCase(),
        avatar_color: "#6366f1",
      }, { onConflict: "id" });
      loadUsers();
    };
    upsertUser();
  }, [currentUser]);

  // ── Load conversations ───────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;
    const loadConversations = async () => {
      const { data } = await supabase
        .from("conversations")
        .select(`
          *,
          participant_1_user:users!conversations_participant_1_fkey(id, email, username, avatar_initials, avatar_color),
          participant_2_user:users!conversations_participant_2_fkey(id, email, username, avatar_initials, avatar_color)
        `)
        .or(`participant_1.eq.${currentUser.id},participant_2.eq.${currentUser.id}`)
        .order("last_message_time", { ascending: false });
      setConversations(data || []);
    };
    loadConversations();
  }, [currentUser]);

  // ── Load messages for active conversation ───────────────
  useEffect(() => {
    if (!activeConv) return;
    const loadMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", activeConv.id)
        .order("created_at", { ascending: true });
      setMessages(data || []);
    };
    loadMessages();

    // Real-time subscription
    const channel = supabase
      .channel("messages-" + activeConv.id)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${activeConv.id}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new]);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [activeConv]);

  // ── Auto scroll ──────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Start or open a conversation ────────────────────────
  const openConversation = async (otherUser) => {
    // Check if conversation already exists
    const existing = conversations.find(
      (c) =>
        (c.participant_1 === currentUser.id && c.participant_2 === otherUser.id) ||
        (c.participant_2 === currentUser.id && c.participant_1 === otherUser.id)
    );
    if (existing) {
      setActiveConv(existing);
      return;
    }
    // Create new conversation
    const { data } = await supabase
      .from("conversations")
      .insert({
        participant_1: currentUser.id,
        participant_2: otherUser.id,
        last_message: "",
        last_message_time: new Date().toISOString(),
      })
      .select(`
        *,
        participant_1_user:users!conversations_participant_1_fkey(id, email, username, avatar_initials, avatar_color),
        participant_2_user:users!conversations_participant_2_fkey(id, email, username, avatar_initials, avatar_color)
      `)
      .single();
    setConversations((prev) => [data, ...prev]);
    setActiveConv(data);
  };

  // ── Send message ─────────────────────────────────────────
  const sendMessage = async () => {
    if (!input.trim() || !activeConv) return;
    const text = input.trim();
    setInput("");
    await supabase.from("messages").insert({
      conversation_id: activeConv.id,
      sender_id: currentUser.id,
      text,
    });
    // Update last message on conversation
    await supabase
      .from("conversations")
      .update({ last_message: text, last_message_time: new Date().toISOString() })
      .eq("id", activeConv.id);
  };

  // ── Helpers ──────────────────────────────────────────────
  const getOtherUser = (conv) => {
    if (!conv || !currentUser) return null;
    return conv.participant_1 === currentUser.id
      ? conv.participant_2_user
      : conv.participant_1_user;
  };

  const formatTime = (ts) => {
    if (!ts) return "";
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const getInitials = (email) => email?.slice(0, 2).toUpperCase() || "??";

  const COLORS = ["#f97316","#8b5cf6","#06b6d4","#ec4899","#10b981","#f59e0b","#6366f1"];
  const colorFor = (str) => COLORS[(str?.charCodeAt(0) || 0) % COLORS.length];

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", background: "#0d0d0f",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#4a4a5a", fontFamily: "DM Sans, sans-serif", fontSize: "15px"
      }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{
      fontFamily: "'DM Sans', sans-serif",
      background: "#0d0d0f",
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2a2a35; border-radius: 4px; }
        .conv-item { display:flex; align-items:center; gap:12px; padding:10px 16px; cursor:pointer; border-radius:12px; transition:background 0.15s ease; }
        .conv-item:hover { background: rgba(255,255,255,0.05); }
        .conv-item.active { background: rgba(255,255,255,0.08); }
        .user-item { display:flex; align-items:center; gap:10px; padding:8px 12px; cursor:pointer; border-radius:10px; transition:background 0.15s; }
        .user-item:hover { background: rgba(255,255,255,0.05); }
        .msg-bubble { max-width:72%; padding:10px 14px; border-radius:18px; font-size:14px; line-height:1.5; animation:popIn 0.2s ease; }
        @keyframes popIn { from{opacity:0;transform:translateY(6px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        .send-btn { background:linear-gradient(135deg,#6366f1,#8b5cf6); border:none; border-radius:12px; width:40px; height:40px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:transform 0.15s; flex-shrink:0; }
        .send-btn:hover { transform:scale(1.06); }
        .send-btn:disabled { opacity:0.4; cursor:default; transform:none; }
        .input-field { flex:1; background:transparent; border:none; outline:none; color:#e5e5ea; font-size:14px; font-family:inherit; resize:none; line-height:1.5; max-height:120px; }
        .input-field::placeholder { color:#4a4a5a; }
        .icon-btn { background:transparent; border:none; cursor:pointer; color:#4a4a5a; padding:6px; border-radius:8px; transition:color 0.15s,background 0.15s; display:flex; align-items:center; justify-content:center; }
        .icon-btn:hover { color:#a0a0b0; background:rgba(255,255,255,0.05); }
        .search-input { flex:1; background:transparent; border:none; outline:none; color:#e5e5ea; font-size:13px; font-family:inherit; }
        .search-input::placeholder { color:#4a4a5a; }
      `}</style>

      <div style={{
        width: "100%", maxWidth: "1100px",
        height: "calc(100vh - 48px)", maxHeight: "780px",
        background: "#111114", borderRadius: "20px",
        border: "1px solid rgba(255,255,255,0.07)",
        display: "flex", overflow: "hidden",
        boxShadow: "0 40px 100px rgba(0,0,0,0.6)",
      }}>

        {/* ── Sidebar ── */}
        <div style={{
          width: "280px", flexShrink: 0,
          background: "#0f0f12",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          display: "flex", flexDirection: "column",
        }}>
          {/* Header */}
          <div style={{ padding: "20px 16px 12px" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"16px" }}>
              <span style={{ color:"#e5e5ea", fontWeight:600, fontSize:"17px", letterSpacing:"-0.02em" }}>Messages</span>
              <button className="icon-btn" onClick={() => setActiveConv(null)} title="New chat">
                <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:"8px", background:"rgba(255,255,255,0.05)", borderRadius:"10px", padding:"8px 12px", border:"1px solid rgba(255,255,255,0.06)" }}>
              <svg width="14" height="14" fill="none" stroke="#4a4a5a" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/></svg>
              <input className="search-input" placeholder="Search conversations…" value={search} onChange={(e) => setSearch(e.target.value)}/>
            </div>
          </div>

          {/* Conversations */}
          <div style={{ flex:1, overflowY:"auto", padding:"4px 8px 8px" }}>
            {conversations.length === 0 && (
              <div style={{ color:"#3a3a4a", fontSize:"12px", textAlign:"center", padding:"20px 16px" }}>
                No conversations yet.<br/>Click + to start chatting!
              </div>
            )}
            {conversations
              .filter((c) => {
                const other = getOtherUser(c);
                return other?.username?.toLowerCase().includes(search.toLowerCase()) ||
                       other?.email?.toLowerCase().includes(search.toLowerCase());
              })
              .map((conv) => {
                const other = getOtherUser(conv);
                if (!other) return null;
                const color = colorFor(other.email);
                return (
                  <div key={conv.id} className={`conv-item ${activeConv?.id === conv.id ? "active" : ""}`} onClick={() => setActiveConv(conv)}>
                    <div style={{ width:42, height:42, borderRadius:"50%", background:color+"22", border:`1.5px solid ${color}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"12px", fontWeight:600, color, flexShrink:0 }}>
                      {getInitials(other.email)}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
                        <span style={{ color:"#e5e5ea", fontSize:"14px", fontWeight:500 }}>{other.username || other.email.split("@")[0]}</span>
                        <span style={{ color:"#3a3a4a", fontSize:"11px" }}>{formatTime(conv.last_message_time)}</span>
                      </div>
                      <span style={{ color:"#4a4a5a", fontSize:"12.5px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", display:"block" }}>
                        {conv.last_message || "Say hello!"}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* My Profile + Logout */}
          <div style={{ padding:"12px 16px", borderTop:"1px solid rgba(255,255,255,0.06)", display:"flex", alignItems:"center", gap:"10px" }}>
            <div style={{ width:34, height:34, borderRadius:"50%", background:"linear-gradient(135deg,#6366f1,#8b5cf6)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"12px", fontWeight:700, color:"#fff", flexShrink:0 }}>
              {getInitials(currentUser?.email)}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ color:"#e5e5ea", fontSize:"13px", fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{currentUser?.email?.split("@")[0]}</div>
              <div style={{ color:"#22c55e", fontSize:"11px" }}>Online</div>
            </div>
            <button className="icon-btn" title="Sign out" onClick={async () => { await supabase.auth.signOut(); router.push("/login"); }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* ── Main Area ── */}
        {!activeConv ? (
          // New chat / user list
          <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px" }}>
            <div style={{ width:"100%", maxWidth:"400px" }}>
              <div style={{ textAlign:"center", marginBottom:"32px" }}>
                <div style={{ fontSize:"40px", marginBottom:"12px" }}>💬</div>
                <h2 style={{ color:"#e5e5ea", fontSize:"20px", fontWeight:600, marginBottom:"8px" }}>Start a conversation</h2>
                <p style={{ color:"#4a4a5a", fontSize:"14px" }}>Pick someone below to start chatting</p>
              </div>
              {users.length === 0 ? (
                <div style={{ textAlign:"center", color:"#3a3a4a", fontSize:"13px", padding:"20px", background:"rgba(255,255,255,0.03)", borderRadius:"12px", border:"1px solid rgba(255,255,255,0.06)" }}>
                  No other users yet.<br/>Share the app link with your friends so they can sign up!
                </div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
                  {users.map((user) => {
                    const color = colorFor(user.email);
                    return (
                      <div key={user.id} className="user-item" onClick={() => openConversation(user)}>
                        <div style={{ width:40, height:40, borderRadius:"50%", background:color+"22", border:`1.5px solid ${color}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"12px", fontWeight:600, color, flexShrink:0 }}>
                          {getInitials(user.email)}
                        </div>
                        <div>
                          <div style={{ color:"#e5e5ea", fontSize:"14px", fontWeight:500 }}>{user.username || user.email.split("@")[0]}</div>
                          <div style={{ color:"#4a4a5a", fontSize:"12px" }}>{user.email}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          // Active chat
          <>
            {/* Chat Header */}
            <div style={{ padding:"14px 20px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", alignItems:"center", gap:"12px", background:"#111114" }}>
              <button className="icon-btn" onClick={() => setActiveConv(null)}>
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round"/></svg>
              </button>
              {(() => {
                const other = getOtherUser(activeConv);
                const color = colorFor(other?.email);
                return (
                  <>
                    <div style={{ width:40, height:40, borderRadius:"50%", background:color+"22", border:`1.5px solid ${color}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"11px", fontWeight:600, color }}>
                      {getInitials(other?.email)}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ color:"#e5e5ea", fontWeight:600, fontSize:"15px" }}>{other?.username || other?.email?.split("@")[0]}</div>
                      <div style={{ color:"#4a4a5a", fontSize:"12px" }}>{other?.email}</div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Messages */}
            <div style={{ flex:1, overflowY:"auto", padding:"24px 20px", display:"flex", flexDirection:"column", gap:"4px" }}>
              {messages.length === 0 && (
                <div style={{ textAlign:"center", color:"#3a3a4a", fontSize:"13px", marginTop:"40px" }}>
                  No messages yet. Say hello! 👋
                </div>
              )}
              {messages.map((msg, i) => {
                const isMe = msg.sender_id === currentUser?.id;
                const prev = messages[i - 1];
                const next = messages[i + 1];
                const isFirst = !prev || (prev.sender_id !== msg.sender_id);
                const isLast = !next || (next.sender_id !== msg.sender_id);
                const other = getOtherUser(activeConv);
                const color = colorFor(other?.email);
                return (
                  <div key={msg.id} style={{ display:"flex", justifyContent:isMe?"flex-end":"flex-start", marginTop:isFirst?"12px":"2px", alignItems:"flex-end", gap:"8px" }}>
                    {!isMe && (
                      <div style={{ width:28, height:28, borderRadius:"50%", background:color+"22", border:`1.5px solid ${color}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"9px", fontWeight:600, color, flexShrink:0, opacity:isLast?1:0 }}>
                        {getInitials(other?.email)}
                      </div>
                    )}
                    <div style={{ display:"flex", flexDirection:"column", alignItems:isMe?"flex-end":"flex-start" }}>
                      <div className="msg-bubble" style={{
                        background: isMe ? "linear-gradient(135deg,#6366f1,#7c3aed)" : "rgba(255,255,255,0.07)",
                        color: isMe ? "#fff" : "#d4d4de",
                        borderRadius: isMe ? `18px 18px ${isLast?"4px":"18px"} 18px` : `18px 18px 18px ${isLast?"4px":"18px"}`,
                        border: isMe ? "none" : "1px solid rgba(255,255,255,0.08)",
                      }}>
                        {msg.text}
                      </div>
                      {isLast && <span style={{ color:"#3a3a4a", fontSize:"10.5px", marginTop:"4px" }}>{formatTime(msg.created_at)}</span>}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef}/>
            </div>

            {/* Input */}
            <div style={{ padding:"12px 16px 16px", borderTop:"1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display:"flex", alignItems:"flex-end", gap:"8px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:"16px", padding:"10px 12px" }}>
                <textarea
                  className="input-field"
                  placeholder="Write a message…"
                  rows={1}
                  value={input}
                  onChange={(e) => { setInput(e.target.value); e.target.style.height="auto"; e.target.style.height=Math.min(e.target.scrollHeight,120)+"px"; }}
                  onKeyDown={(e) => { if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();} }}
                />
                <button className="send-btn" onClick={sendMessage} disabled={!input.trim()}>
                  <svg width="16" height="16" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
              <p style={{ textAlign:"center", color:"#2a2a35", fontSize:"11px", marginTop:"8px" }}>Enter to send · Shift+Enter for newline</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
