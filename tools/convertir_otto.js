'use strict';
// Convierte las piezas del Otto (3MF de Bambu Studio) en un modelo liviano para la mascota 3D.
// Uso:  node tools/convertir_otto.js <carpeta_3mf_descomprimida> <salida.js> [factor]
// Necesita:  npm i meshoptimizer@0.20.0   (solo para generar el modelo; la app no lo usa)
// La salida (www/media/otto3d.js) define window.OTTO3D = { partes: { nombre: { p: [...], i: [...] } } }.

const fs = require('fs');
const path = require('path');

const carpeta = process.argv[2];
const salida = process.argv[3];
const factor = parseFloat(process.argv[4] || '1');
if (!carpeta || !salida) { console.error('Uso: node tools/convertir_otto.js <carpeta_3mf> <salida.js> [factor]'); process.exit(1); }

// objeto del 3MF -> nombre de la pieza y cantidad de triángulos objetivo
const PARTES = [
	{ nombre: 'cabeza', archivo: 'object_16.model', triangulos: 1400 },
	{ nombre: 'cuerpo', archivo: 'object_48.model', triangulos: 1400 },
	{ nombre: 'pierna', archivo: 'object_29.model', triangulos: 500 },
	{ nombre: 'pieIzq', archivo: 'object_40.model', triangulos: 500 },
	{ nombre: 'pieDer', archivo: 'object_41.model', triangulos: 500 }
];

function leer(archivo) {
	const t = fs.readFileSync(path.join(carpeta, '3D', 'Objects', archivo), 'utf8');
	const v = [];
	for (const m of t.matchAll(/<vertex x="([^"]+)" y="([^"]+)" z="([^"]+)"/g)) v.push(+m[1], +m[2], +m[3]);
	const idx = [];
	for (const m of t.matchAll(/<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)"/g)) idx.push(+m[1], +m[2], +m[3]);
	return { pos: new Float32Array(v), idx: new Uint32Array(idx) };
}

// Deja solo los vértices usados y los redondea a 0,1 mm
function compactar(pos, idx) {
	const mapa = new Map(), p = [], i = [];
	for (let k = 0; k < idx.length; k++) {
		const v = idx[k];
		if (!mapa.has(v)) {
			mapa.set(v, p.length / 3);
			p.push(Math.round(pos[v * 3] * 10) / 10, Math.round(pos[v * 3 + 1] * 10) / 10, Math.round(pos[v * 3 + 2] * 10) / 10);
		}
		i.push(mapa.get(v));
	}
	return { p, i };
}

(async function() {
	const { MeshoptSimplifier } = require('meshoptimizer');
	await MeshoptSimplifier.ready;
	const out = {};
	for (const parte of PARTES) {
		const m = leer(parte.archivo);
		const objetivo = Math.round(parte.triangulos * factor) * 3;
		let r = MeshoptSimplifier.simplifySloppy
			? MeshoptSimplifier.simplifySloppy(m.idx, m.pos, 3, objetivo, 0.08)
			: MeshoptSimplifier.simplify(m.idx, m.pos, 3, objetivo, 0.08);
		const nuevo = Array.isArray(r) ? r[0] : r;
		const c = compactar(m.pos, nuevo);
		out[parte.nombre] = c;
		console.log(parte.nombre, m.idx.length / 3, '->', c.i.length / 3, 'triángulos,', c.p.length / 3, 'vértices');
	}
	fs.writeFileSync(salida, '// Generado por tools/convertir_otto.js. No editar a mano.\nwindow.OTTO3D = ' + JSON.stringify({ partes: out }) + ';\n');
	console.log('Escrito', salida, (fs.statSync(salida).size / 1024).toFixed(0) + ' KB');
})();
