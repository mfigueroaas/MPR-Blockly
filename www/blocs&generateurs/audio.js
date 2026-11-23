"use strict";
goog.provide("Blockly.Blocks.arduino");
goog.require("Blockly.Blocks");
  /////////////
 /*  audio  */
/////////////

Blockly.Blocks["buzzer_init"]={init:function(){
  var card=window.localStorage.card;
  this.appendDummyInput().appendField(new Blockly.FieldImage('media/buzzer.png', 33, 33, "*")).appendField(Blockly.Msg.OTTO_HOME_TEXT + Blockly.Msg.OTTO9_BUZZER)
  .appendField(new Blockly.FieldDropdown(profile[card].dropdownAllPins), "PIN");
  this.setInputsInline(true);
  this.setPreviousStatement(true, null);
  this.setNextStatement(true, null);
  this.setColour("#FF63BB");
  this.setHelpUrl(Blockly.Msg.HELPURL);
  this.setTooltip(Blockly.Msg.del_tooltip)}
};
Blockly.Arduino["buzzer_init"]=function(block){
  var value_pin=block.getFieldValue("PIN");
    Blockly.Arduino.definitions_["setup_buzzer"] = "const int buzzer"+" =  " + value_pin + ";";
  Blockly.Arduino.setups_["setup_buzzer" ]="pinMode(" + value_pin + ", OUTPUT);";
  var code = '';
  return code;
};





Blockly.Blocks["play"]={init:function(){
  this.appendDummyInput().appendField(Blockly.Msg.ARDUINO_TONE_INPUT1);
    this.appendDummyInput().appendField(Blockly.Msg.play).appendField(new Blockly.FieldDropdown(Blockly.Msg.note), "note")
		.appendField(new Blockly.FieldDropdown(Blockly.Msg.tempo), "tempo");
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour("#FF63BB");
    this.setTooltip(Blockly.Msg.play_tooltip);
    this.setHelpUrl(Blockly.Msg.play_helpurl)}
};

Blockly.Arduino["play"]=function(block){
    var value_note=block.getFieldValue("note");
    var value_tempo=block.getFieldValue("tempo");
    return "tone( buzzer," + value_note + "," + value_tempo + ");\n delay(" + value_tempo + ");\n"
};

//////////////
Blockly.Blocks["tone"]={init:function(){
        this.setColour("#FF63BB");
        this.setHelpUrl(Blockly.Msg.HELPURL);
        this.appendDummyInput().appendField(Blockly.Msg.ARDUINO_TONE_INPUT1);
        this.appendValueInput("NUM").setAlign(Blockly.ALIGN_RIGHT).appendField(Blockly.Msg.ARDUINO_TONE_INPUT2).setCheck("Number");
        this.appendValueInput("TPS").setAlign(Blockly.ALIGN_RIGHT).appendField(Blockly.Msg.ARDUINO_TONE_INPUT3).setCheck("Number");
        this.setInputsInline(true);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setTooltip(Blockly.Msg.ARDUINO_TONE_TOOLTIP)}
};
Blockly.Arduino["tone"]=function(block){
    var value_num=Blockly.Arduino.valueToCode(block, "NUM", Blockly.Arduino.ORDER_ATOMIC);
    var value_tps=Blockly.Arduino.valueToCode(block, "TPS", Blockly.Arduino.ORDER_ATOMIC);
    return "tone( buzzer," + value_num + "," + value_tps + ");\ndelay(" + value_tps + ");\n"
};
//////////////
Blockly.Blocks["beep"]={init:function(){
  var card=window.localStorage.card;
  this.appendDummyInput().appendField(Blockly.Msg.beep).appendField(new Blockly.FieldDropdown(profile[card].dropdownAllPins), "PIN");
    this.setColour("#FF63BB");
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);this.setNextStatement(true, null);
    this.setHelpUrl(Blockly.Msg.HELPURL);this.setTooltip(Blockly.Msg.beep_TOOLTIP)}
};
Blockly.Arduino["beep"]=function(block){
    var value_pin=block.getFieldValue("PIN");
    Blockly.Arduino.setups_["setup_output" + value_pin]="pinMode(" + value_pin + ", OUTPUT);";
    return "tone(" + value_pin + ",440,1000);\ndelay(1000);\n"
};
//////////////
Blockly.Blocks["notone"]={init:function(){
        this.setColour("#FF63BB");
        this.setHelpUrl(Blockly.Msg.HELPURL);
        this.appendDummyInput().appendField(Blockly.Msg.ARDUINO_NOTONE_INPUT);
        this.setPreviousStatement(true, null);
        this.setInputsInline(true);
        this.setNextStatement(true, null);
        this.setTooltip(Blockly.Msg.ARDUINO_NOTONE_TOOLTIP)}
};
Blockly.Arduino["notone"]=function(block){
    return "noTone( buzzer" + ");\n"
};

