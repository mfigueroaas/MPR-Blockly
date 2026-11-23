 /***************************************************************
 *
 *  This module was created by Oscar Ferruz. oferruz@logix5.com
 *
 ****************************************************************/
'use strict';

goog.provide('Blockly.Blocks.RTTTL');
goog.provide('Blockly.Blocks.arduino');
goog.require('Blockly.Blocks');

/*
Blockly.Blocks['RTTTL_music'] = {
  helpUrl: '',
  init: function() {
    this.setColour("#2a93e8");
    this.appendDummyInput()
	    .appendField(Blockly.Msg.APDS9960_name_gesture)
		.appendField(new Blockly.FieldDropdown(profile[card].dropdownAllPins), "PIN_BUZZER")
        .appendField(new Blockly.FieldDropdown([['StarWars','StarWars'],['MahnaMahna','MahnaMahna'],['LeisureSuit','LeisureSuit'],['MissionImp','MissionImp'],['Entertainer','Entertainer'],['Muppets','Muppets']]), "MELODY");
   	this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setTooltip('Play RTTTL melody');
  }
};*/

// MPR: dos bloques de canciones para explorar por separado (listas más cortas):
//  - RTTTL_music_lat: canciones latinoamericanas (mpr_canciones.js, "Canción misteriosa N")
//  - RTTTL_music: canciones extranjeras de la librería PlayRtttl (TV/dibujos y Navidad; el nombre del tipo se
//    mantiene para que sigan abriendo los ejemplos y programas guardados).
// Primero las misteriosas propias de MPR (Blockly.MPR_CANCIONES_EXT_PROPIAS, en mpr_canciones.js), luego las de la librería.
// MPR: (PLAN_PULIDO D3) las que llevan nombre de marca, serie o personaje se muestran como acertijo; el valor interno
// (lo que se guarda en los .bloc y va al código) sigue siendo el nombre de la melodía en la librería.
Blockly.MPR_CANCIONES_EXT = (Blockly.MPR_CANCIONES_EXT_PROPIAS || []).map(function(c) { return [c[0], c[1]]; }).concat([
  ['Misteriosa: dibujo animado de una familia amarilla','Simpsons'],
  ['Misteriosa: una familia de la edad de piedra','Flinstones'],
  ['Misteriosa: show de títeres con una rana presentadora','Muppets'],
  ['Misteriosa: un felino rosado muy elegante','PinkPanther'],
  ['Misteriosa: dibujos animados de un conejo y su pandilla','Looney'],
  ['Misteriosa: duendecitos azules con gorro blanco','Smurfs'],
  ['Misteriosa: un inspector con un sombrero lleno de inventos','Gadget'],
  ['Misteriosa: cuatro aventureros en un furgón negro','A_Team'],
  ['Misteriosa: música para pensar en un concurso de la tele','Jeopardy'],
  ['JingleBell','JingleBell'],['Misteriosa: un reno con la nariz roja','Rudolph'],['SilentNight','SilentNight'],['WinterWonderland','WinterWonderland'],
  ['WeWishYou','WeWishYou'],['OhDennenboom','OhDennenboom'],['LetItSnow','LetItSnow'],['Misteriosa: un muñeco de nieve que cobra vida','Frosty'],
  ['LastChristmas','LastChristmas'],['AllIWant','AllIWant'],['Short','Short']
]);

Blockly.Blocks['RTTTL_music'] = {
  init: function() {
	var card=window.localStorage.card;
    this.setColour("#FF63BB");
    this.appendDummyInput().appendField(Blockly.Msg.ARDUINO_TONE_INPUT1).appendField(new Blockly.FieldDropdown(profile[card].dropdownAllPins), "PIN_BUZZER");
	this.appendDummyInput().appendField(Blockly.Msg.ARDUINO_RTTTL_EXT || "Tocar canción extranjera ")
        .appendField(new Blockly.FieldDropdown(Blockly.MPR_CANCIONES_EXT), "MELODY");
	this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setTooltip("Toca una canción extranjera (TV, dibujos animados, Navidad)");
	this.setHelpUrl('');
  }
};

Blockly.Blocks['RTTTL_music_lat'] = {
  init: function() {
	var card=window.localStorage.card;
    this.setColour("#FF63BB");
    this.appendDummyInput().appendField(Blockly.Msg.ARDUINO_TONE_INPUT1).appendField(new Blockly.FieldDropdown(profile[card].dropdownAllPins), "PIN_BUZZER");
	this.appendDummyInput().appendField(Blockly.Msg.ARDUINO_RTTTL_LAT || "Tocar canción latinoamericana ")
        .appendField(new Blockly.FieldDropdown((Blockly.MPR_CANCIONES || []).map(function(c) { return [c[0], c[1]]; })), "MELODY");
	this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setTooltip("Toca una canción latinoamericana misteriosa: el nombre se revela al subir el programa al robot");
	this.setHelpUrl('');
  }
};

