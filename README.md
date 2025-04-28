# Lõputöö – Singing Helper

A **Vue + Flask** project designed to assist choir singers in learning their vocal parts efficiently.<br><br>
The application supports only **MusicXML** file import. An example file, **Song.mxl**, is included in the root directory for testing and demonstration purposes.

## Run the Project

Executable files for **Windows and macOS** are available under **Releases**.

## Modify the Project

### Requirements

This is a **Vue + Flask** project. You need:

- **Node.js & NPM** (for the frontend)
- **Python 3** (for the backend)

### Create virtual environment for Python

#### Windows (CMD)

```sh
cd backend
python -m venv venv    
venv\Scripts\activate   
pip install -r requirements.txt
```

#### macOS
```sh
cd backend
python3 -m venv venv      
source venv/bin/activate 
pip install -r requirements.txt
```

### Run backend

#### Windows (CMD)
```sh
python src/app_develop.py
```

#### macOS
```sh
python3 src/app_develop.py
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

### macOS

```sh
chmod +x ./build_mac.sh
./build_linux.sh
```
