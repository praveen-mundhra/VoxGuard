@echo off
cd /d "%~dp0VoxGuard-backened"
call .venv\Scripts\activate
uvicorn main:app --reload --host 127.0.0.1 --port 8000
