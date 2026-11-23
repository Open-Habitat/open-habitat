# Erin's Saturday explainer: how a block print is made, in five steps.
# Rendered by assets.mjs with Manim Community (cairo renderer):
#   manim render -r 1280,720 --fps 30 block_print.py BlockPrint
# The font is the page's own Instrument Sans; assets.mjs converts the woff2 in
# design-system/fonts to TTF and passes its path in BLOCK_PRINT_FONT.
import os

import numpy as np
from manim import (
    DOWN, LEFT, RIGHT, UP, AnimationGroup, Circle, FadeIn, FadeOut, Intersection,
    Line, Rectangle, RoundedRectangle, Scene, Succession, Text, Transform, VGroup,
    VMobject, Wait, config, rate_functions, register_font, smooth,
)

config.background_color = '#efe9dd'

TABLE = '#efe9dd'
INK = '#17201a'
MUTED = '#8d897d'
WOOD = '#c49a68'
WOOD_SIDE = '#8c6f4e'
WOOD_BACK = '#b38658'
RELIEF = '#ecd4a8'
RELIEF_SHADOW = '#7d5f3f'
CUT = '#ad8455'
CLOTH = '#f7f2e7'
CLOTH_EDGE = '#ddd2bd'
INDIGO = '#2f4f73'
RUST = '#b45a33'
SLATE = '#4a3c46'   # indigo under rust: the warm slate of the ink page
MARK = '#a3967f'
ACCENT = '#2c6e3f'

FONT = 'Instrument Sans'


def bez(p, t):
    p0, p1, p2, p3 = p
    return ((1 - t) ** 3)[:, None] * p0 + (3 * (1 - t) ** 2 * t)[:, None] * p1 + (3 * (1 - t) * t ** 2)[:, None] * p2 + (t ** 3)[:, None] * p3


def poly(points, color):
    m = VMobject(stroke_width=0, fill_color=color, fill_opacity=1)
    m.set_points_as_corners([*points, points[0]])
    return m


STEM = [np.array(v, dtype=float) for v in ((-0.18, -1.0, 0), (-0.42, -0.2, 0), (0.5, 0.15, 0), (0.18, 0.92, 0))]


def stem_shape(color):
    t = np.linspace(0, 1, 48)
    c = bez(STEM, t)
    d = np.gradient(c, axis=0)
    n = np.stack([-d[:, 1], d[:, 0], np.zeros_like(t)], axis=1)
    n /= np.linalg.norm(n, axis=1)[:, None]
    w = (0.075 - 0.04 * t)[:, None]
    return poly(list(c + n * w) + list((c - n * w)[::-1]), color)


def leaf(base, angle, length, width, color):
    s = np.linspace(0, 1, 30)
    half = np.sin(np.pi * s) ** 0.9 * width / 2
    top = np.stack([s * length, half, np.zeros_like(s)], axis=1)
    bot = np.stack([s * length, -half, np.zeros_like(s)], axis=1)[::-1]
    pts = np.concatenate([top, bot])
    rot = np.array([[np.cos(angle), -np.sin(angle), 0], [np.sin(angle), np.cos(angle), 0], [0, 0, 1]])
    return poly(list(pts @ rot.T + np.array(base)), color)


def sprig(color):
    """The motif: a sprig leaning right, leaves mostly on one side, berries low left.
    Lopsided on purpose, so that a mirrored copy reads as mirrored."""
    at = lambda t: bez(STEM, np.array([t]))[0]
    parts = [
        stem_shape(color),
        leaf(at(0.30), np.radians(18), 0.78, 0.30, color),
        leaf(at(0.55), np.radians(150), 0.66, 0.27, color),
        leaf(at(0.74), np.radians(30), 0.64, 0.25, color),
        leaf(at(0.97), np.radians(70), 0.42, 0.2, color),
        Circle(0.15, stroke_width=0, fill_color=color, fill_opacity=1).move_to([-0.66, -0.52, 0]),
        Circle(0.12, stroke_width=0, fill_color=color, fill_opacity=1).move_to([-0.86, -0.28, 0]),
        Circle(0.1, stroke_width=0, fill_color=color, fill_opacity=1).move_to([-0.6, -0.2, 0]),
    ]
    return VGroup(*parts)


