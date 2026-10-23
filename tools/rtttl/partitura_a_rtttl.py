"""Partitura -> RTTTL para el bloque "Tocar RTTTL" de MPR Blockly (librería PlayRtttl).

Es la herramienta con que se hicieron las canciones de 31 Minutos (ver BITACORA.md,
2026-10-18), reunida en un solo archivo. Solo usa la biblioteca estándar de Python 3.

Comandos (python tools/rtttl/partitura_a_rtttl.py <comando> -h para ver las opciones):

  buscar "31 minutos"                  busca canciones en Songsterr (id y pistas)
  descargar 3869622 0 pista.json       baja la pista 0 de la canción 3869622
  ver pista.json [--desde 1 --hasta 12]
                                       muestra las notas por compás, numeradas
  convertir pista.json --compases 1-4,9-12 --nombre Anacleto
                                       genera el RTTTL de esos compases
  texto "sol4/8 la4/8 si4/4. p/8 do5/2" --bpm 100 --nombre Prueba
                                       genera el RTTTL de notas escritas a mano
  validar "<rtttl>"                    revisa que PlayRtttl lo toque bien
  wav "<rtttl>" prueba.wav             genera un .wav con sonido de zumbador

Songsterr no tiene una API pública: "buscar" y "descargar" usan la que usa su página
web y pueden dejar de funcionar. Las tablaturas pueden traer errores (o ser generadas
por IA, se avisa al descargar): conviene comparar las notas con otra fuente.
"""
import argparse
import gzip
import json
import math
import re
import struct
import sys
import urllib.parse
import urllib.request
import wave
from collections import Counter
from fractions import Fraction as F

