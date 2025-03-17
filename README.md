# Lõputöö – Singing Helper

A **Vue + Flask** project designed to assist choir singers in learning their vocal parts efficiently.

## Run the Project

Executable files for **Windows and Mac/Linux** are available under **Releases**.

## Modify the Project

### Requirements

This is a **Vue + Flask** project. You need:

- **Node.js** (for the frontend)
- **Python 3** (for the backend)

### Create virtual environment for Python
```sh
cd backend
python -m venv venv       # Create virtual environment
source venv/bin/activate  # Activate (Mac/Linux) OR
venv\Scripts\activate     # Activate (Windows)
pip install -r requirements.txt
```
### Run backend

```sh
python backend/src/app_develop.py         # Run Flask backend
```

### Run frontend

```sh
cd frontend
npm install
npm run dev
```

## Build project (Virtual environment needs to be active)

### Windows (CMD)

```sh
build_win.bat
```

### Mac/Linux

```sh
chmod +x ./build_mac.sh
./build_mac.sh
```
