import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
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
import { GOOGLE_WEB_CLIENT_ID } from "./config";

// Required so the auth session can complete when Chrome Custom Tabs returns to the app.
WebBrowser.maybeCompleteAuthSession();

// Use Google's OpenID Connect authorization endpoint directly.
// Authorization code + PKCE flow: avoids the deprecated implicit flow that Google
// blocks, and keeps the client_secret on the backend (never in the app).
const GOOGLE_DISCOVERY = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
};

export type AuthCredentials =
  | { type: "login"; identificador: string; password: string }
  | { type: "register"; username: string; nombre: string; email: string; password: string }
  | { type: "google"; code: string; codeVerifier: string; redirectUri: string };

interface Props {
  onSubmit: (credentials: AuthCredentials) => Promise<void>;
}

export default function LoginScreen({ onSubmit }: Props) {
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

  // Stable redirect URI for the OAuth request
  const redirectUri = AuthSession.makeRedirectUri({ useProxy: true });

  const [googleRequest, googleResponse, promptGoogleAsync] =
    AuthSession.useAuthRequest(
      {
        clientId: GOOGLE_WEB_CLIENT_ID,
        redirectUri,
        scopes: ["openid", "profile", "email"],
        responseType: AuthSession.ResponseType.Code,
        usePKCE: true,
      },
      GOOGLE_DISCOVERY
    );

  // Handle Google OAuth response — pass code + PKCE verifier to backend for exchange
  useEffect(() => {
    if (googleResponse?.type === "success" && googleRequest?.codeVerifier) {
      const code = googleResponse.params.code;
      if (code) {
        handleSubmit({
          type: "google",
          code,
          codeVerifier: googleRequest.codeVerifier,
          redirectUri,
        });
      } else {
        setError("Google no devolvió el código. Intentá de nuevo.");
      }
    } else if (googleResponse?.type === "error") {
      setError("Error al conectar con Google.");
    }
  }, [googleResponse]);

  async function handleSubmit(credentials: AuthCredentials) {
    setError("");
    setLoading(true);
    try {
      await onSubmit(credentials);
    } catch (e: any) {
      setError(e.message || "Error desconocido");
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
          {tab === "login" ? "Ingresar" : "Crear cuenta"}
        </Text>

        {/* Tabs */}
        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, tab === "login" && styles.tabActive]}
            onPress={() => { setTab("login"); setError(""); }}
          >
            <Text style={[styles.tabText, tab === "login" && styles.tabTextActive]}>
              Ingresar
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, tab === "register" && styles.tabActive]}
            onPress={() => { setTab("register"); setError(""); }}
          >
            <Text style={[styles.tabText, tab === "register" && styles.tabTextActive]}>
              Crear cuenta
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
          style={[styles.googleBtn, (!googleRequest || loading) && styles.btnDisabled]}
          onPress={() => promptGoogleAsync()}
          disabled={!googleRequest || loading}
        >
          <Text style={styles.googleBtnText}>Continuar con Google</Text>
        </Pressable>

        <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={styles.dividerText}>o</Text>
          <View style={styles.line} />
        </View>

        {/* Login form */}
        {tab === "login" && (
          <>
            <Text style={styles.label}>Usuario o email</Text>
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
            <Text style={styles.label}>Clave</Text>
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
                <Text style={styles.submitBtnText}>Ingresar</Text>
              )}
            </Pressable>
          </>
        )}

        {/* Register form */}
        {tab === "register" && (
          <>
            <Text style={styles.label}>Usuario</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              editable={!loading}
            />
            <Text style={styles.label}>Nombre para mostrar</Text>
            <TextInput
              style={styles.input}
              value={nombre}
              onChangeText={setNombre}
              returnKeyType="next"
              editable={!loading}
            />
            <Text style={styles.label}>Email</Text>
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
            <Text style={styles.label}>Clave</Text>
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
                <Text style={styles.submitBtnText}>Crear cuenta</Text>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const PRIMARY = "#165A4A";

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#fff",
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
    color: "#111",
    marginBottom: 20,
  },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
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
  tabText: { fontSize: 14, color: "#6B7280", fontWeight: "500" },
  tabTextActive: { color: PRIMARY, fontWeight: "600" },
  errorBox: {
    backgroundColor: "#FEE2E2",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: "#B91C1C", fontSize: 14 },
  googleBtn: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: "center",
    marginBottom: 20,
  },
  googleBtnText: { fontSize: 15, fontWeight: "600", color: "#111" },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  line: { flex: 1, height: 1, backgroundColor: "#E5E7EB" },
  dividerText: { marginHorizontal: 12, color: "#9CA3AF", fontSize: 13 },
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: "#374151",
    marginTop: 10,
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: "#111",
    backgroundColor: "#FAFAFA",
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
