'use strict';

// MPR: calibración de Otto para monitores (DOCUMENTACION_TECNICA.md 4.12). No está a la vista de los niños: se abre con
// Ctrl + Mayús + O. Sube a Otto un programa de calibración (PROGRAMA, abajo), lee los ajustes ("trims") que tiene
// guardados en su memoria (EEPROM, direcciones 0 a 3), deja moverlos viendo el resultado al instante (por el puerto
// serie) y los guarda en el robot. Después, todos los programas de los niños los usan solos: el bloque Configuración
// Otto genera Otto.init(..., true, ...), que los lee al encender. Usa la subida de js/mpr_subida.js (puerto y placa).

var MPRCalibracion = {
	abierto: false,
	sesion: 0,                    // sube al cerrar: lo que termina después de cerrar no abre el puerto
	puerto: null,
	trims: [0, 0, 0, 0],          // pierna izq., pierna der., pie izq., pie der. (grados)
	guardados: null,              // los que Otto tiene guardados en su memoria (se actualiza al guardar)
	iniciales: null,              // los que tenía al empezar la calibración ("Volver a como estaba")
	LIMITE: 40,
	PARTES: ['cal_pierna_izq', 'cal_pierna_der', 'cal_pie_izq', 'cal_pie_der'],
	PROGRAMA: [
		'// MPR: programa de calibración (lo sube MPR Blockly con Ctrl+Mayús+O). Comandos por el puerto serie, 9600 baudios:',
		'//   T a b c d : prueba esos ajustes (pierna izq., pierna der., pie izq., pie der.) con los servos al centro',
		'//   S         : guarda los ajustes en la memoria de Otto (EEPROM 0 a 3); los programas los leen al encender',
		'//   W         : camina dos pasos adelante y dos atrás, para probar',
		'#include <Otto.h>',
		'#include <EEPROM.h>',
		'Otto Otto;',
		'int trims[4];',
		'int centro[4] = {90, 90, 90, 90};',
		'',
		'void informar(const char* que) {',
		'  Serial.print("MPR_CAL ");',
		'  Serial.print(que);',
		'  for (int i = 0; i < 4; i++) { Serial.print(\' \'); Serial.print(trims[i]); }',
		'  Serial.println();',
		'}',
		'',
		'void setup() {',
		'  Serial.begin(9600);',
		'  Serial.setTimeout(200);',
		'  for (int i = 0; i < 4; i++) { int t = EEPROM.read(i); if (t > 128) t -= 256; trims[i] = t; }',
		'  Otto.init(2, 3, 4, 5, true, 13);',
		'  Otto._moveServos(500, centro);   // con los servos conectados y firmes (home() los suelta)',
		'  informar("G");',
		'}',
		'',
		'void loop() {',
		'  if (!Serial.available()) return;',
		'  // Cada orden es una línea completa (con parseInt los números se desfasaban entre órdenes)',
		'  String l = Serial.readStringUntil(10);',
		'  l.trim();',
		'  if (l.length() == 0) return;',
		'  char c = l.charAt(0);',
		'  int t[4];',
		'  if (c == \'T\' && sscanf(l.c_str() + 1, "%d %d %d %d", &t[0], &t[1], &t[2], &t[3]) == 4) {',
		'    for (int i = 0; i < 4; i++) trims[i] = constrain(t[i], -90, 90);',
		'    Otto.setTrims(trims[0], trims[1], trims[2], trims[3]);',
		'    Otto._moveServos(300, centro);',
		'    informar("T");',
		'  } else if (c == \'S\') {',
		'    Otto.saveTrimsOnEEPROM();',
		'    informar("S");',
		'  } else if (c == \'W\') {',
		'    Otto.walk(2, 1500, 1);',
		'    Otto.walk(2, 1500, -1);',
		'    Otto._moveServos(500, centro);',
		'    informar("W");',
		'  } else if (c == \'?\') {',
		'    informar("T");',
		'  }',
		'}',
		''
	].join('\n')
};

MPRCalibracion.msg = function(k, d) {
	return (typeof MSG != 'undefined' && MSG[k]) || d || '';
};

MPRCalibracion.iniciar = function() {
	document.addEventListener('keydown', function(e) {
		if (e.ctrlKey && e.shiftKey && !e.altKey && (e.key == 'O' || e.key == 'o' || e.keyCode == 79)) {
			e.preventDefault();
			if (MPRCalibracion.abierto) MPRCalibracion.cerrar(); else MPRCalibracion.abrir();
		}
	}, true);
};

