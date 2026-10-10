"""
Baut aus der Thünen-Kulisse organischer Böden (2023) Vektorkacheln für Paludio.

Quelle:  Wittnebel, Frank, Tiemeyer (2023): Aktualisierte Kulisse organischer Böden in Deutschland.
         Thünen Working Paper 212, DOI 10.3220/WP1683180852000; Daten DOI 10.3220/DATA20230510130443-0
Lizenz:  CC BY 4.0
Dienst:  WFS des Thünen-Atlas (GeoServer), Layer geonode:ti_kulisse_kat_final_v10

Ablauf: Polygone je Bundesland seitenweise laden (EPSG:4326), Linien mit Douglas-Peucker auf ca. 2 m
vereinfachen, an einem Kachelgitter (0,1° × 0,15°, ca. 11 × 11 km) zuschneiden, Koordinaten auf 1e-5°
quantisieren und je Kachel delta-/varint-kodiert als gzip ablegen.

Aufruf:  python scripts/build_kulisse.py public/data/kulisse [bw,by,…]
"""
import gzip
import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request
from collections import defaultdict

WFS = 'https://atlas.thuenen.de/geoserver/ows'
LAYER = 'geonode:ti_kulisse_kat_final_v10'
LAENDER = ['bw', 'by', 'be', 'bb', 'hb', 'hh', 'he', 'mv', 'ni', 'nw', 'rp', 'sl', 'sn', 'st', 'sh', 'th']
PAGE = 10000

TILE_LAT, TILE_LON = 0.1, 0.15
Q = 1e5            # Quantisierung: 1e-5 Grad
TOL_M = 2.0        # Vereinfachungstoleranz in Metern

CATS = {
    'Niedermoorboden': 1, 'Hochmoorboden': 2, 'Moorfolgeboden': 3,
    'flach ueberdeckter Niedermoorboden': 4, 'flach ueberdeckter Hochmoorboden': 5,
    'maechtig ueberdeckter Niedermoorboden': 6, 'maechtig ueberdeckter Hochmoorboden': 7,
    'Tiefumbruchboden aus Niedermoor': 8, 'Tiefumbruchboden aus Hochmoor': 9,
}
TMS = {'TM0': 1, 'TM1': 2, 'TM2': 3, 'TM3': 4, 'TM4': 5, 'TM5': 6, 'TMX': 7}


def fetch_page(bl, start):
    params = {
        'service': 'WFS', 'version': '2.0.0', 'request': 'GetFeature', 'typeNames': LAYER,
        'outputFormat': 'application/json', 'srsName': 'EPSG:4326', 'propertyName': 'the_geom,KAT_LANG,TORFMAECHT',
        'CQL_FILTER': f"BL='{bl}'", 'sortBy': 'fid', 'count': str(PAGE), 'startIndex': str(start),
    }
    url = WFS + '?' + urllib.parse.urlencode(params)
    for attempt in range(5):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Paludio-Datenaufbereitung'})
            return json.loads(urllib.request.urlopen(req, timeout=600).read())
        except Exception as err:  # noqa: BLE001
            print('   Wiederholung wegen', err, flush=True)
            time.sleep(10 * (attempt + 1))
    raise RuntimeError(f'WFS nicht erreichbar ({bl}, {start})')


def simplify(ring, tol_lat, tol_lon):
    """Douglas-Peucker (iterativ) in lokal skalierten Koordinaten."""
    n = len(ring)
    if n <= 4:
        return ring
    keep = [False] * n
    keep[0] = keep[-1] = True
    stack = [(0, n - 1)]
    while stack:
        a, b = stack.pop()
        if b <= a + 1:
            continue
        ax, ay = ring[a][0] / tol_lon, ring[a][1] / tol_lat
        bx, by = ring[b][0] / tol_lon, ring[b][1] / tol_lat
        dx, dy = bx - ax, by - ay
        den = math.hypot(dx, dy)
        best, idx = 0.0, -1
        for i in range(a + 1, b):
            px, py = ring[i][0] / tol_lon, ring[i][1] / tol_lat
            d = abs(dy * (px - ax) - dx * (py - ay)) / den if den else math.hypot(px - ax, py - ay)
            if d > best:
                best, idx = d, i
        if best > 1.0:
            keep[idx] = True
            stack.append((a, idx))
            stack.append((idx, b))
    out = [p for p, k in zip(ring, keep) if k]
    return out if len(out) >= 4 else ring


