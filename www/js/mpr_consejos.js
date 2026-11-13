'use strict';

// MPR: base de conocimiento de la mascota Otto. Para agregar un error común o un consejo basta con
// añadir una línea a las listas de abajo (no hay que tocar mpr_mascota.js).
//
//  ERRORES:  { codigo, re: /texto que aparece en el mensaje/, texto: 'lo que dice Otto', monitor: 'qué revisa el monitor',
//              anim: 'alerta' | 'pensar' }
//            Se revisan en orden; gana la primera que coincida. Se comparan contra el detalle técnico del cuadro de
//            verificar/cargar (en minúsculas; Windows en español escribe sus mensajes en español).
//            codigo: corto, para decirlo en voz alta en una mesa con ruido ("P3"). P = puerto y cable, B = bloques,
//            M = memoria, A = la app. La tabla completa para los monitores está en DOCUMENTACION_TECNICA.md 4.13.
//  SUELTOS:  mensaje cuando hay bloques sin conectar en la mesa de trabajo.
//  AZAR:     consejos cortos para el botón "Dame un consejo" y los ratos de calma. {birrete} se muestra como el ícono
//            del botón de ejemplos (MPRMascota.ICONOS).

var MPRConsejos = {
	ERRORES: [
		// "El sistema no puede encontrar el archivo especificado": el puerto ya no existe (va antes que P3, que también
		// trae "can't open device")
		{ codigo: 'P2', re: /cannot find the file|no puede encontrar el archivo|no se puede encontrar el archivo|no se encuentra el archivo|no such file or directory.*(com|tty)/,
		  texto: 'Parece que me desconecté. Revisa el cable USB en el computador y en mi placa: cuando me conectes, mi puerto aparecerá solo en la lista de arriba.',
		  monitor: 'El puerto elegido ya no existe. Revisar cable y conector; ver que aparezca un COM nuevo en la lista. Si no aparece ninguno: driver CH340 (carpeta driversUSB) o cable que solo carga.',
		  anim: 'pensar' },
		{ codigo: 'P3', re: /access is denied|acceso denegado|can't open device|cannot open|ser_open|permission denied|busy|ocupado/,
		  texto: 'Otro programa está usando mi cable USB. Cierra otras ventanas (por ejemplo otra MPR Blockly o la calibración), desenchúfame, vuelve a enchufarme y prueba otra vez.',
		  monitor: 'Puerto ocupado: cerrar otra ventana de MPR Blockly, Arduino IDE o monitor serie. Desenchufar y enchufar. Si sigue: reiniciar la app.',
		  anim: 'alerta' },
		{ codigo: 'P4', re: /not in sync|not responding|stk500|no responde|programmer is not/,
		  texto: 'Te encuentro, pero no te escucho. Revisa que el cable esté bien firme (algunos cables solo cargan y no sirven para programar) y que en la lista de arriba esté mi puerto. Luego vuelve a mandar tu programa.',
		  monitor: 'La placa no responde al cargador: probar otro cable de datos, otro puerto USB, revisar que la placa tenga luz. La app ya prueba sola Nano y Nano Old.',
		  anim: 'pensar' },
		// el #error que pone blocklino.js (renderArduinoCodePreview) cuando un bloque no sabe generar su código
		{ codigo: 'B7', re: /no funciona en el robot/,
		  texto: 'Uno de tus bloques no funciona en mí (viene de otra versión del programa). Busca en la mesa el bloque que dice el detalle y llévalo a la papelera.',
		  monitor: 'Bloque sin código para Arduino (por ejemplo, uno antiguo de un archivo). El detalle técnico dice cuál: quitarlo.',
		  anim: 'pensar' },
		{ codigo: 'B3', re: /ultrasound_distance\w*'? was not declared/,
		  texto: 'Usas el sensor de distancia (mis ojos), pero falta su bloque de configuración dentro de Configuración. Búscalo en Sensores y ponlo debajo de Configuración Otto.',
		  monitor: 'Falta el bloque de configuración del sensor ultrasónico (Trig 8, Echo 9) en Configuración.',
		  anim: 'pensar' },
		{ codigo: 'B2', re: /'otto' was not declared|'otto' does not name a type/,
		  texto: 'Falta el bloque Configuración Otto dentro de Configuración: sin él no sé dónde están mis piernas.',
		  monitor: 'Falta Configuración Otto (pines 2, 3, 4, 5 y zumbador 13) dentro de Configuración.',
		  anim: 'pensar' },
		{ codigo: 'B6', re: /was not declared|not declared in this scope|no se declar/,
		  texto: 'Un bloque usa algo que todavía no existe, por ejemplo una variable que no se creó. Revisa los bloques de variables.',
		  monitor: 'Nombre no declarado (variable o función): ver en el detalle qué nombre falta.',
		  anim: 'pensar' },
		{ codigo: 'B5', re: /multiple definition|redefinition|redeclaration|previously declared/,
		  texto: 'Hay algo repetido: tienes dos bloques que hacen lo mismo, por ejemplo dos configuraciones de Otto. Quita uno.',
		  monitor: 'Definición repetida: buscar bloques de configuración o funciones duplicadas.',
		  anim: 'pensar' },
		{ codigo: 'B4', re: /expected .* before|expected '[;)}]'|expected primary-expression|expected unqualified-id|invalid type argument of unary|too few arguments/,
		  texto: 'Un bloque tiene un espacio vacío. Revisa que todos estén completos: el "si" con su condición, "repetir" y "esperar" con su número.',
		  monitor: 'Entrada vacía en un bloque (si, comparar, repetir, esperar...). Otto lo marca antes de mandar.',
		  anim: 'pensar' },
		{ codigo: 'M1', re: /sketch too big|text section exceeds|overflowed|not enough memory|low memory|demasiado grande/,
		  texto: 'Tu programa es muy grande para mí. Prueba quitando canciones o bloques que no estés usando.',
		  monitor: 'Programa sobre la memoria del Nano: quitar canciones largas o bloques repetidos.',
		  anim: 'alerta' },
		// core de Arduino dañado en el PC: la app ya borró su caché y reintentó una vez (mpr_subida.js, limpiarCore)
		{ codigo: 'A2', re: /undefined reference to .main'|archive has no index|malformed archive|file format not recognized|file truncated/,
		  texto: 'A la app se le desordenaron unos archivos para preparar programas. Prueba otra vez; si vuelve a pasar, llama a tu monitor.',
		  monitor: 'Core de Arduino dañado en este PC (se cortó una compilación a medias). Cerrar la app, borrar la carpeta %TEMP%\\arduino-core-cache y las carpetas %TEMP%\\arduino-sketch-*, y abrirla de nuevo. Mientras tanto, elegir la otra placa (Nano / Nano Old) suele funcionar.',
		  anim: 'pensar' },
		{ codigo: 'A1', re: /enoent|spawn|no se reconoce|is not recognized|no such file or directory/,
		  texto: 'A la app le falta una pieza para preparar programas. Esto no lo puedes arreglar tú: llama a tu monitor.',
		  monitor: 'No se encontró arduino-cli o sus archivos: reinstalar MPR Blockly (C:\\MPRBlockly).',
		  anim: 'alerta' },
		{ codigo: 'A9', re: /error|failed|exit status/,
		  texto: 'Algo salió mal. Revisa que los bloques estén bien unidos y completos, y que yo esté conectado. Prueba otra vez.',
		  monitor: 'Error no reconocido: abrir "Ver detalle técnico" y leer la primera línea con "error".',
		  anim: 'alerta' }
	],

	// Si el mismo error sale VECES veces seguidas (sin un envío bueno entre medio), Otto pide llamar al monitor
	VECES: 3,
	LLAMAR: 'Ya lo intentamos {n} veces. Levanta la mano y llama a tu monitor: dile "código {codigo}".',
	// P5: la subida se quedó pegada en Verificando o Cargando y se detuvo (js/mpr_subida.js, avisarDemora)
	DEMORA_MONITOR: 'Se quedó pegado verificando o cargando: desenchufar y enchufar el cable. Si se repite: cerrar otras ventanas de MPR Blockly, otro puerto USB u otro cable, y reiniciar la app.',
	SIN_PUERTO_MONITOR: 'No hay puerto elegido: conectar el robot; si no aparece un COM, revisar cable de datos y driver CH340.',

	// {n} se reemplaza por la cantidad de bloques sueltos
	SUELTOS_UNO: 'Tienes 1 bloque suelto, fuera de Configuración + Bucle. Yo solo hago lo que está adentro: únelo a tu programa o arrástralo a la papelera.',
	SUELTOS_VARIOS: 'Tienes {n} bloques sueltos, fuera de Configuración + Bucle. Yo solo hago lo que está adentro: únelos a tu programa o arrástralos a la papelera.',

	// Bloques que van una sola vez (la mesa de un proyecto nuevo ya los trae)
	REPETIDO_ESTRUCTURA: 'Tu mesa ya tiene el bloque Configuración + Bucle, y solo puede haber uno. Pon tus bloques dentro del que ya está.',
	REPETIDO_CONFIG: 'Ya tienes Configuración Otto en tu programa: con uno basta. Puedes llevar este a la papelera.',

	SIN_PUERTO: 'Conéctame con el cable USB: cuando te encuentre, mi puerto (COM y un número) aparecerá solo en la lista de arriba. Si hay varios, elige el mío.',
	EXITO_CARGA: '¡Listo! Tu programa ya está en Otto. ¡A probarlo!',
	EXITO_VERIFICA: '¡Sin errores! Ahora mándaselo a Otto con la flecha naranja.',

	// Busca la explicación para un mensaje de error (la usan la mascota y el cuadro de subida, js/mpr_subida.js)
	explicar: function(texto) {
		var t = String(texto || '').toLowerCase();
		for (var i = 0; i < MPRConsejos.ERRORES.length; i++) {
			if (MPRConsejos.ERRORES[i].re.test(t)) return MPRConsejos.ERRORES[i];
		}
		return null;
	},

	// Cuenta cuántas veces seguidas salió el mismo código (null = salió bien: vuelve a cero). Devuelve la cuenta.
	seguidos: { codigo: null, n: 0 },
	registrar: function(codigo) {
		var s = MPRConsejos.seguidos;
		if (!codigo) { s.codigo = null; s.n = 0; return 0; }
		s.n = s.codigo == codigo ? s.n + 1 : 1;
		s.codigo = codigo;
		return s.n;
	},
	// Texto para llamar al monitor si ya van VECES intentos con el mismo error ('' si todavía no)
	llamar: function(codigo, n) {
		return n >= MPRConsejos.VECES ? MPRConsejos.LLAMAR.replace('{n}', n).replace('{codigo}', codigo) : '';
	},

	AZAR: [
		'Si te equivocas, presiona Ctrl + Z para deshacer.',
		'Haz clic derecho sobre un bloque: puedes duplicarlo o pedir ayuda.',
		'Arrastra un bloque a la papelera para borrarlo.',
		'Los bloques solo encajan si son compatibles. Si uno no se une, ¡prueba con otro!',
		'Guarda tu proyecto con el botón del disquete para no perderlo.',
		'El botón </> te muestra cómo se escribe tu programa en código.',
		'Empieza con pocos bloques y ve sumando más. ¡Así es más fácil!',
		'Antes de mandar tu programa, revisa que no queden bloques sueltos.',
		'Haz clic en mí y elige "Mis colores" para pintar a Otto como tú quieras.',
		'¿No sabes por dónde empezar? Mira los ejemplos en el botón {birrete} de arriba.'
	]
};
