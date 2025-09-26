@echo off
cd /d "C:\app\fliiper-print"
pm2 start ecosystem.config.js
timeout /t 3 >nul