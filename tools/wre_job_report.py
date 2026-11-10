#!/usr/bin/env python3
"""WRE job profitability report. Usage: python3 -I wre_report.py BUNDLE.txt CONFIG.json OUTDIR
BUNDLE is the text file from the WRE month pull script (0.7 or later). CONFIG may be {} (see SKILL.md)."""
import sys, re, json, os, math, datetime as dt, collections
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Image, Table, TableStyle, PageBreak

bundle, cfgp, outdir = sys.argv[1], sys.argv[2], sys.argv[3]
C = json.load(open(cfgp)) if os.path.exists(cfgp) else {}
os.makedirs(outdir, exist_ok=True)
L = open(bundle, encoding='utf-8').read().split('\n')
num = lambda s: float(re.sub(r'[^0-9.\-]', '', s) or 0)
MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
mname = lambda ym: MONTHS[int(ym[5:7]) - 1]
short = lambda ym: MONTHS[int(ym[5:7]) - 1][:3] + ('\n' + ym[:4] if ym[5:7] in ('01', '07') else '')

# ---------- read the bundle ----------
sec = {}
for i, l in enumerate(L):
    if l.startswith('== '): sec[l[3:].split(' (')[0].split(':')[0].strip(' =')] = i
def find(prefix): return next((v for k, v in sec.items() if k.startswith(prefix)), None)
def end_of(i): return min([v for v in sec.values() if v > i] + [len(L)])
pulled = re.search(r'pulled (\d{4}-\d\d-\d\d)', L[0]).group(1)
iI, iJ, iD = find('AROFLO INVOICES'), find('JOBS behind'), find('JOB DETAIL')
iTO, iCO = find('TRADEZONE orders opened'), find('CNW orders opened')
if iI is None or iJ is None or iD is None: sys.exit('This bundle has no invoices, jobs or job detail in it. It needs the WRE month pull script at 0.7 or later, with AroFlo ticked.')
head = [h.strip() for h in L[iI + 1].split(' | ')]
col = {h: n for n, h in enumerate(head)}
inv = []
for l in L[iI + 2:end_of(iI)]:
    c = l.split(' | ')
    if len(c) > col['JN'] and re.match(r'\d{4}-\d\d-\d\d$', c[col['date']].strip()):
        inv.append(dict(n=c[0], d=c[col['date']].strip(), st=c[col['status']], ex=num(c[col['ex GST']]), jn=c[col['JN']].strip()))
inv = [i for i in inv if not re.search('void|cancel|delet', i['st'], re.I)]
J = {}
for l in L[iJ + 2:end_of(iJ)]:
    if not l.startswith('JN '): continue
    c = [x.strip() for x in l.split(' | ')]
    if len(c) < 15: continue
    J[c[0][3:]] = dict(jn=c[0][3:], name=' | '.join(c[1:-13]), cl=c[-13], st=c[-11], hrs=num(c[-9]), mats=num(c[-7]), exp=num(c[-6]),
                       others=c[-1], lab=[], mat=[], expl=[], desc='', notes='')
def dmy(s):
    m = re.search(r'(\d{1,2})/(\d{1,2})/(\d{4})', s)
    return '%s-%02d-%02d' % (m.group(3), int(m.group(2)), int(m.group(1))) if m else ''
cur = part = None
for l in L[iD + 1:end_of(iD)]:
    if l.startswith('-- JN '):
        cur = J.get(l[6:].split(' | ')[0].strip()); part = None; continue
    if cur is None: continue
    if l.startswith('   desc: '): cur['desc'] = l[9:]; continue
    if l.startswith('   costing:'): part = 'c'; continue
    if l.startswith('   notes: '): cur['notes'] = l[10:]; part = None; continue
    if part and l.startswith('     '):
        t = l.strip(); c = t.split(' | ')
        if t in ('Labour', 'Material', 'Expense'): part = t; continue
        if part == 'Labour':
            m = re.search(r'([\d.]+) Hrs @ (\S+)', t)
            if m and dmy(c[-1]): cur['lab'].append(dict(who=c[0], hrs=float(m.group(1)), ty=m.group(2), d=dmy(c[-1])))
        elif part == 'Material' and len(c) >= 9 and dmy(c[-2]):
            if c[0].startswith('PO '): c = c[1:]
            cur['mat'].append(dict(desc=' '.join(c[:-8]), cost=num(c[-4]), d=dmy(c[-2])))
        elif part == 'Expense' and len(c) >= 7 and dmy(c[-2]):
            cur['expl'].append(dict(desc=' | '.join(c[1:-6]), cost=num(c[-4]), d=dmy(c[-2])))
