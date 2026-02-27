export interface AppUser {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: "admin" | "user" | "viewer";
  googleAccessToken: string | null;
  googleRefreshToken: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type PropertyType = "departamento" | "casa" | "local" | "terreno" | "oficina" | "otro";
export type PropertyStatus = "activa" | "vendida" | "alquilada" | "suspendida";

export interface AppProperty {
  id: string;
  address: string;
  city: string | null;
  zone: string | null;
  type: string | null;
  status: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppClient {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export type VisitType = "visita" | "firma" | "tasacion" | "otro";

export interface AppVisit {
  id: string;
  title: string;
  description: string | null;
  date: Date;
  startTime: string;
  endTime: string;
  type: VisitType;
  propertyId: string | null;
  clientId: string | null;
  googleEventId: string | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WhitelistEntry {
  id: string;
  email: string;
  isActive: boolean;
  createdAt: Date;
}

export type AuthResult =
  | { success: true; user: AppUser }
  | { success: false; error: string };

export const AUTH_ERRORS = {
  INVALID_CREDENTIALS:
    "Credenciales inválidas. Revisá tu correo y contraseña.",
  NOT_WHITELISTED:
    "No tenés acceso a esta plataforma. Contactá al administrador.",
  OAUTH_ERROR: "Error al iniciar sesión con Google. Intentá de nuevo.",
  UNKNOWN: "Ocurrió un error inesperado. Intentá de nuevo.",
} as const;