Blockly.Blocks['cute_play'] = {init: function() {
    this.appendDummyInput() .appendField("🎼"+Blockly.Msg.OTTO9_SOUND_TEXT) .appendField(new Blockly.FieldDropdown(Blockly.Msg.OTTO9_SOUND_CHOICE), "sound");
    this.setInputsInline(true);
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour("#FF63BB"); }
};

Blockly.Arduino['cute_play'] = function(block) {
  var dropdown_sound = block.getFieldValue('sound');
  Blockly.Arduino.includes_['cute_sound'] = '#include <CuteBuzzerSounds.h>\n';
  Blockly.Arduino.setups_['cute_sound']='  cute.init(buzzer);\n';
  var code = 'cute.play(' + dropdown_sound + ');\n';
  return code;
};

//////////////
//////////////
//////////////

//////////////
//////////////
//////////////


 /////////////
 /*  Audio for MRTX-Uno Board */
/////////////






//////////////
//Pins usung the mcp23008 adapter





 /////////////
 /*  audio buzzer for esp32 */
/////////////




//////////////



/*
//////////////RGB for ESP32
Blockly.Blocks['rgb_init_esp32']={init:function() {
	var card=window.localStorage.card;
    this.appendDummyInput() .appendField(new Blockly.FieldImage('media/rgb.png', 33, 33, "*")) .appendField(Blockly.Msg.rvb_init);
    this.appendDummyInput() .setAlign(Blockly.ALIGN_RIGHT) .appendField("R").appendField(new Blockly.FieldDropdown(profile[card].dropdownPWM), "rouge");
    this.appendDummyInput() .setAlign(Blockly.ALIGN_RIGHT)  .appendField("G").appendField(new Blockly.FieldDropdown(profile[card].dropdownPWM), "vert");
    this.appendDummyInput() .setAlign(Blockly.ALIGN_RIGHT) .appendField("B").appendField(new Blockly.FieldDropdown(profile[card].dropdownPWM), "bleu");
    this.setInputsInline(true);
	this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour("#B655F5");
    this.setTooltip(Blockly.Msg.rvb_init_tooltip);
    this.setHelpUrl('http://www.mon-club-elec.fr/pmwiki_reference_arduino/pmwiki.php?n=Main.ReferenceMaxi')}
};
Blockly.Arduino['rgb_init_esp32'] = function(block) {
  var value_rouge = block.getFieldValue('rouge');
  var value_vert = block.getFieldValue('vert');
  var value_bleu = block.getFieldValue('bleu');
  Blockly.Arduino.variables_['rvb_'+value_rouge] = '#define redPin '+value_rouge+'\n#define greenPin '+value_vert+'\n#define bluePin '+value_bleu+'\n';
  Blockly.Arduino.userFunctions_['rvb_'+value_rouge] = 'void setColor(int redValue, int greenValue, int blueValue) {\n ledcWrite(5,greenValue);\n ledcWrite(6,redValue);\n  ledcWrite(7,blueValue);\n}';
  Blockly.Arduino.setups_['rvb_esp32'+value_rouge]='ledcSetup(5,5000,8);\nledcAttachPin(greenPin,5);\nledcSetup(6,5000,8);\nledcAttachPin(redPin,6);\nledcSetup(7,5000,8);\nledcAttachPin(bluePin,7);\n';
  return '';
};


  Blockly.Blocks["rgb_setcolor_anode"]={init:function(){
	this.appendDummyInput()  .appendField(Blockly.Msg.rvb_set).appendField(Blockly.Msg.rvb_anode);
	this.appendDummyInput().appendField(new Blockly.FieldColour("#ff0000"), "color");
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour("#B655F5");
    this.setTooltip(Blockly.Msg.rvb_set_tooltip);
    this.setHelpUrl("https://learn.adafruit.com/adafruit-arduino-lesson-3-rgb-leds/")}
};
Blockly.Arduino["rgb_setcolor_anode"]=function(block){
	var color=block.getFieldValue("color");
	var colorR=color[1] + color[2], colorG=color[3] + color[4], colorB=color[5] + color[6];
    var red=255-parseInt(colorR,16), green=255-parseInt(colorG,16), blue=255-parseInt(colorB,16);
    var code = 'setColor('+red+','+green+','+blue+');\n';
    return code;
};
*/
