'use strict';

// MPR: "Probar en pantalla" (DOCUMENTACION_TECNICA.md 4.10). Otto sube a un escenario (una mesa en 3D) y hace el
// programa de bloques con los mismos movimientos y sonidos que el robot: js/mpr_otto_lib.js es la traducción de la
// librería Otto (servos, canciones, gestos). Mientras tanto:
//  - ilumina el bloque que se está ejecutando;
//  - el sensor ultrasónico mide la distancia a una caja que el niño puede arrastrar (o quitar);
//  - avisa si Otto llega al borde de la mesa (el robot real se caería) o choca con la caja;
//  - el zumbador suena por el parlante del computador (se puede silenciar).
// Usa el mismo Otto 3D de la mascota (no carga otro modelo): su canvas se muda al escenario mientras está abierto.
// Las piernas se mueven con los ángulos de los 4 servos; el tronco se inclina sobre el pie que queda apoyado.
// Compatible con Electron 4 (Chromium 69) y con el navegador (sin Node no suenan las canciones de la librería).

var MPRSimulador = {
	MESA: { ancho: 1400, fondo: 700, grosor: 18 },  // mm; Otto mide unos 125 mm de alto
	CUADRO: 100,              // tablero de cuadros de 10 cm: la caja cae justo en un cuadro y se pueden contar
	INICIO: { x: -350, z: 0, rumbo: Math.PI / 2 },   // en el centro de un cuadro, a la izquierda, mirando hacia la derecha (+x)
	CAJA: { lado: 100, x: 150, z: 0 },
	SIN_ECO_CM: 400,          // lo que mide el sensor si no hay nada adelante (alcance del HC-SR04)
	MM_PASO: 25,              // caminar: avance por paso (aproximado al robot real)
	GRADOS_GIRO: 20,          // girar: grados por paso
	MM_LATERAL: 12,           // moonwalker y crusaito: desplazamiento de lado por paso
	RADIO: 45,                // huella aproximada de Otto (mm) para chocar con la caja y caer de la mesa
	MAX_MS: 180000,           // corta sola una prueba que nunca termina
	VOLUMEN: 0.05,
	// Cámara: gira alrededor de Otto (ángulo horizontal y altura) y se acerca o aleja. La vista inicial es la de siempre.
	VISTA: { giro: 0.2, altura: 0.43, distancia: 765, fov: 32 },
	ALTURA_MIN: 0.12, ALTURA_MAX: 1.3, ZOOM_MIN: 0.5, ZOOM_MAX: 1.9,
	abierto: false,
	corrida: null,
	n: 0,
	servo: [90, 90, 90, 90],  // ángulos que manda la librería (0 pierna izq., 1 pierna der., 2 pie izq., 3 pie der.)
	cuerpo: { x: 0, z: 0, rumbo: 0 },
	tramos: [],
	cajaVisible: true,
	silencio: false,
	vista: null
};

MPRSimulador.DETENIDO = { detenido: true };

MPRSimulador.msg = function(k, d) {
	return (typeof MSG != 'undefined' && MSG[k]) || d || k;
};

// ---------------------------------------------------------------- interfaz
MPRSimulador.iniciar = function() {
	var b = document.getElementById('btn_simular');
	if (!b) return;
	var self = MPRSimulador;
	b.title = self.msg('sim_boton', 'Probar en pantalla');
	// pantalla con ▶ adentro (la fuente de íconos de la app no trae una): "probar en la pantalla"
	b.innerHTML = '<svg class="mpr-ico-sim" viewBox="0 0 24 24" aria-hidden="true">' +
		'<rect x="2.5" y="3.5" width="19" height="13" rx="2.5" fill="none" stroke="#ffffff" stroke-width="2.2"/>' +
		'<path d="M8.5 20.5h7M12 16.8v3.5" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"/>' +
		'<path d="M10.2 7.3l5 2.7-5 2.7z" fill="#ffffff"/></svg>';
	b.addEventListener('click', function() { if (self.abierto) self.cerrar(); else self.abrir(); });
	$(b).mouseover(function() { $('#survol').text(self.msg('sim_boton_corto', 'Probar en pantalla')); })
		.mouseout(function() { $('#survol').text(''); });
	try { self.silencio = window.localStorage.mpr_sim_silencio == '1'; } catch (e) {}
};

MPRSimulador.crearUI = function() {
	if (document.getElementById('mpr_esc')) return;
	var self = MPRSimulador, m = self.msg;
	var e = document.createElement('div');
	e.id = 'mpr_esc';
	e.innerHTML =
		'<div id="mpr_esc_barra">' +
			'<span id="mpr_esc_titulo">' + m('sim_titulo', 'Probar en pantalla') + '</span>' +
			'<button type="button" id="mpr_esc_probar"></button>' +
			'<button type="button" id="mpr_esc_caja"></button>' +
			'<button type="button" id="mpr_esc_sonido"></button>' +
			'<button type="button" id="mpr_esc_cerrar" title="' + m('sim_cerrar', 'Cerrar') + '">✕</button>' +
		'</div>' +
		'<div id="mpr_esc_vista">' +
			'<div id="mpr_esc_distancia"></div><div id="mpr_esc_aviso"></div><div id="mpr_esc_estado"></div>' +
			'<div id="mpr_esc_camara">' +
				'<button type="button" data-cam="izq" title="' + m('sim_cam_izq', 'Girar la vista a la izquierda') + '">↺</button>' +
				'<button type="button" data-cam="der" title="' + m('sim_cam_der', 'Girar la vista a la derecha') + '">↻</button>' +
				'<button type="button" data-cam="mas" title="' + m('sim_cam_mas', 'Acercar') + '">+</button>' +
				'<button type="button" data-cam="menos" title="' + m('sim_cam_menos', 'Alejar') + '">−</button>' +
				'<button type="button" data-cam="inicio" title="' + m('sim_cam_inicio', 'Volver a la vista de siempre') + '">⌂</button>' +
			'</div>' +
		'</div>' +
		'<div id="mpr_esc_pie">' + m('sim_recuerda', '') + '</div>';
	document.body.appendChild(e);
	document.getElementById('mpr_esc_probar').addEventListener('click', function() {
		if (self.corrida) self.terminar('sim_detenido'); else self.probar();
	});
	document.getElementById('mpr_esc_caja').addEventListener('click', function() {
		self.cajaVisible = !self.cajaVisible;
		if (self.obj) self.obj.caja.visible = self.cajaVisible;
		self.actualizarBotones();
		self.despertar();
	});
	document.getElementById('mpr_esc_sonido').addEventListener('click', function() {
		self.silencio = !self.silencio;
		try { window.localStorage.mpr_sim_silencio = self.silencio ? '1' : ''; } catch (e) {}
		if (self.silencio) self.audio.silencio();
		self.actualizarBotones();
	});
	document.getElementById('mpr_esc_cerrar').addEventListener('click', function() { self.cerrar(); });
	Array.prototype.forEach.call(e.querySelectorAll('#mpr_esc_camara button'), function(b) {
		b.addEventListener('click', function() { self.mover(b.getAttribute('data-cam')); });
	});
};

// Botones de la cámara: girar, acercar o alejar, y volver a la vista de siempre (con una transición suave)
MPRSimulador.mover = function(accion) {
	var self = MPRSimulador, v = self.vista;
	if (accion == 'izq') v.giro -= Math.PI / 6;
	else if (accion == 'der') v.giro += Math.PI / 6;
	else if (accion == 'mas') v.zoom = Math.max(self.ZOOM_MIN, v.zoom / 1.2);
	else if (accion == 'menos') v.zoom = Math.min(self.ZOOM_MAX, v.zoom * 1.2);
	else if (accion == 'inicio') self.vista = { giro: self.VISTA.giro, altura: self.VISTA.altura, zoom: 1 };
	self.despertar();
};

MPRSimulador.actualizarBotones = function() {
	var self = MPRSimulador, m = self.msg;
	var p = document.getElementById('mpr_esc_probar');
	if (!p) return;
	p.textContent = self.corrida ? m('sim_detener', '■ Detener') : m('sim_probar', '▶ Probar');
	p.className = self.corrida ? 'detener' : '';
	document.getElementById('mpr_esc_caja').textContent = self.cajaVisible ? m('sim_caja_quitar', 'Quitar caja') : m('sim_caja_poner', 'Poner caja');
	var s = document.getElementById('mpr_esc_sonido');
	s.textContent = self.silencio ? '🔇' : '🔊';
	s.title = self.silencio ? m('sim_sonido_no', 'Sonido apagado') : m('sim_sonido_si', 'Sonido encendido');
};

