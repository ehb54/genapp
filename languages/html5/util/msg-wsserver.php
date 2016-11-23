#!/usr/local/bin/php
<?php

// todo: monitor connections and on close, remove any associated topic keys
$GLOBALS[ "MAXTEXTAREANOTICE" ] = "The messages are truncated at the top due to large size\n";
$GLOBALS[ "MAXTEXTAREALEN" ] = 512000;
$GLOBALS[ "MAXTEXTAREALEN" ] = __~textarea:maxlen{1}0 ? intval( "__textarea:maxlen__" ) : $GLOBALS[ "MAXTEXTAREALEN" ];
if ( $GLOBALS[ "MAXTEXTAREALEN" ] > 10000000 ) {
   $GLOBALS[ "MAXTEXTAREALEN" ] = 10000000;
}
$GLOBALS[ "MAXTEXTAREATRUNC" ] = -$GLOBALS[ "MAXTEXTAREALEN" ];
$GLOBALS[ "MAXTEXTAREALEN" ] += strlen( $GLOBALS[ "MAXTEXTAREANOTICE" ] );

$json = json_decode( file_get_contents( "__appconfig__" ) );

$lockdir = "/var/run/genapp";
if ( isset( $json->lockdir ) ) {
    $lockdir = $json->lockdir;
}

// check if already running and register pid
define('LOCK_FILE', "$lockdir/msg-ws-" . $json->messaging->zmqport . ".lock");

function tryLock() {
    # If lock file exists, check if stale.  If exists and is not stale, return TRUE
    # Else, create lock file and return FALSE.

    if (@symlink("/proc/" . getmypid(), LOCK_FILE) !== FALSE) # the @ in front of 'symlink' is to suppress the NOTICE you get if the LOCK_FILE exists
        return true;

    # link already exists
    # check if it's stale
    if (is_link(LOCK_FILE) && !is_dir(LOCK_FILE)) {
        unlink(LOCK_FILE);
        # try to lock again
        return tryLock();
    }

    return false;
}

if ( !tryLock() ) {
   die( "Already running.\n" );
}

# remove the lock on exit (Control+C doesn't count as 'exit'?)
register_shutdown_function( 'unlink', LOCK_FILE );

require '../vendor/autoload.php';

use Ratchet\ConnectionInterface;
use Ratchet\Wamp\WampServerInterface;

// connect
try {
     $mongo = new MongoClient();
} catch ( Exception $e ) {
    echo "msg_wsserver: could not connect to mongodb\n";
    exit();
}

__~debug:ws{       echo "msg-wsserver: mongo client open\n";}

$mongocoll = $mongo->msgs->cache;

class Pusher implements WampServerInterface {
    /**
     * A lookup of all the topics clients have subscribed to
     */
    protected $subscribedTopics = array();

    public function onOpen(ConnectionInterface $conn) {
__~debug:ws{       echo "msg-wsserver.php onOpen\n";}
    }
    public function onClose(ConnectionInterface $conn) {
__~debug:ws{       echo "msg-wsserver.php onClose\n";}
    }
    public function onCall(ConnectionInterface $conn, $id, $topic, array $params) {
        // In this application if clients send data it's because the user hacked around in console
__~debug:ws{        echo "msg-wsserver.php onCall\n";}
        $conn->callError($id, $topic, 'You are not allowed to make calls')->close();
    }
    public function onPublish(ConnectionInterface $conn, $topic, $event, array $exclude, array $eligible) {
        // In this application if clients send data it's because the user hacked around in console
__~debug:ws{        echo "msg-wsserver.php onPublish\n";}
        $conn->close();
    }
    public function onError(ConnectionInterface $conn, \Exception $e) {
__~debug:ws{        echo "msg-wsserver.php onError\n";}
    }

// here's where we start

    public function onSubscribe(ConnectionInterface $conn, $topic) {
        // When a visitor subscribes to a topic link the Topic object in a  lookup array
__~debug:ws{        echo "msg-wsserver.php received topic id:" . $topic->getId() . "\n";}
__~debug:ws{        echo "onSubscribe: topic getId " . $topic->getId() . "\n";}
        if ( substr( $topic->getId(), 0, 6 ) == 'unsub:' )
        { 
           $tmp = substr( $topic->getId(), 6 );
__~debug:ws{           echo "as unsub $tmp\n";}
           unset( $this->subscribedTopics[ $tmp ] );
        } else {
//           global $mongocoll;
//           if ( $doc = $mongocoll->findOne( array( "_id" => $topic->getID() ) ) )
//           {
//__~debug:ws{    echo "found topic mongo doc\n";}
//               $conn->send( $doc[ 'data' ] );
//__~debug:ws{    echo "mongo json decode sent to connection\n";}
//           } else {
//__~debug:ws{    echo "NOT found topic mongo doc " . $topic->getId() . "\n";}
//           }

           if (!array_key_exists($topic->getId(), $this->subscribedTopics)) {
              $this->subscribedTopics[$topic->getId()] = $topic;
           }
        }
    }

    public function onUnSubscribe(ConnectionInterface $conn, $submsg) {
__~debug:ws{       echo "msg-wsserver.php onUnSubscribe $submsg\n";}
      if (array_key_exists((string) $submsg, $this->subscribedTopics)) {
__~debug:ws{         echo "unsub: array key exists\n";}
         unset( $this->subscribedTopics[ (string) $submsg ] );
      } else {
__~debug:ws{         echo "unsub: array key does NOT exists\n";}
      }
__~debug:ws{        print_r( array_keys( $this->subscribedTopics ) );}
__~debug:ws{        echo "\n---\n";}
    }

