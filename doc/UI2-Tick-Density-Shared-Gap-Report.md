# Automatic logarithmic tick density (#333)

Owner approval: Joseph Curtis approved the coordinated correction manifest,
including gated GenApp core work, on October 26, 2026. No deployment is approved.

The application already selects concise `.4~g` notation. That changes text,
not automatic tick density. The existing tick-format browser fixture forces
`dtick: 1`, so it misses the failure. The new neutral fixture uses anonymous
scatter values over approximately 0.009–0.3, a logarithmic x axis and automatic
ticks. Before core changes, Plotly 2.35.2 in local headless Chrome produced six
adjacent overlapping label pairs at width 856 and zero at width 480. No module,
output, scientific role, or SASSIE-specific identifier enters the reproduction.

Existing view controls cover notation, title wrapping and subplot spacing,
not adjacent tick collisions. Producer tick placement would put responsive
presentation into saved scientific output. YAML does not own geometry.

Implemented contract: `plotPresentation.axisTickDensity` maps ordinary axis names
to `avoid-overlap`. Only explicitly declared log axes with automatic placement
participate. Measure native rendered labels, favor decade labels, and retain a
non-overlapping subset on detached display axes. Preserve explicit placement,
scientific arrays, ranges, zoom, formatting and hover precision. UI2 and the Lab
call one helper. Refit on rendering, resize and zoom; no module-specific logic.

Controls: omitted/invalid opt-in, linear/date/category axes, explicit axis or
template placement, and overlaid axes. Bounded fitting must not create relayout
loops. PNG and Chart Editor receive the fitted display layout. Saved outputs
retain native placement. Removing the opt-in restores automatic placement.

Local and Linux validation results are recorded below after implementation.
Live acceptance and deployment remain pending separate authorization.

## Local validation, October 26, 2026

- macOS Perl/Node lane: six suites passed, 763 assertions (`plotly_tick_density`,
  `plotly_tick_format`, `plotly_subplot_spacing`, `plotly_axis_title_overflow`,
  `plot_presentation_patterns`, `ui2_views`).
- Neutral local headless Chrome/Plotly 2.35.2 fixture: 33 checks passed. Covers
  widths 480/856/1200, repeated fitting, zoom/reset, source/range preservation,
  explicit placement, two panels, completed updates, purge/reconstruction,
  opt-in removal and scale-2 PNG export at displayed dimensions (1712x1116).
- Application regression lane: 101 tests passed, one known unrelated scenario
  catalog test excluded after reproducing its failure with the unchanged HEAD
  runner. The existing `tamc_phase6_charmm36_ssdna` result-view mapping does not
  cover each output id exactly once. Its catalog was not changed.
- All four MCA Decomposition fixtures rendered across four panel/canvas
  combinations (16 cases), with no adjacent q-label overlap. Color and grayscale
  component exports were reviewed: smaller filled measured markers and larger
  open rescaled markers remain distinguishable at coincident coordinates.
  Scientific fixture data/layout were preserved during presentation refresh.
- Linux runtime validation remains pending: the local Docker socket is absent.
  macOS checks are local evidence, not authoritative Linux runtime acceptance.
- Deployment, actual UI2/Lab lifecycle acceptance, Chart Editor interaction,
  and Susan's evaluation remain pending. No live service was changed.

The application commit also corrects acceptance-runner matrix hydration: it
reconstructs ordered rows from DOM cell coordinates and checks nested dimensions
and values instead of comparing a nested scenario matrix with a flat list.
