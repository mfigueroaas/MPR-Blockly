'use strict';

// MPR: mascota Otto (3D). Vive en una esquina, da consejos y reacciona a los errores comunes.
//  - Interfaz: globo de texto, menú (consejo / colores / esconderme), arrastrable, colores personalizables.
//  - Detecta: bloques sueltos en la mesa, mensajes rojos/verdes del cuadro de verificar y cargar (#messageDIV).
//  - El 3D (three.js + modelo) se carga solo cuando hace falta; si está escondida no gasta recursos.
// Reglas y textos de consejos: js/mpr_consejos.js. Modelo y animaciones: js/mpr_otto3d.js.
// Se carga en index.html después de mpr_tour.js. Compatible con Electron 4 (Chromium 69).

var MPRMascota = {
	W: 150, H: 190,
	CLAVES: { colores: 'mpr_masc_colores', pos: 'mpr_masc_pos', oculta: 'mpr_masc_oculta', silencio: 'mpr_masc_silencio', presentada: 'mpr_masc_presentada', gira: 'mpr_masc_gira' },
	PARTES: [['todo', 'Todo'], ['cabeza', 'Cabeza'], ['cuerpo', 'Cuerpo'], ['piernas', 'Piernas'], ['pies', 'Pies']],
	PALETA: ['#ff5700', '#e63946', '#ffc400', '#2bb673', '#19a7ce', '#3a5bd9', '#8e44ad', '#ff6fb5', '#f2f2f2', '#2b2b2b'],
	PERMITIDOS: { variables_set_init: 1, base_define: 1, base_code: 1 },   // bloques raíz que no necesitan conectarse
	colores: { cabeza: '#ff5700', cuerpo: '#ff5700', piernas: '#ff5700', pies: '#ff5700' },
	silenciada: false,
	modo3d: false,
	prioridadActual: 0,
	ultimaActividad: Date.now(),
	avisoSueltos: { n: 0, cuando: 0 }
};

MPRMascota.msg = function(clave, defecto) {
	return (typeof MSG != 'undefined' && MSG[clave]) || defecto || '';
};

MPRMascota.guardar = function(clave, valor) {
	try { window.localStorage[MPRMascota.CLAVES[clave]] = typeof valor == 'string' ? valor : JSON.stringify(valor); } catch (e) {}
};

MPRMascota.leer = function(clave) {
	try { return window.localStorage[MPRMascota.CLAVES[clave]]; } catch (e) { return undefined; }
};

// ---------------------------------------------------------------- construcción
MPRMascota.crear = function() {
	if (document.getElementById('mpr_masc')) return;
	var caja = document.createElement('div');
	caja.id = 'mpr_masc';
	caja.style.width = MPRMascota.W + 'px';
	caja.style.height = MPRMascota.H + 'px';
	caja.innerHTML =
		'<div id="mpr_masc_globo"><div id="mpr_masc_cont"></div></div>' +
		'<canvas id="mpr_masc_canvas" width="' + MPRMascota.W + '" height="' + MPRMascota.H + '"></canvas>';
	document.body.appendChild(caja);

	var volver = document.createElement('button');
	volver.id = 'mpr_masc_volver';
	volver.type = 'button';
	volver.title = MPRMascota.msg('masc_volver', 'Llamar a Otto');
	volver.innerHTML = '<img src="media/otto_emoji.png" alt="Otto">';
	volver.addEventListener('click', MPRMascota.mostrar);
	document.body.appendChild(volver);

	var c = document.getElementById('mpr_masc_canvas');
	c.addEventListener('mousedown', MPRMascota.empezarArrastre);
	window.addEventListener('resize', MPRMascota.acomodar);
};

