import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowDownLeft, Bot, Check, CheckCircle2, ChevronRight, CalendarDays,
  CircleDollarSign, Clock3, FileText, FolderOpen, ListTodo, Plus, ShieldCheck,
  Sparkles, Wallet, X
} from 'lucide-react';
import './work-assistant.css';

type TaskStatus = 'queued' | 'in_progress' | 'done';
type WorkSource = 'file' | 'website' | 'message' | 'manual';
type WorkTask = {
  id: string; title: string; source: WorkSource; status: TaskStatus;
  payout: number; createdAt: string; completedAt?: string;
};
type Paycheck = {
  id: string; date: string; gross: number; allowance: number; note: string;
};
type StoredState = { tasks: WorkTask[]; paychecks: Paycheck[]; savingsAdjustment: number };

const STORAGE_KEY = 'work-assistant-m1-v1';
const PAY_PER_TASK = 15;
const ALLOWANCE_PER_PAYCHECK = 25;
const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
const today = () => { const d = new Date(); const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 10); };
const initialState: StoredState = { tasks: [], paychecks: [], savingsAdjustment: 0 };

function readState(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw);
    return {
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      paychecks: Array.isArray(parsed.paychecks) ? parsed.paychecks : [],
      savingsAdjustment: Number(parsed.savingsAdjustment) || 0
    };
  } catch { return initialState; }
}