    /**
     * @param string JSON'ified string we'll receive from ZeroMQ
     */
    public function onMsgPost($postmsg) {
        global $mongocoll;
        global $mongo;
        $postData = json_decode($postmsg, true);

        if ( !isset( $postData[ '_uuid'  ] ) ) {
            echo "Error: no _uuid received : $postmsg\n";
            return;
        }

__~debug:ws{        echo "msg-wsserver.php received postmsg, postData\n";}
__~debug:ws{        print_r( $postmsg );}
__~debug:ws{        echo "\n---\n";}
__~debug:ws{        print_r( $postData );}
__~debug:ws{        echo "\n---\n";}
__~debug:ws{        echo "postData[_uuid] = " . $postData[ '_uuid' ] . "\n";}
        

        if ( isset( $postData[ '_pid'   ] ) &&
             isset( $postData[ '_app'   ] ) &&
             isset( $postData[ '_where' ] ) &&
             isset( $postData[ '_what'  ] ) ) {
            __~debug:pid{echo "postData[_uuid] = " . $postData[ '_uuid' ] . " found _pid msg\n";}
            try {
                $mongo->{ $postData[ '_app' ] }->running->update( 
                    array( "_id" => $postData[ '_uuid' ] ),
                    array( 
                        '$push' => array( "pid" => 
                                          array( "where" => $postData[ '_where' ],
                                                 "pid"   => $postData[ '_pid'   ],
                                                 "what"  => $postData[ '_what'  ] ) )
                    ),
                    array( "upsert" => true__~mongojournal{, "j" => true} )  
                    );
                
            } catch( MongoCursorException $e ) {
                __~debug:pid{echo "postData[_uuid] = " . $postData[ '_uuid' ] . " mongo failed\n";}
            }
            return;
        }

        // ignore if cancelled

        if ( $mongo->msgs->cancel->findOne( array( "_id" => $postData[ '_uuid' ] ) ) ) {
            __~debug:cancel{echo "new message skipped due to cancel " . $postData[ '_uuid' ] . "\n";}
            return;
        }

        if ( isset( $postData[ "_cancel" ] ) ) {
            __~debug:cancel{echo "cancel set for " . $postData[ '_uuid' ] . "\n";}
            try {
                $mongo->msgs->cancel->insert( array( "_id" => $postData[ '_uuid' ] )__~mongojournal{, array("j" => true )} );
            } catch ( MongoException $e ) {
                echo "Error: Could not insert to msgs->cancel for " . $postData[ '_uuid' ] . " " . $e->getMessage();
            }
        }            

        // re-send the data to all the clients subscribed to that category
__~debug:ws{        echo "onMsgPost broadcast()\n";}
__~debug:ws{        echo "mongo save() $postmsg\n";}

        if ( $doc = $mongocoll->findOne( array( "_id" => $postData[ '_uuid' ] ) ) ) {
            $textprepend = "";
            $textcurrent = isset( $postData[ '_textarea' ] ) ? $postData[ '_textarea' ] : "";
            if ( isset( $doc[ 'data' ] ) ) {
                $docjson = json_decode( $doc[ 'data' ] );
                if ( isset( $docjson->_textarea ) ) {
                    $textprepend = $docjson->_textarea;
                }
            }
            $texttot = $textprepend . $textcurrent;
            $textlen = strlen( $texttot );
            if ( $textlen ) {
                if ( $textlen > $GLOBALS[ "MAXTEXTAREALEN" ] ) {
                    $texttot = $GLOBALS[ "MAXTEXTAREANOTICE" ] . substr( $texttot, $GLOBALS[ "MAXTEXTAREATRUNC" ] );
                }
                $toPostData = $postData;
                $toPostData[ '_textarea' ] = $texttot;
                $postmsg = json_encode( $toPostData );
__~debug:ws{   echo "mongo save() updated $postmsg\n";}
            }
        }

        try {
            $mongocoll->save( array( "_id" => $postData['_uuid'], "data" => $postmsg ) );
        } catch(MongoCursorException $e) {
            echo "mongo save exception $e\n";
        }
        
        if (!array_key_exists( $postData[ '_uuid' ], $this->subscribedTopics ) ) {
__~debug:ws{            echo "no array key exists\n";}
            return;
        }

__~debug:ws{        echo "array key exists\n";}
        $topic = $this->subscribedTopics[$postData['_uuid']];

        $topic->broadcast($postData);
    }
}


$loop   = React\EventLoop\Factory::create();
$pusher = new Pusher;

// Listen for the web server to make a ZeroMQ push after an ajax request
$context = new React\ZMQ\Context($loop);
$pull = $context->getSocket(ZMQ::SOCKET_PULL);
$pull->bind('tcp://' . $json->messaging->zmqhostip . ':' . $json->messaging->zmqport ); // Binding to 127.0.0.1 means the only client that can connect is itself
$pull->on('message', array($pusher, 'onMsgPost'));

// Set up our WebSocket server for clients wanting real-time updates
$webSock = new React\Socket\Server($loop);
$webSock->listen( $json->messaging->wsport, '0.0.0.0'); // Binding to 0.0.0.0 means remotes can connect
$webServer = new Ratchet\Server\IoServer(
    new Ratchet\Http\HttpServer(
        new Ratchet\WebSocket\WsServer(
            new Ratchet\Wamp\WampServer(
                $pusher
            )
        )
    ),
    $webSock
);

echo "msg_wsserver: listening WS port:" . $json->messaging->wsport . " receiving ZMQ port: " . $json->messaging->zmqport . PHP_EOL;

$loop->run();
