import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar as NativeStatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView, WebViewNavigation } from "react-native-webview";

import { FRONTEND_URL } from "./src/config";
import LoginScreen, { AuthCredentials } from "./src/LoginScreen";

type LoginResolver = { resolve: () => void; reject: (e: Error) => void };

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [webViewKey, setWebViewKey] = useState(0);
  const [showLogin, setShowLogin] = useState(false);
  // Deep-link URL: if the app was opened via a universal/app link, load that URL instead
  const [initialUrl, setInitialUrl] = useState(FRONTEND_URL);
  // Track how many times we've auto-retried to avoid infinite loops
  const autoRetryCountRef = useRef(0);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const webViewRef = useRef<WebView>(null);
  const loginResolverRef = useRef<LoginResolver | null>(null);

  // Resolve the initial URL from a cold-start deep link
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url && url.startsWith("https://")) {
        setInitialUrl(url);
      }
    });
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
    setHasError(false);
    setIsLoading(true);
    setShowLogin(false);
    setWebViewKey((k) => k + 1);
  }

  // Show native login when WebView navigates to auth.html
  const onNavigationStateChange = useCallback((state: WebViewNavigation) => {
    const isAuthPage = state.url.includes("auth.html");
    setShowLogin(isAuthPage);
    if (!isAuthPage) {
      loginResolverRef.current?.resolve();
      loginResolverRef.current = null;
    }
  }, []);

  // Handle LOGIN_SUCCESS / LOGIN_ERROR messages from injected scripts
  const onMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    let data: { type: string; message?: string };
    try { data = JSON.parse(event.nativeEvent.data); } catch { return; }
    if (data.type === "LOGIN_SUCCESS") {
      loginResolverRef.current?.resolve();
      loginResolverRef.current = null;
      // Navigate the WebView to the main page so auth.html is no longer shown
      webViewRef.current?.injectJavaScript(`window.location.href = '${FRONTEND_URL}'; true;`);
      // setShowLogin will be cleared by onNavigationStateChange when URL changes
    } else if (data.type === "LOGIN_ERROR") {
      loginResolverRef.current?.reject(new Error(data.message || "Error al iniciar sesión"));
      loginResolverRef.current = null;
    }
  }, []);

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
              onLoad={finishLoading}
              // onLoadEnd as fallback
              onLoadEnd={finishLoading}
              onError={() => {
                finishLoading();
                // Auto-retry once on transient network errors before showing the error screen
                if (autoRetryCountRef.current < 1) {
                  autoRetryCountRef.current += 1;
                  setTimeout(() => {
                    setHasError(false);
                    setIsLoading(true);
                    setWebViewKey((k) => k + 1);
                  }, 2000);
                } else {
                  setHasError(true);
                }
              }}
              onHttpError={(e) => {
                if (e.nativeEvent.statusCode >= 500) {
                  finishLoading();
                  setHasError(true);
                } else {
                  finishLoading();
                }
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
              <LoginScreen onSubmit={handleNativeSubmit} />
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
    color: "#13231F",
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