// ---------------------------------------------------------------- interfaz
MPRCalibracion.crear = function() {
	if (document.getElementById('mpr_cal')) return;
	var self = MPRCalibracion, m = self.msg, filas = '';
	self.PARTES.forEach(function(p, i) {
		filas += '<div class="fila"><span class="nom">' + m(p, p) + '</span>' +
			'<button type="button" data-i="' + i + '" data-d="-1">−</button>' +
			'<input type="range" min="-' + self.LIMITE + '" max="' + self.LIMITE + '" step="1" value="0" data-i="' + i + '">' +
			'<button type="button" data-i="' + i + '" data-d="1">+</button>' +
			'<span class="val" id="mpr_cal_v' + i + '">0</span></div>';
	});
	var e = document.createElement('div');
	e.id = 'mpr_cal';
	e.innerHTML =
		'<div id="mpr_cal_caja">' +
			'<div id="mpr_cal_cab">🛠️ ' + m('cal_titulo', 'Calibración de Otto (para monitores)') + '<button type="button" id="mpr_cal_x">✕</button></div>' +
			'<div id="mpr_cal_cuerpo">' +
				'<p>' + m('cal_intro', '') + '</p>' +
				'<button type="button" id="mpr_cal_preparar" class="principal">' + m('cal_preparar', 'Preparar Otto') + '</button>' +
				'<div id="mpr_cal_ajustes">' +
					'<p>' + m('cal_como', '') + '</p>' + filas +
					'<div class="acciones">' +
						'<button type="button" id="mpr_cal_caminar">' + m('cal_caminar', 'Probar caminando') + '</button>' +
						'<button type="button" id="mpr_cal_volver">' + m('cal_volver', 'Volver a los guardados') + '</button>' +
						'<button type="button" id="mpr_cal_guardar" class="principal">' + m('cal_guardar', 'Guardar en Otto') + '</button>' +
					'</div>' +
				'</div>' +
				'<div id="mpr_cal_estado"></div>' +
			'</div>' +
		'</div>';
	document.body.appendChild(e);
	document.getElementById('mpr_cal_x').addEventListener('click', self.cerrar);
	document.getElementById('mpr_cal_preparar').addEventListener('click', self.preparar);
	document.getElementById('mpr_cal_caminar').addEventListener('click', function() { self.enviar('W'); self.estado(m('cal_caminando', 'Otto camina para probar...')); });
	document.getElementById('mpr_cal_volver').addEventListener('click', function() { if (self.iniciales) { self.trims = self.iniciales.slice(); self.mostrarValores(); self.mandarTrims(); } });
	document.getElementById('mpr_cal_guardar').addEventListener('click', function() {
		if (!self.puerto || !self.puerto.isOpen) { self.estado(m('cal_primero', 'Primero presiona «1. Preparar Otto».'), 'error'); return; }
		self.enviar('S');
		self.estado(m('cal_guardando', 'Guardando en Otto...'));
		clearTimeout(self.tGuardar);
		self.tGuardar = setTimeout(function() { self.estado(m('cal_sin_respuesta', 'Otto no respondió. Revisa el cable y vuelve a presionar «1. Preparar Otto».'), 'error'); }, 4000);
	});
	Array.prototype.forEach.call(e.querySelectorAll('#mpr_cal_ajustes input[type=range]'), function(r) {
		r.addEventListener('input', function() { self.trims[+r.getAttribute('data-i')] = +r.value; self.mostrarValores(); self.mandarTrims(); });
	});
	Array.prototype.forEach.call(e.querySelectorAll('#mpr_cal_ajustes button[data-d]'), function(b) {
		b.addEventListener('click', function() {
			var i = +b.getAttribute('data-i');
			self.trims[i] = Math.max(-self.LIMITE, Math.min(self.LIMITE, self.trims[i] + +b.getAttribute('data-d')));
			self.mostrarValores();
			self.mandarTrims();
		});
	});
};

MPRCalibracion.abrir = function() {
	var self = MPRCalibracion;
	self.crear();
	self.abierto = true;
	document.getElementById('mpr_cal').style.display = 'block';
	document.getElementById('mpr_cal_ajustes').style.display = self.puerto ? 'block' : 'none';
	self.estado('');
};

MPRCalibracion.cerrar = function() {
	var self = MPRCalibracion;
	self.abierto = false;
	self.sesion++;   // MPR: lo que estaba en curso (subida, apertura del puerto) ya no abre nada (PLAN_PULIDO B3)
	var e = document.getElementById('mpr_cal');
	if (e) e.style.display = 'none';
	self.cerrarPuerto();
};

MPRCalibracion.estado = function(t, clase) {
	var e = document.getElementById('mpr_cal_estado');
	if (!e) return;
	e.textContent = t || '';
	e.className = clase || '';
};

MPRCalibracion.mostrarValores = function() {
	var self = MPRCalibracion;
	Array.prototype.forEach.call(document.querySelectorAll('#mpr_cal_ajustes input[type=range]'), function(r) {
		r.value = self.trims[+r.getAttribute('data-i')];
	});
	for (var i = 0; i < 4; i++) {
		var v = document.getElementById('mpr_cal_v' + i);
		if (v) v.textContent = (self.trims[i] > 0 ? '+' : '') + self.trims[i];
	}
};

