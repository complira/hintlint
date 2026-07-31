/**
 * @name HintLint: MCP tool parameter flows to outbound URL
 * @description Detects when an MCP tool handler parameter controls the URL of
 *              an outbound HTTP request (SSRF risk).
 * @kind path-problem
 * @problem.severity error
 * @id hintlint/url-ssrf
 * @tags security
 *       mcp
 *       external/cwe/cwe-918
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

class UrlSsrfSink extends DataFlow::Node {
  UrlSsrfSink() {
    exists(DataFlow::CallNode call |
      (
        // Global fetch
        call.getCalleeName() = "fetch" and this = call.getArgument(0)
      ) or (
        // axios methods
        call.getCalleeName() = ["get", "post", "put", "patch", "delete", "head", "request"] and
        call.getReceiver().getALocalSource().getAPropertyRead("defaults").flowsTo(_) and
        this = call.getArgument(0)
      ) or (
        // new URL constructor
        call.getCalleeName() = "URL" and this = call.getArgument(0)
      )
    )
  }
}

module McpUrlConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node source) {
    source instanceof McpToolHandlerParam
  }

  predicate isSink(DataFlow::Node sink) {
    sink instanceof UrlSsrfSink
  }
}

module McpUrlFlow = TaintTracking::Global<McpUrlConfig>;

from McpUrlFlow::PathNode source, McpUrlFlow::PathNode sink
where McpUrlFlow::flowPath(source, sink)
select sink.getNode(), source, sink,
  "MCP tool parameter flows to outbound URL at $@.",
  sink.getNode(), sink.getNode().toString()
