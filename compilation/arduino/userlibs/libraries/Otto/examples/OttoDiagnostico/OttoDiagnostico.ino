/*
 * OttoDiagnostico -- Fase 1 del trabajo de optimizacion de consumo
 * ---------------------------------------------------------------
 * Recorre los movimientos de la libreria uno por uno y, para cada uno, emite por
 * el puerto serie una linea CSV con:
 *
 *   - la caida real del rail de 5 V (medida por el propio ATmega328P contra su
 *     referencia interna de 1.1 V, sin ningun componente externo),
 *   - el pico de velocidad angular comandada a los servos,
 *   - los grados totales recorridos, como proxy del trabajo mecanico.
 *
 * NO cambia nada del comportamiento del robot: solo lo observa. El objetivo es
 * tener una linea base del estado ACTUAL antes de tocar los algoritmos.
 *
 * COMO USARLO -- PASADA A, POR USB
 *   1. Ajusta los pines de abajo si tu cableado no es el canonico de Otto DIY.
 *   2. Sube el sketch, abre el monitor serie a 115200 baudios.
 *   3. Deja que complete la secuencia (~2 min) y copia TODO el texto.
 *
 *   OJO con lo que mide esta pasada: en un Nano, el 5 V del USB entra al rail por
 *   un diodo Schottky y PUENTEA el regulador, que es justo el componente que
 *   limita cuando se funciona con pilas. Por eso la pasada por USB da caidas de
 *   tension OPTIMISTAS: es una cota inferior del problema, no la condicion real.
 *
 * COMO USARLO -- PASADA B, CON PILAS Y SIN USB (la condicion real)
 *   Aqui no hay puerto serie que leer, asi que cada tramo de movimiento se anota
 *   en la EEPROM y se vuelca mas tarde.
 *   1. Con el sketch ya subido, desconecta el USB.
 *   2. Enciende el robot con sus pilas y dejalo completar la secuencia (~2 min).
 *      Si se reinicia, no importa: el registro sobrevive y lo deja anotado.
 *   3. Apaga las pilas y conecta el USB.
 *   4. Abre el monitor serie a 115200. En el arranque se volcara TODO lo
 *      registrado durante la pasada con pilas, entre las lineas
 *      "OTTO,eep,inicio" y "OTTO,eep,fin". Copialo.
 *   5. Hazlo antes de dejar correr la secuencia por USB otra vez, porque el
 *      registro es circular y acabaria sobreescribiendo lo de las pilas.
 *
 *   Las lineas "OTTO,eep,#N,ARRANQUE" son la clave: si aparece una en MEDIO de la
 *   secuencia, ahi hubo un reinicio. OJO con como se lee: el tramo se anota DESPUES
 *   de terminar, asi que el ultimo anotado es el ultimo que SOBREVIVIO, y el
 *   culpable es el SIGUIENTE, que no llego a anotarse. Con las etiquetas de la
 *   Fase 2a ese siguiente se identifica solo.
 *
 *   El registro usa la EEPROM desde el byte 16 en adelante, asi que no toca los
 *   bytes 0..3 donde se guarda la calibracion de los servos.
 *
 * COMO LEER LA SALIDA
 *   OTTO,boot,vcc=4712,limiter=3,rr_osc=1
 *        vcc      = rail en reposo al arrancar, sin servos enganchados (mV)
 *        limiter  = valor de OTTO_DIFF_LIMIT_DEFAULT activo
 *
 *   Desde la Fase 2a cada tramo lleva su ETIQUETA, tanto por serie como en el
 *   volcado de EEPROM: ya no hay que deducir que movimiento era contando
 *   posiciones. El formato es  OTTO,<motor>/<etiqueta>,...  donde <motor> dice que
 *   rutina lo genero (mv = _moveServos, gait = oscilador, gst = gesto) y <etiqueta>
 *   dice que movimiento era: walk, turn, jump, bend, shakeLeg, flapping,
 *   home:pies, home:cad...  Las dos pruebas que llaman a _moveServos directamente
 *   desde este sketch (hold_90 y peor_caso_4servos) salen como "mv", y se
 *   distinguen entre si por trv: 0 la primera y ~140 la segunda.
 *
 *   OTTO,gait/walk,dur=4210,vbefore=4698,vmin=4102,sag=596,wpk=180,w=50/50/40/40,trv=...
 *        dur      = duracion real del tramo (mV). Comparala con la pedida:
 *                   si dur >> pedida, el limitador esta estrangulando el gesto.
 *        vbefore  = rail justo antes de mover (mV)
 *        vmin     = rail minimo durante el movimiento (mV)  <-- EL DATO CLAVE
 *        sag      = caida = vbefore - vmin (mV)
 *        wpk      = pico de la suma de velocidades de los 4 servos (grados/s)
 *        w        = pico por servo, en orden YL/YR/RL/RR
 *        trv      = grados recorridos por servo, y trvtot el total
 *
 *   La pareja (wpk, sag) es la que permite calibrar cuanta corriente consume el
 *   robot por cada grado/segundo que se le pide, y por tanto fijar el
 *   presupuesto de velocidad que el regulador del Nano SI puede sostener.
 *
 *   Desde la Fase 3 cada tramo lleva dos campos de ritmo del lazo cerrado, en % del
 *   nominal (100 = no hizo falta frenar, 35 = se freno todo lo posible):
 *     g=   el PEOR instante del tramo. Solo dice si el freno LLEGO a actuar.
 *     gm=  el PROMEDIO del tramo (nuevo en la Fase 3b). Es el que dice si el freno
 *          GOBERNO el ritmo, y el unico comparable con (dur real / dur pedida).
 *
 *   La diferencia entre los dos no es un detalle: en la pasada con pilas de la Fase 3
 *   habia catorce marchas con g=35 y aun asi la duracion solo subia un 5%, porque el
 *   promedio real era del 94%. El freno reaccionaba y se soltaba antes de servir de
 *   nada. Guardar solo el minimo escondia el fallo. Si g y gm estan muy separados,
 *   el freno esta pellizcando picos sin cambiar el ritmo; si van juntos, gobierna.
 *   Los dos van empaquetados a 4 bits en el byte que ya existia, en pasos de 7
 *   puntos, asi que no gastan EEPROM extra (100 se lee como 98).
 *
 * QUE ESPERAR TRAS LA FASE 2b
 *   Los gestos duran MENOS que antes (entre un 23% y un 53%) porque ha desaparecido
 *   el bucle de ajuste final que estiraba cada movimiento. La excepcion es
 *   peor_caso_4servos, que pasa de 704 a ~930 ms: pedia 350 deg/s agregados y ahora
 *   el techo lo baja a 150, que es justamente de lo que se trata.
 *   El dato a vigilar sigue siendo vmin: el objetivo es que ningun tramo baje de
 *   3900 mV. En la pasada anterior con pilas lo incumplian 11 tramos de 83, con un
 *   minimo de 3077 mV en el home() posterior a flapping.
 *
 * QUE SE MIDIO, Y COMO FUE CAMBIANDO EL DISENO
 *   Cinco pasadas con pilas. Cada una corrigio a la anterior, y conviene leerlas
 *   juntas porque el error de cada fase es la leccion de la siguiente.
 *
 *   Fase 3 -> 3b. El freno reaccionaba pero no gobernaba: las marchas corrian al
 *   90-96% de su ritmo nominal pese a registrar g=35, porque la ley de soltado era
 *   geometrica y recuperaba el 90% del camino en 80 ms. Se hizo lineal. Y se descubrio
 *   un amplificador de reinicios: Oscillator::attach() fija _pos=90 sin mirar donde
 *   esta el servo, asi que al arrancar tras un reinicio los cuatro se van a 90 al par
 *   maximo con recorrido CERO para el software. De 12 lineas ARRANQUE, 8 eran esa
 *   cadena. Se escalono el engranche de init().
 *
 *   Fase 3b -> 3c. La semilla del freno era un TRINQUETE (solo sabia bajar), asi que
 *   tras el primer frenazo TODOS los gestos siguientes arrancaban al 60% para
 *   siempre: g=56 en 70 de 87 tramos, 61 de ellos sin ningun problema. Y la caida
 *   relativa, que era la ley principal, NO SEPARA los casos: los incumplidores caian
 *   entre 676 y 1029 mV y habia tramos SANOS cayendo 821. La ley principal paso al
 *   margen a la tension objetivo, que los separa por construccion.
 *
 *   Fase 3c -> 3d. La 3c consiguio lo que importaba -una secuencia completa con pilas
 *   y CERO reinicios- y libero los gestos sanos (27 de 31 tramos holgados a gm=98,
 *   frente a 4 de 59 en la 3b). Pero al quitar el trinquete dejo sin proteccion justo
 *   a los gestos caros: bend -296 mV, home:cad -285, shakeLeg -192. El trinquete era
 *   un fallo, pero estaba haciendo PREVENCION POR ACCIDENTE.
 *
 *   La 3d la hace dirigida: cada movimiento recuerda su propio coste en una tabla de
 *   19 bytes indexada por su etiqueta. updown corre libre y bend arranca ya frenado.
 *   Hace falta porque el lazo es reactivo -no puede evitar la caida que mide, solo
 *   responder a ella- y en la 3c habia siete tramos con vmin bajo y gm alto, que es
 *   la firma exacta del freno llegando tarde.
 *
 *   Es la tercera vez en este trabajo que un FALLO estaba haciendo trabajo util: el
 *   limitador roto de la Fase 1 servia de presupuesto de velocidad, y el trinquete de
 *   la 3b servia de prevencion. Conviene medir antes de quitar nada.
 *
 *   DONDE ESTA EL TECHO. De los 9 tramos que incumplen en la 3c, 6 tenian ya el freno
 *   a fondo (gm<=70). Frenar no les saca mas: en la 3b arrancaban al 60% y se quedaban
 *   en 3805-3897 mV. Es decir, la Fase 3 esta practicamente en su limite y los
 *   ultimos 200-400 mV no son problema de velocidad sino de PAR. Eso es la Fase 4.
 *
 *   OJO CON EL RUIDO. Dentro de una misma pasada, el mismo movimiento con los mismos
 *   parametros da caidas que difieren 116 mV de forma tipica, y updown llego a 226 mV.
 *   Ninguna diferencia por debajo de eso es interpretable con una sola muestra.
 *
 *   OJO TAMBIEN con vmin: la instrumentacion y el freno leen el ADC por separado, cada
 *   uno cada 10 ms pero en fases distintas, asi que el vmin del registro no es
 *   necesariamente el minimo que vio el freno. Por eso hay tramos con vmin comodo y
 *   g=35: el freno cogio un bache que el registro no.
 *
 *   Lo que hay que mirar, en este orden:
 *     1. Que NO aparezca ningun ARRANQUE en medio. Contar GRUPOS, no lineas, y no
 *        confundir el cambio USB<->pilas con un fallo.
 *     2. Que ningun tramo tenga vmin por debajo de 3900.
 *     3. Que los gestos SANOS sigan con gm=98 y que los CAROS arranquen ya frenados.
 *        La tabla por movimiento tarda unas pocas secuencias en aprender, asi que en
 *        la primera vuelta del loop() todavia arrancan libres: comparar la primera
 *        vuelta con la segunda es justo la prueba de que la tabla funciona.
 *     4. Los tramos con gm bajo cuyo vmin NO mejora son los de par estatico: Fase 4.
 *
 * RESULTADO DEL TEST DE VELOCIDAD (2026-11-12 17:05, fase 5a, pilas frescas)
 *
 *   CERO REINICIOS en todo el barrido T=3500/2000/1000/750/250, peor vmin 3966.
 *   Todo el rango de velocidades que ofrecen los bloques se queda por encima de
 *   3900 mV: LA ELECTRONICA YA NO ES EL LIMITE. Lo que limita es la cinematica.
 *
 *   EL TECHO ES POR SERVO, ~47 grados/s, NO AGREGADO. Medido clavado en 46-48
 *   grados/s por servo en los cinco periodos y los tres movimientos. Es el
 *   limitador de Oscillator (1 grado por llamada); el presupuesto agregado de
 *   _moveServos solo gobierna los GESTOS, no las marchas. Correccion: yo lo habia
 *   supuesto agregado, y por eso mis predicciones para swing/updown/tiptoe -que
 *   solo mueven dos servos- salian al doble de lo real.
 *
 *   MODELO VALIDADO: recorrido real por ciclo = suma servo por servo de
 *   min(4*A[i], 47*T). Ajusta los 15 puntos medidos con error del 1 al 13%.
 *
 *              T=3500  2000  1000   750   250
 *     walk       101%   89%   51%   37%   13%
 *     turn       102%   95%   60%   46%   17%
 *     swing       97%   89%   46%   36%   12%
 *
 *   UMBRAL DE LOCOMOCION, observado en el robot: el bipedo deja de avanzar entre
 *   el 37% y el 51% de la onda. A T=1000 camina bien; a T=750 apenas se traslada
 *   y no intenta andar. Por debajo, el recorte deforma la senoidal y se pierde el
 *   desfase cadera-pie de -90 grados, que es lo que convierte el balanceo en paso.
 *
 *   T MINIMO PARA SEGUIR CAMINANDO (fidelidad >= 50%): walk 1070 ms, turn 860,
 *   swing/updown/tiptoe/crusaito 1070, flapping 790, ascTurn 560. Y para que la
 *   onda salga FIEL sin recortar picos (hace falta A <= 7.48*T(s)) walk
 *   necesitaria 4000 ms, mas que el bloque mas lento que existe (3500).
 *
 *   jump SI respeta el techo agregado y se planta: T=3500/2000/1000 se entregan,
 *   pero T=750 sale en 866 ms y T=250 en 813, porque t_cap=800 manda. Donde el
 *   original reptaba y luego esprintaba, ahora se niega de forma explicita.
 *
 * SEGUNDA PASADA DE LA 3d, CON PILAS FRESCAS -- la mejor hasta ahora
 *
 *   DOS CICLOS COMPLETOS Y UN SOLO REINICIO, al final. El ciclo completo del
 *   volcado (52 tramos, 52.9 s): UN tramo bajo 3900, y es flapping. 13 de 21
 *   marchas al x1.00-1.01 de su duracion nominal. walk x1.02-1.05 cuando en la
 *   pasada anterior iba x1.30-1.60: mismo codigo, pilas frescas. El estado de las
 *   pilas es LA variable dominante del proyecto, por encima de cualquier cambio
 *   de codigo hecho hasta aqui.
 *
 *   LA PRUEBA DE LA TABLA, por fin hecha, y la pasa. Los sanos se quedaron en
 *   gm=98 en los DOS ciclos (tiptoe, moonwalk, crusaito, jump, updown, swing,
 *   jitter): no hay deriva global a la baja, que era el fallo de la 3b. Y dos
 *   mejoraron en el segundo ciclo SOLTANDO freno: ascTurn gm 77->91 con x1.23->
 *   x1.09 y vmin 3911->4022, bend gm 63->84 con 795->653 ms y vmin 3924->4156.
 *   La tabla esta en EQUILIBRIO: ni trinquete (3b) ni amnesia (3c). Ojo, que
 *   mejoren soltando freno significa que lo que les ayudaba eran las pilas.
 *
 *   EL TESTIGO DEFINITIVO DE LA FASE 4: #31406, hold_90, dur=1500, trvtot=0,
 *   sag=1534 mV, vmin=3342. No se mueve NADA, ni se COMANDA nada, y el rail cae
 *   1534 mV. En la misma pasada, 50 s antes, el mismo hold_90 cayo 162 mV: factor
 *   9.5 por la POSE, no por el codigo. Ningun control basado en velocidad puede
 *   tocar esto, por construccion: no hay velocidad que reducir. Ademas los tramos
 *   con trv=0 no entran en el bucle del freno, asi que ni se miden ni se protegen.
 *   Y shakeLeg es el segundo caso: 7 ocurrencias por ciclo con sags de 801 a 1261
 *   mV y g=35-70, apoyado sobre un solo pie.
 *
 * FASE 3e -- el defecto que corrige, medido en la PRIMERA pasada de la 3d
 *
 *   PRIMERO LO BUENO: la tabla por movimiento hace justo lo que se le pedia DENTRO
 *   de un ciclo. updown, swing y tiptoe corrieron al x1.01 de su duracion nominal
 *   con gm=98 (libres), mientras walk x1.30-1.40, ascTurn x1.37 y jitter x1.49 si
 *   se frenaron. Los gestos sanos ya no pagan por los caros.
 *
 *   PERO la prueba de verdad -comparar la primera vuelta del loop() con la
 *   segunda- NO SE PUDO HACER: las dos pasadas con pilas se reiniciaron antes de
 *   terminar el primer ciclo (en flapping la primera, en tiptoeSwing la segunda).
 *
 *   EL DEFECTO. El atajo de _moveServos para los tramos sin recorrido (trvTotal==0)
 *   salia ANTES de OTTO_BRAKE_BEGIN(). Dos consecuencias, y la segunda es grave:
 *
 *     1. El registro MENTIA. Al no reiniciarse los acumuladores, esos tramos
 *        publicaban el g=/gm= del tramo anterior. En la pasada: 15 de 15 tramos con
 *        trv=0 eran copia EXACTA del anterior, sin una sola excepcion. Es decir que
 *        'home:cad ... trv=0 ... g=35' no era de home:cad: era de jitter.
 *
 *     2. La etiqueta se FILTRABA. _brakeBegin() es quien la consume, asi que tras un
 *        tramo trv=0 la etiqueta seguia puesta y la heredaba el gesto siguiente. En
 *        este sketch el peor_caso_4servos es un _moveServos pelado, sin etiqueta
 *        propia, y venia justo detras de un home:cad con trv=0: cargaba su coste en
 *        la casilla de HOME_C. O sea que la prueba sintetica mas brutal del sketch
 *        envenenaba la memoria de home() al principio de CADA ciclo.
 *
 *   Y eso empuja a home() al unico regimen donde frenar es contraproducente. Su
 *   ventana nominal con trv=60 son 400 ms; envenenado arranco al 45% y salio en
 *   613 ms (vmin 3870) y 714 ms (vmin 3717), los dos peores home:cad del volcado.
 *   Mismo mecanismo que flapping: home() lo gobierna el PAR ESTATICO de sostener el
 *   cuerpo descompensado, y estirarlo alarga la exposicion sin bajar la corriente.
 *   OJO, esto esta CONFUNDIDO -el freno frena porque la tension esta baja-, asi que
 *   es coherente con la hipotesis, no una prueba. La prueba es el experimento de la
 *   Fase 4.
 *
 *   LAS DOS PASADAS NO SON COMPARABLES ENTRE SI. Las pilas se gastan dentro de la
 *   propia pasada: estiramiento sobre lo nominal +17% -> +34%, tramos bajo 3900 del
 *   14% al 24%, peor vmin 3805 -> 3531, gm medio 87 -> 82, vcc de arranque 4876 ->
 *   4523. Para comparar fases hace falta empezar con las pilas en el mismo estado.
 *
 *   LA CADENA DE REINICIOS AL ARRANCAR SIGUE VIVA. Dos ARRANQUE del volcado no
 *   anotaron NINGUN tramo, lo que significa que murieron dentro de setup(): el
 *   escalonado de 300 ms acorta la cadena pero no la elimina.
 *
 *   MARCAS AUDIBLES (buzzer del pin 13), para no tener que mirar el serie mientras
 *   corre con pilas:
 *     - tres notas DESCENDENTES  -> arranque de setup(). Si suena en medio de la
 *       secuencia, la placa se ha REINICIADO: es un detector de reinicios en vivo.
 *     - N pitidos AGUDOS cortos  -> empieza la vuelta N del loop() (hasta 5).
 *     - dos notas GRAVES         -> secuencia completa, empieza la espera de 10 s.
 *     - CUATRO notas graves      -> prueba terminada (OTTO_DIAG_CICLOS ciclos), ya
 *                                   se puede apagar; los servos quedan sueltos.
 *   Suenan siempre con los servos DESENGANCHADOS y con 400 ms de silencio a cada
 *   lado, asi que no entran en ninguna medida. OTTO_DIAG_BEEP a 0 las apaga.
 */

