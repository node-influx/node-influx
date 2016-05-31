import * as influx from "./"

var username = 'root'
var password = 'root'
var database = 'example_app_db'

var client = influx({host: 'localhost', username: username, password: password, database: database})

client.createDatabase('123', function (err) {
  if (err) throw err
  console.log('Database Created')
})

client.writePoint('response_times', { time: new Date(), value: Math.random() * 100 }, function (err) {
  if (err) throw err
  console.log('Points recorded')
})