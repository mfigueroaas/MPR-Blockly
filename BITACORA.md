# Bitácora de cambios — MPR Blockly

Registro cronológico de los cambios hechos con Claude Code. Quien retome el trabajo debe leer
primero `CLAUDE.md` (reglas) y `LEEME_MPR.md` (contexto), y luego esta bitácora.

## Cómo se trabaja
1. Código fuente en `C:\ClaudeCode\mpr-blockly` (se crea con `PREPARAR_CODIGO.bat`). Abrir con
   `cd /d C:\ClaudeCode\mpr-blockly` y `claude`.
2. Un cambio pequeño por vez, un commit por cambio, mensaje en español.
3. Probar: `python tools/probar.py` (copia a `C:\MPRBlockly`, pide permiso de administrador) y F5 en la app.
4. Registrar el cambio en esta bitácora (plantilla al final).

## Cambios

### 2026-11-13 — F1 (corrección): Otto.cpp y Otto.h idénticos al paquete
- **Pedido:** "el archivo que manda es el que ya está editado (el cpp de `LIB_OTTO_NUEVA.zip`): es el más probado en los servos, lo hizo otra persona, es el depurado".
- **Qué se hizo:** `Otto.cpp` y `Otto.h` quedan **idénticos byte a byte** al paquete (SHA‑256 `ad9c15d7…` y `39bc5ee5…`, los de `SHA256SUMS.txt`): se quitaron los 3 ajustes MPR que el subagente había puesto encima (trims leídos antes de conectar, `_moveServos` sin recorrido reenviando la posición, comentario de DIFF_LIMIT). `OTTO_DIFF_LIMIT_DEFAULT` sigue en 3, como en el paquete. Regla nueva en `CLAUDE.md`.
- **Lo que esos ajustes resolvían, ahora fuera de la librería:** la calibración (`mpr_calibracion.js`) aplicaba el trim con `_moveServos(…, centro)`, que en el paquete no escribe si no hay recorrido; ahora usa `_moveSingle(centro[i], i)` en cada servo (siempre escribe; el trim se suma en `Oscillator::write` después del limitador, así que se aplica completo y al instante). Efecto que queda, propio del paquete: al encender, la pose de reposo sale en 90 sin trim hasta el primer movimiento.
- **Archivos:** `compilation/arduino/userlibs/libraries/Otto/Otto.cpp`, `Otto.h`, `www/js/mpr_calibracion.js`, `CLAUDE.md`.
- **Probado:** `sha256sum` igual al paquete; programa de calibración y los 5 ejemplos MPR que usan Otto compilan contra la librería del repo (calibración 13.648 B; cerro 9.278 B).

### 2026-11-13 — C1, C2, C3 y C8: Otto 3D más liviano con la imagen idéntica
- **Pedido:** plan de pulido, rendimiento sin perder calidad ni detalle del 3D.
- **Qué se hizo:**
  - C1: esconder/mostrar a Otto y abrir/cerrar "Probar en pantalla" reutilizan el renderer, la escena y el modelo (antes se armaba todo de cero y quedaban sombreadores, buffers y un oyente `visibilitychange` por vez). Se vuelve a armar solo si cambió la calidad; se reaplican los colores.
  - C2: con el escenario quieto, cada cuadro calcula una "firma" de lo que se vería (tamaño, cámara, matrices, opacidad y color); si es igual a la del último dibujo no se redibuja (redibujo de seguridad cada 1 s y siempre que algo despierta la escena).
  - C3: la medición de "equipo lento" se reinicia al iniciar, al volver de minimizado, en reposo y tras una pausa aislada de más de 500 ms: ya no baja la calidad por error al abrir el escenario. Umbrales iguales.
  - C8: si se pierde el contexto WebGL y no vuelve en 3 s, Otto pasa a 2D (y el escenario lo avisa); si vuelve, se redibuja.
  - `tools/medir_app.mjs escenario`: mide aperturas, fugas, memoria y CPU con el escenario quieto.
- **Archivos:** `www/js/mpr_otto3d.js`, `www/js/mpr_simulador.js`, `www/js/mpr_mascota.js`, `tools/medir_app.mjs`, `PLAN_PULIDO.md`. Hecho por un subagente; medido y revisado por el coordinador.
- **Medido en la app** (copia `C:\mprbp`, este PC con GPU, `node tools/medir_app.mjs escenario`, antes → después): reabrir el escenario 164–248 ms → 56–139 ms (renderer reutilizado); oyentes `visibilitychange` tras 10 aperturas 1→11 → 1→2; memoria de procesos +46 MB → +32 MB (GPU +31 → +17 MB); escenario quieto 12 → 3,4 cuadros/s y CPU 26,9 % → 8,6 % de un núcleo. **Captura del escenario antes y después: idénticas byte a byte.** Falta: medir con `--disable-gpu` y en un PC del colegio; forzar la pérdida de contexto (C8).

### 2026-11-13 — B2, B3 y C6: Detener, calibración y no recompilar lo mismo
- **Pedido:** plan de pulido, puntos B2, B3 y C6.
- **Qué se hizo:**
  - B2 (`mpr_subida.js`, `cancelar`): "Detener" mataba primero al proceso padre y después `taskkill /T` ya no encontraba el árbol, así que avrdude/arduino-cli (Go, no cierra a sus hijos) quedaban vivos con el puerto tomado. Ahora `h.kill()` se usa solo si taskkill falla. Comprobado por el subagente con un árbol de procesos real.
  - B3 (`mpr_calibracion.js`): cerrar la calibración durante su subida ya no deja el puerto abierto (número de sesión; el callback de subida y el de apertura del puerto revisan que la calibración siga abierta, y un `close`/`error` de un puerto viejo no borra el actual).
  - C6 (`mpr_subida.js`): cada compilación correcta (Verificar, flecha o precompilación) anota programa, placa, carpeta y fecha/tamaño del `.hex`; la flecha se salta la compilación (~10 s) si todo coincide y el `.hex` sigue igual. Ante cualquier diferencia compila. Reemplaza a `MPRSubida.verificado`.
  - La lista de puertos no se consulta con la ventana minimizada; al volver se revisa enseguida.
- **Archivos:** `www/js/mpr_subida.js`, `www/js/mpr_calibracion.js`, `PLAN_PULIDO.md`. Hecho por un subagente; revisado por el coordinador. Falta actualizar 4.9 de `DOCUMENTACION_TECNICA.md` (menciona `MPRSubida.verificado`).
- **Probado:** en la app (copia `C:\mprbp`, sin robot): Verificar funciona (12 s); después, `compiladoVigente` reconoce el mismo programa y rechaza otro código u otra placa; abrir y cerrar la calibración sin errores. **Falta con el robot (COM7):** Detener durante "Cargando…" sin que quede `avrdude.exe`; cerrar la calibración durante "Preparar Otto" y subir enseguida; mandar dos veces el mismo programa (la 2.ª sin compilar).

### 2026-11-13 — B1, B4, B5, B6, B7 y C7: abrir archivos y la vista de código
- **Pedido:** plan de pulido, puntos B1, B4, B5, B6, B7 (en parte) y C7.
- **Qué se hizo:**
  - B1: después de abrir un ejemplo o un `.bloc` (doble clic) se quita `?url=` de la dirección: F5 ya no recarga el archivo original y conserva lo que el alumno hizo.
  - B4: `BlocklyDuino.cargarXmlEnMesa` revisa el archivo antes de tocar la mesa (que se lea, que sea `<xml>`, que todos sus bloques existan); si no, avisa (`MSG.xmlError` con el detalle) y deja la mesa como estaba. Abrir es un solo paso de Deshacer. Este Blockly no lanza errores con XML roto ni con bloques desconocidos, por eso antes la mesa quedaba vacía o a medias. Se usa en Abrir, soltar, `?url=` y `loadBlocks`.
  - B5: soltar un archivo sobre la ventana ya no hace navegar a la app: un `.bloc`/`.xml` se abre como con "Abrir"; otra cosa muestra el aviso. `electronApp.js` solo acepta navegar a la propia página.
  - B6: el selector de archivo se vacía: abrir dos veces el mismo archivo funciona.
  - B7: por argumento solo se aceptan `.bloc`/`.xml`; `shell.openExternal` solo abre `http(s)`; un `.bloc` con `#` en el nombre se lee con `fs`. Abrir un `.ino`/`.py` ahora muestra el aviso.
  - C7: la vista de código ignora los eventos de interfaz (seleccionar, clic, abrir categoría).
- **Archivos:** `www/js/blocklino.js` (sigue CRLF), `electronApp.js`, `PLAN_PULIDO.md`. Hecho por un subagente; revisado por el coordinador.
- **Probado:** en la app (copia `C:\mprbp`, con su `electronApp.js` reemplazado por el del repo, DevTools): texto basura, bloque inventado y raíz HTML → rechazados con la mesa igual; un archivo bueno carga y un Deshacer vuelve; ejemplo Salto abierto por `?url=` → la dirección queda limpia y un bloque agregado sobrevive a F5; navegar a `file:///C:/Windows/win.ini` → la app se queda en su página; soltar una foto → evento cancelado; seleccionar bloques no regenera el código y cambiar un campo lo regenera una vez. No probado a mano: el selector de archivos (B6) y el doble clic en un `.bloc` con `#`.

### 2026-11-13 — F1: librería Otto nueva integrada (LIB_OTTO_NUEVA.zip)
- **Pedido:** "implementar todo lo que sale en esta librería en la versión actual" (archivo `LIB_OTTO_NUEVA.zip`, editado por otra persona, con documentación).
- **Paquete:** SHA‑256 de `Otto.cpp`/`Otto.h` coinciden con `SHA256SUMS.txt`; `CAMBIOS.diff` parte de nuestro commit `9951584` (parche MPR nov-2025) y no incluye `8a7f619` ni `ce27643`. Solo se reemplazan `Otto.cpp` y `Otto.h`; el resto de la librería (Oscillator de MPR incluido) se conserva.
- **Qué cambia en el robot (según el README y la revisión):** gestos y "mover piernas" suaves, por trozos, los 4 servos a la vez (máx. 150°/s en total); con pilas bajas se mueve más lento en vez de reiniciarse (freno adaptativo, `OTTO_BRAKE_VMIN_ABS` depende del chip); periodo mínimo en las marchas (solo cambia Rápido + Grande: 1500 → 2000); `home()` en dos fases (~600 ms); servos conectados escalonados (~1,2 s al encender); `shakeLeg` apoyo 58 → 55. La librería no abre el puerto serie (antes tampoco lo hacía en MPR).
- **Ojo — `OTTO_DIFF_LIMIT_DEFAULT` vuelve de 240 a 3** (el autor midió todo con 3): reaparece el recorte de pasos que `ce27643` quería quitar (caminar a T=1500 hace ~18 de 30°). Para volver: `#define OTTO_DIFF_LIMIT_DEFAULT 240` en `Otto.h`. Decidir con el robot.
- **Ajustes MPR sobre el paquete (marcados `// MPR:`):** los trims se leen antes de conectar los servos; si `_moveServos` no tiene recorrido reenvía la posición (si no, la orden T de la calibración no mostraba el ajuste y el arranque quedaba sin trim); comentario sobre DIFF_LIMIT. Se pierde el límite 0..180 de `_moveSingle` (ningún bloque visible lo usa).
- **Generador:** `www/js/generate_cpp.js` reserva los nombres de la librería (`smile`, `heart`, `wave`, `zero`…`nine`, `S_*`, `note_*`, `Otto`, `Buzzer`…): una variable "smile" del alumno pasa a `smile2`.
- **Archivos:** `compilation/arduino/userlibs/libraries/Otto/Otto.cpp`, `Otto.h`, `README_LIB_NUEVA.md`, `CAMBIOS.diff`, `examples/OttoDiagnostico/`, `examples/OttoValidacionFinal/`; `www/js/generate_cpp.js`; `PLAN_PULIDO.md` (bloque F). Hecho por un subagente; revisado por el coordinador.
- **Probado:** compilado contra la librería del repo (subagente, con `-v` para confirmar cuál usaba): ejemplos MPR, una muestra por familia de bloques Otto, calibración y los ejemplos del paquete; +2,5 KB de flash y +27 B de RAM (cerro: 7.916 → 10.428 B). En la app: variable "smile" → `smile2`. **Falta:** probar en el robot (F4) y alinear el simulador (F2).

### 2026-11-13 — A9 y A10: arreglos menores de bloques
- **Pedido:** plan de pulido, puntos A9 y A10.
- **Qué se hizo:**
  - A9 (en el generador, `ottoesp.js`; la librería Otto no se tocó porque se reemplaza por la nueva): con números escritos, una duración o silencio negativo se genera como 0, y un "tono deslizante" que no terminaría nunca (P ≤ 1, o frecuencia baja con P cercano a 1, por la cuenta entera de `bendTones`) se reemplaza por un comentario que explica qué cambiar. El simulador sigue sonando en ese caso.
  - "y"/"o" generan `&&`/`||` (antes `&`/`|`, que evaluaban los dos lados), con el orden de operaciones correcto.
  - "es primo" genera una función C++ `mpr_esPrimo` (antes generaba JavaScript y no compilaba); par/impar/entero/divisible usan `fmod` (antes `random_int(...) % 2` no compilaba porque es `double`).
  - Con números al azar se agrega `randomSeed(analogRead(A7))` en setup (A7 queda libre en Otto): Movimiento improvisado ya no repite la misma secuencia en cada encendido.
  - Melodía personalizada: el nombre de su variable sale del nombre de la melodía más un número del texto (antes `"Hi:..."` daba `melody_Hi:` y no compilaba; dos melodías que empezaban igual se pisaban). Si la melodía no es un texto escrito se toca desde la RAM.
  - Sensores #2 a #4 tienen su propia función (`ultrasound_distance_2()`…); el #1 genera exactamente el mismo código que antes.
  - "Mover piernas" termina su línea con salto de línea.
- **Archivos:** `www/blocs&generateurs/blockly_generateurs_cpp.js`, `ottoesp.js`, `RTTTL.js` (solo la melodía personalizada), `sensors.js`, `PLAN_PULIDO.md`. Hecho por un subagente; revisado por el coordinador.
- **Detectado y pendiente:** en el simulador "y" funciona como "o" (`mpr_simulador.js` compara `'AND'` y el valor es `'and'`); `MPRRevision` no comprueba que el número de sensor leído esté configurado; `Otto.getSensor()` (`ottoesp.js`) no existe en la librería (bloque no visible).
- **Probado:** en la app (copia `C:\mprbp`) generando por DevTools y compilando con arduino-cli (librería instalada): y/o con primo/par/impar y azar, dos melodías "Hi:…", sensores #1 y #2, mover piernas + tono deslizante 40/100/1.02 (sale el comentario) compilan; los 6 ejemplos `mpr_*.xml` compilan (Movimiento improvisado suma `randomSeed`).

### 2026-11-13 — E3 y E5: Thumbs.db fuera de git y documentación al día
- **Pedido:** plan de pulido, puntos E3 y E5.
- **Qué se hizo:** `www/media/Thumbs.db` (caché de miniaturas de Windows) sale de git (`git rm --cached`) y `.gitignore` ignora `Thumbs.db` y `/versiones/` (no estaban). Documentación: versión 1.5.0 y fila del instalador 1.5.0 en 7.4 (con la errata `distMPR` corregida), 7.3 y 10.1 sin el "instalador 1.2.0", sección 13 con estado al 2026-11-13 y referencia a `PLAN_PULIDO.md`, `py` en vez de `python` en los comandos de Windows (`CLAUDE.md`, `LEEME_MPR.md`, 6.2, 7.1, 9) y `C:\mprbp` bien escrito en `CLAUDE.md`.
- **Archivos:** `.gitignore`, `www/media/Thumbs.db` (fuera de git; sigue en el disco), `DOCUMENTACION_TECNICA.md`, `CLAUDE.md`, `LEEME_MPR.md`, `PLAN_PULIDO.md`. Hecho por un subagente; revisado por el coordinador.
- **Probado:** `git check-ignore` confirma que se ignoran `www/media/Thumbs.db` y `versiones/`.

### 2026-11-13 — C4: logos con el tamaño que se necesita
- **Pedido:** plan de pulido, punto C4 (rendimiento sin perder calidad).
- **Causa:** "logo innova 2025.png" medía 4351×1713 px para verse a 89×35 px (Chromium lo decodifica entero: ~30 MB de memoria) y "MPRBlockly.png" 3055×232 px para verse a 396×30 px (~2,8 MB).
- **Qué se hizo:** se redujeron con remuestreo bicúbico de alta calidad, conservando proporción, transparencia y nombre: innova a 762×300 px (8,6 veces el alto que se ve; 119 KB → 36 KB) y MPRBlockly a 1200×91 px (3 veces; 23,9 KB → 18,7 KB). No se usan en otro lugar (instalador e ícono usan `.ico`). Originales en la carpeta temporal del subagente.
- **Archivos:** `www/media/logo innova 2025.png`, `www/media/MPRBlockly.png`, `PLAN_PULIDO.md`. Hecho por un subagente; revisado por el coordinador.
- **Probado:** en la app (copia `C:\mprbp`, pantalla al 125 %): se muestran a 396×30 y 89×35 px como antes; capturas por DevTools nítidas y con fondo transparente.

