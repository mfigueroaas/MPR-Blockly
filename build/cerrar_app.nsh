; MPR Blockly - cerrar la app antes de instalar o desinstalar (lo incluyen build/installer.nsi y las pruebas).
; Requiere APPEXE y APPNAME definidos, y LogicLib.nsh y WinMessages.nsh incluidos.
; No usa cmd, tasklist ni taskkill: los antivirus desconfían de instaladores que matan procesos (un ejecutable de
; prueba que usaba taskkill quedó en cuarentena). Se le pide a la ventana que se cierre, igual que al apretar la X,
; y la app respalda los bloques del alumno y los recupera al abrirse (BlocklyDuino.backupBlocks).

; ¿Está en uso el programa? Un .exe en ejecución no se puede abrir para escritura (error 32, archivo compartido);
; sirve para cualquier sesión de Windows. Otro error (por ejemplo 5, sin permiso) no cuenta como "en uso".
; Deja 1 en $0 si está en uso.
!macro AppAbierta
  StrCpy $0 0
  ${If} ${FileExists} "$INSTDIR\${APPEXE}"
    ; GENERIC_WRITE, compartir lectura/escritura/borrado, OPEN_EXISTING: no modifica el archivo
    System::Call 'kernel32::CreateFileW(w "$INSTDIR\${APPEXE}", i 0x40000000, i 7, p 0, i 3, i 0x80, p 0) p .r1 ?e'
    Pop $2
    ${If} $1 = -1
      ${If} $2 = 32
        StrCpy $0 1
      ${EndIf}
    ${Else}
      System::Call 'kernel32::CloseHandle(p r1)'
    ${EndIf}
  ${EndIf}
!macroend

; Cierra la app si está abierta, sin preguntar. Si en 15 s no se cerró (por ejemplo, abierta en otra sesión de
; Windows), en modo silencioso cancela con código 2 y con ventana pide cerrarla a mano.
!macro FuncionCerrarApp UN
Function ${UN}CerrarApp
  !insertmacro AppAbierta
  ${If} $0 == 0
    Return
  ${EndIf}
  DetailPrint "Cerrando ${APPNAME} (su trabajo queda guardado)..."
  ${Do}
    FindWindow $1 "Chrome_WidgetWin_1" "${APPNAME}"   ; ventana principal de la app (Electron)
    ${If} $1 <> 0
      SendMessage $1 ${WM_CLOSE} 0 0 /TIMEOUT=5000
    ${EndIf}
    StrCpy $2 0
    ${Do}
      Sleep 500
      !insertmacro AppAbierta
      ${If} $0 == 0
        Return
      ${EndIf}
      IntOp $2 $2 + 1
    ${LoopUntil} $2 >= 30
    ${If} ${Silent}
      SetErrorLevel 2
      Abort "No se pudo cerrar ${APPNAME}."
    ${EndIf}
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "${APPNAME} sigue abierto (quizás en otra sesión de Windows). Ciérralo y presiona Reintentar." IDRETRY reintentar
    SetErrorLevel 2
    Abort "Cancelado: ${APPNAME} seguía abierto."
    reintentar:
  ${Loop}
FunctionEnd
!macroend
