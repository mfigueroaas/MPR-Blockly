'use strict';

// MPR: bloques de la categoría "🛠️ Monitor" (modo monitor, Ctrl + Mayús + M: js/mpr_monitor.js y
// DOCUMENTACION_TECNICA.md 4.14). Sirven a los monitores (los adultos de cada mesa) para depurar un programa con el
// Monitor Serie. Los demás bloques de la categoría son los de siempre (serial_init, serial_print...); aquí van los dos
// nuevos y dos arreglos de bloques existentes. Textos en lang/Arduino_es.js (MPR_MOSTRAR*, MPR_BATERIA*).
// Se carga después de SerialUSB.js, arduino_generateurs_cpp.js y text.js (index.html): lo de aquí reemplaza lo de ellos.

// Clave de setups_ del Serial.begin: la misma que usa serial_init (SerialUSB.js). Así "mostrar" sin "Configuración del
// Monitor Serie" agrega Serial.begin(9600) una sola vez, y si el programa sí trae serial_init, manda la velocidad de él.
Blockly.Arduino.MPR_CLAVE_SERIAL = 'setup_serial';
Blockly.Arduino.addReservedWords('mpr_bateria_mV');

// ---------------------------------------------------------------- 📟 mostrar [nombre] = [valor]
Blockly.Blocks['mpr_mostrar'] = {
	init: function() {
		this.setColour('#0060aa');
		this.setHelpUrl('');
		this.appendValueInput('VALOR')
			.appendField(Blockly.Msg.MPR_MOSTRAR || '📟 mostrar')
			.appendField(new Blockly.FieldTextInput('distancia'), 'NOMBRE')
			.appendField('=');
		this.setInputsInline(true);
		this.setPreviousStatement(true, null);
		this.setNextStatement(true, null);
		this.setTooltip(Blockly.Msg.MPR_MOSTRAR_TOOLTIP || '');
	}
};

// bloques que dan verdadero/falso: se muestran con esas palabras (Serial.println(true) escribe "1")
Blockly.Arduino.MPR_LOGICOS = { logic_boolean: 1, logic_compare: 1, logic_negate: 1, intervalle: 1, math_number_property: 1 };
Blockly.Arduino.mprEsLogico = function(b) {
	if (!b) return false;
	if (b.type == 'logic_operation') return /^(and|or)$/i.test(String(b.getFieldValue('OP')));
	return !!Blockly.Arduino.MPR_LOGICOS[b.type];
};

// texto C++ entre comillas para un nombre escrito por el monitor (sin saltos de línea)
Blockly.Arduino.mprComillas = function(t) {
	return '"' + String(t == null ? '' : t).replace(/[\r\n]+/g, ' ').replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
};

Blockly.Arduino['mpr_mostrar'] = function(block) {
	Blockly.Arduino.addSetup(Blockly.Arduino.MPR_CLAVE_SERIAL, 'Serial.begin(9600);\n', false);
	var nombre = block.getFieldValue('NOMBRE') || '';
	var valor = Blockly.Arduino.valueToCode(block, 'VALOR', Blockly.Arduino.ORDER_NONE) || '0';
	if (Blockly.Arduino.mprEsLogico(block.getInputTargetBlock('VALOR'))) valor = '(' + valor + ') ? "verdadero" : "falso"';
	// F(...): el texto fijo queda en la memoria de programa y no ocupa la RAM del Nano (2 KB)
	return 'Serial.print(F(' + Blockly.Arduino.mprComillas(nombre + ' = ') + '));\n' +
		'Serial.println(' + valor + ');\n';
};

// ---------------------------------------------------------------- 🔋 batería (mV)
Blockly.Blocks['mpr_bateria'] = {
	init: function() {
		this.setColour('#0060aa');
		this.setHelpUrl('');
		this.appendDummyInput().appendField(Blockly.Msg.MPR_BATERIA || '🔋 batería (mV)');
		this.setOutput(true, 'Number');
		this.setTooltip(Blockly.Msg.MPR_BATERIA_TOOLTIP || '');
	}
};

