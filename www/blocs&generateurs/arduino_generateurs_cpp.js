/*  communication  */
Blockly.Arduino["serial_init"]=function(block){
    var dropdown_speed=block.getFieldValue("SPEED");
	var dropdown_pin=block.getFieldValue("pin");
	window.localStorage.baudrate=dropdown_speed;
	switch (dropdown_pin) {
        case "0":
            Blockly.Arduino.setups_["serial_begin"]="Serial.begin(" + dropdown_speed + ");";
            break;
        case "19":
            Blockly.Arduino.setups_["serial_begin"]="Serial1.begin(" + dropdown_speed + ");";
            break;
        case "17":
            Blockly.Arduino.setups_["serial_begin"]="Serial2.begin(" + dropdown_speed + ");";
            break
        case "15":
            Blockly.Arduino.setups_["serial_begin"]="Serial3.begin(" + dropdown_speed + ");";
            break
	}
  return ""
};

Blockly.Arduino["serial_init2"]=function(block){
    var dropdown_speed=block.getFieldValue("SPEED");
	var dropdown_pin=block.getFieldValue("pin");
	window.localStorage.baudrate=dropdown_speed;
	switch (dropdown_pin) {
        case "0":
            Blockly.Arduino.setups_["serial_begin"]="Serial.begin(" + dropdown_speed + ");";
            break;
        case "19":
            Blockly.Arduino.setups_["serial_begin"]="Serial1.begin(" + dropdown_speed + ");";
            break;
        case "17":
            Blockly.Arduino.setups_["serial_begin"]="Serial2.begin(" + dropdown_speed + ");";
            break
        case "15":
            Blockly.Arduino.setups_["serial_begin"]="Serial3.begin(" + dropdown_speed + ");";
            break
	}
  return ""
};





Blockly.Arduino["serial_read"]=function(block){
    var code="Serial.read()";
    return [code, Blockly.Arduino.ORDER_ATOMIC]
};
Blockly.Arduino["serial_line"]=function(block){
    var code='"\\n"';
    return [code, Blockly.Arduino.ORDER_ATOMIC]
};
Blockly.Arduino["serial_tab"]=function(block){
    var code='" ; "';
    return [code, Blockly.Arduino.ORDER_ATOMIC]
};
Blockly.Arduino["serial_available"]=function(block){
    var code="Serial.available()";
    return [code, Blockly.Arduino.ORDER_ATOMIC]
};
Blockly.Arduino["serial_write"]=function(block){
    var content=Blockly.Arduino.valueToCode(block, "CONTENT", Blockly.Arduino.ORDER_ATOMIC);
    return "Serial.print(" + content + ");\n"
};
Blockly.Arduino["soft_init"]=function(block){
    var dropdown_pin1=block.getFieldValue("PIN1");
    var dropdown_pin2=block.getFieldValue("PIN2");
    var dropdown_speed=block.getFieldValue("SPEED");
    Blockly.Arduino.includes_["define_ss"]="#include <SoftwareSerial.h>";
	Blockly.Arduino.definitions_["define_ss"]="SoftwareSerial mySerial(" + dropdown_pin1 + "," + dropdown_pin2 + ");";
    Blockly.Arduino.setups_["setup_sserial"]="mySerial.begin(" + dropdown_speed + ");";
    return ""
};

Blockly.Arduino["soft_init2"]=function(block){
    var dropdown_pin1=block.getFieldValue("PIN1");
    var dropdown_pin2=block.getFieldValue("PIN2");
    var dropdown_speed=block.getFieldValue("SPEED");
    Blockly.Arduino.includes_["define_ss"]="#include <SoftwareSerial.h>";
	Blockly.Arduino.definitions_["define_ss"]="SoftwareSerial mySerial(" + dropdown_pin1 + "," + dropdown_pin2 + ");";
    Blockly.Arduino.setups_["setup_sserial"]="mySerial.begin(" + dropdown_speed + ");";
    return ""
};




