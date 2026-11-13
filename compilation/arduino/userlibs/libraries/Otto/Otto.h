#ifndef Otto_h
#define Otto_h

#ifdef ARDUINO_ARCH_ESP32
#include <ESP32Servo.h>
#else
#include <Servo.h>
#endif
#include "Oscillator.h"
#include <EEPROM.h>
#include "Otto_sounds.h"
#include "Otto_gestures.h"
#include "Otto_mouths.h"
#include "Otto_matrix.h"


// ===== Otto Debug Config =====
#ifndef OTTO_DBG
  #define OTTO_DBG 0          // 1 = enable Serial debug, 0 = compiled out
#endif

#ifndef OTTO_DBG_BAUD
  #define OTTO_DBG_BAUD 115200
#endif

#ifndef OTTO_VISUAL_DEBUG
  #define OTTO_VISUAL_DEBUG 1   // 1 = trazas de refresco/rr visibles, 0 = silencio
#endif

#if OTTO_DBG && OTTO_VISUAL_DEBUG
  #define OTTO_VIS_PRINT(x)    OTTO_DBG_PRINT(x)
  #define OTTO_VIS_PRINTLN(x)  OTTO_DBG_PRINTLN(x)
#else
  #define OTTO_VIS_PRINT(x)    do {} while(0)
  #define OTTO_VIS_PRINTLN(x)  do {} while(0)
#endif



// ===== Otto Instrumentation (Fase 1: medicion) =====
// Mide, SIN ningun componente externo, dos cosas:
//   1) la tension real del rail de alimentacion del microcontrolador, leyendo la
//      referencia interna de banda prohibida de 1.1 V contra AVcc;
//   2) la velocidad angular comandada a cada servo (grados/segundo) y los grados
//      totales recorridos, que sirven como proxy del trabajo mecanico y por tanto
//      de la energia consumida.
// El par (velocidad angular agregada, caida de tension) es lo que permitira
// calibrar el presupuesto de corriente en la Fase 4.
//
// Es un modo de DIAGNOSTICO: no altera el movimiento, solo lo observa.
//
// ==> VA A 0 EN LA VERSION QUE SE ENTREGA (Fase 6, 2026-11-13), por dos razones
//     medidas, no estimadas:
//
//     1) COSTE. Sobre un programa representativo de Blockly (init + walk + turn +
//        swing + jump + sing): 14912 -> 9982 B de flash y 738 -> 473 B de RAM. Son
//        4930 B (16% del Nano) y 265 B (13%), no los ~2 KB que puse aqui al
//        principio a ojo. En un programa de aula con matriz MAX7219, sonidos y
//        ultrasonidos, esos 5 KB deciden si cabe o no.
//
//     2) DESGASTE DEL EEPROM. Con el registro activo, _eepLogAppend escribe el
//        indice en una DIRECCION FIJA en cada tramo de movimiento. Este proyecto
//        acumulo 36281 escrituras en esa celda; el ATmega328P esta especificado
//        para 100000. O sea que un robot de aula la agotaria en unos dos tercios
//        del camino ya recorrido aqui. Es una via de desgaste que no existia antes
//        de este trabajo y no debe viajar en la version entregada.
//
// LO QUE OPTIMIZA NO DEPENDE DE ESTO Y SIGUE ACTIVO con OTTO_INSTRUMENT a 0:
//     - el freno adaptativo (OTTO_BRAKE) lee Vcc por su cuenta en _brakeGain(),
//       cada OTTO_BRAKE_SAMPLE_MS, sin pasar por el instrumentado;
//     - la tabla de freno POR MOVIMIENTO sigue funcionando, porque la etiqueta
//       OTTO_INSTR_KIND es incondicional a proposito y la tabla vive en RAM;
//     - el acotado de T de las marchas (OTTO_GAIT_T_PER_DEG) y el troceado
//       (OTTO_MV_TRV_CHUNK) son independientes.
//   Comprobado compilando las dos configuraciones.
//
// PARA VOLVER A DIAGNOSTICAR hay que poner este 1 AQUI, en Otto.h. Un #define en
// el .ino NO llega: Arduino compila la libreria en otra unidad de traduccion y el
// sketch sale identico (ya nos paso con OTTO_MV_TRV_CHUNK, dos binarios de 12478 B
// exactos). Sin este 1, OttoDiagnostico compila pero no registra nada.
#ifndef OTTO_INSTRUMENT
  #define OTTO_INSTRUMENT 0
#endif

// Periodo minimo entre muestras, en ms. Cada muestra cuesta ~0.4 ms de ADC
// bloqueante, asi que 10 ms suponen ~4% de sobrecarga temporal. Subirlo reduce
// la sobrecarga pero puede perderse el minimo de un transitorio corto.
#ifndef OTTO_INSTR_SAMPLE_MS
  #define OTTO_INSTR_SAMPLE_MS 10
#endif

// Tension nominal de la referencia interna de banda prohibida, en mV.
// Varia entre 1.0 y 1.2 V de una unidad a otra, asi que el valor ABSOLUTO de Vcc
// arrastra hasta +-10% de error; la CAIDA relativa, que es lo que nos interesa,
// es precisa porque el error se cancela.
// Si algun dia mides el pin 5V con un multimetro, calibra con:
//   OTTO_VCC_BANDGAP_MV = 1100 * (Vcc_medido_mV / Vcc_reportado_mV)
// Umbrales para contar CUANTO TIEMPO estuvo el rail bajo, no solo cuanto bajo.
// El A es la tension que el 328P necesita a 16 MHz (3.78 V redondeado a 3.9 con
// margen); el B es un aviso previo. Ver _vccLowA/_vccLowB en la parte privada.
// Etiqueta de la fase compilada. Se imprime en la cabecera del volcado para no
// tener que deducir del contenido que binario corrio: ya ha pasado dos veces que
// una pasada se subio con la version anterior y las conclusiones salian torcidas.
#ifndef OTTO_FASE
  #define OTTO_FASE "6"
