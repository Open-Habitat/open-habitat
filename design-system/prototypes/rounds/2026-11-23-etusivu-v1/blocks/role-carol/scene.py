# Blender scene for Carol's block: a linen tote (and a cushion and a pouch of
# the same cloth) with a block print, built from nothing but this script.
# Run by assets.mjs:
#
#   blender -b --factory-startup -P scene.py -- --mode turntable --ink indigo \
#       --print sprig.png --out frames/ --frames 144
#
# Modes: turntable (PNG frames of one full turn), still (one frame in the same
# studio), photo (the product "as photographed": on the print table among
# tins, books and pinned proofs, for rembg to cut out).
import argparse
import math
import random
import sys

import bmesh
import bpy
from mathutils import Vector, noise

ap = argparse.ArgumentParser()
ap.add_argument('--mode', default='still', choices=['turntable', 'still', 'photo'])
ap.add_argument('--item', default='tote', choices=['tote', 'cushion', 'pouch'])
ap.add_argument('--ink', default='indigo')
ap.add_argument('--print', dest='mask', required=True)
ap.add_argument('--tile', type=float, default=0.15)
ap.add_argument('--out', required=True)
ap.add_argument('--frames', type=int, default=144)
ap.add_argument('--start', type=int, default=0)
ap.add_argument('--end', type=int, default=-1)
ap.add_argument('--res', default='880x660')
ap.add_argument('--samples', type=int, default=64)
ap.add_argument('--seed', type=int, default=1)
ap.add_argument('--angle', type=float, default=-24.0)
ap.add_argument('--threads', type=int, default=0)
A = ap.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
RES = [int(x) for x in A.res.split('x')]
rnd = random.Random(A.seed)


