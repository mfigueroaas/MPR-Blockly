#if defined(ARDUINO) && ARDUINO >= 100
  #include "Arduino.h"
#else
  #include "WProgram.h"
  #include <pins_arduino.h>
#endif
#include "Otto.h"
#include "Oscillator.h"

// Optional: round-robin servo refresh to reduce current spikes
#ifndef OTTO_ROUND_ROBIN_OSC
#define OTTO_ROUND_ROBIN_OSC 1
#endif

#if (OTTO_DBG) || (OTTO_INSTRUMENT)
void ottoSerialBegin() {
  // En AVR, HardwareSerial::operator bool() devuelve siempre true, de modo que el
  // clasico "if (!Serial) Serial.begin(...)" nunca llegaba a abrir el puerto y las
  // trazas de depuracion no salian jamas. Se usa un cerrojo propio de una sola vez.
  static bool opened = false;
  if (!opened) {
    Serial.begin(OTTO_DBG_BAUD);
    opened = true;
  }
}
#endif

#if (OTTO_INSTRUMENT) || (OTTO_EEPROM_LOG)
//-- Nombre legible de cada codigo de movimiento (Fase 2a). Vive en flash.
static const __FlashStringHelper* ottoKindName(uint8_t k) {
  switch (k) {
    case OTTO_K_BOOT:     return F("ARRANQUE");
    case OTTO_K_HOME_P:   return F("home:pies");
    case OTTO_K_HOME_C:   return F("home:cad");
    case OTTO_K_JUMP:     return F("jump");
    case OTTO_K_WALK:     return F("walk");
    case OTTO_K_TURN:     return F("turn");
    case OTTO_K_BEND:     return F("bend");
    case OTTO_K_SHAKE:    return F("shakeLeg");
    case OTTO_K_UPDOWN:   return F("updown");
    case OTTO_K_SWING:    return F("swing");
    case OTTO_K_TIPTOE:   return F("tiptoe");
    case OTTO_K_JITTER:   return F("jitter");
    case OTTO_K_ASCTURN:  return F("ascTurn");
    case OTTO_K_MOONW:    return F("moonwalk");
    case OTTO_K_CRUSAITO: return F("crusaito");
    case OTTO_K_FLAP:     return F("flapping");
    case OTTO_K_GESTURE:  return F("gesto");
    default:              return F("mv");
  }
}
#endif

//-- El freno de la Fase 3 tambien necesita leer el rail, asi que esto vive fuera
//-- del bloque de instrumentacion: se compila si hace falta para cualquiera de los dos.
#if (OTTO_INSTRUMENT) || (OTTO_BRAKE)
//-- Lee el rail de alimentacion del propio microcontrolador sin ningun componente
//-- externo. Se multiplexa el ADC al canal de la referencia interna de 1.1 V
//-- usando AVcc como referencia de fondo de escala; entonces:
//--      Vcc = 1.1 V * 1024 / lectura
//-- Es decir, cuanto mas cae Vcc, mas ALTA es la lectura del ADC.
static uint16_t ottoReadVccMilliVolts() {
#if defined(__AVR__)
  ADCSRA |= _BV(ADEN);                                   // asegurar ADC habilitado
  // REFS0 = 1        -> referencia = AVcc
  // MUX[3:0] = 1110  -> canal = referencia de banda prohibida (1.1 V)
  ADMUX = _BV(REFS0) | _BV(MUX3) | _BV(MUX2) | _BV(MUX1);
  delayMicroseconds(200);                                // asentamiento de la referencia
  ADCSRA |= _BV(ADSC);                                   // 1a conversion: se descarta
  while (ADCSRA & _BV(ADSC)) { }
  (void)ADC;
  ADCSRA |= _BV(ADSC);                                   // 2a conversion: valida
  while (ADCSRA & _BV(ADSC)) { }
  uint16_t raw = ADC;                                    // lee ADCL y luego ADCH
  if (raw == 0) return 0;
  return (uint16_t)(((uint32_t)OTTO_VCC_BANDGAP_MV * 1024UL) / (uint32_t)raw);
#else
  return 0;                                              // no disponible fuera de AVR
#endif
}
#endif

//-- Empaquetado del ritmo: promedio en el nibble alto, minimo en el bajo, pasos de 7.
static inline uint8_t ottoGainPack(uint8_t media, uint8_t peor) {
  if (media > 98) media = 98;
  if (peor  > 98) peor  = 98;
  return (uint8_t)(((media / 7) << 4) | (peor / 7));
}

#if OTTO_INSTRUMENT
///////////////////////////////////////////////////////////////////
//-- INSTRUMENTACION (Fase 1) -----------------------------------//
///////////////////////////////////////////////////////////////////

void Otto::_instrBegin(const __FlashStringHelper* tag) {
  if (_instrDepth++ > 0) return;        // ya hay un tramo externo midiendo
  ottoSerialBegin();
  //-- Copia de la etiqueta AQUI, no al cerrar: asi un home() anidado dentro de un
  //-- gesto no le roba la etiqueta al gesto que lo contiene.
  _segKind     = _instrKind;
  _instrTag    = tag;
  _instrT0     = millis();
  _instrLastMs = _instrT0;
  _vccBefore   = ottoReadVccMilliVolts();
  _vccMin      = _vccBefore;
  _vccLowA     = 0;
  _vccLowB     = 0;
  _wPeakAgg    = 0;
  for (int i = 0; i < 4; i++) {
    _instrLastPos[i] = servo[i].getPosition();
    _wPeak[i]        = 0;
    _degTravel[i]    = 0;
  }
}

//-- Se llama desde los bucles de espera activa, que giran a ritmo de microsegundos.
//-- La primera comprobacion la hace barata: solo se mide cada OTTO_INSTR_SAMPLE_MS.
void Otto::_instrSample() {
  if (_instrDepth == 0) return;
  unsigned long now = millis();
  unsigned long dt  = now - _instrLastMs;
  if (dt < (unsigned long)OTTO_INSTR_SAMPLE_MS) return;
  _instrLastMs = now;

  uint16_t v = ottoReadVccMilliVolts();
  if (v > 0 && v < _vccMin) _vccMin = v;
  if (v > 0) {
    if (v < (uint16_t)OTTO_VCC_LOW_A_MV && _vccLowA < 15) _vccLowA++;
    if (v < (uint16_t)OTTO_VCC_LOW_B_MV && _vccLowB < 15) _vccLowB++;
  }

  int agg = 0;
  for (int i = 0; i < 4; i++) {
    int p = servo[i].getPosition();
    int d = p - _instrLastPos[i];
    if (d < 0) d = -d;
    _instrLastPos[i] = p;
    _degTravel[i] += d;
    int w = (int)(((long)d * 1000L) / (long)dt);   // grados por segundo
    if (w > _wPeak[i]) _wPeak[i] = w;
    agg += w;
  }
  if (agg > _wPeakAgg) _wPeakAgg = agg;
}

//-- Emite una linea CSV por tramo de movimiento. Campos:
//--   dur    duracion real del tramo, en ms (comparar con la pedida)
//--   vbefore/vmin/sag  rail antes, minimo y caida, en mV
//--   wpk    pico de la suma de velocidades angulares de los 4 servos (grados/s)
//--   w      pico por servo: YL/YR/RL/RR
//--   trv    grados recorridos por servo, y total (proxy de energia mecanica)
void Otto::_instrEnd() {
  if (_instrDepth == 0) return;
  if (--_instrDepth > 0) return;

  unsigned long dur = millis() - _instrT0;
  long trvTotal = _degTravel[0] + _degTravel[1] + _degTravel[2] + _degTravel[3];
  //-- Se consume aqui y se devuelve a 1: los gestos que no pasan por _moveServos
  //-- (las marchas) no lo tocan, asi que tienen que verlo en 1.
  uint8_t nch = _mvChunks; _mvChunks = 1;
  if (nch < 1) nch = 1;
  if (nch > 4) nch = 4;

  Serial.print(F("OTTO,"));
  Serial.print(_instrTag);
  Serial.print('/');
  Serial.print(ottoKindName(_segKind));
  Serial.print(F(",dur="));     Serial.print(dur);
  Serial.print(F(",vbefore=")); Serial.print(_vccBefore);
  Serial.print(F(",vmin="));    Serial.print(_vccMin);
  Serial.print(F(",sag="));     Serial.print((int)_vccBefore - (int)_vccMin);
  Serial.print(F(",wpk="));     Serial.print(_wPeakAgg);
  Serial.print(F(",w="));
  for (int i = 0; i < 4; i++) { if (i) Serial.print('/'); Serial.print(_wPeak[i]); }
  Serial.print(F(",trv="));
  for (int i = 0; i < 4; i++) { if (i) Serial.print('/'); Serial.print(_degTravel[i]); }
  Serial.print(F(",trvtot="));  Serial.print(trvTotal);
  if (nch > 1) { Serial.print(F(",tr=")); Serial.print(nch); }
  Serial.print(F(",g="));       Serial.print(OTTO_BRAKE_WORST());
  Serial.print(F(",gm="));      Serial.print(OTTO_BRAKE_MEAN());
  //-- Muestras de 10 ms por debajo de cada umbral, saturadas en 15.
  Serial.print(F(",bajoA="));   Serial.print(_vccLowA);
  Serial.print(F(",bajoB="));   Serial.print(_vccLowB);
  Serial.println();

#if OTTO_EEPROM_LOG
  //-- Se anota DESPUES de imprimir, con el tramo ya terminado: la escritura de
  //-- EEPROM es lenta y no debe caer dentro del movimiento que esta midiendo.
  //-- El byte +9 del registro lleva el ritmo del freno... salvo en los tramos SIN
  //-- recorrido, donde el freno no entra en juego y por tanto ese byte no llevaba
  //-- ninguna informacion (siempre 98/98 desde la Fase 3e). En esos tramos guarda en
  //-- su lugar cuanto TIEMPO estuvo el rail bajo, que es justo lo que hace falta para
  //-- corroborar un caso como el hold_90 que midio 1534 mV de caida con trvtot=0: con
  //-- una sola muestra no se puede distinguir un pico raro del ADC de un hundimiento
  //-- real. El volcado sabe cual de las dos cosas esta leyendo porque tiene trvtot.
  //-- El numero de trozos va en los 2 bits ALTOS de trvtot. El recorrido real nunca
  //-- pasa de ~1200 grados (lo maximo medido es 1191 en walk), asi que 14 bits
  //-- (16383) sobran y no hay que ampliar el registro de 10 bytes.
  long trvRec = (trvTotal > 16383L) ? 16383L : trvTotal;
  uint16_t trvPack = (uint16_t)trvRec | (uint16_t)((uint16_t)(nch - 1) << 14);

  uint8_t byte9;
  if (trvTotal == 0) byte9 = (uint8_t)(((_vccLowB & 0x0F) << 4) | (_vccLowA & 0x0F));
  else               byte9 = ottoGainPack((uint8_t)OTTO_BRAKE_MEAN(),
                                          (uint8_t)OTTO_BRAKE_WORST());
  _eepLogAppend(_segKind, (uint16_t)dur, _vccBefore, _vccMin, trvPack, byte9);
#endif

  //-- La etiqueta es de un solo uso: quien produzca varios tramos (jump, bend,
  //-- shakeLeg) la vuelve a poner antes de cada uno.
  _instrKind = OTTO_K_MV;
}
#endif  // OTTO_INSTRUMENT


