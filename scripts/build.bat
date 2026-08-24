@echo off
REM hyacine - MSVC 构建包装（规避 Git Bash link.exe 遮蔽）
call "C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars64.bat" >nul
if %errorlevel% neq 0 (
  echo [build] vcvars64 失败
  exit /b %errorlevel%
)
cargo %*
