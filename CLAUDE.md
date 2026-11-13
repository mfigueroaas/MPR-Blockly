# Instrucciones para Claude Code — MPR Blockly

App Electron 4.1.1 (32 bits) de programación por bloques para robots Otto, basada en
OttoDIY/blockly. Ver `LEEME_MPR.md` para el contexto completo.

## Reglas
- La app es **solo en español**. Los textos van en `www/lang/Arduino_es.js` y `msg_es.js`.
- **No migrar Electron ni serialport**: el código usa la API de Electron 4 (diálogos con
  callback, `remote`, nodeIntegration por defecto) y `serialport` 7 (`sp.list(callback)`,
  `port.comName`). El instalador reutiliza esos binarios del instalador oficial 1.5.0.
- Solo placas AVR (core `arduino:avr` 1.8.3). No agregar placas ESP/SAMD/megaAVR sin
  incluir también su core en `tools/build_installer.py`.
- Mantener los cambios del programa MPR (logos, ejemplos `mpr_*.xml`, toolbox, menú de
  velocidades, librería Otto). El movimiento del robot depende de
  `OTTO_DIFF_LIMIT_DEFAULT` en `compilation/arduino/userlibs/libraries/Otto/Otto.h`
  (hoy 3, desde la librería nueva de nov‑2026); no cambiarlo sin que lo pidan.
- `Otto.cpp` y `Otto.h` deben quedar **idénticos byte a byte** a los de `LIB_OTTO_NUEVA.zip` (versión depurada
  y probada en servos por otra persona; decisión del usuario: ese archivo manda). Lo que falte se resuelve fuera de
  la librería (generadores, calibración, simulador), no editando esos dos archivos.
- Respetar el fin de línea de cada archivo (hay archivos CRLF y LF). No reescribir
  archivos completos solo por formato.

## Probar cambios (rápido, sin instalador nuevo)
Con MPR Blockly instalado en `C:\MPRBlockly`:
```
py tools/probar.py              # copia www, librerías y .js cambiados a la instalación
```
(En Windows usar `py`: `python` puede abrir la tienda de Microsoft. Si `python` funciona, da lo mismo.)
Luego F5 en la app (o reabrirla si cambió `electronApp.js`). El script pide permiso de
administrador si hace falta. Usar `--simular` para ver qué copiaría.
Hacer commits pequeños, uno por cambio, con mensaje en español.

## Generar el instalador (Windows)
```
winget install 7zip.7zip NSIS.NSIS        # una vez
py tools/build_installer.py --official ottoblockly.Setup.1.5.0.exe
```
Salida: `dist\MPR_Blockly_Setup_<version>.exe`. La versión está en `package.json`.
`ottoblockly.Setup.1.5.0.exe` se descarga de
https://github.com/OttoDIY/blockly/releases/tag/v1.5.0 (SHA‑256 en el script).

## Verificar antes de entregar
- **Revisar siempre en la app real** (Electron 4 = Chromium 69), nunca solo en un navegador o en la versión web: lo que en un Chrome moderno se ve bien puede verse mal en la app. Fotos y pruebas con la app instalada o la copia de prueba `C:\mprbp` abierta con `--remote-debugging-port=9222` (6.5). En CSS no usar `gap` en flex, `clamp()`, `min()`/`max()`, `:is()` ni `aspect-ratio` (no existen en Chromium 69).
- `node --check` sobre los `.js` modificados.
- Si se cambia algo animado o gráfico (recorrido, mascota 3D, CSS): medir en la app instalada con
  `node tools/medir_app.mjs` (sección 6.5 de `DOCUMENTACION_TECNICA.md`), no solo en un navegador. Los PCs
  donde se usará tienen gráfica integrada (sin GPU dedicada) y no se puede perder calidad ni funciones.
- Si se cambia la librería Otto o un generador de bloques: compilar un ejemplo con
  `compilation\arduino\arduino-cli.exe compile --fqbn arduino:avr:nano:cpu=atmega328old sketch\sketch.ino`
  desde la carpeta instalada (`C:\MPRBlockly\compilation\arduino`).

## Bitácora
Cada cambio se registra en `BITACORA.md` (pedido, archivos, qué se hizo, commit, si se probó). Actualizarla en el mismo commit del cambio.

## Documentación
Visión completa del proyecto en `DOCUMENTACION_TECNICA.md` (arquitectura, versiones, mecanismos, instalador). Si un cambio altera algo de ahí, actualizarla junto con `BITACORA.md`.
**Para retomar el trabajo (otro PC, sesión nueva): leer la sección 13 "Traspaso" de `DOCUMENTACION_TECNICA.md`** (estado, qué falta probar, trampas conocidas, cómo ver la mascota 3D sin instalar con `tools/servidor_local.js`).
