'use strict';

goog.provide('Blockly.Blocks.sensors');
goog.provide('Blockly.Blocks.arduino');
goog.require('Blockly.Blocks');
Blockly.FieldCheckbox.CHECK_CHAR= '✅'


















Blockly.Blocks['ultrasonic_sensor'] = {  init: function() {
	var card=window.localStorage.card;
    this.setColour("#54BCF7");
    this.appendDummyInput()  .appendField(new Blockly.FieldImage("media/sensor_ultrasound.png",33,33))
    .appendField(Blockly.Msg.OTTO_HOME_TEXT + "#")	.appendField(new Blockly.FieldDropdown([['1','1'],['2','2'],['3','3'],['4','4']]), "US_NUMBER")
		.appendField(Blockly.Msg.ultrasonic_ranger).appendField(Blockly.Msg.TRIG).appendField(new Blockly.FieldDropdown(profile[card].dropdownAllPins), "PIN_TRIG");
	this.appendDummyInput()	.appendField(Blockly.Msg.Echo)	.appendField(new Blockly.FieldDropdown(profile[card].dropdownAllPins), "PIN_ECHO")
	this.setInputsInline(true);
	this.setPreviousStatement(true, null);
	this.setNextStatement(true, null);
    this.setHelpUrl(Blockly.Msg.HELPURL);
    this.setTooltip(Blockly.Msg.ultrason_tooltip);
  }
};

Blockly.Arduino['ultrasonic_sensor'] = function(block) {
	var PIN_TRIG = block.getFieldValue('PIN_TRIG');
	var PIN_ECHO = block.getFieldValue('PIN_ECHO');
	var us_number = this.getFieldValue('US_NUMBER');

    Blockly.Arduino.setups_['setup_output_'+PIN_TRIG] = 'pinMode('+PIN_TRIG+', OUTPUT);';
    Blockly.Arduino.setups_['setup_input_'+PIN_ECHO] = 'pinMode('+PIN_ECHO+', INPUT);';
	// MPR: lectura del paquete LIB_OTTO_SENSORES.zip (medida en el robot el 2026-11-13, 16 cm con regla = 16 cm leídos):
	// disparo de 25 µs y no 10 (el HC-SR04 clon no responde a 10 µs recién encendido, ni en la 1.5.0 ni con A7),
	// pulseIn con límite de 25 ms (sin él se congela 1 s) y sin eco da 400 cm, "nada adelante" (con 0 el robot
	// esquivaba siempre), igual que el simulador (MPRSimulador.SIN_ECO_CM).
	// MPR: (PLAN_PULIDO A10) el número del sensor (#1-#4) se ignoraba: dos sensores definían dos veces
	// ultrasound_distance_simple() y no compilaba. El #1 queda igual que antes (la tabla de errores de
	// mpr_consejos.js lo reconoce); #2-#4 usan ultrasound_distance_2() ... y la lectura usa la de su número.
	var clave = 'var_ultrasonic' + PIN_TRIG, funcion = 'ultrasound_distance_simple';
	if (us_number && us_number != '1') { clave = 'var_ultrasonic_n' + us_number; funcion = 'ultrasound_distance_' + us_number; }


if ((PIN_TRIG=="4") && (PIN_ECHO=="5"))
	{
	   Blockly.Arduino.definitions_[clave] = 'long ' + funcion + '() {\n'+
        '   long duration, distance;\n'+
        '   digitalWrite('+PIN_TRIG+',LOW);\n'+
        '   delayMicroseconds(100);\n'+
        '   digitalWrite('+PIN_TRIG+', HIGH);\n'+
        '   delayMicroseconds(100);\n'+
        '   digitalWrite('+PIN_TRIG+', LOW);\n'+
        '   duration = pulseIn('+ PIN_ECHO +', HIGH, 25000);\n'+
        '   if (duration == 0) return 400;\n'+
        '   distance = duration/58;\n'+
        '   if (distance > 400) distance = 400;\n'+
        '   return distance;\n'+
        '}\n';
	}
	else
	{
		Blockly.Arduino.definitions_[clave] = 'long ' + funcion + '() {\n'+
        '   long duration, distance;\n'+
        '   digitalWrite('+PIN_TRIG+',LOW);\n'+
        '   delayMicroseconds(4);\n'+
        '   digitalWrite('+PIN_TRIG+', HIGH);\n'+
        '   delayMicroseconds(25);\n'+
        '   digitalWrite('+PIN_TRIG+', LOW);\n'+
        '   duration = pulseIn('+ PIN_ECHO +', HIGH, 25000);\n'+
        '   if (duration == 0) return 400;\n'+
        '   distance = duration/58;\n'+
        '   if (distance > 400) distance = 400;\n'+
        '   return distance;\n'+
        '}\n';
	}

	 var code = '';
	 return code;
};

Blockly.Blocks["ultrasonic_distance"]={init:function(){
  this.appendDummyInput()
	.appendField(new Blockly.FieldImage("media/sensor_ultrasound.png",25,15))
  .appendField("#")	.appendField(new Blockly.FieldDropdown([['1','1'],['2','2'],['3','3'],['4','4']]), "US_NUMBER")
	.appendField(Blockly.Msg.ultrason_distance1);
  this.setColour("#54BCF7");
  this.setHelpUrl(Blockly.Msg.ultrason_helpurl);
  this.setInputsInline(false);
  this.setOutput(true, "Number");
  this.setTooltip(Blockly.Msg.ultrason_distance2);}
};
Blockly.Arduino["ultrasonic_distance"]=function(block){
  var code;
  var us_number = this.getFieldValue('US_NUMBER');

  // MPR: (PLAN_PULIDO A10) cada número lee su propio sensor (ver ultrasonic_sensor)
  code = (us_number && us_number != '1') ? 'ultrasound_distance_' + us_number + '()' : 'ultrasound_distance_simple()';
return [code, Blockly.Arduino.ORDER_ATOMIC];
};















































//////////////







//////////////














































































//Button of the MRTX-Uno board ----------------------------------------------------------------------



// ----------------------------------------------------------------------------------------------------------------


//Button of the MRTNode board ----------------------------------------------------------------------



// ----------------------------------------------------------------------------------------------------------------





///////////////////////////////////////////////////////////////////////////////////////////////////////////

/*  capteur  */
//////////////
//////////////
//////////////

//////////////
//////////////
//////////////
//////////////
//////////////
//////////////
//////////////
//////////////

//////////////
//////////////
//////////////
//////////////
//////////////
//////////////

////////// CCS811 Sensor ////////////









