# Import necessary modules
from flask import Flask
from flask_cors import CORS
from routes import api_routes  # Import custom API routes from another module

# Create a Flask app instance
app = Flask(__name__)

# Enable Cross-Origin Resource Sharing (CORS)
CORS(app)

# Register API routes blueprint
app.register_blueprint(api_routes)

# Entry point to start the Flask server
if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001, debug=False)  # Run the app on localhost port 5001 with debug mode off
