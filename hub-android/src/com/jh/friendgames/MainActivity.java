package com.jh.friendgames;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
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
import java.io.IOException;
import java.net.URLConnection;

public class MainActivity extends Activity {
    private static final String LOCAL_HOME = "https://appassets.androidplatform.net/club/";
    private WebView web;
    private TextView status;
    private Button retry;
    private String onlineAddress = GameCatalog.ROOM_URL;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        int background = Color.rgb(11, 17, 26);
        getWindow().setStatusBarColor(background);
        getWindow().setNavigationBarColor(background);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(background);

        status = new TextView(this);
        status.setTextColor(Color.rgb(233, 193, 131));
        status.setTextSize(12);
        status.setPadding(24, 14, 24, 12);
        status.setVisibility(View.GONE);
        root.addView(status);

        LinearLayout actions = new LinearLayout(this);
        retry = new Button(this);
        retry.setText("重试联机");
        retry.setVisibility(View.GONE);
        retry.setOnClickListener(view -> web.loadUrl(onlineAddress));
        actions.addView(retry);
        Button offline = new Button(this);
        offline.setText("回单人大厅");
        offline.setVisibility(View.GONE);
        offline.setOnClickListener(view -> web.loadUrl(LOCAL_HOME));
        actions.addView(offline);
        root.addView(actions);

        web = new WebView(this);
        web.setBackgroundColor(background);
        root.addView(web, new LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(root);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportZoom(false);
        settings.setTextZoom(100);
        settings.setMediaPlaybackRequiresUserGesture(true);
        web.setWebChromeClient(new WebChromeClient());
        web.setDownloadListener((url, agent, disposition, mime, size) -> openExternal(url));
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String address = request.getUrl().toString();
                if (isLocal(request.getUrl())) return false;
                if (GameCatalog.isAllowed(address) && !GameCatalog.isDownload(address)) {
                    if (request.isForMainFrame()) onlineAddress = address;
                    return false;
                }
                if (request.isForMainFrame()) openExternal(address);
                return true;
            }

            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!isLocal(uri)) return null;
                String path = uri.getPath();
                if (path == null || !path.matches("/[a-zA-Z0-9_./-]+") || path.contains("..")) return null;
                if (path.startsWith("/club-game/")) path = path.replaceFirst("/club-game/", "/club-games/");
                if (path.endsWith("/")) path += "index.html";
                if (path.equals("/club/table-dealer.js") || path.equals("/club/table-dealer.css")) path = path.substring(5);
                String mime = URLConnection.guessContentTypeFromName(path);
                if (path.endsWith(".js")) mime = "application/javascript";
                if (path.endsWith(".css")) mime = "text/css";
                if (path.endsWith(".webp")) mime = "image/webp";
                if (path.endsWith(".flac")) mime = "audio/flac";
                if (path.endsWith(".opus")) mime = "audio/ogg";
                try {
                    return new WebResourceResponse(mime == null ? "application/octet-stream" : mime,
                        mime != null && (mime.startsWith("text/") || path.endsWith(".js")) ? "UTF-8" : null,
                        getAssets().open("offline"+path));
                } catch (IOException error) {
                    return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found",
                        java.util.Collections.emptyMap(), new java.io.ByteArrayInputStream(new byte[0]));
                }
            }

            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) {
                boolean remote = GameCatalog.isAllowed(url);
                status.setText("正在连接好友房…");
                status.setVisibility(remote ? View.VISIBLE : View.GONE);
                offline.setVisibility(remote ? View.VISIBLE : View.GONE);
                retry.setVisibility(View.GONE);
            }

            @Override public void onPageFinished(WebView view, String url) {
                view.evaluateJavascript("!!document.querySelector('main')", value -> {
                    if ("true".equals(value)) {
                        status.setVisibility(View.GONE);
                        retry.setVisibility(View.GONE);
                        offline.setVisibility(View.GONE);
                    }
                });
            }

            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showError("联机暂不可用。可重试或返回单人大厅。");
            }

            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse error) {
                if (request.isForMainFrame()) showError("服务器暂不可用。可重试或返回单人大厅。");
            }
        });
        web.loadUrl(LOCAL_HOME);
    }

    private boolean isLocal(Uri uri) {
        return "https".equals(uri.getScheme()) && "appassets.androidplatform.net".equals(uri.getHost())
            && uri.getUserInfo() == null && uri.getPort() == -1;
    }

    private void showError(String message) {
        status.setText(message);
        status.setVisibility(View.VISIBLE);
        retry.setVisibility(View.VISIBLE);
    }

    private void openExternal(String url) {
        try {
            Uri uri = Uri.parse(url);
            if (GameCatalog.isAllowed(url)) startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (Exception error) { showError("请用浏览器打开下载地址。"); }
    }

    @Override public void onBackPressed() {
        web.evaluateJavascript("window.clubBack ? window.clubBack() : false", value -> {
            if ("true".equals(value)) return;
            if (GameCatalog.isAllowed(web.getUrl())) web.loadUrl(LOCAL_HOME);
            else new AlertDialog.Builder(this).setMessage("退出游戏厅？")
                .setNegativeButton("继续玩", null).setPositiveButton("退出", (dialog, button) -> finish()).show();
        });
    }

    @Override protected void onDestroy() {
        if (web != null) { web.stopLoading(); web.destroy(); }
        super.onDestroy();
    }
}
