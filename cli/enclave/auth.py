"""Email one-time-code login flow."""

from __future__ import annotations

import click

from enclave.client import ApiClient
from enclave.config import Session


def login(api: ApiClient, email: str, code: str | None = None) -> Session:
    """Run the request -> verify exchange and persist the session."""
    api.auth_request(email)
    click.echo(f"A one-time login code has been emailed to {email}.")
    if code is None:
        code = click.prompt("Enter the code", hide_input=False).strip()

    result = api.auth_verify(email, code)
    session = Session(email=result["email"], token=result["token"], access=result.get("access", {}))
    session.save()
    return session
