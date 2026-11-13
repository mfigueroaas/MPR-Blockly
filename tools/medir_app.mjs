// MPR: mide el rendimiento DENTRO de la app instalada (Electron 4.1.1 / Chromium 69) por el protocolo DevTools,
// el mismo que usa F12. Sirve para comprobar en los PCs del colegio (gráfica integrada) que el recorrido y Otto 3D
// van fluidos. No cambia nada guardado (posición, colores, marcas del recorrido).
//
// 1) Cerrar MPR Blockly y abrirlo con el puerto de depuración (solo escucha en 127.0.0.1):
//      "C:\MPRBlockly\MPR Blockly.exe" --remote-debugging-port=9222
//    (agregar --disable-gpu para simular un PC sin aceleración gráfica)
// 2) node tools/medir_app.mjs <orden> [segundos]          (Node 22 o más nuevo: trae WebSocket y fetch)
//      info       GPU, WebGL, modelo de Otto elegido, cuadros por segundo y memoria
//      recorrido  abre el recorrido y mide los cuadros por segundo de cada transición (lo ideal: 55-60)
//      capas      capas del compositor con el recorrido abierto (tamaño y motivo de cada una)
//      reposo     CPU y memoria de cada proceso de la app en reposo, N segundos (Otto no pasea mientras mide)
//      escenario  "Probar en pantalla" con Otto escondido: tiempo hasta el 2.º cuadro al abrir (10 veces), sombreadores,
//                 oyentes y memoria tras abrir y cerrar 10 veces, y cuadros/s y CPU con el escenario quieto (máx. 10 s)
// 3) Al terminar, cerrar la app y abrirla normal (sin el puerto).
import { execFileSync } from 'child_process';

const PUERTO = 9222;
const espera = ms => new Promise(r => setTimeout(r, ms));

async function conectar() {
	let lista;
	try { lista = await (await fetch(`http://127.0.0.1:${PUERTO}/json`)).json(); }
	catch (e) { throw new Error(`No hay app escuchando en el puerto ${PUERTO}. Ábrela con --remote-debugging-port=${PUERTO}.`); }
	const t = lista.find(x => x.type === 'page' && x.url.replace(/\\/g, '/').includes('www/index.html'));
	if (!t) throw new Error('No encuentro la ventana principal de MPR Blockly.');
	const ws = new WebSocket(t.webSocketDebuggerUrl);
	await new Promise((ok, mal) => { ws.onopen = ok; ws.onerror = () => mal(new Error('No se pudo conectar al DevTools de la app.')); });
	let id = 0;
	const pend = new Map(), oyentes = new Map();
	ws.onmessage = ev => {
		const m = JSON.parse(ev.data);
		if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.mal(new Error(JSON.stringify(m.error))) : p.ok(m.result); }
		else if (m.method) (oyentes.get(m.method) || []).forEach(f => f(m.params));
	};
	const app = {
		send(method, params = {}) { const i = ++id; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((ok, mal) => pend.set(i, { ok, mal })); },
		on(ev, f) { if (!oyentes.has(ev)) oyentes.set(ev, []); oyentes.get(ev).push(f); },
		async eval(expr) {
			const r = await app.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
			if (r.exceptionDetails) throw new Error('Error en la página: ' + JSON.stringify(r.exceptionDetails).slice(0, 400));
			return r.result.value;
		},
		cerrar() { ws.close(); }
	};
	for (let i = 0; i < 60 && !(await app.eval(`!!(window.MPRTour && document.readyState == 'complete')`)); i++) await espera(500);
	return app;
}

async function info(app) {
	const r = await app.eval(`(function(){
		var r = { app: navigator.userAgent.replace(/.*(MPRBlockly\\/\\S+).*(Chrome\\/\\S+).*(Electron\\/\\S+).*/, '$1 $2 $3'), escala: devicePixelRatio, vista: innerWidth + 'x' + innerHeight };
		try { var g = require('electron').remote.app.getGPUFeatureStatus(); r.gpu = { composicion: g.gpu_compositing, rasterizado: g.rasterization, webgl: g.webgl }; } catch (e) { r.gpu = 'n/d (fuera de Electron)'; }
		if (window.MPROtto3D && MPROtto3D.renderer) {
			try { var gl = MPROtto3D.renderer.getContext(), x = gl.getExtension('WEBGL_debug_renderer_info'); r.webgl = x ? gl.getParameter(x.UNMASKED_RENDERER_WEBGL) : '?'; } catch (e) {}
			r.otto = MPROtto3D.estadisticas(); r.modoEconomico = MPROtto3D.economia;
		} else r.otto = window.MPRMascota && MPRMascota.modo3d === false ? 'sin 3D (escondido o respaldo 2D)' : 'cargando';
		return r;
	})()`);
	console.log(JSON.stringify(r, null, 2));
}

