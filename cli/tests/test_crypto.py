"""Envelope format tests against the shared cross-language fixture.

The same vector is asserted byte-for-byte by web/src/lib/envelope.test.ts,
proving the Python CLI and the browser produce interchangeable envelopes.
"""

import base64
import json
import os
from pathlib import Path
from unittest import mock

import pytest

from enclave import crypto

VECTOR = json.loads(
    (Path(__file__).resolve().parents[2] / "testdata" / "envelope-vector.json").read_text()
)

KEY = bytes.fromhex(VECTOR["key_hex"])
NONCE = bytes.fromhex(VECTOR["nonce_hex"])
WRAPPED = base64.b64decode(VECTOR["wrapped_b64"])
PLAINTEXT = VECTOR["plaintext_utf8"].encode()
ENVELOPE = base64.b64decode(VECTOR["envelope_b64"])


def test_seal_reproduces_fixture_exactly():
    with mock.patch("enclave.crypto.os.urandom", return_value=NONCE):
        assert crypto.seal(KEY, WRAPPED, PLAINTEXT) == ENVELOPE


def test_open_envelope_recovers_fixture_plaintext():
    assert crypto.open_envelope(KEY, ENVELOPE) == PLAINTEXT


def test_parse_wrapped_key_and_split():
    assert crypto.parse_wrapped_key(ENVELOPE) == WRAPPED
    wrapped, nonce, ct = crypto.split(ENVELOPE)
    assert wrapped == WRAPPED
    assert nonce == NONCE
    assert len(ct) == len(PLAINTEXT) + 16  # GCM tag


def test_random_round_trip():
    key = os.urandom(32)
    wrapped = os.urandom(184)
    content = os.urandom(4096)
    envelope = crypto.seal(key, wrapped, content)
    assert crypto.open_envelope(key, envelope) == content
    assert crypto.parse_wrapped_key(envelope) == wrapped


def test_rejects_bad_magic():
    with pytest.raises(ValueError):
        crypto.open_envelope(KEY, b"XXXX" + ENVELOPE[4:])
