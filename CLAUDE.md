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
  `OTTO_DIFF_LIMIT_DEFAULT` en `compilation/arduino/userlibs/libraries/Otto/Otto.h`;
  no cambiarlo sin que lo pidan.
- Respetar el fin de línea de cada archivo (hay archivos CRLF y LF). No reescribir
  archivos completos solo por formato.

## Probar cambios (rápido, sin instalador nuevo)
Con MPR Blockly instalado en `C:\MPRBlockly`:
```
python tools/probar.py          # copia www, librerías y .js cambiados a la instalación
```
Luego F5 en la app (o reabrirla si cambió `electronApp.js`). El script pide permiso de
administrador si hace falta. Usar `--simular` para ver qué copiaría.
Hacer commits pequeños, uno por cambio, con mensaje en español.

## Generar el instalador (Windows)
```
winget install 7zip.7zip NSIS.NSIS        # una vez
python tools/build_installer.py --official ottoblockly.Setup.1.5.0.exe
```
Salida: `dist\MPR_Blockly_Setup_<version>.exe`. La versión está en `package.json`.
`ottoblockly.Setup.1.5.0.exe` se descarga de
https://github.com/OttoDIY/blockly/releases/tag/v1.5.0 (SHA‑256 en el script).

## Verificar antes de entregar
- `node --check` sobre los `.js` modificados.
- Si se cambia la librería Otto o un generador de bloques: compilar un ejemplo con
  `compilation\arduino\arduino-cli.exe compile --fqbn arduino:avr:nano:cpu=atmega328old sketch\sketch.ino`
  desde la carpeta instalada (`C:\MPRBlockly\compilation\arduino`).

## Bitácora
Cada cambio se registra en `BITACORA.md` (pedido, archivos, qué se hizo, commit, si se probó). Actualizarla en el mismo commit del cambio.