#if OTTO_EEPROM_LOG
///////////////////////////////////////////////////////////////////
//-- REGISTRO EN EEPROM (Fase 1b) -------------------------------//
///////////////////////////////////////////////////////////////////
// Disposicion, a partir de OTTO_EEPROM_LOG_BASE:
//   +0  magic 0xA7
//   +1  magic 0x1C
//   +2  writeIndex (uint16, monotono: cuantos tramos se han anotado nunca)
//   +4  bootCount  (uint16)
//   +6  worstVmin  (uint16, mV; 0xFFFF si aun no hay dato)
//   +8  reservado
//   +10 primer tramo
// Cada tramo ocupa 10 bytes: kind(1) dur(2) vbefore(2) vmin(2) trvtot(2) gain(1)
//
// El byte de ritmo lleva DOS cifras empaquetadas a 4 bits (Fase 3b): el promedio del
// tramo en el nibble alto y el minimo en el bajo, ambos en pasos de 7 puntos. Caben
// los dos sin gastar un byte mas, y 7 puntos de resolucion sobran para decidir. Hizo
// falta porque guardar solo el minimo escondia el fallo de la Fase 3: el minimo
// marcaba 35 mientras el promedio era 94, o sea que el freno no frenaba.

#define OTTO_EEP_MAGIC0   0xA7
#define OTTO_EEP_MAGIC1   0x1C
#define OTTO_EEP_HDR      (OTTO_EEPROM_LOG_BASE)
#define OTTO_EEP_SLOT0    (OTTO_EEPROM_LOG_BASE + 10)
#define OTTO_EEP_SLOTSZ   10

void Otto::_eepLogInit() {
  if (EEPROM.read(OTTO_EEP_HDR + 0) != OTTO_EEP_MAGIC0 ||
      EEPROM.read(OTTO_EEP_HDR + 1) != OTTO_EEP_MAGIC1) {
    //-- Primera vez, o EEPROM con basura: se crea la cabecera.
    EEPROM.update(OTTO_EEP_HDR + 0, OTTO_EEP_MAGIC0);
    EEPROM.update(OTTO_EEP_HDR + 1, OTTO_EEP_MAGIC1);
    //-- OJO: no usar nombres como "zero", "one"... : Otto_mouths.h los define
    //-- como macros de formas de boca y colisionan.
    uint16_t val0 = 0, valSinDato = 0xFFFF;
    EEPROM.put(OTTO_EEP_HDR + 2, val0);        // writeIndex
    EEPROM.put(OTTO_EEP_HDR + 4, val0);        // bootCount
    EEPROM.put(OTTO_EEP_HDR + 6, valSinDato);  // worstVmin
  }
}

void Otto::_eepLogAppend(uint8_t kind, uint16_t dur,
                         uint16_t vbefore, uint16_t vmin, uint16_t trvtot,
                         uint8_t gain) {
  uint16_t idx;
  EEPROM.get(OTTO_EEP_HDR + 2, idx);

  int addr = OTTO_EEP_SLOT0 + (int)(idx % OTTO_EEPROM_LOG_SLOTS) * OTTO_EEP_SLOTSZ;
  EEPROM.update(addr + 0, kind);
  EEPROM.put(addr + 1, dur);
  EEPROM.put(addr + 3, vbefore);
  EEPROM.put(addr + 5, vmin);
  EEPROM.put(addr + 7, trvtot);
  //-- El byte +9 era relleno. Ahora guarda el peor ritmo que permitio el freno
  //-- durante el tramo, en % del nominal: 100 = no freno nada.
  EEPROM.update(addr + 9, gain);

  idx++;
  EEPROM.put(OTTO_EEP_HDR + 2, idx);

  //-- Marca de agua del peor minimo de toda la vida del registro.
  if (vmin > 0) {
    uint16_t worst;
    EEPROM.get(OTTO_EEP_HDR + 6, worst);
    if (vmin < worst) EEPROM.put(OTTO_EEP_HDR + 6, vmin);
  }
}

void Otto::_eepLogDump() {
  uint16_t idx, boots, worst;
  EEPROM.get(OTTO_EEP_HDR + 2, idx);
  EEPROM.get(OTTO_EEP_HDR + 4, boots);
  EEPROM.get(OTTO_EEP_HDR + 6, worst);

  //-- Cuantos tramos hay realmente guardados y por cual empezar a leer.
  uint16_t stored = (idx < OTTO_EEPROM_LOG_SLOTS) ? idx : OTTO_EEPROM_LOG_SLOTS;
  uint16_t first  = (idx < OTTO_EEPROM_LOG_SLOTS) ? 0 : (idx - OTTO_EEPROM_LOG_SLOTS);

  //-- Peor vmin DE LA VENTANA GUARDADA. El de la cabecera es una marca de agua de
  //-- por vida y puede venir de una pasada vieja que ya no esta en el registro, asi
  //-- que informar solo de ese despista. Se recorren los tramos antes de imprimir.
  uint16_t winWorst = 0xFFFF;
  for (uint16_t n = 0; n < stored; n++) {
    const int a = OTTO_EEP_SLOT0 + (int)((first + n) % OTTO_EEPROM_LOG_SLOTS) * OTTO_EEP_SLOTSZ;
    if (EEPROM.read(a + 0) == OTTO_K_BOOT) continue;
    uint16_t vm; EEPROM.get(a + 5, vm);
    if (vm > 0 && vm < winWorst) winWorst = vm;
  }

  Serial.print(F("OTTO,eep,inicio,total="));    Serial.print(idx);
  Serial.print(F(",guardados="));               Serial.print(stored);
  Serial.print(F(",arranques="));               Serial.print(boots);
  Serial.print(F(",peor_vmin="));
  if (winWorst == 0xFFFF) Serial.print(F("na")); else Serial.print(winWorst);
  Serial.print(F(",peor_historico="));
  if (worst == 0xFFFF) Serial.print(F("na")); else Serial.print(worst);
  //-- Que binario produjo esto. Sin esto hay que deducirlo del contenido.
  Serial.print(F(",fase="));                     Serial.print(F(OTTO_FASE));
  //-- Los trims de calibracion (bytes 0-3). Si no son ~0, "90" no es el centro
  //-- real y toda la geometria de los gestos esta desplazada. Una EEPROM virgen
  //-- lee 255, que aqui sale como -1: eso es normal y no afecta.
  Serial.print(F(",trim="));
  for (int t = 0; t < 4; t++) {
    if (t) Serial.print('/');
    int tr = EEPROM.read(t);
    if (tr > 128) tr -= 256;
    Serial.print(tr);
  }
  Serial.println();

  if (stored == 0) {
    Serial.println(F("OTTO,eep,fin,(registro vacio)"));
    return;
  }

  for (uint16_t n = 0; n < stored; n++) {
    uint16_t i = first + n;
    int addr = OTTO_EEP_SLOT0 + (int)(i % OTTO_EEPROM_LOG_SLOTS) * OTTO_EEP_SLOTSZ;
    uint8_t  kind = EEPROM.read(addr + 0);
    uint8_t  gain = EEPROM.read(addr + 9);
    uint16_t dur, vbefore, vmin, trvtot;
    EEPROM.get(addr + 1, dur);
    EEPROM.get(addr + 3, vbefore);
    EEPROM.get(addr + 5, vmin);
    EEPROM.get(addr + 7, trvtot);

    Serial.print(F("OTTO,eep,#")); Serial.print(i); Serial.print(',');
    if (kind == OTTO_K_BOOT) {
      //-- Marca de arranque: si aparece en medio de la secuencia, hubo un reinicio.
      Serial.print(F("ARRANQUE,vcc=")); Serial.println(vbefore);
    } else {
      Serial.print(ottoKindName(kind));
      Serial.print(F(",dur="));     Serial.print(dur);
      Serial.print(F(",vbefore=")); Serial.print(vbefore);
      Serial.print(F(",vmin="));    Serial.print(vmin);
      Serial.print(F(",sag="));     Serial.print((int)vbefore - (int)vmin);
      const uint8_t nch = (uint8_t)((trvtot >> 14) + 1);
      trvtot &= 0x3FFF;
      Serial.print(F(",trvtot=")); Serial.print(trvtot);
      if (nch > 1) { Serial.print(F(",tr=")); Serial.print(nch); }
      //-- Velocidad angular media agregada: la metrica fiable (ver nota en Fase 1).
      if (dur > 0) {
        Serial.print(F(",wmed="));
        Serial.print((uint16_t)(((uint32_t)trvtot * 1000UL) / (uint32_t)dur));
      }
      //-- Ritmo que permitio el lazo cerrado, en % del nominal. 100 = no freno.
      //--   g  = el PEOR instante del tramo. Solo dice si el freno llego a actuar.
      //--   gm = el PROMEDIO del tramo. Es el que dice si el freno gobierno el ritmo,
      //--        y por tanto el unico comparable con (dur real / dur nominal).
      if (trvtot == 0) {
        //-- Tramo sin recorrido: el byte no lleva freno (no hubo), lleva CUANTO
        //-- TIEMPO estuvo el rail bajo. Unidades de 10 ms, 15 = "15 o mas".
        Serial.print(F(",bajoA=")); Serial.print((uint16_t)(gain & 0x0F));
        Serial.print(F(",bajoB=")); Serial.print((uint16_t)(gain >> 4));
      } else {
        Serial.print(F(",g="));  Serial.print((uint16_t)((gain & 0x0F) * 7));
        Serial.print(F(",gm=")); Serial.print((uint16_t)((gain >> 4)   * 7));
      }
      Serial.println();
    }
  }
  Serial.println(F("OTTO,eep,fin"));
}
#endif  // OTTO_EEPROM_LOG



#if OTTO_BRAKE
///////////////////////////////////////////////////////////////////
//-- LAZO CERRADO DE TENSION (Fase 3) ---------------------------//
///////////////////////////////////////////////////////////////////
// Dos granularidades, porque el movimiento tiene dos motores distintos:
//   - _moveServos interpola punto a punto, asi que se le puede frenar el reloj en
//     cualquier momento sin que se note: solo avanza mas despacio por la misma
//     trayectoria.
//   - las marchas son osciladores acoplados por fase. Frenarlas a mitad de ciclo
//     deformaria la senoidal y destruiria el desfase de -90 grados entre caderas y
//     pies, que es justo lo que hace avanzar al bipedo. Por eso ahi el ajuste se
//     aplica ENTRE ciclos, donde la fase es multiplo de 2*pi y el cambio es continuo.

//-- La ley de control, en un sitio, porque se usa dos veces: cada 10 ms sobre la
//-- tension instantanea, y una vez al abrir el tramo sobre la tension en reposo.
uint8_t Otto::_brakeObjetivo(uint16_t v, uint16_t ref) {
  //-- Principal: el margen que queda hasta la tension objetivo.
  int margen = (int)v - (int)OTTO_BRAKE_VMIN_ABS;
  int obj;
  if (margen >= OTTO_BRAKE_MARGIN_BAND) obj = 100;
  else if (margen <= 0)                 obj = OTTO_BRAKE_GAIN_MIN;
  else obj = OTTO_BRAKE_GAIN_MIN + (((100 - OTTO_BRAKE_GAIN_MIN) * margen)
                                    / OTTO_BRAKE_MARGIN_BAND);

  //-- Secundaria: la caida relativa, con banda ancha y solo como seguro. Es lo unico
  //-- inmune a la calibracion de la referencia interna del chip, asi que en una placa
  //-- cuya referencia lea muy desviada es lo que queda en pie. Manda la mas estricta.
  int sag = (int)ref - (int)v;
  if (sag > OTTO_BRAKE_SAG_OK) {
    int obj2;
    if (sag >= OTTO_BRAKE_SAG_MAX) obj2 = OTTO_BRAKE_GAIN_MIN;
    else obj2 = 100 - (((100 - OTTO_BRAKE_GAIN_MIN) * (sag - OTTO_BRAKE_SAG_OK))
                       / (OTTO_BRAKE_SAG_MAX - OTTO_BRAKE_SAG_OK));
    if (obj2 < obj) obj = obj2;
  }
  return (uint8_t)obj;
}