### 2026-11-13 — D3: canciones con nombre de marca se muestran como acertijo
- **Pedido:** las canciones con marcas comerciales quedan como acertijo (se oculta el nombre) y la melodía no se toca (decisión del usuario del 2026-11-12).
- **Qué se hizo:** en "Tocar canción extranjera" (`RTTTL.js`) 11 opciones muestran una pista en vez del nombre: Simpsons → "Misteriosa: dibujo animado de una familia amarilla", Flinstones → "…una familia de la edad de piedra", Muppets → "…show de títeres con una rana presentadora", PinkPanther → "…un felino rosado muy elegante", Looney → "…dibujos animados de un conejo y su pandilla", Smurfs → "…duendecitos azules con gorro blanco", Gadget → "…un inspector con un sombrero lleno de inventos", A_Team → "…cuatro aventureros en un furgón negro", Jeopardy → "…música para pensar en un concurso de la tele", Rudolph → "…un reno con la nariz roja", Frosty → "…un muñeco de nieve que cobra vida". La revelación de "melodía del bosque perdido" (`mpr_canciones.js`) ya no nombra el videojuego. El valor interno de cada opción (lo que se guarda en los `.bloc`) y las melodías no cambian.
- **Pendiente de decidir (usuario):** 31 Minutos (Misteriosas 1–4 revelan el nombre); villancicos pop (LastChristmas, AllIWant); el ejemplo visible "🎼 Ring Tone sounds" (`RTTL.xml`) es para ESP8266 y muestra "Gadget" (proponer ocultarlo).
- **Archivos:** `www/blocs&generateurs/RTTTL.js`, `www/blocs&generateurs/mpr_canciones.js`, `PLAN_PULIDO.md`. Hecho por un subagente; revisado por el coordinador.
- **Probado:** en la app (copia `C:\mprbp`, DevTools): el desplegable muestra los acertijos con tildes bien, el valor sigue siendo `Simpsons`, etc.; los ejemplos que usan canciones (Movimiento improvisado, Canto…) generan código idéntico al de antes y compilan.

### 2026-11-13 — D2: el ejemplo "⛰️ Cerro" usa solo bloques del menú
- **Pedido:** arreglar el ejemplo del Cerro para los bloques que realmente se pueden utilizar (decisión del usuario del 2026-11-12).
- **Causa:** usaba "Iniciar serie" (`serial_init`) e "Imprimir" (`serial_println` con un "text"), que no están en el menú; es justo el ejemplo que la misión final pide modificar.
- **Qué se hizo:** se quitaron esos dos bloques; el resto del programa no cambia (lee la distancia, retrocede si ≤ 5, sube y baja entre 5 y 18, avanza si no). La misión "f_igual" calcula la huella del ejemplo al momento, así que sigue funcionando.
- **Archivos:** `www/examples/mpr_cerro.xml` (sigue CRLF), `PLAN_PULIDO.md`. Hecho por un subagente; revisado por el coordinador.
- **Probado:** en la app (copia `C:\mprbp`) generando por DevTools y compilando: compila (6.832 B, antes 7.916 B); el código solo pierde `Serial.begin(9600)` y `Serial.println(lectura_sensor)`. Todos los tipos de bloque del XML están en el menú.

### 2026-11-13 — D1: la app tutea siempre al alumno
- **Pedido:** tutear en todos los textos (decisión del usuario del 2026-11-12); lo que sigue en inglés se deja así por ahora.
- **Qué se hizo:** 28 textos pasan de usted a tú, sin cambiar el sentido: confirmación de borrar todo ("¿Seguro que quieres borrar todos los bloques?"), "Verifica primero", tooltips de si, según, repetir mientras/hasta, contar, para cada, continuar, operador ternario, esperar, código libre, sensor de sonido y otros. Se dejaron los "su" que se refieren a Otto o al LED y los "debe/puede" impersonales.
- **Archivos:** `www/lang/msg_es.js` (sangría con espacios no separables, conservada), `www/lang/Arduino_es.js` (editado en latin1 por su byte no UTF-8), `www/lang/Blockly_es.js`, `PLAN_PULIDO.md`. Hecho por un subagente; revisado por el coordinador.
- **Probado:** en la app (copia `C:\mprbp`, DevTools): `MSG.discard`, `verif`, tooltips de esperar, si y código muestran el texto nuevo con tildes y saltos de línea correctos. `node --check` OK; los tres archivos siguen LF.

### 2026-11-13 — A8: Otto avisa si faltan la Configuración Otto para los sonidos
- **Pedido:** plan de pulido, punto A8.
- **Causa:** "reproducir nota", "tono" y "silencio" (`play`, `tone`, `notone`) usan la variable `buzzer` de Configuración Otto, pero la revisión previa solo vigilaba los bloques `otto_*`: sin Configuración Otto el programa fallaba al compilar con el error genérico B6.
- **Qué se hizo:** `MPRRevision.USA_ZUMBADOR`; si hay alguno de esos bloques y no está Configuración Otto (ni el bloque antiguo `buzzer_init`, que usa el ejemplo Canto), Otto lo dice antes de compilar con el mismo aviso de "falta Configuración Otto" (y lo pone él si está activado).
- **Archivos:** `www/js/mpr_revision.js`, `PLAN_PULIDO.md`.
- **Probado:** en la app (copia `C:\mprbp`, DevTools, `MPRRevision.buscar`): "tono" sin configuración → aviso `sin_config_otto` marcando el bloque; con Configuración Otto o con `buzzer_init` → sin problemas.

### 2026-11-13 — A7: el sensor de distancia sin eco ya no dice "cerca"
- **Pedido:** plan de pulido, punto A7.
- **Causa:** `pulseIn(eco, HIGH)` sin límite: si no llega el eco (sensor flojo, o sin corriente cuando Otto va solo con el USB) cada lectura esperaba 1 s y devolvía 0 cm, así que "si distancia < 20" se cumplía y Otto retrocedía solo.
- **Qué se hizo:** `pulseIn(eco, HIGH, 30000)` (30 ms alcanza para más de 4 m ida y vuelta) y, sin eco, la función devuelve 400 cm ("nada adelante"), el mismo valor que usa el simulador (`MPRSimulador.SIN_ECO_CM`).
- **Archivos:** `www/blocs&generateurs/sensors.js` (las dos variantes de `ultrasound_distance_simple`), `PLAN_PULIDO.md`.
- **Probado:** en la app (copia `C:\mprbp`) generando por DevTools y compilando con arduino-cli: los 6 ejemplos `mpr_*.xml` y los casos con sensor compilan; Cerro y Canto solo cambian esas dos líneas. Falta probar con el robot (con y sin el sensor conectado).

### 2026-11-12 — A6: "esperar" en segundos y "cada X" sin desbordes ni nombres inválidos
- **Pedido:** plan de pulido, punto A6.
- **Causa:** "esperar X segundos" generaba `delay(X*1000)`, que en el Nano es un `int` de 16 bits: desde 33 s el número se desbordaba y el robot quedaba detenido unos 49 días. "cada X" armaba el nombre de su temporizador con el valor (`long temps0.5` no compila; dos bloques con el mismo valor compartían temporizador) y lo guardaba con signo.
- **Qué se hizo:** `delay((unsigned long)(X*1000UL))`; cada bloque "cada X" tiene su propio `unsigned long temporizador`, `temporizador2`…, y compara contra `(unsigned long)(...)`.
- **Archivos:** `www/blocs&generateurs/arduino_generateurs_cpp.js` (`base_delay`, `tempo_sans_delay`), `PLAN_PULIDO.md`.
- **Probado:** en la app (copia `C:\mprbp`) generando por DevTools y compilando con arduino-cli: esperar 40 s, cada 0.5 s, dos "cada 500 ms" iguales, "cada t s" con variable y "esperar (0.5 + t) s" compilan. Los 6 ejemplos `mpr_*.xml` compilan; Balance, Movimiento improvisado y Canto solo cambian `delay(1*1000)` por la forma nueva.

### 2026-11-12 — A5: un bloque sin código ya no hace mandar el programa anterior
- **Pedido:** plan de pulido, punto A5.
- **Causa:** `millis_start` ("iniciar un cronometraje") está en Tiempo pero no tiene generador C++. Al usarlo, `workspaceToCode` fallaba, la vista previa se quedaba con el programa anterior y Verificar/Subir lo mandaban sin avisar.
- **Qué se hizo:** se oculta `millis_start` del menú. Además, si cualquier bloque no sabe generar su código (por ejemplo, uno de un archivo antiguo), la vista previa pone `#error "El bloque <texto del bloque> no funciona en el robot: quítalo de la mesa"`; el compilador lo muestra y Otto lo explica con el código nuevo **B7** (`mpr_consejos.js`, tabla de 4.13 en `DOCUMENTACION_TECNICA.md`).
- **Archivos:** `www/toolbox/toolbox_arduino_all.xml`, `www/js/blocklino.js` (`renderArduinoCodePreview`), `www/js/mpr_consejos.js`, `DOCUMENTACION_TECNICA.md`, `PLAN_PULIDO.md`.
- **Probado:** en la app (copia `C:\mprbp`, DevTools): con un `millis_start` en el Bucle, Verificar falla y muestra el mensaje B7 en el cuadro y en Otto; sin él, el programa normal verifica bien (7 s). `blocklino.js` sigue en CRLF.

### 2026-11-12 — A4: se oculta el bloque "mover servos"
- **Pedido:** plan de pulido, punto A4.
- **Causa:** `otto_moveservos` genera `Otto._moveServos(10, 90)`: la librería espera una lista de 4 posiciones y recibe el número 90, que el Nano usa como dirección de memoria (registros del chip). Los servos iban a posiciones al azar y el ajuste final podía no terminar. El simulador, en cambio, los movía a 90°.
- **Archivos:** `www/toolbox/toolbox_arduino_all.xml` (comentado entre bloques, con el motivo), `PLAN_PULIDO.md`. "Mover piernas" (`otto_movelegs`) sigue disponible.
- **Probado:** en la app (copia `C:\mprbp`, DevTools): el menú carga sus 9 categorías, "mover servos" ya no está y "mover piernas" sí.

### 2026-11-12 — A3: las variables usadas sin "Declarar" se declaran solas
- **Pedido:** plan de pulido, punto A3.
- **Causa:** el tipado automático de variables está apagado (`typings.js`, `assignTypeToVars` comentado), así que "contar con i desde 1 hasta 5" o un "Fijar" sin "Declarar" no declaraban la variable: `'i' was not declared in this scope`. La misión "Cinco pasos" aceptaba un programa que el robot no compilaba.
- **Qué se hizo:** `Blockly.Arduino.init` declara cada variable usada en la mesa como `long` (o `String`/`float` si un "Fijar" le da un texto o un número con decimales). Un "Declarar" de la misma variable la reemplaza con su tipo (misma clave: el nombre en C++). Un parámetro de función con el mismo nombre la tapa dentro de la función (C++ lo permite).
- **Archivos:** `www/js/generate_cpp.js`, `PLAN_PULIDO.md`.
- **Probado:** en la app (copia `C:\mprbp`) generando por DevTools y compilando con arduino-cli: contar con `i`, Fijar sin declarar (con distancia, texto y 0.5), nombres con espacio o tilde ("mi cuenta", "año") y una función con parámetro compilan. Los 6 ejemplos `mpr_*.xml` dan código idéntico al de antes.

### 2026-11-12 — A2: "Declarar variable" se ejecuta donde está el bloque
- **Pedido:** plan de pulido, punto A2.
- **Causa:** el generador solo escribía `tipo x = valor;` arriba de `setup()` y devolvía nada: en el Bucle no se ejecutaba en cada vuelta (el simulador sí, `mpr_simulador.js`), y "Declarar d = Distancia" no compilaba (`'ultrasound_distance_simple' was not declared`: las variables van antes que las funciones) y Otto lo explicaba como sensor sin configurar.
- **Qué se hizo:** la variable se declara arriba (con su valor solo si es fijo: número, texto o verdadero/falso) y el bloque asigna el valor donde está. Si el bloque está suelto en la mesa (definición global) se comporta como antes; si su valor no es fijo se asigna en `setup()`. Sin valor ya no genera `int x = ;`.
- **Archivos:** `www/blocs&generateurs/blockly_generateurs_cpp.js` (`variables_set_init`), `PLAN_PULIDO.md`.
- **Probado:** en la app (copia `C:\mprbp`) generando el código por DevTools y compilando con el arduino-cli instalado (`nano:cpu=atmega328old`): "Declarar d = Distancia" en Configuración y "Declarar c = 0" en el Bucle compilan; los 6 ejemplos `mpr_*.xml` compilan (Cerro y Movimiento improvisado suman una asignación inicial equivalente; los demás, código idéntico).

### 2026-11-12 — A1: "Declarar variable" parte como "entero"
- **Pedido:** plan de pulido, punto A1.
- **Causa:** el tipo por defecto del bloque era el primero de la lista (`carácter` → `char`): una distancia de 128 cm o más se volvía negativa en el robot y Otto esquivaba con el camino libre (en "Probar en pantalla" no se notaba).
- **Archivos:** `www/blocs&generateurs/blockly_blocs.js` (`variables_set_init` fija `NUMBER` al crearse), `PLAN_PULIDO.md`.
- **Probado:** en la app (copia `C:\mprbp`, por DevTools): un bloque nuevo sale "entero"; uno cargado de un archivo conserva su tipo guardado.

### 2026-11-12 — Plan de pulido (análisis completo)
- **Pedido:** analizar todo el programa para pulirlo, con subagentes, sin perder rendimiento ni detalle del 3D; dejar el plan documentado y hacerlo por partes.
- **Qué se hizo:** seis revisiones en paralelo (código de la app, textos, bloques y librería Otto con compilaciones de prueba, rendimiento 3D, arranque y memoria, repositorio e instalador). Resultado y decisiones del usuario en `PLAN_PULIDO.md` (bloques A a E, con estado por punto).
- **Archivos:** `PLAN_PULIDO.md` (nuevo).

### 2026-11-12 — Sin marcas comerciales en los textos del recorrido y "Acerca de"
- **Pedido:** en el tutorial de inicio decía "como piezas de Lego"; reemplazar por "piezas de un rompecabezas" y revisar que no
  haya más marcas comerciales visibles.
- **Archivos:** `www/lang/msg_es.js` (`tour_trabajo`: "como piezas de un rompecabezas"; `aboutBody`: "basado en Blockly" sin "de Google").
- **Revisión:** búsqueda de marcas (Lego, Google, YouTube, Microsoft, Scratch, etc.) en `www` (html, js, xml, lang). Solo quedan
  referencias internas (URLs de ayuda, código de librerías, agente de usuario) que no se muestran. "Arduino" se mantiene porque es el
  nombre de la placa/compilador y aparece en bloques y mensajes técnicos.
- **Probado:** `node --check` OK. Pendiente verlo en la app (F5 tras `probar.py`).


### 2026-11-11 — Otto ya no se corta: salto al celebrar, cámara del escenario y botón escondido
- **Pedido:** al apretar "Colores al azar" Otto baila y se le corta la cabeza (captura del usuario); revisar que no pase con otras
  animaciones parecidas.
- **Causa:** no era el globo de opciones: Otto se dibuja en un canvas fijo de 150×190 y en "celebrar" saltaba 42 mm, así que la cabeza
  salía 21 px por arriba. Pasaba también al cumplir una misión y al subir bien un programa (usan la misma animación).
- **Revisión de las demás:** `tools/medir_poses.js` (nuevo) proyecta cada vértice de cada pose con la cámara de la mascota: reposo,
  saludo, pensar, alerta, vuelta y caminar quedan dentro con 20 px o más de margen; solo "celebrar" se salía. En "Probar en pantalla"
  (medido en la app por DevTools, 480 casos: 4 lugares del tablero, 4 giros, 6 zooms y 5 posturas extremas de los servos) Otto se salía
  de la imagen con el zoom acercado (la cámara miraba al medio entre Otto y la caja) y en una esquina con la caja lejos (4 px).
  Además, el botón redondo de Otto escondido tapaba el pie del escenario.
- **Archivos:** `www/js/mpr_otto3d.js` (`SALTO` = 20 mm), `www/js/mpr_simulador.js` (la cámara se centra en Otto al acercar la vista y
  se corre como máximo `MIRA_CAJA_MAX` = 260 mm hacia la caja; el botón de Otto escondido se oculta mientras el escenario está abierto),
  `tools/medir_poses.js`, `DOCUMENTACION_TECNICA.md` (4.7).
- **Probado:** en la app (copia `C:\mprbp`, fotos): el baile se ve entero; escenario sin ningún caso fuera (margen mínimo 11 px); el
  botón no tapa Misiones ni el recorrido (queda bajo el velo); sobre el cuadro de mensajes queda encima del fondo oscuro, como Otto
  visible. Estado del usuario restaurado. Instalado con `probar.py` (archivos iguales).

### 2026-11-11 — Otto parte escondido, colores al azar, "Silenciar avisos" y el ícono del birrete
- **Pedido:** (1) en vez de "Naranja de nuevo", un botón de colores aleatorios con efecto arcoíris; (2) "Avisos tranquilos" pasa a
  "Silenciar avisos"; (3) el consejo de los ejemplos muestra el ícono del birrete en vez de la palabra; (6) Otto parte escondido, con un
  efecto sutil que llame la atención del niño pero deje que lo descubra.
