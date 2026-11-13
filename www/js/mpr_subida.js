'use strict';

// MPR: subir el programa a Otto con menos tropiezos (DOCUMENTACION_TECNICA.md 4.8). Lo inicia index.js.
//  - Puerto automático: revisa los puertos USB cada 2 s; si aparece un solo robot y no hay puerto elegido, lo elige.
//    Si el puerto elegido desaparece, la lista vuelve a "Seleccionar puerto USB".
//  - Placa automática: mientras compila, pregunta al robot a qué velocidad responde su cargador (avrdude -n: solo lee
//    la firma del chip, no escribe nada): 115200 = "Nano", 57600 = "Nano Old". Con la placa equivocada avrdude tarda
//    ~100 s en rendirse; la pregunta tarda ~2,5 s. Lo compilado sirve para las dos (mismo chip): no se recompila.
//    La respuesta se recuerda por puerto (localStorage mpr_placa_<COM>).
//  - Pasos claros con las palabras del manual: "Verificando ..." (paso 1 de 2) y "Cargando ..." (paso 2 de 2), con
//    barra de avance; si falla, la explicación para niños (MPRConsejos) y el detalle técnico plegado.
//  - Precompila al abrir, con prioridad baja, si lo compilado en %TEMP% no está (primera vez o carpeta temporal
//    limpia): la primera subida tarda como las siguientes (en el notebook, 21 s frente a 5,5 s).
// En el navegador (sin Node) no hace nada: index.js usa su código original.

var MPRSubida = {
	PLACAS_NANO: ['nanooptiboot', 'nano'],       // solo se prueba entre estas dos
	VID_ROBOT: /^(1a86|0403|2341|2a03|10c4)$/i,   // CH340, FTDI, Arduino, Arduino.org, CP210x
	ESPERA_PRUEBA_MS: 6000,
	CADA_MS_PUERTOS: 2000,
	ESTIMADO: { compila: 25000, sube: 8000 },     // primera estimación de la barra; luego se usa la última duración
	// "Se está demorando": tiempo de un paso desde el que Otto aconseja desenchufar y enchufar el cable (el consejo que dan
	// los monitores). Doble de lo normal más un margen, con un mínimo y un máximo. Ver tardeMs.
	TARDE: { compila: { margen: 15000, min: 40000, max: 120000 }, sube: { margen: 10000, min: 30000, max: 60000 } },
	RECORDAR_MAX_MS: 120000,                      // una duración más larga que esto no se toma como "lo normal"
	PROGRAMA_PRECOMPILA: '// MPR: programa de precalentamiento que escribe la app al abrir; se reemplaza al subir.\n' +
		'#include <Otto.h>\nOtto Otto;\n\nvoid setup() {\n  Otto.init(2, 3, 4, 5, true, 13);\n  Otto.home();\n}\n\n' +
		'void loop() {\n  Otto.walk(1, 2000, 1);\n  Otto.playGesture(OttoHappy);\n  Otto.sing(S_happy);\n}\n',
	listo: false,
	ocupada: false,
	precompilando: null,
	ultimaCompilacion: null,   // { codigo, fqbn, dir, hex, fecha, tam } de la última compilación correcta (C6)
	hijos: [],          // procesos en curso (arduino-cli, avrdude): se detienen si el envío se traba
	cancelada: null,    // 'cable' (Otto se desenchufó durante la espera) o 'boton' (el niño apretó Detener)
	alCancelar: [],     // quienes esperan a que se cancele (esperarCancelar)
	compilacionEnCurso: null   // última compilación lanzada: la siguiente espera a que termine (ver compilar)
};

MPRSubida.msg = function(clave, defecto) {
	return (typeof MSG != 'undefined' && MSG[clave]) || defecto || clave;
};

