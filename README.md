# Lõputöö

## Project Setup

### Backend

```sh
cd backend
python -m venv venv       # Create virtual environment
source venv/bin/activate  # Activate (Mac/Linux) OR
venv\Scripts\activate     # Activate (Windows)
pip install -r requirements.txt
python src/app.py         # Run Flask backend
```

### Compile and Hot-Reload for Development

```sh
cd frontend
npm install
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
