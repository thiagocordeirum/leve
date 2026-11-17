// =============================================================
// Conexão com o seu projeto no Supabase
// Onde achar: Supabase > Project Settings > API (ou "API Keys")
//
// url: "Project URL", algo como https://abcdefgh.supabase.co
// key: a chave PÚBLICA — "publishable" (sb_publishable_...) ou "anon".
//
// A chave pública pode ficar no site: quem protege os dados são as
// regras de acesso (RLS) do schema.sql.
// NUNCA coloque aqui a chave "secret" / "service_role". O app se
// recusa a funcionar se você colocar.
// =============================================================
window.SOBRA_CONFIG = {
  url: "https://SEU-PROJETO.supabase.co",
  // Número do Leve no WhatsApp (só dígitos, com 55 e DDD). Vazio = o grupo WhatsApp não aparece em Ajustes.
  // (O Telegram não precisa de nada aqui: o app pergunta o nome do bot à função telegram.)
  whatsapp: "",
  key: "COLE_AQUI_A_CHAVE_PUBLISHABLE"
};
