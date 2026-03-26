; AMoon Launcher — NSIS Installer Script
; Build: makensis scripts/installer.nsi

Unicode True
!define APP_NAME    "AMoon Launcher"
!define APP_VERSION "0.1.0"
!define APP_EXE     "amoon-launcher.exe"
!define APP_ID      "com.amoon.launcher"
!define INSTALL_DIR "$LOCALAPPDATA\AMoonLauncher"

Name          "${APP_NAME} ${APP_VERSION}"
OutFile       "/home/congmc/mc-launcher/dist-release/amoon-launcher-${APP_VERSION}-windows-x86_64-setup.exe"
InstallDir    "${INSTALL_DIR}"
InstallDirRegKey HKCU "Software\${APP_ID}" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
BrandingText  "AMoon Launcher ${APP_VERSION}"

; ── Pages ─────────────────────────────────────────────────────────────────────
!include "MUI2.nsh"

!define MUI_ICON                  "/home/congmc/mc-launcher/src-tauri/icons/icon.ico"
!define MUI_UNICON                "/home/congmc/mc-launcher/src-tauri/icons/icon.ico"
!define MUI_ABORTWARNING
!define MUI_BGCOLOR               "0f1117"
!define MUI_TEXTCOLOR             "f0f4ff"

!define MUI_WELCOMEPAGE_TITLE     "Welcome to AMoon Launcher ${APP_VERSION} Setup"
!define MUI_WELCOMEPAGE_TEXT      "This wizard will guide you through the installation of AMoon Launcher.$\r$\n$\r$\nAMoon Launcher lets you play Minecraft with support for mods, shaders, and multiple accounts.$\r$\n$\r$\nClick Next to continue."
!define MUI_FINISHPAGE_RUN        "$INSTDIR\${APP_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT   "Launch AMoon Launcher"
!define MUI_FINISHPAGE_SHOWREADME ""
!define MUI_FINISHPAGE_LINK       "Visit anhcong.dev"
!define MUI_FINISHPAGE_LINK_LOCATION "https://anhcong.dev"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE     "/home/congmc/mc-launcher/LICENSE"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

; ── Install ────────────────────────────────────────────────────────────────────
Section "AMoon Launcher" SecMain
  SectionIn RO
  SetOutPath "$INSTDIR"

  File "/home/congmc/mc-launcher/src-tauri/target/x86_64-pc-windows-gnu/release/mc-launcher.exe"
  Rename "$INSTDIR\mc-launcher.exe" "$INSTDIR\${APP_EXE}"

  ; Write registry
  WriteRegStr HKCU "Software\${APP_ID}" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\${APP_ID}" "Version"    "${APP_VERSION}"

  ; Uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "DisplayName"     "${APP_NAME}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "DisplayVersion"  "${APP_VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "Publisher"       "AMoon Team"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "DisplayIcon"     "$INSTDIR\${APP_EXE}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "URLInfoAbout"    "https://anhcong.dev"

  ; Start Menu
  CreateDirectory "$SMPROGRAMS\${APP_NAME}"
  CreateShortcut  "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}"
  CreateShortcut  "$SMPROGRAMS\${APP_NAME}\Uninstall.lnk"   "$INSTDIR\Uninstall.exe"

  ; Desktop shortcut
  CreateShortcut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}"

  ; Add to PATH

SectionEnd

; ── Uninstall ─────────────────────────────────────────────────────────────────
Section "Uninstall"
  Delete "$INSTDIR\${APP_EXE}"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir  "$INSTDIR"

  Delete "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk"
  Delete "$SMPROGRAMS\${APP_NAME}\Uninstall.lnk"
  RMDir  "$SMPROGRAMS\${APP_NAME}"
  Delete "$DESKTOP\${APP_NAME}.lnk"


  DeleteRegKey HKCU "Software\${APP_ID}"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}"
SectionEnd