- **Archivos:** `www/js/mpr_mascota.js`, `www/css/blocklino.css` (final del bloque de la mascota), `www/lang/msg_es.js`
  (`masc_silenciar`, `masc_azar`), `www/js/mpr_consejos.js`, `DOCUMENTACION_TECNICA.md` (4.7, 13.3).
- **Hecho:** "🌈 Colores al azar" pinta cada pieza con un color distinto de la paleta y Otto celebra; el fondo del botón es un arcoíris que
  se desliza despacio. El consejo dice "Mira los ejemplos en el botón [ícono] de arriba" (`{birrete}` → botón en miniatura, gris con el
  birrete blanco). Al abrir la app Otto está siempre escondido: el botón redondo da un saltito con un anillo naranja cada 8 s (solo
  transform/opacity, liviano en gráfica integrada); al tocarlo Otto aparece y se presenta. Si después se esconde, el botón queda quieto.
  Ojo: mientras está escondido Otto no dice los avisos (el cuadro de errores igual los explica).
- **Probado:** en la app (copia de prueba `C:\mprbp`, por DevTools, fotos): botón animado, presentación, menú, colores al azar y consejo
  con el ícono. Estado del usuario (localStorage y mesa) respaldado y restaurado. Instalado con `probar.py`.

### 2026-11-11 — Canción extranjera "Misteriosa: melodía del bosque perdido"
- **Pedido:** agregar a canciones extranjeras una melodía (notas Fa – La – Si ... entregadas por el usuario) con el acertijo
  "melodía del bosque perdido".
- **Archivos:** `www/blocs&generateurs/mpr_canciones.js` (`MPR_CANCIONES_EXT_PROPIAS`, `MPR_buscarCancion`, `MPR_cancionesUsadas`),
  `RTTTL.js`, `www/js/mpr_simulador.js`, `DOCUMENTACION_TECNICA.md`.
- **Hecho:** es Saria's Song (The Legend of Zelda). Las 84 notas del usuario, en orden y sin cambios (comprobado con un script), con el
  ritmo de la melodía conocida; notas sin ' en octava 5 y con ' en octava 6, 140 pulsos/min. `validar`: 27,6 s, de D5 a F6, la toca
  PlayRtttl. Va primera en "Tocar canción extranjera"; como no está en la librería se genera como las latinoamericanas (PROGMEM solo si
  se usa), suena en "Probar en pantalla" y al subir se revela su nombre.
- **Probado:** compila para Nano (3.946 bytes, 12 %). En la app: lista, definición generada y revelación correctas. En el robot y de
  oído: no (el ritmo es una aproximación; ajustarlo si suena raro).

### 2026-11-11 — "Ayuda" del clic derecho lleva a miprimerrobot.utem.cl
- **Pedido:** al hacer clic derecho en un bloque, "Ayuda" mandaba a www.ottodiy.com; que vaya a https://miprimerrobot.utem.cl/.
- **Archivos:** `www/js/mpr_fixes.js`, `www/lang/Arduino_es.js` (`HELPURL`).
- **Hecho:** `Blockly.BlockSvg.prototype.showHelp_` abre siempre `Blockly.MPR_AYUDA_URL` (cada bloque tenía su página: ottodiy, Adafruit,
  Arduino...) y `showContextMenu_` deja "Ayuda" activa en todos los bloques. Electron la abre en el navegador.
- **Probado:** en la app (copia de prueba `C:\mprbp`, por DevTools): `showHelp_` abre https://miprimerrobot.utem.cl/. Instalado con `probar.py`.

### 2026-11-06 — Canciones infantiles tradicionales (11 a 13)
- **Pedido:** 10 canciones latinoamericanas más, alegres y para niños, y agregar "Firestarter" (K/DA).
- **Archivos:** `www/blocs&generateurs/mpr_canciones.js`.
- **Hecho (3 de 10):** 11 Caballito blanco (Songsterr 470721, pista 0, compases 1-8), 12 Estrellita ¿dónde estás? (5301939, pista 0,
  compases 1-12), 13 Cumpleaños feliz (escrita a mano con el comando `texto`: la tablatura 268973 tenía notas equivocadas).
  Las 13 compilan juntas para Nano. Probado en el robot: no.
- **Después:** 14 Martinillo / Fray Santiago y 15 Pepito tenía una granja, tradicionales, notas escritas a mano con `texto` (de memoria,
  sin comprobar de oído). Quedan 5 de las 10 pedidas.
- **No hecho:** Firestarter (canción comercial reciente: no se transcribe su melodía). Faltan 7 infantiles: Songsterr casi solo trae
  versiones comerciales (La Granja de Zenón, etc.). Descartada "Los pollitos dicen": la tablatura no era la melodía.
  Se necesita partitura o notas de las canciones tradicionales que se quieran.

### 2026-11-06 — Más canciones latinoamericanas con pistas, Himno Nacional, logo transparente y ventana mínima mayor
- **Pedido:** más canciones reconocidas en Chile, agregar el Himno, pistas tipo acertijo, logo sin fondo blanco, y que el pie no se
  monte al achicar la ventana (captura del usuario: bloques y barra superior cortados).
- **Archivos:** `www/blocs&generateurs/mpr_canciones.js`, `index.js`, `www/css/blocklino.css`, `electronApp.js`.
- **Canciones:** de 4 a 10 "Misteriosas". La lista muestra "Misteriosa N: pista" (ej. "Misteriosa 5: se canta de pie en el colegio").
  Nuevas (Songsterr, `tools/rtttl/partitura_a_rtttl.py`): 5 Himno Nacional de Chile (estrofa 1 + coro, 2 etapas; track 3 de la
  canción 5903477, compases 10-18 `--quitar-final 2` y 51-57), 6 La Bamba (11536, pista 0, compases 5-14), 7 Cielito lindo
  (1085176, pista 0, compases 1-10), 8 Run Run se fue pa'l norte (9883, pista 4, compases 3-18, `--bpm 90`), 9 La cucaracha
  (73940, pista 0, compases 1-8), 10 Gracias a la vida (5514926, pista 2, compases 9-16). Todas validadas con PlayRtttl y las 10
  compilan juntas para Nano (5.894 bytes, 19 %). **Confianza media:** varias tablaturas son generadas por IA o arreglos
  (Cielito lindo, Gracias a la vida): hay que escucharlas en el robot. Descartadas por tablatura poco clara: Guantanamera,
  El baile de los que sobran, Los pollitos dicen, Si vas para Chile, De música ligera, Volver a los 17.
  Al subir el programa se muestra "Canción misteriosa N era: nombre".
- **Logo y pie:** el logo ya no lleva pastilla blanca (queda transparente). En la app (Chromium 69) el pie no se achicaba porque usé
  `clamp()`, que ese motor no entiende: ahora son alturas fijas por tramos con `@media (max-height)`.
- **Ventana:** mínimo 1100×650 (a 800 px de ancho el botón de subir pasaba a otra línea; a 1100 caben todos los botones).
- **Probado:** captura en Edge a 1100×650 con todos los botones; en la app Electron y en el robot, pendiente.

### 2026-11-06 — Dos bloques de canciones: latinoamericanas y extranjeras
- **Pedido:** separar las canciones en dos bloques (latinoamericanas / extranjeras) para explorar y acortar la lista.
- **Archivos:** `www/blocs&generateurs/RTTTL.js`, `mpr_canciones.js`, `www/lang/Arduino_es.js`, `www/toolbox/toolbox_arduino_all.xml`.
- **Qué se hizo:** bloque nuevo `RTTTL_music_lat` ("Tocar canción latinoamericana", las 4 "Canción misteriosa"), primero en la
  toolbox. `RTTTL_music` se mantiene como "Tocar canción extranjera" con 20 canciones: TV/dibujos (Simpsons, Flinstones, Muppets,
  PinkPanther, Looney, Smurfs, Gadget, A_Team, Jeopardy), Navidad (10) y `Short` (la usan los ejemplos `mpr_sing` y `mpr_randommove`).
  Se quitaron de la lista: StarWars, MahnaMahna, LeisureSuit, MissionImp, Entertainer, YMCA, Indiana, TakeOnMe, 20thCenFox, Bond,
  GoodBad, Toccata, AmazingGrace. Los programas guardados que usaban una de esas pierden la canción (el menú vuelve a la primera).
  La revelación del nombre ahora mira solo `RTTTL_music_lat`.
- **Verificación:** prueba con Blockly simulado (código de ambos bloques, listas, revelación). **Probado en la app:** ver abajo.

### 2026-11-06 — Logo nuevo de Crecer en Renca, pie flexible y tamaño mínimo
- **Pedido:** reemplazar el logo (SVG nuevo), que el diseño no se superponga en ventanas chicas y logos en SVG si se puede.
- **Archivos:** `www/media/crecer-en-rencaLOGO-hor.svg` y `crecer-en-rencaLOGO.svg` (reemplazados por el SVG nuevo),
  `crecer-en-rencaLOGO-hor.png` (eliminado), `www/index.html` (pie), `www/css/blocklino.css` (final del archivo), `electronApp.js`.
- **Qué se hizo:** el pie usa el SVG, que escala sin pérdida. Es un logo negro sin fondo, por eso va sobre una pastilla blanca
  (legible sobre fondo claro u oscuro). El pie es flex bajo el toolbox: los logos se achican con el alto de la ventana
  (`clamp` en `vh`) y nunca pasan del ancho disponible; bajo 760 px de alto se oculta el texto de Otto DIY, bajo 640 px los
  títulos y bajo 540 px el pie. Ventana principal con mínimo 800×560 (`minWidth`/`minHeight`): más chica, la barra de botones se monta.
- **Logos que siguen en PNG:** innova, Renca y La Fábrica (son imágenes; no hay SVG original). El ícono de la app y el del
  instalador son el robot MPR, no llevan el logo de Crecer: no se cambiaron.
- **Verificación:** capturas en Edge (servidor local) a 1240×700 y 1600×900, e iframes de 800×560, 760×600, 640×560 y 640×660: sin
  solapamientos del pie. **Probado en la app Electron:** no.

### 2026-11-06 — Canciones de 31 Minutos como "Canción misteriosa"
- **Pedido:** no mostrar el nombre; cada canción una sola vez aunque tenga etapas.
- **Archivos:** `www/blocs&generateurs/mpr_canciones.js` (formato nuevo: texto neutro, id, nombre real, etapas), `RTTTL.js`, `index.js`.
- **Qué se hizo:** 4 entradas ("Canción misteriosa 1–4"). Las etapas (tema/coro) suenan una tras otra dentro del mismo bloque.
  Los identificadores C y el título RTTTL son neutros (`MPR_C1E1`…) para que la vista de código no delate la canción. Al terminar
  de subir el programa, `index.js` (`revelarCanciones`) muestra "Canción misteriosa N es: …" durante 10 s.
- **Verificación:** prueba con Blockly simulado (lista, código y canciones usadas) y compilación para Nano de las canciones 1 y 4
  (con 2 etapas): OK. **Probado en la app:** no.

### 2026-11-06 — Ícono de chat en la búsqueda de bloques
- **Archivos:** `www/index.html`, `www/lang/msg_es.js`. Lupa → globo de chat (`fa-comments`); tooltip "Hablar con Otto: dile qué bloque buscas"
  y placeholder "Dile a Otto qué bloque buscas...". **Probado en la app:** no (en Edge el ícono se ve).

### 2026-10-23 — Herramienta partitura → RTTTL
- **Pedido:** guardar el script con que se transcribieron las canciones de 31 Minutos para usarlo otra vez.
- **Archivos:** `tools/rtttl/partitura_a_rtttl.py` y `tools/rtttl/LEEME.md` (nuevos), `DOCUMENTACION_TECNICA.md`.
- **Qué se hizo:** los scripts sueltos de la sesión del 2026-10-18 (en una carpeta temporal) se juntaron en una
  herramienta con comandos `buscar`, `descargar`, `ver`, `convertir` (compases de una pista de Songsterr),
  `texto` (notas escritas a mano), `validar` y `wav`. Se agregaron `--transponer auto`, `--quitar-final` y
  `--ultima` para los ajustes que antes se hacían en el código.
- **Verificación:** con las pistas descargadas aquella vez, las recetas del LEEME reproducen exactamente las 6
  melodías de `mpr_canciones.js`. `descargar` probado con la canción 3869622.
- **Commit:** (este)  **Probado en la app:** no aplica (herramienta aparte).

### 2026-10-23 — Instalador 1.3.0
- Versión subida a 1.3.0 en `package.json`. Generado con
  `python tools/build_installer.py --official ottoblockly.Setup.1.5.0.exe`:
  `dist\MPR_Blockly_Setup_1.3.0.exe`, 138 MB, SHA‑256 `549fcf71ed2f3cd6f0c46192006016e940a83dd235998d6def2923ca612b6769`.
- **Probado:** no; falta instalarlo y revisar los acentos, el driver y la página final.

### 2026-10-23 — Instalador: acentos y driver CH340 obligatorio
- **Pedido / problema:** el instalador mostraba textos rotos ("instalarÃ¡", "cÃ³digo") y al final
  ofrecía el driver CH340 como casilla opcional; debe instalarse siempre.
- **Archivos:** `tools/build_installer.py`, `build/installer.nsi`, `DOCUMENTACION_TECNICA.md`.
- **Qué se hizo:** `makensis` se llama con `-INPUTCHARSET UTF8` (el `.nsi` es UTF-8 sin BOM y NSIS
  lo leía como ANSI). Se quitó la casilla `SHOWREADME`; la sección principal llama a `InstallCH340`
  al final. En la página final queda solo la casilla "Abrir MPR Blockly".
- **Commit:** (este)  **Probado en la app:** no; falta generar el instalador y probarlo.

### 2026-10-23 — Bloque map (Matemáticas): descripción y textos
- **Pedido / problema:** el bloque `map` mostraba como descripción la del motor paso a paso
  (`m_pap_tooltip`, además con un "\ N" sobrante) y las etiquetas "map/from/to" en inglés.
- **Archivos:** `www/blocs&generateurs/blockly_blocs.js` (`math_map`), `www/lang/Arduino_es.js`.
- **Qué se hizo:** nuevos mensajes `MATH_MAP_TITLE/FROM/TO/TOOLTIP` ("convertir … del rango … al rango …"
  y descripción propia); se corrigió el texto de `m_pap_tooltip`. El código generado no cambia.
- **Commit:** (este)  **Probado en la app:** copiado con `probar.py`; falta F5 y revisión visual.

### 2026-10-18 — Zumbador: canciones de 31 Minutos en "Tocar RTTTL"
- **Pedido:** agregar canciones de 31 Minutos al bloque que tiene canciones, buscando las partituras y definiendo los
  tonos, para que queden como canciones seleccionables.
- **Archivos:**
  - `www/blocs&generateurs/mpr_canciones.js` (nuevo): tabla `Blockly.MPR_CANCIONES` con [texto en la lista,
    identificador, melodía RTTTL].
  - `www/blocs&generateurs/RTTTL.js`: la lista del bloque `RTTTL_music` ("Tocar RTTTL", Zumbador) muestra primero esas
    canciones; su generador escribe la melodía en el programa (`static const char MPR_x[] PROGMEM = "..."`) solo si se
    usa. La librería PlayRtttl no se tocó.
  - `www/index.html`: carga `mpr_canciones.js` antes de `RTTTL.js`.
- **Canciones** (melodía principal, octavas 5–6, 16–22 s cada una):

  | En la lista | Parte | Fuente (ritmo y notas) y comparación | Confianza |
  |---|---|---|---|
  | Yo nunca vi televisión (tema) | introducción/estrofa; es la melodía de la cortina del programa | Songsterr "31 Minutos - Tema Central" (s24427, flautín, 83 BPM); notas de metalófono y melódica (YouTube 2n8RfEiJ31c, g8AhYWPndxk), flauta (vr5Nm2fWy6M) y LaCuerda | alta |
  | Yo nunca vi televisión (coro) | coro | misma tablatura, compases 10–17; un La# se corrigió a Si según 4 fuentes | media-alta |
  | Bailan sin cesar | coro | Songsterr s5069183 (voz, 130 BPM) y tablatura de LaCuerda | alta |
  | Mi muñeca me habló | coro (2 veces) | notas: flauta dulce (YouTube kuEtVLZ2gwk, iguales) y Profe Andrea Martínez (xh-TRkjmx0o); ritmo: tablatura de Songsterr **generada por IA** (s3183773) | media: los silencios largos entre frases vienen de esa fuente |
  | El dinosaurio Anacleto | estrofa y pre-coro | Songsterr s3869622 (voz, 106 BPM); notas de melódica/teclado (YouTube _vTypr3yKwE, OwSymGJSvfo) | alta |
  | El dinosaurio Anacleto (coro) | coro | misma tablatura, compases 36–43 | media-alta |

  Descartadas por no tener fuentes confiables o que coincidan: Tangananica Tanganana, Mi equilibrio espiritual, Diente
  blanco no te vayas, Arwrarwrirwrarwro, Lala, Calcetín con rombos man. Las transcripciones se hicieron con un script a
  partir de los datos de las tablaturas (no a mano). Son melodías sin letra, como las demás de la librería.
