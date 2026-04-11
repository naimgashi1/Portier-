// Portier by NG Technologies LLC — v3 Parking Clock
import { useState, useRef, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
const SUPABASE_URL = "https://yvxsmrsmurkxierjjhfp.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2eHNtcnNtdXJreGllcmpqaGZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NjM3ODcsImV4cCI6MjA5MTIzOTc4N30.gzFkyo-neUh2UMwpikdDVWt0lktq_MkJ_JuRy_Swv4c";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function sendNotif(title, body) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, { body, icon:"/icon-192.png", vibrate:[200,100,200] });
      });
    } else {
      new Notification(title, { body, icon:"/icon-192.png" });
    }
  }
}

async function requestNotifPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    await Notification.requestPermission();
  }
}

const GOLD   = "#C8A96E";
const GOLD2  = "rgba(200,169,110,0.12)";
const TEXT   = "#EDE8DC";
const DIM    = "#7A7060";
const FAINT  = "#2A2520";
const BG     = "#0A0906";
const SURF   = "#111009";
const CARD   = "#181510";
const BORDER = "#272318";
const ADMIN_PIN = "2604";
const GREEN  = "#4A9E6E";
const AMBER  = "#D4853A";
const BLUE   = "#4A88B8";
const RED    = "#B85A5A";

const DEFAULT_VENUES = [
  { id:"rp-prime",       name:"RP Prime Steak & Seafood",    short:"RP Prime",        location:"Mahwah, New Jersey",       initials:"RP", color:"#C8A96E", hourly_rate:0 },
  { id:"capital-grille", name:"The Capital Grille",           short:"Capital Grille",  location:"Paramus, New Jersey",      initials:"CG", color:"#8B6914", hourly_rate:0 },
  { id:"mortons",        name:"Morton's The Steakhouse",      short:"Morton's",        location:"Hackensack, New Jersey",   initials:"M",  color:"#1B3A4B", hourly_rate:0 },
  { id:"ruths-chris",    name:"Ruth's Chris Steak House",     short:"Ruth's Chris",    location:"Weehawken, New Jersey",    initials:"RC", color:"#8B0000", hourly_rate:0 },
  { id:"nobu",           name:"Nobu Restaurant",              short:"Nobu",            location:"Short Hills, New Jersey",  initials:"N",  color:"#2C3E50", hourly_rate:0 },
  { id:"wolfgang",       name:"Wolfgang's Steakhouse",        short:"Wolfgang's",      location:"Westhampton, New Jersey",  initials:"W",  color:"#5C3A1E", hourly_rate:0 },
];

const STATUS = { PARKED:"parked", REQUESTED:"requested", ENROUTE:"enroute", READY:"ready", DONE:"done" };
const SMETA  = {
  parked:    { label:"Parked",         color:DIM   },
  requested: { label:"Requested",      color:AMBER },
  enroute:   { label:"On the Way",     color:BLUE  },
  ready:     { label:"Ready Outside",  color:GREEN },
  done:      { label:"Retrieved",      color:FAINT },
};

const KEY_BOXES = Array.from({ length: 300 }, (_, i) => i + 1);

function now()        { return new Date().toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"}); }
function today()      { return new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); }
function normPlate(p) { return p.replace(/[^A-Z0-9]/gi,"").toUpperCase(); }

function formatElapsed(ms) {
  const totalSecs = Math.floor(ms / 1000);
  const hrs  = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  if (hrs > 0) return `${hrs}h ${String(mins).padStart(2,"0")}m ${String(secs).padStart(2,"0")}s`;
  return `${String(mins).padStart(2,"0")}m ${String(secs).padStart(2,"0")}s`;
}

function rowToCar(row) {
  return {
    plate: row.plate, make: row.make, color: row.color,
    location: row.location, box: row.box, status: row.status,
    time: row.time, date: row.date, customerName: row.customer_name,
    tip: row.tip, rating: row.rating, valetName: row.valet_name,
    parkedAt: row.parked_at, hourlyRate: row.hourly_rate || 0,
  };
}

function PortierHeader({ onLongPress }) {
  const pressTimer = useRef(null);
  function startPress() { pressTimer.current = setTimeout(() => onLongPress && onLongPress(), 1500); }
  function endPress() { clearTimeout(pressTimer.current); }
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}
      onMouseDown={startPress} onMouseUp={endPress} onMouseLeave={endPress}
      onTouchStart={startPress} onTouchEnd={endPress}>
      <svg width="22" height="22" viewBox="0 0 42 42" fill="none">
        <circle cx="21" cy="21" r="20" stroke={GOLD} strokeWidth="1.5" fill={GOLD2}/>
        <text x="21" y="27" textAnchor="middle" fill={GOLD} fontSize="13" fontFamily="Georgia,serif" fontWeight="bold">P</text>
      </svg>
      <div style={{ fontFamily:"Georgia,serif", fontSize:18, fontWeight:"bold", letterSpacing:5, color:GOLD, lineHeight:1 }}>PORTIER</div>
    </div>
  );
}

