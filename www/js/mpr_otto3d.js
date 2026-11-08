'use strict';

// MPR: Otto 3D de la mascota. Usa three.js (js/three.min.js) y las piezas simplificadas de media/otto3d.js
// (generadas con tools/convertir_otto.js). Cabeza, cuerpo, piernas y pies son piezas separadas: cada una tiene
// su propio color. Como en el robot real, la cabeza va fija al cuerpo y todo el tronco se inclina desde los tobillos;
// solo las piernas tienen movimiento propio (caderas). Compatible con Electron 4 (Chromium 69).
// API: MPROtto3D.iniciar(canvas, colores) -> true/false, .colorear(parte, '#rrggbb'), .animar(nombre), .detener()

var MPROtto3D = {
	PARTES_COLOR: ['cabeza', 'cuerpo', 'piernas', 'pies'],
	ANIMACIONES: { saludo: 2.2, celebrar: 1.8, pensar: 3.2, alerta: 1.3 },   // duración en segundos
	vivo: false,
	gira: true,      // gira despacio para verse en 360°; con una animación vuelve de frente
	rumbo: 0,        // ángulo de giro acumulado (radianes)
	VELOCIDAD_GIRO: 0.45,   // rad/s: una vuelta cada ~14 s
	estado: { nombre: 'reposo', inicio: 0 },
	mirada: { x: 0, y: 0, ax: 0, ay: 0 },
	prox: { cuadros: 0, desde: 0, fps: 0 }
};

MPROtto3D.geometria = function(nombre, matriz) {
	var p = window.OTTO3D.partes[nombre];
	var g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(p.p, 3));
	g.setIndex(p.i);
	if (matriz) g.applyMatrix4(matriz);
	g.computeVertexNormals();
	return g;
};