sup = collections.Counter()   # supplier billing ex GST by month
if iTO is not None:
    ym = None
    for l in L[iTO + 1:end_of(iTO)]:
        if l.startswith('-- '):
            m = re.search(r'Order Date (\d{1,2})/(\d{1,2})/(\d{2,4})', l); ym = None
            if m: y = m.group(3); ym = ('20' + y if len(y) == 2 else y) + '-%02d' % int(m.group(2))
        else:
            m = re.match(r'\s*Grand Total \(Excl\.Tax\) \| \$([\d,.]+)', l)
            if m and ym: sup[ym] += num(m.group(1))
if iCO is not None:
    for l in L[iCO + 1:end_of(iCO)]:
        if l.startswith('-- '):
            c = l[3:].split(' | '); m = re.search(r'(\d\d)/(\d\d)/(\d\d)', c[3]) if len(c) > 3 else None   # CNW dates are month first
            if m: sup['20%s-%s' % (m.group(3), m.group(1))] += num(c[2]) / 1.1

# ---------- the period ----------
def month_end(y, m): return dt.date(y + (m == 12), m % 12 + 1, 1) - dt.timedelta(days=1)
if C.get('cut'): cut = dt.date.fromisoformat(C['cut'])
else:   # the latest month end that is at least 30 days before the pull, so everything counted should be paid
    lim = dt.date.fromisoformat(pulled) - dt.timedelta(days=30); cut = month_end(lim.year, lim.month)
    if cut > lim: cut = dt.date(lim.year, lim.month, 1) - dt.timedelta(days=1)
if C.get('start'): start = dt.date.fromisoformat(C['start'])
else:
    y, m = cut.year, cut.month - 2
    if m < 1: y, m = y - 1, m + 12
    start = dt.date(y, m, 1)
START, CUT, R = start.isoformat(), cut.isoformat(), C.get('rate', 95)
pm = []; y, m = start.year, start.month
while (y, m) <= (cut.year, cut.month): pm.append('%d-%02d' % (y, m)); y, m = (y + 1, 1) if m == 12 else (y, m + 1)
ref = C.get('ref_month', '%d-%02d' % (y, m)); ref = ref if any(i['d'][:7] == ref for i in inv) else None
A, B = mname(pm[0]), mname(pm[-1])
period = f"{A} to {B} {cut.year}" if start.year == cut.year else f"{A} {start.year} to {B} {cut.year}"
span = f"{A} to {B}" if start.year == cut.year else period

# ---------- the numbers: every job invoiced in the period, counted whole, up to the cut ----------
ib = collections.defaultdict(list)
for i in inv: ib[i['jn']].append(i)
jobs = []
for j in J.values():
    if not any(START <= i['d'] <= CUT for i in ib[j['jn']]): continue
    oth = [(m.group(1), float(m.group(2))) for m in re.finditer(r'\S+ (\d{4}-\d\d-\d\d) (-?[\d.]+)', j['others'])]
    rev = sum(i['ex'] for i in ib[j['jn']] if i['d'] <= CUT) + sum(a for d_, a in oth if d_ <= CUT)
    hrs = sum(x['hrs'] for x in j['lab'] if x['d'] <= CUT); trav = sum(x['hrs'] for x in j['lab'] if x['d'] <= CUT and x['ty'] == 'Travel')
    whole = abs(sum(x['cost'] for x in j['mat']) - j['mats']) <= 2 and abs(sum(x['cost'] for x in j['expl']) - j['exp']) <= 2
    mat = sum(x['cost'] for x in j['mat'] if x['d'] <= CUT) if whole else j['mats']      # lines cut short in the pull: AroFlo's own total
    exp = sum(x['cost'] for x in j['expl'] if x['d'] <= CUT) if whole else j['exp']
    jobs.append(dict(jn=j['jn'], name=j['name'], rev=rev, hrs=hrs, trav=trav, mat=mat, net=mat + exp, m=rev - mat - exp - hrs * R))
S_ = lambda k, js=jobs: sum(j[k] for j in js)
missing = {str(k): float(v) for k, v in C.get('missing', {}).items() if any(j['jn'] == str(k) for j in jobs)}
MG = sum(missing.values())
for j in jobs: j['allow'] = missing.get(j['jn'], 0); j['m'] -= j['allow']      # job margin after any missing gear allowance
rev, hrs, net, mat, lab = S_('rev'), S_('hrs'), S_('net'), S_('mat'), S_('hrs') * R
left = rev - net - lab - MG; pct = 100 * left / rev
inr = sum(i['ex'] for i in inv if START <= i['d'] <= CUT)
bands = []
for lo, hi, nm in [(0, 1000, 'Under 1,000'), (1000, 2500, '1,000 to 2,500'), (2500, 10000, '2,500 to 10,000'), (10000, 1e12, 'Over 10,000')]:
    js = [j for j in jobs if lo <= j['rev'] < hi]; bands.append(dict(name=nm, n=len(js), rev=S_('rev', js), hrs=S_('hrs', js), m=S_('m', js)))