export default function App() {
  const [state, setState] = useState<StoredState>(readState);
  const [tab, setTab] = useState<'home' | 'tasks' | 'routine' | 'pay' | 'assistant'>('home');
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showPayForm, setShowPayForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskSource, setTaskSource] = useState<WorkSource>('manual');
  const [payDate, setPayDate] = useState(today());
  const [payGross, setPayGross] = useState('');
  const [payNote, setPayNote] = useState('');

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage may be unavailable */ }
  }, [state]);

  const completedToday = state.tasks.filter(t => t.status === 'done' && t.completedAt?.slice(0, 10) === today()).length;
  const openTasks = state.tasks.filter(t => t.status !== 'done');
  const completedTasks = state.tasks.filter(t => t.status === 'done').length;
  const totalPay = state.paychecks.reduce((sum, p) => sum + p.gross, 0);
  const totalAllowances = state.paychecks.reduce((sum, p) => sum + p.allowance, 0);
  const savings = state.paychecks.reduce((sum, p) => sum + Math.max(0, p.gross - p.allowance), 0) + state.savingsAdjustment;
  const taskEarningsEstimate = completedTasks * PAY_PER_TASK;
  const averagePaycheckSavings = state.paychecks.length ? savings / state.paychecks.length : 0;
  const weekTasks = useMemo(() => {
    const start = new Date(); start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0);
    return state.tasks.filter(t => t.status === 'done' && t.completedAt && new Date(t.completedAt) >= start).length;
  }, [state.tasks]);

  const addTask = (event: React.FormEvent) => {
    event.preventDefault();
    const title = taskTitle.trim();
    if (!title) return;
    const task: WorkTask = { id: crypto.randomUUID(), title, source: taskSource, status: 'queued', payout: PAY_PER_TASK, createdAt: new Date().toISOString() };
    setState(current => ({ ...current, tasks: [task, ...current.tasks] }));
    setTaskTitle(''); setTaskSource('manual'); setShowTaskForm(false); setTab('tasks');
  };

  const updateTask = (id: string, status: TaskStatus) => {
    setState(current => ({ ...current, tasks: current.tasks.map(task => task.id === id
      ? { ...task, status, completedAt: status === 'done' ? new Date().toISOString() : undefined }
      : task) }));
  };

  const addPaycheck = (event: React.FormEvent) => {
    event.preventDefault();
    const gross = Number(payGross);
    if (!Number.isFinite(gross) || gross <= 0) return;
    const paycheck: Paycheck = { id: crypto.randomUUID(), date: payDate, gross, allowance: Math.min(ALLOWANCE_PER_PAYCHECK, gross), note: payNote.trim() };
    setState(current => ({ ...current, paychecks: [paycheck, ...current.paychecks] }));
    setPayGross(''); setPayNote(''); setShowPayForm(false);
  };

  const deleteTask = (id: string) => setState(current => ({ ...current, tasks: current.tasks.filter(t => t.id !== id) }));
  const deletePaycheck = (id: string) => setState(current => ({ ...current, paychecks: current.paychecks.filter(p => p.id !== id) }));

  return (
    <div className="wa-shell">
      <header className="wa-header">
        <div className="wa-brand"><div className="wa-brand-mark"><Bot size={21} /></div><div><div className="wa-brand-name">Denwork</div><div className="wa-brand-caption">YOUR WORK COMPANION</div></div></div>
        <div className="wa-online"><span /> Local mode</div>
      </header>

      <main className="wa-main">
        {tab === 'home' && <>
          <section className="wa-greeting">
            <div className="wa-eyebrow"><Sparkles size={14} /> YOUR LITTLE WORK HQ</div>
            <h1>Make progress,<br /><em>one task at a time.</em></h1>
            <p>Your work, pay, and savings in one calm place.</p>
          </section>
          <section className="wa-hero-card">
            <div className="wa-hero-top"><span>DAILY TASK GOAL</span><span>{Math.min(completedToday, 3)} OF 3</span></div>
            <div className="wa-progress"><div style={{ width: Math.min(completedToday / 3 * 100, 100) + '%' }} /></div>
            <div className="wa-hero-bottom"><div><strong>{completedToday}</strong><span>completed today</span></div><button className="wa-button wa-button-light" onClick={() => { setTab('tasks'); setShowTaskForm(true); }}><Plus size={16} /> Add task</button></div>
          </section>
          <section className="wa-metric-grid">
            <div className="wa-metric"><div className="wa-metric-icon amber"><CircleDollarSign size={18} /></div><span>PAY RECORDED</span><strong>{money(totalPay)}</strong><small>Across {state.paychecks.length} paychecks</small></div>
            <div className="wa-metric"><div className="wa-metric-icon green"><Wallet size={18} /></div><span>SAVINGS TRACKED</span><strong>{money(savings)}</strong><small>After personal allowance</small></div>
            <div className="wa-metric"><div className="wa-metric-icon purple"><ListTodo size={18} /></div><span>OPEN TASKS</span><strong>{openTasks.length}</strong><small>{completedTasks} completed total</small></div>
            <div className="wa-metric"><div className="wa-metric-icon blue"><Activity size={18} /></div><span>LAST 7 DAYS</span><strong>{weekTasks}</strong><small>Tasks completed</small></div>
          </section>
          <section className="wa-section">
            <div className="wa-section-heading"><div><span className="wa-eyebrow">IN YOUR QUEUE</span><h2>Next up</h2></div><button className="wa-text-button" onClick={() => setTab('tasks')}>All tasks <ChevronRight size={15} /></button></div>
            {openTasks.length ? <div className="wa-task-list">{openTasks.slice(0, 3).map(task => <TaskRow key={task.id} task={task} onAdvance={() => updateTask(task.id, task.status === 'queued' ? 'in_progress' : 'done')} onDelete={() => deleteTask(task.id)} />)}</div> : <EmptyState title="Your queue is clear" detail="Add a task when new work arrives." />}
          </section>
          <section className="wa-note"><ShieldCheck size={19} /><div><strong>Your work stays yours</strong><p>This first version saves to this device. Cloud sync and AI automation come in the next milestone.</p></div></section>
        </>}

        {tab === 'tasks' && <>
          <PageHeading eyebrow="WORKFLOW" title="Task board" detail="Capture work from files, websites, messages, or a quick note." action={<button className="wa-button" onClick={() => setShowTaskForm(true)}><Plus size={16} /> New task</button>} />
          <div className="wa-inline-stats"><span><strong>{openTasks.length}</strong> open</span><span><strong>{completedTasks}</strong> completed</span><span><strong>{money(taskEarningsEstimate)}</strong> estimated task value*</span></div>
          <p className="wa-footnote">*Estimate only. Actual pay is recorded from your paycheck, not assumed from task completion.</p>
          {state.tasks.length ? <div className="wa-task-list">{state.tasks.map(task => <TaskRow key={task.id} task={task} onAdvance={() => updateTask(task.id, task.status === 'queued' ? 'in_progress' : task.status === 'in_progress' ? 'done' : 'queued')} onDelete={() => deleteTask(task.id)} />)}</div> : <EmptyState title="No tasks yet" detail="Add your first task to start your work queue." />}
        </>}

        {tab === 'routine' && <RoutinePanel />}

        {tab === 'pay' && <>
          <PageHeading eyebrow="MONEY LOG" title="Pay & savings" detail="Record real paychecks and keep your $25 personal allowance visible." action={<button className="wa-button" onClick={() => setShowPayForm(true)}><Plus size={16} /> Add paycheck</button>} />
          <section className="wa-pay-summary"><div><span>TOTAL PAY RECORDED</span><strong>{money(totalPay)}</strong></div><div><span>ALLOWANCES SET ASIDE</span><strong>{money(totalAllowances)}</strong></div><div><span>ESTIMATED SAVINGS</span><strong>{money(savings)}</strong></div></section>
          <div className="wa-callout"><Wallet size={20} /><div><strong>Your rule: $25 per paycheck</strong><p>Every saved paycheck subtracts a $25 personal allowance. Average savings per recorded paycheck: {money(averagePaycheckSavings)}.</p></div></div>
          <div className="wa-section-heading"><div><span className="wa-eyebrow">HISTORY</span><h2>Paychecks</h2></div></div>
          {state.paychecks.length ? <div className="wa-pay-list">{state.paychecks.map(pay => <div className="wa-pay-row" key={pay.id}><div className="wa-pay-icon"><ArrowDownLeft size={18} /></div><div className="wa-pay-details"><strong>{money(pay.gross)} paycheck</strong><span>{pay.date}{pay.note ? ' · ' + pay.note : ''}</span><small>{money(Math.max(0, pay.gross - pay.allowance))} saved · {money(pay.allowance)} allowance</small></div><button className="wa-icon-button" aria-label="Delete paycheck record" onClick={() => deletePaycheck(pay.id)}><X size={16} /></button></div>)}</div> : <EmptyState title="No paychecks recorded" detail="Add a paycheck when you receive it to track actual savings." />}
        </>}

        {tab === 'assistant' && <>
          <PageHeading eyebrow="AI WORKMATE" title="Assistant" detail="A careful helper for repetitive work, with you in control." />
          <section className="wa-assistant-card"><div className="wa-assistant-orb"><Bot size={30} /></div><div className="wa-eyebrow"><Sparkles size={14} /> MILESTONE 2</div><h2>Your AI teammate is next.</h2><p>The first milestone builds your task and pay foundation. Next, we'll connect a hosted AI model through a secure backend so your API key never lives in the phone app.</p><div className="wa-capability"><CheckCircle2 size={17} /><span>Summarize work instructions and messages</span></div><div className="wa-capability"><CheckCircle2 size={17} /><span>Extract titles and sort imported files</span></div><div className="wa-capability"><CheckCircle2 size={17} /><span>Prepare changes for your approval</span></div><div className="wa-capability"><Clock3 size={17} /><span>Run approved jobs in the cloud and notify you</span></div></section>
          <section className="wa-section"><div className="wa-section-heading"><div><span className="wa-eyebrow">PLANNED INPUTS</span><h2>Bring work in</h2></div></div><div className="wa-input-options"><div><FileText size={20}/><strong>Files</strong><span>Upload or import</span></div><div><FolderOpen size={20}/><strong>Websites</strong><span>Approved pages</span></div><div><ArrowDownLeft size={20}/><strong>Messages</strong><span>Paste or connect</span></div></div></section>
        </>}
      </main>

      <nav className="wa-tabbar" aria-label="Main navigation">
        <NavItem active={tab === 'home'} icon={<Activity size={19}/>} label="Home" onClick={() => setTab('home')} />
        <NavItem active={tab === 'tasks'} icon={<ListTodo size={19}/>} label="Tasks" onClick={() => setTab('tasks')} />
        <NavItem active={tab === 'routine'} icon={<CalendarDays size={19}/>} label="Routine" onClick={() => setTab('routine')} />
        <NavItem active={tab === 'pay'} icon={<Wallet size={19}/>} label="Pay" onClick={() => setTab('pay')} />
        <NavItem active={tab === 'assistant'} icon={<Bot size={19}/>} label="AI helper" onClick={() => setTab('assistant')} />
      </nav>

      {showTaskForm && <Modal title="Add a work task" onClose={() => setShowTaskForm(false)}><form className="wa-form" onSubmit={addTask}><label>What needs doing?<input autoFocus value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="e.g. Import and sort an article" required maxLength={180}/></label><label>Where did it come from?<select value={taskSource} onChange={e => setTaskSource(e.target.value as WorkSource)}><option value="manual">Quick note</option><option value="file">File</option><option value="website">Website</option><option value="message">Message</option></select></label><div className="wa-form-hint">Default task rate: {money(PAY_PER_TASK)}. Pay is only counted when recorded in a paycheck.</div><div className="wa-form-actions"><button type="button" className="wa-button wa-button-muted" onClick={() => setShowTaskForm(false)}>Cancel</button><button className="wa-button" type="submit"><Plus size={16}/> Add task</button></div></form></Modal>}
      {showPayForm && <Modal title="Record a paycheck" onClose={() => setShowPayForm(false)}><form className="wa-form" onSubmit={addPaycheck}><label>Pay date<input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} required/></label><label>Amount received ($)<input type="number" min="0.01" step="0.01" inputMode="decimal" value={payGross} onChange={e => setPayGross(e.target.value)} placeholder="e.g. 110.00" required/></label><label>Note (optional)<input value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="Tasks covered by this paycheck"/></label><div className="wa-pay-preview"><span>Personal allowance</span><strong>{money(ALLOWANCE_PER_PAYCHECK)}</strong><span>Estimated amount saved</span><strong>{money(Math.max(0, Number(payGross || 0) - ALLOWANCE_PER_PAYCHECK))}</strong></div><div className="wa-form-hint">This records the paycheck amount you enter. It doesn't connect to your bank or move money.</div><div className="wa-form-actions"><button type="button" className="wa-button wa-button-muted" onClick={() => setShowPayForm(false)}>Cancel</button><button className="wa-button" type="submit"><Check size={16}/> Save paycheck</button></div></form></Modal>}
    </div>
  );
}

