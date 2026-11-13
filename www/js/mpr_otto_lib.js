'use strict';

// MPR: la librería Otto del robot (compilation/arduino/userlibs/libraries/Otto, versión MPR: Otto.cpp, Oscillator.cpp,
// Otto_sounds.h, Otto_gestures.h) traducida a JavaScript para "Probar en pantalla": el Otto 3D hace los mismos
// movimientos de servos y los mismos sonidos que el robot real con el programa del niño. Traducción fiel: mismas
// amplitudes, desfases, períodos y pasos, el limitador del oscilador (OTTO_DIFF_LIMIT_DEFAULT 3: un grado por orden,
// DOCUMENTACION_TECNICA.md 5.5), el refresco round-robin, el piso de periodo de las marchas y el _moveServos de la
// librería nueva (nov-2026: arranque y frenada graduales, tope de 150 grados/s sumando los 4 servos, por trozos), todas
// las canciones y gestos, con las cuentas redondeadas como en el Nano (ver "Números"). Otro módulo interpreta los
// bloques y dibuja el robot; este calcula qué recibe cada servo y el zumbador.
//
// API: var otto = MPROttoLib.crear(hw);  métodos async con los mismos argumentos (y valores por defecto) que el C++:
//   init() (bloque Configuración Otto: conecta los servos de a uno y va a home), home(), jump, walk, turn, bend,
//   shakeLeg, updown, swing, tiptoeSwing, jitter, ascendingTurn, moonwalker, crusaito, flapping,
//   _moveServos(T, [p0, p1, p2, p3]), _moveSingle, oscillateServos, _execute, _tone, bendTones,
//   sing('S_happy'), playGesture('OttoHappy'), attachServos, detachServos, enableServoLimit, disableServoLimit,
//   setTrims y saveTrimsOnEEPROM (sin efecto), bocas y matriz de LED (putMouth, putAnimationMouth, clearMouth,
//   writeText, initMATRIX, matrixIntensity, setLed: sin efecto, con sus pausas) y delay(ms) (el delay() de Arduino con
//   el reloj del robot: conviene para el bloque Esperar). Sin espera: millis(), getRestState(), setRestState().
//   MPROttoLib.SONIDOS y MPROttoLib.GESTOS: los nombres de Otto_sounds.h y Otto_gestures.h que aceptan sing() y
//   playGesture() (se quitan los espacios de los lados; también aceptan el número del #define). Un nombre que no está
//   termina de inmediato, como el switch del C++.
// Las órdenes se esperan una por una (await), como en el robot. Para detener, el anfitrión rechaza esperar() o
// cuadro(): el rechazo sale por la orden en curso.
//
// hw (lo da el anfitrión):
//   escribir(i, grados)  servo i (0 pierna izq. YL, 1 pierna der. YR, 2 pie izq. RL, 3 pie der. RR) a 0..180 grados
//   ahora()              milisegundos, como millis() (con decimales sirve)
//   esperar(ms)          promesa que se cumple tras ms, como delay(); se rechaza al detener
//   cuadro()             promesa del próximo cuadro (~16 ms); se rechaza al detener
//   tono(hz, ms)         empieza un tono de ms, sin esperar (como tone(pin, f, d)); ms = 0: sin fin, hasta otro tono
//   silencio()           como noTone()
//   movimiento(info)     al empezar cada movimiento, para deslizar o girar el cuerpo en el suelo (sin esperar):
//                        { tipo, pasos, T, dir (0 si no tiene), h (si tiene), ms (duración prevista) }; tipo es
//                        'caminar' (walk), 'girar' (turn), 'moonwalker', 'crusaito', 'subir' (jump, updown) o el
//                        nombre del movimiento: 'bend', 'shakeLeg', 'swing', 'tiptoeSwing', 'jitter', 'ascendingTurn',
//                        'flapping'. Los gestos que usan movimientos también lo llaman.
//
// Tiempo: el robot lleva su propio reloj (ms desde el encendido, que es init()) y todo se calcula en el milisegundo en
// que ocurriría en el robot: muestras del oscilador cada 20 ms, pasos de 10 ms de _moveServos, limitador según el
// tiempo entre órdenes, delay(). Donde el C++ da vueltas leyendo millis() se espera el próximo cuadro y se pone al día
// con ahora(): lo que ya debía haber ocurrido se calcula en su instante, no según los cuadros, así que movimientos y
// duraciones son los del robot aunque los cuadros lleguen tarde (el reloj del robot nunca adelanta al real). delay()
// espera con esperar(), más preciso para los tonos cortos. El tiempo entre una orden y la siguiente (bloques de espera
// del anfitrión, sensores) también pasa para el robot; un atraso de más de 250 ms dentro de una orden (ventana
// minimizada, equipo trabado) se toma como pausa: el robot sigue desde donde quedó.
//
// Lo que no se puede reproducir en pantalla:
//  - Trims (calibración leída de la EEPROM en init(), setTrims, saveTrimsOnEEPROM): el Otto 3D no los necesita.
//  - attach/detach: el robot real queda sin fuerza tras home() y en OttoFail (se desploma tras detachServos()); en
//    pantalla los servos se quedan donde estaban. Los 300 ms tras conectar cada servo en init() sí se respetan.
//  - El freno adaptativo de la librería nueva (OTTO_BRAKE: con las pilas bajas frena marchas y _moveServos, hasta el
//    doble de tiempo) mide la tensión de la placa: en pantalla no hay pilas, se mueve siempre al ritmo nominal (como el
//    robot con pilas buenas). Tampoco el registro de diagnóstico (OTTO_INSTRUMENT, apagado en la entrega).
//  - El servo real tarda en llegar (unos 450 grados/s, con peso y pilas); en pantalla llega al instante a lo ordenado.
//  - millis() del Nano avanza a saltos de 1,024 ms y cada muestra del oscilador toma ~0,3 ms (a veces corre 1 ms la
//    siguiente); aquí los milisegundos son exactos.
//  - La matriz de LED (bocas) no viene en el kit MPR: en el robot tampoco se ve nada.