Blockly.Arduino["soft_read"]=function(block){
    var code="mySerial.read()";
    return [code, Blockly.Arduino.ORDER_ATOMIC]
};
Blockly.Arduino["soft_write"]=function(block){
    var content=Blockly.Arduino.valueToCode(block, "CONTENT", Blockly.Arduino.ORDER_ATOMIC);
    return "mySerial.write(" + content + ");\n"
};
Blockly.Arduino["soft_available"]=function(block){
    var code="mySerial.available()";
    return [code, Blockly.Arduino.ORDER_ATOMIC]
};
/*  wifi  */
/*  bluetooth  */

/*  structure  */
Blockly.Arduino["base_setup_loop"]=function(block){
    var branch=Blockly.Arduino.statementToCode(block, "DO");
    var loop=Blockly.Arduino.statementToCode(block, "LOOP");
    if (Blockly.Arduino.INFINITE_LOOP_TRAP) branch=Blockly.Arduino.INFINITE_LOOP_TRAP.replace(/%1/g, "'" + block.id + "'") + branch;
    var code=branch;
    var setup_key=Blockly.Arduino.variableDB_.getDistinctName("base_setup", Blockly.Variables.NAME_TYPE);
    Blockly.Arduino.setups_[setup_key]=code;
    return [loop, Blockly.Arduino.ORDER_ATOMIC]
};
Blockly.Arduino["base_setup"]=function(block){
    var branch=Blockly.Arduino.statementToCode(block, "DO");

    if (Blockly.Arduino.INFINITE_LOOP_TRAP) branch=Blockly.Arduino.INFINITE_LOOP_TRAP.replace(/%1/g, "'" + block.id + "'") + branch;
    var code=branch;
    var setup_key=Blockly.Arduino.variableDB_.getDistinctName("base_setup", Blockly.Variables.NAME_TYPE);
    Blockly.Arduino.setups_[setup_key]=code;
    return ""
};
Blockly.Arduino["base_loop"]=function(block){
    function statementToCodeNoTab(block, name) {
        var targetBlock=block.getInputTargetBlock(name);
        var code=Blockly.Arduino.blockToCode(targetBlock);
        if (!goog.isString(code)) throw 'Expecting code from statement block "' + targetBlock.type + '".';
        return code
    }
    var loopBranch=statementToCodeNoTab(block, "LOOP");
    return loopBranch
};
Blockly.Arduino["base_define"]=function(block){
    var branch=Blockly.Arduino.statementToCode(block, "DO");
    if (Blockly.Arduino.INFINITE_LOOP_TRAP) branch=Blockly.Arduino.INFINITE_LOOP_TRAP.replace(/%1/g, "'" + block.id + "'") + branch;
    var code=branch;
    var setup_key=Blockly.Arduino.variableDB_.getDistinctName("base_setup", Blockly.Variables.NAME_TYPE);
    Blockly.Arduino.definitions_[setup_key]=code;
    return ""
};
Blockly.Arduino["base_code"]=function(block){
    return block.getFieldValue("TEXT") + "\n"
};
Blockly.Arduino['base_code_entree']=function(block){
	var code=block.getFieldValue("TEXT");
	return [code, Blockly.Arduino.ORDER_ATOMIC] ;
};
/*  temps  */
Blockly.Arduino["inout_pulsein"]=function(block){
    var dropdown_pin=Blockly.Arduino.valueToCode(block, "PIN", Blockly.Arduino.ORDER_ATOMIC);
    var dropdown_stat=block.getFieldValue("STAT");
    Blockly.Arduino.setups_["setup_input_" + dropdown_pin]="pinMode(" + dropdown_pin + ", INPUT);";
    var code="pulseIn(" + dropdown_pin + "," + dropdown_stat + ")";
    return [code, Blockly.Arduino.ORDER_ATOMIC]
};
Blockly.Arduino["millis"]=function(block){
	var _u=block.getFieldValue("unite");
    switch (_u) {
        case "u":
            var code="micros()";
            break;
        case "m":
            var code="millis()";
            break;
        case "s":
            code="millis()/1000";
            break
	}
    return [code, Blockly.Arduino.ORDER_ATOMIC]
};
Blockly.Arduino["base_delay"]=function(block){
    var _u=block.getFieldValue("unite");
    var delay_time=Blockly.Arduino.valueToCode(block, "DELAY_TIME", Blockly.Arduino.ORDER_ATOMIC);
    switch (_u) {
        case "u":
            var code="delayMicroseconds(" + delay_time + ");\n";
            break;
        case "m":
            var code="delay(" + delay_time + ");\n";
            break;
        case "s":
            // MPR: con "*1000" (int de 16 bits) desde 33 s el número se desbordaba y el robot quedaba detenido días
            code="delay((unsigned long)(" + delay_time + "*1000UL));\n";
            break
    };
    return code
};
Blockly.Arduino["tempo_sans_delay"]=function(block){
    var _u=block.getFieldValue("unite");
    var delay_time=Blockly.Arduino.valueToCode(block, "DELAY_TIME", Blockly.Arduino.ORDER_ATOMIC);
	var faire=Blockly.Arduino.statementToCode(block, "branche");
	// MPR: el nombre del temporizador salía del valor ("temps0.5" no compilaba y dos bloques con el mismo valor
	// compartían temporizador). Ahora cada bloque tiene el suyo; el tiempo se guarda sin signo, como millis().
	var temps=Blockly.Arduino.variableDB_.getDistinctName("temporizador", Blockly.Variables.NAME_TYPE);
	Blockly.Arduino.definitions_["temporisation_"+temps]="unsigned long "+temps+" = 0;";
    switch (_u) {
        case "u":
            var code="if ((micros()-"+temps+")>=(unsigned long)(" + delay_time + ")) {\n  "+temps+"=micros();\n"+faire+"}\n";
            break;
        case "m":
            var code="if ((millis()-"+temps+")>=(unsigned long)(" + delay_time + ")) {\n  "+temps+"=millis();\n"+faire+"}\n";
            break;
        case "s":
            code="if ((millis()-"+temps+")>=(unsigned long)(" + delay_time + "*1000UL)) {\n  "+temps+"=millis();\n"+faire+"}\n";
            break
    };
    return code
};
/*  entree sortie  */