void Otto::_brakeBegin() {
  _brakeRef    = ottoReadVccMilliVolts();
  if (_brakeRef == 0) _brakeRef = 5000;
  _brakeLastMs = millis();
  //-- Se arranca donde lo dejo el movimiento anterior, con un margen de recuperacion.
  //-- Las pilas no se recuperan de golpe, asi que arrastrar el estado es lo que evita
  //-- volver a pegarse el mismo golpe en el gesto siguiente. Es la parte PREVENTIVA
  //-- del lazo, frente a la reactiva de _brakeGain().
  //--
  //-- Dos memorias, con dos constantes de tiempo, porque son dos cosas distintas.
  //--
  //-- 1) El estado del RAIL: _brakeGainCur, el ritmo con el que acabo el gesto
  //--    anterior, mas un margen para reintentar. Las pilas no se recuperan de golpe.
  //--
  //-- 2) Lo aprendido de ESTE movimiento en concreto: _brakeKindGain[kind].
  //--
  //-- La segunda es la que PREVIENE, y hace falta porque el lazo es reactivo: no
  //-- puede evitar la caida que mide, solo responder a ella. Medido en la pasada de la
  //-- Fase 3c: siete tramos con vmin bajo y gm alto, es decir el freno llegando tarde.
  //--
  //-- Las dos fases anteriores se equivocaron en direcciones opuestas. La 3b frenaba
  //-- de entrada TODOS los gestos (su semilla era un trinquete que solo sabia bajar:
  //-- 70 de 87 tramos al 60%, 61 de ellos sin ningun problema). La 3c no frenaba de
  //-- entrada ninguno, y los gestos caros perdieron la proteccion que aquel fallo les
  //-- estaba dando sin querer: bend -296 mV, home:cad -285, shakeLeg -192. Por
  //-- movimiento, cada uno recuerda su propio coste y no paga por el de los demas.
  _brakeKind = (_instrKind <= (uint8_t)OTTO_K_MAX) ? _instrKind : (uint8_t)OTTO_K_MV;
  _instrKind = OTTO_K_MV;            //-- la etiqueta es de un solo uso

  int s2 = (int)_brakeKindGain[_brakeKind] + OTTO_BRAKE_KIND_RECOVER;
  if (s2 > 100) s2 = 100;
  _brakeKindGain[_brakeKind] = (uint8_t)s2;   //-- sube un escalon por cada ejecucion

  //-- El termino del rail se MIDE, no se arrastra. Arrastrar el ritmo del gesto
  //-- anterior penalizaba a los gestos sanos que venian detras de uno caro, y los
  //-- datos dicen que ese arrastre no informa de nada: la tension en reposo antes de
  //-- mover es la misma (4.4-4.9 V) en los tramos sanos y en los que incumplen, asi
  //-- que no predice. Lo que si aporta es el caso de dos movimientos seguidos sin
  //-- pausa, donde el rail aun esta hundido al empezar el segundo: eso esta aqui
  //-- medido y no supuesto. Entre gestos con su pausa, este termino vale 100.
  int s1 = (int)_brakeObjetivo(_brakeRef, _brakeRef);
  int seed = (s1 < s2) ? s1 : s2;             //-- manda la mas prudente de las dos
  if (seed > 100) seed = 100;
  if (seed < OTTO_BRAKE_GAIN_MIN) seed = OTTO_BRAKE_GAIN_MIN;
  _brakeGainCur = (uint8_t)seed;
  _brakeWorst   = (uint8_t)seed;
  _brakeSum     = 0;
  _brakeN       = 0;
}

void Otto::_brakeIdle() {
  //-- Ver la nota en Otto.h. Aqui no se mide tension ni se toca la tabla por
  //-- movimiento: solo se consume la etiqueta y se dejan los acumuladores en limpio,
  //-- para que el registro no herede el g=/gm= del tramo anterior.
  _instrKind    = OTTO_K_MV;
  _brakeGainCur = 100;
  _brakeWorst   = 100;
  _brakeSum     = 0;
  _brakeN       = 0;
}

uint8_t Otto::_brakeGain() {
  const unsigned long now = millis();
  if (now - _brakeLastMs < (unsigned long)OTTO_BRAKE_SAMPLE_MS) return _brakeGainCur;
  _brakeLastMs = now;

  const uint16_t v = ottoReadVccMilliVolts();
  if (v == 0) return _brakeGainCur;          // sin ADC no se frena a ciegas

  int obj = (int)_brakeObjetivo(v, _brakeRef);

  //-- Asimetrico a proposito: frena de golpe, suelta DESPACIO Y LINEAL.
  //--
  //-- La Fase 3 soltaba de forma geometrica, (3*cur+obj)/4 por muestra, que recupera
  //-- el 90% del camino en ~80 ms. Como las caidas de una marcha son picos de par en
  //-- cada apoyo, cada pico se castigaba 80 ms de los 1000 ms del paso y el ritmo
  //-- MEDIO se quedaba en el 94%: el freno marcaba 35 en el registro y no frenaba.
  //-- Con paso lineal, ir del suelo a 100 cuesta (100-GAIN_MIN)*SAMPLE_MS/STEP ms,
  //-- unos 650 ms con los valores por defecto, que es el orden del paso. Ahi si
  //-- gobierna el ritmo medio, que es lo unico que mueve la aguja del consumo.
  if (obj < (int)_brakeGainCur) {
    _brakeGainCur = (uint8_t)obj;
  } else if ((int)_brakeGainCur < obj) {
    int sube = (int)_brakeGainCur + OTTO_BRAKE_RELEASE_STEP;
    if (sube > obj) sube = obj;
    _brakeGainCur = (uint8_t)sube;
  }

  if (_brakeGainCur < OTTO_BRAKE_GAIN_MIN) _brakeGainCur = OTTO_BRAKE_GAIN_MIN;
  if (_brakeGainCur < 1)                   _brakeGainCur = 1;
  if (_brakeGainCur < _brakeWorst) {
    _brakeWorst = _brakeGainCur;
    //-- Solo se escribe cuando de verdad hubo que bajar: asi un movimiento que nunca
    //-- da problemas conserva el 100 y no hereda el mal rato de otro.
    _brakeKindGain[_brakeKind] = _brakeWorst;
  }

  //-- Promedio del tramo: la cifra que de verdad dice cuanto freno hubo.
  _brakeSum += (uint32_t)_brakeGainCur;
  if (_brakeN < 65535u) _brakeN++;
  return _brakeGainCur;
}

uint8_t Otto::_brakeMean() {
  if (_brakeN == 0) return _brakeGainCur;   // tramo mas corto que una muestra
  return (uint8_t)(_brakeSum / (uint32_t)_brakeN);
}
#endif  // OTTO_BRAKE

void Otto::init(int YL, int YR, int RL, int RR, bool load_calibration, int Buzzer) {

  //-- Techo de velocidad angular agregada (Fase 2b). La Fase 4 lo hara dinamico.
  _aggRate = OTTO_AGG_RATE_DEFAULT;
  //-- Sensores: fuera de cualquier #if, no dependen del freno.
  _usLastMs = 0;  _usLastCm = (float)OTTO_US_SIN_ECO_CM;
  _mvSplit = 0;
  _mvChunks = 1;

#if OTTO_BRAKE
  //-- Estado del lazo cerrado (Fase 3): se empieza sin frenar.
  _brakeGainCur = 100; _brakeWorst = 100;
  _brakeKind = OTTO_K_MV;
  for (uint8_t i = 0; i <= (uint8_t)OTTO_K_MAX; i++) _brakeKindGain[i] = 100;
  _brakeRef  = 0;   _brakeLastMs  = 0;
#endif

  _instrKind = OTTO_K_MV;
  _segKind   = OTTO_K_MV;

#if OTTO_INSTRUMENT
  //-- Antes de enganchar los servos: el rail esta sin carga, asi que esta lectura
  //-- es la referencia del estado de las pilas al arrancar.
  _instrDepth = 0;
  ottoSerialBegin();
  uint16_t vccBoot = ottoReadVccMilliVolts();
  Serial.print(F("OTTO,boot,vcc="));
  Serial.print(vccBoot);
  Serial.print(F(",limiter="));
#if OTTO_LIMITER_DEFAULT_ON
  Serial.print(OTTO_DIFF_LIMIT_DEFAULT);
#else
  Serial.print(0);
#endif
  Serial.print(F(",rr_osc="));
  Serial.print(OTTO_ROUND_ROBIN_OSC);
  Serial.print(F(",agg="));   Serial.print(OTTO_AGG_RATE_DEFAULT);
  Serial.print(F(",brake=")); Serial.print(OTTO_BRAKE);
  Serial.println();

#if OTTO_EEPROM_LOG
  //-- Se vuelca PRIMERO lo que quedo de la pasada anterior (tipicamente la que se
  //-- hizo con pilas y sin puerto serie) y solo despues se anota este arranque.
  _eepLogInit();
  _eepLogDump();
  uint16_t boots;
  EEPROM.get(OTTO_EEP_HDR + 4, boots);
  boots++;
  EEPROM.put(OTTO_EEP_HDR + 4, boots);
  _eepLogAppend(OTTO_K_BOOT, 0, vccBoot, 0, 0, 100);
#endif
#endif

  servo_pins[0] = YL;
  servo_pins[1] = YR;
  servo_pins[2] = RL;
  servo_pins[3] = RR;

  //-- Engranche ESCALONADO, solo aqui (Fase 3b). Al arrancar -y sobre todo al
  //-- arrancar tras un reinicio a mitad de un gesto- las patas pueden estar lejos de
  //-- 90, pero Oscillator::attach() fija _pos=90 sin mirar y Servo::attach() emite
  //-- 1500 us de inmediato: los cuatro servos se van a 90 al par maximo y para el
  //-- software el recorrido es cero, asi que ni el limitador ni el freno intervienen.
  //-- Eso convertia UN reinicio en una cadena. Repartirlo en el tiempo divide la
  //-- punta de corriente entre cuatro instantes. En el resto de la libreria el
  //-- engranche va precedido de un home(), asi que alli no hace falta.
#if OTTO_ATTACH_STAGGER_MS > 0
  {
    static const uint8_t ordenEng[4] = {2, 3, 0, 1};   // pies antes que caderas
    for (uint8_t k = 0; k < 4; k++) {
      servo[ordenEng[k]].attach(servo_pins[ordenEng[k]]);
      delay(OTTO_ATTACH_STAGGER_MS);
    }
  }
#else
  attachServos();
#endif
    // --- Default limiter (compile-time configurable) ---
    #if OTTO_LIMITER_DEFAULT_ON
      for (int i = 0; i < 4; ++i) {
        servo[i].SetLimiter(OTTO_DIFF_LIMIT_DEFAULT);
      }
      OTTO_DBG_BEGIN();
      OTTO_DBG_PRINT("Limiter ON, diff_limit = ");
      OTTO_DBG_PRINTLN(OTTO_DIFF_LIMIT_DEFAULT);
    #else
      OTTO_DBG_BEGIN();
      OTTO_DBG_PRINTLN("Limiter OFF (OTTO_LIMITER_DEFAULT_ON=0)");
    #endif

  isOttoResting=false;

  if (load_calibration) {
    for (int i = 0; i < 4; i++) {
      int servo_trim = EEPROM.read(i);
      if (servo_trim > 128) servo_trim -= 256;
      servo[i].SetTrim(servo_trim);
    }
  }

  //Buzzer pin:
  pinBuzzer = Buzzer;
  pinMode(Buzzer,OUTPUT);
 
}
///////////////////////////////////////////////////////
void Otto::initMATRIX(int DIN, int CS, int CLK, int rotate){
ledmatrix.init( DIN, CS, CLK, 1, rotate);   // set up Matrix display
}
void Otto::matrixIntensity(int intensity){
ledmatrix.setIntensity(intensity);
}

