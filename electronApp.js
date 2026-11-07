// MPR Blockly - proceso principal de Electron
// Basado en electronApp.js de OttoDIY/blockly (escrito para Electron 4.1.1, la
// versión que trae el instalador oficial 1.5.0). Cambios MPR marcados con "MPR:".
var {electron, ipcMain, app, BrowserWindow, globalShortcut, dialog, shell} = require('electron')
var path = require('path')
var fs = require('fs')

// MPR: el actualizador automático apuntaba a OttoDIY/blockly y habría reemplazado
// MPR Blockly por Otto Blockly oficial. Queda desactivado.
var UPDATES_ENABLED = false
var autoUpdater = null
if (UPDATES_ENABLED) {
	autoUpdater = require("electron-updater").autoUpdater
	autoUpdater.autoDownload = false
	autoUpdater.logger = null
}

// MPR: raíz de la aplicación. Instalada: <instalación>/resources/app -> <instalación>.
// En desarrollo (npm start desde el repositorio): la carpeta del repositorio.
var APP_ROOT = fs.existsSync(path.join(__dirname, '../../www/index.html')) ? path.join(__dirname, '../..') : __dirname
var APP_ICON = path.join(APP_ROOT, 'www/media/mpr_app.ico')

var mainWindow
var termWindow
var factoryWindow
var promptWindow
var promptOptions
var promptAnswer

