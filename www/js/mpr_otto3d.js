'use strict';

// MPR: Otto 3D de la mascota. Usa three.js (js/three.min.js) y las piezas de media/otto3d.js
// (generadas con tools/convertir_otto.js). Cabeza, cuerpo, piernas y pies son piezas separadas: cada una tiene
// su propio color. Como en el robot real, la cabeza va fija al cuerpo y todo el tronco se inclina desde los tobillos;
// las caderas giran las piernas (eje vertical) y los tobillos inclinan los pies. Compatible con Electron 4.
//
// API: MPROtto3D.iniciar(canvas, colores) -> true/false, .colorear(parte, '#rrggbb'), .animar(nombre),
//      .caminar(dir) / .pararCaminar()  (dir: -1 izquierda, +1 derecha; Otto se gira de perfil y camina), .detener()

var MPROtto3D = {
	PARTES_COLOR: ['cabeza', 'cuerpo', 'piernas', 'pies'],
	// duración en segundos de cada animación
	ANIMACIONES: { saludo: 2.2, celebrar: 1.8, pensar: 3.2, alerta: 1.3, vuelta: 3.2 },
	VEL_GIRO: 3.2,        // rad/s al girarse hacia donde camina
	// Altura del salto al celebrar (mm). Con 42 la cabeza salía 21 px por arriba del canvas de 150x190 y se veía cortada;
	// con 20 queda dentro. Medido proyectando todos los vértices de cada pose con la cámara de la mascota.
	SALTO: 20,
	vivo: false,
	economia: false,      // equipo sin aceleración gráfica: 20 cuadros/s al moverse, 8 en reposo, sin suavizado de bordes
	estado: { nombre: 'reposo', inicio: 0 },
	rumbo: 0,             // giro actual de todo el robot (radianes); 0 = de frente
	rumboObj: 0,          // hacia dónde quiere mirar
	andar: 0,             // 0 = parado, 1 = caminando (se suaviza)
	andarObj: 0,
	fase: 0,              // fase del paso
	mirada: { x: 0, y: 0, ax: 0, ay: 0 },
	alLento: null,        // función a llamar si se mueve a menos de 17 cuadros/s durante 5 s seguidos
	// Modo escenario ("Probar en pantalla", js/mpr_simulador.js): { pose(ahoraMs), camara, animando() }. Mientras está
	// puesto, el simulador mueve las piezas y elige la cámara; las animaciones y la mirada de la mascota no actúan.
	escenario: null,
	lentos: 0,
	medA: { n: 0, t0: 0 },
	prox: { cuadros: 0, desde: 0, fps: 0 }
};

function mprDecodificar(b64, Tipo) {
	var bin = atob(b64), n = bin.length, u = new Uint8Array(n);
	for (var k = 0; k < n; k++) u[k] = bin.charCodeAt(k);
	return new Tipo(u.buffer);
}

// Lee una pieza de window.OTTO3D (posiciones Int16 en centésimas de mm, índices de 2 o 4 bytes)
MPROtto3D.geometria = function(nombre, matriz) {
	var p = window.OTTO3D.partes[nombre];
	var enteros = mprDecodificar(p.p, Int16Array), pos = new Float32Array(enteros.length);
	for (var k = 0; k < enteros.length; k++) pos[k] = enteros[k] / 100;
	var g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
	g.setIndex(new THREE.BufferAttribute(mprDecodificar(p.i, p.w == 2 ? Uint16Array : Uint32Array), 1));
	if (matriz) g.applyMatrix4(matriz);
	// Sombreado plano: cada triángulo con su propia normal. Respeta las aristas vivas, los relieves y los logos
	// (MeshLambertMaterial de esta versión de three.js ignora flatShading y suavizaba las caras grandes).
	g = g.toNonIndexed();
	g.computeVertexNormals();
	return g;
};

