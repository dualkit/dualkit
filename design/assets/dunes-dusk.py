# Golden hour over the dunes, for v3's frosted glass to sit on. Saturated sky, dark ridges with a warm rim, low frequency.
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
# Sky: deep steel blue at the top, through peach, to an amber glow at the horizon, brightest behind the sun.
sky_top, sky_mid, sky_low = np.array([62, 92, 136]), np.array([170, 150, 150]), np.array([238, 160, 92])
t = np.clip(y / 0.6, 0, 1)
img = np.where(t[..., None] < 0.55, sky_top + (sky_mid - sky_top) * np.clip(t[..., None] / 0.55, 0, 1) ** 1.2, sky_mid + (sky_low - sky_mid) * np.clip((t[..., None] - 0.55) / 0.45, 0, 1) ** 0.9)
img = np.broadcast_to(img, (H, W, 3)).copy()
sun = np.exp(-(((x - 0.68) / 0.22) ** 2 + ((y - 0.6) / 0.12) ** 2))
img += (np.array([255, 214, 150]) - img) * (sun[..., None] * 0.75)
# Thin cloud streaks catching the light.
cloud = fbm(W, H, (3, 9), 3, 7)
cloud = 1 / (1 + np.exp(-(cloud - 0.58) * 10)) * np.clip(1 - y / 0.5, 0, 1)
img += (np.array([246, 196, 160]) - img) * (cloud[..., None] * 0.35)
sky_low = np.array([226, 150, 96])
# Dunes: four ridges, back to front, each lighter and hazier further away.
ridges = [(0.6, 0.03, [150, 96, 78], 0.5), (0.67, 0.045, [118, 70, 48], 0.3), (0.76, 0.06, [86, 50, 32], 0.12), (0.87, 0.07, [52, 32, 22], 0.0)]
for k, (base, amp, col, haze) in enumerate(ridges):
    ridge = base + amp * (np.sin(x * (2.1 + k) * np.pi + k * 1.7) * 0.5 + fbm(W, 1, (4 + k, 1), 3, 30 + k)[0] - 0.5)
    mask = (y >= ridge).astype(float)
    shade = fbm(W, H, (5 + k, 3), 3, 50 + k)  # wind ripples
    lit = np.clip((y - ridge) * 9, 0, 1)
    rim = np.exp(-((y - ridge) / 0.02) ** 2) * (0.4 + 0.6 * np.clip(1 - np.abs(x - 0.68) / 0.6, 0, 1))
    colour = np.array(col) * (0.9 + 0.2 * shade[..., None]) * (1 - 0.18 * lit[..., None]) + np.array([90, 52, 18]) * rim[..., None]
    colour = colour * (1 - haze) + sky_low * haze
    img = img * (1 - mask[..., None]) + colour * mask[..., None]
# Brush texture: anisotropic noise, wide and short, then a gentle blur so edges read as paint.
brush = fbm(W, H, (14, 90), 2, 99) - 0.5
img += brush[..., None] * 12
im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.6))
arr = np.asarray(im).astype(float)
arr += rng.normal(0, 3.2, (H, W, 1))  # fine grain
Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save(__import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)), 'dunes-dusk.png'), optimize=True)
print('ok')
