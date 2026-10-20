package com.jh.friendgames;
import java.net.URI;
public final class GameCatalog {
 private GameCatalog(){}
 public static final class Game {
  public final String name,url,icon,tag,description;
  Game(String n,String u,String i,String t,String d){name=n;url=u;icon=i;tag=t;description=d;}
 }
 public static final Game[] GAMES={
  new Game("炸金花","https://three-card-duel-jh.onrender.com","♠","三张牌，见高下","闷牌、看牌、加注、开牌，熟悉的双人牌局。"),
  new Game("大话骰","https://dice-duel-jh.onrender.com","⚄","摇一盅，自己喊","骰盅动画、私下偷看，你或好友都能开盅。"),
  new Game("十点半","https://ten-half-duel-jh.onrender.com","10½","多一张，刚刚好","整铺换庄、闲家要牌、庄家发牌，自动结算。")
 };
 public static int indexForUrl(String value){try{URI u=new URI(value);if(!"https".equalsIgnoreCase(u.getScheme())||u.getUserInfo()!=null||(u.getPort()!=-1&&u.getPort()!=443))return -1;for(int i=0;i<GAMES.length;i++){URI game=new URI(GAMES[i].url);if(game.getHost().equalsIgnoreCase(u.getHost()))return i;}}catch(Exception e){}return -1;}
 public static boolean isDownload(String value){try{String p=new URI(value).getPath();return p!=null&&(p.startsWith("/download")||p.startsWith("/club")||p.endsWith(".apk")||p.endsWith(".zip"));}catch(Exception e){return false;}}
}
