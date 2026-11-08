# MPR Blockly — Documentación técnica

| | |
|---|---|
| **Producto** | MPR Blockly (programa *Mi Primer Robot*, Crecer en Renca) |
| **Versión de la app** | 1.3.0 (`package.json`) |
| **Tipo** | Aplicación de escritorio Windows (Electron) para programar robots Otto DIY por bloques |
| **Base** | [OttoDIY/blockly](https://github.com/OttoDIY/blockly), master `fdb2026` del 2026‑08‑14 |
| **Repositorio previsto** | `https://github.com/Admin-Proteinlab/blockly_mpr` (aún no publicado desde esta máquina) |
| **Licencia** | GPL‑2.0 (ver `LICENSE.md`); arduino-cli es GPL‑3.0 |
| **Documentos hermanos** | `CLAUDE.md` (reglas para Claude Code), `LEEME_MPR.md` (resumen), `BITACORA.md` (registro de cada cambio), `ANALISIS_SERVOS.md` (movimiento de los servos) |

Este documento explica **qué es el proyecto, de dónde viene, cómo está armado, cómo se modifica, se prueba y se entrega**, y qué quedó pendiente. Está pensado para que alguien nuevo pueda retomar el trabajo sin la conversación original. Lo que no se ha comprobado en la app real está marcado como **sin confirmar**.

> Convención: las rutas son relativas a la raíz del repositorio (`C:\ClaudeCode\mpr-blockly`) salvo que se indique otra cosa.

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

---

## 5. Cambios de MPR sobre Otto Blockly (inventario)

Para el detalle y los commits de cada cambio de octubre, ver `BITACORA.md`. Resumen funcional:

### 5.1 Interfaz y marca
Logos Crecer en Renca / Innova / La Fábrica / Renca en el pie de página, colores, título "MPR Blockly", ícono MPR (`build/mpr.ico`, `www/media/mpr_app.ico`), interfaz simplificada, selector de idioma oculto (`code.js` fija `es`).

### 5.2 Menú de bloques actual (visible)
Arduino (estructura), **Otto**, matriz 16x8 y OLED (según lo que realmente muestre el XML), **Zumbador**, **Sensores** (solo ultrasonido), Tiempo, Lógica, **Matemática** (sin casting), Funciones, Variables.
Ocultos (sin borrar): categoría **Texto**; bloques Otto `App code` (`otto9_app`), `Guardar Trims en EEPROM` (`otto_eeprom`) y `Dance smooth criminal` (`otto9_smooth`); casting en Matemática; "Sensores extra".

### 5.3 Bloques de Otto
- `otto_configuration` (en `www/blocs&generateurs/ottoesp.js`): título **"Configuracion Otto"**, pines por defecto: pierna izq. 2, der. 3, pie izq. 4, der. 5, buzzer 13. Genera `#define LeftLeg/RightLeg/LeftFoot/RightFoot/Buzzer`, `Otto.init(...)` y `Otto.home()`.
  Además genera `const int buzzer = <pin>;` (minúscula) con la clave `definitions_['setup_buzzer']`, la misma que usa el bloque `buzzer_init`, para que los bloques de sonido de `audio.js` (que escriben `buzzer`) compilen. C++ distingue mayúsculas. **Verificado por el usuario: compila y suena.**
- Bloques de sonido de Otto (`otto_sound` = `Otto.sing`, `otto_tone` y `otto_tonehz` = `Otto._tone`, `otto_bendtone` = `Otto.bendTones`) se muestran ahora en **Zumbador**, no en Otto.

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
`www/examples/examples.json` define qué ejemplos se ven. Sección "Ejemplos Mi Primer Robot": Caminar (`Ottowalk.xml`), Canto (`mpr_sing.xml`), Movimiento improvisado (`mpr_randommove.xml`), Meneito (`mpr_meneito.xml`), Equilibrio (`mpr_balance.xml`), Subir el Cerro Renca (`mpr_cerro.xml`); luego "Explora otros ejemplos" (varios en inglés heredados). `mpr_salto.xml` existe en `www/examples/` pero **no está en `examples.json`**, así que no se muestra.

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

---

## 7. Instalador y distribución

### 7.1 Generar el instalador
1. Descargar `ottoblockly.Setup.1.5.0.exe` de https://github.com/OttoDIY/blockly/releases/tag/v1.5.0 y dejarlo en la raíz del repo (el script verifica su SHA‑256).
2. Una vez: `winget install 7zip.7zip NSIS.NSIS` (Node.js y Python ya instalados).
3. Subir la versión en `package.json`.
4. `python tools/build_installer.py --official ottoblockly.Setup.1.5.0.exe`
5. Resultado: `dist\MPR_Blockly_Setup_<versión>.exe`.

`tools/build_installer.py` extrae el instalador oficial, conserva el runtime de Electron y los paquetes AVR mínimos (`arduino:avr` 1.8.3, avr-gcc, avrdude, arduinoOTA), pone encima el código del repo, cambia ícono y datos de versión del `.exe` (resedit‑cli), y compila `build/installer.nsi` con `makensis -INPUTCHARSET UTF8 -DSTAGE -DVERSION -DOUTFILE` (el `.nsi` es UTF-8 sin BOM). La carpeta de trabajo es `C:\mprb` (corta a propósito por el límite de 260 caracteres de Windows). No usa 7za (no abre instaladores NSIS).

### 7.2 Qué hace el instalador (`build/installer.nsi`)
- Instala en `C:\MPRBlockly` (no choca con Otto Blockly oficial).
- Accesos directos; asociación de `.bloc` (`MPRBlockly.bloc`); desinstalador (`Desinstalar.exe`, borra solo lo instalado según lista generada); entrada en Agregar o quitar programas.
- **Permisos (`icacls`)**: SYSTEM y Administradores control total; Usuarios solo lectura y ejecución, **salvo** `compilation\arduino` y `config.json`, que Usuarios puede modificar. Así los alumnos sin administrador pueden compilar y subir, y una DLL plantada no se ejecuta como administrador.
- Al terminar abre la app **sin privilegios de administrador** (`RunAppNotElevated`).
- Instala siempre el driver CH340 (al final de la copia de archivos) con `pnputil /add-driver ...ch341ser.inf /install`; el código de salida 3010 se considera correcto. `pnputil` no reemplaza un driver más nuevo ya instalado por Windows Update.

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

La versión de `package.json` se pasa al `.nsi` (`-DVERSION`) al generar el instalador.

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


### 4.x Recorrido inicial y mascota Otto 3D (noviembre 2026)
- **Recorrido** (`www/js/mpr_tour.js`, objeto `MPRTour`): 7 pasos con globo y foco resaltado; se abre solo la primera vez (`localStorage.mpr_tour_visto`) y con el botón "?" (`#btn_tour`). Textos en `msg_es.js` (`tour_*`).
- **Mascota** (`mpr_mascota.js`, `mpr_otto3d.js`, `mpr_consejos.js`, `three.min.js` r128, `media/otto3d.js`): Otto 3D en una esquina, arrastrable (posición en `mpr_masc_pos`), con menú (consejo, colores, avisos tranquilos, esconderse). Colores por pieza (cabeza, cuerpo, piernas, pies) en `mpr_masc_colores`; naranja por defecto.
- **Modelo:** `tools/convertir_otto.js` convierte las piezas del 3MF (Bambu Studio) con `meshoptimizer` (`simplifySloppy`) a ~4.300 triángulos (78 KB) y escribe `www/media/otto3d.js`. La pose está en `mpr_otto3d.js` y se calculó con fotos del Otto armado: todas las piezas del 3MF tienen su altura en `z` y el frente de la cabeza (agujeros del sensor) en `-y`, por eso se giran -90° en X; medidas en mm: pies y 0–26, piernas y 8–50 (a x = ±23), cuerpo y 50–89, cabeza y 87–126. Cada pie lleva la placa hacia afuera (`pieIzq` bajo la pierna derecha y `pieDer` bajo la izquierda). Los "ojos" son dos sensores ultrasónicos (cilindro plateado con malla oscura) en x = ±13,4 del frente; no son personalizables. Se carga de forma perezosa; si está escondida no se carga el 3D. Reposo a 12 cuadros/s, animando a 30, pausa con la ventana oculta. Si no hay WebGL, usa `media/otto_emoji.png`.
- **Detectores:** bloques sueltos (bloques de la mesa con `previousConnection` u `outputConnection` sin conectar), y lectura del cuadro `#messageDIV` con un `MutationObserver` (rojo = error, verde = éxito) sin modificar `index.js`. Para agregar un error común basta una línea en `MPRConsejos.ERRORES` (`mpr_consejos.js`, texto en minúsculas).
- **Por verificar en Electron 4:** `three.min.js` r128 y WebGL en Chromium 69 (se probó solo en un Chrome moderno). Si falla, queda el respaldo 2D.

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
