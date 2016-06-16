'use strict'
var influx = require('./')
var async = require('async')

var client = influx({
  // or single-host configuration
  host : 'localhost',
  port : 8086, // optional, default 8086
})

async.waterfall(
  [
    // function(callback){
    //   // create database
    //   client.createDatabase('mqtt_data', function(err, result){
    //     console.log('Something wrong??')
    //     if(err){
    //       return callback('Damn')
    //     }
    //     client = influx({
    //       // or single-host configuration
    //       host : 'localhost',
    //       port : 8086, // optional, default 8086
    //       database: 'mqtt_data'
    //     })
    //
    //     callback(null)
    //   })
    // },
    function(callback){
      // insert data
      var points = [
        //first value with tag
        [{value: 232}, { location: 'HN'}],
        //second value with different tag
        [{value: 212}, { location: 'SG'}],
        //third value, passed as integer. Different tag
        [{value: 848,  time : new Date().getTime() + 100}, { location: 'HN'}],
      ]
      var options = {db: 'mqtt_data'}
      client.writePoints('dbs', points,  options, function(err, result){
        if(err){
          console.log('something wrong when writing points')
        }
        callback(err)
      })
    },
    function(callback){
      var query = "SELECT * FROM dbs where location='HN'";
      console.log('Running...')
      client.query('mqtt_data', query, function(err, results) {
        if(err){
          return callback(err)
        }
        console.log('Data is', results)
      })
    }
  ],
  function(err, result){
    console.log('Final....')
    if(err){
      return console.log('Error', err)
    }
    console.log(result)
  }
)