#endif

#ifndef OTTO_VCC_LOW_A_MV
  #define OTTO_VCC_LOW_A_MV 3900
#endif
#ifndef OTTO_VCC_LOW_B_MV
  #define OTTO_VCC_LOW_B_MV 4200
#endif

#ifndef OTTO_VCC_BANDGAP_MV
  #define OTTO_VCC_BANDGAP_MV 1100
#endif

#if (OTTO_DBG) || (OTTO_INSTRUMENT)
  // Abre el puerto serie una sola vez. No se usa "if (!Serial)" porque en AVR
  // HardwareSerial::operator bool() devuelve siempre true.
  void ottoSerialBegin();
#endif

#if OTTO_DBG
  #define OTTO_DBG_BEGIN()    ottoSerialBegin()
  #define OTTO_DBG_PRINT(x)   do { Serial.print(x); } while(0)
  #define OTTO_DBG_PRINTLN(x) do { Serial.println(x); } while(0)
#else
  #define OTTO_DBG_BEGIN()    do {} while(0)
  #define OTTO_DBG_PRINT(x)   do {} while(0)
  #define OTTO_DBG_PRINTLN(x) do {} while(0)
#endif

#if OTTO_INSTRUMENT
  #define OTTO_INSTR_BEGIN(tag) _instrBegin(F(tag))
  #define OTTO_INSTR_SAMPLE()   _instrSample()
  #define OTTO_INSTR_END()      _instrEnd()
#else
  #define OTTO_INSTR_BEGIN(tag) do {} while(0)
  #define OTTO_INSTR_SAMPLE()   do {} while(0)
  #define OTTO_INSTR_END()      do {} while(0)
#endif

// ===== Codigos de movimiento para el registro (Fase 2a) =====
// El tramo ya se anotaba en EEPROM con un byte "kind" que valia siempre 0.
// Codificar en el la etiqueta del movimiento no cuesta NI UN BYTE mas de EEPROM y
// hace el volcado autoexplicativo: ya no hay que deducir que movimiento era cada
// tramo contando posiciones dentro de la secuencia del sketch.
#define OTTO_K_NONE      0
#define OTTO_K_BOOT      1   // reservado: marca de arranque (ya se usaba asi)
#define OTTO_K_MV        2   // _moveServos / _moveSingle sin etiquetar
#define OTTO_K_HOME_P    3   // home() fase 1: pies al centro (recupera equilibrio)
#define OTTO_K_HOME_C    4   // home() fase 2: caderas al centro
#define OTTO_K_JUMP      5
#define OTTO_K_WALK      6
#define OTTO_K_TURN      7
#define OTTO_K_BEND      8
#define OTTO_K_SHAKE     9
#define OTTO_K_UPDOWN   10
#define OTTO_K_SWING    11
#define OTTO_K_TIPTOE   12
#define OTTO_K_JITTER   13
#define OTTO_K_ASCTURN  14
#define OTTO_K_MOONW    15
#define OTTO_K_CRUSAITO 16
#define OTTO_K_FLAP     17
#define OTTO_K_GESTURE  18
#define OTTO_K_MAX      18

// Etiqueta el PROXIMO tramo que se mida. _instrBegin hace una copia al abrir el
// tramo externo, de modo que un home() anidado dentro de un gesto no le cambia la
// etiqueta al gesto que lo contiene.
// La etiqueta vale para dos cosas distintas, asi que esta siempre activa: para el
// registro (que movimiento era) y, desde la Fase 3d, para que el freno recuerde por
// SEPARADO lo que le costo cada movimiento. Son 2 bytes de RAM.
#define OTTO_INSTR_KIND(k)  do { _instrKind = (uint8_t)(k); } while(0)

// ===== Registro en EEPROM (Fase 1b) =====
// Permite medir la condicion REAL (robot con pilas, sin USB), donde ocurren los
// reinicios y donde no hay puerto serie que leer. Cada tramo de movimiento deja
// su resultado en EEPROM; al reconectar el USB, init() vuelca lo acumulado.
//
// Sobrevive a los reinicios a proposito: en cada arranque se anota una marca de
// tipo "boot", de modo que un reinicio aparece intercalado en la secuencia y se
// puede ver exactamente tras que movimiento ocurrio.
//
// El registro es circular, asi que nunca hay que borrarlo a mano: siempre
// contiene los ultimos OTTO_EEPROM_LOG_SLOTS tramos.
//
// AVISO sobre el coste: una escritura de EEPROM tarda ~3.3 ms por byte, asi que
// anotar un tramo cuesta hasta ~45 ms. Esa escritura ocurre DESPUES de que el
// tramo haya terminado, por lo que dur/vmin/sag del tramo siguen siendo validos;
// lo que se alarga es la separacion entre tramos.
#ifndef OTTO_EEPROM_LOG
  #define OTTO_EEPROM_LOG OTTO_INSTRUMENT
#endif

// Primer byte de EEPROM que usa el registro. OJO: los bytes 0..3 los usa
// saveTrimsOnEEPROM() para la calibracion de los servos, no se pueden pisar.
#ifndef OTTO_EEPROM_LOG_BASE
  #define OTTO_EEPROM_LOG_BASE 16
