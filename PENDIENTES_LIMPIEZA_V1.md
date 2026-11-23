# Pendientes de la limpieza v1 (estado al 2026-11-23)

Rama `limpieza-v1` (sin unir a `main`). Detalle de lo hecho en `BITACORA.md`, entrada "2026-11-23 — Limpieza final de la versión 1".

## Hecho (commits en la rama)
- `2dcee96` Etapa 1: fuera idiomas (salvo es), ejemplos ocultos, imágenes sin uso, menús de otras placas, drivers (solo CH341.zip).
- `7c7a5a4` Etapa 2: solo 4 librerías Arduino (Otto, Servo, PlayRtttl-master, CuteBuzzerSounds); `tools/build_installer.py` recorta avr-gcc (solo multilib avr5), firmwares, arduinoOTA 1.2.1, `library_index.json` vacío, `VkLayer_*`, locales (en-US, es, es-419) y compila un programa de prueba antes de generar.
- `a414dfd` Etapa 3: proceso principal sin código muerto (Python, REPL, factory, actualizador); envíos protegidos (F5/cerrar/abrir otro .bloc), F8 solo en modo monitor, Monitor Serie más robusto.
- `c3cac61` Etapa 4: interfaz con 12 archivos de bloques, toolbox limpio, sin error de `typing.js`, ejemplos "Cute sounds" y "Simple melody" con pin 13 (antes no compilaban).
- Probado en la copia `C:\mprbp` (DevTools): mismo menú, mismo C++ en los 14 ejemplos, los 14 compilan, consola sin errores, Otto 3D bien.

## Falta
1. ~~Revisar `build/installer.nsi`~~ Hecho: ya borraba `resources`, `www`, `packages` y `userlibs` antes de copiar (cubre librerías, idiomas, `repl.js`, drivers); faltaban `compilation\python`, `locales` y `VkLayer_*`/`VkICD_*`, agregados. Falta probar una instalación real encima de una versión anterior (al generar el instalador).
2. **Probar con el robot** (en la app con los cambios, vía `py tools/probar.py` o la copia `C:\mprbp`):
   - enviar un programa a Otto;
   - F5 y cerrar la ventana durante un envío (debe avisar / preguntar "Cerrar cuando termine / Cerrar ya / Seguir aquí");
   - F5 y cerrar justo al abrir la app (precompilación: debe esperar en silencio / ocultarse y salir sola);
   - Monitor Serie: cambiar velocidad con el monitor abierto, tildes/ñ;
   - F8 con y sin Ctrl + Mayús + M;
   - guardar `.bloc`/`.ino` y cancelar el diálogo;
   - crear y renombrar una variable.
3. ~~Actualizar `DOCUMENTACION_TECNICA.md`~~ Hecho (3.2, 7.1, 9 y aviso en 13). Queda poner al día 10 y 13 al cerrar la v1.
4. ~~Limpieza menor~~ Hecha (textos sin uso de `msg_es.js`, modo Python de Ace y 156 definiciones de bloques/generadores sin uso, 4.192 líneas, comprobado con `tools/codigo_generado.mjs`: 82 salidas idénticas). Quedan solo textos sin uso de `Arduino_es.js` y ramas `prog != "python"` dentro de bloques que sí se usan (inocuas).
5. ~~Versión 1.6.0 e instalador~~ Hecho (64 MB, SHA-256 en 7.4 de la documentación). Falta instalarlo encima de una 1.5.x y probarlo.
6. ~~Unir `limpieza-v1` a `main`~~ Hecho (2026-11-23, merge `32f4f33`).
7. ~~Logo~~ Decidido: `Logo Crecer en Renca.svg` y `www/media/crecer-en-rencaLOGO.svg` se quedan (el logo se usa en el software). El de la raíz sigue sin versionar.
8. **Huevo de Pascua** para cerrar la v1 (por definir con el usuario).
9. **Decidir el repositorio de la v2**: seguir en este (historial de ~90 MB) o empezar uno nuevo desde el estado limpio.

## Datos útiles para retomar
- Copia de prueba: `C:\mprbp` (runtime recortado; `www` es un enlace a la carpeta `www` del repo; `compilation\arduino` es un enlace a `C:\mprt`, que tiene el compilador recortado y las 4 librerías). Abrir con `--remote-debugging-port=9222`. Comparte `localStorage` con la app instalada: no abrir las dos a la vez.
- Los scripts de prueba de esa sesión (`prueba_app.mjs`, `comparar.ps1`, `foto.mjs`) estaban en una carpeta temporal y ya no existen: si hacen falta, rehacerlos. Hacían esto por DevTools (puerto 9222): respaldar y restaurar `localStorage`; cargar cada ejemplo visible con `Blockly.Xml.domToWorkspace` y sacar `Blockly.Arduino.workspaceToCode`; compilar cada código en `C:\mprt`; leer los errores de consola tras `Page.reload`; y sacar fotos con `Page.captureScreenshot` (la ventana debe estar visible). Base de comparación: `C:\mprw` (www de `main` antes de la limpieza).
- **Ojo en las pruebas:** `BlocklyDuino.cargarXmlEnMesa` muestra un `alert` si el archivo trae bloques desconocidos, y ese `alert` deja la página detenida hasta que alguien lo cierra. Reemplazar `window.alert` antes de probarlo.
- Sin `library_index.json`, arduino-cli lo descarga de internet al compilar: por eso el instalador lleva uno vacío.
