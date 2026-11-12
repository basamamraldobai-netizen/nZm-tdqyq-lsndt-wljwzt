import { createContext, type ChangeEvent, type ReactNode, useContext, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Link,
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';
import {
  AlertCircle, ArrowDownToLine, ArrowLeft, ArrowUpFromLine, BadgeCheck, BookOpenCheck,
  Check, CheckCircle2, ChevronLeft, CircleHelp, ClipboardList, FileSpreadsheet,
  FileText, LayoutDashboard, Link2, ListChecks, Plus, Search, ShieldCheck,
  SlidersHorizontal, Trash2, Upload, WalletCards,
} from 'lucide-react';

type SourceRow = {
  id: string; sourceRowNumber: number; passportName: string; receiptNumber: string;
  paidRaw: string; remainingRaw: string; agentRaw: string; statusRaw: string;
  professionRaw: string; dateRaw: string; noteRaw: string;
};
type AgentAlias = { canonicalName: string; aliases: string[]; approved: boolean };
type AllocationMap = Record<string, Record<string, number>>;
type Workbook = { filename: string; importedAt: string; rows: SourceRow[] };
type Store = { workbook: Workbook | null; aliases: AgentAlias[]; allocations: AllocationMap; setWorkbook: (workbook: Workbook | null) => void; setAliases: (value: AgentAlias[]) => void; setAllocations: (value: AllocationMap) => void };

const StoreContext = createContext<Store | null>(null);
const emptyStore = { workbook: null as Workbook | null, aliases: [] as AgentAlias[], allocations: {} as AllocationMap };
const STORAGE_KEY = 'sijil-reconcile-v1';
const navigation = [
  { href: '/', label: 'نظرة عامة', icon: LayoutDashboard },
  { href: '/transactions', label: 'الحركات', icon: ClipboardList },
  { href: '/review', label: 'المراجعة', icon: ListChecks },
  { href: '/shared', label: 'السندات المشتركة', icon: WalletCards },
  { href: '/agents', label: 'أسماء الوكلاء', icon: BadgeCheck },
  { href: '/export', label: 'التصدير', icon: ArrowDownToLine },
];

function readStore() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value ? { ...emptyStore, ...JSON.parse(value) } : emptyStore;
  } catch { return emptyStore; }
}
function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error('Store provider missing');
  return value;
}
function parseCsv(text: string) {
  const clean = text.replace(/^\uFEFF/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = (firstLine.match(/\t/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? '\t' : ',';
  const records: string[][] = [];
  let record: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    if (char === '"' && quoted && clean[i + 1] === '"') { cell += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { record.push(cell.trim()); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && clean[i + 1] === '\n') i++;
      record.push(cell.trim()); if (record.some(Boolean)) records.push(record);
      record = []; cell = '';
    } else cell += char;
  }
  record.push(cell.trim()); if (record.some(Boolean)) records.push(record);
  if (records.length < 2) return [];
  const headers = records[0].map((h) => h.trim().toLowerCase().replace(/[\s_-]+/g, ''));
  const aliases: Record<string, string[]> = {
    passportName: ['passportname', 'passport', 'name', 'passportholder', 'اسم', 'اسمالجواز', 'اسمصاحبالجواز'],
    receiptNumber: ['receipt', 'receiptnumber', 'receiptno', 'voucher', 'voucherid', 'رقمالسند', 'السند'],
    paidRaw: ['paid', 'paidraw', 'amountpaid', 'amount', 'المبلغ', 'المدفوع'],
    remainingRaw: ['remaining', 'remainingraw', 'balance', 'المتبقي', 'الرصيد'],
    agentRaw: ['agent', 'agentname', 'agentraw', 'الوكيل', 'اسمالوكيل'],
    statusRaw: ['status', 'statusraw', 'الحالة'],
    professionRaw: ['profession', 'job', 'professionraw', 'المهنة'],
    dateRaw: ['date', 'dateRaw', 'التاريخ'],
    noteRaw: ['note', 'notes', 'remarks', 'ملاحظات'],
  };
  const indices = Object.fromEntries(Object.entries(aliases).map(([key, names]) => [key, headers.findIndex((header) => names.includes(header))]));
  const col = (row: string[], key: string) => indices[key] >= 0 ? row[indices[key]] ?? '' : '';
  return records.slice(1).map((raw, index): SourceRow => ({
    id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    sourceRowNumber: index + 2, passportName: col(raw, 'passportName'), receiptNumber: col(raw, 'receiptNumber'),
    paidRaw: col(raw, 'paidRaw'), remainingRaw: col(raw, 'remainingRaw'), agentRaw: col(raw, 'agentRaw'),
    statusRaw: col(raw, 'statusRaw'), professionRaw: col(raw, 'professionRaw'), dateRaw: col(raw, 'dateRaw'), noteRaw: col(raw, 'noteRaw'),
  }));
}

function Button({ children, onClick, variant = 'primary', testId, disabled = false, type = 'button' }: { children: ReactNode; onClick?: () => void; variant?: 'primary' | 'quiet' | 'outline' | 'danger'; testId: string; disabled?: boolean; type?: 'button' | 'submit' }) {
  return <button type={type} data-testid={testId} disabled={disabled} onClick={onClick} className={`button button-${variant}`}>{children}</button>;
}
function PageHeader({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail: string; action?: ReactNode }) {
  return <header className="page-header"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{detail}</p></div>{action}</header>;
}
function EmptyState({ title, detail, icon: Icon = FileSpreadsheet }: { title: string; detail: string; icon?: typeof FileSpreadsheet }) {
  return <div className="empty-state" data-testid="empty-state"><span className="empty-icon"><Icon size={23} strokeWidth={1.7} /></span><h3>{title}</h3><p>{detail}</p></div>;
}
function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warning' }) {
  return <div className={`notice notice-${tone}`} data-testid={`notice-${tone}`}><CircleHelp size={17} /> <span>{children}</span></div>;
}
function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <div className="app-shell" dir="rtl">
    <aside className="sidebar">
      <Link href="/" className="brand" data-testid="link-home"><span className="brand-mark"><BookOpenCheck size={20} /></span><span><b>سِجل</b><small>مراجعة السندات</small></span></Link>
      <div className="nav-caption">مساحة العمل</div>
      <nav className="main-nav" aria-label="التنقل الرئيسي">{navigation.map(({ href, label, icon: Icon }) => <Link key={href} href={href} data-testid={`nav-${href === '/' ? 'home' : href.slice(1)}`} className={`nav-link ${location === href ? 'active' : ''}`}><Icon size={18} strokeWidth={1.8} /><span>{label}</span>{location === href && <span className="nav-current" />}</Link>)}</nav>
      <div className="sidebar-bottom"><div className="privacy-chip"><ShieldCheck size={16} /><span>محلي على هذا الجهاز</span></div><p>لا تُرسل البيانات إلى أي خادم.</p></div>
    </aside>
    <main className="main-area">
      <div className="topbar"><span className="topbar-label">دفتر المطابقة</span><span className="local-state"><i /> البيانات محفوظة في المتصفح</span></div>
      <div className="page-content">{children}</div>
      <footer className="page-footer"><span>سِجل — أداة مكتبية خاصة</span><span>كل صف محفوظ كما ورد في المصدر</span></footer>
    </main>
  </div>;
}
function UploadCard({ compact = false }: { compact?: boolean }) {
  const { setWorkbook } = useStore();
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    if (!/\.(csv|tsv|txt)$/i.test(file.name)) { setError('هذا الملف ليس CSV أو TSV. احفظ ورقة Excel بصيغة CSV ثم أعد اختيارها.'); event.target.value = ''; return; }
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (!rows.length) { setError('لم نعثر على صفوف بيانات. تحقق من صف العناوين ثم حاول مجددًا.'); return; }
      setWorkbook({ filename: file.name, importedAt: new Date().toISOString(), rows });
    } catch { setError('تعذرت قراءة الملف. تأكد من سلامة الملف ثم أعد المحاولة.'); }
    event.target.value = '';
  }
  return <div className={`upload-panel ${compact ? 'upload-compact' : ''}`}>
    <input ref={inputRef} className="visually-hidden" type="file" accept=".csv,.tsv,.txt" onChange={handleFile} data-testid="input-workbook" />
    <div className="upload-symbol"><ArrowUpFromLine size={21} /></div>
    <div className="upload-copy"><h3>{compact ? 'استبدال ملف المصدر' : 'ابدأ بملف السجل'}</h3><p>{compact ? 'استيراد ملف جديد يستبدل السجل المفتوح.' : 'اختر ملف CSV مُصدّرًا من Excel. لا يغادر الملف جهازك.'}</p></div>
    <Button onClick={() => inputRef.current?.click()} testId="button-upload"><Upload size={16} /> اختيار ملف</Button>
    {error && <div className="upload-error" role="alert" data-testid="upload-error"><AlertCircle size={16} />{error}</div>}
  </div>;
}

