'use strict';

// MPR: modo monitor (DOCUMENTACION_TECNICA.md 4.14). Herramientas para que los monitores (los adultos de cada mesa)
// depuren el programa de un niño con el Monitor Serie. Se enciende y se apaga solo con Ctrl + Mayús + M (sin botón,
// como Ctrl + Mayús + O de la calibración y Ctrl + Mayús + P de mpr_revision.js), y con él activo aparecen:
//  - la categoría "🛠️ Monitor" al final del menú (toolbox_arduino_all.xml, CAT_MPR_MONITOR): la agrega
//    BlocklyDuino.buildToolbox (blocklino.js) solo si el modo está activo;
//  - el botón "Monitor Serie" (#btn_term de index.html), que abre www/term.html (index.js → ipc "prompt").
// El estado se guarda en sessionStorage (mpr_modo_monitor): sigue tras F5 y al reabrir la app vuelve apagado.
// Al apagarlo se quitan la categoría y el botón; los bloques que ya están en la mesa se quedan y siguen generando código.

var MPRMonitor = {
	CLAVE: 'mpr_modo_monitor'
};

MPRMonitor.msg = function(k, d) {
	return (typeof MSG != 'undefined' && MSG[k]) || d || '';
};

MPRMonitor.activo = function() {
	if (window.BlocklyDuino && BlocklyDuino.modoMonitor) return BlocklyDuino.modoMonitor();
	try { return window.sessionStorage.getItem(MPRMonitor.CLAVE) == '1'; } catch (e) { return false; }
};

MPRMonitor.alternar = function() {
	var self = MPRMonitor, activar = !self.activo();
	try {
		if (activar) window.sessionStorage.setItem(self.CLAVE, '1');
		else window.sessionStorage.removeItem(self.CLAVE);
	} catch (e) { return; }
	self.aplicar(true);
};

// Muestra u oculta el botón y rehace el menú con o sin la categoría (cambiar = true: el modo acaba de cambiar)
MPRMonitor.aplicar = function(cambiar) {
	var self = MPRMonitor, on = self.activo();
	var b = document.getElementById('btn_term');
	if (b) {
		if (on) b.className = b.className.replace(/\s*\bhidden\b/g, '');
		else if (!/\bhidden\b/.test(b.className)) b.className += ' hidden';
	}
	if (!cambiar) return;
	var ws = window.BlocklyDuino && BlocklyDuino.workspace;
	if (ws && ws.updateToolbox && BlocklyDuino.buildToolbox) {
		// la lupa puede estar mostrando bloques de la categoría: se cierra antes de rehacer el menú
		if (typeof MPRBuscar != 'undefined' && MPRBuscar.abierta && MPRBuscar.abierta()) MPRBuscar.cerrar();
		try { Blockly.hideChaff(); } catch (e) {}
		try { ws.updateToolbox(BlocklyDuino.buildToolbox()); } catch (e) { console.log('[Modo monitor]', e); }
	}
	self.aviso(on);
};

// Aviso pequeño abajo al centro, el mismo de Ctrl + Mayús + P (#mpr_rev_aviso, estilos en blocklino.css): no usa el
// globo de Otto para que los niños de la mesa no le pongan atención. Se va solo a los 3 s.
MPRMonitor.aviso = function(on) {
	var self = MPRMonitor;
	var e = document.getElementById('mpr_rev_aviso');
	if (!e) { e = document.createElement('div'); e.id = 'mpr_rev_aviso'; document.body.appendChild(e); }
	e.innerHTML = '<span class="punto"></span>' + self.msg(on ? 'mon_activado' : 'mon_desactivado',
		on ? 'Modo monitor activado: tienes la categoría 🛠️ Monitor y el botón del Monitor Serie' : 'Modo monitor desactivado');
	e.className = on ? 'si' : 'no';
	void e.offsetWidth;   // para que la transición parta de nuevo si se aprieta seguido
	e.className += ' visible';
	clearTimeout(self.avisoT);
	if (typeof MPRRevision != 'undefined') clearTimeout(MPRRevision.avisoT);
	self.avisoT = setTimeout(function() { e.className = e.className.replace(' visible', ''); }, 3000);
};

// Ctrl + Mayús + M (keyCode 77 por si e.key no llega). No lo usan Blockly ni Electron (la ventana no tiene menú).
document.addEventListener('keydown', function(e) {
	if (e.ctrlKey && e.shiftKey && !e.altKey && (e.key == 'M' || e.key == 'm' || e.keyCode == 77)) {
		e.preventDefault();
		e.stopPropagation();
		MPRMonitor.alternar();
	}
}, true);

// F8 (consola de desarrollo) solo con el modo monitor activo. Antes lo atendía el proceso principal siempre.
document.addEventListener('keydown', function(e) {
	if (e.key != 'F8' || !MPRMonitor.activo()) return;
	e.preventDefault();
	try { require('electron').remote.getCurrentWebContents().toggleDevTools(); } catch (err) { console.log(err); }
}, true);

// Tras F5 con el modo activo, el menú ya trae la categoría (buildToolbox lee sessionStorage): solo falta el botón
document.addEventListener('DOMContentLoaded', function() { MPRMonitor.aplicar(false); });