- **Verificación:** cada melodía pasa un validador que reproduce el intérprete de PlayRtttl (formato, octavas 4–7, sin
  notas fuera de la tabla) y se generaron archivos .wav (onda cuadrada, como el zumbador) para escucharlas. Un programa
  con las 6 canciones compila para Nano (8.620 bytes; la RAM no cambia porque van en memoria de programa). En el entorno
  de prueba: lista del bloque, código generado y búsqueda "31 minutos".
- **Para agregar otra canción:** una línea más en `mpr_canciones.js`, con identificador que empiece con `MPR_`; validar
  el RTTTL antes (sin espacios, notas a–g con `#`, octavas 4–7).
- **Probado en el robot:** pendiente (que suenen reconocibles; "Mi muñeca me habló" es la de ritmo menos seguro).

### 2026-10-18 — Búsqueda de bloques: ajustes
- **Archivo:** `www/js/mpr_buscar.js`.
- Al abrir la búsqueda o mostrar resultados se cierra una lista desplegable que haya quedado abierta (antes quedaba encima
  del panel de resultados).
- Hasta 6 variantes por bloque (antes 4): al buscar "31 minutos" aparece el bloque "Tocar RTTTL" con cada canción.
- **Probado:** en el entorno de prueba.

### 2026-10-18 — Verificar/Subir: arduino-cli.exe con ruta completa
- **Problema:** al subir un programa apareció `"arduino-cli.exe" no se reconoce como un comando interno o externo`.
  Causa: la app se abrió desde una sesión con la variable de Windows `NoDefaultCurrentDirectoryInExePath=1` (opción de
  seguridad que impide ejecutar programas desde la carpeta actual) y `index.js` llamaba a `arduino-cli.exe` solo por su
  nombre, contando con que estuviera en la carpeta actual (`compilation/arduino`). Abriendo la app desde su acceso directo
  no pasa, pero en un PC que tenga esa opción activada fallaría igual.
- **Archivo:** `index.js`: en Windows se usa la ruta completa y entre comillas
  (`path.resolve(arduino_basepath, 'arduino-cli.exe')`). Verificar y Subir usan esa misma variable.
- **Verificado:** con la variable activa, el comando antiguo da el mismo error y el nuevo funciona (`arduino-cli version`).
- **Probado en la app:** pendiente (`python tools/probar.py` copia `resources/app/index.js`; luego F5 o reabrir la app).

### 2026-10-18 — Velocidad "Muy rápido" en los bloques de Otto
- **Pedido:** que Otto pueda moverse más rápido de lo que permite el menú actual (parte del análisis de los servos).
- **Archivo:** `www/lang/Arduino_es.js`, `OTTO9_MOVE_SPEED_CHOICE` (lo usan Mover, Bailar y Hacer): se agregó
  `["Muy rápido","1000"]` (T=1000 ms, la velocidad "Normal" del Otto original). Normal (2000), Lento (3500) y Rápido (1500)
  no cambiaron: los proyectos `.bloc` guardados siguen igual.
- **Nota:** solo tiene sentido con la librería nueva (limitador 240 grados/s, entrada anterior). Con el limitador
  antiguo (3), a T=1000 el paso quedaba en ~12 de 30 grados.
- **Probado en el robot:** pendiente.

### 2026-10-18 — Librería Otto: movimiento más rápido y sin saltos (limitador en grados/s real)
- **Pedido:** analizar cómo se mueven los servos (el código los limita para que "no se pisen"), revisar el oscilador y
  las instrucciones que mandan a 90 grados sin importar dónde está el servo, y ver si Otto puede moverse mejor y más
  rápido. Análisis completo, números y cómo probar en `ANALISIS_SERVOS.md`.
- **Hallazgos principales:** `OTTO_DIFF_LIMIT_DEFAULT = 3` (grados/s) dejaba el limitador en 1 grado por orden
  (~47 grados/s al caminar, ~25 en `_moveServos`): pasos recortados (caminar a T=1500 hacía ~18 de 30 grados) y por eso
  se bajaron las velocidades del menú. `Oscillator::attach()` mandaba a 90 sin trim al reconectar (después de cada
  `home()`); al encender los 4 servos arrancaban a la vez; tras una pausa el limitador dejaba saltar; el oscilador
  muestreaba cada 21 ms en vez de 20.
- **Archivos:** `compilation/arduino/userlibs/libraries/Otto/Otto.h`, `Otto.cpp`, `Oscillator.h`, `Oscillator.cpp`.
- **Qué se hizo:**
  - `OTTO_DIFF_LIMIT_DEFAULT` 3 → **240** grados/s (valor de OttoDIYLib). Cálculo en `long`, con redondeo; si pasaron
    más de `OSCILLATOR_MAX_DT_MS` (50 ms) desde la orden anterior, el primer paso es como un pulso de 20 ms (5 grados).
  - `Otto::init()`: lee los trims antes de conectar los servos y los conecta de a uno (`OTTO_ATTACH_DELAY_MS` = 200 ms).
  - `Oscillator::attach()`: envía la última posición conocida con trim antes de conectar; ya no reinicia la posición a 90.
  - `next_sample()` con `>=` (20 ms exactos) y `_numberSamples` con decimales.
  - `_moveSingle()`: fuera de rango se limita a 0–180 (antes mandaba a 90).
  - No se tocaron trayectorias, `home()`, round-robin ni bloques.
- **Verificación:** la librería real (antes y después) se compiló en el PC con un Arduino simulado (reloj virtual,
  pulsos de 20 ms, servos a 450 grados/s). Ahora caminar da el paso completo (30/20 grados) en Lento, Normal, Rápido y a
  T=1000; Inclinar dura 2,9 s (antes 4,1 s), Agitar pata 3,6 s (antes 7 s); el arranque ya no tiene 3+ servos a máxima
  velocidad a la vez. Compila para Nano con el arduino-cli instalado (10.046 bytes; antes 9.746; misma RAM).
- **Para volver al limitador anterior:** `#define OTTO_DIFF_LIMIT_DEFAULT 3` en `Otto.h`.
- **Probado en el robot:** **pendiente** (ver la lista de pruebas en `ANALISIS_SERVOS.md`, sección 4). No generar un
  instalador nuevo hasta probarlo.

### 2026-10-18 — Lupa: búsqueda de bloques
- **Pedido:** la lupa (arriba a la derecha) no tenía uso real: abría el monitor serie, que en MPR no sirve (no hay bloques
  de comunicación serie en el menú). Que sirva para buscar entre todos los bloques disponibles.
- **Archivos:**
  - `www/js/mpr_buscar.js` (nuevo, objeto `MPRBuscar`): índice de los bloques del menú visible y búsqueda.
  - `www/index.html`: carga `js/mpr_buscar.js`; botón `btn_buscar` (lupa) y caja `#buscar_bloques`. El botón del monitor
    serie (`btn_term`) quedó comentado (`<!-- OCULTO: ... -->`); su código en `index.js` no se tocó.
  - `www/css/blocklino.css`: caja de búsqueda, lupa activa (naranja) y títulos del panel de resultados.
  - `www/lang/msg_es.js` (textos `btn_buscar`, `buscar_*`) y `www/lang/code.js` (título y texto de ayuda de la caja).
- **Cómo funciona:** clic en la lupa → aparece una caja de texto a su izquierda. Al escribir (sin importar mayúsculas ni
  tildes) el panel lateral muestra los bloques que coinciden, agrupados por categoría, y se arrastran al área de trabajo
  como desde cualquier categoría. Busca en el texto de los bloques, en las opciones de sus listas (si coincide una opción,
  el bloque aparece con esa opción elegida: "triste" → Gesto [Triste] y Sonido [Triste]; "star" → Tocar RTTTL [StarWars]),
  en el nombre de la categoría y en la ayuda (tooltip). Sinónimos para palabras comunes (caminar → Mover, canción/música →
  Tocar RTTTL, saltar → Sube…) en `MPRBuscar.SINONIMOS`. Solo busca en las categorías visibles: los bloques ocultos no
  aparecen. Enter busca de inmediato; Esc o un nuevo clic en la lupa cierran; un clic en el área de trabajo cierra el panel.
  En modo código (editor de texto) la lupa se oculta.
- **Para volver al monitor serie:** en `index.html` quitar el comentario `OCULTO` de `btn_term` (y comentar `btn_buscar`).
- **Probado:** en el entorno de prueba (Electron 4.1.1 de la app con la interfaz del repositorio): búsquedas con y sin
  resultados, opciones elegidas, Variables/Funciones, arrastrar un resultado al área de trabajo, cerrar con Esc, con clic y
  con la lupa, cambio a modo código. En la app instalada: pendiente.

### 2026-10-18 — Estructura: bloque "Declaración" con ícono de hashtag
- **Pedido:** en la categoría Estructura, el bloque "Declaración" tenía un ícono de engranaje (igual que "Configuración");
  cambiarlo por un hashtag.
- **Archivo:** `www/lang/Arduino_es.js`: `Blockly.Msg.def = "#️⃣ Declaración";` (antes `"⚙️ Declaración"`). Es el texto del
  bloque `base_define`; nada más cambió. "Configuración" conserva el engranaje.
- **Nota:** se probaron `#️⃣`, `#` y `＃` en el Electron 4.1.1 de la app: `#️⃣` se ve como un ícono azul con "#", del mismo
  estilo que los íconos de las categorías; `#` y `＃` se ven como texto.
- **Probado:** en el entorno de prueba (Electron 4.1.1) se ve bien. En la app instalada: pendiente.

### 2026-10-18 — Otto: ocultar el bloque "Dance smooth criminal"
- **Pedido:** eliminar el bloque de baile "Dance smooth criminal" (categoría Otto).
- **Archivo:** `www/toolbox/toolbox_arduino_all.xml`, dentro de `CAT_OTTO`: la línea de `otto9_smooth` quedó comentada
  (`<!-- OCULTO: ... -->`), igual que "App code". Su definición y generador (`blocs&generateurs/otto.js`) no se
  borraron, así un proyecto `.bloc` antiguo que lo use sigue abriendo. Ningún ejemplo lo usa.
- **Para volver a mostrarlo:** en esa línea, quitar `<!-- OCULTO: ` y ` -->`.
- **Probado:** en un entorno de prueba con el Electron 4.1.1 de la app (copia en carpeta temporal) el bloque ya no
  aparece en Otto. En la app instalada: pendiente (`python tools/probar.py` y F5).

### 2026-10-02 — Instalador 1.2.0
- Versión subida a 1.2.0 en `package.json`. Instalados 7‑Zip y NSIS con `winget`.
- Generado con `python tools/build_installer.py --official C:\Users\Ultrabook\Downloads\ottoblockly.Setup.1.5.0.exe`:
  `dist\MPR_Blockly_Setup_1.2.0.exe`, 138 MB, SHA‑256 `e54bbe5cddc798a0879926154472b35fb9cb1617006fe80d594cb0d0cdbd54e3`.
- Incluye todos los cambios anteriores de esta bitácora. Drivers: solo CH340 se instala (casilla marcada); FTDI y CP210x quedan copiados pero sin instalar (decisión del usuario: por ahora no hacen falta).
- **Probado en otros PCs:** pendiente.

### 2026-10-02 — Revertida la traducción del bloque "map"
- **Pedido:** revertir el cambio del bloque `math_map` (texto "convertir… de… a…"). Se hizo con `git revert` de los commits
  `36243d3` y `3fbdfd4`; el bloque volvió a su texto original en inglés ("map / from / - / to / -") y a su tooltip anterior.
- **Nota:** si se retoma, ver esos commits con `git show`: cambiaban `math_map` en `blocs&generateurs/blockly_blocs.js` y
  agregaban textos `MPR_MAP*` en `lang/Arduino_es.js`.

### 2026-10-02 — Bloque de configuración de Otto: título en español
- **Problema:** el bloque `otto_configuration` (categoría Otto) mostraba "Configuracionundefined": su título es
  `OTTO_HOME_TEXT` + `OTTO_BIPED_TEXT`, y `OTTO_BIPED_TEXT` solo existía en inglés ("biped").
- **Archivo:** `www/lang/Arduino_es.js`: se agregó `Blockly.Msg.OTTO_BIPED_TEXT = " Otto";` junto a `OTTO_HOME_TEXT`.
  El título ahora es "Configuracion Otto". Nada más cambió en el bloque.
- **Probado en la app:** pendiente.

### 2026-10-02 — Matemática: ocultar los bloques "Casting"
- **Pedido:** ocultar en la categoría Matemática los bloques Casting a Byte, a unsigned Int, a Int y a Float.
- **Archivo:** `www/toolbox/toolbox_arduino_all.xml`, final de `CAT_MATH`: `conversion_tobyte`, `conversion_tounsignedint`,
  `conversion_toint` y `conversion_tofloat` quedaron comentados (`<!-- OCULTO: ... -->`). Los bloques y generadores
  (`blocs&generateurs/blockly_blocs.js`) no se tocaron; los proyectos antiguos siguen abriendo.
- **Para volver a mostrarlos:** quitar `<!-- OCULTO: ` y ` -->` en esas 4 líneas.
- **Probado en la app:** pendiente.

### 2026-10-02 — Listas desplegables largas: alto según espacio disponible y pegadas al campo
- **Problema:** la lista de canciones del bloque "Tocar RTTTL" (Zumbador) era tan larga que se salía de la ventana.
  Un primer arreglo solo con CSS (`max-height`, commit `2a69846`) dejaba la lista pegada al borde superior y lejos del bloque:
  `Blockly.FieldDropdown.prototype.showEditor_` (en `blockly.min.js`) calcula la posición con el alto completo
  de la lista (`scrollHeight`, ~760 px), no con el alto limitado.
- **Archivos:**
  - `www/js/mpr_fixes.js` (nuevo): reemplaza `showEditor_` limitando el alto al espacio libre arriba o abajo del campo
    (se abre hacia donde más cabe), con barra de desplazamiento, y deja la opción actual a la vista. `blockly.min.js` NO se modifica.
  - `www/index.html`: carga `js/mpr_fixes.js` justo después de `js/blockly.min.js`.
  - `www/css/blocklino.css`: se quitó el CSS del primer intento (quedó idéntico al original).
- **Alcance:** afecta a todas las listas desplegables de bloques. Es un reemplazo de una función de Blockly: si algún día se
  actualiza Blockly, revisar `mpr_fixes.js`. Para desactivarlo, quitar su línea `<script>` de `index.html`.
- **Ajuste posterior:** la lista se abría hasta el borde superior y su primer elemento quedaba bajo `#toptitle`
  (`-webkit-app-region: drag`, que captura los clics). Ahora la lista se abre SIEMPRE hacia abajo del campo con el alto que
  quepa; solo si quedan menos de 90 px debajo se abre hacia arriba, sin pasar de la barra de título. Además
  `blocklino.css` pone `-webkit-app-region: no-drag` en `.blocklyWidgetDiv` y `.blocklyDropDownDiv`.
- **Ajuste 2:** al llegar al final de la lista con la rueda se desplazaba toda la ventana (fondo azul abajo), porque
  `Blockly.WidgetDiv.position()` deja el contenedor con el alto de toda la ventana. Ahora `mpr_fixes.js` fija el alto del
  contenedor al de la lista y usa `overscroll-behavior: contain`; `blocklino.css` pone `html, body { overflow: hidden; }`.
- **Cómo verificar:** bloque RTTTL abajo en la pantalla → la lista termina justo encima del campo; arriba → se abre hacia abajo;
  con la rueda del mouse se llega a la última canción y se puede elegir.
- **Probado en la app:** pendiente.

### 2026-10-02 — Bloques de sonido de Otto movidos a "Zumbador"
- **Pedido:** los bloques de sonido de la categoría Otto deben estar en la categoría "Zumbador".
- **Archivo:** `www/toolbox/toolbox_arduino_all.xml`. Se movieron de `CAT_OTTO` al inicio de `CAT_BUZZER` (nombre "Zumbador"):
  `otto_sound` (`Otto.sing`), `otto_tone` (`Otto._tone`), `otto_tonehz` (`Otto._tone` con Hz/duración/silencio) y
  `otto_bendtone` (`Otto.bendTones`). Solo cambió su lugar en el menú; los bloques y generadores no se tocaron.
- **Para devolverlos a Otto:** cortar esas 4 líneas `<block ...>` de `CAT_BUZZER` y pegarlas en `CAT_OTTO`.
- **Probado en la app:** pendiente.

### 2026-10-02 — Categoría Otto: quitar "App code" y "Guardar Trims en EEPROM"
- **Pedido:** eliminar de la categoría Otto los bloques "App code" y "Guardar Trims en EEPROM".
- **Archivo:** `www/toolbox/toolbox_arduino_all.xml`, dentro de `CAT_OTTO`: las líneas de `otto9_app` y `otto_eeprom`
  quedaron comentadas (`<!-- OCULTO: ... -->`). Sus definiciones y generadores en `blocs&generateurs/otto.js` NO se
  borraron, así los proyectos `.bloc` antiguos que los usen siguen abriendo.
- **Cómo volver a mostrarlos:** en esas dos líneas, quitar `<!-- OCULTO: ` y ` -->`, dejando `<block type="..."></block>`.
- **Probado en la app:** pendiente.