function Home() {
  const { workbook } = useStore();
  if (!workbook) return <><PageHeader eyebrow="سجل محلي · مراجعة يدوية" title="كل رقم يستحق مراجعة." detail="استورد ملفك، افحص الصفوف كما هي، ثم جهّز نسخة نظيفة للتنزيل." /><section className="welcome-grid"><div className="welcome-main"><div className="welcome-kicker"><span /> مساحة عمل خاصة</div><h2>ابدأ من المصدر.<br /><em>راجع قبل الاعتماد.</em></h2><p>سِجل يحفظ كل صف كما ورد، ويترك قرار المطابقة لك. لا دمج تلقائيًا، ولا تغييرات خفية على الأرقام.</p><UploadCard /></div><div className="welcome-aside"><div className="aside-index">طريقة العمل <span>01 — 03</span></div><div className="step"><span>01</span><div><b>استيراد</b><small>ملف CSV من Excel</small></div></div><div className="step"><span>02</span><div><b>فحص</b><small>راجع التنبيهات والمبالغ يدويًا</small></div></div><div className="step"><span>03</span><div><b>تصدير</b><small>نزّل نسخة مفهومة وواضحة</small></div></div><div className="aside-rule" /><p className="aside-foot"><ShieldCheck size={15} /> يعمل بالكامل داخل المتصفح</p></div></section><section className="principles"><div><b>لا حذف</b><span>الصفوف المتكررة تبقى كما هي.</span></div><div><b>لا احتساب خفي</b><span>المتبقي المكتوب لا يُعاد حسابه.</span></div><div><b>اعتماد بشري</b><span>لا تتم مطابقة الأسماء تلقائيًا.</span></div></section></>;
  const rows = workbook.rows;
  const flagged = rows.filter((row) => !row.passportName || !row.receiptNumber || !row.paidRaw).length;
  const receiptCount = new Set(rows.map(r => r.receiptNumber).filter(Boolean)).size;
  return <><PageHeader eyebrow="نظرة عامة" title="مرحبًا بك في السجل" detail="راجع المؤشرات، ثم انتقل إلى الصفوف التي تحتاج انتباهك." action={<Link href="/transactions" className="button button-primary" data-testid="link-all-transactions">عرض الحركات <ChevronLeft size={16} /></Link>} /><div className="source-strip"><div className="source-file"><span className="file-type"><FileSpreadsheet size={19} /></span><div><strong data-testid="text-filename">{workbook.filename}</strong><small>{new Date(workbook.importedAt).toLocaleDateString('ar', { dateStyle: 'medium' })} · محفوظ محليًا</small></div></div><span className="source-local"><i /> ملف نشط</span></div><section className="metric-grid"><Metric label="صفوف المصدر" number={rows.length} note="كل صف محفوظ" /><Metric label="أرقام سند مختلفة" number={receiptCount} note="بدون دمج للسجلات" /><Metric label="تحتاج إلى مراجعة" number={flagged} note="حقول أساسية فارغة" warning={flagged > 0} /></section><section className="home-workflow"><div className="section-title"><div><div className="eyebrow">الخطوة التالية</div><h2>افحص قبل أن تعتمد</h2></div><span>{rows.length} صفًا محفوظًا</span></div><div className="workflow-links"><Link href="/transactions" data-testid="link-review-transactions"><span className="workflow-icon"><Search size={18} /></span><div><b>ابحث في الحركات</b><small>اعرض القيم الأصلية لكل صف</small></div><ChevronLeft size={17} /></Link><Link href="/review" data-testid="link-review-issues"><span className="workflow-icon warm"><ListChecks size={18} /></span><div><b>افحص التنبيهات</b><small>حقول ناقصة وصفوف تحتاج قرارًا</small></div><ChevronLeft size={17} /></Link><Link href="/export" data-testid="link-export"><span className="workflow-icon"><ArrowDownToLine size={18} /></span><div><b>جهّز ملف التصدير</b><small>حمّل نسخة CSV قابلة للفتح في Excel</small></div><ChevronLeft size={17} /></Link></div></section><div className="source-controls"><Notice>كل بيانات الملف تبقى في مساحة التخزين المحلية لهذا المتصفح.</Notice><UploadCard compact /></div></>;
}
function Metric({ label, number, note, warning = false }: { label: string; number: number; note: string; warning?: boolean }) {
  return <div className={`metric ${warning ? 'metric-warning' : ''}`} data-testid={`metric-${label}`}><span>{label}</span><strong className="font-numeric">{number.toLocaleString('en')}</strong><small>{note}</small></div>;
}
function Transactions() {
  const { workbook } = useStore(); const [query, setQuery] = useState('');
  const rows = useMemo(() => (workbook?.rows ?? []).filter(row => Object.values(row).some(value => String(value).toLowerCase().includes(query.toLowerCase()))), [workbook, query]);
  return <><PageHeader eyebrow="دفتر المصدر" title="الحركات" detail="ابحث في القيم الأصلية. لا يتم دمج الصفوف أو تعديل حقولها." /><div className="toolbar"><label className="search-box"><Search size={17} /><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="ابحث بالاسم أو رقم السند..." data-testid="input-search-transactions" /><kbd>⌕</kbd></label><div className="table-count" data-testid="text-row-count">{rows.length} من {workbook?.rows.length ?? 0} صف</div></div>{!workbook ? <EmptyState title="لا يوجد ملف مستورد" detail="ارفع ملف CSV من صفحة نظرة عامة لبدء البحث." /> : rows.length ? <div className="table-wrap"><table className="data-table" data-testid="table-transactions"><thead><tr><th>صف المصدر</th><th>اسم الجواز</th><th>رقم السند</th><th>المبلغ المدفوع</th><th>المتبقي المكتوب</th><th>اسم الوكيل</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>{rows.map(row => <tr key={row.id} data-testid={`row-transaction-${row.id}`}><td className="font-numeric rownum">{row.sourceRowNumber}</td><td>{row.passportName || <span className="missing">غير مدخل</span>}</td><td className="font-numeric">{row.receiptNumber || '—'}</td><td className="font-numeric">{row.paidRaw || '—'}</td><td className="font-numeric">{row.remainingRaw || '—'}</td><td>{row.agentRaw || '—'}</td><td><span className="status-pill">{row.statusRaw || 'بلا حالة'}</span></td><td className="font-numeric">{row.dateRaw || '—'}</td></tr>)}</tbody></table><div className="table-foot">الأرقام المعروضة نُقلت كما وردت في الملف، ولم يُحتسب رصيد جديد.</div></div> : <EmptyState title="لا توجد نتائج" detail="جرّب كلمة بحث أخرى." icon={Search} />}</>;
}
function getIssues(rows: SourceRow[]) {
  const issues: { id: string; row: SourceRow; label: string; detail: string }[] = [];
  rows.forEach(row => {
    if (!row.passportName) issues.push({ id: `${row.id}-name`, row, label: 'اسم الجواز غير مدخل', detail: 'الاسم فارغ في المصدر؛ لم يُحذف الصف.' });
    if (!row.receiptNumber) issues.push({ id: `${row.id}-receipt`, row, label: 'رقم السند غير مدخل', detail: 'لا يمكن ربط هذا الصف بسند من دون رقم.' });
    if (!row.paidRaw) issues.push({ id: `${row.id}-amount`, row, label: 'المبلغ غير مدخل', detail: 'قيمة المبلغ فارغة في المصدر.' });
  });
  return issues;
}
function Review() {
  const { workbook } = useStore(); const [resolved, setResolved] = useState<string[]>([]);
  const issues = useMemo(() => getIssues(workbook?.rows ?? []).filter(issue => !resolved.includes(issue.id)), [workbook, resolved]);
  return <><PageHeader eyebrow="مراجعة الصفوف" title="تنبيهات تحتاج قرارك" detail="تظهر الحقول الناقصة فقط. كل صف أصلي محفوظ ولا يتغير عند إغلاق التنبيه." /><div className="review-summary"><div className="review-summary-icon"><ListChecks size={20} /></div><div><b>{issues.length ? `هناك ${issues.length} ملاحظة للمراجعة` : 'لا توجد ملاحظات مفتوحة'}</b><span>الإغلاق هنا للمتابعة فقط، ولا يعدّل بيانات المصدر.</span></div><span className="summary-count font-numeric">{issues.length.toLocaleString('en')}</span></div>{!workbook ? <EmptyState title="بانتظار ملف المصدر" detail="بعد الاستيراد ستظهر هنا الصفوف ذات الحقول الأساسية الناقصة." icon={ListChecks} /> : issues.length ? <div className="issue-list">{issues.map(issue => <article className="issue-row" key={issue.id} data-testid={`issue-${issue.id}`}><div className="issue-indicator"><AlertCircle size={18} /></div><div className="issue-content"><div className="issue-heading"><b>{issue.label}</b><span className="severity">مراجعة</span></div><p>{issue.detail}</p><div className="issue-source">صف المصدر <b className="font-numeric">{issue.row.sourceRowNumber}</b> <span>·</span> {issue.row.passportName || 'اسم غير مدخل'} <span>·</span> سند {issue.row.receiptNumber || 'غير محدد'}</div></div><Button variant="quiet" testId={`button-resolve-${issue.id}`} onClick={() => setResolved([...resolved, issue.id])}><Check size={15} /> تمت المراجعة</Button></article>)}</div> : <EmptyState title="السجل واضح حاليًا" detail="لم نعثر على حقول أساسية فارغة في الصفوف المستوردة." icon={CheckCircle2} />}</>;
}
function Shared() {
  const { workbook, allocations, setAllocations } = useStore();
  const groups = useMemo(() => {
    const map = new Map<string, SourceRow[]>();
    (workbook?.rows ?? []).filter(row => row.receiptNumber).forEach(row => map.set(row.receiptNumber, [...(map.get(row.receiptNumber) ?? []), row]));
    return [...map.entries()].filter(([, rows]) => rows.length > 1);
  }, [workbook]);
  const [messages, setMessages] = useState<Record<string, string>>({});
  function allocate(receipt: string, row: SourceRow, raw: string, totalRaw: string) {
    const amount = Number(raw); const total = Number(String(totalRaw).replace(/[^\d.-]/g, ''));
    const current = allocations[receipt] ?? {};
    const others = Object.entries(current).filter(([id]) => id !== row.id).reduce((sum, [, value]) => sum + Number(value || 0), 0);
    if (!Number.isFinite(amount) || amount < 0) { setMessages({ ...messages, [row.id]: 'أدخل مبلغًا صحيحًا يساوي صفرًا أو أكثر.' }); return; }
    if (amount + others > total) { setMessages({ ...messages, [row.id]: 'يتجاوز مجموع التوزيع إجمالي السند. لم يُحفظ المبلغ.' }); return; }
    setAllocations({ ...allocations, [receipt]: { ...current, [row.id]: amount } }); setMessages({ ...messages, [row.id]: '' });
  }
  return <><PageHeader eyebrow="توزيع يدوي" title="السندات المشتركة" detail="إجمالي السند يُسجّل مرة واحدة. اكتب حصة كل جواز يدويًا، وتحقق من المتبقي قبل الحفظ." /><Notice tone="warning">لا يُوزّع المبلغ تلقائيًا. الحقول الفارغة تعني أن الحصة لم تُحدد بعد.</Notice>{!workbook ? <EmptyState title="لا توجد سجلات بعد" detail="استورد ملفًا لعرض أرقام السندات المتكررة." icon={WalletCards} /> : !groups.length ? <EmptyState title="لا توجد أرقام سند مكررة" detail="ستظهر هنا السندات المرتبطة بأكثر من صف، دون دمج الصفوف." icon={WalletCards} /> : <div className="voucher-list">{groups.map(([receipt, rows]) => {
    const total = Number(String(rows[0].paidRaw).replace(/[^\d.-]/g, '')) || 0;
    const parts = allocations[receipt] ?? {}; const assigned = Object.values(parts).reduce((sum, amount) => sum + Number(amount || 0), 0);
    const remainder = total - assigned;
    return <section className="voucher-card" key={receipt} data-testid={`voucher-${receipt}`}><div className="voucher-head"><div><div className="eyebrow">رقم السند</div><h2 className="font-numeric">{receipt}</h2><small>{rows.length} صفوف مرتبطة · الصفوف محفوظة منفصلة</small></div><div className="voucher-total"><span>الإجمالي من الصف الأول</span><b className="font-numeric">{rows[0].paidRaw || 'غير مدخل'}</b><small>يُسجل مرة واحدة فقط</small></div></div><div className="allocation-head"><span>اسم الجواز</span><span>التخصيص</span><span>المتبقي من الإجمالي</span></div>{rows.map(row => <div className="allocation-row" key={row.id}><div><b>{row.passportName || 'اسم غير مدخل'}</b><small>صف المصدر <span className="font-numeric">{row.sourceRowNumber}</span></small></div><div className="allocation-input"><input type="number" min="0" step="any" value={parts[row.id] ?? ''} onChange={e => allocate(receipt, row, e.target.value, rows[0].paidRaw)} aria-label={`تخصيص ${row.passportName}`} placeholder="أدخل مبلغًا" data-testid={`input-allocation-${row.id}`} /><span>مبلغ</span></div><div className="remaining-cell font-numeric">{parts[row.id] === undefined ? 'غير مخصص' : Number(parts[row.id]).toLocaleString('en')}</div>{messages[row.id] && <p className="allocation-error" data-testid={`error-allocation-${row.id}`}><AlertCircle size={14} />{messages[row.id]}</p>}</div>)}<div className={`remainder-bar ${remainder < 0 ? 'remainder-error' : ''}`}><span>المتبقي غير المخصص</span><b className="font-numeric">{total ? remainder.toLocaleString('en') : 'غير متاح'}</b><span>{remainder === 0 && assigned > 0 ? 'تم توزيع الإجمالي' : 'يبقى ظاهرًا حتى يكتمل التوزيع'}</span></div></section>;
  })}</div>}</>;
}
function Agents() {
  const { workbook, aliases, setAliases } = useStore();
  const suggestions = useMemo(() => [...new Set((workbook?.rows ?? []).map(row => row.agentRaw.trim()).filter(Boolean))], [workbook]);
  const [canonical, setCanonical] = useState(''); const [aliasText, setAliasText] = useState(''); const [error, setError] = useState('');
  function addAlias() {
    const name = canonical.trim(); const variants = aliasText.split(/[،,]/).map(s => s.trim()).filter(Boolean);
    if (!name || !variants.length) { setError('أدخل الاسم المعتمد واسمًا بديلًا واحدًا على الأقل.'); return; }
    if (variants.some(v => v === name)) { setError('الاسم البديل لا يمكن أن يطابق الاسم المعتمد.'); return; }
    setAliases([...aliases, { canonicalName: name, aliases: variants, approved: false }]); setCanonical(''); setAliasText(''); setError('');
  }
  function decide(index: number, approved: boolean) {
    setAliases(aliases.map((item, i) => i === index ? { ...item, approved } : item));
  }
  return <><PageHeader eyebrow="مراجعة بشرية" title="أسماء الوكلاء" detail="اقترح الأسماء المعتمدة يدويًا. لا تُوحّد الأسماء قبل موافقتك." /><div className="agent-intro"><ShieldCheck size={19} /><span>كل صيغة اسم تبقى كما ظهرت في المصدر. الموافقة تحفظ اقتراحك فقط ولا تعدّل الصفوف.</span></div>{workbook && <section className="agent-form"><div className="section-title"><div><div className="eyebrow">اقتراح جديد</div><h2>أضف اسمًا للمراجعة</h2></div><span>{suggestions.length} صيغة وكيل في الملف</span></div><div className="form-row"><label>الاسم المعتمد<input value={canonical} onChange={e => setCanonical(e.target.value)} placeholder="اكتب الاسم المرجعي" data-testid="input-agent-canonical" /></label><label>الأسماء البديلة<input value={aliasText} onChange={e => setAliasText(e.target.value)} placeholder="افصل بين الأسماء بفاصلة" data-testid="input-agent-aliases" /></label><Button onClick={addAlias} testId="button-add-alias"><Plus size={16} /> إضافة للمراجعة</Button></div>{error && <p className="form-error" data-testid="agent-form-error">{error}</p>}{suggestions.length > 0 && <div className="source-name-list"><span>أسماء المصدر، كما هي:</span>{suggestions.slice(0, 8).map((name, i) => <span className="name-tag" key={`${name}-${i}`} data-testid={`agent-source-name-${i}`}>{name}</span>)}</div>}</section>}{!workbook ? <EmptyState title="لا توجد أسماء للمراجعة" detail="استورد ملفًا لإضافة صيغ الوكلاء إلى قائمة المراجعة." icon={BadgeCheck} /> : aliases.length === 0 ? <EmptyState title="لا توجد اقتراحات بعد" detail="أدخل اسمًا معتمدًا وصيغته البديلة لمراجعتهما يدويًا." icon={BadgeCheck} /> : <div className="alias-list">{aliases.map((alias, index) => <article className="alias-card" key={`${alias.canonicalName}-${index}`} data-testid={`alias-${index}`}><div className="alias-flow"><span className="alias-label">بدائل</span>{alias.aliases.map(item => <span className="name-tag" key={item}>{item}</span>)}<ArrowLeft size={16} /><b>{alias.canonicalName}</b></div><span className={`alias-status ${alias.approved ? 'approved' : ''}`}>{alias.approved ? 'معتمد' : 'بانتظار القرار'}</span><div className="alias-actions">{!alias.approved ? <Button variant="outline" testId={`button-approve-alias-${index}`} onClick={() => decide(index, true)}><Check size={15} /> اعتماد</Button> : <Button variant="quiet" testId={`button-reopen-alias-${index}`} onClick={() => decide(index, false)}>إعادة للمراجعة</Button>}<Button variant="quiet" testId={`button-delete-alias-${index}`} onClick={() => setAliases(aliases.filter((_, i) => i !== index))}><Trash2 size={15} /></Button></div></article>)}</div>}</>;
}
function Export() {
  const { workbook } = useStore(); const [includeOriginal, setIncludeOriginal] = useState(true); const [status, setStatus] = useState('');
  function download() {
    if (!workbook) return;
    const header = ['صف المصدر', 'اسم الجواز', 'رقم السند', 'المبلغ المدفوع كما ورد', 'المتبقي المكتوب كما ورد', 'اسم الوكيل', 'الحالة', 'المهنة', 'التاريخ', 'ملاحظات'];
    const rows = workbook.rows.map(row => [row.sourceRowNumber, row.passportName, row.receiptNumber, row.paidRaw, row.remainingRaw, row.agentRaw, row.statusRaw, row.professionRaw, row.dateRaw, row.noteRaw]);
    const quoted = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const data = [header, ...rows].map(row => row.map(quoted).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF', data], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${workbook.filename.replace(/\.[^.]+$/, '')}-مراجَع.csv`; anchor.click(); URL.revokeObjectURL(url);
    setStatus('تم تنزيل النسخة. افتح ملف CSV باستخدام Excel.');
  }
  return <><PageHeader eyebrow="نسخة للمراجعة" title="تصدير السجل" detail="أنشئ ملف CSV يحافظ على الصفوف والقيم الأصلية لفتحه في Excel." /><div className="export-layout"><section className="export-card"><div className="export-icon"><ArrowDownToLine size={22} /></div><div className="eyebrow">ملف قابل للفتح في Excel</div><h2>{workbook ? workbook.filename.replace(/\.[^.]+$/, '') + '-مراجَع.csv' : 'لم يُحدد ملف بعد'}</h2><p>التصدير لا يغيّر السجل الحالي. يتم إنشاء ملف جديد على جهازك عند الضغط على التنزيل.</p><div className="export-choices"><label className="check-row"><input type="checkbox" checked={includeOriginal} onChange={e => setIncludeOriginal(e.target.checked)} data-testid="checkbox-include-source" /><span><b>الحفاظ على كل صف مصدر</b><small>يتضمن الصفوف المتكررة والحقول الفارغة كما هي.</small></span></label><div className="export-option"><FileText size={17} /><span><b>المتبقي المكتوب</b><small>يُصدّر كنص المصدر، وليس رصيدًا محسوبًا.</small></span><CheckCircle2 size={16} /></div><div className="export-option"><Link2 size={17} /><span><b>ترقيم الصفوف</b><small>يحافظ على رقم الصف الأصلي من الملف.</small></span><CheckCircle2 size={16} /></div></div><Button onClick={download} testId="button-download-export" disabled={!workbook || !includeOriginal}><ArrowDownToLine size={17} /> تنزيل ملف CSV</Button>{status && <p className="success-message" data-testid="export-success"><CheckCircle2 size={16} />{status}</p>}</section><aside className="export-aside"><div className="export-aside-mark"><SlidersHorizontal size={18} /></div><h3>ما الذي سيبقى كما هو؟</h3><ul><li>كل صف في المصدر، بما فيه المكرر.</li><li>المبالغ كما كُتبت، بلا إعادة احتساب.</li><li>أسماء الجوازات دون دمج أو تصحيح.</li></ul><div className="aside-rule" /><small>{workbook ? `${workbook.rows.length} صفًا جاهزًا للتصدير` : 'استورد ملفًا أولًا لتهيئة التصدير'}</small></aside></div>{!workbook && <EmptyState title="بانتظار ملف للتصدير" detail="اذهب إلى نظرة عامة لاستيراد ملف CSV." icon={ArrowDownToLine} />}</>;
}

const queryClient = new QueryClient();

function Router() {
  return (
    <RoutedErrorBoundary>
      <Shell>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/transactions" component={Transactions} />
          <Route path="/review" component={Review} />
          <Route path="/shared" component={Shared} />
          <Route path="/agents" component={Agents} />
          <Route path="/export" component={Export} />
          <Route component={NotFound} />
        </Switch>
      </Shell>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  const [state, setState] = useState(readStore);
  const setWorkbook = (workbook: Workbook | null) => setState(current => ({ ...current, workbook, allocations: {} }));
  const setAliases = (aliases: AgentAlias[]) => setState(current => ({ ...current, aliases }));
  const setAllocations = (allocations: AllocationMap) => setState(current => ({ ...current, allocations }));
  const store: Store = { ...state, setWorkbook, setAliases, setAllocations };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* browser storage can be disabled */ }
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <StoreContext.Provider value={store}>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </StoreContext.Provider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
