var cluster = require('cluster')

if(cluster.isMaster) {
  console.log('master pid: ' + process.pid)

  // Fork as CPUs number
  var numCPUs = require("os").cpus().length
  while(numCPUs--) {
    cluster.fork(process.env)
  }

  cluster.on('exit', function(worker, code, signal) {
    // Handle unwanted worker exits
    if(code != 0) {
      console.log("Worker crashed! Spawning a replacement.")
      cluster.fork(process.env)
    }
    // console.log('worker ' + worker.process.pid + ': exit')
  })

  cluster.on('listening', function(worker, code, signal) {
    console.log('process ' + worker.process.pid + ': forked')
  })

/*  cluster.on('disconnect', function(worker, code, signal) {
    console.log('worker ' + worker.process.pid + ': disconnect')
  })*/

  // kill -USR2 MASTER_PID
  process.on('SIGUSR2', function() {
    console.log('SIGUSR2 received, reloading workers')
    
    // only reload one worker at a time
    // otherwise, we'll have a time when no request handlers are running
    var i = 0
    var workers = Object.keys(cluster.workers)
    !function r() {
      if(workers.length === i) return
      console.log('worker ' + workers[i] + ' reloading...')

      // shutdown old worker
      var oldWorker = cluster.workers[workers[i]]
      oldWorker.on('disconnect', function() {
        console.log('worker ' + workers[i] + ' disconnect success!')
      })
      // oldWorker.isConnected() && oldWorker.kill()
      // oldWorker.isConnected() && oldWorker.disconnect()

      if(oldWorker.isConnected()) {
        oldWorker.disconnect()

        // fallback, if keep-live cause disconnect very slow
        setTimeout(function() {
          oldWorker.kill()
        }, 5000)
      }

      // delete the cached module, so we can reload the app
      delete require.cache[require.resolve("./server")]

      // start new worker
      var newWorker = cluster.fork()
      newWorker.once('listening', function() {
        console.log('worker ' + workers[i] + ' reload success!')
        i++
        r()
      })
    }()
  })
}
else {
  require('./server')
}





