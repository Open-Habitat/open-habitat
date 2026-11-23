"""Example Studio's December rota as a constraint model (OR-Tools CP-SAT).

Everything here is invented for the landing page: the people, the 23 rules
and the 19 wishes. The solver and its result are real: assets.mjs runs this
file and the grid in block.js is its output, unedited.

    python3 rota_model.py            the summary the conversation shows
    python3 rota_model.py --json     the grid and the wishes, for block.js

Four weeks, Mon 30 Nov to Sun 27 Dec 2026. One duty per person per day:
S shop, P pack, O office, C course, - free. The 23 rules are hard
constraints; the 19 wishes are the objective. Each rule is checked again
afterwards by check(), which reads only the finished grid and shares no code
with the model.
"""
import json
import sys
from datetime import date, timedelta

from ortools.sat.python import cp_model

START = date(2026, 11, 30)
DAYS = [START + timedelta(days=i) for i in range(28)]
D = range(28)
WEEKS = [range(w * 7, w * 7 + 7) for w in range(4)]
FULL_WEEKS = WEEKS[:3]  # weeks 49-51; week 52 ends at Christmas


def day(month, dom):
    return (date(2026, month, dom) - START).days


CLOSED = {day(12, n) for n in (24, 25, 26, 27)}
ADVENT = [day(12, 6), day(12, 13), day(12, 20)]
RUSH = range(day(12, 7), day(12, 22) + 1)
COURSE_SATS = [day(12, 5), day(12, 12), day(12, 19)]
WREATH = day(12, 12)
SAMI_BUDDY_UNTIL = day(12, 13)


def wd(d):
    return DAYS[d].weekday()  # 0 = Monday


WEEKDAYS = [d for d in D if wd(d) < 5 and d not in CLOSED]
SATS = [d for d in D if wd(d) == 5 and d not in CLOSED]

# Who can do what.
CAN = {
    'Alice': 'SP', 'Bob': 'PS', 'Kirsi': 'O', 'Carol': 'SC', 'Dave': 'OP', 'Erin': 'CS',
    'Sami': 'P', 'Noor': 'P', 'Tom': 'P', 'Iris': 'P',
}
PEOPLE = list(CAN)
FULL_TIME = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin']
SEASONAL = ['Noor', 'Tom', 'Iris']
TILL = ['Alice', 'Bob', 'Carol', 'Erin']
LEADS = ['Bob', 'Alice', 'Dave']

RULES = [
    'Closed 24 to 27 December: nobody works',
    'Shop open Monday to Friday: at least one person in the shop',
    'Saturdays: two people in the shop',
    'Advent Sundays 6, 13 and 20 December: one person in the shop, nothing else on a Sunday',
    'Only till-trained people in the shop: Alice, Bob, Carol, Erin',
    'The courier collects Monday to Friday: at least two packers',
    'Christmas rush 7 to 22 December: at least four packers on courier days',
    'Rush Saturdays 12 and 19 December: at least two packers',
    'Sami and the seasonal packers only pack',
    'Every packing day has a lead: Bob, Alice or Dave packs',
    'Until 13 December Sami packs only on days Bob packs',
    'Thursdays: Bob and Sami both pack, and Alice does not',
    'Office open Monday to Friday: Kirsi or Dave is there',
    'Kirsi works three days a week',
    'Erin teaches every Wednesday, and Saturdays 5, 12 and 19 December',
    'Carol helps at the wreath course on 12 December',
    'Nobody works more than five days in a row',
    'Full-timers work four or five days in a full week; agreed leave counts as a day',
    'Seasonal packers work three or four days a week',
    'Sami works four days a week',
    'Everyone has two days off in a row every week; Sunday with the Monday after counts',
    'Nobody works more than one Advent Sunday, and has the Monday after it off',
    'The seasonal packers get the same number of days, give or take one',
]