MPRSimulador.estado = function(t) {
	var e = document.getElementById('mpr_esc_estado');
	if (e) e.textContent = t || '';
};

MPRSimulador.aviso = function(t, ms) {
	var a = document.getElementById('mpr_esc_aviso');
	if (!a) return;
	clearTimeout(MPRSimulador.tAviso);
	a.textContent = t || '';
	a.style.display = t ? 'block' : 'none';
	if (t && ms) MPRSimulador.tAviso = setTimeout(function() { a.style.display = 'none'; }, ms);
};

// ---------------------------------------------------------------- abrir y cerrar
MPRSimulador.abrir = function() {
	var self = MPRSimulador;
	if (self.abierto) return;
	self.crearUI();
	self.abierto = true;
	document.getElementById('mpr_esc').style.display = 'flex';
	$('#btn_simular').addClass('activo');
	self.actualizarBotones();
	self.aviso('');
	self.estado(self.msg('sim_cargando', 'Otto sube al escenario...'));
	// La mascota deja su esquina: su Otto 3D sube al escenario
	var caja = document.getElementById('mpr_masc');
	if (typeof MPRMascota != 'undefined') { MPRMascota.cancelarPaseo(true); MPRMascota.cerrarGlobo(); }
	self.mascotaVisible = !!(caja && caja.style.display != 'none');
	if (caja) caja.style.display = 'none';
	self.preparar3D(function(ok) {
		if (!self.abierto) return;
		self.con3d = ok && self.montarEscena();
		if (!self.con3d) self.aviso(self.msg('sim_sin3d', ''));
		self.estado(self.msg('sim_listo', 'Presiona ▶ Probar y Otto hará tu programa aquí.'));
	});
	window.addEventListener('resize', self.ajustarTamano);
	self.vigilarCambios();
};

MPRSimulador.cerrar = function() {
	var self = MPRSimulador;
	if (!self.abierto) return;
	if (self.corrida) self.terminar(null);
	self.audio.dormir();
	self.desmontarEscena();
	self.abierto = false;
	window.removeEventListener('resize', self.ajustarTamano);
	document.getElementById('mpr_esc').style.display = 'none';
	$('#btn_simular').removeClass('activo');
	var caja = document.getElementById('mpr_masc');
	if (caja && self.mascotaVisible) caja.style.display = 'block';
	if (typeof MPRMascota != 'undefined') {
		if (self.mascotaVisible) MPRMascota.acomodar();
		MPRMascota.planificar();
	}
};

// Asegura que Otto 3D esté funcionando (si la mascota está escondida, lo enciende solo para el escenario)
MPRSimulador.preparar3D = function(listo) {
	var self = MPRSimulador;
	self.inicieYo = false;
	if (window.MPROtto3D && MPROtto3D.vivo && MPROtto3D.renderer) return listo(true);
	if (document.getElementById('mpr_masc_img') || typeof MPRMascota == 'undefined') return listo(false);   // respaldo 2D
	var canvas = document.getElementById('mpr_masc_canvas');
	if (!canvas) return listo(false);
	function encender() {
		MPROtto3D.economia = !!MPRMascota.software;
		var ok = MPROtto3D.iniciar(canvas, MPRMascota.colores);
		self.inicieYo = ok;
		listo(ok);
	}
	if (typeof THREE != 'undefined' && window.OTTO3D) return encender();
	MPRMascota.nivel = MPRMascota.nivelModelo();
	MPRMascota.cargarScript('js/three.min.js', function() {
		MPRMascota.cargarScript(MPRMascota.ARCHIVOS[MPRMascota.nivel], encender, function() { listo(false); });
	}, function() { listo(false); });
};

// Muda el canvas de Otto al escenario y arma la mesa, la caja y la cámara
MPRSimulador.montarEscena = function() {
	var self = MPRSimulador, O = MPROtto3D;
	try {
		var canvas = O.renderer.domElement, vista = document.getElementById('mpr_esc_vista');
		self.lugarCanvas = { padre: canvas.parentNode, sig: canvas.nextSibling, estilo: canvas.getAttribute('style') || '' };
		vista.insertBefore(canvas, vista.firstChild);
		canvas.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;';
		self.camara = new THREE.PerspectiveCamera(self.VISTA.fov, 1, 20, 8000);
		if (!self.vista) self.vista = { giro: self.VISTA.giro, altura: self.VISTA.altura, zoom: 1 };
		self.vistaVis = { giro: self.vista.giro, altura: self.vista.altura, zoom: self.vista.zoom };
		self.mira = new THREE.Vector3(self.INICIO.x, 45, self.INICIO.z);
		self.armarMesa();
		self.medirSuelas();
		self.reiniciarPose();
		O.escenario = { pose: self.pose, camara: self.camara, animando: self.animando };
		canvas.addEventListener('mousedown', self.alPresionar);
		canvas.addEventListener('mousemove', self.alPasar);
		canvas.addEventListener('wheel', self.alRueda);
		self.ajustarTamano();
		self.despertar();
		return true;
	} catch (e) {
		console.log('[Simulador] no pude armar el escenario', e);
		return false;
	}
};

MPRSimulador.desmontarEscena = function() {
	var self = MPRSimulador, O = window.MPROtto3D;
	if (!O || !self.obj) return;
	O.escenario = null;
	O.escena.remove(self.obj.grupo);
	self.obj.grupo.traverse(function(o) {
		if (o.geometry) o.geometry.dispose();
		if (o.material) o.material.dispose();
	});
	self.obj = null;
	// La mascota vuelve a su pose y a su lugar (sus animaciones no tocan estas posiciones)
	if (O.raiz) {
		O.raiz.position.set(0, 0, 0);
		O.raiz.rotation.set(0, 0, 0);
		O.pies[0].position.set(-23, 8, 0);
		O.pies[1].position.set(23, 8, 0);
	}
	var canvas = O.renderer && O.renderer.domElement;
	if (canvas) {
		canvas.removeEventListener('mousedown', self.alPresionar);
		canvas.removeEventListener('mousemove', self.alPasar);
		canvas.removeEventListener('wheel', self.alRueda);
		if (self.lugarCanvas && self.lugarCanvas.padre) {
			self.lugarCanvas.padre.insertBefore(canvas, self.lugarCanvas.sig);
			canvas.setAttribute('style', self.lugarCanvas.estilo);
		}
		O.renderer.setSize(MPRMascota.W, MPRMascota.H, false);
	}
	if (self.inicieYo) { O.detener(); self.inicieYo = false; }
	else O.ultimo = 0;
};

MPRSimulador.ajustarTamano = function() {
	var self = MPRSimulador, O = window.MPROtto3D, vista = document.getElementById('mpr_esc_vista');
	if (!self.obj || !O || !O.renderer || !vista) return;
	var w = Math.max(100, vista.clientWidth), h = Math.max(100, vista.clientHeight);
	O.renderer.setSize(w, h, false);
	self.camara.aspect = w / h;
	self.camara.updateProjectionMatrix();
	self.despertar();
};