#endif

// Numero de tramos que caben. Cada uno ocupa 10 bytes y la cabecera 10 mas, asi
// que 90 tramos usan 916 bytes de los 1024 del ATmega328P.
#ifndef OTTO_EEPROM_LOG_SLOTS
  #define OTTO_EEPROM_LOG_SLOTS 90
#endif

// ===== Default limiter config =====
#ifndef OTTO_LIMITER_DEFAULT_ON
  #define OTTO_LIMITER_DEFAULT_ON 1   // 1=enable SetLimiter() in init()
#endif

#ifndef OTTO_DIFF_LIMIT_DEFAULT
  // OJO con las unidades: el comentario original decia "degrees per refresh", pero
  // Oscillator::write() lo aplica como grados/segundo. Con 3 deg/s y periodos de
  // 10..40 ms la division entera da 0 y el max(1,...) lo convierte en "1 grado por
  // llamada". Es decir: hoy el limitador NO limita por tiempo, limita por numero de
  // llamadas. _moveServos (Fase 2b) se apoya en eso de forma explicita; corregirlo
  // de verdad es la Fase 4, y no se puede hacer antes de tener el freno puesto.
  #define OTTO_DIFF_LIMIT_DEFAULT 3   // se aplica como grados/segundo (ver nota)
#endif

// ===== Presupuesto de velocidad agregada de _moveServos (Fase 2b) =====
// Techo para la SUMA de las velocidades angulares comandadas a los 4 servos, en
// grados/segundo. Es el presupuesto de corriente expresado en la unidad que si
// podemos controlar desde el software.
//
// Por que existe: el _moveServos original repartia el movimiento en round-robin (un
// servo cada 10 ms, o sea 25 deg/s por servo) y, cuando ese ritmo no alcanzaba el
// objetivo dentro del tiempo pedido, entraba un bucle de ajuste final que comandaba
// los CUATRO servos cada 10 ms, o sea 400 deg/s agregados. Reptaba y luego
// esprintaba con todo a la vez: justo el pico que el round-robin pretendia evitar.
// Medido con pilas (Fase 1b): esos finales son 7 de las 10 caidas mas profundas del
// registro, con un minimo de 3077 mV, muy por debajo de los 3780 que el 328P
// necesita a 16 MHz.
//
// Con un techo agregado el reparto entre servos deja de importar para el consumo, y
// por eso home() puede permitirse mover los pies primero y las caderas despues SIN
// que la duracion total crezca.
//
// 150 deg/s es la envolvente pesimista de la Fase 1b. La Fase 4 lo hara dinamico
// segun cuantos servos participen; de momento es el mismo valor para todos.
#ifndef OTTO_AGG_RATE_DEFAULT
  #define OTTO_AGG_RATE_DEFAULT 150
#endif

// Periodo del lazo de interpolacion, en ms. El ISR de la libreria Servo regenera los
// pulsos cada ~20 ms, asi que bajar de 10 no aporta suavidad: solo gasta CPU.
#ifndef OTTO_MV_TICK_MS
  #define OTTO_MV_TICK_MS 10
#endif

// Fraccion del recorrido, en %, que se dedica a acelerar (y otro tanto a frenar).
// Perfil trapezoidal: elimina el escalon de velocidad en el arranque y en la parada
// a cambio de un pico de solo 1/(1-2*15%) = 1.18 veces la velocidad media.
// 0 = perfil lineal, el comportamiento clasico.
#ifndef OTTO_MV_RAMP_PCT
  #define OTTO_MV_RAMP_PCT 15
#endif

// Tiempo que home() PIDE para volver al centro. El techo agregado decide el real, asi
// que pedir menos no significa consumir mas: significa no quedarse mas tiempo del
// necesario en una pose descompensada, que es lo que de verdad cuesta corriente.
// Antes estaba fijo en 1000 ms y en la practica tardaba 1176.
#ifndef OTTO_HOME_T
  #define OTTO_HOME_T 600
#endif

// ===== Lazo cerrado de tension (Fase 3) =====
// Mide el rail MIENTRAS se mueve y modula el ritmo en tiempo real.
//
// Trabaja con la CAIDA RELATIVA respecto al inicio del tramo, no con el valor
// absoluto de Vcc. Motivo: la referencia interna de banda prohibida varia entre 1.0
// y 1.2 V de una unidad a otra, asi que el Vcc absoluto arrastra hasta un +-10% de
// error (unos 470 mV), pero ese error se CANCELA al restar dos lecturas. La caida
// es precisa sin calibrar nada con un multimetro.
//
// Por que hace falta, si la Fase 2b ya puso un techo: porque el techo es un numero
// fijo y lo medido dice que el coste no depende solo de la velocidad. En las
// sacudidas de shakeLeg, con el MISMO recorrido (60 grados), la MISMA velocidad
// (149 deg/s) y poses de destino identicas en valor absoluto, subir la pata costo
// 1096-1177 mV de caida y bajarla 87-372 mV: hasta el triple segun el SENTIDO del
// movimiento. Y no hay forma de distinguir esos dos casos mirando la pose: la suma
// de |objetivo - 90| es 62 en ambos. Solo se puede medir.
#ifndef OTTO_BRAKE
  #define OTTO_BRAKE 1
#endif

// Periodo de muestreo del freno, en ms. Cada muestra cuesta ~0.4 ms de ADC.
#ifndef OTTO_BRAKE_SAMPLE_MS
  #define OTTO_BRAKE_SAMPLE_MS 10
#endif

