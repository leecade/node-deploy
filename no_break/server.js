var util = require('util')
var EventEmitter = require("events").EventEmitter
var responseCatch = new EventEmitter()

var http = require('http')
var server = http.createServer(function(req, res) {
  res.writeHead(200, {
    // 默认为 keep-alive 无法触发 server.close
    // 'Connection':'close'
  })
  setTimeout(function () {
    res.end('Hello World')
    responseCatch.emit('state', 1)
  }, 3000)
})

server.listen(3000, function() {
  console.log('pid: ' + process.pid)
})

;['uncaughtException', 'SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(function(type) {
  process.on(type, function() {
    console.log('Exit type:' + type)

    // check alive connenctions
    server.getConnections(function(err, count) {
      !count && process.exit(0)
    })

    // 停止接收新的连接请求，但不会立即关闭已经建立的连接，而是会等待这些连接自然结束
    // 实际测试等待时间非常长, 因为默认是 keep-alive 的请求
    server.close(function() {
      process.exit(0)
    })

    responseCatch.on('state', function(data) {
      data == 1 && process.exit(0)
    })
    
    setTimeout(function () {
      process.exit(0)
    }, 5000)
  })
})

/*process.on('beforeExit', function () {
　　console.log('beforeExit.')
})

process.on('SIGQUIT', function () {
  console.log(2)
  // 判断是否有正在进行的连接
  if (!server.getConnections()) {
    process.exit(0)
  }

  console.log('等待连接结束')
  server.close(function () {
    console.log('All')
  })
})*/