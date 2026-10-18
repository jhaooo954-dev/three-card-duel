package com.threecard.duel;

import android.app.Activity;
import android.app.AlertDialog;
import android.os.Bundle;
import android.content.Intent;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.graphics.Color;
import android.net.Uri;
import android.view.WindowManager;
import android.webkit.WebView;
import android.webkit.WebSettings;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceResponse;
import android.webkit.JsResult;
import android.webkit.JavascriptInterface;
import android.widget.EditText;
import android.widget.Toast;
import org.json.JSONObject;
import java.net.URL;
import java.net.HttpURLConnection;
import java.io.InputStream;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.OutputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
 private static final String APP_HOST="appassets.androidplatform.net";
 private static final String DEFAULT_SERVER="https://three-card-duel-jh.onrender.com";
 private WebView web;
 private final ExecutorService network=Executors.newFixedThreadPool(3);
 private volatile boolean destroyed=false;
 private volatile String server=DEFAULT_SERVER;
 @Override public void onCreate(Bundle saved){
  super.onCreate(saved);
  server=getPreferences(MODE_PRIVATE).getString("server",DEFAULT_SERVER);
  if(server.endsWith(".chatgpt.site")){server=DEFAULT_SERVER;getPreferences(MODE_PRIVATE).edit().putString("server",server).apply();}
  getWindow().setStatusBarColor(Color.rgb(16,27,25));getWindow().setNavigationBarColor(Color.rgb(16,27,25));
  getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
  web=new WebView(this);web.setBackgroundColor(Color.rgb(16,27,25));setContentView(web);
  WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setAllowFileAccessFromFileURLs(false);settings.setAllowUniversalAccessFromFileURLs(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setSupportZoom(false);settings.setBuiltInZoomControls(false);settings.setTextZoom(100);
  web.addJavascriptInterface(new Bridge(),"Android");
  web.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView view,String address){
    Uri u=Uri.parse(address);
    if("https".equals(u.getScheme())&&APP_HOST.equals(u.getHost()))return false;
    if("threecard".equals(u.getScheme())){openInvite(u);return true;}
    if("https".equals(u.getScheme())){try{startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(Exception ignored){}return true;}
    return true;
   }
   @Override public WebResourceResponse shouldInterceptRequest(WebView view,String address){
    Uri u=Uri.parse(address);
    if(!"https".equals(u.getScheme())||!APP_HOST.equals(u.getHost()))return blank();
    String p=u.getPath();if(p==null||p.equals("/"))p="/index.html";
    String f=p.substring(1);
    if(!f.matches("(index\\.html|offline\\.html|style\\.css|online\\.js|game\\.js|native\\.js|peer\\.js|engine-peer\\.js|icon\\.svg|manifest\\.webmanifest)"))return blank();
    String mime=f.endsWith(".html")?"text/html":f.endsWith(".css")?"text/css":f.endsWith(".js")?"application/javascript":f.endsWith(".svg")?"image/svg+xml":"application/manifest+json";
    try{return new WebResourceResponse(mime,"UTF-8",getAssets().open(f));}catch(Exception e){return blank();}
   }
  });
  web.setWebChromeClient(new WebChromeClient(){
   @Override public boolean onJsConfirm(WebView view,String url,String message,final JsResult result){new AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton("确定",(d,w)->result.confirm()).setNegativeButton("取消",(d,w)->result.cancel()).setOnCancelListener(d->result.cancel()).show();return true;}
   @Override public boolean onJsAlert(WebView view,String url,String message,final JsResult result){new AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton("知道了",(d,w)->result.confirm()).setOnCancelListener(d->result.confirm()).show();return true;}
  });
  Uri invite=getIntent().getData();load(invite);
 }
 private WebResourceResponse blank(){return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));}
 private void load(Uri invite){String query="";if(invite!=null&&"threecard".equals(invite.getScheme())){String c=invite.getQueryParameter("room");if(c!=null&&c.matches("[A-HJ-NP-Z2-9]{6}"))query="?room="+c;}web.loadUrl("https://"+APP_HOST+"/index.html"+query);}
 private void openInvite(Uri uri){load(uri);}
 @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);openInvite(intent.getData());}
 @Override public void onBackPressed(){if(web.canGoBack())web.goBack();else new AlertDialog.Builder(this).setMessage("退出游戏？对战时请保持 App 在前台。").setPositiveButton("退出",(d,w)->finish()).setNegativeButton("继续玩",null).show();}
 @Override protected void onDestroy(){destroyed=true;network.shutdownNow();if(web!=null){web.removeJavascriptInterface("Android");web.destroy();}super.onDestroy();}
 private void reply(final int id,final int status,final String body){runOnUiThread(()->{if(!destroyed)web.evaluateJavascript("window.__nativeReply("+id+","+status+","+JSONObject.quote(body)+")",null);});}
 public class Bridge {
  @JavascriptInterface public void copy(final String text){runOnUiThread(()->{if(text!=null&&text.length()<100000){((ClipboardManager)getSystemService(CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("三张配对码",text));Toast.makeText(MainActivity.this,"已复制",Toast.LENGTH_SHORT).show();}});}
  @JavascriptInterface public void share(final String text){runOnUiThread(()->{if(text==null||text.length()>100000)return;Intent i=new Intent(Intent.ACTION_SEND);i.setType("text/plain");i.putExtra(Intent.EXTRA_TEXT,text);try{startActivity(Intent.createChooser(i,"发给朋友"));}catch(Exception e){Toast.makeText(MainActivity.this,"请使用复制按钮",Toast.LENGTH_SHORT).show();}});}
  @JavascriptInterface public void configureServer(){runOnUiThread(()->{
   final EditText input=new EditText(MainActivity.this);input.setSingleLine(true);input.setText(server);input.setPadding(30,20,30,20);
   new AlertDialog.Builder(MainActivity.this).setTitle("联机服务").setMessage("默认已连接独立游戏服务器。双方应使用相同服务地址；修改后请重新创建或加入房间。").setView(input).setNegativeButton("取消",null).setNeutralButton("恢复默认",(d,w)->saveServer(DEFAULT_SERVER)).setPositiveButton("保存",(d,w)->{String value=input.getText().toString().trim();try{URL u=new URL(value);if(!"https".equals(u.getProtocol())||u.getHost().isEmpty()||u.getUserInfo()!=null||u.getQuery()!=null||u.getRef()!=null||(!u.getPath().isEmpty()&&!u.getPath().equals("/")))throw new Exception();saveServer("https://"+u.getAuthority());}catch(Exception e){Toast.makeText(MainActivity.this,"请输入正确的 HTTPS 服务根地址",Toast.LENGTH_LONG).show();}}).show();
  });}
  private void saveServer(String value){server=value;getPreferences(MODE_PRIVATE).edit().putString("server",server).apply();Toast.makeText(MainActivity.this,"联机服务地址已保存",Toast.LENGTH_SHORT).show();}
  @JavascriptInterface public void request(final int id,final String method,final String route,final String headers,final String body){
   if(id<0||route==null||!route.matches("/api/room(\\?code=[A-HJ-NP-Z2-9]{6})?")||(!"GET".equals(method)&&!"POST".equals(method))||body==null||body.length()>4096){reply(id,400,"{\"error\":\"无效请求\"}");return;}
   final String endpoint=server;
   network.execute(()->{
    HttpURLConnection c=null;
    try{
     c=(HttpURLConnection)new URL(endpoint+route).openConnection();c.setRequestMethod(method);c.setInstanceFollowRedirects(false);c.setConnectTimeout(20000);c.setReadTimeout(60000);c.setRequestProperty("Accept","application/json");c.setRequestProperty("Content-Type","application/json; charset=utf-8");
     JSONObject h=new JSONObject(headers);String token=h.optString("X-Player-Token","");if(token.matches("[A-Za-z0-9-]{1,100}"))c.setRequestProperty("X-Player-Token",token);
     if("POST".equals(method)){c.setDoOutput(true);byte[] bytes=body.getBytes("UTF-8");c.setFixedLengthStreamingMode(bytes.length);try(OutputStream out=c.getOutputStream()){out.write(bytes);}}
     int status=c.getResponseCode();InputStream stream=status>=400?c.getErrorStream():c.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream();if(stream!=null){try(InputStream in=stream){byte[] buffer=new byte[4096];int n;while((n=in.read(buffer))!=-1){out.write(buffer,0,n);if(out.size()>500000)throw new Exception("响应过长");}}}
     String content=out.toString("UTF-8");String type=c.getContentType();
     if(type==null||!type.contains("application/json")){reply(id,502,"{\"error\":\"联机服务未返回游戏数据，可能被网络或平台拦截。请检查联机服务地址或稍后重试。\"}");}
     else reply(id,status,content);
    }catch(Exception e){reply(id,502,"{\"error\":\"无法连接游戏服务，请检查网络后重试。免费服务唤醒可能需要等待。\"}");}finally{if(c!=null)c.disconnect();}
   });
  }
 }
}