# The wishes in the order they were handed in. kind: off (that day free),
# only (works only on these weekdays), max_pack (packing days a week at most),
# not_sunday (not that Advent Sunday), no_sundays, works (wants that shift).
WISHES = [
    ('Kirsi', 'only', [0, 1, 2], 'Monday to Wednesday as her three days'),
    ('Kirsi', 'off', day(12, 23), 'Wed 23 Dec off'),
    ('Carol', 'off', day(12, 19), 'Sat 19 Dec off'),
    ('Bob', 'off', day(12, 19), 'Sat 19 Dec off'),
    ('Alice', 'off', day(12, 11), 'Fri 11 Dec off'),
    ('Alice', 'no_sundays', None, 'No Advent Sundays'),
    ('Erin', 'off', day(12, 15), 'Tue 15 Dec off'),
    ('Erin', 'not_sunday', day(12, 13), 'Not the Sunday after the wreath course'),
    ('Dave', 'off', day(12, 4), 'Fri 4 Dec off'),
    ('Dave', 'max_pack', 2, 'At most two packing days a week'),
    ('Sami', 'only', [0, 1, 3, 4, 5], 'Wednesdays free'),
    ('Sami', 'off', day(12, 12), 'Sat 12 Dec off'),
    ('Noor', 'only', [1, 2, 3, 4, 5], 'Mondays free'),
    ('Noor', 'off', day(12, 18), 'Fri 18 Dec off'),
    ('Tom', 'works', [day(12, 12), day(12, 19)], 'Both rush Saturdays'),
    ('Tom', 'off', day(12, 8), 'Tue 8 Dec off'),
    ('Iris', 'only', [0, 1, 2, 3, 5], 'Fridays free'),
    ('Iris', 'off', day(12, 22), 'Tue 22 Dec off'),
    ('Carol', 'off', day(11, 30), 'Mon 30 Nov off'),
]


def leave_days(p):
    """Weekdays a person asked off: leave, if the wish is kept."""
    return [w[2] for w in WISHES if w[0] == p and w[1] == 'off' and wd(w[2]) < 5]