Blockly.Arduino.MPR_FUNCION_BATERIA =
	'// MPR: tensión con que funciona el Nano (Vcc), en milivoltios, sin cables extra: mide la referencia interna de 1,1 V\n' +
	'// del ATmega328P contra Vcc (Vcc = 1,1 V * 1023 / lectura). Con pilas cansadas baja de ~4500 mV y Otto se reinicia.\n' +
	'// La referencia varía entre 1,0 y 1,2 V de un chip a otro: sirve para comparar, no como voltímetro exacto.\n' +
	'// La librería Otto nueva también usa el ADC para su freno por tensión, pero entre movimientos (no en paralelo con esta\n' +
	'// función), y cada analogRead() de Arduino vuelve a fijar ADMUX entero; igual se deja ADMUX como estaba.\n' +
	'long mpr_bateria_mV() {\n' +
	'  uint8_t admuxAntes = ADMUX;\n' +
	'  ADMUX = _BV(REFS0) | _BV(MUX3) | _BV(MUX2) | _BV(MUX1);  // referencia AVcc, canal 1,1 V interno\n' +
	'  delayMicroseconds(200);                                 // que la referencia se asiente\n' +
	'  ADCSRA |= _BV(ADSC);                                    // 1.a conversión: se descarta\n' +
	'  while (ADCSRA & _BV(ADSC)) { }\n' +
	'  ADCSRA |= _BV(ADSC);                                    // 2.a conversión: la válida\n' +
	'  while (ADCSRA & _BV(ADSC)) { }\n' +
	'  uint16_t lectura = ADC;\n' +
	'  ADMUX = admuxAntes;\n' +
	'  if (lectura == 0) return 0;\n' +
	'  return 1125300L / lectura;                              // 1125300 = 1,1 V * 1023 * 1000\n' +
	'}\n';

Blockly.Arduino['mpr_bateria'] = function(block) {
	Blockly.Arduino.addDeclaration('mpr_bateria_mV', Blockly.Arduino.MPR_FUNCION_BATERIA);
	return ['mpr_bateria_mV()', Blockly.Arduino.ORDER_UNARY_POSTFIX];
};

// ---------------------------------------------------------------- arreglos de bloques existentes
// "duración en ... desde el principio" (millis, categoría Tiempo): su generador devolvía un texto y no el par
// [código, orden] que Blockly espera de un bloque con valor. Con las comprobaciones de Blockly apagadas, el programa
// recibía solo la primera letra ("m" en vez de "millis()") y no compilaba. Se envuelve: el código es el mismo.
(function() {
	var original = Blockly.Arduino['millis'];
	if (typeof original != 'function' || original.mprPar) return;
	Blockly.Arduino['millis'] = function(block) {
		var c = original.call(this, block);
		if (Array.isArray(c)) return c;
		c = c || 'millis()';
		return [c, /\//.test(c) ? Blockly.Arduino.ORDER_MULTIPLICATIVE : Blockly.Arduino.ORDER_UNARY_POSTFIX];
	};
	Blockly.Arduino['millis'].mprPar = true;
})();

// Bloque de texto (" "): Blockly.Arduino.quote_ (generate_cpp.js) no escapa las comillas dobles, así que un texto con
// comillas (hola "Otto") daba un programa que no compilaba. Mismo código para todo lo demás.
Blockly.Arduino['text'] = function(block) {
	return [Blockly.Arduino.mprComillas(block.getFieldValue('TEXT')), Blockly.Arduino.ORDER_ATOMIC];
};

// "Serial leer como número" devuelve un número (parseFloat o atof), pero estaba marcado como texto ("String") y no se
// podía encajar en comparar ni en las operaciones de Matemática.
(function() {
	var b = Blockly.Blocks['serial_read_number'];
	if (!b || b.mprNumero) return;
	var init = b.init;
	b.init = function() {
		init.call(this);
		this.setOutput(true, 'Number');
	};
	b.mprNumero = true;
})();