// Graba requestAnimationFrame mientras pasa de un paso al siguiente: cuántos cuadros hubo en los 400 ms de la transición
function medirPaso(app, accion) {
	return app.eval(`new Promise(function(ok){
		var t = [], ini = performance.now();
		${accion};
		requestAnimationFrame(function f(ts){ t.push(ts); if (ts - ini < 700) requestAnimationFrame(f); else ok({ ini: ini, t: t }); });
	})`).then(r => {
		const tt = [r.ini, ...r.t], d = [];
		for (let i = 1; i < tt.length; i++) d.push(tt[i] - tt[i - 1]);
		return { fps: Math.round(r.t.filter(x => x - r.ini <= 400).length / 0.4), peorCuadroMs: +Math.max(...d).toFixed(1), cuadrosLentos: d.filter(x => x > 25).length };
	});
}

async function recorrido(app) {
	await app.eval(`(function(){ if (window.MPRMascota && MPRMascota.cerrarGlobo) MPRMascota.cerrarGlobo(); return true; })()`);
	const filas = [{ paso: 'inicio', ...(await medirPaso(app, 'MPRTour.iniciar()')) }];
	await espera(500);
	const total = await app.eval('MPRTour.pasos.length');
	for (let i = 1; i < total; i++) {
		const r = await medirPaso(app, 'MPRTour.ir(1)');
		filas.push({ paso: await app.eval('MPRTour.pasos[MPRTour.actual].id'), ...r });
		await espera(500);
	}
	filas.push({ paso: 'salto largo a bloques', ...(await medirPaso(app, 'MPRTour.actual = 1; MPRTour.mostrar()')) });
	// se cierra sin MPRTour.cerrar() para no tocar la marca "ya visto"
	await app.eval(`(function(){ MPRTour.activo = false; document.getElementById('mpr_tour_velo').style.display = 'none'; return true; })()`);
	console.table(filas);
}

async function capas(app) {
	await app.send('DOM.enable');
	let lista = [];
	app.on('LayerTree.layerTreeDidChange', p => { if (p.layers) lista = p.layers; });
	await app.send('LayerTree.enable');
	await app.eval(`(function(){ MPRTour.iniciar(); MPRTour.actual = Math.min(1, MPRTour.pasos.length - 1); MPRTour.mostrar(); return true; })()`);
	await espera(1500);
	const filas = [];
	for (const l of lista) {
		if (!l.drawsContent) continue;
		let nodo = '', razones = '';
		try { razones = (await app.send('LayerTree.compositingReasons', { layerId: l.layerId })).compositingReasons.join(', '); } catch (e) {}
		if (l.backendNodeId) {
			try { const d = (await app.send('DOM.describeNode', { backendNodeId: l.backendNodeId })).node, a = d.attributes || [], i = a.indexOf('id'); nodo = d.nodeName.toLowerCase() + (i >= 0 ? '#' + a[i + 1] : ''); } catch (e) {}
		}
		filas.push({ capa: nodo || '(página)', ancho: Math.round(l.width), alto: Math.round(l.height), motivo: razones.slice(0, 60) });
	}
	await app.eval(`(function(){ MPRTour.activo = false; document.getElementById('mpr_tour_velo').style.display = 'none'; return true; })()`);
	await app.send('LayerTree.disable');
	console.table(filas);
	console.log('Tamaños en píxeles reales de pantalla. Ninguna capa debería ser mucho más grande que la ventana.');
}

