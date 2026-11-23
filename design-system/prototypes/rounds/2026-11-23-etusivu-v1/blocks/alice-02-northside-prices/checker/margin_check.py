"""Margin check for a supplier's new price list.

Alice and her agent wrote this on 12 November (in the story). It joins a
supplier price list to the shop's catalogue by the supplier's item number,
works out the gross margin of every stocked product at the old and the new
unit cost (shelf price without VAT), prints the products under the minimum
margin and writes a chart of the lowest margins next to the list.

    python3 tools/margin_check.py inbox/northside-2027.csv
        [--catalog catalog/products.csv] [--min 40] [--vat 25.5] [--show 14]

Supplier lists come with semicolons and decimal commas; the last two price
columns are read as last year's and this year's unit cost.
"""
import argparse
import csv
from pathlib import Path


def num(s):
    return float(s.strip().replace(" ", "").replace(",", "."))


def read_supplier(path):
    with open(path, newline="", encoding="utf-8-sig") as f:
        sample = f.read(2048)
        f.seek(0)
        rows = list(csv.reader(f, delimiter=";" if sample.count(";") > sample.count(",") else ","))
    head, body = rows[0], [r for r in rows[1:] if r and r[0].strip()]
    return head, {r[0].strip(): (r[1].strip(), num(r[-2]), num(r[-1])) for r in body}


def margin(price_incl_vat, cost, vat):
    net = price_incl_vat / (1 + vat / 100)
    return (net - cost) / net * 100


def chart(rows, minimum, path, title, subtitle, old, new, width=6.6):
    import matplotlib
    import matplotlib.ticker
    matplotlib.use("Agg")
    from matplotlib import font_manager, patheffects, pyplot as plt

    fonts = sorted((Path(__file__).parent / "fonts").glob("*.ttf"))
    for f in fonts:
        font_manager.fontManager.addfont(str(f))
    if fonts:
        plt.rcParams["font.family"] = font_manager.FontProperties(fname=str(fonts[0])).get_name()
    ink, muted, line, low, ok = "#17201a", "#5c675d", "#dde4d5", "#a3412b", "#2c6e3f"
    plt.rcParams.update({"font.size": 15, "text.color": ink, "axes.labelcolor": muted,
                         "xtick.color": muted, "ytick.color": ink, "svg.fonttype": "none"})
    rows = rows[::-1]
    # Narrow (a phone): names above each row, legend on its own line.
    narrow = width < 5.5
    head = 1.05 + (0.32 if narrow else 0)
    step = 0.62 if narrow else 0.38
    h = step * len(rows) + head + 0.85
    fig, ax = plt.subplots(figsize=(width, h), dpi=160)
    fig.subplots_adjust(left=0.40, right=0.95, top=1 - head / h, bottom=0.62 / h)
    lo = min(min(r["new"], r["old"]) for r in rows)
    x0 = min(minimum - 4, int(lo) - 2)
    x1 = max(max(r["old"], r["new"]) for r in rows) + 2
    ax.axvspan(x0, minimum, color=low, alpha=0.06, lw=0)
    ax.axvline(minimum, color=low, lw=1.2, ls=(0, (4, 3)))
    ax.text(minimum - 0.3, -0.62, f"under {minimum:g} %", color=low, ha="right", va="bottom", fontsize=12.5)
    for i, r in enumerate(rows):
        c = low if r["new"] < minimum else ok
        ax.plot([r["old"], r["new"]], [i, i], color=c, lw=2.2, alpha=0.45, solid_capstyle="round", zorder=2)
        ax.scatter([r["old"]], [i], s=46, facecolor="white", edgecolor=muted, lw=1.4, zorder=3)
        ax.scatter([r["new"]], [i], s=70, color=c, zorder=4)
        if narrow:
            ax.text(x0 + 0.25, i + 0.3, r["name"], color=c if r["new"] < minimum else ink, va="bottom", fontsize=14,
                    fontweight="semibold" if r["new"] < minimum else "normal", zorder=6,
                    path_effects=[patheffects.withStroke(linewidth=4, foreground="#fbf6f4")])
        if r["new"] < minimum:
            ax.text(r["new"] - 0.55, i, f"{r['new']:.1f}", color=c, ha="right", va="center", fontsize=11.5, fontweight="semibold")
    ax.set_yticks(range(len(rows)), [] if narrow else [r["name"] for r in rows])
    for t, r in zip(ax.get_yticklabels(), rows):
        if r["new"] < minimum:
            t.set_color(low)
            t.set_fontweight("semibold")
    ax.set_xlim(x0, x1)
    ax.set_ylim(-0.7, len(rows) - (0.1 if not narrow else -0.25))
    ax.xaxis.set_major_locator(matplotlib.ticker.MultipleLocator(4))
    ax.xaxis.set_major_formatter(lambda v, _: f"{v:.0f} %")
    ax.grid(axis="x", color=line, lw=0.8)
    ax.set_axisbelow(True)
    ax.tick_params(length=0, pad=6)
    for s in ax.spines.values():
        s.set_visible(False)
    # Room on the left for the longest product name, measured as drawn.
    fig.canvas.draw()
    label_w = max((t.get_window_extent().width for t in ax.get_yticklabels()), default=0) / fig.dpi
    fig.subplots_adjust(left=(label_w + 0.2) / width if not narrow else 0.04)
    fig.text(0.03, 1 - 0.30 / fig.get_figheight(), title, fontsize=19, fontweight="semibold", va="top")
    fig.text(0.03, 1 - 0.70 / fig.get_figheight(), subtitle, fontsize=13, color=muted, va="top")
    from matplotlib.lines import Line2D
    keys = [Line2D([], [], ls="", marker="o", ms=7, mfc="white", mec=muted, mew=1.4, label=f"{old} cost"),
            Line2D([], [], ls="", marker="o", ms=8, color=ink, label=f"{new} cost")]
    fig.legend(handles=keys, loc="upper left" if narrow else "upper right", bbox_to_anchor=(0.012, 1 - 0.98 / fig.get_figheight()) if narrow else (0.985, 1 - 0.60 / fig.get_figheight()),
               ncol=2,
               frameon=False, fontsize=12.5, handletextpad=0.3, columnspacing=1.2, labelcolor=muted)
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(path, facecolor="white")


