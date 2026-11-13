// ==============================================================================
//  OttoValidacionFinal -- valida la libreria TAL COMO SE ENTREGA
// ==============================================================================
//
//  POR QUE EXISTE ESTE SKETCH, Y EN QUE SE DIFERENCIA DE OttoDiagnostico
//
//  En la version entregada OTTO_INSTRUMENT vale 0 (Fase 6), asi que NO HAY
//  registro en EEPROM, no hay volcado y la libreria NI SIQUIERA ABRE EL PUERTO
//  SERIE: ottoSerialBegin() vive dentro de un #if OTTO_DBG || OTTO_INSTRUMENT.
//  Por eso un programa normal no imprime nada. No esta roto: esta entregado.
//
//  Este sketch no depende de nada de eso. Abre el serie el mismo y mide cada
//  movimiento con millis(), que es la unica senal que queda cuando el
//  instrumentado esta apagado. Y resulta que millis() basta, porque las dos cosas
//  que hay que validar dejan su huella en el TIEMPO:
//
//    1) EL ACOTADO DE T (Fase 5d). Las marchas no bajan de T_min = 50 ms por grado
//       de su amplitud mayor. Si el acotado esta vivo, pedir T=250 a walk NO da
//       250 ms: da 1500 o mas. Si saliera 250, el acotado no esta actuando.
//
//    2) EL FRENO ADAPTATIVO (Fases 3 y 4). El freno solo puede hacer una cosa
//       observable desde fuera: ALARGAR el movimiento. Asi que su firma es un
//       contraste, no un numero: los movimientos faciles salen clavados a su
//       duracion nominal y los duros salen estirados un 5-20%. Medido en la
//       pasada del 2026-11-13: swing/updown/moonwalk dieron 2004-2023 ms sobre
//       2000 nominales (0-1%), mientras flapping, crusaito y ascendingTurn se
//       estiraron un 10-15%. SI TODO SALE CLAVADO, EL FRENO ESTA MUERTO.
//
//  LAS LLAMADAS SON LAS QUE EMITEN LOS BLOQUES, verbatim. Sacadas de
//  www/blocs&generateurs/ottoesp.js y www/lang/Arduino_es.js:
//    bloque Mover:  Otto.walk(1,V,1|-1)  Otto.turn(1,V,1|-1)
//    bloque Hacer:  Otto.<mov>(1, V, TAM)
//    bloque Bailar: Otto.<mov>(1, V, TAM, 1|-1)
//    gestos:        Otto.jump(1,V)  Otto.bend(1,V,dir)  Otto.shakeLeg(1,V,dir)
//    V   (velocidad): Normal 2000, Lento 3500, Rapido 1500   <- solo estos tres
//    TAM (tamano):    Normal 25, Pequeno 10, Grande 40
//
//  COMO SE LEE LA SALIDA. Una linea por movimiento:
//
//    OTTO,val,swing,V=1500,TAM=25,nominal=1250,medido=1281,estiro=+2%,sin freno
//                                   |             |          |
//                                   |             |          +-- el freno actuo?
//                                   |             +-- lo que midio millis()
//                                   +-- max(V, 50 x amplitud) = lo que DEBE durar
//
//  VEREDICTOS:
//    "sin freno"      estiro <= 3%. Normal en los movimientos faciles.
//    "freno +N%"      el freno alargo el movimiento. Normal en los duros.
//    "!! BAJO SUELO"  duro MENOS que su suelo teorico: el acotado no esta
//                     actuando. Esto si es un fallo.
//
//  AL FINAL imprime un resumen con las tres preguntas resueltas en una linea cada
//  una, para no tener que interpretar la tabla.
//
//  PILAS O USB
//    El serie exige USB, y por USB la alimentacion ENTRA POR UN SCHOTTKY y se
//    salta el regulador, asi que las caidas son ~2.3 veces menores y el freno
//    casi no actua. Esta prueba mide TIEMPOS, no tension, asi que por USB sirve
//    igual para comprobar que todo se ejecuta y que el acotado actua. Pero el
//    contraste del freno se ve mejor con PILAS, siguiendo los pitidos.
//
//  LOS PITIDOS (buzzer en el pin 13), para seguirlo sin terminal:
//    tres notas descendentes -> arranco setup(). Si suenan a mitad, SE REINICIO.
//    N pitidos agudos        -> empieza la parte N (hay 5)
//    cuatro notas graves     -> terminado, servos sueltos, se puede apagar
//
//  ----------------------------------------------------------------------------
//  PROTOCOLO DEL A/B DEL FRENO (la medida que falta desde la Fase 3)
//
//  Lo que se mide NO es la tension -sin instrumentado no hay forma- sino HASTA
//  DONDE LLEGA la secuencia completa antes de que la placa se reinicie. El canal
//  es el buzzer: nota grave larga + N pitidos marca la parte N, y un tic corto
//  precede a cada movimiento. Contando "parte + tics" se sabe el punto exacto.
//
//  CORRER LAS DOS CON LAS MISMAS PILAS, SEGUIDAS Y EN ESTE ORDEN:
//
//    B1  OTTO_BRAKE 0  en Otto.h   <- PRIMERO, con las pilas mas frescas
//    B2  OTTO_BRAKE 1  en Otto.h   <- DESPUES, con las pilas ya algo gastadas
//
//  El orden es a proposito y va CONTRA el freno: le da las peores pilas. Asi, si
//  la pasada con freno llega MAS LEJOS que la de control a pesar de correr con
//  menos bateria, la conclusion es solida y no un artefacto del envejecimiento,
//  que es el confusor que arruino cinco pasadas al principio del proyecto.
//
//  LECTURA:
//    B1 muere antes que B2  -> el freno esta ganando: se queda
//    B1 y B2 mueren igual   -> el freno no aporta: sobran ~1.5 KB y el 5-16% de
//                              alargamiento de los movimientos duros
//    ninguna muere          -> la condicion no discrimina; hay que endurecerla
//                              (bajar PAUSA_MS y PAUSA_PARTE_MS) y repetir
//
//  RESULTADO, YA MEDIDO (2026-11-13, con pilas, cinco pasadas, diseno ABA):
//
//    BRAKE  pilas      murio en                        movimiento
//    -----  ---------  ------------------------------  ----------
//      0    frescas    walk_adelante 1500                  7
//      0    frescas    crusaito 2000 T25                   5
//      0    AGOTADAS   walk_adelante 2000                  8
//      1    usadas     jitter 1500 T10                    16
//      1    frescas    -- NO MURIO: completo los 25 --   >25
//
//  SIN FRENO: 5, 7, 8.   CON FRENO: 16 y >25.  Sin solape.
//
//  LA COMPARACION LIMPIA es la de pilas frescas contra pilas frescas: sin freno
//  5 y 7; con freno COMPLETA LOS 25. Una sola variable y el resultado es
//  categorico. La pasada con freno y pilas frescas esta censurada por la derecha
//  -no murio, asi que 25 es una cota inferior, no su punto de fallo-.
//
//  Y B3 llego MAS LEJOS que las dos de control teniendo PEORES pilas, lo que
//  descarta la bateria como variable dominante: sin freno lo que mata la placa
//  son los movimientos, no el agotamiento. El punto de muerte sin freno es
//  estable en 5-8 pase lo que pase con las pilas.
//
//  LOS TRES PUNTOS DE MUERTE SIN FRENO SON BLOQUES NORMALES: crusaito a Normal,
//  walk a Rapido y walk a Normal. Dos de tres son el bloque de caminar. Ninguno
//  es un caso rebuscado: sin freno, un programa de aula de cinco bloques tira la
//  placa.
//
//  CONCLUSION: el freno cuesta 1478 B de flash y 31 B de RAM y COMPRA QUE EL
//  PROGRAMA TERMINE. Se queda, y no es discutible con estos datos.
//
//  Y lo que mas importa de cara al aula: SIN FRENO LA PLACA CAE EN walk A
//  "RAPIDO" (1500), que es el bloque mas normal que puede poner un alumno, no un
//  caso rebuscado. Con freno ese mismo tramo dio vmin 3938 en la regresion.
//
//  La muerte de B2 en jitter 1500 T10 no senala debilidad de ese movimiento: tenia
//  vmin 4096 con pilas frescas y es de amplitud 10. A esa altura las pilas llevaban
//  dos pasadas y media. Es agotamiento, no un caso nuevo.
//
//  ----------------------------------------------------------------------------
//
//  Autor: validacion de las fases 1-6. No modifica la libreria ni los bloques.
// ==============================================================================