async function reposo(app, seg) {
	const paseaba = await app.eval(`(function(){ var p = MPRMascota.paseando; MPRMascota.cancelarPaseo(true); MPRMascota.paseando = false; MPRMascota.cerrarGlobo(); return p; })()`);
	await espera(1500);
	const ps = `$t=@{}; $a=@{}; Get-CimInstance Win32_Process -Filter "Name='MPR Blockly.exe'" | ForEach-Object { $k = if ($_.CommandLine -match '--type=(\\S+)') { $Matches[1] } else { 'principal' }; $t[[int]$_.ProcessId] = $k; $a[[int]$_.ProcessId] = (Get-Process -Id $_.ProcessId).TotalProcessorTime.TotalMilliseconds }
		$t0 = Get-Date; Start-Sleep -Seconds ${seg}; $dt = ((Get-Date) - $t0).TotalMilliseconds; $tot = 0
		foreach ($id in $t.Keys) { $p = Get-Process -Id $id -ErrorAction SilentlyContinue; if (!$p) { continue }; $c = ($p.TotalProcessorTime.TotalMilliseconds - $a[$id]) / $dt * 100; [string]::Format([Globalization.CultureInfo]::InvariantCulture, '{0};{1:F2};{2:F0}', $t[$id], $c, $p.PrivateMemorySize64 / 1MB) }`;
	let total = 0;
	try {
		// PowerShell entrega solo datos (tipo;cpu;memoria); el texto se arma aquí para no estropear los acentos
		for (const linea of execFileSync('powershell', ['-NoProfile', '-Command', ps]).toString().trim().split(/\r?\n/)) {
			const [tipo, cpu, mem] = linea.split(';');
			total += +cpu;
			console.log(`${tipo.padEnd(13)} CPU ${(+cpu).toFixed(2).padStart(6)} %   memoria privada ${mem.padStart(5)} MB`);
		}
		console.log(`TOTAL         CPU ${total.toFixed(2).padStart(6)} % de un núcleo durante ${seg} s`);
	} finally { await app.eval(`(function(){ MPRMascota.paseando = ${paseaba}; if (MPRMascota.paseando) MPRMascota.planificar(); return true; })()`); }
	console.log('Con Otto visible, casi todo este consumo es su animación en reposo (12 cuadros/s, 8 sin aceleración gráfica).');
}

// MPR: PLAN_PULIDO C1/C2. Memoria privada (MB) y tiempo de CPU (ms) de cada proceso de la app en este momento
function procesos() {
	const ps = `Get-CimInstance Win32_Process -Filter "Name='MPR Blockly.exe'" | ForEach-Object { $k = if ($_.CommandLine -match '--type=(\\S+)') { $Matches[1] } else { 'principal' }; $p = Get-Process -Id $_.ProcessId; [string]::Format([Globalization.CultureInfo]::InvariantCulture, '{0};{1};{2:F0};{3:F0}', $_.ProcessId, $k, $p.TotalProcessorTime.TotalMilliseconds, $p.PrivateMemorySize64 / 1MB) }`;
	const r = {};
	for (const linea of execFileSync('powershell', ['-NoProfile', '-Command', ps]).toString().trim().split(/\r?\n/)) {
		const [pid, tipo, cpu, mem] = linea.split(';');
		if (pid) r[pid] = { tipo, cpu: +cpu, mem: +mem };
	}
	return r;
}

