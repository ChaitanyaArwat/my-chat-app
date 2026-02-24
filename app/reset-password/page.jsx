"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();

  const handleReset = async () => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage("Error: " + error.message);
    } else {
      setMessage("Password updated! Redirecting...");
      setTimeout(() => router.push("/login"), 2000);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#0d0d0f",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "DM Sans, sans-serif"
    }}>
      <div style={{
        width: "100%", maxWidth: "400px", padding: "40px",
        background: "#111114", borderRadius: "20px",
        border: "1px solid rgba(255,255,255,0.07)"
      }}>
        <h1 style={{ color: "#e5e5ea", fontSize: "22px", fontWeight: 700, marginBottom: "8px" }}>
          Set new password
        </h1>
        <p style={{ color: "#4a4a5a", fontSize: "14px", marginBottom: "24px" }}>
          Enter your new password below
        </p>
        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: "100%", padding: "12px", borderRadius: "10px",
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
            color: "#e5e5ea", fontSize: "14px", marginBottom: "16px", outline: "none"
          }}
        />
        <button
          onClick={handleReset}
          style={{
            width: "100%", padding: "12px", borderRadius: "10px",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            border: "none", color: "#fff", fontSize: "15px",
            fontWeight: 600, cursor: "pointer"
          }}
        >
          Update Password
        </button>
        {message && (
          <p style={{ color: "#22c55e", fontSize: "13px", marginTop: "16px", textAlign: "center" }}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}