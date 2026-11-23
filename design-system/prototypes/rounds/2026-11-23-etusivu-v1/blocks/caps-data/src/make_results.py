"""Riverside Rowing Club results 1998-2026: an invented dataset, seeded so it is
the same on every run. Writes results.csv (one row per crew result, 214 rows).
Run: python3 make_results.py <out.csv>"""
import csv, random, sys

rng = random.Random(1998)
REGATTAS = [  # name, month, typical events
    ("Spring Head", 3, ["W8+", "W4+", "M8+", "M4+"]),
    ("Riverside Regatta", 6, ["W2x", "W1x", "M2x", "Mix4x"]),
    ("River Cup", 7, ["W4x", "W2x", "M4x", "M1x"]),
    ("Autumn Sculls", 10, ["W1x", "M1x", "W2x"]),
    ("Masters Sprints", 8, ["MasW1x", "MasW2x", "MasM4+"]),
]
WOMEN = ["Peggy Ash", "Ruth Fenwick", "Olga Marsh", "Ines Holloway", "Mia Kettle", "Sara Brook",
         "Tess Lindqvist", "Nora Weir", "Ada Penrose", "Lena Hart", "Joy Calder", "Uma Reed"]
MEN = ["Victor Lane", "Hugo Mills", "Tom Ferris", "Rafael Stone", "Ivo Bell", "Sam Kerr",
       "Otto Vale", "Leon Burke", "Arne Holm", "Dev Patel-Shaw", "Ben Ashby", "Kai Moreno"]
SEATS = {"8+": 8, "4+": 4, "4x": 4, "2x": 2, "1x": 1}

def crew_for(event, year):
    seats = next(v for k, v in SEATS.items() if event.endswith(k))
    pool = WOMEN if event.startswith(("W", "MasW")) else MEN if event.startswith(("M", "MasM")) and not event.startswith("Mix") else WOMEN + MEN
    # Peggy rows from 1998 to now; give her a fair share of the sculling boats.
    names = rng.sample(pool, seats)
    if "Peggy Ash" in pool and "Peggy Ash" not in names and seats <= 2 and rng.random() < 0.35:
        names[0] = "Peggy Ash"
    return names

def race_time(event):
    base = {"8+": 375, "4+": 430, "4x": 405, "2x": 440, "1x": 470}
    b = next(v for k, v in base.items() if event.endswith(k))
    t = b + rng.uniform(-14, 30) + (12 if event.startswith("Mas") else 0)
    return f"{int(t // 60)}:{t % 60:04.1f}"

rows = []
for year in range(1998, 2027):
    for name, month, events in REGATTAS:
        if name == "Masters Sprints" and year < 2009:
            continue
        for event in events:
            if rng.random() < 0.42:
                continue
            crew = crew_for(event, year)
            place = rng.choices([1, 2, 3, 4, 5, 6], [14, 18, 20, 18, 16, 14])[0]
            day = rng.randint(4, 26)
            rows.append({"date": f"{year}-{month:02d}-{day:02d}", "regatta": name, "event": event,
                         "crew": ", ".join(crew), "place": place, "time": race_time(event)})

rng.shuffle(rows)
rows = sorted(rows[:214], key=lambda r: r["date"])
with open(sys.argv[1], "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0]))
    w.writeheader(); w.writerows(rows)
print(len(rows), "rows;", sum("Peggy Ash" in r["crew"] for r in rows), "with Peggy Ash")
