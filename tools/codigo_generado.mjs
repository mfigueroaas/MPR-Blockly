// MPR: saca el C++ que generan los bloques DENTRO de la app (Electron 4) por DevTools, para comparar antes y después
// de tocar generadores (limpieza de código muerto). Genera el código de (a) cada ejemplo visible y (b) cada bloque del toolbox
// puesto solo en la mesa. No cambia nada guardado: respalda y restaura localStorage y la mesa.
//
//   1) Abrir la app (o la copia C:\mprbp) con:  "MPR Blockly.exe" --remote-debugging-port=9222   (ventana visible)
//   2) node tools/codigo_generado.mjs salida.json
//   3) Tras el cambio: reabrir/F5 y repetir con otro nombre; comparar con  node tools/codigo_generado.mjs --comparar a.json b.json
// Node 22 o más nuevo (trae WebSocket y fetch).
import fs from 'fs';

const PUERTO = 9222;
const espera = ms => new Promise(r => setTimeout(r, ms));

if (process.argv[2] === '--comparar') {
	const a = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')), b = JSON.parse(fs.readFileSync(process.argv[4], 'utf8'));
	let dif = 0;
	for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (a[k] !== b[k]) { dif++; console.log('DISTINTO:', k); }
	console.log(`${Object.keys(a).length} vs ${Object.keys(b).length} entradas, ${dif} diferencias`);
	process.exit(dif ? 1 : 0);
}

const salida = process.argv[2];
if (!salida) { console.log('Uso: node tools/codigo_generado.mjs salida.json'); process.exit(2); }

const lista = await (await fetch(`http://127.0.0.1:${PUERTO}/json`)).json();
const t = lista.find(x => x.type === 'page' && x.url.replace(/\\/g, '/').includes('www/index.html'));
if (!t) throw new Error('No encuentro la ventana principal (puerto ' + PUERTO + ').');
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((ok, mal) => { ws.onopen = ok; ws.onerror = () => mal(new Error('sin DevTools')); });
let id = 0; const pend = new Map();
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.mal(new Error(JSON.stringify(m.error))) : p.ok(m.result); } };
const evalPag = async expr => {
	const i = ++id; ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true } }));
	const r = await new Promise((ok, mal) => pend.set(i, { ok, mal }));
	if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 500));
	return r.result.value;
};
for (let i = 0; i < 60 && !(await evalPag(`!!(window.Blockly && Blockly.mainWorkspace && document.readyState=='complete')`)); i++) await espera(500);

const res = await evalPag(`(async function(){
	window.alert = function(){};
	var out = {}, copia = Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(Blockly.mainWorkspace));
	function gen(){ try { return Blockly.Arduino.workspaceToCode(Blockly.mainWorkspace); } catch(e) { return 'ERROR: ' + e.message; } }
	var ej = await (await fetch('examples/examples.json')).json();
	for (var i = 0; i < ej.length; i++) {
		if (!ej[i].source_url || ej[i].visible === false) continue;
		var txt = await (await fetch('examples/' + ej[i].source_url)).text();
		Blockly.mainWorkspace.clear();
		Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(txt), Blockly.mainWorkspace);
		out['ejemplo:' + ej[i].source_url] = gen();
	}
	var tb = await (await fetch('toolbox/toolbox_arduino_all.xml')).text();
	tb = tb.replace(/<!--[\\s\\S]*?-->/g, '');
	var doc = new DOMParser().parseFromString('<r>' + tb.replace(/<\\?xml[^>]*>/, '').replace(/<\\/?(xml|category)[^>]*>/g, function(m){return m;}) + '</r>', 'text/xml');
	var bloques = doc.querySelectorAll('block');
	var n = 0;
	for (var j = 0; j < bloques.length; j++) {
		if (bloques[j].parentNode && bloques[j].parentNode.nodeName == 'value') continue;  // anidados: ya van dentro de su padre
		Blockly.mainWorkspace.clear();
		var x = document.implementation.createDocument(null, 'xml');
		var raiz = x.documentElement; raiz.appendChild(x.importNode(bloques[j], true));
		try { Blockly.Xml.domToWorkspace(raiz, Blockly.mainWorkspace); } catch(e) { out['bloque:' + j] = 'ERROR carga: ' + e.message; continue; }
		var tipo = bloques[j].getAttribute('type');
		out['bloque:' + String(j).padStart(3,'0') + ':' + tipo] = gen();
		n++;
	}
	Blockly.mainWorkspace.clear();
	Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(copia), Blockly.mainWorkspace);
	return out;
})()`);
fs.writeFileSync(salida, JSON.stringify(res, null, 1));
console.log(Object.keys(res).length + ' entradas ->', salida);
ws.close();