// OJO: el troceado de la Fase 4b se cambia en Otto.h (OTTO_MV_TRV_CHUNK), NO aqui.
// Un #define en el sketch no llega a Otto.cpp: el IDE compila la libreria en una
// unidad de traduccion aparte y no ve los #define del .ino.
#include <Otto.h>

// ---- Pinout canonico de Otto DIY sobre Arduino Nano. AJUSTA SI HACE FALTA ----
#define LeftLeg    2   // servo[0]  YL  cadera izquierda
#define RightLeg   3   // servo[1]  YR  cadera derecha
#define LeftFoot   4   // servo[2]  RL  pie izquierdo
#define RightFoot  5   // servo[3]  RR  pie derecho
#define Buzzer    13

Otto Otto;

// Pausa entre pruebas. Los servos se desenganchan para que no sostengan postura
// y las pilas se recuperen: asi cada medida parte de un estado comparable.
static void reposo(unsigned long ms) {
  Otto.home();            // vuelve a 90/90/90/90 y desengancha
  delay(ms);
}

static void marca(const __FlashStringHelper* nombre) {
  Serial.print(F("OTTO,test,"));
  Serial.println(nombre);
}

// ------------------------------------------------------------------------------
//  AVISOS SONOROS (buzzer en el pin 13). Son solo marcas de tiempo: no forman
//  parte de la medida y van SIEMPRE con los servos desenganchados, en el silencio
//  que deja reposo(), con BEEP_CALMA_MS de margen a cada lado para que no se
//  solapen con ningun movimiento.
//
//  Consumo: un piezo pasivo movido por tone() desde un pin del 328P son unos
//  pocos mA (si es un zumbador electromagnetico, hasta ~30 mA). Frente a los
//  400 mA de UN servo en marcha es despreciable, y aqui ademas suena cuando no
//  hay ningun servo enganchado, asi que no puede contaminar ningun tramo.
//
//  Poner OTTO_DIAG_BEEP a 0 lo desactiva todo sin tocar nada mas.
// ------------------------------------------------------------------------------
// ==> AVISO (Fase 6): desde la version entregada, OTTO_INSTRUMENT vale 0 en
//     Otto.h. Sin tocarlo, ESTE SKETCH COMPILA PERO NO REGISTRA NADA y el volcado
//     sale vacio. Para medir hay que poner OTTO_INSTRUMENT a 1 en Otto.h -no aqui,
//     que no llega- y volverlo a 0 antes de entregar.
#define OTTO_DIAG_BEEP   1
#define BEEP_CALMA_MS  400

