'use strict';

// MPR: canciones agregadas al bloque "Tocar RTTTL" (categoría Zumbador). Aparecen primero en su lista.
// Cada canción: [texto en la lista (neutro, no revela el nombre), identificador, nombre real, etapas].
// Cada etapa: [identificador C, melodía RTTTL]. Las etapas suenan una tras otra dentro del mismo bloque.
// El nombre real se muestra al subir el programa al robot (Blockly.MPR_revelarCanciones).
// El generador del bloque (RTTTL.js) escribe la melodía en el programa solo si se usa.
// Formato RTTTL: Nombre:d=duración,o=octava,b=pulsos por minuto:notas separadas por coma,
// sin espacios. Ver BITACORA.md (entrada "Canciones de 31 Minutos") para validarlas antes de agregarlas.
// Canciones de 31 Minutos (oct-2026): melodía principal de cada una, transcrita desde tablaturas de
// Songsterr y comparada con notas para flauta dulce / metalófono publicadas (fuentes en BITACORA.md).
// Melodías para uso educativo (sin letra); los derechos de las canciones son de sus autores.
Blockly.MPR_CANCIONES = [
	// 31 Minutos: Yo nunca vi televisión
	["Canción misteriosa 1", "MPR_Cancion1", "31 Minutos: Yo nunca vi televisión", [
		["MPR_C1E1", "C1E1:d=16,o=6,b=83:d,p,e,d,p,8f#.,8d,e,8d,8f#.,8d,e,8d,b5,p,2d,p,d,p,e,d,p,8f#.,8d,e,8d,8f#.,8d,e,8d,4b.5,b5,b,8b.5,d,p,e,d,p,8f#.,8d,e,8d,8f#.,8d,e,8d,b5,p,8d,8f#,e,d,8e,d,8b5,p,d,e,d,8f#,8d,e,8d,8a.,8d,f#,8e,4d."],
		["MPR_C1E2", "C1E2:d=8,o=6,b=83:16d,16e,d,e.,d,16e,16d.,32d,4a,16p,b.,16a,16p,f#,e,4d,p,16d,16e,d,e.,d,16e,d,a,4f#.,16p,16g,f#,e,f#,d,p,16d,16e,d,e.,d,16e,d.,4a,4g,f#.,e,16d,16e,16d,f#,d,16e,d,a.,d,16f#,e,2d"],
	]],
	// 31 Minutos: Bailan sin cesar
	["Canción misteriosa 2", "MPR_Cancion2", "31 Minutos: Bailan sin cesar", [
		["MPR_C2E1", "C2E1:d=8,o=6,b=130:f,f,f,16a#,16g,2p,f,f,f,16a#,16g,2p,f,f,f,16f,16g,p,g,16g,g.,f,d,d,16d,c.,a#5,4p,g,a#,g,16f,f.,g,4p,f,f,f,16a#,16g,2p,f,f,f,16a#,16g,2p,f,f,f,16f,16g,p,g,16g,g.,f,d,d,16d,c.,a#5"],
	]],
	// 31 Minutos: Mi muñeca me habló
	["Canción misteriosa 3", "MPR_Cancion3", "31 Minutos: Mi muñeca me habló", [
		["MPR_C3E1", "C3E1:d=8,o=6,b=196:e,d,e,d,c,a5,2c,2p,4p,4c,4e,4g,2g,2c,4p,e,d,e,d,c,a5,4d,2p,4p,p,4g5,g5,e,e,e,e,4c,1p,e,d,e,d,c,a5,2c,2p,4p,4c,4e,4g,2g,2c,4p,e,d,e,d,c,a5,4d,2p,4p,p,4g5,g5,e,e,e,e,4c"],
	]],
	// 31 Minutos: El dinosaurio Anacleto
	["Canción misteriosa 4", "MPR_Cancion4", "31 Minutos: El dinosaurio Anacleto", [
		["MPR_C4E1", "C4E1:d=8,o=5,b=106:g,g,g,g,c6,c6,c6,c6,b,b,b,d6,4a,a,e,g,g,g,g,c6,c6,c6,c6,b,b,b,g,4a,4p,g6,f#6,e6,d6,c6,b,a,g,b,b,b,g,4a,4a,g6,f#6,e6,d6,c6,b,a,g,b,b,b,g,4a"],
		["MPR_C4E2", "C4E2:d=4,o=6,b=106:f#,f#,8f#,8e,8f#,g,e.,8d,8c,8e,d,b.5,2p,b.,a.,g,f#,f#,8f#,8e,8f#,g,e.,8d,8c,8e,d.,2p,p,b.,a.,g"],
	]],
];

// Devuelve las canciones misteriosas usadas en el espacio de trabajo: [[texto en la lista, nombre real], ...]
Blockly.MPR_cancionesUsadas = function(ws) {
	var usadas = [];
	if (!ws) return usadas;
	ws.getAllBlocks().forEach(function(b) {
		if (b.type != 'RTTTL_music') return;
		var id = b.getFieldValue('MELODY');
		(Blockly.MPR_CANCIONES || []).forEach(function(c) {
			if (c[1] == id && !usadas.some(function(u) { return u[0] == c[0]; })) usadas.push([c[0], c[2]]);
		});
	});
	return usadas;
};