def clip(ring, xmin, ymin, xmax, ymax):
    """Sutherland-Hodgman an einem Rechteck (x = Länge, y = Breite)."""
    def run(pts, inside, inter):
        out = []
        for i in range(len(pts)):
            cur, prev = pts[i], pts[i - 1]
            if inside(cur):
                if not inside(prev):
                    out.append(inter(prev, cur))
                out.append(cur)
            elif inside(prev):
                out.append(inter(prev, cur))
        return out

    def ix(x):
        return lambda p, q: (x, p[1] + (q[1] - p[1]) * (x - p[0]) / (q[0] - p[0]))

    def iy(y):
        return lambda p, q: (p[0] + (q[0] - p[0]) * (y - p[1]) / (q[1] - p[1]), y)

    pts = ring
    for inside, inter in (
        (lambda p: p[0] >= xmin, ix(xmin)), (lambda p: p[0] <= xmax, ix(xmax)),
        (lambda p: p[1] >= ymin, iy(ymin)), (lambda p: p[1] <= ymax, iy(ymax)),
    ):
        if not pts:
            break
        pts = run(pts, inside, inter)
    return pts


def varint(n, out):
    while n >= 0x80:
        out.append((n & 0x7F) | 0x80)
        n >>= 7
    out.append(n)


def zz(n):
    return (n << 1) ^ (n >> 63)


def main(out_dir, laender=LAENDER):
    os.makedirs(out_dir, exist_ok=True)
    tiles = defaultdict(list)   # key -> [(code, [ring, ...])]
    total = 0
    for bl in laender:
        start = 0
        while True:
            page = fetch_page(bl, start)
            feats = page.get('features', [])
            print(f'{bl}: {start + len(feats)} Flächen', flush=True)
            for f in feats:
                p = f['properties']
                code = CATS.get(p.get('KAT_LANG'), 0) * 8 + TMS.get(p.get('TORFMAECHT'), 7)
                if code < 8 or not f.get('geometry'):
                    continue
                g = f['geometry']
                polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
                for poly in polys:
                    lat_mid = poly[0][0][1]
                    tol_lat = TOL_M / 111_200
                    tol_lon = TOL_M / (111_200 * math.cos(math.radians(lat_mid)))
                    rings = [simplify([(c[0], c[1]) for c in r], tol_lat, tol_lon) for r in poly]
                    xs = [c[0] for c in rings[0]]
                    ys = [c[1] for c in rings[0]]
                    for i in range(math.floor(min(ys) / TILE_LAT), math.floor(max(ys) / TILE_LAT) + 1):
                        for j in range(math.floor(min(xs) / TILE_LON), math.floor(max(xs) / TILE_LON) + 1):
                            x0, y0 = j * TILE_LON, i * TILE_LAT
                            cut = [clip(r, x0, y0, x0 + TILE_LON, y0 + TILE_LAT) for r in rings]
                            cut = [r for r in cut if len(r) >= 3]
                            if cut and len(cut[0]) >= 3:
                                tiles[f'{i}_{j}'].append((code, cut))
                total += 1
            if len(feats) < PAGE:
                break
            start += PAGE

    size = 0
    for key, polys in tiles.items():
        i, j = map(int, key.split('_'))
        ox, oy = round(j * TILE_LON * Q), round(i * TILE_LAT * Q)
        out = bytearray(b'KV1')
        varint(len(polys), out)
        for code, rings in polys:
            out.append(code)
            varint(len(rings), out)
            for r in rings:
                pts = []
                for x, y in r:
                    q = (round(x * Q), round(y * Q))
                    if not pts or q != pts[-1]:
                        pts.append(q)
                varint(len(pts), out)
                px, py = ox, oy
                for x, y in pts:
                    varint(zz(x - px), out)
                    varint(zz(y - py), out)
                    px, py = x, y
        data = gzip.compress(bytes(out), 9)
        with open(os.path.join(out_dir, f'{key}.bin.gz'), 'wb') as fh:
            fh.write(data)
        size += len(data)
    with open(os.path.join(out_dir, 'index.json'), 'w', encoding='utf-8') as fh:
        json.dump({'tileLat': TILE_LAT, 'tileLon': TILE_LON, 'q': Q, 'tiles': sorted(tiles)}, fh)
    print(f'Fertig: {total} Polygone, {len(tiles)} Kacheln, {size / 1048576:.1f} MB')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2].split(',') if len(sys.argv) > 2 else LAENDER)