// ------------------------------------------------------------------------------
//  LIMITE DE CICLOS -- y esto no es comodidad, es metodologia.
//
//  Medido tres veces: el estado de las pilas mueve los resultados MAS que
//  cualquier cambio de codigo que hayamos hecho. Mismo binario, walk a x1.02 con
//  pilas frescas y a x1.30-1.60 con pilas de media hora. Si cada pasada cubre una
//  ventana de bateria distinta, no se puede comparar nada.
//
//  Con el limite, toda pasada cubre la MISMA ventana: tres ciclos desde el
//  arranque y para. Al terminar suenan cuatro notas graves y los servos quedan
//  desenganchados, asi que se puede apagar con tranquilidad.
//
//  0 = sin limite (vuelve al bucle infinito de antes).
// ------------------------------------------------------------------------------
#define OTTO_DIAG_CICLOS 3

// ------------------------------------------------------------------------------
//  PRUEBA SUELTA: BARRIDO DEL ANGULO DE APOYO
//
//  Por que. shakeLeg deberia dejar UN pie sosteniendo el peso y el otro aleteando
//  EN EL AIRE. Observado en el robot: el pie que aletea no se despega, y acaba
//  levantando el cuerpo. La aritmetica del gesto lo explica. Con la convencion de
//  la propia libreria -deducida de updown y de swing-:
//
//      roll  = (dRL + dRR)/2   inclinarse a un lado  <- esto es lo que LEVANTA un pie
//      heave = (dRL - dRR)/2   subir/bajar el cuerpo
//
//  (updown usa offsets de signo OPUESTO y sube el cuerpo; swing los usa del MISMO
//  signo y bascula de lado. O sea: mismo signo = roll, signo opuesto = heave.)
//
//  Las tres poses de shakeLeg, hacia la derecha:
//      shake_leg1  RL=145 RR=122   roll=+43.5  heave=+11.5   <- levanta el pie
//      shake_leg2  RL= 60 RR=122   roll= +1.0  heave=-31.0   <- EL ROLL DESAPARECE
//      shake_leg3  RL=120 RR=122   roll=+31.0  heave= -1.0   <- vuelve a levantar
//
//  Y la secuencia real es leg1, leg2, (leg3, leg2) x2, homes, o sea que el roll va
//  43.5 -> 1 -> 31 -> 1 -> 31 -> 1. En shake_leg2 el pie que aletea CRUZA el centro
//  (RL=60, o sea -30) mientras el de apoyo se queda en +32: el gesto deja de ser una
//  inclinacion y se convierte en los dos tobillos empujando contra el suelo y entre
//  si. No es que el angulo de apoyo sea pequeno: es que en la pose intermedia se
//  CANCELA. Y eso explica los sags de 801 a 1261 mV de shakeLeg: no estamos midiendo
//  un gesto, estamos midiendo dos servos bloqueados.
//
//  Que hace esta prueba. Manda ROLL PURO -los dos tobillos el mismo delta, heave
//  cero- y lo sostiene, en angulos crecientes. Hay que MIRAR en cual se despega el
//  pie izquierdo del suelo. Cada angulo deja dos lineas en el registro: la de llegar
//  y la de sostener, con su coste electrico.
//
//  Antes de cada angulo suenan N pitidos cortos: 1=30, 2=35, 3=40, 4=45, 5=50 grados.
//
//  Poner a 0 para volver a la secuencia normal de 16 pruebas.
// ------------------------------------------------------------------------------
// ------------------------------------------------------------------------------
//  PRUEBA CORTA: CUANTO CUESTA VOLVER AL CENTRO  (unos 30 segundos)
//
//  Por que corta y no la secuencia entera. Diez pasadas y el estorbo es siempre el
//  mismo: el estado de las pilas mueve los resultados mas que cualquier cambio de
//  codigo, asi que dos pasadas separadas por minutos no son comparables. La salida
//  es que la prueba dure 30 segundos: asi se corren A y B seguidas, con las mismas
//  pilas, y la deriva de bateria se cancela.
//
//  Que hace. Repite cuatro veces la unica pareja que importa: ir a la pose del
//  peor_caso (140 grados agregados) y volver al centro con el home() de verdad, que
//  es el que produce los dos tramos mas caros de la libreria -home:pies con 80
//  grados y home:cad con 60-. Son exactamente los tres tramos que trocea la 4b.
//  Antes de cada repeticion suenan N pitidos.
//
//  Como usarla: en Otto.h, buscar OTTO_MV_TRV_CHUNK (esta junto a la nota de la
//  Fase 4b) y correr la prueba dos veces:
//    1. #define OTTO_MV_TRV_CHUNK 50   -> subir, correr con pilas, volcar
//    2. #define OTTO_MV_TRV_CHUNK  0   -> subir, correr con pilas, volcar
//  No vale ponerlo en este archivo: un #define del sketch no llega a Otto.cpp.
//  El volcado pone tr=2 o tr=3 en los tramos troceados, asi que se VE en los datos
//  si el troceado ocurrio y no hay que creerse nada.
// ------------------------------------------------------------------------------
// ------------------------------------------------------------------------------
//  TEST DE VELOCIDAD DE LOS BLOQUES  (unos 2 minutos)
//
//  Los valores reales del desplegable "Velocidad" de Blockly, buscados en
//  www/lang/Arduino_*.js, clave OTTO9_MOVE_SPEED_CHOICE. No son los mismos en
//  todos los idiomas:
//
//    la mayoria   normal 1000 | lento 2000 | muy lento 3000
//                 rapido 750  | muy rapido 500 | super rapido 250
//    Arduino_es   Normal 2000 | Lento 3500 | Rapido 1500        (solo tres)
//    Arduino_en   Normal 2000 | Lento 3000 | Rapido 1500 | Muy Rapido 750
//
//  Ese numero es el PERIODO T que el bloque pasa a la libreria, siempre con
//  steps=1 y, en los bloques de baile, tamano 25. Rango completo: 250 a 3500 ms.
//
//  Que se barre aqui: los cinco valores que cubren todo el rango, sobre cuatro
//  movimientos que representan los dos caminos distintos de la libreria:
//    walk y turn   marchas por oscillateServos (T = periodo del oscilador)
//    swing         marcha "sana", la referencia de que todo va bien
//    jump          gesto por _moveServos (T = duracion de cada mitad)
//  SE BARRE DE LENTO A RAPIDO, porque en el robot walk no da problemas despacio y
//  van apareciendo al subir: si se reinicia, se pierde solo el extremo rapido.
//  Antes de cada velocidad suenan N pitidos, y el numero crece con la exigencia:
//    1 pitido = 3500 (lento)   2 = 2000   3 = 1000   4 = 750   5 = 250 (el peor)
// ------------------------------------------------------------------------------
// ------------------------------------------------------------------------------
//  BARRIDO FINO DE T SOBRE walk, PARA ELEGIR LA VELOCIDAD  (unos 2.3 minutos)
//
//  Lo que se optimiza NO es la fidelidad de la onda, es cuanto avanza Otto por
//  segundo. Y eso el registro no lo puede medir: no hay odometria. Asi que el test
//  es mixto. La EEPROM da la duracion real, el recorrido angular logrado, el vmin y
//  si el freno intervino; los centimetros los mide el usuario con un metro.
//
//  TIEMPO CONSTANTE, NO PASOS CONSTANTES. Cada velocidad corre unos 6 segundos,
//  ajustando los ciclos como 6000/T, para que los centimetros sean directamente
//  comparables entre velocidades: gana el que llega mas lejos.
//
//    pitidos  T     ciclos  duracion  recorrido previsto  % de la onda
//       1     2000     3     6000 ms       1044 grados        87%
//       2     1750     3     5250 ms        974               81%
//       3     1500     4     6000 ms       1128               70%
//       4     1250     4     5000 ms        940               59%
//       5     1100     5     5500 ms       1034               52%
//       6      950     6     5700 ms       1072               45%
//       7      800     7     5600 ms       1053               38%
//
//  QUE TIENE QUE DECIDIR. Por debajo de T=1700 ms los cuatro servos de walk ya
//  estan recortados, asi que el recorrido angular por segundo se queda FIJO en
//  4 x 47 = 188 grados/s sea cual sea T -mira la columna de recorrido, casi
//  constante-. Las patas barren siempre igual de rapido y lo unico que cambia es la
//  AMPLITUD de la zancada. Si la zancada empujara proporcionalmente, los cm/s
//  serian constantes y daria igual que T elegir. Pero a T=750 ya no avanza
//  (observado en el robot), asi que hay un CODO: por debajo de cierta amplitud el
//  pie no despeja el suelo y la pata solo roza. El test localiza ese codo, que es
//  una propiedad del roce y del peso y no se calcula.
//
//  PROTOCOLO, por velocidad:
//    N pitidos agudos  -> empieza la velocidad N
//    Otto camina ~6 s
//    home() y desengancha
//    UNA NOTA GRAVE LARGA -> se abre la ventana de medida
//    PASO_T_PAUSA_MS para medir y devolverlo a la linea de salida
//
//  Al final, las cuatro notas graves de siempre.
//
//  OJO CON EL METODO, que aqui pesa mas que la electronica:
//    - la MISMA superficie para los siete; el roce domina este experimento
//    - la misma linea de salida, con los talones a ras
//    - apuntar la desviacion lateral: si a T bajo se desvia mas, eso tambien es
//      perdida de traccion
// ------------------------------------------------------------------------------
#define OTTO_DIAG_SOLO_T   0
#define PASO_T_PAUSA_MS    12000
#define PASO_T_VENTANA_MS   6000