# ------------------------------------------------------------------ notas y duraciones
NOMBRES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b']
SOLFEO = {'do': 0, 're': 2, 'mi': 4, 'fa': 5, 'sol': 7, 'la': 9, 'si': 11}
LETRA = {'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11}
# Octava 7 tal como la define PlayRtttl; las demás octavas se obtienen con >> como en la librería.
NOTA_OCT7 = [2093, 2217, 2349, 2489, 2637, 2794, 2960, 3136, 3322, 3520, 3729, 3951]
DURACIONES = (1, 2, 4, 8, 16, 32)
# Valores que RTTTL puede escribir (en redondas), de mayor a menor: 1/n y 1/n con punto.
REPRESENTABLES = sorted([(F(1, n), str(n), '') for n in DURACIONES] +
                        [(F(3, 2 * n), str(n), '.') for n in DURACIONES], key=lambda x: -x[0])


class ErrorRtttl(ValueError):
    pass


def nombre_midi(m):
    """60 -> 'C4'."""
    return NOMBRES[m % 12].upper() + str(m // 12 - 1)


def nombre_dur(f):
    for val, n, punto in REPRESENTABLES:
        if val == f:
            return n + punto
    return str(f)


def octava(m):
    return m // 12 - 1


# ------------------------------------------------------------------ validación (como PlayRtttl)
CABECERA_RE = re.compile(r'^([A-Za-z0-9]{1,10}):d=(\d+),o=(\d),b=(\d+):(.+)$')
NOTA_RE = re.compile(r'^(\d{1,2})?([a-gp])(#)?(\.)?([4-7])?$')


def parsear_rtttl(s):
    """Validador estricto. Devuelve dict(nombre, d, o, b, notas=[(midi|None, ms, token)])."""
    if any(c.isspace() for c in s):
        raise ErrorRtttl('tiene espacios')
    m = CABECERA_RE.match(s)
    if not m:
        raise ErrorRtttl('cabecera inválida: debe ser Nombre:d=..,o=..,b=..:notas '
                         '(nombre solo letras y números, máximo 10)')
    nombre, d, o, b, cuerpo = m.group(1), int(m.group(2)), int(m.group(3)), int(m.group(4)), m.group(5)
    if d not in DURACIONES:
        raise ErrorRtttl('d=%d inválido (1, 2, 4, 8, 16 o 32)' % d)
    if not 4 <= o <= 7:
        raise ErrorRtttl('o=%d fuera de 4..7' % o)
    if not 25 <= b <= 900:
        raise ErrorRtttl('b=%d fuera de rango' % b)
    redonda = (60 * 1000 // b) * 4  # misma aritmética entera que PlayRtttl
    notas = []
    for i, tok in enumerate(cuerpo.split(',')):
        nm = NOTA_RE.match(tok)
        if not nm:
            raise ErrorRtttl('nota %d mal formada: %r' % (i + 1, tok))
        dur_s, letra, sost, punto, oct_s = nm.groups()
        n = int(dur_s) if dur_s else d
        if n not in DURACIONES:
            raise ErrorRtttl('nota %d: duración %d inválida' % (i + 1, n))
        ms = redonda // n
        if punto:
            ms += ms // 2
        if letra == 'p':
            if sost or oct_s:
                raise ErrorRtttl('nota %d: silencio con # u octava: %r' % (i + 1, tok))
            notas.append((None, ms, tok))
            continue
        if sost and letra in ('e', 'b'):
            raise ErrorRtttl('nota %d: %s# no existe en RTTTL (usar %s)' % (i + 1, letra, 'f' if letra == 'e' else 'c'))
        oc = int(oct_s) if oct_s else o
        notas.append(((oc + 1) * 12 + LETRA[letra] + (1 if sost else 0), ms, tok))
    return dict(nombre=nombre, d=d, o=o, b=b, notas=notas)


def frecuencia(midi):
    return NOTA_OCT7[midi % 12] >> (7 - octava(midi))


def resumen(s):
    p = parsear_rtttl(s)
    con_altura = [n[0] for n in p['notas'] if n[0] is not None]
    if not con_altura:
        raise ErrorRtttl('no tiene notas, solo silencios')
    bajo, alto = min(con_altura), max(con_altura)
    return ('%s: %.1f s, %d notas y %d silencios, de %s (%d Hz) a %s (%d Hz), %d caracteres'
            % (p['nombre'], sum(n[1] for n in p['notas']) / 1000.0, len(con_altura),
               len(p['notas']) - len(con_altura), nombre_midi(bajo), frecuencia(bajo),
               nombre_midi(alto), frecuencia(alto), len(s)))


# ------------------------------------------------------------------ eventos -> RTTTL
def _silencios(dur):
    out = []
    while dur > 0:
        for val, n, punto in REPRESENTABLES:
            if val <= dur and not punto:
                out.append((None, n, ''))
                dur -= val
                break
        else:
            raise ErrorRtttl('silencio demasiado corto para RTTTL: %s de redonda' % dur)
    return out


def a_rtttl(nombre, eventos, bpm, transponer=0):
    """eventos: lista de (midi|None, duración en redondas como Fraction).
    Una nota que RTTTL no puede escribir (p. ej. tresillos) se acorta al valor
    escribible más cercano por debajo y el sobrante pasa a silencio: el pulso no cambia."""
    toks = []
    silencio = F(0)
    for midi, dur in eventos:
        if midi is None:
            silencio += dur
            continue
        if silencio:
            toks += _silencios(silencio)
            silencio = F(0)
        for val, n, punto in REPRESENTABLES:
            if val <= dur:
                break
        else:
            raise ErrorRtttl('nota %s demasiado corta para RTTTL' % nombre_midi(midi))
        toks.append((midi + transponer, n, punto))
        silencio += dur - val
    while toks and toks[0][0] is None:
        toks.pop(0)
    if not toks:
        raise ErrorRtttl('la selección no tiene notas')
    for m, n, punto in toks:
        if m is not None and not 4 <= octava(m) <= 7:
            raise ErrorRtttl('%s queda fuera de las octavas 4 a 7: usar --transponer' % nombre_midi(m))
    d = int(Counter(n for m, n, punto in toks).most_common(1)[0][0])
    o = Counter(octava(m) for m, n, punto in toks if m is not None).most_common(1)[0][0]
    partes = []
    for m, n, punto in toks:
        dur_s = '' if int(n) == d else n
        if m is None:
            partes.append(dur_s + 'p' + punto)
        else:
            partes.append(dur_s + NOMBRES[m % 12] + punto + ('' if octava(m) == o else str(octava(m))))
    return '%s:d=%d,o=%d,b=%d:%s' % (nombre, d, o, bpm, ','.join(partes))


def transposicion_auto(eventos):
    """Octavas a subir o bajar para que la melodía quede en 4..7, centrada en 5-6
    (lo que mejor suena en el zumbador)."""
    alturas = [m for m, d in eventos if m is not None]
    if not alturas:
        return 0
    mejor = None
    for k in range(-5, 6):
        bajo, alto = octava(min(alturas) + 12 * k), octava(max(alturas) + 12 * k)
        if bajo < 4 or alto > 7:
            continue
        en_5_6 = sum(1 for m in alturas if octava(m + 12 * k) in (5, 6))
        if mejor is None or en_5_6 > mejor[0]:
            mejor = (en_5_6, 12 * k)
    if mejor is None:
        raise ErrorRtttl('la melodía abarca más de 4 octavas; no cabe en RTTTL')
    return mejor[1]


# ------------------------------------------------------------------ Songsterr
API = 'https://www.songsterr.com/api'
PISTAS = 'https://dqsljvtekg760.cloudfront.net'


def _bajar(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Accept-Encoding': 'gzip'})
    with urllib.request.urlopen(req, timeout=30) as r:
        datos = r.read()
    return gzip.decompress(datos) if datos[:2] == b'\x1f\x8b' else datos


def cargar_pista(ruta):
    with open(ruta, 'rb') as f:
        datos = f.read()
    if datos[:2] == b'\x1f\x8b':
        datos = gzip.decompress(datos)
    return json.loads(datos.decode('utf-8'))


def segmentos_por_compas(pista, voz=0):
    """Por compás: lista de dict(midi|None, dur, ligada). Altura = afinación de la cuerda +
    traste; en acordes se toma la nota más aguda (la melodía)."""
    afinacion = pista['tuning']
    ultima_en_cuerda = {}
    out = []
    for compas in pista['measures']:
        segs = []
        voces = compas.get('voices', [])
        for b in (voces[voz]['beats'] if voz < len(voces) else []):
            seg = dict(midi=None, dur=F(b['duration'][0], b['duration'][1]), ligada=False)
            notas = [n for n in b.get('notes', []) if not n.get('rest') and not n.get('dead')]
            if notas and not b.get('rest'):
                alturas = []
                for n in notas:
                    if n.get('tie') and n['string'] in ultima_en_cuerda:
                        alturas.append(ultima_en_cuerda[n['string']])
                    else:
                        alturas.append(afinacion[n['string']] + n.get('fret', 0))
                for n, a in zip(notas, alturas):
                    ultima_en_cuerda[n['string']] = a
                seg['midi'] = max(alturas)
                seg['ligada'] = all(n.get('tie') for n in notas)
            segs.append(seg)
        out.append(segs)
    return out


def tempo_inicial(pista):
    for t in pista.get('automations', {}).get('tempo', []) or []:
        if t.get('bpm'):
            return int(t['bpm'])
    return 120


def lista_compases(texto, total):
    """'1-4,9-12,9-12' -> [1,2,3,4,9,...]. Se pueden repetir compases."""
    out = []
    for parte in texto.replace(' ', '').split(','):
        a, _, b = parte.partition('-')
        a, b = int(a), int(b or a)
        if not (1 <= a <= b <= total):
            raise ErrorRtttl('compases %s fuera de 1..%d' % (parte, total))
        out += range(a, b + 1)
    return out


def seleccionar(segs, compases, correcciones):
    """Une las notas ligadas y aplica correcciones {(compás, posición 1..n): midi}."""
    out = []
    previo = None
    for c in compases:
        seguido = previo is not None and c == previo + 1
        for k, s in enumerate(segs[c - 1], 1):
            midi = correcciones.get((c, k), s['midi'])
            if (s['ligada'] and out and out[-1][0] is not None and out[-1][0] == midi
                    and (k > 1 or seguido)):
                out[-1][1] += s['dur']
                continue
            out.append([midi, s['dur']])
        previo = c
    return [tuple(e) for e in out]


# ------------------------------------------------------------------ notas escritas a mano
NOTA_TEXTO_RE = re.compile(r'^(do|re|mi|fa|sol|la|si|[a-g])([#b]?)(\d)$', re.I)


def leer_nota(txt):
    """'C#5', 'sol4', 'sib4', 'p' o 'r' (silencio) -> midi|None."""
    t = txt.lower()
    if t in ('p', 'r', 's', '-'):
        return None
    m = NOTA_TEXTO_RE.match(t)
    if not m:
        raise ErrorRtttl('nota no reconocida: %r (ejemplos: C5, F#4, sol4, sib4, p)' % txt)
    base, alt, oc = m.groups()
    semi = SOLFEO[base] if base in SOLFEO else LETRA[base]
    semi += {'#': 1, 'b': -1}.get(alt, 0)
    return (int(oc) + 1) * 12 + semi


def leer_texto(texto):
    """'sol4/8 la4/8 si4/4. p/8' -> eventos. Duración: 1,2,4,8,16,32 con '.' opcional;
    sin duración = negra. 'nota/4+8' suma duraciones (nota ligada)."""
    eventos = []
    for tok in texto.replace(',', ' ').split():
        nota, _, dur = tok.partition('/')
        total = F(0)
        for d in (dur or '4').split('+'):
            punto = d.endswith('.')
            n = int(d.rstrip('.'))
            if n not in DURACIONES:
                raise ErrorRtttl('duración %r inválida en %r' % (d, tok))
            total += F(3, 2 * n) if punto else F(1, n)
        eventos.append((leer_nota(nota), total))
    return eventos


# ------------------------------------------------------------------ sonido
def generar_wav(s, ruta, tasa=22050):
    """Onda cuadrada como el zumbador; cada nota suena 15/16 de su duración (estilo
    'natural' de PlayRtttl) para que se distingan las notas repetidas."""
    p = parsear_rtttl(s)
    muestras = bytearray()
    for midi, ms, tok in p['notas']:
        total = tasa * ms // 1000
        suena = 0 if midi is None else tasa * (ms - (ms + 8) // 16) // 1000
        f = frecuencia(midi) if midi is not None else 0
        for i in range(total):
            muestras.append(128 + (40 if i < suena and math.sin(2 * math.pi * f * i / tasa) >= 0 else -40 if i < suena else 0))
    with wave.open(ruta, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(1)
        w.setframerate(tasa)
        w.writeframes(bytes(muestras))


# ------------------------------------------------------------------ comandos
def nombre_valido(nombre):
    limpio = re.sub(r'[^A-Za-z0-9]', '', nombre)[:10]
    if not limpio:
        raise ErrorRtttl('el nombre debe tener letras o números')
    return limpio


def cmd_buscar(a):
    url = API + '/songs?size=50&pattern=' + urllib.parse.quote(a.texto)
    for c in json.loads(_bajar(url).decode('utf-8')):
        pistas = ' | '.join('%d: %s' % (i, t.get('name') or t.get('instrument'))
                            for i, t in enumerate(c.get('tracks', [])))
        print('%s  %s - %s\n    pistas: %s' % (c['songId'], c.get('artist'), c.get('title'), pistas))


def cmd_descargar(a):
    meta = json.loads(_bajar('%s/meta/%d' % (API, a.cancion)).decode('utf-8'))
    pistas = meta.get('tracks', [])
    if not 0 <= a.pista < len(pistas):
        raise ErrorRtttl('la canción tiene pistas 0..%d' % (len(pistas) - 1))
    datos = _bajar('%s/%d/%s/%s/%d.json' % (PISTAS, a.cancion, meta['revisionId'], meta['image'], a.pista))
    with open(a.salida, 'wb') as f:
        f.write(datos)
    print('%s - %s, pista %d (%s) -> %s' % (meta.get('artist'), meta.get('title'), a.pista,
                                           pistas[a.pista].get('name'), a.salida))
    if meta.get('aiGenerated'):
        print('AVISO: esta tablatura fue generada por IA; comparar las notas con otra fuente.')


def cmd_ver(a):
    pista = cargar_pista(a.pista)
    print('# %s | %s | tempo %d BPM' % (pista.get('name'), pista.get('instrument'), tempo_inicial(pista)))
    print('# nota/duración (4 = negra, 8 = corchea, "." = con punto, ~ = ligada a la anterior)')
    segs = segmentos_por_compas(pista, a.voz)
    for c in range(max(a.desde, 1), min(a.hasta, len(segs)) + 1):
        notas = ['%d:%s/%s%s' % (k, nombre_midi(s['midi']) if s['midi'] is not None else 'p',
                                 nombre_dur(s['dur']), '~' if s['ligada'] else '')
                 for k, s in enumerate(segs[c - 1], 1)]
        print('compás %3d: %s' % (c, ' '.join(notas)))


def _terminar(nombre, eventos, bpm, transponer, wav):
    if transponer == 'auto':
        transponer = transposicion_auto(eventos)
        if transponer:
            print('# transpuesta %+d octava(s) para que suene bien en el zumbador' % (transponer // 12))
    s = a_rtttl(nombre_valido(nombre), eventos, bpm, int(transponer))
    print('# ' + resumen(s))
    print(s)
    if wav:
        generar_wav(s, wav)
        print('# sonido guardado en ' + wav)


def cmd_convertir(a):
    pista = cargar_pista(a.pista)
    segs = segmentos_por_compas(pista, a.voz)
    correcciones = {}
    for c in a.corregir or []:
        m = re.match(r'^(\d+)\.(\d+)=(.+)$', c)
        if not m:
            raise ErrorRtttl('--corregir usa compás.posición=nota, por ejemplo 11.6=B6')
        correcciones[(int(m.group(1)), int(m.group(2)))] = leer_nota(m.group(3))
    eventos = seleccionar(segs, lista_compases(a.compases, len(segs)), correcciones)
    eventos = ajustar_final(eventos, a.quitar_final, a.ultima)
    _terminar(a.nombre, eventos, a.bpm or tempo_inicial(pista), a.transponer, a.wav)


def ajustar_final(eventos, quitar, ultima):
    """Quita las últimas 'quitar' notas (y silencios) y cambia la duración de la última nota."""
    eventos = list(eventos)
    for _ in range(quitar + 1):
        while eventos and eventos[-1][0] is None:
            eventos.pop()
        if _ < quitar and eventos:
            eventos.pop()
    if ultima and eventos:
        eventos[-1] = (eventos[-1][0], leer_texto('p/' + ultima)[0][1])
    return eventos


def cmd_texto(a):
    _terminar(a.nombre, leer_texto(a.notas), a.bpm, a.transponer, a.wav)


def cmd_validar(a):
    print(resumen(a.rtttl))
    print('OK: PlayRtttl la puede tocar')


def cmd_wav(a):
    generar_wav(a.rtttl, a.salida)
    print(resumen(a.rtttl))
    print('sonido guardado en ' + a.salida)


def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='comando', required=True)

    p = sub.add_parser('buscar', help='buscar canciones en Songsterr')
    p.add_argument('texto')
    p.set_defaults(f=cmd_buscar)

    p = sub.add_parser('descargar', help='bajar una pista de Songsterr a un .json')
    p.add_argument('cancion', type=int, help='id de la canción (lo muestra "buscar")')
    p.add_argument('pista', type=int, help='número de pista (0 = la primera)')
    p.add_argument('salida', help='archivo .json donde guardarla')
    p.set_defaults(f=cmd_descargar)

    p = sub.add_parser('ver', help='mostrar las notas de una pista por compás')
    p.add_argument('pista')
    p.add_argument('--desde', type=int, default=1)
    p.add_argument('--hasta', type=int, default=10 ** 6)
    p.add_argument('--voz', type=int, default=0)
    p.set_defaults(f=cmd_ver)

    def comunes(p):
        p.add_argument('--nombre', required=True, help='nombre de la melodía (máx. 10 letras/números)')
        p.add_argument('--transponer', default='auto',
                       help='semitonos a subir (12 = una octava) o "auto" (por defecto)')
        p.add_argument('--wav', help='además guardar el sonido en este .wav')

    p = sub.add_parser('convertir', help='compases de una pista -> RTTTL')
    p.add_argument('pista')
    p.add_argument('--compases', required=True, help='ej. 1-4,9-12 (se pueden repetir: 9-16,9-16)')
    p.add_argument('--bpm', type=int, help='tempo (por defecto el de la pista)')
    p.add_argument('--voz', type=int, default=0)
    p.add_argument('--corregir', action='append',
                   help='cambiar una nota: compás.posición=nota (posición como la muestra "ver"), ej. 11.6=B6')
    p.add_argument('--quitar-final', type=int, default=0, help='quitar las últimas N notas de la selección')
    p.add_argument('--ultima', help='nueva duración de la última nota, ej. 2 (blanca) o 4.')
    comunes(p)
    p.set_defaults(f=cmd_convertir)

    p = sub.add_parser('texto', help='notas escritas a mano -> RTTTL')
    p.add_argument('notas', help='ej. "sol4/8 la4/8 si4/4. p/8 do5/2" (C5 o do5; p = silencio)')
    p.add_argument('--bpm', type=int, required=True)
    comunes(p)
    p.set_defaults(f=cmd_texto)

    p = sub.add_parser('validar', help='revisar un RTTTL')
    p.add_argument('rtttl')
    p.set_defaults(f=cmd_validar)

    p = sub.add_parser('wav', help='escuchar un RTTTL (genera .wav)')
    p.add_argument('rtttl')
    p.add_argument('salida')
    p.set_defaults(f=cmd_wav)

    a = ap.parse_args()
    try:
        a.f(a)
    except ErrorRtttl as e:
        sys.exit('ERROR: %s' % e)


if __name__ == '__main__':
    main()
