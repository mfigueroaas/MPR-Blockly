'use strict';

// MPR: búsqueda de bloques con el botón de la lupa (barra superior, a la derecha).
// Al escribir, los bloques del menú que coinciden aparecen en el panel lateral de Blockly
// (el mismo que abre una categoría) y se arrastran al área de trabajo como siempre.
// Solo se buscan los bloques de las categorías visibles (los ocultos no aparecen).
// Si una palabra coincide con una opción de una lista (por ejemplo "Adelante" o "Triste"),
// el bloque aparece con esa opción ya elegida.
// Se carga en index.html después de blocklino.js. No modifica blockly.min.js.

var MPRBuscar = {
	indice: null,       // bloques fijos del menú; se arma una vez por menú (languageTree)
	arbol: null,        // languageTree con el que se armó el índice
	dinamicas: [],      // categorías que cambian (Variables, Funciones): se leen en cada búsqueda
	temporizador: null,
	MAX_RESULTADOS: 40,
	MAX_VARIANTES: 4,   // máximo de opciones distintas de un mismo bloque
	// Palabras que un alumno puede buscar y que no están escritas en los bloques
	SINONIMOS: {
		caminar: 'mover', camina: 'mover', andar: 'mover', avanzar: 'adelante', retroceder: 'atras',
		saltar: 'sube', salto: 'sube', baile: 'bailar', danza: 'bailar',
		cancion: 'rtttl', canciones: 'rtttl', musica: 'rtttl', melodia: 'rtttl',
		tono: 'sonido', parlante: 'sonido', espera: 'esperar', pausa: 'esperar',
		sensor: 'ultrasonido', emocion: 'gesto', cara: 'gesto'
	}
};

MPRBuscar.normalizar = function(texto) {
	return String(texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, ' ').trim();
};

// ¿La palabra aparece en el texto? Exacta en cualquier parte, o (si tiene 4 letras o más)
// sin su última letra al comienzo de una palabra: "giro" encuentra "girar".
MPRBuscar.contiene = function(texto, palabra) {
	if (!texto) return false;
	if (texto.indexOf(palabra) >= 0) return true;
	return palabra.length >= 4 && (' ' + texto).indexOf(' ' + palabra.slice(0, -1)) >= 0;
};

MPRBuscar.alInicio = function(texto, palabra) {
	return (' ' + texto).indexOf(' ' + palabra) >= 0;
};

// Describe un bloque del menú: textos que muestra y opciones de sus listas desplegables
MPRBuscar.describir = function(xml, categoria, sinPantalla) {
	var bloque;
	try {
		bloque = Blockly.Xml.domToBlock(xml, sinPantalla);
	} catch (e) {
		return null;
	}
	var visibles = [], campos = [], ayuda = '';
	try {
		bloque.inputList.forEach(function(entrada) {
			entrada.fieldRow.forEach(function(campo) {
				if (Blockly.FieldVariable && campo instanceof Blockly.FieldVariable) {
					return;   // sus "opciones" son renombrar/eliminar variable: no sirven para buscar
				}
				if (campo instanceof Blockly.FieldDropdown) {
					var opciones = [];
					(campo.getOptions_() || []).forEach(function(op) {
						var texto = typeof op[0] == 'string' ? op[0] : (op[0] && op[0].alt) || '';
						opciones.push({ valor: op[1], texto: MPRBuscar.normalizar(texto) });
					});
					if (campo.name) campos.push({ nombre: campo.name, opciones: opciones });
				} else if (!(campo instanceof Blockly.FieldImage) && campo.getText) {
					visibles.push(campo.getText());
				}
			});
		});
		ayuda = bloque.tooltip;
		if (typeof ayuda == 'function') ayuda = ayuda.call(bloque);
	} catch (e) {}
	bloque.dispose(false);
	return {
		xml: xml,
		categoria: categoria,
		categoriaNorm: MPRBuscar.normalizar(categoria),
		visible: MPRBuscar.normalizar(visibles.join(' ')),
		campos: campos,
		ayuda: MPRBuscar.normalizar(typeof ayuda == 'string' ? ayuda : '')
	};
};

