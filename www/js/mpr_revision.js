'use strict';

// MPR: Otto revisa el programa antes de mandarlo (DOCUMENTACION_TECNICA.md 4.13). Ataja los errores típicos de los niños
// antes de compilar, los explica, marca los bloques con problema y, si se activa con Ctrl + Mayús + A, los arregla solo:
//  - bloques sueltos fuera de Configuración + Bucle (ya no entran al programa: ver "generador", abajo);
//  - falta Configuración + Bucle; bloques de Otto sin Configuración Otto; sensor sin su bloque de configuración;
//  - bloques con un espacio vacío (un "si" sin condición, "esperar" sin número...); programa que no le pide nada a Otto.
// Lo usan la flecha naranja (js/mpr_subida.js) y Probar en pantalla (js/mpr_simulador.js). Textos: msg_es.js (rev_*).

var MPRRevision = {
	// bloques que pueden ir sueltos en la mesa (no son parte de un programa: definiciones globales)
	ARRIBA: { base_setup_loop: 1, base_setup: 1, base_loop: 1, procedures_defnoreturn: 1, procedures_defreturn: 1, variables_set_init: 1, base_define: 1, base_code: 1 },
	CONFIG_OTTO: '<block type="otto_configuration"><field name="PIN_YL">2</field><field name="PIN_YR">3</field><field name="PIN_RL">4</field><field name="PIN_RR">5</field><field name="PIN_Buzzer">13</field></block>',
	CONFIG_SENSOR: '<block type="ultrasonic_sensor"><field name="US_NUMBER">1</field><field name="PIN_TRIG">8</field><field name="PIN_ECHO">9</field></block>',
	// bloques que usan la librería Otto (necesitan Configuración Otto)
	USA_OTTO: /^otto_(?!configuration$)/,
	// bloques que no hacen nada en Otto (configuraciones): un programa solo con ellos "no le pide nada"
	SOLO_CONFIG: { otto_configuration: 1, ultrasonic_sensor: 1, buzzer_init: 1, serial_init: 1, otto_calibration: 1 },
	// entradas que pueden quedar vacías sin error
	VACIO_OK: { serial_print: 1, serial_println: 1, procedures_ifreturn: 1 },
	// Otto pone los bloques que faltan él mismo ("Ponlo tú, Otto"). Apagado por defecto: Otto explica qué falta y
	// dónde buscarlo, y el niño lo pone. Ctrl + Mayús + A lo enciende o lo apaga (no se guarda: al abrir la app vuelve
	// a estar apagado).
	ottoPone: false,
	// texto para cuando Otto no pone los bloques (el niño lo hace)
	TEXTO_NINO: { sin_estructura: 'rev_sin_estructura_tu', sin_config_otto: 'rev_sin_config_otto_tu', sensor_sin_config: 'rev_sensor_sin_config_tu', config_afuera: 'rev_config_afuera_tu' },
	marcados: []
};

MPRRevision.msg = function(k, d) {
	return (typeof MSG != 'undefined' && MSG[k]) || d || '';
};

MPRRevision.ws = function() { return window.BlocklyDuino && BlocklyDuino.workspace; };

MPRRevision.esSuelto = function(b) {
	return !!(b && !b.getParent() && !MPRRevision.ARRIBA[b.type]);
};

// ---------------------------------------------------------------- generador: los bloques sueltos no entran al programa
// Antes, Blockly los metía dentro del Bucle (al principio o al final según su posición en la mesa): un "Bailar" que el
// niño dejó afuera se ejecutaba igual. Ahora lo que harían en el Bucle se descarta, como espera el niño, y Otto avisa
// que están sueltos. Lo que aportan a la configuración (#include, pines, Otto.init...) se mantiene: una Configuración
// Otto o un sensor que quedó afuera sigue funcionando como antes, y los ejemplos con bloques de definición sueltos
// (base_define, base_code, sensores) siguen compilando igual.
(function() {
	if (typeof Blockly == 'undefined' || !Blockly.Arduino || Blockly.Arduino.mprSinSueltos) return;
	var original = Blockly.Arduino.blockToCode;
	Blockly.Arduino.blockToCode = function(block) {
		var codigo = original.apply(this, arguments);
		if (block && !block.disabled && MPRRevision.esSuelto(block) && !(block.workspace && block.workspace.isFlyout)) {
			return Array.isArray(codigo) ? ['', Blockly.Arduino.ORDER_ATOMIC] : '';
		}
		return codigo;
	};
	Blockly.Arduino.mprSinSueltos = true;
})();

