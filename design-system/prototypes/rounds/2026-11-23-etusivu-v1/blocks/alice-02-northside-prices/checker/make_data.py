"""Make the two fictional CSV files the margin check reads.

catalog/products.csv   Example Studio's own catalogue: sku, name, supplier,
                       supplier item number and shelf price (VAT included).
inbox/northside-2027.csv
                       Northside Linen's 2027 price list as a supplier sends
                       it: semicolons, decimal commas, their own item names,
                       2026 and 2027 unit prices, and a few items the shop does
                       not stock.

Everything is invented (Example Studio, Northside Linen). Deterministic:
the same files on every run.  Usage: make_data.py <out-dir>
"""
import csv
import random
import sys
from pathlib import Path

# (shop name, supplier name, 2026 unit cost, shelf price incl. VAT, base rise, variants)
CATEGORIES = [
    ("Linen tote", "Tote bag linen", 12.90, 29, 0.055, ["natural", "indigo", "rust", "moss"]),
    ("Apron", "Apron full linen", 21.50, 49, 0.050, ["indigo", "natural", "charcoal"]),
    ("Tea towel", "Tea towel 50x70", 5.40, 16, 0.045, ["Birch", "Harbour", "Meadow", "natural", "rust"]),
    ("Tea towels, set of 2", "Tea towel 50x70 2-pack", 11.20, 26, 0.050, ["Birch", "Harbour"]),
    ("Napkins, set of 4", "Napkin 45x45 4-pack", 14.80, 34, 0.050, ["natural", "indigo", "rust", "moss"]),
    ("Tablecloth 140×240", "Tablecloth 140x240", 38.00, 99, 0.040, ["natural", "indigo", "Birch"]),
    ("Tablecloth 140×180", "Tablecloth 140x180", 31.50, 85, 0.040, ["natural", "Birch"]),
    ("Table runner", "Runner 40x150", 13.60, 39, 0.045, ["Birch", "Harbour", "natural"]),
    ("Placemats, set of 2", "Placemat 35x45 2-pack", 8.90, 25, 0.045, ["natural", "rust", "moss"]),
    ("Cushion cover 50×50", "Cushion cover 50x50", 12.80, 36, 0.045, ["Birch", "Harbour", "Meadow", "natural"]),
    ("Pillowcases, pair", "Pillowcase 50x60 pair", 19.40, 54, 0.040, ["natural", "oat", "moss"]),
    ("Duvet cover 150×210", "Duvet cover 150x210", 52.00, 149, 0.040, ["natural", "oat"]),
    ("Bread bag", "Bread bag 30x40", 6.40, 19, 0.045, ["natural", "Birch"]),
    ("Produce bags, set of 3", "Produce bag 3-pack", 7.60, 22, 0.045, ["natural"]),
    ("Linen scarf", "Scarf 50x180", 15.80, 45, 0.040, ["indigo", "rust", "natural", "Meadow"]),
    ("Bath towel", "Bath towel 70x140 linen", 23.50, 65, 0.040, ["natural", "oat", "moss"]),
    ("Hand towel", "Hand towel 40x70 linen", 9.40, 27, 0.040, ["natural", "oat", "moss"]),
    ("Printed linen, per metre", "Fabric printed 150cm /m", 10.80, 32, 0.045, ["Birch", "Harbour", "Meadow"]),
    ("Plain linen, per metre", "Fabric plain 150cm /m", 8.10, 24, 0.045, ["natural", "indigo", "rust", "moss"]),
    ("Zip pouch", "Pouch zip 15x22", 5.60, 17, 0.045, ["Birch", "Harbour"]),
    ("Oven mitt", "Oven mitt linen", 6.90, 21, 0.040, ["natural", "indigo"]),
    ("Pot holders, set of 2", "Pot holder 2-pack", 5.20, 16, 0.040, ["natural", "rust"]),
]
# A handful of items rose well above the rest in 2027.
EXTRA = {
    ("Linen tote", "natural"): 0.105,
    ("Apron", "indigo"): 0.085,
    ("Tea towels, set of 2", "Birch"): 0.075,
    ("Napkins, set of 4", "natural"): 0.065,
}
NOT_STOCKED = [
    ("Curtain 140x250 linen", 41.00), ("Shower curtain linen", 33.50), ("Robe linen S/M", 46.00),
    ("Robe linen L/XL", 46.00), ("Sheet 240x270 linen", 58.00), ("Coaster 4-pack", 4.10), ("Lampshade cover 30cm", 9.80),
]

def dec(x):
    return f"{x:.2f}".replace(".", ",")

def main(out):
    out = Path(out)
    (out / "catalog").mkdir(parents=True, exist_ok=True)
    (out / "inbox").mkdir(parents=True, exist_ok=True)
    rng = random.Random(2027)
    products, supplier = [], []
    n = 0
    for name, sname, cost, price, rise, variants in CATEGORIES:
        for v in variants:
            n += 1
            sku = f"ES-{n:03d}"
            item = f"NL-{4100 + n * 7}"
            c26 = round(cost * rng.uniform(0.98, 1.02), 2)
            c27 = round(c26 * (1 + rise + rng.uniform(-0.012, 0.012) + EXTRA.get((name, v), 0)), 2)
            products.append([sku, f"{name}, {v}", "Northside Linen", item, f"{price:.2f}"])
            supplier.append([item, f"{sname} {v}", "pcs", dec(c26), dec(c27)])
    for i, (desc, c) in enumerate(NOT_STOCKED):
        c26 = round(c, 2)
        supplier.append([f"NL-{5200 + i * 11}", desc, "pcs", dec(c26), dec(round(c26 * 1.05, 2))])
    supplier.sort(key=lambda r: r[0])
    with open(out / "catalog/products.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["sku", "name", "supplier", "supplier_item", "price_incl_vat"])
        w.writerows(products)
    with open(out / "inbox/northside-2027.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["Item no", "Description", "Unit", "Price 2026 EUR", "Price 2027 EUR"])
        w.writerows(supplier)

if __name__ == "__main__":
    main(sys.argv[1])
