
var influx = require('../');

var username = 'root';
var password = 'root';
var database = 'example_app_db';

var client = influx('localhost', 8086, username, password, database);


client.createDatabase('123', function(err) {
  if(err) throw err;
  console.log('Database Created');
});