use strict;
use warnings;

use File::Spec;
use File::Temp qw(tempfile);
use FindBin;
use JSON::PP qw(decode_json);
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, '..', 'lib' );
use GenAppTest qw(repo_root);

my $python = find_executable('python3');
plan skip_all => 'python3 is not available on PATH' if !$python;

my $root = repo_root( File::Spec->catdir( $FindBin::Bin, '..' ) );
my $helper = File::Spec->catfile(
    $root, qw(languages html5 add py genapp3.py) );
my ( $fh, $script ) = tempfile(
    'genapp-python-transport-XXXX', SUFFIX => '.py', TMPDIR => 1, UNLINK => 1 );

my $quoted_helper = python_string($helper);
print {$fh} <<"PYTHON";
import importlib.util
import json

spec = importlib.util.spec_from_file_location("genapp3_transport_test", $quoted_helper)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class FakeSocket:
    def __init__(self):
        self.connected = None
        self.sent = []
        self.closed = False

    def connect(self, address):
        self.connected = address

    def send(self, _data):
        raise AssertionError("partial-write socket.send() must not be used")

    def sendall(self, data):
        self.sent.append(data)

    def recv(self, _size):
        return b'{"answer": "ok"}'

    def close(self):
        self.closed = True


sockets = []


def socket_factory(*_args, **_kwargs):
    value = FakeSocket()
    sockets.append(value)
    return value


module.socket.socket = socket_factory
module.time.sleep = lambda _seconds: None
client = module.genapp({
    "_uuid": "large-run",
    "_tcphost": "127.0.0.1",
    "_tcpport": 12345,
    "_tcprport": 12346,
})
large_value = "x" * 200000

message_result = client.tcpmessage({"blob": large_value})
messagebox_result = client.tcpmessagebox({"text": large_value})
question_result = client.tcpquestion({"blob": large_value})

decoded_message = json.loads(sockets[0].sent[0].decode("utf-8"))
decoded_messagebox = json.loads(sockets[1].sent[0].decode("utf-8"))
decoded_question = json.loads(sockets[2].sent[0].decode("utf-8"))

print(json.dumps({
    "socketCount": len(sockets),
    "allClosed": all(value.closed for value in sockets),
    "allUsedSendall": all(len(value.sent) == 1 for value in sockets),
    "messageBytes": len(sockets[0].sent[0]),
    "messagePayload": len(decoded_message["blob"]),
    "messageUuid": decoded_message["_uuid"],
    "messageStatus": message_result["status"],
    "messageboxPayload": len(decoded_messagebox["_message"]["text"]),
    "messageboxStatus": messagebox_result["status"],
    "questionPayload": len(decoded_question["_question"]["blob"]),
    "questionReply": question_result["answer"],
}))
PYTHON
close $fh;

local $ENV{PYTHONDONTWRITEBYTECODE} = 1;
my $output = `$python "$script" 2>&1`;
is( $? >> 8, 0, 'Python transport helper executes with sendall-only socket' )
    or diag($output);
my $data = eval { decode_json($output) };
ok( $data, 'Python transport helper returns contract results' )
    or diag($@ || $output);

if ($data) {
    is( $data->{socketCount}, 3, 'message, message-box, and question use TCP sockets' );
    ok( $data->{allClosed}, 'all TCP helpers close their sockets' );
    ok( $data->{allUsedSendall}, 'all TCP helpers use complete-write sendall semantics' );
    cmp_ok( $data->{messageBytes}, '>', 65507, 'large message exceeds the UDP datagram ceiling' );
    is( $data->{messagePayload}, 200000, 'large message payload is complete' );
    is( $data->{messageUuid}, 'large-run', 'message preserves the run UUID' );
    is( $data->{messageStatus}, 'ok', 'message reports success' );
    is( $data->{messageboxPayload}, 200000, 'large message-box payload is complete' );
    is( $data->{messageboxStatus}, 'ok', 'message-box reports success' );
    is( $data->{questionPayload}, 200000, 'large question payload is complete' );
    is( $data->{questionReply}, 'ok', 'question response remains compatible' );
}

done_testing();

sub python_string {
    my ($value) = @_;
    $value =~ s/\\/\\\\/g;
    $value =~ s/'/\\'/g;
    return "'$value'";
}

sub find_executable {
    my ($name) = @_;
    for my $dir ( split /:/, $ENV{PATH} || q{} ) {
        my $path = File::Spec->catfile( $dir, $name );
        return $path if -x $path;
    }
    return;
}
