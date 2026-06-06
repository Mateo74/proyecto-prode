import * as AuthSession from "expo-auth-session";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { EXPO_AUTH_REDIRECT_URI, GOOGLE_WEB_CLIENT_ID } from "./config";

// Required so the auth session can complete when Chrome Custom Tabs returns to the app.
WebBrowser.maybeCompleteAuthSession();

const PKCE_MASK = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~";

function randomString(length: number): string {
  const bytes = Crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes).map((b) => PKCE_MASK[b % PKCE_MASK.length]).join("");
}

async function buildCodeChallenge(verifier: string): Promise<string> {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: Crypto.CryptoEncoding.BASE64 }
  );
  return hash.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export type AuthCredentials =
  | { type: "login"; identificador: string; password: string }
  | { type: "register"; username: string; nombre: string; email: string; password: string }
  | { type: "google"; code: string; codeVerifier: string; redirectUri: string };

interface Props {
  onSubmit: (credentials: AuthCredentials) => Promise<void>;
  lang?: "es" | "en";
}

const STRINGS = {
  es: {
    login:              'Ingresar',
    register:           'Crear cuenta',
    continueWithGoogle: 'Continuar con Google',
    or:                 'o',
    userOrEmail:        'Usuario o email',
    password:           'Clave',
    username:           'Usuario',
    displayName:        'Nombre para mostrar',
    email:              'Email',
    unknownError:       'Error desconocido',
  },
  en: {
    login:              'Sign in',
    register:           'Create account',
    continueWithGoogle: 'Continue with Google',
    or:                 'or',
    userOrEmail:        'Username or email',
    password:           'Password',
    username:           'Username',
    displayName:        'Name',
    email:              'Email',
    unknownError:       'Unknown error',
  },
} as const;