#include <Otto.h>
Otto Otto;

// --- Pines, los de siempre en esta placa --------------------------------------
#define LeftLeg    2
#define RightLeg   3
#define LeftFoot   4
#define RightFoot  5
#define Buzzer    13

// --- Velocidades y tamanos, exactamente los del desplegable en espanol --------
#define V_RAPIDO   1500
#define V_NORMAL   2000
#define V_LENTO    3500
#define TAM_PEQUE    10
#define TAM_NORMAL   25
#define TAM_GRANDE   40

// Pausa entre movimientos. Otto.home() recentra y desengancha, asi que cada
// medida arranca del mismo estado.
#define PAUSA_MS   1200

// Pausa para la PARTE 4. Los tres gestos de esa parte -jump, bend, shakeLeg- son
// los tres peores del repertorio (vmin 3754, 3897 y 3564 en la pasada del
// 2026-11-13) y van seguidos, asi que necesitan mas margen de recuperacion.
// OttoDiagnostico les daba 2000 ms; con 1200 la placa se reinicia con pilas.
#define PAUSA_GESTO_MS 2500

// Pausa extra al cambiar de parte, para que cada bloque arranque de un estado
// comparable y no herede el agotamiento del anterior.
#define PAUSA_PARTE_MS 2500

// 0 = corre las cinco partes. 1..5 = corre SOLO esa parte.
// Sirve para aislar: si la PARTE 4 sola, con pilas frescas, no reinicia, el
// problema era la acumulacion de carga de los 18 movimientos previos y no los
// gestos en si. Es el experimento que separa las dos causas.
#define OTTO_VAL_PARTE 0

