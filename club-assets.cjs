'use strict';
const fs=require('node:fs'),zlib=require('node:zlib'),crypto=require('node:crypto');
const cached=new Map();
function serveAsset(req,res,target,type){let entry=cached.get(target);if(!entry){const bytes=fs.readFileSync(target);entry={bytes,gzip:zlib.gzipSync(bytes),etag:'"'+crypto.createHash('sha256').update(bytes).digest('hex').slice(0,24)+'"'};cached.set(target,entry);}res.setHeader('Content-Type',type);res.setHeader('ETag',entry.etag);res.setHeader('Vary','Accept-Encoding');const html=target.endsWith('.html');res.setHeader('Cache-Control',html?'no-cache':'public, max-age=0, must-revalidate');if(req.headers['if-none-match']===entry.etag){res.writeHead(304);res.end();return;}const gzip=/\bgzip\b/.test(req.headers['accept-encoding']||'')&&!/\.(webp|apk|zip)$/.test(target),bytes=gzip?entry.gzip:entry.bytes;if(gzip)res.setHeader('Content-Encoding','gzip');res.setHeader('Content-Length',bytes.length);res.end(req.method==='HEAD'?undefined:bytes);}
module.exports={serveAsset};
