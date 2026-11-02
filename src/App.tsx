import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowDownLeft, Bot, Check, CheckCircle2, ChevronRight, CalendarDays,
  CircleDollarSign, Clock3, FileText, FolderOpen, ListTodo, Plus, ShieldCheck,
  Sparkles, Wallet, X, Search, Pencil, Trash2, ArrowUp, ArrowDown, Printer,
  Download, Upload, Image as ImageIcon, Target, SlidersHorizontal, Archive,
  RotateCcw, Sprout, Receipt, ClipboardList, AlertCircle, Filter, Save
} from 'lucide-react';
import './work-assistant.css';

type TaskStatus = 'queued' | 'in_progress' | 'done';
type WorkSource = 'file' | 'website' | 'message' | 'manual';
type Priority = 'high' | 'medium' | 'low';
type WorkTask = {
  id: string; title: string; source: WorkSource; status: TaskStatus;
  payout: number; createdAt: string; completedAt?: string; dueDate?: string;
  priority: Priority; archived?: boolean; covered?: boolean;
};
type Paycheck = {
  id: string; date: string; gross: number; allowance: number; note: string;
  coveredTaskIds?: string[];
};
type RoutineItem = { id: string; label: string; warning?: string };
type RoutineDay = { day: string; title: string; items: RoutineItem[] };
type LabelStatus = { exists: boolean; full: boolean };
type StoredState = {
  tasks: WorkTask[]; paychecks: Paycheck[]; savingsAdjustment: number;
  goal: { name: string; target: number } | null;
  routines: RoutineDay[]; routineChecks: Record<string, boolean>;
  labels: Record<string, LabelStatus>; references: Record<string, string>;
};

const STORAGE_KEY = 'work-assistant-m1-v1';
const PAY_PER_TASK = 15;
const ALLOWANCE_PER_PAYCHECK = 25;
const LABELS = [
  'Amaranth','Arugula','Basil','Beet','Broccoli','Cabbage','Cantaloupe','Chard','Cilantro','Onion',
  'Peas kale superfood smoothie booster','Peas sunflower radish salad mix',
  'Peas sunflower radish salad spicy mix','Radish','Superfood mix','Sunflower','Sweet pea','Wasabi','Wheatgrass','Kale'
];
const LABELS_PRESENT = new Set(LABELS.filter(x => x !== 'Sweet pea' && x !== 'Kale'));
const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0);
const today = () => { const d = new Date(); const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 10); };
const makeId = () => crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);

const BASE_ROUTINES: RoutineDay[] = [
  {day:'Monday',title:'Inventory & station prep',items:[
    {id:'seeds',label:'Check seeds. Add a red reorder card if low.'},
    {id:'soil',label:'Check soil and coir bins.'},
    {id:'paper',label:'Check paper towels and packing supplies.',warning:'Double-check the original instruction.'},
    {id:'clamshells',label:'Check clamshells.'},
    {id:'variety',label:'Check variety sticker rolls.'},
    {id:'traps',label:'Check sticky traps; replace dirty ones.'},
    {id:'soak',label:'Set out soaking jars and scoops.'},
    {id:'weight',label:'Move trays to the weighted stage. Add weights.'}
  ]},
  {day:'Tuesday',title:'Planting day #1',items:[
    {id:'batch1',label:'Plant Batch #1.'},
    {id:'weight',label:'Move trays to the Weighted Phase and place visual weight blocks on top.'},
    {id:'water',label:'Water active racks (top and bottom).'}
  ]},
  {day:'Wednesday',title:'Harvest #1 + planting #2',items:[
    {id:'batchcheck',label:'Check the batch number before planting.',warning:'Batch number is unclear in the source photo—confirm before planting.'},
    {id:'harvest',label:'Harvest orders, weigh packs, and add delivery labels.'},
    {id:'batch2',label:'Plant Batch #2.'},
    {id:'weight',label:'Move trays to the Weighted Phase and place visual weight blocks on top.'},
    {id:'stage',label:'Put finished packs in the delivery fridge totes.'},
    {id:'water',label:'Top-/bottom-water active growing racks.'}
  ]},
  {day:'Thursday',title:'Delivery + planting #3',items:[
    {id:'load',label:'Load delivery totes for the route.'},
    {id:'drop',label:'Deliver subscriber and restaurant orders.'},
    {id:'batch3',label:'Plant Batch #3.'},
    {id:'lights',label:'Bottom-water racks and check lights.'},
    {id:'water',label:'Water the crops.'}
  ]},
  {day:'Friday',title:'Harvest #2 + market prep',items:[
    {id:'harvest',label:'Harvest bulk trays for market.'},
    {id:'pack',label:'Pack clamshells and add price stickers.'},
    {id:'totes',label:'Pack market gear: tents, tables, displays, clamshells, blank labels, and cash/token box.'},
    {id:'inventory',label:'Count products on the inventory sheet.'},
    {id:'cuttrays',label:'Choose which extra trays to cut.'},
    {id:'water',label:'Top-/bottom-water active growing racks.'}
  ]},
  {day:'Saturday',title:'Farmers market day #1',items:[
    {id:'coolers',label:'Pack coolers and ice packs.'},
    {id:'setup',label:'Set up tables using the market layout picture.',warning:'One station name is hard to read—check the original photo.'},
    {id:'sell',label:'Sell products; use the customer script and price guide.'},
    {id:'breakdown',label:'Pack up totes and count what is left.'},
    {id:'inventory',label:'Count all products on the inventory sheet.'},
    {id:'health',label:'Quick-water crops and check for good vs. bad fuzz.'},
    {id:'harvest',label:'Harvest trays, pack clamshells, and add prices.'}
  ]},
  {day:'Sunday',title:'Farmers market day #2',items:[
    {id:'water',label:'Quick-water the crops.'},
    {id:'setup',label:'Set up the display and tables.'},
    {id:'sell',label:'Run the market.'},
    {id:'unload',label:'Unload the vehicle at the farm.'},
    {id:'sanitize',label:'Clean returned totes and ice packs.'}
  ]}
];

function defaultLabels(): Record<string, LabelStatus> {
  return Object.fromEntries(LABELS.map(name => [name, {exists:LABELS_PRESENT.has(name), full:name==='Peas sunflower radish salad mix'}]));
}
function readState(): StoredState {
  const empty: StoredState = {tasks:[],paychecks:[],savingsAdjustment:0,goal:null,routines:BASE_ROUTINES,routineChecks:{},labels:defaultLabels(),references:{}};
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const oldChecks = JSON.parse(localStorage.getItem('denwork-routine-checks-v1') || '{}');
    const oldLabels = JSON.parse(localStorage.getItem('denwork-label-status-v1') || '{}');
    const tasks = Array.isArray(parsed.tasks) ? parsed.tasks.map((t:any) => ({
      ...t, source:t.source || 'manual', status:t.status || 'queued', payout:Number(t.payout)||PAY_PER_TASK,
      priority:t.priority || 'medium', archived:!!t.archived, covered:!!t.covered
    })) : [];
    const paychecks = Array.isArray(parsed.paychecks) ? parsed.paychecks.map((p:any) => ({
      ...p, allowance:Number.isFinite(Number(p.allowance)) ? Number(p.allowance) : Math.min(ALLOWANCE_PER_PAYCHECK,Number(p.gross)||0),
      coveredTaskIds:Array.isArray(p.coveredTaskIds)?p.coveredTaskIds:[]
    })) : [];
    const labels = {...defaultLabels(), ...(parsed.labels || oldLabels)};
    const merged = {...empty,...parsed,tasks,paychecks,labels,routineChecks:parsed.routineChecks || oldChecks};
    if (!Array.isArray(merged.routines) || !merged.routines.length) merged.routines = BASE_ROUTINES;
    if (!merged.references || typeof merged.references !== 'object') merged.references = {};
    return merged;
  } catch { return empty; }
}

