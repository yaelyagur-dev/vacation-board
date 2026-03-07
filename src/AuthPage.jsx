import { useState } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

export default function AuthPage() {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const errorMessages = {
    "auth/email-already-in-use": "כתובת האימייל כבר רשומה במערכת",
    "auth/invalid-email": "כתובת אימייל לא תקינה",
    "auth/weak-password": "הסיסמה חייבת להכיל לפחות 6 תווים",
    "auth/user-not-found": "משתמש לא נמצא",
    "auth/wrong-password": "סיסמה שגויה",
    "auth/invalid-credential": "אימייל או סיסמה שגויים",
  };

  async function handleSubmit() {
    setError("");
    setLoading(true);
    try {
      if (mode === "register") {
        if (!name.trim()) { setError("נא להזין שם מלא"); setLoading(false); return; }
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", cred.user.uid), {
          name: name.trim(),
          email: email.toLowerCase(),
          role: "employee",
          workDays: [0,1,2,3,4],
          quota: 20,
          rotations: Array(12).fill(""),
          createdAt: new Date().toISOString()
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (e) {
      setError(errorMessages[e.code] || "אירעה שגיאה, נסי שוב");
    }
    setLoading(false);
  }

  const inp = {
    width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #334155",
    background: "#0f172a", color: "#f1f5f9", fontSize: 15, fontFamily: "'Heebo', sans-serif",
    boxSizing: "border-box", outline: "none", direction: "rtl"
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Heebo', sans-serif", direction: "rtl" }}>
      <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />

      <div style={{ width: 400, background: "#1e293b", borderRadius: 20, padding: "40px 36px", border: "1px solid #334155", boxShadow: "0 25px 60px #00000060" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg, #6366f1, #a78bfa)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, margin: "0 auto 12px" }}>🌴</div>
          <div style={{ fontWeight: 900, fontSize: 22, color: "#f1f5f9" }}>לוח חופשות</div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>מעקב חופשות והתמחות</div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", background: "#0f172a", borderRadius: 10, padding: 4, marginBottom: 28 }}>
          {[["login","התחברות"],["register","הרשמה"]].map(([m, label]) => (
            <button key={m} onClick={() => { setMode(m); setError(""); }} style={{
              flex: 1, padding: "8px", borderRadius: 8, border: "none", cursor: "pointer",
              background: mode === m ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "transparent",
              color: mode === m ? "#fff" : "#64748b", fontWeight: 700, fontSize: 14,
              fontFamily: "'Heebo', sans-serif", transition: "all 0.15s"
            }}>{label}</button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {mode === "register" && (
            <div>
              <label style={{ fontSize: 12, color: "#64748b", fontWeight: 700, display: "block", marginBottom: 6 }}>שם מלא</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="ישראל ישראלי" style={inp} />
            </div>
          )}
          <div>
            <label style={{ fontSize: 12, color: "#64748b", fontWeight: 700, display: "block", marginBottom: 6 }}>אימייל</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@hospital.com" style={{ ...inp, direction: "ltr", textAlign: "right" }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#64748b", fontWeight: 700, display: "block", marginBottom: 6 }}>סיסמה</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="לפחות 6 תווים" style={inp}
              onKeyDown={e => e.key === "Enter" && handleSubmit()} />
          </div>

          {error && (
            <div style={{ background: "#fee2e222", border: "1px solid #ef444444", borderRadius: 9, padding: "10px 14px", fontSize: 13, color: "#ef4444" }}>
              {error}
            </div>
          )}

          <button onClick={handleSubmit} disabled={loading} style={{
            width: "100%", padding: "13px", borderRadius: 10, border: "none",
            background: loading ? "#334155" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
            color: "#fff", fontSize: 15, fontWeight: 800, cursor: loading ? "not-allowed" : "pointer",
            fontFamily: "'Heebo', sans-serif", marginTop: 4,
            boxShadow: loading ? "none" : "0 4px 15px rgba(99,102,241,0.4)"
          }}>
            {loading ? "טוען..." : mode === "login" ? "התחברות" : "הרשמה"}
          </button>
        </div>
      </div>
    </div>
  );
}