### 2026-10-02 — Categoría "Texto" oculta
- **Pedido:** ocultar toda la categoría "Texto"; no es necesaria.
- **Archivo:** `www/toolbox/toolbox_arduino_all.xml`, línea 3 (`defaultCategories1`, la lista de categorías que se muestran):
  se quitó `CAT_TEXT`. La definición de la categoría y sus bloques siguen intactos en el archivo.
- **Cómo volver a mostrarla:** en esa misma línea, agregar `CAT_TEXT,` entre `CAT_MATH,` y `CAT_FUNCTIONS`
  (queda `...CAT_LOGIC,CAT_MATH,CAT_TEXT,CAT_FUNCTIONS,CAT_VARIABLES`). Luego `python tools/probar.py` y F5.
- **Nota:** el orden de esa lista es el orden del menú; cualquier categoría se oculta o muestra igual.
- **Probado en la app:** pendiente.

### 2026-10-02 — Sensores: solo ultrasonido; el resto oculto (se activa en el código)
- **Pedido:** en la categoría "Sensores" dejar solo el bloque de configuración del ultrasonido y el de lectura de distancia;
  los demás ocultos, sin borrarlos. La opción de mostrarlos NO debe ser accesible desde la interfaz, solo desde el código.
- **Contexto:** la categoría "Sensores" visible es `CAT_ultrason` (la que usa `defaultCategories1`), no `CAT_SENSORS`.
  Los generadores del ultrasonido (`ultrasonic_sensor`, `ultrasonic_distance` en `blocs&generateurs/sensors.js`) ya
  producen el código esperado (`ultrasound_distance_simple()`); no se tocaron.
- **Archivos:**
  - `www/toolbox/toolbox_arduino_all.xml`: `CAT_ultrason` queda con 2 bloques; los demás (botón, táctil, sonido, DHT,
    potenciómetro, joystick, encoder rotatorio) pasaron a la categoría `CAT_SENSORES_EXTRA` (nada se borró).
  - `www/lang/Arduino_es.js`: nombre "Sensores extra".
  - `www/js/blocklino.js`: `buildToolbox` agrega `CAT_SENSORES_EXTRA` tras `CAT_ultrason` solo si
    `BlocklyDuino.mostrarSensoresExtra` es `true`.
- **Cómo volver a mostrar los sensores extra:** en `www/js/blocklino.js`, línea 6, cambiar
  `BlocklyDuino.mostrarSensoresExtra = false;` por `= true;`. Luego `python tools/probar.py` y F5
  (o regenerar el instalador). Aparece la categoría "Sensores extra" bajo "Sensores".
- **Historial:** primero se hizo con un botón en la interfaz (commit `fceb323`); se retiró por pedido del usuario.
- **Probado en la app:** pendiente.

### 2026-10-01 — Placa predeterminada: Nano
- **Pedido:** que Nano (bootloader nuevo) quede seleccionada por defecto.
- **Archivo:** `www/js/blocklino.js` línea 5: `BlocklyDuino.selectedCard = "nanooptiboot"` (antes `"nano"`, o sea Nano Old).
- **Notas:** solo aplica cuando no hay placa guardada (primera vez o si la guardada ya no existe en el menú).
  Un PC que ya tenga guardada "Nano Old" la conserva; se cambia a mano en el selector.
- **Commit:** ver `git log`. **Probado en la app:** pendiente.

### 2026-10-01 — Selector de placa: solo Nano y Nano Old
- **Pedido:** que solo aparezcan Nano y Nano Old; las demás placas no se usan.
- **Archivo:** `www/index.html` (dos listas: selector de la barra superior y ventana de información de la placa).
- **Qué se hizo:** se quitaron las opciones MRTduino, ZUM BT-328, Uno, Leonardo, Micro y Mega (12 líneas en total).
  Se conservó el fin de línea CRLF del archivo.
- **Notas:** `BlocklyDuino.loadConfig` (`www/js/blocklino.js`) ya vuelve a la placa predeterminada si
  había guardada una que ya no está en el menú. Los perfiles en `www/js/boards.js` no se tocaron.
- **Commit:** `b6cf762`. **Probado en la app:** pendiente.

### 2026-10-01 — Buzzer: `buzzer` vs `Buzzer`
- **Problema:** el bloque de configuración de Otto define `#define Buzzer 13`, pero los bloques de sonido
  (`play`, `noTone`, melodías, `cute`; en `www/blocs&generateurs/audio.js`) generan `tone( buzzer, ...)`
  en minúscula. C++ distingue mayúsculas: error `'buzzer' was not declared`.
- **Archivo:** `www/blocs&generateurs/ottoesp.js`, bloque `otto_configuration`.
- **Qué se hizo:** además del `#define Buzzer`, ahora agrega `const int buzzer = <pin>;` con la clave
  `definitions_['setup_buzzer']`, la misma que usa `buzzer_init`, para que no se duplique si se usan ambos bloques.
  No se tocó `audio.js`.
- **Resultado:** compila y el buzzer suena (verificado por el usuario).
- **Commit:** `9c32612`.

### 2026-10-01 — Preparación del entorno
- Se ejecutó `PREPARAR_CODIGO.bat` (clona `MPR_Blockly.bundle` y aplica `actualizacion.bundle`).
  Quedó en `32ad6ed` (incluye `tools/probar.py`). El aviso "No such remote: 'origin'" es inofensivo.

### 2026-11-08 — Contorno verde del botón cargar y placeholder del buscador cortado
- **Pedido / problema:** el botón de cargar código (flecha) tenía un contorno verde; en el buscador (chat) el texto "Dile a Otto qué bloque buscas..." se cortaba.
- **Archivos:** `www/css/blocklino.css`.
- **Qué se hizo:** `.btn-arduino` ahora fuerza `border-color: #FF5700` (el borde verde venía de bootstrap.min.3.3.6.css); `#buscar_bloques` pasa de 240 px a 330 px de ancho.
- **Commit:** (ver git log)  **Probado en la app:** no

### 2026-11-08 — Recorrido inicial "Conoce a Otto"
- **Pedido / problema:** walkthrough corto y sencillo que muestre qué hace cada zona sin revelar demasiado, para fomentar la exploración.
- **Archivos:** `www/js/mpr_tour.js` (nuevo), `www/index.html`, `www/lang/msg_es.js`, `www/lang/code.js`, `www/css/blocklino.css`.
- **Qué se hizo:** 7 pasos con globo de Otto y foco resaltado (menú de bloques, área de trabajo, ejemplos, puerto USB, flecha de enviar, chat/código). Aparece solo la primera vez (localStorage `mpr_tour_visto`), con botón Saltar siempre visible; el botón "?" de la barra lo abre de nuevo. Los pasos cuyo elemento no se ve se omiten.
- **Commit:** (ver git log)  **Probado en la app:** pendiente

### 2026-11-08 — Mascota Otto 3D con consejos y colores personalizables
- **Pedido / problema:** mascota 3D animada (tipo clip) que dé consejos y respuestas a errores comunes (bloques sueltos, puerto COM, errores de compilación); colores personalizables por pieza; modelo liviano. Además, el avatar de Otto en el recorrido no se veía sobre fondo blanco.
- **Archivos:** `www/js/mpr_mascota.js`, `mpr_otto3d.js`, `mpr_consejos.js`, `three.min.js` (nuevos), `www/media/otto3d.js` (generado), `tools/convertir_otto.js`, `www/index.html`, `lang/msg_es.js`, `css/blocklino.css`, `DOCUMENTACION_TECNICA.md`.
- **Qué se hizo:** Otto 3D armado con las piezas del 3MF simplificadas (~4.300 triángulos, 10 llamadas de dibujo); animaciones: reposo, saludo, celebrar, pensar, alerta; ojos que siguen el mouse; menú, colores por pieza (guardados), esconder y avisos tranquilos. Consejos: bloques sueltos, sin puerto, placa Nano/Nano Old, puerto ocupado/desconectado, variable no declarada, repetidos, programa grande, error genérico, y éxito al verificar/cargar. Avatar del recorrido con círculo azul.
- **Notas:** probado en Chrome moderno (menú, colores, detectores). Pendiente probar en Electron 4 (three r128 y WebGL).
- **Commit:** (ver git log)  **Probado en la app:** no

### 2026-11-08 — Otto 3D: orientación de piezas y ojos como sensor ultrasónico
- **Pedido / problema:** las piezas del Otto 3D estaban mal orientadas y armadas; los ojos blancos debían ser el sensor ultrasónico.
- **Archivos:** `www/js/mpr_otto3d.js`, `DOCUMENTACION_TECNICA.md`.
- **Qué se hizo:** con las fotos de `Fotos otto armado/` y la inspección de las piezas originales del 3MF se corrigió el giro de todas las piezas (altura en z, frente de la cabeza en -y), las medidas del ensamblado, la posición de piernas (x = ±23) y pies (placa hacia afuera) y los pivotes de cuello, cadera y tobillo. Los ojos pasaron a ser dos sensores ultrasónicos (cilindro plateado, malla oscura y rejilla) que se agrandan un poco con alerta/celebrar; se quitaron pupilas y parpadeo.
- **Commit:** (ver git log)  **Probado en la app:** no (probado en Chrome moderno)

### 2026-11-08 — Otto 3D: cabeza fija al cuerpo y giro de 360°
- **Pedido / problema:** la cabeza se movía por separado y parecía flotar atravesando el cuerpo; el robot real la tiene fija. Además se pidió que el modelo gire para verlo por todos lados.
- **Archivos:** `www/js/mpr_otto3d.js`, `www/js/mpr_mascota.js`, `www/lang/msg_es.js`, `DOCUMENTACION_TECNICA.md`.
- **Qué se hizo:** cabeza, cuerpo, sensores y piernas cuelgan de un pivote en los tobillos; las animaciones inclinan/giran todo el bloque y solo las piernas se mueven aparte (caderas). Los pies quedan planos. Giro continuo de ~14 s por vuelta, que vuelve al frente al animar; el menú tiene "Quedarme quieto / Girar para verme" (se guarda). Girar sube el dibujo de 12 a 30 cuadros/s mientras la mascota está visible.
- **Commit:** (ver git log)  **Probado en la app:** no (probado en Chrome moderno)

### 2026-11-08 — Otto 3D: más detalle, cabeza más baja y paseos naturales
- **Pedido / problema:** los polígonos eran muy pocos y no se veían los logos; la cabeza dejaba un hueco con el cuerpo; el giro continuo era artificial (se quería que gire de forma natural al moverse por la mesa de trabajo, de vez en cuando).
- **Archivos:** `tools/convertir_otto.js`, `www/media/otto3d.js` (regenerado), `www/js/mpr_otto3d.js`, `www/js/mpr_mascota.js`, `www/lang/msg_es.js`, `DOCUMENTACION_TECNICA.md`.
- **Qué se hizo:** modelo con `simplify` (colapso de aristas) a ~24.000 triángulos (16 llamadas de dibujo, ~500 KB): se ven los agujeros reales del sensor y los logos en relieve; los sensores quedan dentro de los agujeros. Cabeza 6 mm más abajo (metida en el borde del cuerpo). Se quitó el giro continuo: ahora cada 30—80 s Otto camina a otro punto de la mesa girándose de perfil hacia donde va (caderas alternadas, tobillos levantan cada pie, cuerpo se balancea) y se vuelve de frente, o da una vuelta completa en su lugar. Se interrumpe si se le hace clic, se arrastra o va a hablar. Opción del menú "Quedarme en mi lugar / Pasear por la mesa".
- **Commit:** (ver git log)  **Probado en la app:** no (probado en Chrome moderno: paseo completo y regreso de frente)

### 2026-11-08 — Otto 3D: frente corregido y modelo completo
- **Pedido / problema:** el frente del robot se veía raro; consulta sobre usar el modelo con todos los polígonos o uno que muestre bien los detalles.
- **Archivos:** `tools/convertir_otto.js`, `www/media/otto3d.js` (ahora completo), `www/media/otto3d_liviano.js` (nuevo), `www/js/mpr_otto3d.js`, `www/js/mpr_mascota.js`, `DOCUMENTACION_TECNICA.md`.
- **Causa:** `MeshLambertMaterial` de three r128 ignora `flatShading`: las caras grandes se veían suavizadas (efecto embudo alrededor de los sensores, cuerpo "inflado"), y la simplificación inclinaba un poco el frente.
- **Qué se hizo:** sombreado plano real (geometría no indexada con normales por triángulo); modelo completo de ~123 mil triángulos en formato binario compacto (1,3 MB); modelo liviano de respaldo (~26 mil) para equipos sin aceleración gráfica o lentos, con cambio automático sin reiniciar.
- **Commit:** (ver git log)  **Probado en la app:** no (probado en Chrome moderno: ambos modelos, frente y 3/4 con logos en relieve)

### 2026-11-08 — Otto 3D: sensores centrados en los agujeros
- **Pedido / problema:** los sensores (ojos) no quedaban bien centrados en su agujero.
- **Archivos:** `www/js/mpr_otto3d.js`, `DOCUMENTACION_TECNICA.md`.
- **Causa:** al bajar la cabeza 3 mm no se recalculó la altura de los sensores: quedaban ~2,6 mm más abajo que los agujeros.
- **Qué se hizo:** se midieron los agujeros en la cabeza original (centros x = ±13,37 mm, 6,0 mm sobre el centro de la cabeza, 16,75 mm de diámetro) y se ajustó la posición (y = 109,5 del robot), el radio de la lata (8,1) y la malla (6,5).
- **Commit:** (ver git log)  **Probado en la app:** no (probado en Chrome moderno con acercamiento a la cara)

### 2026-11-08 — Ventana principal siempre maximizada
- **Pedido / problema:** que la app se abra siempre en ventana completa, sin tener que maximizarla cada vez, y evitar que se use en ventanas pequeñas.
- **Archivos:** `electronApp.js`, `www/index.html`, `DOCUMENTACION_TECNICA.md`.
- **Qué se hizo:** la ventana se crea oculta y se muestra maximizada al estar lista; si se intenta restaurar (`unmaximize`) se vuelve a maximizar. El botón de maximizar queda oculto (el script `factory.js` necesita que exista). Minimizar y cerrar siguen igual.
- **Notas:** requiere reabrir la app (cambia `electronApp.js`). El commit parte del `electronApp.js` de HEAD (mínimo 1100×650); en el disco había un cambio sin commit (mínimo 1060×700) que no se incluyó.
- **Commit:** (ver git log)  **Probado en la app:** no (no se pudo abrir una segunda instancia con la app en uso)

### 2026-11-08 — Otto 3D siempre visible, también sin GPU dedicada
- **Pedido / problema:** el modelo 3D debe verse siempre, también en notebooks sin GPU dedicada (gráfica integrada o sin aceleración).
- **Archivos:** `tools/convertir_otto.js`, `www/media/otto3d_minimo.js` (nuevo), `www/js/mpr_mascota.js`, `www/js/mpr_otto3d.js`, `electronApp.js`, `DOCUMENTACION_TECNICA.md`.
- **Qué se hizo:** tercer modelo "mínimo" (~5.500 triángulos); si el equipo dibuja por CPU se parte del mínimo en modo económico (sin suavizado de bordes, menos cuadros/s); si va lento baja solo completo → liviano → mínimo sin reiniciar; `ignore-gpu-blacklist` en Electron para aprovechar gráficas integradas. El respaldo 2D queda solo para cuando WebGL no se puede crear.
- **Notas:** el commit parte del `electronApp.js` de HEAD (no incluye el cambio previo sin commit de tamaños mínimos). Requiere reabrir la app.
- **Commit:** (ver git log)  **Probado en la app:** no (probado en Chrome moderno: nivel mínimo y descenso encadenado)

### 2026-11-08 — Instalador 1.4.0
- **Pedido / problema:** generar el instalador con los cambios nuevos para probarlo en un notebook sin GPU.
- **Archivos:** `package.json` (versión 1.4.0), `DOCUMENTACION_TECNICA.md`; salida `distMPR_Blockly_Setup_1.4.0.exe` (139 MB, SHA-256 `5c53b29aeb7312f86576974edcaea3f9e25167232a0d7e04f3f8de3b8b44081a`).
- **Qué se hizo:** se instalaron 7-Zip 26.06 y NSIS 3.13 con winget; se descargó `ottoblockly.Setup.1.5.0.exe` (259 MB, SHA-256 verificado) a una carpeta temporal; `python tools/build_installer.py --official ...`. Verificado que el contenido incluya mascota, recorrido, los tres modelos 3D, `three.min.js` y `electronApp.js` con maximizado y `ignore-gpu-blacklist`.
- **Notas:** el `electronApp.js` incluido es el del disco (con el cambio previo sin commit de tamaño mínimo 1060×700). En el notebook sin GPU, abrir F12 y buscar `[Otto 3D]` para ver qué modelo eligió y cuántos cuadros/s.
- **Commit:** (ver git log)  **Probado en la app:** no (pendiente: notebook sin GPU)

### 2026-11-08 — Documentación de traspaso y reparación de la bitácora
- **Pedido / problema:** dejar todo anotado para seguir trabajando desde el notebook, donde se revisarán algunos temas pendientes.
- **Archivos:** `DOCUMENTACION_TECNICA.md` (sección 13 nueva; los bloques 4.6 y 4.7 se movieron a su lugar dentro de la sección 4), `CLAUDE.md`, `tools/servidor_local.js` (nuevo), `BITACORA.md`.
- **Qué se hizo:** estado actual, qué no está en git, checklist de pruebas en el notebook, pendientes, cómo preparar otro PC y trampas conocidas. `tools/servidor_local.js` sirve `www/` en 127.0.0.1 para ver la mascota en un navegador. Se reparó la codificación de las entradas del 2026-11-08 de esta bitácora (33 líneas escritas por error en `latin1`: acentos, rayas y flechas).
- **Commit:** (ver git log)  **Probado en la app:** no aplica