// Escenario "Probar en pantalla" con Otto escondido (como parte la app): cuánto tarda en abrir, cuánto gasta abierto y
// quieto, y si queda algo acumulado tras abrirlo y cerrarlo 10 veces. No cambia nada guardado: si Otto estaba a la
// vista, se esconde mientras mide y al final vuelve (con su marca "oculta" de antes).
async function escenario(app, seg) {
	seg = Math.min(seg, 10);
	const antes = await app.eval(`(function(){
		var caja = document.getElementById('mpr_masc'), r = { visible: !!(caja && caja.style.display != 'none'), paseaba: MPRMascota.paseando, oculta: localStorage.getItem('mpr_masc_oculta') };
		MPRMascota.cancelarPaseo(true); MPRMascota.paseando = false; MPRMascota.cerrarGlobo();
		if (MPRSimulador.abierto) MPRSimulador.cerrar();
		if (r.visible) MPRMascota.esconder();
		return r;
	})()`);
	const oyentes = async () => {
		const d = await app.send('Runtime.evaluate', { expression: 'document' });
		const l = (await app.send('DOMDebugger.getEventListeners', { objectId: d.result.objectId })).listeners;
		return l.filter(x => x.type === 'visibilitychange').length;
	};
	const memoria = async () => {
		try { await app.send('HeapProfiler.collectGarbage'); } catch (e) {}
		await espera(500);
		const js = await app.eval(`performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1`);
		const p = procesos();
		return { js, procesos: Object.values(p).reduce((s, x) => s + x.mem, 0), gpu: Object.values(p).filter(x => x.tipo === 'gpu-process').reduce((s, x) => s + x.mem, 0) };
	};
	// Abre el escenario y espera el SEGUNDO cuadro dibujado de Otto; "peorCuadroMs" = el mayor tiempo sin pintar la ventana
	const abrir = () => app.eval(`new Promise(function(ok){
		var O = window.MPROtto3D, r0 = O && O.renderer, f0 = r0 ? r0.info.render.frame : 0, ini = performance.now(), prev = ini, peor = 0;
		MPRSimulador.abrir();
		requestAnimationFrame(function f(){
			var ahora = performance.now(), R = window.MPROtto3D && MPROtto3D.renderer;
			peor = Math.max(peor, ahora - prev); prev = ahora;
			if (R && MPRSimulador.con3d && R.info.render.frame >= (R === r0 ? f0 : 0) + 2) return ok({ ms: Math.round(ahora - ini), peorCuadroMs: Math.round(peor), rendererNuevo: R !== r0 });
			if (ahora - ini > 20000) return ok({ ms: -1, peorCuadroMs: Math.round(peor), rendererNuevo: R !== r0 });
			requestAnimationFrame(f);
		});
	})`);
	try {
		const m0 = await memoria(), o0 = await oyentes();
		const filas = [];
		for (let i = 1; i <= 10; i++) {
			filas.push({ vez: i, ...(await abrir()) });
			await espera(400);
			await app.eval(`(function(){ MPRSimulador.cerrar(); return true; })()`);
			await espera(400);
		}
		console.log('Abrir el escenario con Otto escondido hasta el 2.º cuadro (la 1.ª vez puede incluir cargar el modelo):');
		console.table(filas);
		const m1 = await memoria(), o1 = await oyentes();
		await abrir();
		const prog = await app.eval(`(function(){ var i = MPROtto3D.renderer.info; return { programas: i.programs ? i.programs.length : -1, geometrias: i.memory.geometries, texturas: i.memory.textures }; })()`);
		console.log(`Tras abrir y cerrar 10 veces: sombreadores ${prog.programas}, geometrías ${prog.geometrias}, texturas ${prog.texturas}; oyentes visibilitychange ${o0} -> ${o1}`);
		console.log(`Memoria (tras recolectar basura): JS ${m0.js} -> ${m1.js} MB; procesos ${m0.procesos} -> ${m1.procesos} MB (GPU ${m0.gpu} -> ${m1.gpu} MB)`);
		// Escenario abierto y quieto: se deja asentar la cámara y se mide
		await espera(3000);
		const f0 = await app.eval('MPROtto3D.renderer.info.render.frame'), p0 = procesos(), t0 = Date.now();
		await espera(seg * 1000);
		const f1 = await app.eval('MPROtto3D.renderer.info.render.frame'), p1 = procesos(), dt = Date.now() - t0;
		let total = 0;
		for (const pid in p1) {
			if (!p0[pid]) continue;
			const c = (p1[pid].cpu - p0[pid].cpu) / dt * 100;
			total += c;
			console.log(`${p1[pid].tipo.padEnd(13)} CPU ${c.toFixed(2).padStart(6)} %   memoria privada ${String(p1[pid].mem).padStart(5)} MB`);
		}
		console.log(`Escenario abierto y quieto ${Math.round(dt / 1000)} s: ${((f1 - f0) * 1000 / dt).toFixed(1)} cuadros/s dibujados; CPU total ${total.toFixed(2)} % de un núcleo`);
		console.log('(La CPU de PowerShell se mide en pasos de ~15 ms: para comparar, repetir 2 o 3 veces.)');
	} finally {
		await app.eval(`(function(){ if (MPRSimulador.abierto) MPRSimulador.cerrar(); MPRMascota.cancelarPaseo(true); if (${antes.visible}) MPRMascota.mostrar(); return true; })()`);
		await espera(1200);
		await app.eval(`(function(){
			MPRMascota.cerrarGlobo();
			var o = ${JSON.stringify(antes.oculta)};
			if (o === null) localStorage.removeItem('mpr_masc_oculta'); else localStorage.setItem('mpr_masc_oculta', o);
			MPRMascota.paseando = ${antes.paseaba}; if (MPRMascota.paseando) MPRMascota.planificar();
			return true;
		})()`);
	}
}

const orden = process.argv[2], seg = Math.max(5, +(process.argv[3] || 20));
const ordenes = { info, recorrido, capas, reposo, escenario };
if (!ordenes[orden]) {
	console.log('Uso: node tools/medir_app.mjs info | recorrido | capas | reposo [segundos] | escenario');
	process.exit(1);
}
const app = await conectar();
try { await ordenes[orden](app, seg); } finally { app.cerrar(); }
