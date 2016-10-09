# Express Response Times Example

In this example we'll create a server which has an index page that prints out "hello world", and a page `http://localhost:3000/times` which prints out the last ten response times that InfluxDB gave us.

The end result should look something like this:

```js
➜  ~ curl -s localhost:3000
Hello world!
➜  ~ curl -s localhost:3000/times | jq
[
  {
    "time": "2016-10-09T19:13:26.815Z",
    "duration": 205,
    "host": "ares.peet.io",
    "path": "/"
  }
]
```
