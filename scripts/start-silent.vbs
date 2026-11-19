Option Explicit
Dim sh, fso, dir, bat, rc
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
bat = dir & "\start-bg.cmd"
If Not fso.FileExists(bat) Then
  MsgBox "Cannot find start-bg.cmd", 16, "CMG WMS"
  WScript.Quit 1
End If
' Show minimized console briefly so user sees status; 1=normal, True=wait
rc = sh.Run("cmd /c """ & bat & """", 1, True)
If rc = 0 Then
  MsgBox "Started." & vbCrLf & vbCrLf & "Web: http://127.0.0.1:8080" & vbCrLf & "API: http://127.0.0.1:3001/api/v1", 64, "CMG WMS"
Else
  MsgBox "Start failed, code " & rc & vbCrLf & "See scripts\logs\bootstrap.log", 48, "CMG WMS"
End If
