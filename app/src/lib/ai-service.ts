import { GameState, Message } from './types';
import { z } from 'zod';
import { random, withSeed } from './rng';
import type { Seed } from './validations';
import { SEASON_LENGTH, isSeasonOver } from './constants';
import { allowedActionsFor, filterSuggestions, suggestActions } from './assistant-actions';
import { getLogger } from './request-context';
import type { LogFields } from './logger';
import { parseFailureFields } from './log-safe';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const AI_MODEL = process.env.AI_MODEL || 'google/gemini-2.0-flash-001';
/** How long a live model call may take before it is abandoned for the fallback. */
const AI_TIMEOUT_MS = 8000;

/**
 * Identifier-shaped: an upstream error code, not prose. Anything longer or
 * punctuated is treated as free text and dropped.
 */
const UPSTREAM_IDENTIFIER = /^[A-Za-z0-9_.:-]{1,64}$/;

/** Keys of the conventional `{ error: { ... } }` upstream shape worth keeping. */
const UPSTREAM_ERROR_KEYS = ['code', 'type', 'param'] as const;

/**
 * What may be recorded from an upstream error body.
 *
 * The body belongs to the provider, not to us, so there is no bound on what
 * it contains. Logging it verbatim was shown to copy our own system prompt —
 * and with it the player's team, budget, morale and league position — into
 * the log, and to copy the API key itself when the far end reflects the
 * Authorization header back. So the free text is dropped and only the
 * provider's machine-readable identifiers survive, each one checked to be
 * identifier-shaped and never to contain the key. The status and the body's
 * size are what actually distinguish one upstream failure from another.
 */
function upstreamErrorFields(status: number, body: string): LogFields {
  const fields: LogFields = {
    status,
    bodyBytes: new TextEncoder().encode(body).byteLength,
  };

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    // A body that is not JSON carries nothing we are willing to quote.
    return fields;
  }

  const error = (parsed as { error?: unknown } | null)?.error;
  if (error === null || typeof error !== 'object') return fields;

  for (const key of UPSTREAM_ERROR_KEYS) {
    const value = (error as Record<string, unknown>)[key];
    if (typeof value !== 'string' || !UPSTREAM_IDENTIFIER.test(value)) continue;
    // Belt and braces: an identifier-shaped value is still not worth the risk
    // if it happens to carry the credential.
    if (OPENROUTER_API_KEY && value.includes(OPENROUTER_API_KEY)) continue;
    fields[`upstream${key[0].toUpperCase()}${key.slice(1)}`] = value;
  }

  return fields;
}

const AIResponseSchema = z.object({
  message: z.string(),
  actions: z.array(z.string()).optional().default([]),
  intent: z.string().optional()
});

/**
 * Where a reply came from. `model` is the live model, `mock` the built-in
 * assistant answering because that is the mode the game is in, and
 * `fallback` the mock standing in for a live model that failed — the player
 * is told about that last one rather than being handed canned text that
 * looks like the real thing.
 */
export type AISource = 'model' | 'mock' | 'fallback';

export interface AIResponse {
  content: string;
  actions: string[];
  intent: string;
  cost: number;
  latency: number;
  source: AISource;
}

