# Plan de pulido de MPR Blockly (desde la versión 1.5.0)

Origen: análisis completo del 2026-11-12 con seis revisiones en paralelo (código de la app, textos, bloques y
librería Otto, rendimiento 3D, arranque y memoria, repositorio e instalador). Este archivo es la lista de trabajo:
se marca cada punto al terminarlo (con el commit) y el detalle va en `BITACORA.md`.

Reglas que valen para todo el plan (ver `CLAUDE.md`): probar en la app real (Chromium 69), un commit por cambio,
no bajar calidad gráfica ni quitar funciones, no tocar `OTTO_DIFF_LIMIT_DEFAULT`.

Estados: `[ ]` pendiente · `[x]` hecho · `[-]` descartado o en espera de decisión.

## Decisiones del usuario (2026-11-12)
- Se hace por partes, empezando por el bloque A.
- Bloque D (textos): **no** traducir lo que sigue en inglés por ahora. **Sí** arreglar la mezcla de tú/usted
  (tutear siempre), **sí** arreglar el ejemplo "⛰️ Cerro" para que use solo bloques del menú, y las canciones
  con nombre de marca quedan como **acertijo** (se oculta el nombre; la melodía no se toca).
- Pendiente de decidir: subir el respaldo a GitHub (`Admin-Proteinlab/blockly_mpr`), quitar librerías Arduino
  sobrantes del instalador, y 31 Minutos en el aviso de las canciones.

## A. Bloques que fallan en el robot (prioridad 1)
- [x] A1. "Declarar variable" ofrece "carácter" como tipo por defecto (`char`: distancias ≥ 128 cm salen
      negativas). Que la opción por defecto sea un número.
- [x] A2. "Declarar variable" se convierte en una global inicializada antes de `setup()` y no se ejecuta donde
      está el bloque; "Declarar d = Distancia" no compila. Declarar la global sin valor y asignar en el lugar del
      bloque (igual que el simulador).
- [x] A3. Variables usadas sin "Declarar" (por ejemplo "contar con i desde 1 hasta 5" o "Fijar" solo) no se
      declaran: no compila. Declararlas solas como número.
- [x] A4. Bloque "mover servos" (`otto_moveservos`) visible y roto (pasa un número donde va una lista): ocultarlo.
- [x] A5. Bloque `millis_start` sin generador C++: la vista de código no se actualiza y Verificar/Subir mandan el
      programa anterior sin avisar. Ocultarlo o darle generador, y que un bloque sin generador no deje el
      código viejo.
- [x] A6. "Esperar" en segundos se desborda desde 33 s (`int` de 16 bits); "cada X" arma el nombre de su
      variable con el valor (con 0.5 no compila; dos bloques iguales comparten temporizador).
