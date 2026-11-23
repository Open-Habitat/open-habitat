# Blender script (headless): Example Studio's winter prints as product cut-outs.
#   blender -b --python linen.py -- <towels|cushion-fern|cushion-indigo> <out.png> [samples]
# Linen is a cloth simulation (hung from a peg, or a cover blown up with
# pressure); the block prints are drawn here with numpy as tiling ink masks.
import bpy, sys, math, random
import numpy as np
from mathutils import Vector, Euler

argv = sys.argv[sys.argv.index('--') + 1:]
WHAT, OUT = argv[0], argv[1]
SAMPLES = int(argv[2]) if len(argv) > 2 else 256

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = SAMPLES
scene.cycles.use_adaptive_sampling = True
scene.cycles.adaptive_threshold = 0.02
try:
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = 'OPENIMAGEDENOISE'
except Exception as e:  # this build has no denoiser: the samples carry it
    scene.cycles.use_denoising = False
    print('no denoiser:', e)
scene.render.film_transparent = True
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.image_settings.color_depth = '16'
scene.render.filepath = OUT
scene.render.threads_mode = 'AUTO'

world = bpy.data.worlds.new('w'); scene.world = world; world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (1, 0.98, 0.95, 1)
world.node_tree.nodes['Background'].inputs[1].default_value = 0.32

def lin(hexs):
    c = [int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c) + (1,)

INK = {'indigo': lin('#1f3a6b'), 'rust': lin('#a8431c'), 'fern': lin('#234a2b')}
LINEN = lin('#ddd0b9')

# ---------- The block prints: tiling ink masks ----------
N = 1024
U, V = np.meshgrid((np.arange(N) + .5) / N, (np.arange(N) + .5) / N)
wrap = lambda d: d - np.round(d)
cov = lambda d, w=0.004: np.clip(0.5 - d / w, 0, 1)

def ellipse(cx, cy, a, b, ang):
    x, y = wrap(U - cx), wrap(V - cy)
    c, s = math.cos(ang), math.sin(ang)
    xr, yr = x * c + y * s, -x * s + y * c
    return (np.sqrt((xr / a) ** 2 + (yr / b) ** 2) - 1) * min(a, b)

def disc(cx, cy, r):
    return np.hypot(wrap(U - cx), wrap(V - cy)) - r

def sprig(cx, cy, flip=1):
    m = cov(np.maximum(np.abs(wrap(U - cx)) - 0.006, np.abs(wrap(V - cy) + 0.02) - 0.15))
    for k, y in enumerate((-0.10, -0.035, 0.03)):
        side = flip * (1 if k % 2 == 0 else -1)
        for sgn in (side, -side):
            dy = 0.0 if sgn == side else 0.03
            m = np.maximum(m, cov(ellipse(cx + sgn * 0.052, cy + y + dy + 0.03, 0.068, 0.027, sgn * math.radians(38))))
    m = np.maximum(m, cov(ellipse(cx, cy + 0.17, 0.06, 0.026, math.radians(90))))
    return m

def print_fern():
    m = np.maximum(sprig(0.25, 0.27), sprig(0.75, 0.77, -1))
    for cx, cy in ((0.25, 0.80), (0.75, 0.30)):
        m = np.maximum(m, cov(disc(cx, cy, 0.017)))
    return m

def print_flower():
    m = np.zeros_like(U)
    for cx, cy in ((0.25, 0.25), (0.75, 0.75)):
        for k in range(8):
            a = k * math.pi / 4
            m = np.maximum(m, cov(ellipse(cx + 0.105 * math.cos(a), cy + 0.105 * math.sin(a), 0.058, 0.027, a)))
        m = np.maximum(m, cov(disc(cx, cy, 0.03)))
    for cx, cy in ((0.75, 0.25), (0.25, 0.75)):
        for dx, dy in ((0.045, 0), (-0.045, 0), (0, 0.045), (0, -0.045)):
            m = np.maximum(m, cov(disc(cx + dx, cy + dy, 0.016)))
    return m