///////////////////////////////////////////////////////////////////
//-- ATTACH & DETACH FUNCTIONS ----------------------------------//
///////////////////////////////////////////////////////////////////
void Otto::attachServos(){
    servo[0].attach(servo_pins[0]);
    servo[1].attach(servo_pins[1]);
    servo[2].attach(servo_pins[2]);
    servo[3].attach(servo_pins[3]);
}

void Otto::detachServos(){
    servo[0].detach();
    servo[1].detach();
    servo[2].detach();
    servo[3].detach();
}

///////////////////////////////////////////////////////////////////
//-- OSCILLATORS TRIMS ------------------------------------------//
///////////////////////////////////////////////////////////////////
void Otto::setTrims(int YL, int YR, int RL, int RR) {
  servo[0].SetTrim(YL);
  servo[1].SetTrim(YR);
  servo[2].SetTrim(RL);
  servo[3].SetTrim(RR);
}

void Otto::saveTrimsOnEEPROM() {

  for (int i = 0; i < 4; i++){
      EEPROM.write(i, servo[i].getTrim());
  }
}

///////////////////////////////////////////////////////////////////
//-- BASIC MOTION FUNCTIONS -------------------------------------//
///////////////////////////////////////////////////////////////////
//-- Perfil trapezoidal de recorrido (Fase 2b). Entra la fraccion de tiempo
//-- transcurrido y sale la fraccion de recorrido que debe estar hecha, ambas en
//-- milesimas. Elimina el escalon de velocidad al arrancar y al parar a cambio de un
//-- pico de solo 1/(1-2*OTTO_MV_RAMP_PCT) veces la velocidad media: 1.18 con el 15%.
static uint16_t ottoMvShape(uint16_t u) {
  if (u >= 1000) return 1000;
  const uint32_t r = (uint32_t)OTTO_MV_RAMP_PCT * 10UL;
  if (r == 0 || r > 500UL) return u;                 // 0 = perfil lineal (clasico)
  const uint32_t den = (1000UL - r) * 2UL * r;
  if ((uint32_t)u < r)
    return (uint16_t)(((uint32_t)u * (uint32_t)u * 1000UL) / den);
  if ((uint32_t)u > 1000UL - r) {
    const uint32_t v = 1000UL - (uint32_t)u;
    return (uint16_t)(1000UL - (v * v * 1000UL) / den);
  }
  return (uint16_t)((1000UL * ((uint32_t)u * 2UL - r)) / ((1000UL - r) * 2UL));
}

//-- Mueve los 4 servos a servo_target[] interpolando la trayectoria.
//--
//-- Lo que habia antes: round-robin de un servo por tick de 10 ms con paso
//-- 4*increment, que el limitador de Oscillator recortaba a 1 grado -> 25 deg/s por
//-- servo; y cuando eso no llegaba al objetivo dentro del tiempo pedido, un bucle de
//-- ajuste final que comandaba los CUATRO servos cada 10 ms -> 400 deg/s agregados.
//-- Reptaba y luego esprintaba con todo a la vez, concentrando al final justo el
//-- pico que el round-robin pretendia evitar. De ahi los sobrepasos de duracion
//-- medidos (del +15% al +218%) y 7 de las 10 caidas de tension mas profundas.
//--
//-- Lo que hace ahora: un techo explicito para la velocidad angular AGREGADA
//-- (_aggRate) y una trayectoria que llega al objetivo justo al acabar la ventana,
//-- con lo que el bucle de ajuste final deja de existir. El ritmo lo fija este
//-- bucle, no el recorte del limitador.
void Otto::_moveServos(int time, int  servo_target[]) {

  attachServos();
  if(getRestState()==true){
        setRestState(false);
  }

  OTTO_INSTR_BEGIN("mv");

  //-- Recorrido pendiente de cada servo, en grados enteros (sin coma flotante).
  int  from[4], delta[4], pend[4];
  long trvTotal = 0;
  for (int i = 0; i < 4; i++) {
    from[i]  = servo[i].getPosition();
    delta[i] = servo_target[i] - from[i];
    pend[i]  = (delta[i] < 0) ? -delta[i] : delta[i];
    trvTotal += pend[i];
  }

  const unsigned long t_req = (time > 0) ? (unsigned long)time : 0UL;

  if (trvTotal == 0) {
    //-- Nada que recorrer: solo se consume el tiempo pedido. OJO, el freno TAMBIEN
    //-- tiene que abrir tramo aqui: si no, la etiqueta se filtra al gesto siguiente y
    //-- el registro repite el g=/gm= del anterior. Ver _brakeIdle().
    OTTO_BRAKE_IDLE();
    const unsigned long t_end = millis() + t_req;
    while ((long)(millis() - t_end) < 0) { OTTO_INSTR_SAMPLE(); }
    OTTO_INSTR_END();
    return;
  }

  //-- Tiempo efectivo. Dos reglas, y la segunda es la que protege la placa:
  //--   1) nunca menos de lo que pide el llamante (no acelerar gestos por la espalda)
  //--   2) nunca mas rapido que _aggRate grados/segundo sumando los cuatro servos
  const uint16_t rate  = (_aggRate > 0) ? _aggRate : (uint16_t)OTTO_AGG_RATE_DEFAULT;
  const unsigned long t_cap = ((unsigned long)trvTotal * 1000UL) / (unsigned long)rate;
  unsigned long t_eff = (t_req > t_cap) ? t_req : t_cap;
  if (t_eff < (unsigned long)OTTO_MV_TICK_MS) t_eff = (unsigned long)OTTO_MV_TICK_MS;

  //-- Pies (2,3) antes que caderas (0,1): los pies gobiernan el equilibrio.
  static const uint8_t orden[4] = {2, 3, 0, 1};
  const unsigned long mitad = (unsigned long)OTTO_MV_TICK_MS / 2UL;

  //-- Lazo cerrado (Fase 3): el progreso por la trayectoria deja de ser el tiempo
  //-- real y pasa a ser un reloj virtual que el freno modula. Frenar aqui no deforma
  //-- nada: se recorre la misma trayectoria, solo que mas despacio.
  //-- FASE 4a: autoridad del freno segun la CARGA de velocidad del tramo. Ver la
  //-- nota de OTTO_BRAKE_MIN_LOAD_PCT en Otto.h. Un tramo que ya va por debajo del
  //-- presupuesto no tiene velocidad que ceder, asi que frenarlo solo lo alarga.
  //-- Cuando no es frenable se abre tramo con _brakeIdle() en vez de _brakeBegin():
  //-- asi el registro dice honestamente 98/98 y la tabla por movimiento no aprende
  //-- a frenar algo que nunca se va a frenar. La tension se sigue midiendo igual,
  //-- porque de eso se encarga OTTO_INSTR_SAMPLE() en la espera del tick.
  const unsigned long carga = (t_cap * 100UL) / t_eff;
  const bool frenable = (carga >= (unsigned long)OTTO_BRAKE_MIN_LOAD_PCT);

  //-- FASE 4b: trocear el RECORRIDO SIMULTANEO, a la misma velocidad. Ver la nota de
  //-- OTTO_MV_TRV_CHUNK en Otto.h: medido, 50+50 gana 336 mV a 100 de golpe con la
  //-- misma velocidad y los mismos motores, y encima sale mas rapido porque necesita
  //-- menos freno. Solo se trocea lo que va al tope del presupuesto, para no partir
  //-- gestos deliberadamente lentos como jump, donde lo que se ve es la continuidad.
  //--
  //-- El reparto del tiempo conserva todo: t_cap es lineal en el recorrido, asi que
  //-- n trozos de t_eff/n suman exactamente t_eff. Trocear es GRATIS en duracion.
  //--
  //-- La instrumentacion sigue dando UNA linea para el movimiento completo, porque
  //-- _instrBegin lleva guarda de profundidad y _degTravel y _vccMin se acumulan
  //-- entre trozos. Lo unico que queda parcial es g=/gm=, que reflejan el ULTIMO
  //-- trozo: cada trozo reabre el freno.
#if OTTO_MV_TRV_CHUNK > 0
  if (_mvSplit == 0 && trvTotal > (long)OTTO_MV_TRV_CHUNK &&
      carga >= (unsigned long)OTTO_BRAKE_MIN_LOAD_PCT) {
    uint8_t n = (uint8_t)((trvTotal + (long)OTTO_MV_TRV_CHUNK - 1L) / (long)OTTO_MV_TRV_CHUNK);
    if (n < 2) n = 2;
    if (n > 8) n = 8;
    const uint8_t       etiq    = _instrKind;   //-- antes de que el freno la consuma
    const unsigned long t_tramo = t_eff / (unsigned long)n;
    _mvSplit = 1;                               //-- un solo nivel de troceado
    for (uint8_t k = 1; k <= n; k++) {
      int wp[4];
      for (uint8_t i = 0; i < 4; i++) {
        wp[i] = (k == n) ? servo_target[i]
                         : from[i] + (int)(((long)delta[i] * (long)k) / (long)n);
      }
      _instrKind = etiq;                        //-- cada trozo a su misma casilla
      _moveServos((int)t_tramo, wp);
    }
    _mvSplit  = 0;
    _mvChunks = n;              //-- para que el registro lo pueda decir
    OTTO_INSTR_END();
    return;
  }
#endif

  if (frenable) { OTTO_BRAKE_BEGIN(); } else { OTTO_BRAKE_IDLE(); }

  const unsigned long t0 = millis();
  unsigned long ult  = t0;
  unsigned long prog = 0;
  unsigned long acc  = 0;      // resto en centesimas de ms, para no perder fraccion

  //-- Tope de AUTORIDAD del freno (Fase 3b): ningun gesto puede estirarse mas de
  //-- OTTO_BRAKE_T_MAX_X veces su ventana. Pasado ese punto se sigue a ritmo nominal
  //-- aunque la tension siga mal, porque alargar mas no es gratis: donde la caida la
  //-- causa el par ESTATICO de sostener la pose, frenar prolonga la exposicion sin
  //-- bajar la corriente, y el remedio es peor. El registro lo delata: un tramo que
  //-- toca el tope sale con dur cerca de T_MAX_X veces lo pedido y gm bajo.
  const unsigned long t_tope = t_eff * (unsigned long)OTTO_BRAKE_T_MAX_X;

  for (;;) {
    const unsigned long now = millis();

    //-- Acumulador de resto en vez de redondear cada vuelta: con un ritmo del 35% y
    //-- ticks de 10 ms, truncar daria 3 ms por tick (30%) y el error se acumularia.
    const unsigned long ritmo = (!frenable || (now - t0 >= t_tope))
                                  ? 100UL
                                  : (unsigned long)OTTO_BRAKE_GAIN();
    acc  += (now - ult) * ritmo;
    ult   = now;
    prog += acc / 100UL;
    acc  %= 100UL;
    if (prog > t_eff) prog = t_eff;

    //-- Se muestrea el perfil en el centro del tick, para que la duracion real
    //-- redondee al tick mas cercano en vez de arrastrar medio tick de retraso.
    unsigned long ec = prog + mitad;
    if (ec > t_eff) ec = t_eff;
    const uint16_t s = ottoMvShape((uint16_t)((ec * 1000UL) / t_eff));

    bool llegado = true;
    for (uint8_t k = 0; k < 4; k++) {
      const uint8_t i = orden[k];
      if (pend[i] == 0) continue;
      int hecho = (int)((((long)pend[i] * (long)s) + 500L) / 1000L);
      if (hecho > pend[i]) hecho = pend[i];
      const int tgt = from[i] + ((delta[i] < 0) ? -hecho : hecho);
      //-- SetPosition avanza como maximo un grado por llamada (lo impone el
      //-- limitador de Oscillator), asi que se llama hasta converger. En regimen
      //-- normal son 0, 1 o 2 vueltas; la guarda solo cubre el caso patologico.
      uint8_t guard = 200;
      while (servo[i].getPosition() != tgt && guard--) servo[i].SetPosition(tgt);
      if (servo[i].getPosition() != servo_target[i]) llegado = false;
    }

    if (llegado && prog + mitad >= t_eff) break;

    const unsigned long tick_end = now + (unsigned long)OTTO_MV_TICK_MS;
    while ((long)(millis() - tick_end) < 0) { OTTO_INSTR_SAMPLE(); }
  }

  OTTO_INSTR_END();
}