Blockly.Arduino["inout_digital_read"]=function(block){
    var pull_up=block.getFieldValue('pullup') == 'TRUE';
    var dropdown_pin=block.getFieldValue("PIN");
    if (pull_up) {
        Blockly.Arduino.setups_["setup_input_" + dropdown_pin]="pinMode(" + dropdown_pin + ", INPUT_PULLUP);"
    } else {
        Blockly.Arduino.setups_["setup_input_" + dropdown_pin]="pinMode(" + dropdown_pin + ", INPUT);"
    };
    var code="digitalRead(" + dropdown_pin + ")";
    return [code, Blockly.Arduino.ORDER_ATOMIC]
};

Blockly.Arduino["inout_analog_read"]=function(block){
    var dropdown_pin=block.getFieldValue("broche");
    var code="analogRead(" + dropdown_pin + ")";
    return [code, Blockly.Arduino.ORDER_ATOMIC]
};

Blockly.Arduino["toggle"]=function(block){
    var dropdown_pin=block.getFieldValue("PIN");
	Blockly.Arduino.definitions_["toggle"+dropdown_pin]="boolean etat_" + dropdown_pin + "=LOW;";
    Blockly.Arduino.setups_["setup_output_" + dropdown_pin]="pinMode(" + dropdown_pin + ", OUTPUT);";
    return "digitalWrite(" + dropdown_pin + ", etat_" + dropdown_pin + ");\netat_"+ dropdown_pin + "=!etat_"+ dropdown_pin + ";\n";
};
/*  stockage  */
