import { useState, useEffect } from "react";
import { signOut } from "firebase/auth";
import {
  collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc,
  query, orderBy, setDoc, getDocs
} from "firebase/firestore";
import { auth, db } from "./firebase";

const DAYS_HE = ["ראשון","שני","שלישי","רביעי","חמישי","שישי","שבת"];
const MONTHS_HE = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
const ROTATIONS = ["נשים","מיילדות","פריון מאיר","אולטרהסאונד מאיר","אולטרהסאונד חיצוני","רוטציה חיצונית","פריון חיצוני","קהילה","מדעי יסוד","אחר"];
const STATUS_LABELS = { approved: "מאושר", pending: "ממתין", denied: "נדחה" };
const STATUS_DOT = { approved: "#10b981", pending: "#f59e0b", denied: "#ef4444" };
const calColors = ["#6366f1","#ec4899","#14b8a6","#f97316","#8b5cf6","#06b6d4","#10b981","#f59e0b"];
const rotColors = ["#6366f1","#ec4899","#14b8a6","#f97316","#8b5cf6","#06b6d4","#10b981","#f59e0b","#ef4444","#3b82f6"];
const rotationColors = {};
ROTATIONS.forEach((r,i) => { rotationColors[r] = rotColors[i % rotColors.length]; });

function formatDate(d) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("he-IL", { day:"numeric", month:"long", year:"numeric" });
}
function countWorkingDays(start, end, workDays) {
  let count = 0;
  const s = new Date(start + "T00:00:00"), e = new Date(end + "T00:00:00");
  for (let d = new Date(s); d <= e; d.setDate(d.getDate()+1))
    if (workDays.includes(d.getDay())) count++;
  return count;
}
function getYearUsedDays(emp, requests) {
  const year = new Date().getFullYear();
  return requests
    .filter(r => r.employee === emp.uid && r.status === "approved" && r.start?.startsWith(year))
    .reduce((sum,r) => sum + countWorkingDays(r.start, r.end, emp.workDays||[0,1,2,3,4]), 0);
}
function getDaysInMonth(y,m) { return new Date(y,m+1,0).getDate(); }
function getFirstDay(y,m) { return new Date(y,m,1).getDay(); }

