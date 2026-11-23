#!/usr/bin/env python3
"""Copia los cambios del repositorio a la app instalada para probarlos al tiro.

Sirve para cambios de interfaz, bloques, textos, ejemplos o librería Otto: no hace
falta generar un instalador nuevo. Después de ejecutarlo:
  - cambios en www/ (bloques, textos, ejemplos, CSS) -> presionar F5 en MPR Blockly
  - cambios en electronApp.js -> cerrar y volver a abrir MPR Blockly
  - cambios en la librería Otto -> se usan en la próxima compilación

Uso:
    python tools/probar.py                 (instalación en C:\\MPRBlockly)
    python tools/probar.py --destino D:\\MPRBlockly
    python tools/probar.py --simular       (muestra qué copiaría, sin copiar)

La carpeta instalada solo es modificable por administradores: si hace falta, el
script pide permiso (ventana de Windows) y se vuelve a ejecutar como administrador.
"""
import argparse
import filecmp
import os
import shutil
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# (origen en el repo, destino dentro de la instalación)
MAPEO = [
    ("www", "www"),
    ("compilation/arduino/userlibs", "compilation/arduino/userlibs"),
    ("compilation/arduino/arduino-cli.yaml", "compilation/arduino/arduino-cli.yaml"),
    ("electronApp.js", "resources/app/electronApp.js"),
    ("index.js", "resources/app/index.js"),
    ("factory.js", "resources/app/factory.js"),
    ("term.js", "resources/app/term.js"),
]


def archivos(origen):
    if os.path.isfile(origen):
        yield origen, ""
        return
    for d, _, fs in os.walk(origen):
        for f in fs:
            p = os.path.join(d, f)
            yield p, os.path.relpath(p, origen)


def pendientes(destino):
    for src_rel, dst_rel in MAPEO:
        src = os.path.join(REPO, src_rel)
        for s, rel in archivos(src):
            d = os.path.join(destino, dst_rel, rel) if rel else os.path.join(destino, dst_rel)
            if not os.path.exists(d) or not filecmp.cmp(s, d, shallow=False):
                yield s, d


def relanzar_como_admin():
    import ctypes
    params = subprocess.list2cmdline([os.path.abspath(__file__)] + sys.argv[1:] + ["--pausa"])
    r = ctypes.windll.shell32.ShellExecuteW(None, "runas", sys.executable, params, REPO, 1)
    if r <= 32:
        sys.exit("No se obtuvo permiso de administrador; no se copió nada.")
    print("Continuando en la ventana de administrador...")
    sys.exit(0)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--destino", default=r"C:\MPRBlockly", help="carpeta donde está instalado MPR Blockly")
    ap.add_argument("--simular", action="store_true", help="solo mostrar qué se copiaría")
    ap.add_argument("--pausa", action="store_true", help=argparse.SUPPRESS)
    args = ap.parse_args()

    if not os.path.isfile(os.path.join(args.destino, "MPR Blockly.exe")):
        sys.exit("No encuentro MPR Blockly instalado en %s (usa --destino)." % args.destino)

    lista = list(pendientes(args.destino))
    if not lista:
        print("La app instalada ya tiene todos los cambios del repositorio.")
    else:
        try:
            for s, d in lista:
                print(("[simulado] " if args.simular else "") + os.path.relpath(d, args.destino))
                if not args.simular:
                    os.makedirs(os.path.dirname(d), exist_ok=True)
                    shutil.copy2(s, d)
        except PermissionError:
            if os.name == "nt" and not args.pausa:
                relanzar_como_admin()
            raise
        cambio_main = any(d.endswith("electronApp.js") for _, d in lista)
        print("\n%d archivo(s) %s." % (len(lista), "por copiar" if args.simular else "copiados"))
        if not args.simular:
            print("Cierra y vuelve a abrir MPR Blockly." if cambio_main else "Presiona F5 en MPR Blockly para ver los cambios.")
    if args.pausa:
        input("\nPresiona Enter para cerrar...")


if __name__ == "__main__":
    main()