void Otto::_moveSingle(int position, int servo_number) {
if (position > 180) position = 90;
if (position < 0) position = 90;
  attachServos();
  if(getRestState()==true){
        setRestState(false);
  }
int servoNumber = servo_number;
if (servoNumber == 0){
  servo[0].SetPosition(position);
}
if (servoNumber == 1){
  servo[1].SetPosition(position);
}
if (servoNumber == 2){
  servo[2].SetPosition(position);
}
if (servoNumber == 3){
  servo[3].SetPosition(position);
}
}

void Otto::oscillateServos(int A[4], int O[4], int T, double phase_diff[4], float cycle=1){

  for (int i=0; i<4; i++) {
    servo[i].SetO(O[i]);
    servo[i].SetA(A[i]);
    servo[i].SetT(T);
    servo[i].SetPh(phase_diff[i]);
  }
  OTTO_INSTR_BEGIN("osc");

  //-- Bucle acotado por un reloj VIRTUAL en vez de por el reloj de pared.
  //--
  //-- Se puede frenar una marcha DENTRO del ciclo sin deformarla: el periodo se
  //-- cambia en los cuatro osciladores a la vez, la fase es acumulada y por tanto no
  //-- da ningun salto, y el desfase entre caderas y pies -que es lo que hace avanzar
  //-- al bipedo- se conserva exacto. Lo unico que hay que corregir es el final del
  //-- bucle: si la fase avanza mas despacio, el ciclo necesita mas tiempo REAL para
  //-- completar sus 2*pi, y acotarlo por reloj de pared lo cortaria a medias dejando
  //-- al robot a mitad de zancada. El reloj virtual avanza al ritmo frenado, asi que
  //-- el ciclo siempre se completa entero.
  //--
  //-- Sin freno compilado el ritmo es 100 y esto es exactamente el bucle de siempre.
  const unsigned long lim = (unsigned long)((double)T * (double)cycle);
  unsigned long virt = 0, ult = millis(), acc = 0;
  uint8_t gLast = 100;

  while (virt <= lim) {
    const unsigned long now = millis();
    const uint8_t g = (uint8_t)OTTO_BRAKE_GAIN();
    //-- Acumulador de resto, NO redondeo. Este bucle gira a ritmo de microsegundos,
    //-- asi que el intervalo entre vueltas es casi siempre de 1 ms: redondear hacia
    //-- arriba haria avanzar el reloj virtual a tiempo real y anularia el freno.
    acc += (now - ult) * (unsigned long)g;
    ult  = now;
    virt += acc / 100UL;
    acc  %= 100UL;

#if OTTO_BRAKE
    //-- Solo se reprograma el periodo cuando el ritmo cambia de verdad: SetT implica
    //-- dos divisiones en coma flotante por servo y saldria caro en cada vuelta.
    if (g + 4 < gLast || g > gLast + 4) {
      gLast = g;
      long t2 = ((long)T * 100L) / (long)(g ? g : 1);
      const long techo = (long)T * (long)OTTO_BRAKE_T_MAX_X;
      if (t2 > techo)  t2 = techo;
      if (t2 > 30000L) t2 = 30000L;
      for (int i=0; i<4; i++) servo[i].SetT((unsigned int)t2);
    }
#else
    (void)gLast;
#endif

#if OTTO_ROUND_ROBIN_OSC
    static uint8_t rr = 0;
    OTTO_VIS_PRINT("t="); OTTO_VIS_PRINT(millis()); OTTO_VIS_PRINT(" rr="); OTTO_VIS_PRINTLN(rr);
    servo[rr].refresh();
    rr = (rr + 1) & 0x03;
#else
    OTTO_VIS_PRINT("t="); OTTO_VIS_PRINT(millis()); OTTO_VIS_PRINTLN(" refresh all");
    for (int i=0; i<4; i++){
      servo[i].refresh();
    }
#endif
    OTTO_INSTR_SAMPLE();
  }

  OTTO_INSTR_END();
}

void Otto::_execute(int A[4], int O[4], int T, double phase_diff[4], float steps = 1.0){

  attachServos();
  if(getRestState()==true){
        setRestState(false);
  }


  //-- FASE 5d: acotar T al minimo con el que la zancada se ve. Ver la nota de
  //-- OTTO_GAIT_T_PER_DEG en Otto.h. Las marchas no pasan por el techo agregado de
  //-- _moveServos, asi que si el bloque pide un periodo que el servo no puede
  //-- seguir, el recorte deforma la senoidal y el gesto deja de ser una marcha.
  //--
  //-- El suelo es proporcional a la amplitud MAYOR, porque el limitador de
  //-- Oscillator actua por servo: el servo que mas recorrido tiene es el que manda.
  //-- 50 ms por grado sale del optimo medido con metro (walk, A_max=30, T=1500).
  //--
  //-- Como depende de la amplitud, el desplegable de tamano de los bloques es una
  //-- palanca real: con tamano 10 el suelo baja a 500 ms. Para ir rapido hay que
  //-- bajar la amplitud, no el periodo.
#if OTTO_GAIT_T_PER_DEG > 0
  {
    int amax = 0;
    for (int i = 0; i < 4; i++) {
      const int a = (A[i] < 0) ? -A[i] : A[i];
      if (a > amax) amax = a;
    }
    const long tmin = (long)amax * (long)OTTO_GAIT_T_PER_DEG;
    if (tmin > (long)T) T = (int)tmin;   //-- nunca se acelera: solo se frena lo imposible
  }
#endif

  OTTO_INSTR_BEGIN("gait");
  OTTO_BRAKE_BEGIN();

  int cycles=(int)steps;

  //-- Execute complete cycles
  if (cycles >= 1)
    for(int i = 0; i < cycles; i++)
      oscillateServos(A,O, T, phase_diff);

  //-- Execute the final not complete cycle
  oscillateServos(A,O, T, phase_diff,(float)steps-cycles);

  OTTO_INSTR_END();
}

///////////////////////////////////////////////////////////////////
//-- HOME = Otto at rest position -------------------------------//
///////////////////////////////////////////////////////////////////
void Otto::home(){

  if(isOttoResting==false){ //Go to rest position only if necessary

    //-- Vuelta al centro en DOS FASES, pies primero. Medido con pilas (Fase 1b):
    //-- home() concentra 7 de las 10 caidas de tension mas profundas del registro,
    //-- incluida la peor de todas (3077 mV, 700 mV por debajo de lo que el 328P
    //-- necesita a 16 MHz), y lo hace moviendo solo ~25 grados por servo a 85 deg/s.
    //-- No es un problema de velocidad: es el PAR de sostener el cuerpo
    //-- descompensado. Los pies son los que gobiernan el equilibrio, asi que
    //-- centrarlos primero acorta el tiempo que el robot pasa fuera de equilibrio.
    //-- Y es gratis en duracion: con un techo AGREGADO, repartir el recorrido en dos
    //-- fases consecutivas da el mismo total que hacerlo todo a la vez.
    int homes[4]={90, 90, 90, 90}; //All the servos at rest position

    if (servo[2].getPosition() != 90 || servo[3].getPosition() != 90) {
      int pies[4] = { servo[0].getPosition(), servo[1].getPosition(), 90, 90 };
      OTTO_INSTR_KIND(OTTO_K_HOME_P);
      _moveServos(OTTO_HOME_T / 2, pies);
    }
    OTTO_INSTR_KIND(OTTO_K_HOME_C);
    _moveServos(OTTO_HOME_T / 2, homes);

    detachServos();
    isOttoResting=true;
  }
}

bool Otto::getRestState(){
    return isOttoResting;
}

void Otto::setRestState(bool state){

    isOttoResting = state;
}

///////////////////////////////////////////////////////////////////
//-- PREDETERMINED MOTION SEQUENCES -----------------------------//
///////////////////////////////////////////////////////////////////
//-- Otto movement: Jump
//--  Parameters:
//--    steps: Number of steps
//--    T: Period
//---------------------------------------------------------
void Otto::jump(float steps, int T){

  int up[]={90,90,150,30};
  OTTO_INSTR_KIND(OTTO_K_JUMP);
  _moveServos(T,up);
  int down[]={90,90,90,90};
  OTTO_INSTR_KIND(OTTO_K_JUMP);
  _moveServos(T,down);
}

//---------------------------------------------------------
//-- Otto gait: Walking  (forward or backward)
//--  Parameters:
//--    * steps:  Number of steps
//--    * T : Period
//--    * Dir: Direction: FORWARD / BACKWARD
//---------------------------------------------------------
void Otto::walk(float steps, int T, int dir){

  OTTO_INSTR_KIND(OTTO_K_WALK);
  //-- Oscillator parameters for walking
  //-- Hip sevos are in phase
  //-- Feet servos are in phase
  //-- Hip and feet are 90 degrees out of phase
  //--      -90 : Walk forward
  //--       90 : Walk backward
  //-- Feet servos also have the same offset (for tiptoe a little bit)
  int A[4]= {30, 30, 20, 20}; //30,30,20,20
  int O[4] = {0, 0, 4, -4}; //0,0,5,-5
  double phase_diff[4] = {0, 0, DEG2RAD(dir * -90), DEG2RAD(dir * -90)};

  //-- Let's oscillate the servos!
  _execute(A, O, T, phase_diff, steps);
}

//---------------------------------------------------------
//-- Otto gait: Turning (left or right)
//--  Parameters:
//--   * Steps: Number of steps
//--   * T: Period
//--   * Dir: Direction: LEFT / RIGHT
//---------------------------------------------------------
void Otto::turn(float steps, int T, int dir){

  OTTO_INSTR_KIND(OTTO_K_TURN);

  //-- Same coordination than for walking (see Otto::walk)
  //-- The Amplitudes of the hip's oscillators are not igual
  //-- When the right hip servo amplitude is higher, the steps taken by
  //--   the right leg are bigger than the left. So, the robot describes an
  //--   left arc
  int A[4]= {30, 30, 20, 20};
  int O[4] = {0, 0, 4, -4};
  double phase_diff[4] = {0, 0, DEG2RAD(-90), DEG2RAD(-90)};

  if (dir == LEFT) {
    A[0] = 30; //-- Left hip servo
    A[1] = 10; //-- Right hip servo
  }
  else {
    A[0] = 10;
    A[1] = 30;
  }

  //-- Let's oscillate the servos!
  _execute(A, O, T, phase_diff, steps);
}

//---------------------------------------------------------
//-- Otto gait: Lateral bend
//--  Parameters:
//--    steps: Number of bends
//--    T: Period of one bend
//--    dir: RIGHT=Right bend LEFT=Left bend
//---------------------------------------------------------
void Otto::bend (int steps, int T, int dir){

  //Parameters of all the movements. Default: Left bend
  int bend1[4]={90, 90, 62, 35};
  int bend2[4]={90, 90, 62, 105};
  int homes[4]={90, 90, 90, 90};

  //Time of one bend, constrained in order to avoid movements too fast.
  //T=max(T, 600);
  //Changes in the parameters if right direction is chosen
  if(dir==-1)
  {
    bend1[2]=180-35;
    bend1[3]=180-60;  //Not 65. Otto is unbalanced
    bend2[2]=180-105;
    bend2[3]=180-60;
  }

  //Time of the bend movement. Fixed parameter to avoid falls
  int T2=800;

  //Bend movement
  for (int i=0;i<steps;i++)
  {
    OTTO_INSTR_KIND(OTTO_K_BEND);
    _moveServos(T2/2,bend1);
    OTTO_INSTR_KIND(OTTO_K_BEND);
    _moveServos(T2/2,bend2);
    delay(T*0.8);
    OTTO_INSTR_KIND(OTTO_K_BEND);
    _moveServos(500,homes);
  }

}

