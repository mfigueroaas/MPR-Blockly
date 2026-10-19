# Análisis del movimiento de los servos — librería Otto (octubre 2026)

Pedido: revisar por qué Otto se mueve lento y con pasos cortos en MPR Blockly, revisar el oscilador y las
instrucciones que "mandan a 90 grados" sin importar dónde está el servo, y ver si se puede mejorar sin volver
al problema que el limitador buscaba evitar (servos que "se pisan": arrancan todos a la vez, picos de corriente,
reinicios de la placa, movimientos bruscos).

Archivos: `compilation/arduino/userlibs/libraries/Otto/` (`Oscillator.h/.cpp`, `Otto.h/.cpp`).

## 1. Qué limitaba el movimiento

1. **El limitador de velocidad estaba en 3 grados por segundo.** `Oscillator::write()` calcula cuánto puede
   moverse un servo según el tiempo desde la orden anterior: `limite = tiempo_ms * OTTO_DIFF_LIMIT_DEFAULT / 1000`,
   con un mínimo de 1 grado. Con 3 grados/s el cálculo siempre daba 0, así que quedaba en **1 grado por orden**:
   - al caminar o bailar (una orden cada 20 ms por servo): ~47 grados/s;
   - en `_moveServos` (inclinar, agitar pata, sube, gestos, inicio), que actualiza un servo por vez cada 10 ms
     (round-robin), cada servo recibe una orden cada 40 ms: **~25 grados/s**.

   Un servo SG90 se mueve a 400–600 grados/s. Caminar a la velocidad del Otto original (T=1000 ms) pide unos
   190 grados/s en la cadera. Por eso los pasos quedaban recortados y se **bajaron las velocidades del menú**
   (Normal pasó de 1000 a 2000 ms, Rápido de 750 a 1500 ms).
2. **Saltos al reconectar los servos ("mandar a 90").** `home()` desconecta los servos al terminar. El siguiente
   movimiento los vuelve a conectar con `Oscillator::attach()`, que hacía `write(90)` **sin el trim** y reiniciaba
   la posición guardada a 90, estuviera donde estuviera el servo. Con un robot calibrado, cada reconexión era un
   salto de "trim" grados hacia un lado y otro de vuelta.
3. **Al encender, los cuatro servos se conectaban a la vez** y cada uno iba a 90 a toda velocidad (su posición
   real es desconocida). Es el momento de mayor pico de corriente: los cuatro motores arrancando juntos.
4. **Después de una pausa el limitador permitía un salto**: el tiempo "desde la orden anterior" crece durante la
   pausa, y con él el límite. (Con 240 grados/s, además, la cuenta en `int` de 16 bits del Nano se desbordaba.)
5. **Muestreo del oscilador cada 21 ms en vez de 20** (`>` en vez de `>=`): cada movimiento de un ciclo cubría
   ~95% del ciclo pedido. Y `_period/_samplingPeriod` en enteros: T=750 quedaba en 740 ms.
6. `_moveSingle()` mandaba a 90 las posiciones fuera de rango (salto brusco) en vez de limitarlas a 0–180.

### Sobre el "round-robin" (un servo por vez)
La idea era que los servos no se movieran al mismo tiempo. Pero la librería Servo de Arduino ya envía los pulsos
de los servos uno después del otro en cada ciclo de 20 ms; lo que produce los picos de corriente no es cuándo se
escribe la orden, sino **cuánto cambia la posición de golpe** (motores acelerando al máximo, sobre todo varios a la
vez). En `oscillateServos` el round-robin no cambia nada (cada servo tiene su propio reloj de 20 ms). En
`_moveServos` escalona el arranque 10 ms entre servos (algo ayuda), pero junto con el límite de 1 grado por orden
dividía la velocidad por cuatro. Con un límite real en grados por segundo deja de frenar, así que **se mantuvo**.

## 2. Cambios hechos

| Dónde | Cambio |
|---|---|
| `Otto.h` | `OTTO_DIFF_LIMIT_DEFAULT` 3 → **240 grados/s** (el valor de OttoDIYLib). Sigue limitando los saltos, pero deja seguir la trayectoria pedida. |
| `Otto.h`, `Otto::init()` | Los trims se leen de la EEPROM **antes** de conectar los servos, y los servos se conectan **de a uno**, con `OTTO_ATTACH_DELAY_MS` = 200 ms entre cada uno. |
| `Oscillator::attach()` | Antes de conectar envía la **última posición conocida con trim** (al encender, 90 + trim) y no la reinicia: no hay salto al reconectar después de `home()`. |
| `Oscillator::write()` | Límite en grados/s con redondeo; si pasó más de `OSCILLATOR_MAX_DT_MS` (50 ms) desde la orden anterior se cuenta como una pausa y el primer paso es como un solo pulso de 20 ms (5 grados). Cálculo en `long`. |
| `Oscillator::next_sample()`, `SetT()` | Muestra cada 20 ms exactos (`>=`) y `_numberSamples` con decimales: cada ciclo dura lo pedido. |
| `Otto::_moveSingle()` | Fuera de rango se limita a 0–180 en vez de mandar a 90. |