MPRMascota.posicionInicial = function() {
	var p = null;
	try { p = JSON.parse(MPRMascota.leer('pos')); } catch (e) {}
	var caja = document.getElementById('mpr_masc');
	if (p && typeof p.x == 'number') { caja.style.left = p.x + 'px'; caja.style.top = p.y + 'px'; MPRMascota.movida = true; }
	else { caja.style.left = (window.innerWidth - MPRMascota.W - 70) + 'px'; caja.style.top = (window.innerHeight - MPRMascota.H - 10) + 'px'; }
	MPRMascota.acomodar();
};

// Mantiene la mascota dentro de la ventana y decide hacia qué lado se abre el globo
MPRMascota.acomodar = function() {
	var caja = document.getElementById('mpr_masc');
	if (!caja) return;
	var x = parseInt(caja.style.left, 10) || 0, y = parseInt(caja.style.top, 10) || 0;
	if (!MPRMascota.movida) { x = window.innerWidth - MPRMascota.W - 70; y = window.innerHeight - MPRMascota.H - 10; }
	x = Math.max(0, Math.min(x, window.innerWidth - MPRMascota.W));
	y = Math.max(0, Math.min(y, window.innerHeight - MPRMascota.H));
	caja.style.left = x + 'px';
	caja.style.top = y + 'px';
	caja.className = (x + MPRMascota.W / 2 < window.innerWidth / 2 ? 'izq' : 'der') + (y < 260 ? ' abajo' : '');
};

MPRMascota.empezarArrastre = function(e) {
	if (e.button !== 0) return;
	var caja = document.getElementById('mpr_masc');
	var ini = { x: e.clientX, y: e.clientY, l: parseInt(caja.style.left, 10), t: parseInt(caja.style.top, 10), movio: false };
	function mover(ev) {
		var dx = ev.clientX - ini.x, dy = ev.clientY - ini.y;
		if (!ini.movio && Math.abs(dx) + Math.abs(dy) < 5) return;
		ini.movio = true;
		MPRMascota.movida = true;
		caja.style.left = (ini.l + dx) + 'px';
		caja.style.top = (ini.t + dy) + 'px';
		MPRMascota.acomodar();
	}
	function soltar() {
		document.removeEventListener('mousemove', mover, true);
		document.removeEventListener('mouseup', soltar, true);
		if (ini.movio) MPRMascota.guardar('pos', { x: parseInt(caja.style.left, 10), y: parseInt(caja.style.top, 10) });
		else MPRMascota.alHacerClic();
	}
	document.addEventListener('mousemove', mover, true);
	document.addEventListener('mouseup', soltar, true);
	e.preventDefault();
};

// ---------------------------------------------------------------- 3D (carga perezosa)
MPRMascota.cargarScript = function(src, listo, falla) {
	var s = document.createElement('script');
	s.src = src;
	s.onload = listo;
	s.onerror = falla;
	document.head.appendChild(s);
};

MPRMascota.iniciar3D = function() {
	var canvas = document.getElementById('mpr_masc_canvas');
	function aplicar() {
		MPRMascota.modo3d = MPROtto3D.iniciar(canvas, MPRMascota.colores);
		if (!MPRMascota.modo3d) MPRMascota.respaldo2D();
		else {
			MPROtto3D.girar(MPRMascota.leer('gira') !== 'no');
			setTimeout(function() { try { console.log('[Otto 3D]', JSON.stringify(MPROtto3D.estadisticas())); } catch (e) {} }, 4000);
		}
	}
	if (typeof THREE != 'undefined' && window.OTTO3D) return aplicar();
	MPRMascota.cargarScript('js/three.min.js', function() {
		MPRMascota.cargarScript('media/otto3d.js', aplicar, MPRMascota.respaldo2D);
	}, MPRMascota.respaldo2D);
};

// Si el equipo no soporta WebGL, Otto aparece en 2D con los mismos globos
MPRMascota.respaldo2D = function() {
	var canvas = document.getElementById('mpr_masc_canvas');
	if (!canvas || document.getElementById('mpr_masc_img')) return;
	var img = document.createElement('img');
	img.id = 'mpr_masc_img';
	img.src = 'media/otto_emoji.png';
	img.addEventListener('mousedown', MPRMascota.empezarArrastre);
	canvas.parentNode.replaceChild(img, canvas);
	MPRMascota.modo3d = false;
};

