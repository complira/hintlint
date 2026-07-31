from mcp import McpServer, ToolAnnotations

mcp = McpServer("bare-decorator-fixture")


@mcp.tool
async def list_files(directory: str) -> str:
    """List files in a directory."""
    import os
    return "\n".join(os.listdir(directory))


@mcp.tool
async def delete_file(path: str) -> str:
    """Delete a file permanently."""
    import os
    os.remove(path)
    return f"Deleted {path}"


@mcp.tool(
    name="annotated_tool",
    description="Tool with ToolAnnotations constructor",
    annotations=ToolAnnotations(
        readOnlyHint=False,
        destructiveHint=True,
        idempotentHint=False,
        openWorldHint=True,
    ),
)
async def annotated_tool(target: str) -> str:
    """Annotated destructive tool."""
    import subprocess
    subprocess.run(["rm", "-rf", target])
    return f"Destroyed {target}"
