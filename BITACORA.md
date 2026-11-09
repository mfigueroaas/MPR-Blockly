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

## Plantilla para nuevas entradas
```
### AAAA-MM-DD — Título corto
- **Pedido / problema:**
- **Archivos:**
- **Qué se hizo:**
- **Notas:**
- **Commit:**  **Probado en la app:** sí/no
```
