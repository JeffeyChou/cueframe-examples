"""Shot 3: the rack at the right of the frame, a slow push, room on the left for the bars."""

import math

import model as m

FRAMES = 7 * 24
m.reset()
m.materials()
m.settings(FRAMES)
root, groups, slots = m.rack()
m.stage()
target = m.empty('target', (0.8, 0, 1.15))
cam = m.camera(lens=35, fstop=5.6)
m.aim(cam, target)
m.key(cam, 'location', [(0, (1.0, 6.0, 1.3)), (FRAMES - 1, (0.85, 5.4, 1.25))])
