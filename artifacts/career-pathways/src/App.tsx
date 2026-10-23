import { type ReactNode, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  CareerRolesPage as RolesPage,
  CareerSkillsPage as SkillsPage,
  DatasetFeedback,
  type DatasetState,
} from '@/components/career-data-pages';
import { PageHeading } from '@/components/page-heading';
import { ProfilePage } from '@/components/profile-page';
import { PersonalisedRoadmapPage, OccupationImpactPage, FutureScenarioPage, PlanningStyles } from '@/components/career-planning-pages';
import type { ScenarioId } from '@/lib/career-planning';
import { normalizeProfile, type Profile } from '@/lib/profile';
import { persistConfirmedProfile, removeProfileDraft, PROFILE_STORAGE_KEY, type ProfileSaveResult } from '@/lib/profile-storage';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter, Link } from 'wouter';
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BookOpen, Check, ChevronRight, Compass, FileUser, Gauge, Menu, Network, RotateCcw, Settings2, ShieldCheck, Sparkles, Target, Trash2, X } from 'lucide-react';
import { I18nProvider, useI18n, type Locale } from '@/lib/i18n';
import {
  parseCareerCsv,
} from '@/lib/career-data';

const defaultTitle = 'Career Pathways';
const queryClient = new QueryClient();
const STORAGE_TITLE = 'career-pathways-title';
const STORAGE_PROFILE = PROFILE_STORAGE_KEY;
const navGroups = [
  { label: 'WORKSPACE', links: [
    { href: '/', title: 'Home', icon: Compass },
    { href: '/profile', title: 'My Profile', icon: FileUser },
  ]},
  { label: 'EXPLORE', links: [
    { href: '/skills', title: 'Future Skills Radar', icon: Activity },
    { href: '/roles', title: 'Future Role Matches', icon: Target },
    { href: '/roadmap', title: 'Reskilling Roadmap', icon: BookOpen },
    { href: '/impact', title: 'SDG Impact', icon: Network },
    { href: '/scenarios', title: 'Future Scenarios', icon: Gauge },
  ]},
];
const roadmap = [
  { title:'Explore the role family', duration:'1–2 weeks', detail:'Compare real job descriptions and note recurring responsibilities.', resource:'Resource placeholder · To be verified' },
  { title:'Build a foundations toolkit', duration:'4–6 weeks', detail:'Choose one learning-design or research method to practice in a small project.', resource:'Resource placeholder · To be verified' },
  { title:'Create a practical work sample', duration:'2–3 weeks', detail:'Document a sample workshop, learning module, or customer insight brief.', resource:'Resource placeholder · To be verified' },
  { title:'Ask for informed feedback', duration:'1–2 weeks', detail:'Share your work sample with people familiar with the field.', resource:'Resource placeholder · To be verified' },
];