//---------------------------------------------------------
//-- Otto gait: Shake a leg
//--  Parameters:
//--    steps: Number of shakes
//--    T: Period of one shake
//--    dir: RIGHT=Right leg LEFT=Left leg
//---------------------------------------------------------
void Otto::shakeLeg (int steps,int T,int dir){

  //This variable change the amount of shakes
  int numberLegMoves=2;

  //-- ANGULO DE APOYO: 55 en vez de 58, o sea 35 grados fuera del centro en vez de
  //-- 32. Medido en el robot el 2026-11-12 con un barrido de roll puro: a 30 grados
  //-- el pie contrario se despega apenas, a 35 se despega del todo, a 40 queda
  //-- estable a una pata, y a 45-50 se mantiene pero tambalea. Los 32 originales
  //-- caian justo por debajo del umbral, asi que el gesto no llegaba a sostener el
  //-- peso sobre una pata. Y no cuesta tension: 15 sostenes de 1500 ms entre 30 y 50
  //-- grados dieron CERO muestras por debajo de 3900 mV sobre unas 2250.
  //--
  //-- POSES ORIGINALES DE OTTO DIY, RESTAURADAS A PROPOSITO (Fase 5f, 2026-11-12).
  //-- NO TOCAR sin leer esto: el "fallo geometrico" de este gesto es PORTANTE.
  //--
  //-- Con la convencion de la libreria -roll = (dRL+dRR)/2 es la inclinacion que
  //-- levanta un pie, heave = (dRL-dRR)/2 sube o baja el cuerpo- las tres poses dan
  //-- roll 45 -> 2.5 -> 32.5. La intermedia manda el pie que deberia aletear al OTRO
  //-- lado del centro (RR=120, +30 grados), con lo que la suela vuelve al suelo y la
  //-- inclinacion se cancela. Parece un error de Otto DIY, y por eso en la Fase 5e se
  //-- "arreglo": apoyo clavado en 55 y pie libre aleteando entre 35 y 55, siempre en
  //-- el aire, roll 45 -> 35, las dos poses dentro de la banda que el barrido de
  //-- apoyo habia dado por buena.
  //--
  //-- RESULTADO MEDIDO DE ESE ARREGLO: EL ROBOT SE CAYO LAS OCHO VECES, con las dos
  //-- piernas y a las dos velocidades, con tres brownouts de la placa y peor_vmin
  //-- 3312 mV (el original, con sus sags feos, NUNCA se caia). El reparto de los
  //-- sags por paso del gesto senala el mecanismo sin ambiguedad: 9 de los 10 eventos
  //-- por encima de 800 mV cayeron en el aleteo 4 y el 6, los ULTIMOS. Se levanta
  //-- bien, aguanta el primer aleteo y se va al segundo o al tercero.
  //--
  //-- O sea: cada tiron de 20 grados del tobillo libre devuelve un par de reaccion al
  //-- cuerpo, y sobre UN pie ese par es acumulativo. Otto no tiene control activo de
  //-- equilibrio ni un poligono de apoyo que lo absorba, asi que no se sostiene a una
  //-- pata los ~2.5 s que dura el gesto si ademas se le sacude una pierna. El barrido
  //-- de apoyo que yo tome como permiso media otra cosa: sostenes ESTATICOS de 1500 ms
  //-- en roll puro, sin aleteo y la mitad de tiempo.
  //--
  //-- Por eso Otto DIY baja el pie en la pose intermedia: no es un descuido, es lo que
  //-- mantiene el robot en pie. El precio son sus sags de 801-1261 mV, que si son los
  //-- dos tobillos empujandose, y se acepta: el gesto no se parece a la figura, pero
  //-- se completa y no tira el robot. Si algun dia se quiere el aleteo de verdad, hace
  //-- falta recortar el tiempo a una pata (levantar, UN aleteo, bajar) y medirlo, no
  //-- ampliar la inclinacion.
  //--
  //-- Lo que SI se queda de las fases anteriores es el angulo de apoyo: 55, o sea 35
  //-- grados fuera del centro en vez de los 32 originales (barrido de 2026-11-12: a 30
  //-- el pie contrario se despega apenas, a 35 se despega del todo, a 40 queda estable
  //-- a una pata, a 45-50 tambalea y se cae).
  //Parameters of all the movements. Default: Right leg
  //-- Cuanto cruza el centro el pie libre en la pose intermedia. 30 grados es el
  //-- original (RR=120); OTTO_SHAKE_CROSS_DEG permite ablandarlo sin quitarlo,
  //-- que es la unica hipotesis que queda viva de este gesto. Ver Otto.h.
  const int cruce = 90 + OTTO_SHAKE_CROSS_DEG;

  int shake_leg1[4]={90, 90, 55, 35};
  int shake_leg2[4]={90, 90, 55, cruce};
  int shake_leg3[4]={90, 90, 55, 60};
  int homes[4]={90, 90, 90, 90};

  //Changes in the parameters if left leg is chosen
  if(dir==-1)
  {
    shake_leg1[2]=180-35;
    shake_leg1[3]=180-55;
    shake_leg2[2]=180-cruce;
    shake_leg2[3]=180-55;
    shake_leg3[2]=180-60;
    shake_leg3[3]=180-55;
  }

  //Time of the bend movement. Fixed parameter to avoid falls
  int T2=1000;
  //Time of one shake, constrained in order to avoid movements too fast.
  T=T-T2;
  T=max(T,200*numberLegMoves);

  for (int j=0; j<steps;j++)
  {
  //Bend movement
  OTTO_INSTR_KIND(OTTO_K_SHAKE);
  _moveServos(T2/2,shake_leg1);
  OTTO_INSTR_KIND(OTTO_K_SHAKE);
  _moveServos(T2/2,shake_leg2);

    //Shake movement
    for (int i=0;i<numberLegMoves;i++)
    {
    OTTO_INSTR_KIND(OTTO_K_SHAKE);
    _moveServos(T/(2*numberLegMoves),shake_leg3);
    OTTO_INSTR_KIND(OTTO_K_SHAKE);
    _moveServos(T/(2*numberLegMoves),shake_leg2);
    }
    OTTO_INSTR_KIND(OTTO_K_SHAKE);
    _moveServos(500,homes); //Return to home position
  }

  delay(T);
}

//---------------------------------------------------------
//-- Otto movement: up & down
//--  Parameters:
//--    * steps: Number of jumps
//--    * T: Period
//--    * h: Jump height: SMALL / MEDIUM / BIG
//--              (or a number in degrees 0 - 90)
//---------------------------------------------------------
void Otto::updown(float steps, int T, int h){

  OTTO_INSTR_KIND(OTTO_K_UPDOWN);

  //-- Both feet are 180 degrees out of phase
  //-- Feet amplitude and offset are the same
  //-- Initial phase for the right foot is -90, so that it starts
  //--   in one extreme position (not in the middle)
  int A[4]= {0, 0, h, h};
  int O[4] = {0, 0, h, -h};
  double phase_diff[4] = {0, 0, DEG2RAD(-90), DEG2RAD(90)};

  //-- Let's oscillate the servos!
  _execute(A, O, T, phase_diff, steps);
}

//---------------------------------------------------------
//-- Otto movement: swinging side to side
//--  Parameters:
//--     steps: Number of steps
//--     T : Period
//--     h : Amount of swing (from 0 to 50 aprox)
//---------------------------------------------------------
void Otto::swing(float steps, int T, int h){

  OTTO_INSTR_KIND(OTTO_K_SWING);

  //-- Both feets are in phase. The offset is half the amplitude
  //-- It causes the robot to swing from side to side
  int A[4]= {0, 0, h, h};
  int O[4] = {0, 0, h/2, -h/2};
  double phase_diff[4] = {0, 0, DEG2RAD(0), DEG2RAD(0)};

  //-- Let's oscillate the servos!
  _execute(A, O, T, phase_diff, steps);
}

//---------------------------------------------------------
//-- Otto movement: swinging side to side without touching the floor with the heel
//--  Parameters:
//--     steps: Number of steps
//--     T : Period
//--     h : Amount of swing (from 0 to 50 aprox)
//---------------------------------------------------------
void Otto::tiptoeSwing(float steps, int T, int h){

  OTTO_INSTR_KIND(OTTO_K_TIPTOE);

  //-- Both feets are in phase. The offset is not half the amplitude in order to tiptoe
  //-- It causes the robot to swing from side to side
  int A[4]= {0, 0, h, h};
  int O[4] = {0, 0, h, -h};
  double phase_diff[4] = {0, 0, 0, 0};

  //-- Let's oscillate the servos!
  _execute(A, O, T, phase_diff, steps);
}

//---------------------------------------------------------
//-- Otto gait: Jitter
//--  Parameters:
//--    steps: Number of jitters
//--    T: Period of one jitter
//--    h: height (Values between 5 - 25)
//---------------------------------------------------------
void Otto::jitter(float steps, int T, int h){

  OTTO_INSTR_KIND(OTTO_K_JITTER);

  //-- Both feet are 180 degrees out of phase
  //-- Feet amplitude and offset are the same
  //-- Initial phase for the right foot is -90, so that it starts
  //--   in one extreme position (not in the middle)
  //-- h is constrained to avoid hit the feets
  h=min(25,h);
  int A[4]= {h, h, 0, 0};
  int O[4] = {0, 0, 0, 0};
  double phase_diff[4] = {DEG2RAD(-90), DEG2RAD(90), 0, 0};

  //-- Let's oscillate the servos!
  _execute(A, O, T, phase_diff, steps);
}

//---------------------------------------------------------
//-- Otto gait: Ascending & turn (Jitter while up&down)
//--  Parameters:
//--    steps: Number of bends
//--    T: Period of one bend
//--    h: height (Values between 5 - 15)
//---------------------------------------------------------
void Otto::ascendingTurn(float steps, int T, int h){

  OTTO_INSTR_KIND(OTTO_K_ASCTURN);

  //-- Both feet and legs are 180 degrees out of phase
  //-- Initial phase for the right foot is -90, so that it starts
  //--   in one extreme position (not in the middle)
  //-- h is constrained to avoid hit the feets
  h=min(13,h);
  int A[4]= {h, h, h, h};
  int O[4] = {0, 0, h+4, -h+4};
  double phase_diff[4] = {DEG2RAD(-90), DEG2RAD(90), DEG2RAD(-90), DEG2RAD(90)};

  //-- Let's oscillate the servos!
  _execute(A, O, T, phase_diff, steps);
}

//---------------------------------------------------------
//-- Otto gait: Moonwalker. Otto moves like Michael Jackson
//--  Parameters:
//--    Steps: Number of steps
//--    T: Period
//--    h: Height. Typical valures between 15 and 40
//--    dir: Direction: LEFT / RIGHT
//---------------------------------------------------------
void Otto::moonwalker(float steps, int T, int h, int dir){

  OTTO_INSTR_KIND(OTTO_K_MOONW);

  //-- This motion is similar to that of the caterpillar robots: A travelling
  //-- wave moving from one side to another
  //-- The two Otto's feet are equivalent to a minimal configuration. It is known
  //-- that 2 servos can move like a worm if they are 120 degrees out of phase
  //-- In the example of Otto, the two feet are mirrored so that we have:
  //--    180 - 120 = 60 degrees. The actual phase difference given to the oscillators
  //--  is 60 degrees.
  //--  Both amplitudes are equal. The offset is half the amplitud plus a little bit of
  //-   offset so that the robot tiptoe lightly

  int A[4]= {0, 0, h, h};
  int O[4] = {0, 0, h/2+2, -h/2 -2};
  int phi = -dir * 90;
  double phase_diff[4] = {0, 0, DEG2RAD(phi), DEG2RAD(-60 * dir + phi)};

  //-- Let's oscillate the servos!
  _execute(A, O, T, phase_diff, steps);
}