MPRMascota.animar = function(nombre) {
	if (MPRMascota.modo3d && window.MPROtto3D) MPROtto3D.animar(nombre);
};

// ---------------------------------------------------------------- globo
MPRMascota.cont = function() { return document.getElementById('mpr_masc_cont'); };

MPRMascota.abrirGlobo = function() {
	document.getElementById('mpr_masc_globo').style.display = 'block';
};

MPRMascota.cerrarGlobo = function() {
	clearTimeout(MPRMascota.temporizador);
	var g = document.getElementById('mpr_masc_globo');
	if (g) g.style.display = 'none';
	MPRMascota.prioridadActual = 0;
	MPRMascota.enMenu = false;
};

function mprBoton(texto, clase, accion) {
	var b = document.createElement('button');
	b.type = 'button';
	b.textContent = texto;
	if (clase) b.className = clase;
	b.addEventListener('click', accion);
	return b;
}

// opciones: anim ('saludo', 'alerta'...), ms (tiempo en pantalla), prio (1 = calma, 2 = aviso, 3 = error), forzar
MPRMascota.decir = function(texto, o) {
	o = o || {};
	var prio = o.prio || 1;
	if (MPRMascota.silenciada && !o.forzar) return;
	if (prio < MPRMascota.prioridadActual && document.getElementById('mpr_masc_globo').style.display == 'block') return;
	var cont = MPRMascota.cont();
	cont.innerHTML = '';
	var p = document.createElement('div');
	p.className = 'texto';
	p.textContent = texto;
	cont.appendChild(p);
	var acc = document.createElement('div');
	acc.className = 'acciones';
	acc.appendChild(mprBoton(MPRMascota.msg('masc_entendido', '¡Entendido!'), 'ok', MPRMascota.cerrarGlobo));
	cont.appendChild(acc);
	MPRMascota.enMenu = false;
	MPRMascota.prioridadActual = prio;
	MPRMascota.abrirGlobo();
	MPRMascota.animar(o.anim || 'saludo');
	clearTimeout(MPRMascota.temporizador);
	MPRMascota.temporizador = setTimeout(MPRMascota.cerrarGlobo, o.ms || 16000);
};

// ---------------------------------------------------------------- menú y colores
MPRMascota.alHacerClic = function() {
	var g = document.getElementById('mpr_masc_globo');
	if (g.style.display == 'block' && MPRMascota.enMenu) { MPRMascota.cerrarGlobo(); return; }
	MPRMascota.menu();
	MPRMascota.animar('saludo');
};

MPRMascota.menu = function() {
	var cont = MPRMascota.cont();
	cont.innerHTML = '';
	var t = document.createElement('div');
	t.className = 'titulo';
	t.textContent = MPRMascota.msg('masc_hola', '¿En qué te ayudo?');
	cont.appendChild(t);
	var lista = document.createElement('div');
	lista.className = 'menu';
	lista.appendChild(mprBoton('💡 ' + MPRMascota.msg('masc_consejo', 'Dame un consejo'), '', function() { MPRMascota.consejoAlAzar(true); }));
	lista.appendChild(mprBoton('🎨 ' + MPRMascota.msg('masc_colores', 'Mis colores'), '', MPRMascota.panelColores));
	lista.appendChild(mprBoton(MPROtto3D.gira ? '⏸ ' + MPRMascota.msg('masc_quieto', 'Quedarme quieto') : '🔄 ' + MPRMascota.msg('masc_girar', 'Girar para verme'), '', MPRMascota.alternarGiro));
	lista.appendChild(mprBoton(MPRMascota.silenciada ? '🔔 ' + MPRMascota.msg('masc_activar', 'Activar avisos') : '🔕 ' + MPRMascota.msg('masc_silenciar', 'Avisos tranquilos'), '', MPRMascota.alternarSilencio));
	lista.appendChild(mprBoton('💤 ' + MPRMascota.msg('masc_esconder', 'Esconderme'), '', MPRMascota.esconder));
	cont.appendChild(lista);
	MPRMascota.enMenu = true;
	MPRMascota.prioridadActual = 1;
	MPRMascota.abrirGlobo();
	clearTimeout(MPRMascota.temporizador);
	MPRMascota.temporizador = setTimeout(MPRMascota.cerrarGlobo, 30000);
};

