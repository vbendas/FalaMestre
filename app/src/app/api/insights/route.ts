import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { gameStates } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { GameState } from '@/lib/types';
import { requireAuth } from '@/lib/auth-helpers';
import { withApiRoute, ApiContext } from '@/lib/api-route';
import { Logger } from '@/lib/logger';
import { z } from 'zod';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const AI_MODEL = process.env.AI_MODEL || 'google/gemini-2.0-flash-001';

const insightsRequestSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

interface Insight {
  title: string;
  text: string;
  icon: string;
}

type GameStateRecordShape = {
  currentState: GameState;
};

// In-memory cache (serverless cold starts reset this, but it works per-instance)
const cache = new Map<string, { data: Insight[]; timestamp: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function buildGameContext(gs: GameState): string {
  const injuredPlayers = gs.squad.players.filter(p => p.isInjured);
  const avgOvr = gs.squad.players.length > 0
    ? Math.round(gs.squad.players.reduce((sum, p) => sum + (p.pac + p.sho + p.pas + p.dri + p.def + p.phy) / 6, 0) / gs.squad.players.length)
    : 70;
  const topPlayer = gs.squad.players.slice().sort((a, b) =>
    ((b.pac + b.sho + b.pas + b.dri + b.def + b.phy) / 6) - ((a.pac + a.sho + a.pas + a.dri + a.def + a.phy) / 6)
  )[0];

  return `
TIME: ${gs.user.team}
LIGA: ${gs.season.league}
SEMANA: ${gs.season.week}/38
POSIÇÃO: ${gs.season.position}º
PONTOS: ${gs.season.points}
VITÓRIAS: ${gs.season.wins} | EMPATES: ${gs.season.draws} | DERROTAS: ${gs.season.losses}
PRÓXIMO JOGO: vs ${gs.season.nextMatch.opponent} (${gs.season.nextMatch.isHome ? 'casa' : 'fora'}) - ${gs.season.nextMatch.competition}

ELENCO:
- Total de jogadores: ${gs.squad.players.length}
- Overall médio: ${avgOvr}
- Moral: ${gs.squad.morale}%
- Condição física: ${gs.squad.fitness}%
- Formação: ${gs.squad.formation}
- Jogadores lesionados: ${injuredPlayers.length > 0 ? injuredPlayers.map(p => p.name).join(', ') : 'nenhum'}
- Melhor jogador: ${topPlayer ? `${topPlayer.name} (${topPlayer.position})` : 'N/A'}

CONTEXTO ESTRATÉGICO:
- Conta Corrente: R$ ${gs.user.money.toLocaleString()}
- Nível do manager: ${gs.user.level}
- Divisão: ${gs.season.division}
`.trim();
}

function generateRuleBasedInsights(gs: GameState): Insight[] {
  const insights: Insight[] = [];

  if (gs.squad.morale < 50) {
    insights.push({
      title: 'Moral Baixo',
      text: `O moral está em ${gs.squad.morale}%. Considere descansar jogadores ou fazer uma contratação motivadora para levantar o astral do elenco.`,
      icon: '😤',
    });
  }

  if (gs.squad.fitness < 60) {
    insights.push({
      title: 'Condição Física',
      text: `A condição está em ${gs.squad.fitness}%. Reduza a intensidade do treino e dê mais tempo de recuperação para evitar lesões.`,
      icon: '💪',
    });
  }

  const injuredCount = gs.squad.players.filter(p => p.isInjured).length;
  if (injuredCount > 2) {
    insights.push({
      title: 'Crise de Lesões',
      text: `${injuredCount} jogadores lesionados. Priorize a recuperação e considere buscar reforços no mercado de transferências.`,
      icon: '🏥',
    });
  }

  if (gs.season.losses > gs.season.wins && gs.season.wins + gs.season.losses >= 3) {
    insights.push({
      title: 'Má Fase',
      text: 'O time está em má fase. Analise a formação atual e tente uma estratégia diferente no próximo jogo.',
      icon: '📉',
    });
  }

  if (gs.season.position <= 4) {
    insights.push({
      title: 'No G4!',
      text: 'Seu time está no G4! Mantenha a consistência e foque em não perder jogos decisivos.',
      icon: '🏆',
    });
  } else if (gs.season.position >= 16) {
    insights.push({
      title: 'Zona de Perigo',
      text: 'O time está na zona de rebaixamento. É hora de mudar a estratégia e buscar vitórias urgentes.',
      icon: '⚠️',
    });
  }

  const avgOvr = gs.squad.players.length > 0
    ? Math.round(gs.squad.players.reduce((sum, p) => sum + (p.pac + p.sho + p.pas + p.dri + p.def + p.phy) / 6, 0) / gs.squad.players.length)
    : 70;

  if (avgOvr < 70) {
    insights.push({
      title: 'Reforços Necessários',
      text: `O overall médio do time é ${avgOvr}. Invista no mercado de transferências para elevar o nível do elenco.`,
      icon: '📈',
    });
  }

  if (gs.squad.formation === '4-3-3' && gs.season.nextMatch.isHome === false) {
    insights.push({
      title: 'Formação Fora',
      text: 'Jogando fora de casa com 4-3-3. Considere um 4-5-1 ou 5-3-2 para maior segurança defensiva.',
      icon: '🛡️',
    });
  }

  return insights;
}

async function generateAIInsights(gs: GameState, log: Logger): Promise<Insight[]> {
  if (!OPENROUTER_API_KEY) return [];

  const context = buildGameContext(gs);
  const prompt = `Você é um assistente técnico de futebol para o jogo "Fala Mestre!". Analise o estado atual do time e gere exatamente 3 insights personalizados e acionáveis em português brasileiro.

CADA insight deve ter:
- "title": máximo 3 palavras (ex: "Descansar Atacante")
- "text": máximo 2 frases curtas com ação específica
- "icon": um emoji relevante

REGRAS:
- Seja ESPECÍFICO ao time do jogador, use nomes de jogadores quando relevante
- Dê conselhos PRÁTICOS e ACIONÁVEIS, não genéricos
- Foque em: tática, gestão de elenco, transferências, preparação para próximo jogo
- Tom: profissional mas acessível, como um assistente técnico

ESTADO ATUAL DO TIME:
${context}

Responda APENAS com um array JSON válido, sem markdown:
[{"title": "...", "text": "...", "icon": "..."}, ...]`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://falamestre.ai',
        'X-Title': 'FalaMestre',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 400,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      log.error('AI API error', { status: response.status });
      return [];
    }

    const data = await response.json();
    let content = data.choices[0]?.message?.content || '';

    content = content.replace(/^```[a-z]*\s*/im, '').replace(/```\s*$/m, '').trim();

    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) return [];

    return parsed.slice(0, 3).map((item: Record<string, unknown>) => ({
      title: String(item.title || '').slice(0, 30),
      text: String(item.text || '').slice(0, 200),
      icon: String(item.icon || '💡'),
    }));
  } catch (error) {
    clearTimeout(timeoutId);
    log.error('AI generation failed', { error });
    return [];
  }
}

