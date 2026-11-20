import { sql } from "drizzle-orm";
import { getDb } from "@/db";

// Diagnóstico da configuração (sem expor valores secretos): GET /api/saude
export async function GET() {
  const hasDb = Boolean(process.env.DATABASE_URL ?? process.env.POSTGRES_URL);
  let conexao = "nao_testada";
  if (hasDb || process.env.NODE_ENV !== "production") {
    try {
      const db = await getDb();
      await db.execute(sql`select 1`);
      conexao = "ok";
    } catch (e) {
      conexao = "erro: " + (e instanceof Error ? e.message.replace(/postgres(ql)?:\/\/\S+/gi, "[url]").slice(0, 160) : "desconhecido");
    }
  }
  return Response.json({
    banco: hasDb ? "configurado" : process.env.NODE_ENV === "production" ? "FALTANDO (conecte o Neon em Storage)" : "embutido (desenvolvimento)",
    conexao,
    login: process.env.OTP_PROVIDER ? "provedor" : process.env.ALLOW_SCREEN_OTP === "1" || process.env.NODE_ENV !== "production" ? "codigo_na_tela" : "FALTANDO (ALLOW_SCREEN_OTP=1 ou provedor)",
    url_publica: process.env.PUBLIC_URL ?? "(automática)",
    versao: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
  });
}
