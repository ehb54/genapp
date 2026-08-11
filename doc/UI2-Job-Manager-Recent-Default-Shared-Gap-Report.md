# UI2 Job Manager Recent Default Shared-Gap Report

Status: approved for implementation by the 2026-08-11 Job Manager task.

## Symptom

The native UI2 Job Manager initially selects `*all*`, displaying every prior
job. Users who have not run a job recently can face an unnecessarily long list,
while active users do not begin with the most relevant completed jobs.

## Smallest application-level attempt

No application view, module JSON, driver, or helper controls this behavior.
The Job Manager is a generic UI2 utility whose completed-window options and
initial value are created in `languages/ui2/add/js/ui2.js`.

## Neutral reproduction

Given generic job-feed rows containing completed jobs at one hour, one day, one
week, one month, or older, the utility should select the narrowest completed
window with at least one result. If no completed row is within a month, it
should select `*all*`. Running rows continue to use the existing Running
filter; they do not qualify a completed window.

## Generic contract

On its first successful feed load, a Job Manager instance resolves its
completed filter in this order: Hour, Day, Week, Month, All. The selected
control visibly shows the resolved window. A user filter change, including one
made while the feed is loading, disables automatic resolution for that instance.

This is client-side presentation behavior over the existing legacy job feed.
It changes no endpoint, module JSON, submitted values, job record, driver,
runtime event, completed output, or reattachment contract.

## Consumers and compatibility

The opted-in consumer is native UI2 Job Manager. HTML5 is the non-opted-in
control: its `sys_job2_manager` module JSON continues to default to `*all*`.
The existing Hour/Day/Week/Month values and old numeric day values remain
compatible with the current UI2 filter implementation.

Rollback is a target-local removal of the resolver and Hour initial selection;
no stored data or application migration is involved.

## Verification

Runtime tests cover each resolved window, boundary timestamps, only-running and
empty histories. UI2 source checks ensure a user filter interaction suppresses
automatic resolution. UI2 generation and legacy target-isolation checks confirm
that HTML5 output remains unchanged.