// ---------------------------------------------------------------- escena
MPRSimulador.armarMesa = function() {
	var self = MPRSimulador, M = self.MESA, g = new THREE.Group(), obj = { grupo: g };
	// Mesa de madera con su canto, un poco más grande que el tablero (queda un marco)
	var mesa = new THREE.Mesh(new THREE.BoxGeometry(M.ancho + 40, M.grosor, M.fondo + 40), new THREE.MeshLambertMaterial({ color: 0x9c6a3a }));
	mesa.position.y = -M.grosor / 2;
	g.add(mesa);
	// Tablero de cuadros de 10 cm en dos tonos (una sola geometría con colores por vértice: liviano)
	var Q = self.CUADRO, pos = [], col = [], cA = new THREE.Color(0xe3c497), cB = new THREE.Color(0xcfa56d), i, j;
	for (i = 0; i < M.ancho / Q; i++) for (j = 0; j < M.fondo / Q; j++) {
		var x0 = -M.ancho / 2 + i * Q, z0 = -M.fondo / 2 + j * Q, x1 = x0 + Q, z1 = z0 + Q, c = (i + j) % 2 ? cB : cA;
		pos.push(x0, 0.5, z0, x0, 0.5, z1, x1, 0.5, z1, x0, 0.5, z0, x1, 0.5, z1, x1, 0.5, z0);
		for (var k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
	}
	var gt = new THREE.BufferGeometry();
	gt.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	gt.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
	gt.computeVertexNormals();
	g.add(new THREE.Mesh(gt, new THREE.MeshLambertMaterial({ vertexColors: true })));
	// Casilla donde va a caer la caja mientras se arrastra
	obj.marca = new THREE.Mesh(new THREE.PlaneGeometry(Q - 6, Q - 6), new THREE.MeshBasicMaterial({ color: 0xFF5700, transparent: true, opacity: 0.35, depthWrite: false }));
	obj.marca.rotation.x = -Math.PI / 2;
	obj.marca.position.y = 1.2;
	obj.marca.visible = false;
	g.add(obj.marca);
	// Caja (obstáculo para el sensor)
	var L = self.CAJA.lado;
	obj.caja = new THREE.Mesh(new THREE.BoxGeometry(L, L, L), new THREE.MeshLambertMaterial({ color: 0xc8955a }));
	obj.caja.position.set(self.CAJA.x, L / 2, self.CAJA.z);
	obj.caja.visible = self.cajaVisible;
	var cinta = new THREE.Mesh(new THREE.BoxGeometry(L + 1, 14, L + 1), new THREE.MeshLambertMaterial({ color: 0xa0703f }));
	obj.caja.add(cinta);
	g.add(obj.caja);
	// Sombra suave bajo Otto
	obj.sombra = new THREE.Mesh(new THREE.CircleGeometry(48, 28), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.16, depthWrite: false }));
	obj.sombra.rotation.x = -Math.PI / 2;
	obj.sombra.position.y = 1;
	g.add(obj.sombra);
	// Rayo del sensor (se ve un momento cada vez que el programa mide la distancia)
	var gr = new THREE.BufferGeometry();
	gr.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
	obj.rayo = new THREE.Line(gr, new THREE.LineBasicMaterial({ color: 0xff3355, transparent: true, opacity: 0 }));
	g.add(obj.rayo);
	g.traverse(function(o) { o.frustumCulled = false; });
	MPROtto3D.escena.add(g);
	self.obj = obj;
};

// Extremos de cada suela (mm) en el marco de su tobillo, sacados del modelo, para saber qué pie queda apoyado
MPRSimulador.medirSuelas = function() {
	var self = MPRSimulador, O = MPROtto3D;
	self.suelas = [0, 1].map(function(i) {
		var pie = O.pies[i].children[0], bb;
		pie.geometry.computeBoundingBox();
		bb = pie.geometry.boundingBox;
		return { min: bb.min.x + pie.position.x, max: bb.max.x + pie.position.x, y: bb.min.y + pie.position.y };
	});
	self.modeloSuelas = O.raiz;
};

MPRSimulador.reiniciarPose = function() {
	var self = MPRSimulador;
	self.servo = [90, 90, 90, 90];
	self.tramos = [];
	self.cuerpo = { x: self.INICIO.x, z: self.INICIO.z, rumbo: self.INICIO.rumbo };
	self.choco = false;
	self.betaVis = 0;
};

// Cómo queda apoyado Otto: con los ángulos de los servos fijos, el robot es un cuerpo rígido. Mirado de frente, descansa
// sobre dos puntos de sus suelas (los dos cantos de un pie plano, o un canto de cada pie) que dejan el centro de masa
// entre ellos y ningún otro punto bajo el suelo. Si hay varias, se queda con la más parecida a la postura que tenía
// (previa): un movimiento simétrico sigue simétrico y Otto solo se vuelca hacia un lado cuando ya no puede sostenerse.
// Devuelve la inclinación del tronco (beta, radianes; + hacia la derecha de Otto). rI/rD: inclinación de cada pie
// respecto de su pierna.
MPRSimulador.COM = { x: 0, y: 55 };   // centro de masa aproximado (mm) respecto del pivote de los tobillos
MPRSimulador.esquinas = function(rI, rD) {
	var S = MPRSimulador.suelas, P = [];
	[[0, -23, rD], [1, 23, rI]].forEach(function(p) {
		var su = S[p[0]], c = Math.cos(p[2]), s = Math.sin(p[2]);
		[su.min, su.max].forEach(function(u) { P.push({ x: p[1] + u * c - su.y * s, y: u * s + su.y * c }); });
	});
	return P;
};

// Altura a la que hay que subir a Otto para que su punto más bajo toque el suelo con el tronco inclinado beta
MPRSimulador.alturaPara = function(beta, rI, rD) {
	var cb = Math.cos(beta), sb = Math.sin(beta);
	return -(Math.min.apply(null, MPRSimulador.esquinas(rI, rD).map(function(p) { return p.x * sb + p.y * cb; })) + 8);
};

MPRSimulador.apoyo = function(rI, rD, previa) {
	var C = MPRSimulador.COM, P = MPRSimulador.esquinas(rI, rD), mejor = null, i, j, k;
	previa = previa || 0;
	function girar(p, cb, sb) { return { x: p.x * cb - p.y * sb, y: p.x * sb + p.y * cb }; }
	for (i = 0; i < 4; i++) for (j = i + 1; j < 4; j++) {
		var dx = P[i].x - P[j].x;
		if (Math.abs(dx) < 1e-6) continue;
		var beta = Math.atan(-(P[i].y - P[j].y) / dx), cb = Math.cos(beta), sb = Math.sin(beta);   // deja a-b a la misma altura
		var a = girar(P[i], cb, sb), b = girar(P[j], cb, sb), base = Math.min(a.y, b.y), ok = true;
		for (k = 0; k < 4 && ok; k++) if (girar(P[k], cb, sb).y < base - 0.3) ok = false;
		if (!ok) continue;
		var cm = girar(C, cb, sb);
		if (cm.x < Math.min(a.x, b.x) - 0.5 || cm.x > Math.max(a.x, b.x) + 0.5) continue;   // se caería hacia un lado
		if (!mejor || Math.abs(beta - previa) < Math.abs(mejor.beta - previa)) mejor = { beta: beta };
	}
	return mejor ? mejor.beta : -(rI + rD) / 2;   // sin apoyo estable (no debería pasar): sobre los cantos
};

// Cada cuadro (lo llama MPROtto3D.bucle en modo escenario)
MPRSimulador.pose = function(ahora) {
	var self = MPRSimulador, O = MPROtto3D, obj = self.obj;
	if (!obj || !O.raiz) return;
	if (self.modeloSuelas !== O.raiz) self.medirSuelas();   // cambió el modelo (equipo lento): vuelve a medir los pies
	var dt = self.tPrev ? Math.min(0.1, (ahora - self.tPrev) / 1000) : 0;
	self.tPrev = ahora;
	self.avanzarCuerpo(ahora);

	// Servos -> articulaciones (90 = posición inicial). Los dos tobillos están montados igual: el mismo cambio en los dos
	// inclina los pies hacia el mismo lado (Otto se balancea); cambios opuestos los inclinan en espejo (sube en los cantos,
	// como en "updown"). Signo elegido para que "Inclinar a la izquierda" (bend, dir 1) incline a Otto hacia su izquierda.
	var s = self.servo, R = Math.PI / 180;
	var cadI = (s[0] - 90) * R, cadD = (s[1] - 90) * R, rI = -(s[2] - 90) * R, rD = -(s[3] - 90) * R;
	var meta = self.apoyo(rI, rD, self.betaVis), paso = 6 * (dt || 0.033);   // se vuelca rápido (~340 °/s), no de golpe
	self.betaVis += Math.max(-paso, Math.min(paso, meta - self.betaVis));
	var ap = { beta: self.betaVis, alto: self.alturaPara(self.betaVis, rI, rD) }, cb = Math.cos(ap.beta), sb = Math.sin(ap.beta);
	O.inclinacion.rotation.set(0, 0, ap.beta);
	O.piernas[1].rotation.y = cadI;      // índice 1: x +23, la izquierda del robot (mira hacia +z)
	O.piernas[0].rotation.y = cadD;
	O.pies[1].position.set(23 * cb, 8 + 23 * sb, 0);
	O.pies[0].position.set(-23 * cb, 8 - 23 * sb, 0);
	O.pies[1].rotation.set(0, cadI, ap.beta + rI);
	O.pies[0].rotation.set(0, cadD, ap.beta + rD);
	O.raiz.position.set(self.cuerpo.x, ap.alto, self.cuerpo.z);
	O.raiz.rotation.set(0, self.cuerpo.rumbo, 0);
	for (var i = 0; i < 2; i++) O.ojos[i].scale.set(1, 1, 1);
	obj.sombra.position.set(self.cuerpo.x, 1, self.cuerpo.z);

	// Cámara: sigue a Otto (y mira un poco hacia la caja si está cerca)
	var objetivo = new THREE.Vector3(self.cuerpo.x, 45, self.cuerpo.z);
	// Si la caja está cerca, la cámara mira entre los dos y se aleja lo justo para que se vean ambos
	var lejos = 1;
	if (self.cajaVisible) {
		var dx = obj.caja.position.x - objetivo.x, dz = obj.caja.position.z - objetivo.z, sep = Math.sqrt(dx * dx + dz * dz);
		if (sep < 800) { objetivo.x += dx * 0.45; objetivo.z += dz * 0.45; lejos = Math.max(1, Math.min(1.7, sep / 360)); }
	}
	var k = dt ? Math.min(1, dt * 2.5) : 1;
	self.mira.lerp(objetivo, k);
	self.lejos = (self.lejos || lejos) + (lejos - (self.lejos || lejos)) * k;
	var v = self.vista, vv = self.vistaVis, kv = dt ? Math.min(1, dt * 6) : 1;
	vv.giro += (v.giro - vv.giro) * kv; vv.altura += (v.altura - vv.altura) * kv; vv.zoom += (v.zoom - vv.zoom) * kv;
	var dist = self.VISTA.distancia * vv.zoom * self.lejos, ch = Math.cos(vv.altura);
	self.camara.position.set(self.mira.x + dist * ch * Math.sin(vv.giro), self.mira.y + dist * Math.sin(vv.altura), self.mira.z + dist * ch * Math.cos(vv.giro));
	self.camara.lookAt(self.mira);
	self.camaraQuieta = self.mira.distanceTo(objetivo) < 1 && Math.abs(self.lejos - lejos) < 0.01 &&
		Math.abs(v.giro - vv.giro) < 0.002 && Math.abs(v.altura - vv.altura) < 0.002 && Math.abs(v.zoom - vv.zoom) < 0.002;

	// Rayo del sensor: se apaga solo
	if (obj.rayo.material.opacity > 0) obj.rayo.material.opacity = Math.max(0, obj.rayo.material.opacity - dt * 2.5);
	// Distancia en pantalla (5 veces por segundo)
	if (!self.tDist || ahora - self.tDist > 200) { self.tDist = ahora; self.mostrarDistancia(); }
};

