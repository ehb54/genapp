# Ubuntu Pro build

Ubuntu 20.04 package installation in this image requires Ubuntu Pro services
`esm-infra` and `esm-apps`. The subscription credential must never be committed,
passed as a build argument, or copied into the Docker build context.

Create an attach configuration outside the repository with permissions `0600`:

```yaml
token: YOUR_SHORT_LIVED_OR_CONTRACT_TOKEN
enable_services:
  - esm-infra
  - esm-apps
```

Build with BuildKit and mount that file as a secret:

```sh
docker build \
  --platform linux/amd64 \
  --pull \
  --no-cache \
  --secret id=pro-attach-config,src=/absolute/private/path/pro-attach-config.yaml \
  -t genapp/php7designer:focal-esm \
  -f dockerfiles/php7designer/Dockerfile \
  .
```

The `linux/amd64` platform matches the public deployment boundary and the
platform verified by this image's security and workflow checks. MongoDB 8.0 is
installed from its official Ubuntu 20.04 (`focal`) repository with reviewed
server and shell versions pinned in the Dockerfile. The optional MongoDB
database-tools bundle is deliberately omitted: GenApp does not call those
backup/import utilities, and their current binaries embed an unmaintained Go
crypto package reported by the image scanner.

To build only the patched operating-system, Apache and PHP boundary for
security verification, add:

```sh
--target php7designer-security-base \
-t genapp/php7designer:focal-esm-security-base
```

This target excludes application generation. The normal build copies the
maintained `t/fixtures/apps/minimal_html5` application to the established
`/opt/genapp/genapptest` path, generates its HTML5 target, and remains the
complete designer-image build. It does not fetch the obsolete SVN
`genapptest` project. Container-specific directives and application runtime
settings live beside this Dockerfile; they contain no credentials.

The Dockerfile attaches, upgrades and installs all APT-managed packages,
detaches, purges the Pro client, and removes the APT credentials in one layer.
The build intentionally fails when the secret is absent.

Ubuntu Pro covers Ubuntu archive packages. It does not cover MongoDB 8.0 from
the external MongoDB repository, pinned PECL/CPAN packages, Composer
dependencies, or downloaded application code. Those components require
separate lifecycle and vulnerability review.

The hardened PHP image omits the optional Closure Compiler JAR because the
maintained HTML5 target uses copy-mode assembly and does not execute it. The
Java target's Apache Thrift runtime is replaced during the source-clone layer
with checksum-verified Thrift 0.24.0; the vulnerable 0.9.1 JAR does not enter
the resulting image.
