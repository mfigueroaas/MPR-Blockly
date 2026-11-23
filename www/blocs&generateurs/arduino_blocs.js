"use strict";

goog.provide("Blockly.Blocks.arduino");
goog.require("Blockly.Blocks");

Blockly.Blocks["toggle"]={init:function(){
    var card=window.localStorage.card;
        this.setColour("#00929f");
        this.setHelpUrl(Blockly.Msg.tempo_helpurl);
        this.appendDummyInput().appendField(Blockly.Msg.toggle).appendField(new Blockly.FieldDropdown(profile[card].dropdownAllPins), "PIN");
        this.setInputsInline(true);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setTooltip(Blockly.Msg.toggle_tooltip)}
};

Blockly.Blocks["inout_digital_read"]={init:function(){
    var card=window.localStorage.card;
        this.setColour("#00929f");
        this.setHelpUrl(Blockly.Msg.HELPURL);
        this.appendDummyInput().appendField(Blockly.Msg.ARDUINO_INOUT_DIGITAL_READ_INPUT).appendField(new Blockly.FieldDropdown(profile[card].dropdownDigital), "PIN");
        this.appendDummyInput().setAlign(Blockly.ALIGN_RIGHT).appendField(Blockly.Msg.in_pullup).appendField(new Blockly.FieldCheckbox("FALSE"), "pullup");
        this.setInputsInline(true);
        this.setOutput(true, "Boolean");
        this.setTooltip(Blockly.Msg.in_pullup_tooltip)}
};


Blockly.Blocks["inout_analog_read"]={init:function(){
		var card=window.localStorage.card;
		var prog = window.localStorage.prog;
        this.setColour("#00929f");
        this.setHelpUrl(Blockly.Msg.HELPURL);
		if (prog != "python") {
			this.appendDummyInput().appendField(Blockly.Msg.ARDUINO_INOUT_ANALOG_READ_INPUT).appendField(new Blockly.FieldDropdown(profile[card].dropdownAnalog), "broche");
        } else {
			this.appendDummyInput().appendField(Blockly.Msg.ARDUINO_INOUT_ANALOG_READ_INPUT+" A0");
		}
		this.setOutput(true, "Number");
        this.setTooltip(Blockly.Msg.ARDUINO_INOUT_ANALOG_READ_TOOLTIP)}
};