MPROtto3D.iniciar = function(canvas, colores) {
	if (typeof THREE == 'undefined' || !window.OTTO3D) return false;
	var self = MPROtto3D;
	try {
		self.renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: !self.economia, powerPreference: 'low-power' });
	} catch (e) { return false; }
	var w = canvas.clientWidth || 150, h = canvas.clientHeight || 190;
	self.renderer.setPixelRatio(self.economia ? 1 : Math.min(window.devicePixelRatio || 1, 2));
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
		self.mat[n] = new THREE.MeshLambertMaterial({ color: (colores && colores[n]) || '#ff5700' });   // sin flatShading: este material lo ignora (avisaba en la consola); las caras planas vienen de la geometría
	});
	// Materiales del sensor ultrasónico (no se personalizan: son parte del robot)
	self.matPlata = new THREE.MeshLambertMaterial({ color: 0xc7ccd4 });
	self.matOscuro = new THREE.MeshBasicMaterial({ color: 0x14142b });

	self.armar();

	self.vivo = true;
	self.estado = { nombre: 'reposo', inicio: performance.now() / 1000 };
	self.prox.desde = performance.now();
	window.addEventListener('mousemove', self.alMover);
	document.addEventListener('visibilitychange', function() { if (!document.hidden) self.ultimo = 0; });
	self.ultimo = 0;
	requestAnimationFrame(self.bucle);
	return true;
};

// Arma (o vuelve a armar, si se cambia de modelo) el robot con las piezas de window.OTTO3D
MPROtto3D.armar = function() {
	var self = MPROtto3D;
	if (self.raiz) {   // libera el modelo anterior
		self.raiz.traverse(function(o) { if (o.geometry) o.geometry.dispose(); });
		self.escena.remove(self.raiz);
	}
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

	// Cuerpo (y 50..89) y cabeza metida unos 6 mm en su borde (y 84..123). Posiciones respecto al pivote (y = 8).
	self.cuerpo = new THREE.Mesh(self.geometria('cuerpo', tumbar), self.mat.cuerpo);
	self.cuerpo.position.set(0, 61.5, 0);
	self.inclinacion.add(self.cuerpo);
	var cabeza = new THREE.Mesh(self.geometria('cabeza', tumbar), self.mat.cabeza);
	cabeza.position.set(0, 95.5, 0);
	self.inclinacion.add(cabeza);

	// "Ojos" = sensor ultrasónico: dos cilindros plateados con malla oscura dentro de los agujeros del frente
	self.ojos = [];
	[-13.37, 13.37].forEach(function(x) {   // centros medidos en los agujeros de la cabeza original
		var sensor = new THREE.Group();
		var lata = new THREE.Mesh(new THREE.CylinderGeometry(8.1, 8.1, 14, 24), self.matPlata);
		lata.rotation.x = Math.PI / 2;
		lata.position.z = -1;
		sensor.add(lata);
		var malla2 = new THREE.Mesh(new THREE.CircleGeometry(6.5, 24), self.matOscuro);
		malla2.position.z = 6.1;
		sensor.add(malla2);
		[-3.4, 0, 3.4].forEach(function(bx) {   // rejilla del transductor
			var barra = new THREE.Mesh(new THREE.BoxGeometry(0.9, 9.5, 0.4), self.matPlata);
			barra.position.set(bx, 0, 6.3);
			sensor.add(barra);
		});
		sensor.position.set(x, 101.5, 26.6);    // y 109,5 del robot = centro de la cabeza (103,5) + 6,0 mm; la lata queda al ras de la cara
		self.inclinacion.add(sensor);
		self.ojos.push(sensor);
	});

	// Piernas (y 8..50): la cadera gira la pierna sobre su eje vertical (a x = ±23).
	// El pie con el saliente a la izquierda va bajo la pierna de la derecha y viceversa: la placa sobresale hacia afuera.
	self.piernas = [];
	self.pies = [];
	[-23, 23].forEach(function(x) {
		var cadera = new THREE.Group();
		cadera.position.set(x, 42, 0);
		var pierna = new THREE.Mesh(self.geometria('pierna', tumbar), self.mat.piernas);
		pierna.position.set(0, -21, 0);
		cadera.add(pierna);
		self.inclinacion.add(cadera);
		self.piernas.push(cadera);
		// Pie: pivote en el tobillo, plano en el suelo (hijo de la raíz); sigue el giro de su cadera y se inclina con el tobillo
		var tobillo = new THREE.Group();
		tobillo.position.set(x, 8, 0);
		var pie = new THREE.Mesh(self.geometria(x > 0 ? 'pieIzq' : 'pieDer', tumbar), self.mat.pies);
		pie.position.set(x > 0 ? 9 : -9, 5, 0);
		tobillo.add(pie);
		self.raiz.add(tobillo);
		self.pies.push(tobillo);
	});

	// Otto siempre cabe entero en su canvas: sin el recorte por vista, three.js no calcula la esfera envolvente de cada
	// pieza (recorre ~370 mil vértices al arrancar) ni la prueba en cada cuadro. La imagen es idéntica (comprobado píxel a píxel).
	self.raiz.traverse(function(o) { o.frustumCulled = false; });
};

