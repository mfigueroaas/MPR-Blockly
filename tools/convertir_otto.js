'use strict';
// Convierte las piezas del Otto (3MF de Bambu Studio) en los modelos de la mascota 3D.
// Uso:  node tools/convertir_otto.js <carpeta_3mf_descomprimida> <carpeta_salida>
//   Genera  otto3d.js          modelo COMPLETO (todos los triángulos originales, ~123 mil)
//           otto3d_liviano.js  modelo simplificado (~24 mil) para equipos sin aceleración gráfica
// Necesita:  npm i meshoptimizer@0.20.0   (solo para generar el modelo liviano; la app no lo usa)
// Formato: window.OTTO3D = { nivel, partes: { nombre: { p: base64 Int16 (centésimas de mm), i: base64, w: 2|4 bytes } } }

const fs = require('fs');
const path = require('path');

const carpeta = process.argv[2];
const salida = process.argv[3];
if (!carpeta || !salida) { console.error('Uso: node tools/convertir_otto.js <carpeta_3mf> <carpeta_salida>'); process.exit(1); }

// objeto del 3MF -> nombre de la pieza y triángulos del modelo liviano
const PARTES = [
	{ nombre: 'cabeza', archivo: 'object_16.model', liviano: 7000 },
	{ nombre: 'cuerpo', archivo: 'object_48.model', liviano: 12000 },
	{ nombre: 'pierna', archivo: 'object_29.model', liviano: 2200 },
	{ nombre: 'pieIzq', archivo: 'object_40.model', liviano: 1500 },
	{ nombre: 'pieDer', archivo: 'object_41.model', liviano: 1500 }
];

function leer(archivo) {
	const t = fs.readFileSync(path.join(carpeta, '3D', 'Objects', archivo), 'utf8');
	const v = [];
	for (const m of t.matchAll(/<vertex x="([^"]+)" y="([^"]+)" z="([^"]+)"/g)) v.push(+m[1], +m[2], +m[3]);
	const idx = [];
	for (const m of t.matchAll(/<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)"/g)) idx.push(+m[1], +m[2], +m[3]);
	return { pos: new Float32Array(v), idx: new Uint32Array(idx) };
}

// Deja solo los vértices usados, en centésimas de mm (Int16) y con índices de 2 o 4 bytes, en base64
function empaquetar(pos, idx) {
	const mapa = new Map(), p = [], i = [];
	for (let k = 0; k < idx.length; k++) {
		const v = idx[k];
		if (!mapa.has(v)) {
			mapa.set(v, p.length / 3);
			for (let a = 0; a < 3; a++) {
				const c = Math.round(pos[v * 3 + a] * 100);
				if (Math.abs(c) > 32767) throw new Error('pieza fuera de rango');
				p.push(c);
			}
		}
		i.push(mapa.get(v));
	}
	const IdxT = p.length / 3 < 65536 ? Uint16Array : Uint32Array;
	const pp = Int16Array.from(p), ii = IdxT.from(i);
	return {
		p: Buffer.from(pp.buffer).toString('base64'),
		i: Buffer.from(ii.buffer).toString('base64'),
		w: IdxT.BYTES_PER_ELEMENT,
		triangulos: i.length / 3
	};
}

function escribir(archivo, nivel, partes) {
	let total = 0;
	for (const n in partes) total += partes[n].triangulos;
	fs.writeFileSync(archivo, '// Generado por tools/convertir_otto.js (' + nivel + '). No editar a mano.\nwindow.OTTO3D = ' +
		JSON.stringify({ nivel: nivel, partes: partes }) + ';\n');
	console.log(nivel, total, 'triángulos (en la pose: cabeza + cuerpo + 2 piernas + 2 pies ≈',
		Math.round(partes.cabeza.triangulos + partes.cuerpo.triangulos + 2 * partes.pierna.triangulos + partes.pieIzq.triangulos + partes.pieDer.triangulos), ')',
		(fs.statSync(archivo).size / 1024).toFixed(0) + ' KB', archivo);
}

(async function() {
	const { MeshoptSimplifier } = require('meshoptimizer');
	await MeshoptSimplifier.ready;
	const completo = {}, liviano = {};
	for (const parte of PARTES) {
		const m = leer(parte.archivo);
		completo[parte.nombre] = empaquetar(m.pos, m.idx);
		// Colapso de aristas (conserva mejor los relieves y logos que el método 'sloppy')
		const r = MeshoptSimplifier.simplify(m.idx, m.pos, 3, parte.liviano * 3, 0.02);
		liviano[parte.nombre] = empaquetar(m.pos, Array.isArray(r) ? r[0] : r);
	}
	escribir(path.join(salida, 'otto3d.js'), 'completo', completo);
	escribir(path.join(salida, 'otto3d_liviano.js'), 'liviano', liviano);
})();
