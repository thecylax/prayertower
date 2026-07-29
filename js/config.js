/**
 * Configuração da Torre de Oração
 * 1) Crie um projeto gratuito em https://supabase.com
 * 2) No SQL Editor, execute o conteúdo de supabase-schema.sql
 * 3) Cole abaixo a URL e a chave "anon" (Project Settings → API)
 */
window.TORRE_CONFIG = {
  supabaseUrl: "https://hyihhdlzqpyylfvdfkgp.supabase.co",
  supabaseAnonKey: "sb_publishable_YjXk00icMJU4HSs5G0HVQQ_Cqt41Tnd",

  /** Título exibido no topo */
  titulo: "Torre de Oração",
  subtitulo: "Escolha um horário vago e registre sua oração.",

  /**
   * Data de início (YYYY-MM-DD). Deixe null para usar a data de hoje.
   * Ex.: "2026-07-31"
   */
  dataEvento: "2026-07-31",

  /** Horário de início no primeiro dia (formato 24h) */
  horaInicio: "20:00",

  /** Duração total da torre, em horas */
  duracaoHoras: 40,

  /** Intervalo entre horários, em minutos (30 ou 60 são os mais comuns) */
  intervaloMinutos: 60,
};