def solve():
    m = cp_model.CpModel()
    x = {(p, d, k): m.NewBoolVar(f'{p}_{d}_{k}') for p in PEOPLE for d in D for k in CAN[p]}  # rules 5, 9
    works = {}
    for p in PEOPLE:
        for d in D:
            works[p, d] = m.NewBoolVar(f'w_{p}_{d}')
            m.Add(sum(x[p, d, k] for k in CAN[p]) == works[p, d])

    def on(k, d, who=PEOPLE):
        return sum(x[p, d, k] for p in who if k in CAN[p])

    for d in CLOSED:  # 1
        for p in PEOPLE:
            m.Add(works[p, d] == 0)
    for d in WEEKDAYS:
        m.Add(on('S', d) >= 1)  # 2
        m.Add(on('P', d) >= (4 if d in RUSH else 2))  # 6, 7
        m.Add(on('O', d) >= 1)  # 13
    for d in SATS:
        m.Add(on('S', d) == 2)  # 3
        if d in RUSH:
            m.Add(on('P', d) >= 2)  # 8
    for d in D:
        if wd(d) == 6 and d not in CLOSED:  # 4
            m.Add(on('S', d) == (1 if d in ADVENT else 0))
            for p in PEOPLE:
                for k in CAN[p]:
                    if k != 'S':
                        m.Add(x[p, d, k] == 0)
        if wd(d) >= 5:
            m.Add(on('O', d) == 0)
        for p in PEOPLE:  # 10
            if 'P' in CAN[p] and p not in LEADS:
                m.Add(x[p, d, 'P'] <= on('P', d, LEADS))
        if d <= SAMI_BUDDY_UNTIL:  # 11
            m.Add(x['Sami', d, 'P'] <= x['Bob', d, 'P'])
        if wd(d) == 3 and d not in CLOSED:  # 12
            m.Add(x['Bob', d, 'P'] == 1)
            m.Add(x['Sami', d, 'P'] == 1)
            m.Add(x['Alice', d, 'P'] == 0)
        # 15, 16: courses happen only on their days
        course_day = d not in CLOSED and (wd(d) == 2 or d in COURSE_SATS)
        m.Add(x['Erin', d, 'C'] == (1 if course_day else 0))
        m.Add(x['Carol', d, 'C'] == (1 if d == WREATH else 0))

    for p in PEOPLE:
        for d in range(28 - 5):  # 17
            m.Add(sum(works[p, e] for e in range(d, d + 6)) <= 5)

    kept = []
    for i, (p, kind, arg, _) in enumerate(WISHES):
        k = m.NewBoolVar(f'wish_{i}')
        kept.append(k)
        if kind == 'off':
            m.Add(works[p, arg] == 0).OnlyEnforceIf(k)
            m.Add(works[p, arg] == 1).OnlyEnforceIf(k.Not())
        elif kind == 'only':
            other = [works[p, d] for d in D if wd(d) not in arg]
            m.Add(sum(other) == 0).OnlyEnforceIf(k)
            m.Add(sum(other) >= 1).OnlyEnforceIf(k.Not())
        elif kind == 'max_pack':
            over = []
            for w in WEEKS:
                o = m.NewBoolVar(f'over_{i}_{w[0]}')
                n = sum(x[p, d, 'P'] for d in w)
                m.Add(n > arg).OnlyEnforceIf(o)
                m.Add(n <= arg).OnlyEnforceIf(o.Not())
                over.append(o)
            m.Add(sum(over) == 0).OnlyEnforceIf(k)
            m.Add(sum(over) >= 1).OnlyEnforceIf(k.Not())
        elif kind == 'not_sunday':
            m.Add(works[p, arg] == 0).OnlyEnforceIf(k)
            m.Add(works[p, arg] == 1).OnlyEnforceIf(k.Not())
        elif kind == 'no_sundays':
            n = sum(works[p, d] for d in ADVENT)
            m.Add(n == 0).OnlyEnforceIf(k)
            m.Add(n >= 1).OnlyEnforceIf(k.Not())
        elif kind == 'works':
            m.Add(sum(works[p, d] for d in arg) == len(arg)).OnlyEnforceIf(k)
            m.Add(sum(works[p, d] for d in arg) < len(arg)).OnlyEnforceIf(k.Not())
    kept_of = {i: kept[i] for i in range(len(WISHES))}

    def leave_kept(p, d):
        return next(kept_of[i] for i, w in enumerate(WISHES) if w[0] == p and w[1] == 'off' and w[2] == d)

    for wi, w in enumerate(WEEKS):
        full = wi < 3
        for p in FULL_TIME:  # 18
            n = sum(works[p, d] for d in w) + sum(leave_kept(p, d) for d in leave_days(p) if d in w)
            if full:
                m.Add(n >= 4)
                m.Add(n <= 5)
        n = sum(works['Kirsi', d] for d in w)  # 14
        m.Add(n == 3) if full else m.Add(n <= 3)
        n = sum(works['Sami', d] for d in w)  # 20
        m.Add(n == 4) if full else m.Add(n <= 3)
        for p in SEASONAL:  # 19
            n = sum(works[p, d] for d in w)
            if full:
                m.Add(n >= 3)
                m.Add(n <= 4)
            else:
                m.Add(n <= 3)
        if full:  # 21
            for p in PEOPLE:
                pairs = []
                for d in w:
                    b = m.NewBoolVar(f'pair_{p}_{d}')
                    m.Add(works[p, d] + works[p, d + 1] == 0).OnlyEnforceIf(b)
                    pairs.append(b)
                m.Add(sum(pairs) >= 1)
    for p in TILL:  # 22
        m.Add(sum(works[p, d] for d in ADVENT) <= 1)
        for d in ADVENT:
            m.Add(works[p, d + 1] == 0).OnlyEnforceIf(works[p, d])
    totals = [sum(works[p, d] for d in D) for p in SEASONAL]  # 23
    for a in totals:
        for b in totals:
            m.Add(a - b <= 1)

    # Objective. First as many wishes as possible; between two wishes that
    # cannot both be kept, the one handed in first. Then a tidy rota: full
    # weeks for the full-timers, few changes of duty from one working day to
    # the next, and Dave at his desk.
    tidy = []
    for p in PEOPLE:
        if len(CAN[p]) < 2:
            continue
        for d in range(27):
            for k in CAN[p]:
                for k2 in CAN[p]:
                    if k != k2:
                        s = m.NewBoolVar(f'sw_{p}_{d}_{k}{k2}')
                        m.Add(s >= x[p, d, k] + x[p, d + 1, k2] - 1)
                        tidy.append(s)
    dave_packs = sum(x['Dave', d, 'P'] for d in D)
    full_days = sum(works[p, d] for p in FULL_TIME for d in D)
    n = len(WISHES)
    m.Maximize(sum((1000 + (n - i)) * kept[i] for i in range(n)) + 3 * full_days - sum(tidy) - dave_packs)

    s = cp_model.CpSolver()
    s.parameters.num_search_workers = 1  # one worker and a fixed seed: the same rota every run
    s.parameters.random_seed = 0
    s.parameters.max_time_in_seconds = 120
    status = s.Solve(m)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        sys.exit(f'no rota: {s.StatusName(status)}')
    grid = {p: ''.join(next((k for k in CAN[p] if s.Value(x[p, d, k])), '-') for d in D) for p in PEOPLE}
    return {
        'status': s.StatusName(status), 'seconds': round(s.WallTime(), 2),
        'variables': len(m.Proto().variables), 'constraints': len(m.Proto().constraints),
        'grid': grid, 'kept': [bool(s.Value(k)) for k in kept],
    }


