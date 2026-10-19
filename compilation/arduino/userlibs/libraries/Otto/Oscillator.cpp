//--------------------------------------------------------------
//-- Oscillator.pde
//-- Generate sinusoidal oscillations in the servos
//--------------------------------------------------------------
//-- (c) Juan Gonzalez-Gomez (Obijuan), Dec 2011
//-- GPL license
//--------------------------------------------------------------
//--------------------------------------------------------------
//-- Inclusión de mejoras 2025
//-- GPL license
//--------------------------------------------------------------
#if defined(ARDUINO) && ARDUINO >= 100
  #include "Arduino.h"
#else
  #include "WProgram.h"
  #include <pins_arduino.h>
#endif
#include "Oscillator.h"

//-- This function returns true if another sample
//-- should be taken (i.e. the TS time has passed since
//-- the last sample was taken
bool Oscillator::next_sample()
{
  
  //-- Read current time
  _currentMillis = millis();
 
  //-- Check if the timeout has passed
  //-- MPR: ">=" (antes ">"): con ">" la muestra salia cada 21 ms en vez de 20 y cada
  //-- movimiento de 1 ciclo quedaba en ~95% del ciclo (mas lento que el periodo pedido).
  if(_currentMillis - _previousMillis >= _samplingPeriod) {
    _previousMillis = _currentMillis;   

    return true;
  }
  
  return false;
}

//-- Attach an oscillator to a servo
//-- Input: pin is the arduino pin were the servo
//-- is connected
void Oscillator::attach(int pin, bool rev)
{
  //-- If the oscillator is detached, attach it.
  if(!_servo.attached()){

    //-- MPR: antes se hacia attach() y luego write(90): cada vez que el servo se volvia a
    //-- conectar (home() lo desconecta) saltaba a 90 SIN el trim y _pos volvia a 90 aunque
    //-- el servo estuviera en otra posicion. Ahora se envia la ultima posicion conocida, con
    //-- trim, ANTES de conectar: el primer pulso ya es el correcto y no hay salto.
    //-- Al encender, la ultima posicion conocida es 90 (constructor).
      _servo.write(_pos + _trim);
      _servo.attach(pin);
      _servo.write(_pos + _trim);
      _previousServoCommandMillis = millis();

      //-- Initialization of oscilaltor parameters
      _samplingPeriod=20;
      _period=2000;
      _numberSamples = (double)_period/_samplingPeriod;
      _inc = 2*M_PI/_numberSamples;

      _previousMillis=0;

      //-- Default parameters
      _amplitude=45;
      _phase=0;
      _phase0=0;
      _offset=0;
      _stop=false;

      //-- Reverse mode
      _rev = rev;
  }
      
}

//-- Detach an oscillator from his servo
void Oscillator::detach()
{
   //-- If the oscillator is attached, detach it.
  if(_servo.attached())
        _servo.detach();

}

/*************************************/
/* Set the oscillator period, in ms  */
/*************************************/
void Oscillator::SetT(unsigned int T)
{
  //-- Assign the new period
  _period=T;
  
  //-- Recalculate the parameters
  //-- MPR: division con decimales (con enteros, T=750 quedaba en 740 ms)
  _numberSamples = (double)_period/_samplingPeriod;
  _inc = 2*M_PI/_numberSamples;
};

/*******************************/
/* Manual set of the position  */
/******************************/

void Oscillator::SetPosition(int position)
{
  write(position);
};


/*******************************************************************/
/* This function should be periodically called                     */
/* in order to maintain the oscillations. It calculates            */
/* if another sample should be taken and position the servo if so  */
/*******************************************************************/
void Oscillator::refresh()
{
  
  //-- Only When TS milliseconds have passed, the new sample is obtained
  if (next_sample()) {
  
      //-- If the oscillator is not stopped, calculate the servo position
      if (!_stop) {
        //-- Sample the sine function and set the servo pos
         int pos = round(_amplitude * sin(_phase + _phase0) + _offset);
	       if (_rev) pos=-pos;
         write(pos+90);
      }

      //-- Increment the phase
      //-- It is always increased, even when the oscillator is stop
      //-- so that the coordination is always kept
      _phase = _phase + _inc;

  }
}

void Oscillator::write(int position) 
{
  unsigned long currentMillis = millis();
  if (_diff_limit > 0) {
    //-- MPR: limite de velocidad en GRADOS POR SEGUNDO segun el tiempo desde la orden
    //-- anterior. Si fue una pausa (mas de OSCILLATOR_MAX_DT_MS) se cuenta como un solo
    //-- pulso del servo (20 ms): asi no hay un salto grande al retomar el movimiento.
    //-- Se calcula en long: en el Nano int es de 16 bits y dt * limite se desborda con
    //-- limites altos o pausas largas.
    unsigned long dt = currentMillis - _previousServoCommandMillis;
    if (dt > OSCILLATOR_MAX_DT_MS) dt = 20;
    int limit = (int)(((long)dt * _diff_limit + 500) / 1000);
    if (limit < 1) limit = 1;
    if (abs(position - _pos) > limit) {
      _pos += position < _pos ? -limit : limit;
    } else {
      _pos = position;
    }
  }
  else {
      _pos = position;
  }    
  _previousServoCommandMillis = currentMillis;
  _servo.write(_pos + _trim);
}