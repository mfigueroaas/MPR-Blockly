'use strict';

// MPR: misiones guiadas (DOCUMENTACION_TECNICA.md 4.11). Siguen la estructura del manual de programación del evento
// (Manuales/): estructura, Configuración Otto, acciones con sonido y tiempo, caminar y repetir, velocidad, girar, bailar,
// el sensor de distancia y el Cerro Renca. Cada misión tiene objetivo, pista y un botón "Revisar" que mira los bloques
// de la mesa; al cumplirla, Otto celebra y se pasa a la siguiente. El avance se guarda en localStorage.mpr_misiones.
// Los textos están en www/lang/msg_es.js (mis_*); las revisiones, abajo (MPRMisiones.LISTA).

var MPRMisiones = {
	CLAVE: 'mpr_misiones',
	abierto: false,
	minimizado: false,
	progreso: { actual: 0, hechas: {} }
};

MPRMisiones.msg = function(k, d) {
	return (typeof MSG != 'undefined' && MSG[k]) || d || '';
};

// ---------------------------------------------------------------- lectura de la mesa
// Bloques de una sección (incluye los que están dentro de Repetir, Si, etc.)
MPRMisiones.seccion = function(nombre) {
	var ws = window.BlocklyDuino && BlocklyDuino.workspace, res = [];
	if (!ws) return res;
	ws.getTopBlocks(false).forEach(function(t) {
		if (t.type != 'base_setup_loop' || t.disabled) return;
		var b = t.getInputTargetBlock(nombre);
		while (b) {
			if (!b.disabled) res = res.concat(b.getDescendants(false).filter(function(d) { return !d.disabled; }));
			b = b.getNextBlock();
		}
	});
	return res;
};

MPRMisiones.todos = function() {
	return MPRMisiones.seccion('DO').concat(MPRMisiones.seccion('LOOP'));
};

MPRMisiones.campo = function(b, n) { var v = b.getFieldValue(n); return v == null ? '' : String(v).trim(); };

MPRMisiones.hay = function(lista, tipo, campo, valores) {
	return lista.some(function(b) {
		return b.type == tipo && (!campo || valores.indexOf(MPRMisiones.campo(b, campo)) >= 0);
	});
};

// ¿Hay un "Si" cuya condición usa el sensor de distancia? Devuelve el bloque.
MPRMisiones.siConSensor = function(lista) {
	for (var i = 0; i < lista.length; i++) {
		var b = lista[i];
		if (b.type != 'controls_if') continue;
		var c = b.getInputTargetBlock('IF0');
		if (c && c.getDescendants(false).some(function(d) { return d.type == 'ultrasonic_distance'; })) return b;
	}
	return null;
};

MPRMisiones.dentro = function(b, entrada) {
	var r = [], x = b.getInputTargetBlock(entrada);
	while (x) { r = r.concat(x.getDescendants(false)); x = x.getNextBlock(); }
	return r;
};

var MPR_MOVER = ['otto_move'];

// ---------------------------------------------------------------- misiones (id = clave de los textos mis_<id>_*)
MPRMisiones.LISTA = [
	{ id: 'hola', revisar: function(M) { return M.hay(M.seccion('DO'), 'otto_sound') || M.hay(M.seccion('DO'), 'otto_gesture'); } },
	{ id: 'repetir_sonido', revisar: function(M) { var l = M.seccion('LOOP'); return (M.hay(l, 'otto_sound') || M.hay(l, 'otto_gesture')) && M.hay(l, 'base_delay'); } },
	{ id: 'paso', revisar: function(M) { var l = M.seccion('DO'); return M.hay(l, 'otto_home') && M.hay(l, 'otto_move', 'otto_move_sens', ['FORWARD']); } },
	{ id: 'cinco', revisar: function(M) {
		return M.todos().some(function(b) {
			if (b.type != 'controls_repeat_ext') return false;
			var n = b.getInputTargetBlock('TIMES'), veces = n ? Number(n.getFieldValue('NUM')) : 0;
			return veces == 5 && M.hay(M.dentro(b, 'DO'), 'otto_move', 'otto_move_sens', ['FORWARD']);
		});
	} },
	{ id: 'velocidad', revisar: function(M) { return M.todos().some(function(b) { return b.type == 'otto_move' && M.campo(b, 'otto_move_speed') != '2000' && M.campo(b, 'otto_move_speed') != '3500'; }); } },
	{ id: 'girar', revisar: function(M) { var l = M.todos(); return M.hay(l, 'otto_move', 'otto_move_sens', ['FORWARD', 'BACKWARD']) && M.hay(l, 'otto_move', 'otto_move_sens', ['LEFT', 'RIGHT']); } },
	{ id: 'bailar', revisar: function(M) {
		var l = M.todos(), n = ['otto_dance', 'otto_do', 'otto_gesture'].filter(function(t) { return M.hay(l, t); }).length;
		return n >= 2 && M.hay(l, 'otto_detener');
	} },
	{ id: 'sensor', revisar: function(M) {
		var si = M.siConSensor(M.todos());
		if (!si) return false;
		var d = M.dentro(si, 'DO0');
		return M.hay(d, 'otto_sound') || M.hay(d, 'otto_gesture') || M.hay(d, 'otto_tone') || M.hay(d, 'RTTTL_music_lat') || M.hay(d, 'RTTTL_music');
	} },
	{ id: 'esquivar', revisar: function(M) {
		// Si hay algo cerca: retroceder o girar. Avanzar puede ir en el "si no" o fuera del Si (en el mismo Bucle).
		var bucle = M.seccion('LOOP'), si = M.siConSensor(bucle);
		if (!si) return false;
		var cerca = M.dentro(si, 'DO0');
		var adelante = bucle.filter(function(x) { return cerca.indexOf(x) < 0; });
		return M.hay(cerca, 'otto_move', 'otto_move_sens', ['BACKWARD', 'LEFT', 'RIGHT']) && M.hay(adelante, 'otto_move', 'otto_move_sens', ['FORWARD']);
	} },
	{ id: 'cerro', manual: true }
];