def check(grid):
    """The 23 rules again, read off the finished grid. Returns the rules that fail."""
    g = lambda p, d: grid[p][d]
    n = lambda k, d, who=PEOPLE: sum(g(p, d) == k for p in who)
    worked = lambda p, days: sum(g(p, d) != '-' for d in days)
    kept = wishes_kept(grid)
    leave = lambda p, w: sum(1 for i, x in enumerate(WISHES) if x[0] == p and x[1] == 'off' and x[2] in w and wd(x[2]) < 5 and kept[i])
    two_off = lambda p, w: any(g(p, d) == '-' and g(p, d + 1) == '-' for d in w)
    totals = [worked(p, D) for p in SEASONAL]
    ok = [
        all(g(p, d) == '-' for p in PEOPLE for d in CLOSED),
        all(n('S', d) >= 1 for d in WEEKDAYS),
        all(n('S', d) == 2 for d in SATS),
        all(n('S', d) == (1 if d in ADVENT else 0) and worked_all(grid, d) == n('S', d) for d in D if wd(d) == 6),
        all(g(p, d) != 'S' for p in PEOPLE if p not in TILL for d in D),
        all(n('P', d) >= 2 for d in WEEKDAYS),
        all(n('P', d) >= 4 for d in WEEKDAYS if d in RUSH),
        all(n('P', d) >= 2 for d in SATS if d in RUSH),
        all(g(p, d) in 'P-' for p in ['Sami'] + SEASONAL for d in D),
        all(n('P', d, LEADS) >= 1 for d in D if n('P', d)),
        all(g('Bob', d) == 'P' for d in range(SAMI_BUDDY_UNTIL + 1) if g('Sami', d) == 'P'),
        all(g('Bob', d) == 'P' and g('Sami', d) == 'P' and g('Alice', d) != 'P' for d in D if wd(d) == 3 and d not in CLOSED),
        all(n('O', d, ['Kirsi', 'Dave']) >= 1 for d in WEEKDAYS),
        all(worked('Kirsi', w) == 3 for w in FULL_WEEKS) and worked('Kirsi', WEEKS[3]) <= 3,
        all((g('Erin', d) == 'C') == (d not in CLOSED and (wd(d) == 2 or d in COURSE_SATS)) for d in D),
        g('Carol', WREATH) == 'C',
        all(worked(p, range(d, d + 6)) <= 5 for p in PEOPLE for d in range(23)),
        all(4 <= worked(p, w) + leave(p, w) <= 5 for p in FULL_TIME for w in FULL_WEEKS),
        all(3 <= worked(p, w) <= 4 for p in SEASONAL for w in FULL_WEEKS) and all(worked(p, WEEKS[3]) <= 3 for p in SEASONAL),
        all(worked('Sami', w) == 4 for w in FULL_WEEKS) and worked('Sami', WEEKS[3]) <= 3,
        all(two_off(p, w) for p in PEOPLE for w in FULL_WEEKS),
        all(worked(p, ADVENT) <= 1 and all(g(p, d + 1) == '-' for d in ADVENT if g(p, d) != '-') for p in PEOPLE),
        max(totals) - min(totals) <= 1,
    ]
    assert len(ok) == len(RULES)
    return [i + 1 for i, v in enumerate(ok) if not v]


def worked_all(grid, d):
    return sum(grid[p][d] != '-' for p in PEOPLE)


def wishes_kept(grid):
    out = []
    for p, kind, arg, _ in WISHES:
        row = grid[p]
        if kind in ('off', 'not_sunday'):
            out.append(row[arg] == '-')
        elif kind == 'only':
            out.append(all(row[d] == '-' for d in D if wd(d) not in arg))
        elif kind == 'max_pack':
            out.append(all(sum(row[d] == 'P' for d in w) <= arg for w in WEEKS))
        elif kind == 'no_sundays':
            out.append(all(row[d] == '-' for d in ADVENT))
        elif kind == 'works':
            out.append(all(row[d] != '-' for d in arg))
    return out


def main():
    r = solve()
    failed = check(r['grid'])
    kept = wishes_kept(r['grid'])
    assert kept == r['kept'], 'the grid and the solver disagree about the wishes'
    if '--json' in sys.argv:
        print(json.dumps({
            'start': START.isoformat(), 'people': PEOPLE, 'grid': r['grid'], 'rules': RULES, 'failed': failed,
            'wishes': [{'who': w[0], 'text': w[3], 'kept': k, 'days': ([w[2]] if w[1] in ('off', 'not_sunday') else w[2] if w[1] == 'works' else [])} for w, k in zip(WISHES, kept)],
            'status': r['status'], 'seconds': r['seconds'], 'variables': r['variables'], 'constraints': r['constraints'],
        }))
        return
    print(f"CP-SAT {r['status']} in {r['seconds']} s · {r['variables']} variables · {r['constraints']} constraints")
    print(f"rules checked on the result: {len(RULES) - len(failed)} of {len(RULES)} hold")
    print(f"wishes kept: {sum(kept)} of {len(kept)}")
    for w, k in zip(WISHES, kept):
        if not k:
            print(f"  not kept: {w[0]}, {w[3]}")
    if failed:
        sys.exit('rules broken: ' + ', '.join(str(i) for i in failed))


if __name__ == '__main__':
    main()
