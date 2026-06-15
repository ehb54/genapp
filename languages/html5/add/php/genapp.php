<?php
{};

class GenApp {
    private $input;
    private $output;
    
    public $cache_obj;

    function __construct( $input, $output ) {
        $this->input  = $input;
        $this->output = $output;
        $this->cache_obj = (object) [];
    }

    function tcpmessagebox( $message ) {
        $result = (object)[];
        $msg    = (object)[];
        $msg->_uuid   = $this->input->_uuid;

        if ( is_string( $message ) ) {
            $msg->_message = json_decode( $message );
        } else if ( is_object( $message ) ) {
            $msg->_message = $message;
        } else if ( is_array( $message ) ) {
            $msg->_message = (object)$message;
        } else {
            $result->error = 'message must be a json string, array or object';
            return $result;
        }

        $msgj = utf8_encode( json_encode( $msg ) );
        # udpmessage( [ "_textarea" => "message:\n" . json_encode( json_decode( $msgj ), JSON_PRETTY_PRINT ) ] );

        # $this->output->_textarea = "tcpmessagebox message:\n" . json_encode( json_decode( $msgj ), JSON_PRETTY_PRINT ) . "\n";

        # open socket
        if ( !($socket = socket_create( AF_INET, SOCK_STREAM, SOL_TCP ) ) ) {
            $result->error = 'socket create error : ' . socket_strerror( socket_last_error() );
            return $result;
        }
        if ( !socket_connect( $socket, $this->input->_tcphost, intval( $this->input->_tcpport ) ) ) {
            $result->error = 'socket connect error : ' . socket_strerror( socket_last_error() );
            return $result;
        }

        # send message

        if ( strlen( $msgj ) != ( $bytes_sent = socket_write( $socket, $msgj, strlen( $msgj ) ) ) ) {
            $result->error = "socket send error bytes sent : $bytes_sent : " . socket_strerror( socket_last_error() );
            return $result;
        }
        socket_close( $socket );
        return "ok";
    }

    function tcpmessage( $message ) {
        $result = (object)[];
        $msg    = (object)[];

        if ( is_string( $message ) ) {
            $msg = json_decode( $message );
        } else if ( is_object( $message ) ) {
            $msg = $message;
        } else if ( is_array( $message ) ) {
            $msg = (object)$message;
        } else {
            $result->error = 'message must be a json string, array or object';
            return $result;
        }

        foreach ( $msg as $k => $v ) {
            if ( $k == '_textarea' ) {
                if ( isset( $this->cache_obj->$k ) ) {
                    $this->cache_obj->$k .= $v;
                } else {
                    $this->cache_obj->$k = $v;
                }
            } else {
                $this->cache_obj->$k = $v;
            }
        }

        $msg->_uuid   = $this->input->_uuid;

        $msgj = utf8_encode( json_encode( $msg ) );

        # open socket
        if ( !($socket = socket_create( AF_INET, SOCK_STREAM, SOL_TCP ) ) ) {
            $result->input = json_encode( $this->input );
            $result->error = 'socket create error : ' . socket_strerror( socket_last_error() );
            return $result;
        }
        if ( !socket_connect( $socket, $this->input->_tcphost, intval( $this->input->_tcpport ) ) ) {
            $result->input = json_encode( $this->input );
            $result->error = 'socket connect error : ' . socket_strerror( socket_last_error() );
            return $result;
        }

        # send message

        if ( strlen( $msgj ) != ( $bytes_sent = socket_write( $socket, $msgj, strlen( $msgj ) ) ) ) {
            $result->error = "socket send error bytes sent : $bytes_sent : " . socket_strerror( socket_last_error() );
            return $result;
        }
        socket_close( $socket );
        usleep( 0.5 * 1000 ); ## 500 ms
        return "ok";
    }

    function udpmessagebox( $message ) {
        $result = (object)[];
        $msg    = (object)[];
        $msg->_uuid   = $this->input->_uuid;

        if ( is_string( $message ) ) {
            $msg->_message = json_decode( $message );
        } else if ( is_object( $message ) ) {
            $msg->_message = $message;
        } else if ( is_array( $message ) ) {
            $msg->_message = (object)$message;
        } else {
            $result->error = 'message must be a json string, array or object';
            return $result;
        }

        $msgj = utf8_encode( json_encode( $msg ) );

        # $this->output->_textarea = "udp message:\n" . json_encode( json_decode( $msgj ), JSON_PRETTY_PRINT );

        # open socket
        $socket = socket_create( AF_INET, SOCK_DGRAM, 0 );

        # send message

        socket_sendto( $socket, $msgj, strlen( $msgj ), 0, $this->input->_udphost, intval( $this->input->_udpport ) );

        return "ok";
    }

