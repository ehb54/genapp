package main

import (
	"github.com/fredli74/lockfile"
	zmq "github.com/pebbe/zmq__zmqversion__"
	"encoding/json"
	"net"
	"io"
	"os"
	"bufio"
	"fmt"
	"io/ioutil"
	"time"
	"sync"
	"strconv"
        __~debug:tcp{"reflect"}
)

var appconfig = "/home/ehb/genapptest_svn/appconfig.json"

var timeout time.Duration = 60 * time.Second // in seconds, maybe set override in request

var messaging map[string]interface{}
var zmqlisten string
var tcplisten string
var tcprlisten string
var rchanmap map[uint64] chan []byte
var mutex = &sync.Mutex{} // synchronize access to rchanmap
var lockdir string = "/var/run/genapp"
var tcplockfile string

func main() {

	if len(os.Args) > 1 {
		appconfig = os.Args[1]
	} else {
		fmt.Println( "appconfig used:" + appconfig )
	}

	getappconfig() // make sure we have a good appconfig

	if lock, err := lockfile.Lock(tcplockfile); err != nil {
		panic(err)
	} else {
		defer lock.Unlock()
	}

	fmt.Printf( "default timeout:%v\n", timeout )

	rchanmap = make(map[uint64] chan []byte)

	// listen
	server, err := net.Listen("tcp", tcplisten )
	if server == nil {
		panic("couldn't start listening: " + tcplisten + ":" + err.Error())
	}
	fmt.Println( "msg-tcpserver started listening on " + tcplisten );

	rserver, rerr := net.Listen("tcp", tcprlisten )
	if rserver == nil {
		panic("couldn't start listening: " + tcprlisten + ":" + rerr.Error())
	}
	fmt.Println( "msg-tcpserver started response listening on " + tcprlisten );

	conns, connsid := clientConns(server) // probably need 2 channels, one for net.Conn, 2nd for int64 - id
	rconns, rconnsid := clientConns(rserver)

	for {
		select {
		case msg1 := <-conns:
			id := <-connsid
			go handleConn( msg1, id )
		case msg2 := <-rconns:
			_ = <-rconnsid // ignored
			go handleRconn( msg2 ) // receives response, will check rchanmap for valid id received in response
		}
	}
}

func getappconfig() {
	dat, err := ioutil.ReadFile( appconfig );

	if err != nil {
		panic( "error: reading "  + appconfig + " : " + err.Error())
	}

	var jdata map[string]interface{}
	err = json.Unmarshal(dat, &jdata)

	if _, ok := jdata["messaging"]; ok {
		// v := jdata["messaging"]
		// to uncomment these debugging statements, import "reflect" above
		// fmt.Printf("  value:%v  kind:%s  type:%s\n", v, reflect.TypeOf(v).Kind(), reflect.TypeOf(v))
		messaging = jdata["messaging"].(map[string]interface{})
		if _, ok := messaging["tcpport"]; !ok {
			panic( "error: in "  + appconfig + " : no messaging:tcpport defined" );
		}
		// fmt.Printf( "tcpport: %v\n", messaging["tcpport"] )
		if _, ok := messaging["tcphostip"]; !ok {
			panic( "error: in "  + appconfig + " : no messaging:tcphostip defined" );
		}
		if _, ok := messaging["zmqhostip"]; !ok {
			panic( "error: in "  + appconfig + " : no messaging:zmqhostip defined" );
		}
		if _, ok := messaging["zmqport"]; !ok {
			panic( "error: in "  + appconfig + " : no messaging:zmqport defined" );
		}
		if _, ok := messaging["tcprport"]; !ok {
			panic( "error: in "  + appconfig + " : no messaging:tcprport defined" );
		}
		if _, ok := messaging["tcptimeout"]; ok {
			if _, ok := messaging["tcptimeout"].(float64); ok {
				timeout = time.Duration(messaging["tcptimeout"].(float64)) * time.Second
			}
		}
	} else {
		panic( "error: in "  + appconfig + " : no messaging defined" );
	}
	if _, ok := jdata["lockdir"]; ok {
		lockdir = jdata["lockdir"].(string)
	}
	tcplockfile = lockdir + "/msg-tcp-" + fmt.Sprint( messaging["zmqport"] ) + ".lock"
	tcplisten = fmt.Sprint( messaging["tcphostip"] ) + ":" + fmt.Sprint( messaging["tcpport"] )
	tcprlisten = fmt.Sprint( messaging["tcphostip"] ) + ":" + fmt.Sprint( messaging["tcprport"] )
	zmqlisten = "tcp://" + fmt.Sprint( messaging["zmqhostip"] ) + ":" + fmt.Sprint( messaging["zmqport"] )
}

