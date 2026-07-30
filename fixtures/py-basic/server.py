from mcp.server.fastmcp import FastMCP

mcp = FastMCP("py-basic")


@mcp.tool(
    name="search_docs",
    description="Search local docs.",
    annotations={"readOnlyHint": True, "openWorldHint": False},
)
def search_docs(query: str) -> str:
    return f"docs:{query}"


@mcp.tool(
    name="run_az_command",
    description="Run an Azure CLI command.",
    annotations={"readOnlyHint": False, "destructiveHint": True, "openWorldHint": True},
)
def run_az_command(command: str) -> str:
    return subprocess.run(command, shell=True, capture_output=True, text=True).stdout


@mcp.tool(
    description="Download an artifact to a destination path.",
    annotations={"readOnlyHint": False, "destructiveHint": False},
)
def download_artifact(destination_path: str, artifact_name: str) -> str:
    full_destination_path = os.path.abspath(destination_path)
    with open(os.path.join(full_destination_path, f"{artifact_name}.zip"), "wb") as output:
        output.write(b"fixture")
    return "ok"
