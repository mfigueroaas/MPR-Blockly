'use strict';

// MPR: recorrido corto "Conoce a Otto". Se abre solo la primera vez (localStorage) y con el botón "?".
// Resalta cada zona de la pantalla con un globo de Otto. Textos en lang/msg_es.js (claves tour_*).
// Se carga en index.html después de blocklino.js. Sin librerías; compatible con Electron 4 (Chromium 69).

var MPRTour = {
	CLAVE: 'mpr_tour_visto',
	// selector del elemento a resaltar (null = pantalla completa), texto en MSG['tour_' + id]
	PASOS: [
		{ id: 'inicio', sel: null },
		{ id: 'bloques', sel: '.blocklyToolboxDiv' },
		{ id: 'trabajo', sel: '#content_blocks' },
		{ id: 'ejemplos', sel: '#btn_example' },
		{ id: 'puerto', sel: '#portserie' },
		{ id: 'enviar', sel: '#btn_flash' },
		{ id: 'probar', sel: '#btn_simular' },
		{ id: 'misiones', sel: '#btn_misiones' },
		{ id: 'ayudas', sel: '#btn_group' }
	],
	pasos: [],
	actual: 0,
	activo: false
};

MPRTour.texto = function(clave) {
	return (typeof MSG != 'undefined' && MSG['tour_' + clave]) || '';
};

MPRTour.visible = function(el) {
	return !!el && el.offsetWidth > 0 && el.offsetHeight > 0;
};

MPRTour.crear = function() {
	if (document.getElementById('mpr_tour_velo')) return;
	var velo = document.createElement('div');
	velo.id = 'mpr_tour_velo';
	velo.innerHTML =
		'<div id="mpr_tour_foco"></div>' +
		'<div id="mpr_tour_globo">' +
			'<img id="mpr_tour_otto" src="media/otto_emoji.png" alt="Otto">' +
			'<div id="mpr_tour_cuerpo">' +
				'<div id="mpr_tour_titulo"></div>' +
				'<div id="mpr_tour_texto"></div>' +
				'<div id="mpr_tour_puntos"></div>' +
				'<div id="mpr_tour_botones">' +
					'<button type="button" id="mpr_tour_saltar"></button>' +
					'<span id="mpr_tour_espacio"></span>' +
					'<button type="button" id="mpr_tour_atras"></button>' +
					'<button type="button" id="mpr_tour_sig"></button>' +
				'</div>' +
			'</div>' +
		'</div>';
	document.body.appendChild(velo);
	document.getElementById('mpr_tour_saltar').addEventListener('click', MPRTour.cerrar);
	document.getElementById('mpr_tour_atras').addEventListener('click', function() { MPRTour.ir(-1); });
	document.getElementById('mpr_tour_sig').addEventListener('click', function() { MPRTour.ir(1); });
	document.addEventListener('keydown', MPRTour.tecla, true);
	window.addEventListener('resize', function() { if (MPRTour.activo) MPRTour.mostrar(); });
};

MPRTour.tecla = function(e) {
	if (!MPRTour.activo) return;
	if (e.keyCode == 27) { e.preventDefault(); MPRTour.cerrar(); }
	else if (e.keyCode == 39 || e.keyCode == 13) { e.preventDefault(); MPRTour.ir(1); }
	else if (e.keyCode == 37) { e.preventDefault(); MPRTour.ir(-1); }
};

MPRTour.iniciar = function() {
	MPRTour.crear();
	if (typeof MPRBuscar != 'undefined' && MPRBuscar.abierta && MPRBuscar.abierta()) MPRBuscar.cerrar();
	// Solo los pasos cuyo elemento existe y se ve (el puerto USB solo está en la app instalada)
	MPRTour.pasos = MPRTour.PASOS.filter(function(p) {
		return !p.sel || MPRTour.visible(document.querySelector(p.sel));
	});
	MPRTour.actual = 0;
	MPRTour.activo = true;
	document.getElementById('mpr_tour_velo').style.display = 'block';
	MPRTour.mostrar();
};

MPRTour.ir = function(d) {
	var n = MPRTour.actual + d;
	if (n >= MPRTour.pasos.length) { MPRTour.cerrar(); return; }
	if (n < 0) return;
	MPRTour.actual = n;
	MPRTour.mostrar();
};