// Umbral de estiramiento, en %, a partir del cual se considera que el freno actuo.
// 3% cubre el ruido de millis() y el coste del attach de los servos.
#define UMBRAL_FRENO_PCT  3

// --- Movimientos -------------------------------------------------------------
enum {
  M_SWING, M_UPDOWN, M_TIPTOE, M_JITTER, M_ASCTURN,       // bloque "Hacer"
  M_MOON, M_CRUSA, M_FLAP,                                // bloque "Bailar"
  M_WALKF, M_WALKB, M_TURNL, M_TURNR,                     // bloque "Mover"
  M_JUMP, M_BEND, M_SHAKE                                 // gestos
};

// Los nombres se IMPRIMEN en vez de devolverse: un const char* obliga a que el
// literal viva en RAM, y aqui son 15 cadenas. Con F() se quedan en flash.
static void nombre(uint8_t m) {
  switch (m) {
    case M_SWING:   Serial.print(F("swing"));         break;
    case M_UPDOWN:  Serial.print(F("updown"));        break;
    case M_TIPTOE:  Serial.print(F("tiptoeSwing"));   break;
    case M_JITTER:  Serial.print(F("jitter"));        break;
    case M_ASCTURN: Serial.print(F("ascendingTurn")); break;
    case M_MOON:    Serial.print(F("moonwalker"));    break;
    case M_CRUSA:   Serial.print(F("crusaito"));      break;
    case M_FLAP:    Serial.print(F("flapping"));      break;
    case M_WALKF:   Serial.print(F("walk_adelante")); break;
    case M_WALKB:   Serial.print(F("walk_atras"));    break;
    case M_TURNL:   Serial.print(F("turn_izq"));      break;
    case M_TURNR:   Serial.print(F("turn_der"));      break;
    case M_JUMP:    Serial.print(F("jump"));          break;
    case M_BEND:    Serial.print(F("bend"));          break;
    case M_SHAKE:   Serial.print(F("shakeLeg"));      break;
    default:        Serial.print('?');                break;
  }
}

