const { registry, z } = require("../openapi/registry");

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_.-]{3,24}$/u, "Usuario: 3-24 chars (letras, numeros, punto, guion, guion bajo)");

const emailSchema = z.string().trim().toLowerCase().email("Email invalido");
const passwordSchema = z.string().min(8, "Minimo 8 caracteres").max(128, "Maximo 128 caracteres");

const registerBody = registry.register(
  "AuthRegisterBody",
  z.object({
    username: usernameSchema,
    email: emailSchema.optional(),
    password: passwordSchema,
    nombre: z.string().trim().min(1).max(80).optional(),
    apellido: z.string().trim().max(80).optional(),
  }),
);

const loginBody = registry.register(
  "AuthLoginBody",
  z.object({
    identificador: z.string().trim().min(1).optional(),
    username: z.string().trim().optional(),
    email: z.string().trim().optional(),
    password: z.string().min(1, "Clave requerida"),
  }).refine(
    (data) => data.identificador || data.username || data.email,
    { message: "Tenes que enviar identificador, username o email" },
  ),
);

const googleLoginBody = registry.register(
  "AuthGoogleLoginBody",
  z.object({
    idToken: z.string().trim().min(1, "Token de Google requerido"),
  }),
);

const usuarioPayload = registry.register(
  "Usuario",
  z.object({
    id: z.string(),
    nombre: z.string(),
    apellido: z.string().nullable(),
    username: z.string(),
    email: z.string().nullable(),
    emailVerificado: z.boolean(),
    telefono: z.string().nullable(),
    rol: z.enum(["USER", "ADMIN"]),
    activo: z.boolean(),
    hinchaDe: z.object({
      id: z.string(),
      nombre: z.string(),
      nombreCompleto: z.string().nullable(),
      tipo: z.enum(["CLUB", "SELECCION"]),
    }).nullable(),
  }),
);

const sessionResponse = registry.register(
  "AuthSession",
  z.object({
    token: z.string(),
    usuario: usuarioPayload,
  }),
);

const mobileGoogleLoginBody = registry.register(
  "AuthMobileGoogleLoginBody",
  z.object({
    code: z.string().trim().min(1, "Code requerido"),
    codeVerifier: z.string().trim().min(1, "Code verifier requerido"),
    redirectUri: z.string().trim().min(1, "Redirect URI requerida"),
  }),
);

module.exports = { googleLoginBody, loginBody, mobileGoogleLoginBody, registerBody, sessionResponse, usuarioPayload };
