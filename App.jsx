import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPA_URL = "https://yvxsmrsmurkxierjjhfp.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2eHNtcnNtdXJreGllcmpqaGZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NjM3ODcsImV4cCI6MjA5MTIzOTc4N30.gzFkyo-neUh2UMwpikdDVWt0lktq_MkJ_JuRy_Swv4c";
const db = createClient(SUPA_URL, SUPA_KEY);

// ── Status ─────────────────────────────────────────────────────────────────
const S = { PARKED:"parked", REQUESTED:"requested", ENROUTE:"enroute", READY:"ready", DONE:"done" };
const ADMIN_PIN = "9999";
const BOXES = Array.from({length:300},(_,i)=>i+1);

// ── Venue type helpers (derived from existing columns) ──────────────────────
// venue_type is stored in DB. Existing venues migrated via SQL.
// restaurant: venue_type='restaurant' (was hourly_rate=0)
// garage:     venue_type='garage'     rate_type='hourly'|'daily'|'monthly'
// hotel:      venue_type='hotel'
// airport:    venue_type='airport'    (was is_airport=true)
const VT = { RESTAURANT:"restaurant", GARAGE:"garage", HOTEL:"hotel", AIRPORT:"airport" };
const RT = { HOURLY:"hourly", DAILY:"daily", MONTHLY:"monthly" };

const venueIcon  = t=>({restaurant:"🍽️",garage:"🅿️",hotel:"🏨",airport:"✈️"}[t]||"🅿️");
const venueColor = t=>({restaurant:"#4caf50",garage:"#4a9eff",hotel:"#9c6cff",airport:"#ffa64c"}[t]||"#888");

// ── Utilities ──────────────────────────────────────────────────────────────
const norm   = p => (p||"").replace(/[^A-Z0-9]/gi,"").toUpperCase();
const $amt   = n => `$${Number(n||0).toFixed(2)}`;
const fmtDur = s => {
  s = Math.max(0, Math.floor(s));
  const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;
  return h ? `${h}h ${m}m` : `${m}m ${sec}s`;
};
const elapsedSecs = at => at ? Math.max(0,(Date.now()-new Date(at))/1000) : 0;
const calcBill = (venue, parkedAt) => {
  if (!parkedAt||!venue) return 0;
  const vt=venue.venue_type, rt=venue.rate_type;
  const hours = elapsedSecs(parkedAt)/3600;
  if (vt===VT.RESTAURANT) return 0;
  if (vt===VT.GARAGE) {
    if (rt===RT.HOURLY)   return Math.max(1,Math.ceil(hours))*(venue.hourly_rate||5);
    if (rt===RT.DAILY)    return venue.daily_rate||30;
    if (rt===RT.MONTHLY)  return venue.monthly_rate||200;
  }
  if (vt===VT.HOTEL)    return Math.max(1,Math.ceil(hours/24))*(venue.daily_rate||50);
  if (vt===VT.AIRPORT)  return Math.max(1,Math.ceil(hours/24))*(venue.daily_rate||25);
  return 0;
};

// ── Styles ─────────────────────────────────────────────────────────────────
const STYLES = `
*{box-sizing:border-box;margin:0;padding:0;}
html,body{background:#080808;color:#f0ede8;font-family:'SF Pro Display',-apple-system,BlinkMacSystemFont,sans-serif;-webkit-font-smoothing:antialiased;}
.app{max-width:430px;margin:0 auto;min-height:100vh;padding-bottom:48px;}
.pad{padding:24px 20px;}
.card{background:#111;border:1px solid #1e1e1e;border-radius:16px;padding:20px;margin-bottom:12px;}
.card-hi{background:#111;border:1px solid #c9a84c33;border-radius:16px;padding:20px;margin-bottom:12px;}
.gold{color:#c9a84c;}
.dim{color:#555;font-size:13px;}
.btn{display:block;width:100%;padding:16px;border-radius:12px;border:none;cursor:pointer;font-size:16px;font-weight:600;letter-spacing:.3px;transition:opacity .15s;-webkit-tap-highlight-color:transparent;}
.btn:active{opacity:.75;}
.btn-gold{background:linear-gradient(135deg,#c9a84c,#dbb85e);color:#000;}
.btn-dark{background:#1a1a1a;color:#f0ede8;border:1px solid #252525;}
.btn-red{background:#6a0000;color:#fff;}
.btn-sm{padding:9px 14px;font-size:13px;border-radius:9px;width:auto;display:inline-block;}
.inp{width:100%;background:#141414;border:1px solid #252525;border-radius:10px;padding:14px;color:#f0ede8;font-size:16px;outline:none;-webkit-appearance:none;}
.inp:focus{border-color:#c9a84c55;}
.inp::placeholder{color:#383838;}
.sel{width:100%;background:#141414;border:1px solid #252525;border-radius:10px;padding:14px;color:#f0ede8;font-size:15px;outline:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23555' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;}
.sel option{background:#141414;}
.lbl{font-size:11px;color:#555;margin-bottom:6px;letter-spacing:.8px;text-transform:uppercase;font-weight:500;}
.fld{margin-bottom:14px;}
.row2{display:flex;gap:8px;}
.row2>.fld{flex:1;}
.sep{border:none;border-top:1px solid #1c1c1c;margin:16px 0;}
.tabs{display:flex;gap:2px;background:#111;border:1px solid #1e1e1e;border-radius:12px;padding:3px;margin-bottom:20px;}
.tab{flex:1;padding:9px 4px;text-align:center;border-radius:9px;font-size:13px;cursor:pointer;font-weight:500;color:#444;transition:.15s;}
.tab.on{background:#c9a84c;color:#000;font-weight:700;}
.badge{display:inline-flex;align-items:center;gap:3px;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:.4px;}
.plate{font-family:'SF Mono',monospace;font-size:16px;font-weight:700;color:#c9a84c;letter-spacing:3px;}
.car{background:#141414;border:1px solid #1e1e1e;border-radius:12px;padding:14px;margin-bottom:8px;}
.car.urg{border-color:#c9a84c44;background:#130f00;}
.clock{font-size:42px;font-weight:100;letter-spacing:2px;color:#c9a84c;font-variant-numeric:tabular-nums;text-align:center;}
.clock-lbl{font-size:11px;color:#444;letter-spacing:1px;text-align:center;margin-bottom:6px;}
.flash-wrap{position:fixed;bottom:32px;left:50%;transform:translateX(-50%);z-index:9999;pointer-events:none;}
.flash{background:#c9a84c;color:#000;padding:12px 24px;border-radius:30px;font-weight:700;font-size:14px;white-space:nowrap;box-shadow:0 4px 24px rgba(201,168,76,.35);}
.flash.err{background:#7a0000;color:#fff;}
h1{font-size:26px;font-weight:200;letter-spacing:.5px;line-height:1.2;}
.section-hd{font-size:11px;color:#444;letter-spacing:1px;font-weight:700;margin-bottom:10px;}
.toggle-row{display:flex;justify-content:space-between;align-items:center;padding:14px 0;}
.toggle{position:relative;width:48px;height:28px;cursor:pointer;}
.toggle input{opacity:0;width:0;height:0;}
.toggle-track{position:absolute;inset:0;background:#222;border-radius:14px;transition:.25s;}
.toggle input:checked+.toggle-track{background:#c9a84c;}
.toggle-thumb{position:absolute;top:3px;left:3px;width:22px;height:22px;background:#fff;border-radius:50%;transition:.25s;box-shadow:0 1px 4px rgba(0,0,0,.4);}
.toggle input:checked~.toggle-thumb{left:23px;}
`;

