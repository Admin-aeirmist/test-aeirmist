package com.aeirmist.social;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import androidx.core.app.NotificationCompat;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * ChatHeadService — draws a vertical stack of squircle chat heads over all other apps.
 * Requires SYSTEM_ALERT_WINDOW ("Display over other apps").
 *
 * Tap a head      → opens Aeirmist on that chat
 * Long-press head → dismisses that head
 * Drag any head   → moves the whole stack, snaps to nearest screen edge
 */
public class ChatHeadService extends Service {

    private static final String CHANNEL_ID = "aeirmist_chatheads";
    private static final int FOREGROUND_ID = 9901;
    private static final int HEAD_SIZE_DP = 60;
    private static final int GAP_DP = 12;
    private static final int BADGE_SIZE_DP = 20;

    public static final String ACTION_SHOW   = "com.aeirmist.social.CHATHEAD_SHOW";
    public static final String ACTION_HIDE   = "com.aeirmist.social.CHATHEAD_HIDE";
    public static final String ACTION_UPDATE = "com.aeirmist.social.CHATHEAD_UPDATE";

    public static volatile boolean isRunning = false;
    /** Heads the user dismissed natively — MainActivity forwards these to JS on return. */
    public static final ConcurrentLinkedQueue<String> closedIds = new ConcurrentLinkedQueue<>();

    static class HeadData {
        String id, name, avatarUrl;
        int unread;
    }

    private WindowManager windowManager;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ExecutorService executor = Executors.newFixedThreadPool(2);

    private final List<HeadData> heads = new ArrayList<>();
    private final List<View> views = new ArrayList<>();
    private final List<WindowManager.LayoutParams> paramsList = new ArrayList<>();
    private final Map<String, Bitmap> avatarCache = new HashMap<>();

    private boolean visible = false;
    private int stackX = -1;   // -1 = right edge default
    private int stackY = 260;

    // ── Lifecycle ────────────────────────────────────────────────────────────