function PageHeading({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail: string; action?: React.ReactNode }) {
  return <section className="wa-page-heading"><div><span className="wa-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{detail}</p></div>{action}</section>;
}
function NavItem({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button className={'wa-nav-item' + (active ? ' active' : '')} onClick={onClick}>{icon}<span>{label}</span></button>;
}
function TaskRow({ task, onAdvance, onDelete }: { task: WorkTask; onAdvance: () => void; onDelete: () => void }) {
  const sourceLabels: Record<WorkSource, string> = { file: 'File', website: 'Website', message: 'Message', manual: 'Quick note' };
  return <div className={'wa-task-row ' + task.status}><button className={'wa-task-check ' + (task.status === 'done' ? 'checked' : '')} aria-label="Advance task status" onClick={onAdvance}>{task.status === 'done' ? <Check size={16}/> : task.status === 'in_progress' ? <Clock3 size={16}/> : <Plus size={16}/>}</button><div className="wa-task-content"><strong>{task.title}</strong><div className="wa-task-meta"><span>{sourceLabels[task.source]}</span><span className={'wa-status status-' + task.status}>{task.status === 'queued' ? 'Queued' : task.status === 'in_progress' ? 'In progress' : 'Done'}</span></div></div><span className="wa-task-rate">{money(task.payout)}</span><button className="wa-icon-button" aria-label="Delete task" onClick={onDelete}><X size={15}/></button></div>;
}
function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="wa-empty"><div><ListTodo size={22}/></div><strong>{title}</strong><p>{detail}</p></div>;
}
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="wa-modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section className="wa-modal" role="dialog" aria-modal="true" aria-label={title}><div className="wa-modal-heading"><h2>{title}</h2><button className="wa-icon-button" aria-label="Close dialog" onClick={onClose}><X size={18}/></button></div>{children}</section></div>;
}

