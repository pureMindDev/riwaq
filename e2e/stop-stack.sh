#!/bin/sh
pkill -f "[m]ock-provider" ; pkill -f "[n]ode server.js" ; pkill -f "[v]ite --port" ; pkill -f "[m]ongod --dbpath" ; pkill -f "[f]ile-engine.js"
true
