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

MPRMisiones.dentro = function(b, entrada) {
	var r = [], x = b.getInputTargetBlock(entrada);
	while (x) { r = r.concat(x.getDescendants(false)); x = x.getNextBlock(); }
	return r;
};

// ---------------------------------------------------------------- ayudas para revisar
// Bloques de una sección en el orden en que Otto los hace (los de adentro de Repetir o Si van en su lugar).
// Incluye los de las entradas de valor (números, condiciones).
MPRMisiones.orden = function(nombre) {
	var ws = window.BlocklyDuino && BlocklyDuino.workspace, res = [];
	if (!ws) return res;
	var fila = function(b) {
		for (; b; b = b.getNextBlock()) {
			if (b.disabled) continue;
			res.push(b);
			b.inputList.forEach(function(inp) {
				var c = inp.connection && inp.connection.targetBlock();
				if (!c) return;
				if (inp.type == Blockly.NEXT_STATEMENT) fila(c);
				else res = res.concat(c.getDescendants(false));
			});
		}
	};
	ws.getTopBlocks(true).forEach(function(t) {
		if (t.type == 'base_setup_loop' && !t.disabled) fila(t.getInputTargetBlock(nombre));
	});
	return res;
};

MPRMisiones.de = function(lista, tipo, campo, valores) {
	return lista.filter(function(b) {
		return b.type == tipo && (!campo || valores.indexOf(MPRMisiones.campo(b, campo)) >= 0);
	});
};

// número escrito en una entrada (bloque o sombra de número); NaN si no hay
MPRMisiones.numero = function(b, entrada) {
	var n = b && b.getInputTargetBlock(entrada);
	return n && n.type == 'math_number' ? Number(n.getFieldValue('NUM')) : NaN;
};

// segundos de un bloque esperar
MPRMisiones.segundos = function(b) {
	var n = MPRMisiones.numero(b, 'DELAY_TIME'), u = MPRMisiones.campo(b, 'unite');
	return u == 's' ? n : u == 'm' ? n / 1000 : u == 'u' ? n / 1e6 : NaN;
};

// ¿Este valor mide la distancia? Directo (bloque Distancia) o con una variable que guarda la distancia (como el
// ejemplo del Cerro Renca).
MPRMisiones.esSensor = function(b) {
	if (!b) return false;
	if (b.type == 'ultrasonic_distance') return true;
	if (b.type != 'variables_get') return false;
	var nombre = MPRMisiones.campo(b, 'VAR');
	return MPRMisiones.todos().some(function(s) {
		if ((s.type != 'variables_set' && s.type != 'variables_set_init') || MPRMisiones.campo(s, 'VAR') != nombre) return false;
		var v = s.getInputTargetBlock('VALUE');
		return !!v && v.getDescendants(false).some(function(d) { return d.type == 'ultrasonic_distance'; });
	});
};

// Condición de un Si que compara la distancia con un número: { cerca: true si es "distancia < n", n }; null si no.
MPRMisiones.comparacion = function(si) {
	var cond = si && si.getInputTargetBlock('IF0');
	if (!cond) return null;
	var lista = [cond].concat(cond.getDescendants(false)).filter(function(x) { return x.type == 'logic_compare'; });
	for (var i = 0; i < lista.length; i++) { var r = MPRMisiones.compara(lista[i]); if (r) return r; }
	return null;
};

MPRMisiones.compara = function(c) {
	var op = MPRMisiones.campo(c, 'OP'), a = c.getInputTargetBlock('A'), b = c.getInputTargetBlock('B');
	var menor = op == 'LT' || op == 'LTE', mayor = op == 'GT' || op == 'GTE';
	if (!menor && !mayor) return null;
	if (MPRMisiones.esSensor(a) && b && b.type == 'math_number') return { cerca: menor, n: Number(b.getFieldValue('NUM')) };
	if (MPRMisiones.esSensor(b) && a && a.type == 'math_number') return { cerca: mayor, n: Number(a.getFieldValue('NUM')) };
	return null;
};