#define OTTO_DIAG_SOLO_VELOCIDAD 0

// ------------------------------------------------------------------------------
//  SHAKELEG ARREGLADO (Fase 5e). El gesto original cruzaba el centro con el pie
//  libre, lo devolvia al suelo y cancelaba la inclinacion: los dos tobillos
//  acababan calandose uno contra otro. Ahora el pie libre aletea entre 35 y 55,
//  siempre en el aire, con el tobillo de apoyo clavado en 55.
//
//  QUE MIRAR CON LOS OJOS, que es lo que no se puede leer de la EEPROM:
//    - un pie sostiene el peso y el OTRO aletea EN EL AIRE, sin tocar el suelo
//    - el cuerpo no sube ni baja durante el aleteo: la inclinacion se mantiene
//    - no se cae, y las dos piernas se comportan igual (grupos 1-2 vs 3-4)
//
//  QUE DEBE DECIR LA EEPROM, y es la prueba de que el calado desaparecio:
//    los tramos `shake` bajaban a 801-1261 mV de sag. Con el arreglo deberian
//    quedarse en la banda de un sosten normal (<400 mV) y vmin por encima de
//    3900. Si siguen apareciendo sags de 800+, el pie libre sigue tocando y hay
//    que subir el angulo de apoyo antes que nada.
//
//  Cuatro grupos de pitidos: 1 = T2000 derecha, 2 = T2000 izquierda,
//  3 = T1400 derecha, 4 = T1400 izquierda. Dos repeticiones por grupo para
//  tener una idea del ruido. T solo cambia la velocidad del aleteo: el
//  agachado son 1000 ms fijos y el aleteo es max(T-1000, 400).
// ------------------------------------------------------------------------------
#define OTTO_DIAG_SOLO_SHAKE 0
#define SHAKE_REPES 2

