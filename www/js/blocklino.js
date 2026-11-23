'use strict';

var BlocklyDuino = {};
BlocklyDuino.selectedToolbox = "toolbox_arduino_all";
BlocklyDuino.selectedCard = "nanooptiboot";
BlocklyDuino.content = "on";
BlocklyDuino.workspace = null;

BlocklyDuino.init = function() {
	Code.initLanguage();
	BlocklyDuino.loadConfig();
	BlocklyDuino.workspace = Blockly.inject('content_blocks',{grid:{snap:true},sounds:true,media:'media/',toolbox:BlocklyDuino.buildToolbox(),zoom:{controls:true,wheel:true}});
	BlocklyDuino.bindFunctions();
	BlocklyDuino.workspace.render();
	// MPR: la vista de código solo se regenera cuando cambia el programa; los eventos de interfaz (seleccionar, clic,
	// abrir una categoría) no cambian el código y la regeneraban igual en cada clic (PLAN_PULIDO C7).
	BlocklyDuino.workspace.addChangeListener(function(e) {
		if (e && e.type == Blockly.Events.UI) return;
		BlocklyDuino.renderArduinoCodePreview();
	});
	BlocklyDuino.loadFile();
	window.addEventListener('unload', BlocklyDuino.backupBlocks, false);
	BlocklyDuino.vigilarArchivosSoltados();
};
// MPR: soltar un archivo sobre la ventana hacía que la app navegara a ese archivo (una foto, un .bloc como texto...)
// y se perdía la mesa. Ahora no se navega nunca; si se suelta un .bloc o .xml se abre como con "Abrir" (PLAN_PULIDO B5).
// Solo se actúa cuando se arrastran archivos: arrastrar texto dentro de la app sigue igual.
BlocklyDuino.vigilarArchivosSoltados = function() {
	var traeArchivos = function(e) {
		var tipos = e.dataTransfer && e.dataTransfer.types;
		if (!tipos) return false;
		for (var i = 0; i < tipos.length; i++) if (tipos[i] == 'Files') return true;
		return false;
	};
	document.addEventListener('dragover', function(e) {
		if (!traeArchivos(e)) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = 'copy';
	}, false);
	document.addEventListener('drop', function(e) {
		if (!traeArchivos(e)) return;
		e.preventDefault();
		var archivos = e.dataTransfer.files;
		if (archivos && archivos.length == 1 && /\.(bloc|xml)$/i.test(archivos[0].name)) {
			BlocklyDuino.abrirArchivoLocal(archivos[0]);
		} else {
			alert(MSG['xmlError'] + '\nSuelta un solo archivo .bloc');
		}
	}, false);
};
BlocklyDuino.loadFile = function() {
	var urlFile = BlocklyDuino.getStringParamFromUrl('url', '');
	// MPR: después de cargar el archivo (ejemplo o .bloc abierto con doble clic) se quita ?url= de la dirección.
	// Antes F5 volvía a cargar el archivo original y se perdía lo hecho después; ahora F5 recupera el respaldo
	// (loadOnceBlocks) como siempre. Si el archivo no se puede abrir, se recupera el trabajo anterior (PLAN_PULIDO B1).
	if (urlFile && !/\.(ino|py)$/i.test(urlFile)) {
		BlocklyDuino.leerArchivo(urlFile, function(texto, error) {
			BlocklyDuino.quitarUrlDeLaDireccion();
			if (texto == null) {
				alert(MSG['xmlError'] + '\n' + urlFile + (error ? '\n' + error : ''));
				BlocklyDuino.loadBlocks();
			} else if (!BlocklyDuino.cargarXmlEnMesa(texto)) {
				BlocklyDuino.loadBlocks();
			}
		});
	} else {
		// MPR: los .ino y .py ya no se abren (no hay editor de código): se carga la mesa de siempre
		BlocklyDuino.loadBlocks();
	}
};
// MPR: quita ?url= de la dirección sin recargar, conservando los demás parámetros (PLAN_PULIDO B1).
BlocklyDuino.quitarUrlDeLaDireccion = function() {
	try {
		var resto = location.search.replace(/^\?/, '').split('&').filter(function(p) {
			return p && p.indexOf('url=') !== 0;
		}).join('&');
		history.replaceState(history.state, '', location.pathname + (resto ? '?' + resto : '') + location.hash);
	} catch (e) { console.log(e); }
};
// MPR: lee el archivo de ?url=. En la app (con Node) y con una ruta absoluta se lee con fs: $.get cortaba las rutas
// con # (un .bloc llamado "robot #2.bloc" no abría). En la versión web (sin require) o con rutas relativas
// (los ejemplos, ./examples/...) se sigue usando $.get (PLAN_PULIDO B7). listo(texto, error): texto null si falló.
BlocklyDuino.leerArchivo = function(ruta, listo) {
	var fs = null;
	try {
		if (typeof require == 'function' && require('path').isAbsolute(ruta)) fs = require('fs');
	} catch (e) { fs = null; }
	if (fs) {
		fs.readFile(ruta, 'utf8', function(err, texto) { listo(err ? null : texto, err); });
	} else {
		$.get(ruta, function(texto) { listo(texto); }, 'text').fail(function(x, estado, err) { listo(null, err || estado); });
	}
};
BlocklyDuino.save_com = function() {
	$("#portserie").blur();
	var com=$("#portserie").val();
	window.localStorage.com = com;
};
BlocklyDuino.renderArduinoCodePreview = function() {
	// MPR: si un bloque no sabe generar su código (por ejemplo uno antiguo de un archivo), antes la vista previa
	// se quedaba con el programa anterior y Verificar/Subir lo mandaban sin avisar. Ahora el programa lleva un
	// #error que el compilador muestra, con el texto del bloque (PLAN_PULIDO A5).
	var codigo;
	try {
		codigo = Blockly.Arduino.workspaceToCode(BlocklyDuino.workspace);
	} catch (e) {
		var malo = BlocklyDuino.workspace.getAllBlocks().filter(function(b) {
			return !b.disabled && typeof Blockly.Arduino[b.type] != 'function';
		})[0];
		var limpiar = function(s) { return String(s).replace(/["\\\r\n]/g, ' ').slice(0, 80); };
		codigo = '#error "' + (malo ? 'El bloque ' + limpiar(malo.toString()) + ' no funciona en el robot: quítalo de la mesa'
			: 'No se pudo armar el programa: ' + limpiar(e && e.message || e)) + '"\n';
	}
	$('#pre_previewArduino').text(codigo);
	$('#pre_previewArduino').html(prettyPrintOne($('#pre_previewArduino').html(), 'cpp'));
};
BlocklyDuino.getStringParamFromUrl = function(name, defaultValue) {
  var val = location.search.match(new RegExp('[?&]' + name + '=([^&]+)'));
  return val ? decodeURIComponent(val[1].replace(/\+/g, '%20')) : defaultValue;
};
BlocklyDuino.addReplaceParamToUrl = function(url, param, value) {
	var re = new RegExp("([?&])" + param + "=.*?(&|$)", "i");
	var separator = url.indexOf('?') !== -1 ? "&" : "?";
	if (url.match(re)) {
		return url.replace(re, '$1' + param + "=" + value + '$2');
	}
	else {
		return url + separator + param + "=" + value;
	}
};
// MPR: con lo que parte un proyecto nuevo (al abrir la app sin trabajo guardado y con el botón "Nuevo"):
// Configuración + Bucle con la configuración de Otto adentro, como en el paso 4 del manual de programación.
// Si el niño la borra no se vuelve a poner sola: solo aparece de nuevo al empezar otro proyecto.
BlocklyDuino.PLANTILLA = '<xml xmlns="http://www.w3.org/1999/xhtml">' +
	'<block type="base_setup_loop" x="40" y="40"><statement name="DO"><block type="otto_configuration">' +
	'<field name="PIN_YL">2</field><field name="PIN_YR">3</field><field name="PIN_RL">4</field>' +
	'<field name="PIN_RR">5</field><field name="PIN_Buzzer">13</field></block></statement></block></xml>';
BlocklyDuino.cargarPlantilla = function() {
	try {
		Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(BlocklyDuino.PLANTILLA), BlocklyDuino.workspace);
	} catch (e) { console.log(e); }
};
// MPR: carga un proyecto (.bloc/.xml) en la mesa sin perder lo que había si el archivo está dañado, no es de bloques
// o trae bloques que esta versión no conoce. Antes se vaciaba la mesa y quedaba en blanco o a medias, sin aviso
// (este Blockly no avisa de XML roto ni de bloques desconocidos). Devuelve true si cargó; si no, muestra
// MSG.xmlError y deja la mesa como estaba (PLAN_PULIDO B4).
BlocklyDuino.cargarXmlEnMesa = function(texto) {
	var ws = BlocklyDuino.workspace, xml = null, detalle = '';
	try {
		var doc = new DOMParser().parseFromString(String(texto == null ? '' : texto).replace(/^\uFEFF/, ''), 'text/xml');
		xml = doc.documentElement;
		if (!xml || xml.nodeName.toLowerCase() != 'xml' || doc.getElementsByTagName('parsererror').length) {
			xml = null;
			detalle = 'El archivo no es un proyecto de bloques o está dañado.';
		}
	} catch (e) { xml = null; detalle = String(e); }
	if (xml) {
		var desconocidos = [];
		['block', 'shadow'].forEach(function(etiqueta) {
			var nodos = xml.getElementsByTagName(etiqueta);
			for (var i = 0; i < nodos.length; i++) {
				var tipo = nodos[i].getAttribute('type');
				if ((!tipo || !Blockly.Blocks[tipo]) && desconocidos.indexOf(tipo) < 0) desconocidos.push(tipo);
			}
		});
		if (desconocidos.length) {
			xml = null;
			detalle = 'Trae bloques que esta versión no conoce: ' + desconocidos.join(', ');
		}
	}
	if (xml) {
		var antes = Blockly.Xml.workspaceToDom(ws);
		var grupo = Blockly.Events.getGroup();
		if (!grupo) Blockly.Events.setGroup(true);   // abrir (y deshacer) es un solo paso
		try {
			ws.clear();
			Blockly.Xml.domToWorkspace(xml, ws);
		} catch (e) {
			// falló a medias: se vuelve a poner lo que había
			detalle = String(e && e.message || e);
			xml = null;
			if (Blockly.Field.stopCache) Blockly.Field.stopCache();
			try { ws.clear(); Blockly.Xml.domToWorkspace(antes, ws); } catch (e2) { console.log(e2); }
			if (ws.setResizesEnabled) ws.setResizesEnabled(true);
		}
		if (!grupo) Blockly.Events.setGroup(false);
	}
	if (!xml) {
		alert(MSG['xmlError'] + (detalle ? '\n' + detalle : ''));
		return false;
	}
	ws.render();
	return true;
};
BlocklyDuino.loadBlocks = function(defaultXml) {
	if (defaultXml) {
		BlocklyDuino.cargarXmlEnMesa(defaultXml);   // MPR: sin borrar la mesa si el archivo está dañado (PLAN_PULIDO B4)
	} else {
		var loadOnce = null;
		try {
			loadOnce = window.localStorage.loadOnceBlocks;
		} catch (e) {}
		if (loadOnce != null) {
			delete window.localStorage.loadOnceBlocks;
			// MPR: si el respaldo viene dañado, que la app abra igual (con lo que se alcanzó a cargar o la plantilla)
			try {
				var xml = Blockly.Xml.textToDom(loadOnce);
				Blockly.Xml.domToWorkspace(xml,BlocklyDuino.workspace);
			} catch (e) { console.log(e); }
		}
		// MPR: sin trabajo guardado (primera vez) o con la mesa vacía, se parte con la plantilla
		if (BlocklyDuino.workspace.getAllBlocks().length == 0) BlocklyDuino.cargarPlantilla();
	}
};
BlocklyDuino.load = function(event) {
	var files = event.target.files;
	if (files.length != 1) {
		return;
	}
	var archivo = files[0];
	// MPR: vaciar el selector para que elegir otra vez el mismo archivo vuelva a abrirlo (PLAN_PULIDO B6)
	event.target.value = '';
	BlocklyDuino.abrirArchivoLocal(archivo);
};
// MPR: abre un .bloc/.xml elegido con "Abrir" o soltado sobre la ventana. Ya no hay modo código: los .ino/.py
// (que el selector no ofrece) se rechazan con el aviso en vez de vaciar la mesa (PLAN_PULIDO B4/B5).
BlocklyDuino.abrirArchivoLocal = function(archivo) {
	var reader = new FileReader();
	reader.onloadend = function(event) {
		if (event.target.readyState != 2) return;
		if (BlocklyDuino.cargarXmlEnMesa(event.target.result)) {
			var nombre = archivo.name, punto = nombre.lastIndexOf('.');
				document.getElementById('title-project-name').value = punto > 0 ? nombre.substring(0, punto) : nombre;
		}
	};
	reader.readAsText(archivo);
};
BlocklyDuino.backupBlocks = function() {
	try {
		if (typeof Blockly != 'undefined' && window.localStorage) {
			var xml = Blockly.Xml.workspaceToDom(BlocklyDuino.workspace);
			var text = Blockly.Xml.domToText(xml);
			window.localStorage.loadOnceBlocks = text;
		}
	} catch (e) { console.log(e); }   // localStorage lleno o bloqueado: que la app siga igual
};
BlocklyDuino.loadConfig = function() {
	var card = window.localStorage.card;
	// MPR: si quedó guardada una placa que ya no está en el menú (solo Nano y Nano optiboot, js/boards.js), volver a la
	// predeterminada. Se busca en el perfil (no en el selector), así un valor raro guardado no rompe la selección.
	if (card !== undefined && !window.profile.hasOwnProperty(card)) {
		window.localStorage.removeItem('card');
		card = undefined;
	}
	if (card === undefined) card = BlocklyDuino.selectedCard;
	window.localStorage.card = card;
	window.localStorage.prog = profile[card].prog;
	window.localStorage.toolbox = BlocklyDuino.selectedToolbox;
	$("#boards").val(card);
	BlocklyDuino.loadToolboxDefinition(BlocklyDuino.selectedToolbox);
	// MPR: siempre parte en modo bloques. El texto del editor de codigo no se guarda: si la app quedaba en modo codigo,
	// al abrirla mostraba los bloques pero la flecha mandaba el editor vacio ("#enter your code here") y fallaba.
	window.localStorage.content = BlocklyDuino.content;
	$('#btn_verify').addClass("hidden");
};
BlocklyDuino.change_card = function() {
	BlocklyDuino.backupBlocks();
	$("#boards").blur();
	// Nano y Nano optiboot son el mismo CPU (atmega328p): cambiar de una a otra solo cambia la carga (upload_arg),
	// que mpr_subida.js toma del perfil al subir. No hace falta reiniciar la mesa.
	window.localStorage.card = $("#boards").val();
};
BlocklyDuino.discard = function() {
  var count = BlocklyDuino.workspace.getAllBlocks().length;
  if (count < 4 || window.confirm(MSG['discard'])) {
    BlocklyDuino.workspace.clear();
    BlocklyDuino.cargarPlantilla();   // MPR: proyecto nuevo con Configuración + Bucle y Configuración Otto
    BlocklyDuino.workspace.render();
  }
};
BlocklyDuino.Undo = function() {
	Blockly.mainWorkspace.undo(0);
};
BlocklyDuino.Redo = function() {
	Blockly.mainWorkspace.undo(1);
};
BlocklyDuino.bindFunctions = function() {
	$('#btn_new').on("click", BlocklyDuino.discard);
	$('#btn_undo').on("click", BlocklyDuino.Undo);
	$('#btn_redo').on("click", BlocklyDuino.Redo);
	$('#boards').on("focus", function() {
		BlocklyDuino.selectedCard = $(this).val()
	});
	$('#btn_preview').on("click", function() {
		$("#toggle").toggle("slide")
	});
	$('#btn_verify').mouseover(function() {
		document.getElementById("survol").textContent = "Verificando Código";
	}).mouseout(function() {
		document.getElementById("survol").textContent = "";
	});
	$('#btn_flash').mouseover(function() {
		document.getElementById("survol").textContent = "Cargar Código";
	}).mouseout(function() {
		document.getElementById("survol").textContent = "";
	});
	$('#load').on("change", BlocklyDuino.load);
	$('#btn_fakeload').on("click", function() {
		$('#load').click()
	});
	$('#btn_example').on("click", BlocklyDuino.buildExamples);
	if(typeof process === 'undefined') {
		$('#btn_saveXML').on("click", BlocklyDuino.saveXmlFile);
		$('#btn_saveino').on("click", BlocklyDuino.saveino);
	}
};





BlocklyDuino.buildToolbox = function() {
	// MPR: el menú son las categorías de defaultCategories1 (toolbox/toolbox_arduino_all.xml), en ese orden.
	var lista = $('#defaultCategories1').length ? $('#defaultCategories1').html() : '';
	var xmlValue = '<xml id="toolbox">';
	var xmlids = lista.split(",");
	for (var i = 0; i < xmlids.length; i++) {
		if (xmlids[i] && $('#'+xmlids[i]).length) {
			xmlValue += $('#'+xmlids[i])[0].outerHTML;
		}
	}
	// MPR: categoría "🛠️ Monitor", al final del menú, solo con el modo monitor activo (Ctrl + Mayús + M, js/mpr_monitor.js).
	// Se lee de sessionStorage aquí mismo porque el menú se arma al abrir, antes que mpr_monitor.js haga nada: así sigue
	// tras F5 y vuelve apagado al reabrir la app.
	if (BlocklyDuino.modoMonitor() && $('#CAT_MPR_MONITOR').length) {
		xmlValue += $('#CAT_MPR_MONITOR')[0].outerHTML;
	}
	xmlValue += '</xml>';
	return xmlValue;
};
// MPR: modo monitor activo en esta ventana (sessionStorage mpr_modo_monitor = "1"; lo cambia js/mpr_monitor.js)
BlocklyDuino.modoMonitor = function() {
	try { return window.sessionStorage.getItem('mpr_modo_monitor') == '1'; } catch (e) { return false; }
};







BlocklyDuino.loadToolboxDefinition = function(toolboxFile) {
	$.ajax({
		type: "GET",
		url: "./toolbox/" + toolboxFile + ".xml",
		dataType: "xml",
		async : false
	}).done(function(data){
		var toolboxXml = '<xml id="toolbox" style="display: none">' + $(data).find('toolbox').html() + '</xml>';
		$("#toolbox").remove();
		$('body').append(toolboxXml);
		$("xml").find("category").each(function() {
			if (!$(this).attr('id')) {
				$(this).attr('id', $(this).attr('name'));
				$(this).attr('name', Blockly.Msg[$(this).attr('name')])
			}
		})
	}).fail(function(data) {
		$("#toolbox").remove()
	})
};
BlocklyDuino.buildExamples = function() {
	$.ajax({
	    cache: false,
	    url: "./examples/examples.json",
	    dataType: "json",
	    success :  function(data) {
			$("#includedContent").empty();
			$.each(data, function(i, example) {
				if (example.visible) {
					let line = "<tr><td>";

					// Si el objeto tiene una URL → crear enlace
					if (example.source_url) {
						line += "<a href='?url=./examples/" + example.source_url + "'>" 
							 + example.source_text + "</a>";
					} 
					// Si solo tiene texto → insertar texto plano
					else if (example.text) {
						line += "<span class='example-text'>" + example.text + "</span>";
					}

					line += "</td></tr>";
					$("#includedContent").append(line);
				}
			});
		}
	});
};
Blockly.Variables.flyoutCategory = function(workspace) {
	var variableList = workspace.variableList;
	variableList.sort(goog.string.caseInsensitiveCompare);
	var xmlList = [];
	var button = goog.dom.createDom('button');
	button.setAttribute('text', Blockly.Msg.NEW_VARIABLE);
	button.setAttribute('callbackKey', 'CREATE_VARIABLE');
	Blockly.registerButtonCallback('CREATE_VARIABLE', function(button) {
		Blockly.Variables.createVariable(button.getTargetWorkspace());
	});
	xmlList.push(button);
	if (variableList.length > 0) {
		// gap 0 = sin atributo gap (igual que antes)
		var bloque = function(tipo, nombre, gap) {
			var block = goog.dom.createDom('block');
			block.setAttribute('type', tipo);
			if (gap) block.setAttribute('gap', gap);
			var field = goog.dom.createDom('field', null, nombre);
			field.setAttribute('name', 'VAR');
			block.appendChild(field);
			xmlList.push(block);
		};
		var B = Blockly.Blocks;
		if (B['variables_set_init']) bloque('variables_set_init', variableList[0], 8);
		if (B['variables_set']) bloque('variables_set', variableList[0], 8);
		if (B['math_change']) bloque('math_change', variableList[0], 8);
		if (B['variables_const']) bloque('variables_const', variableList[0], 8);
		if (B['base_define_const']) bloque('base_define_const', variableList[0], B['variables_get'] ? 16 : 0);
		for (var i = 0; i < variableList.length; i++) {
			if (B['variables_get']) bloque('variables_get', variableList[i], B['variables_set'] ? 8 : 0);
		}
	}
	return xmlList;
};
BlocklyDuino.saveino = function() {
    var code = $('#pre_previewArduino').text();
	var datenow = Date.now();
	var projectname = document.getElementById("title-project-name").value;
	var projectname = document.getElementById("title-project-name").value;
	var filename = projectname+".ino";
 	var element = document.createElement('a');
	element.setAttribute('href', 'data:text/ino;charset=utf-8,' + encodeURIComponent(code));
	element.setAttribute('download', filename);
	element.style.display = 'none';
	document.body.appendChild(element);
	element.click();
	document.body.removeChild(element);
};
BlocklyDuino.saveXmlFile = function () {
	var xml = Blockly.Xml.workspaceToDom(Blockly.mainWorkspace);
	var toolbox = window.localStorage.toolbox;
	if (toolbox) {
		var newel = document.createElement("toolbox");
		newel.appendChild(document.createTextNode(toolbox));
		xml.insertBefore(newel, xml.childNodes[0]);
	}
	var data = Blockly.Xml.domToPrettyText(xml);
	document.getElementById("title-project-name").value === '' ? document.getElementById("title-project-name").value = "Ottocode" : null;
	var projectname = document.getElementById("title-project-name").value;
	var filename = projectname+".bloc";
	var element = document.createElement('a');
	element.setAttribute('href', 'data:text/bloc;charset=utf-8,' + encodeURIComponent(data));
	element.setAttribute('download', filename);
	element.style.display = 'none';
	document.body.appendChild(element);
	element.click();
	document.body.removeChild(element)
};
