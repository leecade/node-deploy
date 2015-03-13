var http = require('http')
var server = http.createServer(function(req, res) {
    setTimeout(function() {
        res.end('2Hello World')
    }, 3000)
})
server.listen(3000)
module.exports = server

