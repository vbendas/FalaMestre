import { GameState, Message } from './types';
import { z } from 'zod';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const AI_MODEL = process.env.AI_MODEL || 'google/gemini-2.0-flash-001';

const AIResponseSchema = z.object({
  message: z.string(),
  actions: z.array(z.string()).optional().default([]),
  intent: z.string().optional()
});

interface AIResponse {
  content: string;
  actions: string[];
  intent: string;
  cost: number;
  latency: number;
}

// System prompt generator
function generateSystemPrompt(gameState: GameState): string {
  return `You are the narrator and game engine for "Fala Mestre!", a football management game.
  
CURRENT GAME STATE:
- User Team: ${gameState.user.team}
- Season Week: ${gameState.season.week}
- League Position: ${gameState.season.position}
- Points: ${gameState.season.points}
- Next Match: ${gameState.season.nextMatch.opponent} (${gameState.season.nextMatch.isHome ? 'Home' : 'Away'})
- Squad Morale: ${gameState.squad.morale}%
- Available Actions: ${gameState.context.availableActions.join(', ')}

GAME RULES:
1. Match results based on team strength + tactics + randomness
2. Player ratings from 50-99
3. Brazilian football culture and passion
4. Realistic transfer negotiations
5. Emotional, engaging narrative in Brazilian Portuguese

RESPONSE GUIDELINES:
- Use emojis for visual appeal
- Keep responses concise but engaging (2-4 sentences)
- Always provide 2-4 action options
- Include relevant stats when needed
- Use Brazilian Portuguese
- Be passionate and authentic

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
export async function callAI(
  userMessage: string,
  gameState: GameState,
  conversationHistory: Message[]
): Promise<AIResponse> {
  const startTime = Date.now();

  // Fast-path for simple intents like greetings to reduce API costs
  const preClassifiedIntent = classifyIntent(userMessage, gameState);
  if (preClassifiedIntent === 'greeting') {
    return callAIMock(userMessage, gameState, conversationHistory);
  }

  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not set');
  }

  const messages = [
    { role: 'system', content: generateSystemPrompt(gameState) },
    ...conversationHistory.map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content })),
    { role: 'user', content: userMessage },
  ];

  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

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
      console.error('OpenRouter API error:', response.status, errorText);
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
      console.warn('Failed to parse or validate AI JSON response, falling back:', error);
      // Fallback logic
      parsed = {
        message: content, // use the raw text content as message
        actions: gameState.context.availableActions,
        intent: classifyIntent(userMessage, gameState)
      };
    }

    const latency = Date.now() - startTime;
    const cost = (data.usage?.total_tokens || 0) * 0.000001; // Rough estimate

    return {
      content: parsed.message,
      actions: parsed.actions || [],
      intent: parsed.intent || classifyIntent(userMessage, gameState),
      cost,
      latency,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    const latency = Date.now() - startTime;
    const intent = classifyIntent(userMessage, gameState);

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.warn('AI call timed out after 8 seconds');
      } else {
        console.error('AI call failed:', error.message);
      }
    }

    // Generate contextual fallback response based on intent
    let fallbackMessage = '';
    switch (intent) {
      case 'play_match':
        fallbackMessage = `⚽ Vamos jogar! O ${gameState.user.team} está pronto para o confronto contra ${gameState.season.nextMatch.opponent}. O que você decide fazer?`;
        break;
      case 'view_squad':
        fallbackMessage = `📋 Aqui está seu elenco do ${gameState.user.team}. Temos ${gameState.squad.players.length} jogadores disponíveis. Quer fazer alguma alteração?`;
        break;
      case 'transfer_market':
        fallbackMessage = `💰 O mercado de transferências está movimentado! Você tem ${gameState.user.sociosPoints} pontos para investir. Quer ver algumas opções?`;
        break;
      default:
        fallbackMessage = `⚽ Olá, Mestre! Estou aqui para ajudar o ${gameState.user.team}. O que você precisa?`;
    }

    return {
      content: fallbackMessage,
      actions: gameState.context.availableActions,
      intent,
      cost: 0,
      latency,
    };
  }
}

// Mock AI for testing (no API key needed)
export async function callAIMock(
  userMessage: string,
  gameState: GameState,
  conversationHistory: Message[]
): Promise<AIResponse> {
  const startTime = Date.now();
  const intent = classifyIntent(userMessage, gameState);

  // Helper to get random variant
  const getRandomVariant = <T>(variants: T[]): T => variants[Math.floor(Math.random() * variants.length)];

  // Calculate squad statistics
  const avgRating = gameState.squad.players.length > 0
    ? Math.round(gameState.squad.players.reduce((sum, p) => sum + (p.pac + p.sho + p.pas + p.dri + p.def + p.phy) / 6, 0) / gameState.squad.players.length)
    : 70;
  const bestPlayers = gameState.squad.players.slice(0, 3).map(p => p.name).join(', ');
  const starPlayer = gameState.squad.players[0]?.name || 'seu capitão';

  // Response variants for each intent
  const responses: Record<string, string[]> = {
    greeting: [
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
      `💰 Mercado de transferências movimentado! Você tem ${gameState.user.sociosPoints} pontos disponíveis para investir. Estamos monitorando algumas oportunidades interessantes. Quer ver quem está disponível?`,
      `🛒 Bolsa aquecida! Com ${gameState.user.sociosPoints} pontos, podemos buscar reforços de qualidade. Alguns jogadores estão de olho no ${gameState.user.team}. Quer fazer uma proposta?`,
      `📈 Hora de reforçar o elenco! Seu orçamento: ${gameState.user.sociosPoints} pontos. O mercado está ${avgRating < 75 ? 'cheio de promessas' : 'com poucas opções top'}. Vamos negociar?`,
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
      `🔍 Análise do próximo adversário: ${gameState.season.nextMatch.opponent}\n• Local: ${gameState.season.nextMatch.isHome ? 'Em casa (vantagem)' : 'Fora (desafio maior)'}\n• Competição: ${gameState.season.nextMatch.competition}\n• Semana: ${gameState.season.week} de 38\n\nQuer ver mais detalhes ou preparar a estratégia?`,
    ],
    standings: [
      `📊 Situação no championship:\n• Posição: ${gameState.season.position}º lugar\n• Pontos: ${gameState.season.points}\n• Rodada: ${gameState.season.week}/38\n• Próximo: ${gameState.season.nextMatch.opponent}\n\nEstamos ${gameState.season.position <= 6 ? 'na briga pelo título!' : 'precisando subir na tabela.'}`,
    ],
    match_result: [
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
      `💡 Modo econômico ativado. Com ${gameState.user.sociosPoints} pontos, vamos buscar negócios inteligentes. Jogadores jovens e promessas são nosso foco!`,
    ],
    spending_aggressive: [
      `💸 Modo investidor ligado! Vamos buscar estrelas para o ${gameState.user.team}. Com ${gameState.user.sociosPoints} pontos, podemos montar um time de peso. Quem você quer contratar?`,
    ],
    general_chat: [
      `🤔 Entendido! Estou aqui para ajudar o ${gameState.user.team} a conquistar a glória. Temos ${gameState.season.points} pontos e ${gameState.user.sociosPoints} pontos Socios. O que você precisa?`,
      `⚽ Pode contar comigo, Mestre! O ${gameState.user.team} está na ${gameState.season.position}ª posição. Como posso ajudar você hoje?`,
      `👔 Às suas ordens! O time está ${gameState.squad.morale > 70 ? 'motivado' : 'precisando de um empurrão'}. Temos um jogo importante contra o ${gameState.season.nextMatch.opponent}. O que fazer?`,
    ],
  };

  const message = getRandomVariant(responses[intent] || responses.general_chat);

  // Simulate realistic latency (300-800ms)
  await new Promise(r => setTimeout(r, 300 + Math.random() * 500));

  return {
    content: message,
    actions: gameState.context.availableActions,
    intent,
    cost: 0,
    latency: Date.now() - startTime,
  };
}