// System prompt generator
function generateSystemPrompt(gameState: GameState): string {
  const seasonOver = isSeasonOver(gameState.season);
  // The fixture a finished save carries is the 'Temporada Completa'
  // placeholder, so it is described as the end of the season rather than
  // handed over as an opponent the model will happily talk up.
  const fixture = seasonOver
    ? `NONE. The season is over after ${SEASON_LENGTH} rounds. There is no next match, and no new season can be started yet. Do not invent or promise one.`
    : `${gameState.season.nextMatch.opponent} (${gameState.season.nextMatch.isHome ? 'Home' : 'Away'}), round ${gameState.season.week} of ${SEASON_LENGTH}`;

  return `You are the narrator and game engine for "Fala Mestre!", a football management game.
  
CURRENT GAME STATE:
- User Team: ${gameState.user.team}
- Season Week: ${gameState.season.week} of ${SEASON_LENGTH}${seasonOver ? ' (SEASON FINISHED)' : ''}
- League Position: ${gameState.season.position}
- Points: ${gameState.season.points} (${gameState.season.wins}W ${gameState.season.draws}D ${gameState.season.losses}L)
- Next Match: ${fixture}
- Budget: R$ ${gameState.user.money.toLocaleString('pt-BR')}
- Squad Morale: ${gameState.squad.morale}%
- Squad Size: ${gameState.squad.players.length}

GAME RULES:
1. Match results based on team strength + tactics + randomness
2. Player ratings from 50-99
3. Brazilian football culture and passion
4. Realistic transfer negotiations
5. Emotional, engaging narrative in Brazilian Portuguese

RESPONSE GUIDELINES:
- Use emojis for visual appeal
- Keep responses concise but engaging (2-4 sentences)
- Always provide 2-4 action options, taken ONLY from the ALLOWED ACTIONS list
  below, using those exact keys. Never invent an action key, and never suggest
  one that is not listed — the listed ones are the only screens the player can
  reach from this chat right now
- The suggestions must follow what you just said: suggest the squad after
  talking about players, the market after talking about signings, and so on
- Say only what the state above supports. If the season is finished, say so,
  and talk about the campaign that ended instead of a next match
- Include relevant stats when needed
- Use Brazilian Portuguese
- Be passionate and authentic

ALLOWED ACTIONS (key — what it opens):
${allowedActionsFor(gameState).map((a) => `- ${a.key} — ${a.label}`).join('\n')}

TRACK THESE INTENTS FOR ANALYTICS:
- playing_style (aggressive/defensive/balanced)
- spending_behavior (conservative/balanced/aggressive)
- engagement_level (casual/regular/hardcore)
- decision_speed (quick/thoughtful/analytical)

Format your response as JSON:
{
  "message": "Your narrative response in Portuguese",
  "actions": ["action1", "action2", "action3"],
  "intent": "detected_intent"
}`;
}

// Intent classification
export function classifyIntent(userMessage: string, gameState: GameState): string {
  const msg = userMessage.toLowerCase().trim();

  // Direct action button clicks
  if (msg === 'view_squad') return 'view_squad';
  if (msg === 'play_match') return 'play_match';
  if (msg === 'transfer_market') return 'transfer_market';
  if (msg === 'train') return 'training';
  if (msg === 'tactics') return 'tactics';

  // Greeting patterns
  const greetings = ['ola', 'olá', 'oi', 'bom dia', 'boa tarde', 'boa noite', 'e ai', 'e aí', 'hey', 'hello', 'hi'];
  if (greetings.some(g => msg === g || msg.startsWith(g + ' '))) {
    return 'greeting';
  }

  const negations = ['não', 'nao', 'nunca', 'jamais'];
  const hasNegation = negations.some(n => msg.includes(`${n} `) || msg === n || msg.includes(` ${n}`));

  // If there's a negation, it often changes the intent to a general statement or refusal
  if (hasNegation) {
    if (msg.includes('jogar') || msg.includes('partida')) return 'general_chat'; // "não quero jogar"
    if (msg.includes('treinar') || msg.includes('treino')) return 'general_chat'; // "não quero treinar"
  }

  if (msg.includes('jogar') || msg.includes('partida') || msg.includes('match')) {
    if (msg.includes('treinar') || msg.includes('treino')) return 'training';
    return 'play_match';
  }
  if (msg.includes('elenco') || msg.includes('time') || msg.includes('squad') || msg.includes('jogadores')) return 'view_squad';
  if (msg.includes('transfer') || msg.includes('comprar') || msg.includes('vender') || msg.includes('mercado')) return 'transfer_market';
  if (msg.includes('tatic') || msg.includes('formacao') || msg.includes('formaçao')) return 'tactics';
  if (msg.includes('treino') || msg.includes('treinar')) return 'training';
  if (msg.includes('agressiv') || msg.includes('atacar') || msg.includes('ofensiv') || msg.includes('ataque')) return 'playing_style_aggressive';
  if (msg.includes('defensiv') || msg.includes('retrancar') || msg.includes('segurar') || msg.includes('defesa')) return 'playing_style_defensive';
  if (msg.includes('equilibr') || msg.includes('balance') || msg.includes('equilibrado')) return 'playing_style_balanced';
  if (msg.includes('econom') || msg.includes('barat') || msg.includes('gastar pouco') || msg.includes('orçamento')) return 'spending_conservative';
  if (msg.includes('gastar') || msg.includes('investir') || msg.includes('milhões')) return 'spending_aggressive';
  if (msg.includes('proximo') || msg.includes('próximo') || msg.includes('adversario') || msg.includes('adversário')) return 'next_opponent';
  if (msg.includes('classificacao') || msg.includes('classificação') || msg.includes('tabela') || msg.includes('posicao')) return 'standings';

  // Match result patterns - recognize match summaries
  if (msg.includes('venceu') || msg.includes('perdeu') || msg.includes('empatou') || msg.includes('resultado') || msg.includes('placar') || msg.includes('gols')) {
    return 'match_result';
  }

  return 'general_chat';
}

