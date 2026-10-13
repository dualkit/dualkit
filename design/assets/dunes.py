# A calm painted desert at dusk, for the product window to sit on. Low frequency, brushy, muted.
import numpy as np
from PIL import Image, ImageFilter
rng = np.random.default_rng(13)
W, H = 2600, 1440

def value_noise(w, h, cells, seed):
    r = np.random.default_rng(seed)
    g = r.random((cells[1] + 3, cells[0] + 3))
    ys = np.linspace(0, cells[1], h, endpoint=False)
    xs = np.linspace(0, cells[0], w, endpoint=False)
    xi, yi = np.floor(xs).astype(int), np.floor(ys).astype(int)
    xf, yf = xs - xi, ys - yi
    sx, sy = xf * xf * (3 - 2 * xf), yf * yf * (3 - 2 * yf)
    a = g[np.ix_(yi, xi)]; b = g[np.ix_(yi, xi + 1)]; c = g[np.ix_(yi + 1, xi)]; d = g[np.ix_(yi + 1, xi + 1)]
    top = a + (b - a) * sx; bot = c + (d - c) * sx
    return top + (bot - top) * sy[:, None]

def fbm(w, h, cells, octaves, seed):
    out = np.zeros((h, w)); amp = 1; tot = 0
    for o in range(octaves):
        out += amp * value_noise(w, h, (cells[0] * 2 ** o, cells[1] * 2 ** o), seed + o); tot += amp; amp *= 0.5
    return out / tot

y = np.linspace(0, 1, H)[:, None]; x = np.linspace(0, 1, W)[None, :]
# Sky: pale steel at the top warming to a sand haze at the horizon.
sky_top, sky_low = np.array([206, 212, 216]), np.array([233, 223, 206])
t = np.clip(y / 0.62, 0, 1) ** 1.4
img = sky_top * (1 - t[..., None]) + sky_low * t[..., None]
img = np.broadcast_to(img, (H, W, 3)).copy()
# Soft cloud banks, stretched horizontally like brush strokes.
cloud = fbm(W, H, (3, 6), 3, 7)
cloud = 1 / (1 + np.exp(-(cloud - 0.55) * 9)) * np.clip(1 - y / 0.55, 0, 1)
img += (np.array([246, 242, 236]) - img) * (cloud[..., None] * 0.55)
# Dunes: four ridges, back to front, each lighter and hazier further away.
ridges = [(0.58, 0.035, [214, 196, 172], 0.55), (0.66, 0.05, [205, 180, 150], 0.35), (0.76, 0.06, [190, 160, 126], 0.15), (0.88, 0.07, [168, 137, 104], 0.0)]
for k, (base, amp, col, haze) in enumerate(ridges):
    ridge = base + amp * (np.sin(x * (2.1 + k) * np.pi + k * 1.7) * 0.5 + fbm(W, 1, (4 + k, 1), 3, 30 + k)[0] - 0.5)
    mask = (y >= ridge).astype(float)
    shade = fbm(W, H, (5 + k, 3), 3, 50 + k)  # wind ripples
    lit = np.clip((y - ridge) * 9, 0, 1)
    colour = np.array(col) * (0.94 + 0.12 * shade[..., None]) * (1 - 0.10 * lit[..., None])
    colour = colour * (1 - haze) + sky_low * haze
    img = img * (1 - mask[..., None]) + colour * mask[..., None]
# Brush texture: anisotropic noise, wide and short, then a gentle blur so edges read as paint.
brush = fbm(W, H, (14, 90), 2, 99) - 0.5
img += brush[..., None] * 10
im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.6))
arr = np.asarray(im).astype(float)
arr += rng.normal(0, 3.2, (H, W, 1))  # fine grain
Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save('/private/tmp/claude-501/-Users-samsantos-Documents-Design-ssantosdesign/d0589d2d-d19f-4447-955e-75d60f9a1dbf/scratchpad/paint/dunes.png', optimize=True)
print('ok')
