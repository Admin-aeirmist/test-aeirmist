@echo off
echo [Aeirmist] Building Android APK with JDK 21...
set "JAVA_HOME=C:\Users\Junaed Islam Jim\.jdk21\jdk-21.0.6+7"
cd /d "D:\Aeirmist\android"
call gradlew.bat assembleDebug
if %ERRORLEVEL% NEQ 0 (
    echo [Aeirmist] Gradle build failed!
    exit /b %ERRORLEVEL%
)
cd /d "D:\Aeirmist"
echo [Aeirmist] Copying APK to destinations...
copy /y "D:\Aeirmist\android\app\build\outputs\apk\debug\app-debug.apk" "D:\Aeirmist\Aeirmist.apk"
copy /y "D:\Aeirmist\android\app\build\outputs\apk\debug\app-debug.apk" "C:\Users\Junaed Islam Jim\Downloads\Aeirmist.apk"
echo [Aeirmist] APK build and copy completed successfully!