MPROtto3D.alMover = function(e) {
	var c = MPROtto3D.renderer && MPROtto3D.renderer.domElement;
	if (!c || MPROtto3D.escenario) return;
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
	if (!MPROtto3D.vivo || MPROtto3D.escenario || !MPROtto3D.ANIMACIONES[nombre]) return;
	MPROtto3D.estado = { nombre: nombre, inicio: performance.now() / 1000 };
};

// Otto se gira de perfil hacia donde va (dir: -1 izquierda, +1 derecha) y empieza a caminar
MPROtto3D.caminar = function(dir) {
	MPROtto3D.rumboObj = (dir < 0 ? -1 : 1) * Math.PI / 2;
	MPROtto3D.andarObj = 1;
};

// Se detiene y vuelve a mirar de frente
MPROtto3D.pararCaminar = function() {
	MPROtto3D.andarObj = 0;
	MPROtto3D.rumboObj = 0;
};

MPROtto3D.animando = function() {
	return MPROtto3D.estado.nombre != 'reposo' || MPROtto3D.andarObj > 0 || MPROtto3D.andar > 0.02 ||
		Math.abs(MPROtto3D.rumbo - MPROtto3D.rumboObj) > 0.01;
};

MPROtto3D.detener = function() {
	MPROtto3D.vivo = false;
	window.removeEventListener('mousemove', MPROtto3D.alMover);
	if (MPROtto3D.renderer) { MPROtto3D.renderer.dispose(); MPROtto3D.renderer = null; }
};

function mprSuave(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }

// Pone cada pivote en su pose según la animación y el tiempo
MPROtto3D.pose = function(t) {
	var self = MPROtto3D, e = self.estado;
	var dt = self.tPrev ? Math.min(0.2, t - self.tPrev) : 0;
	self.tPrev = t;
	var s = t - e.inicio, dur = self.ANIMACIONES[e.nombre] || 0;
	if (e.nombre != 'reposo' && s >= dur) { self.estado = e = { nombre: 'reposo', inicio: t }; s = 0; dur = 0; }
	var env = dur ? Math.max(0, Math.min(1, s / 0.25, (dur - s) / 0.25)) : 0;

	var m = self.mirada;
	m.ax += (m.x - m.ax) * 0.12;
	m.ay += (m.y - m.ay) * 0.12;

	// Giro natural hacia donde quiere mirar (a velocidad limitada, como quien se da vuelta)
	var dif = self.rumboObj - self.rumbo;
	var paso = self.VEL_GIRO * dt;
	self.rumbo += Math.abs(dif) <= paso ? dif : (dif > 0 ? paso : -paso);
	// Marcha: se suaviza al empezar y al parar
	self.andar += (self.andarObj - self.andar) * Math.min(1, dt * 5);
	var w = self.andar;
	self.fase += dt * 7.5 * w;

	var y = Math.sin(t * 2.2) * 1.2 * (1 - w), giro = 0, incX = 0, incZ = Math.sin(t * 1.3) * 0.03 * (1 - w);
	var cadI = 0, cadD = 0, tobI = 0, tobD = 0, ojoEsc = 1;

	if (w > 0.02) {   // caminar: caderas giran las piernas alternadas, los tobillos levantan cada pie, el cuerpo se balancea
		var sn = Math.sin(self.fase);
		cadI = 0.45 * w * sn; cadD = -cadI;
		tobI = -0.28 * w * Math.max(0, Math.sin(self.fase + 0.9));
		tobD = 0.28 * w * Math.max(0, -Math.sin(self.fase + 0.9));
		incZ += 0.06 * w * sn;
		y += 1.6 * w * Math.abs(sn);
	} else if (e.nombre == 'saludo') {
		tobD = (0.45 + 0.22 * Math.sin(s * 13)) * env;       // levanta el pie derecho
		incZ += 0.1 * env;                                   // y el cuerpo se inclina hacia el otro lado
		giro = m.ax * 0.15;
	} else if (e.nombre == 'celebrar') {
		y += self.SALTO * Math.abs(Math.sin(Math.PI * s / 0.9)) * env;   // dos saltos; la altura cabe en el canvas (ver SALTO)
		giro = Math.min(1, s / 1.3) * Math.PI * 2;
		cadI = 0.35 * Math.sin(s * 14) * env; cadD = -cadI;
		tobI = -0.2 * Math.max(0, Math.sin(s * 14)) * env; tobD = 0.2 * Math.max(0, -Math.sin(s * 14)) * env;
		incZ += Math.sin(s * 10) * 0.08 * env;
		ojoEsc = 1.12;
	} else if (e.nombre == 'pensar') {
		incZ += 0.12 * env; incX = 0.1 * env;                // se inclina como pensando
		giro = m.ax * 0.1;
	} else if (e.nombre == 'alerta') {
		giro = Math.sin(s * 26) * 0.3 * env; ojoEsc = 1 + 0.3 * env;
		y += 3 * env;
	} else if (e.nombre == 'vuelta') {   // da una vuelta completa, despacio, para mostrarse por todos lados
		giro = mprSuave(s / dur) * Math.PI * 2;
		cadI = 0.4 * Math.sin(s * 7) * env; cadD = -cadI;
		tobI = -0.25 * Math.max(0, Math.sin(s * 7 + 0.9)) * env; tobD = 0.25 * Math.max(0, -Math.sin(s * 7 + 0.9)) * env;
	} else {
		giro = m.ax * 0.3;                                   // en reposo gira un poco la mirada hacia el mouse
	}

	self.raiz.position.y = y;
	self.raiz.rotation.y = self.rumbo + giro;
	self.inclinacion.rotation.set(incX, 0, incZ);
	self.piernas[0].rotation.y = cadI;
	self.piernas[1].rotation.y = cadD;
	self.pies[0].rotation.set(0, cadI, tobI);
	self.pies[1].rotation.set(0, cadD, tobD);

	// Los sensores se agrandan un poco con las emociones (alerta, celebrar)
	for (var i = 0; i < 2; i++) self.ojos[i].scale.set(ojoEsc, ojoEsc, 1);
};