// Hay que dibujar a 30 cuadros/s mientras algo se mueve; si no, basta el ritmo de reposo
MPRSimulador.animando = function() {
	var self = MPRSimulador;
	return !!(self.corrida || self.arrastre || self.tramos.length || !self.camaraQuieta || performance.now() < self.hastaMs);
};

MPRSimulador.despertar = function() {
	MPRSimulador.hastaMs = performance.now() + 1500;
	if (window.MPROtto3D) MPROtto3D.ultimo = 0;
};

// ---------------------------------------------------------------- cuerpo sobre la mesa
// hw.movimiento: la librería avisa al empezar cada movimiento que desplaza el cuerpo
MPRSimulador.desplazar = function(info) {
	var self = MPRSimulador, pasos = Math.abs(info.pasos || 1), dur = Math.max(1, pasos * (info.T || 1000)), d = { adelante: 0, lateral: 0, giro: 0 };
	var dir = info.dir < 0 ? -1 : 1;
	if (info.tipo == 'caminar') d.adelante = self.MM_PASO * pasos * dir;
	else if (info.tipo == 'girar') d.giro = self.GRADOS_GIRO * pasos * dir * Math.PI / 180;
	else if (info.tipo == 'moonwalker' || info.tipo == 'crusaito') d.lateral = self.MM_LATERAL * pasos * dir;
	else return;
	self.tramos.push({ t0: performance.now(), dur: dur, d: d, hecho: 0 });
};

MPRSimulador.avanzarCuerpo = function(ahora) {
	var self = MPRSimulador, c = self.cuerpo;
	if (!self.tramos.length) return;
	self.tramos = self.tramos.filter(function(t) {
		var k = Math.max(0, Math.min(1, (ahora - t.t0) / t.dur)), dk = k - t.hecho;
		t.hecho = k;
		if (dk > 0) {
			c.rumbo += t.d.giro * dk;
			var fx = Math.sin(c.rumbo), fz = Math.cos(c.rumbo);   // adelante
			var lx = Math.cos(c.rumbo), lz = -Math.sin(c.rumbo);  // izquierda del robot
			var nx = c.x + (fx * t.d.adelante + lx * t.d.lateral) * dk;
			var nz = c.z + (fz * t.d.adelante + lz * t.d.lateral) * dk;
			if (self.chocaCaja(nx, nz)) {
				if (!self.choco) { self.choco = true; self.aviso(self.msg('sim_choque', '¡Otto chocó con la caja!'), 6000); }
			} else { c.x = nx; c.z = nz; self.choco = false; }
			self.revisarBorde();
		}
		return k < 1;
	});
};

MPRSimulador.chocaCaja = function(x, z) {
	var self = MPRSimulador;
	if (!self.cajaVisible || !self.obj) return false;
	var p = self.obj.caja.position, m = self.CAJA.lado / 2 + self.RADIO * 0.8;
	return Math.abs(x - p.x) < m && Math.abs(z - p.z) < m;
};

MPRSimulador.revisarBorde = function() {
	var self = MPRSimulador, c = self.cuerpo, M = self.MESA, m = self.RADIO * 0.5;
	var lx = M.ancho / 2 - m, lz = M.fondo / 2 - m;
	if (Math.abs(c.x) <= lx && Math.abs(c.z) <= lz) return;
	c.x = Math.max(-lx, Math.min(lx, c.x));
	c.z = Math.max(-lz, Math.min(lz, c.z));
	self.tramos = [];
	if (self.corrida) self.terminar('sim_borde');
};

// Sensor ultrasónico: tres rayos (el sensor real "ve" en un cono), el más corto gana
MPRSimulador.medir = function() {
	var self = MPRSimulador, c = self.cuerpo, mejor = Infinity, origen = { x: c.x + Math.sin(c.rumbo) * 30, z: c.z + Math.cos(c.rumbo) * 30 };
	if (self.cajaVisible && self.obj) {
		[-0.14, 0, 0.14].forEach(function(a) {
			var d = self.rayoCaja(origen.x, origen.z, Math.sin(c.rumbo + a), Math.cos(c.rumbo + a));
			if (d < mejor) mejor = d;
		});
	}
	return { cm: isFinite(mejor) ? Math.min(self.SIN_ECO_CM, Math.round(mejor / 10)) : self.SIN_ECO_CM, mm: mejor, origen: origen };
};

MPRSimulador.rayoCaja = function(ox, oz, dx, dz) {
	var p = MPRSimulador.obj.caja.position, h = MPRSimulador.CAJA.lado / 2, t0 = -Infinity, t1 = Infinity;
	var ejes = [[ox, dx, p.x - h, p.x + h], [oz, dz, p.z - h, p.z + h]];
	for (var i = 0; i < 2; i++) {
		var o = ejes[i][0], d = ejes[i][1], a = ejes[i][2], b = ejes[i][3];
		if (Math.abs(d) < 1e-9) { if (o < a || o > b) return Infinity; continue; }
		var ta = (a - o) / d, tb = (b - o) / d;
		t0 = Math.max(t0, Math.min(ta, tb));
		t1 = Math.min(t1, Math.max(ta, tb));
	}
	if (t1 < Math.max(t0, 0)) return Infinity;
	return Math.max(0, t0);
};

MPRSimulador.mostrarDistancia = function() {
	var self = MPRSimulador, e = document.getElementById('mpr_esc_distancia');
	if (!e) return;
	var m = self.medir(), t = m.cm >= self.SIN_ECO_CM ? self.msg('sim_sin_caja', '👀 Distancia: no hay nada adelante') : self.msg('sim_distancia', '👀 Distancia: {cm} cm').replace('{cm}', m.cm);
	if (e.textContent != t) e.textContent = t;
};

MPRSimulador.verRayo = function(m) {
	var obj = MPRSimulador.obj;
	if (!obj) return;
	var c = MPRSimulador.cuerpo, largo = isFinite(m.mm) ? Math.min(m.mm, 4000) : 600;
	var a = obj.rayo.geometry.attributes.position;
	a.setXYZ(0, m.origen.x, 110, m.origen.z);
	a.setXYZ(1, m.origen.x + Math.sin(c.rumbo) * largo, 110, m.origen.z + Math.cos(c.rumbo) * largo);
	a.needsUpdate = true;
	obj.rayo.material.opacity = 0.9;
	MPRSimulador.despertar();
};

// ---------------------------------------------------------------- arrastrar la caja y acercar la cámara
MPRSimulador.puntero = function(e) {
	var r = e.target.getBoundingClientRect();
	return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
};

