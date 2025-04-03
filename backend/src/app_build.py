from flask import Flask, send_from_directory
import webbrowser
import threading
from flask_cors import CORS
from routes import api_routes  

app = Flask(__name__, static_folder="static", static_url_path="/")
CORS(app)

app.register_blueprint(api_routes)

@app.route("/")
def serve_vue():
    return send_from_directory("static", "index.html")

@app.route("/<path:path>")
def serve_static(path):
    return send_from_directory("static", path)

def open_browser():
    webbrowser.open("http://127.0.0.1:5001")

if __name__ == "__main__":
    threading.Timer(1, open_browser).start()  
    app.run(host="127.0.0.1", port=5001, debug=False)