// Amplitud MAYOR de cada marcha, que es lo que fija su suelo de T. Los recortes
// internos estan copiados de la libreria: jitter hace h=min(25,h) y
// ascendingTurn hace h=min(13,h); crusaito arranca de 25 en las caderas y
// flapping de 12, asi que su amplitud mayor nunca baja de ahi.
// Devuelve 0 para los gestos, que no son marchas y no llevan acotado.
static int amplitudMayor(uint8_t m, int tam) {
  switch (m) {
    case M_SWING: case M_UPDOWN: case M_TIPTOE: case M_MOON:
      return tam;
    case M_JITTER:  return (tam < 25) ? tam : 25;
    case M_ASCTURN: return (tam < 13) ? tam : 13;
    case M_CRUSA:   return (tam > 25) ? tam : 25;
    case M_FLAP:    return (tam > 12) ? tam : 12;
    case M_WALKF: case M_WALKB: case M_TURNL: case M_TURNR:
      return 30;
    default:        return 0;
  }
}

// Las llamadas, calcadas de lo que generan los bloques.
static void ejecuta(uint8_t m, int v, int tam) {
  switch (m) {
    case M_SWING:   Otto.swing(1, v, tam);              break;
    case M_UPDOWN:  Otto.updown(1, v, tam);             break;
    case M_TIPTOE:  Otto.tiptoeSwing(1, v, tam);        break;
    case M_JITTER:  Otto.jitter(1, v, tam);             break;
    case M_ASCTURN: Otto.ascendingTurn(1, v, tam);      break;
    case M_MOON:    Otto.moonwalker(1, v, tam, 1);      break;
    case M_CRUSA:   Otto.crusaito(1, v, tam, 1);        break;
    case M_FLAP:    Otto.flapping(1, v, tam, 1);        break;
    case M_WALKF:   Otto.walk(1, v, 1);                 break;
    case M_WALKB:   Otto.walk(1, v, -1);                break;
    case M_TURNL:   Otto.turn(1, v, 1);                 break;
    case M_TURNR:   Otto.turn(1, v, -1);                break;
    case M_JUMP:    Otto.jump(1, v);                    break;
    case M_BEND:    Otto.bend(1, v, 1);                 break;
    case M_SHAKE:   Otto.shakeLeg(1, v, 1);             break;
  }
}

// --- Avisos sonoros ----------------------------------------------------------
// Van SIEMPRE con los servos desenganchados y con silencio a los lados, asi que
// no se cuelan en ninguna medida de tiempo.
static void nota(unsigned int hz, unsigned long ms) {
  tone(Buzzer, hz, ms);
  delay(ms + 40);
  noTone(Buzzer);
}
static void avisoArranque() {               // se reinicio, si suena a mitad
  nota(1047, 90); nota(831, 90); nota(659, 160);
}
static void avisoParte(uint8_t n) {
  delay(350);
  nota(440, 260);          // nota GRAVE y larga: frontera de parte, nunca un tic
  delay(200);
  for (uint8_t i = 0; i < n; i++) { nota(2093, 70); delay(90); }
  delay(350);
}
// Un tic corto ANTES de cada movimiento. Con pilas no hay puerto serie, asi que
// el buzzer es el unico canal: contando los tics desde el marcador de parte se
// sabe EXACTAMENTE en que movimiento se reinicio la placa. Suena con los servos
// desenganchados y antes de arrancar el cronometro, asi que no entra en la medida.
static void tic() { nota(3136, 35); delay(60); }