MPRSimulador.tocaCaja = function(e) {
	var self = MPRSimulador;
	if (!self.obj || !self.cajaVisible) return null;
	var rc = new THREE.Raycaster();
	rc.setFromCamera(self.puntero(e), self.camara);
	return rc.intersectObject(self.obj.caja, true).length ? rc : null;
};

MPRSimulador.alPasar = function(e) {
	var self = MPRSimulador;
	if (self.arrastre) return;
	e.target.style.cursor = self.tocaCaja(e) ? 'grab' : 'move';
};

// Centro del cuadro más cercano (el tablero tiene un número par de cuadros a lo ancho e impar a lo fondo)
MPRSimulador.alCuadro = function(v, largo) {
	var Q = MPRSimulador.CUADRO, borde = -largo / 2;
	return borde + (Math.floor((v - borde) / Q) + 0.5) * Q;
};

// Arrastrar el suelo (no la caja) gira la vista: de lado y hacia arriba o abajo
MPRSimulador.girarArrastrando = function(e) {
	var self = MPRSimulador, canvas = e.target, x0 = e.clientX, y0 = e.clientY, g0 = self.vista.giro, a0 = self.vista.altura;
	e.preventDefault();
	self.arrastre = true;
	canvas.style.cursor = 'grabbing';
	function mover(ev) {
		self.vista.giro = g0 - (ev.clientX - x0) * 0.008;
		self.vista.altura = Math.max(self.ALTURA_MIN, Math.min(self.ALTURA_MAX, a0 + (ev.clientY - y0) * 0.006));
		self.vistaVis.giro = self.vista.giro; self.vistaVis.altura = self.vista.altura;
		self.despertar();
	}
	function soltar() {
		document.removeEventListener('mousemove', mover, true);
		document.removeEventListener('mouseup', soltar, true);
		self.arrastre = false;
		canvas.style.cursor = '';
		self.despertar();
	}
	document.addEventListener('mousemove', mover, true);
	document.addEventListener('mouseup', soltar, true);
};

MPRSimulador.alPresionar = function(e) {
	var self = MPRSimulador;
	if (e.button !== 0) return;
	if (!self.tocaCaja(e)) { self.girarArrastrando(e); return; }
	e.preventDefault();
	var canvas = e.target, plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), -self.CAJA.lado / 2), punto = new THREE.Vector3();
	self.arrastre = true;
	canvas.style.cursor = 'grabbing';
	function mover(ev) {
		var rc = new THREE.Raycaster();
		rc.setFromCamera(self.puntero({ target: canvas, clientX: ev.clientX, clientY: ev.clientY }), self.camara);
		if (!rc.ray.intersectPlane(plano, punto)) return;
		var M = self.MESA, h = self.CAJA.lado / 2;
		var x = self.alCuadro(Math.max(-M.ancho / 2 + 1, Math.min(M.ancho / 2 - 1, punto.x)), M.ancho);
		var z = self.alCuadro(Math.max(-M.fondo / 2 + 1, Math.min(M.fondo / 2 - 1, punto.z)), M.fondo);
		var p = self.obj.caja.position, c = self.cuerpo, m = h + self.RADIO;
		if (Math.abs(x - c.x) < m && Math.abs(z - c.z) < m) return;   // no encima de Otto
		p.x = x; p.z = z;
		self.obj.marca.position.x = x; self.obj.marca.position.z = z; self.obj.marca.visible = true;
		self.mostrarDistancia();
		self.despertar();
	}
	function soltar() {
		document.removeEventListener('mousemove', mover, true);
		document.removeEventListener('mouseup', soltar, true);
		self.arrastre = false;
		self.obj.marca.visible = false;
		canvas.style.cursor = '';
		self.despertar();
	}
	document.addEventListener('mousemove', mover, true);
	document.addEventListener('mouseup', soltar, true);
};

MPRSimulador.alRueda = function(e) {
	var self = MPRSimulador;
	e.preventDefault();
	self.vista.zoom = Math.max(self.ZOOM_MIN, Math.min(self.ZOOM_MAX, self.vista.zoom * (e.deltaY > 0 ? 1.1 : 1 / 1.1)));
	self.despertar();
};

// ---------------------------------------------------------------- sonido (zumbador)
MPRSimulador.audio = {
	ctx: null, osc: null, gan: null,
	despertar: function() {
		var C = window.AudioContext || window.webkitAudioContext;
		if (!this.ctx && C) {
			try {
				this.ctx = new C();
				this.gan = this.ctx.createGain();
				this.gan.gain.value = 0;
				this.gan.connect(this.ctx.destination);
				this.osc = this.ctx.createOscillator();
				this.osc.type = 'square';   // el zumbador suena "cuadrado"
				this.osc.connect(this.gan);
				this.osc.start();
			} catch (e) { this.ctx = null; }
		}
		if (this.ctx && this.ctx.state == 'suspended') this.ctx.resume();
	},
	tono: function(hz, ms) {
		if (!this.ctx || MPRSimulador.silencio || !(hz > 20)) return;
		var t = this.ctx.currentTime;
		this.osc.frequency.setValueAtTime(Math.min(hz, 12000), t);
		this.gan.gain.cancelScheduledValues(t);
		this.gan.gain.setValueAtTime(MPRSimulador.VOLUMEN, t);
		if (ms > 0) this.gan.gain.setValueAtTime(0, t + ms / 1000);
	},
	silencio: function() {
		if (!this.ctx) return;
		var t = this.ctx.currentTime;
		this.gan.gain.cancelScheduledValues(t);
		this.gan.gain.setValueAtTime(0, t);
	},
	dormir: function() {   // sin prueba en curso no gasta CPU en audio
		this.silencio();
		if (this.ctx && this.ctx.state == 'running') this.ctx.suspend();
	}
};

// RTTTL (como PlayRtttl): Nombre:d=duración,o=octava,b=pulsos:notas
MPRSimulador.tocarRtttl = async function(texto) {
	var self = MPRSimulador, p = String(texto || '').replace(/\s+/g, '').split(':');
	if (p.length < 3) return;
	var def = { d: 4, o: 6, b: 63 };
	p[1].split(',').forEach(function(kv) {
		var m = /^([a-z])=(\d+)$/i.exec(kv);
		if (m) def[m[1].toLowerCase()] = +m[2];
	});
	var redonda = 4 * 60000 / (def.b || 63), notas = p.slice(2).join(':').split(','), IDX = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
	for (var i = 0; i < notas.length; i++) {
		var m = /^(\d*)([a-gp])(#?)(\.?)(\d?)(\.?)$/i.exec(notas[i]);
		if (!m) continue;
		var ms = redonda / (+(m[1] || def.d) || 4);
		if (m[4] || m[6]) ms *= 1.5;
		var letra = m[2].toLowerCase();
		if (letra != 'p') {
			var hz = 440 * Math.pow(2, (IDX[letra] + (m[3] ? 1 : 0) - 9) / 12 + (+(m[5] || def.o) - 4));
			self.audio.tono(hz, ms * 0.9);
		}
		await self.esperar(ms);
	}
	self.audio.silencio();
};

// Melodías de la librería PlayRtttl (las "extranjeras" del bloque Tocar canción): se leen de su archivo .h
MPRSimulador.melodiasLibreria = function() {
	var self = MPRSimulador;
	if (self._melodias) return self._melodias;
	var res = {};
	try {
		var fs = require('fs'), path = require('path');
		var base = (typeof MPRSubida != 'undefined' && MPRSubida.o) ? MPRSubida.o.basepath : './compilation/arduino';
		var h = fs.readFileSync(path.join(base, 'userlibs', 'libraries', 'PlayRtttl-master', 'src', 'PlayRtttl.h'), 'utf8');
		var re = /static\s+const\s+char\s+(\w+)\s*\[\s*\]\s*PROGMEM\s*=\s*"([^"]*)"/g, m;
		while ((m = re.exec(h))) res[m[1]] = m[2];
	} catch (e) {}
	return (self._melodias = res);
};

// ---------------------------------------------------------------- tiempo (se corta al detener)
MPRSimulador.esperar = function(ms) {
	var c = MPRSimulador.corrida;
	if (!c || c.detenida) return Promise.reject(MPRSimulador.DETENIDO);
	return new Promise(function(ok, mal) {
		var p = { mal: mal };
		p.t = setTimeout(function() { c.pendientes.splice(c.pendientes.indexOf(p), 1); ok(); }, Math.max(0, ms || 0));
		c.pendientes.push(p);
	});
};

