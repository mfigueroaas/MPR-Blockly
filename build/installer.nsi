; MPR Blockly - instalador NSIS
; Lo genera tools/build_installer.py, que pasa:
;   -DSTAGE=<carpeta con la app armada>  -DVERSION=x.y.z  -DOUTFILE=<ruta del .exe>
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

Name "${APPNAME} ${VERSION}"
OutFile "${OUTFILE}"
; Carpeta en la raíz de C: (como C:\OttoBlockly): la app compila escribiendo dentro
; de su carpeta, y en "Archivos de programa" un alumno sin permisos de administrador
; no podría compilar. Además se da permiso de modificación al grupo Usuarios.
InstallDir "C:\MPRBlockly"
InstallDirRegKey HKLM "${REGKEY}" "InstallLocation"
RequestExecutionLevel admin
BrandingText "${APPNAME} ${VERSION}"

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

!define MUI_ICON   "${STAGE}\mpr.ico"
!define MUI_UNICON "${STAGE}\mpr.ico"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TEXT "Este asistente instalará ${APPNAME} ${VERSION}.$\r$\n$\r$\nIncluye todo lo necesario para programar y cargar código en placas Arduino AVR (Nano, Uno, Mega...) sin conexión a internet.$\r$\n$\r$\nCierra MPR Blockly si está abierto antes de continuar."
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APPEXE}"
!define MUI_FINISHPAGE_RUN_TEXT "Abrir ${APPNAME}"
!define MUI_FINISHPAGE_SHOWREADME ""
!define MUI_FINISHPAGE_SHOWREADME_NOTCHECKED
!define MUI_FINISHPAGE_SHOWREADME_TEXT "Instalar driver USB CH340 (placas Nano compatibles)"
!define MUI_FINISHPAGE_SHOWREADME_FUNCTION InstallCH340

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "${STAGE}\LICENSE.md"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Spanish"

!macro CloseRunningApp
  ; Si la app está abierta, pedir que se cierre (los archivos estarían bloqueados)
  retry_close:
  nsExec::ExecToStack 'cmd /c tasklist /FI "IMAGENAME eq ${APPEXE}" /NH | find /I "${APPEXE}"'
  Pop $0
  ${If} $0 == 0
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "${APPNAME} está abierto. Ciérralo y presiona Reintentar." IDRETRY retry_close
    Abort
  ${EndIf}
!macroend

Function .onInit
  SetShellVarContext all
  !insertmacro CloseRunningApp
FunctionEnd

Function InstallCH340
  ; Driver CH340/CH341 incluido en Otto Blockly (driversUSB\CH341.zip, extraído al armar).
  ; Windows 10/11 suele instalarlo solo por Windows Update; pnputil no reemplaza un
  ; driver más nuevo ya instalado.
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
    ${If} $0 != 0
    ${AndIf} $0 != 259
      ExecShell "open" "$INSTDIR\resources\app\driversUSB\CH341"
    ${EndIf}
  ${Else}
    ExecShell "open" "$INSTDIR\resources\app\driversUSB"
  ${EndIf}
FunctionEnd

Section "MPR Blockly" SecMain
  SectionIn RO
  SetShellVarContext all
  SetOutPath "$INSTDIR"

  ; Actualización limpia: se reemplaza la app y las herramientas, pero no se
  ; tocan archivos del usuario fuera de estas carpetas.
  RMDir /r "$INSTDIR\resources"
  RMDir /r "$INSTDIR\www"
  RMDir /r "$INSTDIR\compilation\arduino\packages"
  RMDir /r "$INSTDIR\compilation\arduino\userlibs"

  File /r "${STAGE}\*.*"

  ; Permiso de modificación para el grupo Usuarios (S-1-5-32-545): la compilación
  ; escribe en compilation\arduino y la app guarda config.json en su carpeta.
  nsExec::ExecToLog 'icacls "$INSTDIR" /grant *S-1-5-32-545:(OI)(CI)M /T /C /Q'

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
  WriteRegDWORD HKLM "${REGKEY}" "NoModify" 1
  WriteRegDWORD HKLM "${REGKEY}" "NoRepair" 1
SectionEnd

Function un.onInit
  SetShellVarContext all
  !insertmacro CloseRunningApp
FunctionEnd

Section "Uninstall"
  SetShellVarContext all
  ; Seguridad: solo borrar la carpeta si realmente es una instalación de MPR Blockly
  ${IfNot} ${FileExists} "$INSTDIR\${APPEXE}"
    MessageBox MB_ICONSTOP "No se encontró ${APPEXE} en $INSTDIR. Desinstalación cancelada."
    Abort
  ${EndIf}
  Delete "$DESKTOP\${APPNAME}.lnk"
  RMDir /r "$SMPROGRAMS\${APPNAME}"
  DeleteRegKey HKLM "${REGKEY}"
  ReadRegStr $0 HKCR ".bloc" ""
  ${If} $0 == "MPRBlockly.bloc"
    DeleteRegKey HKCR ".bloc"
  ${EndIf}
  DeleteRegKey HKCR "MPRBlockly.bloc"
  RMDir /r "$INSTDIR"
SectionEnd
