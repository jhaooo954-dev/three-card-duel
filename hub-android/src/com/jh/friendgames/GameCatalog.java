package com.jh.friendgames;
import java.net.URI;
public final class GameCatalog {
 private GameCatalog(){}
 public static final String ROOM_URL="https://ten-half-duel-jh.onrender.com/club/";
 public static boolean isAllowed(String value){try{URI u=new URI(value);return "https".equalsIgnoreCase(u.getScheme())&&u.getUserInfo()==null&&(u.getPort()==-1||u.getPort()==443)&&"ten-half-duel-jh.onrender.com".equalsIgnoreCase(u.getHost());}catch(Exception e){return false;}}
 public static boolean isDownload(String value){try{String p=new URI(value).getPath();return p!=null&&(p.endsWith(".apk")||p.endsWith(".zip"));}catch(Exception e){return false;}}
}