    function udpmessage( $message ) {
        $result = (object)[];
        $msg    = (object)[];
        $msg->_uuid   = $this->input->_uuid;

        if ( is_string( $message ) ) {
            $msg = json_decode( $message );
        } else if ( is_object( $message ) ) {
            $msg = $message;
        } else if ( is_array( $message ) ) {
            $msg = (object)$message;
        } else {
            $result->error = 'message must be a json string, array or object';
            return $result;
        }

        foreach ( $msg as $k => $v ) {
            if ( $k == '_textarea' ) {
                if ( isset( $this->cache_obj->$k ) ) {
                    $this->cache_obj->$k .= $v;
                } else {
                    $this->cache_obj->$k = $v;
                }
            } else {
                $this->cache_obj->$k = $v;
            }
        }

        $msg->_uuid   = $this->input->_uuid;

        $msgj = utf8_encode( json_encode( $msg ) );

        # $this->output->_textarea = "udp message:\n" . json_encode( json_decode( $msgj ), JSON_PRETTY_PRINT );

        # open socket
        $socket = socket_create( AF_INET, SOCK_DGRAM, 0 );

        # send message

        socket_sendto( $socket, $msgj, strlen( $msgj ), 0, $this->input->_udphost, intval( $this->input->_udpport ) );

        return "ok";
    }

    function tcpquestion( $question, $timeout = 300, $buffersize = 65536 ) {
        $result = (object)[];
        $msg    = (object)[];
        $msg->_uuid   = $this->input->_uuid;
        # genapptest's appconfig has a default timeout
        # $msg->timeout = $timeout;

        if ( is_string( $question ) ) {
            $msg->_question = json_decode( $question );
        } else if ( is_object( $question ) ) {
            $msg->_question = $question;
        } else if ( is_array( $question ) ) {
            $msg->_question = (object)$question;
        } else {
            $result->error = 'question must be a json string, array or object';
            return $result;
        }
        
        $msgj = utf8_encode( json_encode( $msg ) );
        # a newline is also required when sending a question
        $msgj .= "\n";
        
        # $this->output->_textarea = "question:\n" . json_encode( json_decode( $msgj ), JSON_PRETTY_PRINT ) . "\n";

        # connect
        if ( !($socket = socket_create( AF_INET, SOCK_STREAM, SOL_TCP ) ) ) {
            $result->error = 'socket create error : ' . socket_strerror( socket_last_error() );
            return $result;
        }
        if ( !socket_connect( $socket, $this->input->_tcphost, intval( $this->input->_tcpport ) ) ) {
            $result->error = 'socket connect error : ' . socket_strerror( socket_last_error() );
            return $result;
        }

        # send question

        if ( strlen( $msgj ) != ( $bytes_sent = socket_write( $socket, $msgj, strlen( $msgj ) ) ) ) {
            $result->error = "socket send error bytes sent = $bytes_sent : " . socket_strerror( socket_last_error() );
            return $result;
        }

        # receive answer

        $data = socket_read( $socket, $buffersize );

        # $this->output->_textarea .= "question response:\n" . json_encode( json_decode( $data ), JSON_PRETTY_PRINT ) . "\n";

        socket_close( $socket );
        return $data;
    }

    function run_cmd( $cmd, $die_if_exit = true, $array_result = false ) {
        global $debug;
        if ( isset( $debug ) && $debug ) {
            echo "$cmd\n";
        }
        exec( "$cmd 2>&1", $res, $res_code );
        if ( $die_if_exit && $res_code ) {
            $this->error_exit( "shell command '$cmd' returned result:\n" . implode( "\n", $res ) . "\nand with exit status '$res_code'" );
        }
        if ( !$array_result ) {
            return implode( "\n", $res ) . "\n";
        }
        return $res;
    }

    function error_exit( $msg ) {
        echo "{\"error\":\"$msg\"}";
        exit;
    }
}