// ---------------------------------------------------------------- interfaz
MPRMisiones.iniciar = function() {
	var b = document.getElementById('btn_misiones');
	if (!b) return;
	var self = MPRMisiones;
	b.title = self.msg('mis_boton', 'Misiones');
	b.addEventListener('click', function() { if (self.abierto) self.cerrar(); else self.abrir(); });
	try { var p = JSON.parse(window.localStorage[self.CLAVE] || 'null'); if (p && typeof p.actual == 'number') self.progreso = p; } catch (e) {}
	if (!self.progreso.hechas) self.progreso.hechas = {};
	self.progreso.actual = Math.max(0, Math.min(self.LISTA.length - 1, self.progreso.actual));
	self.marcarBoton();
};

MPRMisiones.guardar = function() {
	try { window.localStorage[MPRMisiones.CLAVE] = JSON.stringify(MPRMisiones.progreso); } catch (e) {}
	MPRMisiones.marcarBoton();
};

MPRMisiones.marcarBoton = function() {
	var b = document.getElementById('btn_misiones');
	if (!b) return;
	var n = Object.keys(MPRMisiones.progreso.hechas).length;
	b.setAttribute('data-hechas', n ? n + '/' + MPRMisiones.LISTA.length : '');
};

MPRMisiones.crear = function() {
	if (document.getElementById('mpr_mis')) return;
	var self = MPRMisiones, e = document.createElement('div');
	e.id = 'mpr_mis';
	e.innerHTML =
		'<div id="mpr_mis_cab"><span id="mpr_mis_num"></span><span id="mpr_mis_puntos"></span>' +
		'<button type="button" id="mpr_mis_min" title="' + self.msg('mis_minimizar', 'Achicar') + '">–</button>' +
		'<button type="button" id="mpr_mis_x" title="' + self.msg('mis_cerrar', 'Cerrar') + '">✕</button></div>' +
		'<div id="mpr_mis_cuerpo">' +
			'<div id="mpr_mis_titulo"></div><div id="mpr_mis_texto"></div>' +
			'<div id="mpr_mis_pista"></div><div id="mpr_mis_res"></div>' +
			'<div id="mpr_mis_acc">' +
				'<button type="button" id="mpr_mis_ant">◀</button>' +
				'<button type="button" id="mpr_mis_ver_pista"></button>' +
				'<button type="button" id="mpr_mis_probar"></button>' +
				'<button type="button" id="mpr_mis_revisar"></button>' +
				'<button type="button" id="mpr_mis_sig">▶</button>' +
			'</div>' +
		'</div>';
	document.body.appendChild(e);
	document.getElementById('mpr_mis_x').addEventListener('click', self.cerrar);
	document.getElementById('mpr_mis_min').addEventListener('click', function() { self.minimizado = !self.minimizado; self.mostrar(); });
	document.getElementById('mpr_mis_cab').addEventListener('dblclick', function() { self.minimizado = !self.minimizado; self.mostrar(); });
	document.getElementById('mpr_mis_ant').addEventListener('click', function() { self.ir(-1); });
	document.getElementById('mpr_mis_sig').addEventListener('click', function() { self.ir(1); });
	document.getElementById('mpr_mis_ver_pista').addEventListener('click', function() {
		var p = document.getElementById('mpr_mis_pista');
		p.style.display = p.style.display == 'block' ? 'none' : 'block';
	});
	document.getElementById('mpr_mis_probar').addEventListener('click', function() {
		if (typeof MPRSimulador != 'undefined') { if (!MPRSimulador.abierto) MPRSimulador.abrir(); }
	});
	document.getElementById('mpr_mis_revisar').addEventListener('click', self.revisar);
	// Monitores: doble clic en "Misiones" con Mayúscula reinicia el avance
	document.getElementById('mpr_mis_num').addEventListener('dblclick', function(ev) {
		if (!ev.shiftKey || !window.confirm(self.msg('mis_reiniciar', '¿Reiniciar las misiones?'))) return;
		self.progreso = { actual: 0, hechas: {} };
		self.guardar();
		self.mostrar();
	});
};