#define OTTO_DIAG_SOLO_VOLVER 0
#define VOLVER_REPES 4

#define OTTO_DIAG_SOLO_APOYO 0
#define APOYO_DESDE 30
#define APOYO_HASTA 50
#define APOYO_PASO   5

// ------------------------------------------------------------------------------
//  SEGUNDA PARTE: COMO VOLVER DE LA INCLINACION
//
//  Lo que midio el barrido (tres pasadas con pilas, 2026-11-12 13:58):
//
//    SOSTENER la inclinacion es GRATIS. Quince sostenes de 1500 ms, de 30 a 50
//    grados, y CERO muestras por debajo de 3900 mV sobre unas 2250. Sags de 0 a
//    370 mV. Sostener 50 grados a una pata no cuesta practicamente nada.
//
//    VOLVER al centro es el tramo mas caro del volcado, las tres veces:
//    home:pies con trvtot=100, vmin 3924 / 3897 / 3693, sag 644-885, y con el
//    freno A FONDO (g=35, gm=70). Frenar no lo arregla.
//
//    Y el coste POR GRADO es el mismo en los dos sentidos: 8.3 mV/grado en la ida
//    y 7.5 mV/grado en la vuelta. O sea que lo que marca el consumo no es la pose
//    ni el sentido, es CUANTOS GRADOS SE MUEVEN A LA VEZ. La vuelta es cara
//    porque hace los 100 grados de una vez, mientras la ida los reparte en
//    60+10+10+10+10.
//
//  Que no sabemos todavia, y es lo que decide la Fase 4b: si lo que importa es el
//  recorrido simultaneo, la velocidad angular, o el numero de motores moviendose.
//  Las tres cosas van juntas en todo lo medido hasta ahora. Esto las separa:
//
//    modo 1  los dos tobillos juntos, 100 grados de golpe       <- lo que hace home()
//    modo 2  los dos tobillos, en DOS tramos de 50              misma velocidad, mitad de recorrido por tramo
//    modo 3  UN tobillo y luego el otro, 50 cada uno            misma velocidad, UN motor moviendose
//    modo 4  los dos juntos pero al doble de tiempo             mismo recorrido, MITAD de velocidad
//
//  Los cuatro recorren los mismos 100 grados en total. Antes de cada modo suenan
//  dos notas graves y luego N pitidos cortos con el numero de modo.
// ------------------------------------------------------------------------------
#define APOYO_PRUEBA_RETORNO 1

