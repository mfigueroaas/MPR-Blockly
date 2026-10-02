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

### 2026-10-02 — Matemática: bloque "map" traducido
- **Pedido:** traducir al español el bloque `math_map` (decía "map / from / - / to / -").
- **Archivos:** `www/blocs&generateurs/blockly_blocs.js` (el bloque ahora usa textos de idioma, con el inglés original como respaldo) y
  `www/lang/Arduino_es.js` (`MPR_MAP`="convertir", `MPR_MAP_FROM`="de", `MPR_MAP_TO`="a", `MPR_MAP_TOOLTIP`). Se corrigió además el
  tooltip, que mostraba por error el del motor paso a paso.
- **Resultado:** "convertir [valor] de [0] - [1023] a [0] - [10]". El código generado no cambió: `map(valor,0,1023,0,10);`.
  Para cambiar las palabras, editar esas cuatro líneas de `Arduino_es.js`.
- **Probado en la app:** pendiente.

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
