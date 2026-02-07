/**
 * Linguistic utility functions for analyzing Portuguese chat messages.
 * Supports emotional word detection, assertiveness scoring, and
 * linguistic feature extraction for personality profiling.
 */

// Positive emotional words in Portuguese (football context + general)
const POSITIVE_WORDS = new Set([
  // Football-specific
  'golaço', 'golaço!', 'crack', 'mito', 'ídolo', 'ídolo!', 'campeão', 'campeão!',
  'campeoes', 'campeões', 'hexa', 'hexacampeão', 'tetra', 'tri', 'bi',
  'mundial', 'libertadores', 'brasil!', 'brasil', 'seleção', 'seleçao',
  'jogo lindo', 'jogo bonito', 'futebol arte', 'garra', 'raça', 'raçudo',
  'emocionante', 'emocionante!', 'vitoria', 'vitória', 'vitória!', 'vencer',
  'ganhamos', 'ganhamos!', 'vencemos', 'vencemos!', 'classificamos', 'classificamos!',
  'bom de bola', 'jogador', 'jogador!', 'craque', 'craque!', 'foda', 'foda!',
  'fodástico', 'fodastico', 'lindo', 'lindo!', 'sensacional', 'sensacional!',
  
  // General positive
  'legal', 'legal!', 'incrível', 'incrível!', 'incrivel', 'incrivel!',
  'demais', 'demais!', 'massa', 'massa!', 'top', 'top!', 'topzera', 'topzera!',
  'show', 'show!', 'show de bola', 'boa', 'boa!', 'ótimo', 'ótimo!', 'otimo', 'otimo!',
  'excelente', 'excelente!', 'perfeito', 'perfeito!', 'maravilhoso', 'maravilhoso!',
  'fantástico', 'fantastico', 'fantástico!', 'fantastico!', 'espetacular', 'espetacular!',
  'genial', 'genial!', 'brilhante', 'brilhante!', 'mágico', 'mágico!', 'magico', 'magico!',
  'vamos', 'vamos!', 'bora', 'bora!', 'vamo', 'vamo!', 'rumo', 'rumo ao',
  'confiante', 'confiante!', 'otimista', 'otimista!', 'feliz', 'feliz!',
  'alegre', 'alegre!', 'animado', 'animado!', 'motivado', 'motivado!',
  'sucesso', 'sucesso!', 'vencedor', 'vencedor!', 'campeao', 'campeao!',
  'gostei', 'gostei!', 'adorei', 'adorei!', 'amei', 'amei!',
  'parabéns', 'parabens', 'parabéns!', 'parabens!',
  'obrigado', 'obrigado!', 'obrigada', 'obrigada!', 'valeu', 'valeu!',
  'muito bom', 'muito bom!', 'que bom', 'que bom!',
  'vai dar certo', 'vai dar certo!', 'joga muito', 'joga muito!',
  'jogou muito', 'jogou muito!', 'joga duro', 'joga duro!',
]);