static void beepCalma() {
  delay(BEEP_CALMA_MS);
}

//-- ARRANQUE: tres notas DESCENDENTES. Solo suena en setup(), asi que si la oyes
//-- en medio de la secuencia es que la placa se ha reiniciado. Es un detector de
//-- reinicios audible, sin tener que esperar al volcado de la EEPROM.
static void avisoArranque() {
#if OTTO_DIAG_BEEP
  beepCalma();
  Otto._tone(1568, 90, 40);
  Otto._tone(1175, 90, 40);
  Otto._tone( 784, 140, 0);
  beepCalma();
#endif
}

//-- INICIO DE CICLO: un pitido corto AGUDO por cada vuelta del loop(). Una vez es
//-- la primera vuelta, dos la segunda, y asi hasta cinco. Sirve justo para la
//-- prueba de la Fase 3d: la tabla por movimiento tarda unas secuencias en
//-- aprender, y hay que poder saber de oido en que vuelta vas.
static void avisoInicio(uint8_t n) {
#if OTTO_DIAG_BEEP
  beepCalma();
  if (n > 9) n = 9;      //-- el barrido de T necesita llegar a 7
  for (uint8_t i = 0; i < n; i++) Otto._tone(2093, 70, 130);
  beepCalma();
#endif
}

//-- FIN DE CICLO: dos notas GRAVES. Marca el final de la secuencia completa,
//-- antes de la espera de 10 s.
static void avisoFin() {
#if OTTO_DIAG_BEEP
  beepCalma();
  Otto._tone(523, 110, 90);
  Otto._tone(392, 220, 0);
  beepCalma();
#endif
}

//-- PARADA: cuatro notas graves descendentes. Inconfundible frente a las dos de
//-- fin de ciclo. Suena una sola vez, cuando se han hecho los ciclos pedidos.
static void avisoParada() {
#if OTTO_DIAG_BEEP
  beepCalma();
  Otto._tone(523, 140, 60);
  Otto._tone(440, 140, 60);
  Otto._tone(349, 140, 60);
  Otto._tone(262, 320, 0);
#endif
}

//-- VENTANA DE MEDIDA: una nota grave LARGA, inconfundible frente a las dos de
//-- fin de ciclo y las cuatro de parada. Significa "mide y vuelve a la salida".
static void avisoMedir() {
#if OTTO_DIAG_BEEP
  beepCalma();
  Otto._tone(330, 500, 0);
#endif
}