rv = collections.Counter(); hp = collections.defaultdict(collections.Counter); mt = collections.Counter()
for i in inv: rv[i['d'][:7]] += i['ex']
for j in J.values():
    for x in j['lab']: hp[x['d'][:7]][x['who']] += x['hrs']
    for x in j['mat']: mt[x['d'][:7]] += x['cost']
allm = pm + ([ref] if ref else [])
matp, supp = sum(mt[m] for m in pm), sum(sup[m] for m in pm)

# solar jobs that look like they are missing their gear, for Claude to read and estimate
GEAR = re.compile(r'inverter|solar panel|jinko|trina|longi|sungrow|goodwe|fronius|solax|\bJKM|bifacial', re.I)
cand = []
for j in jobs:
    full = J[j['jn']]
    if j['rev'] > 2500 and re.search(r'solar|inverter|panels?\b', full['name'] + ' ' + full['desc'] + ' ' + full['notes'], re.I) \
       and not any(GEAR.search(x['desc']) for x in full['mat']) and not any(re.search('stc', e['desc'], re.I) for e in full['expl']):
        cand.append(dict(jn=j['jn'], name=j['name'], invoiced=round(j['rev']), materials=round(j['mat']), in_config=j['jn'] in missing, desc=full['desc'][:700], notes=full['notes'][:1500]))
json.dump(cand, open(os.path.join(outdir, 'missing-gear-candidates.json'), 'w'), indent=1)

# jobs with big margins, for Claude to check against the notes for gear or materials that never got entered
HI = C.get('high', {}); HP, HD, HR = HI.get('pct', 60), HI.get('dollars', 6000), HI.get('min_rev', 1500)
pc_ = lambda j: 100 * j['m'] / j['rev'] if j['rev'] else 0
high = [j for j in jobs if j['rev'] >= HR and (j['m'] >= HD or pc_(j) >= HP)]
checks = {str(k_): v for k_, v in C.get('checks', {}).items()}
clean = lambda t: re.sub(r'This purchased item is unbilled or recorded on a bill which has not been approved', '', t).strip()
json.dump([dict(jn=j['jn'], name=j['name'], invoiced=round(j['rev']), materials_net=round(j['net']), allowance=j['allow'], hours=round(j['hrs'], 1), margin=round(j['m']), pct=round(pc_(j)), checked=checks.get(j['jn'], ''),
                materials=[(round(x['cost']), x['d'], clean(x['desc'])[-90:]) for x in sorted(J[j['jn']]['mat'], key=lambda x: -x['cost'])[:8]],
                expenses=[(round(e['cost']), e['desc'][:70]) for e in J[j['jn']]['expl']], desc=J[j['jn']]['desc'][:900], notes=J[j['jn']]['notes'][:2500])
           for j in sorted(high, key=lambda j: -j['m'])], open(os.path.join(outdir, 'high-margin-candidates.json'), 'w'), indent=1)
listed = sorted({j['jn']: j for j in high + [j for j in jobs if j['allow']]}.values(), key=lambda j: -j['m'])
unchecked = [j['jn'] for j in listed if j['jn'] not in checks]

# ---------- charts (exact figures on the marks) ----------
OR, BL, TE, PU = '#D9650A', '#2563C9', '#149A7A', '#8A4FD0'      # validated set, fixed order
INK, MUT, GRID, SURF = '#2B2826', '#6F6A65', '#E6E2DE', '#FFFFFF'
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 10, 'axes.edgecolor': GRID, 'axes.labelcolor': MUT, 'xtick.color': MUT, 'ytick.color': MUT, 'text.color': INK,
                     'axes.spines.top': False, 'axes.spines.right': False, 'axes.spines.left': False, 'figure.facecolor': SURF, 'axes.facecolor': SURF})