// ---------------------------------------------------------------- robot
// Sube el programa de calibración (con los pasos y avisos de la subida normal) y abre el puerto serie
MPRCalibracion.preparar = function() {
	var self = MPRCalibracion;
	if (typeof MPRSubida == 'undefined' || !MPRSubida.listo) { self.estado(self.msg('cal_sin_app', 'Solo funciona en la app instalada.'), 'error'); return; }
	self.cerrarPuerto();
	self.iniciales = null;
	document.getElementById('mpr_cal_ajustes').style.display = 'none';
	self.estado(self.msg('cal_subiendo', 'Subiendo el programa de calibración...'));
	localStorage.setItem('verif', false);
	var sesion = self.sesion;
	MPRSubida.cargar(self.PROGRAMA, function(ok, com) {
		// MPR: si cerraron la calibración mientras subía (~15 s), no se abre el puerto: quedaba tomado y la flecha
		// ya no podía subir (PLAN_PULIDO B3)
		if (!self.abierto || sesion !== self.sesion) return;
		if (!ok) { self.estado(self.msg('cal_no_subio', 'No se pudo subir el programa: revisa el mensaje y el cable.'), 'error'); return; }
		setTimeout(function() { $('#message').modal('hide'); }, 1500);
		self.abrirPuerto(com);
	});
};

MPRCalibracion.abrirPuerto = function(com) {
	var self = MPRCalibracion, SP = MPRSubida.o.sp, resto = '', p;
	self.estado(self.msg('cal_conectando', 'Conectando con Otto...'));
	try {
		p = self.puerto = new SP(com, { baudRate: 9600 }, function(err) {
			if (err) { if (self.puerto === p) { self.puerto = null; self.estado(self.msg('cal_sin_puerto', 'No pude abrir el puerto de Otto.') + ' ' + err.message, 'error'); } return; }
			// MPR: si cerraron la calibración mientras el puerto se abría, cerrarPuerto no lo cerró (aún no estaba
			// abierto): se cierra ahora para no dejarlo tomado (PLAN_PULIDO B3)
			if (self.puerto !== p || !self.abierto) { try { p.close(); } catch (e) {} }
		});
	} catch (e) { self.puerto = null; self.estado(String(e), 'error'); return; }
	p.on('data', function(datos) {
		if (self.puerto !== p) return;
		resto += datos.toString();
		var lineas = resto.split(/\r?\n/);
		resto = lineas.pop();
		lineas.forEach(self.alRecibir);
	});
	p.on('close', function() { if (self.puerto === p) self.puerto = null; });   // MPR: un puerto viejo no borra al nuevo
	p.on('error', function(e) { if (self.puerto === p) self.estado(String(e && e.message || e), 'error'); });
	// Al abrir el puerto la placa se reinicia: el programa avisa sus ajustes guardados ("MPR_CAL G ...") al arrancar
	clearTimeout(self.tEspera);
	self.tEspera = setTimeout(function() { if (!self.guardados) self.enviar('?'); }, 5000);
};

MPRCalibracion.alRecibir = function(linea) {
	var self = MPRCalibracion, m = /^MPR_CAL\s+([GTSW])\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)/.exec(linea.trim());
	if (!m) return;
	var v = [+m[2], +m[3], +m[4], +m[5]];
	if (m[1] == 'G' || (!self.guardados && m[1] == 'T')) {
		self.guardados = v.slice();
		if (!self.iniciales) self.iniciales = v.slice();
		self.trims = v.slice();
		self.mostrarValores();
		document.getElementById('mpr_cal_ajustes').style.display = 'block';
		self.estado(self.msg('cal_listo', 'Otto tiene guardado: {v}. Ajusta y presiona «Guardar en Otto».').replace('{v}', v.join(', ')));
	} else if (m[1] == 'T') {
		// Confirmación de Otto: así se sabe que el cambio llegó (aunque sea de 1 grado y casi no se note)
		var igual = self.guardados && v.join() == self.guardados.join();
		self.estado(self.msg(igual ? 'cal_aplicado_igual' : 'cal_aplicado', 'Otto aplicó: {v}').replace('{v}', v.map(function(x) { return (x > 0 ? '+' : '') + x; }).join(', ')));
	} else if (m[1] == 'S') {
		clearTimeout(self.tGuardar);
		self.guardados = v.slice();
		self.estado(self.msg('cal_guardado', '✅ Guardado en Otto: {v}. Ya lo usan todos los programas.').replace('{v}', v.join(', ')), 'ok');
	} else if (m[1] == 'W') {
		self.estado(self.msg('cal_probado', 'Listo. Si camina chueco, sigue ajustando.'));
	}
};

MPRCalibracion.enviar = function(texto) {
	var p = MPRCalibracion.puerto;
	if (p && p.isOpen) p.write(texto + '\n');
};

MPRCalibracion.mandarTrims = function() {
	var self = MPRCalibracion;
	clearTimeout(self.tMandar);
	self.tMandar = setTimeout(function() { self.enviar('T ' + self.trims.join(' ')); }, 150);
};

MPRCalibracion.cerrarPuerto = function() {
	var self = MPRCalibracion;
	clearTimeout(self.tEspera);
	if (self.puerto) { try { if (self.puerto.isOpen) self.puerto.close(); } catch (e) {} }
	self.puerto = null;
	self.guardados = null;
};

window.addEventListener('load', function() {
	setTimeout(MPRCalibracion.iniciar, 700);
});
