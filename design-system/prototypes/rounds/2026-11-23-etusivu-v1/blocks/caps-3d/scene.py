# blender -b --factory-startup -P scene.py -- part   --stl bracket.stl     --out part.png --camera-json cam.json
# blender -b --factory-startup -P scene.py -- sliced --gcode bracket.gcode --out-dir frames --cuts 40,110,309
#
# Two pictures of the same bracket, both from files the other programs wrote:
#   part    the STL OpenSCAD exported, standing the way it hangs on the wall;
#           also writes the camera's projection, so assets.mjs can draw the
#           measurements exactly over the picture.
#   sliced  the G-code PrusaSlicer wrote, every extrusion move drawn as a bead
#           in the slicer's own feature colours, printed up to each cut layer.
# Units: one Blender unit is 100 mm (the part is 62 mm wide).
import bpy, bmesh, json, math, re, sys
import numpy as np
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:]
mode = argv[0]
opt = dict(zip(argv[1::2], argv[2::2]))
MM = 0.01
W, H = int(opt.get('--width', 1200)), int(opt.get('--height', 900))
SAMPLES = int(opt.get('--samples', 128))

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y = W, H
scene.render.image_settings.file_format = 'PNG'
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.render.threads_mode = 'FIXED'
scene.render.threads = int(opt.get('--threads', 4))


