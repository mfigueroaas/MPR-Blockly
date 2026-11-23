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
    - NSIS 3.08 o más nuevo (makensis / makensis.exe)
    - Node.js    (npx, para cambiar ícono y datos de versión del .exe; opcional)
Salida: dist/MPR_Blockly_Setup_<versión>.exe

Firma digital (opcional, solo Windows, cuando haya un certificado de firma de código):
    python tools/build_installer.py --official ... --firma "/sha1 <huella del certificado>"
    (o la variable de entorno MPR_FIRMA). El texto son los argumentos de signtool que eligen el certificado:
      /sha1 <huella>  o  /n "<nombre>"     certificado instalado en Windows (también el de la nube de
                                            Certum con SimplySign Desktop conectado)
      /dlib <Azure.CodeSigning.Dlib.dll> /dmdf <metadata.json>    Azure Artifact Signing
    Se firman con sello de tiempo (--tsa) el instalador, Desinstalar.exe y todos los .exe/.dll/.node que vienen
    sin firma (MPR Blockly.exe y las herramientas de Arduino), para que funcionen también con el Control
    inteligente de aplicaciones de Windows 11 activado.
    Requiere signtool.exe (SDK de Windows: winget install Microsoft.WindowsSDK.10.0.26100).
"""
import argparse
import glob
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
    "packages/arduino/tools/arduinoOTA/1.3.0",     # la que pide arduino:avr 1.8.3 (la 1.2.1 sobra)
    "packages/builtin",
]
# Lo que sobra del paquete oficial para un Nano (atmega328p). Probado el 2026-11-23: el .hex sale idéntico
# byte a byte con el compilador completo, para "Nano" y "Nano Old".
AVR_GCC = "packages/arduino/tools/avr-gcc/7.3.0-atmel3.6.1-arduino7"
MULTILIB_NANO = "avr5"            # bibliotecas de avr-gcc para atmega328p; las de los demás chips AVR sobran (~120 MB)
QUITAR_AVR = ["packages/arduino/hardware/avr/1.8.3/firmwares"]   # firmwares de shields WiFi (13,7 MB)
OFFICIAL_ARDUINO_FILES = ["arduino-cli.exe", "package_index.json", "package_index.json.sig"]
# library_index.json (16 MB) solo sirve para descargar librerías. Si falta, arduino-cli lo baja de internet al
# compilar; con una lista vacía no lo baja y compila igual (las librerías están en userlibs).
LIBRARY_INDEX_VACIO = '{"libraries":[]}\n'
# Runtime de Electron: idiomas de Chromium que se conservan (el resto de locales/*.pak sobra) y capas de
# depuración de Vulkan que Electron 4 trae pero no usa.
LOCALES = {"en-US.pak", "es.pak", "es-419.pak"}
QUITAR_RUNTIME = ["VkICD_mock_icd.dll", "VkLayer_core_validation.dll", "VkLayer_object_tracker.dll",
                  "VkLayer_parameter_validation.dll", "VkLayer_threading.dll", "VkLayer_unique_objects.dll"]
# Programa de prueba que se compila con el arduino-cli armado, antes de generar el instalador
SKETCH_PRUEBA = """#include <Otto.h>
#include <PlayRtttl.hpp>
#include <CuteBuzzerSounds.h>
Otto Otto;
static const char mel[] PROGMEM = "t:d=4,o=5,b=160:c6,e6";
void setup() { Otto.init(2, 3, 4, 5, true, 13); Otto.home(); cute.init(13); Serial.begin(9600); }
void loop() { Otto.walk(2, 1000, 1); Otto.sing(S_happy); cute.play(S_connection);
  playRtttlBlockingPGM(13, (char*)mel); Serial.println(Otto.getDistance()); }