func clientConns(listener net.Listener) ( chan net.Conn, chan uint64 ) {
	ch := make(chan net.Conn)
	chi := make(chan uint64)
	var i uint64 = 0
	go func() {
		for {
			client, err := listener.Accept()
			if client == nil {
				fmt.Printf("couldn't accept: " + err.Error())
				continue
			}
			i++
			__~debug:tcp{fmt.Printf("%d: %v <-> %v\n", i, client.LocalAddr(), client.RemoteAddr())}
			ch <- client
			chi <- i
		}
	}()
	return ch, chi
}

func handleConn(client net.Conn, id uint64) {
	__~debug:tcp{fmt.Println( "handleConn" )}
	b := bufio.NewReader(client)

	defer client.Close();

	// open zmqclient to forward message
	zmqclient, err := zmq.NewSocket(zmq.PUSH)
	if err != nil { // EOF, or worse
		rmap := map[string]string{"error":"zmq socket open error:" + err.Error()}
		rmapj, _ := json.Marshal( rmap )
		client.Write( rmapj )
		return
	}

	defer zmqclient.Close()

	zmqclient.Connect( zmqlisten )

        line, err := b.ReadBytes('\n')
	is_closed := false
        if err != nil { // EOF, or worse
		if err == io.EOF {
			__~debug:tcp{fmt.Printf("eof: %v <-> %v\n", client.LocalAddr(), client.RemoteAddr())}
			is_closed = true
		} else {
			__~debug:tcp{fmt.Printf("read client error: %v <-> %v %v\n", client.LocalAddr(), client.RemoteAddr(), err.Error())}
		}
		if len(line) < 2 {
			return
		}
        }
	// do we have good json?

	var jdata map[string]interface{}
	err = json.Unmarshal(line, &jdata)
	if err != nil {
		// send error json back and exit
		rmap := map[string]string{"error":"invalid json : " + err.Error()}
		rmapj, _ := json.Marshal( rmap )
		client.Write( rmapj )
		__~debug:tcp{fmt.Printf("invalid json: %v <-> %v\n", client.LocalAddr(), client.RemoteAddr())}
		__~debug:tcp{fmt.Printf("closed: %v <-> %v\n", client.LocalAddr(), client.RemoteAddr())}
		return;
	}

	if _, ok := jdata["_uuid"]; !ok {
		// send error json back and exit
		rmap := map[string]string{"error":"json missing _uuid"}
		rmapj, _ := json.Marshal( rmap )
		client.Write( rmapj )
		__~debug:tcp{fmt.Printf("no uuid in json: %v <-> %v\n", client.LocalAddr(), client.RemoteAddr())}
		__~debug:tcp{fmt.Printf("closed: %v <-> %v\n", client.LocalAddr(), client.RemoteAddr())}
		return;
	}

	if _, ok := jdata["_question"]; !ok {
		// not a question, so just pass it along
		zmqclient.SendMessage( line );
		rmap := map[string]string{"ok":"message forwarded to client"}
		rmapj, _ := json.Marshal( rmap )
		client.Write( rmapj )
		__~debug:tcp{fmt.Printf("response len %d: %v <-> %v\n", len(line), client.LocalAddr(), client.RemoteAddr())}
		__~debug:tcp{fmt.Printf("closed: %v <-> %v\n", client.LocalAddr(), client.RemoteAddr())}
		return;
	}

	// add _msgid to json data for channel retrieval
	jdata["_msgid"] = id;
	if line, err = json.Marshal( jdata ); err != nil {
		rmap := map[string]string{"error":"internal error : " + err.Error()}
		rmapj, _ := json.Marshal( rmap )
		client.Write( rmapj )
		__~debug:tcp{fmt.Println("json marhsal error:" + err.Error() )}
		__~debug:tcp{fmt.Printf("closed: %v <-> %v\n", client.LocalAddr(), client.RemoteAddr())}
		return;
	}

	if is_closed {
		__~debug:tcp{fmt.Printf("closed: %v <-> %v\n", client.LocalAddr(), client.RemoteAddr())}
		return
	}

	use_timeout := timeout;

	if _, ok := jdata["timeout"]; ok {
		if _, ok := jdata["timeout"].(float64); ok {
			use_timeout = time.Duration(jdata["timeout"].(float64)) * time.Second
		} else if _, ok := jdata["timeout"].(string); ok {
			msgidret, err := strconv.ParseUint(jdata["timeout"].(string), 10, 64 );
			if err != nil {
				rmap := map[string]string{"error":"_question:timeout specified but could not be converted to a time: " + err.Error()}
				rmapj, _ := json.Marshal( rmap )
				client.Write( rmapj )
				fmt.Println("json marhsal error:" + err.Error() )
				fmt.Printf("closed: %v <-> %v\n", client.LocalAddr(), client.RemoteAddr())
				return;
			}
			use_timeout = time.Duration(msgidret) * time.Second
		}
	}

	// all ok, forward question

	rchanmap[id] = make(chan []byte)
        zmqclient.SendMessage(line)

	// wait for response

	select {
	case res := <-rchanmap[id]:
		delete(rchanmap, id)
		client.Write(res)
		ackmap := map[string]string{"_uuid":jdata["_uuid"].(string),"_msgid":strconv.FormatUint( id, 10 ),"_question_answered":""}
		ackmapj, _ := json.Marshal( ackmap )
		zmqclient.SendMessage( ackmapj )
		__~debug:tcp{fmt.Printf("response len %d: %v <-> %v\n", len(res), client.LocalAddr(), client.RemoteAddr())}
	case <-time.After(use_timeout): // maybe set override in request
		mutex.Lock() // handle possible race condition: timeout happens in race with response received
		if len( rchanmap[ id ] ) > 0 {
			mutex.Unlock()
			res := <-rchanmap[id]
			delete(rchanmap, id)
			client.Write(res)
			ackmap := map[string]string{"_uuid":jdata["_uuid"].(string),"_msgid":strconv.FormatUint( id, 10 ),"_question_answered":""}
			ackmapj, _ := json.Marshal( ackmap )
			zmqclient.SendMessage( ackmapj )
			__~debug:tcp{fmt.Printf("response len %d: %v <-> %v\n", len(res), client.LocalAddr(), client.RemoteAddr())}
			return
		}
		delete(rchanmap, id)
		mutex.Unlock()
		rmap := map[string]string{"error":"timeout"}
		rmapj, _ := json.Marshal( rmap )
		client.Write( rmapj )
		ackmap := map[string]string{"_uuid":jdata["_uuid"].(string),"_msgid":strconv.FormatUint( id, 10 ),"_question_timeout":""}
		ackmapj, _ := json.Marshal( ackmap )
		zmqclient.SendMessage( ackmapj )
	}

	__~debug:tcp{fmt.Printf("closed: %v <-> %v\n", client.LocalAddr(), client.RemoteAddr())}
}

