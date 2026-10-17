"""A stylised GB300 NVL72 rack, built from code so every shot shares one model.

Proportions follow the public descriptions (about 2.3 m tall, 0.6 m wide, 1.07 m deep; from the top:
4 power shelves, 10 compute trays, 9 NVLink switch trays, 8 compute trays, 4 power shelves). The
compute tray interior is simplified: two boards, each with two GPU and one CPU cold plate, coolant
tubes to a manifold, drive bays and network cards at the front. Units are metres.
"""

from __future__ import annotations

import math

import bpy

U = 0.0445  # one rack unit
RACK_W, RACK_D, RACK_H = 0.60, 1.07, 2.30
INNER_W = 0.48
SLOT_FRONT = RACK_D / 2 - 0.02  # trays' front faces sit just inside the door line

# From the top: (kind, count, height in U)
STACK = [('power', 4, 1), ('compute', 10, 1), ('switch', 9, 1), ('compute', 8, 1), ('power', 4, 1)]


def reset() -> None:
    for c in list(bpy.data.collections):
        bpy.data.collections.remove(c)
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)


def material(name: str, color, metal=0.0, rough=0.5, emit=None, strength=0.0, coat=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    if 'Coat Weight' in b.inputs:
        b.inputs['Coat Weight'].default_value = coat
    if emit is not None:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = strength
    return m


MAT: dict = {}


def materials() -> dict:
    MAT.update({
        'cabinet': material('cabinet', (0.006, 0.0065, 0.007), metal=0.0, rough=0.72),
        'frame': material('frame', (0.05, 0.05, 0.055), metal=0.8, rough=0.3),
        'gold': material('gold', (0.62, 0.45, 0.20), metal=1.0, rough=0.28),
        'brass': material('brass', (0.78, 0.60, 0.30), metal=1.0, rough=0.22),
        'tray': material('tray', (0.035, 0.036, 0.04), metal=0.7, rough=0.5),
        'grille': material('grille', (0.03, 0.03, 0.032), metal=0.5, rough=0.5),
        'silver': material('silver', (0.55, 0.56, 0.58), metal=1.0, rough=0.25),
        'pcb': material('pcb', (0.012, 0.09, 0.03), rough=0.5, coat=0.3),
        'copper': material('copper', (0.86, 0.48, 0.30), metal=1.0, rough=0.32),
        'chip': material('chip', (0.05, 0.05, 0.055), rough=0.3, coat=0.6),
        'tube': material('tube', (0.07, 0.07, 0.075), rough=0.55),
        'coolant': material('coolant', (0.45, 0.015, 0.01), rough=0.3, emit=(1.0, 0.06, 0.02), strength=1.6),
        'led': material('led', (0.1, 0.6, 1.0), emit=(0.2, 0.7, 1.0), strength=8.0),
        'floor': material('floor', (0.012, 0.012, 0.013), metal=0.0, rough=0.18),
        'white': material('white', (0.85, 0.85, 0.86), rough=0.4),
    })
    return MAT


def box(name: str, size, loc, mat, parent=None, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    o.location = loc
    if bevel > 0:
        m = o.modifiers.new('bevel', 'BEVEL')
        m.width = bevel
        m.segments = 2
    o.data.materials.append(mat)
    if parent is not None:
        o.parent = parent
    return o


def cylinder(name: str, r: float, depth: float, loc, rot, mat, parent=None, verts=24):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, rotation=rot, vertices=verts)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(mat)
    if parent is not None:
        o.parent = parent
    return o


def tube(name: str, points, r: float, mat, parent=None):
    """A smooth tube through `points` (a bezier curve with a round bevel)."""
    c = bpy.data.curves.new(name, 'CURVE')
    c.dimensions = '3D'
    c.bevel_depth = r
    c.bevel_resolution = 4
    sp = c.splines.new('BEZIER')
    sp.bezier_points.add(len(points) - 1)
    for p, xyz in zip(sp.bezier_points, points):
        p.co = xyz
        p.handle_left_type = p.handle_right_type = 'AUTO'
    o = bpy.data.objects.new(name, c)
    o.data.materials.append(mat)
    bpy.context.scene.collection.objects.link(o)
    if parent is not None:
        o.parent = parent
    return o


def anchor(name: str, parent, loc=(0, 0, 0)):
    """An `anchor.<name>` empty: CueFrame reads it as track <name> (cueframe-py blender)."""
    a = bpy.data.objects.new(f'anchor.{name}', None)
    bpy.context.scene.collection.objects.link(a)
    a.parent = parent
    a.location = loc
    return a


def empty(name: str, loc=(0, 0, 0)):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = loc
    return e


def tray_front(kind: str, z: float, h: float, parent):
    """The front of one tray: a panel, handles at both ends and the face that tells the kinds apart."""
    y = SLOT_FRONT
    t = empty(f'{kind}-front', (0, y, z))
    t.parent = parent
    box('panel', (INNER_W, 0.012, h * 0.92), (0, 0, 0), MAT['tray'], t, bevel=0.0015)
    for sx in (-1, 1):
        box('handle', (0.016, 0.03, h * 0.7), (sx * (INNER_W / 2 - 0.012), 0.018, 0), MAT['brass'], t, bevel=0.002)
    if kind == 'compute':
        # Gold heat-sink fins across most of the face, network ports at the left.
        for i in range(30):
            box('fin', (0.004, 0.008, h * 0.62), (-0.12 + i * 0.0105, 0.009, 0), MAT['gold'], t)
        for i in range(4):
            box('port', (0.014, 0.01, h * 0.38), (-0.205 + i * 0.019, 0.009, 0), MAT['grille'], t)
        box('led', (0.004, 0.004, 0.004), (0.205, 0.009, h * 0.25), MAT['led'], t)
    elif kind == 'switch':
        # Dense silver cable cartridges.
        for i in range(36):
            box('port', (0.008, 0.012, h * 0.5), (-0.2 + i * 0.0114, 0.01, 0), MAT['silver'], t)
    else:
        # Power shelf: fan grilles.
        for i in range(6):
            cylinder('fan', h * 0.36, 0.006, (-0.19 + i * 0.076, 0.009, 0), (math.radians(90), 0, 0), MAT['grille'], t)
    return t


def rack(with_tray_slot: int | None = None):
    """The cabinet and its trays. Returns (root, groups, tray_slots) where groups maps a group id to
    the z range of its trays and tray_slots lists (kind, z) for each tray, top first."""
    root = empty('rack')
    for sx in (-1, 1):
        box('side', (0.03, RACK_D, RACK_H), (sx * (RACK_W / 2 - 0.015), 0, RACK_H / 2), MAT['cabinet'], root, bevel=0.004)
    box('top', (RACK_W, RACK_D, 0.05), (0, 0, RACK_H - 0.025), MAT['cabinet'], root, bevel=0.004)
    box('base', (RACK_W, RACK_D, 0.09), (0, 0, 0.045), MAT['cabinet'], root, bevel=0.004)
    box('back', (RACK_W - 0.06, 0.02, RACK_H - 0.14), (0, -RACK_D / 2 + 0.01, RACK_H / 2), MAT['frame'], root)
    for sx in (-1, 1):
        box('rail', (0.02, 0.03, RACK_H - 0.16), (sx * (INNER_W / 2 + 0.015), SLOT_FRONT + 0.005, RACK_H / 2), MAT['frame'], root)
    for sx in (-1, 1):
        for sy in (-1, 1):
            cylinder('foot', 0.025, 0.05, (sx * 0.24, sy * 0.45, -0.02), (0, 0, 0), MAT['frame'], root)
    z = RACK_H - 0.12
    groups: dict[str, tuple[float, float]] = {}
    slots: list[tuple[str, float]] = []
    seen: dict[str, int] = {}
    for kind, count, units in STACK:
        k = seen.get(kind, 0)
        seen[kind] = k + 1
        gid = f'{kind}{k}'
        top = z
        for _ in range(count):
            h = units * U
            zc = z - h / 2
            idx = len(slots)
            slots.append((kind, zc))
            if idx != with_tray_slot:
                tray_front(kind, zc, h, root)
            z -= h + 0.004
        groups[gid] = (z + 0.004, top)
        z -= 0.03
    return root, groups, slots


def compute_tray(name: str, parent=None):
    """A compute tray pulled from the rack: open top, two superchip boards, liquid cooling.
    Its origin is the centre of the front face. Returns (root, parts)."""
    t = empty(name)
    if parent is not None:
        t.parent = parent
    depth, w, h = 0.80, INNER_W - 0.01, U * 0.92
    cy = -depth / 2  # tray body behind the front face
    box('floor', (w, depth, 0.003), (0, cy, -h / 2 + 0.0015), MAT['tray'], t)
    for sx in (-1, 1):
        box('wall', (0.003, depth, h), (sx * w / 2, cy, 0), MAT['tray'], t)
    box('rear', (w, 0.003, h), (0, -depth, 0), MAT['tray'], t)
    # Front face (same as in the rack).
    front = tray_front('compute', 0, U, t)
    front.location = (0, 0.006, 0)
    parts = {}
    z0 = -h / 2 + 0.004
    for side, sx in (('l', -1), ('r', 1)):
        bx = sx * w / 4
        board = box(f'board-{side}', (w / 2 - 0.02, depth * 0.56, 0.002), (bx, cy - depth * 0.12, z0), MAT['pcb'], t)
        # Two GPU cold plates at the back, one CPU plate nearer the front.
        for j, gy in enumerate((cy - depth * 0.30, cy - depth * 0.08)):
            plate = box(f'gpu-{side}{j}', (0.10, 0.12, 0.012), (bx, gy, z0 + 0.008), MAT['copper'], t, bevel=0.002)
            box('lid', (0.07, 0.08, 0.005), (bx, gy, z0 + 0.016), MAT['copper'], t, bevel=0.0015)
            parts[f'gpu-{side}{j}'] = plate
            for d in (-1, 1):
                tube(f'tube-{side}{j}{d}', [(bx + d * 0.02, gy + 0.05, z0 + 0.016), (bx + d * 0.02, gy + 0.09, z0 + 0.03),
                                            (sx * 0.02 + d * 0.006, gy + 0.10, z0 + 0.03)], 0.0035, MAT['tube'], t)
        cpu = box(f'cpu-{side}', (0.06, 0.06, 0.010), (bx, cy + depth * 0.12, z0 + 0.007), MAT['copper'], t, bevel=0.002)
        parts[f'cpu-{side}'] = cpu
        for k in range(4):
            box('dimm', (0.006, 0.05, 0.02), (bx + (k - 1.5) * 0.018 + sx * 0.04, cy + depth * 0.12, z0 + 0.011), MAT['chip'], t)
    # Coolant manifold down the middle: the red supply line.
    pipe = tube('manifold', [(0, -depth + 0.02, z0 + 0.03), (0, cy, z0 + 0.03), (0, -0.08, z0 + 0.03), (0, -0.02, z0 + 0.015)], 0.009, MAT['coolant'], t)
    parts['manifold'] = pipe
    # Front section: drive bays and network cards.
    for i in range(8):
        box('e1s', (0.012, 0.11, 0.03), (-0.2 + i * 0.016, -0.08, z0 + 0.015), MAT['silver'], t)
    for i in range(4):
        box('nic', (0.05, 0.12, 0.004), (0.06 + i * 0.045, -0.09, z0 + 0.02), MAT['pcb'], t)
    parts['front'] = front
    return t, parts


def stage(world_strength: float = 0.02):
    """Floor, dark world, a warm key, a cool rim and a pool of light on the floor."""
    scene = bpy.context.scene
    w = bpy.data.worlds.new('world')
    w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.02, 0.021, 0.024, 1)
    w.node_tree.nodes['Background'].inputs['Strength'].default_value = world_strength
    scene.world = w
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0))
    bpy.context.object.name = 'floor'
    bpy.context.object.data.materials.append(MAT['floor'])

    def light(name, kind, loc, rot, energy, color, size=1.0):
        d = bpy.data.lights.new(name, kind)
        d.energy = energy
        d.color = color
        if kind == 'AREA':
            d.size = size
        if kind == 'SPOT':
            d.spot_size = math.radians(40)
            d.spot_blend = 0.6
        o = bpy.data.objects.new(name, d)
        o.location = loc
        o.rotation_euler = rot
        scene.collection.objects.link(o)
        return o

    light('key', 'AREA', (-2.2, 2.6, 3.2), (math.radians(50), 0, math.radians(-140)), 450, (1.0, 0.86, 0.72), 2.0)
    light('rim', 'AREA', (2.4, -2.0, 2.4), (math.radians(60), 0, math.radians(50)), 320, (0.65, 0.78, 1.0), 1.5)
    light('pool', 'SPOT', (0.3, 1.4, 4.0), (math.radians(18), 0, 0), 1400, (1.0, 0.95, 0.88))
    light('fill', 'AREA', (0, 3.5, 1.2), (math.radians(90), 0, math.radians(180)), 30, (0.9, 0.9, 1.0), 2.0)


