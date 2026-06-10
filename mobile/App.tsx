import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  Share,
  StatusBar as NativeStatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView, WebViewNavigation } from "react-native-webview";

import { FRONTEND_URL, API_BASE_URL } from "./src/config";
import LoginScreen, { AuthCredentials } from "./src/LoginScreen";

type LoginResolver = { resolve: () => void; reject: (e: Error) => void };
type WebViewMessage = {
  lang?: string;
  message?: string;
  requestId?: string;
  text?: string;
  title?: string;
  token?: string;
  type: string;
  url?: string;
};

// Set foreground notification behaviour (show alert + badge + sound while app is open)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Requests notification permission and registers the Expo push token with the
 * backend. Called once after the user successfully logs in.
 * `getAuthToken` is a callback that returns the current JWT access token.
 */
async function registerForPushNotifications(webViewRef: React.RefObject<WebView>): Promise<void> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return;

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const expoToken = tokenData.data;

    // Delegate the API call to the WebView so it uses the existing session
    // (including cookie-based token refresh) rather than a potentially stale JWT snapshot.
    webViewRef.current?.injectJavaScript(
      `(async function(){try{` +
      `await fetch('/api/push/register',{method:'POST',headers:{'Content-Type':'application/json'},` +
      `body:JSON.stringify({token:${JSON.stringify(expoToken)}})});` +
      `}catch(e){}})();true;`
    );
  } catch {
    // Non-critical — notifications simply won't work if this fails
  }
}

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [webViewKey, setWebViewKey] = useState(0);
  const [showLogin, setShowLogin] = useState(false);
  const [lang, setLang] = useState<"es" | "en">(() => {
    try {
      const locale = Intl.DateTimeFormat().resolvedOptions().locale || "";
      return locale.toLowerCase().startsWith("en") ? "en" : "es";
    } catch {
      return "es";
    }
  });
  // Deep-link URL: if the app was opened via a universal/app link, load that URL instead
  const [initialUrl, setInitialUrl] = useState(FRONTEND_URL);
  // Track how many times we've auto-retried to avoid infinite loops
  const autoRetryCountRef = useRef(0);
  // Mirror of hasError for use in AppState callback (avoids stale closure)
  const hasErrorRef = useRef(false);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const webViewRef = useRef<WebView>(null);
  const loginResolverRef = useRef<LoginResolver | null>(null);
  const currentUrlRef = useRef(FRONTEND_URL);

  // Handle Android hardware back button — go back in WebView history instead of exiting.
  // We track the current URL rather than relying on state.canGoBack, because
  // history.replaceState() calls in the web app don't trigger onNavigationStateChange
  // on Android, leaving canGoBack stale.
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const { BackHandler } = require("react-native");
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!webViewRef.current) return false;
      // Only intercept when we're on a sub-page (all inner pages live under /pages/)
      const url = currentUrlRef.current;
      const isRootPage =
        url === FRONTEND_URL ||
        url === `${FRONTEND_URL}/` ||
        url.endsWith("/index.html") ||
        (!url.includes("/pages/") && !url.includes("/auth"));
      if (isRootPage) return false; // let system handle (exit/minimize)
      webViewRef.current.goBack();
      return true;
    });
    return () => handler.remove();
  }, []);

  // Resolve the initial URL from a cold-start deep link
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url && url.startsWith("https://")) {
        setInitialUrl(url);
      }
    });
  }, []);

  // Handle deep links while the app is already running (foreground or background resume)
  useEffect(() => {
    const sub = Linking.addEventListener("url", ({ url }) => {
      if (url && url.startsWith("https://") && webViewRef.current) {
        webViewRef.current.injectJavaScript(
          `window.location.href = ${JSON.stringify(url)}; true;`
        );
      }
    });
    return () => sub.remove();
  }, []);

  // Safety-net: hide spinner after 15 s in case load events don't fire
  useEffect(() => {
    if (!isLoading) return;
    timeoutRef.current = setTimeout(() => setIsLoading(false), 15000);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isLoading, webViewKey]);

  function finishLoading() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsLoading(false);
  }

  function retry() {
    autoRetryCountRef.current = 0;
    hasErrorRef.current = false;
    // Clear cached responses so a stale error page isn't served again
    webViewRef.current?.clearCache?.(true);
    setHasError(false);
    setIsLoading(true);
    setShowLogin(false);
    setWebViewKey((k) => k + 1);
  }

  // Auto-recover when the app is foregrounded while an error is shown
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && hasErrorRef.current) {
        retry();
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show native login when WebView navigates to auth.html
  const onNavigationStateChange = useCallback((state: WebViewNavigation) => {
    currentUrlRef.current = state.url;
    const isAuthPage = state.url.includes("auth.html");
    setShowLogin(isAuthPage);
    if (!isAuthPage) {
      loginResolverRef.current?.resolve();
      loginResolverRef.current = null;
    }
  }, []);

  // Handle LOGIN_SUCCESS / LOGIN_ERROR messages from injected scripts
  const sendShareResult = useCallback((requestId: string | undefined, status: "received" | "completed" | "error", message?: string) => {
    if (!requestId) return;
    const payload = JSON.stringify({ type: "SHARE_RESULT", requestId, status, message });
    webViewRef.current?.injectJavaScript(
      `window.__ONCE_METROS_NATIVE_SHARE_RESULT__&&window.__ONCE_METROS_NATIVE_SHARE_RESULT__(${payload});true;`
    );
  }, []);

  const onMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    let data: WebViewMessage;
    try { data = JSON.parse(event.nativeEvent.data); } catch { return; }
    if (data.type === "LOGIN_SUCCESS") {
      loginResolverRef.current?.resolve();
      loginResolverRef.current = null;
      // Navigate the WebView to the main page so auth.html is no longer shown
      webViewRef.current?.injectJavaScript(`window.location.href = '${FRONTEND_URL}'; true;`);
      // Register for push notifications now that the user is logged in
      registerForPushNotifications(webViewRef);
      // setShowLogin will be cleared by onNavigationStateChange when URL changes
    } else if (data.type === "TOKEN_FOR_PUSH") {
      // Legacy message — no longer used but kept to avoid errors from old builds
      void 0;
    } else if (data.type === "LOGIN_ERROR") {
      loginResolverRef.current?.reject(new Error(data.message || "Error al iniciar sesión"));
      loginResolverRef.current = null;
    } else if (data.type === "SHARE") {
      const shareMsg = `${data.text || ""} ${data.url || ""}`.trim();
      sendShareResult(data.requestId, "received");
      Share.share({
        title: data.title || "",
        message: shareMsg,
        url: data.url || "",
      })
        .then(() => sendShareResult(data.requestId, "completed"))
        .catch((error) => sendShareResult(data.requestId, "error", error?.message || "No se pudo compartir"));
    } else if (data.type === "ALERT") {
      Alert.alert("Once Metros", data.message || "");
    } else if (data.type === "LANG") {
      const l = data.lang === "en" ? "en" : "es";
      setLang(l);
    }
  }, [sendShareResult]);

  // Inject the API call into the WebView so the httpOnly cookie is set in its own cookie jar
  const handleNativeSubmit = useCallback((credentials: AuthCredentials): Promise<void> => {
    return new Promise((resolve, reject) => {
      loginResolverRef.current = { resolve, reject };
      let js: string;
      if (credentials.type === "login") {
        const creds = JSON.stringify({ identificador: credentials.identificador, password: credentials.password });
        js = `(async()=>{try{await API.login(${creds});window.ReactNativeWebView.postMessage(JSON.stringify({type:'LOGIN_SUCCESS'}));}catch(e){window.ReactNativeWebView.postMessage(JSON.stringify({type:'LOGIN_ERROR',message:e.message}));}})();true;`;
      } else if (credentials.type === "register") {
        const creds = JSON.stringify({ username: credentials.username, nombre: credentials.nombre, email: credentials.email, password: credentials.password });
        js = `(async()=>{try{await API.register(${creds});window.ReactNativeWebView.postMessage(JSON.stringify({type:'LOGIN_SUCCESS'}));}catch(e){window.ReactNativeWebView.postMessage(JSON.stringify({type:'LOGIN_ERROR',message:e.message}));}})();true;`;
      } else {
        // google — send code + PKCE verifier to backend for server-side token exchange
        const params = JSON.stringify({ code: credentials.code, codeVerifier: credentials.codeVerifier, redirectUri: credentials.redirectUri });
        js = `(async()=>{try{await API.loginWithGoogleCode(${params});window.ReactNativeWebView.postMessage(JSON.stringify({type:'LOGIN_SUCCESS'}));}catch(e){window.ReactNativeWebView.postMessage(JSON.stringify({type:'LOGIN_ERROR',message:e.message}));}})();true;`;
      }
      webViewRef.current?.injectJavaScript(js);
    });
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        {hasError ? (
          <View style={styles.centered}>
            <Text style={styles.title}>No se pudo cargar Once Metros</Text>
            <Text style={styles.message}>
              Revisá tu conexión a internet e intentá nuevamente.
            </Text>
            <Pressable style={styles.retryButton} onPress={retry}>
              <Text style={styles.retryText}>Reintentar</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <WebView
              key={webViewKey}
              ref={webViewRef}
              source={{ uri: initialUrl }}
              style={styles.webView}
              // Allow both https and http so redirects don't get blocked
              originWhitelist={["https://*", "http://*"]}
              // Mark the WebView context so the web app can adapt (e.g. hide Google auth)
              injectedJavaScriptBeforeContentLoaded={`window.__ONCE_METROS_NATIVE_WEBVIEW__=true;true;`}
              javaScriptEnabled
              domStorageEnabled
              // Prevent Android system font-size setting from scaling down WebView content
              textZoom={100}
              sharedCookiesEnabled
              thirdPartyCookiesEnabled
              cacheEnabled
              pullToRefreshEnabled={Platform.OS === "android"}
              keyboardDisplayRequiresUserAction={false}
              setSupportMultipleWindows={false}
              onLoadStart={() => {
                setHasError(false);
                setIsLoading(true);
              }}
              // onLoad fires when main document has loaded (more reliable on Android)
              onLoad={() => {
                finishLoading();
                // Read the user's stored language preference from the WebView's localStorage
                // so the native LoginScreen can show the correct language.
                webViewRef.current?.injectJavaScript(
                  `(function(){var l=localStorage.getItem('once_metros_lang');` +
                  `if(l)window.ReactNativeWebView.postMessage(JSON.stringify({type:'LANG',lang:l}));})();true;`
                );
                // If already logged in (e.g. app installed while session exists), request
                // push token registration without waiting for a new login.
                registerForPushNotifications(webViewRef);
              }}
              // onLoadEnd as fallback
              onLoadEnd={finishLoading}
              onError={() => {
                finishLoading();
                // Auto-retry up to 3 times on transient network errors (gives Azure
                // cold-start enough time to warm up) before showing the error screen.
                if (autoRetryCountRef.current < 3) {
                  autoRetryCountRef.current += 1;
                  const delay = autoRetryCountRef.current === 1 ? 3000 : 6000;
                  setTimeout(() => {
                    webViewRef.current?.clearCache?.(true);
                    setHasError(false);
                    setIsLoading(true);
                    setWebViewKey((k) => k + 1);
                  }, delay);
                } else {
                  hasErrorRef.current = true;
                  setHasError(true);
                }
              }}
              onHttpError={(e) => {
                finishLoading();
                if (e.nativeEvent.statusCode >= 500) {
                  hasErrorRef.current = true;
                  setHasError(true);
                }
                // 4xx errors are handled by the web app itself
              }}
              onNavigationStateChange={onNavigationStateChange}
              onMessage={onMessage}
            />
            {isLoading ? (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator color="#00c853" size="large" />
              </View>
            ) : null}
            {showLogin ? (
              <LoginScreen onSubmit={handleNativeSubmit} lang={lang} />
            ) : null}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0a0a0f",
    paddingTop: Platform.OS === "android" ? NativeStatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
    backgroundColor: "#0a0a0f",
  },
  webView: {
    flex: 1,
    backgroundColor: "#0a0a0f",
  },
  loadingOverlay: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    alignItems: "center",
    backgroundColor: "#0a0a0f",
    justifyContent: "center",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  title: {
    color: "#e8ede9",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  message: {
    color: "#5D6965",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#165A4A",
    borderRadius: 8,
    minWidth: 136,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  retryText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
});
