package com.jh.tenhalf;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.DialogInterface;
import android.webkit.ValueCallback;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
public class MainActivity extends Activity {
 private WebView web;private LinearLayout root;private TextView status;private Button retry;
 private final String origin="https://ten-half-duel-jh.onrender.com";
 public void onCreate(Bundle b){super.onCreate(b);getWindow().setStatusBarColor(Color.rgb(8,27,27));getWindow().setNavigationBarColor(Color.rgb(8,27,27));getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
 root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(Color.rgb(8,27,27));status=new TextView(this);status.setTextColor(Color.rgb(233,190,130));status.setPadding(24,20,24,10);status.setText("正在连接游戏，首次启动可能需要约1分钟…");root.addView(status);
 retry=new Button(this);retry.setText("重新连接");retry.setOnClickListener(new View.OnClickListener(){public void onClick(View v){status.setVisibility(View.VISIBLE);status.setText("正在重新连接…");web.loadUrl(origin);}});root.addView(retry);web=new WebView(this);root.addView(web,new LinearLayout.LayoutParams(-1,0,1));setContentView(root);
 WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(false);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);s.setSupportZoom(false);web.setWebChromeClient(new WebChromeClient());web.setWebViewClient(new WebViewClient(){public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){Uri u=r.getUrl();if("https".equals(u.getScheme())&&"ten-half-duel-jh.onrender.com".equals(u.getHost())&&!u.getPath().startsWith("/download"))return false;if("https".equals(u.getScheme())){try{startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(Exception e){status.setText("请使用浏览器打开下载地址");status.setVisibility(View.VISIBLE);}}return true;}public void onPageFinished(WebView v,String url){if(url.startsWith(origin)){v.evaluateJavascript("document.getElementById('lobby')!==null",new ValueCallback<String>(){public void onReceiveValue(String value){if("true".equals(value)){status.setVisibility(View.GONE);retry.setVisibility(View.GONE);}else{retry.setVisibility(View.VISIBLE);}}});}}public void onReceivedError(WebView v,WebResourceRequest r,WebResourceError e){if(r.isForMainFrame()){status.setVisibility(View.VISIBLE);retry.setVisibility(View.VISIBLE);status.setText("连接暂时中断，请检查网络后点重新连接。");}}});web.loadUrl(origin);
 }
 @Override public void onBackPressed(){new AlertDialog.Builder(this).setMessage("退出游戏？再次打开会尝试恢复房间。").setNegativeButton("继续游戏",null).setPositiveButton("退出",new DialogInterface.OnClickListener(){public void onClick(DialogInterface d,int w){finish();}}).show();}
 @Override protected void onDestroy(){if(web!=null){web.stopLoading();web.destroy();}super.onDestroy();}
}