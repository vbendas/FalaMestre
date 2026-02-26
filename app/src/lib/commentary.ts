import { MatchEvent, MatchContext, EventIntensity, ShotType, EventType, Player } from './types';

// Brazilian football slang and expressions
const SLANG = {
  goal: ['golaço', 'gol de placa', 'caneta', 'cavadinha', 'voleio', 'chilena', 'bicicleta', 'goloço', 'tremendo'],
  save: ['defesaça', 'milagrose', 'paredão', 'monstro', 'human wall', 'voou'],
  miss: ['tirou tinta', 'passou raspando', 'quase entrou', 'por pouco', 'quase', 'susto'],
  celebration: ['explodiu', 'vai à loucura', 'festeja', 'comemora', 'mostrawhy', 'égol'],
  tension: ['está quente', 'pressão total', 'tudo pode acontecer', 'contagem regressiva', 'minutos finais', 'decisão'],
  player_praise: ['crack', 'monstro', 'ídolo', 'artilheiro', 'craque', 'fenômeno', 'lenda'],
  referee: ['juiz', 'árbitro', 'bandeira', 'juiz de fora'],
};

function random<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getRandomSlang(category: keyof typeof SLANG): string {
  return random(SLANG[category]);
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Commentary templates by event type and intensity
type TemplateRecord = Record<EventIntensity, string[]>;

const COMMENTARY_TEMPLATES: Record<EventType, TemplateRecord> = {
  goal: {
    dramatic: [
      "⚽⚽⚽ GOOOOOOOOOOL! {player} NOS ACRESCIMOS! QUE MOMENTO HISTÓRICO!",
      "⚽ E LÁ VAI ELA! {player} FAZ O GOL DA VIRADA! INACREDITÁVEL!",
      "⚽ GOLAÇO! {player} COM UM CHUTE DE PLACA! O ESTÁDIO EXPLODE!",
      "⚽ {player} MARCA! A TORCIDA VAI À LOUCURA! {minute}'!",
      "⚽ GOL DE {shotType}! {player} É UM FENÔMENO! QUASE IMPOSSÍVEL!",
      "⚽⚽⚽ GOLAZO! {player} COM UM CHUTE INCROYÁVEL! {team} LEVA A TORCIDA AO DELÍRIO!",
      "⚽⚽⚽ GOL DO TÍTULO! {player} MARCA E LEVA A TAÇA! A HISTÓRIA FOI ESCRITA!",
      "⚽ É HORA DO SHOW! {player} decide! GOLAÇO DO {team}!",
      "⚽ E O CRAQUE FAZ O GOL! {player} MOSTRA PORQUE É ÍDOLO!",
      "⚽ A REDE BALANÇA! {player} FECHA O PLACAR COM UM GOLAÇO!",
      "⚽⚽⚽ MARCAÇÃO ZERO! O {player} NÃO PERDOOU! GOL AZUL!",
      "⚽ E AÍ, CADE O GOLEIRO? {player} FAZ O GOL!",
      "⚽ DENTRO DA ÁREA! NINGUÉM SEGURA {player}! GOL!",
      "⚽ E O {team} VIRA! {player} MARCA O GOL DA VIRADA!",
      "⚽ TEM CHUTE, TEM GOL! {player} EXPLODE A REDE!",
    ],
    high: [
      "⚽ GOOOOL! {player} abre o placar para o {team}!",
      "⚽ QUE GOLAÇO! {player} de {shotType}! Sensacional!",
      "⚽ {player} aproveita a chance e marca! {team} na frente!",
      "⚽ GOL DE {player}! {assist ? `Assistência de ${assist}!` : 'Jogada individual!'}",
      "⚽ {player} marca! É O PRIMEIRO GOL DA PARTIDA!",
      "⚽ QUASE IMPOSSÍVEL DEFENDER! {player} FAZ O GOL!",
      "⚽ GOOOL DO {team}! {player} COMPRA A BOLA E MARCA!",
      "⚽ O ATAQUE FUNCTIONA! {player} ESTÁ BEM POSICIONADO E MARCA!",
      "⚽ CHUTE FORTE! {player} FAZ O PRIMEIRO GOL!",
      "⚽ {player} TEM A PERNA GRANDE! FURA A DEFESA E MARCA!",
      "⚽ CRUZA, {player} COMPLETA! GOL DO {team}!",
      "⚽ FALTA NA ÁREA! {player} VAI COBRAR E MARCA!",
      "⚽ ESCANTEIO, {player} SOBE MAIS E MARCA! GOL!",
      "⚽ A BOLA ROLOU, {player} ESTAVA LÁ! GOL DO {team}!",
      "⚽ {player} COMPRA A CAVA! DEFESA NÃO SEGURA! GOL!",
    ],
    medium: [
      "⚽ Gol do {team}! {player} marca aos {minute}'.",
      "⚽ {player} faz o gol! Placar atualizado!",
      "⚽ O {team} marca! {player} não perdoa!",
      "⚽ GOL! {player} balançou as redes!",
      "⚽ {player} marca para o {team}!Placar: {homeScore}x{awayScore}",
      "⚽ Chute de {player}, a bola entra! Gol do {team}!",
      "⚽ {player} define bem e marca! {team} 1 x 0!",
      "⚽ O CRAQUE FAZ O GOL! {player} marca!",
      "⚽ Bola dentro da área, {player} completa! Gol!",
      "⚽ {player} não erra essa! GOL DO {team}!",
    ],
    low: [
      "⚽ {player} marca para o {team}.",
      "⚽ Placar: {homeScore}x{awayScore}",
      "⚽ Gol de {player}.",
      "⚽ {team} marca.",
      "⚽ {player} completa para o gol.",
      "⚽ Bola no fundo da rede. Gol.",
      "⚽ O {team} abre o placar.",
    ],
  },

  save: {
    dramatic: [
      "🧤 DEFESAÇA MILAGROSA! {player} SALVA O {team} COM O BRAÇO!",
      "🧤 IMPOSSÍVEL! {player} DEFENDE O INDEFENSÁVEL! O JUIZ OFERECEU!",
      "🧤 QUE DEFESA DO GOLEIRO! {player} É UM MONSTRO! NÃO DEU!",
      "🧤 MILAGRE! {player} FAZUMA DEFESA INCRÍVEL COM A PONTA DOS DEDOS!",
      "🧤 COM A MÃO INVERSA! {player} FAZ DEFESAÇCA HISTÓRICA!",
      "🧤 NO ÚLTIMO SEGUNDO! {player} EVITA O GOL CERTO!",
      "🧤 QUE REFLEXO! {player} DEFENDE O CHUTE CERTO DE {shotType}!",
      "🧤 O MONSTRO ACORDA! {player} SALVA O {team} NO最后一Minuto!",
      "🧤 DEFESA DE SEMIANO! {player} É TITULAR POR MERECIMENTO!",
      "🧤 COM O PEITO! {player} USA O CORPO E DEFENDE!",
    ],
    high: [
      "🧤 Grande defesa de {player}! Evitou o gol CERTO!",
      "🧤 {player} mostra PORQUE É TITULAR! DEFESA IMPORTANTE!",
      "🧤 {player} faz a defesa! O {team} respira aliviado!",
      "🧤 UFA! {player} salva o {team} com uma DEFESAÇA!",
      "🧤 O GOLEIRO {player} SAI BIEN! DEFENDEU!",
      "🧤 {player} PEGA BEM! DEFESA SEGURA!",
      "🧤 SEM CHANCE! {player} DEFENDE O CHUTE FORTE!",
      "🧤 AÍ SIM! {player} FAZ A DEFESAZA!",
      "🧤 O GOLEIRO NÃO DORMIU! {player} DEFENDE!",
      "🧤 FORA! {player} AFasta O PERIGO!",
    ],
    medium: [
      "🧤 {player} defende. O chute estava complicado.",
      "🧤 Defesa fácil para {player}.",
      "🧤 Sem problemas para o goleiro {player}.",
      "🧤 {player} segura a bola.",
      "🧤 Goleiro pega.",
      "🧤 Defesa sem dificuldade.",
      "🧤 {player} recolhe a bola.",
      "🧤 Sem perigo para {player}.",
    ],
    low: [
      "🧤 {player} pega tranquilamente.",
      "🧤 Goleiro segura.",
      "🧤 {player} recolhe.",
      "🧤 Bola com o goleiro.",
      "🧤 Sem sustos.",
    ],
  },

  miss: {
    dramatic: [
      "😱 NA TRAVE! {player} QUASE MARCA O GOL DO ANO! ESTÁDIO SUSPIRA!",
      "😱 QUE SUSTO! {player} BATE NA TRAVE! POR POUCO!",
      "😱 TIRA TINTA! {player} TIRA O CRAQUE DO LADO! QUASE!",
      "😱 NA MONTAÑA! {player} QUASE MARCA UM GOLAÇO!",
      "😱 SÓ NÃO ENTROU PORQUE NÃO QUIS! {player} TÁ COM FOME!",
      "😱 A BOLA PASSOU TÃO PERTO QUE O GOLEIRO TREMEU!",
      "😱 E O ÁRVOORE! {player} BATEU NO POSTE! POR POUCO!",
      "😱 NO OLHO DO CO! {player} QUASE MARCA!",
      "😱 ERRROU POR POUCO! {player} TINHA O GOL NO PÉ!",
      "😱 A REDE ATÉ BALANÇOU, MAS A BOLA NÃO ENTRou!",
    ],
    high: [
      "😱 Por pouco! {player} QUASE marca! O gol não veio!",
      "😱 Bateu na trave! {player} teve azar!",
      "😱 QUASE! {player} testa, o goleiro hesita, mas NÃO ENTRA!",
      "😱 SUSTO! {player} chute forte, vai POR CIMA!",
      "😱 O CHUTE DE {player} RASPA O POSTE! Quase!",
      "😱 ERROU O ALVO! {player} mandou pra fora!",
      "😱 TÁ LIVRE! {player} NÃO ACERTA A REDE!",
      "😱 BOLA ALTA! {player} SOBE MAIS E ERRA!",
      "😱 DESCUIDO! {player} Tinha espacio y falló!",
      "😱 A BOLA PASSOU TÃO PERTO... MAS NÃO ENTRou!",
    ],
    medium: [
      "😱 Chute de {player} vai longe.",
      "😱 {player} erra o alvo.",
      "😱 Sem perigo para a defesa.",
      "😱 {player} chute pra fora.",
      "😱 Aiming problem from {player}.",
      "😱 Bolarossa! {player} errou o chute.",
      "😱 Longe do gol.",
      "😱 {player} não acerta a球.",
    ],
    low: [
      "Chute de {player} sem perigo.",
      "Bola para fora.",
      "Erro de {player}.",
      "Sem ameaça.",
      "Desviou longe.",
      "Para o público.",
    ],
  },

  foul: {
    dramatic: [
      "🟨 FALTA! O {team} sofre falta na entrada da área! MOMENTO CRÍTICO!",
      "🟨 FALTA PERIGOSA! {player} comete falta nos acréscimos!",
      "🟨 FALTA DENTRO DA ÁREA! PÊNALTI PARA O {team}!",
      "🟨 O JUIZ MARCOU! FALTA NO {player}! VAI TER CHANCE DE GOL!",
      "🟨 FALTA ANTISPORTIVA! O {player} parou o contra-ataque!",
      "🟨 SEGURADA! {player} SEGURA O ADVERSÁRIO! FALTA!",
      "🟨 CARRINHO TARDIO! {player} CHEGA TARDE E BATE!",
      "🟨 SÃO MUITAS FALTAS! O {team} JOGA FORA!",
      "🟨 FALTA NO MEIO! O JOGO PARA!",
      "🟨 ESCORREGÃO! {player} CAUSA FALTA!",
    ],
    high: [
      "🟨 FALTA! O {team} sofre falta na entrada da área!",
      "🟨 O JUIZ SINALIZA! Falta perigosa para o {team}!",
      "🟨 FALTA PERIGOSA! {player} comete a falta!",
      "🟨 O {team} USA FORÇA EXCESSIVA! Cartão no ar!",
      "🟨 FALTA DE {player}! O jogo para!",
      "🟨 MUITA FORÇA! {player} derrubou o adversário!",
      "🟨 COBRINHA! {player}USA O BRAÇO E MARCAM FALTA!",
      "🟨 FALTA TÁTICA! {player} interrompe o ataque!",
      "🟨 JOGADA BRUTAL! {player} commete falta!",
      "🟨 FALTA LEVE! O juíz marca!",
    ],
    medium: [
      "🟨 Falta de {player}.",
      "🟨 O jogo para. Falta marcando.",
      "🟨 Falta no meio-campo.",
      "🟨 {player} commete falta.",
      "🟨 Jogo interrompido.",
      "🟨 Falta marcada.",
      "🟨 {player} derrubou.",
      "🟨 Falta divisão.",
    ],
    low: [
      "Falta simples.",
      "Falta leve.",
      "Jogo parado.",
      "Pequena infração.",
      "Contato leve.",
      "Sem gravidade.",
    ],
  },

  card: {
    dramatic: [
      "🟨🟨 SEGUNDO AMARELO! {player} É EXPULSO! O {team} VAI JOGAR COM 10!",
      "🟥 DIRETO VERMELHO! {player} COMMETTE FALTA EXTREMA! FORA!",
      "🟥 EXPULSO! {player} NÃO AGUENTOU A PRESSÃO! CAMINHO DOS VESTIÁRIOS!",
      "🟨🟨 FIM DE JOGO PARA {player}! SEGUNDO AMARELO!",
      "🟥 VERMELHO DIRETO! {player} USA FORÇA EXCESSIVA! FORA!",
      "🟨🟨 E ESTÁ EXPULSO! O {team} FICA COM 10!",
      "🟥 ATRÁS DO PLACAR! {player} VAI EMBORA!",
      "🟨🟨 AMARELO ATRÁS DE AMARELO! {player} TÁ FORA!",
    ],
    high: [
      "🟨🟨 SEGUNDO AMARELO! {player} É EXPULSO! O {team} VAI JOGAR COM 10!",
      "🟥 DIRETO VERMELHO! {player} COMMETTE FALTA EXTREMA! FORA!",
      "🟨 Cartão amarelo para {player}. Jogador mais cuidado!",
      "🟨 AMARELO PARA {player}! Muito perigoso!",
      "🟨 {player} leva o primeiro amarelo!",
      "🟨🟨 SAI FORA! SEGUNDO AMARELO!",
      "🟨 PRIMEIRO AMARELO PARA {player}!",
      "🟥 VERMELHO! {player} vai ver oVAR!",
    ],
    medium: [
      "🟨 {player} leva cartão amarelo.",
      "🟨 Amarelo para {player}.",
      "🟨 Cartão mostrado para {player}.",
      "🟨 {player} recebe o amarelo.",
      "🟨 O juíz mostra cartão.",
      "🟨 Amarelo marcado.",
    ],
    low: [
      "Cartão mostrado.",
      "Amarelo na partida.",
      "Jogador advertida.",
      "Sem bola.",
    ],
  },

  corner: {
    dramatic: [
      "🚩 ESCANTEIO! O {team} vai cobrar! Tensão máxima na área!",
      "🚩 ÚLTIMO ESCANTEIO! {player} BATE! TODO MUNDO NA ÁREA!",
      "🚩 ESCANTEIO DO {team}! VAI TER CHANCE DE GOL!",
      "🚩 COISA RARA! ESCANTEIO PARA O {team}!",
      "🚩 FALTA! OU SERÁ ESCANTEIO? O JUIZ MARCA!",
      "🚩 CRUZEIRO! {player} VAI COBRAR! TODO MUNDO AGUARDA!",
      "🚩 ESCANTEIO CURTO! {player} Tenta jogada ensaiada!",
      "🚩 Aí VEM A BOLA! {player} BATE NO PRIMEIRO POSTE!",
    ],
    high: [
      "🚩 ESCANTEIO! O {team} vai cobrar! Tensão na área!",
      "🚩 {player} BATE O ESCANTEIO! Jogada ensaiada!",
      "🚩 ESCANTEIO PERIGOSO! A marcação fica tensa!",
      "🚩 COBRO DE {player}! A BOLA VAI PARA A ÁREA!",
      "🚩 ESCANTEIO PARA O {team}! {player} vai cobrar!",
      "🚩 CRUZAMENTO RASPÃO! {player} BATE QUASE!",
      "🚩 BOLA ALTA! {player} PROCURA O FUNDO DA REDE!",
      "🚩 NO SEGUNDO POSTE! {player} BATE!",
      "🚩 CURTO! {player} OPT POR JOGADA DIFERENTE!",
    ],
    medium: [
      "🚩 Escanteio para o {team}.",
      "🚩 {player} cobran corner.",
      "🚩 Escanteio marcado.",
      "🚩 {team} ganha escanteio.",
      "🚩 Bola sai pela linha de fundo.",
      "🚩 Escanteio do {team}.",
      "🚩 Cobrança de {player}.",
    ],
    low: [
      "Escanteio.",
      "Corner.",
      "Bola saíu.",
      "Escanteio curto.",
      "Sem grandes chances.",
    ],
  },

  pressure: {
    dramatic: [
      "🔥🔥🔥 PRESSÃO TOTAL! O {team} ATACA SEM PARAR!",
      "🔥 O {team} CRESCEU! ESTÁ EM CIMA DO ADVERSÁRIO!",
      "🔥 FOGUEIRA NO PAREDE! O {team} pressiona sem mercy!",
      "🔥🔥🔥 O {team} APERTA! A defesa rival está acuada!",
      "🔥 OH! O {team} pressiona! Vai marcar agora!",
      "🔥 Momento de decisão! O {team} pressiona forte!",
      "🔥🔥🔥 CAOS na área! O {team} pressiona forte!",
    ],
    high: [
      "🔥 O {team} pressiona! Chance pode sair a qualquer momento!",
      "🔥 Pressão do {team}. A defesa rival sofrem!",
      "🔥 ONDA DE ATAQUE! O ataque avança com a bola!",
      "🔥 O {team} intensifica o jogo! Rodeia a área!",
      "🔥 O time pressiona! Boa intensidade!",
      "🔥 O ataque aperta! A defesa não respira!",
      "🔥 Pressão constante do {team}! Busca o gol!",
      "🔥 O {team} acordou! Pressiona forte!",
    ],
    medium: [
      "Pressão do {team}.",
      "Jogo truncado na intermediária.",
      "O {team} tenta criar chances.",
      "Intensidade aumenta no meio.",
      "Disputa equilibrada.",
      "Nenhum time domina ainda.",
    ],
    low: [
      "Equilíbrio no meio-campo.",
      "Sem pressão imediata.",
      "Jogo calmo por agora.",
      "Cautela domina.",
      "Sem grandes emoções.",
      "Times se observam.",
    ],
  },

  buildup: {
    dramatic: [
      "🎯 {player} COM A BOLA! Procura o passe decisivo...",
      "🎯 O {team} CONSTRÓI com paciência! Momento crucial!",
      "🎯 A jogada se desenvolve... ninguém sabe o que vai acontecer!",
      "🎯 {player} domina a bola! O ataque se organiza!",
      "🎯 Construção de jogo do {team}... ataca com inteligência!",
      "🎯 O {team} tenta infiltrar... será que consegue?",
      "🎯 Bola com {player}, que procura alternativas!",
      "🎯 {player} tabela com o companheiro! Boas jogadas no meio-campo!",
      "🎯 {player} recebe e Gira! Busca companions!",
      "🎯 O {team} trabalha a bola! Paciência compensa!",
      "🎯 {player} tabelinha com o lateral! {team} pressiona!",
    ],
    high: [
      "🎯 {player} COM A BOLA! Procura espaço...",
      "🎯 O {team} TROCA passes. Quer chegar com calma!",
      "🎯 {player} conduz. Boa transição de jogo!",
      "🎯 O {team} mantém a posse, buscando a jogada!",
      "🎯 {player} domina e acelera! Leva a bola para frente!",
      "🎯 Troca de passes no meio-campo do {team}!",
      "🎯 {player} oferece opções de passe! Boas opções!",
      "🎯 O {team} constrói pelas laterais!",
      "🎯 {player} protege a bola e espera reforços!",
      "🎯 Jogo de paciência do {team}! Aguardando abertura!",
      "🎯 {player} recebe e gira! Procura o passe!",
      "🎯 Bola circulando no {team}!",
      "🎯 {player} Table com o laterais! {team} pressiona!",
      "🎯 O {team} gira a bola no meio!",
      "🎯 {player} tenta pelas extremas!",
    ],
    medium: [
      "Jogo parado.",
      "Retomada de bola.",
      "Bola recuperada no meio-campo.",
      "O {team} tenta organizar o ataque.",
      "Posse de bola dividida.",
      "Jogo de transição.",
      "Equilíbrio nas ações.",
      "Times se estudam.",
      "Bola circulando.",
      "Nenhuma chance clara.",
      "Transição defensiva.",
      "Meio-campo disputada.",
    ],
    low: [
      "Bola no meio.",
      "Jogo equilibrado.",
      "Cautela dos dois lados.",
      "Sem grandes chances ainda.",
      "Primeiros minutos de estudo.",
      "Posse de bola equilibrada.",
      "Jogo correu pelo meio.",
      "Nenhuma pressão imediata.",
      "Sem emoção ainda.",
      "Observação mútua.",
    ],
  },

  commentary: {
    dramatic: [
      "⏰ ÚLTIMOS MINUTOS! TUDO PODE ACONTECER!",
      "⏰ CONTAGEM REGRESSIVA! O CORAÇÃO DA TORCIDA PAROU!",
      "⏰ SÓ ASSISTINDO! NINGUÉM SEGURA ESSA EMOCÃO!",
      "⏰🔥 GOL OU NADA! MOMENTO DECISIVO!",
      "⏰ O TEMPO É CURTO! A EMOCÃO AUMENTA!",
      "⏰🔥 TENSÃO MÁXIMA! NINGUÉM ARRISCA RESPIRAR!",
      "⏰ ÚLTIMA CHANCE! O {team} PRECISA MARCAR!",
    ],
    high: [
      "📢 A pelada está INCENDIADA!",
      "📢 Jogo MUITO EQUILIBRADO!",
      "📢 Torcida fazem uma CAMARADA INCRÍVEL!",
      "📢 Partida muito abierta! Chances para todos os lados!",
      "📢 EMOCIONANTE! O jogo não tem dono!",
      "📢 Intensidade nas alturas! Ninguém give up!",
      "📢 Jogão! As equipes brigam por cada bola!",
    ],
    medium: [
      "📢 Jogo corrido no meio-campo.",
      "📢 Times se estudam muito.",
      "📢 Ritmo equilibrado.",
      "📢 Disputa técnica no центра do campo.",
      "📢 Momento de análise.",
      "📢 Partida pegada.",
    ],
    low: [
      "Partida equilibrada.",
      "Jogo calmo.",
      "Sem emoções ainda.",
      "Primeiros minutos.",
      "Estudo mútuo.",
    ],
  },

  tension: {
    dramatic: [
      "💢💢💢 TENSÃO MÁXIMA! PRÓXIMO DO FIM! PRECISA MARCAR!",
      "💢 O TEMPO ACABA! O {team} PRECISA DO GOL!",
      "💢 IMPACIENTE! Torcida não aguenta mais!",
      "💢💢💢 DECISÃO! SÓ UM GOL FALTA!",
      "💢 PRESSÃO TOTAL! CADA MINUTO CONTA!",
      "💢 CORAÇÃO PAROU! O {team} vai marcar?",
      "💢💢💢 A EMOCÃO NÃO CABE NO PEITO!",
    ],
    high: [
      "💢 Fica quente! O jogo está MUITO intenso!",
      "💢 Pressão psicológicacresce!",
      "💢 O，终盤 está arrive! Momento de decisão!",
      "💢 Torcida ansiosa! Não aguenta mais!",
      "💢 Minas de tensão! Pode sair gol a qualquer momento!",
      "💢 Atenção Máxima! A slightest mistake pode custar!",
    ],
    medium: [
      "Tensão aumenta.",
      "Jogo fica mais pegado.",
      "Pressão psicológica grows.",
      "Momento importante.",
      "Decisão se aproxima.",
      "Jogo ganha peso.",
    ],
    low: [
      "Calma no jogo.",
      "Sem pressão ainda.",
      "Relaxed atmosphere.",
      "Jogo tranquilo.",
    ],
  },

  kickoff: {
    dramatic: [
      "🏃 E COMEÇA O JOGO! Bola rolando no {stadium}!",
      "🏃 E LÁ VAMOS NÓS! PARTIDA INICIADA!",
      "🏃 O ÁRBITRO ASSOPRA O APITO! VAMOS COMEÇAR!",
      "🏃 A EXPECTATIVA ESTÁ NO ÁPICE! PARTIDA COMEÇA AGORA!",
      "🏃 TORCIDA GRITANDO! O JOGO VAI COMEÇAR!",
      "🏃 COM MUITO CLAMOR! A BOLA ROLA!",
      "🏃 O MOMENTO CHEGOU! VAMOS AOS 90 MINUTOS!",
    ],
    high: [
      "🏃 E COMEÇA O JOGO! Bola rolando no {stadium}!",
      "🏃 E LÁ VAMOS NÓS! PARTIDA INICIADA!",
      "🏃 O ÁRBITRO ASSOPRA O APITO! VAMOS COMEÇAR!",
      "🏃 PARTIDA COMEÇA! {homeTeam} x {awayTeam}!",
      "🏃 O {team} QUER MOSTRAR SEU FUTEBOL!",
      "🏃 COMEÇA O ESPETÁCULO! BOLA ROLANDO!",
      "🏃 E VAMOS COMEÇAR! QUEM VAI LEVAR A MELHOR!",
    ],
    medium: [
      "🏃 E COMEÇA O JOGO!",
      "🏃 PARTIDA INICIADA!",
      "🏃 Bola rolando.",
      "🏃 Jogo começa.",
      "🏃 Apito inicial.",
      "🏃 Começa a partida.",
    ],
    low: [
      "🏃 Jogo começa.",
      "🏃 Partida inicia.",
      "🏃 Bola rola.",
      "🏃 Início.",
    ],
  },

  halftime: {
    dramatic: [
      "⏸️ FIM DO PRIMEIRO TEMPO! {homeScore}x{awayScore}! TUDO ABERTO!",
      "⏸️ INTERVALO! {homeScore}x{awayScore}! PODE ACONTECER DE TUDO!",
      "⏸️ VAI PARA O VESTIÁRIO! {homeScore}x{awayScore}! PARTIDA EMOCIONANTE!",
    ],
    high: [
      "⏸️ FIM DO PRIMEIRO TEMPO! {homeScore}x{awayScore} no placar!",
      "⏸️ Intervalo! Times vão para o vestiário com {homeScore}x{awayScore}!",
      "⏸️ PRIMEIRO TEMPO ENCERRA! {homeScore}x{awayScore}!",
      "⏸️ VAI TER SEGUNDO TEMPO ELECTRIZANTE! {homeScore}x{awayScore}!",
      "⏸️ ATÉ AI! {homeScore}x{awayScore}! MUITO ABERTO!",
    ],
    medium: [
      "⏸️ FIM DO PRIMEIRO TEMPO! {homeScore}x{awayScore}!",
      "⏸️ Intervalo!",
      "⏸️ Primeiro tempo termina.",
      "⏸️ Plac {homeScore}x{awayScore}.",
      "⏸️ Intervalo na partida.",
    ],
    low: [
      "⏸️ Intervalo.",
      "⏸️ Fim do primeiro tempo.",
      "⏸️ Pausa.",
    ],
  },

  substitution: {
    dramatic: [
      "🔄 SUBSTITUIÇÃO NO {team}! Entra {playerIn}, sai {playerOut}! MOMENTO CRÍTICO!",
      "🔄 TÁTICA! {playerIn} ENTRA NO LUGAR DE {playerOut}!",
      "🔄 ÚLTIMA SUBSTITUIÇÃO! O {team} TENTA MUDAR O JOGO!",
      "🔄 MUDANÇA NO {team}! {playerIn} ESTÁ PREPARADO!",
      "🔄 O {team} FAZ SUBSTITUIÇÃO! {playerOut} SAI, {playerIn} ENTRA!",
    ],
    high: [
      "🔄 SUBSTITUIÇÃO no {team}! Entra {playerIn}, sai {playerOut}!",
      "🔄 MUDANÇA TÁTICA! {playerIn} ENTRA NO JOGO!",
      "🔄 O {playerOut} SAI! {playerIn} VAI ENTRAR!",
      "🔄 SUBSTITUIÇÃO DO {team}! TREINADOR MUDA O TIME!",
      "🔄 NOVIDADE! {playerIn} FAZ SUA ENTRADA!",
    ],
    medium: [
      "🔄 Substituição no {team}.",
      "🔄 {playerIn} entra.",
      "🔄 {playerOut} sai.",
      "🔄 Mudança no time.",
      "🔄 Troca de jogador.",
    ],
    low: [
      "🔄 Substituição.",
      "🔄 Troca.",
    ],
  },

  whistle: {
    dramatic: [
      "⏺️ FIM DE JOGO! PARTIDA ENCERRADA!",
      "⏺️ E CHEGA AO FIM! O ÁRBITRO ASSOPRA!",
      "⏺️ CHEGA! FIM DE PARTIDA! {homeScore}x{awayScore}!",
      "⏺️ E ESTÁ ENCERRADO! O JOGO TERMINA!",
      "⏺️ SÓ ISSO! FIM DE JOGO!",
      "⏺️ E O FIM! ENCERRAMOS POR AQUI!",
    ],
    high: [
      "⏺️ FIM DE JOGO! PARTIDA ENCERRADA!",
      "⏺️ O ÁRBITRO ASSOPRA O FIM! ENCERRAMOS!",
      "⏺️ FIM! O JOGO TERMINA!",
      "⏺️ ENCERRADO! PARTIDA ACABOU!",
      "⏺️ CHEGA AO FIM! PLACAR {homeScore}x{awayScore}!",
    ],
    medium: [
      "⏺️ Fim de jogo!",
      "⏺️ Encerrado!",
      "⏺️ Partida termina.",
      "⏺️ Jogo acabou.",
      "⏺️ Fim.",
    ],
    low: [
      "⏺️ Fim.",
      "⏺️ Acabou.",
      "⏺️ Termina.",
    ],
  },
};

function calculateIntensity(minute: number, context: MatchContext): EventIntensity {
  const { homeScore, awayScore, tension } = context;
  
  // Last 15 minutes = dramatic
  if (minute >= 75) return 'dramatic';
  
  // High tension in close games
  if (tension >= 70) return 'dramatic';
  
  // Close final score in last 30 mins
  if (minute >= 60 && Math.abs(homeScore - awayScore) <= 1) return 'high';
  
  // Goals, saves, near misses are high
  if (minute >= 30 && minute <= 75) return 'high';
  
  return 'medium';
}

function generateGoalCommentary(
  player: Player | undefined,
  assist: Player | undefined,
  minute: number,
  context: MatchContext,
  isHome: boolean
): string {
  const team = isHome ? context.homeTeam : context.awayTeam;
  const templates = COMMENTARY_TEMPLATES.goal[calculateIntensity(minute, context)];
  const template = random(templates);
  
  const shotTypes: ShotType[] = ['header', 'volley', 'normal', 'free_kick'];
  const shotType = random(shotTypes);
  
  return template
    .replace('{player}', player?.name || 'Jogador')
    .replace('{team}', team)
    .replace('{minute}', minute.toString())
    .replace('{shotType}', shotType === 'header' ? 'cabeçada' : shotType === 'volley' ? 'vôleio' : shotType === 'free_kick' ? 'falta' : 'chute')
    .replace('{homeScore}', context.homeScore.toString())
    .replace('{awayScore}', context.awayScore.toString())
    .replace('{assist}', assist?.name || '');
}

function generateSaveCommentary(
  player: Player | undefined,
  minute: number,
  context: MatchContext,
  isHome: boolean
): string {
  const team = isHome ? context.homeTeam : context.awayTeam;
  const templates = COMMENTARY_TEMPLATES.save[calculateIntensity(minute, context)];
  const template = random(templates);
  
  return template
    .replace('{player}', player?.name || 'Goleiro')
    .replace('{team}', team);
}

function generateNearMissCommentary(
  player: Player | undefined,
  minute: number,
  context: MatchContext,
  isHome: boolean
): string {
  const templates = COMMENTARY_TEMPLATES.miss[calculateIntensity(minute, context)];
  const template = random(templates);
  
  return template
    .replace('{player}', player?.name || 'Jogador');
}

function generateFoulCommentary(
  player: Player | undefined,
  minute: number,
  context: MatchContext,
  isHome: boolean
): string {
  const team = isHome ? context.homeTeam : context.awayTeam;
  const templates = COMMENTARY_TEMPLATES.foul[calculateIntensity(minute, context)];
  const template = random(templates);
  
  return template
    .replace('{player}', player?.name || 'Jogador')
    .replace('{team}', team);
}

function generateCardCommentary(
  player: Player | undefined,
  minute: number,
  isYellow: boolean,
  isHome: boolean
): string {
  const team = isHome ? 'casa' : 'visitante';
  // Use medium templates for yellow cards, high templates for red cards
  const templates = isYellow ? COMMENTARY_TEMPLATES.card.medium : COMMENTARY_TEMPLATES.card.high;
  const template = random(templates);
  
  return template.replace('{player}', player?.name || 'Jogador').replace('{team}', team);
}

function generatePressureCommentary(
  minute: number,
  context: MatchContext,
  isHome: boolean
): string {
  const team = isHome ? context.homeTeam : context.awayTeam;
  const templates = COMMENTARY_TEMPLATES.pressure[calculateIntensity(minute, context)];
  const template = random(templates);
  
  return template.replace('{team}', team);
}

function generateBuildupCommentary(
  player: Player | undefined,
  minute: number,
  context: MatchContext,
  isHome: boolean
): string {
  const team = isHome ? context.homeTeam : context.awayTeam;
  const templates = COMMENTARY_TEMPLATES.buildup.high;
  const template = random(templates);
  
  return template
    .replace('{player}', player?.name || 'Jogador')
    .replace('{team}', team);
}

function generateTensionCommentary(minute: number, context: MatchContext): string {
  const templates = COMMENTARY_TEMPLATES.tension[calculateIntensity(minute, context)];
  const template = random(templates);
  const team = context.homeScore > context.awayScore ? context.awayTeam : 
               context.awayScore > context.homeScore ? context.homeTeam : 'ambos';
  
  return template.replace('{team}', team);
}

function generateKickoffCommentary(context: MatchContext): string {
  const templates = COMMENTARY_TEMPLATES.kickoff[calculateIntensity(0, context)];
  const template = random(templates);
  
  return template.replace('{stadium}', 'estádio');
}

function generateHalftimeCommentary(context: MatchContext): string {
  const templates = COMMENTARY_TEMPLATES.halftime[calculateIntensity(45, context)];
  const template = random(templates);
  
  return template
    .replace('{homeScore}', context.homeScore.toString())
    .replace('{awayScore}', context.awayScore.toString());
}

function generateWhistleCommentary(homeScore?: number, awayScore?: number): string {
  const templates = COMMENTARY_TEMPLATES.whistle.high;
  let template = random(templates);
  
  // Replace score placeholders if provided
  if (homeScore !== undefined && awayScore !== undefined) {
    template = template
      .replace('{homeScore}', homeScore.toString())
      .replace('{awayScore}', awayScore.toString());
  }
  
  return template;
}

export {
  generateGoalCommentary,
  generateSaveCommentary,
  generateNearMissCommentary,
  generateFoulCommentary,
  generateCardCommentary,
  generatePressureCommentary,
  generateBuildupCommentary,
  generateTensionCommentary,
  generateKickoffCommentary,
  generateHalftimeCommentary,
  generateWhistleCommentary,
  calculateIntensity,
  random,
  SLANG,
};
