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

## Plantilla para nuevas entradas
```
### AAAA-MM-DD — Título corto
- **Pedido / problema:**
- **Archivos:**
- **Qué se hizo:**
- **Notas:**
- **Commit:**  **Probado en la app:** sí/no
```
