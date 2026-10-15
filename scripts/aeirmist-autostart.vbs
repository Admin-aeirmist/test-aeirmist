Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File ""D:\Aeirmist\scripts\start-services.ps1""", 0, True
WshShell.Run "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File ""D:\Aeirmist\scripts\watchdog.ps1""", 0, False
Set WshShell = Nothing