// Negative emotional words in Portuguese
const NEGATIVE_WORDS = new Set([
  // Football-specific
  'droga', 'droga!', 'merda', 'merda!', 'pqp', 'pqp!', 'porra', 'porra!',
  'perdemos', 'perdemos!', 'derrota', 'derrota!', 'rebaixado', 'rebaixado!',
  'rebaixamento', 'rebaixamento!', 'eliminação', 'eliminação!', 'eliminacao', 'eliminacao!',
  'fraco', 'fraco!', 'ruim', 'ruim!', 'péssimo', 'pessimo', 'péssimo!', 'pessimo!',
  'horrível', 'horrivel', 'horrível!', 'horrivel!', 'terrível', 'terrivel', 'terrível!', 'terrivel!',
  'desastre', 'desastre!', 'tragédia', 'tragedia', 'tragédia!', 'tragedia!',
  'frustrado', 'frustrado!', 'frustrante', 'frustrante!', 'decepcionante', 'decepcionante!',
  'vergonha', 'vergonha!', 'vergonhoso', 'vergonhoso!', 'vexame', 'vexame!',
  'apanhou', 'apanhou!', 'goleada', 'goleada!', 'golada', 'golada!',
  'humilhante', 'humilhante!', 'humilhação', 'humilhação!', 'humilhacao', 'humilhacao!',
  'chorando', 'chorando!', 'triste', 'triste!', 'deprimido', 'deprimido!',
  'impossível', 'impossivel', 'impossível!', 'impossivel!', 'sem chance', 'sem chance!',
  'acabou', 'acabou!', 'fudeu', 'fudeu!', 'ferrou', 'ferrou!',
  'odiei', 'odiei!', 'odeio', 'odeio!', 'detestei', 'detestei!',
  'burro', 'burro!', 'idiota', 'idiota!', 'trouxa', 'trouxa!',
  
  // General negative
  'chato', 'chato!', 'chata', 'chata!', 'entediante', 'entediante!',
  'cansativo', 'cansativo!', 'cansado', 'cansado!', 'cansada', 'cansada!',
  'difícil', 'dificil', 'difícil!', 'dificil!', 'complicado', 'complicado!',
  'ruim', 'ruim!', 'pior', 'pior!', 'péssimo', 'pessimo', 'péssimo!', 'pessimo!',
  'horrível', 'horrivel', 'horrível!', 'horrivel!', 'terrível', 'terrivel', 'terrível!', 'terrivel!',
  'desastre', 'desastre!', 'falha', 'falha!', 'erro', 'erro!',
  'preocupado', 'preocupado!', 'preocupante', 'preocupante!', 'ansioso', 'ansioso!',
  'estressado', 'estressado!', 'estressante', 'estressante!',
  'raiva', 'raiva!', 'puto', 'puto!', 'puta', 'puta!', 'furioso', 'furioso!',
  'decepcionado', 'decepcionado!', 'decepcionada', 'decepcionada!',
  'desapontado', 'desapontado!', 'desapontada', 'desapontada!',
  'triste', 'triste!', 'mal', 'mal!', 'ruim dia', 'ruim dia!',
  'não gostei', 'nao gostei', 'não gostei!', 'nao gostei!',
  'que merda', 'que merda!', 'tá difícil', 'ta dificil', 'tá difícil!', 'ta dificil!',
  'demorando', 'demorando!', 'demora', 'demora!', 'lento', 'lento!',
]);

// Imperative verbs indicating assertiveness (command language)
const IMPERATIVE_MARKERS = new Set([
  'quero', 'queremos', 'preciso', 'precisamos',
  'faz', 'faça', 'fazem', 'façam', 'fazer', 'façam!',
  'muda', 'mudem', 'mude', 'mudar', 'mudança', 'mudança!',
  'troca', 'troquem', 'troque', 'trocar',
  'compra', 'comprem', 'compre', 'comprar',
  'vende', 'vendam', 'venda', 'vender',
  'contrata', 'contratem', 'contrate', 'contratar',
  'vai', 'vão', 'vais', 'vão!', 'vamos', 'vamos!',
  'vem', 'venha', 'venham', 'venham!',
  'olha', 'olhem', 'olha!', 'olhem!',
  'escuta', 'escutem', 'escuta!', 'escutem!',
  'para', 'parem', 'pare', 'parar', 'parem!',
  'passa', 'passem', 'passe', 'passar',
  'chama', 'chamem', 'chame', 'chamar',
  'bota', 'botem', 'bote', 'botar', 'coloca', 'coloquem',
  'tira', 'tirem', 'tire', 'tirar', 'tirem!',
  'chuta', 'chutem', 'chute', 'chutar',
  'cruza', 'cruzem', 'cruze', 'cruzar',
  'dá', 'dê', 'dem', 'dar', 'dá!', 'dê!', 'dem!',
  'me dá', 'me dê', 'me dê!', 'dá pra mim', 'dá pra mim!',
]);

// Hedging words indicating uncertainty/low assertiveness
const HEDGING_WORDS = new Set([
  'talvez', 'talvez...', 'será', 'sera', 'será?', 'sera?',
  'não sei', 'nao sei', 'não sei...', 'nao sei...',
  'acho que', 'acho', 'acho que...', 'acho...',
  'sei lá', 'sei la', 'sei la...', 'sei lá...',
  'quem sabe', 'quem sabe...',
  'pode ser', 'pode ser...',
  'talvez seja', 'talvez seja...',
  'provavelmente', 'provavelmente...',
  'possivelmente', 'possivelmente...',
  'acho que sim', 'acho que não', 'acho que nao',
  'não tenho certeza', 'nao tenho certeza',
  'não sei direito', 'nao sei direito',
  'meio', 'meio que', 'mais ou menos',
  'tipo', 'tipo...', 'sabe', 'sabe?',
]);

