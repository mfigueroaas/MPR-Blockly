# MPR Blockly — Documentación técnica

| | |
|---|---|
| **Producto** | MPR Blockly (programa *Mi Primer Robot*, Crecer en Renca) |
| **Versión de la app** | 1.4.0 (`package.json`) |
| **Tipo** | Aplicación de escritorio Windows (Electron) para programar robots Otto DIY por bloques |
| **Base** | [OttoDIY/blockly](https://github.com/OttoDIY/blockly), master `fdb2026` del 2026‑08‑14 |
| **Repositorio previsto** | `https://github.com/Admin-Proteinlab/blockly_mpr` (aún no publicado desde esta máquina) |
| **Licencia** | GPL‑2.0 (ver `LICENSE.md`); arduino-cli es GPL‑3.0 |
| **Documentos hermanos** | `CLAUDE.md` (reglas para Claude Code), `LEEME_MPR.md` (resumen), `BITACORA.md` (registro de cada cambio), `ANALISIS_SERVOS.md` (movimiento de los servos) |

Este documento explica **qué es el proyecto, de dónde viene, cómo está armado, cómo se modifica, se prueba y se entrega**, y qué quedó pendiente. Está pensado para que alguien nuevo pueda retomar el trabajo sin la conversación original. Lo que no se ha comprobado en la app real está marcado como **sin confirmar**.

> Convención: las rutas son relativas a la raíz del repositorio salvo que se indique otra cosa. La raíz era `C:\ClaudeCode\mpr-blockly` en el PC original; desde noviembre de 2026 es la carpeta de OneDrive `Proyectos\mpr-blockly`, compartida entre el PC y el notebook.

---

## 1. Resumen

MPR Blockly es una versión de Otto Blockly adaptada para el programa *Mi Primer Robot*. Los alumnos arman programas con bloques (en español), la app los convierte en código C++ de Arduino, lo compila y lo sube a una placa **Arduino Nano** que controla un robot **Otto** (bípedo con 4 servos, buzzer y opcionalmente un sensor ultrasónico). Funciona sin internet.

Diferencias principales respecto de Otto Blockly oficial:

- Solo español y solo placas AVR (Nano / Nano Old en el selector).
- Marca y colores del programa (logos, pie de página), ejemplos "Mi Primer Robot", menú de velocidades, interfaz simplificada y toolbox reducida.
- Librería Otto con **limitador de velocidad de servos** (240 grados/s), arranque escalonado de los servos y refresco round‑robin.
- Instalador propio (`C:\MPRBlockly`), con asociación de archivos `.bloc`, desinstalador, driver CH340 y permisos pensados para alumnos sin administrador.
- Actualizador automático desactivado (apuntaba a Otto Blockly oficial y lo habría reemplazado).

---

## 2. Linaje del código y versiones

Es importante entender de dónde viene cada capa, porque determina qué se puede cambiar y qué no.

```
OttoDIY/blockly  ──────────────►  base (master fdb2026, 2026‑08‑14)         commit d55c0ad
   │
   ├─ MPR_Patch_OttoBlockly (nov‑2025, partía de upstream ff99529)
   │     50 archivos reales (30 modificados + 20 nuevos)                    commit 9951584
   │
   ├─ Correcciones de integración sobre el parche                           commits 9e15f38, b991fb2, 8a7f619, 499ce39
   ├─ Electron 4.1.1 + instalador NSIS + documentación                      commits 2031311, b8e05fe, 655cb6e, 4aba7ce
   └─ Trabajo con Claude Code (cambios pequeños, 1 y 2 de octubre 2026)     commits 32ad6ed → HEAD
```

### 2.1 El parche `MPR_Patch_OttoBlockly` (noviembre 2025)

- Era una copia modificada de Otto Blockly que partía del commit upstream **`ff99529`** (anterior a los cambios de diciembre 2025 y agosto 2026).
- Incluía unos 3.136 archivos que solo cambiaban el fin de línea (LF→CRLF) y un `package-lock.json`: **se ignoraron**. Solo se aplicaron los **50 archivos con cambios reales**: 30 modificados y 20 nuevos. El resumen quedó en `MPR_cambios_vs_OttoBlockly.patch` (carpeta `C:\ClaudeCode\MPR_Blockly`).
- Se omitieron `electronApp.js.backup` y `auditoria_npm.txt`.
- **Archivos nuevos del parche:** `package.json`, ejemplos `www/examples/cerro.xml`, `mpr_balance.xml`, `mpr_cerro.xml`, `mpr_meneito.xml`, `mpr_randommove.xml`, `mpr_salto.xml`, `mpr_sing.xml`, y los logos `www/media/MPRBlockly.*`, `MPRBLK.ico`, `crecer-en-rencaLOGO-hor.*`, `crecer-en-rencaLOGO.svg`, `logo innova 2025.png`, `logo la fabrica.png`, `logo-innova-direccion-negro.png`, `logo-renca.png`.
- **Archivos modificados del parche** (principales): `www/index.html`, `www/css/blocklino.css`, `www/js/blocklino.js`, `www/lang/Arduino_es.js`, `www/lang/Arduino_en.js`, `www/lang/msg_es.js`, `www/lang/code.js`, `www/toolbox/toolbox_arduino_all.xml`, `www/examples/examples.json` y varios ejemplos Otto, `www/blocs&generateurs/{blockly_blocs,motor,sensors}.js`, la librería Otto (`Oscillator.*`, `Otto.*`), `electronApp.js`, `.gitignore`.

### 2.2 Regresiones que traía el parche y que se corrigieron

El parche había copiado varios archivos desde una instalación de Otto Blockly 1.5.0 (mayo 2023), deshaciendo correcciones de upstream de abril 2024 (PRs #202–#205). Se revirtieron en el commit `b991fb2`:

| Archivo | Problema |
|---|---|
| `motor.js` | L298N "ambos atrás" dejaba `in3=in4=HIGH` (motor B frenado) |
| `sensors.js` | Lógica del botón táctil invertida |
| `Arduino_es.js` | ON escribía LOW y OFF escribía HIGH |
| `blockly_blocs.js` | Bloque switch/case en línea |

Además `index.html` perdía el modo navegador (try/catch en `require`, clase `.electron-only`); se reintegró por merge de 3 vías (`9e15f38`).

### 2.3 Componentes de ejecución (heredados del instalador oficial 1.5.0)

El instalador MPR **no recompila nada de esto**: reutiliza los binarios ya compilados del instalador oficial `ottoblockly.Setup.1.5.0.exe` (SHA‑256 `3c495447694e5e6a68b0de7408d533825d2c661fba35a7ec74415a83e8b28b99`, verificado por `tools/build_installer.py`).

| Componente | Versión | Nota |
|---|---|---|
| Electron | **4.1.1** (32 bits) | El código usa su API antigua; **no migrar** |
| serialport | **7.1.4** | `sp.list(callback)`, `port.comName`; **no migrar** |
| arduino-cli | **0.14.0** (64 bits) | Por eso el instalador exige Windows 64 bits |
| Core Arduino AVR | **1.8.3** (`arduino:avr`) | avr-gcc 7.3.0‑atmel3.6.1‑arduino7, avrdude 6.3.0‑arduino17 |
| electron-updater | 4.0.6 | Desactivado |
| Driver USB CH340 | WCH 3.3.2011.11 (WHQL) | Para placas Nano compatibles; en `driversUSB/` |

---

## 3. Arquitectura

```
┌──────────────────────────── MPR Blockly.exe (Electron 4.1.1) ─────────────────────────────┐
│ Proceso principal: electronApp.js                                                          │
│   ventana, menús, diálogos de guardado, F5/F8, instancia única, abrir .bloc por argumento  │
│                                                                                            │
│ Proceso de la página: www/index.html (nodeIntegration activo)                              │
│   index.js (raíz)  → botones Verificar / Subir, lista de puertos COM, guardar archivos     │
│   www/js/blocklino.js → UI, toolbox, carga/guardado de proyectos                            │
│   www/js/blockly.min.js (Blockly) + www/blocs&generateurs/*.js (bloques y generadores C++) │
│   www/js/boards.js → perfiles de placas (pines, cpu, argumento de arduino-cli)             │
│   www/js/mpr_fixes.js → correcciones sobre Blockly sin tocar blockly.min.js                │
└───────────────┬────────────────────────────────────────────────────────────────────────────┘
                │ escribe compilation/arduino/sketch/sketch.ino
                ▼
   arduino-cli.exe compile --fqbn arduino:avr:nano[...] sketch/sketch.ino
   arduino-cli.exe upload  --port COMx --fqbn ... sketch/sketch.ino
                │  usa librerías de compilation/arduino/userlibs/libraries (incluye Otto)
                ▼
          Placa Arduino Nano  →  servos, buzzer, ultrasonido
```

### 3.1 Flujo de un programa

1. El alumno arma bloques en el espacio de trabajo de Blockly.
2. Cada bloque tiene un **generador** `Blockly.Arduino['tipo_de_bloque']` que devuelve texto C++ y registra includes, definiciones y `setup()` en tablas (`includes_`, `definitions_`, `setups_`). Las claves de esas tablas evitan duplicados: dos bloques que usan la misma clave producen una sola línea.
3. `index.js` escribe el resultado en `compilation/arduino/sketch/sketch.ino`.
4. **Verificar** ejecuta `arduino-cli compile --fqbn <upload_arg del perfil> sketch/sketch.ino` en `compilation/arduino`.
5. **Subir** compila y luego ejecuta `arduino-cli upload --port <COM> --fqbn ...`.
6. Guardar: el proyecto se guarda como `.bloc` (XML de Blockly); también se puede exportar `.ino` o los `.hex`.

### 3.2 Estructura de carpetas

| Ruta | Contenido |
|---|---|
| `electronApp.js` | Proceso principal de Electron (cambios MPR marcados con `MPR:`) |
| `index.js`, `factory.js`, `term.js`, `repl.js` | Lógica de la página en Electron; `index.js` compila/sube y lista puertos |
| `package.json` | Nombre `mpr-blockly`, versión, dependencias; la versión del instalador sale de aquí |
| `config.json` | `{ "update": "false" }` |
| `www/` | Toda la interfaz web |
| `www/index.html` | Estructura de la UI, barra superior, selector de placa, modales |
| `www/css/blocklino.css` | Estilos de la app (colores MPR, pie de página) |
| `www/js/blocklino.js` | Controlador de la UI (toolbox, placas, carga de configuración) |
| `www/js/boards.js` | Perfiles de placas |
| `www/js/mpr_fixes.js` | Sobrescribe `Blockly.FieldDropdown.prototype.showEditor_` (listas desplegables largas) |
| `www/js/mpr_buscar.js` | Búsqueda de bloques del botón de la lupa (objeto `MPRBuscar`) |
| `www/js/mpr_subida.js` | Subida a Otto (objeto `MPRSubida`): puerto y placa automáticos, pasos con barra, errores explicados y precompilación al abrir (4.9) |
| `www/blocs&generateurs/mpr_canciones.js` | Canciones agregadas al bloque "Tocar RTTTL" (31 Minutos) |
| `www/blocs&generateurs/` | Definición de bloques y generadores de código, un archivo por familia |
| `www/lang/` | Textos. Se usa `Arduino_es.js` y `msg_es.js`; `code.js` fija el idioma a `es` |
| `www/toolbox/toolbox_arduino_all.xml` | Categorías y bloques del menú (el que usa Nano) |
| `www/examples/` | Ejemplos `.xml` y `examples.json` (cuáles se muestran) |
| `www/media/` | Imágenes, logos, íconos |
| `compilation/arduino/` | arduino-cli, `arduino-cli.yaml`, `sketch/`, `userlibs/libraries/` |
| `compilation/arduino/userlibs/libraries/Otto/` | Librería Otto (con las modificaciones MPR) |
| `compilation/python/` | Intérprete Python embebido heredado (no se usa en MPR) |
| `driversUSB/` | Drivers USB, incluido CH340/CH341 |
| `build/` | `installer.nsi` (NSIS), íconos y licencia del instalador |
| `tools/build_installer.py` | Genera el instalador |
| `tools/probar.py` | Copia cambios a la app instalada para probarlos con F5 |
| `tools/medir_app.mjs` | Mide el rendimiento dentro de la app instalada (recorrido, capas del compositor, consumo en reposo) por DevTools; ver 6.5 |
| `tools/rtttl/partitura_a_rtttl.py` | Convierte partituras (tablaturas de Songsterr o notas escritas a mano) en melodías RTTTL; guía en `tools/rtttl/LEEME.md` |
| `.gitignore` | Excluye `dist/`, `build_tmp/`, `node_modules/`, el instalador oficial, binarios de arduino-cli |

> Nota: `compilation/arduino/userlibs/libraries/` contiene decenas de librerías heredadas de Otto Blockly (ESP32, NeoPixel, pantallas…). MPR solo usa en la práctica Otto, Servo y las del core AVR; el resto no se tocó.

---

## 4. Mecanismos clave de la interfaz

### 4.1 Selector de placa
- `www/index.html` tiene **dos** listas con las placas: el `<select id="boards">` de la barra superior y el `<select id="pinout">` del modal de información de la placa. Hay que mantenerlas iguales.
- Opciones actuales: `nanooptiboot` ("Nano") y `nano` ("Nano Old"). Los perfiles de las placas quitadas **siguen en `www/js/boards.js`** (no se borraron).
- La placa predeterminada está en `BlocklyDuino.selectedCard` (`www/js/blocklino.js`, línea 5): `"nanooptiboot"`.
- La placa elegida se guarda en `localStorage.card`. `BlocklyDuino.loadConfig` descarta una placa guardada que ya no exista en el selector y vuelve a la predeterminada.
- Perfiles: `nanooptiboot` → `upload_arg: "arduino:avr:nano"`; `nano` → variante `atmega328old`.

### 4.2 Menú de categorías (toolbox)
El menú de bloques se arma así (`BlocklyDuino.buildToolbox`, `blocklino.js`):

1. `loadToolboxDefinition` lee `www/toolbox/toolbox_arduino_all.xml`, y a cada `<category name="CAT_X">` le asigna `id="CAT_X"` y como nombre visible `Blockly.Msg.CAT_X` (textos en `Arduino_es.js`).
2. La **lista de categorías visibles** está en la primera línea `<parametre id="defaultCategories1">` del XML (separadas por coma, en orden de aparición):
   `CAT_ARDUINO, CAT_OTTO, CAT_ARDUINO_matrice8x8, CAT_ARDUINO_matrice16x8, CAT_OLED_U8G, CAT_BUZZER, CAT_ultrason, CAT_ARDUINO_TIME, CAT_LOGIC, CAT_MATH, CAT_FUNCTIONS, CAT_VARIABLES`
3. `buildToolbox` busca cada id con jQuery (`$('#CAT_X')`) y concatena su HTML. Por eso **una categoría anidada también puede mostrarse como categoría propia**: la categoría "Sensores" visible es `CAT_ultrason` (que está dentro de `CAT_SENSORS`), y "Zumbador" es `CAT_BUZZER` (dentro de `CAT_AUDIO`).
4. Los botones de nivel 1/2/3 (`defaultCategories1/2/3`) y el modal de configuración están **comentados/ausentes** en la UI; solo se usa la lista 1.
5. Algunas categorías de la lista pueden no mostrarse: `CAT_ARDUINO_matrice8x8` está dentro de un comentario `<!-- ... -->` del XML (línea ~535), por lo que no existe como categoría aunque esté en la lista. Verificar en la app qué se ve realmente antes de asumir.

**Para ocultar o mostrar una categoría completa:** quitarla o agregarla en `defaultCategories1`.
**Para ocultar un bloque sin borrarlo:** comentarlo en el XML (`<!-- OCULTO: <block type="..."></block> -->`).

### 4.3 Correcciones sobre Blockly (`www/js/mpr_fixes.js`)
Reemplaza `Blockly.FieldDropdown.prototype.showEditor_` para que las listas desplegables largas (por ejemplo, canciones del bloque "Tocar RTTTL") funcionen:
- Siempre se abren hacia abajo del campo, con el alto que quepa y barra de desplazamiento (`max-height` calculado). Solo si quedan menos de 90 px abajo se abren hacia arriba, sin pasar de la barra `#toptitle`.
- El contenedor `Blockly.WidgetDiv.DIV` se ajusta al alto de la lista, y `overscroll-behavior: contain` evita que la rueda mueva la ventana.
- En `www/css/blocklino.css`: `-webkit-app-region: no-drag` para `.blocklyWidgetDiv` / `.blocklyDropDownDiv` (la barra de título es zona de arrastre de Electron y capturaba los clics) y `html, body { overflow: hidden; }`.
- Se carga en `index.html` justo después de `blockly.min.js`. **`blockly.min.js` no se modifica.** Si se actualiza Blockly, revisar este archivo.
- Estado: iterado en 3 rondas con el usuario (posición, clics bajo la barra de título, scroll de la ventana). **Resultado final sin confirmar.**

### 4.4 Interruptores en el código
- `BlocklyDuino.mostrarSensoresExtra` (`www/js/blocklino.js`, línea 6): `false` oculta la categoría "Sensores extra". Poner `true` la muestra bajo "Sensores". No hay botón en la interfaz a propósito.

### 4.5 Búsqueda de bloques (lupa)
- `www/js/mpr_buscar.js` (objeto `MPRBuscar`), cargado después de `blocklino.js`. El botón `#btn_buscar` muestra u oculta la caja `#buscar_bloques`, que se ubica por JS a la izquierda de `#btn_group`. El antiguo botón del monitor serie (`btn_term`) está comentado en `index.html`.
- **Índice:** recorre `BlocklyDuino.workspace.options.languageTree` (el menú cargado, o sea solo las categorías visibles), crea cada bloque en un `Blockly.Workspace` sin pantalla y con eventos desactivados, y guarda sus textos, las opciones de sus listas (`FieldDropdown.getOptions_()`; las listas de variables se ignoran) y la ayuda. Se rehace si cambia el menú. Variables y Funciones (categorías `custom`) se leen en cada búsqueda.
- **Coincidencias:** texto normalizado (minúsculas, sin tildes ni símbolos); todas las palabras deben aparecer; puntaje: texto del bloque > opción de una lista > nombre de la categoría > ayuda. Si coincide una opción, el bloque se muestra con esa opción elegida (hasta 6 variantes por bloque, 40 resultados en total). Sinónimos en `MPRBuscar.SINONIMOS`.
- **Resultados:** `toolbox_.flyout_.show(lista)` con etiquetas (`<label>`) y bloques; antes se desmarca la categoría elegida (`clearSelection`). `Blockly.hideChaff` se envuelve para que un clic en el área de trabajo cierre el panel de resultados; al abrir la búsqueda se llama `Blockly.hideChaff(true)` para cerrar listas desplegables abiertas.
- `blockly.min.js` no se modifica. Si se actualiza Blockly, revisar `getOptions_`, `toolbox_.flyout_`, `tree_.getSelectedItem` y `hideChaff`.

### 4.6 Ventana principal siempre maximizada (noviembre 2026)
- `electronApp.js` (`createWindow`): la ventana se crea con `show: false` y se muestra maximizada en `ready-to-show` (con un respaldo a los 5 s); el evento `unmaximize` la vuelve a maximizar, así no se usa en ventanas pequeñas donde la barra de botones no cabe. El botón de maximizar de `index.html` queda oculto (`display:none`) pero debe existir, porque `factory.js` le asigna un `onclick`. Minimizar y cerrar siguen funcionando. Cambia `electronApp.js`: hay que cerrar y volver a abrir la app (F5 no basta).

### 4.7 Recorrido inicial y mascota Otto 3D (noviembre 2026)
- **Recorrido** (`www/js/mpr_tour.js`, objeto `MPRTour`): 7 pasos con globo y foco resaltado; se abre solo la primera vez (`localStorage.mpr_tour_visto`) y con el botón "?" (`#btn_tour`). Textos en `msg_es.js` (`tour_*`). El foco oscurece el resto con `box-shadow: 0 0 0 9999px`; **no quitar `overflow: hidden` ni `will-change: transform` de `#mpr_tour_velo`** (`blocklino.css`): sin ellos el velo era una capa de ~25.000 × 26.000 px que se repintaba en cada cuadro, y en gráficas integradas el recorrido iba a 15–30 cuadros/s (13.7). La primera vez, el recorrido espera además a que Otto 3D termine de cargar (`MPRMascota.cargando3D`, `MPRTour.iniciarCuandoListo`, máximo 6 s más), para que esa carga no se note como un tirón al aparecer.
- **Mascota** (`mpr_mascota.js`, `mpr_otto3d.js`, `mpr_consejos.js`, `three.min.js` r128, `media/otto3d.js`): Otto 3D en una esquina, arrastrable (posición en `mpr_masc_pos`), con menú (consejo, colores, avisos tranquilos, esconderse). Colores por pieza (cabeza, cuerpo, piernas, pies) en `mpr_masc_colores`; naranja por defecto.
- **Modelo:** `tools/convertir_otto.js <carpeta_3mf> www/media` convierte las piezas del 3MF (Bambu Studio) a un formato binario compacto (posiciones Int16 en centésimas de mm + índices, en base64) y genera dos modelos: `media/otto3d.js` **completo** (~123 mil triángulos en la pose, 1,3 MB) y `media/otto3d_liviano.js` (~26 mil, 284 KB; simplificado con `simplify` de meshoptimizer, conserva agujeros y logos). Hay un tercer modelo, `media/otto3d_minimo.js` (~5.500 triángulos, 59 KB), y la mascota **siempre intenta mostrarse en 3D**: se usa el completo (también en gráficas integradas); si el navegador dibuja por CPU (SwiftShader/llvmpipe, `MPRMascota.esSoftware`) se parte del mínimo y con `MPROtto3D.economia` (sin suavizado de bordes, pixel ratio 1, 20 cuadros/s al moverse y 8 en reposo); y si algún nivel va a menos de 17 cuadros/s (12 en modo económico) durante 5 s, baja solo completo → liviano → mínimo (`MPROtto3D.alLento` → `bajarCalidad`, sin reiniciar). `electronApp.js` agrega `app.commandLine.appendSwitch('ignore-gpu-blacklist')` para que Chromium use también las gráficas integradas o antiguas que descarta por defecto. Solo si WebGL no se puede crear queda el respaldo 2D. Se puede forzar con `localStorage.mpr_masc_calidad = "completa"`, `"liviana"` o `"minima"`. Sombreado plano real: `MPROtto3D.geometria` pasa a no indexada y calcula normales por triángulo (el `MeshLambertMaterial` de three r128 ignora `flatShading`). Todas las mallas tienen `frustumCulled = false` (Otto siempre cabe en su canvas): three.js no calcula esferas envolventes al arrancar ni prueba el recorte en cada cuadro, con la misma imagen. Se carga de forma perezosa; si está escondida no se carga el 3D. Reposo a 12 cuadros/s, animando a 30, pausa con la ventana oculta. Si no hay WebGL, usa `media/otto_emoji.png`. La pose está en `mpr_otto3d.js` y se calculó con fotos del Otto armado: todas las piezas del 3MF tienen su altura en `z` y el frente de la cabeza (agujeros del sensor) en `-y`, por eso se giran -90° en X; medidas en mm: pies y 0–26, piernas y 8–50 (a x = ±23), cuerpo y 50–89, cabeza y 84–123 (6 mm metida en el borde del cuerpo). Cada pie lleva la placa hacia afuera (`pieIzq` bajo la pierna derecha y `pieDer` bajo la izquierda). Como en el robot real, la cabeza va fija al cuerpo: forman un solo tronco que se inclina desde los tobillos (`inclinacion`, pivote y = 8) junto con las piernas; solo las piernas tienen movimiento propio (caderas) y los pies quedan planos. Las caderas giran las piernas sobre su eje vertical y los tobillos inclinan los pies (como los servos reales). De vez en cuando (cada 30–80 s, si no hay globo, cuadro de mensaje ni recorrido) Otto camina a otro punto de la mesa de trabajo girándose de perfil hacia donde va, o da una vuelta completa en su lugar (`MPRMascota.planificar/pasear`; `MPROtto3D.caminar/pararCaminar`, animación `vuelta`). La opción del menú "Quedarme en mi lugar / Pasear por la mesa" se guarda en `mpr_masc_pasea`. El paseo no se guarda como posición: al reabrir vuelve a la posición elegida por el niño. Los "ojos" son dos sensores ultrasónicos (cilindro plateado con malla oscura) en x = ±13,37 y a 6,0 mm sobre el centro de la cabeza (medidos en los agujeros de la cabeza original: 16,75 mm de diámetro); si se cambia la altura de la cabeza hay que recalcular la altura de los sensores. No son personalizables. Se carga de forma perezosa; si está escondida no se carga el 3D. Reposo a 12 cuadros/s, animando a 30, pausa con la ventana oculta. Si no hay WebGL, usa `media/otto_emoji.png`.
- **Detectores:** bloques sueltos (bloques de la mesa con `previousConnection` u `outputConnection` sin conectar), y lectura del cuadro `#messageDIV` con un `MutationObserver` (rojo = error, verde = éxito). Desde 4.9 el cuadro de subida ya trae la explicación: la mascota busca el error solo en el detalle técnico (`.mpr-detalle pre`), con `MPRConsejos.explicar`, que también usa `mpr_subida.js`. Para agregar un error común basta una línea en `MPRConsejos.ERRORES` (`mpr_consejos.js`, texto en minúsculas). Bloques que van una sola vez (`MPRMascota.UNICOS`, `revisarRepetidos`): si el niño agrega un segundo Configuración + Bucle o un segundo Configuración Otto, Otto le explica que ya está en la mesa (`MPRConsejos.REPETIDO_ESTRUCTURA` y `REPETIDO_CONFIG`).
- **Por verificar en Electron 4:** `three.min.js` r128 y WebGL en Chromium 69 (se probó solo en un Chrome moderno). Si falla, queda el respaldo 2D.

### 4.8 Proyecto nuevo con la mesa lista (noviembre 2026)
- Al abrir la app sin trabajo guardado (o con la mesa guardada vacía) y con el botón "Nuevo", la mesa trae **Configuración + Bucle con Configuración Otto adentro** (pines 2, 3, 4, 5 y buzzer 13), como el paso 4 del manual de programación (`BlocklyDuino.PLANTILLA` y `cargarPlantilla` en `www/js/blocklino.js`, llamadas desde `loadBlocks` y `discard`).
- Si el niño borra esos bloques **no vuelven solos** (pedido del usuario): solo al empezar otro proyecto. Abrir un ejemplo o un `.bloc` carga solo lo del archivo.
- El manual 2025 pide arrastrar "Configuración + Bucle" y "Configuración Otto". Si el niño agrega otro, Otto le explica que ya están (4.7, bloques que van una sola vez). Un segundo Configuración + Bucle lo quita el propio bloque (`onchange` con `undo`, heredado); un segundo Configuración Otto no hace daño (mismas claves en el código generado).

### 4.9 Subida a Otto: puerto y placa automáticos, pasos claros y precompilación (noviembre 2026)
- **Dónde:** `www/js/mpr_subida.js` (objeto `MPRSubida`). `index.js` lo inicia (`MPRSubida.iniciar`, con `sp`, `arduino_basepath`, la lista de puertos, el cuadro de mensajes y `uploadOK`) y la flecha naranja de las placas Arduino llama a `MPRSubida.cargar` (antes, Otto revisa los bloques: 4.13). El botón "Verificar" usa `MPRSubida.verificar` (mismo cuadro y errores explicados). Si el módulo no está (por ejemplo, en el navegador), `index.js` sigue con su código original. En los dos botones se detiene el `data-toggle="modal"` del HTML (`ev.stopPropagation()`): abría y cerraba el cuadro en el mismo clic, así que el primer paso "Verificando ..." no se veía.
- **Puerto automático:** revisa los puertos cada 2 s (`sp.list`) y al pasar el mouse por la lista. Si no hay puerto elegido y aparece un solo puerto USB, o un solo robot conocido por su VID (CH340, FTDI, Arduino, CP210x), lo elige y Otto dice "¡Me conectaste!". Si el puerto elegido desaparece, la lista vuelve a "Seleccionar puerto USB". Con puerto elegido, la lista lleva un anillo verde (`.mpr-puerto-listo`). Al abrir la app, como antes, se elige el primero.
- **Placa automática:** mientras compila, `avrdude -n` (solo lee la firma del chip, no escribe) prueba 115200 baudios ("Nano") y 57600 ("Nano Old"), con 6 s de límite cada una, empezando por la recordada para ese puerto (`localStorage.mpr_placa_<COM>`) y la elegida. Lo compilado sirve para las dos (mismo chip; comprobado con el robot), así que se sube con la que respondió, se cambia la lista y se avisa. Con la placa equivocada avrdude tardaba ~103 s en rendirse (medido). Si el robot no responde a ninguna velocidad o el puerto está ocupado, el error sale enseguida (~7 s) sin intentar subir.
- **Pasos claros:** "Verificando ..." (paso 1 de 2) y "Cargando ..." (paso 2 de 2), con una barra que avanza sola con una transición de `transform` según la última duración (`mpr_t_compila`, `mpr_t_sube`). Se mantienen las palabras que muestra el manual (Verificando, Cargando, OK code uploaded) y se agrega "¡Tu programa ya está en Otto!".
- **Errores explicados:** título ("No pude preparar tu programa" o "No pude enviar el programa a Otto"), la explicación de `MPRConsejos.explicar`, el código para el monitor con su pista (4.13) y el texto técnico plegado ("Ver detalle técnico (para tu profe)").
- **Verificar y luego la flecha:** si el código y la placa son los mismos que se verificaron bien, la flecha no vuelve a compilar (`MPRSubida.verificado`). Antes, Verificar dejaba la marca aunque fallara, y la flecha podía mandar lo último que sí había compilado. Textos en `msg_es.js` (`sub_*`); el aviso sin puerto es `Blockly.Msg.com2`.
- **Precompilación:** 8 s después de abrir (sin recorrido ni carga de Otto 3D en curso), si en `%TEMP%` no está lo compilado para ese programa y esa placa (`build.options.json` de las carpetas `arduino-sketch-*` y su carpeta `libraries\Otto`), compila un programa de Otto con prioridad "por debajo de lo normal" (la heredan avr-g++ y cc1plus; comprobado). Si el niño sube mientras tanto, espera a que termine. En el notebook la primera subida bajó de ~26 s a 11 s.
- Los procesos se lanzan con `execFile` y `windowsHide` (sin consola ni comillas).

### 4.9b Estilo común de las piezas MPR (pulido del 2026-11-09)
- Todo lo agregado por MPR usa el lenguaje visual del recorrido y del globo de Otto, para que no parezcan agregados: el recorrido, la mascota, el cuadro de subida (`#message`), el escenario, las misiones y la calibración.
- **Tarjeta:** fondo blanco, borde naranja de 3 px, radio de 18 px y sombra `0 8px 28px rgba(0,0,0,.35)`.
- **Texto:** título naranja en negrita de 17 a 19 px; texto azul oscuro (`#2d2d64`) de 14 a 15 px.
- **Botones:** el principal es naranja `#FF5700` (hover `#ff7a2e`) y los secundarios lavanda `#e6e9f7` (hover `#d4d8ee`), con radio de 10 px. Cerrar y achicar van discretos, en `#6f77a3`, arriba a la derecha.
- **Colores de estado:** el verde se usa solo para indicar estado (puerto conectado, "OK code uploaded", misión cumplida, calibración guardada), no en botones. El botón ▶ de la barra es un círculo azul oscuro del tamaño de la flecha naranja.
- **Puntos de avance:** como los del recorrido (naranja = hecho, anillo = actual, lavanda = pendiente).
- **Dónde:** en `blocklino.css`, bloque "piezas agregadas". Separaciones con márgenes, porque Chromium 69 no soporta `gap` en flex. Revisado con fotos de la app real.

### 4.10 Probar en pantalla: Otto 3D en un escenario (noviembre 2026)
- **Dónde:** `www/js/mpr_simulador.js` (`MPRSimulador`) y `www/js/mpr_otto_lib.js` (`MPROttoLib`). Botón `#btn_simular` (círculo azul oscuro con una pantalla y ▶, dibujados en SVG; al pasar el mouse dice "Probar en pantalla"), a la derecha de la flecha naranja. El escenario ocupa el 48 % derecho de la ventana y deja visible la mesa de bloques.
- **El mismo Otto de la mascota:** su canvas se muda al escenario mientras está abierto, sin cargar otro modelo. `MPROtto3D.escenario = { pose, camara, animando }` hace que su bucle use la pose y la cámara del simulador. Al cerrar, Otto vuelve a su esquina y a su tamaño. Si la mascota estaba escondida, se enciende el 3D solo para el escenario.
- **Movimientos fieles:** `mpr_otto_lib.js` es una traducción a JavaScript de la librería Otto del robot (oscilador, `_moveServos` con el limitador de 240 °/s, todas las canciones de `sing` y todos los gestos). Se comparó contra el firmware real ejecutado en un emulador: duraciones y ángulos iguales al milisegundo o casi. La librería manda los 4 ángulos con `hw.escribir`, avisa los desplazamientos con `hw.movimiento` y suena con `hw.tono`.
- **Pose:** los ángulos de los servos mueven caderas y tobillos. Los dos tobillos están montados igual: el mismo cambio en los dos balancea a Otto, y cambios opuestos lo suben en los cantos ("updown"). Con los ángulos fijos, el robot es un cuerpo rígido. `apoyo()` busca los dos puntos de las suelas que dejan el centro de masa entre ellos, sin otro punto bajo el suelo, y se queda con la postura más parecida a la anterior. "Inclinar a la izquierda" lo inclina 28° hacia su izquierda.
- **Mesa:**
  - Medidas: 1400 × 700 mm, con cuadrícula de 5 cm.
  - Desplazamientos aproximados: caminar avanza 25 mm por paso, girar gira 20° por paso, y moonwalker y crusaito lo mueven 12 mm de lado.
  - Si Otto llega al borde, la prueba se detiene con el aviso "el robot de verdad se caería".
- **Tablero:** cuadros de 10 cm en dos tonos de madera (una sola geometría con colores por vértice). Otto parte en el centro de un cuadro. La caja, al arrastrarla, cae justo en el centro de un cuadro (`alCuadro`), con una marca naranja en la casilla de destino; así los niños pueden contar cuadros (1 cuadro = 10 cm).
- **Caja y sensor:** la caja se arrastra con el mouse y se puede quitar. El bloque de distancia mide hasta ella con tres rayos (como el cono del sensor) y la distancia se ve siempre arriba. Si Otto choca con la caja, hay un aviso.
- **Cámara:** sigue a Otto y se aleja sola para mostrar también la caja. Gira a su alrededor (`vista`: giro, altura y zoom, con transición suave): arrastrar el suelo la gira, la rueda acerca o aleja, y los botones redondos de la derecha (como los de la mesa de bloques) giran, acercan, alejan y vuelven a la vista de siempre (⌂).
- **Intérprete:** recorre los bloques de forma asíncrona e ilumina el que se ejecuta. Configuración corre una vez y Bucle se repite, con un máximo de 3 minutos. Soporta Otto, Zumbador (canciones latinoamericanas desde `Blockly.MPR_CANCIONES`; las extranjeras se leen de `PlayRtttl.h`), Tiempo, Lógica, Matemática (con `map` entero de Arduino), Variables y Funciones. Lo que no puede simular lo avisa una vez y lo salta. Si el niño cambia el programa durante la prueba, se detiene.
- **Sonido:** zumbador con WebAudio, onda cuadrada a volumen bajo, con botón de silencio (`localStorage.mpr_sim_silencio`). Sin prueba en curso, el audio se suspende.
- **Rendimiento (notebook):** 30 cuadros/s con la gráfica integrada y el modelo completo. Sin GPU (`--disable-gpu`), 20 cuadros/s con el modelo mínimo en modo económico, igual que la mascota.

### 4.11 Misiones (noviembre 2026)
- **Dónde:** `www/js/mpr_misiones.js` (`MPRMisiones`). Botón 🏁 `#btn_misiones` en el grupo de la derecha; la fuente de íconos de la app no trae bandera, por eso es un emoji. La tarjeta aparece abajo, junto al menú de bloques, para no tapar Configuración + Bucle.
- **10 misiones**, siguiendo el manual: ¡Hola, Otto!, ¿Cuántas veces sonó?, Un paso, Cinco pasos, ¡Más rápido!, Camina y gira, ¡A bailar! (con Detener), Te veo (sensor), Esquiva la caja y Sube el Cerro Renca. Cada una tiene objetivo, pista, "▶ Probar" (abre el escenario) y "✅ Revisar". Revisar mira los bloques de Configuración y Bucle, también los que están dentro de Repetir o Si. "Sube el Cerro Renca" se marca a mano.
- **Al cumplir una:** Otto celebra, la tarjeta se anima y pasa a la siguiente. El avance se guarda en `localStorage.mpr_misiones` y el botón muestra el conteo (por ejemplo, 3/10). Para el siguiente niño, Mayúscula + doble clic en "Misión N / 10" reinicia el avance.
- **Textos:** `msg_es.js` (`mis_*`). Las revisiones están en `MPRMisiones.LISTA`.

### 4.12 Calibración para monitores (noviembre 2026)
- **Dónde:** `www/js/mpr_calibracion.js` (`MPRCalibracion`). Se abre con **Ctrl + Mayús + O**: no tiene botón, para que los niños no la abran por accidente.
- **Funcionamiento:**
  1. "Preparar Otto" sube un programa de calibración (`MPRCalibracion.PROGRAMA`) con la subida normal (`MPRSubida.cargar(codigo, alTerminar)`) y abre el puerto serie a 9600 baudios.
  2. El robot informa `MPR_CAL G a b c d`: los ajustes ("trims") de su EEPROM, en las direcciones 0 a 3.
  3. Cuatro deslizadores de ±40 mandan `T a b c d` y Otto se mueve al instante. Mantiene los servos firmes con `_moveServos`, porque `home()` los suelta.
  4. "Guardar en Otto" manda `S` (guarda en la EEPROM), "Probar caminando" manda `W` y "Volver a como estaba" regresa a los valores leídos al empezar.
- **Después:** todos los programas usan esos ajustes solos, porque Configuración Otto genera `Otto.init(..., true, ...)`, que los lee al encender.
- **Probado con el Otto del usuario:** tenía −1, −1, −1, −1 (EEPROM nunca calibrada). Se guardó un ajuste de prueba y se restauraron los originales, verificados al reiniciar.
- **Confirmación:** cada cambio que Otto aplica se muestra en el panel ("Otto aplicó: ... todavía no está guardado"); si no responde al guardar en 4 s, se avisa. Cada marca de la barra es 1°: los cambios pequeños casi no se ven en el robot.
- **Trampa:** el programa lee cada orden como una línea completa (`readStringUntil` + `sscanf`); con `Serial.parseInt` los números se desfasaban entre órdenes.

### 4.13 Otto revisa el programa antes de mandarlo y códigos de error para el monitor (noviembre 2026)
- **Pedido:** que los bloques sueltos no se cuelen en el programa (los niños cambian Caminar por Bailar y dejan el bloque viejo afuera) y que Otto ataje los errores típicos y diga qué hacer; Otto ayuda primero y, si no se arregla, el niño llama al monitor de la mesa con un código.
- **Bloques sueltos (generador):** `www/js/mpr_revision.js` envuelve `Blockly.Arduino.blockToCode`. Un bloque de arriba que no es Configuración + Bucle, una función ni un bloque de definición (`MPRRevision.ARRIBA`) se genera igual, para conservar lo que aporta a la configuración (`#include`, pines, `Otto.init`), pero su código del Bucle se descarta. Antes, Blockly lo ponía dentro de `loop()`, antes o después según su posición en la mesa. En los 85 ejemplos que generan código, el código queda igual; `ledpot`, `ledfadepot` y `matrixhands` ya no generaban antes (usan bloques sin generador).
- **Revisión antes de mandar** (`MPRRevision.revisar`, desde la flecha y desde Verificar). Muestra el problema más importante en el cuadro "Otto revisó tu programa", marca los bloques con un borde amarillo (clase `mpr-marcado`, que se quita al cambiar algo en la mesa), y Otto dice "¡Espera! ... mira el cuadro". Los arreglos se deshacen con un solo Ctrl + Z.

  | Problema | ¿Se puede mandar igual? | Arreglo de Otto |
  |---|---|---|
  | Falta Configuración + Bucle | no | la pone y mete adentro la fila suelta del niño |
  | Bloques de Otto sin Configuración Otto | no | la pone al principio de Configuración (pines 2, 3, 4, 5 y 13) |
  | Bloque de distancia sin la configuración del sensor | no | la pone después de Configuración Otto (Trig 8, Echo 9) |
  | Un bloque con un espacio vacío (si, comparar, repetir, esperar...) | no | solo lo marca (el niño lo completa) |
  | Configuración Otto o el sensor afuera de Configuración + Bucle | sí ("Mandar igual") | la mete en Configuración |
  | Bloques sueltos | sí ("Mandar sin los sueltos") | los lleva a la papelera |
  | Bucle vacío | sí | — |

  Después de arreglar, revisa otra vez y, si no queda nada, manda. Probar en pantalla muestra el mismo aviso (sin detener la prueba).
- **Códigos de error** (`MPRConsejos.ERRORES`, en `www/js/mpr_consejos.js`). Cada error de compilar o subir tiene un código corto, para decirlo en voz alta en una mesa con ruido. El cuadro muestra "Código para tu monitor: P3" con una pista para el monitor. Si el mismo código sale 3 veces seguidas sin un envío bueno entre medio (`MPRConsejos.VECES`), el cuadro y Otto dicen "Levanta la mano y llama a tu monitor: dile «código P3»".

  | Código | Qué pasa (texto real que lo identifica) | Qué hace el monitor |
  |---|---|---|
  | P1 | No hay puerto elegido | Conectar el robot; si no aparece un COM: cable de datos y driver CH340 (`driversUSB`) |
  | P2 | El puerto ya no existe ("El sistema no puede encontrar el archivo especificado") | Revisar cable y conector; ver que aparezca un COM en la lista |
  | P3 | Puerto ocupado ("Acceso denegado", `can't open device`) | Cerrar otra MPR Blockly, Arduino IDE o monitor serie; desenchufar y enchufar; reiniciar la app |
  | P4 | La placa no responde (`not in sync`, `programmer is not responding`) | Otro cable de datos u otro USB; ver que la placa tenga luz (la app ya prueba Nano y Nano Old) |
  | B2 | Falta Configuración Otto (`'Otto' was not declared`) | Ponerla en Configuración (Otto también lo ofrece antes) |
  | B3 | Falta la configuración del sensor (`'ultrasound_distance_simple' was not declared`) | Ponerla en Configuración, Trig 8 y Echo 9 |
  | B4 | Espacio vacío en un bloque (`expected primary-expression`, `invalid type argument of unary '*'`) | Completar el bloque marcado |
  | B5 | Algo repetido (`redefinition`) | Quitar la configuración o función duplicada |
  | B6 | Nombre que no existe (`was not declared`) | Ver en el detalle qué variable o función falta |
  | M1 | Programa más grande que la memoria del Nano | Quitar canciones largas o bloques repetidos |
  | A1 | Falta arduino-cli o sus archivos (`ENOENT`, `spawn`) | Reinstalar MPR Blockly |
  | A9 | Error no reconocido | Abrir "Ver detalle técnico" y leer la primera línea con "error" |

  Los mensajes se probaron en la app: compilando cada error típico de un niño, con un puerto que no existe y con el puerto de Otto tomado por otro programa. Para agregar un error, basta con una línea en `ERRORES`. El orden importa: P2 va antes que P3, porque los dos traen `can't open device`.
- **Textos:** `msg_es.js` (`rev_*`, `sub_codigo`, `sub_verifica`); los de los errores están en `mpr_consejos.js`.

---

## 5. Cambios de MPR sobre Otto Blockly (inventario)

Para el detalle y los commits de cada cambio de octubre, ver `BITACORA.md`. Resumen funcional:

### 5.1 Interfaz y marca
Logos Crecer en Renca / Innova / La Fábrica / Renca en el pie de página, colores, título "MPR Blockly", ícono MPR (`build/mpr.ico`, `www/media/mpr_app.ico`), interfaz simplificada, selector de idioma oculto (`code.js` fija `es`).

### 5.2 Menú de bloques actual (visible)
Estructura, **Otto**, **Zumbador**, **Sensores** (solo ultrasonido), Tiempo, Lógica, **Matemática** (sin casting), Funciones, Variables. "LED Ojos" (matriz 16x8) y OLED están en `defaultCategories1` pero no se ven (revisado en la app el 2026-11-08). El usuario pidió dejar el menú como está por ahora (no simplificarlo más para el evento).
Ocultos (sin borrar): categoría **Texto**; bloques Otto `App code` (`otto9_app`), `Guardar Trims en EEPROM` (`otto_eeprom`) y `Dance smooth criminal` (`otto9_smooth`); casting en Matemática; "Sensores extra".

### 5.3 Bloques de Otto
- `otto_configuration` (en `www/blocs&generateurs/ottoesp.js`): título **"Configuración Otto"** (con tilde desde el 2026-11-08, como en el manual), pines por defecto: pierna izq. 2, der. 3, pie izq. 4, der. 5, buzzer 13. Genera `#define LeftLeg/RightLeg/LeftFoot/RightFoot/Buzzer`, `Otto.init(...)` y `Otto.home()`.
  Además genera `const int buzzer = <pin>;` (minúscula) con la clave `definitions_['setup_buzzer']`, la misma que usa el bloque `buzzer_init`, para que los bloques de sonido de `audio.js` (que escriben `buzzer`) compilen. C++ distingue mayúsculas. **Verificado por el usuario: compila y suena.**
- Bloques de sonido de Otto (`otto_sound` = `Otto.sing`, `otto_tone` y `otto_tonehz` = `Otto._tone`, `otto_bendtone` = `Otto.bendTones`) se muestran ahora en **Zumbador**, no en Otto.
- Bloque "Hz" (`otto_tonehz`, Zumbador): en el menú trae 262 Hz (Do4), 500 ms y 100 ms de silencio; venía con 10 Hz (no suena) y 261 en la duración. `otto_moveservos` dice "Posiciones" (decía "Positions").
- **"⏹️ Detener a Otto"** (`otto_detener`, categoría Otto, después de Gesto): genera `Otto.home();` y `while (true) { }`: Otto vuelve a la posición inicial y el programa termina ahí, para que no siga caminando para siempre y se caiga de la mesa. No admite bloques debajo (no se ejecutarían).
- Textos que **no se cambian** porque el manual de programación los muestra así: "Inicio", "Mover ↑ Adelante", "Velocidad Normal" (el orden Normal, Lento, Rápido, Muy rápido deja Normal como valor por defecto; ese menú lo usan 6 bloques), "Sonido 😃 Feliz", "Repetir". "Ola" (`OttoWave`) es una onda de sonido y boca, no un saludo.

### 5.4 Ultrasonido
Bloques `ultrasonic_sensor` (configuración, pines 8 y 9 por defecto) y `ultrasonic_distance` (lectura) en `sensors.js`. Generan `ultrasound_distance_simple()` con `pulseIn` y `duration/58`. (Existe una variante para pines 4/5 con otros tiempos.) Los demás bloques pasaron a `CAT_SENSORES_EXTRA`. **Verificado por el usuario ("está bien").**

### 5.5 Librería Otto (`compilation/arduino/userlibs/libraries/Otto/`)
- **Limitador de velocidad de servos**: `OTTO_DIFF_LIMIT_DEFAULT` en `Otto.h` = **240** grados por segundo (desde oct‑2026; antes 3, que en la práctica era 1 grado por orden y recortaba los pasos). Después de una pausa (más de `OSCILLATOR_MAX_DT_MS` = 50 ms sin órdenes) el primer paso es como un solo pulso de 20 ms. Análisis, números y pruebas en `ANALISIS_SERVOS.md`. **No cambiar sin que lo pidan y sin probar en el robot.**
- **Arranque escalonado:** `Otto::init()` lee los trims y conecta los servos de a uno (`OTTO_ATTACH_DELAY_MS` = 200 ms).
- **Reconexión sin salto:** `Oscillator::attach()` envía la última posición conocida con trim antes de conectar (antes mandaba a 90 sin trim después de cada `home()`).
- Refresco round‑robin de servos (se mantiene; con el límite en grados/s ya no frena el movimiento).
- Corrección en `_moveServos`: la trayectoria se calcula desde la posición inicial en `double`; antes `pos + 4*increment` se truncaba a `int` y los movimientos lentos hacia ángulos mayores no avanzaban.
- `OTTO_DBG_BEGIN`: en Uno/Nano `Serial` siempre es verdadero, nunca iniciaba (`OTTO_DBG` desactivado por defecto).

### 5.6 Canciones del bloque "Tocar RTTTL"
El bloque `RTTTL_music` (Zumbador) toca melodías RTTTL con la librería PlayRtttl. Las canciones agregadas por MPR están en `www/blocs&generateurs/mpr_canciones.js` (`Blockly.MPR_CANCIONES`: texto, identificador `MPR_...`, melodía) y aparecen primero en la lista; el generador (`RTTTL.js`) escribe la melodía en el programa como `PROGMEM` solo si se usa. Hay dos bloques: `RTTTL_music_lat` (latinoamericanas) y `RTTTL_music` (extranjeras de la librería: TV/dibujos y Navidad, 20 canciones). Hoy en el bloque latinoamericano: 10 canciones (4 de 31 Minutos, Himno Nacional de Chile, La Bamba, Cielito lindo, Run Run se fue pa'l norte, La cucaracha, Gracias a la vida), mostradas como "Misteriosa N: pista" (acertijo corto; ventana mínima 1100×650) (cada una, con sus etapas: tema y coro suenan seguidos); el nombre real se revela al subir el programa al robot (`index.js`, `revelarCanciones`). Formato de `Blockly.MPR_CANCIONES`: texto neutro, identificador, nombre real, etapas. Fuentes y confianza en `BITACORA.md`. Para hacer canciones nuevas: `tools/rtttl/partitura_a_rtttl.py` (guía y recetas de las 6 en `tools/rtttl/LEEME.md`).

### 5.7 Ejemplos
`www/examples/examples.json` define qué ejemplos se ven. Sección "Ejemplos Mi Primer Robot": Caminar (`Ottowalk.xml`), Canto (`mpr_sing.xml`), Movimiento improvisado (`mpr_randommove.xml`), Meneito (`mpr_meneito.xml`), Equilibrio (`mpr_balance.xml`), Subir el Cerro Renca (`mpr_cerro.xml`) y, desde el 2026-11-08, cuatro de Otto Blockly con nombre en español (los archivos son los mismos): Baile completo (`Ottodance.xml`), Me alejo si te acercas (`Ottoavoidpeople.xml`), Sigue mi mano (`Ottofollow.xml`) y Esquivar obstáculos (`Ottoavoid.xml`); los tres últimos usan el ultrasonido (pines 8 y 9, como el kit). Luego "Explora otros ejemplos" (los heredados en inglés, que se mantienen). El comentario de configuración de `mpr_meneito.xml` y `mpr_salto.xml` quedó en español. `mpr_salto.xml` existe en `www/examples/` pero **no está en `examples.json`**, así que no se muestra.

### 5.8 Otros
- Compilación: `arduino-cli.yaml` sin índices de terceros y con telemetría desactivada.
- `electronApp.js`: rutas válidas instalada/desarrollo; enlaces externos se abren en el navegador; actualizador desactivado; instancia única; abre `.bloc` por argumento (también con la app abierta); F5/F8 solo con el foco en la app (antes eran atajos globales de Windows).
- `index.js`: `chdir` a la carpeta de instalación (doble clic en `.bloc`); etiqueta "MPR Blockly V<versión>".

---

## 6. Desarrollo y pruebas

### 6.1 Configuración del puesto de trabajo (una sola vez)
1. En `C:\ClaudeCode\MPR_Blockly` están los archivos de entrega: `PREPARAR_CODIGO.bat`, `MPR_Blockly.bundle`, `actualizacion.bundle`, `UNIR_INSTALADOR_1.1.1.bat`, instaladores.
2. Ejecutar `PREPARAR_CODIGO.bat`: clona `MPR_Blockly.bundle` en `C:\ClaudeCode\mpr-blockly` y aplica `actualizacion.bundle` (fast‑forward). El aviso `No such remote: 'origin'` es inofensivo. Requiere Git.
3. Trabajar siempre en `C:\ClaudeCode\mpr-blockly`: `cd /d C:\ClaudeCode\mpr-blockly` y `claude`.
4. MPR Blockly debe estar instalado en `C:\MPRBlockly` para probar.

### 6.2 Ciclo de un cambio
1. Pedir/hacer un cambio **pequeño** (un tema por commit, mensaje en español).
2. `node --check` sobre los `.js` modificados.
3. `python tools/probar.py` — copia a `C:\MPRBlockly` solo lo que difiere (`www/`, `userlibs/`, `arduino-cli.yaml`, `electronApp.js`, `index.js`, `factory.js`, `term.js`, `repl.js`). Pide permiso de administrador (la carpeta instalada es de solo lectura para Usuarios) y continúa en una ventana de administrador. `--simular` muestra qué copiaría; `--destino` cambia la ruta.
4. En la app: **F5** recarga `www/`. Si cambió `electronApp.js`, cerrar y reabrir. Los cambios de la librería Otto se usan en la próxima compilación.
5. Verificar en la app; si toca bloques o generadores, **compilar un ejemplo**:
   `compilation\arduino\arduino-cli.exe compile --fqbn arduino:avr:nano:cpu=atmega328old sketch\sketch.ino` desde `C:\MPRBlockly\compilation\arduino`.
6. Commit y entrada en `BITACORA.md` (en el mismo commit).

### 6.3 Reglas del proyecto (de `CLAUDE.md`)
- App **solo en español**; textos en `www/lang/Arduino_es.js` y `msg_es.js`.
- **No migrar** Electron ni serialport.
- Solo placas AVR (core `arduino:avr` 1.8.3); no agregar otras sin incluir su core en `tools/build_installer.py`.
- Mantener los cambios MPR (logos, ejemplos `mpr_*.xml`, toolbox, menú de velocidades, librería Otto).
- Respetar el fin de línea de cada archivo. Hay mezcla: por ejemplo `index.html` y `blocklino.js` son **CRLF**, mientras que `Arduino_es.js` y `toolbox_arduino_all.xml` son **LF**. Las herramientas de edición pueden convertirlos; verificar con `git diff --stat` que solo cambien las líneas esperadas.
- Preferir **ocultar** a borrar (instrucción del usuario): permite reactivar con una línea y no rompe proyectos antiguos.

### 6.4 Desarrollo sin instalar (opcional)
`npm install` (recompila serialport para Electron 4.1.1; requiere Visual Studio Build Tools) y `npm start`. Para compilar/subir hace falta `compilation/arduino` con arduino-cli y el core AVR; lo más simple es probar con el instalador.

### 6.5 Medir el rendimiento en la app real
Los problemas de rendimiento pueden no verse en un Chrome moderno (así pasó con el recorrido): hay que medir en la app instalada, que es Chromium 69. `tools/medir_app.mjs` (Node 22 o más nuevo) se conecta a la app por DevTools y mide sin cambiar nada guardado:
1. Cerrar MPR Blockly y abrirlo con `"C:\MPRBlockly\MPR Blockly.exe" --remote-debugging-port=9222`. Para simular un PC sin aceleración gráfica, agregar `--disable-gpu`.
2. `node tools/medir_app.mjs info | recorrido | capas | reposo [segundos]`: GPU y modelo de Otto, cuadros/s de cada paso del recorrido, capas del compositor con su tamaño, y CPU/memoria de cada proceso en reposo.
3. Valores del notebook con gráfica integrada (13.7): recorrido de 55–60 cuadros/s; ninguna capa mucho mayor que la ventana.
4. Al terminar, cerrar la app y abrirla normal. El puerto solo escucha en 127.0.0.1, pero no conviene dejarlo abierto.

---

## 7. Instalador y distribución

### 7.1 Generar el instalador
1. Descargar `ottoblockly.Setup.1.5.0.exe` de https://github.com/OttoDIY/blockly/releases/tag/v1.5.0 y dejarlo en la raíz del repo (el script verifica su SHA‑256).
2. Una vez: `winget install 7zip.7zip NSIS.NSIS` (NSIS 3.08 o más nuevo; Node.js y Python ya instalados).
3. Subir la versión en `package.json`.
4. `python tools/build_installer.py --official ottoblockly.Setup.1.5.0.exe`. Con certificado de firma, agregar `--firma "/sha1 <huella>"` (ver 7.5).
5. Resultado: `dist\MPR_Blockly_Setup_<versión>.exe`. En el notebook tarda unos 14 minutos.

`tools/build_installer.py` extrae el instalador oficial, conserva el runtime de Electron y los paquetes AVR mínimos (`arduino:avr` 1.8.3, avr-gcc, avrdude, arduinoOTA), pone encima el código del repo, cambia ícono y datos de versión del `.exe` (resedit‑cli), y compila `build/installer.nsi` con `makensis -INPUTCHARSET UTF8 -DSTAGE -DVERSION -DOUTFILE` (el `.nsi` es UTF-8 sin BOM). La carpeta de trabajo es `C:\mprb` (corta a propósito por el límite de 260 caracteres de Windows). No usa 7za (no abre instaladores NSIS).

### 7.2 Qué hace el instalador (`build/installer.nsi`)
- **Un clic** (desde la 1.4.1): después del permiso de administrador solo muestra la barra de progreso. Al terminar se cierra sola y abre la app **sin privilegios de administrador** (`RunAppNotElevated`). No hay pantallas de bienvenida, licencia, carpeta ni final: la GPL-2.0 no exige aceptarla y `LICENSE.md` queda junto al programa. Solo corre una copia del instalador a la vez (mutex `MPRBlocklyInstalador`).
- **Si la app está abierta, la cierra sola** (`build/cerrar_app.nsh`). Detecta que `MPR Blockly.exe` está en uso porque no se puede abrir para escritura (error 32) y le envía `WM_CLOSE` a su ventana, como al apretar la X. La app respalda los bloques del alumno (`loadOnceBlocks`) y los recupera al abrirse; el instalador espera hasta 15 s. No usa `cmd`, `tasklist` ni `taskkill`: un ejecutable de prueba que los usaba quedó en cuarentena del antivirus del notebook. Si la app no se cierra (por ejemplo, abierta en otra sesión de Windows), con ventana pide cerrarla y en modo silencioso cancela con código 2.
- **Modo desatendido:** `MPR_Blockly_Setup_<versión>.exe /S` instala sin ventanas y sin abrir la app (código 0 = instalado, 2 = no se pudo cerrar la app). Para otra carpeta: `/S /D=D:\MPRBlockly` (siempre al final). Para desinstalar: `"C:\MPRBlockly\Desinstalar.exe" /S`, que también queda como `QuietUninstallString` en el registro. Desde un script con permisos de administrador o una herramienta de despliegue no aparece ninguna ventana.
- Instala en `C:\MPRBlockly` (no choca con Otto Blockly oficial).
- Accesos directos; asociación de `.bloc` (`MPRBlockly.bloc`); desinstalador (`Desinstalar.exe`, borra solo lo instalado según lista generada); entrada en Agregar o quitar programas.
- **Permisos (`icacls`)**: SYSTEM y Administradores control total; Usuarios solo lectura y ejecución, **salvo** `compilation\arduino` y `config.json`, que Usuarios puede modificar. Así los alumnos sin administrador pueden compilar y subir, y una DLL plantada no se ejecuta como administrador.
- Instala siempre el driver CH340 (al final de la copia de archivos) con `pnputil /add-driver ...ch341ser.inf /install`; el código de salida 3010 se considera correcto. `pnputil` no reemplaza un driver más nuevo ya instalado por Windows Update. Es un driver WHQL y no muestra ventanas. Si falla, con ventana se abre la carpeta del driver para instalarlo a mano; en modo silencioso no se abre nada.

### 7.3 Archivos de entrega y bundles (carpeta `C:\ClaudeCode\MPR_Blockly`)
| Archivo | Para qué |
|---|---|
| `MPR_Blockly.bundle` | Repositorio git completo hasta la versión 1.1.0 |
| `actualizacion.bundle` | Commits posteriores (hasta `32ad6ed`, `probar.py`) |
| `PREPARAR_CODIGO.bat` | Crea/actualiza `C:\ClaudeCode\mpr-blockly` desde los bundles |
| `MPR_Blockly_Setup_1.1.0.exe`, `MPR_Blockly_Setup_1.1.1.exe` | Instaladores generados |
| `UNIR_ARCHIVOS.bat`, `UNIR_INSTALADOR_1.1.1.bat` | Reúnen archivos grandes entregados por partes (`.parteNN`) y verifican SHA‑256 (1.1.1: `148ce62d9434b2bca4f3ca6ac26918915f1d63f05710097afa083ac1ac991b87`; 1.1.0: `b4afe355df2b045928cd156d096184adcbe29d07193c39b6f55b87df2a49467c`) |
| `MPR_cambios_vs_OttoBlockly.patch` | Resumen legible de los cambios reales del parche frente a upstream |

**Importante:** los bundles y los instaladores 1.1.0/1.1.1 **no contienen** los cambios de octubre de 2026. Esos cambios están en el instalador 1.2.0 (`dist\`). Los bundles no se han regenerado (`git bundle create` si se necesitan).

### 7.4 Versiones
| Versión | Contenido |
|---|---|
| 1.1.0 | Primera versión empaquetada (parche + base actual + instalador) |
| 1.1.1 | Driver CH340 marcado por defecto en el instalador; sin otros cambios de la app |
| 1.2.0 | Incluye los cambios de octubre 2026 de la sección 8. Generado el 2026-10-02: `dist\MPR_Blockly_Setup_1.2.0.exe`, 138 MB, SHA‑256 `e54bbe5cddc798a0879926154472b35fb9cb1617006fe80d594cb0d0cdbd54e3`. Pendiente de pruebas en otros PCs |
| 1.3.0 | Cambios del 18 y 23 de octubre de 2026 (velocidad Muy rápido, búsqueda de bloques, canciones RTTTL, bloque map, acentos del instalador, driver CH340 obligatorio). Generado el 2026-10-23: `dist\MPR_Blockly_Setup_1.3.0.exe`, 138 MB, SHA‑256 `549fcf71ed2f3cd6f0c46192006016e940a83dd235998d6def2923ca612b6769`. Pendiente de pruebas |
| 1.4.0 | Cambios de noviembre 2026: recorrido inicial "Conoce a Otto", mascota Otto 3D (consejos, errores comunes, colores personalizables, paseos; modelos completo/liviano/mínimo que siempre se ven en 3D, también sin GPU), ventana principal siempre maximizada, arreglos visuales (contorno verde del botón de cargar, buscador). Generado el 2026-11-08: `distMPR_Blockly_Setup_1.4.0.exe`, 139 MB, SHA‑256 `5c53b29aeb7312f86576974edcaea3f9e25167232a0d7e04f3f8de3b8b44081a`. Pendiente de pruebas (en especial el 3D en Electron 4 y en un notebook sin GPU) |
| 1.4.1 | Recorrido fluido en gráfica integrada, recorrido que espera a Otto 3D, Otto sin recorte por vista (13.7) e instalador de un clic y desatendido (`/S`), que cierra solo la app (7.2). Generado el 2026-11-08 en el notebook: `dist\MPR_Blockly_Setup_1.4.1.exe`, 139 MB, SHA‑256 `49749d6553d28c30677b3ddcc3c070064c11034d39e60ab5935b29791c7a90c9`, **sin firma** (7.5). Probado en el notebook: instalación de un clic sobre la 1.4.0 con la app abierta (155 s); desinstalación e instalación silenciosas (72 s y 109 s); preferencias conservadas |

La versión de `package.json` se pasa al `.nsi` (`-DVERSION`) al generar el instalador.

### 7.5 Avisos de seguridad de Windows y firma digital (revisión del 2026-11-08)
El instalador y los programas **no tienen firma digital** (Authenticode). De los 57 ejecutables instalados, 55 no tienen firma; solo los drivers y `d3dcompiler_47.dll` traen la de su autor. Por eso Windows puede mostrar estos avisos:

| Aviso | Cuándo aparece | Cómo reducirlo sin certificado | Con certificado |
|---|---|---|---|
| Control de cuentas de usuario amarillo: "¿Quieres permitir que esta aplicación de un **editor desconocido**...?" | Siempre, porque el instalador necesita permisos de administrador | No se puede quitar: es un clic en "Sí". Con herramientas de despliegue (modo `/S` como administrador) no aparece | Pasa a azul: "Editor comprobado: \<nombre\>" |
| SmartScreen: "**Windows protegió su PC**... aplicación no reconocida" | Solo si el archivo trae la marca "descargado de Internet" (navegador, correo, Teams, WhatsApp Web) | Copiar el instalador por pendrive, por la carpeta de OneDrive sincronizada o por una carpeta de red, que no ponen la marca. Si se descargó: clic derecho → Propiedades → **Desbloquear** (o `Unblock-File` en PowerShell) | Se reduce a medida que el certificado gana reputación con las instalaciones. Desde 2024 ningún certificado (ni EV) la da de inmediato |
| Antivirus: "el archivo contiene un virus o software potencialmente no deseado" | Heurística ante ejecutables nuevos sin firma. Acronis, en el notebook, puso en cuarentena un ejecutable de prueba que usaba `taskkill` | El instalador ya no usa `cmd`, `tasklist` ni `taskkill`. Si un antivirus lo bloquea, reportarlo al fabricante como falso positivo | La firma ayuda mucho |
| **Control inteligente de aplicaciones** (Smart App Control, Windows 11) | Si está activado. Desde abril de 2026 se puede activar en cualquier PC; no aplica a equipos administrados por una organización | Bloquea programas sin firma ni reputación **sin opción de ejecutarlos igual**, y eso incluye `arduino-cli` al compilar. La única salida es desactivarlo en Seguridad de Windows → Control de aplicaciones y del navegador | Con todo firmado, funciona |

**Firma digital, la solución de fondo.** Opciones vigentes en noviembre de 2026 (confirmar precios antes de comprar):
- **Certum Open Source Code Signing en la nube (SimplySign), desde ~€49 al año.** Es para desarrolladores individuales de software libre no comercial, y MPR es GPL-2.0. El certificado sale a nombre de la persona ("Open Source Developer, \<nombre\>"). Permite 5.000 firmas al mes; cada instalador usa unas 80.
- **Certificado OV a nombre de la organización:** Certum en la nube cuesta ~€209 al año y otros emisores, entre US$129 y 530. Muestra el nombre de la institución y requiere validarla.
- **Azure Artifact Signing** (Microsoft, US$9,99 al mes) **no está disponible para organizaciones de Chile**: según Microsoft, solo para EE. UU., Canadá, la UE y el Reino Unido.
- Desde junio de 2023 las claves deben estar en hardware o en la nube; ya no se entregan archivos `.pfx`. Un certificado OV sirve igual que uno EV para SmartScreen.

**Cómo firmar al generar el instalador.** Con el certificado instalado en Windows (con Certum, SimplySign Desktop conectado), ejecutar `py tools/build_installer.py --official <ruta>\ottoblockly.Setup.1.5.0.exe --firma "/sha1 <huella>"` (o usar la variable `MPR_FIRMA`). El script firma con sello de tiempo (DigiCert por defecto, opción `--tsa`):
- el instalador (`!finalize` de NSIS);
- `Desinstalar.exe` (`!uninstfinalize`);
- los 77 `.exe`, `.dll` y `.node` que vienen sin firma: MPR Blockly y las herramientas de Arduino. Los que ya traen firma no se tocan.

Requiere `signtool.exe` (`winget install Microsoft.WindowsSDK.10.0.26100`). Se probó el 2026-11-08 con un certificado autofirmado de prueba (luego borrado), y quedaron firmados los tres tipos de archivo.

**Opcional y gratis, en cada versión:** enviar el instalador a Microsoft como desarrollador (https://www.microsoft.com/wdsi/filesubmission, opción "Software developer") para que lo revisen. Ayuda sobre todo si Defender lo marca; no es seguro que quite el aviso de SmartScreen.

---

## 8. Registro de cambios de octubre 2026 (con Claude Code)

Detalle completo, motivos y cómo revertir cada cambio en `BITACORA.md`. Estado de verificación:

| # | Cambio | Archivos | Verificado por el usuario |
|---|---|---|---|
| 1 | Buzzer: `const int buzzer` junto a `#define Buzzer` | `ottoesp.js` | **Sí** (compila y suena) |
| 2 | Selector de placa: solo Nano y Nano Old | `index.html` | **Sí** (solo aparecen) |
| 3 | Placa predeterminada: Nano (`nanooptiboot`) | `blocklino.js` | Sin confirmar |
| 4 | Sensores: solo ultrasonido; resto en `CAT_SENSORES_EXTRA` (oculto por `mostrarSensoresExtra=false`) | toolbox XML, `Arduino_es.js`, `blocklino.js` | **Sí** (versión con botón); la versión sin botón sin confirmar |
| 5 | Categoría Texto oculta | toolbox XML (línea 3) | Sin confirmar |
| 6 | Otto: ocultos `App code` y `Guardar Trims en EEPROM` | toolbox XML | Sin confirmar |
| 7 | Bloques de sonido de Otto movidos a Zumbador | toolbox XML | Sin confirmar |
| 8 | Listas desplegables largas (alto, posición, clics, scroll) | `mpr_fixes.js`, `index.html`, `blocklino.css` | Sin confirmar (3 iteraciones) |
| 9 | Matemática: casting oculto (Byte, unsigned Int, Int, Float) | toolbox XML | Sin confirmar |
| 10 | Bloque de configuración Otto: título "Configuracion Otto" | `Arduino_es.js` (`OTTO_BIPED_TEXT`) | Sin confirmar |
| — | Traducción del bloque `map` | — | **Revertida** a pedido del usuario |
| 11 | Otto: oculto el bloque "Dance smooth criminal" (`otto9_smooth`) | toolbox XML | Sin confirmar (visto en entorno de prueba) |
| 12 | Estructura: bloque "Declaración" con ícono #️⃣ en vez del engranaje | `Arduino_es.js` (`Blockly.Msg.def`) | Sin confirmar (visto en entorno de prueba) |
| 13 | Lupa: búsqueda de bloques (el monitor serie quedó oculto) | `mpr_buscar.js` (nuevo), `index.html`, `blocklino.css`, `msg_es.js`, `code.js` | Sin confirmar (probado en entorno de prueba) |
| 14 | Librería Otto: limitador 240 grados/s, arranque escalonado, reconexión sin salto, oscilador a 20 ms exactos | `Otto.h/.cpp`, `Oscillator.h/.cpp` | **Pendiente en el robot** (verificado en simulación y compilación) |
| 15 | Menú de velocidades: nueva opción "Muy rápido" (1000 ms) | `Arduino_es.js` (`OTTO9_MOVE_SPEED_CHOICE`) | **Pendiente en el robot** |
| 16 | Verificar/Subir: `arduino-cli.exe` con ruta completa (falla si Windows tiene `NoDefaultCurrentDirectoryInExePath`) | `index.js` | Error reproducido y corregido fuera de la app; en la app pendiente |
| 17 | Zumbador: 6 canciones de 31 Minutos en "Tocar RTTTL" | `mpr_canciones.js` (nuevo), `RTTTL.js`, `index.html` | **Pendiente en el robot** (validadas y compiladas) |

Historial git de esos cambios: `git log --oneline 32ad6ed..HEAD`.

---

## 9. Cómo reactivar cosas ocultas

| Qué | Cómo |
|---|---|
| Sensores extra (botón, DHT, joystick, encoder…) | `www/js/blocklino.js` línea 6: `BlocklyDuino.mostrarSensoresExtra = true;` |
| Categoría Texto | En `defaultCategories1` (línea 3 del toolbox XML) agregar `CAT_TEXT,` entre `CAT_MATH,` y `CAT_FUNCTIONS` |
| `App code` / `Guardar Trims en EEPROM` / `Dance smooth criminal` | Quitar `<!-- OCULTO: ` y ` -->` en esas líneas de `CAT_OTTO` |
| Casting en Matemática | Igual: quitar el comentario `OCULTO` de las 4 líneas `conversion_*` al final de `CAT_MATH` |
| Otras placas (Uno, Mega, Leonardo, Micro, MRTduino, ZUM BT‑328) | Volver a agregar sus `<option>` en las **dos** listas de `index.html` (sus perfiles siguen en `boards.js`); para compilar, el core AVR ya está incluido |
| Sonidos de Otto en la categoría Otto | Mover las 4 líneas `<block>` de `CAT_BUZZER` a `CAT_OTTO` |
| Monitor serie (lo abría la lupa) | En `www/index.html` quitar el comentario `OCULTO` de `btn_term` (y comentar `btn_buscar` si no se quiere la búsqueda) |
| Limitador de servos como antes (más lento y suave) | `OTTO_DIFF_LIMIT_DEFAULT` en `Otto.h`: 3 (ahora 240); valores intermedios 150–180; **probar en el robot** |

Después de cualquiera: `python tools/probar.py` y F5.


---

## 10. Pendientes, riesgos y puntos a vigilar

1. **Instalador 1.2.0 sin validar:** falta probarlo en otros PCs, idealmente sin internet (instalar, abrir, compilar y subir a un Nano). Los bundles de git no incluyen los cambios de octubre.
2. **Verificaciones pendientes** de los cambios marcados "sin confirmar" en la sección 8, en especial las listas desplegables (`mpr_fixes.js`).
3. **`overflow: hidden` en `html, body`:** se agregó para que la ventana no se desplace; comprobar que ninguna pantalla (modales, ayudas, `factory.html`, `term.html`) necesite desplazarse.
4. **Estados guardados en `localStorage`** (`card`, `toolbox`, `prog`, `toolboxids`, `content`): los cambios en listas de placas o categorías pueden requerir borrarlos en PCs que ya usaron la app. La placa predeterminada solo se nota en instalaciones sin placa guardada.
5. **Buzzer sin sonido:** si no suena con el código correcto, revisar pin real, buzzer activo/pasivo, polaridad, y probar `Otto._tone(261,125,1);`.
6. **Textos en español incompletos o mezclados:** el bloque `map` ("map / from / to") y algunos ejemplos "Explora otros ejemplos" siguen en inglés. Hay un intento de traducción del bloque `map` en el historial (`git show 36243d3 3fbdfd4`) revertido a petición del usuario.
7. **Dependencia de binarios externos:** el instalador solo puede generarse con el instalador oficial 1.5.0 (SHA‑256 fijo). Si desaparece de GitHub, conservar una copia.
8. **Respaldo del repositorio:** actualmente solo existe localmente; se recomendó subirlo a `Admin-Proteinlab/blockly_mpr`.
9. **Fin de línea mixto:** editar con cuidado (ver 6.3).
10. **Límite de plataforma:** Windows 64 bits; Electron 4.1.1 es muy antiguo (sin soporte de seguridad); por eso se restringen navegación externa y permisos.

---

## 11. Glosario

| Término | Significado |
|---|---|
| Otto DIY | Robot bípedo de código abierto (4 servos, buzzer) |
| Blockly | Biblioteca de programación por bloques de Google |
| Generador | Función `Blockly.Arduino['bloque']` que produce el código C++ de un bloque |
| `.bloc` | Archivo de proyecto de la app (XML de Blockly) |
| Toolbox | Menú lateral de categorías y bloques |
| `nanooptiboot` / `nano` | Perfiles "Nano" (bootloader nuevo) y "Nano Old" (`atmega328old`) |
| NSIS | Herramienta que genera el instalador `.exe` |
| arduino-cli | Compilador/cargador de Arduino por línea de comandos |
| CH340 | Chip USB‑serie de las placas Nano compatibles; requiere driver |
| Trims | Ajustes de calibración de los servos de Otto (EEPROM) |
| RTTTL | Formato de melodías (ring tone) que reproduce el buzzer |

---

## 12. Referencias rápidas

- Repositorio base: https://github.com/OttoDIY/blockly
- Instalador oficial 1.5.0: https://github.com/OttoDIY/blockly/releases/tag/v1.5.0
- Librería Otto original: https://github.com/OttoDIY/OttoDIYLib
- Más contexto: `LEEME_MPR.md`, `CLAUDE.md`, `BITACORA.md`, `ANALISIS_SERVOS.md`, `git log`
- **Para retomar el trabajo (por ejemplo en otro PC): sección 13 (Traspaso).**

---

## 13. Traspaso: estado al 2026-11-08 y cómo continuar (por ejemplo, desde el notebook)

Esta sección resume la sesión del 8 de noviembre de 2026 para retomar el trabajo sin el contexto de la conversación. Detalle cambio a cambio en `BITACORA.md` (entradas "2026-11-08") y mecanismos en 4.6 y 4.7.

### 13.1 Estado actual
- **Rama `main`.** `package.json`: 1.4.0. Después del instalador 1.4.0 (`afd7b0e`) vinieron la documentación de traspaso y, el mismo día en el notebook, la revisión de rendimiento (13.7): recorrido fluido, espera del recorrido a Otto 3D y Otto sin recorte por vista. Ver `git log`.
- **Instalador generado:** `dist\MPR_Blockly_Setup_1.4.0.exe` (139 MB, SHA‑256 `5c53b29aeb7312f86576974edcaea3f9e25167232a0d7e04f3f8de3b8b44081a`). `dist/` está en `.gitignore`: el `.exe` no está en git, solo en la carpeta (OneDrive).
- **Instalado en el PC principal** (`C:\MPRBlockly`) con `python tools/probar.py`, no con el instalador. **En el notebook NB0003** (Ryzen 5 4600H con gráfica Radeon integrada, sin GPU dedicada, como los PCs donde se usará el programa) está el instalador 1.4.0 más los cambios de rendimiento, copiados con `probar.py` el 2026-11-08. Eso incluye el `electronApp.js` de git (mínimo 1100×650).
- **Instalador 1.4.1 generado** (`dist\MPR_Blockly_Setup_1.4.1.exe`, sin firma; 7.4): lleva las correcciones de rendimiento y el instalador de un clic y desatendido (7.2). Los PCs con la 1.4.0 tienen todavía el recorrido lento. Probado el 2026-11-08 en el notebook (7.4), donde quedó instalada la 1.4.1.
- **Novedades de la 1.4.0** (probadas en un Chrome moderno; el 2026-11-08 también en la app instalada del notebook, ver 13.4):
  1. Arreglos visuales: contorno verde del botón de cargar (`.btn-arduino` en `blocklino.css`) y placeholder cortado del buscador (ancho 330 px).
  2. Recorrido inicial "Conoce a Otto" (`mpr_tour.js`, botón "?").
  3. Mascota Otto 3D (`mpr_mascota.js`, `mpr_otto3d.js`, `mpr_consejos.js`): consejos, errores comunes, colores por pieza, paseos y vueltas, menú. Detalle en 4.7.
  4. Ventana principal siempre maximizada (`electronApp.js`, 4.6).
  5. Opción `ignore-gpu-blacklist` en `electronApp.js` para aprovechar gráficas integradas.

### 13.2 Lo que NO está en git (en la carpeta del proyecto, sin commit)
Ya están en git (commit `d8558f9`): `Otto DIY 2026.3mf.zip` (1,3 MB; **fuente de los modelos 3D**, hay que descomprimirlo para regenerar `www/media/otto3d*.js` con `tools/convertir_otto.js`) y `Fotos otto armado/` (7 fotos del robot armado, usadas para orientar y armar las piezas).

| Elemento | Qué es | Nota |
|---|---|---|
| `Logo Crecer en Renca.svg` | Logo, sin usar aún | |
| `versiones/` (354 MB) | Instaladores y bundles antiguos | No commitear |
| `electronApp.js` | Ya no hay cambio sin commit: el archivo del disco es igual al de git (mínimo **1100×650**). El instalador 1.4.0 trae **1060×700** | En el notebook se reemplazó por el de git al usar `probar.py`. Con la ventana siempre maximizada no influye |
| Faltan en el disco | Dos PNG del ejemplo de la librería Firebase (ESP32); su ruta en OneDrive mide 282 caracteres. No están en el disco ni en OneDrive | Inofensivo: es una librería que MPR no usa. Se pueden borrar de git o recuperar con `git checkout` |

**Revisión de OneDrive (2026-11-08, desde el notebook):** los 5.136 archivos y las 1.481 carpetas del proyecto, incluido `.git`, están sincronizados y marcados "Siempre disponible en este dispositivo". Se comprobó con el estado del Explorador y con la base de datos de OneDrive, y `git fsck` no da errores. La carpeta raíz igual aparece "Sincronización pendiente" porque OneDrive excluye siempre `www/media/Thumbs.db`, una caché de miniaturas de Windows que viene de Otto Blockly y está en git. Por eso en el otro PC ese archivo figura como borrado. Para que la carpeta quede en verde hay que sacar `Thumbs.db` de git y agregarlo a `.gitignore`.

### 13.3 Probar en el notebook (checklist)
1. Instalar `MPR_Blockly_Setup_1.4.0.exe` (encima de la versión anterior o desinstalando antes).
2. **Ventana:** debe abrir maximizada y no poder restaurarse. Sin botón de maximizar; minimizar y cerrar funcionan.
3. **Recorrido** (primera vez): 7 pasos; el paso del puerto USB solo aparece en la app instalada. Se repite con "?". Debe ir fluido: 55–60 cuadros/s con `node tools/medir_app.mjs recorrido` (6.5).
4. **Mascota 3D:** abrir F12 (consola) y buscar `[Otto 3D]`. Muestra el modelo elegido (`completo`, `liviano` o `minimo`), triángulos, llamadas, cuadros/s y memoria. Si baja de nivel por lentitud aparece `[Otto 3D] equipo lento: modelo ...`.
   - Sin aceleración gráfica debería partir en `minimo` (modo económico). Con gráfica integrada, en `completo`.
   - Si Otto sale en 2D (imagen plana con globos), WebGL no se pudo crear: anotar el error de la consola. Confirmado el 2026-11-08 en el notebook: el 3D funciona con la gráfica integrada y también con `--disable-gpu`.
5. **Menú de la mascota** (clic en Otto): consejo, colores, avisos tranquilos, quedarme en mi lugar / pasear, esconderme. Arrastrarla; recargar (F5) y ver que recuerda posición y colores.
6. **Consejos con mensajes reales:** provocar errores reales (sin puerto, puerto ocupado, placa equivocada, código con error) y ver qué mensaje de Otto sale. Las expresiones de `MPRConsejos.ERRORES` se escribieron suponiendo los mensajes típicos de `arduino-cli`/`avrdude`; ajustarlas con los textos reales (están en `www/js/mpr_consejos.js`, en minúsculas).
7. **Bloques sueltos:** dejar 1–2 bloques sin conectar en la mesa y esperar ~4 s.
8. **Paseo:** cada 30–80 s (si no hay globo ni cuadro de mensaje) camina de perfil a otro punto de la mesa y vuelve de frente; a veces da una vuelta. Comprobar fluidez en el notebook.

### 13.4 Temas pendientes o por revisar
- **Verificado el 2026-11-08:** `three.min.js` r128 y WebGL funcionan en Electron 4 en el notebook, tanto con la gráfica integrada (ANGLE/Direct3D 11, modelo completo, 12 cuadros/s en reposo) como simulando un PC sin GPU con `--disable-gpu` (SwiftShader, modelo mínimo, modo económico). Falta probarlo en un PC del colegio con gráfica Intel (`tools/medir_app.mjs`, 6.5).
- **Revisión del usuario en el notebook:** el 3D funcionaba bien; el recorrido iba muy lento (corregido, ver 13.7). Regla del usuario: los PCs no tienen GPU dedicada sino la gráfica integrada del procesador, y las optimizaciones **no pueden bajar gráficos, calidad de animaciones ni quitar funciones** del programa ni de Otto 3D.
- **Instalador 1.4.1:** generado y probado en el notebook. Falta probarlo en un PC del colegio (gráfica Intel, quizás con el Control inteligente de aplicaciones activo).
- **Mejoras de aprendizaje (13.8):** la Etapa 1 está hecha e instalada en el notebook con `probar.py` (aún no hay instalador con ella). La Etapa 2 también está hecha (13.9).
- **Certificado de firma de código:** hoy Windows muestra "editor desconocido" y, si el archivo viene de Internet, "Windows protegió su PC". Con el Control inteligente de aplicaciones activo, bloquearía el programa. Opciones y costos en 7.5; el script ya firma todo con `--firma`.
- **Consumo en reposo de Otto:** ~9 % de un núcleo en el notebook; la app con Otto en pausa usa ~0,15 %. Bajarlo cambiaría lo que se ve o cómo se comporta (menos cuadros, pausar a Otto sin foco o tras minutos sin actividad), así que queda a decisión del usuario (13.7).
- **Error heredado al cargar** (ya estaba en la 1.4.0 y en la base de Otto Blockly): `index.html` pide `blocs&generateurs/microbit.js` y `code.js` pide `lang/microbit_es.js`, que no existen. Además, `typing.js:95` lanza `TypeError` porque `Blockly.Blocks.digital_read` no existe, así que las líneas 95–161 de `typing.js` (tipos de dato de algunos bloques) nunca se ejecutan. Si se corrige, hacerlo con cuidado: afecta los tipos de las variables en el código generado.
- **Textos de error reales** para `MPRConsejos.ERRORES` (ver 13.3, punto 6) y más errores comunes (el usuario aún no tiene una lista definida: "puerto COM" y "bloques sueltos" fueron los ejemplos).
- **Cara del cuerpo:** se desconoce cuál cara es el frente real del cuerpo; como es casi simétrico no se nota, pero el texto en relieve ("lafábrica", "Renca") podría quedar en una cara distinta a la real.
- **Animaciones aproximadas:** caderas giran las piernas sobre el eje vertical y los tobillos inclinan los pies (como los servos reales), pero las amplitudes y fases son una estimación visual. Ajustar en `MPROtto3D.pose`.
- **Frecuencia de paseos** (30–80 s) y velocidad (~55 px/s): constantes en `MPRMascota.planificar/pasear`.
- **Ideas conversadas, no hechas:** más detectores (sensor sin conexión, programa vacío al presionar la flecha, etc.); que el recorrido presente a la mascota; documentar una lista de consejos más completa; ofrecer elegir calidad del 3D en el menú.
- **Pendientes anteriores** siguen en la sección 10 (instalador sin validar en otros PC, `overflow: hidden`, textos mezclados en inglés, etc.).

### 13.5 Preparar el notebook (o cualquier PC) para seguir trabajando
- Trabajar con la carpeta del proyecto (OneDrive) y `claude` desde ella; Claude lee `CLAUDE.md` y esta documentación.
- **Python:** en Windows el comando `python` puede apuntar a la tienda de Microsoft; usar **`py`** (`py tools/probar.py`, `py tools/build_installer.py ...`). `probar.py` abre una ventana de permisos de administrador.
- **Para generar instaladores:** `winget install 7zip.7zip NSIS.NSIS` (en el PC principal ya están instalados desde el 2026-11-08) y el instalador oficial 1.5.0 (259 MB, SHA‑256 en el script; se descargó a una carpeta temporal: `https://github.com/OttoDIY/blockly/releases/download/v1.5.0/ottoblockly.Setup.1.5.0.exe`). Comando: `py tools/build_installer.py --official <ruta>\ottoblockly.Setup.1.5.0.exe`. Salida en `dist\`.
- **Para regenerar los modelos 3D:** descomprimir `Otto DIY 2026.3mf.zip` en una carpeta, `npm i meshoptimizer@0.20.0` (en una carpeta aparte) y `NODE_PATH=<esa carpeta>\node_modules node tools/convertir_otto.js <carpeta_3mf> www/media`. Genera `otto3d.js`, `otto3d_liviano.js` y `otto3d_minimo.js`.
- **Para ver la interfaz sin instalar:** `node tools/servidor_local.js` y abrir `http://127.0.0.1:8765/index.html` en Chrome (sin Electron: no hay USB ni compilación). Útil para la mascota y el recorrido. Una herramienta de IA puede necesitar que el usuario apruebe expresamente el servidor local.
- Claves de `localStorage` útiles para pruebas (en la consola F12): `mpr_tour_visto` (borrar para ver el recorrido de nuevo), `mpr_masc_presentada` (presentación de Otto), `mpr_masc_colores`, `mpr_masc_pos`, `mpr_masc_oculta`, `mpr_masc_silencio`, `mpr_masc_pasea` (`no` = quieto) y `mpr_masc_calidad` (`completa`, `liviana` o `minima` fuerza el modelo 3D).

### 13.6 Trampas y aprendizajes de esta sesión
- **`MeshLambertMaterial` de three r128 ignora `flatShading`**: las caras grandes se veían suavizadas. Solución: geometría no indexada con normales por triángulo (`MPROtto3D.geometria`).
- **Ejes del modelo 3MF:** en todas las piezas la altura está en `z` y el frente de la cabeza en `-y`; se giran -90° en X. Los agujeros del sensor están a x = ±13,37 y 6,0 mm sobre el centro de la cabeza (16,75 mm). Si se cambia la altura de la cabeza hay que recalcular la de los sensores (ya pasó una vez).
- **Fin de línea:** `index.html` es CRLF y `blocklino.css` mezcla CRLF/LF. La herramienta Edit reescribe fines de línea; se usó `node` leyendo/escribiendo en `latin1` con `replace` exacto. `msg_es.js` y los `.js` nuevos son LF.
- **Una sola instancia:** `electronApp.js` usa `requestSingleInstanceLock`; no se puede abrir una segunda copia (ni con `--user-data-dir`) para probar mientras la app está abierta. Cerrar la app y reabrirla.
- **Commitear un archivo con cambios ajenos pendientes** (como `electronApp.js`): se parte de `git show HEAD:...`, se aplica el cambio, `git hash-object -w` y `git update-index --cacheinfo`, para no incluir el resto.
- **Codificación:** `BITACORA.md`, `DOCUMENTACION_TECNICA.md`, `CLAUDE.md`, `msg_es.js` y los `.js` son **UTF-8**. Al editarlos con `node` leer y escribir en `utf8`; usar `latin1` solo en archivos donde lo que se reemplaza es ASCII puro (por ejemplo `index.html`, `blocklino.css`), porque `latin1` destruye acentos y rayas (—, →). Ese error ocurrió con `BITACORA.md` el 2026-11-08 y se reparó.
- **Mensajes de la app:** la mascota lee el cuadro `#messageDIV` con un `MutationObserver` (color rojo = error, verde = éxito); no modifica `index.js`.
- **Medir en la app real, no en Chrome:** el recorrido lento no se notaba en el Chrome moderno. En Chromium 69 (6.5): `Tracing.start` en una página no acepta `traceConfig` (hay que usar `categories`); el objetivo "navegador" de `/json/version` sí lo acepta e incluye el proceso GPU; las duraciones de la traza vienen redondeadas a 1 ms, así que las tareas cortas suman de menos. El consumo en reposo varía mucho entre muestras de 20 s por los paseos de Otto: para comparar, apagar `MPRMascota.paseando` en memoria y repetir.
- **Sombras gigantes:** un `box-shadow` con spread enorme dentro de una capa compuesta agranda la capa entera (25.287 × 25.907 px en el recorrido). Recortar el contenedor con `overflow: hidden` o evitar el truco.
- **Descartado por medición:** (1) un bucle de Otto con temporizador en vez de `requestAnimationFrame` continuo: el hilo principal baja 0,8 % pero el compositor sube 1,5 % (en Chromium 69 encender y apagar los cuadros cuesta más), y sin GPU bajaba los cuadros de Otto de 8 a 6–7; (2) decodificar el modelo en un solo recorrido: da lo mismo pero no es más rápido (three.js ya está optimizado); (3) compartir el sombreador del sensor: ya se comparte; (4) mover el globo del recorrido con `transform`: sin ganancia medible.
- **Comentarios en el menú (toolbox):** un `<!-- ... -->` dentro de un `<block>` del XML hace fallar la categoría entera al abrirla (`g.getAttribute is not a function` en `domToBlockHeadless_`). Los comentarios van entre bloques.
- **Copia de prueba de la app (sin UAC) en ruta corta:** se copia el runtime instalado a `C:\mprbp` (sin `compilation` ni `www`) y se crean dos enlaces de carpeta (`mklink /J`): `www` → la carpeta `www` del repositorio y `compilation` → `C:\MPRBlockly\compilation`; `resources\app\index.js` se copia del repo. En una ruta larga (por ejemplo, la carpeta temporal) arduino-cli falla con "Acceso denegado" al recorrer la librería Firebase (más de 260 caracteres). Comparte `localStorage` y la instancia única con la instalada: respaldar y restaurar el estado (mesa y claves) y no abrir las dos a la vez.
- **Nano y Nano Old comparten lo compilado:** lo compilado con `arduino:avr:nano:cpu=atmega328old` se sube bien con `arduino:avr:nano` (y al revés): mismo chip, solo cambia la velocidad del cargador. Cambiar de una a otra sí invalida la caché de compilación (la siguiente tarda ~12 s).

### 13.7 Rendimiento: revisión del 2026-11-08 en el notebook NB0003
Equipo: Ryzen 5 4600H con gráfica Radeon integrada (ANGLE/Direct3D 11), 16 GB, pantalla 1920×1080 al 125 %. Todo se midió en la app instalada con DevTools (6.5), comparando la 1.4.0 con los cambios.

| Medición | 1.4.0 | Con los cambios |
|---|---|---|
| Recorrido: cuadros/s en las transiciones | 15–30, con tirones de 100–400 ms | 60 (peor cuadro 16,7 ms) |
| Capa del velo del recorrido | 25.287 × 25.907 px | 1.923 × 1.020 px (la ventana) |
| Avisos "tile violates memory policy" / "Swap throttled" en el recorrido | 226 / 325 | 0 / 6 |
| Tareas de rasterizado en el recorrido | 1.391 | 538 |
| Recorrido sin GPU (`--disable-gpu`) | 43–58 cuadros/s | 60 |
| Primer cuadro de Otto 3D al arrancar | 114 ms | ~65 ms |
| Bloqueo total al cargar Otto 3D | ~237 ms | ~190 ms |

- **Causa del recorrido lento:** el velo era una capa gigante (por la sombra de 9999 px) que se invalidaba entera en cada cuadro. La GPU integrada se quedaba sin memoria para las teselas y la pantalla esperaba a la GPU. Detalle en `BITACORA.md`.
- **Consumo en reposo (sin cambios; medido para decidir):** con Otto visible la app usa ~9 % de un núcleo con la gráfica integrada, y entre 9 % y 19 % sin GPU (mucha variación entre muestras). Con Otto en pausa usa ~0,15 %: casi todo es la animación de reposo de Otto (12 cuadros/s; 8 en modo económico). Memoria: ~60–70 MB privados por proceso (3 procesos) y ~12 MB de JavaScript.
- **Arranque:** la carga de Otto 3D (decodificar el modelo, compilar sombreadores y subir ~9 MB a la GPU) empieza en `load` + 1,2 s y termina en ~`load` + 1,5 s. El recorrido de la primera vez espera a que termine.
- **Funciones verificadas en la app instalada después de los cambios:** las 5 animaciones, paseo por la mesa, menú, colores, globo de consejos, esconder y volver a mostrar, botón "?" y teclas del recorrido, descenso completo → liviano y recorrido de la primera vez con sus botones. Sin excepciones nuevas y con las preferencias guardadas intactas.

### 13.8 Mejoras de aprendizaje de la versión del evento (2026-11-08)
- **Contexto (del usuario):** esta app es la **versión del evento** Mi Primer Robot, simplificada a propósito para no confundir a los niños; después vendrá una versión completa de Otto, con todo su contenido y más complejidad. Público: 6° básico (11–12 años), un robot por niño, unos 11 PCs por mesa, kit siempre con sensor ultrasónico. La guía del evento son dos panfletos (armado y programación); el de programación 2025 está en `Manuales/` (la versión del evento puede cambiar algo, pero mantiene la estructura).
- **Decisiones del usuario:** Etapa 1 aprobada, con una condición: si el niño borra la configuración, no vuelve sola salvo en un proyecto nuevo. Etapa 2 aprobada: probar el programa en pantalla con Otto 3D, misiones guiadas según el manual y calibración para monitores. **Sin lectura en voz alta** (hay mucho ruido en el evento). **No simplificar el menú** por ahora. Se mantienen las palabras que muestra el manual.
- **Etapa 1 (hecha):** mesa lista (4.8), subida con puerto y placa automáticos, pasos claros, errores explicados y precompilación (4.9), textos, bloque Hz y ejemplos en español (5.3, 5.7), bloque "Detener a Otto" (5.3). Probada con el Otto del usuario (COM7, cargador nuevo) en la copia de prueba `C:\mprbp` (13.6) y luego en la app instalada del notebook.

| Medición (notebook, Otto real) | Antes | Ahora |
|---|---|---|
| Primera subida al abrir la app | ~26 s (21 s compilando) | 11 s (se precompila al abrir) |
| Subida con "Nano Old" elegida en un Otto "Nano" | ~103 s y error | 17 s; cambia la placa sola y avisa |
| Puerto ocupado por otro programa | error técnico en inglés | 7 s: "No pude enviar el programa a Otto" + explicación |
| Robot enchufado después de abrir la app | había que elegir el puerto | se elige solo y Otto avisa |
| Mesa al empezar un proyecto | vacía | Configuración + Bucle con Configuración Otto |

- **Para el próximo panfleto de programación:** el paso 1 dice "selecciona el puerto COM" (ahora se elige solo; se sigue viendo COM y un número); los pasos 3 y 4 piden arrastrar Configuración + Bucle y Configuración Otto (ya vienen en la mesa; si los arrastran, Otto explica); las capturas son de Otto Blockly antiguo (niveles, inglés).
- **Pendiente:** Etapa 2; generar un instalador con la Etapa 1 (hoy está solo en el notebook, con `probar.py`); probar en un PC del colegio.

### 13.9 Etapa 2 de mejoras de aprendizaje (hecha el 2026-11-09)
- **Qué incluye:** Probar en pantalla (4.10), Misiones (4.11) y Calibración para monitores (4.12). El recorrido suma los pasos "Pruébalo en pantalla" y "Misiones" (9 pasos). Decisiones del usuario: escenario grande y calibración autorizada en su Otto, dejando sus ajustes como estaban.
- **Probado en la copia de prueba `C:\mprbp` con el Otto del usuario:**
  - **Escenario:** caminar hasta chocar con la caja, el ejemplo Esquivar obstáculos, gestos con Detener, el borde de la mesa y el cierre (Otto vuelve a su esquina).
  - **Misiones y recorrido:** las 10 misiones fallan con la mesa inicial y aprueban con su solución; el recorrido tiene sus 9 pasos con foco y texto.
  - **Calibración:** se leyeron los ajustes del robot, se guardó uno de prueba y se restauraron los originales, verificados.
  - **Cuadros/s:** 30 con la gráfica integrada y 20 sin GPU.
- **Instalada en el notebook** con `probar.py` el 2026-11-09 (los 11 archivos verificados). En la app instalada se probaron el escenario (gestos con Detener; al cerrar, Otto vuelve a su esquina), las misiones y los menús.
- **Pendiente:** el instalador con las etapas 1 y 2 se generará cuando termine el desarrollo (pedido del usuario: "todavía estamos desarrollando"). Falta probar en un PC del colegio. Para el próximo panfleto, ver 13.8.

### 13.10 Otto ataja los errores de programación (2026-11-09)
- Hecho y probado en la copia de prueba `C:\mprbp` con el Otto del usuario (COM7). Ver 4.13.
  - Se probaron 11 casos de revisión con sus botones, los ejemplos, los códigos de 11 errores reales, Verificar y luego la flecha (no recompila), la subida real y el puerto ocupado (P3).
  - Al final quedó en Otto un programa quieto: Configuración Otto y posición inicial.
- **Pendiente:** ver en el colegio si los niños entienden los cuadros y si los monitores usan los códigos. Se podría imprimir la tabla de códigos para cada mesa.
