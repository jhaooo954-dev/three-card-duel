"use strict";
const SIZE=15;
const check=(v,m)=>{if(!v)throw Error(m);};
function initial(tokens,names){return {tokens,names,round:0,rev:0,phase:'waiting',board:Array(SIZE*SIZE).fill(null),starter:0,nextStarter:0,turn:0,winner:null,winningLine:[],lastMove:null,moves:0,scores:[0,0]};}
function act(s,i,a){
 check(i===0||i===1,'玩家无效');check(s.tokens[1],'等待好友加入');check(a.round===s.round,'棋局已更新，请重试');
 if(a.type==='start'){
  check(s.phase!=='playing','本局尚未结束');check(i===s.nextStarter,'请等待先手玩家开局');
  Object.assign(s,{board:Array(SIZE*SIZE).fill(null),phase:'playing',starter:i,turn:i,winner:null,winningLine:[],lastMove:null,moves:0,round:s.round+1,rev:s.rev+1});return;
 }
 check(a.type==='move','操作无效');check(s.phase==='playing','请先开始新一局');check(i===s.turn,'还没轮到你落子');
 const {row,col}=a;check(Number.isInteger(row)&&Number.isInteger(col)&&row>=0&&row<SIZE&&col>=0&&col<SIZE,'请落在棋盘交点');
 const k=row*SIZE+col;check(s.board[k]===null,'这里已经有棋子');s.board[k]=i;s.lastMove=k;s.moves++;
 for(const [dr,dc] of [[0,1],[1,0],[1,1],[1,-1]]){
  const line=[k];for(const sign of [-1,1]){let r=row+dr*sign,c=col+dc*sign;while(r>=0&&r<SIZE&&c>=0&&c<SIZE&&s.board[r*SIZE+c]===i){line.push(r*SIZE+c);r+=dr*sign;c+=dc*sign;}}
  if(line.length>=5){s.phase='ended';s.winner=i;s.nextStarter=i;s.winningLine=line;s.scores[i]++;break;}
 }
 if(s.phase==='playing'){if(s.moves===SIZE*SIZE)s.phase='ended';else s.turn=1-i;}
 s.rev++;
}
function view(s,i,code,last){return {code,you:i,names:s.names,joined:!!s.tokens[1],online:last.map((v,j)=>!!s.tokens[j]&&Date.now()-v<15000),round:s.round,rev:s.rev,phase:s.phase,size:SIZE,board:s.board,starter:s.starter,nextStarter:s.nextStarter,turn:s.turn,winner:s.winner,winningLine:s.winningLine,lastMove:s.lastMove,moves:s.moves,scores:s.scores};}
module.exports={initial,act,view,SIZE};