MPRSubida.escapar = function(t) {
	return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

// o: { sp, basepath, portserie, messageDiv, quitDiv, alSubir(avisoHtml) }
MPRSubida.iniciar = function(o) {
	var self = MPRSubida;
	if (typeof require != 'function' || !o || !o.sp) return;
	self.o = o;
	self.cp = require('child_process');
	self.fs = require('fs');
	self.path = require('path');
	self.os = require('os');
	self.cli = self.path.resolve(o.basepath, 'arduino-cli.exe');
	self.avrdude = self.buscarAvrdude();
	self.listo = true;
	self.actualizarPuertos(true);
	// MPR: con la ventana minimizada no se revisan los puertos (PLAN_PULIDO); al volver a verla se revisan enseguida
	setInterval(function() { if (!document.hidden) self.actualizarPuertos(false); }, self.CADA_MS_PUERTOS);
	document.addEventListener('visibilitychange', function() { if (!document.hidden) self.actualizarPuertos(false); });
	$(o.portserie).on('mouseover focus', function() { self.actualizarPuertos(false); });
	setTimeout(self.precompilarCuandoListo, 8000);
};

// ---------------------------------------------------------------- puertos
MPRSubida.actualizarPuertos = function(inicial) {
	var self = MPRSubida, sel = self.o.portserie;
	if (self.ocupada) return;
	self.o.sp.list(function(err, ports) {
		if (err || !ports || self.ocupada) return;
		if (!sel.options.length || sel.options[0].value != 'com') {
			var p = document.createElement('option');
			p.value = 'com';
			p.text = Blockly.Msg.com1;
			sel.insertBefore(p, sel.firstChild);
		}
		var usb = ports.filter(function(p) { return p.vendorId; });
		var nombres = usb.map(function(p) { return p.comName; });
		var antes = [];
		for (var i = 1; i < sel.options.length; i++) antes.push(sel.options[i].value);
		var elegido = sel.value;
		if (nombres.join('|') != antes.join('|')) {
			while (sel.options.length > 1) sel.removeChild(sel.options[1]);
			nombres.forEach(function(c) {
				var op = document.createElement('option');
				op.value = c;
				op.text = c;
				sel.appendChild(op);
			});
			sel.value = nombres.indexOf(elegido) >= 0 ? elegido : 'com';
		}
		if (sel.value == 'com' && usb.length) {
			// un solo puerto USB, o un solo robot conocido; al abrir la app, como antes, el primero
			var robots = usb.filter(function(p) { return self.VID_ROBOT.test(p.vendorId || ''); });
			var auto = usb.length == 1 ? usb[0] : robots.length == 1 ? robots[0] : inicial ? usb[0] : null;
			if (auto) {
				sel.value = auto.comName;
				if (!inicial && antes.indexOf(auto.comName) < 0) self.avisarConexion(auto.comName);
			}
		}
		localStorage.setItem('com', sel.value);
		localStorage.setItem('nb_com', ports.length);
		$(sel).toggleClass('mpr-puerto-listo', sel.value != 'com');
	});
};

MPRSubida.avisarConexion = function(com) {
	if (typeof MPRMascota == 'undefined' || !MPRMascota.decir) return;
	if (typeof MPRTour != 'undefined' && MPRTour.activo) return;
	MPRMascota.decir(MPRSubida.msg('sub_conectado', '¡Me conectaste! Estoy en el puerto {com}.').replace('{com}', com),
		{ anim: 'saludo', prio: 1, ms: 6000 });
};

// ---------------------------------------------------------------- procesos
MPRSubida.buscarAvrdude = function() {
	var self = MPRSubida, base = self.path.resolve(self.o.basepath, 'packages', 'arduino', 'tools', 'avrdude');
	try {
		var vers = self.fs.readdirSync(base).sort().reverse();
		for (var i = 0; i < vers.length; i++) {
			var exe = self.path.join(base, vers[i], 'bin', 'avrdude.exe');
			var conf = self.path.join(base, vers[i], 'etc', 'avrdude.conf');
			if (self.fs.existsSync(exe) && self.fs.existsSync(conf)) return { exe: exe, conf: conf };
		}
	} catch (e) {}
	console.log('[MPR] no encontré avrdude: la placa no se revisa antes de subir');
	return null;
};

// Sin consola ni comillas: execFile directo. baja = prioridad "por debajo de lo normal" (la heredan avr-gcc y compañía)
MPRSubida.ejecutar = function(exe, args, op) {
	var self = MPRSubida;
	op = op || {};
	return new Promise(function(listo) {
		var t0 = Date.now();
		var hijo = self.cp.execFile(exe, args, { cwd: op.cwd || self.o.basepath, timeout: op.timeout || 0, windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
			function(err, stdout, stderr) {
				self.hijos = self.hijos.filter(function(h) { return h !== hijo; });
				var texto = err ? String(err.message || err) : String(stdout || '');
				if (err && stderr && texto.indexOf(String(stderr).trim()) < 0) texto += '\n' + stderr;
				listo({ ok: !err, texto: texto, ms: Date.now() - t0, matado: !!(err && err.killed) });
			});
		if (hijo) {
			hijo.mprCompila = !!op.compila;   // MPR: las compilaciones no se cortan (ver compilar)
			self.hijos.push(hijo);
		}
		if (op.baja && hijo && hijo.pid && self.os.setPriority) {
			try { self.os.setPriority(hijo.pid, self.os.constants.priority.PRIORITY_BELOW_NORMAL); } catch (e) {}
		}
	});
};

// codigo: el texto que se escribió en sketch.ino antes de compilar; si compila bien, queda anotado (ultimaCompilacion)
// para no volver a compilarlo si se manda igual (ver compiladoVigente)
// MPR: para no dañar el core de Arduino (ver CORE_DANADO) una compilación NUNCA se corta: "Detener" o desenchufar
// solo cortan la subida (avrdude); la compilación sigue en segundo plano y su resultado se ignora. Las compilaciones
// van en fila (la siguiente espera a la anterior) y cada una escribe sketch.ino recién cuando le toca.
MPRSubida.compilar = function(fqbn, baja, codigo) {
	var self = MPRSubida, sketch = self.path.join(self.o.basepath, 'sketch', 'sketch.ino');
	self.ultimaCompilacion = null;   // MPR: mientras compila (o si falla) lo anterior ya no vale (PLAN_PULIDO C6)
	var args = ['compile', '--fqbn', fqbn, 'sketch/sketch.ino'], op = { baja: baja, compila: true };
	var fin = (self.compilacionEnCurso || Promise.resolve()).then(function() {
		if (typeof codigo == 'string') self.fs.writeFileSync(sketch, codigo);
		return self.ejecutar(self.cli, args, op);
	}).then(function(r) {
		// core de Arduino dañado: se borra su caché y se compila una vez más
		if (!r.ok && !r.matado && self.CORE_DANADO.test(r.texto)) {
			console.log('[MPR] core de Arduino dañado para ' + fqbn + ': borro su caché y vuelvo a compilar');
			self.limpiarCore(fqbn);
			return self.ejecutar(self.cli, args, op);
		}
		return r;
	}).then(function(r) {
		if (r.ok && typeof codigo == 'string') self.ultimaCompilacion = self.huellaCompilado(fqbn, codigo);
		return r;
	}).catch(function(e) {
		return { ok: false, texto: String(e && e.message || e), ms: 0 };
	});
	self.compilacionEnCurso = fin;
	fin.then(function() { if (self.compilacionEnCurso === fin) self.compilacionEnCurso = null; });
	if (!self.ocupada) return fin;   // precompilación: nadie la detiene
	return Promise.race([fin, self.esperarCancelar().then(function() { return { ok: false, texto: 'detenido', ms: 0, matado: true }; })]);
};

// Promesa que se cumple cuando se aprieta Detener o se desenchufa a Otto (ver cancelar)
MPRSubida.esperarCancelar = function() {
	var self = MPRSubida;
	if (self.cancelada) return Promise.resolve();
	return new Promise(function(listo) { self.alCancelar.push(listo); });
};

// MPR: arduino-cli 0.14 arma el "core" de Arduino agregando sus archivos de a uno a core.a y lo guarda en
// %TEMP%\arduino-core-cache (un archivo por placa: Nano y Nano Old tienen el suyo). Si una compilación se corta a mitad
// de ese paso (Detener, desenchufar, cerrar la app mientras precompila), core.a queda sin sus últimos archivos (main
// entre ellos), arduino-cli lo da por bueno y lo copia a la caché: desde entonces esa placa falla SIEMPRE con
// "undefined reference to `main'" (la otra sigue andando). Pasó en un PC del programa el 2026-11-13 con "Nano".
MPRSubida.CORE_DANADO = /undefined reference to .main'|archive has no index|malformed archive|file format not recognized|file truncated/;

MPRSubida.limpiarCore = function(fqbn) {
	var self = MPRSubida, fs = self.fs, path = self.path, tmp = self.os.tmpdir();
	function borrar(p) {   // Node 10: sin fs.rmSync ni rmdir recursivo
		try {
			if (fs.lstatSync(p).isDirectory()) {
				fs.readdirSync(p).forEach(function(n) { borrar(path.join(p, n)); });
				fs.rmdirSync(p);
			} else fs.unlinkSync(p);
		} catch (e) { console.log('[MPR] no pude borrar ' + p + ': ' + e.message); }
	}
	// caché del core de esta placa: core_<fqbn con _>_<32 hex>.a (la de Nano no debe tocar la de Nano Old)
	var nombre = new RegExp('^core_' + fqbn.replace(/[:=]/g, '_') + '_[0-9a-f]{32}\\.a$', 'i');
	try {
		var cache = path.join(tmp, 'arduino-core-cache');
		fs.readdirSync(cache).forEach(function(n) { if (nombre.test(n)) borrar(path.join(cache, n)); });
	} catch (e) {}
	// y la carpeta de compilación del programa (guarda el core.a a medias)
	try {
		var boceto = path.resolve(self.o.basepath, 'sketch');
		var md5 = require('crypto').createHash('md5').update(boceto).digest('hex').toUpperCase();
		borrar(path.join(tmp, 'arduino-sketch-' + md5));
	} catch (e) {}
};

// ---------------------------------------------------------------- no recompilar lo mismo (PLAN_PULIDO C6)
// MPR: arduino-cli 0.14 deja lo compilado en %TEMP%\arduino-sketch-<MD5 de la carpeta del programa> y "upload" sube el
// sketch.ino.hex de ahí. Si el programa y la placa son los de la última compilación correcta y ese .hex sigue igual
// (misma fecha y tamaño), la flecha va directo a enviar. Ante cualquier duda, compila.
MPRSubida.carpetaCompilado = function(fqbn) {
	var self = MPRSubida, tmp = self.os.tmpdir();
	var boceto = self.path.resolve(self.o.basepath, 'sketch', 'sketch.ino');
	function sirve(d) {
		try {
			var op = JSON.parse(self.fs.readFileSync(self.path.join(tmp, d, 'build.options.json'), 'utf8'));
			return op.fqbn == fqbn && String(op.sketchLocation).toLowerCase() == boceto.toLowerCase();
		} catch (e) { return false; }
	}
	try {
		var md5 = require('crypto').createHash('md5').update(self.path.dirname(boceto)).digest('hex').toUpperCase();
		if (sirve('arduino-sketch-' + md5)) return self.path.join(tmp, 'arduino-sketch-' + md5);
		var dirs = self.fs.readdirSync(tmp);
		for (var i = 0; i < dirs.length; i++) {
			if (dirs[i].indexOf('arduino-sketch-') == 0 && sirve(dirs[i])) return self.path.join(tmp, dirs[i]);
		}
	} catch (e) {}
	return null;
};

MPRSubida.huellaCompilado = function(fqbn, codigo) {
	var self = MPRSubida, dir = self.carpetaCompilado(fqbn);
	if (!dir) return null;
	try {
		var hex = self.path.join(dir, 'sketch.ino.hex'), st = self.fs.statSync(hex);
		if (!st.size) return null;
		return { codigo: codigo, fqbn: fqbn, dir: dir, hex: hex, fecha: st.mtime.getTime(), tam: st.size };
	} catch (e) { return null; }
};

MPRSubida.compiladoVigente = function(fqbn, codigo) {
	var self = MPRSubida, u = self.ultimaCompilacion;
	if (!u || u.codigo !== codigo || u.fqbn !== fqbn) return false;
	try {
		var st = self.fs.statSync(u.hex);
		if (st.mtime.getTime() != u.fecha || st.size != u.tam) return false;
		var op = JSON.parse(self.fs.readFileSync(self.path.join(u.dir, 'build.options.json'), 'utf8'));
		if (op.fqbn != fqbn) return false;
		// y sketch.ino sigue siendo ese programa (nadie lo reemplazó desde entonces)
		return self.fs.readFileSync(self.path.join(self.o.basepath, 'sketch', 'sketch.ino'), 'utf8') === codigo;
	} catch (e) { return false; }
};

MPRSubida.enviar = function(fqbn, com) {
	return MPRSubida.ejecutar(MPRSubida.cli, ['upload', '--port', com, '--fqbn', fqbn, 'sketch/sketch.ino']);
};

// Devuelve { placa } con la que responde, { placa: null, texto } si no responde, o { placa, saltada } si no aplica
MPRSubida.averiguarPlaca = function(com) {
	var self = MPRSubida, actual = localStorage.getItem('card');
	if (self.PLACAS_NANO.indexOf(actual) < 0 || !self.avrdude) return Promise.resolve({ placa: actual, saltada: true });
	var guardada = localStorage.getItem('mpr_placa_' + com);
	var orden = [guardada, actual].concat(self.PLACAS_NANO).filter(function(c, i, a) {
		return c && self.PLACAS_NANO.indexOf(c) >= 0 && window.profile[c] && a.indexOf(c) == i;
	});
	var textos = [];
	function probar(i) {
		if (i >= orden.length) return Promise.resolve({ placa: null, texto: textos.join('\n') });
		var c = orden[i];
		var args = ['-C', self.avrdude.conf, '-p', 'atmega328p', '-c', 'arduino', '-P', com, '-b', String(window.profile[c].speed), '-n'];
		return self.ejecutar(self.avrdude.exe, args, { timeout: self.ESPERA_PRUEBA_MS }).then(function(r) {
			if (r.ok) return { placa: c, ms: r.ms };
			textos.push('[' + window.profile[c].description + ', ' + window.profile[c].speed + ' baudios] ' +
				(r.matado ? 'Otto no responde (' + self.ESPERA_PRUEBA_MS / 1000 + ' s sin respuesta). ' : '') + r.texto.trim());
			// puerto ocupado o inexistente: la otra velocidad tampoco va a funcionar
			if (/access is denied|acceso denegado|can't open device|cannot find the file|no se puede encontrar el archivo/i.test(r.texto)) {
				return { placa: null, texto: textos.join('\n') };
			}
			return probar(i + 1);
		});
	}
	return probar(0);
};

MPRSubida.cambiarPlaca = function(placa) {
	$('#boards').val(placa);
	if (window.BlocklyDuino && BlocklyDuino.change_card) BlocklyDuino.change_card();   // mismo chip: no recarga nada
	else localStorage.setItem('card', placa);
};

// ---------------------------------------------------------------- mensajes
MPRSubida.estimado = function(etapa) {
	var v = parseInt(localStorage.getItem('mpr_t_' + etapa), 10);
	return v > 0 ? v : MPRSubida.ESTIMADO[etapa];
};

MPRSubida.recordar = function(etapa, ms) {
	if (ms > MPRSubida.RECORDAR_MAX_MS) return;
	try { localStorage.setItem('mpr_t_' + etapa, String(ms)); } catch (e) {}
};

MPRSubida.tardeMs = function(etapa, estimadoMs) {
	var t = MPRSubida.TARDE[etapa];
	return Math.max(t.min, Math.min(t.max, estimadoMs * 2 + t.margen));
};

// etapa: 'compila' o 'sube' (para saber cuándo se está demorando más de lo normal)
MPRSubida.paso = function(titulo, sub, estimadoMs, etapa) {
	var self = MPRSubida, div = self.o.messageDiv;
	self.vigilarDemora(etapa, estimadoMs);
	div.style.color = '#000000';
	div.innerHTML = '<div class="mpr-paso-titulo">' + titulo + ' <i class="fa fa-spinner fa-pulse fa-fw"></i></div>' +
		'<div class="mpr-paso-sub">' + self.escapar(sub) + '</div><div class="mpr-progreso"><div></div></div>';
	$('#message').modal('show');
	// La barra avanza sola con una transición (sin temporizadores): llega a ~90 % en el tiempo estimado y nunca al 100 %
	var barra = div.querySelector('.mpr-progreso div');
	void barra.offsetWidth;
	barra.style.transition = 'transform ' + Math.round(estimadoMs * 1.6) + 'ms cubic-bezier(0.2, 0.6, 0.35, 1)';
	barra.style.transform = 'scaleX(0.95)';
};

// ---------------------------------------------------------------- se está demorando más de lo normal
// A veces la subida se queda pegada en "Verificando ..." o "Cargando ..." (el cable o el puerto quedan trabados). El
// consejo de los monitores es desenchufar el cable, enchufarlo y mandar otra vez: Otto lo dice cuando el paso pasa de
// lo normal. Si el niño desenchufa a Otto mientras tanto, la app detiene lo que estaba haciendo (si no, la flecha queda
// "ocupada" y no responde); también hay un botón Detener.
MPRSubida.vigilarDemora = function(etapa, estimadoMs) {
	var self = MPRSubida;
	self.dejarDeVigilar();
	if (!etapa) return;
	self.tDemora = setTimeout(function() { self.avisarDemora(); }, self.tardeMs(etapa, estimadoMs));
};

MPRSubida.dejarDeVigilar = function() {
	clearTimeout(MPRSubida.tDemora);
	clearInterval(MPRSubida.tCable);
	MPRSubida.tDemora = MPRSubida.tCable = null;
};

MPRSubida.avisarDemora = function() {
	var self = MPRSubida, div = self.o.messageDiv;
	if (!self.ocupada || !div.querySelector('.mpr-progreso')) return;
	var texto = self.msg('sub_tarde', 'Me estoy demorando más de lo normal. Desenchufa mi cable USB, vuelve a enchufarlo y manda tu programa otra vez.');
	var caja = document.createElement('div');
	caja.className = 'mpr-paso-tarde';
	caja.innerHTML = '<span>' + self.escapar(texto) + '</span><button type="button">' + self.escapar(self.msg('sub_detener', 'Detener')) + '</button>';
	caja.querySelector('button').onclick = function() { self.cancelar('boton'); };
	div.appendChild(caja);
	if (typeof MPRMascota != 'undefined' && MPRMascota.decir) MPRMascota.decir(texto, { anim: 'pensar', prio: 3, ms: 30000 });
	// mientras tanto, cada segundo: si el puerto de Otto desaparece (lo desenchufaron), se detiene todo
	var com = self.o.portserie.value;
	self.tCable = setInterval(function() {
		self.o.sp.list(function(err, ports) {
			if (err || !ports || !self.ocupada || self.cancelada) return;
			if (!ports.some(function(p) { return p.comName == com; })) self.cancelar('cable');
		});
	}, 1000);
};

// Detiene los procesos en curso (con sus hijos: arduino-cli lanza avr-gcc, avrdude...). La subida termina sola cuando
// los procesos mueren, y muestra el mensaje de "detenido" en vez del error.
MPRSubida.cancelar = function(motivo) {
	var self = MPRSubida;
	if (!self.ocupada || self.cancelada) return;
	self.cancelada = motivo;
	self.dejarDeVigilar();
	// la subida en curso deja de esperar (la compilación sigue sola en segundo plano: ver compilar)
	var esperas = self.alCancelar;
	self.alCancelar = [];
	esperas.forEach(function(listo) { listo(); });
	// MPR: h.kill() solo si taskkill falló. Si se mataba al padre enseguida, cuando taskkill buscaba el árbol el padre ya
	// no existía y sus hijos (avrdude) quedaban vivos con el puerto tomado (PLAN_PULIDO B2). Las compilaciones NO se
	// cortan: cortar arduino-cli mientras arma el core deja core.a a medias en la caché (error "undefined reference to
	// main" con esa placa para siempre; ver CORE_DANADO)
	self.hijos.forEach(function(h) {
		if (h.mprCompila) return;
		var matar = function() { try { h.kill(); } catch (e) {} };
		try {
			self.cp.execFile('taskkill', ['/pid', String(h.pid), '/T', '/F'], { windowsHide: true }, function(err) { if (err) matar(); });
		} catch (e) { matar(); }
	});
};

MPRSubida.mostrarDetenido = function() {
	var self = MPRSubida, div = self.o.messageDiv;
	var texto = self.cancelada == 'cable' ?
		self.msg('sub_detenido_cable', '¡Bien! Me desenchufaste y detuve el envío. Vuelve a enchufarme, espera a que aparezca mi puerto arriba y manda tu programa otra vez.') :
		self.msg('sub_detenido', 'Desenchufa mi cable USB, vuelve a enchufarlo y manda tu programa otra vez.');
	div.style.color = '#000000';
	div.innerHTML = '<div class="mpr-rev-titulo">' + self.escapar(self.msg('sub_detenido_titulo', 'Detuve el envío')) + '</div>' +
		'<div class="mpr-error-texto">' + self.escapar(texto) + '</div>' +
		self.pie('P5', typeof MPRConsejos != 'undefined' && MPRConsejos.DEMORA_MONITOR) + self.o.quitDiv;
	$('#message').modal('show');
	var ll = div.querySelector('.mpr-error-llamar');
	if (typeof MPRMascota != 'undefined' && MPRMascota.decir) {
		MPRMascota.decir((self.cancelada == 'cable' ? '' : self.msg('sub_detenido_titulo', 'Detuve el envío') + '. ') + texto + (ll ? ' ' + ll.textContent.replace(/^\W+/, '') : ''), { anim: 'pensar', prio: 3, ms: 20000 });
	}
};

// Pie de los errores: el código para el monitor y, si el mismo error ya salió varias veces seguidas, el aviso de
// llamarlo (Otto ayuda primero; el monitor llega sabiendo qué pasó). Lo lee la mascota (.mpr-error-llamar).
MPRSubida.pie = function(codigo, monitor) {
	var self = MPRSubida, C = typeof MPRConsejos != 'undefined' ? MPRConsejos : null;
	if (!C || !codigo) return '';
	var llamar = C.llamar(codigo, C.registrar(codigo));
	return (llamar ? '<div class="mpr-error-llamar">✋ ' + self.escapar(llamar) + '</div>' : '') +
		'<div class="mpr-error-codigo">' + self.escapar(self.msg('sub_codigo', 'Código para tu monitor: {codigo}').replace('{codigo}', codigo)) +
		(monitor ? '<span class="mpr-error-monitor">' + self.escapar(monitor) + '</span>' : '') + '</div>';
};

MPRSubida.mostrarError = function(etapa, texto) {
	var self = MPRSubida, div = self.o.messageDiv;
	if (self.cancelada) { self.mostrarDetenido(); return; }   // el error es porque se detuvieron los procesos
	var e = (typeof MPRConsejos != 'undefined' && MPRConsejos.explicar) ? MPRConsejos.explicar(texto) : null;
	var titulo = etapa == 'compila' ? self.msg('sub_err_compila', 'No pude preparar tu programa') : self.msg('sub_err_sube', 'No pude enviar el programa a Otto');
	div.style.color = '#ff0000';   // rojo: la mascota lo lee como error
	div.innerHTML = '<div class="mpr-error-titulo">🛑 ' + self.escapar(titulo) + '</div>' +
		(e ? '<div class="mpr-error-texto">' + self.escapar(e.texto) + '</div>' : '') +
		(e ? self.pie(e.codigo, e.monitor) : '') +
		'<details class="mpr-detalle"><summary>' + self.escapar(self.msg('sub_detalle', 'Ver detalle técnico')) + '</summary><pre>' +
		self.escapar(texto) + '</pre></details>' + self.o.quitDiv;
	$('#message').modal('show');
};

MPRSubida.sinPuerto = function() {
	var self = MPRSubida, C = typeof MPRConsejos != 'undefined' ? MPRConsejos : null;
	self.o.messageDiv.style.color = '#ff0000';
	self.o.messageDiv.innerHTML = Blockly.Msg.com2 + self.pie('P1', C && C.SIN_PUERTO_MONITOR) + self.o.quitDiv;
	$('#message').modal('show');
};

// ---------------------------------------------------------------- verificar (botón del visto bueno)
// Como el paso 1 de la flecha naranja: mismo cuadro, errores explicados con su código. Solo si compila queda anotado
// ese mismo código (ultimaCompilacion; antes quedaba marcado aunque fallara y la flecha mandaba lo último que sí compiló).
MPRSubida.verificar = function(codigo) {
	var self = MPRSubida, carte = localStorage.getItem('card');
	if (self.ocupada) return;
	self.ocupada = true;
	self.cancelada = null;
	var esperando = self.precompilando;
	self.paso(Blockly.Msg.check, self.msg('sub_verifica', 'Reviso tu programa y lo preparo para Otto.'), self.estimado('compila') + (esperando ? 10000 : 0), 'compila');
	Promise.race([esperando || Promise.resolve(), self.esperarCancelar()]).then(function() {
		if (self.cancelada) return { ok: false, texto: 'detenido' };
		return self.compilar(window.profile[carte].upload_arg, false, codigo);   // escribe sketch.ino cuando le toca
	}).then(function(c) {
		if (!c.ok) { self.mostrarError('compila', c.texto); return; }
		self.recordar('compila', c.ms);
		if (typeof MPRConsejos != 'undefined') MPRConsejos.registrar(null);
		var div = self.o.messageDiv;
		div.style.color = '#009000';
		div.innerHTML = Blockly.Msg.check + ': ✅ Code is ready to upload' + self.o.quitDiv;
		$('#message').modal('show');
		setTimeout(function() { if (div.style.color == 'rgb(0, 144, 0)') $('#message').modal('hide'); }, 3000);
	}).catch(function(e) {
		self.mostrarError('compila', String(e && e.stack || e));
	}).then(function() { self.terminar(); });
};

MPRSubida.terminar = function() {
	MPRSubida.dejarDeVigilar();
	MPRSubida.ocupada = false;
	MPRSubida.cancelada = null;
	MPRSubida.alCancelar = [];
};

// ---------------------------------------------------------------- subir (flecha naranja)
// alTerminar(ok), opcional: la usa la calibración (js/mpr_calibracion.js) para seguir cuando el programa ya está en Otto
MPRSubida.cargar = function(codigo, alTerminar) {
	var self = MPRSubida, subio = false;
	if (self.ocupada) { if (alTerminar) alTerminar(false); return; }
	var com = self.o.portserie.value, carte = localStorage.getItem('card');
	if (com == 'com') {
		self.sinPuerto();
		if (alTerminar) alTerminar(false);
		return;
	}
	self.ocupada = true;
	self.cancelada = null;
	localStorage.setItem('verif', false);
	var esperando = self.precompilando;
	self.paso(Blockly.Msg.check, esperando ? self.msg('sub_paso1_espera') : self.msg('sub_paso1'), self.estimado('compila') + (esperando ? 10000 : 0), 'compila');
	Promise.race([esperando || Promise.resolve(), self.esperarCancelar()]).then(function() {
		if (self.cancelada) return [{ ok: false, texto: 'detenido' }, {}];
		var compilacion, fqbn = window.profile[carte].upload_arg;
		// MPR: si este mismo programa ya se compiló bien para esta placa (con Verificar o con la flecha) y lo compilado
		// sigue ahí, no se vuelve a compilar (PLAN_PULIDO C6; antes solo justo después de Verificar)
		if (self.compiladoVigente(fqbn, codigo)) compilacion = Promise.resolve({ ok: true, saltada: true });
		else compilacion = self.compilar(fqbn, false, codigo);   // escribe sketch.ino cuando le toca
		return Promise.all([compilacion, self.averiguarPlaca(com)]);
	}).then(function(r) {
		var comp = r[0], prueba = r[1];
		if (!comp.ok) { self.mostrarError('compila', comp.texto); return; }
		if (!comp.saltada) self.recordar('compila', comp.ms);
		if (!prueba.placa) { self.mostrarError('sube', prueba.texto); return; }
		var aviso = '';
		if (prueba.placa != carte) {
			self.cambiarPlaca(prueba.placa);
			carte = prueba.placa;
			aviso = '<div class="mpr-ok-placa">' + self.escapar(self.msg('sub_placa', 'Tu Otto usa la placa "{placa}": la cambié en la lista.')
				.replace('{placa}', $('#boards option:selected').text().replace(/^\W+/, '').trim())) + '</div>';
		}
		if (self.cancelada) { self.mostrarDetenido(); return; }
		self.paso(Blockly.Msg.upload, self.msg('sub_paso2'), self.estimado('sube'), 'sube');
		return self.enviar(window.profile[carte].upload_arg, com).then(function(s) {
			if (!s.ok) { self.mostrarError('sube', s.texto); return; }
			self.recordar('sube', s.ms);
			if (!prueba.saltada) localStorage.setItem('mpr_placa_' + com, carte);
			subio = true;
			if (typeof MPRConsejos != 'undefined') MPRConsejos.registrar(null);
			self.o.alSubir(aviso);
		});
	}).catch(function(e) {
		self.mostrarError('sube', String(e && e.stack || e));
	}).then(function() {
		self.terminar();
		if (alTerminar) { try { alTerminar(subio, com); } catch (e) { console.log(e); } }
	});
};

// ---------------------------------------------------------------- precompilar al abrir
MPRSubida.precompilarCuandoListo = function() {
	var self = MPRSubida;
	var ocupado = self.ocupada || (typeof MPRTour != 'undefined' && MPRTour.activo) ||
		(typeof MPRMascota != 'undefined' && MPRMascota.cargando3D);
	if (ocupado) { setTimeout(self.precompilarCuandoListo, 3000); return; }
	self.precompilar();
};

MPRSubida.precompilar = function() {
	var self = MPRSubida, carte = localStorage.getItem('card'), perfil = window.profile && window.profile[carte];
	if (!perfil || perfil.prog != 'arduino' || self.compiladoListo(perfil.upload_arg)) return;
	self.precompilando = self.compilar(perfil.upload_arg, true, self.PROGRAMA_PRECOMPILA).then(function(r) {
		console.log('[MPR] precompilación ' + (r.ok ? 'lista' : 'con error') + ' en ' + r.ms + ' ms');
		self.precompilando = null;
	});
};

// arduino-cli 0.14 deja lo compilado en %TEMP%\arduino-sketch-<hash>; build.options.json dice de qué programa y placa
MPRSubida.compiladoListo = function(fqbn) {
	var self = MPRSubida, tmp = self.os.tmpdir();
	var boceto = self.path.resolve(self.o.basepath, 'sketch', 'sketch.ino').toLowerCase();
	try {
		return self.fs.readdirSync(tmp).some(function(d) {
			if (d.indexOf('arduino-sketch-') != 0) return false;
			try {
				var op = JSON.parse(self.fs.readFileSync(self.path.join(tmp, d, 'build.options.json'), 'utf8'));
				return op.fqbn == fqbn && String(op.sketchLocation).toLowerCase() == boceto &&
					self.fs.existsSync(self.path.join(tmp, d, 'libraries', 'Otto'));
			} catch (e) { return false; }
		});
	} catch (e) { return true; }   // ante la duda, no precompila
};
