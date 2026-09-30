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
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.ActivityCallback;

public class MainActivity extends BridgeActivity {
    private static final int NOTIFICATION_PERMISSION_CODE = 1001;
    private static final int ALL_PERMISSIONS_CODE = 1002;

    @CapacitorPlugin(name = "NativeSettings")
    public static class NativeSettingsPlugin extends Plugin {
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
        public void requestNotificationPermission(PluginCall call) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                        ActivityCompat.requestPermissions(getActivity(), new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_PERMISSION_CODE);
                    }
                }
                call.resolve();
            } catch (Exception ex) {
                call.reject("Permission request error: " + ex.getMessage());
            }
        }

        @PluginMethod
        public void requestAllPermissions(PluginCall call) {
            try {
                List<String> neededPermissions = new ArrayList<>();

                // Camera
                if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                    neededPermissions.add(Manifest.permission.CAMERA);
                }

                // Microphone
                if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                    neededPermissions.add(Manifest.permission.RECORD_AUDIO);
                }

                // Location
                if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                    neededPermissions.add(Manifest.permission.ACCESS_FINE_LOCATION);
                }
                if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                    neededPermissions.add(Manifest.permission.ACCESS_COARSE_LOCATION);
                }

                // Storage & Media
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_MEDIA_IMAGES) != PackageManager.PERMISSION_GRANTED) {
                        neededPermissions.add(Manifest.permission.READ_MEDIA_IMAGES);
                    }
                    if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_MEDIA_VIDEO) != PackageManager.PERMISSION_GRANTED) {
                        neededPermissions.add(Manifest.permission.READ_MEDIA_VIDEO);
                    }
                    // Notifications on Android 13+
                    if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                        neededPermissions.add(Manifest.permission.POST_NOTIFICATIONS);
                    }
                } else {
                    if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                        neededPermissions.add(Manifest.permission.READ_EXTERNAL_STORAGE);
                    }
                    if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.Q) {
                        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                            neededPermissions.add(Manifest.permission.WRITE_EXTERNAL_STORAGE);
                        }
                    }
                }

                if (!neededPermissions.isEmpty()) {
                    String[] permArray = neededPermissions.toArray(new String[0]);
                    ActivityCompat.requestPermissions(getActivity(), permArray, ALL_PERMISSIONS_CODE);
                }

                com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
                ret.put("requestedCount", neededPermissions.size());
                ret.put("success", true);
                call.resolve(ret);
            } catch (Exception ex) {
                call.reject("All permissions request error: " + ex.getMessage());
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
    }

    private android.webkit.PermissionRequest pendingPermissionRequest = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeSettingsPlugin.class);
        super.onCreate(savedInstanceState);

        // Proactively ensure Camera & Microphone permissions are requested so calls never get blocked
        try {
            List<String> startupPerms = new ArrayList<>();
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                startupPerms.add(Manifest.permission.CAMERA);
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                startupPerms.add(Manifest.permission.RECORD_AUDIO);
            }
            if (!startupPerms.isEmpty()) {
                ActivityCompat.requestPermissions(this, startupPerms.toArray(new String[0]), ALL_PERMISSIONS_CODE);
            }
        } catch (Exception ignored) {}

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
            }
        } catch (Exception ignored) {
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == ALL_PERMISSIONS_CODE && pendingPermissionRequest != null) {
            runOnUiThread(() -> {
                try {
                    pendingPermissionRequest.grant(pendingPermissionRequest.getResources());
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
