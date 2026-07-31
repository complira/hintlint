/**
 * @name HintLint: MCP tool parameter flows to raw query execution
 * @description Detects when an MCP tool handler parameter reaches a raw SQL or
 *              query execution sink without parameter binding.
 * @kind path-problem
 * @problem.severity error
 * @id hintlint/query-injection
 * @tags security
 *       mcp
 *       external/cwe/cwe-89
 * @precision high
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

class QueryExecutionSink extends DataFlow::Node {
  QueryExecutionSink() {
    exists(DataFlow::CallNode call |
      call.getCalleeName() = ["query", "execute", "raw"] and
      this = call.getArgument(0) and
      // Exclude parameterized queries (second arg is params array)
      not exists(call.getArgument(1))
    )
  }
}

module McpQueryConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node source) {
    source instanceof McpToolHandlerParam
  }

  predicate isSink(DataFlow::Node sink) {
    sink instanceof QueryExecutionSink
  }
}

module McpQueryFlow = TaintTracking::Global<McpQueryConfig>;

from McpQueryFlow::PathNode source, McpQueryFlow::PathNode sink
where McpQueryFlow::flowPath(source, sink)
select sink.getNode(), source, sink,
  "MCP tool parameter flows to raw query execution at $@.",
  sink.getNode(), sink.getNode().toString()
