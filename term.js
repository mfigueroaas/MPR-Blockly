// MPR: Monitor Serie (www/term.html), para los monitores de cada mesa (modo monitor, Ctrl + Mayús + M; ver
// DOCUMENTACION_TECNICA.md 4.14). Usa serialport 7 (el de Electron 4): new SerialPort(puerto, { baudRate, autoOpen }).
//  - Se conecta solo al abrir, al puerto elegido en la ventana principal (localStorage.com) y a localStorage.baudrate
//    (9600 si no hay otra): al conectarse, el Nano se reinicia y se ve lo que escribe desde el principio.
//  - Lo que se escribe abajo se manda con Enter y termina en salto de línea, como el Monitor Serie de Arduino con
//    "Nueva línea" (los bloques "número/texto que llegó del Monitor Serie" leen hasta ese salto).
//  - Al cerrar la ventana se cierra el puerto. La ventana principal la cierra sola antes de subir un programa
//    (ipc "cerrar-term" en electronApp.js): con el puerto tomado, la subida fallaba (código P3).
// Antes: textos en inglés y francés, había que apretar Start, lo recibido se insertaba como HTML y el texto se copiaba
// entero en cada dato (la ventana se ponía lenta con un programa que escribe seguido).
var { ipcRenderer } = require("electron")
var remote = require('electron').remote
var fs = require('fs')
var StringDecoder = require('string_decoder').StringDecoder

var MAX_TEXTO = 60000      // caracteres que se guardan en pantalla (se descartan los más antiguos)
var puerto = null          // SerialPort abierto (o abriéndose)
var conectado = false
var texto = ''
var pintarT = null

function $id(id) { return document.getElementById(id) }

function baudios() {
	var b = parseInt(localStorage.getItem('baudrate'), 10)
	return b > 0 ? b : 9600
}

function nombrePuerto() {
	var c = localStorage.getItem('com')
	return c && c != 'com' ? c : ''
}

// Agrega texto a la ventana; la pantalla se repinta como mucho cada 80 ms
function agregar(t) {
	texto += t
	if (texto.length > MAX_TEXTO) {
		texto = texto.slice(texto.length - MAX_TEXTO * 0.8)
		var salto = texto.indexOf('\n')
		if (salto >= 0 && salto < 200) texto = texto.slice(salto + 1)
	}
	if (!pintarT) pintarT = setTimeout(pintar, 80)
}

function pintar() {
	pintarT = null
	var v = $id('fenetre_term')
	var alFinal = v.scrollTop + v.clientHeight >= v.scrollHeight - 30
	v.textContent = texto
	if (alFinal) v.scrollTop = v.scrollHeight
}

function aviso(t) {
	agregar((texto && texto.slice(-1) != '\n' ? '\n' : '') + '--- ' + t + ' ---\n')
}

function actualizarBotones() {
	$id('btn_connect').innerHTML = conectado ?
		"<span class='fa fa-pause'></span> Desconectar" :
		"<span class='fa fa-play'></span> Conectar"
	$id('btn_envoi').disabled = !conectado
	var p = nombrePuerto()
	$id('mpr_term_estado').textContent = (p ? 'Puerto ' + p : 'Sin puerto elegido') + ' · ' + baudios() + ' baudios' +
		(conectado ? ' · conectado' : '')
	$id('mpr_term_estado').className = conectado ? 'conectado' : ''
}

function conectar() {
	var p = nombrePuerto()
	if (!p) {
		aviso('No hay un puerto elegido: conecta a Otto con el cable y elige su puerto en la ventana principal')
		actualizarBotones()
		return
	}
	var SerialPort = require('serialport')
	var sp = new SerialPort(p, { baudRate: baudios(), autoOpen: false })
	puerto = sp
	conectado = true
	actualizarBotones()
	var dec = new StringDecoder('utf8')   // un carácter UTF-8 partido entre dos paquetes no se rompe
	sp.on('data', function (datos) {
		if (puerto === sp) agregar(dec.write(datos).replace(/\r\n?/g, '\n'))
	})
	sp.on('close', function (err) {
		if (puerto !== sp) return
		puerto = null
		conectado = false
		aviso(err && err.disconnected ? 'Otto se desconectó (¿se soltó el cable?)' : 'Desconectado')
		actualizarBotones()
	})
	sp.on('error', function (err) {
		console.log('[Monitor Serie]', err)
	})
	sp.open(function (err) {
		if (puerto !== sp) { if (!err) sp.close(function () {}); return }   // se pidió desconectar mientras abría
		if (err) {
			puerto = null
			conectado = false
			aviso('No pude abrir ' + p + ': ' + err.message + '. Si dice "Access denied", otro programa lo está usando ' +
				'(otra MPR Blockly, Arduino IDE o una subida en curso)')
		} else {
			aviso('Conectado a ' + p + ' a ' + baudios() + ' baudios. Al conectarse, Otto se reinicia')
		}
		actualizarBotones()
	})
}

function desconectar(alTerminar) {
	var sp = puerto
	puerto = null
	conectado = false
	if (sp && sp.isOpen) sp.close(function () { if (alTerminar) alTerminar() })
	else if (alTerminar) alTerminar()
	aviso('Desconectado')
	actualizarBotones()
}

function enviar() {
	var caja = $id('schbox')
	if (!puerto || !puerto.isOpen) return
	puerto.write(caja.value + '\n', function (err) { if (err) aviso('No pude enviar: ' + err.message) })
	agregar('→ ' + caja.value + '\n')
	caja.value = ''
	caja.focus()
}

window.addEventListener('load', function load(event) {
	if (!localStorage.getItem('baudrate')) localStorage.setItem('baudrate', 9600)
	$id('vitesse').value = String(baudios())
	if (!$id('vitesse').value) { $id('vitesse').value = '9600'; localStorage.setItem('baudrate', 9600) }
	$id('vitesse').onchange = function () {
		localStorage.setItem('baudrate', $id('vitesse').value)
		if (conectado) desconectar(conectar); else actualizarBotones()
	}
	$id('btn_efface').onclick = function () {
		texto = ''
		pintar()
	}
	$id('btn_envoi').onclick = enviar
	$id('schbox').addEventListener('keydown', function (e) {
		if (e.keyCode == 13) { e.preventDefault(); enviar() }
	})
	$id('btn_quit').onclick = function () {
		remote.getCurrentWindow().close()
	}
	$id('btn_connect').onclick = function () {
		if (conectado) desconectar(); else conectar()
	}
	$id('btn_csv').onclick = function () {
		ipcRenderer.send('save-csv')
	}
	actualizarBotones()
	conectar()
})

// Al cerrar la ventana (con la ✕ o porque se va a subir un programa) se suelta el puerto
window.addEventListener('beforeunload', function () {
	var sp = puerto
	puerto = null
	if (sp && sp.isOpen) { try { sp.close(function () {}) } catch (e) {} }
})

ipcRenderer.on('saved-csv', function (event, ruta) {
	if (!ruta) return
	fs.writeFile(ruta, texto, function (err) {
		if (err) aviso('No pude guardar el archivo: ' + err.message)
		else aviso('Guardado en ' + ruta)
	})
})