def base(ax): ax.grid(axis='y', color=GRID, linewidth=0.8); ax.set_axisbelow(True); ax.tick_params(length=0)
def save(fig, name): fig.savefig(os.path.join(outdir, name), dpi=220, bbox_inches='tight', pad_inches=0.12); plt.close(fig)
def ticks(top, money=True):   # round axis steps that clear the tallest bar and its label
    step = next(s for s in (10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000) if top * 1.05 / s <= 5)
    n = math.ceil(top * 1.05 / step); t = [step * i for i in range(n + 1)]
    return t, [('0' if v == 0 else f'{v/1000:.0f}k') if money else f'{v:.0f}' for v in t]
title = dict(loc='left', fontsize=11, fontweight='bold')
# 1 invoicing by month, the reference month faded
fig, ax = plt.subplots(figsize=(6.6, 3.0)); base(ax); vals = [rv[m] for m in allm]
ax.bar(range(len(allm)), vals, width=0.42, color=[OR] * len(pm) + ['#F0B98A'] * (len(allm) - len(pm)), edgecolor=SURF, linewidth=2)
t, tl = ticks(max(vals)); ax.set_ylim(0, t[-1] * 1.04); ax.set_yticks(t); ax.set_yticklabels(tl)
MANY = len(allm) > 6
if MANY: ax.set_ylim(0, t[-1] * 1.22)
for x, v in enumerate(vals): ax.text(x, v + t[-1] * 0.017, f'${v:,.0f}', ha='center', va='bottom', fontsize=7.5 if MANY else 10, fontweight='bold', rotation=90 if MANY else 0)
ax.set_xticks(range(len(allm))); ax.set_xticklabels([(short if MANY else mname)(m) for m in pm] + ([mname(ref) + '\n(not yet fully due)'] if ref else []), fontsize=8.5 if MANY else 10)
ax.set_title('Revenue invoiced by month (ex GST)', pad=10, **title); save(fig, 'c1.png')
# 2 where each $100 goes
parts = [('Materials recorded in AroFlo, net of STCs', net, BL)] + ([('Materials not recorded (estimate)', MG, PU)] if MG else []) + [(f'Labour at ${R} per hour', lab, TE), ('Margin', left, OR)]
fig, ax = plt.subplots(figsize=(6.6, 1.75)); x0 = 0
for name, v, c in parts:
    w = 100 * v / rev; ax.barh(0, w - 0.5, left=x0 + 0.25, height=0.5, color=c, label=f'{name}: {w:.0f}')
    ax.text(x0 + w / 2, 0, f'{w:.0f}', ha='center', va='center', color='white', fontweight='bold', fontsize=11 if w > 6 else 9); x0 += w
ax.set_xlim(0, 100); ax.set_ylim(-0.3, 0.3); ax.axis('off')
ax.legend(frameon=False, loc='upper left', bbox_to_anchor=(0, -0.02), ncol=2, fontsize=8.5, handlelength=1.2, columnspacing=2.2)
ax.set_title('Allocation of each $100 invoiced', pad=4, **title); save(fig, 'c2.png')
# 3 margin by job size
fig, ax = plt.subplots(figsize=(6.6, 3.2)); base(ax); pc = [100 * b['m'] / b['rev'] if b['rev'] else 0 for b in bands]
ax.bar(range(4), pc, width=0.42, color=OR, edgecolor=SURF, linewidth=2)
top = max(10, math.ceil((max(pc) + 8) / 10) * 10); ax.set_ylim(min(0, math.floor(min(pc) / 10) * 10), top - 2)
for x, p in enumerate(pc): ax.text(x, max(p, 0) + 1.2, f'{p:.0f}%', ha='center', va='bottom', fontweight='bold')
ax.set_xticks(range(4)); ax.set_xticklabels([f"{b['name']}\n{b['n']} jobs\n{100*b['rev']/rev:.0f}% of revenue" for b in bands], fontsize=8.5)
yt = list(range(0, top, 10)); ax.set_yticks(yt); ax.set_yticklabels(['0'] + [f'{v}%' for v in yt[1:]])
ax.set_title(f'Margin by job size (labour at ${R} per hour)', pad=10, **title); save(fig, 'c3.png')
# 4 materials: AroFlo against the supplier accounts
fig, ax = plt.subplots(figsize=(6.6, 2.8 if MANY else 3.0)); base(ax); w = 0.3
t, tl = ticks(max([mt[m] for m in pm] + [sup[m] for m in pm])); ax.set_ylim(0, t[-1] * 1.04); ax.set_yticks(t); ax.set_yticklabels(tl)
for i, m in enumerate(pm):
    ax.bar(i - w / 2 - 0.02, mt[m], width=w, color=BL); ax.bar(i + w / 2 + 0.02, sup[m], width=w, color=TE)
    kw4 = dict(ha='center', va='bottom', fontsize=6.5, rotation=90) if MANY else dict(ha='center', va='bottom', fontsize=9)
    ax.text(i - w / 2 - 0.02, mt[m] + t[-1] * 0.015, f'${mt[m]:,.0f}', **kw4); ax.text(i + w / 2 + 0.02, sup[m] + t[-1] * 0.015, f'${sup[m]:,.0f}', **kw4)
