export type ResultsVisibility = {
  showResultsPane: boolean
  showRunStatus: boolean
}

export function resultsVisibility({
  submitting = false,
  hasRunContext = false,
  hasAvailableOutput = false,
  hasActionReview = false,
  hasScenarioReview = false,
}: {
  submitting?: boolean
  hasRunContext?: boolean
  hasAvailableOutput?: boolean
  hasActionReview?: boolean
  hasScenarioReview?: boolean
}): ResultsVisibility {
  const showRunStatus = submitting || hasRunContext
  return {
    showRunStatus,
    showResultsPane: showRunStatus || hasAvailableOutput || hasActionReview || hasScenarioReview,
  }
}