MPRBuscar.recorrer = function(nodo, categoria, sinPantalla, indice) {
	for (var i = 0, hijo; hijo = nodo.childNodes[i]; i++) {
		if (!hijo.tagName) continue;
		var etiqueta = hijo.tagName.toUpperCase();
		if (etiqueta == 'CATEGORY') {
			var nombre = hijo.getAttribute('name') || categoria;
			var custom = hijo.getAttribute('custom');
			if (custom) {
				MPRBuscar.dinamicas.push({ custom: custom, nombre: nombre });
			} else {
				MPRBuscar.recorrer(hijo, nombre, sinPantalla, indice);
			}
		} else if (etiqueta == 'BLOCK') {
			var e = MPRBuscar.describir(hijo, categoria, sinPantalla);
			if (e) indice.push(e);
		}
	}
};

// Ejecuta f con un espacio de trabajo sin pantalla y sin eventos (no toca el área de trabajo)
MPRBuscar.sinPantalla = function(f) {
	var ws = new Blockly.Workspace();
	Blockly.Events.disable();
	try {
		f(ws);
	} finally {
		Blockly.Events.enable();
		ws.dispose();
	}
};

MPRBuscar.construirIndice = function(ws) {
	var arbol = ws.options.languageTree;
	if (MPRBuscar.indice && MPRBuscar.arbol === arbol) return MPRBuscar.indice;
	var indice = [];
	MPRBuscar.dinamicas = [];
	if (arbol) {
		MPRBuscar.sinPantalla(function(sp) { MPRBuscar.recorrer(arbol, '', sp, indice); });
	}
	MPRBuscar.indice = indice;
	MPRBuscar.arbol = arbol;
	return indice;
};

// Variables y Funciones cambian con el programa: se describen en cada búsqueda
MPRBuscar.indiceDinamico = function(ws) {
	var indice = [];
	MPRBuscar.dinamicas.forEach(function(d) {
		var lista = [];
		try {
			if (d.custom == Blockly.Variables.NAME_TYPE) lista = Blockly.Variables.flyoutCategory(ws);
			else if (d.custom == Blockly.Procedures.NAME_TYPE) lista = Blockly.Procedures.flyoutCategory(ws);
		} catch (e) {}
		MPRBuscar.sinPantalla(function(sp) {
			for (var i = 0; i < lista.length; i++) {
				var el = lista[i], etiqueta = el.tagName ? el.tagName.toUpperCase() : '';
				if (etiqueta == 'BLOCK') {
					var e = MPRBuscar.describir(el, d.nombre, sp);
					if (e) indice.push(e);
				} else if (etiqueta == 'BUTTON') {   // "Crear variable"
					indice.push({ xml: el, boton: true, categoria: d.nombre, categoriaNorm: MPRBuscar.normalizar(d.nombre),
						visible: MPRBuscar.normalizar(el.getAttribute('text')), campos: [], ayuda: '' });
				}
			}
		});
	});
	return indice;
};

MPRBuscar.palabras = function(consulta) {
	var palabras = [];
	MPRBuscar.normalizar(consulta).split(' ').forEach(function(p) {
		if (!p) return;
		palabras.push(MPRBuscar.SINONIMOS.hasOwnProperty(p) ? [p, MPRBuscar.SINONIMOS[p]] : [p]);
	});
	return palabras;   // cada palabra con sus alternativas
};

