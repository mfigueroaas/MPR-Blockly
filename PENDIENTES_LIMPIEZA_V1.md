# Pendientes de la limpieza v1 (estado al 2026-11-23)

Rama `limpieza-v1` (sin unir a `main`). Detalle de lo hecho en `BITACORA.md`, entrada "2026-11-23 — Limpieza final de la versión 1".

## Hecho (commits en la rama)
- `2dcee96` Etapa 1: fuera idiomas (salvo es), ejemplos ocultos, imágenes sin uso, menús de otras placas, drivers (solo CH341.zip).
- `7c7a5a4` Etapa 2: solo 4 librerías Arduino (Otto, Servo, PlayRtttl-master, CuteBuzzerSounds); `tools/build_installer.py` recorta avr-gcc (solo multilib avr5), firmwares, arduinoOTA 1.2.1, `library_index.json` vacío, `VkLayer_*`, locales (en-US, es, es-419) y compila un programa de prueba antes de generar.
- `a414dfd` Etapa 3: proceso principal sin código muerto (Python, REPL, factory, actualizador); envíos protegidos (F5/cerrar/abrir otro .bloc), F8 solo en modo monitor, Monitor Serie más robusto.
- `c3cac61` Etapa 4: interfaz con 12 archivos de bloques, toolbox limpio, sin error de `typing.js`, ejemplos "Cute sounds" y "Simple melody" con pin 13 (antes no compilaban).
- Probado en la copia `C:\mprbp` (DevTools): mismo menú, mismo C++ en los 14 ejemplos, los 14 compilan, consola sin errores, Otto 3D bien.

## Falta
1. **Revisar `build/installer.nsi`** (el usuario lo autorizó, pero la configuración de permisos de Claude Code bloquea la carpeta `build/`: quitar esa regla con `/permissions`). Confirmar que al instalar encima de una versión anterior se borran los archivos que ya no existen (77 librerías, idiomas, `VkLayer_*`, `repl.js`, drivers…). Si no, agregar limpieza previa en el `.nsi`.
2. **Probar con el robot** (en la app con los cambios, vía `py tools/probar.py` o la copia `C:\mprbp`):
   - enviar un programa a Otto;
   - F5 y cerrar la ventana durante un envío (debe avisar / preguntar "Cerrar cuando termine / Cerrar ya / Seguir aquí");
   - F5 y cerrar justo al abrir la app (precompilación: debe esperar en silencio / ocultarse y salir sola);
   - Monitor Serie: cambiar velocidad con el monitor abierto, tildes/ñ;
   - F8 con y sin Ctrl + Mayús + M;
   - guardar `.bloc`/`.ino` y cancelar el diálogo;
   - crear y renombrar una variable.
3. **Actualizar `DOCUMENTACION_TECNICA.md`**: secciones 3.2 (estructura: sin python, drivers, lang, libs), 7.1 (recortes del instalador, `--forzar`, compilación de prueba), 9 (cosas ocultas ya no reactivables: sensores extra, niveles, otras placas, idiomas), 10 y 13 (traspaso). Mencionar `#pinout`/`defaultCategories2/3` borrados.
4. **Opcional de limpieza menor** (inocuo, no hecho): textos sin uso en `www/lang/Arduino_es.js` y `msg_es.js` (bloques borrados, `btn_factory`, `configModal`, `cardLabel`); ramas muertas `prog != "python"` y `MRTnode`/ESP en `arduino_blocs.js`, `sensors.js`, `arduino_generateurs_cpp.js`; `blockly_blocs.js` tiene 71 definiciones y se usan 31; `js/mode-python.js` y `js/snippets/python.js`.
5. **Versión 1.6.0** en `package.json` y **generar el instalador**: falta `ottoblockly.Setup.1.5.0.exe` (no está en este PC; descargar de https://github.com/OttoDIY/blockly/releases/download/v1.5.0/ottoblockly.Setup.1.5.0.exe, pedir autorización). Anotar tamaño y SHA-256 en la doc (7.4) y comparar con 1.5.3 (139 MB).
6. **Unir `limpieza-v1` a `main`.**
7. **Decidir** qué hacer con `Logo Crecer en Renca.svg` (raíz, sin git; idéntico a `www/media/crecer-en-rencaLOGO.svg`, que tampoco se usa).
8. **Huevo de Pascua** para cerrar la v1 (por definir con el usuario).
9. **Decidir el repositorio de la v2**: seguir en este (historial de ~90 MB) o empezar uno nuevo desde el estado limpio.

## Datos útiles para retomar
- Copia de prueba: `C:\mprbp` (runtime recortado; `www` es un enlace a la carpeta `www` del repo; `compilation\arduino` es un enlace a `C:\mprt`, que tiene el compilador recortado y las 4 librerías). Abrir con `--remote-debugging-port=9222`. Comparte `localStorage` con la app instalada: no abrir las dos a la vez.
- Scripts de prueba (carpeta temporal de la sesión, pueden borrarse): `prueba_app.mjs` (respaldo/restaurar localStorage, generar código de ejemplos y revisar consola), `comparar.ps1`, `foto.mjs`. Base de comparación: `C:\mprw` (www de `main` antes de la limpieza).
- Sin `library_index.json`, arduino-cli lo descarga de internet al compilar: por eso el instalador lleva uno vacío.