static uint8_t cicloDiag = 0;

void setup() {
  // Otto.init() abre el serie a 115200 y emite la linea OTTO,boot,...
  Otto.init(LeftLeg, RightLeg, LeftFoot, RightFoot, true, Buzzer);

  delay(300);
  Serial.println(F("OTTO,info,inicio de la secuencia de diagnostico"));
  Serial.println(F("OTTO,info,campos: dur(ms) vbefore/vmin/sag(mV) wpk(deg/s) w(YL/YR/RL/RR) trv(grados)"));

  reposo(1500);
  avisoArranque();
}

#if OTTO_DIAG_SOLO_T
static void soloBarridoT() {
  static const int TS[7] = {2000, 1750, 1500, 1250, 1100, 950, 800};
  Serial.println(F("OTTO,info,barrido fino de T sobre walk, a tiempo constante"));
  Serial.println(F("OTTO,info,mide los cm de cada velocidad y devuelvelo a la salida"));
  for (uint8_t k = 0; k < 7; k++) {
    const int T = TS[k];
    int ciclos = PASO_T_VENTANA_MS / T;
    if (ciclos < 1) ciclos = 1;
    Serial.print(F("OTTO,test,T="));       Serial.print(T);
    Serial.print(F(",ciclos="));           Serial.print(ciclos);
    Serial.print(F(",pitidos="));          Serial.println(k + 1);
    avisoInicio(k + 1);
    marca(F("walk"));
    Otto.walk((float)ciclos, T, FORWARD);
    reposo(1000);                    //-- recentra y desengancha: quieto para medir
    avisoMedir();
    delay(PASO_T_PAUSA_MS);
  }
}
#endif

#if OTTO_DIAG_SOLO_VELOCIDAD
static void soloVelocidad() {
  //-- DE LENTO A RAPIDO, no al contrario. Observado en el robot: a velocidad baja
  //-- walk no da problemas y van apareciendo a medida que se sube. Barrer en ese
  //-- orden tiene dos ventajas. Si la placa se reinicia, se pierde solo el extremo
  //-- rapido -que ademas es el predecible- y queda guardado todo lo anterior. Y los
  //-- pitidos crecen con la dificultad, asi que el numero que oyes es tambien el
  //-- nivel de exigencia.
  //-- El precio: el extremo rapido corre con las pilas ya algo gastadas, asi que si
  //-- falla a T=250 hay que mirar el vbefore de ese tramo antes de culpar a la
  //-- velocidad.
  static const int TS[5] = {3500, 2000, 1000, 750, 250};
  Serial.println(F("OTTO,info,test de velocidad de los bloques"));
  for (uint8_t k = 0; k < 5; k++) {
    const int T = TS[k];
    Serial.print(F("OTTO,test,velocidad_T=")); Serial.println(T);
    avisoInicio(k + 1);
    marca(F("walk"));   Otto.walk(1, T, FORWARD);  reposo(1500);
    marca(F("turn"));   Otto.turn(1, T, LEFT);     reposo(1500);
    marca(F("swing"));  Otto.swing(1, T, 25);      reposo(1500);
    marca(F("jump"));   Otto.jump(1, T);           reposo(2000);
  }
}
#endif

#if OTTO_DIAG_SOLO_SHAKE
static void soloShake() {
  static const int   TS[2]   = {2000, 1400};
  static const int   DIRS[2] = {RIGHT, LEFT};
  Serial.println(F("OTTO,info,shakeLeg arreglado -- 2 velocidades x 2 piernas"));
  uint8_t grupo = 0;
  for (uint8_t k = 0; k < 2; k++) {
    for (uint8_t d = 0; d < 2; d++) {
      grupo++;
      Serial.print(F("OTTO,test,shake_grupo=")); Serial.print(grupo);
      Serial.print(F(",T="));                    Serial.print(TS[k]);
      Serial.print(F(",pierna="));
      Serial.println(DIRS[d] == RIGHT ? F("derecha") : F("izquierda"));
      avisoInicio(grupo);
      for (uint8_t r = 0; r < SHAKE_REPES; r++) {
        marca(F("shakeLeg"));
        Otto.shakeLeg(1, TS[k], DIRS[d]);
        reposo(1500);
      }
    }
  }
}
#endif

#if OTTO_DIAG_SOLO_VOLVER
static void soloVolver() {
  int extremo[4] = {60, 120, 130, 50};    //-- la pose del peor_caso: 140 grados
  Serial.println(F("OTTO,info,coste de volver al centro -- 4 repeticiones"));
  for (uint8_t r = 1; r <= VOLVER_REPES; r++) {
    Serial.print(F("OTTO,test,volver_repeticion=")); Serial.println(r);
    avisoInicio(r);
    Otto.attachServos();
    Otto._moveServos(400, extremo);       //-- ir (trv=140 desde el centro)
    Otto._moveServos(600, extremo);       //-- sostener y medir (trv=0)
    reposo(2500);                         //-- volver con el home() de verdad
  }
}
#endif

#if OTTO_DIAG_SOLO_APOYO

//-- Ir a la inclinacion maxima (roll puro) y sostenerla un momento, para que los
//-- cuatro modos de vuelta partan del mismo sitio.
static void irAInclinacion() {
  int pose[4] = {90, 90, 90 + APOYO_HASTA, 90 + APOYO_HASTA};
  Otto._moveServos(700, pose);
  Otto._moveServos(800, pose);          //-- sostener, y medirlo (trvtot=0)
}

//-- Las cuatro formas de volver al centro. Los cuatro recorren 100 grados en total
//-- y, salvo el modo 4, a la misma velocidad agregada (150 grados/s).
static void volverDeInclinacion(uint8_t modo) {
  const int R = APOYO_HASTA;
  int plano[4] = {90, 90, 90, 90};
  if (modo == 1) {
    Otto._moveServos(667, plano);                       // 100 grados de golpe
  } else if (modo == 2) {
    int medio[4] = {90, 90, 90 + R / 2, 90 + R / 2};
    Otto._moveServos(333, medio);                       // 50 grados
    Otto._moveServos(333, plano);                       // 50 grados
  } else if (modo == 3) {
    int uno[4] = {90, 90, 90, 90 + R};
    Otto._moveServos(333, uno);                         // solo el tobillo izquierdo
    Otto._moveServos(333, plano);                       // solo el derecho
  } else {
    Otto._moveServos(1334, plano);                      // 100 grados a mitad de velocidad
  }
}

