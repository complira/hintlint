/**
 * @name HintLint: MCP tool parameter flows to database mutation
 * @description Detects when an MCP tool handler parameter reaches a database
 *              destructive or write operation via an ORM or raw query.
 * @kind path-problem
 * @problem.severity error
 * @id hintlint/database-mutation
 * @tags security
 *       mcp
 *       external/cwe/cwe-89
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

class DatabaseMutationSink extends DataFlow::Node {
  DatabaseMutationSink() {
    exists(DataFlow::CallNode call |
      (
        // ORM destructive methods
        call.getCalleeName() = [
          "delete", "deleteOne", "deleteMany",
          "remove", "removeOne", "removeMany",
          "destroy", "destroyAll",
          "drop", "dropCollection",
          "truncate",
          // ORM write methods
          "create", "createOne", "createMany",
          "update", "updateOne", "updateMany",
          "upsert",
          "insert", "insertOne", "insertMany",
          "save"
        ]
        or
        // Raw query execution
        call.getCalleeName() = ["query", "execute", "raw"]
      ) and
      this = call.getArgument(0)
    )
  }
}

module McpDbConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node source) {
    source instanceof McpToolHandlerParam
  }

  predicate isSink(DataFlow::Node sink) {
    sink instanceof DatabaseMutationSink
  }
}

module McpDbFlow = TaintTracking::Global<McpDbConfig>;

from McpDbFlow::PathNode source, McpDbFlow::PathNode sink
where McpDbFlow::flowPath(source, sink)
select sink.getNode(), source, sink,
  "MCP tool parameter flows to database mutation at $@.",
  sink.getNode(), sink.getNode().toString()
