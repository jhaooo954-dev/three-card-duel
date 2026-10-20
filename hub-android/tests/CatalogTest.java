import com.jh.friendgames.GameCatalog;
public class CatalogTest {
 private static void check(boolean ok,String message){if(!ok)throw new AssertionError(message);}
 public static void main(String[] args){
 check(GameCatalog.GAMES.length==3,"three games");
 String[] names={"炸金花","大话骰","十点半"};
 for(int i=0;i<3;i++){check(GameCatalog.GAMES[i].name.equals(names[i]),"correct game name");check(GameCatalog.indexForUrl(GameCatalog.GAMES[i].url)==i,"game stays in app");check(GameCatalog.indexForUrl(GameCatalog.GAMES[i].url+"/?room=123456")==i,"rooms allowed");check(GameCatalog.indexForUrl(GameCatalog.GAMES[i].url.replace("https:","http:"))==-1,"cleartext blocked");}
 for(String url:new String[]{"https://three-card-duel-jh.onrender.com.evil.test","https://three-card-duel-jh.onrender.com@evil.test","https://evil.test","file:///etc/passwd","javascript:alert(1)","https://dice-duel-jh.onrender.com:1234","https://user@dice-duel-jh.onrender.com"})check(GameCatalog.indexForUrl(url)==-1,"unapproved URL "+url);
 check(GameCatalog.indexForUrl("https://dice-duel-jh.onrender.com:443/")==1,"https port");
 check(GameCatalog.isDownload("https://ten-half-duel-jh.onrender.com/club.apk"),"APK download opens browser");
 check(GameCatalog.isDownload("https://ten-half-duel-jh.onrender.com/club.zip"),"ZIP download opens browser");
 check(!GameCatalog.isDownload("https://dice-duel-jh.onrender.com/"),"game is internal");
 System.out.println("Catalog navigation and URL isolation tests passed (3 games).");
 }
}