// Primer Si del Bucle cuya condición usa el sensor
MPRMisiones.siDelBucle = function() {
	return MPRMisiones.orden('LOOP').filter(function(b) {
		var c = b.type == 'controls_if' && b.getInputTargetBlock('IF0');
		return !!c && c.getDescendants(false).some(function(d) { return MPRMisiones.esSensor(d); });
	})[0] || null;
};

// "Huella" del programa (tipos y valores de los bloques, sin posiciones ni ids), para saber si cambió
MPRMisiones.huella = function(ws) {
	ws = ws || (window.BlocklyDuino && BlocklyDuino.workspace);
	if (!ws) return '';
	var txt = function(b) {
		var s = b.type;
		b.inputList.forEach(function(inp) {
			inp.fieldRow.forEach(function(f) { if (f.name) s += '|' + f.name + '=' + String(f.getValue()).trim(); });
			var c = inp.connection && inp.connection.targetBlock();
			if (c) s += '{' + inp.name + ':' + txt(c) + '}';
		});
		var n = b.getNextBlock();
		return s + (n ? ';' + txt(n) : '');
	};
	return ws.getTopBlocks(true).filter(function(t) { return t.type == 'base_setup_loop' && !t.disabled; }).map(txt).join('#');
};

// Huella del ejemplo del Cerro tal como viene (para saber si el niño lo cambió)
MPRMisiones.huellaCerro = function() {
	if (MPRMisiones.cerroOriginal || MPRMisiones.cargandoCerro) return;
	MPRMisiones.cargandoCerro = true;
	fetch('examples/mpr_cerro.xml').then(function(r) { return r.text(); }).then(function(t) {
		var ws = new Blockly.Workspace();
		Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(t), ws);
		MPRMisiones.cerroOriginal = MPRMisiones.huella(ws);
		ws.dispose();
	}).catch(function(e) { console.log('[Misiones] cerro', e); MPRMisiones.cargandoCerro = false; });
};

MPRMisiones.suena = function(b) { return MPRMisiones.SONIDOS.indexOf(b.type) >= 0; };

// Ramas de un Si con el sensor: lo que hace cuando hay algo cerca y cuando no (el "si no", los "o si" y lo que queda
// en el Bucle fuera del Si cuentan como "lejos" si la condición es "cerca", y al revés)
MPRMisiones.ramas = function(si, c) {
	// (getDescendants del Si incluye los bloques que van debajo de él: por eso se arma "deSi" con sus entradas)
	var entonces = MPRMisiones.dentro(si, 'DO0'), otras = [], deSi = [si];
	si.inputList.forEach(function(inp) {
		var c = inp.connection && inp.connection.targetBlock();
		if (!c) return;
		if (inp.type == Blockly.NEXT_STATEMENT) {
			var rama = MPRMisiones.dentro(si, inp.name);
			deSi = deSi.concat(rama);
			if (inp.name != 'DO0') otras = otras.concat(rama);
		} else deSi = deSi.concat(c.getDescendants(false));
	});
	var fuera = MPRMisiones.orden('LOOP').filter(function(x) { return deSi.indexOf(x) < 0; });
	return c.cerca ? { cerca: entonces, lejos: otras.concat(fuera) } : { cerca: otras, lejos: entonces.concat(fuera) };
};

MPRMisiones.MOVER_ADELANTE = ['FORWARD'];
MPRMisiones.MOVER_ESQUIVAR = ['BACKWARD', 'LEFT', 'RIGHT'];
// todo lo que hace sonar el zumbador (Sonido, Gesto, notas, canciones, bip)
MPRMisiones.SONIDOS = ['otto_sound', 'otto_gesture', 'otto_tone', 'otto_tonehz', 'otto_bendtone', 'RTTTL_music_lat', 'RTTTL_music', 'RTTTL_music_custom', 'beep', 'tone', 'play'];

