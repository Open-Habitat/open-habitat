# Sends real X keystrokes through XTEST: usage xkey.py x y Control_L e
import sys, time
from Xlib import X, XK, display
from Xlib.ext import xtest
d = display.Display()
x, y = int(sys.argv[1]), int(sys.argv[2])
xtest.fake_input(d, X.MotionNotify, x=x, y=y); d.sync(); time.sleep(0.2)
xtest.fake_input(d, X.ButtonPress, 1); xtest.fake_input(d, X.ButtonRelease, 1); d.sync(); time.sleep(0.3)
codes = [d.keysym_to_keycode(XK.string_to_keysym(k)) for k in sys.argv[3:]]
for c in codes: xtest.fake_input(d, X.KeyPress, c)
for c in reversed(codes): xtest.fake_input(d, X.KeyRelease, c)
d.sync(); time.sleep(0.5)