function AdminDashboard({ venues, setVenues, valetCompanies, setValetCompanies, valetEmployees, setValetEmployees, onExit }) {
  const [tab, setTab] = useState("venues");
  const [flashMsg, setFlashMsg] = useState("");
  const [vForm, setVForm] = useState({ name:"", short:"", location:"", initials:"", color:"#C8A96E", hourly_rate:"" });
  const [cForm, setCForm] = useState({ name:"" });
  const [eForm, setEForm] = useState({ name:"", company_id:"", pin:"" });

  function showFlash(msg) { setFlashMsg(msg); setTimeout(() => setFlashMsg(""), 2500); }

  async function addVenue() {
    if (!vForm.name || !vForm.initials) return;
    const id = vForm.name.toLowerCase().replace(/[^a-z0-9]+/g,"-");
    const hourly_rate = parseFloat(vForm.hourly_rate) || 0;
    const record = { id, name:vForm.name, short:vForm.short||vForm.name, location:vForm.location, initials:vForm.initials.toUpperCase().slice(0,2), color:vForm.color, active:true, hourly_rate };
    const { error } = await supabase.from("venues").insert([record]);
    if (error) { showFlash("Error: " + error.message); return; }
    setVenues(p => [...p, record]);
    setVForm({ name:"", short:"", location:"", initials:"", color:"#C8A96E", hourly_rate:"" });
    showFlash("✓ Venue added");
  }

  async function updateHourlyRate(id, rate) {
    const hourly_rate = parseFloat(rate) || 0;
    await supabase.from("venues").update({ hourly_rate }).eq("id", id);
    setVenues(p => p.map(v => v.id===id ? {...v, hourly_rate} : v));
  }

  async function toggleVenue(id, active) {
    await supabase.from("venues").update({ active: !active }).eq("id", id);
    setVenues(p => p.map(v => v.id===id ? {...v, active:!active} : v));
  }

  async function addCompany() {
    if (!cForm.name) return;
    const { data, error } = await supabase.from("valet_companies").insert([{ name:cForm.name }]).select();
    if (error) { showFlash("Error: " + error.message); return; }
    setValetCompanies(p => [...p, data[0]]);
    setCForm({ name:"" });
    showFlash("✓ Company added");
  }

  async function addEmployee() {
    if (!eForm.name || !eForm.pin || eForm.pin.length !== 4) { showFlash("Name + 4-digit PIN required"); return; }
    const { data, error } = await supabase.from("valet_employees").insert([{ name:eForm.name, company_id:eForm.company_id||null, pin:eForm.pin }]).select();
    if (error) { showFlash("Error: " + error.message); return; }
    setValetEmployees(p => [...p, data[0]]);
    setEForm({ name:"", company_id:"", pin:"" });
    showFlash("✓ Employee added");
  }

  async function removeEmployee(id) {
    await supabase.from("valet_employees").update({ active:false }).eq("id", id);
    setValetEmployees(p => p.filter(e => e.id !== id));
  }

  const inputStyle = { background:SURF, border:`1px solid ${BORDER}`, borderRadius:10, padding:"12px 14px", color:TEXT, fontSize:14, fontFamily:"Georgia,serif", width:"100%", outline:"none" };
  const labelStyle = { fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:DIM, letterSpacing:2, marginBottom:6, display:"block" };

  return (
    <div style={{ fontFamily:"Georgia,serif", background:BG, minHeight:"100vh", color:TEXT, display:"flex", flexDirection:"column", maxWidth:430, margin:"0 auto" }}>
      <div style={{ background:SURF, borderBottom:`1px solid ${BORDER}`, padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <svg width="20" height="20" viewBox="0 0 42 42" fill="none">
            <circle cx="21" cy="21" r="20" stroke={GOLD} strokeWidth="1.5" fill={GOLD2}/>
            <text x="21" y="27" textAnchor="middle" fill={GOLD} fontSize="13" fontFamily="Georgia,serif" fontWeight="bold">P</text>
          </svg>
          <div style={{ fontFamily:"Georgia,serif", fontSize:16, fontWeight:"bold", letterSpacing:4, color:GOLD }}>ADMIN</div>
        </div>
        <button className="btn" onClick={onExit} style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:DIM, letterSpacing:1 }}>EXIT</button>
      </div>

      {flashMsg && <div style={{ background:GREEN, color:"#fff", padding:"10px 16px", fontFamily:"'IBM Plex Mono',monospace", fontSize:11, textAlign:"center" }}>{flashMsg}</div>}

      <div style={{ display:"flex", background:CARD, borderBottom:`1px solid ${BORDER}` }}>
        {[["venues","Venues"],["companies","Companies"],["employees","Employees"]].map(([t,l]) => (
          <button key={t} className="btn" onClick={()=>setTab(t)} style={{ flex:1, padding:"12px 0", fontFamily:"'IBM Plex Mono',monospace", fontSize:10, letterSpacing:1, color: tab===t ? GOLD : DIM, borderBottom: tab===t ? `2px solid ${GOLD}` : "2px solid transparent" }}>{l.toUpperCase()}</button>
        ))}
      </div>

      <div style={{ flex:1, overflow:"auto", padding:16 }}>
        {tab==="venues" && <>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:DIM, letterSpacing:2, marginBottom:16 }}>ADD VENUE</div>
          <div style={{ display:"grid", gap:10, marginBottom:8 }}>
            <div><label style={labelStyle}>VENUE NAME</label><input placeholder="e.g. Biltmore Garage" value={vForm.name} onChange={e=>setVForm(p=>({...p,name:e.target.value}))} style={inputStyle}/></div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div><label style={labelStyle}>SHORT NAME</label><input placeholder="e.g. Biltmore" value={vForm.short} onChange={e=>setVForm(p=>({...p,short:e.target.value}))} style={inputStyle}/></div>
              <div><label style={labelStyle}>INITIALS</label><input placeholder="e.g. BG" maxLength={2} value={vForm.initials} onChange={e=>setVForm(p=>({...p,initials:e.target.value.toUpperCase()}))} style={inputStyle}/></div>
            </div>
            <div><label style={labelStyle}>LOCATION</label><input placeholder="e.g. New York, New York" value={vForm.location} onChange={e=>setVForm(p=>({...p,location:e.target.value}))} style={inputStyle}/></div>
            <div><label style={labelStyle}>HOURLY RATE ($/hr) — enter 0 for restaurants</label><input placeholder="e.g. 12 for $12/hr, 0 for restaurant valet" value={vForm.hourly_rate} onChange={e=>setVForm(p=>({...p,hourly_rate:e.target.value}))} type="number" min="0" step="0.50" style={inputStyle}/></div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:10, alignItems:"end" }}>
              <div><label style={labelStyle}>BRAND COLOR</label><input type="color" value={vForm.color} onChange={e=>setVForm(p=>({...p,color:e.target.value}))} style={{ ...inputStyle, padding:6, height:44, cursor:"pointer" }}/></div>
              <div style={{ width:44, height:44, borderRadius:10, background:vForm.color, border:`1px solid ${BORDER}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <span style={{ fontFamily:"Georgia,serif", fontSize:14, fontWeight:"bold", color:"#fff", textShadow:"0 1px 2px rgba(0,0,0,0.5)" }}>{vForm.initials||"?"}</span>
              </div>
            </div>
          </div>
          <button className="btn" onClick={addVenue} style={{ width:"100%", padding:13, borderRadius:10, fontSize:14, fontFamily:"Georgia,serif", background:GOLD, color:BG, fontWeight:600, marginBottom:24 }}>+ Add Venue</button>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:DIM, letterSpacing:2, marginBottom:12 }}>ALL VENUES ({venues.length})</div>
          <div style={{ display:"grid", gap:10 }}>
            {venues.map(v => (
              <div key={v.id} style={{ background:SURF, border:`1px solid ${BORDER}`, borderRadius:12, padding:"13px 15px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10 }}>
                  <svg width="36" height="36" viewBox="0 0 42 42" fill="none">
                    <circle cx="21" cy="21" r="20" stroke={v.color} strokeWidth="1.5" fill={`${v.color}15`}/>
                    <text x="21" y="27" textAnchor="middle" fill={v.color} fontSize={v.initials?.length>1?"10":"14"} fontFamily="Georgia,serif" fontWeight="bold">{v.initials}</text>
                  </svg>
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:"Georgia,serif", fontSize:14, color:TEXT }}>{v.name}</div>
                    <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:DIM, marginTop:2 }}>{v.location}</div>
                  </div>
                  <button className="btn" onClick={()=>toggleVenue(v.id, v.active)} style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color: v.active!==false ? GREEN : RED, border:`1px solid ${v.active!==false ? GREEN+"40" : RED+"40"}`, borderRadius:6, padding:"3px 8px" }}>{v.active!==false ? "ACTIVE" : "INACTIVE"}</button>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:DIM }}>RATE: $</div>
                  <input type="number" min="0" step="0.50" defaultValue={v.hourly_rate || 0} onBlur={e=>updateHourlyRate(v.id, e.target.value)} style={{ background:BG, border:`1px solid ${BORDER}`, borderRadius:7, padding:"5px 10px", color:GOLD, fontSize:13, fontFamily:"'IBM Plex Mono',monospace", width:80, outline:"none" }}/>
                  <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:DIM }}>/hr · 0 = restaurant</div>
                </div>
              </div>
            ))}
          </div>
        </>}

        {tab==="companies" && <>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:DIM, letterSpacing:2, marginBottom:16 }}>ADD VALET COMPANY</div>
          <div style={{ display:"grid", gap:10, marginBottom:8 }}>
            <div><label style={labelStyle}>COMPANY NAME</label><input placeholder="e.g. Premier Valet Services" value={cForm.name} onChange={e=>setCForm(p=>({...p,name:e.target.value}))} style={inputStyle}/></div>
          </div>
          <button className="btn" onClick={addCompany} style={{ width:"100%", padding:13, borderRadius:10, fontSize:14, fontFamily:"Georgia,serif", background:GOLD, color:BG, fontWeight:600, marginBottom:24 }}>+ Add Company</button>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:DIM, letterSpacing:2, marginBottom:12 }}>ALL COMPANIES ({valetCompanies.length})</div>
          {valetCompanies.length === 0 && <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:DIM, textAlign:"center", padding:"20px 0" }}>No companies yet</div>}
          <div style={{ display:"grid", gap:10 }}>
            {valetCompanies.map(c => (
              <div key={c.id} style={{ background:SURF, border:`1px solid ${BORDER}`, borderRadius:12, padding:"13px 15px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div style={{ fontFamily:"Georgia,serif", fontSize:14, color:TEXT }}>{c.name}</div>
                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:DIM }}>{valetEmployees.filter(e=>e.company_id===c.id).length} valets</div>
              </div>
            ))}
          </div>
        </>}

        {tab==="employees" && <>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:DIM, letterSpacing:2, marginBottom:16 }}>ADD VALET EMPLOYEE</div>
          <div style={{ display:"grid", gap:10, marginBottom:8 }}>
            <div><label style={labelStyle}>FULL NAME</label><input placeholder="e.g. Carlos Rivera" value={eForm.name} onChange={e=>setEForm(p=>({...p,name:e.target.value}))} style={inputStyle}/></div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div>
                <label style={labelStyle}>COMPANY</label>
                <select value={eForm.company_id} onChange={e=>setEForm(p=>({...p,company_id:e.target.value}))} style={{...inputStyle, appearance:"none"}}>
                  <option value="">No company</option>
                  {valetCompanies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div><label style={labelStyle}>4-DIGIT PIN</label><input placeholder="e.g. 1234" maxLength={4} type="password" value={eForm.pin} onChange={e=>setEForm(p=>({...p,pin:e.target.value.replace(/\D/,"")}))} style={inputStyle}/></div>
            </div>
          </div>
          <button className="btn" onClick={addEmployee} style={{ width:"100%", padding:13, borderRadius:10, fontSize:14, fontFamily:"Georgia,serif", background:GOLD, color:BG, fontWeight:600, marginBottom:24 }}>+ Add Employee</button>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:DIM, letterSpacing:2, marginBottom:12 }}>ALL EMPLOYEES ({valetEmployees.length})</div>
          {valetEmployees.length === 0 && <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:DIM, textAlign:"center", padding:"20px 0" }}>No employees yet</div>}
          <div style={{ display:"grid", gap:10 }}>
            {valetEmployees.map(e => (
              <div key={e.id} style={{ background:SURF, border:`1px solid ${BORDER}`, borderRadius:12, padding:"13px 15px", display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:36, height:36, borderRadius:"50%", background:GOLD2, border:`1px solid ${GOLD}`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Georgia,serif", fontSize:14, color:GOLD, fontWeight:"bold" }}>{e.name.charAt(0)}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:"Georgia,serif", fontSize:14, color:TEXT }}>{e.name}</div>
                  <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:DIM, marginTop:2 }}>{e.valet_companies?.name || "No company"} · PIN: {"•".repeat(4)}</div>
                </div>
                <button className="btn" onClick={()=>removeEmployee(e.id)} style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:RED, border:`1px solid ${RED}40`, borderRadius:6, padding:"3px 8px" }}>REMOVE</button>
              </div>
            ))}
          </div>
        </>}
      </div>
    </div>
  );
}

export default function App() {
  const [side, setSide] = useState("customer");
  const [adminPinInput, setAdminPinInput] = useState("");
  const [adminPinError, setAdminPinError] = useState(false);
  const [showAdminPin, setShowAdminPin] = useState(false);
  const [lots, setLots] = useState({});
  const custUserRef = useRef(null);
  const valetVenueRef = useRef(null);

  useEffect(() => { requestNotifPermission(); }, []);

  useEffect(() => {
    async function loadLots() {
      const { data, error } = await supabase.from("lots").select("*");
      if (error) { console.error("Load error:", error); return; }
      const built = {};
      data.forEach(row => {
        if (!built[row.venue_id]) built[row.venue_id] = {};
        built[row.venue_id][row.plate] = rowToCar(row);
      });
      setLots(built);
    }
    loadLots();

    const channel = supabase.channel("lots-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "lots" }, (payload) => {
        if (payload.eventType === "DELETE") {
          setLots(prev => {
            const next = { ...prev };
            const row = payload.old;
            if (next[row.venue_id]) { next[row.venue_id] = { ...next[row.venue_id] }; delete next[row.venue_id][row.plate]; }
            return next;
          });
        } else {
          const row = payload.new;
          const cu = custUserRef.current;
          const vv = valetVenueRef.current;
          if (cu && row.plate === normPlate(cu.plate)) {
            if (row.status === "ready") sendNotif("Your car is outside!", "Pull up to the entrance.");
            if (row.status === "enroute") sendNotif("Your car is on the way!", "Your valet is bringing your car out now.");
          }
          if (vv && row.venue_id === vv.id && row.status === "requested") {
            sendNotif("Guest heading out!", `${row.plate} — ${row.customer_name || "Guest"} is ready.`);
          }
          setLots(prev => ({ ...prev, [row.venue_id]: { ...(prev[row.venue_id] || {}), [row.plate]: rowToCar(row) } }));
        }
      }).subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const [valetEmployee, setValetEmployee] = useState(null);
  const [valetLoginScreen, setValetLoginScreen] = useState(true);
  const [valetPinInput, setValetPinInput] = useState("");
  const [valetPinError, setValetPinError] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [valetVenue, setValetVenue] = useState(null);
  const [vForm, setVForm] = useState({ plate:"", make:"", color:"", location:"", box:"" });
  const [vError, setVError] = useState("");
  const [boxSearch, setBoxSearch] = useState("");
  const [showBoxPicker, setShowBoxPicker] = useState(false);
  const [tipModal, setTipModal] = useState(null);
  const [tipAmt, setTipAmt] = useState(null);

  const [custUser, setCustUser] = useState(() => {
    try { const s = localStorage.getItem("portier_guest"); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [custScreen, setCustScreen] = useState("home");
  const [tipPick, setTipPick] = useState(null);
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [venues, setVenues] = useState(DEFAULT_VENUES);
  const [valetCompanies, setValetCompanies] = useState([]);
  const [valetEmployees, setValetEmployees] = useState([]);
  const [notif, setNotif] = useState(null);
  const notifRef = useRef();

  useEffect(() => { custUserRef.current = custUser; }, [custUser]);
  useEffect(() => { valetVenueRef.current = valetVenue; }, [valetVenue]);

  useEffect(() => {
    supabase.from("venues").select("*").eq("active", true).then(({ data }) => { if (data && data.length > 0) setVenues(data); });
    supabase.from("valet_companies").select("*").eq("active", true).then(({ data }) => { if (data) setValetCompanies(data); });
    supabase.from("valet_employees").select("*, valet_companies(name)").eq("active", true).then(({ data }) => { if (data) setValetEmployees(data); });
  }, []);

  function flash(msg, type="ok") {
    clearTimeout(notifRef.current);
    setNotif({ msg, type });
    notifRef.current = setTimeout(() => setNotif(null), 3200);
  }

  const valetLot     = valetVenue ? (lots[valetVenue.id] || {}) : {};
  const usedBoxes    = Object.values(valetLot).filter(c=>c.status!==STATUS.DONE).map(c=>c.box);
  const activeLot    = Object.values(valetLot).filter(c=>c.status!==STATUS.DONE);
  const pendingCount = activeLot.filter(c=>c.status===STATUS.REQUESTED).length;
  const doneLot      = Object.values(valetLot).filter(c=>c.status===STATUS.DONE);
  const totalTips    = doneLot.reduce((s,c)=>s+(c.tip||0),0);
  const availableBoxes = KEY_BOXES.filter(n => { if (usedBoxes.includes(n)) return false; if (boxSearch) return String(n).startsWith(boxSearch); return true; });

  const custCar = custUser ? (() => {
    const plate = normPlate(custUser.plate);
    for (const vid of Object.keys(lots)) {
      if (lots[vid][plate] && lots[vid][plate].status !== STATUS.DONE) {
        return { car: lots[vid][plate], venue: venues.find(v=>v.id===vid) };
      }
    }
    return null;
  })() : null;

  useEffect(() => {
    if (custCar?.car.status === STATUS.DONE && custScreen === "home") setCustScreen("tip");
  }, [custCar?.car.status]);

  useEffect(() => {
    if (!custUser) return;
    const plate = normPlate(custUser.plate);
    for (const vid of Object.keys(lots)) {
      if (lots[vid][plate] && !lots[vid][plate].customerName) {
        supabase.from("lots").update({ customer_name: `${custUser.first} ${custUser.last}` }).eq("venue_id", vid).eq("plate", plate);
      }
    }
  }, [custUser, lots]);

  async function valetPark() {
    if (!valetVenue) return;
    const plate = normPlate(vForm.plate);
    if (!plate || !vForm.make || !vForm.color || !vForm.box) { setVError("Fill in all fields."); return; }
    if (usedBoxes.includes(Number(vForm.box))) { setVError(`Box ${vForm.box} is taken.`); return; }
    if (valetLot[plate] && valetLot[plate].status !== STATUS.DONE) { setVError("Plate already active."); return; }
    const matched = custUser && normPlate(custUser.plate) === plate;
    const record = {
      venue_id: valetVenue.id, plate, make: vForm.make, color: vForm.color,
      location: vForm.location || null, box: Number(vForm.box),
      status: STATUS.PARKED, time: now(), date: today(), tip: null, rating: null,
      customer_name: matched ? `${custUser.first} ${custUser.last}` : null,
      valet_name: valetEmployee ? valetEmployee.name : null,
      parked_at: new Date().toISOString(),
      hourly_rate: valetVenue.hourly_rate || 0,
    };
    try {
      await supabase.from("lots").delete().eq("venue_id", valetVenue.id).eq("plate", plate);
      const { error } = await supabase.from("lots").insert([record]).select();
      if (error) { setVError("DB error: " + error.message); return; }
    } catch { setVError("Network error"); return; }
    setVForm({ plate:"", make:"", color:"", location:"", box:"" });
    setVError(""); setBoxSearch(""); setShowBoxPicker(false);
    flash(`Parked · Box ${vForm.box}${matched ? ` · ${custUser.first} ${custUser.last}` : ""}`);
  }

  async function advance(plate) {
    if (!valetVenue) return;
    const s = valetLot[plate]?.status;
    const next = {requested:STATUS.ENROUTE,enroute:STATUS.READY}[s];
    if (!next) return;
    const updateData = { status: next };
    if (next === STATUS.ENROUTE && valetEmployee) updateData.valet_name = valetEmployee.name;
    await supabase.from("lots").update(updateData).eq("venue_id", valetVenue.id).eq("plate", plate);
  }

  async function confirmRetrieve(plate, tip) {
    if (!valetVenue) return;
    await supabase.from("lots").update({ status: STATUS.DONE, tip }).eq("venue_id", valetVenue.id).eq("plate", plate);
    setTipModal(null);
    flash(`${plate} retrieved${tip?` · $${tip} tip`:""}`);
  }

  async function custRequest() {
    if (!custUser || !custCar) return;
    const plate = normPlate(custUser.plate);
    await supabase.from("lots").update({ status: STATUS.REQUESTED, customer_name: `${custUser.first} ${custUser.last}` }).eq("venue_id", custCar.venue.id).eq("plate", plate);
  }

  if (showAdminPin) return (
    <div style={{ fontFamily:"Georgia,serif", background:BG, minHeight:"100vh", color:TEXT, display:"flex", flexDirection:"column", maxWidth:430, margin:"0 auto", alignItems:"center", justifyContent:"center", padding:32 }}>
      <svg width="48" height="48" viewBox="0 0 42 42" fill="none" style={{ marginBottom:16 }}>
        <circle cx="21" cy="21" r="20" stroke={GOLD} strokeWidth="1.5" fill={GOLD2}/>
        <text x="21" y="27" textAnchor="middle" fill={GOLD} fontSize="13" fontFamily="Georgia,serif" fontWeight="bold">P</text>
      </svg>
      <div style={{ fontFamily:"Georgia,serif", fontSize:22, color:GOLD, marginBottom:6, letterSpacing:4 }}>ADMIN</div>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:DIM, marginBottom:32, letterSpacing:1 }}>Enter admin PIN to continue</div>
      <div style={{ display:"flex", gap:12, marginBottom:24 }}>
        {[0,1,2,3].map(i => <div key={i} style={{ width:18, height:18, borderRadius:"50%", background:i < adminPinInput.length ? GOLD : "transparent", border:`1.5px solid ${GOLD}`, opacity: i < adminPinInput.length ? 1 : 0.4 }}/>)}
      </div>
      {adminPinError && <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:RED, marginBottom:16, letterSpacing:1 }}>INCORRECT PIN</div>}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, width:220 }}>
        {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((k,i) => (
          <button key={i} className="btn" onClick={() => {
            if (k === "⌫") { setAdminPinInput(p => p.slice(0,-1)); setAdminPinError(false); }
            else if (k === "") return;
            else {
              const next = adminPinInput + k; setAdminPinInput(next);
              if (next.length === 4) {
                if (next === ADMIN_PIN) { setShowAdminPin(false); setSide("admin"); setAdminPinInput(""); setAdminPinError(false); }
                else { setAdminPinError(true); setAdminPinInput(""); }
              }
            }
          }} style={{ height:56, borderRadius:12, fontSize:20, fontFamily:"Georgia,serif", background:k===""?"transparent":SURF, color:TEXT, border:k===""?"none":`1px solid ${BORDER}` }}>{k}</button>
        ))}
      </div>
      <button className="btn" onClick={() => { setShowAdminPin(false); setAdminPinInput(""); setAdminPinError(false); }} style={{ marginTop:28, fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:DIM }}>Cancel</button>
    </div>
  );

  if (side === "admin") return (
    <AdminDashboard venues={venues} setVenues={setVenues} valetCompanies={valetCompanies} setValetCompanies={setValetCompanies} valetEmployees={valetEmployees} setValetEmployees={setValetEmployees} onExit={() => setSide("customer")}/>
  );

  return (
    <div style={{ fontFamily:"Georgia,serif", background:BG, minHeight:"100vh", color:TEXT, display:"flex", flexDirection:"column", maxWidth:430, margin:"0 auto" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        input{outline:none;-webkit-appearance:none;appearance:none}
        .btn{cursor:pointer;border:none;transition:all .15s ease;background:transparent}
        .btn:active{transform:scale(.96)}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pop{from{opacity:0;transform:scale(.93)}to{opacity:1;transform:scale(1)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
        .fadeUp{animation:fadeUp .28s ease}
        .slide{animation:slideDown .18s ease}
        .pop{animation:pop .2s ease}
        .blink{animation:blink 1.5s infinite}
        ::placeholder{color:${DIM}}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:${BORDER};border-radius:2px}
        .box-btn:hover{border-color:${GOLD}!important;color:${GOLD}!important}
      `}</style>

      <div style={{ background:SURF, borderBottom:`1px solid ${BORDER}`, padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:50 }}>
        <PortierHeader onLongPress={()=>{ setShowAdminPin(true); setAdminPinInput(""); setAdminPinError(false); }} />
        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:5 }}>
          <div style={{ display:"flex", background:BG, borderRadius:8, padding:3, border:`1px solid ${BORDER}`, gap:2 }}>
            <button className="btn" onClick={()=>setSide("customer")} style={{ padding:"5px 12px", borderRadius:6, fontSize:11, fontFamily:"'IBM Plex Mono',monospace", background:side==="customer"?GOLD:"transparent", color:side==="customer"?BG:DIM, fontWeight:side==="customer"?600:400 }}>Guest</button>
            <button className="btn" onClick={()=>{ if(side!=="valet"){ setValetLoginScreen(true); setValetPinInput(""); setValetPinError(false); setSelectedEmployee(null); } setSide("valet"); }} style={{ padding:"5px 12px", borderRadius:6, fontSize:11, fontFamily:"'IBM Plex Mono',monospace", background:side==="valet"?GOLD:"transparent", color:side==="valet"?BG:DIM, fontWeight:side==="valet"?600:400 }}>{side==="valet"&&valetEmployee?valetEmployee.name.split(" ")[0]:"Valet"}</button>
          </div>
          {pendingCount>0&&side==="valet"&&<div className="blink" style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:AMBER, letterSpacing:1 }}>● {pendingCount} PENDING</div>}
        </div>
      </div>

      {notif && <div className="slide" style={{ position:"fixed", top:60, left:"50%", transform:"translateX(-50%)", padding:"9px 20px", borderRadius:8, fontSize:12, zIndex:200, fontFamily:"'IBM Plex Mono',monospace", whiteSpace:"nowrap", background:notif.type==="alert"?AMBER:GREEN, color:"#fff", boxShadow:"0 6px 24px rgba(0,0,0,.7)" }}>{notif.msg}</div>}

      {tipModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.92)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div className="pop" style={{ background:SURF, border:`1px solid ${BORDER}`, borderRadius:18, padding:28, width:"100%", maxWidth:320 }}>
            <div style={{ fontFamily:"Georgia,serif", fontSize:22, marginBottom:4 }}>Log a tip?</div>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:DIM, marginBottom:20 }}>{tipModal} · Box {valetLot[tipModal]?.box}</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:14 }}>
              {[5,10,15,20].map(a=><button key={a} className="btn" onClick={()=>setTipAmt(a)} style={{ padding:"12px 0", borderRadius:9, fontSize:15, fontWeight:700, background:tipAmt===a?GOLD:CARD, color:tipAmt===a?BG:TEXT, border:`1px solid ${tipAmt===a?GOLD:BORDER}` }}>${a}</button>)}
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn" onClick={()=>confirmRetrieve(tipModal,null)} style={{ flex:1, padding:11, borderRadius:9, fontSize:12, color:DIM, border:`1px solid ${BORDER}`, fontFamily:"'IBM Plex Mono',monospace" }}>No tip</button>
              <button className="btn" onClick={()=>confirmRetrieve(tipModal,tipAmt)} style={{ flex:2, padding:11, borderRadius:9, fontSize:13, background:GOLD, color:BG, fontWeight:700 }}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* VALET LOGIN */}
      {side==="valet" && valetLoginScreen && !valetEmployee && (
        <div className="fadeUp" style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:32 }}>
          <svg width="48" height="48" viewBox="0 0 42 42" fill="none" style={{ marginBottom:14 }}>
            <circle cx="21" cy="21" r="20" stroke={GOLD} strokeWidth="1.5" fill={GOLD2}/>
            <text x="21" y="27" textAnchor="middle" fill={GOLD} fontSize="13" fontFamily="Georgia,serif" fontWeight="bold">P</text>
          </svg>
          <div style={{ fontFamily:"Georgia,serif", fontSize:20, color:GOLD, marginBottom:4, letterSpacing:3 }}>VALET ACCESS</div>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:DIM, marginBottom:28, letterSpacing:1 }}>Select your name to continue</div>
          {valetEmployees.length === 0 ? (
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:DIM, textAlign:"center", marginBottom:24 }}>No valets added yet.<br/>Ask your admin to add employees.</div>
          ) : (
            <div style={{ width:"100%", maxWidth:320, display:"grid", gap:8, marginBottom:24 }}>
              {valetEmployees.map(e => (
                <button key={e.id} className="btn" onClick={() => { setSelectedEmployee(e); setValetPinInput(""); setValetPinError(false); }} style={{ background: selectedEmployee?.id===e.id ? GOLD2 : SURF, border:`1px solid ${selectedEmployee?.id===e.id ? GOLD : BORDER}`, borderRadius:12, padding:"14px 16px", display:"flex", alignItems:"center", gap:12, textAlign:"left" }}>
                  <div style={{ width:36, height:36, borderRadius:"50%", background:GOLD2, border:`1px solid ${GOLD}`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Georgia,serif", fontSize:16, color:GOLD, fontWeight:"bold", flexShrink:0 }}>{e.name.charAt(0)}</div>
                  <div>
                    <div style={{ fontFamily:"Georgia,serif", fontSize:15, color:TEXT }}>{e.name}</div>
                    {e.valet_companies?.name && <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:DIM, marginTop:2 }}>{e.valet_companies.name}</div>}
                  </div>
                </button>
              ))}
            </div>
          )}
          {selectedEmployee && (
            <>
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:DIM, marginBottom:16, letterSpacing:1 }}>Enter PIN for <span style={{ color:GOLD }}>{selectedEmployee.name}</span></div>
              <div style={{ display:"flex", gap:12, marginBottom:16 }}>
                {[0,1,2,3].map(i => <div key={i} style={{ width:16, height:16, borderRadius:"50%", background: i < valetPinInput.length ? GOLD : "transparent", border:`1.5px solid ${GOLD}`, opacity: i < valetPinInput.length ? 1 : 0.4 }}/>)}
              </div>
              {valetPinError && <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:RED, marginBottom:12, letterSpacing:1 }}>INCORRECT PIN</div>}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, width:200, marginBottom:16 }}>
                {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((k,i) => (
                  <button key={i} className="btn" onClick={() => {
                    if (k==="⌫") { setValetPinInput(p=>p.slice(0,-1)); setValetPinError(false); }
                    else if (k==="") return;
                    else {
                      const next = valetPinInput + k; setValetPinInput(next);
                      if (next.length === 4) {
                        if (next === selectedEmployee.pin) { setValetEmployee(selectedEmployee); setValetLoginScreen(false); setValetPinInput(""); setValetPinError(false); }
                        else { setValetPinError(true); setValetPinInput(""); }
                      }
                    }
                  }} style={{ height:52, borderRadius:10, fontSize:18, fontFamily:"Georgia,serif", background:k===""?"transparent":SURF, color:TEXT, border:k===""?"none":`1px solid ${BORDER}` }}>{k}</button>
                ))}
              </div>
            </>
          )}
          <button className="btn" onClick={()=>setSide("customer")} style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:DIM, marginTop:8 }}>Cancel</button>
        </div>
      )}

      {/* VALET DASHBOARD */}
      {side==="valet" && (valetEmployee || valetEmployees.length===0) && (
        <div className="fadeUp" style={{ flex:1, padding:16, overflow:"auto" }}>
          <div style={{ marginBottom:14 }}>
            {!valetVenue ? (
              <div style={{ background:SURF, border:`2px dashed ${BORDER}`, borderRadius:12, padding:20, textAlign:"center" }}>
                <div style={{ fontFamily:"Georgia,serif", fontSize:16, color:GOLD, marginBottom:6 }}>Select your venue</div>
                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:DIM, marginBottom:16 }}>Which property are you working tonight?</div>
                <div style={{ display:"grid", gap:8 }}>
                  {venues.map(v=>(
                    <button key={v.id} className="btn" onClick={()=>{ setValetVenue(v); flash(`${v.short} — shift started`); }} style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:10, padding:"12px 14px", display:"flex", alignItems:"center", gap:12, textAlign:"left" }}>
                      <svg width="32" height="32" viewBox="0 0 42 42" fill="none">
                        <circle cx="21" cy="21" r="20" stroke={v.color} strokeWidth="1.5" fill={`${v.color}18`}/>
                        <text x="21" y="27" textAnchor="middle" fill={v.color} fontSize={v.initials.length>1?"10":"14"} fontFamily="Georgia,serif" fontWeight="bold">{v.initials}</text>
                      </svg>
                      <div>
                        <div style={{ fontFamily:"Georgia,serif", fontSize:14, color:TEXT }}>{v.name}</div>
                        <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:DIM, marginTop:2 }}>{v.location}{v.hourly_rate>0?` · $${v.hourly_rate}/hr`:""}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:SURF, border:`1px solid ${valetVenue.color}40`, borderRadius:10, padding:"10px 14px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <svg width="28" height="28" viewBox="0 0 42 42" fill="none">
                    <circle cx="21" cy="21" r="20" stroke={valetVenue.color} strokeWidth="1.5" fill={`${valetVenue.color}18`}/>
                    <text x="21" y="27" textAnchor="middle" fill={valetVenue.color} fontSize={valetVenue.initials.length>1?"10":"14"} fontFamily="Georgia,serif" fontWeight="bold">{valetVenue.initials}</text>
                  </svg>
                  <div>
                    <div style={{ fontFamily:"Georgia,serif", fontSize:13, color:TEXT }}>{valetVenue.name}</div>
                    <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:DIM, marginTop:1 }}>{valetVenue.location}{valetVenue.hourly_rate>0?` · $${valetVenue.hourly_rate}/hr`:""}</div>
                  </div>
                </div>
                <button className="btn" onClick={()=>setValetVenue(null)} style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:DIM, padding:"4px 8px", border:`1px solid ${BORDER}`, borderRadius:6 }}>Change</button>
              </div>
            )}
          </div>

          {valetVenue && <>
            <div style={{ background:SURF, border:`1px solid ${BORDER}`, borderRadius:14, padding:16, marginBottom:14 }}>
              <div style={{ fontFamily:"Georgia,serif", fontSize:17, color:GOLD, marginBottom:14 }}>Park a Car</div>
              {vForm.plate && custUser && normPlate(vForm.plate)===normPlate(custUser.plate) && (
                <div className="slide" style={{ background:`${GREEN}15`, border:`1px solid ${GREEN}40`, borderRadius:8, padding:"8px 12px", marginBottom:10, display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:12 }}>✓</span>
                  <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:GREEN }}>Guest registered — <b>{custUser.first} {custUser.last}</b></div>
                </div>
              )}
              <div style={{ marginBottom:10 }}>
                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:DIM, letterSpacing:1.5, marginBottom:5 }}>LICENSE PLATE</div>
                <input placeholder="e.g. ABC1234" value={vForm.plate}
                  onChange={async e=>{
                    const val = e.target.value.toUpperCase();
                    setVForm(p=>({...p, plate:val})); setVError("");
                    const norm = normPlate(val);
                    if (norm.length >= 4) {
                      const { data } = await supabase.from("lots").select("make,color").eq("plate", norm).order("id", {ascending:false}).limit(1);
                      if (data && data[0]) setVForm(p=>({...p, plate:val, make:data[0].make||"", color:data[0].color||""}));
                    }
                  }}
                  style={{ background:BG, border:`1px solid ${vError?RED:BORDER}`, borderRadius:9, padding:"11px 14px", color:TEXT, fontSize:18, fontFamily:"'IBM Plex Mono',monospace", letterSpacing:3, width:"100%", textTransform:"uppercase" }}/>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
                {[["make","Make (e.g. Toyota)"],["color","Color (e.g. White)"]].map(([k,ph])=>(
                  <div key={k}>
                    <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:DIM, letterSpacing:1.5, marginBottom:5 }}>{k.toUpperCase()}</div>
                    <input placeholder={ph} value={vForm[k]} onChange={e=>setVForm(p=>({...p,[k]:e.target.value}))} style={{ background:BG, border:`1px solid ${BORDER}`, borderRadius:9, padding:"11px 12px", color:TEXT, fontSize:13, fontFamily:"'IBM Plex Mono',monospace", width:"100%" }}/>
                  </div>
                ))}
              </div>
              <div style={{ marginBottom:10 }}>
                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:DIM, letterSpacing:1.5, marginBottom:5 }}>PARKING LOCATION</div>
                <input placeholder="e.g. Front Row 2, Back lot B" value={vForm.location||""} onChange={e=>setVForm(p=>({...p,location:e.target.value}))} style={{ background:BG, border:`1px solid ${BORDER}`, borderRadius:9, padding:"11px 14px", color:TEXT, fontSize:13, fontFamily:"'IBM Plex Mono',monospace", width:"100%" }}/>
              </div>
              <div style={{ marginBottom:12 }}>
                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:DIM, letterSpacing:1.5, marginBottom:5 }}>KEY BOX</div>
                <div onClick={()=>setShowBoxPicker(!showBoxPicker)} style={{ background:BG, border:`1px solid ${vForm.box?GOLD:BORDER}`, borderRadius:9, padding:"11px 14px", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:vForm.box?20:14, color:vForm.box?GOLD:DIM }}>{vForm.box?`Box ${vForm.box}`:"Tap to assign"}</span>
                  <span style={{ fontSize:11, color:DIM }}>🔑</span>
                </div>
                {showBoxPicker && (
                  <div className="slide" style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:10, marginTop:6, overflow:"hidden" }}>
                    <div style={{ padding:"10px 12px", borderBottom:`1px solid ${BORDER}` }}>
                      <input autoFocus placeholder="Type box number…" value={boxSearch} onChange={e=>setBoxSearch(e.target.value)} style={{ background:BG, border:`1px solid ${BORDER}`, borderRadius:7, padding:"8px 12px", color:TEXT, fontSize:14, fontFamily:"'IBM Plex Mono',monospace", width:"100%", letterSpacing:1 }}/>
                    </div>
                    <div style={{ padding:"6px 12px", borderBottom:`1px solid ${BORDER}`, fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:DIM }}>{300-usedBoxes.length} OF 300 AVAILABLE</div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:5, padding:10, maxHeight:160, overflowY:"auto" }}>
                      {availableBoxes.slice(0,60).map(n=>(
                        <button key={n} className="btn box-btn" onClick={()=>{ setVForm(p=>({...p,box:n})); setShowBoxPicker(false); setBoxSearch(""); }} style={{ padding:"7px 10px", borderRadius:7, fontSize:12, fontFamily:"'IBM Plex Mono',monospace", fontWeight:500, background:BG, color:DIM, border:`1px solid ${BORDER}`, minWidth:44, textAlign:"center" }}>{n}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {vError && <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:RED, marginBottom:10 }}>{vError}</div>}
              <button className="btn" onClick={valetPark} style={{ width:"100%", padding:13, borderRadius:10, fontSize:14, fontWeight:700, fontFamily:"'IBM Plex Mono',monospace", background:vForm.plate&&vForm.make&&vForm.color&&vForm.box?GOLD:FAINT, color:vForm.plate&&vForm.make&&vForm.color&&vForm.box?BG:DIM }}>Park & Register</button>
            </div>

            {activeLot.length>0 && <>
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:DIM, letterSpacing:2, marginBottom:8 }}>LOT · {activeLot.length} ACTIVE</div>
              <div style={{ display:"grid", gap:8, marginBottom:14 }}>
                {[...activeLot].sort((a,b)=>({requested:0,enroute:1,ready:2,parked:3}[a.status]??9)-({requested:0,enroute:1,ready:2,parked:3}[b.status]??9)).map(car=>{
                  const sm=SMETA[car.status]; const hot=car.status===STATUS.REQUESTED;
                  return (
                    <div key={car.plate} style={{ background:CARD, borderRadius:12, padding:"13px 15px", border:`1px solid ${hot?AMBER+"55":BORDER}`, boxShadow:hot?`0 0 16px ${AMBER}18`:"none" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                        <div>
                          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:17, fontWeight:600, color:GOLD, letterSpacing:2 }}>{car.plate}</div>
                          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:DIM, marginTop:2 }}>
                            {car.color} {car.make}
                            {car.customerName?<span style={{ color:TEXT, marginLeft:6 }}>· {car.customerName}</span>:<span style={{ color:FAINT, marginLeft:6 }}>· Walk-in</span>}
                          </div>
                          {car.location&&<div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:GOLD, marginTop:2 }}>📍 {car.location}</div>}
                        </div>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontSize:11, color:sm.color, fontFamily:"'IBM Plex Mono',monospace" }}>{sm.label}</div>
                          <div style={{ fontSize:10, color:DIM, marginTop:1, fontFamily:"'IBM Plex Mono',monospace" }}>{car.time}</div>
                        </div>
                      </div>
                      <div style={{ background:hot?`${AMBER}15`:SURF, border:`1px solid ${hot?AMBER+"40":BORDER}`, borderRadius:8, padding:"8px 12px", marginBottom:10, display:"flex", alignItems:"center", gap:10 }}>
                        <span style={{ fontSize:16 }}>🔑</span>
                        <div>
                          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:DIM, letterSpacing:1.5 }}>KEY BOX</div>
                          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:20, fontWeight:700, color:hot?AMBER:GOLD, lineHeight:1 }}>{car.box}</div>
                        </div>
                        {hot&&<div style={{ marginLeft:"auto", fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:AMBER }}>← GRAB THIS KEY</div>}
                      </div>
                      <div style={{ display:"flex", gap:7 }}>
                        {car.status===STATUS.REQUESTED&&<button className="btn" onClick={()=>advance(car.plate)} style={{ flex:1, padding:9, borderRadius:8, fontSize:12, background:BLUE, color:"#fff", fontFamily:"'IBM Plex Mono',monospace" }}>On the Way</button>}
                        {car.status===STATUS.ENROUTE&&<button className="btn" onClick={()=>advance(car.plate)} style={{ flex:1, padding:9, borderRadius:8, fontSize:12, background:GREEN, color:"#fff", fontFamily:"'IBM Plex Mono',monospace" }}>Car Ready</button>}
                        {car.status===STATUS.READY&&<button className="btn" onClick={()=>{setTipModal(car.plate);setTipAmt(null);}} style={{ flex:1, padding:9, borderRadius:8, fontSize:12, background:GOLD, color:BG, fontWeight:700, fontFamily:"'IBM Plex Mono',monospace" }}>Retrieved</button>}
                        {car.status===STATUS.PARKED&&<div style={{ fontSize:11, color:DIM, fontFamily:"'IBM Plex Mono',monospace", padding:"8px 4px" }}>Waiting for guest…</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>}

            {activeLot.length===0&&doneLot.length===0&&<div style={{ textAlign:"center", padding:"40px 0", color:FAINT, fontFamily:"'IBM Plex Mono',monospace", fontSize:12 }}>Lot is empty</div>}

            {doneLot.length>0&&(
              <div style={{ background:SURF, border:`1px solid ${BORDER}`, borderRadius:12, padding:"14px 16px" }}>
                <div style={{ fontFamily:"Georgia,serif", fontSize:13, color:DIM, marginBottom:10 }}>Tonight's Shift · {valetVenue.short}</div>
                <div style={{ display:"flex", gap:24 }}>
                  {[["CARS",doneLot.length,TEXT],["TIPS",`$${totalTips}`,GREEN],["AVG",doneLot.filter(c=>c.tip).length?`$${Math.round(totalTips/doneLot.filter(c=>c.tip).length)}`:"—",GOLD]].map(([l,v,c])=>(
                    <div key={l}>
                      <div style={{ fontFamily:"Georgia,serif", fontSize:20, color:c }}>{v}</div>
                      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:DIM, letterSpacing:1.5, marginTop:2 }}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>}
        </div>
      )}

      {side==="customer" && !custUser && <CustomerRegister onRegister={setCustUser} />}
      {side==="customer" && custUser && (
        <CustomerHome user={custUser} custCar={custCar} screen={custScreen} setScreen={setCustScreen} tipPick={tipPick} setTipPick={setTipPick} stars={stars} setStars={setStars} hover={hover} setHover={setHover} onRequest={custRequest}/>
      )}
    </div>
  );
}