// ---------------------------------------------------------------- misiones (id = clave de los textos mis_<id>_*)
// revisar(M) devuelve null si está cumplida, o lo que falta: { f: clave del texto mis_<id>_<f>, b: bloques a marcar }.
// Antes de cada misión se mira la revisión de siempre (falta Configuración + Bucle, Configuración Otto, el sensor sin
// su configuración, espacios vacíos): si hay algo de eso, sale primero.
// Las revisiones aceptan las distintas formas correctas de resolver una misión (cualquier sonido o número razonable,
// Repetir o Bucle, la condición escrita al revés, el orden dentro del Bucle...). Solo fallan cuando falta lo que pide
// el objetivo, o cuando el robot de verdad no lo haría (por ejemplo, un sonido antes de Configuración Otto).
MPRMisiones.LISTA = [
	{ id: 'hola', revisar: function(M) {
		// cualquier sonido en Configuración, después de Configuración Otto (antes, el robot todavía no tiene zumbador)
		var conf = M.orden('DO'), cfg = M.de(conf, 'otto_configuration')[0];
		var suena = conf.filter(M.suena), enBucle = M.orden('LOOP').filter(M.suena);
		if (!suena.length) return enBucle.length ? { f: 'f_bucle', b: enBucle } : { f: 'f_sonido' };
		if (cfg && !suena.some(function(b) { return conf.indexOf(b) > conf.indexOf(cfg); })) return { f: 'f_orden', b: suena };
		return null;
	} },
	{ id: 'repetir_sonido', revisar: function(M) {
		// un sonido que se repite (en Bucle o dentro de un Repetir de 2 o más) con un esperar junto a él
		var grupos = [M.orden('LOOP')].concat(M.de(M.todos(), 'controls_repeat_ext').filter(function(r) { return M.numero(r, 'TIMES') >= 2; }).map(function(r) { return M.dentro(r, 'DO'); }));
		var conSonido = grupos.filter(function(g) { return g.some(M.suena); });
		if (!conSonido.length) return M.orden('DO').filter(M.suena).length ? { f: 'f_una_vez', b: M.orden('DO').filter(M.suena) } : { f: 'f_sonido' };
		var ok = conSonido.some(function(g) { return M.de(g, 'base_delay').some(function(b) { return M.segundos(b) > 0; }); });
		if (!ok) return { f: 'f_esperar' };
		return null;
	} },
	{ id: 'paso', revisar: function(M) {
		// Mover hacia adelante en Configuración (Inicio es opcional: Configuración Otto ya lo deja derecho)
		var conf = M.orden('DO'), adelante = M.de(conf, 'otto_move', 'otto_move_sens', M.MOVER_ADELANTE);
		var inicio = M.de(conf, 'otto_home')[0];
		if (!adelante.length) {
			var enBucle = M.de(M.orden('LOOP'), 'otto_move', 'otto_move_sens', M.MOVER_ADELANTE);
			return enBucle.length ? { f: 'f_bucle', b: enBucle } : { f: 'f_mover' };
		}
		if (inicio && !adelante.some(function(b) { return conf.indexOf(b) > conf.indexOf(inicio); })) return { f: 'f_orden', b: [inicio] };
		return null;
	} },
	{ id: 'cinco', revisar: function(M) {
		// Repetir 5 veces (o un "contar" de 5 vueltas) con un paso adentro (adelante o atrás)
		var l = M.todos(), pasos = function(b, entrada) { return M.de(M.dentro(b, entrada), 'otto_move', 'otto_move_sens', ['FORWARD', 'BACKWARD']).length; };
		var reps = M.de(l, 'controls_repeat_ext'), cuentas = M.de(l, 'controls_for');
		if (!reps.length && !cuentas.length) return { f: 'f_repetir' };
		var cinco = reps.filter(function(b) { return M.numero(b, 'TIMES') == 5; }).concat(cuentas.filter(function(b) {
			var d = M.numero(b, 'FROM'), h = M.numero(b, 'TO'), p = Math.abs(M.numero(b, 'BY')) || 1;
			return Math.floor(Math.abs(h - d) / p) + 1 == 5;
		}));
		if (!cinco.length) return { f: 'f_cinco', b: reps.concat(cuentas) };
		if (!cinco.some(function(b) { return pasos(b, 'DO'); })) return { f: 'f_mover', b: cinco };
		return null;
	} },
	{ id: 'velocidad', revisar: function(M) {
		// Rápido o Muy rápido en cualquier bloque de Otto que tenga velocidad (Mover, Bailar, Hacer)
		var conVel = M.todos().filter(function(b) { return M.campo(b, 'otto_move_speed') !== ''; });
		if (!conVel.length) return { f: 'f_mover' };
		if (!conVel.some(function(b) { var v = M.campo(b, 'otto_move_speed'); return v == '1500' || v == '1000'; })) return { f: 'f_rapido', b: conVel };
		return null;
	} },
	{ id: 'girar', revisar: function(M) {
		// caminar (adelante o atrás) y girar, en cualquier orden y lugar
		var l = M.todos();
		if (!M.de(l, 'otto_move', 'otto_move_sens', ['FORWARD', 'BACKWARD']).length) return { f: 'f_caminar' };
		if (!M.de(l, 'otto_move', 'otto_move_sens', ['LEFT', 'RIGHT']).length) return { f: 'f_girar' };
		return null;
	} },
	{ id: 'bailar', revisar: function(M) {
		// al menos dos pasos de baile (Bailar, Hacer o Gesto; pueden ser iguales) y Detener después del último
		var l = M.orden('DO').concat(M.orden('LOOP'));
		var baile = l.filter(function(b) { return b.type == 'otto_dance' || b.type == 'otto_do' || b.type == 'otto_gesture'; });
		var detener = M.de(l, 'otto_detener');
		if (baile.length < 2) return { f: 'f_pocos' };
		if (!detener.length) return { f: 'f_detener' };
		if (l.indexOf(detener[detener.length - 1]) < l.indexOf(baile[baile.length - 1])) return { f: 'f_final', b: detener };
		return null;
	} },
	{ id: 'sensor', revisar: function(M) {
		// Si en el Bucle con "distancia < un número" (de 5 a 50 cm; también escrita al revés) y un sonido cuando hay
		// algo cerca. Con "distancia > n", el sonido va en el "si no".
		var si = M.siDelBucle(), c = M.comparacion(si);
		if (!si) return { f: 'f_si' };
		if (!c || c.n < 5 || c.n > 50) return { f: 'f_menor', b: [si.getInputTargetBlock('IF0')] };
		var r = M.ramas(si, c);
		if (!r.cerca.some(M.suena)) return { f: 'f_sonido', b: [si] };
		return null;
	} },
	{ id: 'esquivar', revisar: function(M) {
		// cerca: retroceder o girar; lejos: avanzar (en el "si no", en otro "o si", o en el Bucle fuera del Si)
		var si = M.siDelBucle(), c = M.comparacion(si);
		if (!si) return { f: 'f_si' };
		if (!c) return { f: 'f_condicion', b: [si.getInputTargetBlock('IF0')] };
		var r = M.ramas(si, c);
		if (!M.de(r.cerca, 'otto_move', 'otto_move_sens', M.MOVER_ESQUIVAR).length) return { f: 'f_cerca', b: [si] };
		if (!M.de(r.lejos, 'otto_move', 'otto_move_sens', M.MOVER_ADELANTE).length) return { f: 'f_lejos', b: [si] };
		return null;
	} },
	{ id: 'cerro', revisar: function(M) {
		// el gran desafío: un programa con el sensor y movimientos, cambiado respecto del ejemplo y probado en pantalla
		var huella = M.huella();
		var mueve = M.todos().some(function(b) { return b.type == 'otto_move' || b.type == 'otto_do' || b.type == 'otto_dance'; });
		if (!M.siDelBucle() || !mueve) return { f: 'f_base' };
		if (M.cerroOriginal && huella == M.cerroOriginal) return { f: 'f_igual' };
		if (M.probado != huella) return { f: 'f_probar' };
		return null;
	} }
];