if MANY: ax.set_ylim(0, t[-1] * 1.25)
ax.set_xticks(range(len(pm))); ax.set_xticklabels([(short if MANY else mname)(m) for m in pm], fontsize=8.5 if MANY else 10)
ax.legend(handles=[plt.Rectangle((0, 0), 1, 1, color=BL), plt.Rectangle((0, 0), 1, 1, color=TE)], labels=['Recorded in AroFlo', 'Billed by Tradezone and CNW'], frameon=False, loc='upper right', fontsize=8.5, ncol=2, bbox_to_anchor=(1, 1.02))
ax.set_title('Materials recorded in AroFlo compared with supplier billing (ex GST)', pad=16, **title); save(fig, 'c4.png')
# 5 hours by person and month. A person keeps their colour from run to run (set 'people' in the config).
tot = collections.Counter()
for m in allm:
    for k, v in hp[m].items(): tot[k] += v
order = C.get('people') or sorted(p for p, v in tot.items() if v >= 20)      # config 'people' fixes who gets which colour
FIXED = dict(zip(order[:4], [OR, BL, TE, PU]))
people = [p for p in FIXED if tot[p] >= 1]
if C.get('others'):
    for m in allm:
        o = sum(v for k, v in hp[m].items() if k not in FIXED)
        hp[m] = collections.Counter({k: v for k, v in hp[m].items() if k in FIXED}); hp[m]['Other staff'] = o
    FIXED['Other staff'] = PU; people.append('Other staff')
fig, ax = plt.subplots(figsize=(6.6, 2.8 if MANY else 3.0)); base(ax); bot = [0] * len(allm)
for p in people:
    v = [hp[m].get(p, 0) for m in allm]; nm = p if p == 'Other staff' else p.split(' ')[0] + '. ' + ' '.join(p.split(' ')[1:])
    ax.bar(range(len(allm)), v, bottom=bot, width=0.6 if MANY else 0.42, color=FIXED.get(p, PU), edgecolor=SURF, linewidth=2, label=nm)
    for x, (b0, h) in enumerate(zip(bot, v)):
        if h >= (40 if MANY else 18): ax.text(x, b0 + h / 2, f'{h:.0f}', ha='center', va='center', color='white', fontsize=6.5 if MANY else 9, fontweight='bold')
    bot = [b0 + h for b0, h in zip(bot, v)]
t, tl = ticks(max(bot), False); ax.set_ylim(0, t[-1] * 1.10); ax.set_yticks(t); ax.set_yticklabels(tl)
for x, tt in enumerate(bot): ax.text(x, tt + t[-1] * 0.014, f'{tt:.0f}', ha='center', va='bottom', fontweight='bold', fontsize=8 if MANY else 10)
if MANY: ax.set_ylim(0, t[-1] * 1.18)
ax.set_xticks(range(len(allm))); ax.set_xticklabels([(short if MANY else mname)(m) for m in allm], fontsize=8.5 if MANY else 10)
ax.legend(frameon=False, loc='upper right', fontsize=8.5, ncol=len(people), bbox_to_anchor=(1, 1.08 if MANY else 1.02)); ax.set_title('Hours logged to jobs by month', pad=22 if MANY else 16, **title); save(fig, 'c5.png')

# ---------- the wording (rounded in the writing) ----------
k = lambda v: f'${round(v, -3):,.0f}'
d = lambda v: ('-$' if v < 0 else '$') + f'{abs(v):,.0f}'
def share(p, cap=False):
    s = 'about a quarter' if 22 <= p <= 28 else 'about a third' if 31 <= p <= 36 else 'about half' if 47 <= p <= 53 else f'about {p:.0f}%'
    return ('Roughly' + s[5:]) if cap else s
WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten']
T = C.get('text', {})
nm_ = len(pm); permonth = inr / nm_ * left / rev
sm = bands[:2]; smn, smr, smh = sum(b['n'] for b in sm), sum(b['rev'] for b in sm), sum(b['hrs'] for b in sm)
p130 = 100 * (rev - net - MG - hrs * 130) / rev; worst = 100 * (left - 0.2 * mat) / rev
seq = [rv[m] for m in allm]
trend = T.get('summary_trend') or (f"Invoicing fell each month from {mname(allm[0])} through to {mname(allm[-1])}." if all(a > b for a, b in zip(seq, seq[1:]))
        else f"Invoicing rose each month from {mname(allm[0])} through to {mname(allm[-1])}." if all(a < b for a, b in zip(seq, seq[1:]))
        else f"Monthly invoicing ranged from about {k(min(seq))} to about {k(max(seq))}.")