MPRSimulador.cuadro = function() {
	var c = MPRSimulador.corrida;
	if (!c || c.detenida) return Promise.reject(MPRSimulador.DETENIDO);
	return new Promise(function(ok, mal) {
		var p = { mal: mal };
		p.f = requestAnimationFrame(function() { c.pendientes.splice(c.pendientes.indexOf(p), 1); ok(); });
		c.pendientes.push(p);
	});
};

MPRSimulador.hw = {
	escribir: function(i, g) { if (i >= 0 && i < 4 && isFinite(g)) MPRSimulador.servo[i] = Math.max(0, Math.min(180, g)); },
	ahora: function() { return performance.now(); },
	esperar: function(ms) { return MPRSimulador.esperar(ms); },
	cuadro: function() { return MPRSimulador.cuadro(); },
	tono: function(hz, ms) { MPRSimulador.audio.tono(hz, ms); },
	silencio: function() { MPRSimulador.audio.silencio(); },
	movimiento: function(info) { MPRSimulador.desplazar(info || {}); }
};

// ---------------------------------------------------------------- ejecutar el programa
MPRSimulador.raiz = function() {
	var tops = BlocklyDuino.workspace.getTopBlocks(true);
	for (var i = 0; i < tops.length; i++) if (tops[i].type == 'base_setup_loop' && !tops[i].disabled) return { conf: tops[i], bucle: tops[i] };
	var s = null, l = null;
	tops.forEach(function(b) { if (b.type == 'base_setup') s = b; if (b.type == 'base_loop') l = b; });
	return (s || l) ? { conf: s, bucle: l } : null;
};

MPRSimulador.probar = function() {
	var self = MPRSimulador;
	if (self.corrida || typeof MPROttoLib == 'undefined') return;
	var r = self.raiz();
	if (!r) { self.aviso(self.msg('sim_sin_estructura', ''), 8000); return; }
	self.aviso('');
	self.audio.despertar();
	self.reiniciarPose();
	var c = self.corrida = { id: ++self.n, detenida: false, pendientes: [], vars: {}, inicio: performance.now(), pasos: 0, avisados: {}, temporizadores: {}, profundidad: 0 };
	c.funciones = {};
	BlocklyDuino.workspace.getTopBlocks(false).forEach(function(b) {
		if ((b.type == 'procedures_defnoreturn' || b.type == 'procedures_defreturn') && !b.disabled) c.funciones[b.getFieldValue('NAME')] = b;
	});
	self.otto = MPROttoLib.crear(self.hw);
	self.actualizarBotones();
	self.despertar();
	(async function() {
		try {
			self.estado(self.msg('sim_config', 'Configuración: lo hago una vez'));
			if (r.conf) await self.lista(r.conf.getInputTargetBlock('DO'));
			var cuerpo = r.bucle ? r.bucle.getInputTargetBlock('LOOP') : null;
			if (!cuerpo) { self.terminar('sim_fin'); return; }
			for (var n = 1; ; n++) {
				self.estado(self.msg('sim_bucle', 'Bucle: vuelta {n}').replace('{n}', n));
				await self.lista(cuerpo);
				await self.cuadro();   // al menos un cuadro por vuelta: un bucle vacío no traba la ventana
				if (performance.now() - c.inicio > self.MAX_MS) { self.terminar('sim_tiempo'); return; }
			}
		} catch (e) {
			if (e === self.DETENIDO || (c.detenida)) return;
			if (e && e.mprFin) { self.terminar(e.mprFin); return; }
			console.log('[Simulador]', e);
			self.terminar('sim_error');
		}
	})();
};

// Termina la prueba (motivo: clave del mensaje, o null para no mostrar nada)
MPRSimulador.terminar = function(motivo) {
	var self = MPRSimulador, c = self.corrida;
	if (!c) return;
	c.detenida = true;
	c.pendientes.forEach(function(p) { clearTimeout(p.t); if (p.f) cancelAnimationFrame(p.f); p.mal(self.DETENIDO); });
	c.pendientes = [];
	self.corrida = null;
	self.tramos = [];
	self.audio.silencio();
	try { BlocklyDuino.workspace.highlightBlock(null); } catch (e) {}
	if (motivo) self.estado(self.msg(motivo, ''));
	if (motivo == 'sim_borde') self.aviso(self.msg('sim_borde', ''), 12000);
	self.actualizarBotones();
	self.despertar();
	setTimeout(function() { if (!self.corrida) self.audio.dormir(); }, 400);
};

// Si el niño cambia el programa mientras corre, la prueba se detiene (los bloques ya no son los mismos)
MPRSimulador.vigilarCambios = function() {
	var self = MPRSimulador, ws = window.BlocklyDuino && BlocklyDuino.workspace;
	if (self.vigilando || !ws) return;
	self.vigilando = true;
	ws.addChangeListener(function(e) {
		if (!self.corrida || !e || e.type == Blockly.Events.UI) return;
		self.terminar('sim_cambio');
	});
};

MPRSimulador.resaltar = function(b) {
	try { BlocklyDuino.workspace.highlightBlock(b.id); } catch (e) {}
};

MPRSimulador.noSimulado = function(b) {
	var self = MPRSimulador, c = self.corrida;
	if (!c || c.avisados[b.type]) return;
	c.avisados[b.type] = true;
	var texto = '';
	try { texto = b.toString().replace(/\s+/g, ' ').trim().slice(0, 40); } catch (e) {}
	self.aviso(self.msg('sim_no_simulado', '').replace('{b}', texto || b.type), 7000);
};

MPRSimulador.FIN = function(motivo) { return { mprFin: motivo }; };
MPRSimulador.ROMPER = { romper: true };
MPRSimulador.SEGUIR = { seguir: true };

MPRSimulador.lista = async function(b) {
	while (b) {
		await MPRSimulador.sentencia(b);
		b = b.getNextBlock();
	}
};

MPRSimulador.sentencia = async function(b) {
	var self = MPRSimulador, c = self.corrida;
	if (!c || c.detenida) throw self.DETENIDO;
	if (b.disabled) return;
	self.resaltar(b);
	var f = self.SENTENCIAS[b.type];
	if (f) await f(b);
	else if (!self.SIN_EFECTO[b.type]) self.noSimulado(b);
	if (++c.pasos % 40 == 0) await self.cuadro();
};

MPRSimulador.valor = async function(b, def) {
	var self = MPRSimulador;
	if (!b) return def;
	var f = self.VALORES[b.type];
	if (!f) { self.noSimulado(b); return def; }
	return await f(b);
};

MPRSimulador.entrada = function(b, nombre, def) {
	return MPRSimulador.valor(b.getInputTargetBlock(nombre), def);
};

MPRSimulador.numero = async function(b, nombre, def) {
	var v = Number(await MPRSimulador.entrada(b, nombre, def));
	return isFinite(v) ? v : (def || 0);
};

MPRSimulador.campo = function(b, nombre) {
	var v = b.getFieldValue(nombre);
	return v == null ? '' : String(v).trim();
};

// Bloques que no hacen nada en pantalla (configuraciones), sin aviso
MPRSimulador.SIN_EFECTO = {
	otto_calibration: 1, ultrasonic_sensor: 1, buzzer_init: 1, serial_init: 1, base_define: 0,
	procedures_defnoreturn: 1, procedures_defreturn: 1
};

MPRSimulador.repetir = async function(cuerpo, condicion) {
	var self = MPRSimulador, c = self.corrida;
	while (await condicion()) {
		try { await self.lista(cuerpo); }
		catch (e) {
			if (e === self.ROMPER) break;
			if (e !== self.SEGUIR) throw e;
		}
		if (++c.pasos % 40 == 0) await self.cuadro();   // cede la ventana aunque el cuerpo esté vacío
	}
};

MPRSimulador.llamar = async function(b, conValor) {
	var self = MPRSimulador, c = self.corrida, def = c.funciones[b.getFieldValue('NAME')];
	if (!def) return 0;
	if (++c.profundidad > 60) throw self.FIN('sim_error');
	var args = def.arguments_ || [], antes = {}, i;
	for (i = 0; i < args.length; i++) {
		var v = await self.entrada(b, 'ARG' + i, 0);
		antes[args[i]] = c.vars[args[i]];
		c.vars[args[i]] = v;
	}
	var resultado = 0;
	try {
		await self.lista(def.getInputTargetBlock('STACK'));
		if (conValor) resultado = await self.entrada(def, 'RETURN', 0);
	} catch (e) {
		if (!(e && e.retorno)) throw e;
		resultado = e.valor;
	} finally {
		for (i = 0; i < args.length; i++) c.vars[args[i]] = antes[args[i]];
		c.profundidad--;
	}
	return resultado;
};