def rust_shapes():
    return [
        Circle(0.5, stroke_width=0, fill_color=RUST, fill_opacity=1).move_to([0.4, -0.42, 0]),
        Circle(0.16, stroke_width=0, fill_color=RUST, fill_opacity=1).move_to([-0.62, 0.62, 0]),
        Circle(0.09, stroke_width=0, fill_color=RUST, fill_opacity=1).move_to([0.78, 0.62, 0]),
    ]


def block_face(size, motif_scale, mirrored=True):
    side = RoundedRectangle(corner_radius=0.12, width=size, height=size, stroke_width=0, fill_color=WOOD_SIDE, fill_opacity=1).shift(DOWN * 0.16 + RIGHT * 0.06)
    face = RoundedRectangle(corner_radius=0.12, width=size, height=size, stroke_width=0, fill_color=CUT, fill_opacity=1)
    grain = VGroup(*[
        Line([-size / 2 + 0.15, y, 0], [size / 2 - 0.15, y + 0.04 * np.sin(5 * y), 0], stroke_width=1.4, stroke_color=WOOD, stroke_opacity=0.7)
        for y in np.linspace(-size / 2 + 0.2, size / 2 - 0.2, 9)
    ])
    m = sprig(RELIEF).scale(motif_scale)
    if mirrored:
        m.flip(UP)
    shadow = m.copy().set_fill(RELIEF_SHADOW).shift(RIGHT * 0.04 + DOWN * 0.05)
    return VGroup(side, face, grain, shadow, m), m


def block_back(size, edge):
    side = RoundedRectangle(corner_radius=0.1, width=size, height=size, stroke_width=0, fill_color=edge, fill_opacity=1).shift(DOWN * 0.12 + RIGHT * 0.05)
    back = RoundedRectangle(corner_radius=0.1, width=size, height=size, stroke_width=0, fill_color=WOOD_BACK, fill_opacity=1)
    grain = VGroup(*[
        Line([-size / 2 + 0.12, y, 0], [size / 2 - 0.12, y + 0.03 * np.cos(6 * y), 0], stroke_width=1.2, stroke_color=WOOD, stroke_opacity=0.8)
        for y in np.linspace(-size / 2 + 0.16, size / 2 - 0.16, 7)
    ])
    knob = Circle(size * 0.16, stroke_width=0, fill_color=WOOD_SIDE, fill_opacity=1)
    knob_top = Circle(size * 0.12, stroke_width=0, fill_color=WOOD, fill_opacity=1).shift(UP * 0.03 + LEFT * 0.02)
    return VGroup(side, back, grain, knob, knob_top)