// Call OpenRouter API
/**
 * Calls the live model, falling back to {@link callAIMock} for cheap intents.
 * `seed` only reaches that mock path: a remote model's wording is outside this
 * process and cannot be replayed, which is why the match route prefers the
 * mock when it wants a reproducible narration.
 */
export async function callAI(
  userMessage: string,
  gameState: GameState,
  conversationHistory: Message[],
  seed?: Seed
): Promise<AIResponse> {
  const startTime = Date.now();

  // Fast-path for simple intents like greetings to reduce API costs
  const preClassifiedIntent = classifyIntent(userMessage, gameState);
  if (preClassifiedIntent === 'greeting') {
    return callAIMock(userMessage, gameState, conversationHistory, seed);
  }

  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not set');
  }

  const messages = [
    { role: 'system', content: generateSystemPrompt(gameState) },
    ...conversationHistory.map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content })),
    { role: 'user', content: userMessage },
  ];

  const log = getLogger('ai-service');

  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

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
        messages: messages,
        temperature: 0.7,
        max_tokens: 300,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      log.error('OpenRouter API error', upstreamErrorFields(response.status, errorText));
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    let content = data.choices[0].message.content;

    // Strip markdown JSON block if present
    content = content.replace(/^```[a-z]*\s*/im, '').replace(/```\s*$/m, '').trim();

    let parsed;
    try {
      const rawJson = JSON.parse(content);
      parsed = AIResponseSchema.parse(rawJson);
    } catch (error) {
      // Not the error object: a JSON.parse SyntaxError quotes the first bytes
      // of the reply in its message, and the reply is the model talking back
      // about whatever the player asked. What is worth knowing is which of the
      // two checks failed and, for the schema, where — the field names are
      // ours, not the model's.
      log.warn(
        'AI reply was not usable, falling back to its raw text',
        parseFailureFields(error, content)
      );
      // Fallback logic
      parsed = {
        message: content, // use the raw text content as message
        actions: gameState.context.availableActions,
        intent: classifyIntent(userMessage, gameState)
      };
    }

    const latency = Date.now() - startTime;
    const cost = (data.usage?.total_tokens || 0) * 0.000001; // Rough estimate

    const intent = parsed.intent || classifyIntent(userMessage, gameState);

    return {
      content: parsed.message,
      // The model picks its own suggestions; only the ones this save can act
      // on survive, and if none do it gets the ones the intent implies.
      actions: filterSuggestions(gameState, intent, parsed.actions),
      intent,
      cost,
      latency,
      source: 'model',
    };
  } catch (error) {
    clearTimeout(timeoutId);

    const latency = Date.now() - startTime;
    const intent = classifyIntent(userMessage, gameState);

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        log.warn('AI call timed out', { timeoutMs: AI_TIMEOUT_MS });
      } else {
        log.error('AI call failed', { error });
      }
    }

    // Generate contextual fallback response based on intent
    const seasonOver = isSeasonOver(gameState.season);
    let fallbackMessage = '';
    switch (seasonOver && intent === 'play_match' ? 'season_over' : intent) {
      case 'season_over':
        fallbackMessage = `🏁 A temporada do ${gameState.user.team} acabou: ${gameState.season.points} pontos e ${gameState.season.position}º lugar. Não há mais jogos nesta liga. Quer rever a campanha?`;
        break;
      case 'play_match':
        fallbackMessage = `⚽ Vamos jogar! O ${gameState.user.team} está pronto para o confronto contra ${gameState.season.nextMatch.opponent}. O que você decide fazer?`;
        break;
      case 'view_squad':
        fallbackMessage = `📋 Aqui está seu elenco do ${gameState.user.team}. Temos ${gameState.squad.players.length} jogadores disponíveis. Quer fazer alguma alteração?`;
        break;
      case 'transfer_market':
        fallbackMessage = `💰 O mercado de transferências está movimentado! Você tem R$ ${gameState.user.money.toLocaleString()} para investir. Quer ver algumas opções?`;
        break;
      default:
        fallbackMessage = `⚽ Olá, Mestre! Estou aqui para ajudar o ${gameState.user.team}. O que você precisa?`;
    }

    return {
      content: fallbackMessage,
      actions: suggestActions(gameState, seasonOver ? 'season_over' : intent),
      intent,
      cost: 0,
      latency,
      // The live model did not answer this one.
      source: 'fallback',
    };
  }
}