    @Override
    public void onCreate() {
        super.onCreate();
        isRunning = true;
        createNotificationChannel();
        Notification n = buildForegroundNotification();
        try {
            if (Build.VERSION.SDK_INT >= 34) {
                startForeground(FOREGROUND_ID, n, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            } else {
                startForeground(FOREGROUND_ID, n);
            }
        } catch (Exception e) {
            isRunning = false;
            stopSelf();
            return;
        }
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;
        String action = intent.getAction();

        if (intent.hasExtra("heads")) parseHeads(intent.getStringExtra("heads"));

        if (ACTION_SHOW.equals(action)) {
            visible = true;
            if (canDrawOverlays()) renderHeads();
        } else if (ACTION_HIDE.equals(action)) {
            visible = false;
            removeAllViews();
        } else if (ACTION_UPDATE.equals(action)) {
            if (visible && canDrawOverlays()) renderHeads();
        }
        return START_NOT_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onDestroy() {
        super.onDestroy();
        isRunning = false;
        removeAllViews();
        executor.shutdownNow();
    }

    private boolean canDrawOverlays() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.M || android.provider.Settings.canDrawOverlays(this);
    }

    private void parseHeads(String json) {
        heads.clear();
        if (json == null) return;
        try {
            JSONArray arr = new JSONArray(json);
            for (int i = 0; i < arr.length() && i < 5; i++) {
                JSONObject o = arr.getJSONObject(i);
                HeadData h = new HeadData();
                h.id = o.optString("id", "");
                h.name = o.optString("name", "Chat");
                h.avatarUrl = o.optString("avatarUrl", "");
                h.unread = o.optInt("unread", 0);
                if (!h.id.isEmpty()) heads.add(h);
            }
        } catch (Exception ignored) {}
    }

    // ── Rendering ────────────────────────────────────────────────────────────

    private void renderHeads() {
        handler.post(() -> {
            removeAllViewsNow();
            if (heads.isEmpty()) return;

            float density = getResources().getDisplayMetrics().density;
            int sizePx  = (int) (HEAD_SIZE_DP * density);
            int gapPx   = (int) (GAP_DP * density);
            int badgePx = (int) (BADGE_SIZE_DP * density);
            int screenW = getResources().getDisplayMetrics().widthPixels;
            if (stackX < 0) stackX = screenW - sizePx - (int) (8 * density);

            int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                    ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                    : WindowManager.LayoutParams.TYPE_PHONE;

            for (int i = 0; i < heads.size(); i++) {
                final HeadData h = heads.get(i);
                final SquircleView v = new SquircleView(this, sizePx, h.unread, badgePx);

                WindowManager.LayoutParams p = new WindowManager.LayoutParams(
                        sizePx, sizePx, type,
                        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                                | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                        PixelFormat.TRANSLUCENT);
                p.gravity = Gravity.TOP | Gravity.START;
                p.x = stackX;
                p.y = stackY + i * (sizePx + gapPx);

                v.setOnTouchListener(new StackTouchListener(h.id, sizePx, gapPx));

                try {
                    windowManager.addView(v, p);
                    views.add(v);
                    paramsList.add(p);
                } catch (Exception ignored) {}

                Bitmap cached = avatarCache.get(h.avatarUrl);
                if (cached != null) {
                    v.setAvatar(cached);
                } else if (h.avatarUrl != null && h.avatarUrl.startsWith("http")) {
                    final String url = h.avatarUrl;
                    executor.execute(() -> {
                        Bitmap bmp = fetchBitmap(url);
                        if (bmp != null) {
                            Bitmap sq = makeSquircleBitmap(bmp, sizePx);
                            handler.post(() -> {
                                avatarCache.put(url, sq);
                                v.setAvatar(sq);
                            });
                        }
                    });
                }
            }
        });
    }

    private void removeAllViews() {
        handler.post(this::removeAllViewsNow);
    }

    private void removeAllViewsNow() {
        if (windowManager != null) {
            for (View v : views) {
                try { windowManager.removeView(v); } catch (Exception ignored) {}
            }
        }
        views.clear();
        paramsList.clear();
    }

    private void moveStack(int x, int y, int sizePx, int gapPx) {
        stackX = x;
        stackY = y;
        for (int i = 0; i < views.size(); i++) {
            WindowManager.LayoutParams p = paramsList.get(i);
            p.x = x;
            p.y = y + i * (sizePx + gapPx);
            try { windowManager.updateViewLayout(views.get(i), p); } catch (Exception ignored) {}
        }
    }

    private void openChat(String id) {
        Intent launch = new Intent(this, MainActivity.class);
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        launch.putExtra("chatHeadId", id);
        startActivity(launch);
    }

    private void dismissHead(String id) {
        closedIds.add(id);
        for (int i = 0; i < heads.size(); i++) {
            if (heads.get(i).id.equals(id)) { heads.remove(i); break; }
        }
        if (heads.isEmpty()) {
            removeAllViewsNow();
        } else {
            renderHeads();
        }
    }

    // ── Touch: drag whole stack, tap = open, long-press = dismiss ───────────

    class StackTouchListener implements View.OnTouchListener {
        private final String headId;
        private final int sizePx, gapPx;
        private int startStackX, startStackY;
        private float downX, downY;
        private long downTime;
        private boolean moved;

        StackTouchListener(String id, int sizePx, int gapPx) {
            this.headId = id; this.sizePx = sizePx; this.gapPx = gapPx;
        }

        @Override
        public boolean onTouch(View v, MotionEvent e) {
            switch (e.getAction()) {
                case MotionEvent.ACTION_DOWN:
                    startStackX = stackX;
                    startStackY = stackY;
                    downX = e.getRawX();
                    downY = e.getRawY();
                    downTime = System.currentTimeMillis();
                    moved = false;
                    return true;
                case MotionEvent.ACTION_MOVE: {
                    float dx = e.getRawX() - downX;
                    float dy = e.getRawY() - downY;
                    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) moved = true;
                    if (moved) moveStack(startStackX + (int) dx, Math.max(0, startStackY + (int) dy), sizePx, gapPx);
                    return true;
                }
                case MotionEvent.ACTION_UP: {
                    long elapsed = System.currentTimeMillis() - downTime;
                    if (!moved) {
                        if (elapsed < 350) openChat(headId);
                        else if (elapsed > 650) dismissHead(headId);
                    } else {
                        int screenW = getResources().getDisplayMetrics().widthPixels;
                        float density = getResources().getDisplayMetrics().density;
                        int margin = (int) (8 * density);
                        int center = stackX + sizePx / 2;
                        int snapX = center < screenW / 2 ? margin : screenW - sizePx - margin;
                        moveStack(snapX, stackY, sizePx, gapPx);
                    }
                    return true;
                }
            }
            return false;
        }
    }