MPRSimulador.SENTENCIAS = {
	otto_configuration: async function() { await MPRSimulador.otto.home(); },
	otto_home: async function() { await MPRSimulador.otto.home(); },
	otto_move: async function(b) {
		var o = MPRSimulador.otto, T = +MPRSimulador.campo(b, 'otto_move_speed') || 2000;
		switch (MPRSimulador.campo(b, 'otto_move_sens')) {
			case 'FORWARD': await o.walk(1, T, 1); break;
			case 'BACKWARD': await o.walk(1, T, -1); break;
			case 'LEFT': await o.turn(1, T, 1); break;
			case 'RIGHT': await o.turn(1, T, -1); break;
			case 'BENDLEFT': await o.bend(1, T, 1); break;
			case 'BENDRIGHT': await o.bend(1, T, -1); break;
			case 'SHAKERIGHT': await o.shakeLeg(1, T, 1); break;
			case 'SHAKELEFT': await o.shakeLeg(1, T, -1); break;
			case 'jump': await o.jump(1, T); break;
		}
	},
	otto_dance: async function(b) {
		var o = MPRSimulador.otto, T = +MPRSimulador.campo(b, 'otto_move_speed') || 2000, h = +MPRSimulador.campo(b, 'otto_dance_size') || 25;
		switch (MPRSimulador.campo(b, 'otto_dance_movement')) {
			case 'moonwalkerLEFT': await o.moonwalker(1, T, h, 1); break;
			case 'moonwalkerRIGHT': await o.moonwalker(1, T, h, -1); break;
			case 'crusaitoLEFT': await o.crusaito(1, T, h, 1); break;
			case 'crusaitoRIGHT': await o.crusaito(1, T, h, -1); break;
			case 'flappingFRONT': await o.flapping(1, T, h, 1); break;
			case 'flappingBACK': await o.flapping(1, T, h, -1); break;
		}
	},
	otto_do: async function(b) {
		var o = MPRSimulador.otto, mov = MPRSimulador.campo(b, 'otto_do_movement');
		var T = +MPRSimulador.campo(b, 'otto_move_speed') || 2000, h = +MPRSimulador.campo(b, 'otto_dance_size') || 25;
		if (typeof o[mov] == 'function') await o[mov](1, T, h);
	},
	otto_gesture: async function(b) { await MPRSimulador.otto.playGesture(MPRSimulador.campo(b, 'otto_gesture')); },
	otto_detener: async function() { await MPRSimulador.otto.home(); throw MPRSimulador.FIN('sim_bloque_detener'); },
	otto_movelegs: async function(b) {
		var S = MPRSimulador, pos = [];
		var nombres = ['PIN_YL', 'PIN_YR', 'PIN_RL', 'PIN_RR'];
		for (var i = 0; i < 4; i++) pos.push(await S.numero(b, nombres[i], 90));
		await S.otto._moveServos(await S.numero(b, 'TEMPO', 200), pos);
	},
	otto_moveservos: async function(b) {
		var S = MPRSimulador, p = await S.numero(b, 'Pos', 90);
		await S.otto._moveServos(await S.numero(b, 'Period', 10), [p, p, p, p]);
	},
	otto_sound: async function(b) { await MPRSimulador.otto.sing(MPRSimulador.campo(b, 'otto_sound')); },
	otto_tone: async function(b) {
		await MPRSimulador.otto._tone(+MPRSimulador.campo(b, 'otto_note'), +MPRSimulador.campo(b, 'otto_note_duration'), 1);
	},
	otto_tonehz: async function(b) {
		var S = MPRSimulador;
		await S.otto._tone(await S.numero(b, 'Hz1', 262), await S.numero(b, 'duration', 500), await S.numero(b, 'silent', 0));
	},
	otto_bendtone: async function(b) {
		var S = MPRSimulador;
		await S.otto.bendTones(await S.numero(b, 'Hz1', 880), await S.numero(b, 'Hz2', 2093), await S.numero(b, 'prop', 1.02),
			await S.numero(b, 'duration', 18), await S.numero(b, 'silent', 1));
	},
	RTTTL_music_lat: async function(b) {
		var id = MPRSimulador.campo(b, 'MELODY');
		var c = (Blockly.MPR_CANCIONES || []).filter(function(x) { return x[1] == id; })[0];
		if (!c) return;
		for (var i = 0; i < c[3].length; i++) await MPRSimulador.tocarRtttl(c[3][i][1]);
	},
	RTTTL_music: async function(b) {
		var t = MPRSimulador.melodiasLibreria()[MPRSimulador.campo(b, 'MELODY')];
		if (t) await MPRSimulador.tocarRtttl(t); else MPRSimulador.noSimulado(b);
	},
	RTTTL_music_custom: async function(b) { await MPRSimulador.tocarRtttl(await MPRSimulador.entrada(b, 'rtttl_melody', '')); },
	play: async function(b) {
		var ms = +MPRSimulador.campo(b, 'tempo') || 250;
		MPRSimulador.audio.tono(+MPRSimulador.campo(b, 'note'), ms);
		await MPRSimulador.esperar(ms);
	},
	tone: async function(b) {
		var S = MPRSimulador, ms = await S.numero(b, 'TPS', 100);
		S.audio.tono(await S.numero(b, 'NUM', 440), ms);
		await S.esperar(ms);
	},
	notone: async function() { MPRSimulador.audio.silencio(); },
	beep: async function() { MPRSimulador.audio.tono(440, 1000); await MPRSimulador.esperar(1000); },
	serial_print: async function(b) { MPRSimulador.escribir(await MPRSimulador.entrada(b, 'CONTENT', '')); },
	serial_println: async function(b) { MPRSimulador.escribir(await MPRSimulador.entrada(b, 'CONTENT', '')); },
	base_delay: async function(b) {
		var S = MPRSimulador, t = await S.numero(b, 'DELAY_TIME', 0), u = S.campo(b, 'unite');
		await S.esperar(u == 's' ? t * 1000 : u == 'u' ? t / 1000 : t);
	},
	tempo_sans_delay: async function(b) {   // "cada X tiempo": se ejecuta si ya pasó ese tiempo desde la última vez
		var S = MPRSimulador, c = S.corrida, t = await S.numero(b, 'DELAY_TIME', 0), u = S.campo(b, 'unite');
		var ms = u == 's' ? t * 1000 : u == 'u' ? t / 1000 : t, ahora = performance.now(), ult = c.temporizadores[b.id] || c.inicio;
		if (ahora - ult >= ms) { c.temporizadores[b.id] = ahora; await S.lista(b.getInputTargetBlock('branche')); }
	},
	controls_if: async function(b) {
		var S = MPRSimulador, n = b.elseifCount_ || 0;
		for (var i = 0; i <= n; i++) {
			if (await S.entrada(b, 'IF' + i, false)) { await S.lista(b.getInputTargetBlock('DO' + i)); return; }
		}
		if (b.elseCount_ || b.getInput('ELSE')) await S.lista(b.getInputTargetBlock('ELSE'));
	},
	controls_repeat_ext: async function(b) {
		var S = MPRSimulador, n = Math.floor(await S.numero(b, 'TIMES', 0)), i = 0;
		await S.repetir(b.getInputTargetBlock('DO'), async function() { return i++ < n; });
	},
	controls_repeat: async function(b) {
		var S = MPRSimulador, n = Math.floor(+S.campo(b, 'TIMES') || 0), i = 0;
		await S.repetir(b.getInputTargetBlock('DO'), async function() { return i++ < n; });
	},
	controls_whileUntil: async function(b) {
		var S = MPRSimulador, hasta = S.campo(b, 'MODE') == 'UNTIL';
		await S.repetir(b.getInputTargetBlock('DO'), async function() { var v = !!(await S.entrada(b, 'BOOL', false)); return hasta ? !v : v; });
	},
	controls_for: async function(b) {
		var S = MPRSimulador, c = S.corrida, nombre = b.getFieldValue('VAR');
		var desde = await S.numero(b, 'FROM', 0), hasta = await S.numero(b, 'TO', 0), paso = Math.abs(await S.numero(b, 'BY', 1)) || 1;
		var sube = desde <= hasta, primero = true;
		c.vars[nombre] = desde;
		await S.repetir(b.getInputTargetBlock('DO'), async function() {
			if (!primero) c.vars[nombre] = (+c.vars[nombre] || 0) + (sube ? paso : -paso);
			primero = false;
			return sube ? c.vars[nombre] <= hasta : c.vars[nombre] >= hasta;
		});
	},
	controls_switch: async function(b) {
		var S = MPRSimulador, v = S.corrida.vars[b.getFieldValue('SWVAR')];
		for (var i = 0; b.getInput('CASE' + i); i++) {
			if ((await S.entrada(b, 'CASE' + i, null)) == v) {
				try { await S.lista(b.getInputTargetBlock('DO' + i)); } catch (e) { if (e !== S.ROMPER) throw e; }
				return;
			}
		}
		if (b.getInput('DEFAULT')) await S.lista(b.getInputTargetBlock('DEFAULT'));
	},
	controls_flow_statements: async function(b) {
		throw MPRSimulador.campo(b, 'FLOW') == 'CONTINUE' ? MPRSimulador.SEGUIR : MPRSimulador.ROMPER;
	},
	variables_set: async function(b) { MPRSimulador.corrida.vars[b.getFieldValue('VAR')] = await MPRSimulador.entrada(b, 'VALUE', 0); },
	variables_set_init: async function(b) { MPRSimulador.corrida.vars[b.getFieldValue('VAR')] = await MPRSimulador.entrada(b, 'VALUE', 0); },
	math_change: async function(b) {
		var c = MPRSimulador.corrida, n = b.getFieldValue('VAR');
		c.vars[n] = (+c.vars[n] || 0) + (await MPRSimulador.numero(b, 'DELTA', 1));
	},
	procedures_callnoreturn: async function(b) { await MPRSimulador.llamar(b, false); },
	procedures_ifreturn: async function(b) {
		var S = MPRSimulador;
		if (await S.entrada(b, 'CONDITION', false)) throw { retorno: true, valor: b.getInput('VALUE') ? await S.entrada(b, 'VALUE', 0) : 0 };
	}
};

