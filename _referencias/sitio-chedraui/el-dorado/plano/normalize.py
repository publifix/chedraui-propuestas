# Normaliza el plano oficial de planta baja de El Dorado (sitio de Inmobiliaria Chedraui) al
# Extracción de formas: node shapes.cjs <svg sin imagen> shapes.json (Playwright: cajas en coordenadas del SVG).
# contrato de CLAUDE.md §7.1.2. Uso: python normalize.py oficial.svg shapes.json salida.svg
import json, re, sys
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

src, shapes_json, out = sys.argv[1:4]
svg = open(src).read()
shapes = json.load(open(shapes_json))
S = 2  # escala: el original mide 960 de ancho; el visor está calibrado para ~1800

# Índice de forma (orden del documento) → clave según la etiqueta visual del plano oficial.
CLAVES = {
  1: 'A1+A2', 5: 'C1+C2', 7: 'C3+D1', 9: 'C4-C6+D2', 11: 'C7+D3', 13: 'C8', 15: 'C9', 17: 'C12+C13',
  19: 'D5', 29: 'A5+A6', 31: 'A3+A4', 33: 'A7+A8', 35: 'SA1A', 37: 'SA1B', 39: 'SA1C', 41: 'SA1D',
  43: 'A14+A15', 45: 'A18', 47: 'A16+A17', 49: 'A25+A26', 51: 'A24', 53: 'A23', 55: 'A19', 57: 'A20',
  59: 'A22', 61: 'A21', 63: 'B5-B8+B14-B15', 65: 'B16', 67: 'B9-B13', 71: 'C23', 73: 'D11', 77: 'D6',
  79: 'C17', 81: 'C18+D8', 83: 'D9+D10+C22', 85: 'C21', 87: 'C20', 89: 'C19', 103: 'C11',
  105: 'C10+D4', 109: 'C14+C15+C16+D7', 111: 'B1-B4+B17-B21',
}
ANCLAS = {3: ('liverpool', 'Liverpool'), 69: ('chedraui-selecto', 'Chedraui Selecto')}

# Elementos de forma fuera de <defs>/<clipPath>, en el mismo orden que shapes.json.
body = re.sub(r'<defs>[\s\S]*?</defs>', '', svg)
body = re.sub(r'<clipPath[\s\S]*?</clipPath>', '', body)
body = re.sub(r'<image[\s\S]*?(/>|</image>)', '', body)
elems = re.findall(r'<(rect|path|polygon|ellipse|text|polyline|line)\b([^>]*)>', body)
assert len(elems) == len([s for s in shapes if s['tag'] != 'image']), (len(elems), len(shapes))
geo = [s for s in shapes if s['tag'] != 'image']

def attrs(a):
  return dict(re.findall(r'([\w:-]+)="([^"]*)"', a))

def path_points(d):
  """Vértices de un path (las curvas del original son tramos rectos: se toman sus extremos)."""
  toks = re.findall(r'[MmLlHhVvCcSsZz]|-?\d*\.?\d+(?:e-?\d+)?', d)
  pts, i, x, y, cmd = [], 0, 0.0, 0.0, None
  def num():
    nonlocal i
    v = float(toks[i]); i += 1; return v
  while i < len(toks):
    if re.match(r'[A-Za-z]', toks[i]): cmd = toks[i]; i += 1
    if cmd in 'Zz': continue
    if cmd in 'Mm': dx, dy = num(), num(); x, y = (x + dx, y + dy) if cmd == 'm' else (dx, dy); cmd = 'l' if cmd == 'm' else 'L'
    elif cmd in 'Ll': dx, dy = num(), num(); x, y = (x + dx, y + dy) if cmd == 'l' else (dx, dy)
    elif cmd in 'Hh': v = num(); x = x + v if cmd == 'h' else v
    elif cmd in 'Vv': v = num(); y = y + v if cmd == 'v' else v
    elif cmd in 'Cc':
      vals = [num() for _ in range(6)]; x, y = (x + vals[4], y + vals[5]) if cmd == 'c' else (vals[4], vals[5])
    elif cmd in 'Ss':
      vals = [num() for _ in range(4)]; x, y = (x + vals[2], y + vals[3]) if cmd == 's' else (vals[2], vals[3])
    pts.append((x, y))
  return pts

def polygon_of(tag, a):
  a = attrs(a)
  if tag == 'rect':
    x, y, w, h = (float(a.get(k, 0)) for k in ('x', 'y', 'width', 'height'))
    return Polygon([(x, y), (x + w, y), (x + w, y + h), (x, y + h)])
  if tag == 'polygon':
    n = [float(v) for v in re.findall(r'-?\d*\.?\d+', a['points'])]
    return Polygon(list(zip(n[::2], n[1::2])))
  if tag == 'path':
    return Polygon(path_points(a['d']))
  return None

locales, anclas, franjas = {}, {}, []
for i, ((tag, a), g) in enumerate(zip(elems, geo)):
  idx = g['i']
  cls = g['cls']
  if cls == 'st1' and idx in CLAVES: locales[CLAVES[idx]] = polygon_of(tag, a)
  elif idx in ANCLAS: anclas[idx] = polygon_of(tag, a)
  elif cls == 'st5': franjas.append(polygon_of(tag, a))
