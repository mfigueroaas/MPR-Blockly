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
// Canciones 5 a 10 (nov-2026): tablaturas de Songsterr (voz o melodía); varias están generadas por IA o son arreglos:
// conviene escucharlas con la herramienta (--wav) y en el robot. Recetas en tools/rtttl/LEEME.md.
// Melodías para uso educativo (sin letra); los derechos de las canciones son de sus autores.
Blockly.MPR_CANCIONES = [
	// 31 Minutos: Yo nunca vi televisión
	["Misteriosa 1: noticiero de títeres", "MPR_Cancion1", "31 Minutos: Yo nunca vi televisión", [
		["MPR_C1E1", "C1E1:d=16,o=6,b=83:d,p,e,d,p,8f#.,8d,e,8d,8f#.,8d,e,8d,b5,p,2d,p,d,p,e,d,p,8f#.,8d,e,8d,8f#.,8d,e,8d,4b.5,b5,b,8b.5,d,p,e,d,p,8f#.,8d,e,8d,8f#.,8d,e,8d,b5,p,8d,8f#,e,d,8e,d,8b5,p,d,e,d,8f#,8d,e,8d,8a.,8d,f#,8e,4d."],
		["MPR_C1E2", "C1E2:d=8,o=6,b=83:16d,16e,d,e.,d,16e,16d.,32d,4a,16p,b.,16a,16p,f#,e,4d,p,16d,16e,d,e.,d,16e,d,a,4f#.,16p,16g,f#,e,f#,d,p,16d,16e,d,e.,d,16e,d.,4a,4g,f#.,e,16d,16e,16d,f#,d,16e,d,a.,d,16f#,e,2d"],
	]],
	// 31 Minutos: Bailan sin cesar
	["Misteriosa 2: bailar sin parar", "MPR_Cancion2", "31 Minutos: Bailan sin cesar", [
		["MPR_C2E1", "C2E1:d=8,o=6,b=130:f,f,f,16a#,16g,2p,f,f,f,16a#,16g,2p,f,f,f,16f,16g,p,g,16g,g.,f,d,d,16d,c.,a#5,4p,g,a#,g,16f,f.,g,4p,f,f,f,16a#,16g,2p,f,f,f,16a#,16g,2p,f,f,f,16f,16g,p,g,16g,g.,f,d,d,16d,c.,a#5"],
	]],
	// 31 Minutos: Mi muñeca me habló
	["Misteriosa 3: una muñeca que habla", "MPR_Cancion3", "31 Minutos: Mi muñeca me habló", [
		["MPR_C3E1", "C3E1:d=8,o=6,b=196:e,d,e,d,c,a5,2c,2p,4p,4c,4e,4g,2g,2c,4p,e,d,e,d,c,a5,4d,2p,4p,p,4g5,g5,e,e,e,e,4c,1p,e,d,e,d,c,a5,2c,2p,4p,4c,4e,4g,2g,2c,4p,e,d,e,d,c,a5,4d,2p,4p,p,4g5,g5,e,e,e,e,4c"],
	]],
	// 31 Minutos: El dinosaurio Anacleto
	["Misteriosa 4: un dinosaurio gigante", "MPR_Cancion4", "31 Minutos: El dinosaurio Anacleto", [
		["MPR_C4E1", "C4E1:d=8,o=5,b=106:g,g,g,g,c6,c6,c6,c6,b,b,b,d6,4a,a,e,g,g,g,g,c6,c6,c6,c6,b,b,b,g,4a,4p,g6,f#6,e6,d6,c6,b,a,g,b,b,b,g,4a,4a,g6,f#6,e6,d6,c6,b,a,g,b,b,b,g,4a"],
		["MPR_C4E2", "C4E2:d=4,o=6,b=106:f#,f#,8f#,8e,8f#,g,e.,8d,8c,8e,d,b.5,2p,b.,a.,g,f#,f#,8f#,8e,8f#,g,e.,8d,8c,8e,d.,2p,p,b.,a.,g"],
	]],
	// Himno Nacional de Chile
	["Misteriosa 5: se canta de pie en el colegio", "MPR_Cancion5", "Himno Nacional de Chile", [
		["MPR_C5E1", "C5E1:d=8,o=5,b=117:b,e6,4e6,d#6,c#6,c#6,c#6,b,b,4b.,16a,4g#,16p,f#,g#,4a,c#6,a,4g#,b,g#,2f#,4p,b,e6,4e6,d#6,c#6,4c#6,b,a,4b.,16a,4g#,16p,b,e6,d#6,16c#6,d#.6,e6,4c#6,c#6,d#6,2b"],
		["MPR_C5E2", "C5E2:d=8,o=5,b=117:4g#,e,e,4f#,d#,d#,e,4e,4p,p,e,e,4g#,e,e,4f#,d#,d#,e,4e.,4p,e,e,4g#,e,e,4f#,d#,d#,e,1e"],
	]],
	// La Bamba (baile tradicional mexicano)
	["Misteriosa 6: baile mexicano con zapateo", "MPR_Cancion6", "La Bamba (baile tradicional mexicano)", [
		["MPR_C6E1", "C6E1:d=8,o=6,b=152:f,f,16f,16p,f.,16p,f,4e,c.,2p,4p,16p,f,16f,16p,16f,16p,f,f,f,4e,c.,p,16p,c.,16p,c,d.,16p,4b5,16d,16p,f,16p,e,16p,16d,16p,e.,c,2p,4p,16p,f,16f,16p,16f,16p,f,f,f,4e,c,4p,c.,16p,c,d.,16p,b.5,16p,16d,16p,f,16p,e,16p,16d,16p,e.,c"],
	]],
	// Cielito lindo (tradicional mexicana)
	["Misteriosa 7: mariachi: canta y no llores", "MPR_Cancion7", "Cielito lindo (tradicional mexicana)", [
		["MPR_C7E1", "C7E1:d=8,o=6,b=178:a5,b5,c#,d,e,2f#.,2e,4d,1b.5,2e.,2e,4d,4f#,1d,4a5,2b5,4a5"],
	]],
	// Run Run se fue pa'l norte (Violeta Parra)
	["Misteriosa 8: alguien se fue hacia el norte", "MPR_Cancion8", "Run Run se fue pa'l norte (Violeta Parra)", [
		["MPR_C8E1", "C8E1:d=4,o=5,b=90:b,g,a,f#,d6,a,g.,8e,g.,8e,g.,8a,1f#,b,g,a,f#,d6,a,g.,8e,g.,8e,g.,8e,1e"],
	]],
	// La cucaracha (tradicional)
	["Misteriosa 9: un bichito que ya no camina", "MPR_Cancion9", "La cucaracha (tradicional)", [
		["MPR_C9E1", "C9E1:d=8,o=5,b=180:e,e,e,4a.,4c#6,32p,e,e,e,4a.,2c#6,p,16p,32p,4a,a,g#,g#,f#,f#,2e,p,e,e,e,4g#.,4b,e,e,e,4g#.,2b.,4e6,f#6,e6,d6,c#6,b,2c#6"],
	]],
	// Gracias a la vida (Violeta Parra)
	["Misteriosa 10: gracias por todo lo que me dio", "MPR_Cancion10", "Gracias a la vida (Violeta Parra)", [
		["MPR_C10E1", "C10E1:d=8,o=6,b=96:16f,16f,16f,16f,f,f#,2c,2p,d#,d#,16d#,d#,d#,c#,f.,a#5,4a#.5,4p,c#,c#,c#,16c#,c#,4g#5,2p,p,16p,f,f,16f,16f,16f,16f,f,4c#"],
	]],
];

// Devuelve las canciones misteriosas usadas en el espacio de trabajo: [[texto en la lista, nombre real], ...]
Blockly.MPR_cancionesUsadas = function(ws) {
	var usadas = [];
	if (!ws) return usadas;
	ws.getAllBlocks().forEach(function(b) {
		if (b.type != 'RTTTL_music_lat') return;
		var id = b.getFieldValue('MELODY');
		(Blockly.MPR_CANCIONES || []).forEach(function(c) {
			if (c[1] == id && !usadas.some(function(u) { return u[0] == c[0]; })) usadas.push([c[0], c[2]]);
		});
	});
	return usadas;
};
