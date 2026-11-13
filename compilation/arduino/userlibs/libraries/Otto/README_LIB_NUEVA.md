# LIB_OTTO_NUEVA — librería Otto optimizada (MPR / Mi Primer Robot)

Paquete para **validación por un equipo externo**. Contiene los dos únicos ficheros
de la librería `Otto` que fueron modificados, los dos sketches de prueba y el diff
completo contra el punto de partida.

| | |
|---|---|
| Base de partida | commit `b2c182f` |
| Estado entregado | commit `fd812ab` (39 commits) |
| Hardware de referencia | Arduino Nano v3 (ATmega328P), 4×AA por VIN, 4 servos SG90 colgados del regulador del Nano, buzzer en el pin 13 |
| Fecha | 2026-11-13 |

---

## 1. Qué contiene

```
LIB_OTTO_NUEVA/
├── Otto.h                 ← MODIFICADO
├── Otto.cpp               ← MODIFICADO
├── SHA256SUMS.txt
├── CAMBIOS.diff           ← diff completo de los dos ficheros contra b2c182f
├── README.md
└── examples/
    ├── OttoValidacionFinal/   ← el sketch con el que se valida esta entrega
    └── OttoDiagnostico/       ← solo sirve con el instrumentado encendido (ver §6)
```

## 2. Instalación

**Solo hay que sustituir dos ficheros.** Los otros siete de la librería están
**sin tocar** y deben conservarse tal cual:

| fichero | estado |
|---|---|
| `Otto.h`, `Otto.cpp` | **sustituir por los de este paquete** |
| `Oscillator.h`, `Oscillator.cpp` | sin cambios — **no sustituir** |
| `Otto_mouths.h`, `Otto_sounds.h`, `Otto_gestures.h` | sin cambios |
| `Otto_matrix.h`, `Otto_matrix.cpp` | sin cambios |

```sh
cp Otto.h Otto.cpp <ruta>/Arduino/libraries/Otto/
cp -r examples/* <ruta>/Arduino/libraries/Otto/examples/
```

Compilar con **Arduino Nano / ATmega328P**.

## 3. La restricción que gobernó todo el trabajo

> *"quiero que los bloques queden intactos y las llamadas de funciones también"*

Verificable y verificado:

| | resultado |
|---|---|
| Ficheros tocados en `www/` (bloques y generadores Blockly) | **0** |
| Ficheros tocados de `Oscillator` | **0** |
| Firmas públicas de `Otto.h` | **37 antes, 37 ahora, diff vacío** |
| Eliminaciones en la API | ninguna; solo 3 miembros **privados** (`increment[4]`, `final_time`, `partial_time`) |

**Cualquier programa generado por Blockly compila y se comporta igual.** Todo el
trabajo está en cuerpos de función, miembros privados y macros de compilación.

## 4. Configuración que se entrega

Comprobable con el preprocesador (recomendado: no fiarse de un `grep`):

```
INSTRUMENT=0   EEPROM_LOG=0   BRAKE=1   CRUCE=30   SUELO=50
```

| macro | valor | qué hace | coste medido |
|---|---|---|---|
| `OTTO_INSTRUMENT` | **0** | diagnóstico (medición de Vcc + registro en EEPROM) apagado | ahorra **4930 B de flash y 265 B de RAM** |
| `OTTO_BRAKE` | **1** | freno adaptativo: la caída de tensión modula el ritmo en tiempo real | **+1478 B de flash, +31 B de RAM** |
| `OTTO_GAIT_T_PER_DEG` | **50** | suelo de periodo de las marchas: `T_min = 50 ms × amplitud mayor` | 3 líneas |
| `OTTO_MV_TRV_CHUNK` | **50** | trocea los desplazamientos simultáneos grandes | gratis |
| `OTTO_SHAKE_CROSS_DEG` | **30** | cuánto cruza el centro el pie libre en `shakeLeg` (30 = el original) | — |

Tamaños resultantes:

| sketch | flash | RAM |
|---|---|---|
| Programa Blockly típico (`init` + walk + turn + swing + jump + sing) | 9982 B (32 %) | 473 B (23 %) |
| `OttoDiagnostico` | 13620 B (44 %) | 747 B (36 %) |
| `OttoValidacionFinal` | 15574 B (50 %) | 749 B (36 %) |

## 5. Cómo validar — `OttoValidacionFinal`

Es el sketch pensado para esta entrega: **no depende del instrumentado**. Mide cada
movimiento con `millis()`, que es la única señal disponible con el diagnóstico
apagado, y resulta suficiente porque las dos cosas a validar dejan huella en el
tiempo.

