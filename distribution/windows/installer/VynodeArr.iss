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
UninstallDisplayIcon={app}\gateway\VynodeArr.Gateway.exe
CloseApplications=yes
RestartApplications=no
SetupLogging=yes

[Files]
Source: "{#SourceRoot}\gateway\*"; DestDir: "{app}\gateway"; Flags: ignoreversion recursesubdirs createallsubdirs
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
Name: "{group}\VynodeArr"; Filename: "http://127.0.0.1:8686/"
Name: "{autodesktop}\VynodeArr"; Filename: "http://127.0.0.1:8686/"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional shortcuts:"; Flags: unchecked

[Run]
Filename: "{sys}\sc.exe"; Parameters: "create {#ServiceName} binPath= """"{app}\gateway\VynodeArr.Gateway.exe"""" start= auto DisplayName= ""VynodeArr"""; Flags: runhidden waituntilterminated; StatusMsg: "Registering VynodeArr service..."
Filename: "{sys}\sc.exe"; Parameters: "description {#ServiceName} ""Unified movie and television media manager"""; Flags: runhidden waituntilterminated
Filename: "{sys}\sc.exe"; Parameters: "failure {#ServiceName} reset= 86400 actions= restart/5000/restart/15000/restart/30000"; Flags: runhidden waituntilterminated
Filename: "{sys}\sc.exe"; Parameters: "start {#ServiceName}"; Flags: runhidden waituntilterminated; StatusMsg: "Starting VynodeArr..."
Filename: "http://127.0.0.1:8686/"; Description: "Open VynodeArr"; Flags: postinstall shellexec skipifsilent nowait

[UninstallRun]
Filename: "{sys}\sc.exe"; Parameters: "stop {#ServiceName}"; Flags: runhidden waituntilterminated skipifdoesntexist; RunOnceId: "StopVynodeArr"
Filename: "{sys}\sc.exe"; Parameters: "delete {#ServiceName}"; Flags: runhidden waituntilterminated skipifdoesntexist; RunOnceId: "DeleteVynodeArr"

[Code]
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
begin
  Exec(ExpandConstant('{sys}\sc.exe'), 'stop {#ServiceName}', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Sleep(2000);
  Result := '';
end;