function CustomerRegister({ onRegister }) {
  const [reg, setReg] = useState(() => {
    try { const s = localStorage.getItem("portier_guest"); return s ? JSON.parse(s) : { first:"", last:"", plate:"" }; } catch { return { first:"", last:"", plate:"" }; }
  });
  const ready = reg.first && reg.last && reg.plate;
  function handleRegister(r) { try { localStorage.setItem("portier_guest", JSON.stringify(r)); } catch {} onRegister(r); }
  return (
    <div className="fadeUp" style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:28 }}>
      <div style={{ width:"100%", maxWidth:340 }}>
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <svg width="72" height="72" viewBox="0 0 42 42" fill="none" style={{ display:"block", margin:"0 auto 16px" }}>
            <circle cx="21" cy="21" r="20" stroke={GOLD} strokeWidth="1.5" fill={GOLD2}/>
            <text x="21" y="27" textAnchor="middle" fill={GOLD} fontSize="13" fontFamily="Georgia,serif" fontWeight="bold">P</text>
          </svg>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:12, marginBottom:4 }}>
            <div style={{ height:1, width:28, background:GOLD, opacity:.4 }}/><div style={{ width:4, height:4, background:GOLD, borderRadius:"50%", opacity:.6 }}/><div style={{ height:1, width:28, background:GOLD, opacity:.4 }}/>
          </div>
          <div style={{ fontFamily:"Georgia,serif", fontSize:32, fontWeight:"bold", letterSpacing:8, color:GOLD }}>PORTIER</div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:12, marginTop:4 }}>
            <div style={{ height:1, width:28, background:GOLD, opacity:.4 }}/><div style={{ width:4, height:4, background:GOLD, transform:"rotate(45deg)", opacity:.6 }}/><div style={{ height:1, width:28, background:GOLD, opacity:.4 }}/>
          </div>
        </div>
        <div style={{ display:"grid", gap:10, marginBottom:16 }}>
          {[["first","First Name"],["last","Last Name"]].map(([k,ph])=>(
            <input key={k} placeholder={ph} value={reg[k]} onChange={e=>setReg(p=>({...p,[k]:e.target.value}))} style={{ background:SURF, border:`1px solid ${BORDER}`, borderRadius:10, padding:"13px 16px", color:TEXT, fontSize:15, fontFamily:"Georgia,serif", width:"100%", outline:"none" }}/>
          ))}
          <div>
            <input placeholder="Plate Number  (e.g. ABC1234)" value={reg.plate} onChange={e=>setReg(p=>({...p,plate:e.target.value.toUpperCase()}))} style={{ background:SURF, border:`1px solid ${BORDER}`, borderRadius:10, padding:"13px 16px", color:TEXT, fontSize:15, fontFamily:"'IBM Plex Mono',monospace", letterSpacing:2, width:"100%", textTransform:"uppercase", outline:"none" }}/>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:DIM, marginTop:5, paddingLeft:2 }}>Your plate links your car — no ticket needed</div>
          </div>
        </div>
        <button className="btn" onClick={()=>{ if(ready) handleRegister(reg); }} style={{ width:"100%", padding:14, borderRadius:10, fontSize:15, fontFamily:"Georgia,serif", background:ready?GOLD:FAINT, color:ready?BG:DIM, fontWeight:600 }}>Enter Experience</button>
      </div>
    </div>
  );
}