### 2026-11-08 — Fuentes del Otto 3D a git
- **Pedido / problema:** guardar en el repositorio el zip del 3MF y las fotos del robot armado, necesarios para regenerar los modelos 3D.
- **Archivos:** `Otto DIY 2026.3mf.zip`, `Fotos otto armado/`, `DOCUMENTACION_TECNICA.md` (13.2 actualizado).
- **Commit:** `d8558f9` (fuentes) y el siguiente (documentación)  **Probado en la app:** no aplica

### 2026-11-08 — Recorrido: animación fluida en gráfica integrada
- **Pedido / problema:** en el notebook de pruebas (Ryzen 5 4600H con gráfica Radeon integrada, pantalla al 125 %) la animación del recorrido "Conoce a Otto" iba muy lenta. Los PCs donde se usará el programa tienen gráfica integrada, sin GPU dedicada.
- **Archivos:** `www/css/blocklino.css` (`#mpr_tour_velo`).
- **Causa (medida en la app instalada por DevTools, ver `DOCUMENTACION_TECNICA.md` 13.7):** el foco oscurece la pantalla con `box-shadow: 0 0 0 9999px`, y el velo era una capa propia (por quedar sobre el canvas de Otto) de 25.287 × 25.907 píxeles. Cada cuadro de la transición la invalidaba entera: la GPU se quedaba sin memoria para las teselas (226 avisos "tile violates memory policy") y la pantalla esperaba a la GPU (325 "Swap throttled"). Resultado: 15–30 cuadros/s con tirones de 100–400 ms.
- **Qué se hizo:** `overflow: hidden` recorta el velo a la ventana (lo de afuera nunca se veía) y `will-change: transform` lo deja siempre en capa propia (también con Otto escondido), así el recorrido nunca repinta Blockly. El velo solo existe mientras el recorrido está abierto. Se ve igual: capturas comparadas píxel a píxel (solo cambia el remuestreo subpíxel del avatar).
- **Notas:** en la app instalada pasó a 60 cuadros/s en los 8 pasos, 0 avisos de memoria, 6 "Swap throttled" y 61 % menos rasterizado. Sin GPU (`--disable-gpu`): de 43–58 a 60 cuadros/s. No quitar esas dos líneas.
- **Commit:** (ver git log)  **Probado en la app:** sí (`C:\MPRBlockly` en el notebook NB0003, copiado con `probar.py`)

### 2026-11-08 — Recorrido de la primera vez: espera a que Otto 3D termine de cargar
- **Pedido / problema:** parte de la revisión de rendimiento para PCs con gráfica integrada. Al arrancar, la carga de Otto 3D bloquea la página unos 250 ms en este notebook (decodificar el modelo y primer dibujo); empieza 1,2 s después de `load` y terminaba solo ~280 ms antes de que apareciera el recorrido (`load` + 1,8 s). En un PC 1,5–2,5 veces más lento ambas cosas se cruzan y se nota un tirón justo al aparecer el recorrido.
- **Archivos:** `www/js/mpr_tour.js` (`MPRTour.iniciarCuandoListo`), `www/js/mpr_mascota.js` (`MPRMascota.cargando3D`).
- **Qué se hizo:** la mascota marca `cargando3D` mientras carga three.js y el modelo, hasta después del primer cuadro (o del respaldo 2D). El recorrido automático de la primera vez espera a que termine, revisando cada 150 ms y como máximo 6 s más. No se repite si mientras tanto lo abrieron con "?". Con Otto escondido no espera. El botón "?" funciona igual que antes.
- **Notas:** en este notebook no cambia nada visible: Otto queda listo en `load` + 1,47 s y el recorrido aparece en `load` + 1,81 s.
- **Commit:** (ver git log)  **Probado en la app:** sí (primera vez simulada borrando `mpr_tour_visto` y restaurándolo; botones Siguiente/Atrás/Saltar y teclas)

### 2026-11-08 — Otto 3D: sin recorte por vista (arranque más liviano, misma imagen)
- **Pedido / problema:** parte de la revisión de rendimiento. El perfil del arranque mostró ~28 ms (en frío) calculando la esfera envolvente de cada pieza (`computeBoundingSphere`, que recorre los ~370 mil vértices del modelo completo) y probándola en cada cuadro. Ese trabajo no sirve: Otto siempre cabe entero en su canvas.
- **Archivos:** `www/js/mpr_otto3d.js` (`MPROtto3D.armar`).
- **Qué se hizo:** `frustumCulled = false` en todas las mallas, también al bajar de nivel de modelo.
- **Notas:** imagen idéntica comprobada píxel a píxel (`gl.readPixels`, 0 bytes distintos en reposo y en mitad de "celebrar"). El primer cuadro de Otto pasó de 114 a ~65 ms en este notebook. También se probó compartir el sombreador del sensor (`flatShading` en `matPlata`), pero no hay nada que ganar: `MeshLambertMaterial` de r128 no tiene esa propiedad y ya hay solo 2 programas. Por eso salen 4 avisos "'flatShading' is not a property" en la consola, que son inofensivos.
- **Commit:** (ver git log)  **Probado en la app:** sí (prueba de humo: animaciones, paseo, menú, colores, esconder/mostrar, bajar a liviano)

### 2026-11-08 — Revisión de rendimiento y de OneDrive; herramienta para medir la app real
- **Pedido / problema:** revisar la documentación y que todo esté sincronizado con OneDrive. Además, revisar en detalle el uso de recursos para PCs con gráfica integrada, sin perder calidad ni funciones, probando en el programa instalado y no en la versión de navegador.
- **Archivos:** `tools/medir_app.mjs` (nuevo), `DOCUMENTACION_TECNICA.md` (convención de rutas, 3.2, 6.5 nueva, 13.1–13.4, 13.6 y 13.7 nueva), `BITACORA.md`.
- **Qué se hizo:**
  - OneDrive: los 5.136 archivos y 1.481 carpetas del proyecto (incluido `.git`) están sincronizados. Solo queda fuera `www/media/Thumbs.db`, que OneDrive excluye siempre. Faltan dos PNG de Firebase cuya ruta mide 282 caracteres y que no están en ninguna parte. `git fsck` sin errores.
  - Rendimiento: mediciones en la app instalada por DevTools (13.7) y las tres correcciones de los commits anteriores.
  - `tools/medir_app.mjs` permite repetir las mediciones en los PCs del colegio (6.5).
- **Notas:** el consumo en reposo es casi todo la animación de Otto (~9 % de un núcleo); bajarlo cambiaría lo que se ve, así que queda a decisión del usuario. En 13.4 quedó anotado el error heredado de `microbit.js` y `typing.js:95`.
- **Commit:** (ver git log)  **Probado en la app:** sí (las cuatro órdenes de la herramienta contra `C:\MPRBlockly`)

### 2026-11-08 — Instalador de un clic y desatendido, menos avisos de seguridad y firma digital lista
- **Pedido / problema:** al ejecutar el instalador apareció un aviso de que el programa podía ser peligroso. Se pidió reducirlo al mínimo y que la instalación sea lo más desatendida posible.
- **Archivos:** `build/installer.nsi`, `build/cerrar_app.nsh` (nuevo), `tools/build_installer.py`, `DOCUMENTACION_TECNICA.md` (7.1, 7.2 y 7.5 nueva), `LEEME_MPR.md`, `BITACORA.md`.
- **Causa de los avisos:** nada está firmado: ni el instalador, ni `MPR Blockly.exe`, ni `Desinstalar.exe`, y 55 de los 57 ejecutables instalados tampoco. Por eso Windows muestra "editor desconocido" al pedir permisos y SmartScreen avisa si el archivo viene de Internet. El antivirus también puede desconfiar: Acronis puso en cuarentena un ejecutable de prueba que usaba `taskkill`.
- **Qué se hizo:**
  - Instalador de un clic: solo barra de progreso (sin bienvenida, licencia, carpeta ni pantalla final); al terminar se cierra y abre la app. Solo corre una copia a la vez.
  - Si la app está abierta, la cierra sola de forma ordenada (`WM_CLOSE`, como la X), sin `cmd`, `tasklist` ni `taskkill`. La app respalda los bloques y los recupera al abrirse.
  - Modo desatendido `/S` para instalar y desinstalar, sin ventanas y sin abrir la app. Devuelve código 2 si no pudo cerrar la app, y deja `QuietUninstallString` en el registro.
  - Firma digital opcional al generar (`--firma` o `MPR_FIRMA`): instalador, desinstalador y los 77 ejecutables y bibliotecas que vienen sin firma, con sello de tiempo.
  - Documentación de los avisos, de cómo distribuir sin la marca de Internet y de las opciones de certificado (7.5).
- **Notas:**
  - Probado: compilación del instalador.
  - Probado: cierre ordenado con un ejecutable de prueba contra la app real, en modo silencioso y con ventana. Se cierra en ~1,2 s y guarda el trabajo (`loadOnceBlocks`).
  - Probado: firma con un certificado autofirmado de prueba (instalador, desinstalador y lote de ejecutables), respetando las firmas existentes. El certificado se borró.
  - Instalación de un clic de la 1.4.1 sobre la 1.4.0 con la app abierta: la app se cerró sola y guardó el trabajo. Terminó con código 0 en 155 s y reabrió la app sin permisos de administrador (desde explorer.exe). Dejó versión 1.4.1 en el registro, accesos directos y permisos correctos.
  - Con la app abierta, `Desinstalar.exe /S` cerró la app y terminó con código 0 en 72 s, sin dejar restos en `C:\MPRBlockly`, en el registro, en los accesos directos ni en la asociación de `.bloc`.
  - Después, `/S` instaló con código 0 en 109 s, sin ventanas y sin abrir la app. Dejó permisos, accesos, `.bloc` y driver CH340 correctos.
  - Las preferencias del usuario (recorrido visto, colores y posición de Otto) se conservaron.
  - El primer intento se canceló porque Windows cierra el permiso de administrador si nadie responde en ~2 minutos.
- **Commit:** (ver git log)  **Probado en la app:** sí (instalación de un clic, desinstalación e instalación silenciosas en el notebook NB0003)

### 2026-11-08 — Versión 1.4.1 e instalador generado
- **Pedido / problema:** repartir las correcciones de rendimiento (recorrido fluido) y el instalador de un clic y desatendido.
- **Archivos:** `package.json` (1.4.1), `DOCUMENTACION_TECNICA.md` (7.4, 13.1, 13.4). Salida: `dist\MPR_Blockly_Setup_1.4.1.exe` (139 MB, SHA-256 `49749d6553d28c30677b3ddcc3c070064c11034d39e60ab5935b29791c7a90c9`), sin firma digital.
- **Qué se hizo:** `py tools/build_installer.py --official <Descargas>\ottoblockly.Setup.1.5.0.exe` en el notebook (tardó 14 min); el SHA-256 del instalador oficial coincidió.
- **Commit:** (ver git log)  **Probado en la app:** sí (ver la entrada anterior; es la versión instalada en el notebook)

### 2026-11-08 — Proyecto nuevo con la mesa lista y aviso de bloques repetidos
- **Pedido / problema:** mejorar la experiencia de aprendizaje de la versión del evento (Etapa 1, punto 1). La mesa partía vacía (la primera vez y con "Nuevo") y el niño tenía que saber que primero van Configuración + Bucle y Configuración Otto. El usuario pidió que, si el niño borra la configuración, no se vuelva a poner sola salvo al empezar otro proyecto.
- **Archivos:** `www/js/blocklino.js` (`BlocklyDuino.PLANTILLA`, `cargarPlantilla`, `loadBlocks`, `discard`), `www/js/mpr_mascota.js` (`UNICOS`, `revisarRepetidos`), `www/js/mpr_consejos.js` (`REPETIDO_ESTRUCTURA`, `REPETIDO_CONFIG`), `DOCUMENTACION_TECNICA.md` (4.7, 4.8).
- **Qué se hizo:** al abrir sin trabajo guardado (o con la mesa vacía) y con "Nuevo", la mesa trae Configuración + Bucle con Configuración Otto (pines 2-5 y 13), como el paso 4 del manual. Como el manual pide arrastrar esos bloques, si el niño agrega un segundo Configuración + Bucle (el bloque lo quita solo, como antes) o un segundo Configuración Otto, Otto le explica que ya están.
- **Notas:** el manual de programación 2025 (`Manuales/`) dice "Toma un bloque de Configuración + Bucle, un bloque de Configuración Otto..."; conviene ajustar ese paso en el próximo panfleto.
- **Commit:** (ver git log)  **Probado en la app:** sí (copia de prueba con el `www` del repo: "Nuevo" deja la plantilla; avisos de los dos repetidos)

### 2026-11-08 — Subir a Otto: puerto y placa automáticos, pasos claros, errores explicados y precompilación
- **Pedido / problema:** Etapa 1, puntos 2 a 5. El puerto solo se elegía solo si el robot estaba enchufado al abrir la app; había que acertar entre Nano y Nano Old (con la equivocada avrdude tarda ~103 s en fallar, medido con el Otto del usuario); al subir solo se veía "Verificando ..." con una ruedita; los errores salían en texto técnico en inglés, y la primera compilación tardaba 21 s en el notebook (5,5 s las siguientes).
- **Archivos:** `www/js/mpr_subida.js` (nuevo), `index.js` (inicia el módulo; la flecha lo usa; `uploadOK` con una línea para el niño), `www/index.html`, `www/css/blocklino.css`, `www/lang/msg_es.js` (`sub_*`, `tour_puerto`), `www/lang/Arduino_es.js` (`com2`), `www/js/mpr_consejos.js` (`explicar`, textos de puerto sin "elige la placa"), `www/js/mpr_mascota.js` (lee el detalle técnico), `DOCUMENTACION_TECNICA.md` (3.2, 4.7, 4.9), `LEEME_MPR.md`.
- **Qué se hizo:** ver `DOCUMENTACION_TECNICA.md` 4.9. Se mantienen las palabras que muestra el manual (Verificando, Cargando, OK code uploaded).
- **Notas:** probado con el Otto del usuario en COM7 (cargador nuevo, "Nano"): subida en 17 s; con "Nano Old" elegida detecta "Nano", cambia la lista y sube en 17 s (antes ~103 s y fallaba); después de precompilar, la primera subida tarda 11 s (antes ~26 s); con el puerto ocupado por otro programa, error claro en 7 s; error de compilación con explicación y detalle plegado. La precompilación corre con prioridad baja (comprobado en avr-g++ y cc1plus). Desenchufar y volver a enchufar se simuló reemplazando la lista de puertos.
- **Commit:** (ver git log)  **Probado en la app:** sí (copia de prueba en `C:\mprbp` con el robot real)

### 2026-11-08 — Textos, bloque Hz y ejemplos en español para el evento
- **Pedido / problema:** Etapa 1, punto 6: corregir textos y sumar 3 o 4 ejemplos en español que sirvan al evento, sin esconder los en inglés (el usuario quiere el menú como está).
- **Archivos:** `www/lang/Arduino_es.js` ("Configuración Otto" con tilde, como el manual), `www/blocs&generateurs/ottoesp.js` ("Posiciones"), `www/toolbox/toolbox_arduino_all.xml` (bloque Hz), `www/examples/examples.json`, `www/examples/mpr_meneito.xml` y `mpr_salto.xml` (comentario en español), `DOCUMENTACION_TECNICA.md` (5.2, 5.3, 5.7).
- **Qué se hizo:** el bloque "Hz" del Zumbador venía con 10 Hz (no suena) y 261 en la duración: ahora 262 Hz (Do4), 500 ms y 100 ms de silencio. En "Ejemplos Mi Primer Robot" se agregan Baile completo, Me alejo si te acercas, Sigue mi mano y Esquivar obstáculos (los tres últimos con el ultrasonido del kit); siguen también en la lista en inglés.
- **Notas:** no se cambiaron "Inicio", "Mover", "Sonido", "Velocidad Normal" ni el orden de las velocidades porque el manual los muestra así. Un comentario XML dentro de un `<block>` del menú rompe la categoría al abrirla (pasó con el del bloque Hz y se corrigió): van entre bloques.
- **Commit:** (ver git log)  **Probado en la app:** sí (las 9 categorías abren; los 4 ejemplos y Meneito compilan; Hz y "Configuración Otto" se ven bien)

### 2026-11-08 — Bloque "Detener a Otto"
- **Pedido / problema:** Etapa 1, punto 7: que Otto no siga caminando para siempre (en el evento se caen de la mesa).
- **Archivos:** `www/blocs&generateurs/ottoesp.js` (`otto_detener`), `www/lang/Arduino_es.js` (`OTTO_DETENER_TEXT`, `OTTO_DETENER_TOOLTIP`), `www/toolbox/toolbox_arduino_all.xml` (después de Gesto), `DOCUMENTACION_TECNICA.md` (5.3).
- **Qué se hizo:** bloque "⏹️ Detener a Otto": `Otto.home();` y `while (true) { }`. No admite bloques debajo porque no se ejecutarían.
- **Commit:** (ver git log)  **Probado en la app:** sí (se subió al Otto del usuario un programa con Gesto + Detener; el código generado es el esperado)

