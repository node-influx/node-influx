
var Influx = require('../');

var username = 'root';
var password = 'root';
var database = 'example_app_db';

var client = new Influx('localhost', 8086, username, password, database);

client.getDatabaseNames(function(err, dbs) {
  if(err) {
    throw err;
  }
  console.log('Deleting Databases: ' + dbs.join(', '));
  for (var i = dbs.length - 1; i >= 0; i--) {
    client.deleteDatabase(dbs[i], function(err) {
      if(err) {
        throw err;
      }
      console.log('Deleted Database: ' + dbs[i]);
    });
  }
});