export default function App() {
  // ── Core state ─────────────────────────────────────────────────────────
  const [mode, setMode]     = useState("select");    // select|guest|valet|admin
  const [vView, setVView]   = useState("login");     // login|venue|home
  const [adminTab, setAdminTab] = useState("venues");
  const [tick, setTick]     = useState(0);
  const [flashState, setFlashState] = useState(null);

  // DB data
  const [venues, setVenues]       = useState([]);
  const [companies, setCompanies] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [lots, setLots]           = useState({});    // {venue_id:{plate:car}}

  // Valet
  const [valetPin, setValetPin]     = useState("");
  const [valetUser, setValetUser]   = useState(null);
  const [valetVenue, setValetVenue] = useState(null);
  const [vForm, setVForm]           = useState({plate:"",make:"",color:"",location:"",box:""});
  const [vErr, setVErr]             = useState("");
  const [boxQ, setBoxQ]             = useState("");
  const [showBoxes, setShowBoxes]   = useState(false);
  const [tipModal, setTipModal]     = useState(null);

  // Guest
  const [custUser, setCustUser] = useState(null);
  const [gReg, setGReg]         = useState({first:"",last:"",plate:""});
  const [returnFlight, setReturnFlight] = useState("");

  // Admin forms
  const [vf, setVf] = useState({
    name:"",short_name:"",initials:"",location:"",
    venue_type:"restaurant",rate_type:"hourly",
    hourly_rate:"5",daily_rate:"30",monthly_rate:"200",
    airport_code:"",color:"#c9a84c"
  });
  const [coForm, setCoForm]   = useState({name:""});
  const [empForm, setEmpForm] = useState({name:"",pin:"",company_id:"",venue_id:""});
  const [adminPin, setAdminPin] = useState("");
  const [adminAuth, setAdminAuth] = useState(false);

  const flashRef = useRef(null);

  // ── Flash ───────────────────────────────────────────────────────────────
  const flash = useCallback((msg, type="ok")=>{
    setFlashState({msg,type});
    clearTimeout(flashRef.current);
    flashRef.current = setTimeout(()=>setFlashState(null), 3000);
  },[]);

  // ── Ticker (live clocks) ────────────────────────────────────────────────
  useEffect(()=>{
    const t = setInterval(()=>setTick(x=>x+1), 1000);
    return ()=>clearInterval(t);
  },[]);

  // ── Supabase realtime ───────────────────────────────────────────────────
  useEffect(()=>{
    loadAll();
    const ch = db.channel("portier-rt")
      .on("postgres_changes",{event:"*",schema:"public",table:"venues"},loadVenues)
      .on("postgres_changes",{event:"*",schema:"public",table:"companies"},loadCompanies)
      .on("postgres_changes",{event:"*",schema:"public",table:"employees"},loadEmployees)
      .on("postgres_changes",{event:"*",schema:"public",table:"lots"},loadLots)
      .subscribe();
    return ()=>db.removeChannel(ch);
  },[]);

  const loadAll       = ()=>{ loadVenues();loadCompanies();loadEmployees();loadLots(); };
  const loadVenues    = async()=>{ const{data}=await db.from("venues").select("*").order("name"); if(data)setVenues(data); };
  const loadCompanies = async()=>{ const{data}=await db.from("companies").select("*").order("name"); if(data)setCompanies(data); };
  const loadEmployees = async()=>{ const{data}=await db.from("employees").select("*"); if(data)setEmployees(data); };
  const loadLots      = async()=>{
    const{data}=await db.from("lots").select("*").neq("status","done");
    if(!data)return;
    const m={};
    data.forEach(r=>{ if(!m[r.venue_id])m[r.venue_id]={}; m[r.venue_id][r.plate]=r; });
    setLots(m);
  };

  // ── Derived ─────────────────────────────────────────────────────────────
  const valetLot  = valetVenue?(lots[valetVenue.id]||{}):{}
  const usedBoxes = new Set(Object.values(valetLot).filter(c=>c.status!==S.DONE).map(c=>c.box));
  const custPlate = custUser?norm(custUser.plate):null;

  const custCar = custPlate?(()=>{
    for(const vid of Object.keys(lots)){
      const car=lots[vid][custPlate];
      if(car&&car.status!==S.DONE){
        const venue=venues.find(v=>String(v.id)===String(vid)||String(v.id)===String(car.venue_id));
        return{...car,venue};
      }
    }
    return null;
  })():null;

  // ── Valet: park ─────────────────────────────────────────────────────────
  const parkCar = async()=>{
    if(!vForm.plate||!vForm.box){setVErr("Plate and box required");return;}
    const plate=norm(vForm.plate);
    // Check not already parked
    for(const v of Object.values(lots)){
      if(v[plate]&&v[plate].status!==S.DONE){setVErr("Already parked");return;}
    }
    // Look up guest
    const{data:g}=await db.from("guests").select("*").eq("plate",plate).maybeSingle().catch(()=>({data:null}));
    const rec={
      venue_id:String(valetVenue.id), plate,
      make:vForm.make||"", color:vForm.color||"",
      location:vForm.location||"", box:Number(vForm.box),
      status:S.PARKED,
      time:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),
      date:new Date().toLocaleDateString(),
      customer_name:g?`${g.first} ${g.last}`:null,
      valet_name:valetUser?.name||"",
      parked_at:new Date().toISOString(),
    };
    const{error}=await db.from("lots").upsert(rec,{onConflict:"venue_id,plate"});
    if(error){setVErr("DB: "+error.message);return;}
    setVForm({plate:"",make:"",color:"",location:"",box:""});
    setVErr(""); setBoxQ(""); setShowBoxes(false);
    flash(`Parked · Box ${rec.box}${g?" · "+g.first:""}`);
  };

  // ── Valet: plate change auto-fill ────────────────────────────────────────
  const onPlateChange = async(val)=>{
    const p=val.toUpperCase();
    setVForm(f=>({...f,plate:p}));
    if(norm(p).length>=3){
      const{data}=await db.from("lots").select("make,color").eq("plate",norm(p)).order("created_at",{ascending:false}).limit(1).catch(()=>({data:null}));
      if(data?.[0]) setVForm(f=>({...f,plate:p,make:f.make||data[0].make||"",color:f.color||data[0].color||""}));
    }
  };

  // ── Valet: advance status ────────────────────────────────────────────────
  const advance = async(plate)=>{
    const car=valetLot[plate]; if(!car)return;
    const next={[S.REQUESTED]:S.ENROUTE,[S.ENROUTE]:S.READY}[car.status];
    if(!next)return;
    const upd={status:next};
    if(next===S.ENROUTE) upd.valet_name=valetUser?.name||"";
    await db.from("lots").update(upd).eq("venue_id",String(valetVenue.id)).eq("plate",plate);
  };

  // ── Valet: complete / tip ────────────────────────────────────────────────
  const confirmRetrieve = async(plate,tip)=>{
    const car=valetLot[plate]; if(!car)return;
    const bill=calcBill(valetVenue,car.parked_at);
    await db.from("lots").update({status:S.DONE,tip,billing_amount:bill}).eq("venue_id",String(valetVenue.id)).eq("plate",plate);
    setTipModal(null);
    flash(`${plate} retrieved${tip?` · $${tip} tip`:""}`);
  };

  // ── Guest: request car ───────────────────────────────────────────────────
  const requestCar = async()=>{
    if(!custUser||!custCar)return;
    await db.from("lots")
      .update({status:S.REQUESTED,customer_name:`${custUser.first} ${custUser.last}`})
      .eq("venue_id",String(custCar.venue_id)).eq("plate",custPlate);
    flash("🔔 Request sent!");
  };

  // ── Guest: save return flight ────────────────────────────────────────────
  const saveReturnFlight = async()=>{
    if(!custCar||!returnFlight)return;
    await db.from("lots").update({return_flight:returnFlight}).eq("venue_id",String(custCar.venue_id)).eq("plate",custPlate);
    flash("✈️ Flight saved");
  };

  // ── Guest: register ──────────────────────────────────────────────────────
  const registerGuest = async()=>{
    if(!gReg.first||!gReg.last||!gReg.plate){flash("Fill all fields","err");return;}
    const plate=norm(gReg.plate);
    const{error}=await db.from("guests").upsert({first:gReg.first.trim(),last:gReg.last.trim(),plate},{onConflict:"plate"}).catch(e=>({error:e}));
    if(error){flash("Error: "+error.message,"err");return;}
    const u={first:gReg.first.trim(),last:gReg.last.trim(),plate};
    setCustUser(u);
    try{localStorage.setItem("portier_guest",JSON.stringify(u));}catch{}
  };

  useEffect(()=>{
    try{const s=localStorage.getItem("portier_guest"); if(s)setCustUser(JSON.parse(s));}catch{}
  },[]);

  // ── Admin: venue CRUD ────────────────────────────────────────────────────
  const addVenue = async()=>{
    if(!vf.name){flash("Name required","err");return;}
    const rec={
      name:vf.name, short_name:vf.short_name, initials:vf.initials,
      location:vf.location, color:vf.color,
      venue_type:vf.venue_type,
      rate_type:vf.venue_type==="garage"?vf.rate_type:null,
      hourly_rate:vf.venue_type==="garage"&&vf.rate_type==="hourly"?Number(vf.hourly_rate):null,
      daily_rate:(vf.venue_type==="hotel"||vf.venue_type==="airport"||(vf.venue_type==="garage"&&vf.rate_type==="daily"))?Number(vf.daily_rate):null,
      monthly_rate:vf.venue_type==="garage"&&vf.rate_type==="monthly"?Number(vf.monthly_rate):null,
      airport_code:vf.venue_type==="airport"?vf.airport_code.toUpperCase():null,
      // legacy compatibility
      is_airport:vf.venue_type==="airport",
    };
    const{error}=await db.from("venues").insert(rec);
    if(error){flash("Error: "+error.message,"err");return;}
    setVf({name:"",short_name:"",initials:"",location:"",venue_type:"restaurant",rate_type:"hourly",hourly_rate:"5",daily_rate:"30",monthly_rate:"200",airport_code:"",color:"#c9a84c"});
    flash("Venue added ✓");
  };

  const delVenue = async(id)=>{ await db.from("venues").delete().eq("id",id); flash("Deleted"); };

  const addCompany = async()=>{
    if(!coForm.name)return;
    await db.from("companies").insert({name:coForm.name});
    setCoForm({name:""}); flash("Company added");
  };

  const addEmployee = async()=>{
    if(!empForm.name||!empForm.pin||!empForm.company_id){flash("Fill all fields","err");return;}
    await db.from("employees").insert({name:empForm.name,pin:empForm.pin,company_id:empForm.company_id,venue_id:empForm.venue_id||null});
    setEmpForm({name:"",pin:"",company_id:"",venue_id:""}); flash("Employee added");
  };

  const delEmployee = async(id)=>{ await db.from("employees").delete().eq("id",id); flash("Deleted"); };

  // ── UI Components ────────────────────────────────────────────────────────
  const FlashMsg = ()=>flashState&&(
    <div className="flash-wrap">
      <div className={`flash${flashState.type==="err"?" err":""}`}>{flashState.msg}</div>
    </div>
  );

  const StatusBadge = ({s:st})=>{
    const map={parked:["#1a3a20","#4caf50","PARKED"],requested:["#3a2c00","#ffc107","REQUESTED"],enroute:["#0d2035","#4a9eff","EN ROUTE"],ready:["#2d1800","#ff8c00","READY"]};
    const[bg,fg,lbl]=map[st]||["#1e1e1e","#555","–"];
    return <span className="badge" style={{background:bg,color:fg}}>{lbl}</span>;
  };

  const VTypeBadge = ({venue})=>{
    if(!venue)return null;
    const t=venue.venue_type||"restaurant";
    const[bg,fg]={restaurant:["#1a3a20","#4caf50"],garage:["#0d2035","#4a9eff"],hotel:["#1e0d35","#9c6cff"],airport:["#2d1800","#ffa64c"]}[t]||["#1e1e1e","#888"];
    return <span className="badge" style={{background:bg,color:fg}}>{venueIcon(t)} {t.charAt(0).toUpperCase()+t.slice(1)}</span>;
  };

  // Guest billing display — venue-type-aware
  const GuestBilling = ({car,venue})=>{
    const vt=venue?.venue_type||"restaurant";
    const rt=venue?.rate_type;
    const secs=Math.floor(elapsedSecs(car.parked_at));
    const bill=calcBill(venue,car.parked_at);

    if(vt===VT.RESTAURANT) return (
      <div className="card" style={{textAlign:"center",padding:"28px 20px"}}>
        <div style={{fontSize:36,marginBottom:8}}>🍽️</div>
        <div style={{color:"#555",fontSize:14}}>Enjoy your evening</div>
        <div style={{color:"#333",fontSize:12,marginTop:4}}>No parking charge</div>
      </div>
    );

    if(vt===VT.GARAGE){
      if(rt===RT.MONTHLY) return (
        <div className="card-hi" style={{textAlign:"center",padding:"28px 20px"}}>
          <div style={{fontSize:36,marginBottom:8}}>🅿️</div>
          <div className="gold" style={{fontSize:18,fontWeight:400}}>Monthly Permit</div>
          <div style={{color:"#444",fontSize:12,marginTop:8}}>{$amt(venue.monthly_rate||200)}/month</div>
        </div>
      );
      if(rt===RT.DAILY) return (
        <div className="card-hi" style={{textAlign:"center",padding:"28px 20px"}}>
          <div className="clock-lbl" style={{marginBottom:12}}>FLAT DAILY RATE</div>
          <div className="clock">{$amt(venue.daily_rate||30)}</div>
          <div style={{color:"#444",fontSize:12,marginTop:8}}>Due at pickup</div>
        </div>
      );
      // Hourly — live ticking clock
      return (
        <div className="card-hi" style={{padding:"24px 20px"}}>
          <div className="clock-lbl">TIME PARKED</div>
          <div className="clock">{fmtDur(secs)}</div>
          <div style={{color:"#444",fontSize:12,textAlign:"center",marginTop:4}}>min 1 hour · {$amt(venue.hourly_rate||5)}/hr</div>
          <hr className="sep"/>
          <div className="clock-lbl">CURRENT CHARGE</div>
          <div style={{fontSize:30,fontWeight:200,color:"#c9a84c",textAlign:"center"}}>{$amt(bill)}</div>
        </div>
      );
    }

    if(vt===VT.HOTEL){
      const days=Math.max(1,Math.ceil(secs/86400));
      return (
        <div className="card-hi" style={{padding:"24px 20px"}}>
          <div className="clock-lbl">TIME PARKED</div>
          <div className="clock">{fmtDur(secs)}</div>
          <div style={{color:"#444",fontSize:12,textAlign:"center",marginTop:4}}>{$amt(venue.daily_rate||50)}/night</div>
          <hr className="sep"/>
          <div style={{display:"flex",justifyContent:"space-between",color:"#666",fontSize:14}}>
            <span>Nights billed</span><span className="gold">{days}</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:10,fontSize:16}}>
            <span style={{color:"#888"}}>Estimated total</span><span className="gold">{$amt(bill)}</span>
          </div>
        </div>
      );
    }

    if(vt===VT.AIRPORT){
      const days=Math.max(1,Math.ceil(secs/86400));
      return (
        <div className="card-hi" style={{padding:"24px 20px"}}>
          <div style={{textAlign:"center",marginBottom:12}}>
            {venue.airport_code&&<div className="gold" style={{fontSize:28,fontWeight:100,letterSpacing:5,marginBottom:4}}>{venue.airport_code}</div>}
            <div style={{color:"#555",fontSize:13}}>{days} day{days!==1?"s":""} · {$amt(venue.daily_rate||25)}/day</div>
            <div style={{fontSize:30,fontWeight:100,color:"#c9a84c",margin:"12px 0"}}>{$amt(bill)}</div>
          </div>
          <hr className="sep"/>
          <div className="fld" style={{marginBottom:0}}>
            <div className="lbl">Return Flight #</div>
            <div style={{display:"flex",gap:8}}>
              <input className="inp" placeholder="e.g. AA 1234" value={returnFlight} onChange={e=>setReturnFlight(e.target.value)} style={{flex:1}}/>
              <button className="btn btn-dark btn-sm" onClick={saveReturnFlight}>Save</button>
            </div>
            {car.return_flight&&<div style={{color:"#c9a84c",fontSize:13,marginTop:6}}>✈️ {car.return_flight}</div>}
          </div>
        </div>
      );
    }
    return null;
  };

  // ── Valet lot car list ───────────────────────────────────────────────────
  const activeCars = Object.values(valetLot).filter(c=>c.status!==S.DONE);
  const urgentCars = activeCars.filter(c=>c.status===S.REQUESTED);
  const restCars   = activeCars.filter(c=>c.status!==S.REQUESTED);

  // ═══════════════════════════════════════════════════════════════════════
  // SCREENS
  // ═══════════════════════════════════════════════════════════════════════

  // ── MODE SELECT ──────────────────────────────────────────────────────────
  if(mode==="select") return(
    <>
      <style>{STYLES}</style>
      <div className="app">
        <div className="pad" style={{paddingTop:88,textAlign:"center"}}>
          <div style={{fontSize:52,marginBottom:16}}>🚗</div>
          <div className="gold" style={{fontSize:36,fontWeight:100,letterSpacing:5,marginBottom:4}}>PORTIER</div>
          <div style={{color:"#2a2a2a",fontSize:13,letterSpacing:3,marginBottom:56}}>LUXURY PARKING</div>
          <div className="fld"><button className="btn btn-gold" onClick={()=>setMode("guest")}>Guest</button></div>
          <div className="fld"><button className="btn btn-dark" onClick={()=>{setMode("valet");setVView("login");}}>Valet / Staff</button></div>
          <div style={{marginTop:28}}>
            <span style={{color:"#2a2a2a",fontSize:13,cursor:"pointer"}} onClick={()=>setMode("admin")}>Admin ›</span>
          </div>
        </div>
      </div>
      <FlashMsg/>
    </>
  );

  // ── GUEST FLOW ───────────────────────────────────────────────────────────
  if(mode==="guest"){
    // Register
    if(!custUser) return(
      <>
        <style>{STYLES}</style>
        <div className="app">
          <div className="pad" style={{paddingTop:28}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:36}}>
              <button className="btn btn-dark btn-sm" onClick={()=>setMode("select")} style={{width:"auto"}}>←</button>
              <span className="gold" style={{fontSize:20,fontWeight:200,letterSpacing:3}}>PORTIER</span>
            </div>
            <h1 style={{marginBottom:6}}>Welcome</h1>
            <div style={{color:"#333",fontSize:14,marginBottom:32}}>Register once. Your plate is your pass.</div>
            <div className="fld"><div className="lbl">First Name</div><input className="inp" placeholder="John" value={gReg.first} onChange={e=>setGReg(f=>({...f,first:e.target.value}))}/></div>
            <div className="fld"><div className="lbl">Last Name</div><input className="inp" placeholder="Smith" value={gReg.last} onChange={e=>setGReg(f=>({...f,last:e.target.value}))}/></div>
            <div className="fld"><div className="lbl">License Plate</div><input className="inp" placeholder="ABC 1234" value={gReg.plate} onChange={e=>setGReg(f=>({...f,plate:e.target.value.toUpperCase()}))} style={{fontFamily:"monospace",letterSpacing:3}}/></div>
            <button className="btn btn-gold" onClick={registerGuest}>Continue →</button>
          </div>
        </div>
        <FlashMsg/>
      </>
    );

    // Guest home
    return(
      <>
        <style>{STYLES}</style>
        <div className="app">
          <div className="pad" style={{paddingTop:28}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:28}}>
              <span className="gold" style={{fontSize:20,fontWeight:200,letterSpacing:3}}>PORTIER</span>
              <button className="btn btn-dark btn-sm" onClick={()=>{setCustUser(null);try{localStorage.removeItem("portier_guest")}catch{}}} style={{width:"auto",color:"#444",fontSize:12}}>Sign out</button>
            </div>
            <div style={{marginBottom:24}}>
              <div style={{color:"#333",fontSize:12,marginBottom:2}}>Hello,</div>
              <div style={{fontSize:20,fontWeight:300}}>{custUser.first} {custUser.last}</div>
              <div className="plate" style={{marginTop:4}}>{norm(custUser.plate)}</div>
            </div>

            {!custCar?(
              <div className="card" style={{textAlign:"center",padding:"44px 20px"}}>
                <div style={{fontSize:40,marginBottom:12,opacity:.3}}>🚗</div>
                <div style={{color:"#2a2a2a",fontSize:14}}>No active session</div>
                <div style={{color:"#222",fontSize:12,marginTop:6}}>Your car appears here once the valet checks you in</div>
              </div>
            ):(
              <>
                <div className="card" style={{marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                    <div>
                      <div style={{fontWeight:600,fontSize:16}}>{custCar.venue?.name||"Your Venue"}</div>
                      {custCar.venue?.location&&<div style={{color:"#444",fontSize:12,marginTop:2}}>{custCar.venue.location}</div>}
                    </div>
                    <VTypeBadge venue={custCar.venue}/>
                  </div>
                  <hr className="sep"/>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13}}>
                    <span style={{color:"#555"}}>Key Box #{custCar.box}</span>
                    <StatusBadge s={custCar.status}/>
                  </div>
                  {(custCar.color||custCar.make)&&<div style={{color:"#333",fontSize:12,marginTop:6}}>{custCar.color} {custCar.make}</div>}
                </div>

                <GuestBilling car={custCar} venue={custCar.venue}/>

                {custCar.status===S.PARKED&&(
                  <div className="fld" style={{marginTop:8}}>
                    <button className="btn btn-gold" onClick={requestCar}>Heading Out — Get My Car</button>
                  </div>
                )}
                {custCar.status===S.REQUESTED&&(
                  <div className="card" style={{textAlign:"center",background:"#130f00",borderColor:"#c9a84c33"}}>
                    <div style={{fontSize:28,marginBottom:8}}>⏳</div>
                    <div className="gold" style={{fontSize:15}}>Valet notified</div>
                    <div style={{color:"#444",fontSize:13,marginTop:4}}>Your car is being retrieved</div>
                  </div>
                )}
                {custCar.status===S.ENROUTE&&(
                  <div className="card" style={{textAlign:"center",background:"#001525",borderColor:"#4a9eff33"}}>
                    <div style={{fontSize:28,marginBottom:8}}>🚗</div>
                    <div style={{color:"#4a9eff",fontSize:15,fontWeight:500}}>
                      {custCar.valet_name?`${custCar.valet_name.split(" ")[0]} is bringing your car out`:"Your car is on its way"}
                    </div>
                  </div>
                )}
                {custCar.status===S.READY&&(
                  <div className="card" style={{textAlign:"center",background:"#001500",borderColor:"#4caf5033"}}>
                    <div style={{fontSize:28,marginBottom:8}}>✅</div>
                    <div style={{color:"#4caf50",fontSize:15,fontWeight:500}}>Your car is outside!</div>
                    <div style={{color:"#333",fontSize:13,marginTop:4}}>Head to the front — valet is waiting</div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <FlashMsg/>
      </>
    );
  }

  // ── VALET FLOW ───────────────────────────────────────────────────────────
  if(mode==="valet"){

    // Login
    if(vView==="login") return(
      <>
        <style>{STYLES}</style>
        <div className="app">
          <div className="pad" style={{paddingTop:60}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:44}}>
              <button className="btn btn-dark btn-sm" onClick={()=>setMode("select")} style={{width:"auto"}}>←</button>
              <span className="gold" style={{fontSize:20,fontWeight:200,letterSpacing:3}}>VALET LOGIN</span>
            </div>
            <div className="fld">
              <div className="lbl">PIN</div>
              <input className="inp" type="password" inputMode="numeric" placeholder="••••" value={valetPin} onChange={e=>setValetPin(e.target.value)} style={{fontSize:28,letterSpacing:10,textAlign:"center"}}/>
            </div>
            <button className="btn btn-gold" onClick={()=>{
              if(valetPin===ADMIN_PIN){setMode("admin");setAdminAuth(true);setValetPin("");return;}
              const emp=employees.find(e=>e.pin===valetPin);
              if(!emp){flash("Invalid PIN","err");setValetPin("");return;}
              setValetUser(emp); setValetPin(""); setVView("venue");
            }}>Enter</button>
          </div>
        </div>
        <FlashMsg/>
      </>
    );

    // Venue select
    if(vView==="venue") return(
      <>
        <style>{STYLES}</style>
        <div className="app">
          <div className="pad" style={{paddingTop:36}}>
            <div style={{color:"#333",fontSize:13,marginBottom:2}}>Welcome,</div>
            <div style={{fontSize:22,fontWeight:300,marginBottom:28}}>{valetUser?.name}</div>
            <div className="section-hd">SELECT VENUE</div>
            {venues.length===0&&<div style={{color:"#2a2a2a",textAlign:"center",padding:"40px 0"}}>No venues. Ask admin to add venues.</div>}
            {venues.map(v=>(
              <div key={v.id} className="car" style={{cursor:"pointer",marginBottom:10,borderLeft:`3px solid ${venueColor(v.venue_type||"restaurant")}`}}
                onClick={()=>{setValetVenue(v);setVView("home");}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontWeight:600,fontSize:15}}>{v.name}</div>
                    {v.location&&<div style={{color:"#444",fontSize:12,marginTop:2}}>{v.location}</div>}
                    <div style={{marginTop:6}}>
                      <VTypeBadge venue={v}/>
                      {v.venue_type==="garage"&&v.rate_type==="hourly"&&<span style={{color:"#444",fontSize:12,marginLeft:8}}>${v.hourly_rate||5}/hr</span>}
                      {v.venue_type==="garage"&&v.rate_type==="daily"&&<span style={{color:"#444",fontSize:12,marginLeft:8}}>${v.daily_rate||30} flat</span>}
                      {v.venue_type==="garage"&&v.rate_type==="monthly"&&<span style={{color:"#444",fontSize:12,marginLeft:8}}>${v.monthly_rate||200}/mo</span>}
                      {v.venue_type==="hotel"&&<span style={{color:"#444",fontSize:12,marginLeft:8}}>${v.daily_rate||50}/night</span>}
                      {v.venue_type==="airport"&&<span style={{color:"#444",fontSize:12,marginLeft:8}}>{v.airport_code} · ${v.daily_rate||25}/day</span>}
                    </div>
                  </div>
                  <span style={{color:"#333",fontSize:20}}>›</span>
                </div>
              </div>
            ))}
            <div style={{marginTop:20}}>
              <button className="btn btn-dark" onClick={()=>{setVView("login");setValetUser(null);}} style={{color:"#444"}}>Sign Out</button>
            </div>
          </div>
        </div>
        <FlashMsg/>
      </>
    );

    // Valet home
    return(
      <>
        <style>{STYLES}</style>
        <div className="app">
          <div className="pad" style={{paddingTop:20}}>
            {/* Header */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <div>
                <div className="gold" style={{fontWeight:600}}>{valetVenue?.name}</div>
                <div style={{color:"#444",fontSize:12}}>{valetUser?.name}</div>
              </div>
              <div style={{display:"flex",gap:6}}>
                <button className="btn btn-dark btn-sm" onClick={()=>setVView("venue")} style={{width:"auto",fontSize:12}}>Switch</button>
                <button className="btn btn-dark btn-sm" onClick={()=>{setVView("login");setValetUser(null);setValetVenue(null);}} style={{width:"auto",fontSize:12,color:"#444"}}>Exit</button>
              </div>
            </div>
            <hr className="sep"/>

            {/* Park form */}
            <div className="card" style={{marginBottom:16}}>
              <div className="section-hd" style={{color:"#c9a84c",marginBottom:12}}>PARK A CAR</div>
              <div className="row2">
                <div className="fld"><div className="lbl">Plate</div>
                  <input className="inp" placeholder="ABC1234" value={vForm.plate} onChange={e=>onPlateChange(e.target.value)} style={{fontFamily:"monospace",letterSpacing:2}}/>
                </div>
                <div className="fld"><div className="lbl">Make</div><input className="inp" placeholder="BMW" value={vForm.make} onChange={e=>setVForm(f=>({...f,make:e.target.value}))}/></div>
              </div>
              <div className="row2">
                <div className="fld"><div className="lbl">Color</div><input className="inp" placeholder="Black" value={vForm.color} onChange={e=>setVForm(f=>({...f,color:e.target.value}))}/></div>
                <div className="fld"><div className="lbl">Level/Spot</div><input className="inp" placeholder="2A" value={vForm.location} onChange={e=>setVForm(f=>({...f,location:e.target.value}))}/></div>
              </div>
              {/* Box picker */}
              <div className="fld">
                <div className="lbl">Key Box</div>
                <div style={{display:"flex",gap:8}}>
                  <input className="inp" placeholder="Search box #" value={boxQ}
                    onChange={e=>{setBoxQ(e.target.value);setShowBoxes(true);}}
                    onFocus={()=>setShowBoxes(true)} style={{flex:1}}/>
                  {vForm.box&&<div style={{background:"#c9a84c",color:"#000",fontWeight:700,borderRadius:8,padding:"0 14px",display:"flex",alignItems:"center",fontSize:15}}>#{vForm.box}</div>}
                </div>
                {showBoxes&&(
                  <div style={{background:"#141414",border:"1px solid #252525",borderRadius:10,padding:10,marginTop:6,maxHeight:110,overflowY:"auto"}}>
                    <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                      {BOXES.filter(b=>!boxQ||String(b).includes(boxQ)).filter(b=>!usedBoxes.has(b)).slice(0,60).map(b=>(
                        <span key={b} style={{background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:6,padding:"4px 9px",cursor:"pointer",fontSize:12}}
                          onClick={()=>{setVForm(f=>({...f,box:String(b)}));setBoxQ(String(b));setShowBoxes(false);}}>{b}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {vErr&&<div style={{color:"#ff4444",fontSize:13,marginBottom:8}}>{vErr}</div>}
              <button className="btn btn-gold" onClick={parkCar}>Park Car</button>
            </div>

            {/* Urgent alerts */}
            {urgentCars.length>0&&(
              <div style={{marginBottom:8}}>
                <div className="section-hd" style={{color:"#ffc107"}}>⚡ RETRIEVE NOW ({urgentCars.length})</div>
                {urgentCars.map(car=>(
                  <div key={car.plate} className="car urg" style={{marginBottom:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div>
                        <div className="plate" style={{fontSize:15}}>{car.plate}</div>
                        {car.customer_name&&<div style={{color:"#c9a84c",fontSize:13,marginTop:2}}>{car.customer_name}</div>}
                        <div style={{color:"#444",fontSize:12,marginTop:2}}>Box #{car.box}{car.color&&` · ${car.color}`}{car.make&&` ${car.make}`}</div>
                      </div>
                      <button className="btn btn-gold btn-sm" onClick={()=>advance(car.plate)}>En Route →</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Active lot */}
            <div className="section-hd">LOT — {restCars.length} CARS</div>
            {restCars.length===0&&<div style={{color:"#222",textAlign:"center",padding:"20px 0",fontSize:13}}>Empty lot</div>}
            {restCars.map(car=>(
              <div key={car.plate} className="car" style={{marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div className="plate" style={{fontSize:14}}>{car.plate}</div>
                      <StatusBadge s={car.status}/>
                    </div>
                    <div style={{color:"#444",fontSize:12,marginTop:4}}>Box #{car.box}{car.color&&` · ${car.color}`}{car.make&&` ${car.make}`}</div>
                    {car.customer_name&&<div style={{color:"#555",fontSize:12}}>{car.customer_name}</div>}
                    {valetVenue?.venue_type!=="restaurant"&&car.parked_at&&(
                      <div style={{color:"#c9a84c",fontSize:12,marginTop:2}}>{$amt(calcBill(valetVenue,car.parked_at))}</div>
                    )}
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {car.status===S.ENROUTE&&<button className="btn btn-dark btn-sm" onClick={()=>advance(car.plate)}>Ready ✓</button>}
                    {car.status===S.READY&&<button className="btn btn-gold btn-sm" onClick={()=>setTipModal(car.plate)}>Done</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tip / Complete modal */}
        {tipModal&&(()=>{
          const car=valetLot[tipModal];
          const bill=calcBill(valetVenue,car?.parked_at);
          return(
            <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999,padding:20}}>
              <div className="card" style={{width:"100%",maxWidth:360}}>
                <div style={{fontWeight:600,marginBottom:4}}>Complete Retrieval</div>
                <div className="plate" style={{fontSize:15,marginBottom:16}}>{tipModal}</div>
                {bill>0&&<div style={{color:"#c9a84c",fontSize:22,fontWeight:200,marginBottom:16}}>Parking: {$amt(bill)}</div>}
                <div style={{fontSize:12,color:"#444",marginBottom:10,letterSpacing:.5}}>TIP AMOUNT</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16}}>
                  {[0,5,10,15,20].map(t=>(
                    <button key={t} className="btn btn-dark btn-sm" onClick={()=>confirmRetrieve(tipModal,t)}
                      style={{flex:"1 0 28%",textAlign:"center"}}>
                      {t===0?"No tip":`$${t}`}
                    </button>
                  ))}
                </div>
                <button className="btn btn-dark" onClick={()=>setTipModal(null)} style={{color:"#444"}}>Cancel</button>
              </div>
            </div>
          );
        })()}
        <FlashMsg/>
      </>
    );
  }

  // ── ADMIN FLOW ───────────────────────────────────────────────────────────
  if(mode==="admin"){
    // Auth
    if(!adminAuth) return(
      <>
        <style>{STYLES}</style>
        <div className="app">
          <div className="pad" style={{paddingTop:60}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:44}}>
              <button className="btn btn-dark btn-sm" onClick={()=>setMode("select")} style={{width:"auto"}}>←</button>
              <span className="gold" style={{fontSize:20,fontWeight:200,letterSpacing:3}}>ADMIN</span>
            </div>
            <div className="fld"><div className="lbl">PIN</div>
              <input className="inp" type="password" inputMode="numeric" value={adminPin} onChange={e=>setAdminPin(e.target.value)} style={{fontSize:28,letterSpacing:10,textAlign:"center"}}/>
            </div>
            <button className="btn btn-gold" onClick={()=>{
              if(adminPin===ADMIN_PIN){setAdminAuth(true);setAdminPin("");}
              else{flash("Wrong PIN","err");setAdminPin("");}
            }}>Enter</button>
          </div>
        </div>
        <FlashMsg/>
      </>
    );

    return(
      <>
        <style>{STYLES}</style>
        <div className="app">
          <div className="pad" style={{paddingTop:24}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <span className="gold" style={{fontSize:20,fontWeight:200,letterSpacing:3}}>ADMIN</span>
              <button className="btn btn-dark btn-sm" onClick={()=>{setMode("select");setAdminAuth(false);}} style={{width:"auto",color:"#444",fontSize:12}}>EXIT</button>
            </div>

            <div className="tabs">
              {["venues","companies","employees"].map(t=>(
                <div key={t} className={`tab${adminTab===t?" on":""}`} onClick={()=>setAdminTab(t)} style={{textTransform:"capitalize"}}>{t}</div>
              ))}
            </div>

            {/* ── VENUES ── */}
            {adminTab==="venues"&&(<>
              <div className="card">
                <div className="section-hd" style={{color:"#c9a84c",marginBottom:12}}>ADD VENUE</div>
                <div className="fld"><div className="lbl">Venue Name</div><input className="inp" placeholder="e.g. Biltmore Garage" value={vf.name} onChange={e=>setVf(f=>({...f,name:e.target.value}))}/></div>
                <div className="row2">
                  <div className="fld"><div className="lbl">Short Name</div><input className="inp" placeholder="e.g. Biltmore" value={vf.short_name} onChange={e=>setVf(f=>({...f,short_name:e.target.value}))}/></div>
                  <div className="fld"><div className="lbl">Initials</div><input className="inp" placeholder="BG" maxLength={3} value={vf.initials} onChange={e=>setVf(f=>({...f,initials:e.target.value.toUpperCase()}))} style={{textAlign:"center",letterSpacing:2}}/></div>
                </div>
                <div className="fld"><div className="lbl">Location</div><input className="inp" placeholder="e.g. New York, New York" value={vf.location} onChange={e=>setVf(f=>({...f,location:e.target.value}))}/></div>

                {/* Venue Type selector */}
                <div className="fld">
                  <div className="lbl">Venue Type</div>
                  <select className="sel" value={vf.venue_type} onChange={e=>setVf(f=>({...f,venue_type:e.target.value}))}>
                    <option value="restaurant">🍽️ Restaurant — valet only, no billing</option>
                    <option value="garage">🅿️ Garage — parking with billing</option>
                    <option value="hotel">🏨 Hotel — nightly rate</option>
                    <option value="airport">✈️ Airport — daily rate</option>
                  </select>
                </div>

                {/* Garage sub-options */}
                {vf.venue_type==="garage"&&(<>
                  <div className="fld">
                    <div className="lbl">Rate Type</div>
                    <select className="sel" value={vf.rate_type} onChange={e=>setVf(f=>({...f,rate_type:e.target.value}))}>
                      <option value="hourly">Hourly — live ticking clock, min 1 hr</option>
                      <option value="daily">Daily — flat day rate</option>
                      <option value="monthly">Monthly — permit holders</option>
                    </select>
                  </div>
                  {vf.rate_type==="hourly"&&<div className="fld"><div className="lbl">Hourly Rate ($)</div><input className="inp" type="number" min="1" value={vf.hourly_rate} onChange={e=>setVf(f=>({...f,hourly_rate:e.target.value}))}/></div>}
                  {vf.rate_type==="daily" &&<div className="fld"><div className="lbl">Daily Rate ($)</div><input className="inp" type="number" min="1" value={vf.daily_rate} onChange={e=>setVf(f=>({...f,daily_rate:e.target.value}))}/></div>}
                  {vf.rate_type==="monthly"&&<div className="fld"><div className="lbl">Monthly Rate ($)</div><input className="inp" type="number" min="1" value={vf.monthly_rate} onChange={e=>setVf(f=>({...f,monthly_rate:e.target.value}))}/></div>}
                </>)}

                {/* Hotel rate */}
                {vf.venue_type==="hotel"&&<div className="fld"><div className="lbl">Nightly Rate ($)</div><input className="inp" type="number" min="1" value={vf.daily_rate} onChange={e=>setVf(f=>({...f,daily_rate:e.target.value}))}/></div>}

                {/* Airport fields */}
                {vf.venue_type==="airport"&&(<>
                  <div className="fld"><div className="lbl">Daily Rate ($)</div><input className="inp" type="number" min="1" value={vf.daily_rate} onChange={e=>setVf(f=>({...f,daily_rate:e.target.value}))}/></div>
                  <div className="fld"><div className="lbl">Airport Code</div><input className="inp" placeholder="JFK" maxLength={4} value={vf.airport_code} onChange={e=>setVf(f=>({...f,airport_code:e.target.value.toUpperCase()}))} style={{fontFamily:"monospace",letterSpacing:4,textAlign:"center"}}/></div>
                </>)}

                {/* Brand color */}
                <div className="fld">
                  <div className="lbl">Brand Color</div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <input type="color" value={vf.color} onChange={e=>setVf(f=>({...f,color:e.target.value}))} style={{width:46,height:46,border:"none",background:"none",cursor:"pointer",borderRadius:8,padding:2}}/>
                    <input className="inp" value={vf.color} onChange={e=>setVf(f=>({...f,color:e.target.value}))} style={{flex:1,fontFamily:"monospace",fontSize:14}}/>
                  </div>
                </div>
                <button className="btn btn-gold" onClick={addVenue}>+ Add Venue</button>
              </div>

              <div className="section-hd">ALL VENUES ({venues.length})</div>
              {venues.map(v=>(
                <div key={v.id} className="car" style={{marginBottom:10,borderLeft:`3px solid ${v.color||venueColor(v.venue_type)}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div>
                      <div style={{fontWeight:600}}>{v.name}</div>
                      {v.location&&<div style={{color:"#444",fontSize:12,marginTop:1}}>{v.location}</div>}
                      <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap",alignItems:"center"}}>
                        <VTypeBadge venue={v}/>
                        {v.venue_type==="garage"&&v.rate_type==="hourly"&&<span style={{color:"#444",fontSize:12}}>${v.hourly_rate}/hr</span>}
                        {v.venue_type==="garage"&&v.rate_type==="daily"&&<span style={{color:"#444",fontSize:12}}>${v.daily_rate}/day</span>}
                        {v.venue_type==="garage"&&v.rate_type==="monthly"&&<span style={{color:"#444",fontSize:12}}>${v.monthly_rate}/mo</span>}
                        {v.venue_type==="hotel"&&<span style={{color:"#444",fontSize:12}}>${v.daily_rate}/night</span>}
                        {v.venue_type==="airport"&&<span style={{color:"#444",fontSize:12}}>{v.airport_code} · ${v.daily_rate}/day</span>}
                      </div>
                    </div>
                    <button className="btn btn-red btn-sm" onClick={()=>delVenue(v.id)}>Del</button>
                  </div>
                </div>
              ))}
            </>)}

            {/* ── COMPANIES ── */}
            {adminTab==="companies"&&(<>
              <div className="card">
                <div className="section-hd" style={{color:"#c9a84c",marginBottom:12}}>ADD COMPANY</div>
                <div className="fld"><div className="lbl">Company Name</div><input className="inp" placeholder="Premier Valet Inc." value={coForm.name} onChange={e=>setCoForm({name:e.target.value})}/></div>
                <button className="btn btn-gold" onClick={addCompany}>+ Add Company</button>
              </div>
              <div className="section-hd">COMPANIES ({companies.length})</div>
              {companies.map(c=>(
                <div key={c.id} className="car" style={{marginBottom:8}}>
                  <div style={{fontWeight:600}}>{c.name}</div>
                  <div style={{color:"#444",fontSize:12,marginTop:2}}>{employees.filter(e=>e.company_id===c.id).length} employees</div>
                </div>
              ))}
            </>)}

            {/* ── EMPLOYEES ── */}
            {adminTab==="employees"&&(<>
              <div className="card">
                <div className="section-hd" style={{color:"#c9a84c",marginBottom:12}}>ADD EMPLOYEE</div>
                <div className="fld"><div className="lbl">Full Name</div><input className="inp" placeholder="Carlos Rodriguez" value={empForm.name} onChange={e=>setEmpForm(f=>({...f,name:e.target.value}))}/></div>
                <div className="fld"><div className="lbl">PIN (4 digits)</div><input className="inp" type="password" inputMode="numeric" placeholder="1234" maxLength={4} value={empForm.pin} onChange={e=>setEmpForm(f=>({...f,pin:e.target.value}))}/></div>
                <div className="fld"><div className="lbl">Company</div>
                  <select className="sel" value={empForm.company_id} onChange={e=>setEmpForm(f=>({...f,company_id:e.target.value}))}>
                    <option value="">Select company...</option>
                    {companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="fld"><div className="lbl">Default Venue (optional)</div>
                  <select className="sel" value={empForm.venue_id} onChange={e=>setEmpForm(f=>({...f,venue_id:e.target.value}))}>
                    <option value="">No default</option>
                    {venues.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <button className="btn btn-gold" onClick={addEmployee}>+ Add Employee</button>
              </div>
              <div className="section-hd">EMPLOYEES ({employees.length})</div>
              {employees.map(e=>{
                const co=companies.find(c=>c.id===e.company_id);
                const venue=venues.find(v=>v.id===e.venue_id);
                return(
                  <div key={e.id} className="car" style={{marginBottom:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div>
                        <div style={{fontWeight:600}}>{e.name}</div>
                        <div style={{color:"#444",fontSize:12,marginTop:2}}>{co?.name||"–"}{venue&&` · ${venue.name}`}</div>
                        <div style={{color:"#2a2a2a",fontSize:11,fontFamily:"monospace",marginTop:2}}>PIN: {e.pin}</div>
                      </div>
                      <button className="btn btn-red btn-sm" onClick={()=>delEmployee(e.id)}>Del</button>
                    </div>
                  </div>
                );
              })}
            </>)}
          </div>
        </div>
        <FlashMsg/>
      </>
    );
  }

  return null;
}