### 2026-11-08 — Etapa 1 instalada en el notebook y documentada
- **Pedido / problema:** cerrar la Etapa 1 de mejoras de aprendizaje de la versión del evento.
- **Archivos:** `DOCUMENTACION_TECNICA.md` (13.4, 13.6, 13.8 nueva), `Manuales/Manual Programación Otto DIY MPR2025.pdf` (panfleto de programación 2025 que entregó el usuario; referencia para textos, ejemplos y las misiones de la Etapa 2).
- **Qué se hizo:** `py tools/probar.py` copió los 14 archivos a `C:\MPRBlockly` (se comprobó que quedaron iguales al repositorio). En la app instalada, con el Otto del usuario: subida en 11,5 s, las 9 categorías abren, los ejemplos nuevos aparecen. Se restauró la mesa y las preferencias del usuario.
- **Commit:** (ver git log)  **Probado en la app:** sí (app instalada del notebook)

### 2026-11-09 — Etapa 2: Probar en pantalla, Misiones y Calibración para monitores
- **Pedido / problema:** Etapa 2 de mejoras de aprendizaje de la versión del evento, aprobada por el usuario: escenario grande para probar el programa en Otto 3D, misiones según el manual y calibración autorizada en su Otto (dejando sus ajustes como estaban). Se pausó el 2026-11-08 y se retomó el 2026-11-09.
- **Archivos:**
  - **Nuevos:** `www/js/mpr_simulador.js`, `mpr_otto_lib.js` (traducción de la librería Otto, hecha por un subagente y comparada contra el firmware en un emulador), `mpr_misiones.js` y `mpr_calibracion.js`.
  - **Cambiados:** `mpr_otto3d.js` (modo escenario), `mpr_mascota.js` (no se arrastra en el escenario), `mpr_subida.js` (`cargar(codigo, alTerminar)`), `index.html` (botones ▶ y 🏁, scripts), `blocklino.css`, `msg_es.js` (`sim_*`, `mis_*`, `cal_*`, recorrido) y `mpr_tour.js` (9 pasos); también `DOCUMENTACION_TECNICA.md` (4.10, 4.11, 4.12 y 13.9).
- **Qué se hizo:** ver `DOCUMENTACION_TECNICA.md` 4.10 a 4.12.
- **Notas:**
  - **Corregido al probar:**
    - signo de los tobillos (van montados igual; "updown" debía subir sin inclinar);
    - cálculo de apoyo de cuerpo rígido que conserva la postura;
    - cámara que encuadra a Otto y la caja;
    - tarjeta de misiones movida abajo (tapaba el programa);
    - ícono de misiones (la fuente no traía bandera);
    - calibración: `Serial.parseInt` desfasaba los números (ahora lee líneas completas) y "Volver a como estaba" vuelve a los valores iniciales.
  - **Robot:** la calibración de prueba dejó los ajustes del Otto del usuario en sus valores originales (−1 en los cuatro), verificado al reiniciar.
- **Commit:** (ver git log)  **Probado en la app:** sí (copia de prueba con el robot real; instalada en el notebook con `probar.py` el 2026-11-09 y probada ahí). Instalador: todavía no, por pedido del usuario (sigue el desarrollo).

### 2026-11-09 — Calibración: Otto confirma cada cambio y avisa si no responde
- **Pedido / problema:** el usuario probó la calibración y le pareció que las piernas no se movían; presionó "Guardar en Otto" y el panel se quedó en "Guardando...". Repetida con él mirando a Otto: +15° en la pierna izquierda sí la gira. El panel no confirmaba nada y cada marca de la barra es solo 1°, así que los cambios pequeños no se notaban. Lo guardado no cambió (seguía en −1 en los cuatro).
- **Archivos:** `www/js/mpr_calibracion.js`, `www/lang/msg_es.js` (`cal_aplicado*`, `cal_primero`, `cal_sin_respuesta` y `cal_como`).
- **Qué se hizo:**
  - Cada respuesta `T` de Otto se muestra: "Otto aplicó: +9, −1, −1, −1. Todavía no está guardado..." (o "está con lo que tiene guardado").
  - "Guardar" sin preparar antes pide presionar «1. Preparar Otto».
  - Si Otto no responde al guardar en 4 s, lo avisa en vez de quedarse en "Guardando...".
  - La ayuda dice que cada marca es 1 grado.
- **Commit:** (ver git log)  **Probado en la app:** sí (app instalada, con el Otto del usuario; sus ajustes siguen en −1 y quedó con un programa normal)

### 2026-11-09 — Calibración: botones de abajo más ordenados
- **Pedido / problema:** el usuario vio los botones de abajo del panel de calibración muy juntos y con el texto partido en dos líneas.
- **Archivos:** `www/css/blocklino.css` (estilos de `#mpr_cal`).
- **Qué se hizo:**
  - El panel pasa a 560 px de ancho.
  - "Probar caminando" y "Volver a como estaba" quedan en una fila, sin cortar el texto.
  - "3. Guardar en Otto" es un botón grande de ancho completo debajo.
  - Más espacio entre las filas y una línea que separa el paso 1 de los ajustes.
- **Commit:** (ver git log)  **Probado en la app:** revisado en una foto de la interfaz (Chrome, versión de navegador). Instalado en el notebook con `probar.py` (F5 para verlo).

### 2026-11-09 — Paneles sin `gap` (Chromium 69) y regla de revisar en la app
- **Pedido / problema:** en la app los botones de abajo de la calibración quedaban pegados y demasiado anchos. Yo los había revisado en un Chrome moderno, donde se veían bien. Causa: Chromium 69 (Electron 4) no soporta `gap` en flexbox. El usuario pidió revisar siempre comparando con la app y no con la versión web.
- **Archivos:** `www/css/blocklino.css` (`#mpr_esc_barra`, `#mpr_mis_cab`, `#mpr_mis_acc`, `#mpr_cal_ajustes`), `CLAUDE.md` (regla nueva en "Verificar antes de entregar").
- **Qué se hizo:**
  - Las separaciones van con márgenes (`> * + * { margin-left }`).
  - En la calibración, los tres botones de abajo quedan centrados, del ancho de su texto y con la misma separación (12 px, medida en la app).
  - `CLAUDE.md` exige revisar en la app real y evitar en CSS `gap` en flex, `clamp()`, `min()`/`max()`, `:is()` y `aspect-ratio`.
- **Commit:** (ver git log)  **Probado en la app:** sí (fotos de la app instalada: calibración, escenario y misiones)
### 2026-11-09 — Pulido de la interfaz: todas las piezas MPR con el mismo estilo
- **Pedido / problema:** el usuario quería que todo se viera homogéneo y profesional, sin parecer agregados (por ejemplo, el escenario de "Probar en pantalla"), apegado a la forma y los colores del programa original.
- **Archivos:** `www/css/blocklino.css` (bloque "piezas agregadas" reescrito), `www/js/mpr_misiones.js` (puntos de avance), `www/lang/msg_es.js` (recorrido: "botón ▶" en vez de "botón verde"), `DOCUMENTACION_TECNICA.md` (4.9b, 4.10).
- **Qué se hizo:**
  - El escenario, las misiones, la calibración y el cuadro de subida toman el lenguaje del recorrido y del globo de Otto, que ya calzaban con la app (4.9b): tarjeta blanca con borde naranja, título naranja, botón principal naranja y secundarios lavanda.
  - Se quitaron el verde de los botones y las barras azul oscuro.
  - El ▶ de la barra pasa a un círculo azul oscuro.
  - Deslizadores de la calibración con el punto naranja.
  - En el cuadro de subida, la ✕ va arriba a la derecha.
  - Se corrigió el botón "siguiente" de las misiones, que se salía de la tarjeta.
- **Commit:** (ver git log)  **Probado en la app:** sí (fotos antes y después en la app real: barra, escenario, misiones, calibración, subida en curso, error y éxito, recorrido y mascota)

### 2026-11-09 — Misiones: botón de la barra y fila de botones rediseñados
- **Pedido / problema:** en la tarjeta de misiones, el botón Revisar quedaba apretado y la flecha "siguiente" tocaba el borde. Arriba a la derecha, el botón de misiones (emoji 🏁 de color con el contador "1/10" encima) se veía raro junto a los íconos blancos de la barra.
- **Archivos:** `www/js/mpr_misiones.js`, `www/css/blocklino.css`, `www/lang/msg_es.js` (`mis_de`, `mis_cumplidas`, `mis_anterior`, `mis_siguiente`; etiquetas sin emoji).
- **Qué se hizo:**
  - **Botón de la barra:** bandera blanca dibujada en SVG, como los demás íconos (la fuente de íconos de la app no trae bandera). El contador pasa a una barrita abajo que se llena de naranja con las misiones cumplidas, con el detalle al pasar el mouse ("3 de 10 cumplidas"). Abierto, se pinta naranja como la lupa activa.
  - **Tarjeta:** el encabezado dice "MISIÓN 4 DE 10" con los puntos. Las flechas ‹ › van chicas a la izquierda, y Pista, Probar y Revisar a la derecha, con íconos de la app (?, ▶, ✓) en vez de emojis. La tarjeta mide 390 px.
- **Commit:** (ver git log)  **Probado en la app:** sí (fotos de la app real: tarjeta y botón con 0 y 3 misiones; posiciones medidas, nada se sale de la tarjeta)
### 2026-11-09 — Escenario más práctico y bonito: tablero de cuadros, cámara libre y botón ▶ con ícono nuevo
- **Pedido / problema:** el usuario pidió un mejor ícono para el botón ▶ y un texto más corto al pasar el mouse (el largo se metía detrás de los botones de la derecha). También, que el espacio del Otto simulado fuera más práctico: más cuadriculado para poner objetos, más bonito y con botones para mover y reiniciar la cámara y el zoom, para que el niño tenga más libertad.
- **Archivos:** `www/js/mpr_simulador.js`, `www/css/blocklino.css`, `www/lang/msg_es.js` (`sim_boton_corto`, `sim_cam_*`, `sim_listo`) y `DOCUMENTACION_TECNICA.md` (4.10).
- **Qué se hizo:**
  - **Botón:** pantalla con ▶ dibujada en SVG; al pasar el mouse dice solo "Probar en pantalla".
  - **Tablero:** cuadros de 10 cm en dos tonos de madera, con marco. La caja cae justo en un cuadro, con una marca naranja en la casilla de destino. Otto parte centrado en un cuadro (distancia inicial: 42 cm).
  - **Cámara:** gira alrededor de Otto. Arrastrar el suelo la gira y la rueda hace zoom. Hay botones redondos naranjas, como los de la mesa de bloques: girar ↺ ↻, acercar +, alejar − y volver a la vista de siempre ⌂.
- **Commit:** (ver git log)  **Probado en la app:** sí (fotos en la app real; las pruebas del escenario pasan, a 30 cuadros/s con el modelo completo)

### 2026-11-09 — Otto ataja los errores de programación: bloques sueltos, revisión antes de mandar y códigos para el monitor
- **Pedido / problema:** los bloques sueltos fuera de Configuración + Bucle entraban igual al programa. Por ejemplo, el niño cambiaba Caminar por Bailar, dejaba el bloque viejo afuera y Otto lo hacía igual, en un orden raro. El usuario pidió que Otto ataje ese y todos los errores posibles (no detectar el puerto COM, error al mandar...), ver cada código de error y su solución, y que Otto ayude primero y después venga el monitor de la mesa, para ahorrar tiempo.
- **Archivos:** `www/js/mpr_revision.js` (nuevo), `www/js/mpr_consejos.js`, `www/js/mpr_subida.js`, `www/js/mpr_mascota.js`, `www/js/mpr_simulador.js`, `index.js`, `www/index.html`, `www/css/blocklino.css`, `www/lang/msg_es.js` y `DOCUMENTACION_TECNICA.md` (4.9, 4.13 y 13.10).
- **Qué se hizo:**
  - **Bloques sueltos:** ya no entran al Bucle. Su configuración (Configuración Otto o sensor que quedó afuera) se mantiene. Los 85 ejemplos que generan código quedan iguales.
  - **Antes de mandar (flecha y Verificar):** Otto revisa el programa, muestra el problema y marca con borde amarillo los bloques en cuestión. Los problemas que revisa: falta Configuración + Bucle, falta Configuración Otto, sensor sin configurar, espacio vacío, configuración afuera, bloques sueltos y Bucle vacío. Cuando se puede, ofrece arreglarlo ("Ponlo tú, Otto", "Llevar a la papelera"). Probar en pantalla avisa lo mismo.
  - **Códigos de error:** P1 a P4 (puerto y cable), B2 a B6 (bloques), M1 (memoria) y A1/A9 (app). Cada uno trae un texto para el niño y una pista para el monitor, incluidos los mensajes de Windows en español ("Acceso denegado", "El sistema no puede encontrar el archivo especificado"). Al tercer error igual seguido, Otto pide llamar al monitor con el código. Se corrigieron consejos equivocados: el sensor sin configurar decía "falta crear la variable", el "esperar" vacío daba un mensaje genérico y un puerto que no existe se tomaba como ocupado.
  - **Verificar:** ahora usa el mismo cuadro y los mismos errores. Solo si compila, la flecha se salta la compilación. Antes quedaba marcado aunque fallara, y la flecha podía mandar lo último que sí compiló.
  - **Cuadro de subida:** el `data-toggle` del botón cerraba el cuadro en el mismo clic, así que el primer paso "Verificando ..." no se veía.
- **Commit:** (ver git log)  **Probado en la app:** sí, en la copia de prueba `C:\mprbp` (Electron 4):
  - 11 casos de revisión con sus botones y fotos;
  - los ejemplos y los códigos de 11 errores reales;
  - con el Otto del usuario en COM7: Verificar y luego la flecha (5,2 s, sin recompilar) y el puerto ocupado (P3).
  - En Otto quedó un programa quieto (posición inicial).

### 2026-11-09 — Otto avisa cuando la subida se demora más de lo normal
- **Pedido / problema:** a veces la subida se queda mucho rato en "Verificando" y no sale de ahí. El consejo que dan los monitores es desenchufar y enchufar el cable y mandar el programa otra vez. El usuario pidió que Otto lo diga cuando note que se demora más de lo normal.
- **Archivos:** `www/js/mpr_subida.js`, `www/js/mpr_consejos.js` (pista P5 para el monitor), `www/lang/msg_es.js` (`sub_tarde`, `sub_detener`, `sub_detenido*`), `www/css/blocklino.css` (`.mpr-paso-tarde`) y `DOCUMENTACION_TECNICA.md` (4.9, 4.13 y 13.10).
- **Qué se hizo:**
  - **El aviso:** si Verificando o Cargando pasa del doble de lo normal más un margen (Verificando: entre 40 s y 2 min; Cargando: entre 30 s y 1 min), el cuadro muestra "Me estoy demorando más de lo normal. Desenchufa mi cable USB, vuelve a enchufarlo y manda tu programa otra vez", con un botón Detener, y Otto lo dice.
  - **Al desenchufar:** desde ese momento, si Otto se desenchufa, la app detiene arduino-cli y avrdude con sus procesos hijos. Antes la flecha quedaba "ocupada" y no respondía al volver a mandar. Después dice "¡Bien! Me desenchufaste...".
  - **Código P5:** al tercero seguido, Otto pide llamar al monitor. Las duraciones de más de 2 min no se guardan como "lo normal".
- **Commit:** (ver git log)  **Probado en la app:** sí, en la copia de prueba `C:\mprbp`, con el límite bajado a 1,5 s:
  - botón Detener, desenchufe simulado (el puerto desaparece de la lista) y escalamiento al tercero;
  - no quedan procesos de arduino-cli, avrdude ni cc1plus;
  - con los límites reales, envío a Otto sin aviso (9,8 s).

### 2026-11-09 — Fuera el bloque "Calibrar" del menú Otto
- **Pedido / problema:** como ya existe la calibración para monitores (Ctrl + Mayús + O), el usuario pidió sacar los bloques de programación para calibrar.
- **Archivos:** `www/toolbox/toolbox_arduino_all.xml` (`otto_calibration` comentado con `OCULTO`), `www/examples/examples.json` ("Biped calibration" con `"visible": false`) y `DOCUMENTACION_TECNICA.md` (4.12, inventario 18 y sección 9).
- **Qué se hizo:**
  - Se ocultó, sin borrarlo, el único bloque de calibrar visible: "Calibrar" (pierna y pie, izquierda y derecha). El de Otto Ninja ya estaba comentado.
  - También se ocultó el ejemplo "Biped calibration" de "Explora otros ejemplos", que es un programa de calibrar con ese bloque.
  - La lupa busca solo en el menú, así que tampoco aparece al buscar.
  - Los proyectos que ya tienen el bloque siguen abriendo y generando su código (`setTrims`).
- **Commit:** (ver git log)  **Probado en la app:** sí, en la copia de prueba `C:\mprbp`:
  - menú Otto sin el bloque (foto);
  - búsqueda "calibrar", "calibración" y "trims" sin resultados;
  - el ejemplo ya no está en la lista;
  - `Ottocalibration.xml` carga y genera `setTrims`.