const CROP_GUIDES: Record<string, {family:string; soak:string; germination:string; light:string; harvest:string}> = {
  'Amaranth':{family:'tiny seed',soak:'Usually no soak; sow evenly and avoid burying the tiny seed.',germination:'Use an even, light blackout/cover if your farm SOP calls for it. Avoid heavy pressure on tiny-seeded trays.',light:'After germination, provide bright, even light and airflow. A common microgreen starting schedule is 12–16 hours/day.',harvest:'Harvest when the canopy is even and stems are tender, before it becomes leggy.'},
  'Arugula':{family:'brassica',soak:'Usually no soak. Spread seed evenly; dense sowing can mat.',germination:'Often germinates quickly. Use only the tray weight specified by your farm procedure.',light:'Bright, even light after blackout; keep airflow steady and avoid waterlogged media.',harvest:'Often ready as tender cotyledons/early true leaves. Cut cleanly above the media.'},
  'Basil':{family:'herb',soak:'Do not pre-soak as a default: basil seed can form a gel-like coating when wet.',germination:'Germinates more slowly than many brassicas. Keep moisture consistent without saturating the tray.',light:'Use bright light after emergence and gentle airflow; avoid letting seedlings stretch.',harvest:'Harvest when stems are sturdy and leaves are developed; handle gently.'},
  'Beet':{family:'beet',soak:'Seed clusters may benefit from a short soak in some farm systems; confirm the seed supplier and your farm SOP before using one.',germination:'Germination can be uneven because each seed cluster may contain multiple seeds. Thin only if the farm process says to.',light:'Bright light after emergence; keep moisture even and avoid standing water.',harvest:'Harvest when stems and first leaves reach your farm’s target size.'},
  'Broccoli':{family:'brassica',soak:'Usually no soak.',germination:'Typically quick and uniform. Avoid overwatering and excessive tray pressure.',light:'Bright, even light after blackout with gentle air movement.',harvest:'Usually harvested young at the cotyledon/early true-leaf stage.'},
  'Cabbage':{family:'brassica',soak:'Usually no soak.',germination:'Use a light, even sow and follow the same controlled germination process as your farm’s brassica trays.',light:'Bright light after emergence; maintain airflow.',harvest:'Harvest young while stems are tender and the canopy is upright.'},
  'Cantaloupe':{family:'cucurbit',soak:'Large cucurbit seeds sometimes use a short pre-soak, but use the supplier and farm instructions for this variety.',germination:'Use a clean, well-drained tray and avoid prolonged saturation.',light:'Bright light after emergence; watch for stretching and maintain airflow.',harvest:'Harvest only at the size and stage approved for your farm’s product.'},
  'Chard':{family:'beet family',soak:'Seed clusters may use a short soak in some systems; confirm before changing your normal procedure.',germination:'Expect slower/more variable emergence than many brassicas.',light:'Bright, consistent light after emergence and even moisture.',harvest:'Harvest once stems are strong and leaves reach the farm’s target size.'},
  'Cilantro':{family:'herb',soak:'Some growers gently split the round seed fruit before sowing; do not crush it. Confirm the farm’s exact process.',germination:'Can be slower and less uniform than brassicas; keep the tray evenly moist, not saturated.',light:'Bright light after emergence with airflow; avoid overly hot conditions.',harvest:'Harvest when leaves have developed enough for the intended product; avoid cutting too low.'},
  'Onion':{family:'allium',soak:'Usually no soak unless the supplier or farm procedure specifies it.',germination:'Can be slower and finer than brassica crops. Keep the surface evenly moist.',light:'Bright light after emergence; fine seedlings benefit from gentle airflow.',harvest:'Harvest when the crop reaches the farm’s specified height and firmness.'},
  'Peas kale superfood smoothie booster':{family:'mixed seed blend',soak:'This is a blend: follow its exact seed supplier directions. Do not assume every component needs the same soak.',germination:'Mixed seed sizes can emerge at different speeds. Use the label and farm SOP for tray weights.',light:'Use the farm’s standard bright-light schedule after germination and check the slower components.',harvest:'Harvest to the blend’s approved size; check that all components are ready and safe for the product.'},
  'Peas sunflower radish salad mix':{family:'mixed seed blend',soak:'Follow the blend-specific pack directions. Pea/sunflower components may need different preparation from radish.',germination:'Mixed components may need separate staging. Follow your farm’s batch instructions rather than applying one weight to all seeds.',light:'Bright, even light after germination; avoid letting faster radish growth shade other components.',harvest:'Harvest when the mix is balanced and the slowest component is at the approved stage.'},
  'Peas sunflower radish salad spicy mix':{family:'mixed seed blend',soak:'Use the supplier’s blend-specific directions; components can have different soak needs.',germination:'Use the farm’s mix-specific tray weights and staging. A single generic weight may not suit every seed.',light:'Bright light and airflow after emergence; inspect each component for even growth.',harvest:'Harvest at the farm’s target stage for the complete mix.'},
  'Radish':{family:'brassica',soak:'Usually no soak.',germination:'Often fast. Avoid overly dense sowing and keep trays evenly moist.',light:'Bright light after blackout and steady airflow.',harvest:'Usually harvested young while stems are crisp and leaves are tender.'},
  'Superfood mix':{family:'mixed seed blend',soak:'Check the exact blend label; soak requirements vary by seed species and proportions.',germination:'Mixed seeds may germinate at different rates. Use the blend’s farm-approved tray procedure.',light:'Bright, even light after emergence and good airflow.',harvest:'Harvest according to the mix’s product standard and inspect all components.'},
  'Sunflower':{family:'large seed',soak:'Many sunflower microgreen systems use a pre-soak, often around 8–12 hours, but seed size and supplier guidance matter.',germination:'Use only the farm-approved tray weight and blackout period. Remove hulls according to the farm procedure.',light:'Bright light after germination; airflow helps reduce excess surface moisture.',harvest:'Harvest when stems are firm and cotyledons are open; check hulls before packing.'},
  'Sweet pea':{family:'pea shoot',soak:'Pea-type seed is commonly soaked overnight (often around 8–12 hours); follow the specific seed instructions.',germination:'Pea shoots commonly use an approved top weight during germination. Keep drainage clear and remove weight per SOP.',light:'Bright light after the weighted phase; maintain airflow and consistent moisture.',harvest:'Cut tender shoots at the farm’s target height, leaving the correct regrowth point if applicable.'},
  'Wasabi':{family:'specialty/slow crop',soak:'Use supplier-specific directions; do not assume a standard microgreen soak.',germination:'Treat as a specialty crop. Confirm temperature, timing and tray method with the seed supplier or farm manager.',light:'Avoid assuming the same light intensity as fast brassicas; use the farm’s validated wasabi procedure.',harvest:'Follow the variety-specific harvest window and handling instructions.'},
  'Wheatgrass':{family:'grass',soak:'Wheatgrass seed is commonly soaked overnight (often around 8–12 hours), then drained well.',germination:'Use a clean tray and the farm-approved cover/weight. Avoid standing water and stale air.',light:'After emergence, provide bright light and airflow; maintain even moisture.',harvest:'Often cut when the grass reaches the farm’s target height, before it becomes coarse.'},
  'Kale':{family:'brassica',soak:'Usually no soak.',germination:'Generally quick. Keep the seed evenly distributed and moisture consistent.',light:'Bright light after blackout with good airflow.',harvest:'Harvest young at the farm’s target size while stems are tender.'}
};

