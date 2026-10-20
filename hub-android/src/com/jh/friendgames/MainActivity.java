package com.jh.friendgames;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.DialogInterface;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
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
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
public class MainActivity extends Activity {
 private final int bg=Color.rgb(9,29,24),gold=Color.rgb(233,193,131),cream=Color.rgb(241,237,222),muted=Color.rgb(161,187,160);
 private LinearLayout root,header,gameArea,loading;private ScrollView home;private TextView heading,status;private Button lobby,retry;private WebView web;private int selected=-1;
 private int dp(float n){return (int)(n*getResources().getDisplayMetrics().density+.5f);}
 private GradientDrawable shape(int color,int stroke,int radius){GradientDrawable g=new GradientDrawable();g.setColor(color);g.setCornerRadius(dp(radius));if(stroke!=0)g.setStroke(dp(1),stroke);return g;}
 private TextView label(String s,int size,int color){TextView t=new TextView(this);t.setText(s);t.setTextSize(size);t.setTextColor(color);t.setFontFeatureSettings("kern");return t;}
 private LinearLayout.LayoutParams lp(int w,int h){return new LinearLayout.LayoutParams(w,h);}
 @Override public void onCreate(Bundle b){super.onCreate(b);getWindow().setStatusBarColor(bg);getWindow().setNavigationBarColor(bg);
 root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(bg);
 header=new LinearLayout(this);header.setGravity(Gravity.CENTER_VERTICAL);header.setPadding(dp(20),dp(10),dp(16),dp(10));
 heading=label("双人游戏厅",21,cream);heading.setTypeface(Typeface.DEFAULT,Typeface.BOLD);header.addView(heading,new LinearLayout.LayoutParams(0,dp(46),1));heading.setGravity(Gravity.CENTER_VERTICAL);
 lobby=new Button(this);lobby.setText("大厅");lobby.setTextColor(gold);lobby.setTextSize(13);lobby.setAllCaps(false);lobby.setBackground(shape(Color.rgb(29,58,42),Color.rgb(64,88,58),12));header.addView(lobby,lp(dp(72),dp(40)));lobby.setOnClickListener(new View.OnClickListener(){public void onClick(View v){showHome();}});root.addView(header);
 buildHome();buildGame();setContentView(root);showHome();
 }
 private void buildHome(){home=new ScrollView(this);home.setFillViewport(true);home.setClipToPadding(false);LinearLayout content=new LinearLayout(this);content.setOrientation(LinearLayout.VERTICAL);content.setPadding(dp(20),dp(12),dp(20),dp(28));
 TextView eyebrow=label("FRIENDS  /  PLAY TOGETHER",10,muted);eyebrow.setLetterSpacing(.12f);content.addView(eyebrow);
 TextView title=label("今晚，玩哪一个？",29,gold);title.setTypeface(Typeface.DEFAULT,Typeface.BOLD);LinearLayout.LayoutParams titleLp=lp(-1,-2);titleLp.setMargins(0,dp(14),0,dp(12));content.addView(title,titleLp);
 TextView intro=label("一部手机，一个大厅。\n选好游戏，叫上好友，一起开局。",14,muted);intro.setLineSpacing(dp(5),1);content.addView(intro);
 for(int i=0;i<GameCatalog.GAMES.length;i++)addGameCard(content,i);
 TextView tip=label("两人先选择同一款游戏，再通过房间码加入。\n点右上角「大厅」即可切换游戏；未过期的房间会尝试恢复。",11,muted);tip.setLineSpacing(dp(5),1);LinearLayout.LayoutParams tipLp=lp(-1,-2);tipLp.setMargins(dp(2),dp(21),dp(2),0);content.addView(tip,tipLp);
 TextView footer=label("好友休闲游戏 · 华为 / 三星通用 · v1.0",10,Color.rgb(115,146,120));footer.setGravity(Gravity.CENTER);LinearLayout.LayoutParams footerLp=lp(-1,-2);footerLp.setMargins(0,dp(28),0,0);content.addView(footer,footerLp);
 home.addView(content);root.addView(home,new LinearLayout.LayoutParams(-1,0,1));
 }
 private void addGameCard(LinearLayout parent,final int index){GameCatalog.Game game=GameCatalog.GAMES[index];LinearLayout card=new LinearLayout(this);card.setOrientation(LinearLayout.VERTICAL);card.setPadding(dp(18),dp(18),dp(18),dp(16));card.setBackground(shape(Color.rgb(22,52,35),Color.rgb(72,91,59),20));card.setElevation(dp(3));LinearLayout.LayoutParams cardLp=lp(-1,-2);cardLp.setMargins(0,dp(20),0,0);
 LinearLayout top=new LinearLayout(this);top.setGravity(Gravity.CENTER_VERTICAL);TextView icon=label(game.icon,index==2?26:36,gold);icon.setGravity(Gravity.CENTER);icon.setTypeface(Typeface.create("serif",Typeface.BOLD));icon.setBackground(shape(Color.rgb(39,66,43),Color.rgb(110,112,66),15));top.addView(icon,lp(dp(64),dp(64)));
 LinearLayout words=new LinearLayout(this);words.setOrientation(LinearLayout.VERTICAL);words.setPadding(dp(15),0,0,0);TextView name=label(game.name,22,cream);name.setTypeface(Typeface.DEFAULT,Typeface.BOLD);words.addView(name);TextView tag=label(game.tag,11,muted);LinearLayout.LayoutParams tagLp=lp(-1,-2);tagLp.setMargins(0,dp(5),0,0);words.addView(tag,tagLp);top.addView(words,new LinearLayout.LayoutParams(0,-2,1));parent.addView(card,cardLp);card.addView(top);
 TextView desc=label(game.description,12,muted);desc.setLineSpacing(dp(4),1);LinearLayout.LayoutParams descLp=lp(-1,-2);descLp.setMargins(0,dp(15),0,dp(15));card.addView(desc,descLp);
 Button enter=new Button(this);enter.setText("进入"+game.name+"  ↗");enter.setTextSize(14);enter.setTypeface(Typeface.DEFAULT,Typeface.BOLD);enter.setTextColor(Color.rgb(37,44,28));enter.setAllCaps(false);enter.setBackground(shape(gold,0,12));card.addView(enter,lp(-1,dp(46)));View.OnClickListener click=new View.OnClickListener(){public void onClick(View v){openGame(index);}};enter.setOnClickListener(click);card.setOnClickListener(click);
 }
 private void buildGame(){gameArea=new LinearLayout(this);gameArea.setOrientation(LinearLayout.VERTICAL);gameArea.setBackgroundColor(bg);
 loading=new LinearLayout(this);loading.setGravity(Gravity.CENTER_VERTICAL);loading.setPadding(dp(15),dp(5),dp(15),dp(6));status=label("",11,gold);status.setPadding(dp(9),0,dp(8),0);status.setLineSpacing(dp(3),1);loading.addView(status,new LinearLayout.LayoutParams(0,-2,1));retry=new Button(this);retry.setText("重试");retry.setTextColor(gold);retry.setTextSize(12);retry.setAllCaps(false);retry.setBackground(shape(Color.rgb(32,60,41),0,10));loading.addView(retry,lp(dp(64),dp(38)));retry.setOnClickListener(new View.OnClickListener(){public void onClick(View v){if(selected>=0)web.loadUrl(GameCatalog.GAMES[selected].url);}});gameArea.addView(loading);
 web=new WebView(this);web.setBackgroundColor(bg);WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setSupportZoom(false);settings.setSupportMultipleWindows(false);web.setWebChromeClient(new WebChromeClient());
 web.setDownloadListener(new DownloadListener(){public void onDownloadStart(String url,String userAgent,String disposition,String mime,long size){openExternal(url);}});
 web.setWebViewClient(new WebViewClient(){
 @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){String url=r.getUrl().toString();int game=GameCatalog.indexForUrl(url);if(game>=0&&!GameCatalog.isDownload(url)){if(r.isForMainFrame()&&selected!=game){selected=game;heading.setText(GameCatalog.GAMES[game].name);}return false;}if(r.isForMainFrame())openExternal(url);return true;}
 @Override public void onPageStarted(WebView v,String url,android.graphics.Bitmap icon){if(isCurrent(url)){loading.setVisibility(View.VISIBLE);status.setText("正在打开"+GameCatalog.GAMES[selected].name+"，首次连接可能需要约1分钟…");retry.setVisibility(View.GONE);}}
 @Override public void onPageFinished(WebView v,String url){if(!isCurrent(url))return;final int expected=selected;v.evaluateJavascript("document.querySelector('main')!==null",new ValueCallback<String>(){public void onReceiveValue(String value){if(expected!=selected)return;if("true".equals(value))loading.setVisibility(View.GONE);else showError("页面还未准备好，请稍后点重试。");}});}
 @Override public void onReceivedError(WebView v,WebResourceRequest r,WebResourceError e){if(r.isForMainFrame()&&isCurrent(r.getUrl().toString()))showError("连接暂时中断，请检查网络后重试。");}
 @Override public void onReceivedHttpError(WebView v,WebResourceRequest r,WebResourceResponse e){if(r.isForMainFrame()&&isCurrent(r.getUrl().toString()))showError("游戏正在唤醒，请稍后点重试。");}
 });gameArea.addView(web,new LinearLayout.LayoutParams(-1,0,1));root.addView(gameArea,new LinearLayout.LayoutParams(-1,0,1));
 }
 private boolean isCurrent(String url){return selected>=0&&GameCatalog.indexForUrl(url)==selected;}
 private void showError(String message){loading.setVisibility(View.VISIBLE);status.setText(message);retry.setVisibility(View.VISIBLE);}
 private void openExternal(String url){try{Uri u=Uri.parse(url);if(!"https".equalsIgnoreCase(u.getScheme()))return;startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(Exception e){showError("请使用浏览器打开该地址。");}}
 private void openGame(int index){selected=index;home.setVisibility(View.GONE);gameArea.setVisibility(View.VISIBLE);lobby.setVisibility(View.VISIBLE);heading.setText(GameCatalog.GAMES[index].name);getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);loading.setVisibility(View.VISIBLE);retry.setVisibility(View.GONE);status.setText("正在打开游戏…");web.loadUrl(GameCatalog.GAMES[index].url);}
 private void showHome(){selected=-1;getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);if(web!=null){web.stopLoading();web.loadUrl("about:blank");}gameArea.setVisibility(View.GONE);home.setVisibility(View.VISIBLE);lobby.setVisibility(View.GONE);heading.setText("双人游戏厅");}
 @Override public void onBackPressed(){if(selected>=0){showHome();return;}new AlertDialog.Builder(this).setMessage("退出双人游戏厅？").setNegativeButton("留下",null).setPositiveButton("退出",new DialogInterface.OnClickListener(){public void onClick(DialogInterface d,int w){finish();}}).show();}
 @Override protected void onDestroy(){if(web!=null){web.stopLoading();web.destroy();}super.onDestroy();}
}