/**
 * Count emotional/sentiment words in a Portuguese message.
 * 
 * @param text - The message text
 * @returns Object with positive, negative, and total counts
 */
export function countEmotionalWords(text: string): { 
  positive: number; 
  negative: number; 
  total: number;
} {
  const normalized = text.toLowerCase().trim();
  const words = normalized.split(/\s+/);
  
  let positive = 0;
  let negative = 0;
  
  // Check for word matches
  for (const word of words) {
    const cleanWord = word.replace(/[.,!?;:]$/, ''); // Remove trailing punctuation
    
    if (POSITIVE_WORDS.has(word) || POSITIVE_WORDS.has(cleanWord)) {
      positive++;
    } else if (NEGATIVE_WORDS.has(word) || NEGATIVE_WORDS.has(cleanWord)) {
      negative++;
    }
  }
  
  // Also check for multi-word phrases
  for (const phrase of POSITIVE_WORDS) {
    if (phrase.includes(' ') && normalized.includes(phrase)) {
      positive++;
    }
  }
  
  for (const phrase of NEGATIVE_WORDS) {
    if (phrase.includes(' ') && normalized.includes(phrase)) {
      negative++;
    }
  }
  
  return {
    positive,
    negative,
    total: positive + negative,
  };
}

/**
 * Detect assertiveness level (0-100) from a Portuguese message.
 * 
 * High assertiveness markers:
 * - Exclamation marks (!)
 * - Imperative verbs (commands)
 * - ALL CAPS words
 * - Direct requests
 * 
 * Low assertiveness markers:
 * - Question marks (?)  
 * - Hedging words (talvez, será, não sei)
 * - Indirect language
 * 
 * @param text - The message text
 * @returns Assertiveness score (0-100)
 */
export function detectAssertiveness(text: string): number {
  const normalized = text.toLowerCase().trim();
  const words = normalized.split(/\s+/);
  const originalWords = text.split(/\s+/);
  
  let score = 50; // Base score
  
  // Check for imperative markers (high assertiveness)
  for (const word of words) {
    const cleanWord = word.replace(/[.,!?;:]$/, '');
    if (IMPERATIVE_MARKERS.has(word) || IMPERATIVE_MARKERS.has(cleanWord)) {
      score += 15;
    }
  }
  
  // Check for hedging words (low assertiveness)
  for (const word of words) {
    const cleanWord = word.replace(/[.,!?;:]$/, '');
    if (HEDGING_WORDS.has(word) || HEDGING_WORDS.has(cleanWord)) {
      score -= 15;
    }
  }
  
  // Exclamation marks increase assertiveness
  const exclamationCount = (text.match(/!/g) || []).length;
  score += exclamationCount * 5;
  
  // Question marks decrease assertiveness slightly
  const questionCount = (text.match(/\?/g) || []).length;
  score -= questionCount * 5;
  
  // ALL CAPS words indicate high assertiveness
  const capsWords = originalWords.filter(w => 
    w.length > 1 && w === w.toUpperCase() && /[A-Z]/.test(w)
  ).length;
  score += capsWords * 10;
  
  // Very short messages (< 3 words) with exclamation are very assertive
  if (words.length < 3 && exclamationCount > 0) {
    score += 10;
  }
  
  // Long messages with many questions are less assertive
  if (words.length > 20 && questionCount > 2) {
    score -= 10;
  }
  
  // Clamp between 0 and 100
  return Math.max(0, Math.min(100, score));
}

/**
 * Detect if text contains question(s).
 * 
 * @param text - The message text
 * @returns True if message contains a question mark
 */
export function hasQuestion(text: string): boolean {
  return text.includes('?');
}

/**
 * Count words in text.
 * 
 * @param text - The message text
 * @returns Word count
 */
export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}