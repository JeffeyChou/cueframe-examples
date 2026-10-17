"""Shot 1: the rack. The camera arcs from front-right to front-left and settles; anchors on the
left edge of each tray group feed the callouts."""

import math

import model as m

FRAMES = 8 * 24
m.reset()
m.materials()
m.settings(FRAMES)
root, groups, slots = m.rack()
m.stage()

LABEL = {'power0': 'power_top', 'compute0': 'compute_top', 'switch0': 'switch', 'compute1': 'compute_bottom', 'power1': 'power_bottom'}
for gid, (z0, z1) in groups.items():
    m.anchor(LABEL[gid], root, (-m.INNER_W / 2 + 0.035, m.SLOT_FRONT + 0.03, (z0 + z1) / 2))

target = m.empty('target', (0, 0, 1.15))
cam = m.camera(lens=35, fstop=5.6, focus=target)
m.aim(cam, target)


def orbit(deg, dist, h):
    a = math.radians(deg)
    return (dist * math.sin(a), dist * math.cos(a), h)


m.key(cam, 'location', [(0, orbit(40, 6.4, 1.7)), (120, orbit(20, 5.7, 1.4)), (FRAMES - 1, orbit(16, 5.6, 1.38))])
m.key(target, 'location', [(0, (0.45, 0, 1.2)), (120, (0.62, 0, 1.15)), (FRAMES - 1, (0.65, 0, 1.15))])