const ROUTINES = [
  {day:'Monday',title:'Inventory & station prep',tasks:[
    ['seeds','Check seeds. Add a red reorder card if low.'],
    ['soil','Check soil and coir bins.'],
    ['paper','Check paper towels and packing supplies.','Double-check the original instruction.'],
    ['clamshells','Check clamshells.'],
    ['variety','Check variety sticker rolls.'],
    ['traps','Check sticky traps; replace dirty ones.'],
    ['soak','Set out soaking jars and scoops.'],
    ['weight','Move trays to the weighted stage. Add weights.']
  ]},
  {day:'Tuesday',title:'Planting day #1',tasks:[
    ['batch1','Plant Batch #1.'],
    ['weight','Move trays to the Weighted Phase and place visual weight blocks on top.'],
    ['water','Water active racks (top and bottom).']
  ]},
  {day:'Wednesday',title:'Harvest #1 + planting #2',tasks:[
    ['batchcheck','Check the batch number before planting.','Batch number is unclear in the source photo—confirm before planting.'],
    ['harvest','Harvest orders, weigh packs, and add delivery labels.'],
    ['batch2','Plant Batch #2.'],
    ['weight','Move trays to the Weighted Phase and place visual weight blocks on top.'],
    ['stage','Put finished packs in the delivery fridge totes.'],
    ['water','Top-/bottom-water active growing racks.']
  ]},
  {day:'Thursday',title:'Delivery + planting #3',tasks:[
    ['load','Load delivery totes for the route.'],
    ['drop','Deliver subscriber and restaurant orders.'],
    ['batch3','Plant Batch #3.'],
    ['lights','Bottom-water racks and check lights.'],
    ['water','Water the crops.']
  ]},
  {day:'Friday',title:'Harvest #2 + market prep',tasks:[
    ['harvest','Harvest bulk trays for market.'],
    ['pack','Pack clamshells and add price stickers.'],
    ['totes','Pack market gear: tents, tables, displays, clamshells, blank labels, and cash/token box.'],
    ['inventory','Count products on the inventory sheet.'],
    ['cuttrays','Choose which extra trays to cut.'],
    ['water','Top-/bottom-water active growing racks.']
  ]},
  {day:'Saturday',title:'Farmers market day #1',tasks:[
    ['coolers','Pack coolers and ice packs.'],
    ['setup','Set up tables using the market layout picture.','One station name is hard to read—check the original photo.'],
    ['sell','Sell products; use the customer script and price guide.'],
    ['breakdown','Pack up totes and count what is left.'],
    ['inventory','Count all products on the inventory sheet.'],
    ['health','Quick-water crops and check for good vs. bad fuzz.'],
    ['harvest','Harvest trays, pack clamshells, and add prices.']
  ]},
  {day:'Sunday',title:'Farmers market day #2',tasks:[
    ['water','Quick-water the crops.'],
    ['setup','Set up the display and tables.'],
    ['sell','Run the market.'],
    ['unload','Unload the vehicle at the farm.'],
    ['sanitize','Clean returned totes and ice packs.']
  ]}
];
const LABELS = ['Amaranth','Arugula','Basil','Beet','Broccoli','Cabbage','Cantaloupe','Chard','Cilantro','Onion','Peas kale superfood smoothie booster','Peas sunflower radish salad mix','Peas sunflower radish salad spicy mix','Radish','Superfood mix','Sunflower','Sweet pea','Wasabi','Wheatgrass','Kale'];
const LABELS_PRESENT = new Set(LABELS.filter(x => x !== 'Sweet pea' && x !== 'Kale'));
function RoutinePanel() {
  const [day, setDay] = useState(['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()]);
  const [checks, setChecks] = useState<Record<string, boolean>>(() => { try { return JSON.parse(localStorage.getItem('denwork-routine-checks-v1') || '{}'); } catch { return {}; } });
  const [labels, setLabels] = useState<Record<string, {exists:boolean; full:boolean}>>(() => { try { return JSON.parse(localStorage.getItem('denwork-label-status-v1') || '{}'); } catch { return {}; } });
  const monday = new Date(); monday.setHours(0,0,0,0); monday.setDate(monday.getDate() - ((monday.getDay()+6)%7));
  const week = monday.getFullYear() + '-' + String(monday.getMonth()+1).padStart(2,'0') + '-' + String(monday.getDate()).padStart(2,'0');
  const toggle = (id:string, checked:boolean) => { const next={...checks,[week+':'+id]:checked}; setChecks(next); try { localStorage.setItem('denwork-routine-checks-v1',JSON.stringify(next)); } catch {} };
  const setLabel = (name:string,field:'exists'|'full',value:boolean) => { const prev=labels[name] || {exists:LABELS_PRESENT.has(name),full:name==='Peas sunflower radish salad mix'}; const next={...labels,[name]:{...prev,[field]:value}}; setLabels(next); try {localStorage.setItem('denwork-label-status-v1',JSON.stringify(next));} catch {} };
  const all = ROUTINES.reduce((n,d)=>n+d.tasks.length,0);
  const done = ROUTINES.reduce((n,d)=>n+d.tasks.filter(t=>checks[week+':'+d.day+':'+t[0]]).length,0);
  return <><PageHeading eyebrow="WEEKLY WORK PLAN" title="Farm routines" detail="Repeatable checklists for each workday. Weekly checkmarks reset by week; earlier weeks remain saved on this device." />
    <section className="wa-hero-card"><div className="wa-hero-top"><span>THIS WEEK</span><span>{done} OF {all} CHECKED</span></div><div className="wa-progress"><div style={{width:(done/all*100)+'%'}} /></div></section>
    <div className="wa-day-selector">{ROUTINES.map(d=><button key={d.day} className={'wa-button '+(day===d.day?'':'wa-button-muted')} onClick={()=>setDay(d.day)}>{d.day.slice(0,3)}</button>)}</div>
    {ROUTINES.filter(d=>d.day===day).map(d=><section className="wa-section" key={d.day}><div className="wa-section-heading"><div><span className="wa-eyebrow">{d.day.toUpperCase()}</span><h2>{d.title}</h2></div><span>{d.tasks.filter(t=>checks[week+':'+d.day+':'+t[0]]).length}/{d.tasks.length}</span></div>
      <div className="wa-routine-list">{d.tasks.map(t=>{const id=week+':'+d.day+':'+t[0];return <label className={'wa-routine-item '+(checks[id]?'is-checked':'')} key={id}><input type="checkbox" checked={!!checks[id]} onChange={e=>toggle(id,e.target.checked)} /><span className="wa-routine-copy"><strong>{t[1]}</strong>{t[2]&&<small>⚠️ {t[2]}</small>}</span></label>})}</div></section>)}
    <section className="wa-section"><div className="wa-section-heading"><div><span className="wa-eyebrow">PRINTING & INVENTORY</span><h2>Product label tracker</h2></div></div><p className="wa-footnote">Statuses are prefilled from your list. Update either checkbox independently.</p>
      <div className="wa-label-list">{LABELS.map(name=>{const st=labels[name]||{exists:LABELS_PRESENT.has(name),full:name==='Peas sunflower radish salad mix'};return <div className="wa-label-row" key={name}><strong>{name}</strong><label><input type="checkbox" checked={st.exists} onChange={e=>setLabel(name,'exists',e.target.checked)}/> Label exists</label><label><input type="checkbox" checked={st.full} onChange={e=>setLabel(name,'full',e.target.checked)}/> Needs full sheet</label></div>})}</div>
    </section></>;
}