MPRMisiones.abrir = function() {
	var self = MPRMisiones;
	self.crear();
	self.abierto = true;
	self.minimizado = false;
	document.getElementById('mpr_mis').style.display = 'block';
	$('#btn_misiones').addClass('activo');
	self.mostrar();
};

MPRMisiones.cerrar = function() {
	var self = MPRMisiones;
	self.abierto = false;
	var e = document.getElementById('mpr_mis');
	if (e) e.style.display = 'none';
	$('#btn_misiones').removeClass('activo');
};

MPRMisiones.ir = function(d) {
	var self = MPRMisiones;
	self.progreso.actual = Math.max(0, Math.min(self.LISTA.length - 1, self.progreso.actual + d));
	self.guardar();
	self.mostrar();
};

MPRMisiones.mostrar = function() {
	var self = MPRMisiones, m = self.LISTA[self.progreso.actual], hecha = !!self.progreso.hechas[m.id];
	var e = document.getElementById('mpr_mis');
	if (!e) return;
	e.className = (self.minimizado ? 'mini ' : '') + (hecha ? 'hecha' : '');
	document.getElementById('mpr_mis_num').textContent = '🏁 ' + self.msg('mis_mision', 'Misión') + ' ' + (self.progreso.actual + 1) + ' / ' + self.LISTA.length;
	document.getElementById('mpr_mis_puntos').textContent = self.LISTA.map(function(x, i) {
		return self.progreso.hechas[x.id] ? '★' : (i == self.progreso.actual ? '●' : '○');
	}).join('');
	document.getElementById('mpr_mis_titulo').textContent = (hecha ? '✅ ' : '') + self.msg('mis_' + m.id + '_t', m.id);
	document.getElementById('mpr_mis_texto').textContent = self.msg('mis_' + m.id, '');
	var p = document.getElementById('mpr_mis_pista');
	p.textContent = '💡 ' + self.msg('mis_' + m.id + '_pista', '');
	p.style.display = 'none';
	document.getElementById('mpr_mis_res').textContent = hecha ? self.msg('mis_ya_hecha', '¡Ya la cumpliste! Puedes seguir con la próxima.') : '';
	document.getElementById('mpr_mis_res').className = hecha ? 'ok' : '';
	document.getElementById('mpr_mis_ver_pista').textContent = self.msg('mis_pista', 'Pista');
	document.getElementById('mpr_mis_probar').textContent = self.msg('mis_probar', '▶ Probar');
	document.getElementById('mpr_mis_probar').style.display = typeof MPRSimulador != 'undefined' ? '' : 'none';
	document.getElementById('mpr_mis_revisar').textContent = m.manual ? self.msg('mis_lo_logre', '¡Lo logré!') : self.msg('mis_revisar', 'Revisar');
	document.getElementById('mpr_mis_ant').disabled = self.progreso.actual == 0;
	document.getElementById('mpr_mis_sig').disabled = self.progreso.actual == self.LISTA.length - 1;
};

MPRMisiones.revisar = function() {
	var self = MPRMisiones, m = self.LISTA[self.progreso.actual], ok = false;
	try { ok = m.manual ? true : !!m.revisar(self); } catch (e) { console.log('[Misiones]', e); }
	var r = document.getElementById('mpr_mis_res');
	if (!ok) {
		r.className = 'falta';
		r.textContent = self.msg('mis_falta', 'Todavía no. Revisa el objetivo o mira la pista.');
		document.getElementById('mpr_mis_pista').style.display = 'block';
		return;
	}
	self.progreso.hechas[m.id] = true;
	var ultima = self.progreso.actual == self.LISTA.length - 1;
	r.className = 'ok';
	r.textContent = ultima ? self.msg('mis_todas', '¡Cumpliste todas las misiones! ¡Eres un gran programador!') : self.msg('mis_cumplida', '¡Misión cumplida!');
	self.celebrar(ultima);
	self.guardar();
	setTimeout(function() {
		if (!ultima && self.LISTA[self.progreso.actual] === m) { self.progreso.actual++; self.guardar(); self.mostrar(); }
		else self.mostrar();
	}, 2600);
};

// Otto celebra (salta y gira) y dice algo; si Otto está en el escenario o escondido, basta el mensaje del panel
MPRMisiones.celebrar = function(ultima) {
	var e = document.getElementById('mpr_mis');
	if (e) { e.classList.remove('festeja'); void e.offsetWidth; e.classList.add('festeja'); }
	if (typeof MPRMascota != 'undefined' && MPRMascota.decir) {
		MPRMascota.decir(ultima ? MPRMisiones.msg('mis_todas', '') : MPRMisiones.msg('mis_otto_cumplida', '¡Lo hiciste! Vamos por la siguiente misión.'), { anim: 'celebrar', prio: 2, ms: 6000, forzar: true });
	}
};

window.addEventListener('load', function() {
	setTimeout(MPRMisiones.iniciar, 600);
});
