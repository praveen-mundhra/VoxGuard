@echo off
cd /d "%~dp0VoxGuard-frontened"
npm install
npm run dev -- --host 127.0.0.1
