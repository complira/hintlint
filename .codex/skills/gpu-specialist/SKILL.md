---
name: gpu-specialist
description: GPU engineer review and design for benchmark/evaluation plans in model-serving systems, including RunPod/cloud GPU selection, CUDA/driver/runtime manifests, vLLM/SGLang/Dynamo load profiles, GPU/process telemetry, utilization/MFU interpretation, pressure materialization, bottleneck diagnosis, cost/runtime guardrails, and no-hot-path observability constraints. Use with scientist for TrainLens/InferLens benchmark protocols, external evidence runs, GPU utilization questions, model-serving performance regressions, and claim boundaries involving latency, throughput, overhead, saturation, or GPU cost.
---

# GPU Specialist

## Purpose

Use this skill as a GPU systems reviewer for benchmark planning, execution design, and measured-result interpretation. It complements the `scientist` skill: scientist owns evidence validity and claims; GPU specialist owns whether the GPU/runtime/load/telemetry setup can actually stress and measure the serving system fairly.

## Tool Policy

This skill does not own or enable tools. Use only the shell/file tools, MCP or app tools, and project scripts already available in the current Codex session, under the active sandbox and approval policy.

- Inspect benchmark plans, runtime manifests, load scripts, telemetry collectors, result bundles, and GPU-serving configuration.
- Run local diagnostics, telemetry reads, benchmark analysis scripts, or serving checks only when the environment is already available and the command is appropriate for the active sandbox.
- Do not provision paid GPU infrastructure, start cost-bearing runs, mutate production infrastructure, or deploy serving changes unless the user explicitly approves that action.

## Core workflow

1. **Clarify the benchmark question**
   - Is the goal compatibility, observability, pressure materialization, overhead, throughput/latency, cost, active-control safety, or production sizing?
   - Reject mixed goals unless the protocol separates phases and claims.

2. **Check hardware/runtime comparability**
   - Record GPU model/count, VRAM, driver, CUDA, image, framework versions, model id, quantization/dtype, vLLM/SGLang/Dynamo versions, CPU, RAM, region/provider, and pod/node ids.
   - Use independent pods/nodes only if the report claims independent repetitions.
   - Treat driver/image/provider drift as a covariate or downgrade.

3. **Design pressure before scoring intelligence**
   - Do not score an advisor until pressure/no-pressure labels are valid.
   - Add an unscored calibration/materialization phase before scored windows.
   - Prefer baseline-relative thresholds or pre-registered multi-signal pressure indexes over fixed absolute latency thresholds.
   - If pressure cannot be induced within budget/safety limits, classify as pressure-infeasible, not advisor success/failure.

4. **Separate load generation from telemetry**
   - Load generator defines request pressure and request-level latency/throughput.
   - Serving metrics define internal saturation/queueing if available.
   - GPU/process telemetry corroborates bottlenecks; it should not be the only correctness label unless GPU saturation is the claim.

5. **Prefer off-path observation**
   - For InferLens/TrainLens external evidence, default to existing `/metrics`, Prometheus snapshots, `nvidia-smi`/DCGM/process sampling, and result-bundle analysis.
   - Reject synchronous request/token hot-path hooks unless explicitly approved as a separate overhead condition.
   - Generated prompt/output bodies must not be persisted unless explicitly approved and privacy-reviewed.

6. **Diagnose bottlenecks before interpreting low GPU utilization**
   - Low GPU utilization can mean small model, short outputs, CPU/tokenizer bottleneck, client bottleneck, network latency, batching limits, memory/KV limits, or insufficient offered load.
   - Increase offered load, output length, model size, or open-loop request rate only through pre-approved budget/safety bounds.

7. **Gate claims conservatively**
   - Compatibility evidence does not prove performance.
   - Pressure evidence does not prove advisor quality.
   - Shadow advisor success does not prove active-control safety.
   - Lab GPU results do not prove customer value, cost savings, or production SLO improvement.

## Required output shape

When reviewing or designing a GPU evaluation, produce:

- **Verdict**: `Pass` | `Pass with constraints` | `Blocked` | `Not enough GPU evidence yet`
- **Benchmark question**
- **GPU/runtime manifest requirements**
- **Load/profile design**
- **Telemetry plan**
- **Pressure/materialization logic**
- **Bottleneck and utilization interpretation**
- **Budget/runtime/teardown guardrails**
- **Claim boundaries**
- **Next experiment**

## InferLens Run 2B/2B.1 guidance

For Dynamo shadow-advisory evaluation:

- Keep `:8000/metrics` as the primary verified Dynamo/vLLM metrics surface unless another endpoint is proven Prometheus-compatible.
- Keep `:8081/metrics` blocked if it returns non-Prometheus payloads.
- Use independent L40S pods only if preserving L40S comparability; do not mix GPU types in the same scored matrix unless GPU type is an explicit factor.
- Add calibration windows before scored advisory windows.
- Compute pressure thresholds from each repetition's own baseline, with the exact formula fixed before scored data is visible.
- Use higher concurrency, open-loop rate, longer output tokens, or a heavier public model only if pre-approved.
- Score one primary advisory subject, preferably `shadow_max_num_seqs` / queue-pressure hold-release; keep generic capacity/routing advisories diagnostic unless separately approved.
- Do not proceed to active mutation / Run 2C until shadow pressure labels and advisory gates pass measured scientist review.