//----------------------------------------------------------
//-- Otto gait: Crusaito. A mixture between moonwalker and walk
//--   Parameters:
//--     steps: Number of steps
//--     T: Period
//--     h: height (Values between 20 - 50)
//--     dir:  Direction: LEFT / RIGHT
//-----------------------------------------------------------
void Otto::crusaito(float steps, int T, int h, int dir){

  OTTO_INSTR_KIND(OTTO_K_CRUSAITO);

  int A[4]= {25, 25, h, h};
  int O[4] = {0, 0, h/2+ 4, -h/2 - 4};
  double phase_diff[4] = {90, 90, DEG2RAD(0), DEG2RAD(-60 * dir)};

  //-- Let's oscillate the servos!
  _execute(A, O, T, phase_diff, steps);
}

//---------------------------------------------------------
//-- Otto gait: Flapping
//--  Parameters:
//--    steps: Number of steps
//--    T: Period
//--    h: height (Values between 10 - 30)
//--    dir: direction: FOREWARD, BACKWARD
//---------------------------------------------------------
void Otto::flapping(float steps, int T, int h, int dir){

  OTTO_INSTR_KIND(OTTO_K_FLAP);

  int A[4]= {12, 12, h, h};
  int O[4] = {0, 0, h - 10, -h + 10};
  double phase_diff[4] = {DEG2RAD(0), DEG2RAD(180), DEG2RAD(-90 * dir), DEG2RAD(90 * dir)};

  //-- Let's oscillate the servos!
  _execute(A, O, T, phase_diff, steps);
}

///////////////////////////////////////////////////////////////////
//-- MOUTHS & ANIMATIONS ----------------------------------------//
///////////////////////////////////////////////////////////////////
void Otto::setLed(byte X, byte Y, byte value){
  ledmatrix.setDot( X,  Y, value);
}


// EXAMPLE putAnimationMouth(dreamMouth,0);
void Otto::putAnimationMouth(unsigned long int aniMouth, int index){

ledmatrix.writeFull(PROGMEM_getAnything (&Gesturetable[aniMouth][index]));

}

//EXAMPLE putMouth(smile);
void Otto::putMouth(unsigned long int mouth, bool predefined){
  if (predefined){
// Here a direct entry into the Progmem Mouthttable is used!!

ledmatrix.writeFull(PROGMEM_getAnything(&Mouthtable[mouth]));
  }
  else{
    ledmatrix.writeFull(mouth);
  }
}


void Otto::clearMouth(){

  ledmatrix.clearMatrix();
}

void Otto::writeText(const char * s, byte scrollspeed){
 int a ;
 int b ;
  for(a = 0; s[a] != '\0'; a++){
    b = a +1 ;
    if (b > 9 ) b = 9; // only maximum of nine characters allowed
  }
  for(int charNUMBER = 0; charNUMBER <b; charNUMBER++){
      if ((* s < 48) || (* s > 91)) {
        if (* s == 32){
          ledmatrix.sendChar (44, charNUMBER, b, scrollspeed);
        }
        else
        {
          ledmatrix.sendChar (43, charNUMBER, b, scrollspeed);
        }
     }
      else
      {
      ledmatrix.sendChar ((* s - 48), charNUMBER, b, scrollspeed);
     }
  * s++;
  }

}

///////////////////////////////////////////////////////////////////
//-- SOUNDS -----------------------------------------------------//
///////////////////////////////////////////////////////////////////

void Otto::_tone (float noteFrequency, long noteDuration, int silentDuration){

    // tone(10,261,500);
    // delay(500);

      if(silentDuration==0){silentDuration=1;}

      tone(Otto::pinBuzzer, noteFrequency, noteDuration);
      delay(noteDuration);       //milliseconds to microseconds
      //noTone(PIN_Buzzer);
      delay(silentDuration);
}

void Otto::bendTones (float initFrequency, float finalFrequency, float prop, long noteDuration, int silentDuration){

  //Examples:
  //  bendTones (880, 2093, 1.02, 18, 1);
  //  bendTones (note_A5, note_C7, 1.02, 18, 0);

  if(silentDuration==0){silentDuration=1;}

  if(initFrequency < finalFrequency)
  {
      for (int i=initFrequency; i<finalFrequency; i=i*prop) {
          _tone(i, noteDuration, silentDuration);
      }

  } else{

      for (int i=initFrequency; i>finalFrequency; i=i/prop) {
          _tone(i, noteDuration, silentDuration);
      }
  }
}

void Otto::sing(int songName){
  switch(songName){

    case S_connection:
      _tone(note_E5,50,30);
      _tone(note_E6,55,25);
      _tone(note_A6,60,10);
    break;

    case S_disconnection:
      _tone(note_E5,50,30);
      _tone(note_A6,55,25);
      _tone(note_E6,50,10);
    break;

    case S_buttonPushed:
      bendTones (note_E6, note_G6, 1.03, 20, 2);
      delay(30);
      bendTones (note_E6, note_D7, 1.04, 10, 2);
    break;

    case S_mode1:
      bendTones (note_E6, note_A6, 1.02, 30, 10);  //1318.51 to 1760
    break;

    case S_mode2:
      bendTones (note_G6, note_D7, 1.03, 30, 10);  //1567.98 to 2349.32
    break;

    case S_mode3:
      _tone(note_E6,50,100); //D6
      _tone(note_G6,50,80);  //E6
      _tone(note_D7,300,0);  //G6
    break;

    case S_surprise:
      bendTones(800, 2150, 1.02, 10, 1);
      bendTones(2149, 800, 1.03, 7, 1);
    break;

    case S_OhOoh:
      bendTones(880, 2000, 1.04, 8, 3); //A5 = 880
      delay(200);

      for (int i=880; i<2000; i=i*1.04) {
           _tone(note_B5,5,10);
      }
    break;

    case S_OhOoh2:
      bendTones(1880, 3000, 1.03, 8, 3);
      delay(200);

      for (int i=1880; i<3000; i=i*1.03) {
          _tone(note_C6,10,10);
      }
    break;

    case S_cuddly:
      bendTones(700, 900, 1.03, 16, 4);
      bendTones(899, 650, 1.01, 18, 7);
    break;

    case S_sleeping:
      bendTones(100, 500, 1.04, 10, 10);
      delay(500);
      bendTones(400, 100, 1.04, 10, 1);
    break;

    case S_happy:
      bendTones(1500, 2500, 1.05, 20, 8);
      bendTones(2499, 1500, 1.05, 25, 8);
    break;

    case S_superHappy:
      bendTones(2000, 6000, 1.05, 8, 3);
      delay(50);
      bendTones(5999, 2000, 1.05, 13, 2);
    break;

    case S_happy_short:
      bendTones(1500, 2000, 1.05, 15, 8);
      delay(100);
      bendTones(1900, 2500, 1.05, 10, 8);
    break;

    case S_sad:
      bendTones(880, 669, 1.02, 20, 200);
    break;

    case S_confused:
      bendTones(1000, 1700, 1.03, 8, 2);
      bendTones(1699, 500, 1.04, 8, 3);
      bendTones(1000, 1700, 1.05, 9, 10);
    break;

    case S_fart1:
      bendTones(1600, 3000, 1.02, 2, 15);
    break;

    case S_fart2:
      bendTones(2000, 6000, 1.02, 2, 20);
    break;

    case S_fart3:
      bendTones(1600, 4000, 1.02, 2, 20);
      bendTones(4000, 3000, 1.02, 2, 20);
    break;

  }
}

///////////////////////////////////////////////////////////////////
//-- GESTURES ---------------------------------------------------//
///////////////////////////////////////////////////////////////////