class BlockPrint(Scene):
    def construct(self):
        with register_font(os.environ['BLOCK_PRINT_FONT']):
            self.play_all()

    def caption(self, text):
        return Text(text, font=FONT, font_size=34, color=INK, weight='MEDIUM').move_to(UP * 3.42).to_edge(LEFT, buff=0.7)

    def play_all(self):
        steps = ['Block', 'Ink', 'Press', 'Repeat', 'Second colour']
        row = VGroup(*[
            VGroup(Text(f'{i + 1}', font=FONT, font_size=20, color=MUTED, weight='MEDIUM'), Text(s, font=FONT, font_size=22, color=MUTED, weight='MEDIUM')).arrange(RIGHT, buff=0.14)
            for i, s in enumerate(steps)
        ]).arrange(RIGHT, buff=0.55).move_to(DOWN * 3.48).to_edge(LEFT, buff=0.7)
        for item in row:  # line the labels up on their capitals, not their descenders
            item[0].align_to(row[0][0], UP)
            item[1].align_to(row[0][1], UP)
        bar = Line(LEFT, RIGHT, stroke_width=4, stroke_color=WOOD_SIDE)

        def step_to(i):
            anims = []
            for k, item in enumerate(row):
                anims.append(item.animate.set_color(INK if k == i else (MUTED if k > i else '#5e5a50')))
            target = Line(row[i].get_corner(DOWN + LEFT) + DOWN * 0.12, row[i].get_corner(DOWN + RIGHT) + DOWN * 0.12, stroke_width=4, stroke_color=WOOD_SIDE)
            anims.append(Transform(bar, target))
            return anims

        cap = self.caption('Carve the block in mirror image.')
        bar.become(Line(row[0].get_corner(DOWN + LEFT) + DOWN * 0.12, row[0].get_corner(DOWN + RIGHT) + DOWN * 0.12, stroke_width=4, stroke_color=WOOD_SIDE))
        row[0].set_color(INK)

        # ---- 1 · The block -------------------------------------------------
        paper = Rectangle(width=2.9, height=2.9, stroke_width=1.2, stroke_color=CLOTH_EDGE, fill_color='#fbf8f1', fill_opacity=1).move_to([-3.6, 0.1, 0])
        drawing = sprig(INK).scale(1.1).move_to(paper)
        drawing.set_fill(opacity=0).set_stroke(INK, width=2.2)
        label_d = Text('the drawing', font=FONT, font_size=20, color=MUTED).next_to(paper, DOWN, buff=0.22)
        block, relief = block_face(3.0, 1.1)
        block.move_to([1.6, 0.1, 0])
        label_b = Text('the block', font=FONT, font_size=20, color=MUTED).next_to(block, DOWN, buff=0.22)
        self.add(row, bar)
        self.play(FadeIn(cap, shift=DOWN * 0.15), FadeIn(paper), run_time=0.5)
        self.play(AnimationGroup(*[p.animate.set_fill(INK, opacity=1).set_stroke(width=0) for p in drawing], lag_ratio=0.12), FadeIn(drawing, run_time=0.01), FadeIn(label_d), run_time=1.0)
        face_only = VGroup(*block[:3])
        self.play(FadeIn(face_only, shift=UP * 0.2), FadeIn(label_b), run_time=0.5)
        # Lift a copy of the drawing over the block, then turn it over: the
        # carving is the drawing's mirror image.
        ghost = drawing.copy()
        self.play(ghost.animate.move_to(relief), run_time=0.55, rate_func=smooth)
        self.play(ghost.animate.stretch(-1, dim=0), run_time=0.55, rate_func=smooth)
        self.play(FadeIn(block[3]), FadeIn(block[4]), FadeOut(ghost), run_time=0.35)
        self.wait(0.4)

        # ---- 2 · The ink ---------------------------------------------------
        new = self.caption('Roll ink onto the raised wood.')
        self.play(FadeOut(cap, shift=UP * 0.15), FadeIn(new, shift=UP * 0.15), FadeOut(VGroup(paper, drawing, label_d, label_b)), block.animate.move_to([0, 0.1, 0]), *step_to(1), run_time=0.6)
        cap = new
        roller = VGroup(
            Line([0.0, 0, 0], [0.9, -0.0, 0], stroke_width=6, stroke_color=WOOD_SIDE).shift(RIGHT * 0.25),
            RoundedRectangle(corner_radius=0.2, width=0.42, height=3.4, stroke_width=0, fill_color='#24384f', fill_opacity=1),
            RoundedRectangle(corner_radius=0.12, width=0.16, height=3.2, stroke_width=0, fill_color='#4b6a8f', fill_opacity=1).shift(LEFT * 0.08),
        ).move_to([-2.4, 0.1, 0])
        self.play(FadeIn(roller, shift=RIGHT * 0.3), run_time=0.3)
        relief_parts = list(relief)

        def ink_up(m):
            x = roller[1].get_center()[0]
            for p in relief_parts:
                if p.get_center()[0] < x and p.fill_color.to_hex().lower() != INDIGO:
                    p.set_fill(INDIGO)
        roller.add_updater(ink_up)
        self.play(roller.animate.move_to([2.2, 0.1, 0]), run_time=1.3, rate_func=rate_functions.ease_in_out_sine)
        roller.clear_updaters()
        for p in relief_parts:
            p.set_fill(INDIGO)
        self.play(FadeOut(roller, shift=RIGHT * 0.3), run_time=0.3)
        self.wait(0.3)

        # ---- 3 · The press -------------------------------------------------
        cloth = Rectangle(width=9.6, height=5.0, stroke_width=1.2, stroke_color=CLOTH_EDGE, fill_color=CLOTH, fill_opacity=1).move_to([0, 0.05, 0])
        weave = VGroup(
            *[Line([x, -2.45, 0], [x, 2.55, 0], stroke_width=0.8, stroke_color='#e6dcc8', stroke_opacity=0.7) for x in np.arange(-4.7, 4.75, 0.16)],
            *[Line([-4.8, y, 0], [4.8, y, 0], stroke_width=0.8, stroke_color='#e6dcc8', stroke_opacity=0.7) for y in np.arange(-2.4, 2.5, 0.16)],
        )
        cols, rows_, tile = 4, 2, 2.25
        centres = [np.array([(c - (cols - 1) / 2) * tile, 0.05 + ((rows_ - 1) / 2 - r) * tile, 0]) for r in range(rows_) for c in range(cols)]
        marks = VGroup()
        for r in range(rows_ + 1):
            for c in range(cols + 1):
                p = np.array([(c - cols / 2) * tile, 0.05 + (rows_ / 2 - r) * tile, 0])
                marks.add(VGroup(Line(p + LEFT * 0.12, p + RIGHT * 0.12, stroke_width=2, stroke_color=MARK), Line(p + UP * 0.12, p + DOWN * 0.12, stroke_width=2, stroke_color=MARK)))
        motif_s = 0.9
        prints = [sprig(INDIGO).scale(motif_s).move_to(ORIGIN_ADJ(c, motif_s)) for c in centres]

        back = block_back(2.0, WOOD_SIDE)
        new = self.caption('Press it face down: it prints the right way round.')
        self.play(FadeOut(cap, shift=UP * 0.15), FadeIn(new, shift=UP * 0.15), *step_to(2), FadeIn(cloth), FadeIn(weave), block.animate.scale(0.66).move_to(centres[0] + UP * 0.35 + RIGHT * 0.25), run_time=0.7)
        cap = new
        # Turn the block over: squeeze it to an edge, show its back.
        self.play(block.animate.stretch(0.04, dim=0), run_time=0.22, rate_func=rate_functions.ease_in_quad)
        back.move_to(block).stretch(0.04, dim=0)
        self.remove(block)
        self.add(back)
        self.play(back.animate.stretch(25, dim=0).move_to(centres[0] + UP * 0.25 + RIGHT * 0.15), run_time=0.28, rate_func=rate_functions.ease_out_quad)
        shadow = RoundedRectangle(corner_radius=0.1, width=2.0, height=2.0, stroke_width=0, fill_color='#5a4630', fill_opacity=0.18).move_to(centres[0] + DOWN * 0.1 + RIGHT * 0.06)
        self.add(marks)
        self.bring_to_back(weave)
        self.bring_to_back(cloth)
        self.play(FadeIn(marks), FadeIn(shadow), back.animate.move_to(centres[0]), run_time=0.45)
        self.play(back.animate.scale(0.95), shadow.animate.scale(0.95).set_opacity(0.3), run_time=0.18)
        self.add(prints[0])
        self.bring_to_front(shadow, back)
        self.play(back.animate.scale(1 / 0.95).move_to(centres[1] + UP * 0.35), FadeOut(shadow), run_time=0.45)
        self.wait(0.5)

        # ---- 4 · The repeat ------------------------------------------------
        new = self.caption('Repeat it along the register marks.')
        self.play(FadeOut(cap, shift=UP * 0.15), FadeIn(new, shift=UP * 0.15), *step_to(3), marks.animate.set_color('#7f735e'), run_time=0.5)
        cap = new
        for k, c in enumerate(centres[1:], start=1):
            t = 0.3 if k < 3 else 0.2
            self.play(back.animate.move_to(c), run_time=t, rate_func=smooth)
            self.add(prints[k])
            self.bring_to_front(back)
            self.play(back.animate.scale(0.95), run_time=0.08)
            self.play(back.animate.scale(1 / 0.95), run_time=0.08)
        self.play(back.animate.shift(RIGHT * 6), run_time=0.45, rate_func=rate_functions.ease_in_quad)
        self.remove(back)
        self.wait(0.35)

        # ---- 5 · The second colour ----------------------------------------
        rust_units = []
        for c in centres:
            base = sprig(INDIGO).scale(motif_s).move_to(ORIGIN_ADJ(c, motif_s))
            shapes = [s.shift(c) for s in rust_shapes()]
            overlaps = []
            for s in shapes:
                for p in base:
                    o = Intersection(s, p, stroke_width=0, fill_color=SLATE, fill_opacity=1)
                    if len(o.points):
                        overlaps.append(o)
            rust_units.append(VGroup(*shapes, *overlaps))
        rust_back = block_back(2.0, RUST)
        new = self.caption('A second block, a second colour, on the same marks.')
        off = rust_back.copy().move_to(centres[0] + UP * 0.45 + RIGHT * 0.5).rotate(np.radians(7))
        rust_back.move_to(off)
        rust_back.rotate(np.radians(7))
        rust_back.become(off)
        corner_ids = [0, 1, cols + 1, cols + 2]
        self.play(FadeOut(cap, shift=UP * 0.15), FadeIn(new, shift=UP * 0.15), *step_to(4), FadeIn(rust_back, shift=LEFT * 0.6), run_time=0.6)
        cap = new
        self.play(*[marks[i].animate.set_color(ACCENT).scale(1.6) for i in corner_ids], run_time=0.3)
        self.play(rust_back.animate.rotate(np.radians(-7)).move_to(centres[0]), run_time=0.5, rate_func=smooth)
        self.play(*[marks[i].animate.set_color('#7f735e').scale(1 / 1.6) for i in corner_ids], rust_back.animate.scale(0.95), run_time=0.2)
        self.add(rust_units[0])
        self.bring_to_front(rust_back)
        self.play(rust_back.animate.scale(1 / 0.95), run_time=0.1)
        for k, c in enumerate(centres[1:], start=1):
            self.play(rust_back.animate.move_to(c), run_time=0.17, rate_func=smooth)
            self.add(rust_units[k])
            self.bring_to_front(rust_back)
            self.play(rust_back.animate.scale(0.95), run_time=0.06)
            self.play(rust_back.animate.scale(1 / 0.95), run_time=0.06)
        new = self.caption('Where two inks overlap, a third colour appears.')
        self.play(rust_back.animate.shift(RIGHT * 6), FadeOut(cap, shift=UP * 0.15), FadeIn(new, shift=UP * 0.15), marks.animate.set_opacity(0.35), run_time=0.5)
        self.remove(rust_back)
        self.wait(1.4)


def ORIGIN_ADJ(c, s):
    # The sprig's bounding box is off centre; keep its stem's root where the
    # block's centre falls, so every print sits the same in its tile.
    return c + np.array([0.02, 0.0, 0]) * s
