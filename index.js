var { ipcRenderer, shell, clipboard } = require("electron")
var sp = require('serialport')
var fs = require('fs')
var path = require('path')
var appVersion = window.require('electron').remote.app.getVersion()

// MPR: trabajar siempre desde la carpeta de instalación. Las rutas de compilación
// (./compilation/arduino, config.json) son relativas al directorio actual, que
// puede ser otro si la app se abre con doble clic sobre un archivo .bloc.
var mpr_app_root = path.join(__dirname, '..', '..')
if (fs.existsSync(path.join(mpr_app_root, 'compilation', 'arduino'))) {
	try { process.chdir(mpr_app_root) } catch (e) { console.log(e) }
}

var arduino_basepath = process.platform == 'win32' ? './compilation/arduino' : path.join(__dirname, '../../compilation/arduino')

// MPR: si no se pudo guardar (carpeta sin permiso, pendrive quitado, disco lleno), decirlo en vez de fallar en silencio
function avisarNoGuardado(err) {
	console.log(err)
	window.require('electron').remote.dialog.showErrorBox('No se pudo guardar el archivo',
		'Prueba guardarlo en otra carpeta, por ejemplo Documentos.\n\n(' + err.message + ')')
}

window.addEventListener('load', function load(event) {
	var quitDiv = '<button type="button" class="close" data-dismiss="modal" aria-label="Close">&#215;</button>'
	var portserie = document.getElementById('portserie')
	var messageDiv = document.getElementById('messageDIV')
	document.getElementById('versionapp').textContent = " MPR Blockly V" + appVersion
	// MPR: al subir el programa se revela el nombre real de las "canciones misteriosas" que usa
	// MPR: además del "OK code uploaded" que muestra el manual, una línea para el niño y, si la placa se cambió sola, el aviso
	function textoOK(extra){
		return '<div class="mpr-ok-sub">' + ((typeof MSG != 'undefined' && MSG.sub_ok) || '') + '</div>' + (extra || '')
	}
	function revelarCanciones(extra){
		var usadas = []
		try { usadas = Blockly.MPR_cancionesUsadas(Blockly.getMainWorkspace()) } catch (e) { console.log(e) }
		if (!usadas.length) return false
		messageDiv.style.color = '#009000'
		messageDiv.innerHTML = Blockly.Msg.upload + ': ✅ OK' + quitDiv + textoOK(extra) + '<div style="color:#000;margin-top:8px">🎵 ' +
			usadas.map(function(u){ return '<b>Canción ' + u[0].split(':')[0].toLowerCase() + '</b> era: ' + u[1] }).join('<br>🎵 ') + '</div>'
		$('#message').modal('show')
		setTimeout(function() { $('#message').modal('hide') }, 10000)
		return true
	}
	function uploadOK(extra){
		if (revelarCanciones(extra)) return
		messageDiv.style.color = '#009000'
		messageDiv.innerHTML = Blockly.Msg.upload + ': ✅ OK code uploaded' + quitDiv + textoOK(extra)
		$('#message').modal('show');
		setTimeout(function() {
		$('#message').modal('hide');
		}, extra ? 6000 : 3000);
	}
	$('#btn_forum').on('click', function(){
		shell.openExternal('https://discord.gg/CZZytnw')
	})
	$('#btn_site').on('click', function(){
		shell.openExternal('https://www.ottodiy.com/')
	})
	$('#btn_contact').on('click', function(){
		shell.openExternal('https://github.com/OttoDIY/blockly/issues')
	})
	$('#btn_copy').on('click', function(){
		clipboard.writeText($('#pre_previewArduino').text())
	})
	// MPR: puerto y placa automáticos, pasos de la subida y precompilación (www/js/mpr_subida.js)
	MPRSubida.iniciar({ sp: sp, basepath: arduino_basepath, portserie: portserie,
		messageDiv: messageDiv, quitDiv: quitDiv, alSubir: uploadOK })
	// MPR: botón "Monitor Serie" del modo monitor (Ctrl + Mayús + M, www/js/mpr_monitor.js). Durante una subida el puerto
	// está ocupado: no se abre (la subida misma cierra el monitor antes de empezar, ver MPRSubida.cerrarMonitor).
	$('#btn_term').on('click', function(){
		if (typeof MPRSubida != 'undefined' && MPRSubida.ocupada) return
		if (portserie.value=="com"){
			$("#message").modal("show")
			messageDiv.style.color = '#ff0000'
			messageDiv.innerHTML = Blockly.Msg.com2 + quitDiv
			return
		}
		ipcRenderer.send("prompt", "")
	})
	$('#btn_verify').on('click', function(ev){
		// MPR: Arduino: Otto revisa los bloques y explica los errores con su código (www/js/mpr_revision.js, mpr_subida.js)
		if (typeof MPRSubida == 'undefined' || !MPRSubida.listo) return
		// el cuadro lo abre MPR: sin esto, el data-toggle del botón lo cerraba en el mismo clic
		ev.stopPropagation()
		var contenidoOff = localStorage.getItem('content') == "off"
		if (!contenidoOff && typeof MPRRevision != 'undefined' && MPRRevision.antesDeMandar(messageDiv, function(){
			MPRSubida.verificar($('#pre_previewArduino').text())
		})) return
		MPRSubida.verificar(contenidoOff ? editor.getValue() : $('#pre_previewArduino').text())
	})
	$('#btn_flash').on('click', function(ev){
		// MPR: placas Arduino: pasos claros, placa automática y errores explicados (www/js/mpr_subida.js). Antes, Otto
		// revisa los bloques (www/js/mpr_revision.js); en modo código se manda lo escrito en el editor.
		if (typeof MPRSubida == 'undefined' || !MPRSubida.listo) return
		// el cuadro lo abre MPR: sin esto, el data-toggle del botón lo cerraba en el mismo clic
		ev.stopPropagation()
		if (localStorage.getItem('content') == "off") { MPRSubida.cargar(editor.getValue()); return }
		if (typeof MPRRevision != 'undefined' && MPRRevision.antesDeMandar(messageDiv, function(){
			MPRSubida.cargar($('#pre_previewArduino').text())
		})) return
		MPRSubida.cargar($('#pre_previewArduino').text())
	})
	$('#btn_saveino').on('click', function(){
		ipcRenderer.send('save-ino')
	})
	$('#btn_saveXML').on('click', function(){
		if (localStorage.getItem("content") == "on") {
			ipcRenderer.send('save-bloc')
		} else {
			ipcRenderer.send('save-ino')
		}
	})
	ipcRenderer.on('saved-ino', function(event, path){
		var code = $('#pre_previewArduino').text()
		if (!path) {
			return
		} else {
			fs.writeFile(path, code, function(err){
				if (err) avisarNoGuardado(err)
			})
		}
	})
	ipcRenderer.on('saved-bloc', function(event, path){
		if (!path) {
			return
		} else {
			var xml = Blockly.Xml.workspaceToDom(Blockly.mainWorkspace)
			var toolbox = localStorage.getItem("toolbox") || "toolbox_arduino_all"
			var newel = document.createElement("toolbox")
			newel.appendChild(document.createTextNode(toolbox))
			xml.insertBefore(newel, xml.childNodes[0])
			var code = Blockly.Xml.domToPrettyText(xml)
			fs.writeFile(path, code, function(err){
				if (err) avisarNoGuardado(err)
			})
		}
	})
})