def print_arch():
    m = np.zeros_like(U)
    for row in range(4):
        for col in range(4):
            cx, cy = (col + (0.5 if row % 2 else 0)) * 0.25 + 0.125, row * 0.25 + 0.05
            up = wrap(V - cy) >= -0.002
            d = np.hypot(wrap(U - cx), wrap(V - cy))
            for r, w in ((0.105, 0.014), (0.062, 0.012)):
                m = np.maximum(m, cov(np.abs(d - r) - w) * up)
            m = np.maximum(m, cov(d - 0.026) * up)
    return m

PRINTS = {'fern': print_fern, 'indigo': print_flower, 'rust': print_arch}

def mask_image(name):
    m = PRINTS[name]().astype(np.float32)
    img = bpy.data.images.new('print-' + name, N, N, alpha=False, is_data=True)
    img.pixels.foreach_set(np.stack([m, m, m, np.ones_like(m)], -1).ravel())
    img.pack()
    return img

def linen(name, repeats, weave=900.0):
    mat = bpy.data.materials.new('linen-' + name); mat.use_nodes = True
    nt = mat.node_tree; nd = nt.nodes; L = nt.links.new
    bsdf = nd['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = 0.92
    for k, v in (('Sheen Weight', 0.15), ('Sheen Roughness', 0.5)):
        if k in bsdf.inputs: bsdf.inputs[k].default_value = v
    tc = nd.new('ShaderNodeTexCoord')
    mp = nd.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (repeats[0], repeats[1], 1)
    L(tc.outputs['UV'], mp.inputs['Vector'])
    tex = nd.new('ShaderNodeTexImage'); tex.image = mask_image(name); tex.extension = 'REPEAT'
    L(mp.outputs['Vector'], tex.inputs['Vector'])
    def noise(scale, detail=2.0, vec=None, stretch=None):
        n = nd.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = scale; n.inputs['Detail'].default_value = detail
        src = vec or tc.outputs['UV']
        if stretch:
            m2 = nd.new('ShaderNodeMapping'); m2.inputs['Scale'].default_value = stretch; L(src, m2.inputs['Vector']); src = m2.outputs['Vector']
        L(src, n.inputs['Vector']); return n.outputs['Fac']
    def math_(op, a, b=None, clamp=False):
        m = nd.new('ShaderNodeMath'); m.operation = op; m.use_clamp = clamp
        for i, x in enumerate((a, b)):
            if x is None: continue
            if isinstance(x, (int, float)): m.inputs[i].default_value = x
            else: L(x, m.inputs[i])
        return m.outputs[0]
    # The stamp: edges eaten by the weave, ink thinner where the block lifted.
    edge = math_('ADD', tex.outputs['Color'], math_('MULTIPLY', math_('SUBTRACT', noise(260, 3), 0.5), 0.28))
    hard = nd.new('ShaderNodeMapRange'); hard.inputs['From Min'].default_value = 0.38; hard.inputs['From Max'].default_value = 0.62
    L(edge, hard.inputs['Value'])
    dens = nd.new('ShaderNodeMapRange'); dens.inputs['From Min'].default_value = 0.3; dens.inputs['From Max'].default_value = 0.7
    dens.inputs['To Min'].default_value = 0.8; dens.inputs['To Max'].default_value = 1.0
    L(noise(14, 4), dens.inputs['Value'])
    ink = math_('MULTIPLY', hard.outputs['Result'], dens.outputs['Result'], True)
    # The cloth: warp and weft threads of uneven thickness.
    warp = noise(1.0, 1.0, stretch=(repeats[0] * 60, repeats[1] * 1.2, 1)); weft = noise(1.0, 1.0, stretch=(repeats[0] * 1.2, repeats[1] * 60, 1))
    slub = math_('ADD', math_('MULTIPLY', warp, 0.5), math_('MULTIPLY', weft, 0.5))
    shade = nd.new('ShaderNodeMapRange'); shade.inputs['From Min'].default_value = 0.3; shade.inputs['From Max'].default_value = 0.7
    shade.inputs['To Min'].default_value = 0.86; shade.inputs['To Max'].default_value = 1.06
    L(slub, shade.inputs['Value'])
    base = nd.new('ShaderNodeMixRGB'); base.blend_type = 'MULTIPLY'; base.inputs['Fac'].default_value = 1
    base.inputs['Color1'].default_value = LINEN; L(shade.outputs['Result'], base.inputs['Color2'])
    mix = nd.new('ShaderNodeMixRGB'); mix.inputs['Color2'].default_value = INK[name]
    L(ink, mix.inputs['Fac']); L(base.outputs['Color'], mix.inputs['Color1'])
    L(mix.outputs['Color'], bsdf.inputs['Base Color'])
    sep = nd.new('ShaderNodeSeparateXYZ'); L(tc.outputs['UV'], sep.inputs['Vector'])
    wx = math_('SINE', math_('MULTIPLY', sep.outputs['X'], weave * repeats[0] / 6)); wy = math_('SINE', math_('MULTIPLY', sep.outputs['Y'], weave * repeats[1] / 6))
    h = math_('ADD', math_('MULTIPLY', math_('MULTIPLY', wx, wy), 0.5), math_('MULTIPLY', slub, 1.6))
    bump = nd.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.35; bump.inputs['Distance'].default_value = 0.0006
    L(h, bump.inputs['Height']); L(bump.outputs['Normal'], bsdf.inputs['Normal'])
    return mat

def wood():
    mat = bpy.data.materials.new('wood'); mat.use_nodes = True
    b = mat.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = lin('#c9a77c'); b.inputs['Roughness'].default_value = 0.32
    return mat

def area(loc, target, size, power, color=(1, 1, 1)):
    d = bpy.data.lights.new('a', 'AREA'); d.size = size; d.energy = power; d.color = color
    o = bpy.data.objects.new('a', d); scene.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()

def camera(loc, target, lens, res):
    c = bpy.data.cameras.new('c'); c.lens = lens; c.sensor_width = 36
    o = bpy.data.objects.new('c', c); scene.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    scene.camera = o; scene.render.resolution_x, scene.render.resolution_y = res; scene.render.resolution_percentage = 100

def catcher(loc, rot, size):
    bpy.ops.mesh.primitive_plane_add(size=size, location=loc, rotation=rot)
    o = bpy.context.object; o.is_shadow_catcher = True
    return o

def run(frames):
    scene.frame_start, scene.frame_end = 1, frames
    for f in range(1, frames + 1):
        scene.frame_set(f)

def freeze(obj, mat, thickness=0.0):
    """The simulated shape as a plain mesh, smooth, with thickness."""
    ev = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    me = bpy.data.meshes.new_from_object(ev)
    o = bpy.data.objects.new(obj.name + '-set', me); scene.collection.objects.link(o)
    o.matrix_world = obj.matrix_world.copy()
    bpy.data.objects.remove(obj)
    for p in me.polygons: p.use_smooth = True
    me.materials.clear(); me.materials.append(mat)
    if thickness:
        s = o.modifiers.new('solid', 'SOLIDIFY'); s.thickness = thickness; s.offset = 0
    s = o.modifiers.new('sub', 'SUBSURF'); s.levels = s.render_levels = 2
    return o

def towel(x, name, seed, slack):
    rnd = random.Random(seed)
    W, H = 0.5, 0.7
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=46, y_subdivisions=62, size=1, location=(0, 0, 0))
    o = bpy.context.object; o.name = 'towel-' + name
    ph = [rnd.uniform(0, 6.28) for _ in range(6)]
    pin = o.vertex_groups.new(name='pin')
    for v in o.data.vertices:
        px, py = v.co.x * W, v.co.y * H
        for sx in (-PEG, PEG):
            if math.hypot(px - sx, py - H / 2) < 0.02: pin.add([v.index], 1.0, 'REPLACE')
        # Hung on two pegs closer together than the cloth is wide: it starts gathered.
        wave = math.sin(px / W * math.pi * 5 + ph[0]) + 0.5 * math.sin(px / W * math.pi * 9 + ph[1]) + 0.3 * math.sin(py * 13 + ph[2])
        v.co = Vector((x + px * slack, -0.04 - 0.018 * wave, py - H / 2))
    c = o.modifiers.new('cloth', 'CLOTH'); s = c.settings
    s.quality = 8; s.mass = 0.25; s.air_damping = 3
    s.tension_stiffness = s.compression_stiffness = 18; s.shear_stiffness = 6; s.bending_stiffness = 0.3
    s.tension_damping = s.compression_damping = 6; s.bending_damping = 1
    s.vertex_group_mass = 'pin'
    c.collision_settings.use_self_collision = True; c.collision_settings.self_distance_min = 0.004
    c.collision_settings.distance_min = 0.006; c.collision_settings.collision_quality = 3
    return o

