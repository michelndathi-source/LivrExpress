/**
 * LivrExpress — Configuration Supabase
 *
 * 1. Créez un projet sur https://supabase.com/dashboard
 * 2. Settings → API : copiez Project URL et anon public key
 * 3. SQL Editor : exécutez supabase/migrations/001_init_livrexpress.sql
 * 4. Collez vos valeurs ci-dessous (remplacez les placeholders)
 *
 * Laissez vide pour rester en mode localStorage (démo hors-ligne).
 */
(function (global) {
  const config = {
    /**
     * Project URL — Settings → API → Project URL
     * (sans /rest/v1 — le client l’ajoute tout seul)
     */
    url: "https://opseytovjnuffonfwtgx.supabase.co",

    /**
     * Clé navigateur : "anon" (JWT eyJ…) ou "publishable" (sb_publishable_…)
     * Settings → API → Project API keys
     */
    anonKey: "sb_publishable_YL-fFof2Qm2GNavrdFPD5A_qtsyRk8L",

    /** Email du super-admin (doit correspondre au SQL) */
    superAdminEmail: "michelndathi@gmail.com",
  };

  const isPlaceholder = (v) =>
    !v ||
    /YOUR_PROJECT|YOUR_SUPABASE|placeholder/i.test(String(v)) ||
    String(v).includes("YOUR_");

  config.isConfigured = function isConfigured() {
    const urlOk =
      !isPlaceholder(config.url) &&
      /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(String(config.url).trim());
    const keyOk =
      !isPlaceholder(config.anonKey) &&
      (String(config.anonKey).startsWith("eyJ") ||
        String(config.anonKey).startsWith("sb_publishable_"));
    return urlOk && keyOk;
  };

  global.LIVREXPRESS_SUPABASE = config;
})(typeof window !== "undefined" ? window : globalThis);