// ---------------------------------------------------------------- revisión
MPRRevision.raiz = function() {
	var ws = MPRRevision.ws();
	if (!ws) return null;
	var tops = ws.getTopBlocks(true).filter(function(b) { return !b.disabled; });
	var tipos = ['base_setup_loop', 'base_setup', 'base_loop'];
	for (var k = 0; k < tipos.length; k++) for (var i = 0; i < tops.length; i++) if (tops[i].type == tipos[k]) return tops[i];
	return null;
};

// entrada de bloques de la raíz (Configuración en base_setup_loop; la primera que haya en los otros)
MPRRevision.entrada = function(raiz, nombre) {
	var inp = nombre ? raiz.getInput(nombre) : null;
	if (!inp) inp = raiz.inputList.filter(function(i) { return i.type == Blockly.NEXT_STATEMENT; })[0];
	return inp && inp.connection;
};

// Bloques "del programa": dentro de Configuración + Bucle y dentro de las funciones
MPRRevision.delPrograma = function() {
	var ws = MPRRevision.ws(), res = [];
	if (!ws) return res;
	ws.getTopBlocks(false).forEach(function(t) {
		if (t.disabled || MPRRevision.esSuelto(t)) return;
		res = res.concat(t.getDescendants(false).filter(function(d) { return !d.disabled; }));
	});
	return res;
};

// Devuelve el problema más importante (o null). Cada problema: { id, grave, bloques, texto, arreglo, accion }.
// Si Otto no pone bloques (MPRRevision.ottoPone apagado), el problema no trae arreglo y el texto dice cómo hacerlo.
MPRRevision.revisar = function() {
	var p = MPRRevision.buscar();
	if (p && !MPRRevision.ottoPone) {
		p.arreglo = null;
		if (MPRRevision.TEXTO_NINO[p.id]) p.texto = MPRRevision.msg(MPRRevision.TEXTO_NINO[p.id], p.texto);
	}
	return p;
};

// Ctrl + Mayús + A: Otto pone los bloques él mismo (sí / no). Lo confirma un aviso pequeño abajo al centro, que se va solo
// a los 2,5 s (aparece y se va con opacidad: no repinta la mesa). No usa el globo de Otto, para no distraer al niño.
MPRRevision.cambiarOttoPone = function() {
	var self = MPRRevision;
	self.ottoPone = !self.ottoPone;
	var e = document.getElementById('mpr_rev_aviso');
	if (!e) { e = document.createElement('div'); e.id = 'mpr_rev_aviso'; document.body.appendChild(e); }
	e.innerHTML = '<span class="punto"></span>' + self.msg(self.ottoPone ? 'rev_otto_pone_si' : 'rev_otto_pone_no');
	e.className = self.ottoPone ? 'si' : 'no';
	void e.offsetWidth;   // para que la transición parta de nuevo si se aprieta seguido
	e.className += ' visible';
	clearTimeout(self.avisoT);
	self.avisoT = setTimeout(function() { e.className = e.className.replace(' visible', ''); }, 2500);
};

document.addEventListener('keydown', function(e) {
	if (e.ctrlKey && e.shiftKey && !e.altKey && (e.key == 'A' || e.key == 'a' || e.keyCode == 65)) {
		e.preventDefault();
		e.stopPropagation();
		MPRRevision.cambiarOttoPone();
	}
}, true);

