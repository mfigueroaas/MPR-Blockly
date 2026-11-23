; MPR Blockly - instalador NSIS
; Lo genera tools/build_installer.py, que pasa:
;   -DSTAGE=<carpeta con la app armada>  -DVERSION=x.y.z  -DOUTFILE=<ruta del .exe>  -DUNLIST=<lista de desinstalación>
;   y, si hay certificado, -DFIRMAR=<script que firma el archivo %1> (firma el desinstalador y el instalador).
;
; Instalación de un clic: después del permiso de administrador solo se ve la barra de progreso; al terminar la
; ventana se cierra sola y se abre MPR Blockly. No hace preguntas: si la app está abierta, le pide cerrarse como
; al apretar la X (build/cerrar_app.nsh), y la app guarda el trabajo del alumno para recuperarlo al abrirse.
;
; Instalación desatendida (varios PCs, sin ventanas ni abrir la app):
;     MPR_Blockly_Setup_x.y.z.exe /S                    (otra carpeta: /S /D=D:\MPRBlockly, siempre al final)
; Desinstalación desatendida:
;     "C:\MPRBlockly\Desinstalar.exe" /S
; Código de salida en modo silencioso: 0 = instalado; 2 = cancelado (no se pudo cerrar la app abierta).
Unicode true
SetCompressor /SOLID lzma
SetCompressorDictSize 64
ManifestDPIAware true

!ifndef VERSION
  !define VERSION "1.1.0"
!endif
!define APPNAME   "MPR Blockly"
!define APPEXE    "MPR Blockly.exe"
!define REGKEY    "Software\Microsoft\Windows\CurrentVersion\Uninstall\MPRBlockly"
!define PUBLISHER "Programa Mi Primer Robot"

; Firma digital (Authenticode): con certificado, Windows muestra "Editor comprobado" en vez de "Editor desconocido"
!ifdef FIRMAR
  !uninstfinalize '${FIRMAR} "%1"' = 0
  !finalize '${FIRMAR} "%1"' = 0
!endif

Name "${APPNAME} ${VERSION}"
Caption "Instalando ${APPNAME} ${VERSION}"
OutFile "${OUTFILE}"
; Carpeta en la raíz de C: (como C:\OttoBlockly). La app escribe al compilar en
; compilation\arduino y en config.json; solo esas rutas quedan modificables por el
; grupo Usuarios (ver permisos más abajo).
InstallDir "C:\MPRBlockly"
InstallDirRegKey HKLM "${REGKEY}" "InstallLocation"
RequestExecutionLevel admin
BrandingText "${APPNAME} ${VERSION}"
AutoCloseWindow true

VIProductVersion "${VERSION}.0"
VIAddVersionKey /LANG=1034 "ProductName" "${APPNAME}"
VIAddVersionKey /LANG=1034 "FileDescription" "Instalador de ${APPNAME}"
VIAddVersionKey /LANG=1034 "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=1034 "ProductVersion" "${VERSION}"
VIAddVersionKey /LANG=1034 "CompanyName" "${PUBLISHER}"
VIAddVersionKey /LANG=1034 "LegalCopyright" "GPL-2.0 - basado en Otto Blockly (Otto DIY)"

!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
!include "WinMessages.nsh"

!define MUI_ICON   "${STAGE}\mpr.ico"
!define MUI_UNICON "${STAGE}\mpr.ico"

; Una sola pantalla: el progreso. La licencia GPL-2.0 no exige aceptarla; se instala junto al programa (LICENSE.md).
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Spanish"

!include "cerrar_app.nsh"
!insertmacro FuncionCerrarApp ""
!insertmacro FuncionCerrarApp "un."

Function .onInit
  SetShellVarContext all
  ; Una sola copia del instalador a la vez (por ejemplo, si se hace doble clic dos veces)
  System::Call 'kernel32::CreateMutex(p 0, i 0, t "MPRBlocklyInstalador") p .r0 ?e'
  Pop $1
  ${If} $1 == 183
    Abort
  ${EndIf}
FunctionEnd

Function .onInstSuccess
  ${IfNot} ${Silent}
    Call RunAppNotElevated
  ${EndIf}
FunctionEnd

Function RunAppNotElevated
  ; El instalador corre como administrador; abrir la app a través de explorer.exe
  ; la inicia con los permisos normales del usuario.
  Exec '"$WINDIR\explorer.exe" "$INSTDIR\${APPEXE}"'
FunctionEnd

Function InstallCH340
  ; Driver CH340/CH341 incluido en Otto Blockly (driversUSB\CH341.zip, extraído al armar).
  ; Windows 10/11 suele instalarlo solo por Windows Update; pnputil no reemplaza un
  ; driver más nuevo ya instalado. Es un driver WHQL: se instala sin preguntas.
  ${If} ${FileExists} "$INSTDIR\resources\app\driversUSB\CH341\ch341ser.inf"
    ; el instalador es de 32 bits: en Windows 64 bits pnputil está en System32 real
    ${If} ${RunningX64}
      ${DisableX64FSRedirection}
    ${EndIf}
    nsExec::ExecToLog '"$SYSDIR\pnputil.exe" /add-driver "$INSTDIR\resources\app\driversUSB\CH341\ch341ser.inf" /install'
    Pop $0
    ${If} ${RunningX64}
      ${EnableX64FSRedirection}
    ${EndIf}
    DetailPrint "Driver CH340: código $0"
    ; Si falló, con ventana se abre la carpeta del driver para instalarlo a mano; en modo silencioso, nada
    ${If} $0 != 0
    ${AndIf} $0 != 259
    ${AndIf} $0 != 3010
    ${AndIfNot} ${Silent}
      ExecShell "open" "$INSTDIR\resources\app\driversUSB\CH341"
    ${EndIf}
  ${ElseIfNot} ${Silent}
    ExecShell "open" "$INSTDIR\resources\app\driversUSB"
  ${EndIf}