MPRMascota.panelColores = function() {
	var cont = MPRMascota.cont();
	cont.innerHTML = '';
	var t = document.createElement('div');
	t.className = 'titulo';
	t.textContent = '🎨 ' + MPRMascota.msg('masc_colores', 'Mis colores');
	cont.appendChild(t);
	MPRMascota.PARTES.forEach(function(par) {
		var fila = document.createElement('div');
		fila.className = 'fila';
		var et = document.createElement('span');
		et.className = 'etiqueta';
		et.textContent = par[1];
		fila.appendChild(et);
		MPRMascota.PALETA.forEach(function(hex) {
			var b = document.createElement('button');
			b.type = 'button';
			b.className = 'muestra';
			b.style.background = hex;
			b.title = hex;
			if (par[0] != 'todo' && MPRMascota.colores[par[0]] == hex) b.className += ' sel';
			b.addEventListener('click', function() { MPRMascota.pintar(par[0], hex); MPRMascota.panelColores(); });
			fila.appendChild(b);
		});
		cont.appendChild(fila);
	});
	var acc = document.createElement('div');
	acc.className = 'acciones';
	acc.appendChild(mprBoton(MPRMascota.msg('masc_restablecer', 'Naranja de nuevo'), '', function() { MPRMascota.pintar('todo', '#ff5700'); MPRMascota.panelColores(); }));
	acc.appendChild(mprBoton(MPRMascota.msg('masc_listo', 'Listo'), 'ok', MPRMascota.menu));
	cont.appendChild(acc);
	MPRMascota.enMenu = true;
	clearTimeout(MPRMascota.temporizador);
	MPRMascota.temporizador = setTimeout(MPRMascota.cerrarGlobo, 60000);
};

MPRMascota.pintar = function(parte, hex) {
	var partes = parte == 'todo' ? ['cabeza', 'cuerpo', 'piernas', 'pies'] : [parte];
	partes.forEach(function(p) {
		MPRMascota.colores[p] = hex;
		if (MPRMascota.modo3d) MPROtto3D.colorear(p, hex);
	});
	MPRMascota.guardar('colores', MPRMascota.colores);
};

MPRMascota.alternarGiro = function() {
	if (!MPRMascota.modo3d || !window.MPROtto3D) return;
	MPROtto3D.girar(!MPROtto3D.gira);
	MPRMascota.guardar('gira', MPROtto3D.gira ? 'si' : 'no');
	MPRMascota.menu();
};

MPRMascota.alternarSilencio = function() {
	MPRMascota.silenciada = !MPRMascota.silenciada;
	MPRMascota.guardar('silencio', MPRMascota.silenciada ? '1' : '');
	MPRMascota.cerrarGlobo();
	if (!MPRMascota.silenciada) MPRMascota.decir(MPRMascota.msg('masc_vuelvo', '¡Vuelvo a avisarte si veo algo!'), { forzar: true });
};

MPRMascota.esconder = function() {
	MPRMascota.cerrarGlobo();
	MPRMascota.guardar('oculta', '1');
	document.getElementById('mpr_masc').style.display = 'none';
	document.getElementById('mpr_masc_volver').style.display = 'block';
	if (MPRMascota.modo3d && window.MPROtto3D) { MPROtto3D.detener(); MPRMascota.modo3d = false; }
};