MPRRevision.buscar = function() {
	var self = MPRRevision, ws = self.ws(), m = self.msg;
	if (!ws) return null;
	var raiz = self.raiz();
	var sueltos = ws.getTopBlocks(false).filter(function(b) { return !b.disabled && self.esSuelto(b); });
	var todos = self.delPrograma();
	var hay = function(f) { return todos.filter(f); };
	if (!raiz) {
		var otros = ws.getTopBlocks(false).filter(function(b) { return b.type != 'procedures_defnoreturn' && b.type != 'procedures_defreturn'; });
		return { id: 'sin_estructura', grave: true, bloques: otros, texto: m('rev_sin_estructura'), arreglo: self.ponerEstructura, accion: m('rev_ponerla') };
	}
	var vacios = hay(function(b) {
		if (self.VACIO_OK[b.type]) return false;
		return b.inputList.some(function(inp) { return inp.type == Blockly.INPUT_VALUE && inp.connection && !inp.connection.targetBlock(); });
	});
	// las configuraciones sirven aunque estén sueltas (el generador las mantiene): se buscan en toda la mesa
	var enMesa = ws.getAllBlocks().filter(function(b) { return !b.disabled; });
	var existe = function(tipo) { return enMesa.some(function(b) { return b.type == tipo; }); };
	var usaOtto = hay(function(b) { return self.USA_OTTO.test(b.type); });
	if (usaOtto.length && !existe('otto_configuration')) {
		return { id: 'sin_config_otto', grave: true, bloques: usaOtto.slice(0, 1), texto: m('rev_sin_config_otto'), arreglo: self.ponerConfigOtto, accion: m('rev_ponerla') };
	}
	var sensor = hay(function(b) { return b.type == 'ultrasonic_distance'; });
	if (sensor.length && !existe('ultrasonic_sensor')) {
		return { id: 'sensor_sin_config', grave: true, bloques: sensor, texto: m('rev_sensor_sin_config'), arreglo: self.ponerConfigSensor, accion: m('rev_ponerla') };
	}
	if (vacios.length) {
		return { id: 'vacios', grave: true, bloques: vacios, texto: (vacios.length == 1 ? m('rev_vacio_uno') : m('rev_vacio_varios').replace('{n}', vacios.length)) };
	}
	// una fila suelta hecha solo de configuraciones (Configuración Otto, sensor): Otto la pone en Configuración
	// (si ya hay una igual adentro, sobra: queda como bloque suelto para la papelera)
	var adentro = todos.map(function(b) { return b.type; });
	var configAfuera = sueltos.filter(function(s) {
		return !!s.previousConnection && s.getDescendants(false).every(function(d) { return self.SOLO_CONFIG[d.type] && adentro.indexOf(d.type) < 0; });
	});
	if (configAfuera.length) {
		return { id: 'config_afuera', grave: false, bloques: configAfuera, texto: m('rev_config_afuera'), arreglo: self.entrarConfig, accion: m('rev_meterla') };
	}
	if (sueltos.length) {
		var n = sueltos.reduce(function(a, b) { return a + b.getDescendants(false).length; }, 0);
		return { id: 'sueltos', grave: false, bloques: sueltos, texto: (n == 1 ? m('rev_suelto_uno') : m('rev_sueltos_varios').replace('{n}', n)), arreglo: self.botarSueltos, accion: m('rev_botar') };
	}
	if (!hay(function(b) { return b.type != 'base_setup_loop' && !self.SOLO_CONFIG[b.type] && !/^(math_|logic_|text$|variables_get)/.test(b.type); }).length) {
		return { id: 'vacio', grave: false, bloques: [raiz], texto: m('rev_programa_vacio') };
	}
	return null;
};

// ---------------------------------------------------------------- arreglos (con un solo Ctrl + Z para deshacerlos)
MPRRevision.grupo = function(f) {
	Blockly.Events.setGroup(true);
	try { f(); } finally { Blockly.Events.setGroup(false); }
};

MPRRevision.bloqueDe = function(xml) {
	var b = Blockly.Xml.domToBlock(Blockly.Xml.textToDom('<xml>' + xml + '</xml>').firstChild, MPRRevision.ws());
	return b;
};

// último bloque de una fila (nuevo puede traer otros debajo)
MPRRevision.fin = function(b) {
	while (b.getNextBlock()) b = b.getNextBlock();
	return b;
};

MPRRevision.ponerDespues = function(antes, nuevo) {
	var sig = antes.getNextBlock();
	if (sig) sig.unplug();
	antes.nextConnection.connect(nuevo.previousConnection);
	if (sig) MPRRevision.fin(nuevo).nextConnection.connect(sig.previousConnection);
};

MPRRevision.ponerAlInicio = function(raiz, nuevo) {
	var c = MPRRevision.entrada(raiz, 'DO'), primero = c.targetBlock();
	if (primero) primero.unplug();
	c.connect(nuevo.previousConnection);
	if (primero) MPRRevision.fin(nuevo).nextConnection.connect(primero.previousConnection);
};

// Mete en Configuración las filas sueltas de configuraciones: Configuración Otto al principio, lo demás después de ella
MPRRevision.entrarConfig = function() {
	var p = MPRRevision.revisar();
	if (!p || p.id != 'config_afuera') return;
	MPRRevision.grupo(function() {
		p.bloques.forEach(function(fila) {
			var raiz = MPRRevision.raiz();
			var cfg = raiz.getDescendants(false).filter(function(b) { return b.type == 'otto_configuration'; })[0];
			if (fila.type != 'otto_configuration' && cfg) MPRRevision.ponerDespues(cfg, fila);
			else MPRRevision.ponerAlInicio(raiz, fila);
		});
	});
};