def lin(hexcol):
    """sRGB hex -> linear RGBA."""
    h = hexcol.lstrip('#')
    out = []
    for k in (0, 2, 4):
        c = int(h[k:k + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (*out, 1.0)


INKS = {'indigo': '#22406a', 'rust': '#b24d25', 'moss': '#4d6238', 'ochre': '#c08a2a'}
LINEN = '#d9d0be'
lerp = lambda a, b, t: a + (b - a) * t
sgn = lambda x: 1.0 if x >= 0 else -1.0

# ---------------------------------------------------------------- materials


def cloth(name, base, ink=None, mask=None, tile=0.095):
    """Linen: slubby threads, a woven bump, sheen; optionally a block print
    (mask image, white = ink) pressed on unevenly, as a hand print is."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    N, L = m.node_tree.nodes, m.node_tree.links
    bsdf = N['Principled BSDF']
    tc = N.new('ShaderNodeTexCoord')

    def mapped(scale, src='UV'):
        mp = N.new('ShaderNodeMapping')
        mp.inputs['Scale'].default_value = scale
        L.new(tc.outputs[src], mp.inputs['Vector'])
        return mp.outputs['Vector']

    def tex_noise(vec, scale, detail=2.0):
        n = N.new('ShaderNodeTexNoise')
        n.inputs['Scale'].default_value = scale
        n.inputs['Detail'].default_value = detail
        L.new(vec, n.inputs['Vector'])
        return n.outputs['Fac']

    def math_(op, a, b=None, clamp=False):
        n = N.new('ShaderNodeMath')
        n.operation = op
        n.use_clamp = clamp
        for k, v in enumerate([a, b]):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                n.inputs[k].default_value = v
            else:
                L.new(v, n.inputs[k])
        return n.outputs[0]

    def mix(fac, a, b):
        n = N.new('ShaderNodeMix')
        n.data_type = 'RGBA'
        for k, v in ((0, fac), (6, a), (7, b)):
            if isinstance(v, (int, float)):
                n.inputs[k].default_value = v
            elif isinstance(v, tuple):
                n.inputs[k].default_value = v
            else:
                L.new(v, n.inputs[k])
        return n.outputs[2]

    def wave(direction):
        w = N.new('ShaderNodeTexWave')
        w.wave_type = 'BANDS'
        w.bands_direction = direction
        w.inputs['Scale'].default_value = 150.0  # a thread every ~2 mm
        w.inputs['Distortion'].default_value = 1.2
        w.inputs['Detail'].default_value = 1.0
        w.inputs['Detail Scale'].default_value = 0.6
        L.new(tc.outputs['UV'], w.inputs['Vector'])
        return w.outputs['Fac']

    slub = math_('MULTIPLY', math_('ADD', tex_noise(mapped((500, 9, 1)), 1.0), tex_noise(mapped((9, 500, 1)), 1.0)), 0.5)
    weave = math_('MULTIPLY', math_('ADD', wave('X'), wave('Y')), 0.5)
    b = lin(base)
    dark = (b[0] * 0.84, b[1] * 0.84, b[2] * 0.84, 1)
    light = (min(1, b[0] * 1.06), min(1, b[1] * 1.06), min(1, b[2] * 1.06), 1)
    thread = math_('ADD', math_('MULTIPLY', slub, 0.75), math_('MULTIPLY', weave, 0.25))
    colour = mix(math_('SUBTRACT', math_('MULTIPLY', thread, 2.2), 0.6, clamp=True), dark, light)
    if ink and mask:
        img = N.new('ShaderNodeTexImage')
        img.image = mask
        img.extension = 'REPEAT'
        img.interpolation = 'Cubic'
        L.new(mapped((1 / tile, 1 / tile, 1)), img.inputs['Vector'])
        # A hand-pressed print: the ink sits on the thread tops and thins out in patches.
        fine = math_('ADD', math_('MULTIPLY', tex_noise(mapped((1, 1, 1), 'Object'), 420.0, 3.0), 0.7), 0.62, clamp=True)
        broad = math_('ADD', math_('MULTIPLY', tex_noise(mapped((1, 1, 1), 'Object'), 14.0, 1.0), 0.4), 0.78, clamp=True)
        tops = math_('ADD', math_('MULTIPLY', weave, 0.3), 0.8, clamp=True)
        fac = math_('MULTIPLY', math_('MULTIPLY', math_('MULTIPLY', img.outputs['Color'], fine), broad), tops, clamp=True)
        colour = mix(fac, colour, lin(ink))
    L.new(colour, bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.88
    for key, val in (('Sheen Weight', 0.45), ('Sheen Roughness', 0.45), ('Specular IOR Level', 0.25)):
        if key in bsdf.inputs:
            bsdf.inputs[key].default_value = val
    bump = N.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.55
    bump.inputs['Distance'].default_value = 0.0007
    L.new(math_('ADD', math_('MULTIPLY', weave, 0.6), math_('MULTIPLY', slub, 0.5)), bump.inputs['Height'])
    L.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    return m


def plain(name, hexcol, rough=0.6, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = lin(hexcol)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    return m


def wood(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    N, L = m.node_tree.nodes, m.node_tree.links
    tc = N.new('ShaderNodeTexCoord')
    mp = N.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (0.5, 9.0, 1.0)
    L.new(tc.outputs['Object'], mp.inputs['Vector'])
    n = N.new('ShaderNodeTexNoise')
    n.inputs['Scale'].default_value = 5.0
    n.inputs['Detail'].default_value = 8.0
    n.inputs['Roughness'].default_value = 0.65
    L.new(mp.outputs['Vector'], n.inputs['Vector'])
    r = N.new('ShaderNodeValToRGB')
    r.color_ramp.elements[0].position = 0.3
    r.color_ramp.elements[0].color = lin('#6b4a2e')
    r.color_ramp.elements[1].position = 0.75
    r.color_ramp.elements[1].color = lin('#b08a5c')
    L.new(n.outputs['Fac'], r.inputs['Fac'])
    b = N['Principled BSDF']
    L.new(r.outputs['Color'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.45
    return m


# ------------------------------------------------------------------- meshes


def finish(bm, name, mats, solid=0.0, subsurf=2):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    for m in mats:
        me.materials.append(m)
    for p in me.polygons:
        p.use_smooth = True
    if solid:
        s = ob.modifiers.new('cloth thickness', 'SOLIDIFY')
        s.thickness = solid
        s.offset = -1
        s.material_offset = 1 if len(mats) > 1 else 0
    if subsurf:
        ss = ob.modifiers.new('soft', 'SUBSURF')
        ss.levels = ss.render_levels = subsurf
    return ob


class Bag:
    """A sewn bag standing on its gusset: a boxy foot that flattens to the
    opening, with the slack a filled cloth bag has."""

    def __init__(self, W, H, g, top_b, seed, wr=0.0035, closed=False):
        self.W, self.H, self.g, self.top_b, self.seed, self.wr, self.closed = W, H, g, top_b, seed, wr, closed

    def section(self, v):
        vs = v * v * (3 - 2 * v)
        a = lerp(self.W / 2 - self.g * 0.28, self.W / 2, vs)
        b = lerp(self.g / 2, self.top_b, v ** 0.7) + (0.0 if self.closed else 0.010) * math.sin(math.pi * v)
        n = lerp(4.5, 2.0, v ** 0.6)
        return a, b, n

    def slack(self, x, z, side, s_abs, v):
        p = Vector((x * 8 + self.seed * 3.1, z * 6.5, side * 2.0 + self.seed))
        w = self.wr * noise.noise(p) * 2.0 + 0.0012 * noise.noise(p * 3.7)
        return w * s_abs * (0.35 + 0.65 * v)

    def point(self, t, v):
        a, b, n = self.section(v)
        c, s = math.cos(t), math.sin(t)
        x = a * sgn(c) * abs(c) ** (2 / n)
        y = b * sgn(s) * abs(s) ** (2 / n)
        z = self.H * v - 0.006 * s * s * v ** 6
        y += sgn(s) * self.slack(x, z, sgn(s), abs(s), v)
        return Vector((x, y, z))

    def surface_y(self, x, z, side):
        v = min(1.0, z / self.H)
        a, b, n = self.section(v)
        c = min(1.0, abs(x) / a) ** (n / 2)
        s = math.sqrt(max(0.0, 1 - c * c))
        return side * (b * s ** (2 / n) + self.slack(x, z, side, s, v))

    def build(self, name, mats, nU=128, nV=44):
        bm = bmesh.new()
        uvl = bm.loops.layers.uv.new()
        rings, us = [], []
        for j in range(nV + 1):
            pts = [self.point(2 * math.pi * i / nU, j / nV) for i in range(nU)]
            arc = [0.0]
            for i in range(1, nU + 1):
                arc.append(arc[-1] + (pts[i % nU] - pts[i - 1]).length)
            mid = arc[nU // 4]  # the front centre gets u = 0, so the print is centred on the panel
            us.append([a_ - mid for a_ in arc])
            rings.append([bm.verts.new(p) for p in pts])
        for j in range(nV):
            for i in range(nU):
                i2 = (i + 1) % nU
                f = bm.faces.new((rings[j][i], rings[j][i2], rings[j + 1][i2], rings[j + 1][i]))
                uv = [(us[j][i], j), (us[j][i + 1], j), (us[j + 1][i + 1], j + 1), (us[j + 1][i], j + 1)]
                for loop, (u, jj) in zip(f.loops, uv):
                    loop[uvl].uv = (u, self.H * jj / nV)
        # The foot: two rings in and a centre.
        prev = rings[0]
        for k in (0.62, 0.24):
            ring = [bm.verts.new(Vector((v.co.x * k, v.co.y * k, 0.0))) for v in rings[0]]
            for i in range(nU):
                i2 = (i + 1) % nU
                f = bm.faces.new((prev[i2], prev[i], ring[i], ring[i2]))
                for loop in f.loops:
                    loop[uvl].uv = (loop.vert.co.x, loop.vert.co.y - 0.3)
            prev = ring
        centre = bm.verts.new((0, 0, 0))
        for i in range(nU):
            f = bm.faces.new((prev[(i + 1) % nU], prev[i], centre))
            for loop in f.loops:
                loop[uvl].uv = (loop.vert.co.x, loop.vert.co.y - 0.3)
        return finish(bm, name, mats, solid=0.0024)


def strap(name, path, width, th, mat):
    """A webbing strap swept along a path that lies roughly in a y-plane."""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    r = th * 0.42
    prof = [(-width / 2 + r, -th / 2), (width / 2 - r, -th / 2), (width / 2, -th / 2 + r), (width / 2, th / 2 - r),
            (width / 2 - r, th / 2), (-width / 2 + r, th / 2), (-width / 2, th / 2 - r), (-width / 2, -th / 2 + r)]
    pu = [0.0]
    for k in range(1, len(prof) + 1):
        a_, b_ = prof[k - 1], prof[k % len(prof)]
        pu.append(pu[-1] + math.hypot(a_[0] - b_[0], a_[1] - b_[1]))
    rings, dist = [], [0.0]
    for k, p in enumerate(path):
        T = (path[min(k + 1, len(path) - 1)] - path[max(k - 1, 0)]).normalized()
        Nn = T.cross(Vector((0, 1, 0))).normalized()
        Bn = Nn.cross(T).normalized()
        rings.append([bm.verts.new(p + Nn * a_ + Bn * b_) for a_, b_ in prof])
        if k:
            dist.append(dist[-1] + (p - path[k - 1]).length)
    P = len(prof)
    for k in range(len(path) - 1):
        for i in range(P):
            i2 = (i + 1) % P
            f = bm.faces.new((rings[k][i], rings[k][i2], rings[k + 1][i2], rings[k + 1][i]))
            for loop, uv in zip(f.loops, [(pu[i], dist[k]), (pu[i + 1], dist[k]), (pu[i + 1], dist[k + 1]), (pu[i], dist[k + 1])]):
                loop[uvl].uv = uv
    bm.faces.new(rings[0])
    bm.faces.new(rings[-1])
    ob = finish(bm, name, [mat], subsurf=0)
    wn = ob.modifiers.new('flat faces', 'WEIGHTED_NORMAL')
    wn.keep_sharp = False
    return ob


def box(name, size, loc, mat, rot=0.0, bevel=0.004):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=(0, 0, rot))
    ob = bpy.context.object
    ob.name = name
    ob.scale = size
    ob.data.materials.append(mat)
    if bevel:
        bv = ob.modifiers.new('edge', 'BEVEL')
        bv.width = bevel
        bv.segments = 2
    return ob


def cyl(name, r, h, loc, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, location=loc, rotation=rot, vertices=48)
    ob = bpy.context.object
    ob.name = name
    ob.data.materials.append(mat)
    for p in ob.data.polygons:
        p.use_smooth = len(p.vertices) == 4
    return ob


def plane(name, sx, sy, loc, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc, rotation=rot)
    ob = bpy.context.object
    ob.name = name
    ob.scale = (sx, sy, 1)
    ob.data.materials.append(mat)
    return ob


# ----------------------------------------------------------------- products


def make_tote(root, printed, inside, webbing):
    bag = Bag(0.38, 0.42, 0.085, 0.02, A.seed, wr=0.0055)
    parts = [bag.build('tote', [printed, inside])]
    hx, zb, zt, rz, w, th = 0.075, 0.355, 0.43, 0.15, 0.027, 0.003
    for side in (1, -1):
        def y_at(x, z):
            if z <= bag.H:
                return bag.surface_y(x, z, side) + side * (th / 2 + 0.0006)
            base = bag.surface_y(x, bag.H, side) + side * (th / 2 + 0.0006)
            return base - side * 0.07 * (z - bag.H) - side * 0.25 * (z - bag.H) ** 2
        shear = 0.012 if side < 0 else -0.004
        pts = []
        for k in range(13):
            z = lerp(zb, zt, k / 12)
            pts.append((-hx, z))
        for k in range(1, 48):
            th_ = math.pi * (1 - k / 48)
            pts.append((hx * math.cos(th_), zt + rz * math.sin(th_) ** 0.9))
        for k in range(13):
            pts.append((hx, lerp(zt, zb, k / 12)))
        path = []
        for x, z in pts:
            up = max(0.0, z - bag.H)
            path.append(Vector((x + shear * (up / rz) ** 2, y_at(x, z), z)))
        parts.append(strap('handle', path, w, th, webbing))
    for p in parts:
        p.parent = root
    return 0.31


def make_pouch(root, printed, inside, webbing):
    bag = Bag(0.25, 0.165, 0.055, 0.004, A.seed + 7, wr=0.002, closed=True)
    ob = bag.build('pouch', [printed, inside])
    zipm = plain('zip', '#2b2a28', 0.45, 0.6)
    z1 = box('zip', (0.246, 0.011, 0.007), (0, 0, 0.1665), zipm, bevel=0.002)
    pull = box('pull', (0.007, 0.004, 0.03), (0.108, -0.008, 0.155), plain('brass', '#b08d57', 0.3, 1.0), bevel=0.0015)
    tab = strap('tab', [Vector((0.125, 0, 0.13)), Vector((0.14, 0, 0.13)), Vector((0.15, 0, 0.13))], 0.02, 0.003, webbing)
    for p in (ob, z1, pull, tab):
        p.parent = root
    return 0.085


def make_cushion(root, printed, back):
    S, D, n = 0.42, 0.075, 40
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    for side in (1, -1):
        grid = []
        for j in range(n + 1):
            row = []
            for i in range(n + 1):
                u, w = 2 * i / n - 1, 2 * j / n - 1
                pu, pw = sgn(u) * abs(u) ** 0.8, sgn(w) * abs(w) ** 0.8  # denser toward the seam
                e = (max(0.0, 1 - abs(pu) ** 2.2) * max(0.0, 1 - abs(pw) ** 2.2)) ** 0.55
                pull = 1 - 0.07 * (abs(pu) * abs(pw)) ** 1.5 - 0.035 * e  # corners poke out, sides draw in
                x, z = pu * S / 2 * (pull + 0.035), pw * S / 2 * (pull + 0.035)
                y = side * (D * e + 0.004 * e * noise.noise(Vector((x * 9, z * 9, side + A.seed))))
                row.append(bm.verts.new((x, y, z + S / 2)))
            grid.append(row)
        for j in range(n):
            for i in range(n):
                f = bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
                f.material_index = 0 if side < 0 else 1  # the printed face looks at the camera (-y)
                for loop in f.loops:
                    loop[uvl].uv = (loop.vert.co.x, loop.vert.co.z)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    ob = finish(bm, 'cushion', [printed, back], subsurf=1)
    ob.rotation_euler = (math.radians(-9), 0, 0)
    ob.location = (0, 0.0, 0.004)
    ob.parent = root
    return 0.21


def make_item():
    root = bpy.data.objects.new('product', None)
    bpy.context.scene.collection.objects.link(root)
    mask = bpy.data.images.load(A.mask)
    mask.colorspace_settings.name = 'Non-Color'
    ink = INKS[A.ink]
    printed = cloth('printed linen', LINEN, ink, mask, A.tile)
    inside = cloth('linen', '#cfc2a8')
    dyed = cloth('dyed cotton', ink)
    dyed.node_tree.nodes['Principled BSDF'].inputs['Sheen Weight'].default_value = 0.15
    if A.item == 'tote':
        mid = make_tote(root, printed, inside, dyed)
    elif A.item == 'pouch':
        mid = make_pouch(root, printed, inside, dyed)
    else:
        mid = make_cushion(root, printed, dyed)
    return root, mid


# ------------------------------------------------------------------- scenes


def light(name, kind, loc, target, power, size=1.0, colour=(1, 1, 1)):
    d = bpy.data.lights.new(name, kind)
    d.energy = power
    d.color = colour
    if kind == 'AREA':
        d.size = size
    else:
        d.shadow_soft_size = size
    ob = bpy.data.objects.new(name, d)
    ob.location = loc
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.collection.objects.link(ob)
    return ob


def camera(loc, target, lens, roll=0.0, fstop=None):
    d = bpy.data.cameras.new('camera')
    d.lens = lens
    ob = bpy.data.objects.new('camera', d)
    ob.location = loc
    q = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y')
    ob.rotation_euler = q.to_euler()
    ob.rotation_euler.rotate_axis('Z', math.radians(roll))
    if fstop:
        d.dof.use_dof = True
        d.dof.focus_distance = (Vector(target) - Vector(loc)).length
        d.dof.aperture_fstop = fstop
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.scene.camera = ob


def world(hexcol, strength):
    w = bpy.data.worlds.new('world')
    w.use_nodes = True
    bg = w.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = lin(hexcol)
    bg.inputs['Strength'].default_value = strength
    bpy.context.scene.world = w


def studio(mid):
    """A paper sweep and three soft lights: the light background Carol asked for."""
    paper = plain('paper sweep', '#efebe3', 0.9)
    bm = bmesh.new()
    prof = [(-4.0, 0.0), (1.6, 0.0)] + [(1.6 + 1.4 * math.sin(a), 1.4 - 1.4 * math.cos(a)) for a in [math.pi / 2 * k / 16 for k in range(1, 17)]] + [(3.0, 6.0)]
    prev = None
    for y, z in prof:
        pair = (bm.verts.new((-7, y, z)), bm.verts.new((7, y, z)))
        if prev:
            bm.faces.new((prev[0], prev[1], pair[1], pair[0]))
        prev = pair
    finish(bm, 'sweep', [paper], subsurf=0)
    light('key', 'AREA', (-1.9, -2.4, 2.6), (0, 0, mid), 140, 2.0, (1.0, 0.97, 0.93))
    light('fill', 'AREA', (2.6, -1.8, 1.3), (0, 0, mid), 18, 3.0, (0.94, 0.97, 1.0))
    light('rim', 'AREA', (1.2, 2.2, 2.4), (0, 0, mid + 0.1), 55, 1.6)
    world('#f2efe9', 0.26)
    if A.item == 'tote':
        camera((0, -1.95, 0.66), (0, 0, mid - 0.015), 70)
    else:
        camera((0, -1.5, 0.5), (0, 0, mid), 70)


def print_table(mid, root):
    """The product as Carol photographed it: on the print table, with the
    day's clutter and pinned proofs behind it. Every shot differs a little."""
    plane('table', 3.2, 1.7, (0, 0.1, 0), wood('table'))
    plane('wall', 5, 3, (0, 0.95, 1.2), plain('wall', rnd.choice(['#b3ae9f', '#a9b0a8', '#b8a998']), 0.9), (math.pi / 2, 0, 0))
    mask = bpy.data.images[0]
    plane('kraft', 0.95, 0.7, (rnd.uniform(-.08, .08), 0.02, 0.001), plain('kraft', '#a98c62', 0.8), (0, 0, rnd.uniform(-.25, .25)))
    plane('mat', 0.6, 0.45, (-0.62, 0.3, 0.002), plain('cutting mat', '#3f6b4a', 0.6), (0, 0, rnd.uniform(-.2, .2)))
    # pinned proofs on the wall
    for k, x in enumerate([-0.72, -0.2, 0.36, 0.86]):
        proof = cloth(f'proof{k}', '#e6dfcf', INKS[rnd.choice(list(INKS))], mask, rnd.choice([0.07, 0.11]))
        plane(f'proof{k}', 0.3, 0.42, (x + rnd.uniform(-.05, .05), 0.94, rnd.uniform(0.62, 0.8)), proof, (math.pi / 2, rnd.uniform(-.08, .08), 0))
    # books, tins, a jar of tools, a brayer, a bolt of cloth
    bx = rnd.choice([-0.5, 0.52])
    for k, (c, w) in enumerate([('#7a2e2a', 0.26), ('#2f4f73', 0.23), ('#d9c9a0', 0.2)]):
        box(f'book{k}', (w, 0.17, 0.035), (bx + rnd.uniform(-.02, .02), 0.62, 0.0175 + 0.035 * k), plain(f'book{k}', c, 0.7), rnd.uniform(-.25, .25))
    tx = -bx
    for k, c in enumerate(rnd.sample(list(INKS.values()), 3)):
        cyl(f'tin{k}', 0.045, 0.04, (tx + 0.11 * k - 0.1, 0.55 + 0.05 * (k % 2), 0.02), plain(f'tin{k}', '#8d9094', 0.3, 1.0))
        cyl(f'lid{k}', 0.046, 0.006, (tx + 0.11 * k - 0.1, 0.55 + 0.05 * (k % 2), 0.043), plain(f'lid{k}', c, 0.4))
    jx = rnd.choice([-0.3, 0.3]) + bx * 0.3
    cyl('jar', 0.04, 0.12, (jx, 0.72, 0.06), plain('jar', '#5d7f86', 0.25))
    for k in range(4):
        cyl(f'tool{k}', 0.005, 0.2, (jx + rnd.uniform(-.02, .02), 0.72 + rnd.uniform(-.02, .02), 0.17), plain(f'tool{k}', rnd.choice(['#c9a55c', '#3a3a3a', '#a03a2a']), 0.5), (rnd.uniform(-.2, .2), rnd.uniform(-.2, .2), 0))
    rx, ry = rnd.choice([-0.36, 0.38]), rnd.uniform(-0.3, -0.18)
    cyl('roller', 0.02, 0.1, (rx, ry, 0.02), plain('rubber', '#252628', 0.5), (0, math.pi / 2, 0.5))
    cyl('roller handle', 0.011, 0.12, (rx + 0.04, ry - 0.075, 0.03), plain('beech', '#c9a676', 0.5), (math.pi / 2, 0, 0.5))
    cyl('bolt', 0.07, 0.75, (rnd.uniform(-.3, .3), 0.84, 0.07), cloth('bolt', rnd.choice(['#d8ccb3', '#8c6f4e', '#3e5b6e'])), (0, math.pi / 2, rnd.uniform(-.06, .06)))
    root.rotation_euler.z = math.radians(rnd.uniform(-26, 26))
    root.location = (rnd.uniform(-.04, .04), rnd.uniform(-.05, .03), 0.002)
    light('window', 'AREA', (-2.2 * rnd.choice([1, 1, -1]), -0.8, 1.7), (0, 0, mid), rnd.uniform(120, 170), 1.1, (0.92, 0.96, 1.0))
    light('lamp', 'POINT', (rnd.uniform(-.5, .9), -0.2, 1.5), (0, 0, 0), rnd.uniform(14, 26), 0.08, (1.0, 0.82, 0.62))
    world('#aab0b5', 0.22)
    reach = {'tote': 1.55, 'cushion': 1.3, 'pouch': 0.64}[A.item]
    camera((rnd.uniform(-.3, .3), -reach + rnd.uniform(-.08, .08), mid + rnd.uniform(0.18, 0.4)),
           (rnd.uniform(-.03, .03), 0, mid + rnd.uniform(-.02, .03)), 45, rnd.uniform(-3, 3), 3.2)


# ------------------------------------------------------------------- render

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = A.samples
sc.cycles.use_denoising = True
sc.cycles.max_bounces = 6
sc.cycles.seed = A.seed
sc.render.resolution_x, sc.render.resolution_y = RES
sc.render.resolution_percentage = 100
sc.render.image_settings.file_format = 'PNG'
sc.render.use_persistent_data = True
sc.view_settings.view_transform = 'Standard'
if A.threads:
    sc.render.threads_mode = 'FIXED'
    sc.render.threads = A.threads

root, mid = make_item()
if A.mode == 'photo':
    print_table(mid, root)
else:
    studio(mid)

if A.mode == 'turntable':
    end = A.frames if A.end < 0 else A.end
    for f in range(A.start, end):
        root.rotation_euler.z = math.radians(A.angle) + 2 * math.pi * f / A.frames
        sc.render.filepath = f'{A.out}/f{f:04d}.png'
        bpy.ops.render.render(write_still=True)
else:
    if A.mode == 'still':
        root.rotation_euler.z = math.radians(A.angle)
    sc.render.filepath = A.out
    bpy.ops.render.render(write_still=True)