/*	structure  */
Blockly.Blocks["base_setup_loop"]={
	init:function(){
		var prog = window.localStorage.prog;
        this.setColour("#2d2d64");
        this.setHelpUrl(Blockly.Msg.HELPURL);
		if (prog != "python") {
			this.appendDummyInput().appendField(Blockly.Msg.init);
		} else {
			this.appendDummyInput().appendField(Blockly.Msg.def);
		}
        this.appendStatementInput("DO");
        this.appendDummyInput().appendField(Blockly.Msg.loop);
        this.appendStatementInput("LOOP");
        this.setInputsInline(false);
        this.setTooltip(Blockly.Msg.base_setup_loop);
        this.contextMenu = false},
    getArduinoLoopsInstance:function(){return true},
	onchange:function(){
		var blocks = [];
		for (var blockID in BlocklyDuino.workspace.blockDB_) {
			if (BlocklyDuino.workspace.blockDB_[blockID].type == "base_setup_loop"||BlocklyDuino.workspace.blockDB_[blockID].type == "base_loop") {
				blocks.push(BlocklyDuino.workspace.blockDB_[blockID]);
			}
		}
		if(blocks.length>1) BlocklyDuino.workspace.undo(false)}
};
Blockly.Blocks["base_setup"]={
	init:function(){
		var prog = window.localStorage.prog;
		if (prog == "python")  this.setNextStatement(true, null);
        this.setColour("#2d2d64");
        this.setHelpUrl(Blockly.Msg.HELPURL);
        this.appendDummyInput().appendField(Blockly.Msg.init);
        this.appendStatementInput("DO");
        this.setTooltip(Blockly.Msg.def_tooltip)},
	onchange:function(){
		var blocks = [];
		for (var blockID in BlocklyDuino.workspace.blockDB_) {
			if (BlocklyDuino.workspace.blockDB_[blockID].type == "base_setup") {
				blocks.push(BlocklyDuino.workspace.blockDB_[blockID]);
			}
		}
		if(blocks.length>1) BlocklyDuino.workspace.undo(false)}
};
Blockly.Blocks["base_loop"]={
	init:function(){
        this.setColour("#2d2d64");
        this.setHelpUrl(Blockly.Msg.HELPURL);
        this.appendDummyInput().appendField(Blockly.Msg.loop);
        this.appendStatementInput("LOOP");
		var prog = window.localStorage.prog;
		if (prog == "python")  this.setPreviousStatement(true, null);
        this.setTooltip(Blockly.Msg.loop_tooltip)},
	onchange:function(){
		var blocks = [];
		for (var blockID in BlocklyDuino.workspace.blockDB_) {
			if (BlocklyDuino.workspace.blockDB_[blockID].type == "base_loop") {
				blocks.push(BlocklyDuino.workspace.blockDB_[blockID]);
			}
		}
		if(blocks.length>1) BlocklyDuino.workspace.undo(false)}
};
Blockly.Blocks["base_define"]={
	init:function(){
		var prog = window.localStorage.prog;
		if (prog == "python")  this.setNextStatement(true, null);
        this.setColour("#2d2d64");
        this.setHelpUrl(Blockly.Msg.HELPURL);
        this.appendDummyInput().appendField(Blockly.Msg.def);
        this.appendStatementInput("DO");
        this.setTooltip(Blockly.Msg.def_tooltip)},
	onchange:function(){
		var blocks = [];
		for (var blockID in BlocklyDuino.workspace.blockDB_) {
			if (BlocklyDuino.workspace.blockDB_[blockID].type == "base_define") {
				blocks.push(BlocklyDuino.workspace.blockDB_[blockID]);
			}
		}
		if(blocks.length>1) BlocklyDuino.workspace.undo(false)}
};
Blockly.Blocks["base_code"]={init:function(){
	var prog = window.localStorage.prog;
	if (prog != "python") {
		this.appendDummyInput().appendField(new Blockly.FieldTextInput("code arduino;"), "TEXT");
	} else {
		this.appendDummyInput().appendField(new Blockly.FieldTextInput("code python"), "TEXT");
	}
    this.setHelpUrl(Blockly.Msg.HELPURL);
    this.setColour("#2d2d64");
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setTooltip(Blockly.Msg.code_tooltip)}
};
Blockly.Blocks['base_code_entree']={init:function(){
	var prog = window.localStorage.prog;
	if (prog != "python") {
		this.appendDummyInput().appendField(new Blockly.FieldTextInput("code arduino"), "TEXT");
	} else {
		this.appendDummyInput().appendField(new Blockly.FieldTextInput("code python"), "TEXT");
	}
	this.setOutput(true);
    this.setColour("#2d2d64");
	this.setHelpUrl(Blockly.Msg.HELPURL);this.setTooltip(Blockly.Msg.code_tooltip)}
};
/*	temps  */
Blockly.Blocks["millis"]={init:function(){
	var prog = window.localStorage.prog;
    this.setColour("#00929F");
    this.setHelpUrl(Blockly.Msg.HELPURL);
	if (prog != "python") {
		this.appendDummyInput().appendField(Blockly.Msg.millis1).appendField(new Blockly.FieldDropdown(Blockly.Msg.times), "unite").appendField(Blockly.Msg.millis2);
	} else {
		this.appendDummyInput().appendField(Blockly.Msg.millis).appendField(new Blockly.FieldDropdown(Blockly.Msg.times), "unite");
	}
    this.setOutput(true, "Number");
    this.setTooltip(Blockly.Msg.millis_tooltip)}
};
Blockly.Blocks['tempo_sans_delay']={init:function() {
	var prog = window.localStorage.prog;
	this.appendValueInput("DELAY_TIME", "Number").setCheck("Number").appendField(Blockly.Msg.tempo1);
	if (prog != "python") {
		this.appendDummyInput().appendField(new Blockly.FieldDropdown(Blockly.Msg.times), "unite");
		this.setPreviousStatement(true, null);
		this.setNextStatement(true, null)
	} else {
		this.appendDummyInput().appendField(new Blockly.FieldDropdown(Blockly.Msg.time), "unite");
	}
	this.appendStatementInput("branche").appendField(Blockly.Msg.CONTROLS_SWITCH_MSG_DO);
	this.setInputsInline(true);
	this.setColour("#00929F");
	this.setTooltip(Blockly.Msg.tempo_tooltip);
	this.setHelpUrl(Blockly.Msg.tempo_helpurl)}
};
Blockly.Blocks["base_delay"]={init:function(){
        this.setColour("#00929F");
        this.setHelpUrl(Blockly.Msg.HELPURL);
        this.appendValueInput("DELAY_TIME", "Number").appendField(Blockly.Msg.ARDUINO_BASE_DELAY).setCheck("Number");
        this.appendDummyInput().appendField(new Blockly.FieldDropdown(Blockly.Msg.times), "unite");
        this.setInputsInline(true);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setTooltip(Blockly.Msg.ARDUINO_BASE_DELAY_TOOLTIP)}
};
Blockly.Blocks["inout_pulsein"]={init:function(){
        this.setColour("#00929F");
        this.setHelpUrl(Blockly.Msg.HELPURL);
        this.appendDummyInput().appendField(Blockly.Msg.ARDUINO_PULSEIN).appendField(new Blockly.FieldDropdown(Blockly.Msg.FIELDDROPDOWN_0_1), "STAT");
        this.appendValueInput("PIN").setCheck("Number").setAlign(Blockly.ALIGN_RIGHT).appendField(Blockly.Msg.pin);
        this.setOutput(true, "Number");
        this.setInputsInline(true);
        this.setTooltip(Blockly.Msg.ARDUINO_INOUT_Pulsein)}
};
/* bluetooth  */
/*  wifi  */
/*  stockage  */
/* communication */
/*
Blockly.Blocks["soft_init"]={init:function(){
		var card=window.localStorage.card;
        this.setColour("#0060aa");
        this.setHelpUrl(Blockly.Msg.HELPURL);
        this.appendDummyInput()
			.appendField(Blockly.Msg.SSERIAL_Init).appendField(new Blockly.FieldDropdown(Blockly.Msg.rxtx), "PIN1").appendField("/ Tx").appendField(new Blockly.FieldDropdown(Blockly.Msg.rxtx), "PIN2");
        this.appendDummyInput().setAlign(Blockly.ALIGN_RIGHT).appendField(Blockly.Msg.vitesse).appendField(new Blockly.FieldDropdown(profile[card].serial), "SPEED");
        this.setInputsInline(false);
        this.setTooltip(Blockly.Msg.SSERIAL_tooltip)}
};

Blockly.Blocks["soft_init2"]={init:function(){
		var card=window.localStorage.card;
        this.setColour("#0060aa");
        this.setHelpUrl(Blockly.Msg.HELPURL);
        this.appendDummyInput()
			.appendField(Blockly.Msg.SSERIAL_Init).appendField(new Blockly.FieldDropdown(Blockly.Msg.rxtx), "PIN1").appendField("/ Tx").appendField(new Blockly.FieldDropdown(Blockly.Msg.rxtx), "PIN2");
        this.appendDummyInput().setAlign(Blockly.ALIGN_RIGHT).appendField(Blockly.Msg.vitesse).appendField(new Blockly.FieldDropdown(profile[card].serial), "SPEED");
        this.setInputsInline(true);
		this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setTooltip(Blockly.Msg.SSERIAL_tooltip)}
};

Blockly.Blocks["soft_read"]={init:function(){
        this.setColour("#0060aa");
        this.setHelpUrl(Blockly.Msg.HELPURL);
        this.appendDummyInput().appendField(Blockly.Msg.SSERIAL_Read);
        this.setInputsInline(true);
        this.setOutput(true, "String");
        this.setTooltip(Blockly.Msg.SSERIAL_Read_tooltip)}
};
Blockly.Blocks["soft_write"]={init:function(){
        this.setHelpUrl(Blockly.Msg.HELPURL);
        this.setColour("#0060aa");
        this.appendValueInput("CONTENT", "String").appendField(Blockly.Msg.SSERIAL_Write);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setTooltip(Blockly.Msg.SSERIAL_Write_tooltip)}
};
Blockly.Blocks["soft_available"]={init:function(){
        this.setHelpUrl(Blockly.Msg.HELPURL);
        this.setColour("#0060aa");
        this.appendDummyInput().appendField(Blockly.Msg.SSERIAL_Available);
        this.setInputsInline(true);
        this.setOutput(true, "Number");
        this.setTooltip(Blockly.Msg.SSERIAL_Available_tooltip)}
};
Blockly.Blocks["serial_init"]={init:function(){
		var card=window.localStorage.card;
        this.setColour("#0060aa");
        this.setHelpUrl(Blockly.Msg.HELPURL);
        this.setInputsInline(false);
        this.appendDummyInput().appendField(Blockly.Msg.Serial_Init).appendField(new Blockly.FieldDropdown(profile[card].serialPin), "pin");
		this.appendDummyInput().setAlign(Blockly.ALIGN_RIGHT).appendField(Blockly.Msg.vitesse).appendField(new Blockly.FieldDropdown(profile[card].serial), "SPEED");
        this.setTooltip(Blockly.Msg.Serial_Init_tooltip)}
		};
Blockly.Blocks["serial_init2"]={init:function(){
		var card=window.localStorage.card;
        this.setColour("#0060aa");
        this.setHelpUrl(Blockly.Msg.HELPURL);
        this.setInputsInline(false);
        this.appendDummyInput().appendField(Blockly.Msg.Serial_Init).appendField(new Blockly.FieldDropdown(profile[card].serialPin), "pin");
		this.appendDummyInput().setAlign(Blockly.ALIGN_RIGHT).appendField(Blockly.Msg.vitesse).appendField(new Blockly.FieldDropdown(profile[card].serial), "SPEED");
		this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
		 this.setInputsInline(true);
        this.setTooltip(Blockly.Msg.Serial_Init_tooltip)}
};
Blockly.Blocks["serial_read"]={init:function(){
		var card=window.localStorage.card;
        this.setColour("#0060aa");
        this.setHelpUrl(Blockly.Msg.HELPURL);
		if (card!="python"){this.appendDummyInput().appendField(Blockly.Msg.Serial_read);} else {this.appendDummyInput().appendField(Blockly.Msg.repl_read);}
        this.setInputsInline(true);
        this.setOutput(true, "Number");
        this.setTooltip(Blockly.Msg.Serial_read_tooltip)}
};

Blockly.Blocks["serial_available"]={init:function(){
        this.setHelpUrl(Blockly.Msg.HELPURL);
        this.setColour("#0060aa");
        this.appendDummyInput().appendField(Blockly.Msg.SSERIAL_Available);
        this.setInputsInline(true);
        this.setOutput(true, "Number");
        this.setTooltip(Blockly.Msg.SSERIAL_Available_tooltip)}
};

Blockly.Blocks["serial_line"]={init:function(){
        this.setColour("#0060aa");
        this.setHelpUrl(Blockly.Msg.HELPURL);
        this.appendDummyInput().appendField(Blockly.Msg.Serial_saut);
        this.setInputsInline(true);
        this.setOutput(true, "String");
        this.setTooltip(Blockly.Msg.Serial_saut_tooltip)}
};
Blockly.Blocks["serial_tab"]={init:function(){
    this.setColour("#0060aa");
    this.setHelpUrl(Blockly.Msg.HELPURL);
    this.appendDummyInput().appendField(Blockly.Msg.Serial_space);
    this.setInputsInline(true);
    this.setOutput(true, "String");
    this.setTooltip(Blockly.Msg.Serial_space_tooltip)}
};

Blockly.Blocks["serial_write"]={init:function(){
        this.setColour("#0060aa");
        this.setHelpUrl(Blockly.Msg.HELPURL);
        this.appendValueInput("CONTENT", String).appendField(Blockly.Msg.Serial_Write);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setTooltip(Blockly.Msg.Serial_write_tooltip)}
};
Blockly.Blocks["serial_input"]={init:function(){
        this.setColour("#0060aa");
        this.setHelpUrl(Blockly.Msg.HELPURL);
        this.appendValueInput("CONTENT", String).appendField("wait user command");
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setTooltip(Blockly.Msg.Serial_write_tooltip)}
};

/*	entrée-sortie */


//Pins usung the mcp23008 adapter