// Mock AI for testing (no API key needed)
/**
 * Canned narration. Pass `seed` to make the wording reproducible: the same
 * seed and the same game state always produce the same reply, so a replayed
 * match narrates identically.
 */
export async function callAIMock(
  userMessage: string,
  gameState: GameState,
  conversationHistory: Message[],
  seed?: Seed
): Promise<AIResponse> {
  const startTime = Date.now();
  const classified = classifyIntent(userMessage, gameState);

  // A finished season has no fixture: `season.nextMatch` holds the
  // 'Temporada Completa' placeholder. Anything the player asks about the
  // next game is answered as the end of the campaign instead, because the
  // alternative is the assistant pitching a match against a placeholder.
  const seasonOver = isSeasonOver(gameState.season);
  const ABOUT_NEXT_MATCH = ['play_match', 'next_opponent', 'tactics'];
  const intent = seasonOver && ABOUT_NEXT_MATCH.includes(classified) ? 'season_over' : classified;

  // Calculate squad statistics
  const avgRating = gameState.squad.players.length > 0
    ? Math.round(gameState.squad.players.reduce((sum, p) => sum + (p.pac + p.sho + p.pas + p.dri + p.def + p.phy) / 6, 0) / gameState.squad.players.length)
    : 70;
  const bestPlayers = gameState.squad.players.slice(0, 3).map(p => p.name).join(', ');
  const starPlayer = gameState.squad.players[0]?.name || 'seu capitão';

  const record = `${gameState.season.wins}V ${gameState.season.draws}E ${gameState.season.losses}D`;

  // Response variants for each intent
  const responses: Record<string, string[]> = {
    season_over: [
      `🏁 Fim de temporada, Mestre! O ${gameState.user.team} fechou a Liga Mestre em ${gameState.season.position}º lugar, com ${gameState.season.points} pontos em ${SEASON_LENGTH} rodadas (${record}). Não há mais partidas nesta temporada. Quer rever a campanha?`,
      `🏆 A temporada acabou. Foram ${SEASON_LENGTH} rodadas e o ${gameState.user.team} terminou na ${gameState.season.position}ª posição com ${gameState.season.points} pontos (${record}). Sem jogos à frente por ora — bom momento para olhar o elenco e o mercado.`,
    ],
    greeting: seasonOver
      ? [
          `⚽ Olá, Mestre! A temporada do ${gameState.user.team} está encerrada: ${gameState.season.position}º lugar com ${gameState.season.points} pontos. Como posso ajudar?`,
          `👋 Saudações, treinador! Campanha concluída (${record}) e nenhum jogo marcado. Quer analisar o elenco?`,
        ]
      : [
      `⚽ Olá, Mestre! Bem-vindo ao comando do ${gameState.user.team}! Estamos na ${gameState.season.week}ª rodada e ocupamos a ${gameState.season.position}ª posição. Como posso ajudar hoje?`,
      `👋 Saudações, treinador! O ${gameState.user.team} aguarda suas ordens. Atualmente temos ${gameState.season.points} pontos no campeonato. O que deseja fazer?`,
      `🔥 E aí, Mestre! Pronto para mais uma jornada com o ${gameState.user.team}? Estamos ${gameState.season.nextMatch.isHome ? 'em casa' : 'fora'} contra o ${gameState.season.nextMatch.opponent} na próxima partida!`,
    ],
    play_match: [
      `⚽ Vamos para a partida! O ${gameState.user.team} enfrenta o ${gameState.season.nextMatch.opponent} ${gameState.season.nextMatch.isHome ? 'em casa' : 'fora de casa'}. Nossa moral está em ${gameState.squad.morale}%. Preparado para o confronto?`,
      `🎯 Hora do jogo! ${gameState.season.nextMatch.opponent} é o adversário de hoje. Com ${gameState.season.points} pontos na bagagem, vamos buscar a vitória! Quer ajustar algo antes de começar?`,
      `🏟️ Partida à vista! O ${gameState.user.team} entra em campo contra o ${gameState.season.nextMatch.opponent}. ${starPlayer} está inspirado para essa. Vamos jogar?`,
    ],
    view_squad: [
      `📋 Aqui está seu elenco do ${gameState.user.team}:\n• Média geral: ${avgRating}\n• Destaques: ${bestPlayers}\n• Moral do time: ${gameState.squad.morale}%\n• Jogadores disponíveis: ${gameState.squad.players.length}\n\nQuer fazer alguma alteração tática?`,
      `👥 Status do ${gameState.user.team}:\n${gameState.squad.players.slice(0, 5).map(p => `• ${p.name} (${p.position}) - Overall ${Math.round((p.pac + p.sho + p.pas + p.dri + p.def + p.phy) / 6)}`).join('\n')}\n\nMoral atual: ${gameState.squad.morale}%. Precisa de reforços?`,
      `⚡ Análise do elenco:\nForça média: ${avgRating}/99\n${starPlayer} é nosso destaque absoluto. O time está ${gameState.squad.morale > 70 ? 'confiante' : 'precisando de um gás'}. Quer ver opções de mercado?`,
    ],
transfer_market: [
      `💰 Mercado de transferências movimentado! Você tem R$ ${gameState.user.money.toLocaleString()} disponíveis para investir. Estamos monitorando algumas oportunidades interessantes. Quer ver quem está disponível?`,
      `🛑 Bolsa aquecida! Com R$ ${gameState.user.money.toLocaleString()}, podemos buscar reforços de qualidade. Alguns jogadores estão de olho no ${gameState.user.team}. Quer fazer uma proposta?`,
      `📈 Hora de reforçar o elenco! Seu orçamento: R$ ${gameState.user.money.toLocaleString()}. O mercado está ${avgRating < 75 ? 'cheio de promessas' : 'com poucas opções top'}. Vamos negociar?`,
    ],
    tactics: [
      `📊 Táticas disponíveis para o ${gameState.user.team}:\n• 4-4-2 (Equilibrado)\n• 4-3-3 (Ofensivo)\n• 4-5-1 (Defensivo)\n• 3-5-2 (Controle)\n\nQual formação você prefere usar contra o ${gameState.season.nextMatch.opponent}?`,
      `⚙️ Configuração tática atual. Com base no nosso elenco (média ${avgRating}), recomendo ${avgRating > 75 ? 'um jogo ofensivo' : 'uma postura mais cautelosa'}. Quer mudar a estratégia?`,
    ],
    training: [
      `🏋️ Centro de treinamentos pronto! Podemos focar em:\n• Finalização\n• Condicionamento físico\n• Táticas defensivas\n• Jogadas ensaiadas\n\nO que priorizar essa semana?`,
      `💪 Hora de suar! Com ${gameState.squad.morale}% de moral, um treino focado pode fazer toda a diferença. Qual aspecto quer aprimorar?`,
    ],
    next_opponent: [
      `🔍 Análise do próximo adversário: ${gameState.season.nextMatch.opponent}\n• Local: ${gameState.season.nextMatch.isHome ? 'Em casa (vantagem)' : 'Fora (desafio maior)'}\n• Competição: ${gameState.season.nextMatch.competition}\n• Semana: ${gameState.season.week} de ${SEASON_LENGTH}\n\nQuer ver mais detalhes ou preparar a estratégia?`,
    ],
    standings: seasonOver
      ? [
          `📊 Classificação final:\n• Posição: ${gameState.season.position}º lugar\n• Pontos: ${gameState.season.points}\n• Campanha: ${record} em ${SEASON_LENGTH} rodadas\n\nTemporada encerrada — ${gameState.season.position <= 6 ? 'campanha de respeito!' : 'há o que melhorar para a próxima.'}`,
        ]
      : [
      `📊 Situação no campeonato:\n• Posição: ${gameState.season.position}º lugar\n• Pontos: ${gameState.season.points}\n• Rodada: ${gameState.season.week}/${SEASON_LENGTH}\n• Próximo: ${gameState.season.nextMatch.opponent}\n\nEstamos ${gameState.season.position <= 6 ? 'na briga pelo título!' : 'precisando subir na tabela.'}`,
    ],
    match_result: seasonOver
      ? [
          `⚽ Foi a última da temporada! O ${gameState.user.team} fecha a campanha em ${gameState.season.position}º com ${gameState.season.points} pontos (${record}). Agora é balanço: quer rever a classificação final?`,
        ]
      : [
      `⚽ Que partida! O ${gameState.user.team} mostrou garra e determinação. Agora é hora de analisar o que funcionou e o que precisamos melhorar para o próximo confronto!\n\nVamos conversar sobre os próximos passos?`,
      `🏆 ${gameState.user.team} deu Show hoje! A torcida aplaudiu de pé. Agora é hora de recuperar os jogadores e pensar na próxima batalha!\n\nO que você quer fazer agora, Mestre?`,
      `💪 ${gameState.user.team} deixou tudo em campo! Mesmo com o resultado, o time mostrou personalidade. Agora é hora de trabalhar nos pontos fracos.\n\nVamos analisar o elenco ou partir para o mercado?`,
    ],
    playing_style_aggressive: [
      `🔥 Estilo ofensivo selecionado! Vamos pressionar alto e buscar o gol desde o início. ${starPlayer} será peça-chave nesse esquema. A torcida vai adorar!`,
    ],
    playing_style_defensive: [
      `🛡️ Postura defensiva definida. Vamos fortalecer a marcação e explorar os contra-ataques. Às vezes, a melhor defesa é o ataque... contido!`,
    ],
    spending_conservative: [
      `💡 Modo econômico ativado. Com R$ ${gameState.user.money.toLocaleString()}, vamos buscar negócios inteligentees. Jogadores jovens e promessas são nosso foco!`,
    ],
    spending_aggressive: [
      `💸 Modo investidor ligado! Vamos buscar estrelas para o ${gameState.user.team}. Com R$ ${gameState.user.money.toLocaleString()}, podemos montar um time de peso. Quem você quer contratar?`,
    ],
    general_chat: seasonOver
      ? [
          `🤔 Entendido! A temporada do ${gameState.user.team} terminou em ${gameState.season.position}º com ${gameState.season.points} pontos, e temos R$ ${gameState.user.money.toLocaleString()} em caixa. O que você precisa?`,
          `👔 Às suas ordens, Mestre! Sem jogos no calendário por enquanto — dá para cuidar do elenco com calma. O que fazer?`,
        ]
      : [
      `🤔 Entendido! Estou aqui para ajudar o ${gameState.user.team} a conquistar a glória. Temos ${gameState.season.points} pontos na tabela e R$ ${gameState.user.money.toLocaleString()} na conta. O que você precisa?`,
      `⚽ Pode contar comigo, Mestre! O ${gameState.user.team} está na ${gameState.season.position}ª posição. Como posso ajudar você hoje?`,
      `👔 Às suas ordens! O time está ${gameState.squad.morale > 70 ? 'motivado' : 'precisando de um empurrão'}. Temos um jogo importante contra o ${gameState.season.nextMatch.opponent}. O que fazer?`,
    ],
  };

  // Picking the wording is the only random step, and it is synchronous, so a
  // seeded scope can wrap it on its own — withSeed cannot span the latency
  // await below (see rng.ts), and it does not need to: that await only burns
  // wall-clock and never touches the match content a caller sees.
  const variants = responses[intent] || responses.general_chat;
  const pick = () => variants[Math.floor(random() * variants.length)];
  const message = seed === undefined ? pick() : withSeed(seed, pick);

  // Simulate realistic latency (300-800ms)
  await new Promise(r => setTimeout(r, 300 + Math.random() * 500));

  return {
    content: message,
    actions: suggestActions(gameState, intent),
    intent,
    cost: 0,
    latency: Date.now() - startTime,
    source: 'mock',
  };
}
