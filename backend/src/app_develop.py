from flask import Flask
from flask_cors import CORS
from routes import api_routes  # Import routes

app = Flask(__name__)
CORS(app)

# Register routes
app.register_blueprint(api_routes)

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001, debug=False)