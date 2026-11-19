Option Explicit
Dim sh, fso, dir, bat, rc
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
bat = dir & "\stop-bg.cmd"
rc = sh.Run("cmd /c """ & bat & """", 1, True)
MsgBox "Stop finished.", 64, "CMG WMS"