void Otto::playGesture(int gesture){

  OTTO_INSTR_KIND(OTTO_K_GESTURE);
  OTTO_INSTR_BEGIN("gst");
 int gesturePOSITION[4];
  
  switch(gesture){

    case OttoHappy: 
        _tone(note_E5,50,30);
        putMouth(smile);
        sing(S_happy_short);
        swing(1,800,20); 
        sing(S_happy_short);

        home();
        putMouth(happyOpen);
    break;


    case OttoSuperHappy:
        putMouth(happyOpen);
        sing(S_happy);
        putMouth(happyClosed);
        tiptoeSwing(1,500,20);
        putMouth(happyOpen);
        sing(S_superHappy);
        putMouth(happyClosed);
        tiptoeSwing(1,500,20); 

        home();  
        putMouth(happyOpen);
    break;


    case OttoSad: 
        putMouth(sad);
        gesturePOSITION[0] = 110;//int sadPos[6]=      {110, 70, 20, 160};
        gesturePOSITION[1] = 70;
         gesturePOSITION[2] = 20;
          gesturePOSITION[3] = 160;
        _moveServos(700, gesturePOSITION);     
        bendTones(880, 830, 1.02, 20, 200);
        putMouth(sadClosed);
        bendTones(830, 790, 1.02, 20, 200);  
        putMouth(sadOpen);
        bendTones(790, 740, 1.02, 20, 200);
        putMouth(sadClosed);
        bendTones(740, 700, 1.02, 20, 200);
        putMouth(sadOpen);
        bendTones(700, 669, 1.02, 20, 200);
        putMouth(sad);
        delay(500);

        home();
        delay(300);
        putMouth(happyOpen);
    break;


    case OttoSleeping:
    gesturePOSITION[0] = 100;//int bedPos[6]=      {100, 80, 60, 120};
        gesturePOSITION[1] = 80;
         gesturePOSITION[2] = 60;
          gesturePOSITION[3] = 120;
        _moveServos(700, gesturePOSITION);     
        for(int i=0; i<4;i++){
          putAnimationMouth(dreamMouth,0);
          bendTones (100, 200, 1.04, 10, 10);
          putAnimationMouth(dreamMouth,1);
          bendTones (200, 300, 1.04, 10, 10);  
          putAnimationMouth(dreamMouth,2);
          bendTones (300, 500, 1.04, 10, 10);   
          delay(500);
          putAnimationMouth(dreamMouth,1);
          bendTones (400, 250, 1.04, 10, 1); 
          putAnimationMouth(dreamMouth,0);
          bendTones (250, 100, 1.04, 10, 1); 
          delay(500);
        } 

        putMouth(lineMouth);
        sing(S_cuddly);

        home();  
        putMouth(happyOpen);
    break;


    case OttoFart:
    gesturePOSITION[0] = 90;// int fartPos_1[6]=   {90, 90, 145, 122};
        gesturePOSITION[1] = 90;
         gesturePOSITION[2] = 145;
          gesturePOSITION[3] = 122;
        _moveServos(500,gesturePOSITION);
        delay(300);     
        putMouth(lineMouth);
        sing(S_fart1);  
        putMouth(tongueOut);
        delay(250);
        gesturePOSITION[0] = 90;// int fartPos_2[6]=   {90, 90, 80, 122};
        gesturePOSITION[1] = 90;
         gesturePOSITION[2] = 80;
          gesturePOSITION[3] = 122;
        _moveServos(500,gesturePOSITION);
        delay(300);
        putMouth(lineMouth);
        sing(S_fart2); 
        putMouth(tongueOut);
        delay(250);
        gesturePOSITION[0] = 90;// int fartPos_3[6]=   {90, 90, 145, 80};
        gesturePOSITION[1] = 90;
         gesturePOSITION[2] = 145;
          gesturePOSITION[3] = 80;
        _moveServos(500,gesturePOSITION);
        delay(300);
        putMouth(lineMouth);
        sing(S_fart3);
        putMouth(tongueOut);    
        delay(300);

        home(); 
        delay(500); 
        putMouth(happyOpen);
    break;


    case OttoConfused:
    gesturePOSITION[0] = 110;//int confusedPos[6]= {110, 70, 90, 90};
        gesturePOSITION[1] = 70;
         gesturePOSITION[2] = 90;
          gesturePOSITION[3] = 90;
        _moveServos(300, gesturePOSITION); 
        putMouth(confused);
        sing(S_confused);
        delay(500);

        home();  
        putMouth(happyOpen);
    break;


    case OttoLove:
        putMouth(heart);
        sing(S_cuddly);
        crusaito(2,1500,15,1);

        home(); 
        sing(S_happy_short);  
        putMouth(happyOpen);
    break;


    case OttoAngry: 
    gesturePOSITION[0] = 90;//int angryPos[6]=    {90, 90, 70, 110};
        gesturePOSITION[1] = 90;
         gesturePOSITION[2] = 70;
          gesturePOSITION[3] = 110;
        _moveServos(300, gesturePOSITION); 
        putMouth(angry);

        _tone(note_A5,100,30);
        bendTones(note_A5, note_D6, 1.02, 7, 4);
        bendTones(note_D6, note_G6, 1.02, 10, 1);
        bendTones(note_G6, note_A5, 1.02, 10, 1);
        delay(15);
        bendTones(note_A5, note_E5, 1.02, 20, 4);
        delay(400);
        gesturePOSITION[0] = 110;//int headLeft[6]=    {110, 110, 90, 90};
        gesturePOSITION[1] = 110;
         gesturePOSITION[2] = 90;
          gesturePOSITION[3] = 90;
        _moveServos(200, gesturePOSITION); 
        bendTones(note_A5, note_D6, 1.02, 20, 4);
        gesturePOSITION[0] = 70;//int headRight[6]=   {70, 70, 90, 90};
        gesturePOSITION[1] = 70;
         gesturePOSITION[2] = 90;
          gesturePOSITION[3] = 90;
        _moveServos(200, gesturePOSITION); 
        bendTones(note_A5, note_E5, 1.02, 20, 4);

        home();  
        putMouth(happyOpen);
    break;


    case OttoFretful: 
        putMouth(angry);
        bendTones(note_A5, note_D6, 1.02, 20, 4);
        bendTones(note_A5, note_E5, 1.02, 20, 4);
        delay(300);
        putMouth(lineMouth);

        for(int i=0; i<4; i++){
          gesturePOSITION[0] = 90;//int fretfulPos[6]=  {90, 90, 90, 110};
        gesturePOSITION[1] = 90;
         gesturePOSITION[2] = 90;
          gesturePOSITION[3] = 110;
          _moveServos(100, gesturePOSITION);   
          home();
        }

        putMouth(angry);
        delay(500);

        home();  
        putMouth(happyOpen);
    break;


    case OttoMagic:

        //Initial note frecuency = 400
        //Final note frecuency = 1000
        
        // Reproduce the animation four times
        for(int i = 0; i<4; i++){ 

          int noteM = 400; 

            for(int index = 0; index<6; index++){
              putAnimationMouth(adivinawi,index);
              bendTones(noteM, noteM+100, 1.04, 10, 10);    //400 -> 1000 
              noteM+=100;
            }

            clearMouth();
            bendTones(noteM-100, noteM+100, 1.04, 10, 10);  //900 -> 1100

            for(int index = 0; index<6; index++){
              putAnimationMouth(adivinawi,index);
              bendTones(noteM, noteM+100, 1.04, 10, 10);    //1000 -> 400 
              noteM-=100;
            }
        } 
 
        delay(300);
        putMouth(happyOpen);
    break;


    case OttoWave:
        
        // Reproduce the animation four times
        for(int i = 0; i<2; i++){ 

            int noteW = 500; 

            for(int index = 0; index<10; index++){
              putAnimationMouth(wave,index);
              bendTones(noteW, noteW+100, 1.02, 10, 10); 
              noteW+=101;
            }
            for(int index = 0; index<10; index++){
              putAnimationMouth(wave,index);
              bendTones(noteW, noteW+100, 1.02, 10, 10); 
              noteW+=101;
            }
            for(int index = 0; index<10; index++){
              putAnimationMouth(wave,index);
              bendTones(noteW, noteW-100, 1.02, 10, 10); 
              noteW-=101;
            }
            for(int index = 0; index<10; index++){
              putAnimationMouth(wave,index);
              bendTones(noteW, noteW-100, 1.02, 10, 10); 
              noteW-=101;
            }
        }    

        clearMouth();
        delay(100);
        putMouth(happyOpen);
    break;

    case OttoVictory:
        
        putMouth(smallSurprise);
        //final pos   = {90,90,150,30}
        for (int i = 0; i < 60; ++i){
          int pos[]={90,90,90+i,90-i};  
          _moveServos(10,pos);
          _tone(1600+i*20,15,1);
        }

        putMouth(bigSurprise);
        //final pos   = {90,90,90,90}
        for (int i = 0; i < 60; ++i){
          int pos[]={90,90,150-i,30+i};  
          _moveServos(10,pos);
          _tone(2800+i*20,15,1);
        }

        putMouth(happyOpen);
        //SUPER HAPPY
        //-----
        tiptoeSwing(1,500,20);
        sing(S_superHappy);
        putMouth(happyClosed);
        tiptoeSwing(1,500,20); 
        //-----

        home();
        clearMouth();
        putMouth(happyOpen);

    break;

    case OttoFail:
        putMouth(sadOpen);
         gesturePOSITION[0] = 90;//int bendPos_1[6]=   {90, 90, 70, 35};
        gesturePOSITION[1] = 90;
         gesturePOSITION[2] = 70;
          gesturePOSITION[3] = 35;
        _moveServos(300,gesturePOSITION);
        _tone(900,200,1);
        putMouth(sadClosed);
        gesturePOSITION[0] = 90;//int bendPos_2[6]=   {90, 90, 55, 35};
        gesturePOSITION[1] = 90;
         gesturePOSITION[2] = 55;
          gesturePOSITION[3] = 35;
        _moveServos(300,gesturePOSITION);
        _tone(600,200,1);
        putMouth(confused);
        gesturePOSITION[0] = 90;//int bendPos_3[6]=   {90, 90, 42, 35};
        gesturePOSITION[1] = 90;
         gesturePOSITION[2] = 42;
          gesturePOSITION[3] = 35;
        _moveServos(300,gesturePOSITION);
        _tone(300,200,1);
        gesturePOSITION[0] = 90;//int bendPos_4[6]=   {90, 90, 34, 35};
        gesturePOSITION[1] = 90;
         gesturePOSITION[2] = 34;
          gesturePOSITION[3] = 35;
        _moveServos(300,gesturePOSITION);
        putMouth(xMouth);

        detachServos();
        _tone(150,2200,1);
        
        delay(600);
        clearMouth();
        putMouth(happyOpen);
        home();

    break;

  }

  OTTO_INSTR_END();
}

void Otto::enableServoLimit(int diff_limit) {
  for (int i = 0; i < 4; i++) {
    servo[i].SetLimiter(diff_limit);
  }
}

void Otto::disableServoLimit() {
  for (int i = 0; i < 4; i++) {
    servo[i].DisableLimiter();
  }
}
//==============================================================================
//-- SENSORES (anadido 2026-11-13, rama feat/sensores)
//==============================================================================
//
//-- POR QUE ESTO NO ESTABA. El generador de Blockly emite Otto.getSensor() y la
//-- libreria no lo tenia, asi que cualquier programa con ese bloque moria con
//-- "error: 'class Otto' has no member named 'getSensor'". No es algo que se
//-- rompiera: el fork llego asi, y se comprobo en b2c182f.
//
//-- EL ENREDO DE NOMBRES, que conviene conocer antes de tocar nada:
//--
//--   bloque            emite               etiqueta en espanol   existe el bloque
//--   otto_getsensor    Otto.getSensor()    "Ruido medido"        SI
//--   (ninguno)         --                  "Distancia [cm]"      NO: el texto
//--                                                               esta en el
//--                                                               idioma pero el
//--                                                               bloque no se
//--                                                               define en
//--                                                               ottoesp.js
//--
//-- O sea que el unico bloque Otto de sensor que existe es el de RUIDO, aunque su
//-- funcion se llame getSensor. Por eso getSensor() es alias de getNoise(): si
//-- devolviera distancia, un bloque etiquetado "Ruido medido" mentiria, que es
//-- peor que no compilar.
//--
//-- PARA MEDIR DISTANCIA DESDE BLOCKLY HAY DOS CAMINOS, y los dos son decision
//-- del propietario porque tocan www/:
//--   a) usar el bloque generico "ultrasonic_sensor" de la categoria Sensores,
//--      que NO depende de esta libreria: se genera su propia funcion con
//--      pulseIn y ya funciona hoy. Ojo: usa el pulseIn por defecto, o sea
//--      timeout de UN SEGUNDO, con lo que puede congelar una marcha.
//--   b) definir el bloque otto_getdistance en ottoesp.js -el texto en espanol ya
//--      existe- y que emita Otto.getDistance(), que es lo que se anade aqui.
//==============================================================================

float Otto::getDistance() {
  //-- El HC-SR04 necesita ~60 ms entre disparos o le llega el eco del anterior.
  //-- Entre medias se devuelve la ultima lectura: es correccion de hardware, no
  //-- un atajo, y de paso evita que un bucle de Blockly lo dispare a destiempo.
  const unsigned long ahora = millis();
  if (_usLastMs != 0 && (ahora - _usLastMs) < (unsigned long)OTTO_US_INTERVALO_MS) {
    return _usLastCm;
  }
  _usLastMs = ahora;

  pinMode(OTTO_US_TRIGGER_PIN, OUTPUT);
  pinMode(OTTO_US_ECHO_PIN, INPUT);

  //-- Pulso de disparo: 10 us en alto, precedido de un nivel bajo limpio.
  digitalWrite(OTTO_US_TRIGGER_PIN, LOW);
  delayMicroseconds(4);
  digitalWrite(OTTO_US_TRIGGER_PIN, HIGH);
  delayMicroseconds(OTTO_US_DISPARO_US);   //-- 25, no 10: ver la nota en Otto.h
  digitalWrite(OTTO_US_TRIGGER_PIN, LOW);

  //-- TIMEOUT EXPLICITO. Sin el, pulseIn espera un segundo entero cuando no hay
  //-- eco y se lleva por delante el temporizado de la marcha.
  const unsigned long dur = pulseIn(OTTO_US_ECHO_PIN, HIGH, OTTO_US_TIMEOUT_US);

  if (dur == 0) {                       //-- no volvio eco dentro del plazo
    _usLastCm = (float)OTTO_US_SIN_ECO_CM;
    return _usLastCm;
  }

  //-- 58 us por centimetro de ida y vuelta: 2 cm / 0.0343 cm-por-us.
  float cm = (float)dur / 58.0f;
  if (cm > (float)OTTO_US_SIN_ECO_CM) cm = (float)OTTO_US_SIN_ECO_CM;
  _usLastCm = cm;
  return cm;
}

int Otto::getNoise() {
  //-- Promedio corto: la salida de estos modulos de sonido es muy ruidosa y una
  //-- sola lectura da saltos que no significan nada.
  long suma = 0;
  for (uint8_t i = 0; i < (uint8_t)OTTO_NOISE_MUESTRAS; i++) {
    suma += analogRead(OTTO_NOISE_PIN);
  }
  return (int)(suma / (long)OTTO_NOISE_MUESTRAS);
}

//-- Alias del nombre que emite el generador. Ver el enredo de nombres arriba.
float Otto::getSensor() {
  return (float)getNoise();
}