// MPR: los enlaces externos (logo, pie de página) se abren en el navegador del
// sistema. Antes navegaban la propia ventana de la app a un sitio web con acceso
// a Node.js y sin forma de volver.
function protectNavigation(win) {
	// MPR: F5 (recargar) y F8 (consola) solo cuando la ventana de la app tiene el foco.
	// Antes se registraban con globalShortcut y F5 dejaba de funcionar en otros
	// programas (por ejemplo, PowerPoint) mientras la app estaba abierta.
	win.webContents.on('before-input-event', function (event, input) {
		if (input.type !== 'keyDown') return
		if (input.key === 'F5') { event.preventDefault(); refresh(win) }
		if (input.key === 'F8') { event.preventDefault(); open_console(win) }
	})
	win.webContents.on('will-navigate', function (event, url) {
		if (url.indexOf('file://') !== 0) {
			event.preventDefault()
			shell.openExternal(url)
		}
	})
	win.webContents.on('new-window', function (event, url) {
		event.preventDefault()
		if (url.indexOf('file://') !== 0) shell.openExternal(url)
	})
}
var INDEX_URL = "file://" + path.join(APP_ROOT, 'www/index.html')
// MPR: al abrir un .bloc con doble clic, Windows pasa la ruta como argumento.
// Se busca entre los argumentos (antes se tomaba argv[1] aunque fuera una opción)
// y se codifica para que rutas con #, & o % no se corten.
function fileFromArgv(argv) {
	for (var i = argv.length - 1; i >= 1; i--) {
		if (/\.(bloc|xml|ino|py)$/i.test(argv[i]) && fs.existsSync(argv[i])) return argv[i]
	}
	return ''
}
function indexUrlFor(file) {
	return file ? INDEX_URL + '?url=' + encodeURIComponent(file) : INDEX_URL
}
function createWindow () {
	mainWindow = new BrowserWindow({width: 1240, height: 700, minWidth: 800, minHeight: 560, icon: APP_ICON, title: 'MPR Blockly', frame: false, movable: true})
	mainWindow.loadURL(indexUrlFor(fileFromArgv(process.argv)))
	mainWindow.setMenu(null)
	protectNavigation(mainWindow)
	mainWindow.on('closed', function () {
		mainWindow = null
	})
}
function createTerm() {
	termWindow = new BrowserWindow({width: 640, height: 560, 'parent': mainWindow, resizable: false, movable: true, frame: false, modal: true, icon: APP_ICON})
	termWindow.loadURL("file://" + path.join(APP_ROOT, "www/term.html"))
	termWindow.setMenu(null)
	protectNavigation(termWindow)
	termWindow.on('closed', function () {
		termWindow = null
	})
}
function createRepl() {
	termWindow = new BrowserWindow({width: 640, height: 515, 'parent': mainWindow, resizable: false, movable: true, frame: false, modal: true, icon: APP_ICON})
	termWindow.loadURL("file://" + path.join(APP_ROOT, "www/repl.html"))
	termWindow.setMenu(null)
	protectNavigation(termWindow)
	termWindow.on('closed', function () {
		termWindow = null
	})
}
function createfactory() {
	factoryWindow = new BrowserWindow({width: 1066, height: 640, 'parent': mainWindow, resizable: true, movable: true, frame: false, icon: APP_ICON})
	factoryWindow.loadURL("file://" + path.join(APP_ROOT, "www/factory.html"))
	factoryWindow.setMenu(null)
	protectNavigation(factoryWindow)
	factoryWindow.on('closed', function () {
		factoryWindow = null
	})
}
function promptModal(options, callback) {
	promptOptions = options
	promptWindow = new BrowserWindow({width:360, height: 135, 'parent': mainWindow, resizable: false, movable: true, frame: false, modal: true})
	promptWindow.loadURL("file://" + path.join(APP_ROOT, "www/modalVar.html"))
	promptWindow.on('closed', function () {
		promptWindow = null
		callback(promptAnswer)
	})
}
function open_console(mainWindow = BrowserWindow.getFocusedWindow()) {
	if (mainWindow) mainWindow.webContents.toggleDevTools()
}
function refresh(mainWindow = BrowserWindow.getFocusedWindow()) {
	if (mainWindow) mainWindow.webContents.reloadIgnoringCache()
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
			// doble clic en otro .bloc con la app abierta: abrirlo en la ventana actual
			var file = fileFromArgv(argv)
			if (file) mainWindow.loadURL(indexUrlFor(file))
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
ipcMain.on("version", function () {
	if (UPDATES_ENABLED) autoUpdater.checkForUpdates()
})
ipcMain.on("prompt", function () {
	createTerm()
})
ipcMain.on("repl", function () {
	createRepl()
})
ipcMain.on("factory", function () {
	createfactory()
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
ipcMain.on('save-bin', function (event) {
	dialog.showSaveDialog(mainWindow,{
		title: 'Exportar binarios',
		defaultPath: 'MPR_hex',
		filters: [{ name: 'Binario', extensions: ['hex']}]
	},
	function(filename){
		event.sender.send('saved-bin', filename)
	})
})
ipcMain.on('save-ino', function (event) {
	dialog.showSaveDialog(mainWindow,{
		title: 'Guardar como .INO',
		defaultPath: 'MPR_Arduino',
		filters: [{ name: 'Arduino', extensions: ['ino'] }]
	},
	function(filename){
		event.sender.send('saved-ino', filename)
	})
})
ipcMain.on('save-py', function (event) {
	dialog.showSaveDialog(mainWindow,{
		title: 'Guardar como .PY',
		defaultPath: 'MPR_python',
		filters: [{ name: 'python', extensions: ['py'] }]
	},
	function(filename){
		event.sender.send('saved-py', filename)
	})
})
ipcMain.on('save-bloc', function (event) {
	dialog.showSaveDialog(mainWindow,{
		title: 'Guardar proyecto (.BLOC)',
		defaultPath: 'MPR_proyecto',
		filters: [{ name: 'MPR Blockly', extensions: ['bloc'] }]
	},
	function(filename){
		event.sender.send('saved-bloc', filename)
	})
})
ipcMain.on('save-csv', function (event) {
	dialog.showSaveDialog(mainWindow,{
		title: 'Guardar como CSV',
		defaultPath: 'MPR_datos',
		filters: [{ name: 'datos', extensions: ['csv'] }]
	},
	function(filename){
		event.sender.send('saved-csv', filename)
	})
})
if (UPDATES_ENABLED) {
	autoUpdater.on('error', function(error) {
		dialog.showErrorBox('Error: ', error == null ? "unknown" : (error.stack || error).toString())
	})
	autoUpdater.on('update-available', function() {
		dialog.showMessageBox(mainWindow,{
			type: 'none',
			title: 'Actualización',
			message: "Hay una nueva versión disponible, ¿quieres descargarla e instalarla ahora?",
			buttons: ['Sí', 'No'],
			cancelId: 1,
			noLink: true
		},
		function(buttonIndex)  {
			if (buttonIndex === 0) autoUpdater.downloadUpdate()
		})
	})
	autoUpdater.on('update-not-available', function() {
		dialog.showMessageBox(mainWindow,{
			title: 'Actualizado',
			message: 'Tienes la última versión.'
		})
	})
	autoUpdater.on('update-downloaded', function() {
		dialog.showMessageBox(mainWindow,{
			title: 'Actualizado',
			message: "Descarga terminada, la aplicación se instalará y se reiniciará."
		}, function() {
			setImmediate(function(){
				autoUpdater.quitAndInstall()
			})
		})
	})
}
module.exports.open_console = open_console
module.exports.refresh = refresh