PEG = 0.19
if WHAT == 'towels':
    wall = catcher((0, 0.012, -0.3), (math.radians(90), 0, 0), 6)
    wall.modifiers.new('col', 'COLLISION'); wall.collision.thickness_outer = 0.01; wall.collision.cloth_friction = 12
    spec = [(-0.56, 'indigo', 3, 0.70), (0.0, 'rust', 11, 0.78), (0.56, 'fern', 7, 0.66)]
    cloths = [(towel(x, n, sd, cn), n) for x, n, sd, cn in spec]
    run(110)
    for o, n in cloths:
        freeze(o, linen(n, (0.5 / 0.105, 0.7 / 0.105)), 0.0014)
    w = wood()
    for x, n, sd, sl in spec:
      for px in (-PEG * sl, PEG * sl):
        xx, z = x + px, 0.0
        bpy.ops.mesh.primitive_cylinder_add(radius=0.011, depth=0.085, location=(xx, -0.03, z), rotation=(math.radians(90), 0, 0)); bpy.context.object.data.materials.append(w)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.021, location=(xx, -0.075, z), segments=48, ring_count=24)
        k = bpy.context.object; k.data.materials.append(w)
        for p in k.data.polygons: p.use_smooth = True
    camera((0, -7.5, -0.33), (0, 0, -0.33), 135, (1800, 1000))
    area((-2.6, -3.2, 2.2), (0, 0, -0.1), 2.6, 300, (1, 0.97, 0.93))
    area((3.0, -3.5, -0.2), (0, 0, -0.1), 3.0, 70, (0.95, 0.97, 1))