    // ── Squircle view ────────────────────────────────────────────────────────

    static class SquircleView extends View {
        private final Paint bgPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint borderPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint badgePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint textPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final int sizePx, badgePx, unread;
        private Bitmap avatar;

        SquircleView(Context ctx, int sizePx, int unread, int badgePx) {
            super(ctx);
            this.sizePx = sizePx;
            this.unread = unread;
            this.badgePx = badgePx;
            bgPaint.setColor(0xFF1A1A2E);
            borderPaint.setStyle(Paint.Style.STROKE);
            borderPaint.setStrokeWidth(sizePx * 0.04f);
            borderPaint.setColor(0xFF00F2FF);
            badgePaint.setColor(0xFFFF3B30);
            textPaint.setColor(Color.WHITE);
            textPaint.setTextSize(badgePx * 0.55f);
            textPaint.setTextAlign(Paint.Align.CENTER);
            textPaint.setTypeface(Typeface.DEFAULT_BOLD);
        }

        void setAvatar(Bitmap bmp) { this.avatar = bmp; invalidate(); }

        @Override
        protected void onDraw(Canvas canvas) {
            float r = sizePx * 0.28f;
            canvas.drawRoundRect(new RectF(0, 0, sizePx, sizePx), r, r, bgPaint);
            if (avatar != null) canvas.drawBitmap(avatar, 0, 0, null);
            float half = borderPaint.getStrokeWidth() / 2f;
            canvas.drawRoundRect(new RectF(half, half, sizePx - half, sizePx - half), r - half, r - half, borderPaint);
            if (unread > 0) {
                float bx = sizePx - badgePx * 0.5f;
                float by = badgePx * 0.5f;
                canvas.drawCircle(bx, by, badgePx * 0.5f, badgePaint);
                String label = unread > 9 ? "9+" : String.valueOf(unread);
                canvas.drawText(label, bx, by + textPaint.getTextSize() * 0.38f, textPaint);
            }
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private Bitmap fetchBitmap(String url) {
        try {
            HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setConnectTimeout(3000);
            conn.setReadTimeout(3000);
            conn.connect();
            InputStream is = conn.getInputStream();
            return BitmapFactory.decodeStream(is);
        } catch (Exception e) { return null; }
    }

    private Bitmap makeSquircleBitmap(Bitmap src, int sizePx) {
        Bitmap out = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(out);
        float r = sizePx * 0.28f;
        Path path = new Path();
        path.addRoundRect(new RectF(0, 0, sizePx, sizePx), r, r, Path.Direction.CW);
        canvas.clipPath(path);
        Bitmap scaled = Bitmap.createScaledBitmap(src, sizePx, sizePx, true);
        canvas.drawBitmap(scaled, 0, 0, new Paint(Paint.ANTI_ALIAS_FLAG));
        return out;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Chat Heads", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Aeirmist floating chat heads");
            ch.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(ch);
        }
    }

    private Notification buildForegroundNotification() {
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        int piFlags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0;
        PendingIntent pi = PendingIntent.getActivity(this, 0, intent, piFlags);
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Aeirmist")
                .setContentText("Chat heads are active")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setContentIntent(pi)
                .setSilent(true)
                .build();
    }
}