export const POST = withApiRoute('insights', async (
  request: NextRequest,
  { log, readJson }: ApiContext
) => {
  try {
    const authError = await requireAuth();
    if (authError) return authError;

    const bodyResult = await readJson();
    if (!bodyResult.ok) {
      return bodyResult.response;
    }
    const body = bodyResult.body;

    const validation = insightsRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const { userId } = validation.data;

    // Check cache
    const cached = cache.get(userId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json({
        insights: cached.data,
        generatedAt: new Date(cached.timestamp).toISOString(),
        cached: true,
      });
    }

    // Load game state
    let gs: GameState;
    try {
      const record = await db.query.gameStates.findFirst({
        where: eq(gameStates.userId, userId),
      }) as GameStateRecordShape | undefined;

      if (!record) {
        return NextResponse.json({ insights: [], cached: false });
      }
      gs = record.currentState;
    } catch (error) {
      log.error('Failed to load game state', { error });
      // Return rule-based only on DB failure
      const ruleBased = generateRuleBasedInsights({} as GameState);
      return NextResponse.json({ insights: ruleBased, cached: false });
    }

    // Generate insights: AI + rule-based combined
    const ruleBased = generateRuleBasedInsights(gs);
    const aiInsights = await generateAIInsights(gs, log);

    // Combine: AI first (personalized), then rule-based as supplement
    const combined = [...aiInsights, ...ruleBased].slice(0, 6);

    // Cache result
    cache.set(userId, { data: combined, timestamp: Date.now() });

    return NextResponse.json({
      insights: combined,
      generatedAt: new Date().toISOString(),
      cached: false,
    });
  } catch (error) {
    log.error('Unexpected error', { error });
    return NextResponse.json(
      { error: 'Internal server error', insights: [] },
      { status: 500 }
    );
  }
}, {
  // This route answered a malformed body with 'Invalid JSON' rather than the
  // helper's 'Invalid JSON body'; keep its wording.
  invalidJsonResponse: () => NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }),
});