function cropAnswer(crop:string, question:string) {
  const guide = CROP_GUIDES[crop];
  const q = question.toLowerCase();
  if (q.includes('soak') || q.includes('pre-soak')) return guide.soak;
  if (q.includes('germin') || q.includes('weight') || q.includes('blackout')) return guide.germination;
  if (q.includes('light') || q.includes('lamp') || q.includes('photoperiod')) return guide.light;
  if (q.includes('harvest') || q.includes('cut') || q.includes('when')) return guide.harvest;
  return guide.family + ' profile: ' + guide.germination + ' ' + guide.light + ' For a crop-specific answer, ask about soaking, germination/weight, lighting, or harvesting.';
}

function parseWorkText(sourceText:string) {
  return sourceText.split(/\n|[•;]/).map(line=>line.replace(/^\s*[-*•\d.)]+\s*/,'').trim())
    .filter(line=>line.length>5 && line.length<220)
    .filter(line=>!/^hi[,! ]|^thanks|^thank you|^hello/i.test(line))
    .slice(0,30).map(line=>({
      id:makeId(),title:line.charAt(0).toUpperCase()+line.slice(1),
      priority:/urgent|asap|today|immediately|before (?:noon|close)/i.test(line)?'high' as Priority:/when you can|whenever|optional|next week/i.test(line)?'low' as Priority:'medium' as Priority,
      payout:PAY_PER_TASK
    }));
}
function extractPayText(raw:string) {
  const currency = raw.match(/\$\s?([\d,]+(?:\.\d{1,2})?)/);
  const labeled = raw.match(/(?:gross(?:\s+pay)?|total|amount paid|net pay|paid|earnings)\s*[:=]?\s*\$?\s*([\d,]+(?:\.\d{1,2})?)/i);
  const grossText = labeled?.[1] || currency?.[1] || '';
  const gross = Number(grossText.replace(/,/g,''));
  const dateISO = raw.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  const dateUS = raw.match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/);
  const date = dateISO ? dateISO[1]+'-'+dateISO[2].padStart(2,'0')+'-'+dateISO[3].padStart(2,'0')
    : dateUS ? dateUS[3]+'-'+dateUS[1].padStart(2,'0')+'-'+dateUS[2].padStart(2,'0') : today();
  return {gross:Number.isFinite(gross)&&gross>0?gross:0,date,note:raw.trim().replace(/\s+/g,' ').slice(0,140)};
}

