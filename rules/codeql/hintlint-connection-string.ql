/**
 * @name HintLint: MCP tool parameter flows to connection string
 * @description Detects when an MCP tool handler parameter is interpolated into
 *              a database connection string without delimiter protection.
 * @kind path-problem
 * @problem.severity error
 * @id hintlint/connection-string
 * @tags security
 *       mcp
 *       external/cwe/cwe-88
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

class ConnectionStringSink extends DataFlow::Node {
  ConnectionStringSink() {
    exists(DataFlow::CallNode call |
      call.getCalleeName() = ["connect", "createConnection", "createPool", "createClient"] and
      this = call.getArgument(0)
    )
  }
}

module McpConnConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node source) {
    source instanceof McpToolHandlerParam
  }

  predicate isSink(DataFlow::Node sink) {
    sink instanceof ConnectionStringSink
  }
}

module McpConnFlow = TaintTracking::Global<McpConnConfig>;

from McpConnFlow::PathNode source, McpConnFlow::PathNode sink
where McpConnFlow::flowPath(source, sink)
select sink.getNode(), source, sink,
  "MCP tool parameter flows to connection string at $@.",
  sink.getNode(), sink.getNode().toString()
