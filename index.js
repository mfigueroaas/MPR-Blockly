var { ipcRenderer, shell, clipboard } = require("electron")
var { exec } = require('child_process')
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

var arduino_basepath = process.platform == 'win32' ? arduino_basepath = './compilation/arduino' : path.join(__dirname, '../../compilation/arduino')
// MPR: en Windows se usa la ruta completa de arduino-cli.exe. Con solo el nombre, cmd.exe lo busca en la
// carpeta actual y no lo encuentra si el PC tiene NoDefaultCurrentDirectoryInExePath (opción de seguridad).
var arduino_ide_cmd = process.platform == 'win32' ? '"' + path.resolve(arduino_basepath, 'arduino-cli.exe') + '"' : arduino_ide_cmd = path.join(__dirname, '../../compilation/arduino/arduino-cli')

window.addEventListener('load', function load(event) {
	var quitDiv = '<button type="button" class="close" data-dismiss="modal" aria-label="Close">&#215;</button>'
	var checkBox = document.getElementById('verifyUpdate')
	var portserie = document.getElementById('portserie')
	var messageDiv = document.getElementById('messageDIV')
	localStorage.setItem("verif",false)
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
	// MPR: con www/js/mpr_subida.js la lista de puertos se revisa sola (cada 2 s y al pasar el mouse); esto queda de respaldo
	if (typeof MPRSubida == 'undefined') $('#portserie').mouseover(function(){
		sp.list(function(err,ports) {
			var nb_com = localStorage.getItem("nb_com"), menu_opt = portserie.getElementsByTagName('option')
			if(ports.length > nb_com){
				ports.forEach(function(port){
					if (port.vendorId){
						var opt = document.createElement('option')
						opt.value = port.comName
						opt.text = port.comName
						portserie.appendChild(opt)
						localStorage.setItem("com",port.comName)
					}
				})
				localStorage.setItem("nb_com",ports.length)
				localStorage.setItem("com",portserie.options[1].value)
			}
			if(ports.length < nb_com){
				while(menu_opt[1]) {
					portserie.removeChild(menu_opt[1])
				}
				localStorage.setItem("com","com")
				localStorage.setItem("nb_com",ports.length)
			}
		})
	})
	$('#btn_copy').on('click', function(){
		clipboard.writeText($('#pre_previewArduino').text())
	})
	$('#btn_bin').on('click', function(){
		if (localStorage.getItem('verif') == "false"){
			$("#message").modal("show")
			messageDiv.style.color = '#000000'
			messageDiv.innerHTML = Blockly.Msg.verif + quitDiv
			return
		}
		localStorage.setItem("verif",false)
		ipcRenderer.send('save-bin')
	})
	$.ajax({
	    cache: false,
	    url: "../config.json",
	    dataType: "json",
	    success : function(data) {
			$.each(data, function(i, update){
				if (update=="true") {
					$('#verifyUpdate').prop('checked', true)
					checkBox.dispatchEvent(new Event('change'))
					ipcRenderer.send("version", "")
				} else {
					$('#verifyUpdate').prop('checked', false)
					checkBox.dispatchEvent(new Event('change'))
				}
			})
		}
	})
	checkBox.addEventListener('change', function(event){
		if (event.target.checked) {
			fs.writeFile('config.json', '{ "update": "true" }', function(err){
				if (err) return console.log(err)
			})
		} else {
			fs.writeFile('config.json', '{ "update": "false" }', function(err){
				if (err) return console.log(err)
			})
		}
	})
	// MPR: puerto y placa automáticos, pasos de la subida y precompilación (www/js/mpr_subida.js)
	if (typeof MPRSubida != 'undefined') MPRSubida.iniciar({ sp: sp, basepath: arduino_basepath, portserie: portserie,
		messageDiv: messageDiv, quitDiv: quitDiv, alSubir: uploadOK })
	else sp.list(function(err,ports){
		var opt = document.createElement('option')
		opt.value = "com"
		opt.text = Blockly.Msg.com1
		portserie.appendChild(opt)
		ports.forEach(function(port) {
			if (port.vendorId){
				var opt = document.createElement('option')
				opt.value = port.comName
				opt.text = port.comName
				portserie.appendChild(opt)
			}
		})
		localStorage.setItem("nb_com",ports.length)
		if (portserie.options.length > 1) {
			portserie.selectedIndex = 1
			localStorage.setItem("com",portserie.options[1].value)
		} else {
			localStorage.setItem("com","com")
		}
	})
	$('#btn_version').on('click', function(){
		$('#aboutModal').modal('hide')
		ipcRenderer.send("version", "")
	})
	$('#btn_term').on('click', function(){
		if (portserie.value=="com"){
			$("#message").modal("show")
			messageDiv.style.color = '#ff0000'
			messageDiv.innerHTML = Blockly.Msg.com2 + quitDiv
			return
		}
		if (localStorage.getItem("prog") == "python") { ipcRenderer.send("repl", "") } else { ipcRenderer.send("prompt", "") }
	})
	$('#btn_factory').on('click', function(){
		ipcRenderer.send("factory", "")
	})
	$('#btn_verify').on('click', function(ev){
		if (localStorage.getItem('content') == "off") {
			var data = editor.getValue()
		} else {
			var data = $('#pre_previewArduino').text()
		}
		var carte = localStorage.getItem('card')
		var prog = localStorage.getItem('prog')
		var com = portserie.value
		// MPR: Arduino: Otto revisa los bloques y explica los errores con su código (www/js/mpr_revision.js, mpr_subida.js)
		if (prog != "python" && typeof MPRSubida != 'undefined' && MPRSubida.listo) {
			// el cuadro lo abre MPR: sin esto, el data-toggle del botón lo cerraba en el mismo clic
			ev.stopPropagation()
			if (localStorage.getItem('content') != "off" && typeof MPRRevision != 'undefined' && MPRRevision.antesDeMandar(messageDiv, function(){
				MPRSubida.verificar($('#pre_previewArduino').text())
			})) return
			MPRSubida.verificar(data)
			return
		}
		messageDiv.style.color = '#000000'
		messageDiv.innerHTML = Blockly.Msg.check + '<i class="fa fa-spinner fa-pulse fa-1_5x fa-fw"></i>'

		if (prog == "python") {
			fs.writeFile('./compilation/python/py/sketch.py', data, function(err){
				if (err) return console.log(err)
			})
			exec('python -m pyflakes ./py/sketch.py', {cwd:"./compilation/python"}, function(err, stdout, stderr){
				if (stderr) {
					rech=RegExp('token')
					if (rech.test(stderr)){
						messageDiv.style.color = '#ff0000'
						messageDiv.innerHTML = Blockly.Msg.error + quitDiv
					} else {
						messageDiv.style.color = '#ff0000'
						messageDiv.innerHTML = err.toString() + quitDiv
					}
					return
				}
				messageDiv.style.color = '#009000'
				messageDiv.innerHTML = Blockly.Msg.check + ':✅ OK' + quitDiv
			})
		} else {
			//fs.writeFile('./compilation/arduino/ino/sketch.ino', data, function(err){

		fs.writeFile(`${arduino_basepath}/sketch/sketch.ino`, data, function(err){

			if (err) return console.log(err)
		})

		var upload_arg = window.profile[carte].upload_arg
		var cmd = `${arduino_ide_cmd} compile --fqbn ` + upload_arg +' sketch/sketch.ino'

		/*
		   exec( cmd, {cwd:'./compilation/arduino'}, function(err, stdout, stderr){
			//exec('verify.bat ' + carte, {cwd:'./compilation/arduino'}, function(err, stdout, stderr){
				if (stderr) {
					rech=RegExp('token')
					if (rech.test(stderr)){
						messageDiv.style.color = '#ff0000'
						messageDiv.innerHTML = Blockly.Msg.error + quitDiv
					} else {
						messageDiv.style.color = '#ff0000'
						messageDiv.innerHTML = err.toString() + quitDiv
					}
					return
				}

				messageDiv.style.color = '#009000'
				messageDiv.innerHTML = Blockly.Msg.check + ': OK' + quitDiv
			}) */

			exec(cmd , {cwd: arduino_basepath} , (error, stdout, stderr) => {
			if (error) {

						messageDiv.style.color = '#ff0000'
						messageDiv.innerHTML = error.toString() + quitDiv
						return
						}

			    messageDiv.style.color = '#009000'
				messageDiv.innerHTML = Blockly.Msg.check + ': ✅ Code is ready to upload' + quitDiv
				$('#message').modal('show');
				setTimeout(function() {
    			$('#message').modal('hide');
				}, 3000);

		    })


		}
		localStorage.setItem("verif",true)
	})
	$('#btn_flash').on('click', function(ev){

		var data = $('#pre_previewArduino').text()
		var carte = localStorage.getItem('card')
		var prog = profile[carte].prog
		// MPR: placas Arduino: pasos claros, placa automática y errores explicados (www/js/mpr_subida.js). Antes, Otto
		// revisa los bloques (www/js/mpr_revision.js); en modo código se manda lo escrito en el editor.
		if (prog != "python" && typeof MPRSubida != 'undefined' && MPRSubida.listo) {
			// el cuadro lo abre MPR: sin esto, el data-toggle del botón lo cerraba en el mismo clic
			ev.stopPropagation()
			if (localStorage.getItem('content') == "off") { MPRSubida.cargar(editor.getValue()); return }
			if (typeof MPRRevision != 'undefined' && MPRRevision.antesDeMandar(messageDiv, function(){
				MPRSubida.cargar($('#pre_previewArduino').text())
			})) return
			MPRSubida.cargar(data)
			return
		}
		var speed = profile[carte].speed
		var cpu = profile[carte].cpu
		var com = portserie.value
		var upload_arg = window.profile[carte].upload_arg

		if ( com == "com" ){
			messageDiv.style.color = '#ff0000'
			messageDiv.innerHTML = Blockly.Msg.com2 + quitDiv
			return
		}
		if ( localStorage.getItem('verif') == "false" ){
			messageDiv.style.color = '#000000'
			messageDiv.innerHTML = Blockly.Msg.check + '<i class="fa fa-spinner fa-pulse fa-1_5x fa-fw"></i>'
			//fs.writeFile('./compilation/arduino/ino/sketch.ino', data, function(err){
			fs.writeFile(`${arduino_basepath}/sketch/sketch.ino`, data, function(err){

				if (err) return console.log(err)
			})


			var cmd = `${arduino_ide_cmd} compile --fqbn ` + upload_arg +' sketch/sketch.ino'


			exec(cmd , {cwd: `${arduino_basepath}`} , (error, stdout, stderr) => {
			if (error) {

						messageDiv.style.color = '#ff0000'
						messageDiv.innerHTML = error.toString() + quitDiv
						return
						}

			    messageDiv.style.color = '#009000'
				messageDiv.innerHTML = Blockly.Msg.check + ': ✅ OK' + quitDiv

			/*
		    exec( cmd, {cwd:'./compilation/arduino'}, function(err, stdout, stderr){
			//exec('verify.bat ' + carte, {cwd:'./compilation/arduino'}, function(err, stdout, stderr){
				if (stderr) {
					rech=RegExp('token')
					if (rech.test(stderr)){
						messageDiv.style.color = '#ff0000'
						messageDiv.innerHTML = Blockly.Msg.error + quitDiv
					} else {
						messageDiv.style.color = '#ff0000'
						messageDiv.innerHTML = err.toString() + quitDiv
					}
					return
				}
				messageDiv.style.color = '#009000'
				messageDiv.innerHTML = Blockly.Msg.check + ': OK' + quitDiv */

			messageDiv.style.color = '#000000'
			messageDiv.innerHTML = Blockly.Msg.upload + '<i class="fa fa-spinner fa-pulse fa-1_5x fa-fw"></i>'

			cmd = `${arduino_ide_cmd} upload --port `+portserie.value +' --fqbn ' + upload_arg +' sketch/sketch.ino'
		    exec( cmd, {cwd:`${arduino_basepath}`}, function(err, stdout, stderr){
			//exec('flash.bat ' + cpu + ' ' + prog + ' '+ com + ' ' + speed, {cwd: './compilation/arduino'} , function(err, stdout, stderr){
				if (err) {
					messageDiv.style.color = '#ff0000'
					messageDiv.innerHTML = err.toString() + quitDiv
					return
				}
				uploadOK()
			}) })
			localStorage.setItem("verif",false)
			return
		}
		messageDiv.style.color = '#000000'
		messageDiv.innerHTML = Blockly.Msg.upload + '<i class="fa fa-spinner fa-pulse fa-1_5x fa-fw"></i>'
		if ( prog == "python" ) {
			if ( cpu == "cortexM0" ) {
				var cheminFirmware = "./compilation/python/firmware.hex"
				var fullHexStr = ""
				exec('wmic logicaldisk get volumename', function(err, stdout){
					if (err) return console.log(err)
					localStorage.setItem("volumename", stdout.split('\r\r\n').map(value => value.trim()))
				})
				exec('wmic logicaldisk get name', function(err, stdout){
					if (err) return console.log(err)
					localStorage.setItem("name", stdout.split('\r\r\n').map(value => value.trim()))
				})
				var volume = localStorage.getItem("volumename")
				var drive = localStorage.getItem("name")
				var volumeN = volume.split(',')
				var driveN = drive.split(',')
				var count = volumeN.length
				var disk = ""
				for (var i = 0 ; i < count ; i++) {
					if (volumeN[i]=="MICROBIT") disk = driveN[i]
				}
				if (disk!="") {
					fs.readFile(cheminFirmware, function(err, firmware){
						firmware = String(firmware)
						fullHexStr = upyhex.injectPyStrIntoIntelHex(firmware, data)
						fs.writeFile(disk + '\sketch.hex', fullHexStr, function(err){
							if (err) {
								messageDiv.style.color = '#ff0000'
								messageDiv.innerHTML = err.toString() + quitDiv
							}
						})
					})
					setTimeout(uploadOK, 7000)
				} else {
					messageDiv.style.color = '#000000'
					messageDiv.innerHTML = 'Connect micro:bit!' + quitDiv
				}
			} else {


				exec( 'python -m ampy -p ' + com + ' -b 115200 -d 1 run --no-output ./py/sketch.py', {cwd: "./compilation/python"} , function(err, stdout, stderr){
					if (err) {
						messageDiv.style.color = '#ff0000'
						messageDiv.innerHTML = err.toString() + quitDiv
						return
					}
					uploadOK()
				})
			}
		} else {


			cmd = `${arduino_ide_cmd} upload --port `+portserie.value +' --fqbn ' + upload_arg +' sketch/sketch.ino'
		    exec( cmd, {cwd:`${arduino_basepath}`}, function(err, stdout, stderr){
			//exec('flash.bat ' + cpu + ' ' + prog + ' '+ com + ' ' + speed, {cwd: './compilation/arduino'} , function(err, stdout, stderr){
				if (err) {
					messageDiv.style.color = '#ff0000'
					messageDiv.innerHTML = err.toString() + quitDiv
					return
				}
				uploadOK()
			})
		}
		localStorage.setItem("verif",false)
	})
	$('#btn_saveino').on('click', function(){
		if (localStorage.getItem("prog") == "python") { ipcRenderer.send('save-py') } else { ipcRenderer.send('save-ino') }
	})
	$('#btn_saveXML').on('click', function(){
		if (localStorage.getItem("content") == "on") {
			ipcRenderer.send('save-bloc')
		} else {
			if (localStorage.getItem("prog") == "python") { ipcRenderer.send('save-py') } else { ipcRenderer.send('save-ino') }
		}
	})
	ipcRenderer.on('saved-ino', function(event, path){
		var code = $('#pre_previewArduino').text()
		if (path === null) {
			return
		} else {
			fs.writeFile(path, code, function(err){
				if (err) return console.log(err)
			})
		}
	})
	ipcRenderer.on('saved-py', function(event, path){
		var code = $('#pre_previewArduino').text()
		if (path === null) {
			return
		} else {
			fs.writeFile(path, code, function(err){
				if (err) return console.log(err)
			})
		}
	})
	ipcRenderer.on('saved-bloc', function(event, path){
		if (path === null) {
			return
		} else {
			var xml = Blockly.Xml.workspaceToDom(Blockly.mainWorkspace)
			var toolbox = localStorage.getItem("toolbox")
			if (!toolbox) {
				toolbox = $("#toolboxes").val()
			}
			if (toolbox) {
				var newel = document.createElement("toolbox")
				newel.appendChild(document.createTextNode(toolbox))
				xml.insertBefore(newel, xml.childNodes[0])
			}
			var toolboxids = localStorage.getItem("toolboxids")
			if (toolboxids === undefined || toolboxids === "") {
				if ($('#defaultCategories').length) {
					toolboxids = $('#defaultCategories').html()
				}
			}
			var code = Blockly.Xml.domToPrettyText(xml)
			fs.writeFile(path, code, function(err){
				if (err) return console.log(err)
			})
		}
	})
	ipcRenderer.on('saved-bin', function(event, path){
		if (path === null) {
			return
		} else {
			var xml = Blockly.Xml.workspaceToDom(Blockly.mainWorkspace)
			var toolbox = localStorage.getItem("toolbox")
			if (!toolbox) {
				toolbox = $("#toolboxes").val()
			}
			if (toolbox) {
				var newel = document.createElement("toolbox")
				newel.appendChild(document.createTextNode(toolbox))
				xml.insertBefore(newel, xml.childNodes[0])
			}
			var toolboxids = localStorage.getItem("toolboxids")
			if (toolboxids === undefined || toolboxids === "") {
				if ($('#defaultCategories').length) {
					toolboxids = $('#defaultCategories').html()
				}
			}
			var code = Blockly.Xml.domToPrettyText(xml)
			var res = path.split(".")
			fs.writeFile(res[0]+'.bloc', code, function(err){
				if (err) return console.log(err)
			})
			fs.copyFile(`${arduino_basepath}/build/sketch.ino.with_bootloader.hex`, res[0]+'_with_bootloader.hex', (err) => {if (err) throw err})
			fs.copyFile(`${arduino_basepath}/build/sketch.ino.hex`, res[0]+'.hex', (err) => {if (err) throw err})
			fs.copyFile(`${arduino_basepath}/ino/sketch.ino`, res[0]+'.ino', (err) => {if (err) throw err})
		}
	})
})
