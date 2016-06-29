# GenApp
To run GenApp first follow instructions from http://gw105.iu.xsede.org:8000/genapp/wiki to install GenApp properly
To run GenApp with Airavata change the following lines in appconfig.json

"resources" : {
      "local"              :  ""
      ,"airavata"          : {
          "run" : "airavatarun",
          "properties"   : {
              "server" : "127.0.0.1",
              "port" : 8930,
              "timeout" : 5000,
              "credentialStoreToken" : "2c308fa9-99f8-4baa-92e4-d062e311483c",
              "gateway" : "genAppGateway",
              "gatewayName" : "GenApp_Gateway",
              "login" : "admin",
              "projectAccount" : "somo",
              "email" : "emre@biochem.uthscsa.edu"
            },
            "resources"   : [
              {
                  "host":"HOST NAME",
                  "description":"HOST DESCRIPTION",
                  "executable": "PATH OF EXECUTABLE FILES FOR YOUR APPLICATION"
              }
          ]
      }
  }
  ,"resourcedefault" : "airavata"

You can get the sample details in appconfig.json.template
First you need to register all the modules using register.php in PHP and register.java in Java