mats_line = T.get('summary_materials') or ('Materials recorded in AroFlo line up with what Tradezone and CNW billed over the same months.' if matp and 0.85 <= supp / matp <= 1.2
        else 'Materials recorded in AroFlo differ from what Tradezone and CNW billed over the same months. See the Materials section.')
rev_text = T.get('revenue') or (f"{span} totalled about {k(inr)}." + (f" {mname(ref)} came in at about {k(rv[ref])}." if ref else ''))
avg_h = round(sum(sum(hp[m].values()) for m in pm) / nm_, -1)
hours_text = T.get('hours') or (f"Hours logged to jobs averaged around {avg_h:.0f} a month from {span}" + (f", and were about {round(sum(hp[ref].values()), -1):.0f} in {mname(ref)}" if ref else '') +
        f". {share(100 * S_('trav') / hrs, True)} of logged hours are travel. Office and quoting time is not logged to jobs and is not shown.")
n_miss = len(missing)
miss_text = T.get('missing') or (f"{WORDS[n_miss] if n_miss <= 10 else n_miss} solar job{'s do' if n_miss != 1 else ' does'} not have {'their' if n_miss != 1 else 'its'} panels and inverters entered in AroFlo. "
        f"An allowance of about {k(MG)} has been included for these, based on typical panel and inverter costs. Entering the actual materials would firm this up.") if n_miss else ''

# ---------- the PDF ----------
ORc = colors.HexColor(OR); INKc = colors.HexColor(INK); MUTc = colors.HexColor(MUT); LINE = colors.HexColor(GRID); WASH = colors.HexColor('#FBF3EC'); GREY = colors.HexColor('#F5F3F1')
W, H = A4; LM = 18 * mm
st = lambda n, **kw: ParagraphStyle(n, fontName=kw.pop('font', 'Helvetica'), textColor=kw.pop('color', INKc), **kw)
H1 = st('h1', font='Helvetica-Bold', fontSize=22, leading=26, spaceAfter=2); SUB = st('sub', fontSize=11, leading=15, color=MUTc, spaceAfter=10)
H2 = st('h2', font='Helvetica-Bold', fontSize=13.5, leading=17, spaceBefore=10, spaceAfter=5, color=ORc)
P = st('p', fontSize=10, leading=14.2, spaceAfter=6); Bu = st('b', fontSize=10, leading=14.2, leftIndent=11, bulletIndent=1, spaceAfter=3); SM = st('sm', fontSize=8.5, leading=11.5, color=MUTc, spaceAfter=4)
TC = st('tc', fontSize=8.8, leading=11.5); TCB = st('tcb', font='Helvetica-Bold', fontSize=8.8, leading=11.5); TCR = st('tcr', fontSize=8.8, leading=11.5, alignment=2); TCRB = st('tcrb', font='Helvetica-Bold', fontSize=8.8, leading=11.5, alignment=2)
TN = st('tn', font='Helvetica-Bold', fontSize=17, leading=20); TL = st('tl', fontSize=8.3, leading=10.5, color=MUTc)
bullets = lambda items: [Paragraph(x, Bu, bulletText='•') for x in items]
def img(name, w):
    from PIL import Image as PI
    iw, ih = PI.open(os.path.join(outdir, name)).size; return Image(os.path.join(outdir, name), width=w, height=w * ih / iw)
def table(rows, widths):
    data = [[Paragraph(str(c), (TCRB if ri in (0, len(rows) - 1) else TCR) if ci else (TCB if ri in (0, len(rows) - 1) else TC)) for ci, c in enumerate(r)] for ri, r in enumerate(rows)]
    t = Table(data, colWidths=widths)
    t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LINEBELOW', (0, 0), (-1, -2), 0.5, LINE), ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4), ('LEFTPADDING', (0, 0), (-1, -1), 5), ('RIGHTPADDING', (0, 0), (-1, -1), 5),
                           ('BACKGROUND', (0, 0), (-1, 0), GREY), ('LINEBELOW', (0, 0), (-1, 0), 0.8, MUTc), ('BACKGROUND', (0, -1), (-1, -1), WASH), ('LINEABOVE', (0, -1), (-1, -1), 0.8, ORc)])); return t
