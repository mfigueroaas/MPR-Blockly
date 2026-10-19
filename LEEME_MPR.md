# MPR Blockly (Mi Primer Robot)

Versión de [Otto Blockly](https://github.com/OttoDIY/blockly) adaptada para el programa
*Mi Primer Robot* (Crecer en Renca). Programación por bloques, en español, para robots
Otto con placas Arduino AVR (Nano, Uno, Mega…), sin conexión a internet.

## Qué incluye respecto de Otto Blockly

- Todo lo del parche `MPR_Patch_OttoBlockly` (nov‑2025): logos y pie de página del
  programa, colores, ejemplos "Mi Primer Robot", toolbox por niveles, menú de
  velocidades, interfaz simplificada y librería Otto con limitador de servos y
  refresco round‑robin.
- Sobre la base actual de OttoDIY/blockly (master, ago‑2026), con las correcciones de
  upstream de abril‑2024 que el parche había deshecho (motor L298N, ON/OFF, botón
  táctil, bloque switch).
- Solo español y solo placas AVR.
- Instalador propio: carpeta `C:\MPRBlockly`, accesos directos, asociación de
  archivos `.bloc`, desinstalador y driver CH340 opcional. No reemplaza ni choca con
  una instalación de Otto Blockly. Requiere Windows de 64 bits (arduino-cli es de
  64 bits, igual que en Otto Blockly 1.5.0).
- Alumnos sin permisos de administrador pueden compilar y subir: solo
  `compilation\arduino` y `config.json` son modificables por el grupo Usuarios.
- Actualizador automático desactivado (apuntaba a Otto Blockly oficial).

El historial de git explica cada cambio (`git log`).

## Generar el instalador

El instalador reutiliza las partes ya compiladas para Windows del instalador oficial
`ottoblockly.Setup.1.5.0.exe` (Electron 4.1.1, serialport 7.1.4, arduino-cli 0.14.0,
core arduino:avr 1.8.3, avr-gcc, avrdude) y pone encima el código de este repositorio.

1. Descargar `ottoblockly.Setup.1.5.0.exe` desde
   https://github.com/OttoDIY/blockly/releases/tag/v1.5.0 y dejarlo en la raíz del repo.
2. Instalar herramientas (una vez): `winget install 7zip.7zip NSIS.NSIS` (Node.js y
   Python ya deben estar instalados).
3. Ejecutar: `python tools/build_installer.py --official ottoblockly.Setup.1.5.0.exe`
4. Resultado: `dist\MPR_Blockly_Setup_<versión>.exe` (la carpeta de trabajo es
   `C:\mprb`, corta a propósito por el límite de 260 caracteres de Windows).

La versión se cambia en `package.json` (`"version"`).

## Probar cambios en la app instalada (lo más rápido)

`python tools/probar.py` copia a `C:\MPRBlockly` solo los archivos que cambiaron
(interfaz, bloques, textos, ejemplos, librería Otto). Después basta con F5 en la app.
El instalador nuevo solo hace falta para repartir la versión a otros PCs.

## Probar cambios de la interfaz sin instalar

`npm install` (recompila serialport para Electron 4.1.1; requiere Visual Studio Build
Tools) y luego `npm start` abre la app desde el repositorio.
Para compilar y subir código hace falta la carpeta `compilation/arduino` con
arduino-cli y el core AVR; lo más simple es probar con el instalador.

## Dónde está cada cosa

| Qué | Dónde |
|---|---|
| Interfaz, logos, colores | `www/index.html`, `www/css/blocklino.css`, `www/media/` |
| Búsqueda de bloques (lupa) | `www/js/mpr_buscar.js` |
| Bloques y código generado | `www/blocs&generateurs/` |
| Textos en español, menú de velocidades | `www/lang/Arduino_es.js`, `www/lang/msg_es.js` |
| Ejemplos | `www/examples/` + `www/examples/examples.json` |
| Categorías por nivel | `www/toolbox/toolbox_arduino_all.xml` |
| Librería del robot | `compilation/arduino/userlibs/libraries/Otto/` |
| Movimiento (limitador de servos) | `OTTO_DIFF_LIMIT_DEFAULT` en `Otto.h` (3 = igual que el parche) |
| Proceso principal Electron | `electronApp.js` |
| Compilar / subir / puertos COM | `index.js` |
| Instalador | `build/installer.nsi`, `tools/build_installer.py` |

## Licencia

GPL‑2.0, igual que Otto Blockly (ver `LICENSE.md`). Si se distribuye el instalador, el
código fuente de esta versión debe quedar disponible (por ejemplo, en el repositorio
del programa). arduino-cli es GPL‑3.0 (`compilation/arduino/LICENSE.txt`).
