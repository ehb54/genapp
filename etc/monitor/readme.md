# monitor.pl

# Summary
provides monitoring to for multiple websites to specified users per site
all info is stored in config.json

you can use the system sendmail or smtp
for smtp leave mail an empty object -  "mail":{}
timing can be adjusted
ccall if available will cc those users of all messages (if you want multiple addresses here, comma separate)

# Install

perl -MCPAN -e 'install \"JSON\";install \"Try::Tiny\";install \"LWP::UserAgent\";install \"MIME::Lite\";install \"MIME::Base64\";install \"LWP::Protocol::https\";

then setup a config.json file listing the required websites and users in the "monitors" object
see config.json.sample for an example

# Running

once config.json is setup, perl monitor.pl
you may wish it to be in etc/init.d/, left as an exercise.

if you kill TERM or INT the process, it will shutdown and send a goodbye message
if you kill HUP, it will attempt reread the config.json ... any json errors will revert to the previous config.json params during the run