No se cambiaron: las trayectorias de los movimientos (amplitudes, desfases), `home()` (1 s, luego desconecta),
el round-robin, ni los bloques. Para volver al limitador anterior basta poner `OTTO_DIFF_LIMIT_DEFAULT` en 3.

## 3. Resultados (simulación)

Se compiló la librería real (antes y después) en el PC con un Arduino simulado: reloj virtual, librería Servo con
pulsos cada 20 ms, ejes de servo que se mueven a lo más 450 grados/s, robot calibrado (trims 5, −4, 7, −6) y
encendido en una pose cualquiera. Programa como el que genera MPR Blockly (`Otto.init` + `Otto.home` y luego
4 repeticiones del movimiento). Amplitud = la que recorre cada servo en el último ciclo (cadera izq./der., pie
izq./der.); "salto" = mayor cambio de orden en un pulso de 20 ms.

| Movimiento | T (ms) | Antes: duración / amplitud / salto | Ahora: duración / amplitud / salto |
|---|---|---|---|
| Caminar | 3500 (Lento) | 14,0 s / 30-30-20-20 / 1 | 14,0 s / 30-30-20-20 / 5 |
| Caminar | 2000 (Normal) | 8,0 s / **24**-24-20-20 / 1 | 8,0 s / **30**-30-20-20 / 5 |
| Caminar | 1500 (Rápido) | 6,0 s / **18,5**-18,5-18-18 / 1 | 6,0 s / **30**-30-20-20 / 5 |
| Caminar | 1000 | 4,0 s / **12,5**-12,5-12,5-12,5 / 1 | 4,0 s / **30**-30-20-20 / 5 |
| Girar | 1000 | 4,0 s / 12,5-10-12,5-12,5 / 1 | 4,0 s / 30-10-20-20 / 5 |
| Moonwalk grande (h=40) | 1000 | 4,0 s / pies **13** / 1 | 4,0 s / pies **40** / 5 |
| Inclinar | 2000 | **4,1 s** | **2,9 s** (lo diseñado) |
| Agitar pata | 2000 | **7,0 s** | **3,6 s** (diseñado: 3,5 s) |
| Sube | 1500 | 3,5 s | 3,0 s |

- **Arranque** (encender + inicio): antes, 2 pulsos con 3 o más servos a velocidad máxima a la vez y un salto de
  7 grados (el trim); ahora, ninguno (los servos se acomodan de a uno en ~0,6 s) y saltos de 1 grado.
- **Después de una pausa de 2 s sin volver al inicio**: antes, el primer paso del siguiente movimiento saltaba
  6 grados en 3 servos a la vez; ahora 5 grados como máximo, igual que en marcha normal.
- El precio: los servos se mueven más rápido (hasta ~250 grados/s, no 47), que es lo que permite pasos completos.
  Caminar en "Normal" quedó con el paso que el Otto original da en su velocidad normal.

La simulación no reemplaza la prueba en el robot: no modela el peso, el roce ni la caída de voltaje de las pilas.

## 4. Cómo probar en el robot

1. `python tools/probar.py` (copia la librería a `C:\MPRBlockly`) y abrir la app.
2. Subir los ejemplos "Caminar", "Meneito" y "Equilibrio", y un programa con "Mover Adelante" en Normal y
   Rápido, "Inclinar", "Agitar pata" y "Bailar".
3. Revisar: al encender, los servos se acomodan uno por uno; los pasos son más largos y el robot avanza más por
   paso; el robot no se cae; la placa **no se reinicia** (si se reinicia, el robot vuelve a acomodar los servos uno
   por uno en medio del programa). Probar con pilas nuevas y con pilas usadas.
4. Si se reinicia o se cae: bajar `OTTO_DIFF_LIMIT_DEFAULT` a 150–180 en `Otto.h`;
   si el problema es solo al encender, subir `OTTO_ATTACH_DELAY_MS`. Para volver al comportamiento anterior: 3.

## 5. Otros hallazgos (no se cambiaron)

- **Bloque "Mover Velocidad … Positions …" (`otto_moveservos`, categoría Otto):** genera `Otto._moveServos(10, 90);`,
  pero la función espera una lista de 4 posiciones. Compila solo con una advertencia (`-fpermissive`) y al
  ejecutarse lee 4 "posiciones" desde la dirección de memoria 90: los servos irían a posiciones impredecibles,
  incluso a los extremos. Recomendación: ocultarlo (el bloque "Mover Pierna Izquierda … Velocidad" hace lo mismo
  bien).
- `crusaito()` usa desfases `{90, 90, …}` en radianes (no `DEG2RAD(90)`); viene así de la librería original. Las
  dos caderas quedan con el mismo desfase, así que no rompe el baile; no se tocó para no cambiarlo.
- `home()` desconecta los servos (el robot queda sin fuerza en reposo, ahorra pilas y evita zumbidos). Es el
  diseño original; con el cambio en `attach()` ya no hay salto al reconectar.
- Los reinicios de la placa en el fondo son de **alimentación**: los servos toman la corriente del Nano. Pilas
  nuevas (o un portapilas de 4×AA de buena calidad) ayudan más que cualquier ajuste del código.