// Caida, en mV, por debajo de la cual no se frena nada. Medido: los tramos sanos de
// la pasada con pilas se mueven entre 100 y 400 mV.
#ifndef OTTO_BRAKE_SAG_OK
  #define OTTO_BRAKE_SAG_OK 650
#endif

// Caida, en mV, a partir de la cual se frena todo lo posible. Medido: con vbefore
// tipico de 4650 mV, pasar de ~750 mV es quedarse por debajo del objetivo de 3900.
#ifndef OTTO_BRAKE_SAG_MAX
  #define OTTO_BRAKE_SAG_MAX 1100
#endif

// Ritmo minimo al que se permite caer, en % del nominal. No baja a cero a proposito:
// un servo parado a mitad de una pose descompensada sigue consumiendo, y ademas el
// robot se caeria.
#ifndef OTTO_BRAKE_GAIN_MIN
  #define OTTO_BRAKE_GAIN_MIN 35
#endif

// Tension objetivo, en mV. Desde la Fase 3c esta es la ley PRINCIPAL del lazo, no un
// respaldo, y el cambio lo obligaron los datos: con las tres pasadas con pilas
// delante, la caida relativa NO SEPARA los tramos sanos de los que incumplen. Los
// siete incumplimientos tenian caidas de 676 a 1029 mV y los sanos llegaban a 821:
// solapan de 676 a 821 y ningun umbral de caida los distingue. El margen a esta
// tension los separa por construccion, porque es justo la magnitud que importa.
//
// El precio es que este si es el parametro sensible a la calibracion de la banda
// prohibida del chip (+-10% entre unidades), asi que en OTRA placa habria que
// ajustarlo con OTTO_VCC_BANDGAP_MV. En esta esta validado: los reinicios observados
// caen entre 3200 y 3800 en estas unidades, coherente con los 3780 que pide el
// ATmega328P a 16 MHz, asi que 3900 deja margen de verdad.
#ifndef OTTO_BRAKE_VMIN_ABS
  #define OTTO_BRAKE_VMIN_ABS 3900
#endif

// Con cuanta antelacion, en mV de margen, se empieza a frenar. Barrido sobre los 87
// tramos de la pasada de la Fase 3b: con 300 mV se frenan los 7 que incumplen y 21
// sanos de mas; con 600 se frenarian 68 sanos sin ganar nada. La ley de caida que
// habia frenaba 34 tramos, 27 de ellos sanos, y la semilla encallada anadia otros 49.
#ifndef OTTO_BRAKE_MARGIN_BAND
  #define OTTO_BRAKE_MARGIN_BAND 300
#endif

// Puntos que recupera la memoria POR MOVIMIENTO cada vez que ese movimiento se
// ejecuta (Fase 3d). Lo que hemos aprendido de que `bend` o `shakeLeg` son caros no
// se debe tirar deprisa: con 10 puntos, un gesto que tuvo que bajar al suelo tarda
// siete ejecuciones en volver a ritmo libre, y mientras tanto va probando.
//
// Sustituye al OTTO_BRAKE_RECOVER de las fases 3 a 3c, que concedia ese margen sobre
// el ritmo ARRASTRADO del gesto anterior. Aquello penalizaba a los gestos sanos que
// venian detras de uno caro, y los datos dicen que el arrastre no informa: la tension
// en reposo antes de mover es la misma en los tramos sanos y en los que incumplen.
#ifndef OTTO_BRAKE_KIND_RECOVER
  #define OTTO_BRAKE_KIND_RECOVER 10
#endif

// Cuanto como mucho se puede estirar un movimiento, sea el periodo de una marcha o
// la ventana de _moveServos. Es el tope de AUTORIDAD del freno: le pone precio
// maximo a la seguridad para que un gesto no se eternice. Si el registro muestra
// tramos que tocan el tope, el problema ya no lo puede arreglar frenar.
#ifndef OTTO_BRAKE_T_MAX_X
  #define OTTO_BRAKE_T_MAX_X 2
#endif

// Puntos de ritmo que se recuperan por muestra al soltar el freno (Fase 3b).
//
// Esto es lo que le da AUTORIDAD al lazo, y en la Fase 3 estaba mal. Alli la vuelta
// era geometrica -(3*cur+obj)/4 por muestra-, que recupera el 90% del camino en unos
// 80 ms. Las caidas durante una marcha son picos de par en cada apoyo, asi que cada
// pico se castigaba 80 ms de los 1000 ms del paso: el ritmo MEDIO se quedaba en el
// 94% y el freno no frenaba, aunque el minimo registrado marcase 35. Medido en la
// pasada con pilas del 2026-11-11: 90-96% de ritmo medio en las catorce marchas.
//
// Con vuelta LINEAL de 1 punto por muestra de 10 ms, ir de 35 a 100 cuesta 650 ms, el
// orden de magnitud de un paso. Ahi el freno si gobierna el ritmo medio.
#ifndef OTTO_BRAKE_RELEASE_STEP
  #define OTTO_BRAKE_RELEASE_STEP 1
#endif