"""
REPO_JS = ["electronApp.js", "index.js", "factory.js", "term.js", "repl.js"]
TSA_DEFECTO = "http://timestamp.digicert.com"   # sello de tiempo RFC 3161: sirve con certificados de cualquier emisor


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


def find_signtool():
    kits = sorted(glob.glob(r"C:\Program Files (x86)\Windows Kits\10\bin\*\x64\signtool.exe"), reverse=True)
    return find_tool(["signtool", "signtool.exe"], kits)


def ruta_sin_espacios(path):
    """Ruta corta 8.3 de Windows: NSIS ejecuta !finalize con cmd, que se confunde con rutas entre comillas."""
    if os.name != "nt" or " " not in path:
        return path
    import ctypes
    buf = ctypes.create_unicode_buffer(1024)
    if ctypes.windll.kernel32.GetShortPathNameW(path, buf, 1024) and " " not in buf.value:
        return buf.value
    sys.exit("La carpeta de trabajo no puede tener espacios si se firma: usa --work C:\\mprb")


def pe_con_firma(path):
    """True si el ejecutable o biblioteca ya trae firma Authenticode (o no es un archivo PE): no se toca."""
    with open(path, "rb") as f:
        dos = f.read(64)
        if len(dos) < 64 or dos[:2] != b"MZ":
            return True
        pe = int.from_bytes(dos[60:64], "little")
        f.seek(pe)
        if f.read(4) != b"PE\0\0":
            return True
        f.seek(pe + 24)
        magic = int.from_bytes(f.read(2), "little")
        # directorios de datos: tras 96 bytes del encabezado opcional (PE32) o 112 (PE32+); el 4.º es el de certificados
        f.seek(pe + 24 + (96 if magic == 0x10b else 112) + 4 * 8)
        return int.from_bytes(f.read(8)[4:8], "little") > 0


def firmar_todo(stage, signtool, firma, tsa):
    """Firma todos los .exe/.dll/.node que vienen sin firma: los de MPR y las herramientas de Arduino incluidas
    (arduino-cli, avr-gcc, avrdude...). Con el Control inteligente de aplicaciones de Windows 11 activo, cualquier
    programa sin firma ni reputación queda bloqueado, también al compilar. Los que ya traen firma no se tocan."""
    archivos = [os.path.join(d, f) for d, _, fs in os.walk(stage) for f in fs
                if f.lower().endswith((".exe", ".dll", ".node")) and not pe_con_firma(os.path.join(d, f))]
    for i in range(0, len(archivos), 40):   # en lotes: cada archivo pide un sello de tiempo
        lote = " ".join('"%s"' % a for a in archivos[i:i + 40])
        subprocess.run('"%s" sign /fd sha256 /tr %s /td sha256 %s %s' % (signtool, tsa, firma, lote),
                       check=True, stdout=subprocess.DEVNULL)
    return len(archivos)


def preparar_firma(firma, tsa, work):
    """Escribe <work>/firmar.cmd, que firma con signtool el archivo que recibe (lo usan este script y NSIS)."""
    if os.name != "nt":
        sys.exit("La firma digital solo está disponible en Windows (signtool).")
    signtool = find_signtool()
    if not signtool:
        sys.exit("Para firmar falta signtool.exe (SDK de Windows): winget install Microsoft.WindowsSDK.10.0.26100")
    cmd = os.path.join(work, "firmar.cmd")
    with open(cmd, "w", encoding="utf-8", newline="\r\n") as f:
        # chcp 65001: los nombres de certificado pueden llevar tildes
        f.write('@echo off\nchcp 65001 >nul\n"%s" sign /fd sha256 /tr %s /td sha256 %s %%1\n' % (signtool, tsa, firma))
    return ruta_sin_espacios(cmd), signtool


def probar_compilacion(ard_dst, work):
    """Compila un programa con Otto, canciones y sonidos usando el arduino-cli ya armado (Nano y Nano Old).
    Si falla, el instalador no se genera: así un recorte de más no llega a los PCs."""
    if os.name != "nt":
        print("  (prueba de compilación omitida: arduino-cli.exe solo corre en Windows)")
        return
    print("  Probando la compilación con el arduino-cli armado (Nano y Nano Old)")
    antes = set(os.listdir(ard_dst))
    carpeta = os.path.join(work, "prueba")
    shutil.rmtree(carpeta, ignore_errors=True)
    os.makedirs(carpeta)
    with open(os.path.join(carpeta, "prueba.ino"), "w", encoding="ascii") as f:
        f.write(SKETCH_PRUEBA)
    try:
        for fqbn in ("arduino:avr:nano", "arduino:avr:nano:cpu=atmega328old"):
            r = subprocess.run([os.path.join(ard_dst, "arduino-cli.exe"), "compile", "--config-file", "arduino-cli.yaml",
                                "--fqbn", fqbn, "--build-path", os.path.join(work, "prueba_build"), carpeta],
                               cwd=ard_dst, capture_output=True, text=True, encoding="utf-8", errors="replace")
            salida = r.stdout + r.stderr
            if r.returncode != 0 or "library_index" in salida:
                sys.exit("ERROR: la compilación de prueba falló con %s:\n%s" % (fqbn, salida[-3000:]))
    finally:
        for nuevo in set(os.listdir(ard_dst)) - antes:   # inventory.yaml y otras cosas que crea arduino-cli
            p = os.path.join(ard_dst, nuevo)
            shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
    print("  Compila bien")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--official", required=True, help="ottoblockly.Setup.1.5.0.exe")
    # En Windows se usa una carpeta corta: hay rutas de librerías de ~215 caracteres y
    # el límite clásico de Windows es 260.
    default_work = r"C:\mprb" if os.name == "nt" else os.path.join(REPO, "build_tmp")
    ap.add_argument("--work", default=default_work, help="carpeta de trabajo (ruta corta)")
    ap.add_argument("--out", default=os.path.join(REPO, "dist"), help="carpeta de salida")
    ap.add_argument("--skip-exe-resources", action="store_true", help="no cambiar ícono/versión del .exe")
    ap.add_argument("--firma", default=os.environ.get("MPR_FIRMA"),
                    help='argumentos de signtool que eligen el certificado, por ejemplo "/sha1 <huella>" (o variable MPR_FIRMA)')
    ap.add_argument("--tsa", default=os.environ.get("MPR_FIRMA_TSA", TSA_DEFECTO), help="servidor de sello de tiempo")
    ap.add_argument("--forzar", action="store_true", help="seguir aunque el SHA-256 del instalador oficial no coincida")
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
        msg = "el SHA-256 no coincide con ottoblockly.Setup.1.5.0.exe conocido:\n   %s" % digest
        if not args.forzar:
            sys.exit("ERROR: " + msg + "\n  (usa --forzar solo si sabes que el archivo es correcto)")
        print("  AVISO: " + msg)

    work = os.path.abspath(args.work)
    official = os.path.join(work, "official")
    stage = os.path.join(work, "stage")
    for d in (official, stage):
        shutil.rmtree(d, ignore_errors=True)
    os.makedirs(official)
    os.makedirs(stage)
    os.makedirs(args.out, exist_ok=True)
    firmar, signtool = preparar_firma(args.firma, args.tsa, work) if args.firma else (None, None)
    print("  Firma digital: %s" % ("sí (%s)" % args.firma if firmar else "no (sin certificado: Windows mostrará 'Editor desconocido')"))

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
    for f in QUITAR_RUNTIME:
        if os.path.exists(os.path.join(stage, f)):
            os.remove(os.path.join(stage, f))
    for f in os.listdir(os.path.join(stage, "locales")):
        if f not in LOCALES:
            os.remove(os.path.join(stage, "locales", f))
    os.makedirs(os.path.join(stage, "resources"))
    shutil.copy2(os.path.join(official, "resources", "electron.asar"), os.path.join(stage, "resources", "electron.asar"))

    app_dir = os.path.join(stage, "resources", "app")
    copytree(os.path.join(official, "resources", "app", "node_modules"), os.path.join(app_dir, "node_modules"))
    # Solo el driver CH340/CH341 de los Nano (el .nsi lo instala con pnputil); el .zip no se instala
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
    with open(os.path.join(ard_dst, "library_index.json"), "w", encoding="ascii") as f:
        f.write(LIBRARY_INDEX_VACIO)
    for rel in AVR_PACKAGES:
        copytree(os.path.join(ard_off, rel), os.path.join(ard_dst, rel))
    for rel in QUITAR_AVR:
        shutil.rmtree(os.path.join(ard_dst, rel))
    for base in ("lib/gcc/avr/7.3.0", "avr/lib"):
        carpeta = os.path.join(ard_dst, AVR_GCC, base)
        for d in os.listdir(carpeta):
            # multilibs: avr2..avr6, avrxmega*, avrtiny, tiny-stack (device-specs, include, plugin… se quedan)
            es_multilib = d.startswith(("avr", "tiny-stack")) and os.path.isdir(os.path.join(carpeta, d))
            if es_multilib and d != MULTILIB_NANO:
                shutil.rmtree(os.path.join(carpeta, d))
    for rel in ("arduino-cli.yaml", "LICENSE.txt", "sketch", "userlibs"):
        s = os.path.join(REPO, "compilation", "arduino", rel)
        copytree(s, os.path.join(ard_dst, rel)) if os.path.isdir(s) else shutil.copy2(s, os.path.join(ard_dst, rel))
    probar_compilacion(ard_dst, work)

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
    if firmar:
        n = firmar_todo(stage, signtool, args.firma, args.tsa)
        print("  Firmados %d ejecutables y bibliotecas que venían sin firma (MPR y herramientas de Arduino)" % n)

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
         "-DUNLIST=" + unlist] + (["-DFIRMAR=" + firmar] if firmar else []) +
        [os.path.join(REPO, "build", "installer.nsi")])

    print("[6/6] Listo")
    size = os.path.getsize(outfile) / 1e6
    print("  %s  (%.0f MB)\n  SHA-256 %s" % (outfile, size, sha256(outfile)))
    if firmar:
        ok = subprocess.run([signtool, "verify", "/pa", "/q", outfile]).returncode == 0
        print("  Firma: %s" % ("válida y de confianza" if ok else
                               "PRESENTE pero Windows no confía en el certificado (¿certificado de prueba?)"))


if __name__ == "__main__":
    main()
