"""Client-side envelope encryption.

The AWS KMS master key is used (via the /crypto/datakey Lambda) to mint a per-file
AES-256 data key. We encrypt the file locally with AES-256-GCM and store the
KMS-wrapped data key alongside the ciphertext, so any authorized device can ask
KMS to unwrap it again.

Envelope layout (all binary, big-endian lengths):

    magic     "ENV1"        4 bytes
    blob_len  uint16        2 bytes   length of the KMS-wrapped data key
    blob      blob_len      KMS CiphertextBlob (opaque)
    nonce     12 bytes      AES-GCM nonce
    ciphertext+tag          remainder
"""

from __future__ import annotations

import os
import struct
from typing import Tuple

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

MAGIC = b"ENV1"
NONCE_LEN = 12
_HEADER = struct.Struct(">4sH")  # magic, blob_len


def seal(plaintext_key: bytes, wrapped_key: bytes, content: bytes) -> bytes:
    """Encrypt `content`. `wrapped_key` is the KMS CiphertextBlob to embed."""
    if len(plaintext_key) != 32:
        raise ValueError("expected a 256-bit data key")
    nonce = os.urandom(NONCE_LEN)
    ct = AESGCM(plaintext_key).encrypt(nonce, content, None)
    return _HEADER.pack(MAGIC, len(wrapped_key)) + wrapped_key + nonce + ct


def parse_wrapped_key(envelope: bytes) -> bytes:
    """Extract just the KMS-wrapped data key (needed before we can decrypt)."""
    magic, blob_len = _HEADER.unpack_from(envelope, 0)
    if magic != MAGIC:
        raise ValueError("not an enclave-envoy envelope")
    start = _HEADER.size
    return envelope[start : start + blob_len]


def open_envelope(plaintext_key: bytes, envelope: bytes) -> bytes:
    """Decrypt an envelope given the unwrapped plaintext data key."""
    magic, blob_len = _HEADER.unpack_from(envelope, 0)
    if magic != MAGIC:
        raise ValueError("not an enclave-envoy envelope")
    offset = _HEADER.size + blob_len
    nonce = envelope[offset : offset + NONCE_LEN]
    ct = envelope[offset + NONCE_LEN :]
    return AESGCM(plaintext_key).decrypt(nonce, ct, None)


def split(envelope: bytes) -> Tuple[bytes, bytes, bytes]:
    """Return (wrapped_key, nonce, ciphertext) without decrypting."""
    magic, blob_len = _HEADER.unpack_from(envelope, 0)
    if magic != MAGIC:
        raise ValueError("not an enclave-envoy envelope")
    start = _HEADER.size
    wrapped = envelope[start : start + blob_len]
    nonce = envelope[start + blob_len : start + blob_len + NONCE_LEN]
    ct = envelope[start + blob_len + NONCE_LEN :]
    return wrapped, nonce, ct
