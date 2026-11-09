import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, ArrowDownToLine, ArrowRight, Atom, BookOpen, CheckCircle2,
  ChevronRight, CircleHelp, Clock3, FileImage, FileText, FlaskConical,
  LayoutDashboard, Leaf, LogOut, Menu, Package, Recycle, ScanLine,
  Search, ShieldCheck, Sparkles, UploadCloud, UserRound, Weight, X,
} from 'lucide-react';
import { api, BASE, token } from './lib/api';

type Page = 'dashboard' | 'scanner' | 'results' | 'history' | 'materials';
type User = { id: string; email: string; full_name: string; role?: string };
type Analysis = {
  id: string;
  mode: 'live' | 'demo';
  created_at: string;
  product: { product_name: string; summary: string; limitations?: string };
  components: Array<{
    component_name: string; material_id: string; family?: string; confidence?: number;
    status_label: string; recycling_status: string; technical_explanation: string;
    recommended_process?: string; contamination?: string;
  }>;
  weight: { minimum_g: number | null; expected_g: number | null; maximum_g: number | null; confidence: string; assumptions: string[] };
  recovery: Array<{ component_name: string; material_id: string; input_g: number; conservative_g: number; expected_g: number; optimistic_g: number }>;
  recommendations: Array<{ product_name: string; material_id: string; description?: string; expected_output_g: number; minimum_input_g: number; processing_requirements: string; machinery?: string; feasibility: string }>;
};

