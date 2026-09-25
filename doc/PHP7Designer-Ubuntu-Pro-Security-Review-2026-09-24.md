# PHP7Designer Ubuntu Pro security review

Date: 2026-09-24; final image verification completed 2026-09-25

## Scope

This review covers the complete `genapp/php7designer:focal-esm` image from
`dockerfiles/php7designer/Dockerfile`, built as Linux `amd64`. The verified
local image and repository digest is
`sha256:82451480d0a96beddbe0f9da764074930c0e70949185eea8d206bef17727b88a`.

## Changes made

- Ubuntu Pro ESM Apps and ESM Infra are attached through a required BuildKit
  secret only while packages are upgraded and installed.
- The build detaches from Pro, removes the Pro client and deletes private APT
  credentials before the package layer closes.
- OpenSSH package-created host keys are removed before the package layer closes.
  The container generates its own keys at startup, so cloned containers do not
  share private host keys baked into the image.
- All Ubuntu packages are installed in the Pro-enabled layer with bounded APT
  retries and timeouts.
- The MongoDB repository uses a scoped `signed-by` key instead of `apt-key`.
- MongoDB was upgraded from the unsupported 4.2 repository to MongoDB server
  8.0.32 and MongoDB Shell 2.12.0 from the official Ubuntu 20.04 repository.
  The versions are pinned and held. Optional database backup/import tools are
  omitted because GenApp does not call them and their current binaries embed
  an unmaintained Go crypto package flagged by Trivy.
- Apache has `TraceEnable Off`, `ServerTokens Prod` and
  `ServerSignature Off`.
- LWP and the PHP mail libraries now come from Ubuntu packages instead of
  unpinned CPAN/PEAR downloads.
- PHP extensions are pinned to PHP 7.4-compatible releases: MongoDB 1.20.1,
  UUID 1.3.0 and ImageMagick 3.8.1. The build fails if their shared libraries
  are absent.
- The obsolete SVN `genapptest` project is replaced by the maintained minimal
  HTML5 workflow fixture. Container-specific directives and runtime settings
  preserve the established `/opt/genapp/genapptest` path without credentials.
- The optional Closure Compiler JAR is omitted because the maintained HTML5
  target uses copy-mode assembly. Apache Thrift 0.9.1 is replaced with
  checksum-verified Thrift 0.24.0 for the Java target.

## Verification results

- Apache `2.4.41-4ubuntu3.23+esm7`
- PHP `7.4.3-4ubuntu2.29+esm3`
- OpenSSL `1.1.1f-1ubuntu2.24+esm5`
- OpenSSH `8.2p1-4ubuntu0.13+esm3`
- Apache configuration: `Syntax OK`
- Loaded Apache shared modules recorded: `access_compat`, `alias`, `auth_basic`,
  `authn_core`, `authn_file`, `authz_core`, `authz_host`, `authz_user`,
  `autoindex`, `deflate`, `dir`, `env`, `filter`, `mime`, `mpm_prefork`,
  `negotiation`, `php7`, `proxy`, `proxy_wstunnel`, `reqtimeout`, `setenvif`
  and `status`
- HTTP TRACE request: `405 Method Not Allowed`
- Required PHP extensions loaded: `mongodb`, `uuid`, `imagick`, `zmq`
- MongoDB server `8.0.32` started and answered a live `mongosh` ping; MongoDB
  Shell `2.12.0` was present and the optional database-tool binaries were absent
- Ubuntu Pro client and private APT credential locations absent
- Image history contains no token-shaped attach configuration
- Dockerfile guardrail test: 37 checks passed
- Maintained HTML5 fixture workflow test: 15 checks passed
- Complete-image workflow: generation, web-root linking, `rc.genapp` startup
  and Apache configuration passed
- Generated application returned HTTP `200` and contained the expected title
- The generated legacy fixture still contains pre-existing GenApp placeholder
  strings; this is recorded separately and is not represented as a passed check
- SSH host private keys were absent from the image and generated at container
  startup
- Repository whitespace validation passed

The temporary Ubuntu Pro attach file and temporary verification container were
removed after the build.

## Trivy result

Trivy 0.74.0 scanned the final tagged local image using its locally downloaded
vulnerability database, updated 2026-09-24. It inspected 954 Ubuntu packages,
Java content and Node.js content. It reported zero vulnerabilities and zero
secrets; in particular, the Ubuntu Pro credential and SSH host private keys are
not embedded.

| Target | Critical | High | Medium | Low | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Ubuntu 20.04 packages | 0 | 0 | 0 | 0 | 0 |
| Node.js packages | 0 | 0 | 0 | 0 | 0 |
| Java packages | 0 | 0 | 0 | 0 | 0 |
| Secrets | 0 | 0 | 0 | 0 | 0 |

## Remaining limitations

- Ubuntu Pro covers Ubuntu archive packages, not MongoDB 8.0 from MongoDB's
  external repository, PECL/CPAN code, Composer dependencies or downloaded
  application code. Those components remain separately pinned and need normal
  lifecycle review.
- Trivy warns that Ubuntu 20.04 is past standard support and may not fully
  model ESM. Installed ESM package revisions and the zero Ubuntu-package result
  are both recorded above for review.

## Plain-language conclusion

The final Ubuntu, Apache, PHP and MongoDB image is updated, does not keep the
Ubuntu Pro credential or shared SSH host private keys, rejects TRACE, and
produced zero vulnerability and zero secret findings in the final local Trivy
scan. The image is ready to provide to the NIST scanning team for an independent
rescan of the intended production boundary.
