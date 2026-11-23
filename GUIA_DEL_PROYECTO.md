# MPR Blockly — Guía para trabajar con el proyecto

Esta guía explica **cómo está armado MPR Blockly, qué se le agregó a la base y cómo funciona cada pieza**, con el detalle técnico suficiente para poder modificarlo, pero escrita para leerse de corrido. Es la puerta de entrada; el detalle completo (decisiones, medidas, historial de versiones) está en `DOCUMENTACION_TECNICA.md`, y cada cambio, uno por uno, en `BITACORA.md`.

Estado de esta guía: versión **1.6.0** (noviembre 2026, tras la "limpieza v1").

---

## 1. Qué es y para qué sirve

MPR Blockly es una aplicación de escritorio (Windows) donde los niños del programa *Mi Primer Robot* **programan armando bloques**, en español y sin internet. La aplicación convierte los bloques en código C++ de Arduino, lo compila y lo sube a una placa **Arduino Nano** que maneja un robot **Otto** (bípedo con 4 servos, un buzzer y, opcionalmente, un sensor ultrasónico).

Parte de [OttoDIY/blockly](https://github.com/OttoDIY/blockly) y le agrega: marca y colores del programa, un menú de bloques reducido, ejemplos y misiones propios, una mascota Otto 3D, un simulador en pantalla, subida automática al robot, revisión del programa antes de enviarlo, calibración y un modo de depuración para los monitores (los adultos de cada mesa).

Dos ideas de diseño recorren todo el proyecto:

- **Que el niño nunca se quede atascado.** Los errores técnicos se traducen a frases simples con un código corto ("P3", "B4") que el niño puede decirle al monitor.
- **Que funcione en PCs modestos.** Los computadores del colegio tienen gráfica integrada y Electron muy antiguo, así que todo lo gráfico se mide en la app real.

---

## 2. Cómo está hecha por dentro

```
MPR Blockly.exe  (Electron 4.1.1, 32 bits = Chromium 69)
│
├─ Proceso principal ........ electronApp.js
│     ventana maximizada, menús, diálogos de guardar, F5/F8, abrir .bloc,
│     ventana del Monitor Serie, instancia única
│
├─ Página (www/index.html) .. interfaz web con acceso a Node
│     index.js ............ botones Verificar/Subir, lista de puertos COM
│     www/js/blocklino.js .. controlador de la interfaz (menú, proyectos)
│     blockly.min.js ...... Blockly (NO se modifica)
│     www/blocs&generateurs/*.js .. bloques y generadores de C++
│     www/js/mpr_*.js ..... todo lo agregado por MPR (sección 5)
│
└─ arduino-cli.exe + avr-gcc + avrdude (compilación/subida, sin internet)
        └─ librerías: compilation/arduino/userlibs/libraries
           (Otto, Servo, PlayRtttl-master, CuteBuzzerSounds)
```

### El camino de un programa

1. El niño arma bloques en el espacio de trabajo de Blockly.
2. Cada tipo de bloque tiene un **generador** `Blockly.Arduino['tipo']` que devuelve texto C++ y registra includes, definiciones globales y líneas de `setup()` en tablas con clave (`includes_`, `definitions_`, `setups_`). La clave evita duplicados: dos bloques que usan la misma clave producen una sola línea.
3. `index.js` escribe el resultado en `compilation/arduino/sketch/sketch.ino`.
4. **Verificar** ejecuta `arduino-cli compile`; **Subir** compila y luego ejecuta `arduino-cli upload` por el puerto COM del robot.
5. El proyecto se guarda como `.bloc` (XML de Blockly); también se exporta `.ino`.

### Por qué hay cosas "viejas" a propósito

- **Electron 4.1.1 y serialport 7.1.4 no se migran.** El código usa su API antigua (diálogos con callback, `remote`, `sp.list(callback)`, `port.comName`) y el instalador reutiliza esos binarios ya compilados del instalador oficial de Otto Blockly 1.5.0.
- **Solo placas AVR** (core `arduino:avr` 1.8.3, Nano y Nano Old). Agregar otra familia obliga a incluir su core en `tools/build_installer.py`.
- **Chromium 69:** en CSS no se puede usar `gap` en flex, `clamp()`, `min()`/`max()`, `:is()` ni `aspect-ratio`.

---

## 3. Mapa de carpetas

| Ruta | Qué hay |
|---|---|
| `electronApp.js`, `index.js`, `term.js` | Proceso principal, lógica de la página y del Monitor Serie |
| `package.json` | Nombre, **versión** (de aquí sale la del instalador) y dependencias |
| `www/index.html` | Estructura de la interfaz |
| `www/js/blocklino.js` | Controlador: menú de bloques, placa, carga/guardado, plantilla de proyecto nuevo |
| `www/js/mpr_*.js` | Módulos MPR (simulador, mascota, misiones, calibración, subida, revisión, monitor…) |
| `www/blocs&generateurs/` | Definición de bloques y sus generadores de C++ |
| `www/toolbox/toolbox_arduino_all.xml` | Qué categorías y bloques muestra el menú |
| `www/examples/` | Ejemplos `.xml` y `examples.json` (cuáles se ven) |
| `www/lang/` | Textos, solo español (`Arduino_es.js`, `msg_es.js`, `Blockly_es.js`) |
| `www/media/` | Logos, íconos y modelos 3D de Otto |
| `compilation/arduino/` | arduino-cli y las 4 librerías Arduino (la de Otto con cambios MPR) |
| `driversUSB/` | Solo `CH341.zip` (driver de las placas con chip CH340) |
| `build/` | `installer.nsi` (NSIS) e íconos del instalador |
| `tools/` | Scripts: instalador, pruebas rápidas, mediciones, conversión del modelo 3D |
| `BITACORA.md`, `DOCUMENTACION_TECNICA.md`, `PENDIENTES_LIMPIEZA_V1.md` | Historial, documentación completa y lo que falta |

---

## 4. Cómo trabajar (el día a día)

### Requisitos
Windows 64 bits, Python (`py`), Node.js 22 o más nuevo, y MPR Blockly instalado en `C:\MPRBlockly`. Para el instalador, además: `winget install 7zip.7zip NSIS.NSIS`.

### Probar un cambio sin instalar
```
py tools/probar.py            # copia al programa instalado lo que cambió
py tools/probar.py --simular  # solo muestra qué copiaría
```
Después **F5** en la app. Si se cambió `electronApp.js`, hay que cerrarla y abrirla de nuevo. El script pide permisos de administrador si hacen falta.

### Reglas al editar
- Textos solo en español, en `www/lang/` (`Arduino_es.js`, `msg_es.js`).
- Respetar el fin de línea de cada archivo (hay CRLF y LF mezclados); no reescribir un archivo entero por formato.
- `Otto.cpp` y `Otto.h` deben ser **idénticos byte a byte** a los del último paquete de librería (`LIB_OTTO_SENSORES.zip`). Lo que falte se resuelve fuera de la librería (generadores, calibración, simulador). No cambiar `OTTO_DIFF_LIMIT_DEFAULT` (hoy 3) sin que se pida.
- Un commit pequeño por cambio, mensaje en español, y registrarlo en `BITACORA.md` **en el mismo commit**. Si el cambio altera algo de `DOCUMENTACION_TECNICA.md`, actualizarlo también.

### Verificar antes de dar algo por terminado
1. **Siempre en la app real** (Electron 4), no en un Chrome moderno: lo que allá se ve bien aquí puede verse mal. La copia de prueba es `C:\mprbp`, que se abre con `--remote-debugging-port=9222`.
2. `node --check` sobre cada `.js` modificado.
3. Si cambió algo gráfico o animado: `node tools/medir_app.mjs` (cuadros por segundo, capas, consumo).
4. Si cambió la librería Otto o un generador: compilar un ejemplo con
   `compilation\arduino\arduino-cli.exe compile --fqbn arduino:avr:nano:cpu=atmega328old sketch\sketch.ino`.
5. Si se tocan generadores o bloques: comparar el C++ antes y después (sección 6).

### Generar el instalador
```
py tools/build_installer.py --official ottoblockly.Setup.1.5.0.exe
```
Sale `dist\MPR_Blockly_Setup_<versión>.exe`. Necesita el instalador oficial 1.5.0 en la raíz (se descarga de la página de releases de OttoDIY/blockly; el script comprueba su SHA‑256). El script arma una carpeta de trabajo recortada (solo lo necesario de avr-gcc, sin firmwares ni idiomas sobrantes), **compila un programa de prueba** antes de empaquetar y llama a NSIS. La 1.6.0 pesa 64 MB (la 1.5.3 pesaba 139 MB).

El instalador es de un clic: pide administrador, cierra la app si está abierta, **borra lo anterior** (`resources`, `www`, librerías y restos de versiones viejas) y copia lo nuevo; instala el driver CH340 y deja permisos para que alumnos sin administrador puedan compilar y subir. Con `/S` es completamente silencioso.

---

## 5. Lo que se agregó y cómo funciona

Cada módulo es un objeto global en su propio archivo, que se conecta a la página por el DOM. Por eso, para encontrar quién usa qué, conviene buscar con Grep y no confiar solo en el grafo de código.

### 5.1 Interfaz, marca y menú
Logos, colores y pie de página; título "MPR Blockly"; selector de placa con solo Nano y Nano Old. El menú sale de `toolbox_arduino_all.xml`: la lista de categorías visibles está en la primera línea (`defaultCategories1`). Para ocultar un bloque sin borrarlo se comenta en el XML con `<!-- OCULTO: ... -->`. `mpr_fixes.js` corrige las listas desplegables largas de Blockly sin tocar `blockly.min.js`.

### 5.2 Proyecto nuevo con la mesa lista (`blocklino.js`)
Al empezar un proyecto la mesa trae **Configuración + Bucle** con **Configuración Otto** adentro (pines 2, 3, 4, 5 y buzzer en 13), tal como pide el manual. Si el niño los borra no vuelven solos.

### 5.3 Búsqueda de bloques (`mpr_buscar.js`)
La lupa construye un índice con los textos, las opciones de las listas y la ayuda de cada bloque visible, normaliza (sin tildes ni mayúsculas) y muestra los resultados en el mismo panel del menú. Tiene sinónimos (`MPRBuscar.SINONIMOS`).

### 5.4 Subida a Otto (`mpr_subida.js`)
- **Puerto automático:** mira los puertos cada 2 s y, si aparece uno solo (o un solo robot conocido por su VID), lo elige y Otto dice "¡Me conectaste!".
- **Placa automática:** mientras compila, `avrdude -n` (que solo lee, no escribe) prueba las dos velocidades (Nano y Nano Old) y sube con la que responde. Antes, con la placa equivocada, tardaba ~103 s en rendirse.
- **Pasos claros:** "Verificando (1 de 2)" y "Cargando (2 de 2)" con barra de progreso, y errores explicados con el detalle técnico plegado.
- **Se está demorando:** si un paso pasa de su límite, ofrece "Detener"; si se desenchufa el cable, corta arduino-cli y avrdude con todos sus procesos hijos.
- **No recompilar lo mismo:** si nada cambió, la flecha sube directo el `.hex` anterior.
- **Precompilación:** 8 s después de abrir, compila un programa de Otto con prioridad baja para calentar la caché; la primera subida del día pasa de ~26 s a ~11 s.
- **Protegida:** F5, cerrar o abrir otro `.bloc` durante un envío avisa y pregunta ("Cerrar cuando termine / Cerrar ya / Seguir aquí").

### 5.5 Otto revisa antes de mandar (`mpr_revision.js`) y códigos de error (`mpr_consejos.js`)
Antes de enviar, la app revisa la mesa y muestra el problema más importante: falta Configuración + Bucle, falta Configuración Otto, falta la del sensor, espacios vacíos, bloques sueltos. Marca los bloques con un contorno rojo. Por defecto **solo aconseja**; con **Ctrl + Mayús + P** Otto además arregla (pone los bloques que faltan). Los bloques sueltos no se cuelan en el programa: el generador descarta su código del bucle.

Cada error de compilación o subida tiene un código corto (P = puerto, B = bloques, M = memoria, A = aplicación). Si el mismo código sale tres veces seguidas, el cuadro dice "Levanta la mano y llama a tu monitor: dile «código P3»". Para agregar un error basta una línea en `MPRConsejos.ERRORES`; el orden importa (P2 va antes que P3).

### 5.6 Mascota Otto 3D (`mpr_mascota.js`, `mpr_otto3d.js`, `mpr_consejos.js`, three.js r128)
Un Otto 3D en una esquina que da consejos, detecta errores comunes (lee el cuadro de mensajes con un `MutationObserver`), pasea por la mesa y se puede pintar por piezas. Parte escondido: solo se ve un botón redondo que da saltitos. Para que funcione en gráficas integradas tiene **tres modelos** (completo, liviano, mínimo) y baja de calidad solo si los cuadros por segundo caen; si ni siquiera hay WebGL, usa un dibujo 2D. Los modelos se generan con `tools/convertir_otto.js` desde el archivo 3MF; `tools/medir_poses.js` comprueba que ninguna animación se salga del canvas.

### 5.7 Recorrido inicial (`mpr_tour.js`)
Siete pasos con globo y foco resaltado, la primera vez que se abre y con el botón "?". Ojo: no quitar `overflow: hidden` ni `will-change: transform` del velo (`#mpr_tour_velo`); sin ellos el velo se convierte en una capa gigante que arruina el rendimiento.

### 5.8 Probar en pantalla (`mpr_simulador.js`, `mpr_otto_lib.js`)
Un escenario con Otto 3D sobre una mesa de 1400 × 700 mm (cuadros de 10 cm) donde se ejecuta el programa sin robot. `mpr_otto_lib.js` es una **traducción a JavaScript de la librería Otto real** (oscilador, limitador, marchas, canciones, gestos), así que los movimientos son fieles. Hay una caja arrastrable que el sensor de distancia "ve" con tres rayos. El intérprete recorre los bloques de forma asíncrona (Configuración una vez, Bucle repetido, máximo 3 minutos), resalta el bloque en curso y avisa lo que no puede simular. El zumbador suena por WebAudio.

### 5.9 Misiones (`mpr_misiones.js`)
Diez misiones siguiendo el manual (de "¡Hola, Otto!" a "Sube el Cerro Renca"). Cada una revisa los bloques de verdad y acepta varias formas correctas; si falta algo, dice qué y marca el bloque. El avance se guarda en `localStorage`; **Mayúscula + doble clic** en "Misión N / 10" lo reinicia para el siguiente niño.

### 5.10 Calibración (`mpr_calibracion.js`) — **Ctrl + Mayús + O**
Sin botón, para uso de monitores. Sube un programa de calibración y, por el puerto serie (9600), lee y escribe los ajustes de los servos en la EEPROM de Otto con cuatro deslizadores. Después, todos los programas los usan solos porque Configuración Otto genera `Otto.init(..., true, ...)`.

### 5.11 Modo monitor (`mpr_monitor.js`) — **Ctrl + Mayús + M**
Muestra, hasta cerrar la app, la categoría **🛠️ Monitor** (bloques de depuración como "mostrar nombre = valor" y "batería") y el botón del **Monitor Serie**. El Monitor Serie (`term.html`) se conecta solo al puerto y velocidad elegidos, muestra el texto de forma segura, guarda los últimos 60.000 caracteres y ya no bloquea la ventana principal. Si estaba abierto cuando se sube un programa, se cierra y se reabre solo. **F8** (consola de desarrollo) también solo funciona con el modo monitor encendido.

### 5.12 Librería Otto
`compilation/arduino/userlibs/libraries/Otto/` es la librería nueva (depurada y probada en servos por otra persona, más `getDistance`, `getNoise` y `getSensor`). Movimiento suave con tope de velocidad, freno según la tensión de las pilas, periodo mínimo en las marchas y arranque escalonado de los servos. Es intocable salvo reemplazo completo por un paquete nuevo.

---

## 6. Comparar el C++ generado (`tools/codigo_generado.mjs`)

Cuando se toca un generador o un bloque, la prueba más útil es comprobar que el código generado **no cambió**:

```
# 1) abrir la app (o C:\mprbp) con la ventana visible:
"MPR Blockly.exe" --remote-debugging-port=9222
# 2) antes del cambio:
node tools/codigo_generado.mjs antes.json
# 3) hacer el cambio, recargar (F5) y:
node tools/codigo_generado.mjs despues.json
node tools/codigo_generado.mjs --comparar antes.json despues.json
```

Saca por DevTools el C++ de cada ejemplo visible y de cada bloque del menú puesto solo en la mesa (82 casos hoy), y respalda y restaura la mesa y `localStorage`. En la limpieza v1 sirvió para borrar 156 bloques y generadores sin uso con 0 diferencias.

---

## 7. Atajos de teclado y banderas ocultas

| Atajo | Qué hace |
|---|---|
| **F5** | Recarga la interfaz (avisa si hay un envío en curso) |
| **Ctrl + Mayús + M** | Modo monitor (categoría 🛠️ y Monitor Serie); se apaga al cerrar la app |
| **Ctrl + Mayús + P** | Otto pone los bloques que faltan (apagado al abrir) |
| **Ctrl + Mayús + O** | Calibración de servos |
| **F8** | Consola de desarrollo (solo con el modo monitor encendido) |
| **Mayús + doble clic** en "Misión N / 10" | Reinicia las misiones |

Todos son sin botón a propósito: están pensados para monitores, no para niños.

---

## 8. Recetas rápidas

- **Agregar un texto o cambiar uno:** `www/lang/msg_es.js` o `Arduino_es.js`; probar con `py tools/probar.py` y F5.
- **Mostrar u ocultar un bloque o categoría:** `toolbox_arduino_all.xml` (y `defaultCategories1` para categorías enteras).
- **Agregar un error explicado:** una línea en `MPRConsejos.ERRORES` (`mpr_consejos.js`), con su código y la pista para el monitor.
- **Agregar un ejemplo:** el `.xml` en `www/examples/` y su entrada en `examples.json`; luego comprobar que compila.
- **Nuevo bloque:** definición en `Blockly.Blocks[...]`, generador en `Blockly.Arduino[...]`, texto en `Arduino_es.js` y entrada en el toolbox. Comparar el C++ con la herramienta de la sección 6.
- **Cambiar la versión:** `package.json`, luego generar el instalador y anotar tamaño y SHA‑256 en la sección 7.4 de `DOCUMENTACION_TECNICA.md`.

---

## 9. Qué se quitó en la limpieza v1 (y ya no se puede reactivar sin git)

Idiomas distintos del español, el editor de Python y el modo "fábrica", otras placas (solo Nano y Nano Old), los sensores extra y niveles, 73 de las 77 librerías Arduino de terceros, drivers USB salvo el CH340, el actualizador automático, y 156 definiciones de bloques y generadores que ni el menú ni los ejemplos usaban (ESP8266/ESP32, bluetooth, MP3, sensores "2", texto, arrays…). Un `.bloc` guardado con alguno de esos bloques ya no abriría. Todo sigue en el historial de git.

---

## 10. Dónde seguir

- **Qué falta hacer:** `PENDIENTES_LIMPIEZA_V1.md` (pruebas con el robot, instalar la 1.6.0 sobre una versión anterior, huevo de Pascua, repositorio de la v2).
- **Detalle de cada mecanismo y medidas:** `DOCUMENTACION_TECNICA.md` (la sección 13 es el traspaso para retomar en otro PC).
- **Qué se cambió, cuándo y por qué:** `BITACORA.md`.
- **Trampas conocidas:** secciones 10 y 13.6 de `DOCUMENTACION_TECNICA.md`.