static void avisoFin() {
  delay(350);
  for (uint8_t i = 0; i < 4; i++) { nota(330, 170); delay(110); }
}

// --- Resumen acumulado -------------------------------------------------------
static uint8_t  nMarchas    = 0;   // marchas medidas
static uint8_t  nBajoSuelo  = 0;   // marchas que duraron menos que su suelo
static uint8_t  nConFreno   = 0;   // marchas estiradas por encima del umbral
static int      peorEstiro  = 0;   // mayor estiramiento visto, en %
static uint8_t  peorMov     = 0;   // en que movimiento
static uint8_t  nTotal      = 0;   // movimientos ejecutados en total

// --- Una medida --------------------------------------------------------------
static unsigned long pausaMs = PAUSA_MS;   // la fija cada parte

static void mide(uint8_t m, int v, int tam) {
  tic();
  const int  amax    = amplitudMayor(m, tam);
  const long suelo   = 50L * (long)amax;            // la regla de la Fase 5d
  const long nominal = (amax == 0) ? 0
                     : ((long)v > suelo ? (long)v : suelo);

  const unsigned long t0 = millis();
  ejecuta(m, v, tam);
  const unsigned long dt = millis() - t0;
  nTotal++;

  Serial.print(F("OTTO,val,"));
  nombre(m);
  Serial.print(F(",V="));      Serial.print(v);
  if (amax > 0 || tam > 0) { Serial.print(F(",TAM=")); Serial.print(tam); }

  if (nominal > 0) {
    const int estiro = (int)(((long)dt - nominal) * 100L / nominal);
    Serial.print(F(",nominal="));  Serial.print(nominal);
    Serial.print(F(",medido="));   Serial.print(dt);
    Serial.print(F(",estiro="));
    if (estiro >= 0) Serial.print('+');
    Serial.print(estiro); Serial.print('%');

    nMarchas++;
    if ((long)dt < (nominal * 95L) / 100L) {
      nBajoSuelo++;
      Serial.println(F(",!! BAJO SUELO -- el acotado NO actua"));
    } else if (estiro > UMBRAL_FRENO_PCT) {
      nConFreno++;
      if (estiro > peorEstiro) { peorEstiro = estiro; peorMov = m; }
      Serial.println(F(",freno actuando"));
    } else {
      Serial.println(F(",sin freno"));
    }
  } else {
    // Gestos: su duracion no la fija T de forma simple (bend ignora T para la
    // velocidad y shakeLeg solo lo usa para la sacudida), asi que no hay nominal
    // con el que comparar. Se imprime el tiempo para que quede constancia de que
    // se ejecutaron y de cuanto tardan.
    Serial.print(F(",medido="));  Serial.print(dt);
    Serial.println(F(",gesto -- sin nominal comparable"));
  }

  Otto.home();
  delay(pausaMs);
}

// =============================================================================
void setup() {
  // IMPRESCINDIBLE: con OTTO_INSTRUMENT a 0 la libreria no abre el serie.
  Serial.begin(115200);
  delay(300);

  Otto.init(LeftLeg, RightLeg, LeftFoot, RightFoot, true, Buzzer);
  Otto.home();

  Serial.println();
  Serial.println(F("OTTO,val,inicio -- validacion de la libreria entregada"));
  Serial.print  (F("OTTO,val,instrumentado="));
#if OTTO_INSTRUMENT
  Serial.println(F("1 (modo diagnostico: este sketch tambien vale, pero la "
                   "version entregada lleva 0)"));
#else
  Serial.println(F("0 (version entregada)"));
#endif
  Serial.print  (F("OTTO,val,freno="));
  Serial.print(OTTO_BRAKE);
  Serial.print  (F(",acotado_ms_por_grado="));
  Serial.print(OTTO_GAIT_T_PER_DEG);
  Serial.print  (F(",troceado="));
  Serial.println(OTTO_MV_TRV_CHUNK);

  avisoArranque();
  delay(600);
}

