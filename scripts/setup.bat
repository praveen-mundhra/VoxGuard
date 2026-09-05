@echo off
python -m venv backend\.venv
call backend\.venv\Scripts\activate
pip install -r backend\requirements.txt
cd frontend
npm install