MPRTour.mostrar = function() {
	var paso = MPRTour.pasos[MPRTour.actual];
	var total = MPRTour.pasos.length;
	var foco = document.getElementById('mpr_tour_foco');
	var globo = document.getElementById('mpr_tour_globo');
	var ancho = window.innerWidth, alto = window.innerHeight;

	document.getElementById('mpr_tour_titulo').textContent = MPRTour.texto(paso.id + '_t');
	document.getElementById('mpr_tour_texto').textContent = MPRTour.texto(paso.id);
	document.getElementById('mpr_tour_saltar').textContent = MPRTour.texto('saltar');
	document.getElementById('mpr_tour_atras').textContent = MPRTour.texto('atras');
	var ultimo = MPRTour.actual == total - 1;
	document.getElementById('mpr_tour_sig').textContent = MPRTour.texto(ultimo ? 'fin' : (MPRTour.actual == 0 ? 'empezar' : 'siguiente'));
	document.getElementById('mpr_tour_atras').style.visibility = MPRTour.actual == 0 ? 'hidden' : 'visible';
	document.getElementById('mpr_tour_saltar').style.visibility = ultimo ? 'hidden' : 'visible';
	var puntos = '';
	for (var i = 0; i < total; i++) puntos += '<span class="' + (i == MPRTour.actual ? 'on' : '') + '"></span>';
	document.getElementById('mpr_tour_puntos').innerHTML = puntos;

	var el = paso.sel ? document.querySelector(paso.sel) : null;
	var r = el ? el.getBoundingClientRect() : null;
	foco.style.display = 'block';
	if (r) {
		var m = 6;
		foco.style.left = (r.left - m) + 'px';
		foco.style.top = (r.top - m) + 'px';
		foco.style.width = (r.width + 2 * m) + 'px';
		foco.style.height = (r.height + 2 * m) + 'px';
		foco.className = '';
	} else {   // pantalla completa: solo se oscurece
		foco.style.left = foco.style.top = (ancho / 2) + 'px';
		foco.style.width = foco.style.height = '0px';
		foco.className = 'centro';
	}

	// Posición del globo: debajo del elemento; si no cabe, a la derecha; si no, centrado en él
	var gw = globo.offsetWidth, gh = globo.offsetHeight, x, y, g = 18;
	if (!r) {
		x = (ancho - gw) / 2; y = (alto - gh) / 2;
	} else if (r.bottom + g + gh < alto - 10) {
		x = r.left; y = r.bottom + g + 6;
	} else if (r.right + g + gw < ancho - 10) {
		x = r.right + g + 6; y = Math.max(r.top, 70);
	} else {
		x = r.left + (r.width - gw) / 2; y = r.top + (r.height - gh) / 2;
	}
	globo.style.left = Math.max(10, Math.min(x, ancho - gw - 10)) + 'px';
	globo.style.top = Math.max(10, Math.min(y, alto - gh - 10)) + 'px';
};

MPRTour.yaVisto = function() {
	try { return !!window.localStorage[MPRTour.CLAVE]; } catch (e) { return true; }
};

MPRTour.cerrar = function() {
	MPRTour.activo = false;
	var velo = document.getElementById('mpr_tour_velo');
	if (velo) velo.style.display = 'none';
	try { window.localStorage[MPRTour.CLAVE] = '1'; } catch (e) {}
};

// La primera vez, además de la pantalla de carga, espera a que Otto 3D termine de cargar: en equipos lentos esa carga
// ocupa la página unos cientos de milisegundos y se notaría como un tirón justo al aparecer el recorrido (máximo 6 s más).
MPRTour.iniciarCuandoListo = function(intentos) {
	intentos = intentos || 0;
	if (typeof MPRMascota != 'undefined' && MPRMascota.cargando3D && intentos < 40) {
		setTimeout(function() { MPRTour.iniciarCuandoListo(intentos + 1); }, 150);
		return;
	}
	var visto = false;
	try { visto = !!window.localStorage[MPRTour.CLAVE]; } catch (e) {}
	if (!MPRTour.activo && !visto) MPRTour.iniciar();   // no lo repite si mientras tanto lo abrieron con "?"
};

window.addEventListener('load', function() {
	var btn = document.getElementById('btn_tour');
	if (btn) btn.addEventListener('click', MPRTour.iniciar);
	var visto = false;
	try { visto = !!window.localStorage[MPRTour.CLAVE]; } catch (e) {}
	if (!visto) setTimeout(MPRTour.iniciarCuandoListo, 1800);   // espera a que termine la pantalla de carga
});