assert len(locales) == len(CLAVES), sorted(set(CLAVES.values()) - set(locales))

def fmt(poly):
  poly = poly.simplify(0.05)
  coords = list(poly.exterior.coords)[:-1]
  return ' '.join(f'{x * S:.1f},{y * S:.1f}' for x, y in coords)

def local_id(clave):
  return 'local-' + re.sub(r'^-|-$', '', re.sub(r'[^a-z0-9]+', '-', clave.lower()))

edificios = list(locales.values()) + list(anclas.values()) + franjas
union = unary_union(edificios)
# Contorno: los edificios unidos y los pasillos entre ellos cerrados (cierre morfológico).
contorno = union.buffer(14, join_style=2).buffer(-10, join_style=2)
contorno = max(contorno.geoms, key=lambda g: g.area) if contorno.geom_type == 'MultiPolygon' else contorno
pasillos = contorno.difference(union)
pasillos = [g for g in (pasillos.geoms if hasattr(pasillos, 'geoms') else [pasillos]) if g.area > 30]

# Formas simples, ubicadas según la imagen de fondo del plano oficial (aproximadas).
est_norte = Polygon([(32, 72), (615, 72), (615, 146), (520, 146), (500, 180), (490, 146), (32, 146)])
est_oriente = Polygon([(740, 72), (935, 72), (935, 215), (890, 204), (733, 111)])
marina = box(135, 374, 760, 440)
for nombre, g in [('norte', est_norte), ('oriente', est_oriente), ('marina', marina)]:
  inter = g.intersection(union.buffer(-0.5))
  assert inter.area < 1, f'{nombre} invade un edificio: {inter.bounds}'

accesos = [
  ('acceso-poniente', 'Acceso poniente', 314, 150),
  ('acceso-norte', 'Acceso norte', 509, 172),
  ('acceso-oriente', 'Acceso oriente', 604, 262),
  ('acceso-marina', 'Acceso marina', 421, 357),
]
# Ruta del A25+A26: del estacionamiento norte, por el acceso norte, a su fachada poniente.
ruta = [(505, 140), (509, 172), (518, 200), (529, 204)]

L = []
w = L.append
minx, miny, maxx, maxy = unary_union(edificios + [est_norte, est_oriente, marina]).bounds
pad = 10
vb = (minx - pad) * S, (miny - pad) * S, (maxx - minx + 2 * pad) * S, (maxy - miny + 2 * pad) * S
w(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb[0]:.0f} {vb[1]:.0f} {vb[2]:.0f} {vb[3]:.0f}">')
w('  <title>El Dorado · Planta baja (plano esquemático, no a escala)</title>')
w('  <desc>Normalizado del plano oficial de planta baja del sitio de Inmobiliaria Chedraui: geometría de locales, anclas y terrazas del original; estacionamientos, marina y accesos como formas simples aproximadas. Sin textos: el visor rotula desde la configuración.</desc>')
w('  <g id="marina">')
w(f'    <polygon data-nombre="Marina" points="{fmt(marina)}"/>')
w('  </g>')
w('  <g id="estacionamiento">')
w(f'    <polygon id="estacionamiento-norte" data-nombre="Estacionamiento norte" points="{fmt(est_norte)}"/>')
w(f'    <polygon id="estacionamiento-oriente" data-nombre="Estacionamiento oriente" points="{fmt(est_oriente)}"/>')
w('  </g>')
w('  <g id="contorno">')
w(f'    <polygon points="{fmt(contorno)}"/>')
w('  </g>')
w('  <g id="pasillos">')
for g in pasillos: w(f'    <polygon points="{fmt(g)}"/>')
for g in franjas: w(f'    <polygon data-nombre="Terraza" points="{fmt(g)}"/>')
w('  </g>')
w('  <g id="anclas">')
for idx, (slug, marca) in ANCLAS.items():
  w(f'    <polygon id="ancla-{slug}" data-marca="{marca}" points="{fmt(anclas[idx])}"/>')
w('  </g>')
w('  <g id="locales">')
for clave, poly in sorted(locales.items(), key=lambda kv: (kv[1].bounds[1] > 270, kv[1].bounds[0])):
  w(f'    <polygon id="{local_id(clave)}" data-clave="{clave}" points="{fmt(poly)}"/>')
w('  </g>')
w('  <g id="accesos">')
for id_, nombre, x, y in accesos: w(f'    <circle id="{id_}" data-nombre="{nombre}" cx="{x * S}" cy="{y * S}" r="6"/>')
w('  </g>')
w('  <g id="rutas">')
d = 'M' + ' L'.join(f'{x * S},{y * S}' for x, y in ruta)
w(f'    <path id="ruta-estacionamiento-norte-a25-a26" data-desde="estacionamiento-norte" data-hasta="A25+A26" d="{d}"/>')
w('  </g>')
w('  <g id="etiquetas">')
w(f'    <text x="{vb[0] + 16:.0f}" y="{vb[1] + vb[3] - 14:.0f}" data-leyenda="">Plano esquemático, no a escala</text>')
w('  </g>')
w('</svg>')
open(out, 'w').write('\n'.join(L) + '\n')
print('locales', len(locales), 'pasillos', len(pasillos), 'franjas', len(franjas), 'viewBox', [round(v) for v in vb])