void loop() {
  // --- PARTE 1: el contraste del freno -------------------------------------
  // Tres faciles y tres duros, todos a Normal y tamano Normal. Lo que valida no
  // es ningun numero suelto, es que los tres primeros salgan clavados y los tres
  // ultimos estirados. Si los seis salen clavados, el freno no esta actuando.
#if OTTO_VAL_PARTE == 0 || OTTO_VAL_PARTE == 1
  Serial.println(F("OTTO,val,PARTE 1 -- contraste del freno (faciles vs duros)"));
  pausaMs = PAUSA_MS;
  avisoParte(1);
  mide(M_SWING,   V_NORMAL, TAM_NORMAL);
  mide(M_UPDOWN,  V_NORMAL, TAM_NORMAL);
  mide(M_MOON,    V_NORMAL, TAM_NORMAL);
  mide(M_ASCTURN, V_NORMAL, TAM_NORMAL);
  mide(M_CRUSA,   V_NORMAL, TAM_NORMAL);
  mide(M_FLAP,    V_NORMAL, TAM_NORMAL);
  delay(PAUSA_PARTE_MS);
#endif

  // --- PARTE 2: los tres bloques de velocidad ------------------------------
  // Marcha y giro con los tres valores del desplegable. Los tres estan en o por
  // encima del suelo de walk y turn (1500), asi que NINGUNO deberia quedar
  // acotado: es la comprobacion de que la Fase 5d no toca los bloques.
#if OTTO_VAL_PARTE == 0 || OTTO_VAL_PARTE == 2
  Serial.println(F("OTTO,val,PARTE 2 -- los tres bloques de velocidad"));
  pausaMs = PAUSA_MS;
  avisoParte(2);
  mide(M_WALKF, V_RAPIDO, TAM_NORMAL);
  mide(M_WALKF, V_NORMAL, TAM_NORMAL);
  mide(M_WALKF, V_LENTO,  TAM_NORMAL);
  mide(M_WALKB, V_RAPIDO, TAM_NORMAL);
  mide(M_TURNL, V_RAPIDO, TAM_NORMAL);
  mide(M_TURNR, V_RAPIDO, TAM_NORMAL);
  delay(PAUSA_PARTE_MS);
#endif

  // --- PARTE 3: los tres tamanos -------------------------------------------
  // El suelo escala con la amplitud, asi que el tamano es la palanca real de
  // velocidad. A Rapido (1500): swing Pequeno tiene suelo 500 y corre a 1500 sin
  // acotar; swing Grande tiene suelo 2000 y SE ACOTA, o sea que durara ~2000 aun
  // habiendo pedido 1500. Eso es el acotado visible desde los bloques.
#if OTTO_VAL_PARTE == 0 || OTTO_VAL_PARTE == 3
  Serial.println(F("OTTO,val,PARTE 3 -- los tres tamanos a Rapido"));
  pausaMs = PAUSA_MS;
  avisoParte(3);
  mide(M_SWING, V_RAPIDO, TAM_PEQUE);
  mide(M_SWING, V_RAPIDO, TAM_NORMAL);
  mide(M_SWING, V_RAPIDO, TAM_GRANDE);
  mide(M_JITTER, V_RAPIDO, TAM_PEQUE);
  mide(M_TIPTOE, V_RAPIDO, TAM_GRANDE);
  mide(M_FLAP,   V_RAPIDO, TAM_GRANDE);
  delay(PAUSA_PARTE_MS);
#endif

  // --- PARTE 4: los gestos --------------------------------------------------
  // No llevan acotado porque no son marchas. Se ejecutan para dejar constancia
  // de que funcionan y de cuanto tardan. OJO con shakeLeg: su pose intermedia
  // devuelve el pie al suelo a proposito (ver el comentario en Otto.cpp); se ve
  // raro y es lo correcto, porque es lo que impide que el robot se caiga.
#if OTTO_VAL_PARTE == 0 || OTTO_VAL_PARTE == 4
  Serial.println(F("OTTO,val,PARTE 4 -- gestos (los tres peores del repertorio)"));
  pausaMs = PAUSA_GESTO_MS;
  avisoParte(4);
  mide(M_JUMP,  V_NORMAL, 0);
  mide(M_BEND,  V_NORMAL, 0);
  mide(M_SHAKE, V_NORMAL, 0);
  delay(PAUSA_PARTE_MS);
#endif

  // --- PARTE 5: el acotado, con valores que los bloques NO pueden pedir -----
  // Desde Blockly lo mas rapido es 1500, que es justo el suelo de walk, asi que
  // el acotado es invisible. Aqui se pide por debajo a proposito para verlo. Si
  // estas lineas dieran ~250 ms, el acotado no estaria compilado.
#if OTTO_VAL_PARTE == 0 || OTTO_VAL_PARTE == 5
  Serial.println(F("OTTO,val,PARTE 5 -- acotado (valores fuera del alcance de "
                   "los bloques, solo para verlo actuar)"));
  pausaMs = PAUSA_MS;
  avisoParte(5);
  mide(M_WALKF, 250, TAM_NORMAL);   // suelo 1500 -> debe durar ~1500, no 250
  mide(M_WALKF, 750, TAM_NORMAL);   // suelo 1500 -> debe durar ~1500
  mide(M_SWING, 250, TAM_NORMAL);   // suelo 1250 -> debe durar ~1250
  mide(M_ASCTURN, 250, TAM_NORMAL); // suelo  650 -> debe durar ~650
#endif

  // --- Resumen --------------------------------------------------------------
  Serial.println();
  Serial.println(F("OTTO,val,===================== RESUMEN ====================="));
  Serial.print  (F("OTTO,val,movimientos ejecutados: ")); Serial.println(nTotal);

  Serial.print(F("OTTO,val,1) EL ACOTADO DE T (5d): "));
  if (nBajoSuelo == 0) {
    Serial.print(F("las "));
    Serial.print(nMarchas);
    Serial.println(F(" marchas respetaron su suelo -> ACOTADO OK"));
  } else {
    Serial.print(nBajoSuelo);
    Serial.print(F(" de "));
    Serial.print(nMarchas);
    Serial.println(F(" marchas duraron MENOS que su suelo -> FALLO: revisar "
                     "OTTO_GAIT_T_PER_DEG en Otto.h"));
  }

  Serial.print(F("OTTO,val,2) EL FRENO ADAPTATIVO: "));
#if !OTTO_BRAKE
  Serial.println(F("COMPILADO FUERA (OTTO_BRAKE=0). Lo esperado es que no se "
                   "estire nada: esta es la pasada de control del A/B."));
  (void)peorEstiro; (void)peorMov;
#else
  if (nConFreno == 0) {
    Serial.println(F("ninguna marcha se estiro -> EL FRENO NO ESTA ACTUANDO."));
    Serial.println(F("OTTO,val,   Si estas por USB es normal: la alimentacion "
                     "entra por un Schottky, se salta el regulador y casi no "
                     "hay caida que frenar. Repitelo CON PILAS."));
  } else {
    Serial.print(nConFreno);
    Serial.print(F(" marchas estiradas; la peor fue "));
    nombre(peorMov);
    Serial.print(F(" con +")); Serial.print(peorEstiro);
    Serial.println(F("% -> FRENO VIVO"));
  }
#endif

  Serial.print(F("OTTO,val,3) LOS BLOQUES: "));
  Serial.println(F("si las lineas de la PARTE 2 salieron con estiro pequeno y "
                   "nominal igual a V, los bloques de velocidad no han "
                   "cambiado de comportamiento."));
  Serial.println(F("OTTO,val,fin -- se puede apagar"));

  Otto.home();
  Otto.detachServos();
  avisoFin();
  for (;;) { delay(1000); }
}