const nav: Array<{ id: Page; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'scanner', label: 'Waste scanner', icon: ScanLine },
  { id: 'history', label: 'Scan history', icon: Clock3 },
  { id: 'materials', label: 'Material explorer', icon: BookOpen },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [page, setPage] = useState<Page>('dashboard');
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [summary, setSummary] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [measuredWeight, setMeasuredWeight] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);

  const filteredMaterials = useMemo(() => materials.filter((m) =>
    `${m.id} ${m.name} ${m.family}`.toLowerCase().includes(query.toLowerCase())), [materials, query]);

  async function refresh() {
    const [s, h, m] = await Promise.all([
      api('/dashboard/summary'), api('/analyses'), api('/materials'),
    ]);
    setSummary(s); setHistory(h); setMaterials(m);
  }

  useEffect(() => {
    if (!token()) { setLoadingAuth(false); return; }
    api('/auth/me').then((u: User) => { setUser(u); return refresh(); })
      .catch(() => localStorage.removeItem('ev_token'))
      .finally(() => setLoadingAuth(false));
  }, []);

  async function submitAuth(event: FormEvent) {
    event.preventDefault(); setAuthBusy(true); setAuthError('');
    try {
      const result = await api(authMode === 'login' ? '/auth/login' : '/auth/register', {
        method: 'POST',
        body: JSON.stringify(authMode === 'login'
          ? { email, password }
          : { email, password, full_name: fullName }),
      });
      localStorage.setItem('ev_token', result.access_token);
      setUser(result.user); await refresh();
    } catch (err) { setAuthError(err instanceof Error ? err.message : 'Authentication failed'); }
    finally { setAuthBusy(false); }
  }

  function logout() {
    localStorage.removeItem('ev_token'); setUser(null); setAnalysis(null); setPage('dashboard');
  }

  async function scan(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    setBusy(true); setError('');
    try {
      const form = new FormData();
      form.append('image', file);
      if (measuredWeight) form.append('measured_weight_g', measuredWeight);
      const result = await api('/analyze', { method: 'POST', body: form });
      setAnalysis(result); setPage('results'); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not analyse this image'); }
    finally { setBusy(false); }
  }

  async function openAnalysis(id: string) {
    try { setAnalysis(await api(`/analyses/${id}`)); setPage('results'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to open scan'); }
  }

  async function downloadReport() {
    if (!analysis) return;
    try {
      const response = await fetch(`${BASE}/analyses/${analysis.id}/report.pdf`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!response.ok) throw new Error('Report generation failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url;
      anchor.download = `ecovision-${analysis.id}.pdf`; anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to download report'); }
  }

  if (loadingAuth) return <div className="loading-screen"><div className="brand-mark"><Recycle /></div><span>Loading EcoVision AI…</span></div>;

  if (!user) return (
    <div className="auth-shell">
      <div className="auth-visual">
        <div className="brand"><span className="brand-mark"><Recycle size={22}/></span><span>EcoVision<span className="brand-ai"> AI</span></span></div>
        <div className="auth-hero-copy">
          <span className="eyebrow light">INTELLIGENCE FOR A CIRCULAR WORLD</span>
          <h1>Waste is not the end of the story.</h1>
          <p>Understand what's inside an item, explore responsible recycling pathways, and turn recovered materials into new opportunities.</p>
          <div className="auth-points"><span><ScanLine/> Identify visible materials</span><span><Atom/> Understand component risks</span><span><Leaf/> Explore recovery pathways</span></div>
        </div>
        <div className="auth-footnote">Evidence-led material intelligence · Transparent assumptions</div>
      </div>
      <div className="auth-form-side">
        <form className="auth-card" onSubmit={submitAuth}>
          <span className="eyebrow">WELCOME TO ECOVISION</span>
          <h2>{authMode === 'login' ? 'Sign in to your workspace' : 'Create your account'}</h2>
          <p className="muted">Access your waste analysis workspace and saved reports.</p>
          {authMode === 'register' && <label>Full name<input required minLength={2} value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Your name"/></label>}
          <label>Email address<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>
          <label>Password<input type="password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters"/></label>
          {authError && <div className="error-box">{authError}</div>}
          <button className="button button-primary button-wide" disabled={authBusy}>{authBusy ? 'Please wait…' : authMode === 'login' ? 'Sign in' : 'Create account'}<ArrowRight size={17}/></button>
          <p className="auth-switch">{authMode === 'login' ? 'New to EcoVision?' : 'Already have an account?'} <button type="button" onClick={()=>{setAuthMode(authMode==='login'?'register':'login');setAuthError('')}}>{authMode==='login'?'Create an account':'Sign in'}</button></p>
          <div className="auth-disclaimer"><ShieldCheck size={15}/> Your password is securely hashed by the backend. API keys stay server-side.</div>
        </form>
      </div>
    </div>
  );

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
        <div className="brand sidebar-brand"><span className="brand-mark"><Recycle size={21}/></span><span>EcoVision<span className="brand-ai"> AI</span></span><button className="mobile-close" onClick={()=>setMobileMenu(false)}><X/></button></div>
        <div className="workspace-label">WORKSPACE</div>
        <nav>{nav.map(item => <button key={item.id} className={`nav-item ${page===item.id || (page==='results'&&item.id==='scanner')?'active':''}`} onClick={()=>{setPage(item.id);setMobileMenu(false);setError('')}}><item.icon size={18}/>{item.label}{item.id==='scanner'&&<span className="nav-plus">+</span>}</button>)}</nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip"><div className="tip-icon"><Sparkles size={17}/></div><b>Better inputs, better insights.</b><p>Use a clear image and include a measured weight when possible.</p><button onClick={()=>setPage('scanner')}>Start a scan <ArrowRight size={14}/></button></div>
          <div className="profile-row"><div className="avatar"><UserRound size={17}/></div><div className="profile-copy"><b>{user.full_name}</b><small>{user.email}</small></div><button title="Sign out" className="logout-button" onClick={logout}><LogOut size={17}/></button></div>
        </div>
      </aside>
      {mobileMenu && <button className="mobile-backdrop" aria-label="Close menu" onClick={()=>setMobileMenu(false)}/>}
      <main className="main-area">
        <header className="topbar"><button className="mobile-menu-button" onClick={()=>setMobileMenu(true)}><Menu/></button><div className="breadcrumb">Workspace <ChevronRight size={14}/><b>{page==='results'?'Analysis results':nav.find(x=>x.id===page)?.label}</b></div><div className="topbar-right"><span className="system-status"><i/> System ready</span><div className="top-avatar">{user.full_name.slice(0,1).toUpperCase()}</div></div></header>
        <div className="page-content">
          {error && <div className="error-box page-error">{error}<button onClick={()=>setError('')}><X size={15}/></button></div>}
          {page==='dashboard' && <Dashboard user={user} summary={summary} history={history} setPage={setPage} openAnalysis={openAnalysis}/>}
          {page==='scanner' && <Scanner file={file} setFile={setFile} measuredWeight={measuredWeight} setMeasuredWeight={setMeasuredWeight} busy={busy} error={error} scan={scan}/>}
          {page==='results' && analysis && <Results analysis={analysis} downloadReport={downloadReport} newScan={()=>{setFile(null);setMeasuredWeight('');setPage('scanner')}}/>}
          {page==='results' && !analysis && <div className="empty-panel"><FileImage/><h3>No analysis selected</h3><p>Start a new scan or open one from your history.</p><button className="button button-primary" onClick={()=>setPage('scanner')}>Open scanner</button></div>}
          {page==='history' && <History items={history} openAnalysis={openAnalysis} setPage={setPage}/>}
          {page==='materials' && <Materials items={filteredMaterials} query={query} setQuery={setQuery}/>}
          <footer className="page-footer"><span>EcoVision AI</span><span>Evidence-led · Transparent · Circular</span><span>Turning Waste into Intelligent Recovery Opportunities.</span></footer>
        </div>
      </main>
    </div>
  );
}

function Dashboard({ user, summary, history, setPage, openAnalysis }: any) {
  return <div className="page-stack">
    <section className="welcome-banner"><div className="welcome-copy"><span className="eyebrow light">YOUR CIRCULARITY WORKSPACE</span><h1>Good to see you, {user.full_name.split(' ')[0]}.</h1><p>Turn a simple waste image into clear, evidence-aware recycling intelligence.</p><button className="button button-lime" onClick={()=>setPage('scanner')}>Start waste analysis <ArrowRight size={17}/></button></div><div className="banner-art"><div className="leaf-ring"><Recycle size={76}/></div><span className="orbit-label orbit-one">IDENTIFY</span><span className="orbit-label orbit-two">RECOVER</span><span className="orbit-label orbit-three">REIMAGINE</span></div></section>
    <div className="section-heading"><div><span className="eyebrow">YOUR ACTIVITY</span><h2>Workspace overview</h2></div><span className="subtle-note">Updated from your saved analyses</span></div>
    <section className="metric-grid">
      <Metric icon={<ScanLine/>} label="Total scans" value={summary?.total_scans??0} note="Saved waste analyses"/>
      <Metric icon={<Sparkles/>} label="Live AI scans" value={summary?.live_scans??0} note="Gemini Vision analyses"/>
      <Metric icon={<FlaskConical/>} label="Demo scans" value={summary?.demo_scans??0} note="Synthetic demonstration data"/>
      <Metric icon={<BookOpen/>} label="Materials indexed" value={16} note="Material reference entries"/>
    </section>
    <section className="dashboard-grid">
      <div className="panel"><div className="panel-head"><div><span className="eyebrow">RECENT ACTIVITY</span><h3>Latest analyses</h3></div><button className="text-action" onClick={()=>setPage('history')}>View history <ArrowRight size={15}/></button></div>
        {history.length ? history.slice(0,5).map((item:any)=><div className="history-item" key={item.id}><div className="history-symbol"><Recycle size={18}/></div><div className="history-detail"><b>{item.product_name}</b><small>{new Date(item.created_at).toLocaleString()}</small></div><span className={`mode-pill ${item.mode}`}>{item.mode}</span><button className="small-icon-button" onClick={()=>openAnalysis(item.id)}><ChevronRight size={18}/></button></div>) : <EmptyState icon={<ScanLine/>} title="No scans yet" text="Your analyses will appear here after your first upload." action="Scan an item" onAction={()=>setPage('scanner')}/>}
      </div>
      <div className="panel process-panel"><span className="eyebrow">THE ECOVISION METHOD</span><h3>From image to insight.</h3>{[['01','Identify','AI interprets visible product cues.'],['02','Understand','Assess each identified component.'],['03','Recover','Model yields using explicit assumptions.']].map(row=><div className="process-step" key={row[0]}><span>{row[0]}</span><div><b>{row[1]}</b><small>{row[2]}</small></div></div>)}</div>
    </section>
    <div className="notice-card"><CircleHelp size={19}/><p><b>Important:</b> A photograph cannot prove chemical composition or exact mass. Live AI findings are estimates; demo scans use synthetic sample data, not the uploaded item's identity.</p></div>
  </div>;
}

function Scanner({ file, setFile, measuredWeight, setMeasuredWeight, busy, scan }: any) {
  return <div className="page-stack">
    <div className="page-title"><div><span className="eyebrow">IMAGE-BASED MATERIAL INTELLIGENCE</span><h1>Smart waste scanner</h1><p>Upload a clear image to identify visible components and explore responsible recovery options.</p></div><span className="step-chip"><ScanLine size={15}/> ANALYSIS STUDIO</span></div>
    <div className="scanner-grid"><form className="panel scanner-card" onSubmit={scan}>
      <div className="panel-title"><div className="panel-icon"><UploadCloud/></div><div><h3>Upload a waste item</h3><p>JPG, PNG or WebP · Maximum 10 MB</p></div></div>
      <label className="upload-zone"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setFile(e.target.files?.[0]||null)}/>{file?<><div className="upload-check"><CheckCircle2 size={32}/></div><b>{file.name}</b><small>{(file.size/1024/1024).toFixed(2)} MB · Ready to analyse</small></>:<><div className="upload-icon"><FileImage size={33}/></div><b>Choose an image to upload</b><small>Click to browse files from your device</small><span className="browse-pill">Browse files</span></>}</label>
      {file && <div className="selected-file"><FileImage size={17}/><span>{file.name}</span><button type="button" onClick={()=>setFile(null)}><X size={16}/></button></div>}
      <label className="field-label">Measured weight <span className="optional">OPTIONAL</span><div className="input-with-unit"><input type="number" min="0.01" step="0.01" value={measuredWeight} onChange={e=>setMeasuredWeight(e.target.value)} placeholder="Enter scale measurement"/><span>grams</span></div></label>
      <div className="notice-card compact"><CircleHelp size={17}/><p>Adding a scale measurement makes recovery estimates more useful. Photo-only mass estimates are not treated as exact.</p></div>
      <button className="button button-primary button-wide" disabled={!file||busy}>{busy?'Analysing…':'Analyse waste item'} <ArrowRight size={17}/></button>
    </form>
    <div className="panel pipeline-card"><span className="eyebrow">ANALYSIS PIPELINE</span><h3>Evidence before assumptions.</h3>{[['01','Vision analysis','Gemini interprets the visible product and components.'],['02','Material mapping','A rule-based knowledge base assesses identified materials.'],['03','Recovery modelling','Mass balance is calculated only when supported by inputs.'],['04','Actionable report','Review assumptions and export a PDF report.']].map(item=><div className="pipeline-row" key={item[0]}><span>{item[0]}</span><div><b>{item[1]}</b><small>{item[2]}</small></div></div>)}
      <div className="pipeline-note"><ShieldCheck size={18}/><p>API keys remain on the server. When Gemini is not configured, the backend clearly labels a synthetic demo result.</p></div>
    </div></div>
  </div>;
}

function Results({ analysis, downloadReport, newScan }: {analysis:Analysis;downloadReport:()=>void;newScan:()=>void}) {
  const product = analysis.product;
  return <div className="page-stack">
    <div className="result-heading"><div><span className="eyebrow">ANALYSIS REPORT · {analysis.mode.toUpperCase()} MODE</span><h1>{product.product_name}</h1><p>{product.summary}</p></div><div className="result-actions"><button className="button button-secondary" onClick={downloadReport}><ArrowDownToLine size={16}/> Download PDF</button><button className="button button-primary" onClick={newScan}>New scan <ArrowRight size={16}/></button></div></div>
    <div className={`mode-banner ${analysis.mode}`}>{analysis.mode==='demo'?<CircleHelp size={18}/>:<Sparkles size={18}/>}<p>{analysis.mode==='demo'?'DEMO DATA: This is a synthetic sample result. It does not identify the image you uploaded.':'LIVE AI: Results are Gemini visual inferences. Confirm polymer types and composition with labels or qualified testing.'} {product.limitations||''}</p></div>
    <section className="metric-grid result-metrics">
      <Metric icon={<Weight/>} label="Expected item weight" value={analysis.weight.expected_g==null?'Unavailable':`${analysis.weight.expected_g} g`} note={analysis.weight.confidence==='user_measured'?'User-provided measurement':analysis.weight.confidence}/>
      <Metric icon={<Package/>} label="Components identified" value={analysis.components.length} note="Component-level assessment"/>
      <Metric icon={<Recycle/>} label="Recovery entries" value={analysis.recovery.length} note="Mass balance available where supported"/>
      <Metric icon={<FlaskConical/>} label="Product pathways" value={analysis.recommendations.length} note="Indicative opportunities"/>
    </section>
    <section className="panel"><div className="panel-head"><div><span className="eyebrow">MATERIAL DECOMPOSITION</span><h3>Component intelligence</h3></div><span className="count-chip">{analysis.components.length} components</span></div>
      <div className="component-list">{analysis.components.map((component,index)=><article className="component-row" key={index}><div className="component-number">{String(index+1).padStart(2,'0')}</div><div className="component-info"><b>{component.component_name}</b><div className="component-meta"><span>{component.material_id}</span>{component.family&&<span>{component.family}</span>}{component.confidence!=null&&<span>{Math.round(component.confidence*100)}% visual confidence</span>}</div><p>{component.technical_explanation}</p><small><b>Process:</b> {component.recommended_process}</small>{component.contamination&&<small><b>Contamination:</b> {component.contamination}</small>}</div><span className={`status-pill ${component.recycling_status}`}>{component.status_label}</span></article>)}</div>
    </section>
    <div className="two-column">
      <section className="panel"><span className="eyebrow">MATERIAL RECOVERY</span><h3>Estimated recoverable output</h3>{analysis.recovery.length?analysis.recovery.map((item,index)=><div className="recovery-entry" key={index}><div><b>{item.component_name}</b><small>{item.material_id} · input {item.input_g} g</small></div><div className="recovery-numbers"><b>{item.expected_g} g</b><small>{item.conservative_g}–{item.optimistic_g} g range</small></div></div>):<EmptyState icon={<Weight/>} title="Recovery not calculated" text="A measured item weight and component mass fractions are needed before a defensible multi-component recovery calculation is available."/>}</section>
      <section className="panel"><span className="eyebrow">CIRCULAR OPPORTUNITIES</span><h3>Potential product pathways</h3>{analysis.recommendations.length?analysis.recommendations.map((item,index)=><div className="recommendation-entry" key={index}><div className="recommendation-top"><b>{item.product_name}</b><span className="feasibility-pill">Indicative</span></div><p>{item.description||'Potential downstream pathway from recovered material.'}</p><small>Expected output: {item.expected_output_g} g · Minimum input: {item.minimum_input_g} g</small><small><b>Process:</b> {item.processing_requirements}</small><small><b>Machinery:</b> {item.machinery||'Depends on processor scale and specifications'}</small><small className="muted">{item.feasibility}</small></div>):<EmptyState icon={<Leaf/>} title="No pathway recommendation" text="No matching recommendation can be made from the current measured recovery data."/>}</section>
    </div>
    <section className="panel assumption-panel"><div className="panel-icon"><ShieldCheck/></div><div><b>Weight and confidence notes</b>{analysis.weight.assumptions?.map((note,index)=><p key={index}>{note}</p>)}</div></section>
  </div>;
}

function History({ items, openAnalysis, setPage }: any) {
  return <div className="page-stack"><div className="page-title"><div><span className="eyebrow">YOUR WORKSPACE</span><h1>Scan history</h1><p>Review and reopen your previous waste analyses.</p></div><button className="button button-primary" onClick={()=>setPage('scanner')}>New scan <ArrowRight size={16}/></button></div><section className="panel">{items.length?items.map((item:any)=><div className="history-item large" key={item.id}><div className="history-symbol"><Recycle size={18}/></div><div className="history-detail"><b>{item.product_name}</b><small>{new Date(item.created_at).toLocaleString()}</small></div><span className={`mode-pill ${item.mode}`}>{item.mode}</span><button className="button button-tertiary" onClick={()=>openAnalysis(item.id)}>View report <ArrowRight size={15}/></button></div>):<EmptyState icon={<Clock3/>} title="No saved scans yet" text="Your scan history will appear here when you analyse an item." action="Open scanner" onAction={()=>setPage('scanner')}/>}</section></div>;
}

function Materials({ items, query, setQuery }: any) {
  return <div className="page-stack"><div className="page-title"><div><span className="eyebrow">REFERENCE KNOWLEDGE BASE</span><h1>Material explorer</h1><p>Explore common waste materials and their general processing requirements.</p></div></div><div className="material-search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search PET, aluminium, paper…"/></div><div className="material-grid">{items.map((item:any)=><article className="material-card" key={item.id}><div className="material-card-top"><span>{item.family}</span><b>{item.id}</b></div><h3>{item.name}</h3><span className={`status-pill ${item.recycling_status}`}>{item.recycling_status.replaceAll('_',' ')}</span><p>{item.notes}</p><div className="material-detail"><b>Typical process</b><span>{item.process}</span></div><div className="material-detail"><b>Contamination risks</b><span>{item.contamination}</span></div></article>)}</div>{!items.length&&<EmptyState icon={<Search/>} title="No materials found" text="Try another material name or resin code."/>}</div>;
}

function Metric({ icon, label, value, note }: any) {
  return <div className="metric-card"><div className="metric-icon">{icon}</div><div className="metric-copy"><small>{label}</small><strong>{value}</strong><span>{note}</span></div></div>;
}
function EmptyState({ icon, title, text, action, onAction }: any) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><b>{title}</b><p>{text}</p>{action&&<button className="text-action" onClick={onAction}>{action} <ArrowRight size={15}/></button>}</div>;
}