func handleRconn(client net.Conn) {
	__~debug:tcp{fmt.Println( "handleRconn" )}
	b := bufio.NewReader(client)

	defer client.Close();

	// just once
	// for {

        line, err := b.ReadBytes('\n')
        if err != nil { // EOF, or worse
		if err == io.EOF {
			__~debug:tcp{fmt.Printf("eof on tcpr: %v <-> %v\n", client.LocalAddr(), client.RemoteAddr())}
		} else {
			__~debug:tcp{fmt.Printf("read client error on tcpr: %v <-> %v %v\n", client.LocalAddr(), client.RemoteAddr(), err.Error())}
		}
		if len(line) < 2 {
			return
		}
        }
        __~debug:tcp{fmt.Println("tcprserver received" + string(line))}
	// check message, if ok, channel response to rchanmap[_msgid] for tcp response

	var jdata map[string]interface{}
	err = json.Unmarshal(line, &jdata)
	if err != nil {
		// send error json back and exit
		rmap := map[string]string{"error":"invalid json : " + err.Error()}
		rmapj, _ := json.Marshal( rmap )
		client.Write( rmapj )
		__~debug:tcp{fmt.Printf("tcpr: invalid json: %v <-> %v\n", client.LocalAddr(), client.RemoteAddr())}
		__~debug:tcp{fmt.Printf("closed tcpr: %v <-> %v\n", client.LocalAddr(), client.RemoteAddr())}
		return;
	}

	if _, ok := jdata["_uuid"]; !ok {
		// send error json back and exit
		rmap := map[string]string{"error":"json missing _uuid"}
		rmapj, _ := json.Marshal( rmap )
		client.Write( rmapj )
		__~debug:tcp{fmt.Printf("tcpr: no _uuid in json: %v <-> %v\n", client.LocalAddr(), client.RemoteAddr())}
		__~debug:tcp{fmt.Printf("closed tcpr: %v <-> %v\n", client.LocalAddr(), client.RemoteAddr())}
		return;
	}
	
	if _, ok := jdata["_response"]; !ok {
		// send error json back and exit
		rmap := map[string]string{"error":"json missing _response"}
		rmapj, _ := json.Marshal( rmap )
		client.Write( rmapj )
		__~debug:tcp{fmt.Printf("tcpr: no _response in json: %v <-> %v\n", client.LocalAddr(), client.RemoteAddr())}
		__~debug:tcp{fmt.Printf("closed tcpr: %v <-> %v\n", client.LocalAddr(), client.RemoteAddr())}
		return;
	}
	
	if _, ok := jdata["_msgid"]; !ok {
		// send error json back and exit
		rmap := map[string]string{"error":"json missing _msgid"}
		rmapj, _ := json.Marshal( rmap )
		client.Write( rmapj )
		__~debug:tcp{fmt.Printf("tcpr: no _msgid in json: %v <-> %v\n", client.LocalAddr(), client.RemoteAddr())}
		__~debug:tcp{fmt.Printf("closed tcpr: %v <-> %v\n", client.LocalAddr(), client.RemoteAddr())}
		return;
	}

	var msgid uint64;

	if _, ok := jdata["_msgid"].(float64); ok {
		msgid = uint64(jdata["_msgid"].(float64));
	} else if _, ok := jdata["_msgid"].(string); ok {
		msgidret, err := strconv.ParseUint(jdata["_msgid"].(string), 10, 64 );
		if err != nil {
			// send error json back and exit
			rmap := map[string]string{"error":"json _msgid not numeric, error converting string"}
			rmapj, _ := json.Marshal( rmap )
			client.Write( rmapj )
			__~debug:tcp{fmt.Println(err.Error())}
			__~debug:tcp{fmt.Printf("tcpr: _msgid not numeric 1: %v <-> %v\n", client.LocalAddr(), client.RemoteAddr())}
			__~debug:tcp{fmt.Printf("closed tcpr: %v <-> %v\n", client.LocalAddr(), client.RemoteAddr())}
			return;
		}
		msgid = msgidret
	} else {
		__~debug:tcp{fmt.Printf(" type of _msgid  kind:%s  type:%s\n", reflect.TypeOf(jdata["_msgid"]).Kind(), reflect.TypeOf( jdata["_msgid"]))}
		// send error json back and exit
		rmap := map[string]string{"error":"json _msgid not numeric"}
		rmapj, _ := json.Marshal( rmap )
		client.Write( rmapj )
		__~debug:tcp{fmt.Printf("tcpr: _msgid not numeric 2: %v <-> %v\n", client.LocalAddr(), client.RemoteAddr())}
		__~debug:tcp{fmt.Printf("closed tcpr: %v <-> %v\n", client.LocalAddr(), client.RemoteAddr())}
		return;
	}

	mutex.Lock() // handle possible race condition: timeout happens in race with response received
	if _, ok := rchanmap[ msgid ]; !ok {
		mutex.Unlock();
		// send error json back and exit
		rmap := map[string]string{"error":"tcp receiver closed, likely due to timeout"}
		rmapj, _ := json.Marshal( rmap )
		client.Write( rmapj )
		__~debug:tcp{fmt.Printf("tcpr: no uuid in json: %v <-> %v\n", client.LocalAddr(), client.RemoteAddr())}
		__~debug:tcp{fmt.Printf("closed tcpr: %v <-> %v\n", client.LocalAddr(), client.RemoteAddr())}
		return;
	}
		
	rchanmap[ msgid ] <- line
	mutex.Unlock();

	__~debug:tcp{fmt.Printf("closed tcpr: %v <-> %v\n", client.LocalAddr(), client.RemoteAddr())}
}