var MPROttoLib = (function() {
	// ---------------------------------------------------------------- constantes (Otto.h y Oscillator.h, versión MPR)
	// MPR: valores de la librería nueva (commit 315cd81, PLAN_PULIDO F2)
	var DIFF_LIMIT_DEFAULT = 3;      // OTTO_DIFF_LIMIT_DEFAULT: el Oscillator de MPR lo toma como grados por segundo; con
	                                 // 3 y órdenes cada 10-50 ms la cuenta da 0 y queda en 1 grado por orden
	var ATTACH_STAGGER_MS = 300;     // OTTO_ATTACH_STAGGER_MS: pausa tras conectar cada servo en init()
	var ORDEN_PIES = [2, 3, 0, 1];   // pies antes que caderas (init() y _moveServos)
	var AGG_RATE = 150;              // OTTO_AGG_RATE_DEFAULT: tope de _moveServos, grados/s sumando los 4 servos
	var MV_TICK_MS = 10;             // OTTO_MV_TICK_MS: paso del lazo de _moveServos
	var MV_RAMP_PCT = 15;            // OTTO_MV_RAMP_PCT: % del recorrido para acelerar (y otro tanto para frenar)
	var MV_TRV_CHUNK = 50;           // OTTO_MV_TRV_CHUNK: recorrido sumado por trozo
	var MIN_LOAD_PCT = 70;           // OTTO_BRAKE_MIN_LOAD_PCT: solo se trocea lo que va al tope del presupuesto
	var HOME_T = 600;                // OTTO_HOME_T: home() en dos fases de 300 ms
	var GAIT_T_PER_DEG = 50;         // OTTO_GAIT_T_PER_DEG: piso de periodo de las marchas, ms por grado de amplitud
	var MAX_DT_MS = 50;              // OSCILLATOR_MAX_DT_MS: más tiempo sin órdenes es una pausa para el limitador
	var SERVO_LIMIT_DEFAULT = 240;   // SERVO_LIMIT_DEFAULT: valor por defecto de enableServoLimit()
	var SHAKE_APOYO = 55;            // shakeLeg(): pie de apoyo (antes 58)
	var SHAKE_CRUCE = 90 + 30;       // shakeLeg(): 90 + OTTO_SHAKE_CROSS_DEG, el pie libre cruza el centro
	// Reloj del simulador (ver "Tiempo")
	var ATRASO_MAX_MS = 250;         // atraso dentro de una orden que se toma como pausa
	var SIN_PAUSA_MAX = 1000;        // órdenes seguidas sin esperar antes de ceder un cuadro (no trabar la página)

	// Otto_sounds.h y Otto_gestures.h, en el orden de sus #define
	var SONIDOS = ['S_connection', 'S_disconnection', 'S_buttonPushed', 'S_mode1', 'S_mode2', 'S_mode3', 'S_surprise',
		'S_OhOoh', 'S_OhOoh2', 'S_cuddly', 'S_sleeping', 'S_happy', 'S_superHappy', 'S_happy_short', 'S_sad',
		'S_confused', 'S_fart1', 'S_fart2', 'S_fart3'];
	var GESTOS = ['OttoHappy', 'OttoSuperHappy', 'OttoSad', 'OttoSleeping', 'OttoFart', 'OttoConfused', 'OttoLove',
		'OttoAngry', 'OttoFretful', 'OttoMagic', 'OttoWave', 'OttoVictory', 'OttoFail'];
	// Notas de Otto_sounds.h que usan sing() y playGesture()
	var N = { E5: 659.26, A5: 880, B5: 987.77, C6: 1046.5, D6: 1174.66, E6: 1318.51, G6: 1567.98, A6: 1760,
		D7: 2349.32 };

	// ---------------------------------------------------------------- números como en el Nano
	// En el Nano (AVR) double es float de 32 bits: las cuentas del oscilador, de _moveServos y de bendTones se redondean
	// a float (Math.fround) para dar las mismas posiciones y los mismos tonos (en float 1500 * 1.05 da 1574.9999: el
	// tono sigue en 1574 y no en 1575). int es de 16 bits; round() de C lleva las mitades lejos del cero.
	var f32 = Math.fround;
	var PI = f32(Math.PI);           // M_PI
	var DOS_PI = f32(2 * PI);        // 2*M_PI

	function ent(x) {                // a int (16 bits): trunca y da la vuelta
		x = Math.trunc(Number(x));
		return isFinite(x) ? (x << 16) >> 16 : 0;
	}

	function largo(x) {              // a long (32 bits)
		x = Math.trunc(Number(x));
		return isFinite(x) ? x | 0 : 0;
	}

	function sinSigno(x) {           // a unsigned int (16 bits)
		return ent(x) & 0xFFFF;
	}

	function redondear(x) {          // round() de C
		return x < 0 ? -Math.round(-x) : Math.round(x);
	}

	function gradosARad(g) {         // DEG2RAD(g) = ((g)*M_PI)/180, en float
		return f32(f32(ent(g) * PI) / 180);
	}

	// Nombre de una canción o gesto: el del #define (sin espacios a los lados) o su número
	function nombre(x, lista) {
		if (typeof x == 'number') return lista[x] || null;
		x = String(x == null ? '' : x).trim();
		return lista.indexOf(x) >= 0 ? x : null;
	}

	// MPR: ottoMvShape() de Otto.cpp (PLAN_PULIDO F2). Perfil trapezoidal de _moveServos: entra la fracción de tiempo y
	// sale la de recorrido, en milésimas (cuentas enteras sin signo, como en el C++).
	function formaMv(u) {
		if (u >= 1000) return 1000;
		var r = MV_RAMP_PCT * 10;
		if (r == 0 || r > 500) return u;
		var den = (1000 - r) * 2 * r;
		if (u < r) return Math.floor(u * u * 1000 / den);
		if (u > 1000 - r) {
			var v = 1000 - u;
			return 1000 - Math.floor(v * v * 1000 / den);
		}
		return Math.floor(1000 * (u * 2 - r) / ((1000 - r) * 2));
	}

	// MPR: piso de periodo de _execute() (OTTO_GAIT_T_PER_DEG, PLAN_PULIDO F2): T no baja de 50 ms por grado de la
	// amplitud mayor (walk y turn 1500, la mayoría de los bailes con tamaño 25: 1250, con tamaño 40: 2000). Nunca acelera.
	function pisoT(A, T) {
		var amax = 0;
		for (var i = 0; i < 4; i++) amax = Math.max(amax, Math.abs(ent(A[i])));
		var tmin = amax * GAIT_T_PER_DEG;
		return tmin > T ? ent(tmin) : T;
	}

	// MPR: duración que tendrá _moveServos(time) de "desde" a "hasta" (para avisar al anfitrión la duración prevista):
	// la misma cuenta del tiempo efectivo, el troceado y el paso de 10 ms que hace _moveServos.
	function msMover(desde, hasta, time, trozo) {
		var i, trv = 0;
		for (i = 0; i < 4; i++) trv += Math.abs(ent(hasta[i]) - desde[i]);
		var tReq = time > 0 ? time : 0;
		if (trv == 0) return tReq;
		var tCap = Math.floor(trv * 1000 / AGG_RATE);
		var tEff = Math.max(tReq, tCap, MV_TICK_MS);
		if (!trozo && MV_TRV_CHUNK > 0 && trv > MV_TRV_CHUNK && Math.floor(tCap * 100 / tEff) >= MIN_LOAD_PCT) {
			var n = Math.min(8, Math.max(2, Math.ceil(trv / MV_TRV_CHUNK))), ms = 0, a = desde;
			for (var k = 1; k <= n; k++) {
				var wp = [];
				for (i = 0; i < 4; i++) wp[i] = k == n ? ent(hasta[i]) : desde[i] + Math.trunc((ent(hasta[i]) - desde[i]) * k / n);
				ms += msMover(a, wp, Math.floor(tEff / n), true);
				a = wp;
			}
			return ms;
		}
		return MV_TICK_MS * Math.max(0, Math.ceil((tEff - MV_TICK_MS / 2) / MV_TICK_MS));
	}

	// ---------------------------------------------------------------- Oscillator (Oscillator.h y Oscillator.cpp)
	function Oscilador(indice) {
		this.indice = indice;
		this.reiniciar();
	}

	// Como al encender: Oscillator(trim = 0) (MPR: _pos parte en 90) y lo demás en 0 (Otto es un objeto global)
	Oscilador.prototype.reiniciar = function() {
		this.trim = 0;            // _trim
		this.limite = 0;          // _diff_limit (grados por segundo; 0 = sin limitador)
		this.pos = 90;            // _pos: última posición enviada al servo
		this.ultimaOrden = 0;     // _previousServoCommandMillis
		this.conectado = false;   // _servo.attached()
		this.A = 0;               // _amplitude
		this.O = 0;               // _offset
		this.periodo = 0;         // _period
		this.fase0 = 0;           // _phase0
		this.fase = 0;            // _phase
		this.inc = 0;             // _inc
		this.muestreo = 20;       // _samplingPeriod (en el C++ vale 0 hasta el primer attach(), que lo pone en 20)
		this.anterior = 0;        // _previousMillis
		this.parado = false;      // _stop
		this.rev = false;         // _rev
	};

	// attach(): solo si estaba desconectado. MPR: envía la última posición conocida (con trim) antes de conectar, sin
	// saltos. Reinicia los parámetros del oscilador: después de home() (que desconecta) la fase vuelve a 0.
	Oscilador.prototype.conectar = function(otto, rev) {
		if (this.conectado) return;
		otto._servo(this.indice, this.pos + this.trim);
		this.conectado = true;
		this.ultimaOrden = otto.millis();
		this.muestreo = 20;
		this.periodo = 2000;
		this.inc = f32(DOS_PI / f32(this.periodo / this.muestreo));
		this.anterior = 0;
		this.A = 45;
		this.fase = 0;
		this.fase0 = 0;
		this.O = 0;
		this.parado = false;
		this.rev = !!rev;
	};

	// SetT(): MPR, cantidad de muestras con decimales
	Oscilador.prototype.setT = function(T) {
		this.periodo = sinSigno(T);
		this.inc = f32(DOS_PI / f32(this.periodo / this.muestreo));
	};

	// write() (también SetPosition()). MPR: limitador en grados por segundo según el tiempo desde la orden anterior;
	// tras una pausa (más de 50 ms) cuenta como un solo pulso de 20 ms. "ahora" es millis() del robot.
	Oscilador.prototype.escribir = function(otto, posicion, ahora) {
		if (this.limite > 0) {
			var dt = ahora - this.ultimaOrden;
			if (dt > MAX_DT_MS || dt < 0) dt = 20;
			var limite = Math.trunc((dt * this.limite + 500) / 1000);
			if (limite < 1) limite = 1;
			if (Math.abs(posicion - this.pos) > limite) this.pos += posicion < this.pos ? -limite : limite;
			else this.pos = posicion;
		} else {
			this.pos = posicion;
		}
		this.ultimaOrden = ahora;
		otto._servo(this.indice, this.pos + this.trim);
	};

	// refresh() cuando toca muestra (next_sample): posición = round(A·sen(fase + fase0) + O) + 90. La fase avanza
	// 2π/(T/20) en cada muestra, también con el oscilador detenido (Stop), para no perder la coordinación.
	Oscilador.prototype.muestrear = function(otto, ahora) {
		this.anterior = ahora;
		if (!this.parado) {
			var pos = ent(redondear(f32(f32(this.A * f32(Math.sin(f32(this.fase + this.fase0)))) + this.O)));
			if (this.rev) pos = -pos;
			this.escribir(otto, ent(pos + 90), ahora);
		}
		this.fase = f32(this.fase + this.inc);
	};

	// ---------------------------------------------------------------- Otto (Otto.cpp)
	function Otto(hw) {
		this.hw = hw;
		this.osc = [new Oscilador(0), new Oscilador(1), new Oscilador(2), new Oscilador(3)];
		this.reposo = false;   // isOttoResting
		// MPR: ya no hay "static rr" en _moveServos: la librería nueva mueve los 4 servos en cada paso (PLAN_PULIDO F2)
		this.trozando = false; // _mvSplit: _moveServos está partido en trozos (un solo nivel)
		this.nivel = 0;       // órdenes en curso (un gesto llama a sing, home...)
		this.sinPausa = 0;
		this._encender();
	}

	var P = Otto.prototype;

	// Métodos públicos. Al entrar desde fuera, el reloj del robot suma el tiempo real que pasó desde la orden anterior
	// (si el anfitrión esperó, también pasa para el robot). El atraso propio (cuadros) no se suma: se recupera solo.
	function publico(fn) {
		return async function() {
			if (this.nivel++ == 0) {
				var hueco = this._real() - this.realFin;
				if (hueco > 0) this.t += hueco;
				this.sinPausa = 0;
			}
			try {
				return await fn.apply(this, arguments);
			} finally {
				if (--this.nivel == 0) this.realFin = this._real();
			}
		};
	}

	// ---------------------------------------------------------------- reloj
	P._encender = function() {
		this.origen = this.hw.ahora();
		this.t = 0;            // reloj del robot: ms desde el encendido, con decimales; millis() es la parte entera
		this.realFin = 0;      // tiempo real (desde el origen) en que terminó la última orden
	};

	P._real = function() {
		return this.hw.ahora() - this.origen;
	};

	P.millis = function() {
		return Math.floor(this.t);
	};

	// Lleva el reloj del robot hasta x (como "while (millis() < x);" o el final de un delay) y espera a que el tiempo
	// real lo alcance: con esperar() si es preciso (delay), si no con cuadros. Si el tiempo real ya pasó (un cuadro que
	// llegó tarde), sigue sin esperar: lo atrasado se calcula en su instante y se pone al día.
	P._hasta = async function(x, preciso) {
		if (x > this.t) this.t = x;
		for (;;) {
			var falta = this.t - this._real();
			if (falta <= 0) {
				if (-falta > ATRASO_MAX_MS) this.origen -= falta;   // pausa larga: el robot sigue desde donde quedó
				if (++this.sinPausa < SIN_PAUSA_MAX) return;
				this.sinPausa = 0;
				await this.hw.cuadro();
				return;
			}
			this.sinPausa = 0;
			if (preciso) await this.hw.esperar(Math.min(falta, 60000));
			else await this.hw.cuadro();
		}
	};

	// delay(ms) de Arduino (unsigned long, exacto)
	P._delay = async function(ms) {
		ms = largo(ms);
		if (ms < 0) {   // en el Nano un número negativo se vuelve enorme (~49 días): el programa queda detenido aquí
			for (;;) await this.hw.esperar(60000);
		}
		await this._hasta(this.t + ms, true);
	};

	P.delay = publico(async function(ms) {
		await this._delay(ms);
	});

	// ---------------------------------------------------------------- servos y zumbador
	// Servo::write(): hasta 543 son grados (se limitan a 0..180); desde 544, microsegundos (544..2400 = 0..180 grados)
	P._servo = function(i, valor) {
		var g = valor < 544 ? (valor < 0 ? 0 : valor > 180 ? 180 : valor) :
			Math.round((Math.min(valor, 2400) - 544) * 180 / 1856);
		this.hw.escribir(i, g);
	};

	// tone(pinBuzzer, f, d) de Arduino: f pasa a unsigned int (note_E5 = 659,26 suena a 659 Hz); d = 0 suena sin fin.
	// Si 2·f·d/1000 da 0 (f = 0, o un tono muy corto y grave), tone() se apaga en la primera interrupción: silencio.
	P._tono = function(frecuencia, duracion) {
		var f = Math.trunc(frecuencia);
		f = f > 0 ? f & 0xFFFF : 0;
		var d = duracion < 0 ? 0 : duracion;   // negativa: en unsigned long son horas de tono; se toma sin fin
		if (f == 0 || (d > 0 && Math.floor(2 * f * d / 1000) == 0)) {
			if (this.hw.silencio) this.hw.silencio();
		} else if (this.hw.tono) {
			this.hw.tono(f, d);
		}
	};

	P._conectarServos = function() {
		for (var i = 0; i < 4; i++) this.osc[i].conectar(this);
	};

	P._desconectarServos = function() {
		for (var i = 0; i < 4; i++) this.osc[i].conectado = false;
	};

	// MPR: duración prevista de una serie de _moveServos (poses[k] en tiempos[k]) desde la posición actual, con las
	// cuentas de la librería nueva (msMover, PLAN_PULIDO F2)
	P._msPoses = function(poses, tiempos) {
		var ms = 0, a = [];
		for (var i = 0; i < 4; i++) a[i] = this.osc[i].pos;
		for (var k = 0; k < poses.length; k++) {
			ms += msMover(a, poses[k], ent(tiempos[k]));
			a = poses[k].map(ent);
		}
		return ms;
	};

	// Avisa al anfitrión que empieza un movimiento (para deslizar o girar el cuerpo); ms = duración prevista
	P._movimiento = function(tipo, pasos, T, dir, h, ms) {
		if (typeof this.hw.movimiento != 'function') return;
		var info = { tipo: tipo, pasos: pasos, T: T, dir: dir };
		if (h !== undefined) info.h = h;
		info.ms = ms !== undefined ? ms : Math.max(0, T * pasos);
		this.hw.movimiento(info);
	};

	// ---------------------------------------------------------------- inicio y conexión
	// Otto.init(LeftLeg, RightLeg, LeftFoot, RightFoot, true, Buzzer) + Otto.home() del bloque Configuración Otto. Como
	// al encender el robot: reloj en 0, servos en 90 y conectados de a uno, limitador (OTTO_DIFF_LIMIT_DEFAULT) y home().
	// MPR: como Otto::init() de la librería nueva (PLAN_PULIDO F2): pies primero (2, 3, 0, 1) y 300 ms después de
	// conectar cada uno (1,2 s); el home() siguiente, con todo en 90, no recorre nada y solo espera 300 ms. Si
	// después se llama home(), no hace nada: ya está en reposo, como en el robot.
	P.init = publico(async function(YL, YR, RL, RR, load_calibration, Buzzer) {
		this._encender();
		for (var i = 0; i < 4; i++) this.osc[i].reiniciar();
		this.reposo = false;
		this.trozando = false;
		if (this.hw.silencio) this.hw.silencio();
		// load_calibration: el robot lee los trims de la EEPROM después de conectar; en pantalla quedan en 0
		for (i = 0; i < 4; i++) {
			this.osc[ORDEN_PIES[i]].conectar(this);
			await this._delay(ATTACH_STAGGER_MS);
		}
		for (i = 0; i < 4; i++) this.osc[i].limite = DIFF_LIMIT_DEFAULT;   // OTTO_LIMITER_DEFAULT_ON
		this.reposo = false;
		await this.home();
	});

	P.attachServos = publico(async function() {
		this._conectarServos();
	});

	P.detachServos = publico(async function() {
		this._desconectarServos();
	});

	// Trims: el Otto 3D no necesita calibración; no cambian nada
	P.setTrims = publico(async function(YL, YR, RL, RR) {});

	P.saveTrimsOnEEPROM = publico(async function() {
		await this._delay(10);   // EEPROM.write de 4 bytes: cada escritura espera ~3,4 ms a la anterior
	});

	P.enableServoLimit = publico(async function(speed_limit_degree_per_sec = SERVO_LIMIT_DEFAULT) {
		var v = ent(speed_limit_degree_per_sec);
		for (var i = 0; i < 4; i++) this.osc[i].limite = v;
	});

	P.disableServoLimit = publico(async function() {
		for (var i = 0; i < 4; i++) this.osc[i].limite = 0;
	});

	P.getRestState = function() {
		return this.reposo;
	};

	P.setRestState = function(state) {
		this.reposo = !!state;
	};

	// ---------------------------------------------------------------- movimientos básicos
	// _moveServos(): MPR, como Otto::_moveServos() de la librería nueva (PLAN_PULIDO F2). Tiempo efectivo: lo pedido, o
	// más si el recorrido sumado de los 4 servos pasa de 150 grados/s (t_cap = recorrido·1000/150). Cada 10 ms mueve
	// los 4 servos a la vez (pies primero) por un perfil trapezoidal (arranca y frena suave: 15 % del recorrido en cada
	// punta) y termina justo al acabar el tiempo, sin ajuste final. Si va al tope de los 150 grados/s y recorre más de
	// 50 grados en total, se parte en trozos de 50 (2 a 8) que suman el mismo tiempo. Sin recorrido: solo espera el
	// tiempo pedido, sin escribir (igual que el paquete). El freno por tensión no aplica en pantalla.
	P._moveServos = publico(async function(time, servo_target) {
		time = ent(time);
		var i, k, objetivo = [];
		for (i = 0; i < 4; i++) objetivo[i] = ent(servo_target ? servo_target[i] : 0);
		this._conectarServos();
		if (this.reposo) this.reposo = false;
		var desde = [], delta = [], pend = [], trv = 0;
		for (i = 0; i < 4; i++) {
			desde[i] = this.osc[i].pos;
			delta[i] = objetivo[i] - desde[i];
			pend[i] = Math.abs(delta[i]);
			trv += pend[i];
		}
		var tReq = time > 0 ? time : 0;
		if (trv == 0) {
			// como Otto.cpp del paquete: nada que recorrer, solo se consume el tiempo pedido (no se escribe)
			await this._hasta(this.millis() + tReq, false);
			return;
		}
		var tCap = Math.floor(trv * 1000 / AGG_RATE);
		var tEff = Math.max(tReq, tCap, MV_TICK_MS);
		var carga = Math.floor(tCap * 100 / tEff);
		if (!this.trozando && MV_TRV_CHUNK > 0 && trv > MV_TRV_CHUNK && carga >= MIN_LOAD_PCT) {
			var n = Math.min(8, Math.max(2, Math.ceil(trv / MV_TRV_CHUNK)));
			var tTramo = Math.floor(tEff / n);
			this.trozando = true;
			try {
				for (k = 1; k <= n; k++) {
					var wp = [];
					for (i = 0; i < 4; i++) wp[i] = k == n ? objetivo[i] : desde[i] + Math.trunc(delta[i] * k / n);
					await this._moveServos(tTramo, wp);
				}
			} finally {
				this.trozando = false;
			}
			return;
		}
		var t0 = this.millis(), mitad = MV_TICK_MS / 2;
		for (;;) {
			var ahora = this.millis();
			var prog = Math.min(ahora - t0, tEff);   // sin freno: el reloj virtual es el real
			var s = formaMv(Math.floor(Math.min(prog + mitad, tEff) * 1000 / tEff));
			var llegado = true;
			for (k = 0; k < 4; k++) {
				i = ORDEN_PIES[k];
				if (pend[i] == 0) continue;
				var hecho = Math.min(Math.floor((pend[i] * s + 500) / 1000), pend[i]);
				var meta = desde[i] + (delta[i] < 0 ? -hecho : hecho);
				// el limitador del oscilador avanza un grado por orden: se repite hasta llegar (guarda de 200)
				for (var guarda = 200; this.osc[i].pos != meta && guarda > 0; guarda--) this.osc[i].escribir(this, meta, ahora);
				if (this.osc[i].pos != objetivo[i]) llegado = false;
			}
			if (llegado && prog + mitad >= tEff) break;
			await this._hasta(ahora + MV_TICK_MS, false);
		}
	});

	// Una sola orden: con el limitador avanza a lo más un grado. MPR: la librería nueva volvió a mandar a 90 lo que
	// está fuera de 0..180 (la versión MPR anterior lo limitaba a 0..180); se imita al robot (PLAN_PULIDO F2).
	P._moveSingle = publico(async function(position, servo_number) {
		position = ent(position);
		if (position > 180) position = 90;
		if (position < 0) position = 90;
		this._conectarServos();
		if (this.reposo) this.reposo = false;
		var n = ent(servo_number);
		if (n >= 0 && n <= 3) this.osc[n].escribir(this, position, this.millis());
	});

	// oscillateServos(): MPR, en la librería nueva el lazo es "while (virt <= lim)" con lim = (unsigned long)(T*cycle) y
	// un reloj virtual que el freno puede frenar; sin freno (en pantalla) el reloj virtual es millis() - ref, así que
	// termina igual que antes, en ref + lim + 1 (PLAN_PULIDO F2). Refresca un servo por vuelta (round-robin;
	// el orden dentro de un mismo milisegundo no cambia nada). Cada servo toma su muestra cuando pasaron 20 ms desde la
	// anterior, o de inmediato si ya pasaron (recién conectado, o tras una pausa). La fase no se reinicia entre
	// llamadas: dos walk seguidos continúan la oscilación.
	P.oscillateServos = publico(async function(A, O, T, phase_diff, cycle = 1) {
		T = ent(T);
		cycle = f32(cycle);
		var i;
		for (i = 0; i < 4; i++) {
			var s = this.osc[i];
			s.O = ent(O[i]);
			s.A = sinSigno(A[i]);
			s.setT(T);
			s.fase0 = f32(phase_diff[i]);
		}
		var ref = this.millis();
		var lim = Math.trunc(f32(T * cycle));   // (double)T * (double)cycle (float en el Nano), a unsigned long
		if (lim < 0) return;
		var ultimo = ref + lim;   // último milisegundo dentro del lazo
		var prox = [];
		for (i = 0; i < 4; i++) prox[i] = Math.max(this.osc[i].anterior + this.osc[i].muestreo, ref);
		for (;;) {
			var j = 0;
			for (i = 1; i < 4; i++) if (prox[i] < prox[j]) j = i;
			if (prox[j] > ultimo) break;
			await this._hasta(prox[j], false);
			this.osc[j].muestrear(this, prox[j]);
			prox[j] += this.osc[j].muestreo;
		}
		await this._hasta(ultimo + 1, false);
	});

	// MPR: con el piso de periodo de Otto::_execute() de la librería nueva (pisoT, PLAN_PULIDO F2)
	P._execute = publico(async function(A, O, T, phase_diff, steps = 1.0) {
		this._conectarServos();
		if (this.reposo) this.reposo = false;
		T = pisoT(A, ent(T));
		steps = f32(steps);
		var cycles = ent(steps);
		if (cycles >= 1) for (var i = 0; i < cycles; i++) await this.oscillateServos(A, O, T, phase_diff);
		await this.oscillateServos(A, O, T, phase_diff, f32(steps - cycles));   // el ciclo final incompleto
	});

	// MPR: como Otto::home() de la librería nueva (PLAN_PULIDO F2): en dos fases de OTTO_HOME_T/2 = 300 ms, primero los
	// pies (si no están en 90) y después las caderas; con mucho recorrido el tope de 150 grados/s lo alarga. Antes era
	// un solo _moveServos de 1000 ms.
	P.home = publico(async function() {
		if (!this.reposo) {
			if (this.osc[2].pos != 90 || this.osc[3].pos != 90) {
				await this._moveServos(HOME_T / 2, [this.osc[0].pos, this.osc[1].pos, 90, 90]);
			}
			await this._moveServos(HOME_T / 2, [90, 90, 90, 90]);
			this._desconectarServos();
			this.reposo = true;
		}
	});

	// Movimientos con osciladores: avisa al anfitrión y oscila. MPR: el anfitrión recibe el periodo con el piso de
	// _execute() (el que de verdad se usa), para que el cuerpo avance al mismo ritmo que las patas (PLAN_PULIDO F2).
	P._oscilar = function(tipo, steps, T, dir, h, A, O, phase_diff) {
		T = pisoT(A, T);
		this._movimiento(tipo, steps, T, dir, h);
		return this._execute(A, O, T, phase_diff, steps);
	};

	// ---------------------------------------------------------------- movimientos predeterminados
	// jump: el C++ no usa steps (sube y baja una vez)
	P.jump = publico(async function(steps = 1, T = 2000) {
		steps = f32(steps);
		T = ent(T);
		var up = [90, 90, 150, 30];
		this._movimiento('subir', steps, T, 0, undefined, this._msPoses([up, [90, 90, 90, 90]], [T, T]));
		await this._moveServos(T, up);
		await this._moveServos(T, [90, 90, 90, 90]);
	});

	// walk: caderas en fase, pies en fase, caderas y pies desfasados 90 grados (-90 adelante, 90 atrás); los pies con
	// un poco de offset para ir de puntillas
	P.walk = publico(async function(steps = 4, T = 1000, dir = 1) {
		steps = f32(steps);
		T = ent(T);
		dir = ent(dir);
		var ph = gradosARad(dir * -90);
		await this._oscilar('caminar', steps, T, dir, undefined, [30, 30, 20, 20], [0, 0, 4, -4], [0, 0, ph, ph]);
	});

	// turn: como walk, con más amplitud en una cadera (LEFT = 1: la izquierda)
	P.turn = publico(async function(steps = 4, T = 2000, dir = 1) {
		steps = f32(steps);
		T = ent(T);
		dir = ent(dir);
		var A = [30, 30, 20, 20];
		var ph = gradosARad(-90);
		if (dir == 1) {
			A[0] = 30;
			A[1] = 10;
		} else {
			A[0] = 10;
			A[1] = 30;
		}
		await this._oscilar('girar', steps, T, dir, undefined, A, [0, 0, 4, -4], [0, 0, ph, ph]);
	});

	// bend: inclinarse hacia un lado (dir 1 izquierda, -1 derecha); el tiempo de la inclinación es fijo (800 ms)
	P.bend = publico(async function(steps = 1, T = 1400, dir = 1) {
		steps = ent(steps);
		T = ent(T);
		dir = ent(dir);
		var bend1 = [90, 90, 62, 35], bend2 = [90, 90, 62, 105], homes = [90, 90, 90, 90];
		if (dir == -1) {
			bend1[2] = 180 - 35;
			bend1[3] = 180 - 60;   // "Not 65. Otto is unbalanced"
			bend2[2] = 180 - 105;
			bend2[3] = 180 - 60;
		}
		var T2 = 800;
		var pausa = f32(T * f32(0.8));   // delay(T*0.8)
		this._movimiento('bend', steps, T, dir, undefined, Math.max(0, steps) *
			(this._msPoses([bend1, bend2, homes], [T2 / 2, T2 / 2, 500]) + Math.max(0, largo(pausa))));
		for (var i = 0; i < steps; i++) {
			await this._moveServos(T2 / 2, bend1);
			await this._moveServos(T2 / 2, bend2);
			await this._delay(pausa);
			await this._moveServos(500, homes);
		}
	});

	// shakeLeg: agitar una pata. Como en el C++, dir == -1 (RIGHT, el valor por defecto) usa los ángulos que el
	// comentario original llama "pata izquierda". MPR: pie de apoyo en 55 (antes 58) y el pie libre cruzando el centro
	// hasta 120, como Otto::shakeLeg() de la librería nueva (PLAN_PULIDO F2).
	P.shakeLeg = publico(async function(steps = 1, T = 2000, dir = -1) {
		steps = ent(steps);
		var T0 = ent(T);
		dir = ent(dir);
		var numberLegMoves = 2;
		var leg1 = [90, 90, SHAKE_APOYO, 35], leg2 = [90, 90, SHAKE_APOYO, SHAKE_CRUCE], leg3 = [90, 90, SHAKE_APOYO, 60];
		var homes = [90, 90, 90, 90];
		if (dir == -1) {
			leg1[2] = 180 - 35;
			leg1[3] = 180 - SHAKE_APOYO;
			leg2[2] = 180 - SHAKE_CRUCE;
			leg2[3] = 180 - SHAKE_APOYO;
			leg3[2] = 180 - 60;
			leg3[3] = 180 - SHAKE_APOYO;
		}
		var T2 = 1000;   // tiempo de la inclinación, fijo para no caerse
		T = Math.max(ent(T0 - T2), 200 * numberLegMoves);
		var tPata = Math.trunc(T / (2 * numberLegMoves));
		this._movimiento('shakeLeg', steps, T0, dir, undefined, Math.max(0, steps) *
			this._msPoses([leg1, leg2, leg3, leg2, leg3, leg2, homes], [T2 / 2, T2 / 2, tPata, tPata, tPata, tPata, 500]) + T);
		for (var j = 0; j < steps; j++) {
			await this._moveServos(T2 / 2, leg1);
			await this._moveServos(T2 / 2, leg2);
			for (var i = 0; i < numberLegMoves; i++) {
				await this._moveServos(tPata, leg3);
				await this._moveServos(tPata, leg2);
			}
			await this._moveServos(500, homes);
		}
		await this._delay(T);
	});

	// updown: pies desfasados 180 grados, con la misma amplitud y offset
	P.updown = publico(async function(steps = 1, T = 1000, h = 20) {
		steps = f32(steps);
		T = ent(T);
		h = ent(h);
		await this._oscilar('subir', steps, T, 0, h, [0, 0, h, h], [0, 0, h, -h],
			[0, 0, gradosARad(-90), gradosARad(90)]);
	});

	// swing: pies en fase con offset de media amplitud: se balancea de lado a lado
	P.swing = publico(async function(steps = 1, T = 1000, h = 20) {
		steps = f32(steps);
		T = ent(T);
		h = ent(h);
		await this._oscilar('swing', steps, T, 0, h, [0, 0, h, h], [0, 0, Math.trunc(h / 2), Math.trunc(-h / 2)],
			[0, 0, gradosARad(0), gradosARad(0)]);
	});

	// tiptoeSwing: como swing, con offset de una amplitud entera (de puntillas)
	P.tiptoeSwing = publico(async function(steps = 1, T = 900, h = 20) {
		steps = f32(steps);
		T = ent(T);
		h = ent(h);
		await this._oscilar('tiptoeSwing', steps, T, 0, h, [0, 0, h, h], [0, 0, h, -h], [0, 0, 0, 0]);
	});

	// jitter: caderas desfasadas 180 grados; h hasta 25 para que los pies no choquen
	P.jitter = publico(async function(steps = 1, T = 500, h = 20) {
		steps = f32(steps);
		T = ent(T);
		h = Math.min(25, ent(h));
		await this._oscilar('jitter', steps, T, 0, h, [h, h, 0, 0], [0, 0, 0, 0],
			[gradosARad(-90), gradosARad(90), 0, 0]);
	});

	// ascendingTurn: caderas y pies desfasados 180 grados; h hasta 13
	P.ascendingTurn = publico(async function(steps = 1, T = 900, h = 20) {
		steps = f32(steps);
		T = ent(T);
		h = Math.min(13, ent(h));
		await this._oscilar('ascendingTurn', steps, T, 0, h, [h, h, h, h], [0, 0, h + 4, -h + 4],
			[gradosARad(-90), gradosARad(90), gradosARad(-90), gradosARad(90)]);
	});

	// moonwalker: onda que viaja de un pie al otro (60 grados de desfase); dir 1 izquierda, -1 derecha
	P.moonwalker = publico(async function(steps = 1, T = 900, h = 20, dir = 1) {
		steps = f32(steps);
		T = ent(T);
		h = ent(h);
		dir = ent(dir);
		var phi = ent(-dir * 90);
		await this._oscilar('moonwalker', steps, T, dir, h, [0, 0, h, h],
			[0, 0, Math.trunc(h / 2) + 2, Math.trunc(-h / 2) - 2], [0, 0, gradosARad(phi), gradosARad(-60 * dir + phi)]);
	});

	// crusaito: mezcla de moonwalker y walk. Las caderas tienen desfase 90 RADIANES (no DEG2RAD(90)): viene así de la
	// librería original y se mantiene (ANALISIS_SERVOS.md 5)
	P.crusaito = publico(async function(steps = 1, T = 900, h = 20, dir = 1) {
		steps = f32(steps);
		T = ent(T);
		h = ent(h);
		dir = ent(dir);
		await this._oscilar('crusaito', steps, T, dir, h, [25, 25, h, h],
			[0, 0, Math.trunc(h / 2) + 4, Math.trunc(-h / 2) - 4], [90, 90, gradosARad(0), gradosARad(-60 * dir)]);
	});

	// flapping: aleteo; dir 1 adelante, -1 atrás
	P.flapping = publico(async function(steps = 1, T = 1000, h = 20, dir = 1) {
		steps = f32(steps);
		T = ent(T);
		h = ent(h);
		dir = ent(dir);
		await this._oscilar('flapping', steps, T, dir, h, [12, 12, h, h], [0, 0, h - 10, -h + 10],
			[gradosARad(0), gradosARad(180), gradosARad(-90 * dir), gradosARad(90 * dir)]);
	});

	// ---------------------------------------------------------------- bocas y matriz de LED (no vienen en el kit)
	P.putMouth = publico(async function(mouth, predefined = true) {});
	P.putAnimationMouth = publico(async function(anim, index) {});
	P.clearMouth = publico(async function() {});
	P.initMATRIX = publico(async function(DIN, CS, CLK, rotate) {});
	P.matrixIntensity = publico(async function(intensity) {});
	P.setLed = publico(async function(X, Y, value) {});

	// writeText: no se ve nada, pero se mantienen las pausas de Otto_Matrix::sendChar (hasta 9 caracteres: 500 ms y
	// luego scrollspeed, entre 50 y 150, por cada columna que se desplaza)
	P.writeText = publico(async function(s, scrollspeed) {
		var n = Math.min(String(s == null ? '' : s).length, 9);
		if (n < 1) return;
		var v = Number(scrollspeed) & 0xFF;   // byte
		if (v < 50) v = 50;
		if (v > 150) v = 150;
		await this._delay(500);
		for (var i = 0; i < n * 8 - 1; i++) await this._delay(v);
	});

	// ---------------------------------------------------------------- sonidos
	// _tone(): un silencio de 0 se toma como 1; el tono no se apaga (noTone está comentado en el C++)
	P._tone = publico(async function(noteFrequency, noteDuration, silentDuration) {
		var d = largo(noteDuration), s = ent(silentDuration);
		if (s == 0) s = 1;
		this._tono(f32(noteFrequency), d);
		await this._delay(d);
		await this._delay(s);
	});

	// bendTones(): la frecuencia es un int que se multiplica (o divide) por prop en cada tono y se trunca
	P.bendTones = publico(async function(initFrequency, finalFrequency, prop, noteDuration, silentDuration) {
		var f0 = f32(initFrequency), f1 = f32(finalFrequency), p = f32(prop);
		var d = largo(noteDuration), s = ent(silentDuration);
		if (s == 0) s = 1;
		var i;
		if (f0 < f1) {
			for (i = ent(f0); i < f1; i = ent(f32(i * p))) await this._tone(i, d, s);
		} else {
			for (i = ent(f0); i > f1; i = ent(f32(i / p))) await this._tone(i, d, s);
		}
	});

	P.sing = publico(async function(songName) {
		var i;
		switch (nombre(songName, SONIDOS)) {
			case 'S_connection':
				await this._tone(N.E5, 50, 30);
				await this._tone(N.E6, 55, 25);
				await this._tone(N.A6, 60, 10);
				break;
			case 'S_disconnection':
				await this._tone(N.E5, 50, 30);
				await this._tone(N.A6, 55, 25);
				await this._tone(N.E6, 50, 10);
				break;
			case 'S_buttonPushed':
				await this.bendTones(N.E6, N.G6, 1.03, 20, 2);
				await this._delay(30);
				await this.bendTones(N.E6, N.D7, 1.04, 10, 2);
				break;
			case 'S_mode1':
				await this.bendTones(N.E6, N.A6, 1.02, 30, 10);
				break;
			case 'S_mode2':
				await this.bendTones(N.G6, N.D7, 1.03, 30, 10);
				break;
			case 'S_mode3':
				await this._tone(N.E6, 50, 100);
				await this._tone(N.G6, 50, 80);
				await this._tone(N.D7, 300, 0);
				break;
			case 'S_surprise':
				await this.bendTones(800, 2150, 1.02, 10, 1);
				await this.bendTones(2149, 800, 1.03, 7, 1);
				break;
			case 'S_OhOoh':
				await this.bendTones(880, 2000, 1.04, 8, 3);
				await this._delay(200);
				for (i = 880; i < 2000; i = ent(f32(i * f32(1.04)))) await this._tone(N.B5, 5, 10);
				break;
			case 'S_OhOoh2':
				await this.bendTones(1880, 3000, 1.03, 8, 3);
				await this._delay(200);
				for (i = 1880; i < 3000; i = ent(f32(i * f32(1.03)))) await this._tone(N.C6, 10, 10);
				break;
			case 'S_cuddly':
				await this.bendTones(700, 900, 1.03, 16, 4);
				await this.bendTones(899, 650, 1.01, 18, 7);
				break;
			case 'S_sleeping':
				await this.bendTones(100, 500, 1.04, 10, 10);
				await this._delay(500);
				await this.bendTones(400, 100, 1.04, 10, 1);
				break;
			case 'S_happy':
				await this.bendTones(1500, 2500, 1.05, 20, 8);
				await this.bendTones(2499, 1500, 1.05, 25, 8);
				break;
			case 'S_superHappy':
				await this.bendTones(2000, 6000, 1.05, 8, 3);
				await this._delay(50);
				await this.bendTones(5999, 2000, 1.05, 13, 2);
				break;
			case 'S_happy_short':
				await this.bendTones(1500, 2000, 1.05, 15, 8);
				await this._delay(100);
				await this.bendTones(1900, 2500, 1.05, 10, 8);
				break;
			case 'S_sad':
				await this.bendTones(880, 669, 1.02, 20, 200);
				break;
			case 'S_confused':
				await this.bendTones(1000, 1700, 1.03, 8, 2);
				await this.bendTones(1699, 500, 1.04, 8, 3);
				await this.bendTones(1000, 1700, 1.05, 9, 10);
				break;
			case 'S_fart1':
				await this.bendTones(1600, 3000, 1.02, 2, 15);
				break;
			case 'S_fart2':
				await this.bendTones(2000, 6000, 1.02, 2, 20);
				break;
			case 'S_fart3':
				await this.bendTones(1600, 4000, 1.02, 2, 20);
				await this.bendTones(4000, 3000, 1.02, 2, 20);
				break;
		}
	});

	// ---------------------------------------------------------------- gestos
	// Las bocas (putMouth, putAnimationMouth, clearMouth) quedan como comentarios: no toman tiempo y no se ven.
	P.playGesture = publico(async function(gesture) {
		var i, index, nota;
		switch (nombre(gesture, GESTOS)) {
			case 'OttoHappy':
				await this._tone(N.E5, 50, 30);
				// putMouth(smile)
				await this.sing('S_happy_short');
				await this.swing(1, 800, 20);
				await this.sing('S_happy_short');
				await this.home();
				// putMouth(happyOpen)
				break;

			case 'OttoSuperHappy':
				// putMouth(happyOpen)
				await this.sing('S_happy');
				// putMouth(happyClosed)
				await this.tiptoeSwing(1, 500, 20);
				// putMouth(happyOpen)
				await this.sing('S_superHappy');
				// putMouth(happyClosed)
				await this.tiptoeSwing(1, 500, 20);
				await this.home();
				// putMouth(happyOpen)
				break;

			case 'OttoSad':
				// putMouth(sad)
				await this._moveServos(700, [110, 70, 20, 160]);
				await this.bendTones(880, 830, 1.02, 20, 200);
				// putMouth(sadClosed)
				await this.bendTones(830, 790, 1.02, 20, 200);
				// putMouth(sadOpen)
				await this.bendTones(790, 740, 1.02, 20, 200);
				// putMouth(sadClosed)
				await this.bendTones(740, 700, 1.02, 20, 200);
				// putMouth(sadOpen)
				await this.bendTones(700, 669, 1.02, 20, 200);
				// putMouth(sad)
				await this._delay(500);
				await this.home();
				await this._delay(300);
				// putMouth(happyOpen)
				break;

			case 'OttoSleeping':
				await this._moveServos(700, [100, 80, 60, 120]);
				for (i = 0; i < 4; i++) {
					// putAnimationMouth(dreamMouth, 0..2)
					await this.bendTones(100, 200, 1.04, 10, 10);
					await this.bendTones(200, 300, 1.04, 10, 10);
					await this.bendTones(300, 500, 1.04, 10, 10);
					await this._delay(500);
					// putAnimationMouth(dreamMouth, 1..0)
					await this.bendTones(400, 250, 1.04, 10, 1);
					await this.bendTones(250, 100, 1.04, 10, 1);
					await this._delay(500);
				}
				// putMouth(lineMouth)
				await this.sing('S_cuddly');
				await this.home();
				// putMouth(happyOpen)
				break;

			case 'OttoFart':
				await this._moveServos(500, [90, 90, 145, 122]);
				await this._delay(300);
				// putMouth(lineMouth)
				await this.sing('S_fart1');
				// putMouth(tongueOut)
				await this._delay(250);
				await this._moveServos(500, [90, 90, 80, 122]);
				await this._delay(300);
				await this.sing('S_fart2');
				await this._delay(250);
				await this._moveServos(500, [90, 90, 145, 80]);
				await this._delay(300);
				await this.sing('S_fart3');
				await this._delay(300);
				await this.home();
				await this._delay(500);
				// putMouth(happyOpen)
				break;

			case 'OttoConfused':
				await this._moveServos(300, [110, 70, 90, 90]);
				// putMouth(confused)
				await this.sing('S_confused');
				await this._delay(500);
				await this.home();
				// putMouth(happyOpen)
				break;

			case 'OttoLove':
				// putMouth(heart)
				await this.sing('S_cuddly');
				await this.crusaito(2, 1500, 15, 1);
				await this.home();
				await this.sing('S_happy_short');
				// putMouth(happyOpen)
				break;

			case 'OttoAngry':
				await this._moveServos(300, [90, 90, 70, 110]);
				// putMouth(angry)
				await this._tone(N.A5, 100, 30);
				await this.bendTones(N.A5, N.D6, 1.02, 7, 4);
				await this.bendTones(N.D6, N.G6, 1.02, 10, 1);
				await this.bendTones(N.G6, N.A5, 1.02, 10, 1);
				await this._delay(15);
				await this.bendTones(N.A5, N.E5, 1.02, 20, 4);
				await this._delay(400);
				await this._moveServos(200, [110, 110, 90, 90]);
				await this.bendTones(N.A5, N.D6, 1.02, 20, 4);
				await this._moveServos(200, [70, 70, 90, 90]);
				await this.bendTones(N.A5, N.E5, 1.02, 20, 4);
				await this.home();
				// putMouth(happyOpen)
				break;

			case 'OttoFretful':
				// putMouth(angry)
				await this.bendTones(N.A5, N.D6, 1.02, 20, 4);
				await this.bendTones(N.A5, N.E5, 1.02, 20, 4);
				await this._delay(300);
				// putMouth(lineMouth)
				for (i = 0; i < 4; i++) {
					await this._moveServos(100, [90, 90, 90, 110]);
					await this.home();
				}
				// putMouth(angry)
				await this._delay(500);
				await this.home();
				// putMouth(happyOpen)
				break;

			case 'OttoMagic':
				// La animación cuatro veces; como en el C++, la segunda mitad también sube cada tono (noteM a noteM+100)
				for (i = 0; i < 4; i++) {
					nota = 400;
					for (index = 0; index < 6; index++) {
						// putAnimationMouth(adivinawi, index)
						await this.bendTones(nota, nota + 100, 1.04, 10, 10);
						nota += 100;
					}
					// clearMouth()
					await this.bendTones(nota - 100, nota + 100, 1.04, 10, 10);
					for (index = 0; index < 6; index++) {
						await this.bendTones(nota, nota + 100, 1.04, 10, 10);
						nota -= 100;
					}
				}
				await this._delay(300);
				// putMouth(happyOpen)
				break;

			case 'OttoWave':
				// Onda de sonido (y de boca): sube y baja dos veces. Cada lazo de 20 son dos lazos iguales de 10 del C++.
				for (i = 0; i < 2; i++) {
					nota = 500;
					for (index = 0; index < 20; index++) {
						// putAnimationMouth(wave, index % 10)
						await this.bendTones(nota, nota + 100, 1.02, 10, 10);
						nota += 101;
					}
					for (index = 0; index < 20; index++) {
						await this.bendTones(nota, nota - 100, 1.02, 10, 10);
						nota -= 101;
					}
				}
				// clearMouth()
				await this._delay(100);
				// putMouth(happyOpen)
				break;

			case 'OttoVictory':
				// putMouth(smallSurprise)
				for (i = 0; i < 60; ++i) {   // hasta {90, 90, 150, 30}
					await this._moveServos(10, [90, 90, 90 + i, 90 - i]);
					await this._tone(1600 + i * 20, 15, 1);
				}
				// putMouth(bigSurprise)
				for (i = 0; i < 60; ++i) {   // de vuelta a {90, 90, 90, 90}
					await this._moveServos(10, [90, 90, 150 - i, 30 + i]);
					await this._tone(2800 + i * 20, 15, 1);
				}
				// putMouth(happyOpen)
				await this.tiptoeSwing(1, 500, 20);
				await this.sing('S_superHappy');
				// putMouth(happyClosed)
				await this.tiptoeSwing(1, 500, 20);
				await this.home();
				// clearMouth(); putMouth(happyOpen)
				break;

			case 'OttoFail':
				// putMouth(sadOpen)
				await this._moveServos(300, [90, 90, 70, 35]);
				await this._tone(900, 200, 1);
				// putMouth(sadClosed)
				await this._moveServos(300, [90, 90, 55, 35]);
				await this._tone(600, 200, 1);
				// putMouth(confused)
				await this._moveServos(300, [90, 90, 42, 35]);
				await this._tone(300, 200, 1);
				await this._moveServos(300, [90, 90, 34, 35]);
				// putMouth(xMouth)
				this._desconectarServos();   // detachServos(): el robot real se desploma; en pantalla queda quieto
				await this._tone(150, 2200, 1);
				await this._delay(600);
				// clearMouth(); putMouth(happyOpen)
				await this.home();
				break;
		}
	});

	return {
		SONIDOS: SONIDOS.slice(),
		GESTOS: GESTOS.slice(),
		DIFF_LIMIT_DEFAULT: DIFF_LIMIT_DEFAULT,
		crear: function(hw) {
			return new Otto(hw);
		}
	};
})();
