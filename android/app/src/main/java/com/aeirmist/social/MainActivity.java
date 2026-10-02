package com.aeirmist.social;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;
import android.app.DownloadManager;
import android.content.Context;
import android.os.Environment;
import java.util.ArrayList;
import java.util.List;
import android.media.AudioManager;
import android.media.AudioDeviceInfo;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.ActivityCallback;
import android.view.WindowManager;
import android.graphics.Color;
import java.util.Locale;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.core.view.ViewCompat;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.os.VibrationEffect;

public class MainActivity extends BridgeActivity {
    private static final int NOTIFICATION_PERMISSION_CODE = 1001;
    private static final int ALL_PERMISSIONS_CODE = 1002;
    private static final int LOCATION_PERMISSION_CODE = 1003;
    private static PluginCall pendingCallPermissionPluginCall = null;
    private static PluginCall pendingNotificationPermissionPluginCall = null;
    private static PluginCall pendingLocationPermissionPluginCall = null;
    private static android.webkit.GeolocationPermissions.Callback pendingGeolocationCallback = null;
    private static String pendingGeolocationOrigin = null;
    private static String pendingCallType = "audio";
    public static final String NOTIFICATION_CHANNEL_GENERAL = "aeirmist_channel_general";
    public static final String NOTIFICATION_CHANNEL_MESSAGES = "aeirmist_channel_messages";

    @CapacitorPlugin(name = "NativeSettings")
    public static class NativeSettingsPlugin extends Plugin {
        private AudioFocusRequest audioFocusRequest = null;

        @PluginMethod
        public void openNotificationSettings(PluginCall call) {
            try {
                Intent intent = new Intent();
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    intent.setAction(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                    intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
                } else {
                    intent.setAction(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                    intent.setData(Uri.fromParts("package", getContext().getPackageName(), null));
                }
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                call.resolve();
            } catch (Exception e) {
                try {
                    Intent fallback = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                    fallback.setData(Uri.fromParts("package", getContext().getPackageName(), null));
                    fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(fallback);
                    call.resolve();
                } catch (Exception ex) {
                    call.reject("Failed to open notification settings: " + ex.getMessage());
                }
            }
        }

        @PluginMethod
        public void openAppPermissionSettings(PluginCall call) {
            try {
                Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.fromParts("package", getContext().getPackageName(), null));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                call.resolve();
            } catch (Exception ex) {
                call.reject("Failed to open app settings: " + ex.getMessage());
            }
        }

        private static final ExecutorService notifExecutor = Executors.newFixedThreadPool(3);

        @PluginMethod
        public void checkNotificationPermission(PluginCall call) {
            boolean granted;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                granted = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
            } else {
                granted = NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
            }
            com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
            ret.put("granted", granted);
            call.resolve(ret);
        }

