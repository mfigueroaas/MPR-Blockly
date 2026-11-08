'use strict';

// MPR: base de conocimiento de la mascota Otto. Para agregar un error común o un consejo basta con
// añadir una línea a las listas de abajo (no hay que tocar mpr_mascota.js).
//
//  ERRORES:  { re: /texto que aparece en el mensaje/, texto: 'lo que dice Otto', anim: 'alerta' | 'pensar' }
//            Se revisan en orden; gana la primera que coincida. Se comparan contra el mensaje rojo
//            del cuadro de verificar/cargar (en minúsculas).
//  SUELTOS:  mensaje cuando hay bloques sin conectar en la mesa de trabajo.
//  AZAR:     consejos cortos para el botón "Dame un consejo" y los ratos de calma.

var MPRConsejos = {
	ERRORES: [
		{ re: /not in sync|not responding|stk500|no responde/,
		  texto: 'Otto no me responde. Prueba cambiar la placa de "Nano" a "Nano Old" (o al revés) en la lista de arriba y vuelve a mandar tu programa.',
		  anim: 'pensar' },
		{ re: /access is denied|acceso denegado|can't open device|cannot open|ser_open|permission denied|busy/,
		  texto: 'No puedo hablar con el puerto USB. Tal vez otro programa lo está usando. Desenchufa y vuelve a enchufar el cable de Otto y elige el puerto otra vez.',
		  anim: 'alerta' },
		{ re: /cannot find the file specified|no se puede encontrar el archivo|no se encuentra el archivo|no such file or directory.*(com|tty)/,
		  texto: 'Parece que Otto se desconectó. Revisa el cable USB y elige el puerto de nuevo en la lista.',
		  anim: 'pensar' },
		{ re: /was not declared|not declared in this scope|no se declar/,
		  texto: 'Un bloque usa algo que todavía no existe. ¿Falta crear la variable o poner el bloque de configuración de Otto al principio?',
		  anim: 'pensar' },
		{ re: /multiple definition|redefinition|redeclaration|previously declared/,
		  texto: 'Hay algo repetido: tienes dos bloques que hacen lo mismo, por ejemplo dos configuraciones de Otto. Quita uno.',
		  anim: 'pensar' },
		{ re: /expected .* before|expected '[;)}]'|expected primary-expression|expected unqualified-id/,
		  texto: 'Falta algo en el programa. Revisa que ningún bloque tenga un espacio vacío sin completar.',
		  anim: 'pensar' },
		{ re: /sketch too big|text section exceeds|overflowed|not enough memory|low memory|demasiado grande/,
		  texto: 'Tu programa es muy grande para Otto. Prueba quitando canciones o bloques que no estés usando.',
		  anim: 'alerta' },
		{ re: /error/,
		  texto: 'Algo salió mal. Revisa que los bloques estén bien unidos y completos, y que Otto esté conectado. Si sigue igual, pídele ayuda a tu profe.',
		  anim: 'alerta' }
	],

	// {n} se reemplaza por la cantidad de bloques sueltos
	SUELTOS_UNO: 'Tienes 1 bloque suelto en la mesa. Los bloques sueltos también cuentan como parte del programa de Otto. Únelo a tu programa o arrástralo a la papelera.',
	SUELTOS_VARIOS: 'Tienes {n} bloques sueltos en la mesa. Los bloques sueltos también cuentan como parte del programa de Otto. Únelos a tu programa o arrástralos a la papelera.',

	SIN_PUERTO: 'Primero elige el puerto USB de Otto en la lista de arriba. Si no aparece, revisa que el cable esté bien conectado.',
	EXITO_CARGA: '¡Listo! Tu programa ya está en Otto. ¡A probarlo!',
	EXITO_VERIFICA: '¡Sin errores! Ahora mándaselo a Otto con la flecha naranja.',

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
		'¿No sabes por dónde empezar? Mira los ejemplos del birrete.'
	]
};