MPRMascota.mostrar = function() {
	MPRMascota.guardar('oculta', '');
	document.getElementById('mpr_masc_volver').style.display = 'none';
	document.getElementById('mpr_masc').style.display = 'block';
	MPRMascota.acomodar();
	if (!document.getElementById('mpr_masc_img')) MPRMascota.iniciar3D();
	setTimeout(function() { MPRMascota.decir(MPRMascota.msg('masc_regreso', '¡Aquí estoy de nuevo!'), { forzar: true, ms: 5000 }); }, 600);
};

MPRMascota.consejoAlAzar = function(forzar) {
	var l = MPRConsejos.AZAR, i;
	do { i = Math.floor(Math.random() * l.length); } while (l.length > 1 && i === MPRMascota.ultimoConsejo);
	MPRMascota.ultimoConsejo = i;
	MPRMascota.decir(l[i], { anim: 'pensar', forzar: !!forzar, ms: 14000 });
};

// ---------------------------------------------------------------- detectores
// 1) Bloques sueltos (con enganche arriba o a la izquierda, sin conectar a nada)
MPRMascota.contarSueltos = function() {
	var ws = window.BlocklyDuino && BlocklyDuino.workspace;
	if (!ws || !ws.getTopBlocks) return 0;
	var n = 0;
	ws.getTopBlocks(false).forEach(function(b) {
		if (b.disabled || MPRMascota.PERMITIDOS[b.type]) return;
		if (b.previousConnection || b.outputConnection) n++;
	});
	return n;
};

MPRMascota.revisarSueltos = function() {
	var n = MPRMascota.contarSueltos();
	if (!n) { MPRMascota.avisoSueltos.n = 0; return; }
	var a = MPRMascota.avisoSueltos, ahora = Date.now();
	if (a.n == n && ahora - a.cuando < 300000) return;   // no repite el mismo aviso en 5 minutos
	if (typeof MPRTour != 'undefined' && MPRTour.activo) return;
	if ($('#message').hasClass('in')) return;
	a.n = n; a.cuando = ahora;
	MPRMascota.decir(n == 1 ? MPRConsejos.SUELTOS_UNO : MPRConsejos.SUELTOS_VARIOS.replace('{n}', n), { anim: 'pensar', prio: 2, ms: 20000 });
};

MPRMascota.vigilarMesa = function() {
	var ws = window.BlocklyDuino && BlocklyDuino.workspace;
	if (!ws || !ws.addChangeListener) { setTimeout(MPRMascota.vigilarMesa, 1000); return; }
	ws.addChangeListener(function(e) {
		MPRMascota.ultimaActividad = Date.now();
		if (e && e.type == Blockly.Events.UI) return;
		clearTimeout(MPRMascota.temporizadorMesa);
		MPRMascota.temporizadorMesa = setTimeout(MPRMascota.revisarSueltos, 3500);
	});
};

// 2) Resultado de verificar / cargar: el cuadro #messageDIV (rojo = error, verde = éxito)
MPRMascota.leerMensaje = function() {
	var el = document.getElementById('messageDIV');
	if (!el) return;
	var texto = (el.textContent || '').toLowerCase().replace(/\s+/g, ' ').trim();
	var m = /rgb\((\d+), *(\d+), *(\d+)\)/.exec(el.style.color || '');
	if (!texto || !m) return;
	var r = +m[1], g = +m[2], b = +m[3];
	var clave = texto + '|' + el.style.color;
	if (clave == MPRMascota.ultimoMensaje && Date.now() - MPRMascota.ultimoMensajeT < 4000) return;
	MPRMascota.ultimoMensaje = clave; MPRMascota.ultimoMensajeT = Date.now();

	if (r > 200 && g < 80 && b < 80) {   // rojo: error
		var com2 = (typeof Blockly != 'undefined' && Blockly.Msg && Blockly.Msg.com2 || '').toLowerCase().replace(/<[^>]*>/g, '').trim();
		if (com2 && texto.indexOf(com2) >= 0) { MPRMascota.decir(MPRConsejos.SIN_PUERTO, { anim: 'pensar', prio: 3, ms: 20000 }); return; }
		for (var i = 0; i < MPRConsejos.ERRORES.length; i++) {
			var e = MPRConsejos.ERRORES[i];
			if (e.re.test(texto)) { MPRMascota.decir(e.texto, { anim: e.anim || 'alerta', prio: 3, ms: 25000 }); return; }
		}
	} else if (g > 100 && r < 60 && b < 60) {   // verde: éxito
		var subida = /upload|cargad|subid|cargando|ok code/.test(texto) && !/ready to upload|listo para/.test(texto);
		MPRMascota.decir(subida ? MPRConsejos.EXITO_CARGA : MPRConsejos.EXITO_VERIFICA, { anim: 'celebrar', prio: 3, ms: 9000 });
	}
};