// ---------------------------------------------------------------- interfaz
MPRMisiones.iniciar = function() {
	var b = document.getElementById('btn_misiones');
	if (!b) return;
	var self = MPRMisiones;
	// Bandera blanca dibujada (la fuente de íconos de la app no trae una) y barrita naranja con el avance
	b.innerHTML = '<svg class="mpr-ico-mis" viewBox="0 0 24 24" aria-hidden="true">' +
		'<path d="M5 2.5h2v19H5z"/><path d="M7 3.5h12l-3 4.5 3 4.5H7z"/></svg><span class="mpr-avance-mis"><i></i></span>';
	b.addEventListener('click', function() { if (self.abierto) self.cerrar(); else self.abrir(); });
	try { var p = JSON.parse(window.localStorage[self.CLAVE] || 'null'); if (p && typeof p.actual == 'number') self.progreso = p; } catch (e) {}
	if (!self.progreso.hechas) self.progreso.hechas = {};
	self.progreso.actual = Math.max(0, Math.min(self.LISTA.length - 1, self.progreso.actual));
	self.marcarBoton();
	self.huellaCerro();
	// Probar en pantalla guarda la huella del programa que se probó (misión del Cerro: "pruébalo")
	if (typeof MPRSimulador != 'undefined' && !MPRSimulador.mprMisiones) {
		var probar = MPRSimulador.probar;
		MPRSimulador.probar = function() {
			try { if (!MPRSimulador.corrida) self.probado = self.huella(); } catch (e) {}
			return probar.apply(this, arguments);
		};
		MPRSimulador.mprMisiones = true;
	}
};

