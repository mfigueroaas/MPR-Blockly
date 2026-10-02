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