MPRMascota.vigilarMensajes = function() {
	var el = document.getElementById('messageDIV');
	if (!el || !window.MutationObserver) return;
	new MutationObserver(function() {
		clearTimeout(MPRMascota.temporizadorMsg);
		MPRMascota.temporizadorMsg = setTimeout(MPRMascota.leerMensaje, 900);   // espera a que el mensaje se estabilice
	}).observe(el, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['style'] });
};

// 3) Ratos de calma: un consejo cada varios minutos sin actividad
MPRMascota.vigilarCalma = function() {
	setInterval(function() {
		var quieto = Date.now() - MPRMascota.ultimaActividad;
		var ocupado = (typeof MPRTour != 'undefined' && MPRTour.activo) || $('#message').hasClass('in') || document.hidden;
		var visible = document.getElementById('mpr_masc').style.display != 'none';
		if (quieto > 150000 && visible && !ocupado && !MPRMascota.silenciada && Date.now() - (MPRMascota.ultimoAzar || 0) > 420000) {
			MPRMascota.ultimoAzar = Date.now();
			MPRMascota.consejoAlAzar(false);
		}
	}, 30000);
	document.addEventListener('mousedown', function() { MPRMascota.ultimaActividad = Date.now(); }, true);
	document.addEventListener('keydown', function() { MPRMascota.ultimaActividad = Date.now(); }, true);
};

// ---------------------------------------------------------------- arranque
MPRMascota.arrancar = function() {
	var guardados = null;
	try { guardados = JSON.parse(MPRMascota.leer('colores')); } catch (e) {}
	if (guardados) for (var k in MPRMascota.colores) if (typeof guardados[k] == 'string') MPRMascota.colores[k] = guardados[k];
	MPRMascota.silenciada = !!MPRMascota.leer('silencio');

	MPRMascota.crear();
	MPRMascota.posicionInicial();
	MPRMascota.vigilarMesa();
	MPRMascota.vigilarMensajes();
	MPRMascota.vigilarCalma();

	if (MPRMascota.leer('oculta')) {
		document.getElementById('mpr_masc').style.display = 'none';
		document.getElementById('mpr_masc_volver').style.display = 'block';
		return;
	}
	MPRMascota.iniciar3D();
	// Se presenta cuando termina el recorrido (o enseguida si ya lo vio)
	var visto = !!MPRMascota.leer('presentada');
	if (!visto) {
		var espera = setInterval(function() {
			if (typeof MPRTour != 'undefined' && (MPRTour.activo || !MPRTour.yaVisto())) return;
			clearInterval(espera);
			MPRMascota.guardar('presentada', '1');
			MPRMascota.decir(MPRMascota.msg('masc_presentacion', '¡Hola! Soy Otto. Haz clic en mí si necesitas ayuda y te cuento cómo pintarme a tu gusto.'), { anim: 'saludo', ms: 14000 });
		}, 1000);
	}
};

window.addEventListener('load', function() {
	setTimeout(MPRMascota.arrancar, 1200);
});
