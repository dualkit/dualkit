# Footer painting: the dusk dunes, grainy like a risograph, fading up into the warm ground. Run after dunes-dusk.py.
import os
import numpy as np
from PIL import Image
here = os.path.dirname(os.path.abspath(__file__))
src = Image.open(os.path.join(here, 'dunes-dusk.png')).convert('RGB')
W, H = 2880, 1200
im = src.resize((W, int(src.height * W / src.width)), Image.LANCZOS)
im = im.crop((0, im.height - H, W, im.height))
a = np.asarray(im).astype(float)
rng = np.random.default_rng(5)
# Coarse grain: 2px cells of mono noise, strong in the sky, softer in the dunes.
cell = rng.normal(0, 1, (H // 2, W // 2)).repeat(2, 0).repeat(2, 1)[:H, :W]
y = np.linspace(0, 1, H)[:, None]
a += cell[..., None] * (26 - 10 * y)[..., None]
a = np.clip(a, 0, 255)
# Fade the top into the ground (#efece4) with alpha, so the columns sit on warm paper.
alpha = np.clip((y - 0.08) / 0.5, 0, 1) ** 1.6
dither = (rng.random((H, W)) - 0.5) * 0.22
alpha = np.clip(alpha + dither * (alpha * (1 - alpha)) * 4, 0, 1)
rgba = np.dstack([a, np.broadcast_to(alpha * 255, (H, W))]).astype(np.uint8)
Image.fromarray(rgba, 'RGBA').save(os.path.join(here, 'dunes-footer.png'), optimize=True)
print('ok')
