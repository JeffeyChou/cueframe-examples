"""Shot 2: one compute tray slides out and the camera rises over it. Anchors on a GPU and a CPU
cold plate, the coolant manifold and the front I/O."""

import math

import model as m

FRAMES = 9 * 24
SLOT = 7  # the third compute tray from the top
m.reset()
m.materials()
m.settings(FRAMES)
root, groups, slots = m.rack(with_tray_slot=SLOT)
m.stage()

kind, z = slots[SLOT]
tray, parts = m.compute_tray('tray', root)
m.softbox((0, m.SLOT_FRONT + 0.3, z), size=1.0, energy=15)
# A dimmer pool: the floor behind the tray stays dark enough for white type.
m.bpy.data.objects['pool'].data.energy = 260
m.key(tray, 'location', [(0, (0, m.SLOT_FRONT, z)), (24, (0, m.SLOT_FRONT, z)), (84, (0, m.SLOT_FRONT + 0.62, z))])
# Anchors float a few cm above (or in front of) what they mark, so a tube crossing in front of
# a cold plate does not hide the label's point.
m.anchor('gpu', parts['gpu-r1'], (0, 0, 0.05))  # a front GPU: the rear ones stay under the rack
m.anchor('cpu', parts['cpu-l'], (0, 0, 0.05))
m.anchor('coolant', tray, (0, -0.55, -m.U * 0.46 + 0.07))
m.anchor('front', tray, (-0.18, 0.06, 0.01))

target = m.empty('target', (0, m.SLOT_FRONT, z))
cam = m.camera(lens=38, fstop=2.8, focus=target)
m.aim(cam, target)
tz = z
m.key(cam, 'location', [
    (0, (1.6, 2.6, tz + 0.35)),
    (60, (1.3, 2.2, tz + 0.6)),
    (140, (0.55, 1.95, tz + 1.15)),
    (FRAMES - 1, (0.5, 1.9, tz + 1.2)),
])
# The tray ends right of centre, the dark rack and floor on the left take the labels.
m.key(target, 'location', [
    (0, (0, m.SLOT_FRONT, tz)),
    (84, (0.05, m.SLOT_FRONT + 0.25, tz)),
    (140, (0.2, m.SLOT_FRONT + 0.3, tz)),
    (FRAMES - 1, (0.21, m.SLOT_FRONT + 0.31, tz)),
])
