var influx = require('../')

var username = 'root'
var password = 'root'
var database = 'example_app_db'

var client = influx({host: 'localhost', username: username, password: password, database: database})

client.getDatabaseNames(function (err, dbs) {
  if (err) {
    throw err
  }
  console.log('Deleting Databases: ' + dbs.join(', '))

  var callbackGenerator = function (dbName) {
    return function (err) {
      if (err) {
        throw err
      }
      console.log('Deleted Database: ' + dbName)
    }
  }

  for (var i = dbs.length - 1; i >= 0; i--) {
    client.dropDatabase(dbs[i], callbackGenerator(dbs[i]))
  }
})