def main():
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("price_list")
    p.add_argument("--catalog", default="catalog/products.csv")
    p.add_argument("--min", type=float, default=40, help="minimum gross margin, percent")
    p.add_argument("--vat", type=float, default=25.5, help="VAT included in shelf prices, percent")
    p.add_argument("--show", type=int, default=8, help="products in the chart, lowest margin first")
    p.add_argument("--chart-width", type=float, default=6.6, help="chart width in inches (160 dpi)")
    p.add_argument("--chart", help="where to write the chart (default reports/<list>.png)")
    a = p.parse_args()

    head, sup = read_supplier(a.price_list)
    with open(a.catalog, newline="", encoding="utf-8") as f:
        cat = list(csv.DictReader(f))
    rows, missing = [], []
    for c in cat:
        s = sup.get(c["supplier_item"])
        if not s:
            missing.append(c["name"])
            continue
        price = float(c["price_incl_vat"])
        rows.append({"name": c["name"], "price": price, "c26": s[1], "c27": s[2],
                     "old": margin(price, s[1], a.vat), "new": margin(price, s[2], a.vat)})
    rows.sort(key=lambda r: r["new"])
    under = [r for r in rows if r["new"] < a.min]
    near = [r for r in rows if a.min <= r["new"] < a.min + 2]
    years = [h.replace("EUR", "").replace("Price", "").strip() for h in head[-2:]]
    rise = sum(r["c27"] / r["c26"] - 1 for r in rows) / len(rows) * 100

    src = Path(a.price_list)
    print(f"{src.name}: {len(sup)} items, {len(rows)} in your catalogue")
    if missing:
        print(f"not in the price list: {', '.join(missing)}")
    print(f"unit cost {years[0]} -> {years[1]}: +{rise:.1f} % on average")
    print(f"margin on shelf price less {a.vat:g} % VAT, minimum {a.min:g} %\n")
    w = max(len(r["name"]) for r in under + near) if under + near else 10
    print(f"{'UNDER ' + format(a.min, 'g') + ' %':<{w}}  {years[0]:>6}  {years[1]:>6}  {'margin':>6}  {'was':>6}")
    for r in under:
        print(f"{r['name']:<{w}}  {r['c26']:6.2f}  {r['c27']:6.2f}  {r['new']:4.1f} %  {r['old']:4.1f} %")
    if not under:
        print("(none)")
    if near:
        print(f"\nclose ({a.min:g}-{a.min + 2:g} %): " + "; ".join(f"{r['name']} {r['new']:.1f} %" for r in near))
    out = Path(a.chart) if a.chart else Path("reports") / (src.stem + ".png")
    chart(rows[: a.show], a.min, out, f"{src.stem.replace('-', ' ').title()}: lowest margins",
          f"{len(rows)} products · {len(under)} under {a.min:g} %", years[0], years[1], a.chart_width)
    print(f"\n{len(under)} of {len(rows)} under {a.min:g} % · chart: {out}")


if __name__ == "__main__":
    main()