### 2026-11-09 — Fuera los ejemplos de servos
- **Pedido / problema:** el usuario pidió sacar los ejemplos que dicen "Servo", porque son técnicos y no está claro para qué los usaría un niño.
- **Archivos:** `www/examples/examples.json` y `DOCUMENTACION_TECNICA.md` (inventario 19 y sección 9).
- **Qué se hizo:** "🦿 Servo centering" y "🦿 Servo sweep" quedan con `"visible": false`, sin borrarlos. Mueven un servo suelto y no a Otto. "Servo advanced control" ya estaba oculto.
- **Commit:** (ver git log)  **Probado en la app:** sí, en la app instalada: la lista de ejemplos ya no muestra servos ni calibración.

### 2026-11-09 — Fuera el ejemplo "Serial measure distance"
- **Pedido / problema:** el ejemplo escribe la distancia del sensor en el monitor serie, que está oculto en esta versión: el niño no veía nada. El usuario aprobó sacarlo.
- **Archivos:** `www/examples/examples.json` y `DOCUMENTACION_TECNICA.md` (inventario 19 y sección 9).
- **Qué se hizo:** `serialdistance.xml` queda con `"visible": false`, sin borrarlo.
- **Commit:** (ver git log)  **Probado en la app:** sí, en la app instalada: la lista ya no lo muestra.

### 2026-11-10 — Otto aconseja, pero no pone bloques salvo que se active
- **Pedido:** que Otto siga dando consejos, pero que la opción de que coloque los bloques él mismo esté desactivada por defecto, con una combinación de teclas para activarla.
- **Archivos:** `www/js/mpr_revision.js`, `www/lang/msg_es.js`, `www/css/blocklino.css`, `DOCUMENTACION_TECNICA.md` (4.13 y 9).
- **Qué se hizo:** `MPRRevision.revisar` quita el arreglo cuando `ottoPone` está apagado (por defecto) y usa textos que dicen dónde buscar el bloque (`rev_*_tu`). Sin arreglo no aparecen "Ponlo tú, Otto", "Ponla tú, Otto" ni "Llevar a la papelera". **Ctrl + Mayús + A** lo cambia; Otto dice "¡Listo! Ahora, si falta un bloque, te ofreceré ponerlo yo..." o "Ya no pondré bloques yo...". Si Otto está escondido, sale un aviso (`#mpr_rev_aviso`). No se guarda en `localStorage`.
- **Commit:** (ver git log)  **Probado en la app:** sí, en la copia de prueba `C:mprbp` con teclas reales por DevTools: por defecto solo "Volver a mis bloques" y el texto nuevo; con Ctrl + Mayús + A aparece "Ponlo tú, Otto" y pone Configuración Otto; otra vez Ctrl + Mayús + A lo apaga; bloques sueltos: solo "Mandar sin los sueltos"; aviso con Otto escondido.

### 2026-11-10 — Se ve mejor qué bloque se está haciendo y dónde falta algo
- **Pedido:** en Probar en pantalla (el patio de juegos) el bloque que se está ejecutando no se veía bien; tampoco el contorno amarillo con que Otto marca un bloque con un espacio vacío. Revisarlo en la app, no en la web.
- **Archivos:** `www/js/mpr_revision.js`, `www/js/mpr_simulador.js`, `www/css/blocklino.css`, `www/lang/msg_es.js`, `DOCUMENTACION_TECNICA.md` (4.10 y 4.13).
- **Qué se hizo:**
  - **Halo propio** (`MPRRevision.halo`): dos trazos SVG con la forma del bloque, encima de él: orilla azul oscuro de 11 px y banda de color de 6 px. Se ve sobre la mesa gris y sobre bloques de cualquier color. Antes era un trazo amarillo de 5 px que se perdía en los bloques de Lógica (amarillos) y el relieve de Blockly (`highlightBlock`), casi invisible.
  - **Bloque que se está haciendo:** halo verde y una flecha ▶ (círculo azul oscuro) a la izquierda. Fijo, sin animación.
  - **Bloque con problema:** halo rojo que late 4 veces al aparecer (1,8 s) y queda fijo. Los textos dicen "borde rojo" en vez de "borde amarillo".
  - **Hueco vacío:** rectángulo blanco con orilla roja punteada y un "?", justo donde va el bloque que falta (en línea o al costado).
- **Commit:** (ver git log)  **Probado en la app:** sí, en la copia de prueba `C:mprbp` (Chromium 69), con fotos: repetir, esperar y si vacíos; Meneíto y el ejemplo del Cerro en Probar en pantalla (el halo sigue al bloque, también dentro de si/de lo contrario). Cuadros/s de la página con la prueba corriendo: 60 con el halo y 60 con el resaltado anterior.

### 2026-11-10 — Contornos más finos y bonitos
- **Pedido:** los contornos rojo y verde se veían bien, pero muy gruesos y poco estéticos; que se vean bonitos y no desentonen con el programa.
- **Archivos:** `www/css/blocklino.css`, `www/js/mpr_simulador.js`, `www/js/mpr_revision.js` (comentarios), `DOCUMENTACION_TECNICA.md` (4.10 y 4.13).
- **Qué se hizo:** sin la orilla azul oscuro de 11 px: ahora es una línea de 3 px del color con un brillo suave del mismo color (9 px al 30 %; 10 px al 45 % en el verde, que sobre los bloques azules quedaba tenue). Rojo `#FF3355`, verde `#2ECC40` (el verde de estado de la app). Flecha ▶ más chica (radio 9), verde con borde blanco. Hueco: orilla punteada de 2 px y "?" de 15 px.
- **Commit:** (ver git log)  **Probado en la app:** sí, en la copia de prueba `C:\mprbp`, con fotos de los espacios vacíos (repetir, esperar, si) y del ejemplo del Cerro en Probar en pantalla.

### 2026-11-10 — Botón en el menú de Otto para que ponga los bloques (sí / no)
- **Pedido:** además de la combinación de teclas, un botón para activar y desactivar que Otto ponga los bloques él mismo.
- **Archivos:** `www/js/mpr_mascota.js`, `www/lang/msg_es.js`, `DOCUMENTACION_TECNICA.md` (4.13 y 9).
- **Qué se hizo:** el menú de Otto (clic en Otto) tiene "🧩 Que Otto ponga los bloques que faltan" cuando está apagado (por defecto) y "✋ Yo pongo mis bloques" cuando está encendido. Llama a `MPRRevision.cambiarOttoPone`, lo mismo que Ctrl + Mayús + A. El mensaje de Otto al encenderlo dice que se apaga "en mi menú o con Ctrl + Mayús + A".
- **Commit:** (ver git log)  **Probado en la app:** sí, en la copia de prueba `C:\mprbp`: el botón enciende y apaga, cambia su texto y Otto confirma cada cambio (foto del menú).

### 2026-11-10 — Fuera el botón del menú de Otto: solo Ctrl + Mayús + A
- **Pedido:** que la opción de que Otto ponga los bloques no se pueda activar desde la interfaz, solo con la combinación de teclas.
- **Archivos:** `www/js/mpr_mascota.js`, `www/lang/msg_es.js`, `DOCUMENTACION_TECNICA.md` (4.13 y 9).
- **Qué se hizo:** se quitó el botón "🧩 Que Otto ponga los bloques que faltan" / "✋ Yo pongo mis bloques" del menú de Otto (entrada anterior) y sus textos. El mensaje de Otto al encenderlo vuelve a decir "(Ctrl + Mayús + A para apagarlo)". Sigue apagado por defecto.
- **Commit:** (ver git log)  **Probado en la app:** sí, en la copia de prueba `C:\mprbp`: el menú de Otto ya no tiene el botón y Ctrl + Mayús + A sigue encendiendo y apagando.

### 2026-11-10 — Aviso pequeño al apretar Ctrl + Mayús + A
- **Pedido:** que al apretar la combinación se note que se activó el modo, con algo sutil y pequeño que se quite solo.
- **Archivos:** `www/js/mpr_revision.js`, `www/css/blocklino.css`, `www/lang/msg_es.js`, `DOCUMENTACION_TECNICA.md` (4.13).
- **Qué se hizo:** en vez del globo de Otto, sale una píldora azul oscuro de 13 px abajo al centro: "Otto pone los bloques que faltan: activado" (punto verde) o "...: desactivado" (punto gris). Aparece y se va con una transición de opacidad y se quita sola a los 2,5 s. No recibe clics.
- **Commit:** (ver git log)  **Probado en la app:** sí, en la copia de prueba `C:\mprbp` con teclas reales: se ve al apretar (foto), a los 3 s está oculta, al apretar otra vez dice "desactivado" y el globo de Otto no se abre.

### 2026-11-10 — La combinación pasa a Ctrl + Mayús + P
- **Pedido:** cambiar la combinación de teclas para que Otto ponga los bloques: Ctrl + Mayús + P en vez de Ctrl + Mayús + A (al usuario no le funcionaba en su app).
- **Archivos:** `www/js/mpr_revision.js`, `www/css/blocklino.css` (comentario), `DOCUMENTACION_TECNICA.md` (4.13 y 9).
- **Qué se hizo:** el atajo revisa `P` (`keyCode` 80). No choca con otros atajos de la app (Ctrl + Mayús + O es la calibración). Las entradas anteriores de hoy que dicen Ctrl + Mayús + A quedan como historia.
- **Commit:** (ver git log)  **Probado en la app:** sí, en la copia de prueba `C:\mprbp` con teclas reales: Ctrl + Mayús + A ya no hace nada; Ctrl + Mayús + P activa ("...: activado") y desactiva.

### 2026-11-10 — Fuera el modo código: la flecha mandaba el editor vacío
- **Pedido / problema:** el usuario armó un programa bien hecho (si distancia = 10, Sonido Feliz; si no, Sonido Sorpresa) y daba error al mandarlo. Quiere poder ver el código, pero sin un modo que un niño active y le cause el mismo problema.
- **Causa:** en algún momento se apretó el interruptor bloques/código (`codeORblock`, a la derecha de la barra) y quedó `localStorage.content = "off"`. Al abrir la app se veían los bloques, pero la flecha y Verificar mandaban el editor de texto, que no se guarda y vuelve a `#enter your code here`: "error: invalid preprocessing directive #enter" (código A9).
- **Archivos:** `www/js/blocklino.js`, `www/index.html`, `www/css/blocklino.css`, `DOCUMENTACION_TECNICA.md` (9).
- **Qué se hizo:** (1) `blocklino.js` parte siempre en modo bloques: si `content` venía en "off", lo vuelve a "on". (2) El interruptor queda oculto con comentario `OCULTO` en `index.html`. (3) El código se sigue viendo con el botón `</>` (`btn_preview`): muestra el código actual de los bloques y no se puede editar. Ahora ese botón es el último del grupo y lleva las esquinas derechas redondas.
- **Commit:** (ver git log)  **Probado en la app:** sí, en la copia de prueba `C:\mprbp` con el estado real del usuario (`content = "off"`): al abrir queda en "on", no está el interruptor (foto de la barra), `</>` muestra el código, y el programa del usuario compila ("Code is ready to upload").

### 2026-11-10 — Recorrido inicial al día con los cambios
- **Pedido:** revisar que el tutorial del inicio ("Conoce a Otto") muestre bien los botones y el programa después de los cambios de hoy.
- **Archivos:** `www/lang/msg_es.js`, `www/css/blocklino.css`.
- **Qué se hizo:** "Más ayudas" ya no menciona el interruptor bloques/código, que se quitó: ahora dice "Con el globo dime qué bloque buscas. Con </> ves el código que arman tus bloques, y con ? repites este paseo." "¡Mándame tu programa!" suma que Otto revisa el programa antes de mandarlo y marca en rojo lo que falta. El botón "¡A programar!" ya no se parte en dos líneas (`white-space: nowrap`). No se menciona Ctrl + Mayús + P, a propósito. Se revisaron los demás textos (consejos, misiones, menú de Otto): no hablan del modo código.
- **Commit:** (ver git log)  **Probado en la app:** sí, en la copia de prueba `C:\mprbp`, con fotos de los pasos "¡Mándame tu programa!" y "Más ayudas" (9 pasos).

### 2026-11-10 — Misiones: revisiones que de verdad comprueban el objetivo (y aceptan varias formas)
- **Pedido:** mejorar cómo se comprueba que se cumplió cada misión. En la última ("Sube el Cerro Renca") el usuario no hizo nada, presionó Revisar y se la dio por buena. Después pidió no ser tan exactos: hay varias formas de resolver cada objetivo, y un niño que sí lo hizo no puede quedar mal.
- **Archivos:** `www/js/mpr_misiones.js`, `www/lang/msg_es.js`, `DOCUMENTACION_TECNICA.md` (4.11).
- **Qué se hizo:**
  - **Revisión común:** cada misión parte por la revisión de siempre de Otto.
  - **Qué falta:** la tarjeta dice qué falta en concreto (29 textos nuevos `mis_*_f_*`) y marca los bloques en rojo.
  - **Más flexibles:** se aceptan cualquier sonido, cualquier espera, Repetir o "contar", y la condición escrita al revés o con una variable. Inicio es opcional y el orden no importa donde no corresponde.
  - **Lo que sigue fallando:** el sonido antes de Configuración Otto (el robot no sonaría) y Detener antes del baile.
  - **Cerro:** el programa tiene que ser distinto del ejemplo y estar probado en pantalla.
  - **Última misión:** "¡Cumpliste todas!" sale solo con las 10 hechas.
  - **Textos:** los objetivos de Hola, Repetir sonido, Te veo y Cerro dicen lo que hay que lograr, con un ejemplo.
- **Probado en la app:** sí, en la copia de prueba `C:\mprbp`.
  - **64 programas armados por DevTools:** varias formas correctas por misión, que aprueban, y formas incompletas, que fallan con el texto correcto. También la mesa inicial, que no cumple ninguna.
  - **Ejemplos:** "Esquivar obstáculos" y "Subir el Cerro Renca" cumplen Esquiva la caja, y "Canto" cumple Te veo.
  - **Cerro con los botones reales:** el ejemplo sin cambios no pasa, cambiado sin probar tampoco, y cambiado y probado con ▶ Probar sí.
  - **Tarjeta:** foto con "Cambia el número del repetir para que diga 5 veces." y el repetir marcado.
  - **Estado:** el avance y la mesa del usuario quedaron como estaban.
- **Commit:** (ver git log)

### 2026-11-10 — Pulido antes del instalador 1.5.0
- **Pedido:** dejar la versión pulida, con lo pendiente en el código, antes de generar el instalador.
- **Archivos:** `www/index.html`, `www/lang/code.js`, `www/js/mpr_otto3d.js`, `DOCUMENTACION_TECNICA.md` (13.4).
- **Qué se hizo:**
  - **Abrir:** el botón de abrir acepta solo proyectos de bloques (`.xml`, `.bloc`). Un `.ino` o un `.py` pasaba al editor de código, del que ya no se puede volver sin el interruptor.
  - **Archivos que faltaban:** fuera las referencias a `blocs&generateurs/microbit.js` y `lang/microbit_es.js`, que no existen (2 `ERR_FILE_NOT_FOUND` al abrir; heredado de Otto Blockly).
  - **Otto 3D:** sin `flatShading` en `MeshLambertMaterial`. three r128 lo ignora y avisaba 4 veces; las caras planas salen de la geometría (13.6).
  - **Sin cambios, a propósito:** el `TypeError` de `typing.js:95`, porque corregirlo cambia los tipos de variables del código generado (13.4). También el aviso de `play()` de Blockly, que es el navegador bloqueando los sonidos antes del primer clic.
- **Probado en la app:** sí, en la copia de prueba `C:\mprbp`, recargando sin caché y registrando la consola. Se usaron el recorrido, la vista de código, las misiones, la búsqueda, el menú y los consejos de Otto, el escenario con Probar, la revisión, los ejemplos y Ctrl + Mayús + P: ningún error del código de MPR. Otto 3D se ve igual (foto).
- **Commit:** (ver git log)

### 2026-11-10 — Versión 1.5.0 e instalador
- **Pedido:** generar el instalador de la nueva versión, después de dejarla pulida.
- **Archivos:** `package.json` (1.4.1 → 1.5.0), `DOCUMENTACION_TECNICA.md` (13.1 y 13.11).
- **Qué se hizo:** `py tools/build_installer.py --official ottoblockly.Setup.1.5.0.exe` generó `dist\MPR_Blockly_Setup_1.5.0.exe` (139.047.350 bytes, SHA‑256 `326c40785ba3aff0ab17bdace3b58a5086c7838293a001052e2158580fb9b6f5`, versión 1.5.0.0 en el .exe, sin firma). Se extrajeron del instalador `mpr_misiones.js`, `mpr_revision.js`, `blocklino.js` e `index.html`: iguales a los del repositorio. Hubo que borrar a mano `C:\mprb\stage`, que quedó de un armado interrumpido (13.11).
- **Commit:** (ver git log)  **Probado:** el instalador todavía no se ha ejecutado en un PC. Los cambios se probaron en la copia de prueba y en la app instalada con `probar.py`.

## Plantilla para nuevas entradas
```
### AAAA-MM-DD — Título corto
- **Pedido / problema:**
- **Archivos:**
- **Qué se hizo:**
- **Notas:**
- **Commit:**  **Probado en la app:** sí/no
```
