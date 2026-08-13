import type { JobRuntimeSnapshot } from "./types.js"

export type RunCue = {
  text: string
  tone: "normal" | "warning"
}

export function runtimeLogText(snapshot: JobRuntimeSnapshot): string {
  const topic = snapshot.channels.log?.run
  const appended = (topic?.items || []).map((item) => {
    if (item && typeof item === "object" && "text" in item) return String((item as { text?: unknown }).text || "")
    return String(item || "")
  }).join("")
  return appended || String(topic?.value || "")
}

function runtimeProgressValue(snapshot: JobRuntimeSnapshot): Record<string, unknown> {
  const topic = snapshot.channels.progress?.run
  const value = topic?.value
  return value && typeof value === "object" ? value as Record<string, unknown> : {}
}

function numberText(value: unknown): string | null {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? String(numeric) : null
}

function firstLogMatch(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern)
  return match?.[1]?.trim() || null
}

export function runCueMessage(snapshot: JobRuntimeSnapshot): RunCue {
  const lifecycle = snapshot.lifecycle || {}
  const lifecycleState = String(lifecycle.state || lifecycle.status || "").trim().toLowerCase()
  const lifecycleMessage = String(lifecycle.error || lifecycle.message || "").trim()
  if (["failed", "error"].includes(lifecycleState)) {
    return {
      text: lifecycleMessage ? `Run failed · ${lifecycleMessage}` : "Run failed",
      tone: "warning"
    }
  }
  if (["cancelled", "canceled"].includes(lifecycleState)) {
    return { text: lifecycleMessage ? `Run cancelled · ${lifecycleMessage}` : "Run cancelled", tone: "warning" }
  }

  const log = runtimeLogText(snapshot)
  const progress = runtimeProgressValue(snapshot)
  const accepted = firstLogMatch(log, /accepted\s+(\d+\s+out\s+of\s+\d+)\s*:/i)
    || (
      numberText(progress.accepted) && numberText(progress.attempted)
        ? `${numberText(progress.accepted)} / ${numberText(progress.attempted)}`
        : null
    )
  const outputDir = firstLogMatch(log, /Configurations and statistics saved in\s+(.+?)\s+directory/i)
  const completed = ["complete", "completed", "finished"].includes(lifecycleState)
    || Number(progress.fraction) >= 1
    || /(?:is done|completed successfully|run complete)/i.test(log)
  const hasException = /(?:unhandled exception|traceback|error:|exception)/i.test(log)
  const hasProgress = Object.keys(progress).length > 0
  if (hasException && !completed) {
    return { text: "Needs attention · driver reported an exception", tone: "warning" }
  }
  if (completed) {
    const parts = ["Run completed"]
    if (accepted) parts.push(`accepted ${accepted}`)
    if (outputDir) parts.push(`outputs saved in ${outputDir}`)
    return { text: parts.join(" · "), tone: "normal" }
  }
  if (!hasProgress && !log && !snapshot.run) {
    return { text: "Starting job · waiting for first runtime message", tone: "normal" }
  }
  if (!hasProgress && !log) {
    return { text: "Starting job · runtime stream connecting", tone: "normal" }
  }
  if (hasProgress) {
    return { text: "Running · live progress active", tone: "normal" }
  }
  const lineCount = log ? log.split(/\r?\n/).filter((line) => line.trim()).length : 0
  if (lineCount) return { text: `Running · run log active · ${lineCount} lines received`, tone: "normal" }
  return { text: "Starting job · waiting for first runtime message", tone: "normal" }
}
