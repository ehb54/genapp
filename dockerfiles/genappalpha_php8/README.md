# genappalpha_php8: test image for the svn-era GenApp on PHP 8

A container for this branch (`genappalpha-php8`) on Ubuntu 24.04, with the `demo`, `tutorial2` and `mulch`
applications installed for testing. It keeps the layout and ports of `dockerfiles/genappalpha`:
GenApp in `/src/genapp`, applications in `/opt/genapp/<app>`, docroot `/var/www/html`, messaging on
30777 (websocket), 30778 (zmq), 30779 (udp), 30780/30781 (tcp).

| component | version | source |
|---|---|---|
| Ubuntu | 24.04 | `ubuntu:24.04` |
| Apache, mod_php | 2.4.58 prefork, PHP 8.3 | Ubuntu archive |
| PHP extensions zmq, imagick | 1.1.3, 3.7.0 | Ubuntu archive (`php-zmq`, `php-imagick`) |
| PHP extension mongodb | 1.21.12 | PECL, built in the `phpext` stage |
| PEAR Mail, Mail_Mime, Net_SMTP | | Ubuntu archive |
| MongoDB | 8.0.34 | repo.mongodb.org |
| Go | 1.27.3 | go.dev (builds `util/msg-tcpserver`) |
| Python 2 | 2.7.18 | python.org source, built in the `python2` stage |
| Perl modules | | Ubuntu archive |

Versions and checksums are build arguments at the top of each stage of the `Dockerfile`.

Why these choices:

- **Ubuntu 24.04 with its own PHP 8.3** rather than 22.04 with the sury PPA: the distro PHP gets Ubuntu
  security updates through 2029. 22.04 would provide a python2 interpreter as a package, but no python2
  libraries either, so the source build below costs little.
- **python2 from source:** 24.04 has no python2, and the svn-era applications start their scripts with
  `#!/usr/bin/python`. It is installed in `/opt/python2.7`, with `/usr/bin/python` and `/usr/bin/python2` linked to it.
- **ext-mongodb from PECL:** Ubuntu's `php-mongodb` 1.15.0 cannot run `mongodb/mongodb` 1.21.5 (which has the
  fixes for CVE-2026-81525 and CVE-2026-88023), and 1.15 itself is affected by several 2026 driver advisories
  fixed in 1.21.12. The 1.x line is the one `alcaeus/mongo-php-adapter` works with.

## Targets

- `base`: GenApp and its runtime, no applications. A site image would start here and add its applications.
- `test`: `base` plus `demo`, `tutorial2` and `mulch`, installed with `sbin/getapp.pl` as a site would
  (`svn-from-dir` stands in for `svn`), then completed by `test-appconfig.php`. `smokeadmin` is their administrator.

## Recipe

Run on a Linux host with Docker (BuildKit is used when available, not required).

1. Export the test applications from a dump of the GenApp svn repository (`svnadmin dump` of the repository
   that holds `genappalpha` and the applications). The dump is loaded in a throwaway container without network.

   ```
   ./export-test-apps.sh /path/to/svn-dump.gz ~/genapp-test-apps
   ```

2. Build. `-r REF` builds from a git ref of this repository (default `HEAD`), `-w` from the working tree,
   `-t base` without applications.

   ```
   ./build.sh -a ~/genapp-test-apps
   ```

3. Smoke test. It starts container `gaphp8-smoke` with every PHP error level logged
   (`GENAPP_PHP_LOG_ALL=1`), runs `smoke-test.py` and `smoke_modules.py` from a client container in the same
   network namespace, and reports the messaging services, MongoDB contents and PHP log messages, with GenApp's
   own code separated from the vendored libraries. The container is left running.

   ```
   ./smoke-test.sh
   ```

4. Browser test: headless Chromium (Playwright) drives the generated `tutorial2` page: its websocket
   session, the login form, the Messaging Exercise and the Energy module. Screenshots go to OUTDIR.

   ```
   ./browser-test.sh ~/gaphp8-browser
   ```

5. PHP 8 compatibility scan: `php -l` (PHP 8.3) on the generated PHP of the three applications, and phpcs with
   PHPCompatibility (`testVersion 8.3`) on that and on GenApp's own PHP. Vendored libraries are not scanned.

   ```
   ./compat-scan.sh ~/gaphp8-scan
   ```

6. The test suite of `alcaeus/mongo-php-adapter` with the image's PHP and mongodb extension, against MongoDB 8.0
   in the image or against another server image:

   ```
   ./adapter-tests.sh ~/gaphp8-adapter
   ./adapter-tests.sh ~/gaphp8-adapter mongo:4.4
   ```

To look at the test container in a browser, run it with the web port published on the loopback interface,
for example `docker run -d --name gaphp8-web -p 127.0.0.1:8080:80 genappalpha-php8:test`, after building
with `-- --build-arg GENAPP_PUBLICPORT=8080` so that the page's websocket uses the same port.
`docker stop -t 60` lets the entry point stop Apache, MongoDB and the messaging services cleanly.

Clean up with `docker rm -f gaphp8-smoke` and `docker rmi genappalpha-php8:test genappalpha-php8-smokeclient
genappalpha-php8-browser genappalpha-php8-phpcs genappalpha-php8-svntools`.

## Notes for sites moving to this branch

- **MongoDB 4.0 or newer.** ext-mongodb 1.21 refuses the MongoDB 3.6 server of the PHP 5.6 containers
  ("reports wire version 6, but this version of libmongoc requires at least 7 (MongoDB 4.0)"). Move the data
  with `mongodump` from the old server and `mongorestore` into the new one (MongoDB 8.0 in this image).
- **`util/msg-tcpserver`.** genapp runs `util/build-tcp.sh` after generating, which needs go, git, cgo and the
  libzmq headers, and the directive `"zmqversion"` (`"4"` for libzmq 4.x). The server also needs
  `messaging.tcprport` in the application's `appconfig.json`; `sbin/getapp.pl` does not copy it from
  `etc/config.json` (`test-appconfig.php` does this for the test image).
- **Legacy driver options.** The adapter ignores `"j" => true` (journaled write, set by the `mongojournal`
  directive); MongoDB still journals within its commit interval. It also connects lazily, so an unreachable
  MongoDB shows up at the first query, not in `new MongoClient()`.
- **`mongo:cafile`** passes an SSL stream context, which ext-mongodb 1.x still maps to `tlsCAFile` (deprecated).
- **Logs.** With Ubuntu's production `php.ini` (`E_ALL & ~E_DEPRECATED & ~E_STRICT`) the deprecations raised
  inside the vendored libraries are not logged. With every level logged, the adapter's use of
  `MongoDB\Driver\ReadPreference` and Ratchet's dynamic properties account for nearly all of them.
