var http = require('http')

http.createServer(function(req, res) {
  setTimeout(function () {
    res.end('Hello World')
  }, 10000)
}).listen(3000)