Blockly.Arduino['RTTTL_music'] = function(block) {
  var melody = this.getFieldValue('MELODY');
  var PIN_BUZZER = block.getFieldValue('PIN_BUZZER');
  var code;
  var card=window.localStorage.card;
  Blockly.Arduino.includes_['include_PlayRTTTL'] = '#include <PlayRtttl.hpp>\n';
  // Canción propia de MPR (no está en la librería): se genera igual que las latinoamericanas
  if ((Blockly.MPR_CANCIONES_EXT_PROPIAS || []).some(function(c) { return c[1] == melody; }))
	return Blockly.Arduino['RTTTL_music_lat'].call(this, block);
  if (card =="MRTnode")
	code= 'playRtttlBlocking('+PIN_BUZZER+',(char*)'+melody+');\n';
  else
	code= 'playRtttlBlockingPGM('+PIN_BUZZER+',(char*)'+melody+');\n';
 return code;
};

Blockly.Arduino['RTTTL_music_lat'] = function(block) {
  var melody = this.getFieldValue('MELODY');
  var PIN_BUZZER = block.getFieldValue('PIN_BUZZER');
  var code;
  var card=window.localStorage.card;
  Blockly.Arduino.includes_['include_PlayRTTTL'] = '#include <PlayRtttl.hpp>\n';
  // Las canciones latinoamericanas no están en la librería: se define cada etapa en el programa y se tocan en orden
  var etapas = [];
  (Blockly.MPR_CANCIONES || []).concat(Blockly.MPR_CANCIONES_EXT_PROPIAS || []).forEach(function(c) {
    if (c[1] != melody) return;
    c[3].forEach(function(e) {
      Blockly.Arduino.definitions_['mpr_cancion_' + e[0]] = 'static const char ' + e[0] + '[] PROGMEM = "' + e[1] + '";';
      etapas.push(e[0]);
    });
  });
  if (!etapas.length) etapas.push(melody);
  var play = (card == "MRTnode") ? 'playRtttlBlocking(' : 'playRtttlBlockingPGM(';
  code = etapas.map(function(e) { return play + PIN_BUZZER + ',(char*)' + e + ');\n'; }).join('');
 return code;
};

Blockly.Blocks['RTTTL_music_custom'] = {
  init: function() {
	var card=window.localStorage.card;
  this.setColour("#FF63BB");
  this.appendDummyInput().appendField(Blockly.Msg.ARDUINO_TONE_INPUT1).appendField(new Blockly.FieldDropdown(profile[card].dropdownAllPins), "PIN_BUZZER");
	this.appendValueInput("rtttl_melody").setCheck("String").appendField(Blockly.Msg.ARDUINO_RTTTL_BLOCK)
	this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setTooltip("Play RTTTL melody");
	this.setHelpUrl('');
  }
};

Blockly.Arduino['RTTTL_music_custom'] = function(block) {

  var PIN_BUZZER = block.getFieldValue('PIN_BUZZER');
  var rtttl_melody = Blockly.Arduino.valueToCode(block, 'rtttl_melody', Blockly.Arduino.ORDER_ATOMIC);
  var card=window.localStorage.card;
  var code;
  Blockly.Arduino.includes_['include_PlayRTTTL'] = '#include <PlayRtttl.hpp>\n';
  // MPR: (PLAN_PULIDO A10) el nombre salía de las letras 1 a 3 de la melodía ("Hi:d=..." daba melody_Hi:, que no
  // compila, y dos melodías que empiezan igual se pisaban). Ahora: nombre de la melodía solo con letras, números y _,
  // más un número sacado de todo el texto (misma melodía = mismo nombre, distinta = otro nombre).
  if (!/^"[\s\S]*"$/.test(rtttl_melody)) {
    // no es un texto escrito (variable, unir textos...): se toca desde la RAM, no se puede guardar en PROGMEM
    return 'playRtttlBlocking(' + PIN_BUZZER + ', String(' + (rtttl_melody || '""') + ').c_str());\n';
  }
  var hash = 5381;
  for (var k = 0; k < rtttl_melody.length; k++) hash = ((hash * 33) ^ rtttl_melody.charCodeAt(k)) >>> 0;
  var name_melody = rtttl_melody.slice(1, -1).split(':')[0].replace(/[^A-Za-z0-9_]/g, '').slice(0, 12) + '_' + hash.toString(16);
 Blockly.Arduino.definitions_['Melody_'+name_melody] = 'static const char melody_'+ name_melody+'[] PROGMEM = '+rtttl_melody+';\n';
  if (card =="MRTnode")
	code= 'playRtttlBlocking('+PIN_BUZZER+',(char*) melody_'+name_melody+');\n';
  else
	 code= 'playRtttlBlockingPGM('+PIN_BUZZER+',(char*) melody_'+name_melody+');\n';
 return code;
};

// This is a particular configutration for MRTX-Uno Board





