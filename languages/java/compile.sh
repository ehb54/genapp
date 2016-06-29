#!/bin/sh

javac -cp ".:lib/simple_json.jar" __application__.java
javac -cp ".:lib/*" airavata/LaunchExperiment.java
javac -cp ".:lib/*" airavata/Register.java