import torch
import argparse
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from ai4bharat.transliteration import XlitEngine
import logging
import os

# Fix for torch serialization
torch.serialization.add_safe_globals([argparse.Namespace])

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)  # Enable CORS for all routes
logging.basicConfig(level=logging.INFO)

# Dictionary to store loaded engines
engines = {}


def get_engine(lang_code):
    """Load or retrieve transliteration engine for a language"""
    if lang_code not in engines:
        logging.info(f"🔄 Loading engine for '{lang_code}'...")
        try:
            engines[lang_code] = XlitEngine(lang_code, beam_width=5, rescore=True)
            logging.info(f"✅ Engine for '{lang_code}' ready.")
        except Exception as e:
            logging.error(f"❌ Failed to load engine for '{lang_code}': {e}")
            raise
    return engines[lang_code]


def transliterate_text(text, lang):
    """Transliterate full names by splitting into words"""
    if not text or not text.strip():
        return ""

    words = text.strip().split()
    transliterated_words = []

    for word in words:
        try:
            engine = get_engine(lang)
            # Convert to lowercase for better matching
            word_lower = word.lower()
            out = engine.translit_word(word_lower)
            suggestions = out.get(lang, [])

            if suggestions and len(suggestions) > 0:
                # Return the first suggestion
                transliterated_words.append(suggestions[0])
            else:
                # If no suggestion, return original word
                transliterated_words.append(word)
        except Exception as e:
            logging.error(f"Error transliterating '{word}': {e}")
            transliterated_words.append(word)

    return " ".join(transliterated_words)


@app.route('/')
def index():
    """Serve the main HTML file"""
    return send_from_directory('.', 'index.html')


@app.route('/<path:path>')
def static_files(path):
    """Serve static files (CSS, JS, etc.)"""
    return send_from_directory('.', path)


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "ok",
        "message": "VarnamAI backend is running",
        "engines_loaded": list(engines.keys())
    })


@app.route('/transliterate', methods=['POST'])
def transliterate():
    """Main transliteration endpoint"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON data"}), 400

        names = data.get('names', [])
        langs = data.get('langs', ['hi'])

        if not names:
            return jsonify({"error": "No names provided"}), 400

        # Validate languages
        valid_langs = {'hi', 'ta', 'te', 'mr'}
        for lang in langs:
            if lang not in valid_langs:
                return jsonify({"error": f"Unsupported language: {lang}"}), 400

        logging.info(f"Processing {len(names)} names for languages: {langs}")

        results = {}
        success_count = 0

        for name in names:
            name_clean = name.strip()
            if not name_clean:
                results[name_clean] = {lang: "" for lang in langs}
                continue

            entry = {}
            for lang in langs:
                try:
                    translit_result = transliterate_text(name_clean, lang)
                    entry[lang] = translit_result
                    if translit_result:
                        success_count += 1
                except Exception as e:
                    logging.error(f"Error for '{name_clean}' -> {lang}: {e}")
                    entry[lang] = ""

            results[name_clean] = entry

        logging.info(f"Successfully processed {success_count} transliterations")

        return jsonify({
            "results": results,
            "count": len(names),
            "successful": success_count
        })

    except Exception as e:
        logging.error(f"Unexpected error in transliterate endpoint: {e}")
        return jsonify({"error": str(e)}), 500


@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Endpoint not found"}), 404


@app.errorhandler(500)
def internal_error(e):
    return jsonify({"error": "Internal server error"}), 500


if __name__ == '__main__':
    print("=" * 50)
    print("🔧 VarnamAI Backend Server")
    print("=" * 50)

    # Preload all engines
    print("\n🔄 Preloading transliteration engines...")
    supported_langs = ['hi', 'ta', 'te', 'mr']
    lang_names = {'hi': 'Hindi', 'ta': 'Tamil', 'te': 'Telugu', 'mr': 'Marathi'}

    for lang in supported_langs:
        try:
            get_engine(lang)
            print(f"  ✅ {lang_names[lang]} ({lang}) engine loaded")
        except Exception as e:
            print(f"  ❌ Failed to load {lang_names[lang]} ({lang}): {e}")

    print("\n" + "=" * 50)
    print("🚀 VarnamAI Backend is running!")
    print(f"📍 Local: http://localhost:5000")
    print(f"📍 Network: http://0.0.0.0:5000")
    print("📡 Health check: http://localhost:5000/health")
    print("=" * 50)
    print("\n⚠️  Make sure your HTML, CSS, and JS files are in the same directory")
    print("⚠️  Open http://localhost:5000 in your browser\n")

    # Run on port 5000 (default Flask port)
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
