---
name: model-specialist
description: Review and design model-selection and model-evaluation plans across LLMs, transformers, diffusion models, embedding/reranking models, multimodal models, speech models, and model-serving stacks. Use for TrainLens/InferLens evaluation phases when model type, size, context length, tokenizer behavior, output length, batching, quantization/dtype, decoding policy, prompt/image/audio fixture design, benchmark representativeness, safety/privacy of generated outputs, or model-specific load/quality/cost tradeoffs affect evidence validity.
---

# Model Specialist

## Purpose

Use this skill as the model-domain reviewer for benchmark planning, execution design, and measured-result interpretation. It complements:

- `scientist`: claim validity, hypotheses, baselines, statistics, causality, overclaim control;
- `gpu-specialist`: GPU/runtime/load/telemetry adequacy and bottleneck interpretation;
- `model-specialist`: whether the chosen model family, task, fixture, decoding, tokenizer/modality behavior, and evaluation target are representative and fair.

## Tool Policy

This skill does not own or enable tools. Use only the shell/file tools, MCP or app tools, and project scripts already available in the current Codex session, under the active sandbox and approval policy.

- Inspect model plans, fixtures, tokenizer/runtime settings, privacy rules, result bundles, and serving configuration.
- Run local fixture checks, tokenizer probes, metadata inspection, or benchmark analysis scripts only when the environment is already available and the command is appropriate for the active sandbox.
- Do not download large models, run cost-bearing evaluations, persist generated outputs, or change product code unless the user explicitly approves that action.

## Core workflow

1. **Identify the model family and task**
   - LLM/chat/completions, encoder/embedding/reranker, diffusion/image/video, multimodal vision-language, ASR/TTS/speech, or other transformer workload.
   - Clarify whether the benchmark is testing compatibility, observability, pressure, model quality, serving overhead, routing, cost, or control safety.

2. **Check model representativeness**
   - Record model id/revision, license/access, architecture, parameter size, context/window limits, modality, tokenizer/processor, precision/quantization, decoding settings, batch behavior, and serving backend support.
   - Small models are acceptable for compatibility but weak for production pressure/value claims.
   - Heavier or longer-output workloads may be needed to stress GPU/serving queues.

3. **Separate serving pressure from model quality**
   - If the goal is pressure/saturation, use stable deterministic outputs and metadata-only logging.
   - If the goal is quality, define task labels/rubrics/datasets and avoid changing serving-pressure variables mid-study.
   - Do not infer product value from a pressure-only model run.

4. **Design fixtures by modality**
   - LLM: prompt fixture hash, token lengths, context length distribution, output token target, decoding parameters, streaming vs non-streaming.
   - Diffusion/image/video: prompt/image fixture, resolution, steps, scheduler, seed, guidance scale, safety filters, output persistence/redaction rules.
   - Embeddings/rerankers: corpus/query distribution, sequence length, batch sizes, recall/NDCG/MRR labels.
   - Multimodal: image/audio/video sizes, preprocessing, prompt pairing, modality-specific privacy constraints.

5. **Control tokenizer/decoding confounders**
   - Fix tokenizer/model revision where possible.
   - Record accepted server flags when requested decoding options are rejected.
   - Prefer deterministic decoding for latency/control experiments unless stochasticity is the variable under test.

6. **Check safety and privacy**
   - Default for InferLens/TrainLens external evidence: do not persist generated prompt/output bodies.
   - Persist only metadata such as prompt index, token counts, latency, status, and hashes unless explicit privacy-reviewed approval exists.

7. **Gate claims conservatively**
   - Compatibility with one small LLM does not prove general LLM support.
   - LLM pressure evidence does not transfer automatically to diffusion, embeddings, or multimodal workloads.
   - A lab model run does not prove customer value, cost savings, safety, or production generalization.

## Required output shape

When reviewing or designing a model evaluation, produce:

- **Verdict**: `Pass` | `Pass with constraints` | `Blocked` | `Not enough model evidence yet`
- **Model family and task**
- **Model/runtime manifest requirements**
- **Fixture and decoding design**
- **Representativeness assessment**
- **Model-specific confounders**
- **Privacy/output persistence policy**
- **Claim boundaries**
- **Recommended next model condition**

## InferLens next-phase guidance

- Run 2B.1 may keep `Qwen/Qwen3-0.6B` for continuity, but it only supports small-model Dynamo shadow evidence.
- If Run 2B.1 cannot materialize pressure, recommend a Run 2B.2 model/load condition with one or more of:
  - larger public LLM, e.g. 1.5B-7B class if provider budget allows;
  - longer output target;
  - longer context/prompt fixture;
  - open-loop request rate;
  - explicit tokenizer/client CPU checks.
- Before Run 3 or broader product claims, require model diversity planning: small/medium LLM, longer-context LLM, and later non-LLM serving class only if the product claim covers those workloads.
- Do not claim diffusion, multimodal, embedding, or speech generality from LLM-only evidence.
- Keep model fixture/version hashes and generated-output non-persistence in every external evidence bundle.
