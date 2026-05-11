"""
Secure IoT Communication Simulator - Flask Backend
Implements Hybrid Encryption: AES-256 (CBC) + RSA-2048 (OAEP)

Flow:
  Encrypt: Message -> AES-256 -> ciphertext + IV
          AES key  -> RSA public key -> encrypted_key
  Decrypt: encrypted_key -> RSA private key -> AES key
          ciphertext + IV + AES key -> plaintext
"""

from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from Crypto.PublicKey import RSA
from Crypto.Cipher import AES, PKCS1_OAEP
from Crypto.Random import get_random_bytes
from Crypto.Util.Padding import pad, unpad
import base64
import os

app = Flask(__name__)
CORS(app)

# ─── RSA Key Generation (done once at startup) ────────────────────────────────
print("[*] Generating RSA-2048 key pair...")
rsa_key = RSA.generate(2048)          # Private key (holds both)
rsa_public_key = rsa_key.publickey()  # Public key (encrypt only)
print("[✓] RSA key pair ready.")


# ─── Helper Functions ─────────────────────────────────────────────────────────

def aes_encrypt(message: str) -> dict:
    """
    Step 1 – AES-256 CBC Encryption
    - Generate a random 32-byte key and 16-byte IV
    - Pad the message to AES block size (16 bytes) using PKCS7
    - Encrypt using AES in CBC mode
    """
    aes_key = get_random_bytes(32)   # 256-bit key
    iv      = get_random_bytes(16)   # 128-bit IV (one block)

    cipher     = AES.new(aes_key, AES.MODE_CBC, iv)
    padded_msg = pad(message.encode("utf-8"), AES.block_size)  # PKCS7 padding
    ciphertext = cipher.encrypt(padded_msg)

    return {
        "aes_key":    aes_key,
        "iv":         iv,
        "ciphertext": ciphertext,
    }


def rsa_encrypt_key(aes_key: bytes) -> bytes:
    """
    Step 2 – RSA-OAEP Encryption of the AES key
    - Use the RSA public key with OAEP padding
    - This protects the AES key during transmission
    """
    cipher_rsa    = PKCS1_OAEP.new(rsa_public_key)  # Asymmetric cipher (public)
    encrypted_key = cipher_rsa.encrypt(aes_key)
    return encrypted_key


def rsa_decrypt_key(encrypted_key: bytes) -> bytes:
    """
    Step 3 – RSA-OAEP Decryption of the AES key
    - Use the RSA private key to recover the original AES key
    """
    cipher_rsa = PKCS1_OAEP.new(rsa_key)            # Asymmetric cipher (private)
    aes_key    = cipher_rsa.decrypt(encrypted_key)
    return aes_key


def aes_decrypt(aes_key: bytes, iv: bytes, ciphertext: bytes) -> str:
    """
    Step 4 – AES-256 CBC Decryption
    - Reconstruct the AES cipher with the recovered key + IV
    - Decrypt and remove PKCS7 padding
    """
    cipher    = AES.new(aes_key, AES.MODE_CBC, iv)
    padded    = cipher.decrypt(ciphertext)
    plaintext = unpad(padded, AES.block_size)
    return plaintext.decode("utf-8")


# ─── API Endpoints ────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/encrypt", methods=["POST"])
def encrypt():
    """
    POST /encrypt
    Body:  { "message": "Hello Khaled" }
    Returns:
      {
        "ciphertext":     "<base64>",
        "iv":             "<base64>",
        "encrypted_key":  "<base64>"
      }
    """
    data    = request.get_json()
    message = data.get("message", "")

    if not message:
        return jsonify({"error": "No message provided"}), 400

    # Step 1: Encrypt message with AES-256
    enc = aes_encrypt(message)

    # Step 2: Encrypt the AES key with RSA public key
    encrypted_key = rsa_encrypt_key(enc["aes_key"])

    # Encode binary data to base64 strings for JSON transport
    return jsonify({
        "ciphertext":    base64.b64encode(enc["ciphertext"]).decode(),
        "iv":            base64.b64encode(enc["iv"]).decode(),
        "encrypted_key": base64.b64encode(encrypted_key).decode(),
    })


@app.route("/decrypt", methods=["POST"])
def decrypt():
    """
    POST /decrypt
    Body:
      {
        "ciphertext":    "<base64>",
        "iv":            "<base64>",
        "encrypted_key": "<base64>"
      }
    Returns: { "message": "Hello Khaled" }
    """
    data = request.get_json()

    try:
        ciphertext    = base64.b64decode(data["ciphertext"])
        iv            = base64.b64decode(data["iv"])
        encrypted_key = base64.b64decode(data["encrypted_key"])
    except (KeyError, Exception) as e:
        return jsonify({"error": f"Invalid input: {str(e)}"}), 400

    # Step 3: Decrypt AES key using RSA private key
    aes_key = rsa_decrypt_key(encrypted_key)

    # Step 4: Decrypt message using AES
    message = aes_decrypt(aes_key, iv, ciphertext)

    return jsonify({"message": message})


@app.route("/keys", methods=["GET"])
def get_public_key():
    """Return the RSA public key for educational display."""
    return jsonify({
        "public_key": rsa_public_key.export_key().decode()
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)