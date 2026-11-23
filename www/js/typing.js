// Tipos de bloque para la comprobación de tipos del generador C++ (Blockly.Types, js/type.js y compañía).
// Solo se asigna a los bloques que existen; si uno no está cargado, su línea se omite sin lanzar error.
// Las líneas de digital_read en adelante se quitaron: ese bloque no existe, así que el archivo lanzaba
// TypeError en esa línea y nunca se ejecutaban. El código C++ generado no cambia.
// logic
if (Blockly.Blocks.inout_onoff) Blockly.Blocks.inout_onoff.getBlockType = function() {
	return Blockly.Types.BOOLEAN;
};
if (Blockly.Blocks.controls_if) Blockly.Blocks.controls_if.getBlockType = function() {
	return Blockly.Types.BOOLEAN;
};
if (Blockly.Blocks.controls_switch) Blockly.Blocks.controls_switch.getVars = function() {
	return [this.getFieldValue('SWVAR')];
};
if (Blockly.Blocks.logic_compare) Blockly.Blocks.logic_compare.getBlockType = function() {
	return Blockly.Types.BOOLEAN;
};
if (Blockly.Blocks.logic_operation) Blockly.Blocks.logic_operation.getBlockType = function() {
	return Blockly.Types.BOOLEAN;
};
if (Blockly.Blocks.logic_negate) Blockly.Blocks.logic_negate.getBlockType = function() {
	return Blockly.Types.BOOLEAN;
};
if (Blockly.Blocks.logic_null) Blockly.Blocks.logic_null.getBlockType = function() {
	return Blockly.Types.NULL;
};
// loop
if (Blockly.Blocks.controls_for) Blockly.Blocks.controls_for.getVars = function() {
	return [this.getFieldValue('VAR')];
};
if (Blockly.Blocks.controls_repeat_ext) Blockly.Blocks.controls_repeat_ext.getBlockType = function() {
	return Blockly.Types.NUMBER;
};
if (Blockly.Blocks.controls_whileUntil) Blockly.Blocks.controls_whileUntil.getBlockType = function() {
	return Blockly.Types.BOOLEAN;
};
if (Blockly.Blocks.controls_flow_statements) Blockly.Blocks.controls_flow_statements.getVars = function() {
	return Blockly.Types.BOOLEAN;
};
// math
if (Blockly.Blocks.math_number) Blockly.Blocks.math_number.getBlockType = function() {
	var numString = this.getFieldValue('NUM');
	return Blockly.Types.identifyNumber(numString);
};
if (Blockly.Blocks.inout_angle_maths) Blockly.Blocks.inout_angle_maths.getBlockType = function() {
	return Blockly.Types.NUMBER;
};
if (Blockly.Blocks.math_arithmetic) Blockly.Blocks.math_arithmetic.getBlockType = function() {
	return Blockly.Types.NUMBER;
};
if (Blockly.Blocks.intervalle) Blockly.Blocks.intervalle.getBlockType = function() {
	return Blockly.Types.BOOLEAN;
};
if (Blockly.Blocks.math_single) Blockly.Blocks.math_single.getBlockType = function() {
	return Blockly.Types.DECIMAL;
};
if (Blockly.Blocks.math_trig) Blockly.Blocks.math_trig.getBlockType = function() {
	return Blockly.Types.DECIMAL;
};
if (Blockly.Blocks.math_constant) Blockly.Blocks.math_constant.getBlockType = function() {
	return Blockly.Types.DECIMAL;
};
if (Blockly.Blocks.math_number_property) Blockly.Blocks.math_number_property.getBlockType = function() {
	return Blockly.Types.BOOLEAN;
};
if (Blockly.Blocks.math_round) Blockly.Blocks.math_round.getBlockType = function() {
	return Blockly.Types.DECIMAL;
};
if (Blockly.Blocks.math_modulo) Blockly.Blocks.math_modulo.getBlockType = function() {
	return Blockly.Types.NUMBER;
};
if (Blockly.Blocks.math_random_int) Blockly.Blocks.math_random_int.getBlockType = function() {
	return Blockly.Types.NUMBER;
};
// text
if (Blockly.Blocks.text) Blockly.Blocks.text.getBlockType = function() {
	return Blockly.Types.TEXT;
};
if (Blockly.Blocks.text_char) Blockly.Blocks.text_char.getBlockType = function() {
	return Blockly.Types.TEXT;
};
if (Blockly.Blocks.text_join) Blockly.Blocks.text_join.getBlockType = function() {
	return Blockly.Types.TEXT;
};
if (Blockly.Blocks.text_length) Blockly.Blocks.text_length.getBlockType = function() {
	return Blockly.Types.NUMBER;
};
if (Blockly.Blocks.text_isEmpty) Blockly.Blocks.text_isEmpty.getBlockType = function() {
	return Blockly.Types.BOOLEAN;
};
// arduino_time
if (Blockly.Blocks.millis) Blockly.Blocks.millis.getBlockType = function() {
	return Blockly.Types.LARGE_NUMBER;
};
if (Blockly.Blocks.base_delay) Blockly.Blocks.base_delay.getBlockType = function() {
	return Blockly.Types.NUMBER;
};
