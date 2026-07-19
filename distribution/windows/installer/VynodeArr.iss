#ifndef SourceRoot
  #error SourceRoot must point to the staged VynodeArr-win-x64 directory.
#endif
#ifndef OutputRoot
  #define OutputRoot "..\..\..\artifacts\installer"
#endif
#ifndef AppVersion
  #define AppVersion "0.1.0"
#endif

#define AppName "VynodeArr"
#define ServiceName "VynodeArr"

[Setup]
AppId={{EED7999B-F6AA-48F3-A726-D8F2493FD071}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=minerport
AppPublisherURL=https://github.com/minerport/VynodeArr-Unified
DefaultDirName={autopf}\VynodeArr
DefaultGroupName=VynodeArr
DisableProgramGroupPage=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
OutputDir={#OutputRoot}
OutputBaseFilename=VynodeArr-{#AppVersion}-win-x64-setup
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
SetupIconFile={#SourceRoot}\branding\VynodeArr.ico
UninstallDisplayIcon={app}\branding\VynodeArr.ico
CloseApplications=yes
RestartApplications=no
SetupLogging=yes

[Files]
Source: "{#SourceRoot}\gateway\*"; DestDir: "{app}\gateway"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#SourceRoot}\tray\*"; DestDir: "{app}\tray"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#SourceRoot}\branding\*"; DestDir: "{app}\branding"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#SourceRoot}\engines\movie\*"; DestDir: "{app}\engines\movie"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#SourceRoot}\engines\television\*"; DestDir: "{app}\engines\television"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#SourceRoot}\source-lock.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SourceRoot}\package-manifest.json"; DestDir: "{app}"; Flags: ignoreversion

[Dirs]
Name: "{commonappdata}\VynodeArr"; Flags: uninsneveruninstall
Name: "{commonappdata}\VynodeArr\movie"; Flags: uninsneveruninstall
Name: "{commonappdata}\VynodeArr\television"; Flags: uninsneveruninstall
Name: "{commonappdata}\VynodeArr\unified"; Flags: uninsneveruninstall

[Icons]
Name: "{group}\VynodeArr"; Filename: "{app}\tray\VynodeArr.Tray.exe"; Parameters: "--open"; WorkingDir: "{app}\tray"; IconFilename: "{app}\branding\VynodeArr.ico"
Name: "{commondesktop}\VynodeArr"; Filename: "{app}\tray\VynodeArr.Tray.exe"; Parameters: "--open"; WorkingDir: "{app}\tray"; IconFilename: "{app}\branding\VynodeArr.ico"
Name: "{commonstartup}\VynodeArr Tray"; Filename: "{app}\tray\VynodeArr.Tray.exe"; WorkingDir: "{app}\tray"

[Run]
Filename: "{app}\tray\VynodeArr.Tray.exe"; Description: "Start the VynodeArr tray controller"; Flags: postinstall nowait runasoriginaluser skipifsilent
Filename: "http://127.0.0.1:8686/"; Description: "Open VynodeArr"; Flags: postinstall shellexec skipifsilent nowait

[UninstallRun]
Filename: "{sys}\taskkill.exe"; Parameters: "/IM VynodeArr.Tray.exe /T /F"; Flags: runhidden waituntilterminated; RunOnceId: "StopVynodeArrTray"
Filename: "{sys}\sc.exe"; Parameters: "stop {#ServiceName}"; Flags: runhidden waituntilterminated skipifdoesntexist; RunOnceId: "StopVynodeArr"
Filename: "{sys}\sc.exe"; Parameters: "delete {#ServiceName}"; Flags: runhidden waituntilterminated skipifdoesntexist; RunOnceId: "DeleteVynodeArr"

[Code]
procedure RunServiceCommand(const Parameters: String);
var
  ResultCode: Integer;
begin
  if not Exec(ExpandConstant('{sys}\sc.exe'), Parameters, '', SW_HIDE,
    ewWaitUntilTerminated, ResultCode) then
  begin
    RaiseException('Unable to run the Windows service command: ' + Parameters);
  end;

  if ResultCode <> 0 then
  begin
    RaiseException(Format('Windows service command failed with exit code %d: %s', [ResultCode, Parameters]));
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ExecutablePath: String;
begin
  if CurStep <> ssPostInstall then
  begin
    exit;
  end;

  ExecutablePath := ExpandConstant('{app}\gateway\VynodeArr.Gateway.exe');
  if RegKeyExists(HKLM, 'SYSTEM\CurrentControlSet\Services\{#ServiceName}') then
  begin
    RunServiceCommand('config {#ServiceName} binPath= "' + ExecutablePath +
      '" start= auto DisplayName= "VynodeArr"');
  end
  else
  begin
    RunServiceCommand('create {#ServiceName} binPath= "' + ExecutablePath +
      '" start= auto DisplayName= "VynodeArr"');
  end;

  RunServiceCommand('description {#ServiceName} "Unified movie and television media manager"');
  RunServiceCommand('failure {#ServiceName} reset= 86400 actions= restart/5000/restart/15000/restart/30000');
  RunServiceCommand('start {#ServiceName}');
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
begin
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/IM VynodeArr.Tray.exe /T /F', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec(ExpandConstant('{sys}\sc.exe'), 'stop {#ServiceName}', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Sleep(2000);
  Result := '';
end;