// Devuelve los resultados ordenados: [{entrada, puntaje, valores: {campo: [valores]}}]
MPRBuscar.buscar = function(consulta, ws) {
	var palabras = MPRBuscar.palabras(consulta);
	if (!palabras.length) return null;
	var indice = MPRBuscar.construirIndice(ws).concat(MPRBuscar.indiceDinamico(ws));
	var resultados = [];
	indice.forEach(function(e, orden) {
		var puntaje = 0, valores = {};
		for (var i = 0; i < palabras.length; i++) {
			var mejor = 0;
			palabras[i].forEach(function(p) {
				var pts = 0;
				if (MPRBuscar.contiene(e.visible, p)) pts = MPRBuscar.alInicio(e.visible, p) ? 12 : 8;
				e.campos.forEach(function(c) {
					c.opciones.forEach(function(o) {
						if (!MPRBuscar.contiene(o.texto, p)) return;
						var lista = valores[c.nombre] = valores[c.nombre] || [];
						if (lista.indexOf(o.valor) < 0) lista.push(o.valor);
						pts = Math.max(pts, MPRBuscar.alInicio(o.texto, p) ? 10 : 6);
					});
				});
				if (!pts && MPRBuscar.contiene(e.categoriaNorm, p)) pts = 3;
				if (!pts && MPRBuscar.contiene(e.ayuda, p)) pts = 1;
				mejor = Math.max(mejor, pts);
			});
			if (!mejor) return;   // todas las palabras deben aparecer
			puntaje += mejor;
		}
		resultados.push({ entrada: e, puntaje: puntaje, valores: valores, orden: orden });
	});
	resultados.sort(function(a, b) { return b.puntaje - a.puntaje || a.orden - b.orden; });
	return resultados;
};

// Copia del XML del bloque con algunas listas ya elegidas
MPRBuscar.variante = function(xml, valores) {
	var copia = xml.cloneNode(true);
	Object.keys(valores).forEach(function(nombre) {
		var campo = null;
		for (var i = 0, h; h = copia.childNodes[i]; i++) {
			if (h.tagName && h.tagName.toUpperCase() == 'FIELD' && h.getAttribute('name') == nombre) campo = h;
		}
		if (!campo) {
			campo = copia.ownerDocument.createElement('field');
			campo.setAttribute('name', nombre);
			copia.insertBefore(campo, copia.firstChild);
		}
		campo.textContent = valores[nombre];
	});
	return copia;
};

MPRBuscar.etiqueta = function(texto) {
	var e = goog.dom.createDom('label');
	e.setAttribute('text', texto);
	return e;
};

// Arma la lista de elementos para el panel: título, y por categoría su nombre y sus bloques
MPRBuscar.armarLista = function(consulta, resultados) {
	var lista = [], cuenta = 0, grupos = [], porCategoria = {};
	resultados.forEach(function(r) {
		var e = r.entrada, nombres = Object.keys(r.valores), xmls = [];
		if (e.boton || !nombres.length) {
			xmls.push(e.xml.cloneNode(true));
		} else {
			// varía la primera lista que coincidió; las demás toman su primera opción coincidente
			var fijos = {};
			nombres.slice(1).forEach(function(n) { fijos[n] = r.valores[n][0]; });
			r.valores[nombres[0]].slice(0, MPRBuscar.MAX_VARIANTES).forEach(function(v) {
				var vals = {};
				Object.keys(fijos).forEach(function(n) { vals[n] = fijos[n]; });
				vals[nombres[0]] = v;
				xmls.push(MPRBuscar.variante(e.xml, vals));
			});
		}
		xmls.forEach(function(x) {
			if (cuenta >= MPRBuscar.MAX_RESULTADOS) return;
			if (!porCategoria[e.categoria]) {
				porCategoria[e.categoria] = [];
				grupos.push(e.categoria);
			}
			porCategoria[e.categoria].push(x);
			cuenta++;
		});
	});
	var q = String(consulta).trim();
	if (!cuenta) {
		lista.push(MPRBuscar.etiqueta(MSG['buscar_ninguno'] + ' «' + q + '»'));
		return lista;
	}
	lista.push(MPRBuscar.etiqueta(cuenta == 1 ? MSG['buscar_uno'] + ' «' + q + '»'
		: cuenta + ' ' + MSG['buscar_varios'] + ' «' + q + '»'));
	grupos.forEach(function(g) {
		if (g) lista.push(MPRBuscar.etiqueta(g));
		porCategoria[g].forEach(function(x) { lista.push(x); });
	});
	return lista;
};