MPROtto3D.iniciar = function(canvas, colores) {
	if (typeof THREE == 'undefined' || !window.OTTO3D) return false;
	var self = MPROtto3D;
	try {
		self.renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
	} catch (e) { return false; }
	var w = canvas.clientWidth || 150, h = canvas.clientHeight || 190;
	self.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
	self.renderer.setSize(w, h, false);
	self.renderer.setClearColor(0x000000, 0);

	self.escena = new THREE.Scene();
	self.camara = new THREE.PerspectiveCamera(28, w / h, 50, 2000);
	self.camara.position.set(0, 82, 380);
	self.camara.lookAt(new THREE.Vector3(0, 60, 0));
	self.escena.add(new THREE.HemisphereLight(0xffffff, 0x6b6b8f, 0.85));
	var luz = new THREE.DirectionalLight(0xffffff, 0.6);
	luz.position.set(120, 260, 300);
	self.escena.add(luz);

	// Materiales: uno por grupo de piezas, así cada niño pinta su Otto
	self.mat = {};
	self.PARTES_COLOR.forEach(function(n) {
		self.mat[n] = new THREE.MeshLambertMaterial({ color: (colores && colores[n]) || '#ff5700', flatShading: true });
	});
	// Materiales del sensor ultrasónico (no se personalizan: son parte del robot)
	var matPlata = new THREE.MeshLambertMaterial({ color: 0xc7ccd4 });
	var matOscuro = new THREE.MeshBasicMaterial({ color: 0x14142b });

	// Todas las piezas del 3MF tienen su altura en z y el frente de la cabeza en -y: se giran -90° en X
	// (x, y, z) -> (x, z, -y). Ejes del robot: X derecha, Y arriba, Z hacia el frente. Medidas en mm.
	var tumbar = new THREE.Matrix4().makeRotationX(-Math.PI / 2);

	// Como en el robot real, la cabeza está fija al cuerpo: forman un solo bloque (el tronco) que se inclina
	// desde los tobillos junto con las piernas. Los pies quedan planos en el suelo.
	self.raiz = new THREE.Group();            // salta y gira todo el robot
	self.escena.add(self.raiz);
	self.inclinacion = new THREE.Group();     // pivote en los tobillos (y = 8): inclina piernas + cuerpo + cabeza
	self.inclinacion.position.set(0, 8, 0);
	self.raiz.add(self.inclinacion);

	// Cuerpo (y 50..89) y cabeza encima (y 87..126, con 2 mm dentro del borde del cuerpo). Posiciones respecto al pivote.
	self.cuerpo = new THREE.Mesh(self.geometria('cuerpo', tumbar), self.mat.cuerpo);
	self.cuerpo.position.set(0, 61.5, 0);
	self.inclinacion.add(self.cuerpo);
	var cabeza = new THREE.Mesh(self.geometria('cabeza', tumbar), self.mat.cabeza);
	cabeza.position.set(0, 98.5, 0);
	self.inclinacion.add(cabeza);

	// "Ojos" = sensor ultrasónico: dos cilindros plateados con malla oscura, en los agujeros del frente de la cabeza
	self.ojos = [];
	[-13.4, 13.4].forEach(function(x) {
		var sensor = new THREE.Group();
		var lata = new THREE.Mesh(new THREE.CylinderGeometry(7.9, 7.9, 14, 20), matPlata);
		lata.rotation.x = Math.PI / 2;
		lata.position.z = -1;
		sensor.add(lata);
		var malla2 = new THREE.Mesh(new THREE.CircleGeometry(6.2, 20), matOscuro);
		malla2.position.z = 6.1;
		sensor.add(malla2);
		[-3.4, 0, 3.4].forEach(function(bx) {   // rejilla del transductor
			var barra = new THREE.Mesh(new THREE.BoxGeometry(0.9, 9.5, 0.4), matPlata);
			barra.position.set(bx, 0, 6.3);
			sensor.add(barra);
		});
		sensor.position.set(x, 104.9, 29.2);    // y 112,9 del robot; la lata asoma ~2 mm del frente
		self.inclinacion.add(sensor);
		self.ojos.push(sensor);
	});

	// Piernas (y 8..50): pivote en la cadera (y = 50), a x = ±23, movidas por los servos de cadera.
	// El pie con el saliente a la izquierda va bajo la pierna de la derecha y viceversa: la placa sobresale hacia afuera.
	self.piernas = [];
	[-23, 23].forEach(function(x) {
		var cadera = new THREE.Group();
		cadera.position.set(x, 42, 0);
		var pierna = new THREE.Mesh(self.geometria('pierna', tumbar), self.mat.piernas);
		pierna.position.set(0, -21, 0);
		cadera.add(pierna);
		self.inclinacion.add(cadera);
		self.piernas.push(cadera);
		// Pie plano en el suelo (hijo de la raíz, no se inclina)
		var pie = new THREE.Mesh(self.geometria(x > 0 ? 'pieIzq' : 'pieDer', tumbar), self.mat.pies);
		pie.position.set(x + (x > 0 ? 9 : -9), 13, 0);
		self.raiz.add(pie);
	});


	self.vivo = true;
	self.estado = { nombre: 'reposo', inicio: performance.now() / 1000 };
	self.prox.desde = performance.now();
	window.addEventListener('mousemove', self.alMover);
	document.addEventListener('visibilitychange', function() { if (!document.hidden) self.ultimo = 0; });
	self.ultimo = 0;
	requestAnimationFrame(self.bucle);
	return true;
};

MPROtto3D.alMover = function(e) {
	var c = MPROtto3D.renderer && MPROtto3D.renderer.domElement;
	if (!c) return;
	var r = c.getBoundingClientRect();
	var dx = (e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2);
	var dy = (e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2);
	MPROtto3D.mirada.x = Math.max(-1, Math.min(1, dx));
	MPROtto3D.mirada.y = Math.max(-1, Math.min(1, dy));
};

MPROtto3D.colorear = function(parte, hex) {
	if (MPROtto3D.mat && MPROtto3D.mat[parte]) MPROtto3D.mat[parte].color.set(hex);
};

MPROtto3D.animar = function(nombre) {
	if (!MPROtto3D.vivo || !MPROtto3D.ANIMACIONES[nombre]) return;
	MPROtto3D.estado = { nombre: nombre, inicio: performance.now() / 1000 };
};

MPROtto3D.girar = function(si) {
	MPROtto3D.gira = !!si;
};

MPROtto3D.animando = function() {
	return MPROtto3D.estado.nombre != 'reposo';
};

MPROtto3D.detener = function() {
	MPROtto3D.vivo = false;
	window.removeEventListener('mousemove', MPROtto3D.alMover);
	if (MPROtto3D.renderer) { MPROtto3D.renderer.dispose(); MPROtto3D.renderer = null; }
};

