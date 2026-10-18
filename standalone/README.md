# 三张 · 独立服务器版

安卓和 iPhone 通过浏览器打开相同网址，创建/加入房间后远程对战。无需安装客户端。

## 已实现

- 两名真人联机，每人三张牌；闷牌、看牌、跟注、加注、开牌、弃牌。
- 服务器发牌、比较牌型、结算；未看牌时不向手机发送自己的牌面，始终不提前发送对方牌面。
- 独立玩家身份、换设备需要重新建房；同一设备可刷新恢复，换房后可用房间码重新加入。
- 重复操作用版本号校验；SQLite 保存房间，每次下注后写入。房间 24 小时过期。
- v1.2：无底注；本局投入从 0 开始，结算后保留双方投入和底池，下一局发牌时归零。
- 闷牌按当前底分、翻过任意一张后按底分两倍计费；开牌等于本人跟注费用，不再额外翻倍；初始底分 10，加注每次提高 10，上限 100。
- 可翻 1 / 2 / 3 张；只给本人发送已翻牌面，未全翻不发送牌型。弃牌、开牌、自动比牌后双方亮出全部三张。
- 第一局房主发牌，此后上局赢家发牌；发牌方的对手先操作，自动平局沿用原发牌方。
- 双方可同意重置战绩，积分不关联现金。

## 运行

使用 Node.js 24，无第三方依赖。

```sh
npm start
```

打开 http://localhost:3000 。服务默认监听 0.0.0.0，端口读取 `PORT`。健康检查 `/healthz`。

测试：`npm test`。

## Render 配置

线上使用单个 Render Web Service，配置如下：

- Web Service，Node，根目录 `standalone`
- Build Command: `node --check server.mjs && npm test`
- Start Command: `npm start`
- Node 版本 24，Health Check `/healthz`
- 已部署为 Free 计划，不附加付费存储
- 当前地址：https://three-card-duel-jh.onrender.com

现有服务以仓库根目录运行，构建和启动命令均以 `cd standalone &&` 开头。安卓客户端源码在 `android/`，签名密钥不存入 Git。

`DATA_DIR=/tmp/three-card-data` 不依赖额外付费存储。免费服务可能休眠，首次唤醒会等待；实例重启、重新部署或平台回收本地磁盘后，房间会丢失，请重新建房。游戏过程中保持网页前台。

如需持久保存房间，可将 DATA_DIR 指向单实例的持久磁盘；这可能产生费用，需要另行确认。SQLite 版本不适合多实例横向扩容。

部署完成后应从两个实际手机网络分别检查首页、创建房间、加入、闷牌、看牌、开牌与刷新重连；新域名的实际网络可达性仍需验证。

## Docker / 自有服务器

```sh
docker build -t three-card-duel .
docker run -p 3000:3000 -v three-card-data:/data three-card-duel
```

公网运行请配置 HTTPS 反向代理；不要把数据库目录作为静态文件目录开放。

## 官方部署文档

- https://render.com/docs/web-services
- https://render.com/docs/node-version
- https://render.com/docs/free
- https://render.com/docs/blueprint-spec