function ParkingClock({ parkedAt, hourlyRate }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!parkedAt || !hourlyRate) return;
    const start = new Date(parkedAt).getTime();
    const tick = () => setElapsed(Date.now() - start);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [parkedAt, hourlyRate]);

  if (!parkedAt || !hourlyRate) return null;
  const cost = Math.max(hourlyRate, (elapsed / 3600000) * hourlyRate).toFixed(2);

  return (
    <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:12, padding:"18px 20px", marginBottom:14, textAlign:"center" }}>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:DIM, letterSpacing:2, marginBottom:10 }}>PARKING TIME</div>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:28, fontWeight:600, color:GOLD, letterSpacing:2, marginBottom:4 }}>{formatElapsed(elapsed)}</div>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:DIM, marginBottom:8 }}>RUNNING TOTAL</div>
      <div style={{ fontFamily:"Georgia,serif", fontSize:40, color:GREEN }}>${cost}</div>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:DIM, marginTop:6 }}>${hourlyRate}/hr</div>
    </div>
  );
}

function CustomerHome({ user, custCar, screen, setScreen, tipPick, setTipPick, stars, setStars, hover, setHover, onRequest }) {
  const car    = custCar?.car;
  const venue  = custCar?.venue;
  const sm     = car ? SMETA[car.status] : null;
  const isReady= car?.status === STATUS.READY;

  if (screen==="tip") return (
    <div className="fadeUp" style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:28 }}>
      <div style={{ width:"100%", maxWidth:320, textAlign:"center" }}>
        <div style={{ fontSize:44, marginBottom:12 }}>🙌</div>
        <div style={{ fontFamily:"Georgia,serif", fontSize:24, marginBottom:6 }}>Your car is here!</div>
        <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:DIM, marginBottom:28 }}>Tip your valet?</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:8 }}>
          {[5,10,15,20].map(a=><button key={a} className="btn" onClick={()=>setTipPick(tipPick===a?null:a)} style={{ padding:"14px 0", borderRadius:10, fontSize:16, fontWeight:700, background:tipPick===a?GOLD:SURF, color:tipPick===a?BG:TEXT, border:`1px solid ${tipPick===a?GOLD:BORDER}` }}>${a}</button>)}
        </div>
        <button className="btn" onClick={()=>setScreen("rate")} style={{ width:"100%", padding:14, borderRadius:10, fontSize:15, fontFamily:"Georgia,serif", background:tipPick?GOLD:SURF, color:tipPick?BG:TEXT, fontWeight:600, border:`1px solid ${tipPick?GOLD:BORDER}`, marginBottom:8 }}>{tipPick?`Tip $${tipPick}`:"Select an amount"}</button>
        <button className="btn" onClick={()=>setScreen("rate")} style={{ width:"100%", padding:10, borderRadius:10, fontSize:12, color:DIM, fontFamily:"'IBM Plex Mono',monospace" }}>Skip</button>
      </div>
    </div>
  );

  if (screen==="rate") return (
    <div className="fadeUp" style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:28 }}>
      <div style={{ width:"100%", maxWidth:320, textAlign:"center" }}>
        <div style={{ fontFamily:"Georgia,serif", fontSize:22, marginBottom:6 }}>How was your experience?</div>
        {venue&&<div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:DIM, marginBottom:28 }}>{venue.name}</div>}
        <div style={{ display:"flex", justifyContent:"center", gap:10, marginBottom:32 }}>
          {[1,2,3,4,5].map(s=><div key={s} onMouseEnter={()=>setHover(s)} onMouseLeave={()=>setHover(0)} onClick={()=>setStars(s)} style={{ fontSize:38, cursor:"pointer", transition:"transform .12s", transform:s<=(hover||stars)?"scale(1.25)":"scale(1)", filter:s<=(hover||stars)?"grayscale(0)":"grayscale(1) brightness(.4)" }}>⭐</div>)}
        </div>
        <button className="btn" onClick={()=>setScreen("home")} style={{ width:"100%", padding:14, borderRadius:10, fontSize:15, fontFamily:"Georgia,serif", background:stars?GOLD:SURF, color:stars?BG:TEXT, fontWeight:600, border:`1px solid ${stars?GOLD:BORDER}`, marginBottom:8 }}>{stars?"Submit":"Select a rating"}</button>
        <button className="btn" onClick={()=>setScreen("home")} style={{ width:"100%", padding:10, borderRadius:10, fontSize:12, color:DIM, fontFamily:"'IBM Plex Mono',monospace" }}>Skip</button>
      </div>
    </div>
  );

  if (isReady) return (
    <div className="fadeUp" style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:28, textAlign:"center" }}>
      <div style={{ width:"100%", maxWidth:340 }}>
        {venue && <>
          <svg width="56" height="56" viewBox="0 0 42 42" fill="none" style={{ display:"block", margin:"0 auto 12px" }}>
            <circle cx="21" cy="21" r="20" stroke={venue.color} strokeWidth="1.5" fill={`${venue.color}18`}/>
            <text x="21" y="27" textAnchor="middle" fill={venue.color} fontSize={venue.initials?.length>1?"10":"14"} fontFamily="Georgia,serif" fontWeight="bold">{venue.initials}</text>
          </svg>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, marginBottom:16 }}>
            <div style={{ height:1, width:28, background:venue.color, opacity:.4 }}/><div style={{ width:4, height:4, background:venue.color, borderRadius:"50%", opacity:.6 }}/><div style={{ height:1, width:28, background:venue.color, opacity:.4 }}/>
          </div>
        </>}
        <div style={{ fontFamily:"Georgia,serif", fontSize:13, color:DIM, fontStyle:"italic", marginBottom:10 }}>Thank you for visiting</div>
        {venue&&<div style={{ fontFamily:"Georgia,serif", fontSize:28, color:TEXT, marginBottom:32 }}>{venue.name}</div>}
        <div style={{ background:SURF, border:`1px solid ${GREEN}30`, borderRadius:14, padding:"20px", marginBottom:24 }}>
          <div style={{ width:10, height:10, borderRadius:"50%", background:GREEN, margin:"0 auto 12px", boxShadow:`0 0 12px ${GREEN}60` }}/>
          <div style={{ fontFamily:"Georgia,serif", fontSize:18, color:GREEN, marginBottom:6 }}>Your car is outside</div>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:DIM }}>Drive safe — see you next time</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
          <div style={{ height:1, width:24, background:GOLD, opacity:.3 }}/><div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:DIM, letterSpacing:2 }}>PORTIER</div><div style={{ height:1, width:24, background:GOLD, opacity:.3 }}/>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fadeUp" style={{ flex:1, overflow:"auto", display:"flex", flexDirection:"column" }}>
      {car && car.status!==STATUS.DONE && car.status!==STATUS.READY ? (
        <div style={{ padding:16 }}>
          {venue && (
            <div style={{ textAlign:"center", padding:"28px 0 20px" }}>
              <svg width="72" height="72" viewBox="0 0 42 42" fill="none" style={{ display:"block", margin:"0 auto 12px" }}>
                <circle cx="21" cy="21" r="20" stroke={venue.color} strokeWidth="1.5" fill={`${venue.color}18`}/>
                <text x="21" y="27" textAnchor="middle" fill={venue.color} fontSize={venue.initials?.length>1?"10":"15"} fontFamily="Georgia,serif" fontWeight="bold">{venue.initials}</text>
              </svg>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, marginBottom:6 }}>
                <div style={{ height:1, width:28, background:venue.color, opacity:.4 }}/><div style={{ width:4, height:4, background:venue.color, borderRadius:"50%", opacity:.6 }}/><div style={{ height:1, width:28, background:venue.color, opacity:.4 }}/>
              </div>
              <div style={{ fontFamily:"Georgia,serif", fontSize:22, color:TEXT, letterSpacing:1 }}>{venue.name}</div>
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:DIM, marginTop:4 }}>{venue.location}</div>
            </div>
          )}

          <div style={{ marginBottom:16 }}>
            <div style={{ fontFamily:"Georgia,serif", fontSize:21 }}>Good evening, <span style={{ color:GOLD }}>{user.first}</span></div>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:4 }}>
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:DIM }}>Plate: <span style={{ color:GOLD, letterSpacing:2 }}>{user.plate.toUpperCase()}</span></div>
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, background:`${GREEN}20`, color:GREEN, border:`1px solid ${GREEN}40`, borderRadius:6, padding:"2px 7px" }}>✓ LINKED</div>
            </div>
          </div>

          <div style={{ background:SURF, border:`1px solid ${car.status===STATUS.REQUESTED?AMBER+"55":BORDER}`, borderRadius:16, overflow:"hidden", marginBottom:18 }}>
            <div style={{ background:venue?.color||GOLD, padding:"12px 18px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:"#fff", letterSpacing:2, opacity:.8 }}>YOUR CAR</div>
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:20, fontWeight:700, color:"#fff", letterSpacing:3 }}>{car.plate}</div>
            </div>
            <div style={{ padding:"16px 18px" }}>
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:DIM, marginBottom:14 }}>{car.color} {car.make} · Arrived {car.time}</div>
              <div style={{ display:"flex", alignItems:"center", gap:12, background:CARD, borderRadius:10, padding:"14px 16px", marginBottom:14 }}>
                <div style={{ width:10, height:10, borderRadius:"50%", background:sm.color, flexShrink:0, boxShadow:`0 0 8px ${sm.color}60` }}/>
                <div>
                  <div style={{ fontFamily:"Georgia,serif", fontSize:16, color:sm.color }}>{sm.label}</div>
                  <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:DIM, marginTop:2 }}>
                    {car.status===STATUS.PARKED && "Your car is safely parked"}
                    {car.status===STATUS.REQUESTED && "Valet notified — heading to your car"}
                    {car.status===STATUS.ENROUTE && (car.valetName ? `${car.valetName.split(" ")[0]} is bringing your car out` : "Your car is on its way out")}
                  </div>
                </div>
              </div>
              {car.status===STATUS.PARKED ? (
                <button className="btn" onClick={onRequest} style={{ width:"100%", padding:15, borderRadius:11, fontSize:16, fontFamily:"Georgia,serif", background:GOLD, color:BG, fontWeight:600, boxShadow:`0 4px 20px ${GOLD}30` }}>
                  I'm heading out — bring my car
                </button>
              ) : (
                <div style={{ textAlign:"center", fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:DIM, padding:"8px 0" }}>Request sent ✓</div>
              )}
            </div>
          </div>

          {/* LIVE PARKING CLOCK — bottom, garages and hotels only */}
          {car.hourlyRate > 0 && car.status === STATUS.PARKED && (
            <ParkingClock parkedAt={car.parkedAt} hourlyRate={car.hourlyRate} />
          )}
        </div>
      ) : !car ? (
        /* CLEAN HOME SCREEN */
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:28, textAlign:"center" }}>
          <svg width="72" height="72" viewBox="0 0 42 42" fill="none" style={{ marginBottom:24 }}>
            <circle cx="21" cy="21" r="20" stroke={GOLD} strokeWidth="1.5" fill={GOLD2}/>
            <text x="21" y="27" textAnchor="middle" fill={GOLD} fontSize="13" fontFamily="Georgia,serif" fontWeight="bold">P</text>
          </svg>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
            <div style={{ height:1, width:28, background:GOLD, opacity:.4 }}/><div style={{ width:4, height:4, background:GOLD, borderRadius:"50%", opacity:.6 }}/><div style={{ height:1, width:28, background:GOLD, opacity:.4 }}/>
          </div>
          <div style={{ fontFamily:"Georgia,serif", fontSize:28, fontWeight:"bold", letterSpacing:8, color:GOLD, marginBottom:48 }}>PORTIER</div>
          <div style={{ fontFamily:"Georgia,serif", fontSize:22, color:TEXT, marginBottom:16 }}>Good evening, <span style={{ color:GOLD }}>{user.first}</span></div>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:13, color:DIM, letterSpacing:2 }}>Vehicle: <span style={{ color:GOLD }}>{user.plate.toUpperCase()}</span></div>
        </div>
      ) : null}
    </div>
  );
}