MPRMisiones.guardar = function() {
	try { window.localStorage[MPRMisiones.CLAVE] = JSON.stringify(MPRMisiones.progreso); } catch (e) {}
	MPRMisiones.marcarBoton();
};

MPRMisiones.marcarBoton = function() {
	var b = document.getElementById('btn_misiones');
	if (!b) return;
	var n = Object.keys(MPRMisiones.progreso.hechas).length, total = MPRMisiones.LISTA.length;
	var barra = b.querySelector('.mpr-avance-mis i');
	if (barra) barra.style.width = Math.round(100 * n / total) + '%';
	b.title = MPRMisiones.msg('mis_boton', 'Misiones') + ' (' + MPRMisiones.msg('mis_cumplidas', '{n} de {t} cumplidas').replace('{n}', n).replace('{t}', total) + ')';
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
				'<button type="button" id="mpr_mis_ant" title="' + self.msg('mis_anterior', 'Misión anterior') + '"><span class="fa fa-chevron-right mpr-girado"></span></button>' +
				'<button type="button" id="mpr_mis_sig" title="' + self.msg('mis_siguiente', 'Misión siguiente') + '"><span class="fa fa-chevron-right"></span></button>' +
				'<span class="espacio"></span>' +
				'<button type="button" id="mpr_mis_ver_pista"></button>' +
				'<button type="button" id="mpr_mis_probar"></button>' +
				'<button type="button" id="mpr_mis_revisar"></button>' +
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
	document.getElementById('mpr_mis_num').textContent = self.msg('mis_mision', 'Misión') + ' ' + (self.progreso.actual + 1) + ' ' + self.msg('mis_de', 'de') + ' ' + self.LISTA.length;
	// puntos como los del recorrido: naranja = cumplida, anillo = la actual, lavanda = pendiente
	document.getElementById('mpr_mis_puntos').innerHTML = self.LISTA.map(function(x, i) {
		return '<span class="' + (self.progreso.hechas[x.id] ? 'hecha' : (i == self.progreso.actual ? 'actual' : '')) + '"></span>';
	}).join('');
	document.getElementById('mpr_mis_titulo').textContent = (hecha ? '✅ ' : '') + self.msg('mis_' + m.id + '_t', m.id);
	document.getElementById('mpr_mis_texto').textContent = self.msg('mis_' + m.id, '');
	var p = document.getElementById('mpr_mis_pista');
	p.textContent = '💡 ' + self.msg('mis_' + m.id + '_pista', '');
	p.style.display = 'none';
	document.getElementById('mpr_mis_res').textContent = hecha ? self.msg('mis_ya_hecha', '¡Ya la cumpliste! Puedes seguir con la próxima.') : '';
	document.getElementById('mpr_mis_res').className = hecha ? 'ok' : '';
	// íconos de la fuente de la app (no emojis), como el resto de la barra
	document.getElementById('mpr_mis_ver_pista').innerHTML = '<span class="fa fa-question"></span> ' + self.msg('mis_pista', 'Pista');
	document.getElementById('mpr_mis_probar').innerHTML = '<span class="fa fa-play"></span> ' + self.msg('mis_probar', 'Probar');
	document.getElementById('mpr_mis_probar').style.display = typeof MPRSimulador != 'undefined' ? '' : 'none';
	document.getElementById('mpr_mis_revisar').innerHTML = '<span class="fa fa-check"></span> ' + self.msg('mis_revisar', 'Revisar');
	document.getElementById('mpr_mis_ant').disabled = self.progreso.actual == 0;
	document.getElementById('mpr_mis_sig').disabled = self.progreso.actual == self.LISTA.length - 1;
};

