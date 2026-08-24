@echo off
REM hyacine MSVC build wrapper - avoids Git Bash link.exe shadowing
call "C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars64.bat" >nul
if %errorlevel% neq 0 (
  echo [build] vcvars64 failed
  exit /b %errorlevel%
)
cargo %*