MPRBuscar.mostrar = function(consulta) {
	var ws = BlocklyDuino.workspace;
	var tb = ws && ws.toolbox_;
	if (!tb || !tb.flyout_) return;
	var resultados = MPRBuscar.buscar(consulta, ws);
	if (resultados === null) {
		MPRBuscar.ocultarResultados();
		return;
	}
	tb.clearSelection();   // ninguna categoría marcada: el panel muestra la búsqueda
	tb.flyout_.show(MPRBuscar.armarLista(consulta, resultados));
	tb.flyout_.scrollToStart();
};

// Oculta el panel solo si muestra una búsqueda (si hay una categoría elegida, Blockly lo maneja)
MPRBuscar.ocultarResultados = function() {
	var ws = BlocklyDuino.workspace;
	var tb = ws && ws.toolbox_;
	if (tb && tb.flyout_ && tb.flyout_.isVisible() && !tb.tree_.getSelectedItem()) tb.flyout_.hide();
};

MPRBuscar.programar = function() {
	clearTimeout(MPRBuscar.temporizador);
	MPRBuscar.temporizador = setTimeout(function() {
		MPRBuscar.mostrar(document.getElementById('buscar_bloques').value);
	}, 150);
};

MPRBuscar.ubicar = function() {
	var caja = document.getElementById('buscar_bloques');
	var grupo = document.getElementById('btn_group');
	var cabecera = document.getElementById('header');
	if (!caja || !grupo || !cabecera) return;
	caja.style.right = Math.round(cabecera.getBoundingClientRect().right - grupo.getBoundingClientRect().left + 8) + 'px';
};

MPRBuscar.abierta = function() {
	return document.getElementById('buscar_bloques').style.display == 'block';
};

MPRBuscar.abrir = function() {
	var caja = document.getElementById('buscar_bloques');
	caja.style.display = 'block';
	MPRBuscar.ubicar();
	$('#btn_buscar').addClass('activo');
	caja.focus();
	caja.select();
	if (caja.value) MPRBuscar.mostrar(caja.value);
};

MPRBuscar.cerrar = function() {
	var caja = document.getElementById('buscar_bloques');
	clearTimeout(MPRBuscar.temporizador);
	caja.style.display = 'none';
	$('#btn_buscar').removeClass('activo');
	MPRBuscar.ocultarResultados();
	caja.blur();
};

MPRBuscar.alternar = function() {
	if (MPRBuscar.abierta()) MPRBuscar.cerrar(); else MPRBuscar.abrir();
};

document.addEventListener('DOMContentLoaded', function() {
	var caja = document.getElementById('buscar_bloques');
	if (!caja || !document.getElementById('btn_buscar')) return;
	$('#btn_buscar').on('click', MPRBuscar.alternar);
	caja.addEventListener('input', MPRBuscar.programar);
	caja.addEventListener('focus', function() {
		if (caja.value) MPRBuscar.mostrar(caja.value);
	});
	caja.addEventListener('keydown', function(e) {
		if (e.keyCode == 27) {          // Esc: cerrar
			e.preventDefault();
			MPRBuscar.cerrar();
		} else if (e.keyCode == 13) {   // Enter: buscar ya
			e.preventDefault();
			clearTimeout(MPRBuscar.temporizador);
			MPRBuscar.mostrar(caja.value);
		}
	});
	window.addEventListener('resize', function() {
		if (MPRBuscar.abierta()) MPRBuscar.ubicar();
	});
	// En modo código (editor de texto) no hay bloques que buscar
	$('#codeORblock').on('change', function() {
		if ($('#codeORblock').prop('checked')) {
			$('#btn_buscar').removeClass('hidden');
		} else {
			MPRBuscar.cerrar();
			$('#btn_buscar').addClass('hidden');
		}
	});
	// Un clic en el área de trabajo (o Esc fuera de la caja) cierra el panel de resultados
	var hideChaffOriginal = Blockly.hideChaff;
	Blockly.hideChaff = function(opt_allowToolbox) {
		hideChaffOriginal.apply(this, arguments);
		if (!opt_allowToolbox) MPRBuscar.ocultarResultados();
	};
});