// Reparto en el tiempo del engranche de los cuatro servos, en ms (Fase 3b).
//
// Oscillator::attach() hace `_pos = 90` SIN MIRAR donde esta el servo, y Servo::attach
// empieza a emitir 1500 us (90 grados) de inmediato. Asi que al arrancar tras un
// reinicio a mitad de un gesto, las patas estan descentradas, init() engancha los
// cuatro a la vez y los cuatro se van a 90 al par maximo. Ni el limitador ni el freno
// ven nada, porque para el software el recorrido es CERO.
//
// Eso convierte UN reinicio en una cadena de reinicios. En la pasada con pilas del
// 2026-11-11 hubo 12 lineas ARRANQUE en 5 grupos: solo 4 eran la causa real, las
// otras 8 eran este bucle. Escalonar el engranche reparte la punta de corriente entre
// cuatro instantes en vez de uno. Solo se aplica en init(), que es el unico sitio
// donde la posicion real puede estar lejos de 90; cuesta 600 ms una vez al arrancar.
// Subido de 200 a 300 en la Fase 3c: con 200 ms el escalonado bajo las cadenas de
// reinicios de hasta 4 eslabones a 2, pero no las elimino. 300 ms cubre con holgura
// un salto de 90 grados de un SG90 bajo carga. Cuesta 900 ms una vez al arrancar.
#ifndef OTTO_ATTACH_STAGGER_MS
  #define OTTO_ATTACH_STAGGER_MS 300
#endif

// FASE 4a -- el freno solo manda donde hay velocidad que quitar.
//
// t_cap es el tiempo que exige el presupuesto agregado de velocidad; t_eff es el
// que se va a usar de verdad. Su cociente es la CARGA del tramo: el porcentaje del
// presupuesto que realmente consume. Si el llamante pidio mas tiempo del que el
// presupuesto exige, el tramo ya va lento y lo que domina su consumo es el PAR de
// sostener la pose, no la velocidad: frenarlo no quita corriente, solo alarga la
// exposicion. Es el mecanismo medido en flapping y en home().
//
// Medido en la pasada del 2026-11-12 13:22 (pilas de ~75 minutos): el freno se
// gastaba el presupuesto en tramos de home() de 16 a 30 grados de recorrido,
// estirandolos entre x1.5 y x1.8 -y saliendo igualmente por debajo de 3900-, y por
// primera vez freno tambien jump, que manda los dos pies a los extremos y los
// sostiene. Con 70% se quedan fuera exactamente esos dos casos (home con poco
// recorrido, y jump) y siguen dentro peor_caso, bend, shakeLeg y home con recorrido
// completo, que si van al tope del presupuesto.
//
// 0 lo desactiva (todo frenable, como hasta la 3e).
#ifndef OTTO_BRAKE_MIN_LOAD_PCT
  #define OTTO_BRAKE_MIN_LOAD_PCT 70
#endif

// FASE 4b -- lo que cuesta es cuantos grados se mueven A LA VEZ.
//
// Medido el 2026-11-12 14:10. Se comparo volver de 50 grados de inclinacion de
// cuatro formas, todas recorriendo los MISMOS 100 grados agregados:
//
//   modo 1  los dos tobillos, 100 de golpe (lo que hace home)  peor vmin 3805-3938
//   modo 2  los dos tobillos, en dos tramos de 50              peor vmin 4141
//   modo 3  un tobillo y luego el otro, 50 cada uno            peor vmin 3754-3911
//   modo 4  los dos juntos, a mitad de velocidad               peor vmin 4250
//
// El modo 2 gana a el modo 1 por 336 mV en el peor caso, con la MISMA velocidad
// agregada, los MISMOS dos motores y el MISMO recorrido total. Lo unico que cambia
// es cuanto se recorre de una vez. Y encima sale mas rapido (895-904 ms frente a
// 944-984) porque necesita menos freno. Repetido en dos tandas.
//
// El modo 3 es el PEOR: mover un tobillo dejando el otro a 50 grados deja el cuerpo
// torcido a mitad de camino. Queda refutado que importe el numero de motores.
//
// El modo 4 es el mas barato en el registro, pero EL ROBOT SE CAE: a mitad de
// velocidad pasa el doble de tiempo descompensado y la gravedad le gana. Observado
// en el robot, no en el log. Y por eso FRENAR la vuelta no es la solucion: frenar es
// exactamente el modo 4. Esto explica que el freno a fondo (g=35) no arreglara nunca
// los home() mas caros.
//
// Asi que: trocear el recorrido, a la misma velocidad. Solo se trocea cuando el
// tramo va al tope del presupuesto de velocidad (la misma condicion que la 4a), para
// no partir en trozos gestos deliberadamente lentos como jump, donde la continuidad
// del movimiento es lo que se ve.
//
// RESULTADO DEL A/B EN LA SECUENCIA REAL (2026-11-12 16:04, mismas pilas, 17
// minutos de separacion, 8 repeticiones troceadas frente a 4 sin trocear):
//
//   tramo       dur A / B    sag A / B   dif      peor vmin A / B   dif
//   peor_caso   946 / 934    494 / 558   -64 mV   4141 / 4022      +119 mV
//   home:pies   548 / 545    634 / 721   -87 mV   4156 / 4051      +105 mV
//   home:cad    479 / 510    644 / 642    +3 mV   3938 / 3897       +41 mV
//
// Cinco comparaciones a favor, una empate, ninguna en contra: la direccion es
// consistente. Pero con el ruido medido de 116 mV entre repeticiones, esas
// diferencias son de 0.9 a 1.2 sigma, o sea NO SIGNIFICATIVAS. **No son los 336 mV
// que dio el experimento de poses.** Alli el movimiento eran 100 grados de tobillo
// desde una inclinacion de 50 grados; aqui son 80 desde una pose menos extrema, y
// home:cad son CADERAS, que el experimento no probo.
//
// Se mantiene porque es GRATIS -la duracion sale igual, 946 frente a 934 ms- y
// porque el signo es consistente. No porque este demostrado.
//
// 0 lo desactiva (un solo tramo, como hasta la 4a).
#ifndef OTTO_MV_TRV_CHUNK
  #define OTTO_MV_TRV_CHUNK 50
