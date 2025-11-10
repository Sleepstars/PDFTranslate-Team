"""
ALTCHA utility functions for challenge generation and verification.
"""
import hashlib
import hmac
import json
import secrets
import time
from typing import Optional


def create_challenge(
    secret_key: str,
    max_number: int = 100000,
    salt_length: int = 12,
    expires_in: int = 300  # 5 minutes
) -> dict:
    """
    Create an ALTCHA challenge.

    Args:
        secret_key: Secret key for HMAC signing
        max_number: Maximum number for the challenge
        salt_length: Length of the random salt
        expires_in: Challenge expiration time in seconds

    Returns:
        Dictionary containing challenge data
    """
    # Generate random salt
    salt = secrets.token_hex(salt_length)

    # Generate random number
    number = secrets.randbelow(max_number)

    # Calculate expiration timestamp
    expires = int(time.time()) + expires_in

    # Create the challenge hash
    challenge = hashlib.sha256(f"{salt}{number}".encode()).hexdigest()

    # Create signature
    signature_data = f"{challenge}{salt}{number}{expires}"
    signature = hmac.new(
        secret_key.encode(),
        signature_data.encode(),
        hashlib.sha256
    ).hexdigest()

    return {
        "algorithm": "SHA-256",
        "challenge": challenge,
        "salt": salt,
        "signature": signature,
        "maxnumber": max_number,
        "expires": expires
    }


def verify_solution(
    payload: str,
    secret_key: str,
    check_expires: bool = True
) -> bool:
    """
    Verify an ALTCHA solution payload.

    Args:
        payload: Base64-encoded JSON payload from the client
        secret_key: Secret key used to create the challenge
        check_expires: Whether to check if the challenge has expired

    Returns:
        True if the solution is valid, False otherwise
    """
    try:
        import base64

        # Decode the payload
        decoded = base64.b64decode(payload).decode('utf-8')
        data = json.loads(decoded)

        algorithm = data.get("algorithm")
        challenge = data.get("challenge")
        number = data.get("number")
        salt = data.get("salt")
        signature = data.get("signature")
        expires = data.get("expires")

        # Validate required fields
        if not all([algorithm, challenge, number is not None, salt, signature]):
            return False

        # Check algorithm
        if algorithm != "SHA-256":
            return False

        # Check expiration
        if check_expires and expires:
            if int(time.time()) > expires:
                return False

        # Verify the challenge hash
        computed_challenge = hashlib.sha256(f"{salt}{number}".encode()).hexdigest()
        if computed_challenge != challenge:
            return False

        # Verify the signature
        signature_data = f"{challenge}{salt}{number}{expires}"
        expected_signature = hmac.new(
            secret_key.encode(),
            signature_data.encode(),
            hashlib.sha256
        ).hexdigest()

        return hmac.compare_digest(signature, expected_signature)

    except Exception:
        return False


def verify_server_signature(
    challenge: str,
    salt: str,
    number: int,
    expires: int,
    signature: str,
    secret_key: str
) -> bool:
    """
    Verify the server signature of a challenge.

    Args:
        challenge: Challenge hash
        salt: Salt used in the challenge
        number: Number used in the challenge
        expires: Expiration timestamp
        signature: Signature to verify
        secret_key: Secret key used to create the signature

    Returns:
        True if the signature is valid, False otherwise
    """
    signature_data = f"{challenge}{salt}{number}{expires}"
    expected_signature = hmac.new(
        secret_key.encode(),
        signature_data.encode(),
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(signature, expected_signature)
