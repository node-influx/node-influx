const urlModule = require('url')

module.exports = function () {
  let firstFailed = false

  /**
   * Create a middleware that serves routes starting with /pool. Rounds can:
   *  - be `/ping`
   *  - contain a `failFirst` segment to alternate request failures
   *  - end with a status code, like `/pool/failFirst/204`
   *  - end with `reset` to reset failFirst routes
   *  - end with `echo` to print back what it was requested with
   *  - end with `json` or `badjson` to get valid and
   *    malformed responses, respectively
   */

  return function handle(req, res, next) {
    if (req.url === '/ping') { // special case
      req.url = '/pool/failFirst/ping'
    }

    const url = urlModule.parse(req.url)
    const parts = url.pathname.slice(1).split('/')
    if (parts[0] !== 'pool') {
      // fall through otherwise. In Karma this is a middleware and we'll have
      // a next() function, otherwise send a 404.
      if (typeof next === 'function') {
        return next()
      }

      res.writeHead(404)
      res.end()
      return
    }

    const last = parts[parts.length - 1];
    if (last === 'reset') {
      firstFailed = false
      res.writeHead(204)
      res.end()
      return
    }

    if (parts.includes('failFirst') && !firstFailed) {
      firstFailed = true
      res.writeHead(500)
      res.end()
      return
    }

    switch (last) {
      case 'ping':
        setTimeout(() => {
          if (firstFailed) {
            res.setHeader('X-Influxdb-Version', 'v1.0.0')
            res.writeHead(204)
          } else {
            res.writeHead(502)
          }
          firstFailed = !firstFailed
          res.end()
        }, 1)
        break

      case 'echo':
        let body = ''
        req.setEncoding('utf8')
        req.on('data', str => body += str)
        req.on('end', () => {
          res.end(JSON.stringify({
            method: req.method,
            query: url.query,
            body
          }))
        })
        break

      case 'json':
        res.end(JSON.stringify({ ok: true }))
        break

      case 'badjson':
        res.end('{')
        break

      default:
        const code = Number(last);
        if (Number.isNaN(code)) {
          console.error(`Could not handle path ${req.url}`);
        }

        res.writeHead(code)
        res.end()
        break
    }
  }
}