// Pone Configuración + Bucle (con Configuración Otto) y, si el niño tenía una sola fila de bloques suelta, la mete adentro
MPRRevision.ponerEstructura = function() {
	var ws = MPRRevision.ws();
	MPRRevision.grupo(function() {
		var antes = ws.getTopBlocks(true).filter(function(b) { return !b.disabled && b.previousConnection && MPRRevision.esSuelto(b); });
		BlocklyDuino.cargarPlantilla();
		var raiz = MPRRevision.raiz();
		if (!raiz || antes.length != 1) return;
		var fila = antes[0];
		if (fila.type == 'otto_configuration') {
			// ya traía su configuración: se usa la del niño y se quita la de la plantilla
			var cfg = MPRRevision.entrada(raiz, 'DO').targetBlock();
			if (cfg) cfg.dispose(false);
			MPRRevision.entrada(raiz, 'DO').connect(fila.previousConnection);
		} else if (raiz.getInput('LOOP')) {
			raiz.getInput('LOOP').connection.connect(fila.previousConnection);
		}
	});
};

MPRRevision.ponerConfigOtto = function() {
	MPRRevision.grupo(function() { MPRRevision.ponerAlInicio(MPRRevision.raiz(), MPRRevision.bloqueDe(MPRRevision.CONFIG_OTTO)); });
};

MPRRevision.ponerConfigSensor = function() {
	MPRRevision.grupo(function() {
		var raiz = MPRRevision.raiz(), nuevo = MPRRevision.bloqueDe(MPRRevision.CONFIG_SENSOR);
		var cfg = raiz.getDescendants(false).filter(function(b) { return b.type == 'otto_configuration'; })[0];
		if (cfg && cfg.nextConnection) MPRRevision.ponerDespues(cfg, nuevo); else MPRRevision.ponerAlInicio(raiz, nuevo);
	});
};

MPRRevision.botarSueltos = function() {
	var ws = MPRRevision.ws();
	MPRRevision.grupo(function() {
		ws.getTopBlocks(false).filter(function(b) { return !b.disabled && MPRRevision.esSuelto(b); }).forEach(function(b) { b.dispose(true, true); });
	});
};

// ---------------------------------------------------------------- marcar los bloques con problema
// Borde propio: el resaltado de Blockly (un relieve) casi no se ve. Se dibuja un halo encima del contorno del bloque:
// una línea roja fina con un brillo suave del mismo color, que se ve sobre la mesa y sobre bloques de cualquier color
// (estilos en css/blocklino.css, "mpr-halo"). Probar en pantalla usa el mismo halo en verde para el bloque que se está
// haciendo (MPRRevision.halo). En un espacio vacío, además, se marca el hueco que hay que rellenar.
// Se marcan el bloque y los que cuelgan de él (si es una fila suelta).
MPRRevision.SVG = 'http://www.w3.org/2000/svg';

MPRRevision.svg = function(tag, attrs, padre) {
	var e = document.createElementNS(MPRRevision.SVG, tag);
	for (var k in attrs) e.setAttribute(k, attrs[k]);
	if (padre) padre.appendChild(e);
	return e;
};

// Agrega un halo al bloque (tipo: 'marcado' o 'ejecuta'). Devuelve el elemento, para quitarlo después.
MPRRevision.halo = function(b, tipo) {
	var g = b && b.getSvgRoot && b.getSvgRoot(), path = b && b.svgPath_;
	var d = path && path.getAttribute('d');
	if (!g || !d) return null;
	var h = MPRRevision.svg('g', { 'class': 'mpr-halo mpr-halo-' + tipo });
	MPRRevision.svg('path', { 'class': 'mpr-halo-orilla', d: d }, h);
	MPRRevision.svg('path', { 'class': 'mpr-halo-banda', d: d }, h);
	g.appendChild(h);   // al final: queda encima del bloque y del que cuelga debajo
	return h;
};

// Huecos vacíos de un bloque: un rectángulo blanco con orilla roja punteada y un "?", justo donde va el bloque que falta
MPRRevision.huecos = function(b, h) {
	if (!h || MPRRevision.VACIO_OK[b.type]) return;
	var xy = b.getRelativeToSurfaceXY();
	b.inputList.forEach(function(inp) {
		var c = inp.connection;
		if (inp.type != Blockly.INPUT_VALUE || !c || c.targetBlock() || typeof c.x_ != 'number') return;
		var x = c.x_ - xy.x, y = c.y_ - xy.y;
		var enLinea = b.getInputsInline() && inp.renderWidth;
		var r = enLinea ? { x: x - 8, y: y - 3, width: inp.renderWidth + 5, height: (inp.renderHeight || 25) + 6 }
			: { x: x - 12, y: y - 3, width: 34, height: 31 };
		r.rx = 6;
		var g = MPRRevision.svg('g', { 'class': 'mpr-hueco' }, h);
		MPRRevision.svg('rect', r, g);
		MPRRevision.svg('text', { x: r.x + r.width / 2, y: r.y + r.height / 2 + 6 }, g).textContent = '?';
	});
};