MPROtto3D.bucle = function(ahora) {
	var self = MPROtto3D;
	if (!self.vivo) return;
	requestAnimationFrame(self.bucle);
	if (document.hidden) return;
	// Ahorro de recursos: 30 cuadros/s al moverse, 12 en reposo (también en el escenario)
	var esc = self.escenario, anima = esc ? esc.animando() : self.animando();
	var meta = anima ? (self.economia ? 50 : 33) : (self.economia ? 125 : 80);
	if (ahora - self.ultimo < meta - 4) return;
	self.ultimo = ahora;
	if (anima) {   // mide los cuadros por segundo solo mientras se anima
		self.medA.n++;
		if (ahora - self.medA.t0 >= 2500) {
			var f = self.medA.n * 1000 / (ahora - self.medA.t0);
			self.medA = { n: 0, t0: ahora };
			if (f < (self.economia ? 12 : 17) && self.alLento) { if (++self.lentos >= 2) { var cb = self.alLento; self.alLento = null; cb(f); } }
			else self.lentos = 0;
		}
	} else self.medA = { n: 0, t0: ahora };
	if (esc) {
		esc.pose(ahora);
		self.renderer.render(self.escena, esc.camara);
	} else {
		self.pose(ahora / 1000);
		self.renderer.render(self.escena, self.camara);
	}
	self.prox.cuadros++;
	if (ahora - self.prox.desde >= 2000) {
		self.prox.fps = Math.round(self.prox.cuadros * 1000 / (ahora - self.prox.desde));
		self.prox.cuadros = 0; self.prox.desde = ahora;
	}
};

MPROtto3D.estadisticas = function() {
	var i = MPROtto3D.renderer ? MPROtto3D.renderer.info : null;
	var mem = window.performance && performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB' : 'n/d';
	return { modelo: window.OTTO3D ? window.OTTO3D.nivel : '', triangulos: i ? i.render.triangles : 0, llamadas: i ? i.render.calls : 0, geometrias: i ? i.memory.geometries : 0, fps: MPROtto3D.prox.fps, memoriaJS: mem };
};