MPRMisiones.revisar = function() {
	var self = MPRMisiones, m = self.LISTA[self.progreso.actual], falta = null;
	try {
		// primero lo que Otto revisa antes de mandar (Configuración + Bucle, Configuración Otto, sensor, espacios vacíos)
		var p = typeof MPRRevision != 'undefined' ? MPRRevision.revisar() : null;
		if (p && p.grave) falta = { texto: p.texto.replace(/\s*¿[^?]*\?\s*$/, ''), b: p.bloques, huecos: p.id == 'vacios' };
		else falta = m.revisar(self);
	} catch (e) { console.log('[Misiones]', e); falta = {}; }
	var r = document.getElementById('mpr_mis_res');
	if (falta) {
		r.className = 'falta';
		r.textContent = falta.texto || (falta.f && self.msg('mis_' + m.id + '_' + falta.f)) || self.msg('mis_falta', 'Todavía no. Revisa el objetivo o mira la pista.');
		// los bloques que hay que arreglar, con el borde rojo de siempre (se quita al cambiar algo en la mesa)
		if (falta.b && typeof MPRRevision != 'undefined') MPRRevision.marcar(falta.b.filter(Boolean), falta.huecos);
		document.getElementById('mpr_mis_pista').style.display = 'block';
		return;
	}
	self.progreso.hechas[m.id] = true;
	var ultima = self.progreso.actual == self.LISTA.length - 1;
	// "todas" solo si de verdad están las 10 (se puede llegar a la última saltándose otras con las flechas)
	var faltan = self.LISTA.filter(function(x) { return !self.progreso.hechas[x.id]; }).length;
	r.className = 'ok';
	r.textContent = !faltan ? self.msg('mis_todas', '¡Cumpliste todas las misiones! ¡Eres un gran programador!') :
		ultima ? (faltan == 1 ? self.msg('mis_falta_una', '¡Misión cumplida! Te falta 1.') : self.msg('mis_faltan', '¡Misión cumplida! Te faltan {n}.').replace('{n}', faltan)) : self.msg('mis_cumplida', '¡Misión cumplida!');
	self.celebrar(!faltan);
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