- [x] A7. Ultrasonido sin límite de espera: sin eco cada lectura tarda 1 s y devuelve 0 cm ("cerca").
- [x] A8. Bloques de sonido sin "Configuración Otto": la revisión previa no lo detecta (`mpr_revision.js`).
- [x] A9 (menores, librería Otto): `bendTones` puede no terminar; `_tone` con duración negativa.
- [x] A10 (menores): "y"/"o" generan `&`/`|`; "es primo" genera JavaScript; sin `randomSeed`; RTTTL
      personalizado arma un nombre inválido; dos sensores (#1/#2) redefinen la función; `otto_movelegs`.

## B. Fallos de la app
- [x] B1. F5 recarga el ejemplo o `.bloc` original (la URL conserva `?url=`) y se pierden los cambios.
- [x] B2. "Detener" durante la subida puede dejar avrdude vivo con el puerto tomado (`mpr_subida.js`).
- [x] B3. Cerrar la calibración durante su subida deja el puerto abierto (`mpr_calibracion.js`).
- [x] B4. Abrir un `.bloc` dañado puede borrar la mesa sin aviso (`blocklino.js`).
- [x] B5. Soltar un archivo sobre la ventana navega fuera de la app (`electronApp.js`).
- [x] B6. Volver a abrir el mismo archivo no hace nada (el `<input>` no se vacía).
- [ ] B7 (menores): `#` en el nombre del `.bloc`; `.ino`/`.py` por argumento; `openExternal` solo http(s);
      doble apertura rápida del escenario; error rojo de `typing.js:95` (no afecta el código generado).

## C. Rendimiento sin perder calidad (medir antes y después en la app con `tools/medir_app.mjs`)
- [ ] C1. Otto 3D se rearma de cero al abrir "Probar en pantalla" o al llamarlo (~190 ms y fuga en la GPU):
      reutilizar renderer y escena.
- [ ] C2. El escenario quieto se redibuja 12 veces/s: dibujar solo cuando algo cambia.
- [ ] C3. Falsos "equipo lento" que bajan el modelo 3D toda la sesión (`medA`/`lentos`).
- [x] C4. Logo "innova 2025" de 4351×1713 px para 35 px de alto (~30 MB de memoria) y `MPRBlockly.png`.
- [ ] C5. Primera compilación en un PC nuevo: 33 s; con la caché del core en el instalador, ~19 s y no se pierde
      al limpiar `%TEMP%`.
- [x] C6. No recompilar si el programa y la placa no cambiaron (~10 s por reenvío).
- [x] C7. La vista de código se regenera con eventos de interfaz: ignorarlos.
- [ ] C8 (menores): `webglcontextlost` sin manejo; `getBoundingClientRect` en cada `mousemove`; JS que no se usa.

## D. Textos (parcial, según la decisión del usuario)
- [x] D1. Tutear siempre (tooltips y mensajes que dicen "Escriba", "Especifique", "Verifique", "Está seguro"…).
- [x] D2. Ejemplo "⛰️ Cerro" (`mpr_cerro.xml`): quitar `serial_init`/`serial_println` (no están en el menú).
- [x] D3. Canciones con nombre de marca (Simpsons, Pink Panther, Pitufos, Zelda…): mostrar como acertijo, sin
      el nombre; la melodía no se toca.
- [-] D4. Traducir lo que sigue en inglés: en espera (decisión del usuario).
- [ ] D5 (revisar con el usuario): otros ejemplos que usan bloques fuera del menú (🎤 Canto, canción `TakeOnMe`
      eliminada en "Biped random dancer").

## E. Repositorio e instalador
- [-] E1. Respaldo en GitHub: en espera de decisión (requiere `gh auth login`).
- [-] E2. Quitar librerías Arduino sobrantes (~51 MB menos en el instalador): en espera de decisión.
- [x] E3. Sacar `www/media/Thumbs.db` de git.
- [ ] E4. Versión 1.5.1 en `package.json` antes del próximo instalador.
- [x] E5. Actualizar `DOCUMENTACION_TECNICA.md` (secciones 7, 10 y 13 hablan de 1.2.0/1.4.x) y `CLAUDE.md`
      (`C:mprbp` → `C:\mprbp`).

## F. Librería Otto nueva (`LIB_OTTO_NUEVA.zip`, pedido del usuario del 2026-11-13)
Versión editada por otra persona (README en `compilation/arduino/userlibs/libraries/Otto/README_LIB_NUEVA.md`): freno
adaptativo con pilas bajas, `_moveServos` reescrito (suave, por trozos, 150°/s), piso de periodo en las marchas, `home()`
en dos fases, conexión escalonada de servos.
- [x] F1. Integrar `Otto.cpp`/`Otto.h` del paquete (con 3 ajustes MPR), ejemplos y README; nombres de la librería
      reservados en el generador. **Vuelve `OTTO_DIFF_LIMIT_DEFAULT` = 3 (era 240)**: probar el largo del paso en el robot.
- [ ] F2. Alinear el simulador ("Probar en pantalla", `www/js/mpr_otto_lib.js`) con la librería nueva.
- [ ] F3. Actualizar `DOCUMENTACION_TECNICA.md` 5.5, `ANALISIS_SERVOS.md`, y la regla de `CLAUDE.md`/`LEEME_MPR.md`.
- [ ] F4. Probar con el robot (USB y pilas): `examples/OttoValidacionFinal`, ejemplos MPR, calibración (ver BITACORA).
