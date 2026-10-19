# Dot-matrix map of the Gulf from Natural Earth 1:50m countries (public domain). Writes gulf-map.json:
# one SVG path of 2px square dots on land, plus each city's position, in a 1440x900 frame.
# Usage: python3 gulf-map.py <ne_50m_admin_0_countries.geojson>
import json, os, sys
import numpy as np
LON0, LON1, LAT0, LAT1 = 43.2, 60.6, 19.6, 31.4
W, H, STEP = 1440, 900, 9
def proj(lon, lat):
    return (lon - LON0) / (LON1 - LON0) * W, (LAT1 - lat) / (LAT1 - LAT0) * H
rings = []
for f in json.load(open(sys.argv[1]))['features']:
    g = f['geometry']; polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    for poly in polys:
        ring = np.array(poly[0])
        if ring[:, 0].max() < LON0 - 2 or ring[:, 0].min() > LON1 + 2 or ring[:, 1].max() < LAT0 - 2 or ring[:, 1].min() > LAT1 + 2: continue
        x, y = proj(ring[:, 0], ring[:, 1]); rings.append(np.stack([x, y], 1))
xs, ys = np.meshgrid(np.arange(STEP / 2, W, STEP), np.arange(STEP / 2, H, STEP))
px, py = xs.ravel(), ys.ravel(); inside = np.zeros(px.shape, bool)
for r in rings:
    x0, y0 = r[:-1, 0], r[:-1, 1]; x1, y1 = r[1:, 0], r[1:, 1]
    hit = np.zeros(px.shape, bool)
    for a, b, c, d in zip(x0, y0, x1, y1):
        cond = ((b > py) != (d > py)) & (px < (c - a) * (py - b) / (d - b + 1e-12) + a)
        hit ^= cond
    inside |= hit
cxy = np.array([proj(*c) for c in [(47.98, 29.37), (46.72, 24.71), (50.58, 26.23), (51.53, 25.29), (54.37, 24.45), (55.27, 25.20), (58.41, 23.59)]])
near = np.zeros(px.shape, bool)
for cx, cy in cxy: near |= (px - cx) ** 2 + (py - cy) ** 2 < 44 ** 2
sq = lambda m: ''.join(f'M{x - 1:.0f} {y - 1:.0f}h2v2h-2z' for x, y in zip(px[m], py[m]))
d, lit = sq(inside & ~near), sq(inside & near)
cities = {'Kuwait City': (47.98, 29.37), 'Riyadh': (46.72, 24.71), 'Manama': (50.58, 26.23), 'Doha': (51.53, 25.29), 'Abu Dhabi': (54.37, 24.45), 'Dubai': (55.27, 25.20), 'Muscat': (58.41, 23.59)}
out = {'w': W, 'h': H, 'dots': int(inside.sum()), 'path': d, 'lit': lit, 'cities': {k: [round(v, 1) for v in proj(*c)] for k, c in cities.items()}}
json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'gulf-map.json'), 'w'))
print(out['dots'], out['cities'])

# Optional second argument: a directory to also receive gulf-grid.json, the land grid packed as a bitset
# (row-major, most significant bit first, 1 = land) for the site's canvas map.
if len(sys.argv) > 2:
    import base64
    cols, rows = len(np.arange(STEP / 2, W, STEP)), len(np.arange(STEP / 2, H, STEP))
    bits = base64.b64encode(np.packbits(inside.astype(np.uint8)).tobytes()).decode()
    grid = {'cols': cols, 'rows': rows, 'step': STEP, 'w': W, 'h': H, 'dots': int(inside.sum()), 'bits': bits, 'cities': out['cities']}
    json.dump(grid, open(os.path.join(sys.argv[2], 'gulf-grid.json'), 'w'), separators=(',', ':'))