Las llamadas son **las que emiten los generadores de Blockly, literales**:
velocidad ∈ {1500, 2000, 3500}, tamaño ∈ {10, 25, 40}, siempre con `steps = 1`.

### Resultados esperados (medidos el 2026-11-13, por USB)

**A) El acotado de T actúa.** Las 22 marchas deben respetar su suelo:

| petición | suelo | medido |
|---|---|---|
| `walk(1, 250, 1)` | 1500 | **1544** |
| `walk(1, 750, 1)` | 1500 | 1521 |
| `swing(1, 250, 25)` | 1250 | **1254** |
| `swing(1, 1500, 40)` | 2000 | **2023** |
| `tiptoeSwing(1, 1500, 40)` | 2000 | 2003 |

Si alguna de estas sale cerca del valor pedido, el acotado no está compilado.

**B) El freno actúa.** Su firma es un **contraste**, no un número:

| movimiento (V=2000, tamaño 25) | estiramiento sobre el nominal |
|---|---|
| `swing`, `updown`, `moonwalker` | **+0 %** |
| `crusaito` | +5 % |
| `ascendingTurn` | +8 % |
| `flapping` | +12 % |

**Si los seis salen clavados, el freno no está actuando.**

**C) Los bloques no cambian.** `walk` y `turn` a 1500 / 2000 / 3500 deben salir
todos con `nominal = V`, ninguno acotado.

### Cómo correrlo

| | |
|---|---|
| **Por USB** | única forma de leer la tabla por el puerto serie (115200). **Pero** por USB la alimentación entra por un Schottky y **se salta el regulador**: las caídas son ~2.3× menores y el contraste del freno puede salir plano |
| **Con pilas** | no hay puerto serie. El canal es el buzzer: nota grave larga + N pitidos = parte N; un tic corto antes de cada movimiento. Contando "parte + tics" se localiza el punto exacto de un reinicio |

`OTTO_VAL_PARTE` (en el `.ino`) corre una sola parte: 0 = las cinco, 1..5 = solo esa.

## 6. Cómo volver a medir — `OttoDiagnostico`

> **ATENCIÓN:** con `OTTO_INSTRUMENT 0`, `OttoDiagnostico` **compila pero no
> registra ni imprime nada**, y el volcado sale vacío. No está roto.

Para medir de verdad hay que poner `OTTO_INSTRUMENT 1` **en `Otto.h`**.

> **Un `#define` en el `.ino` NO llega a `Otto.cpp`.** Arduino compila la librería en
> otra unidad de traducción. Este error costó dos binarios de 12478 B exactamente
> iguales antes de detectarlo. **Los macros se cambian en `Otto.h`.**

Con el instrumentado activo, `init()` vuelca por serie el registro circular de la
pasada anterior (90 ranuras de 10 bytes en EEPROM desde el byte 16; los bytes 0-3
son los trims de servo y no se tocan). Eso permite medir **con pilas y sin puerto
serie**, que es la única condición representativa.

**La librería no abre el puerto serie con `OTTO_INSTRUMENT 0`.** Un sketch propio
que quiera imprimir debe llamar a `Serial.begin()` él mismo.

## 7. Qué cambió en el comportamiento

Seis cosas. El resto del diff son comentarios, instrumentación y los dos sketches.

| # | antes (`b2c182f`) | ahora |
|---|---|---|
| 1 | `_moveServos`: round-robin, **un servo cada 10 ms** con salto de 4 incrementos, más un bucle final que los clavaba al destino | perfil trapezoidal con acumuladores de resto en punto fijo, los cuatro servos a la vez, presupuesto agregado de 150 °/s, troceado y freno |
| 2 | `oscillateServos`: bucle acotado por reloj de pared | **reloj virtual** modulado por el freno. La fase no salta porque se reprograma el periodo en los cuatro osciladores a la vez y la fase es acumulada |
| 3 | `_execute`: sin acotado de periodo | `T_min = 50 ms × amplitud mayor`. **Nunca acelera: solo frena lo imposible** |
| 4 | `home()`: un `_moveServos(1000, homes)` | **dos fases**: pies y luego caderas, 600 ms en total |
| 5 | `shakeLeg`: apoyo en 58 (32° del centro) | apoyo en **55** (35°, umbral de despegue medido) |
| 6 | — | instrumentación y registro en EEPROM, **apagados en la entrega** |

**Atribución, para evitar un malentendido:** el limitador (`OTTO_LIMITER_DEFAULT_ON`,
`OTTO_DIFF_LIMIT_DEFAULT 3`) y el round-robin del oscilador **ya existían** en
`b2c182f` y siguen activos. El techo de 47 °/s por servo se **midió** en este
trabajo, no se introdujo.