def srgb(hexcol):
    c = [int(hexcol[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c] + [1]


def material(name, colour, rough=0.5, **kw):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = srgb(colour)
    b.inputs['Roughness'].default_value = rough
    for k, v in kw.items():
        b.inputs[k].default_value = v
    return m


def area(name, loc, size, energy, colour=(1, 1, 1), target=(0, 0, 0)):
    d = bpy.data.lights.new(name, 'AREA')
    d.shape, d.size, d.energy, d.color = 'DISK', size, energy, colour
    o = bpy.data.objects.new(name, d)
    o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    scene.collection.objects.link(o)


def camera(loc, target, lens):
    d = bpy.data.cameras.new('cam')
    d.lens, d.sensor_width = lens, 36
    o = bpy.data.objects.new('cam', d)
    o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    scene.collection.objects.link(o)
    scene.camera = o
    return o


def backdrop(colour, floor_z=0.0):
    # A floor that curves up into a wall far behind: no horizon line.
    world = bpy.data.worlds.new('w')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = srgb(colour)
    world.node_tree.nodes['Background'].inputs[1].default_value = 0.55
    scene.world = world
    bm = bmesh.new()
    prof = [(-30, 0)] + [(8 + 6 * math.sin(a), 6 - 6 * math.cos(a)) for a in np.linspace(0, math.pi / 2, 24)] + [(14, 40)]
    rows = [[bm.verts.new((x, y, z + floor_z)) for (y, z) in prof] for x in (-40, 40)]
    for i in range(len(prof) - 1):
        bm.faces.new((rows[0][i], rows[1][i], rows[1][i + 1], rows[0][i + 1]))
    me = bpy.data.meshes.new('backdrop')
    bm.to_mesh(me)
    for p in me.polygons:
        p.use_smooth = True
    o = bpy.data.objects.new('backdrop', me)
    me.materials.append(material('paper', colour, 0.9))
    scene.collection.objects.link(o)


def write_camera(path, cam):
    dg = bpy.context.evaluated_depsgraph_get()
    proj = cam.calc_matrix_camera(dg, x=W, y=H) @ cam.matrix_world.inverted()
    json.dump({'w': W, 'h': H, 'mm': MM, 'm': [list(r) for r in proj]}, open(path, 'w'))


# ---------- part: the STL, as it hangs on the wall ----------
if mode == 'part':
    bpy.ops.wm.stl_import(filepath=opt['--stl'])
    o = bpy.context.selected_objects[0]
    me = o.data
    # scad (x out from the wall, y up, z along the rail) -> world (X along the
    # rail, -Y towards the camera, Z up), centred on the rail's length.
    xs = [v.co.z for v in me.vertices]
    mid = (min(xs) + max(xs)) / 2
    me.transform(Matrix(((0, 0, -MM, mid * MM), (-MM, 0, 0, 0), (0, MM, 0, 0), (0, 0, 0, 1))))
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.shade_auto_smooth(angle=math.radians(28))

    # Printed PETG: a little sheen and the 0.2 mm layers, which run along the rail.
    m = material('petg', opt.get('--colour', '#1f6f5c'), 0.34, **{'Coat Weight': 0.25, 'Coat Roughness': 0.25})
    nt = m.node_tree
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = 2 * math.pi / (0.2 * MM)
    sin = nt.nodes.new('ShaderNodeMath'); sin.operation = 'SINE'
    bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.22; bump.inputs['Distance'].default_value = 0.0006
    nt.links.new(tc.outputs['Object'], sep.inputs[0])
    nt.links.new(sep.outputs['X'], mul.inputs[0])
    nt.links.new(mul.outputs[0], sin.inputs[0])
    nt.links.new(sin.outputs[0], bump.inputs['Height'])
    nt.links.new(bump.outputs[0], nt.nodes['Principled BSDF'].inputs['Normal'])
    me.materials.append(m)

    backdrop('#f1ede4')
    cam = camera((1.55, -2.55, 1.42), (0.03, -0.24, 0.1), 88)
    area('key', (-1.6, -1.6, 2.6), 1.6, 62, (1, 0.97, 0.93), (0, -0.2, 0.1))
    area('fill', (2.4, -1.4, 1.0), 2.2, 14, (0.93, 0.96, 1), (0, -0.2, 0.1))
    area('rim', (0.6, 1.6, 1.6), 1.2, 30, (1, 1, 1), (0, -0.1, 0.15))
    write_camera(opt['--camera-json'], cam)
    scene.render.filepath = opt['--out']
    bpy.ops.render.render(write_still=True)

# ---------- sliced: the G-code, bead by bead ----------
if mode == 'sliced':
    COL = {  # PrusaSlicer's feature colours
        'Perimeter': '#ffe64d', 'External perimeter': '#ff7d38', 'Overhang perimeter': '#1f1fff',
        'Internal infill': '#b03029', 'Solid infill': '#9654cc', 'Top solid infill': '#f04040',
        'Bridge infill': '#4d80ba', 'Gap fill': '#ffffff', 'Skirt/Brim': '#00876e',
    }
    types = list(COL)
    segs = []  # x0 y0 x1 y1 z width height type layer
    x = y = z = e = 0.0
    width, height, typ, layer = 0.45, 0.2, None, 0
    num = re.compile(r'([XYZE])(-?\d*\.?\d+)')
    for line in open(opt['--gcode']):
        if line.startswith(';'):
            if line.startswith(';TYPE:'): typ = line[6:].strip()
            elif line.startswith(';WIDTH:'): width = float(line[7:])
            elif line.startswith(';HEIGHT:'): height = float(line[8:])
            elif line.startswith(';LAYER_CHANGE'): layer += 1
            continue
        if line.startswith('G92'):
            for k, v in num.findall(line):
                if k == 'E': e = float(v)
            continue
        if not line.startswith('G1'):
            continue
        nx, ny, ne = x, y, e
        for k, v in num.findall(line.split(';')[0]):
            if k == 'X': nx = float(v)
            elif k == 'Y': ny = float(v)
            elif k == 'Z': z = float(v)
            elif k == 'E': ne = float(v)
        if ne > e and (nx != x or ny != y) and typ in COL:
            segs.append((x, y, nx, ny, z, width, height, types.index(typ), layer))
        x, y, e = nx, ny, ne
    S = np.array(segs)
    layers = int(S[:, 8].max())
    cx, cy = (S[:, 0].min() + S[:, 0].max()) / 2, (S[:, 1].min() + S[:, 1].max()) / 2
    print(f'{len(S)} extrusion moves, {layers} layers')

    mats = [material(t, COL[t], 0.42, **{'Coat Weight': 0.15}) for t in types]

    def beads(part, name):
        # Each move becomes a six-sided bead, a little longer than the move so
        # that neighbours overlap at the corners.
        p0 = part[:, 0:2] - (cx, cy); p1 = part[:, 2:4] - (cx, cy)
        d = p1 - p0
        ln = np.linalg.norm(d, axis=1, keepdims=True); ln[ln == 0] = 1
        d = d / ln
        nrm = np.stack([-d[:, 1], d[:, 0]], axis=1)
        w, h, zz = part[:, 5:6], part[:, 6:7], part[:, 4:5]
        p0 = p0 - d * w * 0.3; p1 = p1 + d * w * 0.3
        ring = [(0.5, 0.5, 0), (0.28, 0.5, 0.5), (-0.28, 0.5, 0.5), (-0.5, 0.5, 0), (-0.28, 0.5, -0.5), (0.28, 0.5, -0.5)]
        verts = []
        for p in (p0, p1):
            for (a, _, c) in ring:
                xy = p + nrm * w * a * 1.04
                verts.append(np.concatenate([xy, zz - h / 2 + h * c * 1.04], axis=1))
        V = np.stack(verts, axis=1).reshape(-1, 3) * MM   # n x 12 x 3
        n = len(part)
        quads = [(i, (i + 1) % 6, 6 + (i + 1) % 6, 6 + i) for i in range(6)] + [(2, 1, 0, 5), (2, 5, 4, 3), (6, 7, 8, 11), (8, 9, 10, 11)]
        F = (np.arange(n)[:, None, None] * 12 + np.array(quads)[None]).reshape(-1)
        me = bpy.data.meshes.new(name)
        me.vertices.add(n * 12); me.loops.add(n * 40); me.polygons.add(n * 10)
        me.vertices.foreach_set('co', V.reshape(-1))
        me.loops.foreach_set('vertex_index', F)
        me.polygons.foreach_set('loop_start', np.arange(n * 10) * 4)
        me.polygons.foreach_set('loop_total', np.full(n * 10, 4))
        me.polygons.foreach_set('material_index', np.repeat(part[:, 7].astype(int), 10))
        me.polygons.foreach_set('use_smooth', np.ones(n * 10, dtype=bool))
        me.update(); me.validate()
        for m in mats:
            me.materials.append(m)
        o = bpy.data.objects.new(name, me)
        scene.collection.objects.link(o)
        return o

    cuts = [int(c) for c in opt['--cuts'].split(',')]
    cuts[-1] = min(cuts[-1], layers)
    stages, lo = [], 0
    for k, c in enumerate(cuts):
        sel = S[(S[:, 8] > lo) & (S[:, 8] <= c)]
        stages.append(beads(sel, f'stage{k}'))
        lo = c

    # The print bed: a dark textured sheet with a 10 mm grid, on the same paper.
    bed = 1.25
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=bed)
    me = bpy.data.meshes.new('bed'); bm.to_mesh(me)
    m = material('sheet', '#26302b', 0.55)
    nt = m.node_tree
    tc = nt.nodes.new('ShaderNodeTexCoord')
    brick = nt.nodes.new('ShaderNodeTexBrick')
    brick.offset = 0; brick.inputs['Scale'].default_value = 1
    brick.inputs['Brick Width'].default_value = 0.1; brick.inputs['Row Height'].default_value = 0.1
    brick.inputs['Mortar Size'].default_value = 0.0018
    brick.inputs['Color1'].default_value = brick.inputs['Color2'].default_value = srgb('#26302b')
    brick.inputs['Mortar'].default_value = srgb('#3a4a42')
    nt.links.new(tc.outputs['Object'], brick.inputs['Vector'])
    nt.links.new(brick.outputs['Color'], nt.nodes['Principled BSDF'].inputs['Base Color'])
    me.materials.append(m)
    o = bpy.data.objects.new('bed', me); o.location = (0, 0, -0.0005)
    scene.collection.objects.link(o)
    backdrop('#f1ede4', -0.02)

    cam = camera((1.75, 1.55, 1.75), (0.03, 0.0, 0.335), 90)
    area('key', (2.4, -1.2, 3.0), 1.8, 75, (1, 0.97, 0.93), (0, 0, 0.3))
    area('fill', (-0.6, 2.6, 1.4), 2.2, 22, (0.93, 0.96, 1), (0, 0, 0.3))
    area('rim', (-2.0, -1.6, 1.8), 1.4, 30, (1, 1, 1), (0, 0, 0.3))
    for k, c in enumerate(cuts):
        for j, st in enumerate(stages):
            st.hide_render = j > k
        scene.render.filepath = f"{opt['--out-dir']}/layer-{c:03d}.png"
        bpy.ops.render.render(write_still=True)