FunctionEnd

Section "MPR Blockly" SecMain
  SectionIn RO
  SetShellVarContext all
  Call CerrarApp
  SetOutPath "$INSTDIR"

  ; Actualización limpia: se reemplaza la app y las herramientas, pero no se
  ; tocan archivos del usuario fuera de estas carpetas.
  RMDir /r "$INSTDIR\resources"
  RMDir /r "$INSTDIR\www"
  RMDir /r "$INSTDIR\compilation\arduino\packages"
  RMDir /r "$INSTDIR\compilation\arduino\userlibs"
  ; Restos de versiones anteriores que la limpieza v1 ya no incluye
  RMDir /r "$INSTDIR\compilation\python"
  RMDir /r "$INSTDIR\locales"
  Delete "$INSTDIR\VkLayer_*.dll"
  Delete "$INSTDIR\VkICD_mock_icd.dll"

  File /r "${STAGE}\*.*"

  ; Permisos: la carpeta raíz de C: deja que cualquier usuario modifique lo que hay
  ; en sus subcarpetas. Se quita esa herencia: SYSTEM y Administradores con control
  ; total, Usuarios solo lectura/ejecución, y modificación únicamente donde la app
  ; escribe (compilation\arduino: sketch e inventario de arduino-cli; config.json).
  nsExec::ExecToLog 'icacls "$INSTDIR" /inheritance:r /grant:r *S-1-5-18:(OI)(CI)F *S-1-5-32-544:(OI)(CI)F *S-1-5-32-545:(OI)(CI)RX /C /Q'
  nsExec::ExecToLog 'icacls "$INSTDIR\*" /reset /T /C /Q'
  nsExec::ExecToLog 'icacls "$INSTDIR\compilation\arduino" /grant *S-1-5-32-545:(OI)(CI)M /T /C /Q'
  nsExec::ExecToLog 'icacls "$INSTDIR\config.json" /grant *S-1-5-32-545:M /C /Q'

  ; Accesos directos
  CreateDirectory "$SMPROGRAMS\${APPNAME}"
  CreateShortCut "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk" "$INSTDIR\${APPEXE}" "" "$INSTDIR\mpr.ico"
  CreateShortCut "$SMPROGRAMS\${APPNAME}\Drivers USB.lnk" "$INSTDIR\resources\app\driversUSB"
  CreateShortCut "$SMPROGRAMS\${APPNAME}\Desinstalar ${APPNAME}.lnk" "$INSTDIR\Desinstalar.exe"
  CreateShortCut "$DESKTOP\${APPNAME}.lnk" "$INSTDIR\${APPEXE}" "" "$INSTDIR\mpr.ico"

  ; Asociar archivos .bloc
  WriteRegStr HKCR ".bloc" "" "MPRBlockly.bloc"
  WriteRegStr HKCR "MPRBlockly.bloc" "" "Proyecto MPR Blockly"
  WriteRegStr HKCR "MPRBlockly.bloc\DefaultIcon" "" "$INSTDIR\mpr.ico"
  WriteRegStr HKCR "MPRBlockly.bloc\shell\open\command" "" '"$INSTDIR\${APPEXE}" "%1"'
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'

  ; Desinstalador y entrada en "Agregar o quitar programas"
  WriteUninstaller "$INSTDIR\Desinstalar.exe"
  WriteRegStr HKLM "${REGKEY}" "DisplayName" "${APPNAME}"
  WriteRegStr HKLM "${REGKEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKLM "${REGKEY}" "Publisher" "${PUBLISHER}"
  WriteRegStr HKLM "${REGKEY}" "DisplayIcon" "$INSTDIR\mpr.ico"
  WriteRegStr HKLM "${REGKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "${REGKEY}" "UninstallString" '"$INSTDIR\Desinstalar.exe"'
  WriteRegStr HKLM "${REGKEY}" "QuietUninstallString" '"$INSTDIR\Desinstalar.exe" /S'
  WriteRegDWORD HKLM "${REGKEY}" "NoModify" 1
  WriteRegDWORD HKLM "${REGKEY}" "NoRepair" 1

  ; Driver USB CH340 (placas Nano compatibles): siempre se instala
  DetailPrint "Instalando driver USB CH340..."
  Call InstallCH340
SectionEnd

Function un.onInit
  SetShellVarContext all
FunctionEnd

Section "Uninstall"
  SetShellVarContext all
  ; Seguridad: solo borrar la carpeta si realmente es una instalación de MPR Blockly
  ${IfNot} ${FileExists} "$INSTDIR\${APPEXE}"
    MessageBox MB_ICONSTOP "No se encontró ${APPEXE} en $INSTDIR. Desinstalación cancelada." /SD IDOK
    SetErrorLevel 2
    Abort
  ${EndIf}
  Call un.CerrarApp
  Delete "$DESKTOP\${APPNAME}.lnk"
  RMDir /r "$SMPROGRAMS\${APPNAME}"
  DeleteRegKey HKLM "${REGKEY}"
  ReadRegStr $0 HKCR ".bloc" ""
  ${If} $0 == "MPRBlockly.bloc"
    DeleteRegKey HKCR ".bloc"
  ${EndIf}
  DeleteRegKey HKCR "MPRBlockly.bloc"
  ; Solo se borra lo que instaló este instalador (lista generada al armar); si el
  ; usuario guardó otros archivos en la carpeta, la carpeta se conserva.
  !include "${UNLIST}"
  Delete "$INSTDIR\Desinstalar.exe"
  RMDir "$INSTDIR"
SectionEnd