## 8. Evidencia: qué está demostrado y qué no

Se separa a propósito, para que la validación se concentre donde hace falta.

| cambio | evidencia | grado |
|---|---|---|
| **El freno evita reinicios** | A/B con pilas, **5 pasadas, diseño ABA**. Sin freno la placa cae en el movimiento **5, 7 y 8**; con freno en el **16** y, con pilas frescas, **completa los 25**. Sin solape | ✅ **demostrado** |
| **El freno actúa** | contraste +0 % en los fáciles vs +5-12 % en los duros; **Spearman ρ = 0.90** entre el freno que la tabla había aprendido por movimiento y la dificultad medida (n=14) | ✅ demostrado |
| **Acotado de T** | recorrido de `walk` a T=250: **191° → 290° (+52 %)**; predicho al milisegundo; cm/s sin cambio | ✅ medido |
| **Instrumentado apagado** | −4930 B flash, −265 B RAM; elimina 36281 escrituras acumuladas (de 100000 especificadas) en una **dirección fija** del EEPROM | ✅ medido |
| Apoyo de `shakeLeg` a 35° | barrido: a 30° el pie contrario apenas despega, a 35° despega del todo, a 40° estable, a 45-50° tambalea | ✅ medido |
| Troceado (`OTTO_MV_TRV_CHUNK`) | 64-87 mV de mejora frente a un **ruido de 116 mV** | ⚠️ **no significativo.** Se mantiene por ser gratis y por el signo consistente (5 a favor, 1 empate, 0 en contra) |
| Reescritura de `_moveServos` | — | ⚠️ **sin A/B directo.** Es el cambio más grande; se sustituyó antes de que hubiera instrumentación para comparar |

## 9. Hallazgos que conviene conocer antes de tocar nada

| # | hallazgo | cómo se midió |
|---|---|---|
| 1 | **El techo de velocidad es 47 °/s POR SERVO**, no agregado. El presupuesto agregado de 150 °/s solo gobierna los **gestos** (`_moveServos`), no las marchas | 5 periodos × 3 movimientos, siempre clavado en 46-48 |
| 2 | **Modelo de recorrido validado:** `trv = Σ min(4·A[i], 47·T)`. Acertó en **15 de 15** puntos con 0-7 % de error | barrido de velocidad + barrido fino de T con medida de distancia |
| 3 | **No existe óptimo de velocidad entre T=800 y T=2000: los cm/s son planos** (2.15 ± 9 %, por debajo del ±17 % del error de medida con metro), porque con los servos al tope zancada × cadencia es constante. El óptimo práctico es **T=1500**, elegido por tensión y aspecto | 7 valores de T, dos barridos, medición con metro |
| 4 | **Sostener una pose es gratis; lo caro es volver al centro.** 3.8 mV/° yendo hacia el extremo, 8.5-10.7 mV/° volviendo. **Y frenar la vuelta tira el robot** (pasa el doble de tiempo descompensado) | 23 sostenes, ~2850 muestras, cero por debajo de 3900 mV; experimento de cuatro modos de retorno |
| 5 | **La dirección importa, el recorrido no.** Con el **mismo** recorrido de 60°, ir hacia una pose que calza contra el suelo cuesta **961 mV** y alejarse de ella **552 mV** | reparto de caídas por paso de `shakeLeg`, n=24 vs n=16 |
| 6 | **El `vcc` de arranque (sin carga) engaña como medidor de batería.** Una corrida que arrancó a 4962 mV rindió peor que otra a 4876 | cuatro pasadas del mismo código |

## 10. Limitaciones conocidas

**Tres movimientos no alcanzan el objetivo de 3900 mV**, y los tres están fuera de
lo que se podía tocar:

| movimiento | peor `vmin` | por qué no se corrige |
|---|---|---|
| `flapping` | 3283 | se dejó intacto por indicación expresa del propietario |
| `shakeLeg` | 3564 | su calado contra el suelo es **portante**: ver §11 |
| `bend` | 3897 | **ignora `T` para la velocidad** (tres `_moveServos` fijos de 400/400/500 ms; `T` solo alarga un `delay` final), así que **ningún bloque puede frenarlo**. Defecto de origen de Otto DIY |

**El acotado de T apenas se nota desde los bloques.** De las nueve combinaciones
velocidad × tamaño que el juego en español puede generar, **solo cambia una**
(Rápido 1500 × Grande 40, cuyo suelo es 2000). "Rápido" (1500) coincide con el suelo
de `walk`. El valor del acotado es sobre todo **condicional**: protege si algún día
el desplegable ofrece valores más rápidos.