#endif

// FASE 5d -- acotar T en las MARCHAS al minimo con el que se ve la zancada.
//
// Las marchas van por oscillateServos, que NO pasa por el techo agregado de
// _moveServos: su limite es el de Oscillator, un grado por llamada. Medido el
// 2026-11-12 en tres barridos y quince puntos, cada servo se clava en 46-48
// grados/s sea cual sea el periodo y sea cual sea la marcha. OTTO_OSC_RATE es ese
// numero y es el unico parametro fisico de esta fase.
//
// Por debajo de cierto T el servo no puede seguir la senoidal, el recorte la
// convierte en triangulo, se pierde el desfase cadera-pie de -90 grados -que es lo
// que convierte el balanceo en paso- y lo que sale es un temblor. Ahora se entrega
// el periodo mas corto con el que la zancada todavia se ve, igual que _moveServos
// entrega t_cap cuando le piden ir mas rapido de lo que puede.
//
// LA REGLA: T_min = OTTO_GAIT_T_PER_DEG milisegundos por grado de la amplitud MAYOR.
// Y el numero sale de una medida con metro, no de una estimacion. Siete periodos
// sobre walk, cada uno corriendo ~6 s:
//
//   T      cm   cm/s   % onda   vmin   aspecto
//   2000   15   2.37     87%    3818   camina   <- el PEOR en tension, y el que mas desvia
//   1500   14   2.24     70%    4081   camina   <- EL OPTIMO
//   1250   11   2.10     59%    3911   camina
//   1100   12   2.05     52%    3966   camina
//    950   12   1.96     45%    3966   camina
//    800   13   2.21     38%    3938   ROZA
//
// walk tiene A_max=30 y su mejor T medido fue 1500, luego 1500/30 = 50 ms/grado.
// El criterio resulta UNIFORME: 59% de fidelidad del servo de mayor amplitud, sea
// cual sea el numero de servos que mueva la marcha. Es la fisica correcta, porque
// el limitador es POR SERVO.
//
// Suelos que resultan: walk y turn 1500 ms; swing, updown, tiptoe, jitter, moonwalk,
// crusaito y flapping 1250; ascendingTurn 650. Y como depende de la AMPLITUD, el
// desplegable de tamano es una palanca real: con tamano "Pequeno" (10) el suelo baja
// a 500 ms. Si quieres gestos rapidos, baja la amplitud, no el periodo.
//
// Acotar NO cuesta avance: los cm/s medidos son planos (2.15 +-9%, por debajo del
// +-17% de medir a mano) de 800 a 2000 ms, porque con los servos al tope
// zancada x cadencia es constante. T=1500 dio incluso algo mas (2.24) que T=1000
// (2.05), con zancadas mayores y la mejor tension de todo el barrido.
//
// El juego de bloques espanol (1500 / 2000 / 3500) NO se ve afectado en absoluto.
// Esto solo actua sobre las opciones de 250, 500, 750 y 1000 de otros idiomas.
//
// Se ve en el registro: si un bloque pide 250 y dur sale en ~1500 por ciclo, el
// acotado actuo. Verificado en la pasada del 18:06 con el umbral anterior: turn y
// swing salieron a 790 y 971 ms frente a los 787 y 968 calculados.
//
// 0 lo desactiva (el periodo se pasa tal cual, como hasta la 5b).
#ifndef OTTO_GAIT_T_PER_DEG
  #define OTTO_GAIT_T_PER_DEG 50
#endif

// ===== shakeLeg: cuanto cruza el centro el pie libre (grados) =====
// El gesto de Otto DIY manda el pie que deberia aletear al OTRO lado del centro
// (RR=120, o sea +30 grados). La suela vuelve al suelo y la inclinacion se
// cancela. Parece un error y NO LO ES: es lo que mantiene el robot en pie. La
// Fase 5e lo quito -pie libre siempre en el aire- y el robot se cayo las ocho
// veces, con tres brownouts. Ver el comentario largo dentro de shakeLeg().
//
// Pero el calado SI es real y SI es lo que cuesta: con el mismo recorrido de 60
// grados, los pasos que van HACIA esa pose promedian 961 mV de caida (n=24) y
// los que se alejan 552 mV (n=16). La direccion importa, el recorrido no.
//
// De ahi la hipotesis que queda por medir: ABLANDAR el cruce en vez de
// eliminarlo. A 15 grados el pie sigue bajando y sosteniendo -que es lo que
// impide la caida- pero empuja contra el suelo la mitad.
//
//   30 = el original de Otto DIY (RR=120). ES EL VALOR QUE SE ENTREGA.
//   15 = la hipotesis (RR=105). MEDIDA Y DESCARTADA, ver abajo.
//    0 = el pie se queda en el centro. NO USAR: se acerca a la 5e, que tiro el robot.
//
// Roll compuesto de la pose intermedia, con el apoyo en 55:
//   30 grados -> roll  -2.5   (la inclinacion se cancela del todo)
//   15 grados -> roll -10.0   (conserva algo mas de inclinacion)
//
// RESULTADO DE MEDIR LA HIPOTESIS (fase 5g, 8 llamadas por configuracion):
//
//                                   cruce=30   cruce=15
//   ratio hacia/alejandose            1.62       0.89     <- ACERTO
//   pasos con caida > 1000 mV           11          2     <- ACERTO
//   caida sumada del gesto (mV)       4961       4118       -17%
//   recorrido del gesto (grados)       480        390       -19%
//   CAIDA POR GRADO (mV/grado)       10.34      10.56       +2%  <- SIN GANANCIA
//   paso 7, volver a casa (mV)         395        785       +99%  <- EMPEORO
//   peor vmin de la pasada (mV)       3274       2995       el peor del proyecto
//
// La hipotesis acerto en su mecanismo: el ratio 0.89 dice que la asimetria de
// direccion -el calado contra el suelo- desaparecio. Pero el -17% de caida se
// explica ENTERO por el -19% de recorrido: por grado no cambia nada. No abarata
// el gesto, lo hace mas pequeno.
//
// Y el coste se MUDO al regreso a casa, duplicandolo. El motivo encaja con lo ya
// medido: con cruce=15 el robot sigue INCLINADO todo el gesto (roll -10), asi que
// home() tiene que levantar el cuerpo desde la inclinacion, y volver al centro
// cuesta 8.5-10.7 mV/grado frente a 3.8 yendo hacia fuera. Con cruce=30 la pose
// intermedia deja el robot NIVELADO y el regreso parte de equilibrio.
//
// CONCLUSION: la pose "rota" de Otto DIY hace DOS trabajos. Mantiene el robot en
// pie -lo probo la 5e, que al quitarlo lo tiro 8 de 8 veces- y LO DEJA NIVELADO
// ANTES DEL REGRESO -lo prueba esta medida-. Se vuelve a 30. Con los dos valores
// el robot aguanta sin caerse, asi que si alguna vez se prefiere el aspecto de
// cruce=15, el dato dice que electricamente es un empate: decide la estetica.
#ifndef OTTO_SHAKE_CROSS_DEG
  #define OTTO_SHAKE_CROSS_DEG 30
