export function inferVerifiedBehavior(sinkEvidence) {
  const categories = new Set(sinkEvidence.map((item) => item.category));
  const sinkKinds = new Set(sinkEvidence.map((item) => item.sink_kind));
  const unsafeFlows = [...new Set(
    sinkEvidence
      .filter((item) => item.flow && item.sanitizer?.status !== "found")
      .map((item) => item.flow)
  )].sort();
  const unsafeQuery = unsafeFlows.includes("query");

  return {
    readOnlyHint: !(
      categories.has("database_mutation") ||
      categories.has("filesystem_mutation") ||
      categories.has("http_mutation") ||
      categories.has("external_send") ||
      categories.has("cloud_mutation") ||
      categories.has("process_execution") ||
      unsafeQuery
    ),
    destructiveHint: sinkKinds.has("destructive") || categories.has("process_execution"),
    openWorldHint: (
      categories.has("http_mutation") ||
      categories.has("external_send") ||
      categories.has("cloud_mutation") ||
      categories.has("process_execution") ||
      categories.has("url_construction")
    ),
    writes_internal_state: categories.has("database_mutation") || categories.has("filesystem_mutation") || categories.has("http_mutation"),
    external_side_effect: categories.has("external_send") || categories.has("http_mutation") || categories.has("cloud_mutation"),
    destructive_action: sinkKinds.has("destructive"),
    process_execution: categories.has("process_execution"),
    filesystem_mutation: categories.has("filesystem_mutation"),
    database_mutation: categories.has("database_mutation"),
    http_mutation: categories.has("http_mutation"),
    cloud_mutation: categories.has("cloud_mutation"),
    query_execution: categories.has("query_execution"),
    url_construction: categories.has("url_construction"),
    connection_string: categories.has("connection_string"),
    unsafe_flows: unsafeFlows,
    evidence_categories: [...categories].sort(),
    confidence: sinkEvidence.length > 0 ? "source-backed" : "unknown"
  };
}

export function suggestedAnnotationsFor(declared, behavior) {
  const suggested = { ...declared };
  suggested.readOnlyHint = behavior.readOnlyHint;
  if (behavior.destructiveHint || declared.destructiveHint !== undefined) {
    suggested.destructiveHint = behavior.destructiveHint;
  }
  if (behavior.openWorldHint || declared.openWorldHint !== undefined) {
    suggested.openWorldHint = behavior.openWorldHint;
  }
  return suggested;
}