        @PluginMethod
        public void requestNotificationPermission(PluginCall call) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                        pendingNotificationPermissionPluginCall = call;
                        ActivityCompat.requestPermissions(getActivity(), new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_PERMISSION_CODE);
                        return;
                    }
                }
                boolean granted = NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
                com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                ret.put("granted", granted);
                ret.put("alreadyGranted", true);
                ret.put("requested", false);
                call.resolve(ret);
            } catch (Exception ex) {
                call.reject("Permission request error: " + ex.getMessage());
            }
        }

        @PluginMethod
        public void checkLocationPermission(PluginCall call) {
            boolean fine = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
            boolean coarse = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
            com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
            ret.put("granted", fine || coarse);
            ret.put("fine", fine);
            ret.put("coarse", coarse);
            call.resolve(ret);
        }

        @PluginMethod
        public void requestLocationPermission(PluginCall call) {
            try {
                boolean fine = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
                boolean coarse = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
                if (fine || coarse) {
                    com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                    ret.put("alreadyGranted", true);
                    ret.put("granted", true);
                    ret.put("fine", fine);
                    ret.put("coarse", coarse);
                    call.resolve(ret);
                    return;
                }
                pendingLocationPermissionPluginCall = call;
                ActivityCompat.requestPermissions(getActivity(), new String[]{
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                }, LOCATION_PERMISSION_CODE);
            } catch (Exception ex) {
                call.reject("Location permission request error: " + ex.getMessage());
            }
        }

        @PluginMethod
        @SuppressWarnings("MissingPermission")
        public void showDeviceNotification(PluginCall call) {
            final String title = call.getString("title", "Aeirmist");
            final String body = call.getString("body", "");
            final String avatarUrl = call.getString("avatarUrl", null);
            final String targetUrl = call.getString("targetUrl", null);
            final String type = call.getString("type", "general");
            final int id = call.getInt("id", (int) (System.currentTimeMillis() & 0x0fffffff));

            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                        call.reject("POST_NOTIFICATIONS permission not granted");
                        return;
                    }
                }

                boolean isMsg = "message".equalsIgnoreCase(type) || "chat".equalsIgnoreCase(type) || "call".equalsIgnoreCase(type) || (type != null && type.contains("msg"));
                String channelId = isMsg ? MainActivity.NOTIFICATION_CHANNEL_MESSAGES : MainActivity.NOTIFICATION_CHANNEL_GENERAL;

                Intent intent = new Intent(getContext(), MainActivity.class);
                intent.setAction(Intent.ACTION_VIEW);
                intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                if (targetUrl != null && !targetUrl.isEmpty()) {
                    intent.putExtra("targetUrl", targetUrl);
                }

                int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    flags |= PendingIntent.FLAG_IMMUTABLE;
                }
                PendingIntent pendingIntent = PendingIntent.getActivity(getContext(), id, intent, flags);

                final NotificationCompat.Builder builder = new NotificationCompat.Builder(getContext(), channelId)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle(title)
                    .setContentText(body)
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setCategory(isMsg ? NotificationCompat.CATEGORY_MESSAGE : NotificationCompat.CATEGORY_SOCIAL)
                    .setAutoCancel(true)
                    .setContentIntent(pendingIntent)
                    .setDefaults(NotificationCompat.DEFAULT_ALL);

                if (avatarUrl != null && !avatarUrl.isEmpty() && (avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://"))) {
                    notifExecutor.execute(() -> {
                        try {
                            URL url = new URL(avatarUrl);
                            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                            connection.setConnectTimeout(2500);
                            connection.setReadTimeout(2500);
                            connection.setDoInput(true);
                            connection.connect();
                            InputStream input = connection.getInputStream();
                            Bitmap myBitmap = BitmapFactory.decodeStream(input);
                            if (myBitmap != null) {
                                builder.setLargeIcon(myBitmap);
                            }
                        } catch (Exception ignored) {
                        } finally {
                            try {
                                NotificationManagerCompat.from(getContext()).notify(id, builder.build());
                            } catch (SecurityException ignored) {
                            } catch (Exception ignored) {}
                        }
                    });
                } else {
                    NotificationManagerCompat.from(getContext()).notify(id, builder.build());
                }

                com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                ret.put("success", true);
                ret.put("id", id);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Failed to display device notification: " + e.getMessage());
            }
        }

        @PluginMethod
        public void checkCallPermissions(PluginCall call) {
            try {
                String type = call.getString("type", "audio");
                boolean hasMic = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
                boolean hasCam = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;

                boolean granted = "video".equals(type) ? (hasMic && hasCam) : hasMic;

                com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                ret.put("granted", granted);
                ret.put("microphone", hasMic);
                ret.put("camera", hasCam);
                ret.put("type", type);
                call.resolve(ret);
            } catch (Exception ex) {
                call.reject("Permission check error: " + ex.getMessage());
            }
        }

        @PluginMethod
        public void getSystemInsets(PluginCall call) {
            try {
                int topDp = 38;
                int bottomDp = 16;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && getActivity() != null) {
                    WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(getActivity().getWindow().getDecorView());
                    if (insets != null) {
                        float density = getContext().getResources().getDisplayMetrics().density;
                        androidx.core.graphics.Insets status = insets.getInsets(
                            WindowInsetsCompat.Type.statusBars() | WindowInsetsCompat.Type.displayCutout()
                        );
                        androidx.core.graphics.Insets nav = insets.getInsets(
                            WindowInsetsCompat.Type.navigationBars()
                        );
                        if (status.top > 0) topDp = Math.max(Math.round(status.top / density), 28);
                        if (nav.bottom > 0) bottomDp = Math.round(nav.bottom / density);
                    }
                }
                com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                ret.put("top", topDp);
                ret.put("bottom", bottomDp);
                call.resolve(ret);
            } catch (Exception ex) {
                call.reject("Failed to get system insets: " + ex.getMessage());
            }
        }

        @PluginMethod
        public void requestCallPermissions(PluginCall call) {
            try {
                String type = call.getString("type", "audio");
                List<String> needed = new ArrayList<>();

                // Always check microphone for calling
                if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                    needed.add(Manifest.permission.RECORD_AUDIO);
                }

                // ONLY check camera if this is a video call
                if ("video".equals(type)) {
                    if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                        needed.add(Manifest.permission.CAMERA);
                    }
                }

                if (!needed.isEmpty()) {
                    pendingCallPermissionPluginCall = call;
                    pendingCallType = type;
                    ActivityCompat.requestPermissions(getActivity(), needed.toArray(new String[0]), ALL_PERMISSIONS_CODE);
                } else {
                    com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                    ret.put("alreadyGranted", true);
                    ret.put("granted", true);
                    ret.put("microphone", true);
                    ret.put("camera", true);
                    ret.put("type", type);
                    ret.put("success", true);
                    call.resolve(ret);
                }
            } catch (Exception ex) {
                call.reject("Call permission request error: " + ex.getMessage());
            }
        }


        @PluginMethod
        public void saveMediaToDevice(PluginCall call) {
            String url = call.getString("url");
            String filename = call.getString("filename");
            if (url == null || url.isEmpty()) {
                call.reject("URL is required");
                return;
            }

            try {
                if (filename == null || filename.isEmpty()) {
                    String ext = (url.contains(".mp4") || url.contains("video")) ? ".mp4" : ".jpg";
                    filename = "Aeirmist_" + System.currentTimeMillis() + ext;
                }

                DownloadManager dm = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
                Uri downloadUri = Uri.parse(url);
                DownloadManager.Request request = new DownloadManager.Request(downloadUri);
                request.setAllowedNetworkTypes(DownloadManager.Request.NETWORK_WIFI | DownloadManager.Request.NETWORK_MOBILE);
                request.setTitle(filename);
                request.setDescription("Saving media to Aeirmist gallery...");
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);

                // Save directly to Pictures/Aeirmist so it shows in phone Gallery instantly without opening browser
                try {
                    request.setDestinationInExternalPublicDir(Environment.DIRECTORY_PICTURES, "Aeirmist/" + filename);
                } catch (Exception ignored) {
                    request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename);
                }

                dm.enqueue(request);

                com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                ret.put("success", true);
                ret.put("filename", filename);
                ret.put("message", "Media saved directly to device gallery.");
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Failed to save media to device: " + e.getMessage());
            }
        }

        @PluginMethod
        public void selectDownloadFolder(PluginCall call) {
            try {
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                        | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                        | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
                        | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
                startActivityForResult(call, intent, "folderPickerResult");
            } catch (Exception e) {
                call.reject("Failed to open folder picker: " + e.getMessage());
            }
        }

        @ActivityCallback
        private void folderPickerResult(PluginCall call, androidx.activity.result.ActivityResult result) {
            if (call == null) return;
            if (result.getResultCode() == android.app.Activity.RESULT_OK && result.getData() != null) {
                Uri treeUri = result.getData().getData();
                if (treeUri != null) {
                    final int takeFlags = Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION;
                    try {
                        getContext().getContentResolver().takePersistableUriPermission(treeUri, takeFlags);
                    } catch (Exception ignored) {}

                    String displayName = resolveFolderName(treeUri);

                    android.content.SharedPreferences prefs = getContext().getSharedPreferences("aeirmist_prefs", android.content.Context.MODE_PRIVATE);
                    prefs.edit()
                            .putString("aeirmist_download_mode", "custom")
                            .putString("aeirmist_download_custom_uri", treeUri.toString())
                            .putString("aeirmist_download_custom_name", displayName)
                            .apply();

                    com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                    ret.put("success", true);
                    ret.put("uri", treeUri.toString());
                    ret.put("name", displayName);
                    call.resolve(ret);
                    return;
                }
            }
            com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
            ret.put("canceled", true);
            call.resolve(ret);
        }

        private String resolveFolderName(Uri uri) {
            if (uri == null) return "Custom Folder";
            try {
                String docId = android.provider.DocumentsContract.getTreeDocumentId(uri);
                if (docId != null) {
                    String[] parts = docId.split(":");
                    if (parts.length > 1) {
                        return parts[1];
                    }
                    return parts[0];
                }
            } catch (Exception ignored) {}
            return uri.getLastPathSegment() != null ? uri.getLastPathSegment() : "Custom Folder";
        }

        @PluginMethod
        public void getDownloadPathConfig(PluginCall call) {
            try {
                android.content.SharedPreferences prefs = getContext().getSharedPreferences("aeirmist_prefs", android.content.Context.MODE_PRIVATE);
                String mode = prefs.getString("aeirmist_download_mode", "system_downloads");
                String customUri = prefs.getString("aeirmist_download_custom_uri", null);
                String customName = prefs.getString("aeirmist_download_custom_name", null);

                com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                ret.put("mode", mode);
                ret.put("customUri", customUri);
                ret.put("customName", customName);
                ret.put("isAvailable", true);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Failed to get download config: " + e.getMessage());
            }
        }

        @PluginMethod
        public void setDownloadMode(PluginCall call) {
            try {
                String mode = call.getString("mode", "system_downloads");
                android.content.SharedPreferences prefs = getContext().getSharedPreferences("aeirmist_prefs", android.content.Context.MODE_PRIVATE);
                prefs.edit().putString("aeirmist_download_mode", mode).apply();
                call.resolve();
            } catch (Exception e) {
                call.reject("Failed to set download mode: " + e.getMessage());
            }
        }

        @PluginMethod
        public void resetDownloadPath(PluginCall call) {
            try {
                android.content.SharedPreferences prefs = getContext().getSharedPreferences("aeirmist_prefs", android.content.Context.MODE_PRIVATE);
                prefs.edit()
                        .putString("aeirmist_download_mode", "system_downloads")
                        .remove("aeirmist_download_custom_uri")
                        .remove("aeirmist_download_custom_name")
                        .apply();
                call.resolve();
            } catch (Exception e) {
                call.reject("Failed to reset download path: " + e.getMessage());
            }
        }

        @PluginMethod
        public void setAudioMode(PluginCall call) {
            try {
                String mode = call.getString("mode", "normal");
                boolean speaker = call.getBoolean("speaker", true);
                AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
                if (am != null) {
                    if ("communication".equals(mode)) {
                        am.setMode(AudioManager.MODE_IN_COMMUNICATION);
                        try {
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                                if (audioFocusRequest == null) {
                                    AudioAttributes playbackAttributes = new AudioAttributes.Builder()
                                        .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                                        .build();
                                    audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                                        .setAudioAttributes(playbackAttributes)
                                        .setAcceptsDelayedFocusGain(true)
                                        .setOnAudioFocusChangeListener(focusChange -> {})
                                        .build();
                                }
                                am.requestAudioFocus(audioFocusRequest);
                            } else {
                                am.requestAudioFocus(null, AudioManager.STREAM_VOICE_CALL, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT);
                            }
                        } catch (Exception ignored) {}

                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                            List<AudioDeviceInfo> devices = am.getAvailableCommunicationDevices();
                            AudioDeviceInfo targetDevice = null;
                            if (speaker) {
                                for (AudioDeviceInfo d : devices) {
                                    if (d.getType() == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER) {
                                        targetDevice = d;
                                        break;
                                    }
                                }
                            } else {
                                for (AudioDeviceInfo d : devices) {
                                    int type = d.getType();
                                    if (type == AudioDeviceInfo.TYPE_BUILTIN_EARPIECE ||
                                        type == AudioDeviceInfo.TYPE_WIRED_HEADSET ||
                                        type == AudioDeviceInfo.TYPE_WIRED_HEADPHONES ||
                                        type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO ||
                                        type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP) {
                                        targetDevice = d;
                                        break;
                                    }
                                }
                            }
                            if (targetDevice != null) {
                                am.setCommunicationDevice(targetDevice);
                            } else {
                                am.clearCommunicationDevice();
                            }
                            am.setSpeakerphoneOn(speaker);
                        } else {
                            am.setSpeakerphoneOn(speaker);
                        }
                    } else {
                        try {
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                                if (audioFocusRequest != null) {
                                    am.abandonAudioFocusRequest(audioFocusRequest);
                                    audioFocusRequest = null;
                                }
                            } else {
                                am.abandonAudioFocus(null);
                            }
                        } catch (Exception ignored) {}

                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                            am.clearCommunicationDevice();
                        }
                        am.setSpeakerphoneOn(false);
                        am.setMode(AudioManager.MODE_NORMAL);
                    }
                }
                com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                ret.put("success", true);
                ret.put("speaker", speaker);
                ret.put("mode", mode);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Failed to set audio mode: " + e.getMessage());
            }
        }

        @PluginMethod
        public void performHaptics(PluginCall call) {
            try {
                String type = call.getString("type", "light");
                Vibrator vibrator = null;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    VibratorManager vm = (VibratorManager) getContext().getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                    if (vm != null) vibrator = vm.getDefaultVibrator();
                }
                if (vibrator == null) {
                    vibrator = (Vibrator) getContext().getSystemService(Context.VIBRATOR_SERVICE);
                }

                if (vibrator != null && vibrator.hasVibrator()) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        int effectId = VibrationEffect.EFFECT_CLICK;
                        if ("heavy".equalsIgnoreCase(type)) {
                            effectId = VibrationEffect.EFFECT_HEAVY_CLICK;
                        } else if ("tick".equalsIgnoreCase(type) || "light".equalsIgnoreCase(type) || "selection".equalsIgnoreCase(type)) {
                            effectId = VibrationEffect.EFFECT_TICK;
                        } else if ("double_click".equalsIgnoreCase(type) || "medium".equalsIgnoreCase(type) || "success".equalsIgnoreCase(type)) {
                            effectId = VibrationEffect.EFFECT_DOUBLE_CLICK;
                        }
                        vibrator.vibrate(VibrationEffect.createPredefined(effectId));
                    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        long duration = "heavy".equalsIgnoreCase(type) ? 35 : ("medium".equalsIgnoreCase(type) ? 22 : 12);
                        int amplitude = "heavy".equalsIgnoreCase(type) ? 255 : ("medium".equalsIgnoreCase(type) ? 180 : 90);
                        vibrator.vibrate(VibrationEffect.createOneShot(duration, amplitude));
                    } else {
                        vibrator.vibrate(15);
                    }
                }
                call.resolve();
            } catch (Exception ignored) {
                call.resolve();
            }
        }

        @PluginMethod
        public void checkBiometrics(PluginCall call) {
            try {
                BiometricManager bm = BiometricManager.from(getContext());
                int canAuth = bm.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.BIOMETRIC_WEAK);
                boolean available = (canAuth == BiometricManager.BIOMETRIC_SUCCESS);
                com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                ret.put("available", available);
                ret.put("status", canAuth);
                call.resolve(ret);
            } catch (Exception e) {
                com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                ret.put("available", false);
                ret.put("error", e.getMessage());
                call.resolve(ret);
            }
        }

        @PluginMethod
        public void authenticateBiometrics(PluginCall call) {
            try {
                final String title = call.getString("title", "Aeirmist Vault");
                final String subtitle = call.getString("subtitle", "Verify your fingerprint or face to unlock");
                final String cancelText = call.getString("cancelText", "Use Passcode");

                getActivity().runOnUiThread(() -> {
                    try {
                        BiometricManager bm = BiometricManager.from(getContext());
                        int canAuth = bm.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.BIOMETRIC_WEAK);
                        if (canAuth != BiometricManager.BIOMETRIC_SUCCESS) {
                            call.reject("Biometrics not available or not configured on this device");
                            return;
                        }

                        BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
                            .setTitle(title)
                            .setSubtitle(subtitle)
                            .setNegativeButtonText(cancelText)
                            .build();

                        BiometricPrompt biometricPrompt = new BiometricPrompt(
                            getActivity(),
                            ContextCompat.getMainExecutor(getContext()),
                            new BiometricPrompt.AuthenticationCallback() {
                                @Override
                                public void onAuthenticationError(int errorCode, CharSequence errString) {
                                    super.onAuthenticationError(errorCode, errString);
                                    call.reject(errString.toString());
                                }

                                @Override
                                public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                                    super.onAuthenticationSucceeded(result);
                                    com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                                    ret.put("success", true);
                                    call.resolve(ret);
                                }

                                @Override
                                public void onAuthenticationFailed() {
                                    super.onAuthenticationFailed();
                                }
                            }
                        );

                        biometricPrompt.authenticate(promptInfo);
                    } catch (Exception ex) {
                        call.reject("Biometric prompt error: " + ex.getMessage());
                    }
                });
            } catch (Exception e) {
                call.reject("Failed to trigger biometrics: " + e.getMessage());
            }
        }
    }

    private android.webkit.PermissionRequest pendingPermissionRequest = null;

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                NotificationChannel channelGeneral = new NotificationChannel(
                    NOTIFICATION_CHANNEL_GENERAL,
                    "Aeirmist Notifications",
                    NotificationManager.IMPORTANCE_HIGH
                );
                channelGeneral.setDescription("Real-time notifications for likes, comments, mentions, and updates");
                channelGeneral.enableLights(true);
                channelGeneral.setLightColor(0xFF00F2FE);
                channelGeneral.enableVibration(true);
                channelGeneral.setVibrationPattern(new long[]{0, 200, 100, 200});
                channelGeneral.setShowBadge(true);

                NotificationChannel channelMessages = new NotificationChannel(
                    NOTIFICATION_CHANNEL_MESSAGES,
                    "Aeirmist Messages",
                    NotificationManager.IMPORTANCE_HIGH
                );
                channelMessages.setDescription("Direct messages, chats and call alerts");
                channelMessages.enableLights(true);
                channelMessages.setLightColor(0xFF4FACFE);
                channelMessages.enableVibration(true);
                channelMessages.setVibrationPattern(new long[]{0, 250, 150, 250});
                channelMessages.setShowBadge(true);

                notificationManager.createNotificationChannel(channelGeneral);
                notificationManager.createNotificationChannel(channelMessages);
            }
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleNotificationIntent(intent);
    }

    private void handleNotificationIntent(Intent intent) {
        if (intent == null) return;
        String targetUrl = intent.getStringExtra("targetUrl");
        if (targetUrl != null && !targetUrl.isEmpty()) {
            runOnUiThread(() -> {
                try {
                    if (this.bridge != null && this.bridge.getWebView() != null) {
                        String js = "window.dispatchEvent(new CustomEvent('aeirmist_notification_click', { detail: { url: '" + targetUrl.replace("'", "\\'") + "' } }));";
                        this.bridge.getWebView().evaluateJavascript(js, null);
                    }
                } catch (Exception ignored) {}
            });
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeSettingsPlugin.class);
        super.onCreate(savedInstanceState);
        createNotificationChannels();

        // Configure camera cutout and edge-to-edge insets
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                WindowManager.LayoutParams lp = getWindow().getAttributes();
                lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
                getWindow().setAttributes(lp);
            }

            WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
            getWindow().setStatusBarColor(Color.TRANSPARENT);
            getWindow().setNavigationBarColor(Color.TRANSPARENT);

            WindowInsetsControllerCompat insetsController = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
            if (insetsController != null) {
                insetsController.setAppearanceLightStatusBars(false);
                insetsController.setAppearanceLightNavigationBars(false);
            }

            ViewCompat.setOnApplyWindowInsetsListener(getWindow().getDecorView(), (v, windowInsets) -> {
                androidx.core.graphics.Insets statusBarInsets = windowInsets.getInsets(
                    WindowInsetsCompat.Type.statusBars() | WindowInsetsCompat.Type.displayCutout()
                );
                androidx.core.graphics.Insets navInsets = windowInsets.getInsets(
                    WindowInsetsCompat.Type.navigationBars()
                );
                float density = getResources().getDisplayMetrics().density;
                int topDp = Math.max(Math.round(statusBarInsets.top / density), 38);
                int bottomDp = Math.max(Math.round(navInsets.bottom / density), 16);

                runOnUiThread(() -> {
                    try {
                        if (this.bridge != null && this.bridge.getWebView() != null) {
                            String js = String.format(Locale.US,
                                "(function(){" +
                                "document.documentElement.style.setProperty('--sat', '%dpx');" +
                                "document.documentElement.style.setProperty('--sab', '%dpx');" +
                                "document.documentElement.style.setProperty('--safe-area-inset-top', '%dpx');" +
                                "document.documentElement.style.setProperty('--safe-area-inset-bottom', '%dpx');" +
                                "document.documentElement.classList.add('is-native-app');" +
                                "})();",
                                topDp, bottomDp, topDp, bottomDp);
                            this.bridge.getWebView().evaluateJavascript(js, null);
                        }
                    } catch (Exception ignored) {}
                });
                return windowInsets;
            });
        } catch (Exception ignored) {}

        // Cold start notification intent check
        handleNotificationIntent(getIntent());

        try {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                WebView webView = this.bridge.getWebView();
                // Let Chromium handle GPU compositing dynamically to save VRAM on budget Mali/PowerVR GPUs
                webView.setLayerType(View.LAYER_TYPE_NONE, null);
                // Prevent white flash during cold start or configuration change
                webView.setBackgroundColor(0xFF050508);

                WebSettings settings = webView.getSettings();
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                settings.setLoadsImagesAutomatically(true);
                settings.setGeolocationEnabled(true);
                settings.setAllowFileAccess(true);
                // HTML5 video autoplay handles muted stories/reels; keep user gesture policy clean
                settings.setMediaPlaybackRequiresUserGesture(false);
                settings.setCacheMode(WebSettings.LOAD_DEFAULT);
                settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

                final android.webkit.WebChromeClient defaultChromeClient = webView.getWebChromeClient();
                webView.setWebChromeClient(new android.webkit.WebChromeClient() {
                    @Override
                    public void onGeolocationPermissionsShowPrompt(final String origin, final android.webkit.GeolocationPermissions.Callback callback) {
                        runOnUiThread(() -> {
                            boolean hasLocation = ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                                                  ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
                            if (hasLocation) {
                                callback.invoke(origin, true, false);
                            } else {
                                pendingGeolocationCallback = callback;
                                pendingGeolocationOrigin = origin;
                                ActivityCompat.requestPermissions(MainActivity.this, new String[]{
                                    Manifest.permission.ACCESS_FINE_LOCATION,
                                    Manifest.permission.ACCESS_COARSE_LOCATION
                                }, LOCATION_PERMISSION_CODE);
                            }
                        });
                    }

                    @Override
                    public void onGeolocationPermissionsHidePrompt() {
                        pendingGeolocationCallback = null;
                        pendingGeolocationOrigin = null;
                    }

                    @Override
                    public void onPermissionRequest(final android.webkit.PermissionRequest request) {
                        runOnUiThread(() -> {
                            try {
                                List<String> needed = new ArrayList<>();
                                for (String res : request.getResources()) {
                                    if (android.webkit.PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(res)) {
                                        if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                                            needed.add(Manifest.permission.CAMERA);
                                        }
                                    } else if (android.webkit.PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(res)) {
                                        if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                                            needed.add(Manifest.permission.RECORD_AUDIO);
                                        }
                                    }
                                }

                                if (!needed.isEmpty()) {
                                    pendingPermissionRequest = request;
                                    ActivityCompat.requestPermissions(MainActivity.this, needed.toArray(new String[0]), ALL_PERMISSIONS_CODE);
                                } else {
                                    request.grant(request.getResources());
                                }
                            } catch (Exception e) {
                                try {
                                    request.grant(request.getResources());
                                } catch (Exception ex) {
                                    request.deny();
                                }
                            }
                        });
                    }

                    @Override
                    public boolean onShowFileChooser(WebView webView, android.webkit.ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                        if (defaultChromeClient != null) {
                            return defaultChromeClient.onShowFileChooser(webView, filePathCallback, fileChooserParams);
                        }
                        return super.onShowFileChooser(webView, filePathCallback, fileChooserParams);
                    }

                    @Override
                    public boolean onConsoleMessage(android.webkit.ConsoleMessage consoleMessage) {
                        if (defaultChromeClient != null) {
                            return defaultChromeClient.onConsoleMessage(consoleMessage);
                        }
                        return super.onConsoleMessage(consoleMessage);
                    }
                });

                webView.post(() -> injectSystemInsets());
                webView.postDelayed(() -> injectSystemInsets(), 400);
                webView.postDelayed(() -> injectSystemInsets(), 1200);
            }
        } catch (Exception ignored) {
        }
        handleNotificationIntent(getIntent());
    }

    @Override
    public void onResume() {
        super.onResume();
        injectSystemInsets();
    }

    private void injectSystemInsets() {
        try {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(getWindow().getDecorView());
                int topDp = 38;
                int bottomDp = 16;
                if (insets != null) {
                    float density = getResources().getDisplayMetrics().density;
                    androidx.core.graphics.Insets status = insets.getInsets(
                        WindowInsetsCompat.Type.statusBars() | WindowInsetsCompat.Type.displayCutout()
                    );
                    androidx.core.graphics.Insets nav = insets.getInsets(
                        WindowInsetsCompat.Type.navigationBars()
                    );
                    if (status.top > 0) topDp = Math.max(Math.round(status.top / density), 28);
                    if (nav.bottom > 0) bottomDp = Math.max(Math.round(nav.bottom / density), 16);
                }
                String js = String.format(Locale.US,
                    "(function(){" +
                    "document.documentElement.style.setProperty('--sat', '%dpx');" +
                    "document.documentElement.style.setProperty('--sab', '%dpx');" +
                    "document.documentElement.style.setProperty('--safe-area-inset-top', '%dpx');" +
                    "document.documentElement.style.setProperty('--safe-area-inset-bottom', '%dpx');" +
                    "document.documentElement.classList.add('is-native-app');" +
                    "window.dispatchEvent(new CustomEvent('aeirmist_insets_changed', { detail: { top: %d, bottom: %d } }));" +
                    "})();",
                    topDp, bottomDp, topDp, bottomDp, topDp, bottomDp);
                this.bridge.getWebView().evaluateJavascript(js, null);
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode == NOTIFICATION_PERMISSION_CODE) {
            if (pendingNotificationPermissionPluginCall != null) {
                runOnUiThread(() -> {
                    try {
                        boolean granted;
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                            granted = ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
                        } else {
                            granted = NotificationManagerCompat.from(this).areNotificationsEnabled();
                        }
                        com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                        ret.put("granted", granted);
                        ret.put("requested", true);
                        if (pendingNotificationPermissionPluginCall != null) {
                            pendingNotificationPermissionPluginCall.resolve(ret);
                        }
                    } catch (Exception ignored) {
                    } finally {
                        pendingNotificationPermissionPluginCall = null;
                    }
                });
            }
        }

        if (requestCode == LOCATION_PERMISSION_CODE) {
            runOnUiThread(() -> {
                boolean fine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
                boolean coarse = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
                boolean granted = fine || coarse;

                if (pendingGeolocationCallback != null && pendingGeolocationOrigin != null) {
                    try {
                        pendingGeolocationCallback.invoke(pendingGeolocationOrigin, granted, false);
                    } catch (Exception ignored) {}
                    pendingGeolocationCallback = null;
                    pendingGeolocationOrigin = null;
                }

                if (pendingLocationPermissionPluginCall != null) {
                    try {
                        com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                        ret.put("granted", granted);
                        ret.put("fine", fine);
                        ret.put("coarse", coarse);
                        ret.put("requested", true);
                        pendingLocationPermissionPluginCall.resolve(ret);
                    } catch (Exception ignored) {
                    } finally {
                        pendingLocationPermissionPluginCall = null;
                    }
                }
            });
        }

        if (requestCode == ALL_PERMISSIONS_CODE) {
            if (pendingCallPermissionPluginCall != null) {
                runOnUiThread(() -> {
                    try {
                        boolean hasMic = ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
                        boolean hasCam = ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
                        boolean granted = "video".equals(pendingCallType) ? (hasMic && hasCam) : hasMic;
                        com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                        ret.put("granted", granted);
                        ret.put("microphone", hasMic);
                        ret.put("camera", hasCam);
                        ret.put("type", pendingCallType);
                        ret.put("alreadyGranted", false);
                        ret.put("success", true);
                        if (pendingCallPermissionPluginCall != null) {
                            pendingCallPermissionPluginCall.resolve(ret);
                        }
                    } catch (Exception ignored) {
                    } finally {
                        pendingCallPermissionPluginCall = null;
                    }
                });
            }

            if (pendingPermissionRequest != null) {
                runOnUiThread(() -> {
                    try {
                        List<String> grantedResources = new ArrayList<>();
                        for (String res : pendingPermissionRequest.getResources()) {
                            if (android.webkit.PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(res)) {
                                if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                                    grantedResources.add(res);
                                }
                            } else if (android.webkit.PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(res)) {
                                if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                                    grantedResources.add(res);
                                }
                            }
                        }
                        if (!grantedResources.isEmpty()) {
                            pendingPermissionRequest.grant(grantedResources.toArray(new String[0]));
                        } else {
                            pendingPermissionRequest.deny();
                        }
                    } catch (Exception ignored) {
                        try {
                            pendingPermissionRequest.deny();
                        } catch (Exception ignored2) {}
                    } finally {
                        pendingPermissionRequest = null;
                    }
                });
            }
        }
    }

    @Override
    public void onTrimMemory(int level) {
        super.onTrimMemory(level);
        try {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                WebView webView = this.bridge.getWebView();
                // Only purge ephemeral resources under critical memory pressure, preserving disk cache
                if (level == TRIM_MEMORY_RUNNING_CRITICAL || level == TRIM_MEMORY_COMPLETE) {
                    webView.freeMemory();
                }
            }
        } catch (Exception ignored) {
        }
    }
}
