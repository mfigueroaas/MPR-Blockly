#!/usr/bin/env python3
"""Arma el instalador de MPR Blockly.

Reutiliza del instalador oficial ottoblockly.Setup.1.5.0.exe lo que ya está
compilado y probado para Windows (Electron 4.1.1 de 32 bits, serialport 7.1.4,
arduino-cli 0.14.0, core arduino:avr 1.8.3, avr-gcc y avrdude) y le pone encima
el código de este repositorio (www, librerías, electronApp.js, index.js...).

Uso:
    python tools/build_installer.py --official ruta/ottoblockly.Setup.1.5.0.exe

Requisitos (Windows o Linux):
    - 7-Zip      (7z / 7z.exe)
    - NSIS 3     (makensis / makensis.exe)
    - Node.js    (npx, para cambiar ícono y datos de versión del .exe; opcional)
Salida: dist/MPR_Blockly_Setup_<versión>.exe
"""
import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import zipfile

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OFFICIAL_SHA256 = "3c495447694e5e6a68b0de7408d533825d2c661fba35a7ec74415a83e8b28b99"
APP_EXE = "MPR Blockly.exe"

# Archivos del runtime de Electron (raíz del instalador oficial) que NO se copian:
# se reemplazan por los del repositorio o no se usan.
SKIP_OFFICIAL_ROOT = {"www", "compilation", "resources", "config.json", "README.md",
                      "LICENSE.md", "ottoblockly.exe"}
# Herramientas mínimas para compilar y cargar en placas AVR (core arduino:avr 1.8.3)
AVR_PACKAGES = [
    "packages/arduino/hardware/avr/1.8.3",
    "packages/arduino/tools/avr-gcc/7.3.0-atmel3.6.1-arduino7",
    "packages/arduino/tools/avrdude/6.3.0-arduino17",
    "packages/arduino/tools/arduinoOTA",
    "packages/builtin",
]
OFFICIAL_ARDUINO_FILES = ["arduino-cli.exe", "package_index.json", "package_index.json.sig",
                          "library_index.json"]
REPO_JS = ["electronApp.js", "index.js", "factory.js", "term.js", "repl.js"]


def find_tool(names, extra_paths):
    for n in names:
        p = shutil.which(n)
        if p:
            return p
    for p in extra_paths:
        if os.path.isfile(p):
            return p
    return None


def run(cmd, **kw):
    print("  $", " ".join('"%s"' % c if " " in c else c for c in cmd))
    subprocess.run(cmd, check=True, **kw)