function readProfile(): Profile | null {
  try {
    const raw=localStorage.getItem(STORAGE_PROFILE);
    if(!raw)return null;
    const parsed=JSON.parse(raw);
    const normalized=normalizeProfile(parsed);
    return normalized?.confirmed_by_user ? normalized : null;
  } catch { return null; }
}
function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Shell({ children, title, hasProfile }: { children: ReactNode; title: string; hasProfile: boolean }) {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { locale, setLocale, t } = useI18n();
  useEffect(() => { document.title = title === defaultTitle ? t('Career Pathways') : title; }, [title, locale]);
  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`} aria-label={t('Main navigation')}>
      <div style={{display:'flex',alignItems:'center',gap:11,padding:'0 10px 27px'}}>
        <div className="brand-mark"><Compass size={19}/></div>
        <div><div style={{font:'700 15px Manrope',letterSpacing:'-.03em'}}>{t('Pathways')}</div><div style={{fontSize:10,color:'#b7c3b8',marginTop:2}}>{t('CAREER WORKSPACE')}</div></div>
        <button className="mobile-menu" style={{marginLeft:'auto',color:'#f2eee3',borderColor:'#536459'}} onClick={()=>setMenuOpen(false)} aria-label={t('Close menu')} data-testid="button-close-menu"><X size={17}/></button>
      </div>
      <div style={{padding:'0 5px',display:'flex',flexDirection:'column',gap:24}}>
        {navGroups.map(group=><div key={group.label}>
          <div style={{font:'500 9px IBM Plex Mono',letterSpacing:'.16em',color:'#93a297',padding:'0 11px 9px'}}>{t(group.label)}</div>
          <nav style={{display:'grid',gap:3}}>{group.links.map(item=>{
            const Icon=item.icon; const active=location===item.href;
            return <Link key={item.href} href={item.href} className={`nav-link ${active?'active':''}`} onClick={()=>setMenuOpen(false)} data-testid={`link-${item.title.toLowerCase().replaceAll(' ','-')}`}>
              <Icon size={16} strokeWidth={1.8}/><span>{t(item.title)}</span>{item.href==='/profile'&&hasProfile?<span style={{marginLeft:'auto',width:6,height:6,borderRadius:'50%',background:'#dfb66a'}}/>:null}
            </Link>;
          })}</nav>
        </div>)}
      </div>
      <div style={{marginTop:'auto'}}>
        <div style={{padding:'14px 13px',background:'#30473d',borderRadius:12,margin:'0 4px 14px'}}>
          <div style={{display:'flex',alignItems:'center',gap:7,color:'#e1bc76',fontSize:11,fontWeight:700}}><ShieldCheck size={14}/> {t('Your workspace')}</div>
          <p style={{fontSize:11,lineHeight:1.55,color:'#c2cdc3',margin:'8px 0 0'}}>{t('Saved on this device only. Examples are illustrative, not recommendations.')}</p>
        </div>
        <Link href="/settings" className={`nav-link ${location==='/settings'?'active':''}`} onClick={()=>setMenuOpen(false)} data-testid="link-settings"><Settings2 size={16}/><span>{t('Workspace settings')}</span></Link>
      </div>
    </aside>
    {menuOpen&&<button aria-label={t('Close navigation overlay')} onClick={()=>setMenuOpen(false)} style={{position:'fixed',inset:0,zIndex:20,border:0,background:'#172a2270'}}/>}
    <div className="main-area">
      <header className="topbar">
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <button className="mobile-menu" onClick={()=>setMenuOpen(true)} aria-label={t('Open menu')} data-testid="button-open-menu"><Menu size={19}/></button>
          <div className="top-title" style={{fontSize:14,fontWeight:700,color:'#34493e'}} data-testid="text-workspace-title">{title}</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div className="language-switch" role="group" aria-label={t('Choose language')} data-testid="language-switch">
            {([
              ['en', 'EN', 'English'],
              ['zh', '简体中文', '简体中文'],
              ['ms', 'BM', 'Bahasa Melayu'],
            ] as const).map(([value, label, accessible]) => <button key={value} type="button" aria-label={accessible} aria-pressed={locale === value} className={locale === value ? 'language-active' : ''} onClick={() => setLocale(value as Locale)} data-testid={`button-language-${value}`}>{label}</button>)}
          </div>
          <div className="workspace-private"><span style={{width:7,height:7,borderRadius:9,background:'#6b9872'}}/> {t('Private workspace')}</div>
        </div>
      </header>
      <main className="content">{children}</main>
    </div>
  </div>;
}

function Home({ profile }: {profile:Profile|null}) {
  const { t } = useI18n();
  const links = [
    {href:'/profile',n:'01',title:'Start with your story',text:'Add skills, experience, interests, and the context that matters to you.',icon:FileUser,cta:profile?'Edit your profile':'Create your profile'},
    {href:'/skills',n:'02',title:'Notice what is changing',text:'Explore a clearly synthetic view of skills that may grow or shift.',icon:Activity,cta:'Explore skills'},
    {href:'/roles',n:'03',title:'Compare possible directions',text:'Review sample role matches with visible strengths and learning gaps.',icon:Target,cta:'View role examples'},
    {href:'/roadmap',n:'04',title:'Make a next-step plan',text:'Turn an interesting direction into manageable learning steps.',icon:BookOpen,cta:'Open roadmap'},
    {href:'/impact',n:'05',title:'Connect work to wider goals',text:'Explore explained SDG links without presenting them as measured impact.',icon:Network,cta:'Explore SDG mapping'},
  ];
  return <>
    <div style={{background:'#e8eadf',borderRadius:20,padding:'clamp(24px,5vw,52px)',position:'relative',overflow:'hidden',marginBottom:28}}>
      <div style={{position:'absolute',right:-55,top:-75,width:290,height:290,border:'1px solid #cbd2c3',borderRadius:'50%'}}/><div style={{position:'absolute',right:-22,top:-42,width:220,height:220,border:'1px solid #cbd2c3',borderRadius:'50%'}}/>
      <div style={{position:'relative',maxWidth:700}}>
        <div className="eyebrow" style={{color:'#627867'}}>{t('A practical place to explore what’s next')}</div>
        <h1 style={{font:'700 clamp(34px,5vw,58px)/1.06 Manrope',letterSpacing:'-.055em',color:'#294237',maxWidth:650,margin:'17px 0'}}>{t('Your experience can open more than one door.')}</h1>
        <p style={{fontSize:15,lineHeight:1.75,color:'#626e62',maxWidth:570,margin:'0 0 24px'}}>{t('Career Pathways helps you map what you already bring to work, explore adjacent roles, and decide what might be worth learning next. No predictions, just a clearer place to think.')}</p>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          <Link href="/profile" className="btn btn-primary" data-testid="link-home-profile">{t(profile?'Review your profile':'Build your profile')} <ArrowRight size={15}/></Link>
          <Link href="/roles" className="btn" data-testid="link-home-roles">{t('Browse role examples')} <ChevronRight size={15}/></Link>
        </div>
      </div>
      <div style={{position:'absolute',right:'8%',bottom:25,display:'flex',alignItems:'center',gap:8,color:'#687767',font:'11px IBM Plex Mono'}} className="hero-note"><Sparkles size={14}/> {t('YOUR NEXT CHAPTER, AT YOUR PACE')}</div>
    </div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'end',gap:14,margin:'0 0 15px'}}>
       <div><div className="eyebrow">{t('A simple way through')}</div><h2 style={{font:'700 22px Manrope',letterSpacing:'-.03em',margin:'5px 0 0',color:'#30483b'}}>{t('Explore at your own pace')}</h2></div>
       <span className="tag">{t('5 steps')}</span>
    </div>
    <div className="home-grid">{links.map(({href,n,title,text,icon:Icon,cta})=><Link key={href} href={href} className="panel home-card" data-testid={`card-home-${n}`}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'start'}}><div style={{width:38,height:38,borderRadius:12,background:'#eff1e8',display:'grid',placeItems:'center',color:'#45644d'}}><Icon size={19}/></div><span style={{font:'12px IBM Plex Mono',color:'#a0a394'}}>{n}</span></div>
       <h3 style={{font:'700 17px Manrope',letterSpacing:'-.02em',margin:'20px 0 7px',color:'#30483b'}}>{t(title)}</h3><p style={{fontSize:12,lineHeight:1.65,color:'#71786c',margin:'0 0 18px'}}>{t(text)}</p><div style={{fontSize:12,fontWeight:700,color:'#47634f',display:'flex',gap:6,alignItems:'center'}}>{t(cta)}<ArrowRight size={14}/></div>
    </Link>)}</div>
    <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:18,alignItems:'center',marginTop:26,padding:'17px 20px',borderTop:'1px solid #dcded3',borderBottom:'1px solid #dcded3'}}>
       <div><div className="eyebrow">{t('A note on examples')}</div><p style={{fontSize:12,lineHeight:1.6,color:'#697269',margin:'5px 0 0'}}>{t('All skills, role scores, durations, and scenario values are illustrative synthetic examples. They are not live labor-market data, verified recommendations, or promises of outcomes.')}</p></div><Link href="/settings" className="btn" data-testid="link-home-settings">{t('Settings')} <ArrowRight size={14}/></Link>
    </div>
     <style>{`.home-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}.home-card{padding:18px;text-decoration:none;transition:transform .2s,box-shadow .2s}.home-card:hover{transform:translateY(-3px);box-shadow:0 12px 25px #35463712}@media(max-width:1100px){.home-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:720px){.home-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:470px){.home-grid{grid-template-columns:1fr}.hero-note{display:none!important}}`}</style>
  </>;
}
export function LegacyRoadmapPage() {
 return <><PageHeading kicker="Turn curiosity into action" title="Reskilling Roadmap" description="A flexible example sequence for exploring a new direction. Adjust the pace to fit your life; time estimates are illustrative only."/>
  <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:20}}><span className="tag"><Activity size={12} style={{marginRight:5}}/> Illustrative durations</span><span className="tag">Learning resources are placeholders</span></div>
  <div style={{position:'relative',display:'grid',gap:14,maxWidth:850}}>{roadmap.map((step,i)=><article key={step.title} className="panel" style={{display:'grid',gridTemplateColumns:'38px 1fr auto',gap:15,alignItems:'start',padding:'20px 22px'}} data-testid={`step-roadmap-${i}`}>
    <div style={{position:'relative',height:'100%'}}>{i<roadmap.length-1&&<div className="timeline-line"/>}<div className="step-dot">{String(i+1).padStart(2,'0')}</div></div>
    <div><div style={{display:'flex',gap:9,alignItems:'center',flexWrap:'wrap'}}><h2 style={{font:'700 16px Manrope',margin:0,color:'#30483b'}}>{step.title}</h2><span className="tag" style={{fontSize:10}}>{step.duration} · estimate</span></div><p style={{fontSize:12,color:'#72796f',lineHeight:1.6,margin:'8px 0 13px'}}>{step.detail}</p><span style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:11,color:'#8b7055',background:'#f7f0e5',borderRadius:7,padding:'6px 9px'}}><BookOpen size={12}/>{step.resource}</span></div>
    <ChevronRight size={16} color="#a4aa9e" style={{marginTop:8}}/>
  </article>)}</div>
  <div className="panel" style={{maxWidth:850,marginTop:17,background:'#edf0e7'}}><div style={{display:'flex',gap:12}}><ShieldCheck size={18} color="#57745f"/><div><strong style={{fontSize:13,color:'#3b5543'}}>Keep it grounded</strong><p style={{fontSize:12,color:'#6c776a',lineHeight:1.6,margin:'4px 0 0'}}>Learning pathways depend on your circumstances and local opportunities. Check course details, cost, accessibility, and relevance before committing.</p></div></div></div>
 </>;
}
export function LegacyImpactPage() {
 const sdgs=[
  {n:'04',title:'Quality Education',tone:'#b75b4c',text:'Learning and reskilling can support lifelong learning. A career pathway can help someone notice what they want to learn next; this workspace does not deliver education itself.'},
  {n:'08',title:'Decent Work and Economic Growth',tone:'#9a7453',text:'Exploring work transitions may support informed career choices. The examples here do not guarantee job access, decent work, or economic outcomes.'},
  {n:'10',title:'Reduced Inequalities',tone:'#a65d70',text:'Reflecting on transferable skills can make possible routes more visible. This tool cannot assess or remove structural barriers to opportunity.'},
 ];
 return <><PageHeading kicker="Connect work to wider goals" title="SDG Impact" description="A thoughtful, non-claiming look at how career exploration relates to selected UN Sustainable Development Goals."/>
  <div style={{background:'#e8eadf',padding:'22px 25px',borderRadius:15,marginBottom:20,display:'flex',gap:15,alignItems:'start'}}><div style={{width:38,height:38,flex:'0 0 auto',background:'#d9dfd1',borderRadius:11,display:'grid',placeItems:'center',color:'#47634e'}}><Network size={19}/></div><div><strong style={{font:'700 15px Manrope',color:'#30483b'}}>A connection, not a claim.</strong><p style={{fontSize:12,lineHeight:1.7,color:'#697366',margin:'5px 0 0'}}>The UN SDGs are broad global aims. Career planning may intersect with some of them, but using this app does not directly measure or deliver progress toward any goal.</p></div></div>
  <div style={{display:'grid',gap:13}}>{sdgs.map(s=><article className="panel sdg-row" key={s.n} data-testid={`card-sdg-${s.n}`} style={{display:'grid',gridTemplateColumns:'72px 1fr',gap:19,alignItems:'center',padding:21}}>
   <div style={{width:68,height:68,background:s.tone,color:'#fff',borderRadius:13,display:'flex',flexDirection:'column',justifyContent:'center',paddingLeft:12}}><span style={{font:'700 22px Manrope',lineHeight:1}}>{s.n}</span><span style={{font:'500 8px IBM Plex Mono',marginTop:4,opacity:.87}}>UN SDG</span></div>
   <div><h2 style={{font:'700 17px Manrope',margin:'0 0 7px',color:'#30483b'}}>{s.title}</h2><p style={{fontSize:12,lineHeight:1.7,color:'#737a70',margin:0}}>{s.text}</p></div>
  </article>)}</div>
  <p style={{fontSize:10,color:'#899084',marginTop:15}}>Goal names refer to the United Nations Sustainable Development Goals. This summary is explanatory and not an official UN assessment.</p>
  <style>{`@media(max-width:470px){.sdg-row{grid-template-columns:56px 1fr!important;gap:13px!important;padding:15px!important}.sdg-row>div:first-child{width:54px!important;height:58px!important;padding-left:9px!important}}`}</style>
 </>;
}
export function LegacyScenariosPage() {
 const scenarios=[
  {name:'Moderate disruption',pace:'Gradual shifts',accent:'#66856c',assumptions:[['Routine task exposure','Some tasks shift'],['Work redesign','Steady adaptation'],['New skill demand','Incremental change']],body:'An illustrative case where adoption is uneven, and work changes through a series of smaller adjustments.'},
  {name:'Fast disruption',pace:'Quicker shifts',accent:'#b88458',assumptions:[['Routine task exposure','More tasks shift'],['Work redesign','Rapid adaptation'],['New skill demand','Faster change']],body:'An illustrative case where tools are adopted more quickly and teams revisit responsibilities sooner.'},
 ];
 return <><PageHeading kicker="Think in possibilities" title="Future Scenarios" description="Two ways to think about change—not forecasts. Every value and description below is an illustrative assumption, not a prediction."/>
  <div style={{background:'#eceee4',borderRadius:11,padding:'13px 16px',display:'flex',gap:9,alignItems:'center',color:'#667166',fontSize:11,marginBottom:19}}><ShieldCheck size={16} color="#57745f"/> Scenario assumptions are synthetic prompts for discussion. They are not measured probabilities or evidence about your future.</div>
  <div className="scenario-grid">{scenarios.map((s,i)=><article className="panel" key={s.name} data-testid={`card-scenario-${i}`} style={{padding:'24px'}}>
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'start'}}><div><div className="eyebrow">ILLUSTRATIVE ASSUMPTION {String(i+1).padStart(2,'0')}</div><h2 style={{font:'700 21px Manrope',color:'#30483b',margin:'9px 0 4px'}}>{s.name}</h2><span style={{fontSize:12,color:s.accent,fontWeight:700}}>{s.pace}</span></div><div style={{width:38,height:38,borderRadius:12,background:i?'#f6eee4':'#edf1e8',display:'grid',placeItems:'center',color:s.accent}}>{i?<ArrowUpRight size={18}/>:<ArrowDownRight size={18}/>}</div></div>
   <p style={{fontSize:12,color:'#737a70',lineHeight:1.65,margin:'18px 0 20px'}}>{s.body}</p>
   <div style={{display:'grid',gap:9}}>{s.assumptions.map(([k,v])=><div className="scenario-block" key={k} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10}}><span style={{fontSize:11,color:'#6f776c'}}>{k}</span><span style={{fontSize:11,fontWeight:700,color:'#3d5646',textAlign:'right'}}>{v}</span></div>)}</div>
   <div style={{marginTop:15,font:'10px IBM Plex Mono',color:'#92968a'}}>EACH LABEL = ILLUSTRATIVE ASSUMPTION</div>
  </article>)}</div>
  <div className="panel" style={{marginTop:17}}><h3 style={{font:'700 14px Manrope',color:'#30483b',margin:'0 0 6px'}}>Use scenarios as questions</h3><p style={{fontSize:12,lineHeight:1.65,color:'#737a70',margin:0}}>Which parts of your work feel routine? Which parts rely on trust, context, creativity, or care? What small experiment could help you learn more?</p></div>
  <style>{`.scenario-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}@media(max-width:640px){.scenario-grid{grid-template-columns:1fr}}`}</style>
 </>;
}
function SettingsPage({title,onTitleChange,onReset}:{title:string;onTitleChange:(v:string)=>void;onReset:()=>void}) {
 const { t } = useI18n();
 const [draft,setDraft]=useState(title);
 const [saved,setSaved]=useState(false);
 useEffect(()=>setDraft(title),[title]);
  return <><PageHeading kicker={t('Make this space yours')} title={t('Workspace Settings')} description={t('Choose a name for this workspace and manage the information saved on this device.')}/>
   <section className="panel" style={{maxWidth:740,marginBottom:16}}><div style={{display:'flex',gap:13,alignItems:'center',marginBottom:20}}><div style={{width:40,height:40,display:'grid',placeItems:'center',background:'#edf0e7',borderRadius:12,color:'#52705a'}}><Settings2 size={19}/></div><div><h2 style={{font:'700 17px Manrope',color:'#30483b',margin:0}}>{t('Workspace name')}</h2><p style={{fontSize:12,color:'#7a8176',margin:'4px 0 0'}}>{t('Only visible in this browser.')}</p></div></div>
    <label className="label" htmlFor="workspace-name">{t('Project title')}</label><div className="settings-title-form"><input id="workspace-name" className="field" maxLength={48} value={draft} onChange={e=>{setDraft(e.target.value);setSaved(false)}} data-testid="input-workspace-title"/><button className="btn btn-primary" onClick={()=>{const name=draft.trim()||defaultTitle;setDraft(name);onTitleChange(name);setSaved(true)}} data-testid="button-save-title">{t('Save title')} <Check size={14}/></button></div>{saved&&<p style={{fontSize:11,color:'#52745b',margin:'9px 0 0'}} role="status" data-testid="status-title-saved">{t('Workspace title saved on this device.')}</p>}
  </section>
   <section className="panel" style={{maxWidth:740,borderColor:'#e4d7ca'}}><div style={{display:'flex',gap:13,alignItems:'start'}}><div style={{width:40,height:40,flex:'0 0 auto',display:'grid',placeItems:'center',background:'#f6eee5',borderRadius:12,color:'#9a6e50'}}><RotateCcw size={18}/></div><div><h2 style={{font:'700 17px Manrope',color:'#30483b',margin:'2px 0 6px'}}>{t('Reset workspace data')}</h2><p style={{fontSize:12,color:'#737a70',lineHeight:1.65,margin:'0 0 17px'}}>{t('This removes the saved profile and returns the title to “Career Pathways.” Your illustrative examples remain available. This action cannot be undone.')}</p><button className="btn btn-danger" onClick={()=>{if(window.confirm(t('Reset workspace data? Your saved profile and custom title will be permanently removed from this device.')))onReset()}} data-testid="button-reset-workspace"><Trash2 size={14}/> {t('Reset profile and title')}</button></div></div></section>
   <div style={{marginTop:19,fontSize:11,color:'#8a9085',lineHeight:1.7,maxWidth:740}}>{t('Privacy note: profile and title are stored in your browser’s local storage. There is no account, backend, or cloud sync. Clearing browser storage will remove this information.')}</div>
  <style>{`.settings-title-form{display:grid;grid-template-columns:1fr auto;gap:9px}@media(max-width:460px){.settings-title-form{grid-template-columns:1fr}}`}</style>
 </>;
}
function Router() {
  const { t } = useI18n();
 const [title,setTitle]=useState(()=>localStorage.getItem(STORAGE_TITLE)||defaultTitle);
 const [profile,setProfile]=useState<Profile|null>(()=>readProfile());
 const [dataset,setDataset]=useState<DatasetState>({records:[],errors:[],loading:true,loadError:''});
 const [selected,setSelected]=useState(()=>localStorage.getItem('career-pathways-occupation')||'');
 const [scenario,setScenario]=useState<ScenarioId>(()=>localStorage.getItem('career-pathways-scenario')==='fast'?'fast':'moderate');
 const occupations=Array.from(new Set(dataset.records.map(record=>record.occupation)));
 const selectedOccupation=occupations.includes(selected)?selected:occupations[0]||'';
 const chooseOccupation=(occupation:string)=>{setSelected(occupation);localStorage.setItem('career-pathways-occupation',occupation);};
 const chooseScenario=(next:ScenarioId)=>{setScenario(next);localStorage.setItem('career-pathways-scenario',next);};
 const selectionProps={occupations,selectedOccupation,onSelectOccupation:chooseOccupation};
 useEffect(()=>localStorage.setItem(STORAGE_TITLE,title),[title]);
 useEffect(()=>{
  let cancelled=false;
  const loadDataset=async()=>{
   try{
    const response=await fetch(`${import.meta.env.BASE_URL}data/skills-occupations.csv`);
    if(!response.ok)throw new Error(`Request failed with status ${response.status}`);
    const parsed=parseCareerCsv(await response.text());
    if(!cancelled)setDataset({...parsed,loading:false,loadError:''});
   }catch(error){
    if(!cancelled)setDataset({records:[],errors:[],loading:false,loadError:error instanceof Error?error.message:'Unknown loading error'});
   }
  };
  void loadDataset();
  return()=>{cancelled=true};
 },[]);
 const saveProfile=(next:Profile):ProfileSaveResult=>{
  try{
   const result=persistConfirmedProfile(localStorage,next);
   if(result.ok)setProfile(next);
   return result;
  }catch{return {ok:false};}
 };
 const clearDraft=()=>{try{removeProfileDraft(sessionStorage);}catch{/* Storage access may be blocked. */}};
 const deleteProfile=()=>{localStorage.removeItem(STORAGE_PROFILE);clearDraft();setProfile(null);};
 const reset=()=>{localStorage.removeItem(STORAGE_PROFILE);localStorage.removeItem(STORAGE_TITLE);clearDraft();setProfile(null);setTitle(defaultTitle);};
   return <RoutedErrorBoundary><Shell title={title===defaultTitle?t('Career Pathways'):title} hasProfile={Boolean(profile)}><PlanningStyles/><nav aria-label={t('Career exploration steps')} className="journey-nav" style={{display:'flex',gap:12,flexWrap:'wrap',fontSize:11,marginBottom:24}}>{[['/profile','1. Profile'],['/skills','2. Skills radar'],['/roles','3. Role matches'],['/roadmap','4. Learning plan'],['/impact','5. SDG mapping']].map(([href,label])=><Link href={href} key={href} data-testid={`link-journey-${href.slice(1)}`}>{t(label)}</Link>)}</nav><Switch>
   <Route path="/"><Home profile={profile}/></Route>
   <Route path="/profile"><ProfilePage profile={profile} onSave={saveProfile} onDelete={deleteProfile}/></Route>
   <Route path="/skills"><SkillsPage dataset={dataset}/></Route>
   <Route path="/roles"><RolesPage dataset={dataset} profileSkills={profile?.skills??''} onChooseOccupation={chooseOccupation}/></Route>
   <Route path="/roadmap"><DatasetFeedback dataset={dataset}/><PersonalisedRoadmapPage {...selectionProps} records={dataset.records} profileSkills={profile?.skills??''}/></Route>
   <Route path="/impact"><DatasetFeedback dataset={dataset}/><OccupationImpactPage {...selectionProps}/></Route>
   <Route path="/scenarios"><DatasetFeedback dataset={dataset}/><FutureScenarioPage scenario={scenario} onScenarioChange={chooseScenario} records={dataset.records} profileSkills={profile?.skills??''}/></Route>
   <Route path="/settings"><SettingsPage title={title} onTitleChange={setTitle} onReset={reset}/></Route>
   <Route component={NotFound}/>
  </Switch></Shell></RoutedErrorBoundary>;
}
function App() {
  return <I18nProvider><QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router/></WouterRouter><Toaster/></TooltipProvider></QueryClientProvider></I18nProvider>;
}
export default App;