#endif
#ifndef OTTO_OSC_RATE
  #define OTTO_OSC_RATE 47
#endif

#if OTTO_BRAKE
  #define OTTO_BRAKE_BEGIN()  _brakeBegin()
  #define OTTO_BRAKE_IDLE()   _brakeIdle()
  #define OTTO_BRAKE_GAIN()   _brakeGain()
  #define OTTO_BRAKE_WORST()  _brakeWorst
  #define OTTO_BRAKE_MEAN()   _brakeMean()
#else
  //-- Sin freno compilado nadie mas consume la etiqueta, asi que la consumen estos.
  #define OTTO_BRAKE_BEGIN()  do { _instrKind = (uint8_t)OTTO_K_MV; } while(0)
  #define OTTO_BRAKE_IDLE()   do { _instrKind = (uint8_t)OTTO_K_MV; } while(0)
  #define OTTO_BRAKE_GAIN()   100
  #define OTTO_BRAKE_WORST()  100
  #define OTTO_BRAKE_MEAN()   100
#endif


//-- Constants
#define FORWARD     1
#define BACKWARD    -1
#define LEFT        1
#define RIGHT       -1
#define SMALL       10
#define MEDIUM      15
#define BIG         25

// -- Servo delta limit default. degree / sec
#define SERVO_LIMIT_DEFAULT 240

class Otto
{
  public:

    //-- Otto initialization
    void init(int YL, int YR, int RL, int RR, bool load_calibration, int Buzzer);
    //-- Attach & detach functions
    void attachServos();
    void detachServos();

    //-- Oscillator Trims
    void setTrims(int YL, int YR, int RL, int RR);
    void saveTrimsOnEEPROM();

    //-- Predetermined Motion Functions
    void _moveServos(int time, int  servo_target[]);
    void _moveSingle(int position,int  servo_number);
    void oscillateServos(int A[4], int O[4], int T, double phase_diff[4], float cycle);

    //-- HOME = Otto at rest position
    void home();
    bool getRestState();
    void setRestState(bool state);

    //-- Predetermined Motion Functions
    void jump(float steps=1, int T = 2000);

    void walk(float steps=4, int T=1000, int dir = FORWARD);
    void turn(float steps=4, int T=2000, int dir = LEFT);
    void bend (int steps=1, int T=1400, int dir=LEFT);
    void shakeLeg (int steps=1, int T = 2000, int dir=RIGHT);

    void updown(float steps=1, int T=1000, int h = 20);
    void swing(float steps=1, int T=1000, int h=20);
    void tiptoeSwing(float steps=1, int T=900, int h=20);
    void jitter(float steps=1, int T=500, int h=20);
    void ascendingTurn(float steps=1, int T=900, int h=20);

    void moonwalker(float steps=1, int T=900, int h=20, int dir=LEFT);
    void crusaito(float steps=1, int T=900, int h=20, int dir=FORWARD);
    void flapping(float steps=1, int T=1000, int h=20, int dir=FORWARD);

    //-- Mouth & Animations
    void putMouth(unsigned long int mouth, bool predefined = true);
    void putAnimationMouth(unsigned long int anim, int index);
    void clearMouth();

    //-- Sounds
    void _tone (float noteFrequency, long noteDuration, int silentDuration);
    void bendTones (float initFrequency, float finalFrequency, float prop, long noteDuration, int silentDuration);
    void sing(int songName);

    //-- Gestures
    void playGesture(int gesture);
    void initMATRIX(int DIN, int CS, int CLK, int rotate);
    void matrixIntensity(int intensity);
    void setLed(byte X, byte Y, byte value);
    void writeText (const char * s, byte scrollspeed);

    // -- Servo limiter
    void enableServoLimit(int speed_limit_degree_per_sec = SERVO_LIMIT_DEFAULT);
    void disableServoLimit();

  private:

    Oscillator servo[4];
    Otto_Matrix ledmatrix;
    int servo_pins[4];
    int servo_trim[4];

    int pinBuzzer;