def copytree(src, dst):
    shutil.copytree(src, dst, dirs_exist_ok=True)


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--official", required=True, help="ottoblockly.Setup.1.5.0.exe")
    # En Windows se usa una carpeta corta: hay rutas de librerías de ~215 caracteres y
    # el límite clásico de Windows es 260.
    default_work = r"C:\mprb" if os.name == "nt" else os.path.join(REPO, "build_tmp")
    ap.add_argument("--work", default=default_work, help="carpeta de trabajo (ruta corta)")
    ap.add_argument("--out", default=os.path.join(REPO, "dist"), help="carpeta de salida")
    ap.add_argument("--skip-exe-resources", action="store_true", help="no cambiar ícono/versión del .exe")
    args = ap.parse_args()

    pkg = json.load(open(os.path.join(REPO, "package.json"), encoding="utf-8"))
    version = pkg["version"]

    sevenzip = find_tool(["7z", "7z.exe"], [r"C:\Program Files\7-Zip\7z.exe", r"C:\Program Files (x86)\7-Zip\7z.exe"])
    makensis = find_tool(["makensis", "makensis.exe"], [r"C:\Program Files (x86)\NSIS\makensis.exe", r"C:\Program Files\NSIS\makensis.exe"])
    npx = find_tool(["npx", "npx.cmd"], [r"C:\Program Files\nodejs\npx.cmd"])
    if not sevenzip or not makensis:
        sys.exit("Falta 7-Zip o NSIS. Windows: 'winget install 7zip.7zip NSIS.NSIS'.  Linux: 'apt install p7zip-full nsis'.")

    print("[1/6] Verificando instalador oficial")
    digest = sha256(args.official)
    if digest != OFFICIAL_SHA256:
        print("  AVISO: el SHA-256 no coincide con ottoblockly.Setup.1.5.0.exe conocido:\n  ", digest)

    work = os.path.abspath(args.work)
    official = os.path.join(work, "official")
    stage = os.path.join(work, "stage")
    for d in (official, stage):
        shutil.rmtree(d, ignore_errors=True)
    os.makedirs(official)
    os.makedirs(stage)
    os.makedirs(args.out, exist_ok=True)

    print("[2/6] Extrayendo runtime oficial (Electron 4.1.1, serialport 7.1.4, arduino-cli 0.14.0)")
    run([sevenzip, "e", "-y", "-o" + work, args.official, "$PLUGINSDIR/app-32.7z"], stdout=subprocess.DEVNULL)
    run([sevenzip, "x", "-y", "-o" + official, os.path.join(work, "app-32.7z")], stdout=subprocess.DEVNULL)
    os.remove(os.path.join(work, "app-32.7z"))

    print("[3/6] Armando la aplicación")
    for name in os.listdir(official):
        if name in SKIP_OFFICIAL_ROOT:
            continue
        s, d = os.path.join(official, name), os.path.join(stage, name)
        copytree(s, d) if os.path.isdir(s) else shutil.copy2(s, d)
    shutil.copy2(os.path.join(official, "ottoblockly.exe"), os.path.join(stage, APP_EXE))
    os.makedirs(os.path.join(stage, "resources"))
    shutil.copy2(os.path.join(official, "resources", "electron.asar"), os.path.join(stage, "resources", "electron.asar"))

    app_dir = os.path.join(stage, "resources", "app")
    copytree(os.path.join(official, "resources", "app", "node_modules"), os.path.join(app_dir, "node_modules"))
    copytree(os.path.join(REPO, "driversUSB"), os.path.join(app_dir, "driversUSB"))
    with zipfile.ZipFile(os.path.join(REPO, "driversUSB", "CH341.zip")) as z:
        z.extractall(os.path.join(app_dir, "driversUSB", "CH341"))
    for f in REPO_JS:
        shutil.copy2(os.path.join(REPO, f), os.path.join(app_dir, f))
    app_pkg = {k: pkg[k] for k in ("name", "productName", "version", "description", "author", "license", "main")}
    json.dump(app_pkg, open(os.path.join(app_dir, "package.json"), "w", encoding="utf-8"), indent=2, ensure_ascii=False)

    copytree(os.path.join(REPO, "www"), os.path.join(stage, "www"))

    ard_off = os.path.join(official, "compilation", "arduino")
    ard_dst = os.path.join(stage, "compilation", "arduino")
    os.makedirs(ard_dst)
    for f in OFFICIAL_ARDUINO_FILES:
        shutil.copy2(os.path.join(ard_off, f), os.path.join(ard_dst, f))
    for rel in AVR_PACKAGES:
        copytree(os.path.join(ard_off, rel), os.path.join(ard_dst, rel))
    for rel in ("arduino-cli.yaml", "LICENSE.txt", "README.md", "sketch", "userlibs"):
        s = os.path.join(REPO, "compilation", "arduino", rel)
        copytree(s, os.path.join(ard_dst, rel)) if os.path.isdir(s) else shutil.copy2(s, os.path.join(ard_dst, rel))

    for f in ("config.json", "LICENSE.md"):
        shutil.copy2(os.path.join(REPO, f), os.path.join(stage, f))
    shutil.copy2(os.path.join(REPO, "build", "mpr.ico"), os.path.join(stage, "mpr.ico"))
    shutil.copy2(os.path.join(REPO, "LEEME_MPR.md"), os.path.join(stage, "LEEME.md"))

    print("[4/6] Ícono y datos de versión de %s" % APP_EXE)
    exe = os.path.join(stage, APP_EXE)
    if args.skip_exe_resources or not npx:
        print("  (omitido: falta Node.js/npx o se pidió --skip-exe-resources; el .exe queda con el ícono de Otto)")
    else:
        v4 = version + ".0"
        run([npx, "--yes", "resedit-cli@3.1.1", exe, exe + ".tmp",
             "--icon", "1," + os.path.join(REPO, "build", "mpr.ico"),
             "--product-name", "MPR Blockly", "--file-description", "MPR Blockly",
             "--internal-name", "MPR Blockly", "--original-filename", APP_EXE,
             "--company-name", "Programa Mi Primer Robot",
             "--legal-copyright", "GPL-2.0 - basado en Otto Blockly (Otto DIY)",
             "--file-version", v4, "--product-version", v4])
        os.replace(exe + ".tmp", exe)

    print("[5/6] Generando instalador NSIS (puede tardar varios minutos)")
    # Lista de desinstalación: solo lo que se instala (no se borra nada más de la carpeta)
    unlist = os.path.join(work, "uninstall_list.nsh")
    with open(unlist, "w", encoding="utf-8") as f:
        for name in sorted(os.listdir(stage)):
            if os.path.isdir(os.path.join(stage, name)):
                f.write('  RMDir /r "$INSTDIR\\%s"\n' % name)
            else:
                f.write('  Delete "$INSTDIR\\%s"\n' % name)
        f.write('  Delete "$INSTDIR\\config.json"\n')
    outfile = os.path.join(os.path.abspath(args.out), "MPR_Blockly_Setup_%s.exe" % version)
    run([makensis, "-V2", "-INPUTCHARSET", "UTF8", "-DSTAGE=" + stage, "-DVERSION=" + version, "-DOUTFILE=" + outfile,
         "-DUNLIST=" + unlist,
         os.path.join(REPO, "build", "installer.nsi")])

    print("[6/6] Listo")
    size = os.path.getsize(outfile) / 1e6
    print("  %s  (%.0f MB)\n  SHA-256 %s" % (outfile, size, sha256(outfile)))


if __name__ == "__main__":
    main()