**Las mediciones absolutas son específicas de esta placa.** El Vcc se obtiene de la
referencia interna de banda prohibida, que varía **±10 % entre unidades** (1.0-1.2 V).
La Fase 3 trabaja con la **caída relativa**, donde el error se cancela al restar, pero
`OTTO_BRAKE_VMIN_ABS` (3900 mV) **sí** es sensible a esa calibración: en otra placa
hay que ajustarlo con `OTTO_VCC_BANDGAP_MV`. En las unidades probadas los reinicios
caen entre 3200 y 3800 mV, coherente con los ~3.78 V que el ATmega328P necesita a
16 MHz — **ese**, y no el BOD de 2.7 V, es el mecanismo real de reinicio.

**Nunca usar como nombres de variable local:** `zero`-`nine`, `otto`, `smile`,
`heart`, `wave`, `angry`, `sad`, `confused`, `diagonal`, `thunder`, `vamp1`, `vamp2`.
`Otto_mouths.h` los define como macros.

## 11. Dos "arreglos" que los datos tumbaron

Se documentan porque **ahorran repetir el intento**, y el razonamiento completo está
escrito dentro de `shakeLeg()` en `Otto.cpp`.

El gesto de Otto DIY manda el pie que debería aletear **al otro lado del centro**
(RR=120, +30°): la suela vuelve al suelo y la inclinación se cancela. Parece un
error de diseño. **No lo es.**

| intento | qué midió |
|---|---|
| **Quitar el cruce** (pie libre siempre en el aire) | **el robot se cayó 8 de 8 veces**, con las dos piernas, a dos velocidades y con 3 brownouts. El cruce **mantiene el robot en pie** |
| **Ablandar el cruce a 15°** (RR=105) | eliminó el calado (ratio direccional 1.62 → 0.89) pero **la caída por grado no cambió (+2 %)** y el coste se mudó al regreso a casa (**+99 %**), con el peor `vmin` de todo el proyecto. El cruce también **deja el robot nivelado antes del regreso** |

`OTTO_SHAKE_CROSS_DEG` queda como macro, con la tabla de resultados al lado. Con 30
y con 15 el robot aguanta sin caerse, así que eléctricamente es un empate: si se
prefiere el aspecto de 15, el dato no se opone, pero no es una mejora.

**Lección transferible:** en este robot, "arreglar" una geometría que parece mal
diseñada falló **tres veces**, y las tres porque cumplía una función mecánica no
evidente. Antes de corregir una pose fea, **medir qué pasa cuando se quita**.

## 12. Nota de método, por si se repiten las medidas

El confusor dominante **no fue técnico: fueron las pilas.** Arruinó cinco pasadas
antes de detectarlo (mediana de `vbefore` 4732 → 4616 → 4523 en pasadas sucesivas del
*mismo* código, con el ciclo alargándose de 52.9 s a 60.5 s). Lo que lo resolvió:

1. **Pruebas cortas** (30 s) en vez de secuencias largas.
2. **A y B seguidas, con las mismas celdas.**
3. **El orden elegido en contra de la hipótesis.** El A/B del freno vale precisamente
   porque al freno se le dieron las **peores** pilas y ganó igual.
4. **Métricas adimensionales** cuando se pueda (ratios dentro de una misma pasada),
   porque no dependen del estado de la batería.

Y una advertencia sobre promedios: el freno parecía inútil mirando medias. Se vio
actuando al partir las caídas **por paso del gesto** y al comparar **direcciones con
el mismo recorrido**. Guardar solo el mínimo de una variable de control **esconde si
el lazo tiene autoridad**; hay que guardar también el promedio. Por eso el registro
lleva `g=` (mínimo) y `gm=` (promedio) empaquetados en 4+4 bits.

---

## Resumen para quien valida

1. Sustituir `Otto.h` y `Otto.cpp`. **No tocar los otros siete ficheros.**
2. Compilar y subir `OttoValidacionFinal` **por USB**: comprobar §5-A (acotado) y §5-C
   (bloques sin cambio).
3. Repetir **con pilas**, siguiendo los pitidos: debe llegar a las cuatro notas graves.
   Ahí se comprueba §5-B (el freno) en condiciones reales.
4. Para el A/B del freno: `OTTO_BRAKE 0` en `Otto.h`, **misma batería, pasada de
   control primero**. El protocolo y los resultados ya obtenidos están en la cabecera
   de `OttoValidacionFinal.ino`.