else:
    name = WHAT.split('-')[1]
    n = 54; side = 0.45
    verts, idx_top, idx_bot = [], {}, {}
    for j in range(n + 1):
        for i in range(n + 1):
            edge = i in (0, n) or j in (0, n)
            idx_top[i, j] = len(verts); verts.append(((i / n - .5) * side, (j / n - .5) * side, 0 if edge else 0.003))
            if edge: idx_bot[i, j] = idx_top[i, j]
            else: idx_bot[i, j] = len(verts); verts.append(((i / n - .5) * side, (j / n - .5) * side, -0.003))
    faces, uvs = [], []
    for j in range(n):
        for i in range(n):
            q = [(i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)]
            faces.append([idx_top[k] for k in q]); uvs += [(a / n, b / n) for a, b in q]
            faces.append([idx_bot[k] for k in reversed(q)]); uvs += [(a / n, b / n) for a, b in reversed(q)]
    me = bpy.data.meshes.new('cover'); me.from_pydata(verts, [], faces); me.update()
    uv = me.uv_layers.new(name='UVMap')
    for l, t in zip(uv.data, uvs): l.uv = t
    o = bpy.data.objects.new('cover', me); scene.collection.objects.link(o)
    c = o.modifiers.new('cloth', 'CLOTH'); s = c.settings
    s.quality = 8; s.mass = 0.3
    s.tension_stiffness = s.compression_stiffness = 30; s.shear_stiffness = 10; s.bending_stiffness = 0.4
    s.use_pressure = True; s.uniform_pressure_force = 2.5; s.pressure_factor = 1
    s.effector_weights.gravity = 0
    run(45)
    o = freeze(o, linen(name, (0.45 / 0.105, 0.45 / 0.105)))
    lean = {'fern': (math.radians(76), 0, math.radians(-16)), 'indigo': (math.radians(78), 0, math.radians(14))}[name]
    o.rotation_euler = Euler(lean)
    bpy.context.view_layer.update()
    ev = o.evaluated_get(bpy.context.evaluated_depsgraph_get())
    zmin = min((ev.matrix_world @ v.co).z for v in ev.data.vertices)
    o.location.z -= zmin
    catcher((0, 0, 0), (0, 0, 0), 8)
    camera((0, -4.2, 0.62), (0, 0, 0.22), 190, (1200, 1200))
    area((-2.2, -2.6, 2.6), (0, 0, 0.2), 2.4, 170, (1, 0.97, 0.93))
    area((2.6, -2.6, 0.8), (0, 0, 0.2), 2.6, 45, (0.95, 0.97, 1))

bpy.ops.render.render(write_still=True)
print('wrote', OUT)