def tiles(items):
    t = Table([[[Paragraph(n, TN), Paragraph(l, TL)] for n, l in items]], colWidths=[174 * mm / len(items)] * len(items))
    t.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), WASH), ('LINEBEFORE', (1, 0), (-1, -1), 3, colors.white), ('TOPPADDING', (0, 0), (-1, -1), 9), ('BOTTOMPADDING', (0, 0), (-1, -1), 9), ('LEFTPADDING', (0, 0), (-1, -1), 9), ('VALIGN', (0, 0), (-1, -1), 'TOP')])); return t
def page(c, doc):
    c.saveState(); c.setFillColor(ORc); c.rect(0, H - 7 * mm, W, 7 * mm, stroke=0, fill=1); c.setFont('Helvetica', 8); c.setFillColor(MUTc)
    c.drawString(LM, 10 * mm, f'Wired Rite Electrical  |  Job Profitability, {period}  |  All figures exclude GST'); c.drawRightString(W - LM, 10 * mm, f'Page {doc.page}'); c.restoreState()
pdf = os.path.join(outdir, f'WRE-Job-Profitability-{A[:3]}-{B[:3]}-{cut.year}.pdf')
doc = BaseDocTemplate(pdf, pagesize=A4, leftMargin=LM, rightMargin=LM, topMargin=17 * mm, bottomMargin=18 * mm, title=f'Wired Rite Electrical: Job Profitability, {period}', author='Wired Rite Electrical')
doc.addPageTemplates([PageTemplate(id='p', frames=[Frame(LM, 18 * mm, W - 2 * LM, H - 35 * mm, id='f', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)], onPage=page)])
cutw = f'{cut.day} {B}'
S = [Paragraph('Wired Rite Electrical', H1), Paragraph(f'Job Profitability: {period}', SUB),
     tiles([(d(inr), f'Invoiced {span} (ex GST)'), (f'{len(jobs)}', 'Jobs invoiced'), (f'{pct:.0f}%', 'Margin after materials and labour'), (d(round(permonth, -2)), 'Average margin per month')]),
     Spacer(1, 8), Paragraph('Summary', H2)]
S += bullets([f'Jobs invoiced from {span} returned a margin of about {pct:.0f}% after materials and labour, with labour costed at ${R} per hour.',
              f'That is roughly {k(permonth)} per month on about {k(inr / nm_)} per month of invoicing.', mats_line, trend,
              'Larger jobs produce most of the margin. Jobs under $2,500 are most of the jobs but only a small part of the revenue.'])
S += [Paragraph('How this was worked out', H2)]
S += bullets(['Figures come from AroFlo invoices, timesheets and materials, checked against the Tradezone and CNW accounts.',
              f'Only invoices dated up to {cutw} are counted. Builder terms are a month at most, so this work should all be paid.' + (f' {mname(ref)} is shown on the charts for reference only.' if ref else ''),
              f'Each job is counted in full: everything invoiced on it, every hour logged to it at ${R}, and all materials entered against it.',
              f'The ${R} per hour is a loaded rate covering wages, super, vehicles, fuel and office costs.'])
S += [Paragraph('Invoicing by month', H2), img('c1.png', 150 * mm), Paragraph(rev_text, P),
      PageBreak(), Paragraph('Where the money goes', H2), img('c2.png', 160 * mm), Spacer(1, 4),
      table([['', 'Amount', 'Share'], ['Invoiced on these jobs', d(rev), '100%'], ['Materials, net of STCs', d(net), f'{100*net/rev:.0f}%']] +
            ([['Materials not yet entered in AroFlo (estimate)', d(MG), f'{100*MG/rev:.0f}%']] if MG else []) +
            [[f'Labour, {hrs:,.0f} hours at ${R}', d(lab), f'{100*lab/rev:.0f}%'], ['Margin', d(left), f'{pct:.0f}%']], [108 * mm, 34 * mm, 32 * mm]), Spacer(1, 5)]
if rev - inr > 500: S += [Paragraph(f'The invoiced total is higher than the {span} figure because some of these jobs were part invoiced before {A}. Those earlier invoices are counted along with the hours and materials that went with them.', SM)]
S += [Paragraph('Margin by job size', H2), img('c3.png', 150 * mm),
      Paragraph(T.get('small_jobs') or f'Jobs under $2,500 make up {smn} of the {len(jobs)} jobs and {share(100*smh/hrs)} of the hours, but only about {100*smr/rev:.0f}% of the revenue. They cover their costs with little to spare. Jobs over $2,500 bring in close to {round(100-100*smr/rev, -1):.0f}% of the revenue at a noticeably better margin.', P),
      PageBreak(), Paragraph('Materials', H2), img('c4.png', 132 * mm),
      Paragraph(T.get('materials') or f'For {span}, AroFlo shows about {k(matp)} of materials on these jobs. Tradezone and CNW billed about {k(supp)} over the same months. The difference is expected, as the supplier accounts include stock and materials for jobs not yet invoiced.', P)]
