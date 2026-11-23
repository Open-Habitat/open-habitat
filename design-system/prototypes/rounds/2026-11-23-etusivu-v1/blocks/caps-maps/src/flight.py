# A flight around the textured 3D model OpenDroneMap made: PyVista (VTK) draws
# the frames off screen, ffmpeg cuts them into the film (assets.mjs).
#
#   xvfb-run -a python flight.py <odm_texturing dir> <frames dir>
#
# The camera swings a quarter circle around the park and back, so the film
# loops without a jump.
import math
import os
import sys
from pathlib import Path

import numpy as np
import pyvista as pv

tex_dir, frames = Path(sys.argv[1]), Path(sys.argv[2])
frames.mkdir(parents=True, exist_ok=True)
W, H, N = 960, 600, int(os.environ.get('FLIGHT_FRAMES', 144))  # 6 s at 24 frames per second

pl = pv.Plotter(off_screen=True, window_size=(W, H), lighting='none')
pl.import_obj(str(tex_dir / 'odm_textured_model_geo.obj'))
pl.set_background('#1d2a20')
actors = list(pl.renderer.actors.values())
for a in actors:  # the photo texture as it is: no shading on top of the baked light
    p = a.GetProperty()
    p.LightingOff(); p.SetColor(1, 1, 1); p.SetAmbientColor(1, 1, 1); p.SetDiffuseColor(1, 1, 1)
    if a.GetTexture():
        a.GetTexture().UseSRGBColorSpaceOn(); a.GetTexture().InterpolateOn(); a.GetTexture().MipmapOn()
pl.enable_anti_aliasing('ssaa')
b = np.array(pl.bounds)
cx, cy = (b[0] + b[1]) / 2, (b[2] + b[3]) / 2
span = max(b[1] - b[0], b[3] - b[2])
# Ground height: the median of the model's vertices.
zs = np.concatenate([pv.wrap(a.GetMapper().GetInput()).points[:, 2] for a in actors])
z0 = float(np.median(zs))
focus = (b[0] + (b[1] - b[0]) * .29, b[2] + (b[3] - b[2]) * .52, z0)
pl.camera.view_angle = 32
for k in range(N):
    t = k / N
    swing = math.sin(2 * math.pi * t)            # there and back
    az = math.radians(-62 + 30 * swing)
    dist, height = span * .44, span * .22
    pl.camera.position = (focus[0] + dist * math.cos(az), focus[1] + dist * math.sin(az), z0 + height)
    pl.camera.focal_point = focus
    pl.camera.up = (0, 0, 1)
    pl.camera.clipping_range = (1, span * 4)
    pl.render()
    pl.screenshot(str(frames / f'f-{k:03d}.png'))
print(f'{N} frames, {W} x {H}, model {b[1] - b[0]:.0f} x {b[3] - b[2]:.0f} m')
