"""The whole chip: a package with a die of 8×8 glowing cores. Markers: wide (hold), push (2 s in),
drift (a slow orbit to the end). The scene places these on the narration (scenes/die.ts)."""

import math

import bpy

FRAMES = 192
s = bpy.context.scene
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o)
s.frame_start, s.frame_end = 0, FRAMES - 1
s.render.fps = 24
s.render.resolution_x, s.render.resolution_y = 1920, 1080
s.view_settings.view_transform = 'AgX'
s.view_settings.look = 'AgX - Medium High Contrast'
for name, frame in (('wide', 0), ('push', 24), ('drift', 72)):
    s.timeline_markers.new(name, frame=frame)

world = bpy.data.worlds.get('World') or bpy.data.worlds.new('World')
s.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.004, 0.007, 0.01, 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0


def material(name, color, metal=0.0, rough=0.5, emit=None, strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = strength
    return m


def box(name, size, loc, mat):
    mesh = bpy.data.meshes.new(name)
    x, y, z = (v / 2 for v in size)
    verts = [(sx * x, sy * y, sz * z) for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)]
    faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    mesh.from_pydata(verts, [], faces)
    mesh.materials.append(mat)
    o = bpy.data.objects.new(name, mesh)
    o.location = loc
    s.collection.objects.link(o)
    return o


substrate = material('substrate', (0.03, 0.05, 0.055), rough=0.35)
silicon = material('silicon', (0.02, 0.025, 0.035), metal=0.7, rough=0.25)
gold = material('gold', (0.9, 0.6, 0.25), metal=1.0, rough=0.3)
cores = [material(f'core{k}', (0.02, 0.05, 0.06), emit=(0.22, 0.84, 0.91), strength=0.12 + 0.12 * k) for k in range(4)]
cache = material('cache', (0.05, 0.03, 0.02), emit=(1.0, 0.54, 0.24), strength=0.35)

box('substrate', (3.2, 3.2, 0.12), (0, 0, 0), substrate)
box('die', (1.9, 1.9, 0.06), (0, 0, 0.09), silicon)
for i in range(8):
    for j in range(8):
        mat = cache if j in (3, 4) and i in (0, 7) else cores[(i * 7 + j * 3) % 4]
        box(f'core.{i}.{j}', (0.19, 0.19, 0.012), (-0.8 + i * 0.228, -0.8 + j * 0.228, 0.126), mat)
for k in range(12):
    for side in range(4):
        u = -1.3 + k * (2.6 / 11)
        x, y = ((u, -1.5), (u, 1.5), (-1.5, u), (1.5, u))[side]
        box(f'pad.{side}.{k}', (0.09, 0.09, 0.02), (x, y, 0.07), gold)

light = bpy.data.lights.new('key', 'AREA')
light.energy, light.size = 400, 3
lo = bpy.data.objects.new('key', light)
lo.location = (-2.5, -2.0, 4.0)
lo.rotation_euler = (math.radians(40), 0, math.radians(-50))
s.collection.objects.link(lo)

target = bpy.data.objects.new('target', None)
s.collection.objects.link(target)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
cam.data.lens = 50
s.collection.objects.link(cam)
s.camera = cam
aim = cam.constraints.new('TRACK_TO')
aim.target, aim.track_axis, aim.up_axis = target, 'TRACK_NEGATIVE_Z', 'UP_Y'


def key(o, frame, loc, interp='BEZIER'):
    o.location = loc
    o.keyframe_insert('location', frame=frame)


# wide: hold; push: in to the die; drift: a slow orbit around it.
for f, cl, tl in ((0, (0, -6.6, 4.4), (0, 0, 0)), (24, (0, -6.6, 4.4), (0, 0, 0)), (72, (0.25, -2.7, 1.75), (0.05, 0.1, 0.1))):
    key(cam, f, cl)
    key(target, f, tl)
r, h = math.hypot(0.25, 2.7), 1.75
start = math.atan2(-2.7, 0.25)
for n in range(5):
    f = 72 + n * (FRAMES - 1 - 72) / 4
    a = start + math.radians(22) * n / 4
    key(cam, round(f), (r * math.cos(a), r * math.sin(a), h - 0.1 * n / 4))
    key(target, round(f), (0.05, 0.1, 0.1))
for o in (cam, target):
    for fc in o.animation_data.action.fcurves if hasattr(o.animation_data.action, 'fcurves') else []:
        for kp in fc.keyframe_points:
            if kp.co[0] >= 72:
                kp.interpolation = 'LINEAR'
