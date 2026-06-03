"""`enclave` command-line interface."""

from __future__ import annotations

import glob as globmod
from pathlib import Path

import click

from enclave import auth, sync
from enclave.client import ApiClient, ApiError
from enclave.config import Config, Session


def _client(require_auth: bool = True) -> ApiClient:
    cfg = Config.load()
    session = Session.load()
    token = session.require_token() if require_auth else None
    return ApiClient(cfg.require_api_url(), token=token)


@click.group()
@click.version_option(package_name="enclave-envoy")
def main() -> None:
    """Securely sync dotfiles across devices (AWS S3 + KMS)."""


@main.command()
@click.option("--api-url", required=True, help="HTTPS API URL printed by `sst deploy`.")
def configure(api_url: str) -> None:
    """Store the API endpoint locally."""
    cfg = Config.load()
    cfg.api_url = api_url
    cfg.save()
    click.echo(f"Saved API URL: {api_url}")


@main.command()
@click.argument("email")
@click.option("--code", default=None, help="Skip the prompt by passing the emailed code.")
def login(email: str, code: str | None) -> None:
    """Log in with EMAIL via a one-time code."""
    api = ApiClient(Config.load().require_api_url())
    try:
        session = auth.login(api, email, code)
    except ApiError as e:
        raise SystemExit(f"Login failed: {e}")
    projects = ", ".join(session.access) or "(none)"
    click.echo(f"Logged in as {session.email}. Projects: {projects}")


@main.command()
def logout() -> None:
    """Forget the local session."""
    Session.load().clear()
    click.echo("Logged out.")


@main.command()
def whoami() -> None:
    """Show the current user and access map (server-validated)."""
    try:
        info = _client().whoami()
    except ApiError as e:
        raise SystemExit(str(e))
    click.echo(f"Email: {info['email']}")
    for project, stages in info.get("access", {}).items():
        click.echo(f"  {project}: {', '.join(stages)}")


@main.command(name="list")
@click.option("--project", required=True)
@click.option("--stage", required=True)
def list_cmd(project: str, stage: str) -> None:
    """List files stored for a project/stage."""
    try:
        files = sync.remote_list(_client(), project, stage)
    except ApiError as e:
        raise SystemExit(str(e))
    if not files:
        click.echo("(empty)")
    for f in files:
        click.echo(f)


@main.command()
@click.option("--project", required=True)
@click.option("--stage", required=True)
@click.option("--glob", "glob_pat", default=None, help="Glob of files to push, e.g. '$HOME/.*'.")
@click.argument("files", nargs=-1, type=click.Path(exists=True, dir_okay=False, path_type=Path))
def push(project: str, stage: str, glob_pat: str | None, files: tuple[Path, ...]) -> None:
    """Encrypt and upload FILES (and/or a --glob) to project/stage."""
    targets = list(files)
    if glob_pat:
        targets += [Path(p) for p in globmod.glob(globmod.os.path.expanduser(glob_pat)) if Path(p).is_file()]
    if not targets:
        raise SystemExit("Nothing to push. Pass files or --glob.")

    api = _client()
    for path in targets:
        try:
            key = sync.push_file(api, project, stage, path)
            click.echo(f"↑ {path}  →  s3://{key}")
        except (ApiError, OSError) as e:
            click.echo(f"✗ {path}: {e}", err=True)


@main.command()
@click.option("--project", required=True)
@click.option("--stage", required=True)
@click.option("--dest", default=".", type=click.Path(file_okay=False, path_type=Path), help="Destination directory.")
@click.option("--only", multiple=True, help="Restrict to specific file names (repeatable).")
def pull(project: str, stage: str, dest: Path, only: tuple[str, ...]) -> None:
    """Download and decrypt files from project/stage into --dest."""
    api = _client()
    try:
        files = list(only) if only else sync.remote_list(api, project, stage)
    except ApiError as e:
        raise SystemExit(str(e))
    if not files:
        click.echo("(nothing to pull)")
        return
    for name in files:
        try:
            out = sync.pull_file(api, project, stage, name, dest)
            click.echo(f"↓ {name}  →  {out}")
        except (ApiError, OSError) as e:
            click.echo(f"✗ {name}: {e}", err=True)


if __name__ == "__main__":
    main()
