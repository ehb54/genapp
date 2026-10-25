# php8designer image

GenApp's `php8designer` branch (php7designer on PHP 8.3) on Ubuntu 24.04, without Ubuntu Pro. Adapted
from `dockerfiles/genappalpha_php8` on the `genappalpha-php8` branch; the Apache hardening and the
genapptest fixture follow `dockerfiles/php7designer`.

## What is in it

| Component | Version | From |
|---|---|---|
| Ubuntu | 24.04 | `ubuntu:24.04` |
| Apache, mod_php | 2.4.58 (prefork), PHP 8.3 | Ubuntu |
| PHP extensions | mongodb 1.21.12; zmq 1.1.3, imagick 3.7.0 | PECL source (SHA-256 checked, built in a stage); Ubuntu |
| MongoDB | 8.0.34: mongod, mongosh, the database tools | MongoDB's noble repository |
| Go | 1.27.3, for `util/msg-tcpserver` | go.dev (SHA-256 checked) |
| Node.js | 24.22.1 LTS, for the nodeapi target, the tests and the UI2 build (corepack's pnpm) | nodejs.org (SHA-256 checked) |
| Python | 2.7.18 (built from source), 3.12 | python.org (SHA-256 checked); Ubuntu |
| Perl | 5.38 with JSON, Hash::Merge, Try::Tiny, LWP, MIME::Lite | Ubuntu |

The PHP libraries are the composer-managed tree in `languages/html5/add/vendor` (see
`languages/html5/composer.json`); the image does not run composer.

Users: `genapp` has a system uid, and its group `genapp` (gid 1001) includes www-data. `mongodb` is uid 100,
group `mongodb` gid 101: the ids that a site's MongoDB data files in its volume belong to.

## Build

    dockerfiles/php8designer/build.sh -t base                       # GenApp and its runtime
    dockerfiles/php8designer/build.sh -t test -a DIR [-u admin]     # plus the test applications

`build.sh` assembles the build context in `dockerfiles/php8designer/ctx` from a git archive of HEAD (`-r ref`
for another one) or from the working tree (`-w`). It leaves out `etc/closure_compiler.jar` and the Java
target's `libthrift-0.9.1.jar`, as `dockerfiles/php7designer` does: the image has no Java.

The test target adds genapptest, the repository's `t/fixtures/apps/minimal_html5` fixture (as in
`dockerfiles/php7designer`), and the svn-era applications demo, tutorial2 and mulch, which the site checks
use. `-a` is a directory with demo, tutorial2 and mulch exported from the GenApp svn repository at r1767
(`export-test-apps.sh` on the genappalpha-php8 branch exports them from a dump of the repository). demo
and mulch are installed from that export (`svn-from-dir` stands in for svn), tutorial2 from the git
repository of applications at `svn-r1767/tutorial2` (getapp.pl's git mode). `-u` names the user that
administers the applications (default testadmin).

This branch's genapp checks applications more strictly than genappalpha's, so the test image changes two of
the svn-era applications:

- demo: its zmq version (as sites set it), and the html5 target only. demo also lists qt4, which has no
  template for the `grid2` type that `sys_job2_manager` uses.
- mulch: a `directives.json.template` made from its `directives.json.ubuntu_localhost`; stand-ins for the
  `files/*_my.html` pages that each site writes and svn never had (genapp now requires every included
  file); and the moduleid of `acknowledgements.json` in lower case, as its file and menu entry have it.
- all three, in `appconfig.json` (`test-appconfig.php`): `messaging.tcplisten` set to `tcphostip`. This
  branch's `util/msg-tcpserver` listens on `tcplisten` and, without it, on a random port, so no job's
  TCP messages arrive.

## Run

    docker run -d --name NAME -p 127.0.0.1:8080:80 php8designer:test

The entry point (`genapp-start`) starts mongod as the mongodb user, the messaging services
(`/etc/init.d/rc.genapp*`) and Apache in the foreground. `docker stop` stops them all (allow
`docker stop -t 60`). `GENAPP_PHP_LOG_ALL=1` logs every PHP error level, deprecations included: Apache's PHP
to `/var/log/apache2/error.log`, command line PHP to `/var/log/php-cli.log`.

## Compared with dockerfiles/php7designer

- Ubuntu 24.04 and PHP 8.3, without Ubuntu Pro (Ubuntu 20.04's packages need Pro's ESM for security updates).
- ext-mongodb 1.21.12 (php7designer: 1.20.1, for PHP 7.4). No uuid extension, php-gd or php-zip: GenApp's
  PHP does not use them; an application that needs one adds it.
- MongoDB 8.0.34 from the noble repository, with the database tools: site migrations restore their
  databases with mongorestore (php7designer leaves the tools out because of their crypto dependency).
- Go and Node.js are checksum-pinned upstream releases (php7designer: a Go build stage, and Ubuntu's node 10
  with node-gyp for the native bcrypt module; the node api uses bcryptjs now).
- Not in this image: sshd, a phpinfo page, composer, Java.
- The genapp user and group have system ids, as in the genappalpha_php8 images (php7designer: 5401).

## Checks

- `t/unit_tests/php8designer_image.t` checks this directory without docker: no Ubuntu Pro, the pinned
  checksums, composer's `ext-mongodb` platform matching the extension built here, Node.js meeting the
  nodeapi and UI2 engines, the Apache hardening, the ids, the test target.
- `prove -r t` in a container of the image, with a git checkout of the repository mounted at `/src/genapp`
  (the image's own tree comes from git archive, without the `.git` that the build-revision tests read). It
  needs no network, except the two UI2 React helper tests, which also need `corepack enable` and
  `pnpm install --frozen-lockfile` in `languages/ui2/react`.
- The applications of the test image: the protocol-level site check, the browser check and the PHP
  compatibility scan of the genappalpha-php8 branch (`dockerfiles/genappalpha_php8` there) run against a
  container of it, built with `-u` set to the administrator name they register. Two changes are
  needed for this branch: its PHP validates the `_window` of every request (a UUID, as the
  pages send, or a UI2 window id), so the protocol-level check makes its window ids with
  `str(uuid.uuid4())`; and the layout engine names the login form's button `sys_login_b_submit_button`
  (`sys_login_submit` before), which the browser check clicks.