function mprMapArduino(x, a1, a2, b1, b2) {   // map() de Arduino: aritmética entera
	if (a2 == a1) return b1;
	return Math.trunc((x - a1) * (b2 - b1) / (a2 - a1)) + b1;
}

MPRSimulador.VALORES = {
	math_number: async function(b) { return +b.getFieldValue('NUM') || 0; },
	inout_angle_maths: async function(b) { return +b.getFieldValue('ANGLE') || 0; },
	text: async function(b) { return b.getFieldValue('TEXT') || ''; },
	logic_boolean: async function(b) { return b.getFieldValue('BOOL') == 'TRUE'; },
	logic_null: async function() { return 0; },
	logic_negate: async function(b) { return !(await MPRSimulador.entrada(b, 'BOOL', false)); },
	logic_operation: async function(b) {
		var S = MPRSimulador, y = b.getFieldValue('OP') == 'AND', a = !!(await S.entrada(b, 'A', false));
		if (y ? !a : a) return a;
		return !!(await S.entrada(b, 'B', false));
	},
	logic_compare: async function(b) {
		var S = MPRSimulador, a = await S.entrada(b, 'A', 0), c = await S.entrada(b, 'B', 0);
		switch (b.getFieldValue('OP')) {
			case 'EQ': return a == c;
			case 'NEQ': return a != c;
			case 'LT': return a < c;
			case 'LTE': return a <= c;
			case 'GT': return a > c;
			case 'GTE': return a >= c;
		}
		return false;
	},
	intervalle: async function(b) {
		var S = MPRSimulador, inf = await S.numero(b, 'inf', 0), v = await S.numero(b, 'valeur', 0), sup = await S.numero(b, 'sup', 0);
		var izq = b.getFieldValue('comp_inf') == 'LTE' ? v >= inf : v > inf;
		var der = b.getFieldValue('comp_sup') == 'LTE' ? v <= sup : v < sup;
		return izq && der;
	},
	math_arithmetic: async function(b) {
		var S = MPRSimulador, a = await S.numero(b, 'A', 0), c = await S.numero(b, 'B', 0);
		switch (b.getFieldValue('OP')) {
			case 'ADD': return a + c;
			case 'MINUS': return a - c;
			case 'MULTIPLY': return a * c;
			case 'DIVIDE': return c == 0 ? 0 : a / c;
			case 'POWER': return Math.pow(a, c);
		}
		return 0;
	},
	math_modulo: async function(b) {
		var S = MPRSimulador, a = await S.numero(b, 'DIVIDEND', 0), c = await S.numero(b, 'DIVISOR', 1);
		return c == 0 ? 0 : a % c;
	},
	math_random_int: async function(b) {
		var S = MPRSimulador, a = Math.round(await S.numero(b, 'FROM', 0)), c = Math.round(await S.numero(b, 'TO', 0));
		if (a > c) { var t = a; a = c; c = t; }
		return a + Math.floor(Math.random() * (c - a + 1));
	},
	math_map: async function(b) {
		var S = MPRSimulador;
		return mprMapArduino(await S.numero(b, 'pin', 0), await S.numero(b, 'A1', 0), await S.numero(b, 'A2', 1023), await S.numero(b, 'B1', 0), await S.numero(b, 'B2', 10));
	},
	math_constrain: async function(b) {
		var S = MPRSimulador, v = await S.numero(b, 'VALUE', 0), lo = await S.numero(b, 'LOW', 0), hi = await S.numero(b, 'HIGH', 100);
		return Math.max(lo, Math.min(hi, v));
	},
	math_single: async function(b) {
		var x = await MPRSimulador.numero(b, 'NUM', 0);
		switch (b.getFieldValue('OP')) {
			case 'ROOT': return Math.sqrt(x);
			case 'ABS': return Math.abs(x);
			case 'NEG': return -x;
			case 'LN': return Math.log(x);
			case 'LOG10': return Math.log(x) / Math.LN10;
			case 'EXP': return Math.exp(x);
			case 'POW10': return Math.pow(10, x);
		}
		return x;
	},
	math_round: async function(b) {
		var x = await MPRSimulador.numero(b, 'NUM', 0);
		switch (b.getFieldValue('OP')) {
			case 'ROUNDUP': return Math.ceil(x);
			case 'ROUNDDOWN': return Math.floor(x);
		}
		return Math.round(x);
	},
	math_trig: async function(b) {
		var x = await MPRSimulador.numero(b, 'NUM', 0), r = x * Math.PI / 180;
		switch (b.getFieldValue('OP')) {
			case 'SIN': return Math.sin(r);
			case 'COS': return Math.cos(r);
			case 'TAN': return Math.tan(r);
			case 'ASIN': return Math.asin(x) * 180 / Math.PI;
			case 'ACOS': return Math.acos(x) * 180 / Math.PI;
			case 'ATAN': return Math.atan(x) * 180 / Math.PI;
		}
		return 0;
	},
	math_constant: async function(b) {
		return { PI: Math.PI, E: Math.E, GOLDEN_RATIO: (1 + Math.sqrt(5)) / 2, SQRT2: Math.SQRT2, SQRT1_2: Math.SQRT1_2, INFINITY: Infinity }[b.getFieldValue('CONSTANT')] || 0;
	},
	math_number_property: async function(b) {
		var S = MPRSimulador, x = await S.numero(b, 'NUMBER_TO_CHECK', 0);
		switch (b.getFieldValue('PROPERTY')) {
			case 'EVEN': return x % 2 == 0;
			case 'ODD': return Math.abs(x % 2) == 1;
			case 'WHOLE': return x % 1 == 0;
			case 'POSITIVE': return x > 0;
			case 'NEGATIVE': return x < 0;
			case 'DIVISIBLE_BY': var d = await S.numero(b, 'DIVISOR', 1); return d != 0 && x % d == 0;
			case 'PRIME':
				if (x < 2 || x % 1 != 0) return false;
				for (var i = 2; i * i <= x; i++) if (x % i == 0) return false;
				return true;
		}
		return false;
	},
	variables_get: async function(b) {
		var v = MPRSimulador.corrida.vars[b.getFieldValue('VAR')];
		return v === undefined ? 0 : v;
	},
	ultrasonic_distance: async function() {
		var m = MPRSimulador.medir();
		MPRSimulador.verRayo(m);
		return m.cm;
	},
	millis: async function(b) {
		var ms = performance.now() - MPRSimulador.corrida.inicio, u = MPRSimulador.campo(b, 'unite');
		return u == 's' ? Math.floor(ms / 1000) : u == 'u' ? Math.floor(ms * 1000) : Math.floor(ms);
	},
	procedures_callreturn: async function(b) { return await MPRSimulador.llamar(b, true); }
};

MPRSimulador.escribir = function(v) {
	MPRSimulador.estado(MPRSimulador.msg('sim_escribe', 'Otto escribe: {t}').replace('{t}', String(v)));
};

window.addEventListener('load', function() {
	setTimeout(MPRSimulador.iniciar, 500);
});
