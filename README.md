# node 生产环境部署

思考:

- [x] 创建专门工作帐号进行权限和安全控制
- [x] 在 crash / 内存严重泄露时自动重启
- [x] 系统重启时自动执行
- [x] 版本切换时不中断服务不断开活跃请求
- [x] 版本控制和回归机制
- [x] 日志 / 报警 / 监控
- [x] 负载均衡方案, 多应用管理
- [x] **远程控制**
- [ ] 性能预估
- [ ] node + nginx 防攻击策略

## node 生成环境中 graceful-reload 方案研究

### node 进程中止的可能方式

- **SIGINT**: Sent from CTRL-C
- **SIGQUIT**: Sent from keyboard quit action(kill -QUIT PID).
- **SIGTERM**: Sent from operating system kill.
- **uncaughtException**: Internal error.

### 中断请求未完成的用户

问题:

- 请求未完成时, 直接结束进程会中断请求, 客户端 `No Data Received`
- 默认为 keep-alive 无法触发 server.close
- 部分服务可能需要在关闭前手动处理

策略:

- 当前如果没有活跃请求, 直接结束进程

```javascript
// check alive connenctions
server.getConnections(function(err, count) {
  !count && process.exit(0)
})
```

- 通过 server.close 事件

```javascript
// 停止接收新的连接请求，但不会立即关闭已经建立的连接，而是会等待这些连接自然结束
// 实际测试等待时间非常长, 因为默认是 keep-alive 的请求
server.close(function() {
  process.exit(0)
})
```

- 自定义监听器, 在 keep-alive 状态下认为 res.end() 已经完成并手动处理完相关事件后触发

```javascript
responseCatch.on('state', function(data) {
  data == 1 && process.exit(0)
})
```

- fallback: setTimeout 5000

```javascript
setTimeout(function () {
  process.exit(0)
}, 5000)
```

### 重启进程的响应时间间隔

问题:

- 旧服务关闭和新服务启动前处于无法响应请求的状态

策略:

- 多机部署 + nginx 负载均衡, 逐台更新    
- 单机 cluster

> 测试 worker.disconnect 方法也是因为 keep-alive 无法销毁

## [PM2](https://github.com/Unitech/pm2) 集成方案
---

### FEAUTURE

- 热部署

    * **reload**: 仅在 cluster 模式下服务不中断平滑升级, 同时不会中断当前连接
    * **gracefulReload**: 在 **reload** 基础下发送 `shutdown` 消息, 在业务中可以实现手动的 `reload` 处理逻辑

```javascript
process.on('shutdown', function () {
  server.close()

  // 15 秒后仍然不能关闭所有连接的话就直接停止进程
  setTimeout(function () {
    process.exit(0)
  }, 15000)
})
```

- 负载均衡

- 应用管理

- 状态监控

https://app.keymetrics.io/

![Keymetrics monitoring](https://camo.githubusercontent.com/7857adbf765b2742e77551b5733e5be1584772dd/68747470733a2f2f6b65796d6574726963732e696f2f6173736574732f696d616765732f6170706c69636174696f6e2d64656d6f2e706e67)

- 版本管理

生产环境采用 git + softlink 方案部署, 可以很方便按版本进行回滚或升级

```bash
$ pm2 deploy ecosystem.json5 production revert 1
```

- 系统整合

支持主要 linux 发行版开机启动

### 部署流程

- create a user for app deploy

```bash
# 创建 sudo 组用于分配 sudo 权限
$ groupadd sudo

# 创建部署用户
$ adduser -g sudo work

# 允许 sudo 用户组的 sudo 权限
$ vi /etc/sudoers
```

```
# %wheel ALL=(ALL) ALL
%sudo ALL=(ALL) ALL
```

> 如果 sudo 编译时默认参数 `–with-secure-path` 导致 path 匹配不到

```bash
$ vi ~/.bashrc
```

```
alias sudo='sudo env PATH=$PATH'
```

- Install iojs

https://iojs.org

- Install pm2

```bash
$ sudo npm install pm2@latest -g
```

- Allow pm2 startup

```bash
sudo pm2 startup centos
```

- Deploy monitor
    * create a new bucket on [Keymetrics](https://app.keymetrics.io).
    * link [Keymetrics](https://app.keymetrics.io) on server

```bash
$ pm2 interact xxxxxxxx xxxxxxxxx
```

- ssh-key configuration on dev machine

```bash
$ ssh-keygen -t rsa
$ ssh-copy-id root@myserver.com
```