export default function Dashboard({ user, userRole }) {
  const [view, setView] = useState("board");
  const [requests, setRequests] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showScheduleEdit, setShowScheduleEdit] = useState(null);
  const [showRotationEdit, setShowRotationEdit] = useState(null);
  const [editSchedule, setEditSchedule] = useState(null);
  const [editRotations, setEditRotations] = useState(null);
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [form, setForm] = useState({ start:"", end:"", reason:"" });
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().slice(0,10);
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const isAdmin = userRole === "admin";

  // colors per employee
  const empColor = {};
  employees.forEach((e,i) => { empColor[e.uid] = calColors[i % calColors.length]; });

  // Live data from Firestore
  useEffect(() => {
    const unsubReqs = onSnapshot(
      query(collection(db, "requests"), orderBy("createdAt","desc")),
      snap => setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    const unsubEmps = onSnapshot(collection(db, "users"), snap => {
      setEmployees(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
    });
    return () => { unsubReqs(); unsubEmps(); };
  }, []);

  const me = employees.find(e => e.uid === user.uid);

  async function submitRequest() {
    if (!form.start || !form.end) return;
    setSaving(true);
    await addDoc(collection(db, "requests"), {
      employee: user.uid,
      employeeName: me?.name || user.email,
      start: form.start,
      end: form.end,
      reason: form.reason || "",
      status: "pending",
      createdAt: new Date().toISOString()
    });
    setForm({ start:"", end:"", reason:"" });
    setShowForm(false);
    setSaving(false);
  }

  async function updateStatus(id, status) {
    await updateDoc(doc(db, "requests", id), { status });
  }

  async function deleteRequest(id) {
    await deleteDoc(doc(db, "requests", id));
  }

  async function deleteEmployee(uid) {
    if (!window.confirm("האם למחוק עובד זה לצמיתות?")) return;
    await deleteDoc(doc(db, "users", uid));
  }

  async function saveSchedule() {
    setSaving(true);
    await updateDoc(doc(db, "users", editSchedule.uid), {
      workDays: editSchedule.workDays,
      quota: editSchedule.quota
    });
    setShowScheduleEdit(null);
    setSaving(false);
  }

  async function saveRotations() {
    setSaving(true);
    await updateDoc(doc(db, "users", editRotations.uid), {
      rotations: editRotations.rotations
    });
    setShowRotationEdit(null);
    setSaving(false);
  }

  function toggleWorkDay(day) {
    setEditSchedule(prev => ({
      ...prev,
      workDays: prev.workDays.includes(day)
        ? prev.workDays.filter(d => d !== day)
        : [...prev.workDays, day].sort()
    }));
  }

  // Filtered requests based on role
  const visibleRequests = isAdmin
    ? requests
    : requests.filter(r => r.employee === user.uid);

  function getVacationsForDay(day) {
    const dateStr = `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    return requests.filter(r => r.status === "approved" && r.start <= dateStr && r.end >= dateStr);
  }

  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDay(calYear, calMonth);
  const monthName = new Date(calYear, calMonth, 1).toLocaleString("he-IL", { month:"long" });

  const navBtn = (active) => ({
    padding:"7px 16px", borderRadius:8, border:"none", cursor:"pointer", fontSize:13, fontWeight:600,
    background: active ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "transparent",
    color: active ? "#fff" : "#94a3b8", transition:"all 0.15s", fontFamily:"'Heebo', sans-serif"
  });

  const inp = (extra={}) => ({
    width:"100%", padding:"10px 12px", borderRadius:9, border:"1px solid #334155",
    background:"#0f172a", color:"#f1f5f9", fontSize:14, fontFamily:"'Heebo', sans-serif",
    boxSizing:"border-box", direction:"rtl", ...extra
  });

  return (
    <div style={{ minHeight:"100vh", background:"#0f172a", fontFamily:"'Heebo', sans-serif", color:"#e2e8f0", direction:"rtl" }}>
      <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {/* Header */}
      <header style={{ background:"linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", borderBottom:"1px solid #334155", padding:"0 2rem" }}>
        <div style={{ maxWidth:1200, margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"space-between", height:70 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:"linear-gradient(135deg, #6366f1, #a78bfa)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>🌴</div>
            <div>
              <div style={{ fontWeight:900, fontSize:18, color:"#f1f5f9" }}>לוח חופשות</div>
              <div style={{ fontSize:11, color:"#64748b" }}>
                {me?.name || user.email}
                {isAdmin && <span style={{ marginRight:6, fontSize:10, background:"#6366f122", color:"#6366f1", borderRadius:4, padding:"1px 6px", fontWeight:700 }}>מנהל</span>}
              </div>
            </div>
          </div>

          <nav style={{ display:"flex", gap:4 }}>
            {[
              ["board","📋 בקשות"],
              ...(isAdmin ? [["schedule","👤 עובדים"],["rotation","🔄 רוטציות"]] : [["myrotation","🔄 הרוטציות שלי"]]),
              ["calendar","📅 לוח שנה"]
            ].map(([v, label]) => (
              <button key={v} onClick={() => setView(v)} style={navBtn(view===v)}>{label}</button>
            ))}
          </nav>

          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={() => setShowForm(true)} style={{
              padding:"9px 18px", borderRadius:9, border:"none", cursor:"pointer",
              background:"linear-gradient(135deg, #6366f1, #8b5cf6)", color:"#fff",
              fontSize:13, fontWeight:700, display:"flex", alignItems:"center", gap:6,
              boxShadow:"0 4px 15px rgba(99,102,241,0.4)", fontFamily:"'Heebo', sans-serif"
            }}>
              <span style={{ fontSize:16 }}>+</span> בקשת חופשה
            </button>
            <button onClick={() => signOut(auth)} style={{
              padding:"9px 14px", borderRadius:9, border:"1px solid #334155",
              background:"transparent", color:"#64748b", cursor:"pointer", fontSize:13, fontFamily:"'Heebo', sans-serif"
            }}>יציאה</button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth:1200, margin:"0 auto", padding:"2rem" }}>

        {/* Stats */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16, marginBottom:28 }}>
          {[
            { label:"סה״כ בקשות", value: visibleRequests.length, icon:"📝", color:"#6366f1" },
            { label:"מאושרות", value: visibleRequests.filter(r=>r.status==="approved").length, icon:"✅", color:"#10b981" },
            { label:"ממתינות", value: visibleRequests.filter(r=>r.status==="pending").length, icon:"⏳", color:"#f59e0b" },
          ].map(s => (
            <div key={s.label} style={{ background:"#1e293b", borderRadius:14, padding:"18px 20px", border:"1px solid #334155", display:"flex", alignItems:"center", gap:14 }}>
              <div style={{ width:44, height:44, borderRadius:12, background:s.color+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>{s.icon}</div>
              <div>
                <div style={{ fontSize:24, fontWeight:800, color:"#f1f5f9", lineHeight:1 }}>{s.value}</div>
                <div style={{ fontSize:12, color:"#64748b", marginTop:3 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ===== BOARD ===== */}
        {view === "board" && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
            {["pending","approved","denied"].map(status => (
              <div key={status}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:STATUS_DOT[status] }} />
                  <span style={{ fontWeight:800, fontSize:13, color:"#94a3b8" }}>{STATUS_LABELS[status]}</span>
                  <span style={{ marginRight:"auto", background:"#1e293b", border:"1px solid #334155", borderRadius:20, padding:"1px 9px", fontSize:12, color:"#64748b" }}>
                    {visibleRequests.filter(r=>r.status===status).length}
                  </span>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {visibleRequests.filter(r=>r.status===status).map(req => {
                    const emp = employees.find(e => e.uid === req.employee);
                    const wd = emp?.workDays || [0,1,2,3,4];
                    const reqDays = req.start && req.end ? countWorkingDays(req.start, req.end, wd) : "?";
                    const used = emp ? getYearUsedDays(emp, requests) : 0;
                    const startMonth = req.start ? parseInt(req.start.slice(5,7))-1 : null;
                    const rot = emp?.rotations?.[startMonth] || "";
                    const color = empColor[req.employee] || "#6366f1";
                    const canDelete = isAdmin || req.employee === user.uid;
                    return (
                      <div key={req.id} style={{ background:"#1e293b", borderRadius:12, padding:16, border:"1px solid #334155" }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <div style={{ width:30, height:30, borderRadius:"50%", background:color+"33", border:`2px solid ${color}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color }}>
                              {(req.employeeName||"?")[0]}
                            </div>
                            <div>
                              <span style={{ fontWeight:700, fontSize:14, color:"#f1f5f9" }}>{req.employeeName}</span>
                              {isAdmin && <div style={{ fontSize:10, color:"#64748b", marginTop:1 }}>ניצל השנה: {used}/{emp?.quota||20} ימים</div>}
                            </div>
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            <span style={{ fontSize:11, background:"#0f172a", borderRadius:6, padding:"2px 8px", color:"#f59e0b", border:"1px solid #334155", fontWeight:700 }}>{reqDays}י׳</span>
                            {rot && <span style={{ fontSize:10, borderRadius:6, padding:"1px 7px", background:rotationColors[rot]+"22", color:rotationColors[rot], fontWeight:700 }}>{rot}</span>}
                            {canDelete && <button onClick={() => deleteRequest(req.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#475569", fontSize:14, padding:2 }}>✕</button>}
                          </div>
                        </div>
                        <div style={{ fontSize:12, color:"#94a3b8", marginBottom:6 }}>📅 {formatDate(req.start)} ← {formatDate(req.end)}</div>
                        {req.reason && <div style={{ fontSize:12, color:"#64748b", marginBottom:10, fontStyle:"italic" }}>״{req.reason}״</div>}
                        {isAdmin && status==="pending" && (
                          <div style={{ display:"flex", gap:6 }}>
                            <button onClick={() => updateStatus(req.id,"approved")} style={{ flex:1, padding:"6px", borderRadius:7, border:"none", background:"#d1fae522", color:"#10b981", cursor:"pointer", fontSize:12, fontWeight:700, fontFamily:"'Heebo', sans-serif" }}>✓ אשר</button>
                            <button onClick={() => updateStatus(req.id,"denied")} style={{ flex:1, padding:"6px", borderRadius:7, border:"none", background:"#fee2e222", color:"#ef4444", cursor:"pointer", fontSize:12, fontWeight:700, fontFamily:"'Heebo', sans-serif" }}>✕ דחה</button>
                          </div>
                        )}
                        {isAdmin && status!=="pending" && (
                          <div style={{ display:"flex", gap:6 }}>
                            {status==="approved" && <button onClick={() => updateStatus(req.id,"denied")} style={{ flex:1, padding:"6px", borderRadius:7, border:"none", background:"#fee2e222", color:"#ef4444", cursor:"pointer", fontSize:12, fontFamily:"'Heebo', sans-serif" }}>בטל אישור</button>}
                            {status==="denied" && <button onClick={() => updateStatus(req.id,"approved")} style={{ flex:1, padding:"6px", borderRadius:7, border:"none", background:"#d1fae522", color:"#10b981", cursor:"pointer", fontSize:12, fontFamily:"'Heebo', sans-serif" }}>אשר</button>}
                            <button onClick={() => updateStatus(req.id,"pending")} style={{ flex:1, padding:"6px", borderRadius:7, border:"none", background:"#fef3c722", color:"#f59e0b", cursor:"pointer", fontSize:12, fontFamily:"'Heebo', sans-serif" }}>אפס</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {visibleRequests.filter(r=>r.status===status).length === 0 && (
                    <div style={{ background:"#1e293b", borderRadius:12, padding:24, border:"1px dashed #334155", textAlign:"center", color:"#475569", fontSize:13 }}>אין בקשות {STATUS_LABELS[status]}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ===== SCHEDULE (admin) ===== */}
        {view === "schedule" && isAdmin && (
          <div>
            <div style={{ fontWeight:800, fontSize:13, color:"#64748b", marginBottom:16 }}>לוח עובדים — ימי עבודה ומכסת חופשה</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))", gap:16 }}>
              {employees.map(emp => {
                const used = getYearUsedDays(emp, requests);
                const remaining = (emp.quota||20) - used;
                const pct = Math.min(100, Math.round((used/(emp.quota||20))*100));
                const barColor = pct>85?"#ef4444":pct>60?"#f59e0b":"#10b981";
                const color = empColor[emp.uid]||"#6366f1";
                const currentRot = emp.rotations?.[currentMonth]||"";
                return (
                  <div key={emp.uid} style={{ background:"#1e293b", borderRadius:16, padding:20, border:"1px solid #334155" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
                      <div style={{ width:44, height:44, borderRadius:"50%", background:color+"33", border:`2px solid ${color}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:800, color, flexShrink:0 }}>
                        {(emp.name||"?")[0]}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:800, fontSize:15, color:"#f1f5f9" }}>{emp.name}</div>
                        <div style={{ fontSize:12, color:"#64748b", marginTop:2 }}>{emp.email}</div>
                      </div>
                      <div style={{ display:"flex", gap:6 }}>
                        <button onClick={() => { setEditSchedule({...emp, workDays:[...(emp.workDays||[0,1,2,3,4])], quota:emp.quota||20}); setShowScheduleEdit(emp.uid); }} style={{ background:"#0f172a", border:"1px solid #334155", borderRadius:8, padding:"5px 10px", color:"#94a3b8", cursor:"pointer", fontSize:12 }}>✏️</button>
                        <button onClick={() => deleteEmployee(emp.uid)} style={{ background:"#fee2e222", border:"1px solid #ef444444", borderRadius:8, padding:"5px 10px", color:"#ef4444", cursor:"pointer", fontSize:12 }}>🗑️</button>
                      </div>
                    </div>
                    {currentRot && (
                      <div style={{ marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ fontSize:11, color:"#64748b" }}>רוטציה נוכחית:</span>
                        <span style={{ fontSize:12, fontWeight:800, padding:"3px 10px", borderRadius:20, background:rotationColors[currentRot]+"22", color:rotationColors[currentRot] }}>{currentRot}</span>
                      </div>
                    )}
                    <div style={{ marginBottom:14 }}>
                      <div style={{ fontSize:11, color:"#64748b", fontWeight:700, marginBottom:8 }}>ימי עבודה</div>
                      <div style={{ display:"flex", gap:5 }}>
                        {[0,1,2,3,4,5,6].map(d => (
                          <div key={d} style={{ flex:1, textAlign:"center", padding:"6px 0", borderRadius:7, fontSize:11, fontWeight:700,
                            background:(emp.workDays||[0,1,2,3,4]).includes(d)?color+"33":"#0f172a",
                            color:(emp.workDays||[0,1,2,3,4]).includes(d)?color:"#334155",
                            border:`1px solid ${(emp.workDays||[0,1,2,3,4]).includes(d)?color+"66":"#1e293b"}`
                          }}>{DAYS_HE[d].slice(0,2)}</div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                        <span style={{ fontSize:11, color:"#64748b", fontWeight:700 }}>ניצול חופשה {currentYear}</span>
                        <span style={{ fontSize:12, color:"#f1f5f9", fontWeight:700 }}>{used} / {emp.quota||20} ימים</span>
                      </div>
                      <div style={{ background:"#0f172a", borderRadius:99, height:8, overflow:"hidden" }}>
                        <div style={{ width:`${pct}%`, height:"100%", background:barColor, borderRadius:99 }} />
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
                        <span style={{ fontSize:11, color:"#64748b" }}>נוצלו: {used}</span>
                        <span style={{ fontSize:11, color:remaining>0?"#10b981":"#ef4444", fontWeight:700 }}>נותרו: {remaining}</span>
                      </div>
                    </div>
                    {/* Role toggle */}
                    <div style={{ marginTop:14, borderTop:"1px solid #334155", paddingTop:12, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      <span style={{ fontSize:12, color:"#64748b" }}>הרשאה:</span>
                      <div style={{ display:"flex", gap:6 }}>
                        {["employee","admin"].map(role => (
                          <button key={role} onClick={() => updateDoc(doc(db,"users",emp.uid),{role})} style={{
                            padding:"4px 12px", borderRadius:7, border:"none", cursor:"pointer", fontSize:12, fontWeight:700, fontFamily:"'Heebo', sans-serif",
                            background: emp.role===role ? (role==="admin"?"#6366f133":"#1e293b") : "#0f172a",
                            color: emp.role===role ? (role==="admin"?"#6366f1":"#10b981") : "#475569",
                            border: `1px solid ${emp.role===role?(role==="admin"?"#6366f144":"#10b98144"):"#334155"}`
                          }}>{role==="admin"?"מנהל":"עובד"}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===== ROTATION (admin) ===== */}
        {view === "rotation" && isAdmin && (
          <div>
            <div style={{ fontWeight:800, fontSize:13, color:"#64748b", marginBottom:16 }}>תכנית רוטציות — {currentYear}</div>
            <div style={{ background:"#1e293b", borderRadius:16, border:"1px solid #334155", overflow:"hidden", marginBottom:24 }}>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", direction:"rtl" }}>
                  <thead>
                    <tr style={{ borderBottom:"1px solid #334155" }}>
                      <th style={{ padding:"12px 16px", textAlign:"right", fontSize:12, fontWeight:700, color:"#64748b", background:"#0f172a", minWidth:120, position:"sticky", right:0 }}>עובד/ת</th>
                      {MONTHS_HE.map((m,i) => (
                        <th key={m} style={{ padding:"12px 8px", textAlign:"center", fontSize:12, fontWeight:700, color:i===currentMonth?"#6366f1":"#64748b", minWidth:80, background:i===currentMonth?"#6366f111":"transparent" }}>
                          {i===currentMonth?<span style={{ background:"#6366f1", color:"#fff", borderRadius:6, padding:"2px 7px" }}>{m}</span>:m}
                        </th>
                      ))}
                      <th style={{ padding:"12px 8px", textAlign:"center", minWidth:50 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map(emp => (
                      <tr key={emp.uid} style={{ borderBottom:"1px solid #1e293b" }}>
                        <td style={{ padding:"10px 16px", background:"#0f172a", position:"sticky", right:0 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <div style={{ width:24, height:24, borderRadius:"50%", background:(empColor[emp.uid]||"#6366f1")+"33", border:`2px solid ${empColor[emp.uid]||"#6366f1"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, color:empColor[emp.uid]||"#6366f1" }}>{(emp.name||"?")[0]}</div>
                            <span style={{ fontSize:13, fontWeight:700, color:"#f1f5f9", whiteSpace:"nowrap" }}>{emp.name}</span>
                          </div>
                        </td>
                        {(emp.rotations||Array(12).fill("")).map((rot,mi) => (
                          <td key={mi} style={{ padding:"8px 4px", textAlign:"center", background:mi===currentMonth?"#6366f108":"transparent" }}>
                            {rot ? <span style={{ fontSize:10, fontWeight:700, padding:"2px 6px", borderRadius:5, background:rotationColors[rot]+"22", color:rotationColors[rot], whiteSpace:"nowrap", display:"inline-block" }}>{rot}</span>
                                 : <span style={{ fontSize:11, color:"#334155" }}>—</span>}
                          </td>
                        ))}
                        <td style={{ padding:"8px 4px", textAlign:"center" }}>
                          <button onClick={() => { setEditRotations({...emp, rotations:[...(emp.rotations||Array(12).fill(""))]}); setShowRotationEdit(emp.uid); }} style={{ background:"#0f172a", border:"1px solid #334155", borderRadius:7, padding:"4px 8px", color:"#94a3b8", cursor:"pointer", fontSize:12 }}>✏️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {/* Timeline */}
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {employees.map(emp => {
                const color = empColor[emp.uid]||"#6366f1";
                return (
                  <div key={emp.uid} style={{ background:"#1e293b", borderRadius:12, padding:"14px 18px", border:"1px solid #334155" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                      <div style={{ width:28, height:28, borderRadius:"50%", background:color+"33", border:`2px solid ${color}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:800, color }}>{(emp.name||"?")[0]}</div>
                      <span style={{ fontWeight:800, fontSize:14, color:"#f1f5f9" }}>{emp.name}</span>
                    </div>
                    <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                      {(emp.rotations||Array(12).fill("")).map((rot,mi) => {
                        const isCurrent = mi===currentMonth;
                        const rc = rot?rotationColors[rot]:"#334155";
                        return (
                          <div key={mi} style={{ flex:"0 0 calc(8.33% - 4px)", minWidth:58, textAlign:"center" }}>
                            <div style={{ fontSize:10, color:isCurrent?"#6366f1":"#475569", fontWeight:isCurrent?800:500, marginBottom:4 }}>{MONTHS_HE[mi].slice(0,3)}</div>
                            <div style={{ padding:"5px 2px", borderRadius:6, fontSize:9, fontWeight:700, background:rot?rc+"22":"#0f172a", color:rot?rc:"#334155", border:`1px solid ${isCurrent?"#6366f1":rot?rc+"44":"#1e293b"}`, minHeight:26, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:isCurrent?"0 0 0 2px #6366f144":"none" }}>
                              {rot||"—"}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===== MY ROTATION (employee) ===== */}
        {view === "myrotation" && !isAdmin && me && (
          <div>
            <div style={{ fontWeight:800, fontSize:13, color:"#64748b", marginBottom:16 }}>הרוטציות שלי — {currentYear}</div>
            <div style={{ background:"#1e293b", borderRadius:16, padding:24, border:"1px solid #334155" }}>
              {me.rotations?.[currentMonth] && (
                <div style={{ marginBottom:20, padding:"16px 20px", borderRadius:12, background:rotationColors[me.rotations[currentMonth]]+"11", border:`1px solid ${rotationColors[me.rotations[currentMonth]]}44`, display:"flex", alignItems:"center", gap:12 }}>
                  <span style={{ fontSize:24 }}>🔄</span>
                  <div>
                    <div style={{ fontSize:12, color:"#64748b" }}>רוטציה נוכחית</div>
                    <div style={{ fontSize:20, fontWeight:900, color:rotationColors[me.rotations[currentMonth]] }}>{me.rotations[currentMonth]}</div>
                  </div>
                </div>
              )}
              <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                {(me.rotations||Array(12).fill("")).map((rot,mi) => {
                  const isCurrent = mi===currentMonth;
                  const rc = rot?rotationColors[rot]:"#334155";
                  return (
                    <div key={mi} style={{ flex:"0 0 calc(8.33% - 4px)", minWidth:60, textAlign:"center" }}>
                      <div style={{ fontSize:11, color:isCurrent?"#6366f1":"#475569", fontWeight:isCurrent?800:500, marginBottom:4 }}>{MONTHS_HE[mi].slice(0,3)}</div>
                      <div style={{ padding:"8px 4px", borderRadius:8, fontSize:10, fontWeight:700, background:rot?rc+"22":"#0f172a", color:rot?rc:"#334155", border:`1px solid ${isCurrent?"#6366f1":rot?rc+"44":"#1e293b"}`, minHeight:32, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:isCurrent?"0 0 0 2px #6366f144":"none" }}>
                        {rot||"—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ===== CALENDAR ===== */}
        {view === "calendar" && (
          <div style={{ background:"#1e293b", borderRadius:16, border:"1px solid #334155", overflow:"hidden" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 24px", borderBottom:"1px solid #334155" }}>
              <button onClick={() => { if(calMonth===0){setCalMonth(11);setCalYear(y=>y-1);}else setCalMonth(m=>m-1); }} style={{ background:"#0f172a", border:"1px solid #334155", borderRadius:8, padding:"6px 14px", color:"#94a3b8", cursor:"pointer", fontSize:16 }}>›</button>
              <span style={{ fontWeight:900, fontSize:20, color:"#f1f5f9" }}>{monthName} {calYear}</span>
              <button onClick={() => { if(calMonth===11){setCalMonth(0);setCalYear(y=>y+1);}else setCalMonth(m=>m+1); }} style={{ background:"#0f172a", border:"1px solid #334155", borderRadius:8, padding:"6px 14px", color:"#94a3b8", cursor:"pointer", fontSize:16 }}>‹</button>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", borderBottom:"1px solid #334155", direction:"ltr" }}>
              {["א׳","ב׳","ג׳","ד׳","ה׳","ו׳","ש׳"].map(d => (
                <div key={d} style={{ padding:"10px 0", textAlign:"center", fontSize:12, fontWeight:700, color:"#64748b" }}>{d}</div>
              ))}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", direction:"ltr" }}>
              {Array.from({length:firstDay}).map((_,i) => <div key={"e"+i} style={{ minHeight:90, borderRight:"1px solid #33415533", borderBottom:"1px solid #33415533" }} />)}
              {Array.from({length:daysInMonth}).map((_,i) => {
                const day = i+1;
                const dateStr = `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                const vacs = getVacationsForDay(day);
                const todayHL = dateStr===today;
                return (
                  <div key={day} style={{ minHeight:90, padding:"8px 6px", borderRight:"1px solid #33415533", borderBottom:"1px solid #33415533", background:todayHL?"#6366f111":"transparent", direction:"rtl" }}>
                    <div style={{ width:26, height:26, borderRadius:"50%", background:todayHL?"#6366f1":"transparent", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:4 }}>
                      <span style={{ fontSize:13, fontWeight:todayHL?700:400, color:todayHL?"#fff":"#94a3b8" }}>{day}</span>
                    </div>
                    {vacs.slice(0,3).map(v => (
                      <div key={v.id} style={{ fontSize:10, padding:"2px 5px", borderRadius:4, background:(empColor[v.employee]||"#6366f1")+"33", color:empColor[v.employee]||"#6366f1", marginBottom:2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", fontWeight:700 }}>
                        {v.employeeName?.split(" ")[0]||"?"}
                      </div>
                    ))}
                    {vacs.length>3 && <div style={{ fontSize:10, color:"#64748b" }}>+{vacs.length-3}</div>}
                  </div>
                );
              })}
            </div>
            <div style={{ padding:"16px 24px", borderTop:"1px solid #334155", display:"flex", flexWrap:"wrap", gap:12 }}>
              {employees.map(e => (
                <div key={e.uid} style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:"#94a3b8" }}>
                  <div style={{ width:10, height:10, borderRadius:3, background:empColor[e.uid]||"#6366f1" }} />
                  {e.name}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ===== REQUEST MODAL ===== */}
      {showForm && (
        <div style={{ position:"fixed", inset:0, background:"#00000088", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, backdropFilter:"blur(4px)" }}>
          <div style={{ background:"#1e293b", borderRadius:18, padding:32, width:440, border:"1px solid #334155", boxShadow:"0 25px 60px #00000060", direction:"rtl" }}>
            <div style={{ fontWeight:900, fontSize:20, color:"#f1f5f9", marginBottom:24 }}>🌴 בקשת חופשה</div>
            {me && (() => {
              const used = getYearUsedDays(me, requests);
              const remaining = (me.quota||20) - used;
              const previewDays = form.start && form.end && form.end>=form.start ? countWorkingDays(form.start, form.end, me.workDays||[0,1,2,3,4]) : null;
              const startMonth = form.start ? parseInt(form.start.slice(5,7))-1 : null;
              const rot = startMonth!==null ? me.rotations?.[startMonth] : null;
              return (
                <div style={{ background:"#0f172a", borderRadius:9, padding:"10px 14px", border:"1px solid #334155", fontSize:12, color:"#94a3b8", display:"flex", flexWrap:"wrap", gap:8, justifyContent:"space-between", marginBottom:16 }}>
                  <span>נותרו: <strong style={{ color:remaining>0?"#10b981":"#ef4444" }}>{remaining} ימים</strong></span>
                  {previewDays!==null && <span>בקשה זו: <strong style={{ color:"#f59e0b" }}>{previewDays} ימי עבודה</strong></span>}
                  {rot && <span>רוטציה: <strong style={{ color:rotationColors[rot] }}>{rot}</strong></span>}
                </div>
              );
            })()}
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div>
                  <label style={{ fontSize:12, color:"#64748b", fontWeight:700, display:"block", marginBottom:6 }}>תאריך התחלה</label>
                  <input type="date" value={form.start} onChange={e => setForm(f=>({...f,start:e.target.value}))} style={inp()} />
                </div>
                <div>
                  <label style={{ fontSize:12, color:"#64748b", fontWeight:700, display:"block", marginBottom:6 }}>תאריך סיום</label>
                  <input type="date" value={form.end} onChange={e => setForm(f=>({...f,end:e.target.value}))} style={inp()} />
                </div>
              </div>
              <div>
                <label style={{ fontSize:12, color:"#64748b", fontWeight:700, display:"block", marginBottom:6 }}>סיבה / הערות</label>
                <textarea value={form.reason} onChange={e => setForm(f=>({...f,reason:e.target.value}))} rows={3} placeholder="הערות אופציונליות..." style={{ ...inp(), resize:"none" }} />
              </div>
              <div style={{ display:"flex", gap:10, marginTop:4 }}>
                <button onClick={() => setShowForm(false)} style={{ flex:1, padding:11, borderRadius:9, border:"1px solid #334155", background:"transparent", color:"#94a3b8", cursor:"pointer", fontSize:14, fontFamily:"'Heebo', sans-serif" }}>ביטול</button>
                <button onClick={submitRequest} disabled={saving} style={{ flex:2, padding:11, borderRadius:9, border:"none", background:"linear-gradient(135deg, #6366f1, #8b5cf6)", color:"#fff", cursor:"pointer", fontSize:14, fontWeight:800, fontFamily:"'Heebo', sans-serif" }}>{saving?"שולח...":"שלח בקשה"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== SCHEDULE EDIT MODAL ===== */}
      {showScheduleEdit && editSchedule && (
        <div style={{ position:"fixed", inset:0, background:"#00000088", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, backdropFilter:"blur(4px)" }}>
          <div style={{ background:"#1e293b", borderRadius:18, padding:32, width:420, border:"1px solid #334155", boxShadow:"0 25px 60px #00000060", direction:"rtl" }}>
            <div style={{ fontWeight:900, fontSize:20, color:"#f1f5f9", marginBottom:4 }}>✏️ עריכת לוח עבודה</div>
            <div style={{ fontSize:13, color:"#64748b", marginBottom:24 }}>{editSchedule.name}</div>
            <div style={{ marginBottom:20 }}>
              <label style={{ fontSize:12, color:"#64748b", fontWeight:700, display:"block", marginBottom:10 }}>ימי עבודה בשבוע</label>
              <div style={{ display:"flex", gap:6 }}>
                {[0,1,2,3,4,5,6].map(d => {
                  const active = editSchedule.workDays.includes(d);
                  const color = empColor[editSchedule.uid]||"#6366f1";
                  return (
                    <button key={d} onClick={() => toggleWorkDay(d)} style={{ flex:1, padding:"10px 0", borderRadius:9, border:`2px solid ${active?color:"#334155"}`, background:active?color+"33":"#0f172a", color:active?color:"#475569", cursor:"pointer", fontSize:12, fontWeight:700, fontFamily:"'Heebo', sans-serif" }}>
                      {DAYS_HE[d].slice(0,2)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ marginBottom:24 }}>
              <label style={{ fontSize:12, color:"#64748b", fontWeight:700, display:"block", marginBottom:8 }}>מכסת חופשה שנתית (ימים)</label>
              <input type="number" min={0} max={60} value={editSchedule.quota} onChange={e => setEditSchedule(s=>({...s,quota:parseInt(e.target.value)||0}))} style={{ ...inp(), fontSize:16, fontWeight:700, textAlign:"center" }} />
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setShowScheduleEdit(null)} style={{ flex:1, padding:11, borderRadius:9, border:"1px solid #334155", background:"transparent", color:"#94a3b8", cursor:"pointer", fontSize:14, fontFamily:"'Heebo', sans-serif" }}>ביטול</button>
              <button onClick={saveSchedule} disabled={saving} style={{ flex:2, padding:11, borderRadius:9, border:"none", background:"linear-gradient(135deg, #6366f1, #8b5cf6)", color:"#fff", cursor:"pointer", fontSize:14, fontWeight:800, fontFamily:"'Heebo', sans-serif" }}>{saving?"שומר...":"שמור"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== ROTATION EDIT MODAL ===== */}
      {showRotationEdit && editRotations && (
        <div style={{ position:"fixed", inset:0, background:"#00000088", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, backdropFilter:"blur(4px)" }}>
          <div style={{ background:"#1e293b", borderRadius:18, padding:32, width:520, border:"1px solid #334155", boxShadow:"0 25px 60px #00000060", direction:"rtl", maxHeight:"90vh", overflowY:"auto" }}>
            <div style={{ fontWeight:900, fontSize:20, color:"#f1f5f9", marginBottom:4 }}>🔄 עריכת רוטציות</div>
            <div style={{ fontSize:13, color:"#64748b", marginBottom:20 }}>{editRotations.name}</div>
            <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:24 }}>
              {MONTHS_HE.map((month,mi) => (
                <div key={mi} style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <span style={{ fontSize:13, color:mi===currentMonth?"#6366f1":"#94a3b8", fontWeight:mi===currentMonth?800:500, minWidth:72 }}>{month}</span>
                  <select value={editRotations.rotations[mi]||""} onChange={e => {
                    const r=[...editRotations.rotations]; r[mi]=e.target.value;
                    setEditRotations(p=>({...p,rotations:r}));
                  }} style={{ flex:1, padding:"8px 12px", borderRadius:8, border:`1px solid ${editRotations.rotations[mi]?rotationColors[editRotations.rotations[mi]]+"66":"#334155"}`, background:"#0f172a", color:editRotations.rotations[mi]?rotationColors[editRotations.rotations[mi]]:"#94a3b8", fontSize:13, fontWeight:700, fontFamily:"'Heebo', sans-serif", direction:"rtl" }}>
                    <option value="">— ללא רוטציה —</option>
                    {ROTATIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setShowRotationEdit(null)} style={{ flex:1, padding:11, borderRadius:9, border:"1px solid #334155", background:"transparent", color:"#94a3b8", cursor:"pointer", fontSize:14, fontFamily:"'Heebo', sans-serif" }}>ביטול</button>
              <button onClick={saveRotations} disabled={saving} style={{ flex:2, padding:11, borderRadius:9, border:"none", background:"linear-gradient(135deg, #6366f1, #8b5cf6)", color:"#fff", cursor:"pointer", fontSize:14, fontWeight:800, fontFamily:"'Heebo', sans-serif" }}>{saving?"שומר...":"שמור"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