// Pone cada pivote en su pose según la animación y el tiempo
MPROtto3D.pose = function(t) {
	var self = MPROtto3D, e = self.estado;
	var s = t - e.inicio, dur = self.ANIMACIONES[e.nombre] || 0;
	if (e.nombre != 'reposo' && s >= dur) { self.estado = e = { nombre: 'reposo', inicio: t }; s = 0; dur = 0; }
	var env = dur ? Math.max(0, Math.min(1, s / 0.25, (dur - s) / 0.25)) : 0;

	var m = self.mirada;
	m.ax += (m.x - m.ax) * 0.12;
	m.ay += (m.y - m.ay) * 0.12;

	// Todo el robot se mueve como un bloque: la cabeza nunca se separa del cuerpo
	// Giro de exhibición: continuo en reposo; al animar vuelve al frente por el camino más corto
	var dt = self.tPrev ? Math.min(0.2, t - self.tPrev) : 0;
	self.tPrev = t;
	if (self.gira && e.nombre == 'reposo') self.rumbo += dt * self.VELOCIDAD_GIRO;
	else self.rumbo += (Math.round(self.rumbo / (2 * Math.PI)) * 2 * Math.PI - self.rumbo) * Math.min(1, dt * 4);

	var y = Math.sin(t * 2.2) * 1.2, giro = self.gira ? 0 : m.ax * 0.35, incX = 0, incZ = Math.sin(t * 1.3) * 0.03;
	var legA = 0, legB = 0, ojoEsc = 1;

	if (e.nombre == 'saludo') {
		legB = (0.8 + 0.35 * Math.sin(s * 13)) * env;        // la pierna derecha saluda
		incZ += 0.1 * env; giro *= 0.4;                      // y el cuerpo se inclina hacia el otro lado
	} else if (e.nombre == 'celebrar') {
		y += 42 * Math.abs(Math.sin(Math.PI * s / 0.9)) * env;
		giro = Math.min(1, s / 1.3) * Math.PI * 2;
		legA = -(0.45 + 0.25 * Math.sin(s * 16)) * env; legB = -legA;
		incZ += Math.sin(s * 10) * 0.08 * env;
		ojoEsc = 1.12;
	} else if (e.nombre == 'pensar') {
		incZ += 0.12 * env; incX = 0.1 * env; giro *= 0.3;   // se inclina como pensando
	} else if (e.nombre == 'alerta') {
		giro = Math.sin(s * 26) * 0.3 * env; ojoEsc = 1 + 0.3 * env;
		y += 3 * env;
	}

	self.raiz.position.y = y;
	self.raiz.rotation.y = self.rumbo + giro;
	self.inclinacion.rotation.set(incX, 0, incZ);
	self.piernas[0].rotation.z = legA;
	self.piernas[1].rotation.z = legB;

	// Los sensores se agrandan un poco con las emociones (alerta, celebrar)
	for (var i = 0; i < 2; i++) self.ojos[i].scale.set(ojoEsc, ojoEsc, 1);
};

MPROtto3D.bucle = function(ahora) {
	var self = MPROtto3D;
	if (!self.vivo) return;
	requestAnimationFrame(self.bucle);
	if (document.hidden) return;
	// Ahorro de recursos: 30 cuadros/s al animar o girar, 12 si está quieto
	var meta = (self.animando() || self.gira) ? 33 : 80;
	if (ahora - self.ultimo < meta - 4) return;
	self.ultimo = ahora;
	self.pose(ahora / 1000);
	self.renderer.render(self.escena, self.camara);
	self.prox.cuadros++;
	if (ahora - self.prox.desde >= 2000) {
		self.prox.fps = Math.round(self.prox.cuadros * 1000 / (ahora - self.prox.desde));
		self.prox.cuadros = 0; self.prox.desde = ahora;
	}
};

MPROtto3D.estadisticas = function() {
	var i = MPROtto3D.renderer ? MPROtto3D.renderer.info : null;
	var mem = window.performance && performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB' : 'n/d';
	return { triangulos: i ? i.render.triangles : 0, llamadas: i ? i.render.calls : 0, geometrias: i ? i.memory.geometries : 0, fps: MPROtto3D.prox.fps, memoriaJS: mem };
};