export default function App() {
  const [state,setState] = useState<StoredState>(readState);
  const [tab,setTab] = useState<'home'|'tasks'|'routine'|'pay'|'assistant'>('home');
  const [showTaskForm,setShowTaskForm] = useState(false);
  const [showPayForm,setShowPayForm] = useState(false);
  const [editingTaskId,setEditingTaskId] = useState<string|null>(null);
  const [taskTitle,setTaskTitle] = useState('');
  const [taskSource,setTaskSource] = useState<WorkSource>('manual');
  const [taskDue,setTaskDue] = useState('');
  const [taskPriority,setTaskPriority] = useState<Priority>('medium');
  const [taskPayout,setTaskPayout] = useState(String(PAY_PER_TASK));
  const [payDate,setPayDate] = useState(today());
  const [payGross,setPayGross] = useState('');
  const [payNote,setPayNote] = useState('');
  const [payTaskIds,setPayTaskIds] = useState<string[]>([]);
  const [taskSearch,setTaskSearch] = useState('');
  const [taskStatusFilter,setTaskStatusFilter] = useState('all');
  const [taskSourceFilter,setTaskSourceFilter] = useState('all');
  const [showArchived,setShowArchived] = useState(false);
  const [backupMessage,setBackupMessage] = useState('');
  const [assistantText,setAssistantText] = useState('');
  const [parsedTasks,setParsedTasks] = useState<ReturnType<typeof parseWorkText>>([]);
  const [selectedCrop,setSelectedCrop] = useState('Amaranth');
  const [cropQuestion,setCropQuestion] = useState('');
  const [cropResponse,setCropResponse] = useState('');
  const [payExtractText,setPayExtractText] = useState('');
  const [payExtract,setPayExtract] = useState<ReturnType<typeof extractPayText>|null>(null);
  const [referenceItem,setReferenceItem] = useState<{id:string;label:string}|null>(null);
  const [runSheetOpen,setRunSheetOpen] = useState(false);
  const [newGoalName,setNewGoalName] = useState('');
  const [newGoalTarget,setNewGoalTarget] = useState('');
  const [newLabelName,setNewLabelName] = useState('');
  const [labelSearch,setLabelSearch] = useState('');
  const [labelFilter,setLabelFilter] = useState<'all'|'missing'|'full'>('all');

  useEffect(()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch{setBackupMessage('Storage is full or unavailable. Export a backup and remove large reference images.');}},[state]);

  const completedToday = state.tasks.filter(t=>t.status==='done' && t.completedAt?.slice(0,10)===today()).length;
  const openTasks = state.tasks.filter(t=>t.status!=='done'&&!t.archived);
  const completedTasks = state.tasks.filter(t=>t.status==='done'&&!t.archived).length;
  const totalPay = state.paychecks.reduce((sum,p)=>sum+p.gross,0);
  const totalAllowances = state.paychecks.reduce((sum,p)=>sum+p.allowance,0);
  const savings = state.paychecks.reduce((sum,p)=>sum+Math.max(0,p.gross-p.allowance),0)+state.savingsAdjustment;
  const coveredTaskIds = new Set(state.paychecks.flatMap(p=>p.coveredTaskIds||[]));
  const completedEstimate = state.tasks.filter(t=>t.status==='done').reduce((sum,t)=>sum+t.payout,0);
  const reconciledEstimate = state.tasks.filter(t=>t.status==='done'&&(coveredTaskIds.has(t.id)||!!t.covered)).reduce((sum,t)=>sum+t.payout,0);
  const outstandingEstimate = Math.max(0,completedEstimate-reconciledEstimate);
  const averagePaycheck = state.paychecks.length?totalPay/state.paychecks.length:0;
  const weekTasks = useMemo(()=>{const start=new Date();start.setDate(start.getDate()-6);start.setHours(0,0,0,0);return state.tasks.filter(t=>t.status==='done'&&t.completedAt&&new Date(t.completedAt)>=start).length;},[state.tasks]);
  const visibleTasks = state.tasks.filter(t=>{
    if(!!t.archived!==showArchived)return false;
    if(taskStatusFilter!=='all'&&t.status!==taskStatusFilter)return false;
    if(taskSourceFilter!=='all'&&t.source!==taskSourceFilter)return false;
    return t.title.toLowerCase().includes(taskSearch.toLowerCase());
  });

  const openTaskForm = (task?:WorkTask) => {
    setEditingTaskId(task?.id||null);setTaskTitle(task?.title||'');setTaskSource(task?.source||'manual');
    setTaskDue(task?.dueDate||'');setTaskPriority(task?.priority||'medium');setTaskPayout(String(task?.payout??PAY_PER_TASK));setShowTaskForm(true);
  };
  const saveTask = (event:React.FormEvent) => {
    event.preventDefault();const title=taskTitle.trim();const payout=Number(taskPayout);
    if(!title||!Number.isFinite(payout)||payout<0)return;
    if(editingTaskId){setState(s=>({...s,tasks:s.tasks.map(t=>t.id===editingTaskId?{...t,title,source:taskSource,dueDate:taskDue||undefined,priority:taskPriority,payout}:t)}));}
    else {const task:WorkTask={id:makeId(),title,source:taskSource,status:'queued',payout,createdAt:new Date().toISOString(),dueDate:taskDue||undefined,priority:taskPriority};setState(s=>({...s,tasks:[task,...s.tasks]}));}
    setShowTaskForm(false);setEditingTaskId(null);setTab('tasks');
  };
  const updateTask = (id:string, status:TaskStatus) => setState(s=>({...s,tasks:s.tasks.map(t=>t.id===id?{...t,status,completedAt:status==='done'?(t.completedAt||new Date().toISOString()):undefined}:t)}));
  const toggleTaskCovered = (id:string) => setState(s=>({...s,tasks:s.tasks.map(t=>t.id===id?{...t,covered:!t.covered}:t)}));
  const deleteTask = (id:string) => setState(s=>({...s,tasks:s.tasks.filter(t=>t.id!==id),paychecks:s.paychecks.map(p=>({...p,coveredTaskIds:(p.coveredTaskIds||[]).filter(x=>x!==id)}))}));
  const addPaycheck = (event:React.FormEvent) => {
    event.preventDefault();const gross=Number(payGross);if(!Number.isFinite(gross)||gross<=0)return;
    const paycheck:Paycheck={id:makeId(),date:payDate,gross,allowance:Math.min(ALLOWANCE_PER_PAYCHECK,gross),note:payNote.trim(),coveredTaskIds:payTaskIds};
    setState(s=>({...s,paychecks:[paycheck,...s.paychecks]}));setPayGross('');setPayNote('');setPayTaskIds([]);setShowPayForm(false);
  };
  const deletePaycheck=(id:string)=>setState(s=>({...s,paychecks:s.paychecks.filter(p=>p.id!==id)}));
  const markAllDone=()=>setState(s=>({...s,tasks:s.tasks.map(t=>!t.archived&&t.status!=='done'?{...t,status:'done',completedAt:new Date().toISOString()}:t)}));
  const archiveCompleted=()=>setState(s=>({...s,tasks:s.tasks.map(t=>t.status==='done'?{...t,archived:true}:t)}));

  const exportBackup=()=>{
    const payload={app:'Denwork',version:2,exportedAt:new Date().toISOString(),state};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='denwork-backup-'+today()+'.json';a.click();URL.revokeObjectURL(url);setBackupMessage('Backup downloaded. Keep it somewhere safe.');
  };
  const importBackup=(event:React.ChangeEvent<HTMLInputElement>)=>{
    const file=event.target.files?.[0];if(!file)return;const reader=new FileReader();
    reader.onload=()=>{try{const parsed=JSON.parse(String(reader.result));const incoming=parsed.state||parsed;
      if(!incoming||!Array.isArray(incoming.tasks)||!Array.isArray(incoming.paychecks))throw new Error('This file does not look like a Denwork backup.');
      if(!window.confirm('Restore this backup and replace the current Denwork data on this device?'))return;
      setState({...readState(),...incoming});setBackupMessage('Backup restored on this device.');
    }catch(e){setBackupMessage(e instanceof Error?e.message:'Could not read this backup.');}finally{event.target.value='';}};
    reader.readAsText(file);
  };

  const saveGoal=(event:React.FormEvent)=>{event.preventDefault();const target=Number(newGoalTarget);if(!newGoalName.trim()||!Number.isFinite(target)||target<=0)return;setState(s=>({...s,goal:{name:newGoalName.trim(),target}}));setNewGoalName('');setNewGoalTarget('');};
  const addLabel=(event:React.FormEvent)=>{event.preventDefault();const name=newLabelName.trim();if(!name)return;setState(s=>({...s,labels:{...s.labels,[name]:{exists:false,full:false}}}));setNewLabelName('');};
  const setLabel=(name:string,field:'exists'|'full',value:boolean)=>setState(s=>({...s,labels:{...s.labels,[name]:{...(s.labels[name]||{exists:false,full:false}),[field]:value}}}));

  const sourceLabels:Record<WorkSource,string>={file:'File',website:'Website',message:'Message',manual:'Quick note'};
  const printDays=['Wednesday','Thursday','Friday'];
  const printRoutines=state.routines.filter(d=>printDays.includes(d.day));
  const currentWeek=(()=>{const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7));return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');})();

  return (
    <div className="wa-shell">
      <header className="wa-header">
        <div className="wa-brand"><div className="wa-brand-mark"><Bot size={21}/></div><div><div className="wa-brand-name">Denwork</div><div className="wa-brand-caption">YOUR WORK COMPANION</div></div></div>
        <div className="wa-online"><span/> Local workspace</div>
      </header>
      <main className="wa-main">
        {tab==='home'&&<>
          <section className="wa-greeting"><div className="wa-eyebrow"><Sparkles size={14}/> YOUR LITTLE WORK HQ</div><h1>Make progress,<br/><em>one task at a time.</em></h1><p>Your work, pay, and savings in one calm place.</p></section>
          <section className="wa-hero-card"><div className="wa-hero-top"><span>DAILY TASK GOAL</span><span>{Math.min(completedToday,3)} OF 3</span></div><div className="wa-progress"><div style={{width:Math.min(completedToday/3*100,100)+'%'}}/></div><div className="wa-hero-bottom"><div><strong>{completedToday}</strong><span>completed today</span></div><button className="wa-button wa-button-light" onClick={()=>{setTab('tasks');openTaskForm();}}><Plus size={16}/> Add task</button></div></section>
          <section className="wa-metric-grid">
            <Metric icon={<CircleDollarSign size={18}/>} color="amber" label="PAY RECORDED" value={money(totalPay)} detail={'Across '+state.paychecks.length+' paychecks'}/>
            <Metric icon={<Wallet size={18}/>} color="green" label="SAVINGS TRACKED" value={money(savings)} detail="After personal allowance"/>
            <Metric icon={<ListTodo size={18}/>} color="purple" label="OPEN TASKS" value={String(openTasks.length)} detail={completedTasks+' completed total'}/>
            <Metric icon={<Activity size={18}/>} color="blue" label="LAST 7 DAYS" value={String(weekTasks)} detail="Tasks completed"/>
          </section>
          <section className="wa-section"><div className="wa-section-heading"><div><span className="wa-eyebrow">IN YOUR QUEUE</span><h2>Next up</h2></div><button className="wa-text-button" onClick={()=>setTab('tasks')}>All tasks <ChevronRight size={15}/></button></div>
            {openTasks.length?<div className="wa-task-list">{openTasks.slice(0,4).map(task=><TaskRow key={task.id} task={task} onAdvance={()=>updateTask(task.id,task.status==='queued'?'in_progress':'done')} onEdit={()=>openTaskForm(task)} onDelete={()=>deleteTask(task.id)} sourceLabels={sourceLabels}/>)}</div>:<EmptyState title="Your queue is clear" detail="Add a task when new work arrives."/>}
          </section>
          <section className="wa-note"><ShieldCheck size={19}/><div><strong>Your work stays on this device</strong><p>Use Backup & Restore to move a copy manually. Cloud sync and live AI connections are intentionally left for your Google AI Studio setup.</p></div></section>
        </>}

        {tab==='tasks'&&<>
          <PageHeading eyebrow="WORKFLOW" title="Task board" detail="Capture, prioritize, schedule, and reconcile work." action={<button className="wa-button" onClick={()=>openTaskForm()}><Plus size={16}/> New task</button>}/>
          <div className="wa-inline-stats"><span><strong>{openTasks.length}</strong> open</span><span><strong>{completedTasks}</strong> completed</span><span><strong>{money(completedEstimate)}</strong> estimated completed value</span></div>
          <div className="wa-toolbar"><label className="wa-search"><Search size={16}/><input value={taskSearch} onChange={e=>setTaskSearch(e.target.value)} placeholder="Search tasks"/></label>
            <select value={taskSourceFilter} onChange={e=>setTaskSourceFilter(e.target.value)}><option value="all">All sources</option><option value="file">File</option><option value="website">Website</option><option value="message">Message</option><option value="manual">Quick note</option></select>
            <select value={taskStatusFilter} onChange={e=>setTaskStatusFilter(e.target.value)}><option value="all">All statuses</option><option value="queued">Queued</option><option value="in_progress">In progress</option><option value="done">Done</option></select>
            <button className={'wa-button wa-button-muted '+(showArchived?'active-filter':'')} onClick={()=>setShowArchived(v=>!v)}><Archive size={15}/>{showArchived?'Show active':'Show archived'}</button>
          </div>
          <div className="wa-batch-actions"><button className="wa-button wa-button-muted" onClick={markAllDone}><CheckCircle2 size={15}/> Mark all done today</button><button className="wa-button wa-button-muted" onClick={archiveCompleted}><Archive size={15}/> Archive completed</button></div>
          <p className="wa-footnote">Task value is an estimate at {money(PAY_PER_TASK)} per task by default. Actual pay is recorded separately.</p>
          {visibleTasks.length?<div className="wa-task-list">{visibleTasks.map(task=><TaskRow key={task.id} task={task} onAdvance={()=>updateTask(task.id,task.status==='queued'?'in_progress':task.status==='in_progress'?'done':'queued')} onEdit={()=>openTaskForm(task)} onDelete={()=>deleteTask(task.id)} onToggleCovered={()=>toggleTaskCovered(task.id)} sourceLabels={sourceLabels}/>)}</div>:<EmptyState title="No matching tasks" detail="Try a different search or filter, or add a task."/>}
          <section className="wa-callout"><ClipboardList size={20}/><div><strong>Task vs. paycheck reconciliation</strong><p>{money(completedEstimate)} estimated from completed tasks · {money(totalPay)} actual paychecks recorded · {money(reconciledEstimate)} of task estimates linked/marked covered · {money(outstandingEstimate)} completed-task estimate still unlinked.</p><span className="wa-footnote">When you record a paycheck, choose which completed tasks it covers. This is an estimate-based cross-check, not proof of employer payment.</span></div></section>
        </>}

        {tab==='routine'&&<RoutinePanel state={state} setState={setState} onReference={(id,label)=>setReferenceItem({id,label})} onPrint={()=>{setRunSheetOpen(true);setTimeout(()=>window.print(),80);}}/>}

        {tab==='pay'&&<>
          <PageHeading eyebrow="MONEY LOG" title="Pay & savings" detail="Record real paychecks, set a savings target, and review trends." action={<button className="wa-button" onClick={()=>setShowPayForm(true)}><Plus size={16}/> Add paycheck</button>}/>
          <section className="wa-pay-summary"><div><span>TOTAL PAY RECORDED</span><strong>{money(totalPay)}</strong></div><div><span>ALLOWANCES SET ASIDE</span><strong>{money(totalAllowances)}</strong></div><div><span>ESTIMATED SAVINGS</span><strong>{money(savings)}</strong></div></section>
          <section className="wa-goal-card"><div className="wa-section-heading"><div><span className="wa-eyebrow">SAVINGS GOAL</span><h2>{state.goal?.name||'Give your savings a target'}</h2></div><Target size={22}/></div>
            {state.goal?<><div className="wa-goal-numbers"><strong>{money(savings)}</strong><span>of {money(state.goal.target)}</span><strong>{Math.min(100,savings/state.goal.target*100).toFixed(0)}%</strong></div><div className="wa-progress"><div style={{width:Math.min(100,savings/state.goal.target*100)+'%'}}/></div><p className="wa-footnote">{money(Math.max(0,state.goal.target-savings))} remaining. Progress uses recorded paycheck savings after allowances.</p><button className="wa-text-button" onClick={()=>{setNewGoalName(state.goal?.name||'');setNewGoalTarget(String(state.goal?.target||''));}}>Edit goal</button></>:<p className="wa-footnote">Choose a goal such as equipment, an emergency fund, or vehicle maintenance.</p>}
            <form className="wa-goal-form" onSubmit={saveGoal}><input value={newGoalName} onChange={e=>setNewGoalName(e.target.value)} placeholder="Goal name (e.g. farm equipment)" required/><input type="number" min="1" step="0.01" value={newGoalTarget} onChange={e=>setNewGoalTarget(e.target.value)} placeholder="Target amount ($)" required/><button className="wa-button" type="submit"><Save size={15}/>{state.goal?'Save goal':'Set goal'}</button></form>
          </section>
          <div className="wa-callout"><Wallet size={20}/><div><strong>Your rule: $25 per paycheck</strong><p>Recorded allowances: {money(totalAllowances)} · Average paycheck: {money(averagePaycheck)} · Average savings after allowance: {money(state.paychecks.length?savings/state.paychecks.length:0)}.</p></div></div>
          <section className="wa-section"><div className="wa-section-heading"><div><span className="wa-eyebrow">MONTHLY & YEARLY</span><h2>Pay summaries</h2></div></div><PaySummaries paychecks={state.paychecks}/></section>
          <section className="wa-section"><div className="wa-section-heading"><div><span className="wa-eyebrow">HISTORY</span><h2>Paychecks</h2></div></div>
            {state.paychecks.length?<div className="wa-pay-list">{state.paychecks.map(pay=><div className="wa-pay-row" key={pay.id}><div className="wa-pay-icon"><ArrowDownLeft size={18}/></div><div className="wa-pay-details"><strong>{money(pay.gross)} paycheck</strong><span>{pay.date}{pay.note?' · '+pay.note:''}</span><small>{money(Math.max(0,pay.gross-pay.allowance))} saved · {money(pay.allowance)} allowance · {(pay.coveredTaskIds||[]).length} task(s) linked</small></div><button className="wa-icon-button" aria-label="Delete paycheck record" onClick={()=>deletePaycheck(pay.id)}><X size={16}/></button></div>)}</div>:<EmptyState title="No paychecks recorded" detail="Add a paycheck when you receive it to track actual savings."/>}
          </section>
          <section className="wa-section wa-backup-card"><div className="wa-section-heading"><div><span className="wa-eyebrow">DATA PORTABILITY</span><h2>Backup & restore</h2></div><ShieldCheck size={21}/></div><p className="wa-footnote">Export tasks, paychecks, goals, routines, labels, checkmarks, and attached reference images as a JSON file. Restore replaces this device’s current app data.</p><div className="wa-form-actions"><button className="wa-button" onClick={exportBackup}><Download size={16}/> Download backup</button><label className="wa-button wa-button-muted wa-file-button"><Upload size={16}/> Restore backup<input type="file" accept="application/json,.json" onChange={importBackup}/></label></div>{backupMessage&&<p className="wa-footnote" role="status">{backupMessage}</p>}</section>
        </>}

        {tab==='assistant'&&<>
          <PageHeading eyebrow="AI WORKMATE" title="Assistant" detail="Local tools for drafting and organizing. Google AI Studio can connect a live model later."/>
          <section className="wa-assistant-card"><div className="wa-assistant-orb"><Bot size={30}/></div><div className="wa-eyebrow"><Sparkles size={14}/> LOCAL WORK TOOLS</div><h2>Get the messy bits organized.</h2><p>These tools run in the browser and do not call an AI service. Treat extracted details as drafts and check them before adding anything to your records.</p></section>
          <section className="wa-section wa-tool-card"><div className="wa-section-heading"><div><span className="wa-eyebrow">01 · MESSAGE INTAKE</span><h2>Smart note & message parser</h2></div><FileText size={20}/></div><p className="wa-footnote">Paste client messages, farm instructions, or voice-note text. The local parser splits lines into task drafts and applies simple priority cues.</p><textarea rows={5} value={assistantText} onChange={e=>{setAssistantText(e.target.value);setParsedTasks([]);}} placeholder={'Example:\nHarvest the arugula on Wednesday\nUrgent: print the missing labels today\nRestock clamshells when you can'}/><div className="wa-form-actions"><button className="wa-button" disabled={!assistantText.trim()} onClick={()=>setParsedTasks(parseWorkText(assistantText))}><Sparkles size={15}/> Parse into task drafts</button></div>
            {parsedTasks.length>0&&<div className="wa-draft-list"><div className="wa-section-heading"><strong>{parsedTasks.length} draft task(s)</strong><button className="wa-text-button" onClick={()=>setParsedTasks([])}>Clear</button></div>{parsedTasks.map(t=><label className="wa-draft-row" key={t.id} data-id={t.id}><input type="checkbox" defaultChecked/><span><strong>{t.title}</strong><small>{t.priority} priority · estimated {money(t.payout)}</small></span></label>)}<button className="wa-button" onClick={()=>{const checks=Array.from(document.querySelectorAll<HTMLInputElement>('.wa-draft-row input:checked'));const ids=new Set(checks.map(x=>x.closest('.wa-draft-row')?.getAttribute('data-id')));const chosen=parsedTasks.filter(t=>ids.has(t.id));setState(s=>({...s,tasks:[...chosen.map(t=>({id:t.id,title:t.title,source:'message' as WorkSource,status:'queued' as TaskStatus,payout:t.payout,priority:t.priority,createdAt:new Date().toISOString()})),...s.tasks]}));setParsedTasks([]);setAssistantText('');setTab('tasks');}}>Add selected tasks</button></div>}
          </section>
          <section className="wa-section wa-tool-card"><div className="wa-section-heading"><div><span className="wa-eyebrow">02 · CROP REFERENCE</span><h2>Microgreens & crop copilot</h2></div><Sprout size={20}/></div><p className="wa-footnote">Choose one of the 20 tracked varieties and ask about soaking, germination/weights, lighting, or harvest timing.</p><select value={selectedCrop} onChange={e=>{setSelectedCrop(e.target.value);setCropResponse('');}}>{LABELS.map(name=><option key={name}>{name}</option>)}</select><div className="wa-crop-quick"><button className="wa-button wa-button-muted" onClick={()=>setCropResponse(cropAnswer(selectedCrop,'soak'))}>Soaking</button><button className="wa-button wa-button-muted" onClick={()=>setCropResponse(cropAnswer(selectedCrop,'germination weight'))}>Germination & weight</button><button className="wa-button wa-button-muted" onClick={()=>setCropResponse(cropAnswer(selectedCrop,'light'))}>Lighting</button><button className="wa-button wa-button-muted" onClick={()=>setCropResponse(cropAnswer(selectedCrop,'harvest'))}>Harvesting</button></div><textarea rows={2} value={cropQuestion} onChange={e=>setCropQuestion(e.target.value)} placeholder="Ask a crop question…"/><div className="wa-form-actions"><button className="wa-button" onClick={()=>setCropResponse(cropAnswer(selectedCrop,cropQuestion||'general'))}>Get crop guidance</button></div>{cropResponse&&<div className="wa-answer"><strong>{selectedCrop}</strong><p>{cropResponse}</p></div>}<p className="wa-footnote">Starting reference only. Seed lots, suppliers, equipment, and your farm’s established SOP can differ. Confirm any soak, weight, or schedule change with the farm’s written instructions.</p></section>
          <section className="wa-section wa-tool-card"><div className="wa-section-heading"><div><span className="wa-eyebrow">03 · PAY INTAKE</span><h2>Pay stub & receipt extractor</h2></div><Receipt size={20}/></div><p className="wa-footnote">Paste raw earnings or invoice text. The local extractor looks for a currency amount and date, then prepares a paycheck draft for review.</p><textarea rows={4} value={payExtractText} onChange={e=>{setPayExtractText(e.target.value);setPayExtract(null);}} placeholder={'Example:\nPay date: 11/01/2026\nGross pay: $110.00\nFarm tasks completed'}/><div className="wa-form-actions"><button className="wa-button" disabled={!payExtractText.trim()} onClick={()=>setPayExtract(extractPayText(payExtractText))}><Receipt size={15}/> Extract details</button></div>
            {payExtract&&<div className="wa-answer"><strong>Review extracted details</strong><div className="wa-extract-grid"><label>Pay date<input type="date" value={payExtract.date} onChange={e=>setPayExtract({...payExtract,date:e.target.value})}/></label><label>Gross amount ($)<input type="number" min="0" step="0.01" value={payExtract.gross||''} onChange={e=>setPayExtract({...payExtract,gross:Number(e.target.value)})}/></label></div><p className="wa-footnote">Personal allowance: {money(Math.min(ALLOWANCE_PER_PAYCHECK,payExtract.gross))} · Estimated saved: {money(Math.max(0,payExtract.gross-ALLOWANCE_PER_PAYCHECK))}</p><button className="wa-button" disabled={!payExtract.gross||payExtract.gross<=0} onClick={()=>{setPayDate(payExtract.date);setPayGross(String(payExtract.gross));setPayNote(payExtract.note);setPayTaskIds([]);setShowPayForm(true);}}>Use in paycheck form</button></div>}
          </section>
        </>}
      </main>

      <nav className="wa-tabbar" aria-label="Main navigation">
        <NavItem active={tab==='home'} icon={<Activity size={19}/>} label="Home" onClick={()=>setTab('home')}/>
        <NavItem active={tab==='tasks'} icon={<ListTodo size={19}/>} label="Tasks" onClick={()=>setTab('tasks')}/>
        <NavItem active={tab==='routine'} icon={<CalendarDays size={19}/>} label="Routine" onClick={()=>setTab('routine')}/>
        <NavItem active={tab==='pay'} icon={<Wallet size={19}/>} label="Pay" onClick={()=>setTab('pay')}/>
        <NavItem active={tab==='assistant'} icon={<Bot size={19}/>} label="AI helper" onClick={()=>setTab('assistant')}/>
      </nav>

      {showTaskForm&&<Modal title={editingTaskId?'Edit task':'Add a work task'} onClose={()=>setShowTaskForm(false)}><form className="wa-form" onSubmit={saveTask}>
        <label>Task title<input autoFocus value={taskTitle} onChange={e=>setTaskTitle(e.target.value)} required maxLength={180}/></label>
        <label>Source<select value={taskSource} onChange={e=>setTaskSource(e.target.value as WorkSource)}><option value="manual">Quick note</option><option value="file">File</option><option value="website">Website</option><option value="message">Message</option></select></label>
        <div className="wa-form-row"><label>Due date<input type="date" value={taskDue} onChange={e=>setTaskDue(e.target.value)}/></label><label>Priority<select value={taskPriority} onChange={e=>setTaskPriority(e.target.value as Priority)}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label></div>
        <label>Estimated task value ($)<input type="number" min="0" step="0.01" value={taskPayout} onChange={e=>setTaskPayout(e.target.value)}/></label>
        <div className="wa-form-hint">Default estimate: {money(PAY_PER_TASK)} per task. This does not represent confirmed wages.</div>
        <div className="wa-form-actions"><button type="button" className="wa-button wa-button-muted" onClick={()=>setShowTaskForm(false)}>Cancel</button><button className="wa-button" type="submit"><Save size={16}/> Save task</button></div>
      </form></Modal>}
      {showPayForm&&<Modal title="Record a paycheck" onClose={()=>setShowPayForm(false)}><form className="wa-form" onSubmit={addPaycheck}>
        <label>Pay date<input type="date" value={payDate} onChange={e=>setPayDate(e.target.value)} required/></label>
        <label>Amount received ($)<input type="number" min="0.01" step="0.01" inputMode="decimal" value={payGross} onChange={e=>setPayGross(e.target.value)} placeholder="e.g. 110.00" required/></label>
        <label>Note (optional)<input value={payNote} onChange={e=>setPayNote(e.target.value)} placeholder="Tasks covered by this paycheck"/></label>
        <div className="wa-task-link-picker"><strong>Completed tasks covered by this paycheck</strong>{state.tasks.filter(t=>t.status==='done'&&!t.archived).length?state.tasks.filter(t=>t.status==='done'&&!t.archived).map(t=><label key={t.id}><input type="checkbox" checked={payTaskIds.includes(t.id)} onChange={e=>setPayTaskIds(ids=>e.target.checked?[...ids,t.id]:ids.filter(x=>x!==t.id))}/><span>{t.title} · {money(t.payout)}</span></label>):<small>No completed tasks to link yet.</small>}</div>
        <div className="wa-pay-preview"><span>Personal allowance</span><strong>{money(Math.min(ALLOWANCE_PER_PAYCHECK,Number(payGross||0)))}</strong><span>Estimated amount saved</span><strong>{money(Math.max(0,Number(payGross||0)-ALLOWANCE_PER_PAYCHECK))}</strong></div>
        <div className="wa-form-hint">This records the amount you enter. It does not connect to a bank or move money.</div>
        <div className="wa-form-actions"><button type="button" className="wa-button wa-button-muted" onClick={()=>setShowPayForm(false)}>Cancel</button><button className="wa-button" type="submit"><Check size={16}/> Save paycheck</button></div>
      </form></Modal>}

      {referenceItem&&<div className="wa-drawer-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setReferenceItem(null);}}><aside className="wa-reference-drawer"><div className="wa-modal-heading"><div><span className="wa-eyebrow">REFERENCE DRAWER</span><h2>{referenceItem.label}</h2></div><button className="wa-icon-button" onClick={()=>setReferenceItem(null)} aria-label="Close reference drawer"><X/></button></div><p className="wa-footnote">Attach a photo or setup diagram from this device. It stays in this browser’s local storage and is included in JSON backups.</p>{state.references[referenceItem.id]?<><img className="wa-reference-image" src={state.references[referenceItem.id]} alt={'Reference for '+referenceItem.label}/><button className="wa-button wa-button-muted" onClick={()=>setState(s=>{const next={...s.references};delete next[referenceItem.id];return {...s,references:next};})}>Remove image</button></>:<div className="wa-reference-empty"><ImageIcon size={28}/><strong>No reference attached yet</strong></div>}<label className="wa-button wa-file-button"><Upload size={16}/> Attach reference image<input type="file" accept="image/*" onChange={e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>1.5*1024*1024){setBackupMessage('That image is over 1.5 MB. Choose a smaller image to keep local storage reliable.');return;}const reader=new FileReader();reader.onload=()=>setState(s=>({...s,references:{...s.references,[referenceItem.id]:String(reader.result)}}));reader.readAsDataURL(file);e.target.value='';}}/></label></aside></div>}

      {runSheetOpen&&<div className="wa-print-sheet"><h1>Farm Harvest & Delivery Run-Sheet</h1><p>Week of {currentWeek} · Printed {today()}</p>{printRoutines.map(day=><section key={day.day}><h2>{day.day} — {day.title}</h2>{day.items.map(item=><div className="wa-print-task" key={item.id}><span className="wa-print-box"/><span>{item.label}</span></div>)}</section>)}<p className="wa-print-note">Confirm unclear source-photo instructions with the original farm reference before acting.</p></div>}
    </div>
  );
}

function Metric({icon,color,label,value,detail}:{icon:React.ReactNode;color:string;label:string;value:string;detail:string}){return <div className="wa-metric"><div className={'wa-metric-icon '+color}>{icon}</div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;}
function PageHeading({eyebrow,title,detail,action}:{eyebrow:string;title:string;detail:string;action?:React.ReactNode}){return <section className="wa-page-heading"><div><span className="wa-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{detail}</p></div>{action}</section>;}
function NavItem({active,icon,label,onClick}:{active:boolean;icon:React.ReactNode;label:string;onClick:()=>void}){return <button className={'wa-nav-item'+(active?' active':'')} onClick={onClick}>{icon}<span>{label}</span></button>;}
function TaskRow({task,onAdvance,onEdit,onDelete,onToggleCovered,sourceLabels}:{task:WorkTask;onAdvance:()=>void;onEdit:()=>void;onDelete:()=>void;onToggleCovered?:()=>void;sourceLabels:Record<WorkSource,string>}){
  return <div className={'wa-task-row '+task.status}><button className={'wa-task-check '+(task.status==='done'?'checked':'')} aria-label="Advance task status" onClick={onAdvance}>{task.status==='done'?<Check size={16}/>:task.status==='in_progress'?<Clock3 size={16}/>:<Plus size={16}/>}</button><div className="wa-task-content"><strong>{task.title}</strong><div className="wa-task-meta"><span>{sourceLabels[task.source]}</span><span className={'wa-status status-'+task.status}>{task.status==='queued'?'Queued':task.status==='in_progress'?'In progress':'Done'}</span><span className={'wa-priority priority-'+task.priority}>{task.priority}</span>{task.dueDate&&<span className="wa-due-date">Due {task.dueDate}</span>}</div></div><span className="wa-task-rate">{money(task.payout)}</span><button className="wa-icon-button" aria-label="Edit task" onClick={onEdit}><Pencil size={15}/></button>{onToggleCovered&&task.status==='done'&&<label className="wa-covered-check" title="Mark linked to a paycheck"><input type="checkbox" checked={!!task.covered} onChange={onToggleCovered}/> Paid</label>}<button className="wa-icon-button" aria-label="Delete task" onClick={onDelete}><X size={15}/></button></div>;
}
function EmptyState({title,detail}:{title:string;detail:string}){return <div className="wa-empty"><div><ListTodo size={22}/></div><strong>{title}</strong><p>{detail}</p></div>;}
function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}){return <div className="wa-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section className="wa-modal" role="dialog" aria-modal="true" aria-label={title}><div className="wa-modal-heading"><h2>{title}</h2><button className="wa-icon-button" aria-label="Close dialog" onClick={onClose}><X size={18}/></button></div>{children}</section></div>;}

function RoutinePanel({state,setState,onReference,onPrint}:{state:StoredState;setState:React.Dispatch<React.SetStateAction<StoredState>>;onReference:(id:string,label:string)=>void;onPrint:()=>void}){
  const [day,setDay]=useState(['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()]);
  const [newRoutineText,setNewRoutineText]=useState('');
  const [editingId,setEditingId]=useState<string|null>(null);
  const [editingText,setEditingText]=useState('');
  const [labelSearch,setLabelSearch]=useState('');
  const [labelFilter,setLabelFilter]=useState<'all'|'missing'|'full'>('all');
  const monday=new Date();monday.setHours(0,0,0,0);monday.setDate(monday.getDate()-((monday.getDay()+6)%7));
  const week=monday.getFullYear()+'-'+String(monday.getMonth()+1).padStart(2,'0')+'-'+String(monday.getDate()).padStart(2,'0');
  const toggle=(id:string,checked:boolean)=>setState(s=>({...s,routineChecks:{...s.routineChecks,[week+':'+day+':'+id]:checked}}));
  const updateDay=(dayName:string,items:RoutineItem[])=>setState(s=>({...s,routines:s.routines.map(d=>d.day===dayName?{...d,items}:d)}));
  const active=state.routines.find(d=>d.day===day)||BASE_ROUTINES.find(d=>d.day===day)!;
  const all=state.routines.reduce((n,d)=>n+d.items.length,0);
  const done=state.routines.reduce((n,d)=>n+d.items.filter(t=>state.routineChecks[week+':'+d.day+':'+t.id]).length,0);
  const addItem=(e:React.FormEvent)=>{e.preventDefault();const label=newRoutineText.trim();if(!label)return;updateDay(day,[...active.items,{id:makeId(),label}]);setNewRoutineText('');};
  const moveItem=(index:number,direction:number)=>{const next=[...active.items];const target=index+direction;if(target<0||target>=next.length)return;[next[index],next[target]]=[next[target],next[index]];updateDay(day,next);};
  const saveEdit=(id:string)=>{if(editingText.trim())updateDay(day,active.items.map(t=>t.id===id?{...t,label:editingText.trim()}:t));setEditingId(null);};
  const currentCount=active.items.filter(t=>state.routineChecks[week+':'+day+':'+t.id]).length;
  return <><PageHeading eyebrow="WEEKLY WORK PLAN" title="Farm routines" detail="Edit, add, and reorder checklist items for any day. Changes stay on this device." action={<button className="wa-button wa-button-muted" onClick={onPrint}><Printer size={16}/> Print run-sheet</button>}/>
    <section className="wa-hero-card"><div className="wa-hero-top"><span>THIS WEEK</span><span>{done} OF {all} CHECKED</span></div><div className="wa-progress"><div style={{width:(all?done/all*100:0)+'%'}}/></div></section>
    <div className="wa-day-selector">{state.routines.map(d=><button key={d.day} className={'wa-button '+(day===d.day?'':'wa-button-muted')} onClick={()=>setDay(d.day)}>{d.day.slice(0,3)}</button>)}</div>
    <section className="wa-section"><div className="wa-section-heading"><div><span className="wa-eyebrow">{day.toUpperCase()}</span><h2>{active.title}</h2></div><span>{currentCount}/{active.items.length}</span></div>
      <div className="wa-routine-list">{active.items.map((item,index)=>{const key=week+':'+day+':'+item.id;return <div className={'wa-routine-item '+(state.routineChecks[key]?'is-checked':'')} key={item.id}>
        <input aria-label={'Complete '+item.label} type="checkbox" checked={!!state.routineChecks[key]} onChange={e=>toggle(item.id,e.target.checked)}/>
        <span className="wa-routine-copy">{editingId===item.id?<input className="wa-inline-edit" value={editingText} onChange={e=>setEditingText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')saveEdit(item.id);if(e.key==='Escape')setEditingId(null);}} autoFocus/>:<strong>{item.label}</strong>}{item.warning&&<small>⚠️ {item.warning}</small>}
          <span className="wa-routine-actions">{editingId===item.id?<><button onClick={()=>saveEdit(item.id)}>Save</button><button onClick={()=>setEditingId(null)}>Cancel</button></>:<><button aria-label="Move up" disabled={index===0} onClick={()=>moveItem(index,-1)}><ArrowUp size={14}/></button><button aria-label="Move down" disabled={index===active.items.length-1} onClick={()=>moveItem(index,1)}><ArrowDown size={14}/></button><button onClick={()=>{setEditingId(item.id);setEditingText(item.label);}}><Pencil size={14}/> Edit</button><button onClick={()=>onReference(item.id,item.label)}><ImageIcon size={14}/> Reference</button><button aria-label="Delete routine item" onClick={()=>{if(window.confirm('Delete this routine item?'))updateDay(day,active.items.filter(x=>x.id!==item.id));}}><Trash2 size={14}/></button></>}</span>
        </span></div>;})}</div>
      <form className="wa-add-routine" onSubmit={addItem}><input value={newRoutineText} onChange={e=>setNewRoutineText(e.target.value)} placeholder={'Add a '+day+' routine item'} maxLength={180}/><button className="wa-button" type="submit"><Plus size={16}/> Add item</button></form>
    </section>
    <section className="wa-section"><div className="wa-section-heading"><div><span className="wa-eyebrow">PRINTING & INVENTORY</span><h2>Product label tracker</h2></div></div><p className="wa-footnote">Search varieties and show only missing labels or labels that need a full sheet.</p>
      <div className="wa-toolbar"><label className="wa-search"><Search size={16}/><input value={labelSearch} onChange={e=>setLabelSearch(e.target.value)} placeholder="Search labels"/></label><select value={labelFilter} onChange={e=>setLabelFilter(e.target.value as 'all'|'missing'|'full')}><option value="all">All labels</option><option value="missing">Missing labels</option><option value="full">Needs full sheet</option></select></div>
      <div className="wa-label-list">{Object.keys({...defaultLabels(),...state.labels}).filter(name=>name.toLowerCase().includes(labelSearch.toLowerCase())).filter(name=>{const st=state.labels[name]||defaultLabels()[name]||{exists:false,full:false};return labelFilter==='all'||(labelFilter==='missing'&&!st.exists)||(labelFilter==='full'&&st.full);}).map(name=>{const st=state.labels[name]||defaultLabels()[name]||{exists:false,full:false};return <div className="wa-label-row" key={name}><strong>{name}</strong><label><input type="checkbox" checked={st.exists} onChange={e=>setState(s=>({...s,labels:{...s.labels,[name]:{...st,exists:e.target.checked}}}))}/> Label exists</label><label><input type="checkbox" checked={st.full} onChange={e=>setState(s=>({...s,labels:{...s.labels,[name]:{...st,full:e.target.checked}}}))}/> Needs full sheet</label></div>;})}</div>
      <form className="wa-add-routine" onSubmit={e=>{e.preventDefault();const input=e.currentTarget.elements.namedItem('newLabel') as HTMLInputElement;const name=input.value.trim();if(name){setState(s=>({...s,labels:{...s.labels,[name]:{exists:false,full:false}}}));input.value='';}}}><input name="newLabel" placeholder="New variety name"/><button className="wa-button" type="submit"><Plus size={16}/> Add variety</button></form>
    </section>
  </>;
}

function PaySummaries({paychecks}:{paychecks:Paycheck[]}){
  const monthly=Object.entries(paychecks.reduce((acc:Record<string,{gross:number;allowance:number;count:number}>,p)=>{const key=p.date.slice(0,7)||'Undated';acc[key] ||= {gross:0,allowance:0,count:0};acc[key].gross+=p.gross;acc[key].allowance+=p.allowance;acc[key].count++;return acc;},{})).sort((a,b)=>b[0].localeCompare(a[0]));
  const yearly=Object.entries(paychecks.reduce((acc:Record<string,{gross:number;allowance:number;count:number}>,p)=>{const key=p.date.slice(0,4)||'Undated';acc[key] ||= {gross:0,allowance:0,count:0};acc[key].gross+=p.gross;acc[key].allowance+=p.allowance;acc[key].count++;return acc;},{})).sort((a,b)=>b[0].localeCompare(a[0]));
  const SummaryTable=({title,rows}:{title:string;rows:[string,{gross:number;allowance:number;count:number}][]})=><div className="wa-summary-table"><h3>{title}</h3>{rows.length?rows.map(([period,v])=><div className="wa-summary-row" key={period}><strong>{period}</strong><span>{money(v.gross)} gross</span><span>{money(v.allowance)} allowance</span><span>{v.count} checks</span></div>):<p className="wa-footnote">No paycheck history yet.</p>}</div>;
  return <div className="wa-summary-grid"><SummaryTable title="By month" rows={monthly}/><SummaryTable title="By year" rows={yearly}/></div>;
}