export default function LoginScreen({ onSubmit, lang = "en" }: Props) {
  const s = STRINGS[lang];
  const [tab, setTab] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Login fields
  const [identificador, setIdentificador] = useState("");
  const [password, setPassword] = useState("");

  // Register fields
  const [username, setUsername] = useState("");
  const [nombre, setNombre] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleGoogleSignIn() {
    if (googleLoading || loading) return;
    setError("");
    setGoogleLoading(true);
    try {
      // Generate PKCE code verifier + challenge
      const codeVerifier = randomString(64);
      const codeChallenge = await buildCodeChallenge(codeVerifier);
      const state = randomString(16);

      // Build Google OAuth URL with the Expo proxy as redirect_uri
      const googleParams = new URLSearchParams({
        client_id: GOOGLE_WEB_CLIENT_ID,
        redirect_uri: EXPO_AUTH_REDIRECT_URI,
        response_type: "code",
        scope: "openid profile email",
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        state,
      });
      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${googleParams}`;

      // The URI the proxy will redirect back to after Google auth.
      // Must have a host component to pass the proxy's URI validation, so we
      // always use the custom scheme + explicit path (works in both Expo Go and
      // standalone APK/AAB).
      const returnUrl = AuthSession.makeRedirectUri({ scheme: 'once-metros', path: 'redirect' });

      // Route through the proxy's /start endpoint so it stores the returnUrl
      const startUrl = `${EXPO_AUTH_REDIRECT_URI}/start?${new URLSearchParams({ authUrl: googleAuthUrl, returnUrl })}`;

      const result = await WebBrowser.openAuthSessionAsync(startUrl, returnUrl);

      if (result.type === "cancel" || result.type === "dismiss") return;
      if (result.type !== "success") {
        setError("Error al conectar con Google.");
        return;
      }

      // Parse code + state from the URL the proxy redirected back to
      const queryString = result.url.includes("?") ? result.url.split("?")[1] : "";
      const params = new URLSearchParams(queryString);
      const code = params.get("code");
      const returnedState = params.get("state");

      if (!code) {
        setError("Google no devolvió el código. Intentá de nuevo.");
        return;
      }
      if (returnedState !== state) {
        setError("Error de seguridad en la autenticación. Intentá de nuevo.");
        return;
      }

      await handleSubmit({ type: "google", code, codeVerifier, redirectUri: EXPO_AUTH_REDIRECT_URI });
    } catch (e: any) {
      setError(e.message || "Error al conectar con Google.");
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleSubmit(credentials: AuthCredentials) {
    setError("");
    setLoading(true);
    try {
      await onSubmit(credentials);
    } catch (e: any) {
      setError(e.message || s.unknownError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logoRow}>
          <View style={styles.logoDot} />
          <Text style={styles.logoText}>Once Metros</Text>
        </View>

        <Text style={styles.pageTitle}>
          {tab === "login" ? s.login : s.register}
        </Text>

        {/* Tabs */}
        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, tab === "login" && styles.tabActive]}
            onPress={() => { setTab("login"); setError(""); }}
          >
            <Text style={[styles.tabText, tab === "login" && styles.tabTextActive]}>
              {s.login}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, tab === "register" && styles.tabActive]}
            onPress={() => { setTab("register"); setError(""); }}
          >
            <Text style={[styles.tabText, tab === "register" && styles.tabTextActive]}>
              {s.register}
            </Text>
          </Pressable>
        </View>

        {/* Error banner */}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Google button */}
        <Pressable
          style={[styles.googleBtn, (googleLoading || loading) && styles.btnDisabled]}
          onPress={handleGoogleSignIn}
          disabled={googleLoading || loading}
        >
          {googleLoading ? (
            <ActivityIndicator color={TEXT} size="small" />
          ) : (
            <>
              <GoogleIcon />
              <Text style={styles.googleBtnText}>{s.continueWithGoogle}</Text>
            </>
          )}
        </Pressable>

        <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={styles.dividerText}>{s.or}</Text>
          <View style={styles.line} />
        </View>

        {/* Login form */}
        {tab === "login" && (
          <>
            <Text style={styles.label}>{s.userOrEmail}</Text>
            <TextInput
              style={styles.input}
              value={identificador}
              onChangeText={setIdentificador}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              returnKeyType="next"
              editable={!loading}
            />
            <Text style={styles.label}>{s.password}</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              returnKeyType="done"
              editable={!loading}
              onSubmitEditing={() =>
                handleSubmit({ type: "login", identificador, password })
              }
            />
            <Pressable
              style={[styles.submitBtn, loading && styles.btnDisabled]}
              onPress={() => handleSubmit({ type: "login", identificador, password })}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>{s.login}</Text>
              )}
            </Pressable>
          </>
        )}

        {/* Register form */}
        {tab === "register" && (
          <>
            <Text style={styles.label}>{s.username}</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              editable={!loading}
            />
            <Text style={styles.label}>{s.displayName}</Text>
            <TextInput
              style={styles.input}
              value={nombre}
              onChangeText={setNombre}
              returnKeyType="next"
              editable={!loading}
            />
            <Text style={styles.label}>{s.email}</Text>
            <TextInput
              style={styles.input}
              value={regEmail}
              onChangeText={setRegEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              returnKeyType="next"
              editable={!loading}
            />
            <Text style={styles.label}>{s.password}</Text>
            <TextInput
              style={styles.input}
              value={regPassword}
              onChangeText={setRegPassword}
              secureTextEntry
              autoComplete="new-password"
              returnKeyType="done"
              editable={!loading}
              onSubmitEditing={() =>
                handleSubmit({
                  type: "register",
                  username,
                  nombre,
                  email: regEmail,
                  password: regPassword,
                })
              }
            />
            <Pressable
              style={[styles.submitBtn, loading && styles.btnDisabled]}
              onPress={() =>
                handleSubmit({
                  type: "register",
                  username,
                  nombre,
                  email: regEmail,
                  password: regPassword,
                })
              }
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>{s.register}</Text>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const BG        = "#0a0a0f";
const BG2       = "#111118";
const BG3       = "#17171f";
const PRIMARY   = "#00c853";
const BORDER    = "rgba(255,255,255,0.10)";
const TEXT      = "#ffffff";
const TEXT2     = "rgba(255,255,255,0.60)";
const TEXT3     = "rgba(255,255,255,0.35)";
const DANGER    = "#ff4444";

function GoogleIcon() {
  return (
    <View style={styles.googleIconWrap}>
      <Text style={styles.googleIconB}>G</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG,
    zIndex: 10,
  },
  scroll: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 52,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 28,
  },
  logoDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: PRIMARY,
    marginRight: 8,
  },
  logoText: {
    fontSize: 18,
    fontWeight: "700",
    color: PRIMARY,
    letterSpacing: -0.3,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: TEXT,
    marginBottom: 20,
  },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    marginBottom: 20,
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginRight: 20,
    marginBottom: -1,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: { borderBottomColor: PRIMARY },
  tabText: { fontSize: 14, color: TEXT3, fontWeight: "500" },
  tabTextActive: { color: PRIMARY, fontWeight: "600" },
  errorBox: {
    backgroundColor: "rgba(255,68,68,0.15)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,68,68,0.30)",
  },
  errorText: { color: DANGER, fontSize: 14 },
  googleBtn: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BG3,
    marginBottom: 20,
  },
  googleIconWrap: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  googleIconB: { fontSize: 13, fontWeight: "800", color: "#4285F4", lineHeight: 20 },
  googleBtnText: { fontSize: 15, fontWeight: "600", color: TEXT },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  line: { flex: 1, height: 1, backgroundColor: BORDER },
  dividerText: { marginHorizontal: 12, color: TEXT3, fontSize: 13 },
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: TEXT2,
    marginTop: 10,
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: TEXT,
    backgroundColor: BG2,
  },
  submitBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 20,
  },
  btnDisabled: { opacity: 0.45 },
  submitBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