MPRRevision.marcar = function(bloques, conHuecos) {
	var ws = MPRRevision.ws();
	MPRRevision.desmarcar();
	var halos = [];
	(bloques || []).forEach(function(b) {
		(MPRRevision.esSuelto(b) || !b.getParent() ? b.getDescendants(false) : [b]).forEach(function(d) {
			var h = MPRRevision.halo(d, 'marcado');
			if (!h) return;
			if (conHuecos) MPRRevision.huecos(d, h);
			halos.push(h);
		});
	});
	MPRRevision.marcados = halos;
	MPRRevision.marcadoT = Date.now();
	// se desmarcan solos cuando el niño cambia algo en la mesa (no con los eventos del propio arreglo, que llegan después)
	if (!MPRRevision.vigila && ws) {
		MPRRevision.vigila = true;
		ws.addChangeListener(function(e) {
			if (e.type == Blockly.Events.UI || !MPRRevision.marcados.length || Date.now() - MPRRevision.marcadoT < 400) return;
			MPRRevision.desmarcar();
		});
	}
};

MPRRevision.desmarcar = function() {
	MPRRevision.marcados.forEach(function(h) { if (h.parentNode) h.parentNode.removeChild(h); });
	MPRRevision.marcados = [];
};

// ---------------------------------------------------------------- cuadro "Otto revisó tu programa" (antes de mandar)
// continuar(): sigue con la subida. Devuelve true si mostró un problema (y la subida espera).
MPRRevision.antesDeMandar = function(div, continuar) {
	var self = MPRRevision, p = self.revisar(), m = self.msg;
	if (!p) return false;
	self.marcar(p.bloques, p.id == 'vacios');
	var botones = '<button type="button" data-rev="volver" class="mpr-rev-sec">' + m('rev_volver', 'Volver a mis bloques') + '</button>';
	if (!p.grave) botones += '<button type="button" data-rev="igual" class="mpr-rev-sec">' + m(p.id == 'sueltos' ? 'rev_mandar_sin' : 'rev_mandar_igual', 'Mandar igual') + '</button>';
	if (p.arreglo) botones += '<button type="button" data-rev="arreglar" class="mpr-rev-pri">' + p.accion + '</button>';
	div.style.color = '#000000';   // no es un error del robot: la mascota no lo lee como rojo
	div.innerHTML = '<div class="mpr-rev-titulo">' + m('rev_titulo', 'Otto revisó tu programa') + '</div>' +
		'<div class="mpr-rev-texto">' + p.texto + '</div><div class="mpr-rev-acc">' + botones + '</div>';
	$('#message').modal('show');
	if (typeof MPRMascota != 'undefined' && MPRMascota.decir) MPRMascota.decir(m(p.grave ? 'rev_otto_grave' : 'rev_otto_aviso'), { anim: 'pensar', prio: 3, ms: 8000 });
	div.onclick = function(ev) {
		var b = ev.target.closest ? ev.target.closest('button[data-rev]') : null;
		if (!b) return;
		div.onclick = null;
		var a = b.getAttribute('data-rev');
		if (typeof MPRMascota != 'undefined' && MPRMascota.cerrarGlobo) MPRMascota.cerrarGlobo();
		if (a == 'volver') { $('#message').modal('hide'); return; }
		var cambio = a == 'arreglar';
		if (cambio) {
			p.arreglo();
			self.desmarcar();
			// el código que se manda tiene que ser el de ahora (la vista previa se actualiza sola, pero después)
			if (BlocklyDuino.renderArduinoCodePreview) BlocklyDuino.renderArduinoCodePreview();
			// después de arreglar se vuelve a revisar: si queda otro problema, se muestra; si no, se manda
			if (self.antesDeMandar(div, function() { continuar(true); })) return;
		}
		continuar(cambio);
	};
	return true;
};

// Para Probar en pantalla: un aviso corto (no detiene la prueba). El borde rojo no choca con el resaltado de la
// prueba (que muestra el bloque que se está haciendo).
MPRRevision.avisoSimulador = function() {
	var p = MPRRevision.revisar();
	if (!p || p.id == 'sin_estructura' || p.id == 'vacio') return '';
	MPRRevision.marcar(p.bloques, p.id == 'vacios');
	// sin la pregunta "¿Lo pongo yo?": en la prueba no hay botón para arreglarlo
	return MPRRevision.msg('rev_en_robot', 'Ojo, para el robot:') + ' ' + p.texto.replace(/\s*¿[^?]*\?\s*$/, '');
};
