'use strict';
// Servidor estático mínimo para probar la interfaz (www/) en un navegador de escritorio, sin instalar la app.
// Solo escucha en 127.0.0.1. Uso:   node tools/servidor_local.js [puerto]   y abrir http://127.0.0.1:8765/index.html
// Sirve para ver la mascota 3D, el recorrido y los consejos con WebGL real. NO tiene Electron: no hay puerto USB,
// compilación ni subida (los botones de cargar/verificar no funcionan). El navegador de prueba es un Chrome moderno,
// no el Chromium 69 de Electron 4: lo que funcione aquí hay que confirmarlo también en la app instalada.
const http = require('http'), fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..', 'www');
const puerto = parseInt(process.argv[2] || '8765', 10);
const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png',
	'.svg': 'image/svg+xml', '.xml': 'text/xml', '.json': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };
http.createServer(function(req, res) {
	let ruta = decodeURIComponent(req.url.split('?')[0]);
	if (ruta === '/') ruta = '/index.html';
	const archivo = path.join(raiz, ruta);
	if (archivo.indexOf(raiz) !== 0) { res.writeHead(403); res.end(); return; }   // no salir de www/
	fs.readFile(archivo, function(e, datos) {
		if (e) { res.writeHead(404); res.end(); return; }
		res.writeHead(200, { 'Content-Type': tipos[path.extname(archivo)] || 'application/octet-stream' });
		res.end(datos);
	});
}).listen(puerto, '127.0.0.1', function() { console.log('MPR Blockly (solo interfaz) en http://127.0.0.1:' + puerto + '/index.html'); });
