# GenApp

GenApp is a framework for generating science gateway and application
interfaces from JSON definitions plus executable wrappers. Application authors
describe menus, modules, inputs, outputs, runtime behavior, and target
languages; GenApp reads those definitions and emits target-specific application
code.

## php7designer Branch

This branch is the active development branch for the PHP 7 / HTML5 Designer
work. It is still under development, but it is being used for current GenApp
development and application work.

Current focus areas include:

- PHP 7 compatibility for generated web applications.
- Designer and UI layout/style updates.
- Continued HTML5 target behavior and runtime maintenance.

Expect changes while this branch is refined. Preserve existing application JSON
ids where possible when updating generated interfaces, because previous jobs may
depend on those ids for reattach and output handling.

## Documentation

The current GenApp documentation is maintained in the GitHub wiki:

- [Start Here](https://github.com/ehb54/genapp/wiki/Start-Here)
- [Get GenApp](https://github.com/ehb54/genapp/wiki/Get-GenApp)
- [Install GenApp](https://github.com/ehb54/genapp/wiki/Install-GenApp)
- [Wrap an Application](https://github.com/ehb54/genapp/wiki/Wrap-an-Application)
- [Reference](https://github.com/ehb54/genapp/wiki/Reference)
- [Developer Guide](https://github.com/ehb54/genapp/wiki/Developer-Guide)

## Repository Layout

- `bin/`: GenApp command-line entry points and validation helpers.
- `languages/`: target definitions and templates for generated output.
- `modules/`: built-in and system module definitions.
- `etc/`: Perl utilities, tests, templates, and support files.
- `sbin/`: installer and application-management scripts.
- `dockerfiles/`: container build material.
- `tools/`: local maintenance helpers.

## Application Layout

A GenApp application normally contains:

- `directives.json`: global generation and application directives.
- `menu.json`: menu hierarchy and module grouping.
- `modules/*.json`: module input/output field definitions and behavior.
- `bin/`: executable wrappers or programs invoked by modules.
- `add/`: optional static files copied into generated output.

Executable wrappers should write valid JSON to stdout and send diagnostics to
stderr or files.

## Development Notes

Set `GENAPP` to this repository before running the local command-line tools.
Use `bin/check_json.pl` for JSON validation and `bin/genapp_check.pl` or
`genapp` for application-directory validation when a fixture or application is
available.

## please use [GenApp's current subversion repo](https://genapp.rocks/wiki/wiki/get)

