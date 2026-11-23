# MPR Blockly

Programación por bloques, en español y sin internet, para el robot **Otto** del programa *Mi Primer Robot* (Crecer en Renca). Los niños arman bloques, la app los convierte en C++ de Arduino, los compila y los sube a un Arduino Nano.

Es una adaptación de [OttoDIY/blockly](https://github.com/OttoDIY/blockly) (GPL‑2.0, ver `LICENSE.md`), que a su vez se apoya en Blockly@rduino, BlocklyDuino y Blocklino. Aplicación de escritorio para Windows 64 bits (Electron 4.1.1).

## Descargar
El instalador de la última versión (1.6.0, Windows 64 bits) está en [Releases](https://github.com/mfigueroaas/MPR-Blockly/releases/latest). Las versiones anteriores también están ahí (`v1.1.0` a `v1.5.3`; solo la 1.1.0 y la 1.1.1 conservan su instalador).

## Qué trae de más
Menú de bloques reducido, ejemplos y 10 misiones, mascota Otto 3D, "Probar en pantalla" (simulador), subida automática al robot con errores explicados, revisión del programa antes de enviarlo, calibración de servos y modo monitor con Monitor Serie.

## Documentación
- [`GUIA_DEL_PROYECTO.md`](GUIA_DEL_PROYECTO.md): cómo trabajar con el proyecto y cómo funciona cada pieza (empieza aquí).
- [`DOCUMENTACION_TECNICA.md`](DOCUMENTACION_TECNICA.md): detalle completo, versiones e instalador.
- [`BITACORA.md`](BITACORA.md): registro de cada cambio.
- `docs/`: documentos de planes ya terminados y análisis de servos.

## Probar y generar el instalador
```
py tools/probar.py                                   # copia los cambios a C:\MPRBlockly (luego F5)
py tools/build_installer.py --official ottoblockly.Setup.1.5.0.exe
```