    unsigned long final_time;
    unsigned long partial_time;
    //-- increment[] desaparecio con la reescritura de _moveServos (Fase 2b):
    //-- la trayectoria se calcula ahora en enteros, sin coma flotante.
    //-- Guarda de recursion del troceado de la Fase 4b: garantiza UN solo nivel.
    uint8_t  _mvSplit;
    //-- En cuantos trozos se partio el movimiento. Lo pone _moveServos y lo consume
    //-- _instrEnd, que lo devuelve a 1. Sin esto el troceado era INVISIBLE en el
    //-- registro -misma duracion y mismo recorrido que sin trocear-, o sea un cambio
    //-- imposible de comprobar desde los datos.
    uint8_t  _mvChunks;
    uint16_t _aggRate;   // techo de velocidad angular agregada, grados/s

    //-- Etiqueta del movimiento. Siempre presente: la usan el registro y el freno.
    uint8_t  _instrKind;   // etiqueta pendiente para el proximo tramo
    uint8_t  _segKind;     // copia tomada al abrir el tramo externo

#if OTTO_BRAKE
    //-- Estado del lazo cerrado (Fase 3). Todo en % del ritmo nominal.
    uint16_t _brakeRef;      // rail al abrir el tramo, mV (referencia de la caida)
    unsigned long _brakeLastMs;
    uint8_t  _brakeGainCur;  // ritmo permitido ahora mismo
    uint8_t  _brakeWorst;    // peor ritmo del tramo entero (va al registro)
    //-- Promedio del tramo (Fase 3b). El minimo solo dice si el freno LLEGO a actuar;
    //-- el promedio dice si gobierno el ritmo. Sin el, la Fase 3 parecio funcionar.
    uint32_t _brakeSum;
    uint16_t _brakeN;
    //-- Memoria POR MOVIMIENTO (Fase 3d). La prevencion tiene que ser dirigida: la
    //-- 3b frenaba de entrada TODOS los gestos (un trinquete, que era un fallo) y la
    //-- 3c no frenaba de entrada NINGUNO, con lo que los gestos caros perdieron la
    //-- proteccion que el fallo les daba sin querer. Aqui cada movimiento recuerda su
    //-- propio coste, asi que updown corre libre y bend arranca ya frenado.
    uint8_t _brakeKind;
    uint8_t _brakeKindGain[OTTO_K_MAX + 1];

    void    _brakeBegin();
    //-- Tramo SIN recorrido (trvTotal == 0). Medido en la pasada de la Fase 3d: el
    //-- atajo de _moveServos para estos tramos salia antes de _brakeBegin(), con dos
    //-- consecuencias. (1) La etiqueta no se consumia y se FILTRABA al siguiente
    //-- gesto, que cargaba su coste en la casilla equivocada de la tabla. (2) Los
    //-- acumuladores no se reiniciaban, asi que el registro publicaba el g=/gm= del
    //-- tramo ANTERIOR como si fuera de este. No toca _brakeKindGain: un tramo que no
    //-- mueve nada no es evidencia ni a favor ni en contra de ese movimiento.
    void    _brakeIdle();
    uint8_t _brakeGain();
    static uint8_t _brakeObjetivo(uint16_t v, uint16_t ref);
    uint8_t _brakeMean();
#endif

    bool isOttoResting;

    unsigned long int getMouthShape(int number);
    unsigned long int getAnimShape(int anim, int index);
    void _execute(int A[4], int O[4], int T, double phase_diff[4], float steps);

#if OTTO_INSTRUMENT
    //-- Instrumentacion. Solo observa: no participa en el control del movimiento.
    uint8_t       _instrDepth;        // anidamiento, para medir solo el tramo externo
    unsigned long _instrT0;           // marca de inicio del tramo medido
    unsigned long _instrLastMs;       // marca de la ultima muestra
    uint16_t      _vccBefore;         // mV del rail justo antes de mover
    uint16_t      _vccMin;            // mV minimo observado durante el movimiento
    //-- CUANTO TIEMPO estuvo bajo, no solo cuanto bajo. _vccMin es el minimo de una
    //-- sola muestra, asi que una conversion rara del ADC bastaria para explicarlo.
    //-- Estos dos cuentan muestras de OTTO_INSTR_SAMPLE_MS por debajo de cada umbral,
    //-- y asi distinguen un pico instantaneo de un hundimiento sostenido. Se saturan
    //-- en 15, que a 10 ms por muestra son 150 ms: suficiente para decidir.
    uint8_t       _vccLowA;           // muestras por debajo de OTTO_VCC_LOW_A_MV
    uint8_t       _vccLowB;           // muestras por debajo de OTTO_VCC_LOW_B_MV
    int           _instrLastPos[4];   // ultima posicion vista, por servo
    int           _wPeak[4];          // pico de velocidad angular, por servo (grados/s)
    int           _wPeakAgg;          // pico de la suma de |velocidad| de los 4
    long          _degTravel[4];      // grados recorridos acumulados, por servo
    const __FlashStringHelper* _instrTag;

    void _instrBegin(const __FlashStringHelper* tag);
    void _instrSample();
    void _instrEnd();
#endif

#if OTTO_EEPROM_LOG
    //-- Registro circular en EEPROM, para medir con pilas y sin puerto serie.
    void _eepLogInit();                       // valida o crea la cabecera
    void _eepLogDump();                       // vuelca lo acumulado por serie
    void _eepLogAppend(uint8_t kind, uint16_t dur,
                       uint16_t vbefore, uint16_t vmin, uint16_t trvtot,
                       uint8_t gain);
#endif

};

#endif