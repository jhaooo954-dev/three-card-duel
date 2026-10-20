package com.jh.friendgames;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.DialogInterface;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.DownloadListener;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
public class MainActivity extends Activity {
 private WebView web;private TextView status;private Button retry;
 @Override public void onCreate(Bundle b){super.onCreate(b);int bg=Color.rgb(10,33,26);getWindow().setStatusBarColor(bg);getWindow().setNavigationBarColor(bg);getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(bg);
 status=new TextView(this);status.setTextColor(Color.rgb(233,193,131));status.setTextSize(12);status.setPadding(24,18,24,12);status.setText("正在打开统一房间，首次连接可能需要约1分钟…");root.addView(status);
 retry=new Button(this);retry.setText("重新连接");retry.setVisibility(View.GONE);retry.setOnClickListener(new View.OnClickListener(){public void onClick(View v){status.setVisibility(View.VISIBLE);status.setText("正在重新连接统一房间…");web.loadUrl(GameCatalog.ROOM_URL);}});root.addView(retry);
 web=new WebView(this);web.setBackgroundColor(bg);root.addView(web,new LinearLayout.LayoutParams(-1,0,1));setContentView(root);WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setSupportZoom(false);web.setWebChromeClient(new WebChromeClient());
 web.setDownloadListener(new DownloadListener(){public void onDownloadStart(String url,String ua,String cd,String mime,long size){openExternal(url);}});
 web.setWebViewClient(new WebViewClient(){
 @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){String url=r.getUrl().toString();if(GameCatalog.isAllowed(url)&&!GameCatalog.isDownload(url))return false;if(r.isForMainFrame())openExternal(url);return true;}
 @Override public void onPageFinished(WebView v,String url){if(!GameCatalog.isAllowed(url))return;v.evaluateJavascript("document.querySelector('main')!==null",new ValueCallback<String>(){public void onReceiveValue(String value){if("true".equals(value)){status.setVisibility(View.GONE);retry.setVisibility(View.GONE);}else showError("页面正在准备，请稍后点重新连接。");}});}
 @Override public void onReceivedError(WebView v,WebResourceRequest r,WebResourceError e){if(r.isForMainFrame())showError("连接暂时中断，请检查网络后重新连接。");}
 @Override public void onReceivedHttpError(WebView v,WebResourceRequest r,WebResourceResponse e){if(r.isForMainFrame())showError("服务正在唤醒，请稍后重新连接。");}
 });web.loadUrl(GameCatalog.ROOM_URL);
 }
 private void showError(String text){status.setText(text);status.setVisibility(View.VISIBLE);retry.setVisibility(View.VISIBLE);}
 private void openExternal(String url){try{Uri uri=Uri.parse(url);if("https".equalsIgnoreCase(uri.getScheme()))startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(Exception e){showError("请用浏览器打开下载地址。");}}
 private void confirmExit(){new AlertDialog.Builder(this).setMessage("退出游戏厅？房间会保留，再次打开可尝试恢复。").setNegativeButton("继续玩",null).setPositiveButton("退出",new DialogInterface.OnClickListener(){public void onClick(DialogInterface d,int w){finish();}}).show();}
 @Override public void onBackPressed(){web.evaluateJavascript("window.clubBack ? window.clubBack() : false",new ValueCallback<String>(){public void onReceiveValue(String value){if(!"true".equals(value))confirmExit();}});}
 @Override protected void onDestroy(){if(web!=null){web.stopLoading();web.destroy();}super.onDestroy();}
}
