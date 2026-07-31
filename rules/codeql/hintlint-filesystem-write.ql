/**
 * @name HintLint: MCP tool parameter flows to filesystem write
 * @description Detects when an MCP tool handler parameter reaches a filesystem
 *              write sink without path containment validation.
 * @kind path-problem
 * @problem.severity warning
 * @id hintlint/filesystem-write
 * @tags security
 *       mcp
 *       external/cwe/cwe-22
 * @precision medium
 */

import javascript
import DataFlow::PathGraph

class McpToolHandlerParam extends DataFlow::SourceNode {
  McpToolHandlerParam() {
    exists(DataFlow::CallNode call, DataFlow::FunctionNode handler |
      call.getCalleeName() = "tool" and
      handler = call.getArgument([2, 3]).getALocalSource() and
      this = handler.getParameter(0)
    )
  }
}

class FilesystemWriteSink extends DataFlow::Node {
  FilesystemWriteSink() {
    exists(DataFlow::CallNode call |
      call.getCalleeName() = [
        "writeFile", "writeFileSync",
        "createWriteStream",
        "mkdir", "mkdirSync",
        "rm", "rmSync", "rmdir", "rmdirSync",
        "unlink", "unlinkSync",
        "rename", "renameSync",
        "copyFile", "copyFileSync"
      ] and
      this = call.getArgument(0)
    )
  }
}

module McpFsConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node source) {
    source instanceof McpToolHandlerParam
  }

  predicate isSink(DataFlow::Node sink) {
    sink instanceof FilesystemWriteSink
  }
}

module McpFsFlow = TaintTracking::Global<McpFsConfig>;

from McpFsFlow::PathNode source, McpFsFlow::PathNode sink
where McpFsFlow::flowPath(source, sink)
select sink.getNode(), source, sink,
  "MCP tool parameter flows to filesystem write at $@.",
  sink.getNode(), sink.getNode().toString()
