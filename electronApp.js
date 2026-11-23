// MPR Blockly - proceso principal de Electron
// Basado en electronApp.js de OttoDIY/blockly (escrito para Electron 4.1.1, la
// versión que trae el instalador oficial 1.5.0). Cambios MPR marcados con "MPR:".
var {ipcMain, app, BrowserWindow, dialog, shell} = require('electron')
var path = require('path')
var fs = require('fs')
var URL = require('url').URL

// MPR: usar también las gráficas integradas o antiguas que Chromium descarta por defecto (lista negra de GPU),
// para que la mascota 3D (WebGL) se vea en todos los equipos. Sin GPU, Chromium dibuja por software (SwiftShader).
app.commandLine.appendSwitch('ignore-gpu-blacklist')

// MPR: raíz de la aplicación. Instalada: <instalación>/resources/app -> <instalación>.
// En desarrollo (npm start desde el repositorio): la carpeta del repositorio.
var APP_ROOT = fs.existsSync(path.join(__dirname, '../../www/index.html')) ? path.join(__dirname, '../..') : __dirname
var APP_ICON = path.join(APP_ROOT, 'www/media/mpr_app.ico')

var mainWindow
var termWindow
var promptWindow
var promptOptions
var promptAnswer

// MPR: los enlaces externos (logo, pie de página) se abren en el navegador del
// sistema. Antes navegaban la propia ventana de la app a un sitio web con acceso
// a Node.js y sin forma de volver.
function protectNavigation(win) {
		// MPR: F5 (recargar) solo cuando la ventana de la app tiene el foco. Antes se registraba con globalShortcut y
		// F5 dejaba de funcionar en otros programas (por ejemplo, PowerPoint) mientras la app estaba abierta.
		// F8 (consola) lo atiende www/js/mpr_monitor.js, solo con el modo monitor activo.
		win.webContents.on('before-input-event', function (event, input) {
			if (input.type !== 'keyDown') return
			if (input.key === 'F5') { event.preventDefault(); refresh(win) }
		})
	// MPR: solo se deja navegar a la misma página de la ventana con otros parámetros (los ejemplos usan
	// index.html?url=...). Antes se aceptaba cualquier file:// y soltar una foto o un .bloc sobre la ventana
	// la llevaba a ese archivo y se perdía la mesa (PLAN_PULIDO B5).
	win.webContents.on('will-navigate', function (event, url) {
		var destino = rutaDeUrlArchivo(url)
		if (destino !== null && destino === rutaDeUrlArchivo(win.webContents.getURL())) return
		event.preventDefault()
		if (esUrlWeb(url)) shell.openExternal(url)
	})
	win.webContents.on('new-window', function (event, url) {
		event.preventDefault()
		if (esUrlWeb(url)) shell.openExternal(url)
	})
}
// MPR: el navegador del sistema solo recibe direcciones web; nunca archivos ni otros protocolos (PLAN_PULIDO B7)
function esUrlWeb(url) {
	return /^https?:\/\//i.test(String(url))
}
// MPR: ruta (sin parámetros) de una dirección file://, para comparar páginas; null si no es file://
function rutaDeUrlArchivo(url) {
	try {
		var u = new URL(url)
		if (u.protocol !== 'file:') return null
		return decodeURIComponent(u.pathname).toLowerCase()
	} catch (e) {
		return null
	}
}
var INDEX_URL = "file://" + path.join(APP_ROOT, 'www/index.html')
// MPR: al abrir un .bloc con doble clic, Windows pasa la ruta como argumento.
// Se busca entre los argumentos (antes se tomaba argv[1] aunque fuera una opción)
// y se codifica para que rutas con #, & o % no se corten.
// MPR: solo .bloc y .xml: la app ya no tiene modo código para abrir .ino o .py (PLAN_PULIDO B7).
function fileFromArgv(argv) {
	for (var i = argv.length - 1; i >= 1; i--) {
		if (/\.(bloc|xml)$/i.test(argv[i]) && fs.existsSync(argv[i])) return argv[i]
	}
	return ''
}
function indexUrlFor(file) {
	return file ? INDEX_URL + '?url=' + encodeURIComponent(file) : INDEX_URL
}
function createWindow () {
	mainWindow = new BrowserWindow({width: 1240, height: 700, minWidth: 1100, minHeight: 650, icon: APP_ICON, title: 'MPR Blockly', frame: false, movable: true, show: false})
	// MPR: la ventana siempre se abre maximizada y no se puede dejar pequeña (los botones de la barra de bloques no caben)
	function mostrarMaximizada() {
		if (!mainWindow || mainWindow.isVisible()) return
		mainWindow.maximize()
		mainWindow.show()
	}
	mainWindow.once('ready-to-show', mostrarMaximizada)
	setTimeout(mostrarMaximizada, 5000)   // por si 'ready-to-show' no llega
	mainWindow.on('unmaximize', function () {
		if (mainWindow) mainWindow.maximize()
	})
	mainWindow.loadURL(indexUrlFor(fileFromArgv(process.argv)))
	mainWindow.setMenu(null)
	protectNavigation(mainWindow)
	mainWindow.on('close', preguntarAntesDeCerrar)
	mainWindow.webContents.on('crashed', function () { estadoSubida = 'libre' })
	mainWindow.on('closed', function () {
		mainWindow = null
	})
}
// MPR: Monitor Serie (modo monitor, Ctrl + Mayús + M). Ya no es modal: el monitor puede cambiar bloques y subir con
// la ventana abierta (antes de subir, la página la cierra con "cerrar-term" para soltar el puerto). Una sola a la vez.
function createTerm() {
	if (termWindow && !termWindow.isDestroyed()) { termWindow.show(); termWindow.focus(); return }
	termWindow = new BrowserWindow({width: 640, height: 560, 'parent': mainWindow, resizable: false, movable: true, frame: false, modal: false, icon: APP_ICON, title: 'Monitor Serie'})
	termWindow.loadURL("file://" + path.join(APP_ROOT, "www/term.html"))
	termWindow.setMenu(null)
	protectNavigation(termWindow)
	var esta = termWindow
	termWindow.on('closed', function () {
		if (termWindow === esta) termWindow = null
	})
}
function promptModal(options, callback) {
	promptOptions = options
	promptAnswer = null   // si la ventana se cierra sin responder (Alt+F4), no vale la respuesta anterior
	promptWindow = new BrowserWindow({width:360, height: 135, 'parent': mainWindow, resizable: false, movable: true, frame: false, modal: true})
	promptWindow.loadURL("file://" + path.join(APP_ROOT, "www/modalVar.html"))
	promptWindow.on('closed', function () {
		promptWindow = null
		callback(promptAnswer)
	})
}
// MPR: mientras Otto recibe un programa o se compila (www/js/mpr_subida.js avisa con 'subida-estado'), no se recarga
// la página ni se abre otro archivo: arduino-cli y avrdude seguirían vivos con el puerto tomado, y una compilación
// cortada deja el core de Arduino dañado (CORE_DANADO en mpr_subida.js)
// Estados: 'libre'; 'compilando' = solo la precompilación en segundo plano (el alumno no pidió nada); 'enviando' = el
// alumno verifica o envía. Con 'compilando', recargar o abrir otro archivo esperan en silencio a que termine, y cerrar
// oculta la ventana y sale al terminar. Con 'enviando' se avisa o se pregunta.
var estadoSubida = 'libre'
var cierreAutorizado = false
var cerrarAlTerminar = false
var preguntandoCierre = false
var alQuedarLibre = null     // recarga o archivo pendiente mientras termina la precompilación
var TOPE_ESPERA_MS = 90000   // si una compilación se cuelga, no esperar para siempre
function avisarOcupado(win) {
	if (!win || win.isDestroyed()) return
	dialog.showMessageBox(win, {type: 'info', title: 'MPR Blockly', buttons: ['OK'],
		message: 'Otto todavía está recibiendo un programa o preparándolo.',
		detail: 'Espera a que termine y vuelve a intentarlo.'}, function () {})
}
// Hace la acción ahora, o cuando termine la precompilación; con un envío del alumno en curso, avisa y no hace nada
function cuandoQuedeLibre(win, accion) {
	if (estadoSubida == 'enviando') { avisarOcupado(win); return }
	if (estadoSubida == 'libre') { accion(); return }
	alQuedarLibre = accion
	setTimeout(function () { if (alQuedarLibre === accion) { alQuedarLibre = null; accion() } }, TOPE_ESPERA_MS)
}
function cerrarCuandoTermine(win) {
	cerrarAlTerminar = true
	setTimeout(function () {
		if (cerrarAlTerminar && win && !win.isDestroyed()) { cerrarAlTerminar = false; cierreAutorizado = true; win.close() }
	}, TOPE_ESPERA_MS)
}
// Cerrar durante un envío pregunta: "cerrar cuando termine" espera y se cierra sola; "cerrar ya" corta solo el envío
// (avrdude). Una compilación nunca se corta: con la precompilación, la ventana se oculta y la app sale al terminar.
function preguntarAntesDeCerrar(event) {
	if (cierreAutorizado || estadoSubida == 'libre') return
	event.preventDefault()
	if (preguntandoCierre || !mainWindow) return
	var win = mainWindow
	if (estadoSubida == 'compilando') { win.hide(); cerrarCuandoTermine(win); return }
	preguntandoCierre = true
	dialog.showMessageBox(win, {type: 'question', title: 'MPR Blockly', buttons: ['Cerrar cuando termine', 'Cerrar ya (corta el envío)', 'Seguir aquí'],
		defaultId: 2, cancelId: 2, noLink: true,
		message: 'Otto todavía está recibiendo un programa o preparándolo.',
		detail: 'Si cierras ya, el envío se corta y habrá que mandarlo otra vez. Una compilación nunca se corta: la app espera a que termine para no dañar el core de Arduino.'},
	function (i) {
		preguntandoCierre = false
		if (i == 2 || !win || win.isDestroyed()) return
		if (i == 1) win.webContents.send('subida-cortar')
		if (estadoSubida == 'libre') { cierreAutorizado = true; win.close(); return }
		win.hide()
		cerrarCuandoTermine(win)
	})
}
function refresh(mainWindow = BrowserWindow.getFocusedWindow()) {
	if (!mainWindow) return
	var win = mainWindow
	cuandoQuedeLibre(win, function () { if (!win.isDestroyed()) win.webContents.reloadIgnoringCache() })
}
// MPR: una sola instancia; si ya está abierta, se trae al frente
var gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
	app.quit()
} else {
	app.on('second-instance', function (event, argv) {
		if (mainWindow) {
			if (mainWindow.isMinimized()) mainWindow.restore()
			mainWindow.focus()
			// doble clic en otro .bloc con la app abierta: abrirlo en la ventana actual (salvo si Otto está recibiendo un programa)
			var file = fileFromArgv(argv)
			var win = mainWindow
			if (file) cuandoQuedeLibre(win, function () { if (!win.isDestroyed()) win.loadURL(indexUrlFor(file)) })
		}
	})
	app.on('ready',  function () {
		createWindow()
	})
}
app.on('activate', function () {
	if (mainWindow === null) createWindow()
})
app.on('window-all-closed', function () {
	if (process.platform !== 'darwin') app.quit()
})
ipcMain.on("prompt", function () {
	createTerm()
})
// MPR: antes de subir (o de averiguar la placa), la página cierra el Monitor Serie para que suelte el puerto: con él
// abierto, avrdude no podía abrir el COM (código P3). Responde "term-cerrado" con true si estaba abierto, un momento
// después de que la ventana se cerró (el controlador USB tarda un poco en liberar el puerto).
ipcMain.on("cerrar-term", function (event) {
	var w = termWindow, quien = event.sender
	var responder = function (estaba) {
		if (!quien.isDestroyed()) quien.send('term-cerrado', estaba)
	}
	if (!w || w.isDestroyed()) { responder(false); return }
	w.once('closed', function () { setTimeout(function () { responder(true) }, 400) })
	w.close()
})
ipcMain.on("openDialog", function (event, data) {
    event.returnValue = JSON.stringify(promptOptions, null, '')
})
ipcMain.on("closeDialog", function (event, data) {
	promptAnswer = data
})
ipcMain.on("modalVar", function (event, arg) {
	promptModal(
		{"label": arg, "value": "", "ok": "OK"},
	    function(data) {
	       event.returnValue = data
        }
	)
})
// MPR: www/js/mpr_subida.js avisa si hay un envío o una compilación en curso (así no se recarga ni se cierra a medias)
ipcMain.on('subida-estado', function (event, estado) {
	estadoSubida = (estado == 'enviando' || estado == 'compilando') ? estado : 'libre'
	if (estadoSubida != 'libre') return
	if (cerrarAlTerminar && mainWindow) {
		cerrarAlTerminar = false
		cierreAutorizado = true
		mainWindow.close()
		return
	}
	if (alQuedarLibre) { var accion = alQuedarLibre; alQuedarLibre = null; accion() }
})
ipcMain.on('save-ino', function (event) {
	dialog.showSaveDialog(mainWindow,{
		title: 'Guardar como .INO',
		defaultPath: 'MPR_Arduino',
		filters: [{ name: 'Arduino', extensions: ['ino'] }]
	},
	function(filename){
		if (filename) event.sender.send('saved-ino', filename)
	})
})
ipcMain.on('save-bloc', function (event) {
	dialog.showSaveDialog(mainWindow,{
		title: 'Guardar proyecto (.BLOC)',
		defaultPath: 'MPR_proyecto',
		filters: [{ name: 'MPR Blockly', extensions: ['bloc'] }]
	},
	function(filename){
		if (filename) event.sender.send('saved-bloc', filename)
	})
})
ipcMain.on('save-csv', function (event) {
	dialog.showSaveDialog(mainWindow,{
		title: 'Guardar como CSV',
		defaultPath: 'MPR_datos',
		filters: [{ name: 'datos', extensions: ['csv'] }]
	},
	function(filename){
		if (filename) event.sender.send('saved-csv', filename)
	})
})
module.exports.refresh = refresh
