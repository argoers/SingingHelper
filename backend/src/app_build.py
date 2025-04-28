# Import necessary modules
from flask import Flask, send_from_directory
import webbrowser
import threading
from flask_cors import CORS
from routes import api_routes  # Import custom API routes from a separate module

# Create a Flask app instance
app = Flask(__name__, static_folder="static", static_url_path="/")

# Enable Cross-Origin Resource Sharing (CORS)
CORS(app)

# Register API routes blueprint
app.register_blueprint(api_routes)

# Route to serve the main Vue.js application page
@app.route("/")
def serve_vue():
    return send_from_directory("static", "index.html")

# Route to serve other static files (like JS, CSS, images)
@app.route("/<path:path>")
def serve_static(path):
    return send_from_directory("static", path)

# Function to open the app automatically in a web browser
def open_browser():
    webbrowser.open("http://127.0.0.1:5001")

# Entry point to start the Flask server
if __name__ == "__main__":
    threading.Timer(1, open_browser).start()  # Open browser after 1 second delay
    app.run(host="127.0.0.1", port=5001, debug=False)  # Run the app on port 5001
