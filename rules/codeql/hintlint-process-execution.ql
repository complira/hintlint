/**
 * @name HintLint: MCP tool parameter flows to process execution
 * @description Detects when an MCP tool handler parameter reaches a process
 *              execution sink (child_process.exec, subprocess.run, etc.)
 *              without a server-side allowlist.
 * @kind path-problem
 * @problem.severity error
 * @id hintlint/process-execution
 * @tags security
 *       mcp
 *       external/cwe/cwe-78
 * @precision medium
 */

import javascript
import DataFlow::PathGraph

/**
 * A source: parameter of an MCP server.tool() handler callback.
 */
class McpToolHandlerParam extends DataFlow::SourceNode {
  McpToolHandlerParam() {
    exists(DataFlow::CallNode call, DataFlow::FunctionNode handler |
      // server.tool(name, schema, handler)
      call.getCalleeName() = "tool" and
      handler = call.getArgument([2, 3]).getALocalSource() and
      this = handler.getParameter(0)
    )
  }
}

/**
 * A sink: process execution calls.
 */
class ProcessExecutionSink extends DataFlow::Node {
  ProcessExecutionSink() {
    exists(DataFlow::CallNode call |
      call.getCalleeName() = ["exec", "execSync", "spawn", "spawnSync", "execFile", "execFileSync", "fork"] and
      this = call.getArgument(0)
    )
  }
}

/**
 * Taint configuration for MCP handler param to process execution.
 */
module McpProcessConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node source) {
    source instanceof McpToolHandlerParam
  }

  predicate isSink(DataFlow::Node sink) {
    sink instanceof ProcessExecutionSink
  }
}

module McpProcessFlow = TaintTracking::Global<McpProcessConfig>;

from McpProcessFlow::PathNode source, McpProcessFlow::PathNode sink
where McpProcessFlow::flowPath(source, sink)
select sink.getNode(), source, sink,
  "MCP tool parameter flows to process execution at $@.",
  sink.getNode(), sink.getNode().toString()
