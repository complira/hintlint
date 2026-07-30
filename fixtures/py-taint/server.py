import os
import re
import requests
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("py-taint")
ALLOWED_ROOT = "/tmp/hintlint-artifacts"


def validate_query_safety(query: str) -> None:
    if not query.lower().startswith("select "):
        raise ValueError("query must be read-only")


@mcp.tool(
    name="unsafe_postgres_query",
    description="Execute a PostgreSQL query supplied by the caller.",
    annotations={"readOnlyHint": True, "openWorldHint": False},
)
def unsafe_postgres_query(query: str) -> str:
    return conn.execute(query).fetchall()


@mcp.tool(
    name="safe_mysql_query",
    description="Execute a MySQL query after server-side validation.",
    annotations={"readOnlyHint": False, "openWorldHint": False},
)
def safe_mysql_query(query: str) -> str:
    validate_query_safety(query)
    return cursor.execute("SELECT id FROM customers WHERE name = ?", [query]).fetchall()


@mcp.tool(
    name="unsafe_storage_account",
    description="Fetch Azure Storage account metadata.",
    annotations={"readOnlyHint": True, "openWorldHint": False},
)
def unsafe_storage_account(account_name: str) -> str:
    url = f"https://{account_name}.blob.core.windows.net"
    return requests.get(url).text


@mcp.tool(
    name="safe_storage_account",
    description="Fetch Azure Storage account metadata for a validated account name.",
    annotations={"readOnlyHint": True, "openWorldHint": True},
)
def safe_storage_account(account_name: str) -> str:
    if not re.fullmatch(r"^[a-z0-9]{3,24}$", account_name):
        raise ValueError("invalid storage account name")
    url = f"https://{account_name}.blob.core.windows.net"
    return requests.get(url).text


@mcp.tool(
    name="unsafe_connection_string",
    description="Connect to a database using caller-provided database name.",
    annotations={"readOnlyHint": False, "openWorldHint": False},
)
def unsafe_connection_string(database: str) -> str:
    token = get_entra_token()
    connection_string = f"Host=db.internal;Database={database};Username=reader;Password={token}"
    return database_client.connect(connection_string).status


@mcp.tool(
    name="safe_download_artifact",
    description="Download an artifact under an allowed root.",
    annotations={"readOnlyHint": False, "destructiveHint": False},
)
def safe_download_artifact(destination_path: str, artifact_name: str) -> str:
    full_destination_path = os.path.abspath(os.path.join(ALLOWED_ROOT, destination_path))
    if not full_destination_path.startswith(ALLOWED_ROOT):
        raise ValueError("destination outside allowed root")
    with open(os.path.join(full_destination_path, f"{artifact_name}.zip"), "wb") as output:
        output.write(b"fixture")
    return "ok"


def maintenance_cleanup(path: str) -> None:
    shutil.rmtree(path)