static void barridoApoyo() {
  Serial.println(F("OTTO,info,barrido del angulo de apoyo (roll puro)"));
  Serial.println(F("OTTO,info,MIRA en que angulo se despega el pie izquierdo del suelo"));
  Otto.attachServos();
  uint8_t idx = 0;
  for (int R = APOYO_DESDE; R <= APOYO_HASTA; R += APOYO_PASO) {
    idx++;
    Serial.print(F("OTTO,test,apoyo_roll=")); Serial.println(R);
    avisoInicio(idx);                      //-- idx pitidos: viene el angulo idx
    int apoyo[4] = {90, 90, 90 + R, 90 + R};
    Otto._moveServos(700, apoyo);          //-- llegar a la pose
    Otto._moveServos(1500, apoyo);         //-- sostenerla, y MEDIRLA (trvtot=0)
  }
  reposo(2000);

#if APOYO_PRUEBA_RETORNO
  Serial.println(F("OTTO,info,comparando las cuatro formas de volver de la inclinacion"));
  for (uint8_t modo = 1; modo <= 4; modo++) {
    Serial.print(F("OTTO,test,retorno_modo=")); Serial.println(modo);
    avisoFin();                         //-- dos notas graves: viene un modo nuevo
    avisoInicio(modo);                  //-- y el numero de modo en pitidos
    Otto.attachServos();
    irAInclinacion();
    volverDeInclinacion(modo);
    reposo(1500);
  }
#endif
}
#endif

void loop() {

#if OTTO_DIAG_SOLO_T
  soloBarridoT();
  Serial.println(F("OTTO,info,BARRIDO DE T TERMINADO -- ya se puede apagar"));
  Otto.home();
  Otto.detachServos();
  avisoParada();
  for (;;) { delay(1000); }
#endif

#if OTTO_DIAG_SOLO_VELOCIDAD
  soloVelocidad();
  Serial.println(F("OTTO,info,TEST DE VELOCIDAD TERMINADO -- ya se puede apagar"));
  Otto.home();
  Otto.detachServos();
  avisoParada();
  for (;;) { delay(1000); }
#endif

#if OTTO_DIAG_SOLO_SHAKE
  soloShake();
  Serial.println(F("OTTO,info,PRUEBA DE SHAKELEG TERMINADA -- ya se puede apagar"));
  Otto.home();
  Otto.detachServos();
  avisoParada();
  for (;;) { delay(1000); }
#endif

#if OTTO_DIAG_SOLO_VOLVER
  soloVolver();
  Serial.println(F("OTTO,info,PRUEBA TERMINADA -- ya se puede apagar"));
  Otto.home();
  Otto.detachServos();
  avisoParada();
  for (;;) { delay(1000); }
#endif

#if OTTO_DIAG_SOLO_APOYO
  barridoApoyo();
  Serial.println(F("OTTO,info,BARRIDO TERMINADO -- ya se puede apagar"));
  Otto.home();
  Otto.detachServos();
  avisoParada();
  for (;;) { delay(1000); }
#endif

  //-- Marca audible de entrada: tantos pitidos como vuelta del loop().
  if (cicloDiag < 255) cicloDiag++;
  Serial.print(F("OTTO,info,ciclo=")); Serial.println(cicloDiag);
  avisoInicio(cicloDiag);

  // --- 1. Referencia: sostener postura sin moverse -------------------------
  // Mide lo que cuesta solo mantener los 4 servos enganchados contra gravedad.
  marca(F("hold_90"));
  {
    int centro[4] = {90, 90, 90, 90};
    Otto.attachServos();
    Otto._moveServos(1500, centro);
  }
  reposo(1500);

  // --- 2. Peor caso deliberado: los 4 servos, excursion grande, rapido -----
  // Es el escenario que hace resetear la placa. Si aqui vmin se desploma,
  // tenemos localizado el limite del regulador.
  marca(F("peor_caso_4servos"));
  {
    int extremo[4] = {60, 120, 130, 50};
    Otto.attachServos();
    Otto._moveServos(400, extremo);
  }
  reposo(2000);

  // --- 3. Marchas basadas en osciladores (oscillateServos) ----------------
  marca(F("walk_fwd_4pasos"));   Otto.walk(4, 1000, FORWARD);    reposo(1500);
  marca(F("walk_back_4pasos"));  Otto.walk(4, 1000, BACKWARD);   reposo(1500);
  marca(F("turn_left_4"));       Otto.turn(4, 2000, LEFT);       reposo(1500);
  marca(F("updown"));            Otto.updown(2, 1000, 20);       reposo(1500);
  marca(F("swing"));             Otto.swing(2, 1000, 20);        reposo(1500);
  marca(F("tiptoeSwing"));       Otto.tiptoeSwing(2, 900, 20);   reposo(1500);
  marca(F("jitter"));            Otto.jitter(2, 500, 20);        reposo(1500);
  marca(F("ascendingTurn"));     Otto.ascendingTurn(2, 900, 13); reposo(1500);
  marca(F("moonwalker"));        Otto.moonwalker(2, 900, 20, LEFT);    reposo(1500);
  marca(F("crusaito"));          Otto.crusaito(2, 900, 20, FORWARD);   reposo(1500);
  marca(F("flapping"));          Otto.flapping(2, 1000, 20, FORWARD);  reposo(1500);

  // --- 4. Gestos basados en _moveServos ------------------------------------
  marca(F("jump"));              Otto.jump(1, 2000);             reposo(2000);
  marca(F("bend_left"));         Otto.bend(1, 1400, LEFT);       reposo(2000);
  marca(F("shakeLeg_right"));    Otto.shakeLeg(1, 2000, RIGHT);  reposo(2000);

  avisoFin();

#if OTTO_DIAG_CICLOS > 0
  if (cicloDiag >= OTTO_DIAG_CICLOS) {
    Serial.print(F("OTTO,info,PRUEBA TERMINADA tras "));
    Serial.print(cicloDiag);
    Serial.println(F(" ciclos -- ya se puede apagar"));
    //-- home() solo actua si isOttoResting es false, asi que por si misma no
    //-- GARANTIZA nada: aqui siempre llega ya en reposo y no hace nada. El
    //-- detachServos() de despues si es incondicional, y es el que asegura que al
    //-- acabar la prueba no queda ni un servo tirando.
    Otto.home();
    Otto.detachServos();
    avisoParada();
    //-- Parado de verdad: servos sueltos, sin escrituras en EEPROM y sin tocar los
    //-- pines. Se puede apagar cuando se quiera; el registro ya esta completo.
    for (;;) { delay(1000); }
  }
#endif

  Serial.println(F("OTTO,info,secuencia completa -- repitiendo en 10 s"));
  delay(10000);
}