if miss_text: S += [Paragraph(miss_text, P)]
S += [Paragraph('Hours on the tools', H2), img('c5.png', 132 * mm), Paragraph(hours_text, P), Paragraph('Points to note', H2)]
S += bullets(['These figures show what was invoiced, not what has been received.',
              f"The ${R} per hour has not been checked against this year's actual costs. If the true figure were $130 per hour, the margin would still be about {p130:.0f}%.",
              f'If every material cost were 20% higher than recorded, the margin would still be about {worst:.0f}%.', 'Work done but not yet invoiced is not included.'])
def short(n):   # address without the builder's PO numbers in front
    n = re.sub(r'^(P\.?O\.? No:?\s*)?[A-Z]{0,3}[\d-]*\d[\w-]*\s*-?\s*', '', n.strip()); n = re.sub(r'\s+(QLD|NSW)\s*\d{0,4}$', '', n, flags=re.I)
    return n[:44]
if listed:
    JC = st('jc', fontSize=7.6, leading=9.6); JCB = st('jcb', font='Helvetica-Bold', fontSize=7.6, leading=9.6); JR = st('jr', fontSize=7.6, leading=9.6, alignment=2); JRB = st('jrb', font='Helvetica-Bold', fontSize=7.6, leading=9.6, alignment=2)
    rows = [[Paragraph(x, JCB if i in (0, 7) else JRB) for i, x in enumerate(['Job', 'Invoiced', 'Materials', 'Allowance', 'Labour', 'Margin', '%', 'Checked'])]]
    for j in listed:
        rows.append([Paragraph(f"<b>{j['jn']}</b> {short(j['name'])}", JC), Paragraph(d(j['rev']), JR), Paragraph(d(j['net']), JR), Paragraph(d(j['allow']) if j['allow'] else '', JR),
                     Paragraph(d(j['hrs'] * R), JR), Paragraph(d(j['m']), JR), Paragraph(f"{pc_(j):.0f}%", JR), Paragraph(checks.get(j['jn'], 'Not checked'), JC)])
    jt = Table(rows, colWidths=[40 * mm, 17 * mm, 17 * mm, 16 * mm, 16 * mm, 16 * mm, 9 * mm, 43 * mm], repeatRows=1)
    jt.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LINEBELOW', (0, 0), (-1, -1), 0.5, LINE), ('BACKGROUND', (0, 0), (-1, 0), GREY), ('LINEBELOW', (0, 0), (-1, 0), 0.8, MUTc),
                            ('TOPPADDING', (0, 0), (-1, -1), 3), ('BOTTOMPADDING', (0, 0), (-1, -1), 3), ('LEFTPADDING', (0, 0), (-1, -1), 3), ('RIGHTPADDING', (0, 0), (-1, -1), 3)]))
    S += [PageBreak(), Paragraph('Job list: high margin jobs and allowances', H2),
          Paragraph(T.get('job_list') or f"Every job that returned {HP}% or more, or {d(HD)} or more, after materials and labour, plus every job with a materials allowance. Each one was checked against its job notes for gear or materials supplied but not entered in AroFlo. "
                    f"Materials are net of STCs, labour is logged hours at ${R}, and the margin is after any allowance.", P), Spacer(1, 2), jt]
doc.build(S)
print(json.dumps(dict(pdf=pdf, pulled=pulled, start=START, cut=CUT, ref_month=ref, rate=R, jobs=len(jobs), invoiced_in_period=round(inr, 2), invoiced_on_jobs=round(rev, 2), hours=round(hrs, 2),
      materials=round(mat, 2), materials_net=round(net, 2), missing_gear=MG, labour=round(lab, 2), margin=round(left, 2), margin_pct=round(pct, 1),
      aroflo_materials_in_period=round(matp), high_margin_jobs=len(high), job_list=len(listed), unchecked=unchecked, supplier_billing_in_period=round(supp), monthly={m: dict(invoiced=round(rv[m]), hours=round(sum(hp[m].values()))) for m in allm},
      missing_gear_candidates=[(c['jn'], c['name'][:40], c['invoiced'], c['materials'], 'in config' if c['in_config'] else 'NOT in config') for c in cand]), indent=1))