def softbox(loc, size=1.2, energy=250):
    """A soft light straight above `loc`, for close-ups of shiny parts."""
    d = bpy.data.lights.new('softbox', 'AREA')
    d.energy = energy
    d.size = size
    o = bpy.data.objects.new('softbox', d)
    o.location = (loc[0], loc[1], loc[2] + 1.2)
    bpy.context.scene.collection.objects.link(o)
    return o


def camera(name='cam', lens=40.0, fstop=0.0, focus=None):
    d = bpy.data.cameras.new(name)
    d.lens = lens
    d.clip_start = 0.02
    if fstop:
        d.dof.use_dof = True
        d.dof.aperture_fstop = fstop
        if focus is not None:
            d.dof.focus_object = focus
    o = bpy.data.objects.new(name, d)
    bpy.context.scene.collection.objects.link(o)
    bpy.context.scene.camera = o
    return o


def aim(cam, target):
    c = cam.constraints.new('TRACK_TO')
    c.target = target
    c.track_axis = 'TRACK_NEGATIVE_Z'
    c.up_axis = 'UP_Y'


def key(o, path: str, frames_values, interp='BEZIER'):
    """Keyframe `path` (location, rotation_euler, …) at (frame, value) pairs."""
    for f, v in frames_values:
        setattr(o, path, v)
        o.keyframe_insert(path, frame=f)


def settings(frames: int, fps: int = 24, res=(1920, 1080)):
    s = bpy.context.scene
    s.frame_start, s.frame_end = 0, frames - 1
    s.render.fps = fps
    s.render.resolution_x, s.render.resolution_y = res
    s.view_settings.view_transform = 'AgX'
    s.view_settings.look = 'AgX - Medium High Contrast'
    if hasattr(s.render, 'use_motion_blur'):
        s.render.use_motion_blur = True
