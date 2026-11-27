document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  // =====================================
  // CONFIGURAÇÕES
  // =====================================

  const PASTA = "./animacao-portfolio/imagens animadas/";
  const PREFIXO = "animaçao_";
  const TARGET = "./target/target.mind";

  // FPS reais da animação
  const FPS = 25;
  const TEMPO_FRAME = 1000 / FPS;

  // Música
  const INTRO = 3000;
  const FINAL = 3000;

  // Microanimações
  const ENTRADA = 450;
  const SAIDA = 450;

  // Fundo
  const COR_FUNDO = "#f4f8fb";
  const OPACIDADE_FUNDO = 0.60;
  const RAIO_CANTOS = 38;

  // TAMANHO DO FUNDO
  // menor para as imagens parecerem sair para fora
  const FUNDO_LARGURA_PERCENT = 0.74;
  const FUNDO_ALTURA_PERCENT = 0.74;

  // TAMANHO DAS IMAGENS
  // muito maiores, quase a ocupar a área toda
  const IMAGEM_LARGURA_PERCENT = 0.95;
  const IMAGEM_ALTURA_PERCENT = 0.95;

  // Tamanho do plano AR
  const LARGURA_AR = 3.05;

  // Estabilidade do tracking
  const ATRASO_PERDA_TARGET = 350;

  const LIMITE = 300;

  const $ = id => document.getElementById(id);

  // =====================================
  // ELEMENTOS
  // =====================================

  const ecraInicio = $("inicio");
  const ecraCarregamento = $("carregamento");
  const ecraErro = $("erro");
  const ecraScanner = $("scanner");

  const audio = $("musica-ar");
  const botaoSom = $("botao-som");
  const mensagem = $("mensagem-scanner");
  const contagem = $("contagem");

  let cena;
  let alvo;
  let plano;
  let material;
  let textura;
  let canvas;
  let contexto;

  // =====================================
  // ESTADO
  // =====================================

  let imagens = [];
  let DURACAO = 0;

  let pronto = false;
  let reconhecido = false;
  let emAnimacao = false;
  let emFinalMusical = false;
  let executado = false;

  let aDesenhar = false;
  let ultimoFrame = -1;

  let inicioCiclo = 0;
  let inicioAnimacao = 0;
  let sessao = 0;

  let timerIntro = null;
  let timerFinal = null;
  let timerPerda = null;
  let pedidoFrame = null;

  // =====================================
  // GESTÃO DOS ECRÃS
  // =====================================

  function mostrar(ecra) {
    [ecraInicio, ecraCarregamento, ecraErro, ecraScanner].forEach(elemento => {
      elemento.classList.toggle("ativo", elemento === ecra);
    });

    if (ecra === ecraScanner) {
      ecraScanner.classList.remove("preparar");
    }
  }

  // =====================================
  // PROGRESSO
  // =====================================

  function progresso(valor, descricao) {
    const n = Math.max(0, Math.min(100, Math.round(valor)));

    $("percentagem").textContent = n + "%";

    $("circulo-progresso").style.setProperty("--valor", n);
    $("barra-valor").style.width = n + "%";
    $("barra-progresso").setAttribute("aria-valuenow", String(n));
    $("texto-carregamento").textContent = descricao;
  }

  // =====================================
  // ERROS
  // =====================================

  function mostrarErro(texto, detalhe) {
    console.error("Erro na experiência AR:", detalhe || texto);

    cancelar();

    $("texto-erro").textContent = texto;
    mostrar(ecraErro);
  }

  // =====================================
  // CARREGAR SCRIPTS
  // =====================================

  function carregarScript(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url;
      script.onload = resolve;
      script.onerror = () => reject(new Error("Falha ao carregar " + url));
      document.head.appendChild(script);
    });
  }

  async function carregarBibliotecas() {
    progresso(4, "A preparar o reconhecimento...");

    if (!window.AFRAME) {
      await carregarScript("https://aframe.io/releases/1.5.0/aframe.min.js");
    }

    progresso(10, "A iniciar a realidade aumentada...");

    if (!AFRAME.components["mindar-image"]) {
      await carregarScript("https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js");
    }

    if (!AFRAME.components["mindar-image"]) {
      throw new Error("A biblioteca MindAR não está disponível.");
    }
  }

  // =====================================
  // CAMINHOS
  // =====================================

  function caminho(i) {
    return PASTA + PREFIXO + String(i).padStart(5, "0") + ".png";
  }

  async function existe(i) {
    const url = caminho(i);

    let resposta = await fetch(url, {
      method: "HEAD",
      cache: "no-store"
    });

    if (resposta.status === 405) {
      resposta = await fetch(url, { cache: "no-store" });
    }

    if (resposta.status === 404) {
      return false;
    }

    if (!resposta.ok) {
      throw new Error("Erro HTTP " + resposta.status + ": " + url);
    }

    return true;
  }

  // =====================================
  // CONTAR IMAGENS
  // =====================================

  async function contarImagens() {
    if (!(await existe(0))) {
      throw new Error("Não encontrei " + caminho(0));
    }

    let inferior = 0;
    let superior = 1;

    while (superior < LIMITE && await existe(superior)) {
      inferior = superior;
      superior *= 2;
    }

    superior = Math.min(superior, LIMITE);

    while (superior - inferior > 1) {
      const meio = Math.floor((inferior + superior) / 2);

      if (await existe(meio)) {
        inferior = meio;
      } else {
        superior = meio;
      }
    }

    if (superior === LIMITE && await existe(LIMITE - 1)) {
      throw new Error("A sequência excede o limite.");
    }

    return superior;
  }

  // =====================================
  // CARREGAR IMAGENS
  // =====================================

  async function carregarImagens() {
    progresso(15, "A procurar as ilustrações...");

    const total = await contarImagens();

    imagens = new Array(total);

    let seguinte = 0;
    let carregadas = 0;

    async function trabalhador() {
      while (seguinte < total) {
        const i = seguinte++;

        const resposta = await fetch(caminho(i), { cache: "no-store" });

        if (!resposta.ok) {
          throw new Error("Não foi possível carregar " + caminho(i));
        }

        imagens[i] = await resposta.blob();

        carregadas++;

        progresso(
          15 + (carregadas / total) * 70,
          "A carregar ilustrações: " + carregadas + " de " + total
        );
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(6, total) }, () => trabalhador())
    );

    DURACAO = total * TEMPO_FRAME;

    console.log("Fotogramas:", total);
    console.log("Velocidade:", FPS, "FPS");
    console.log("Duração:", DURACAO / 1000, "segundos");
  }

  // =====================================
  // CRIAR CENA
  // =====================================

  function criarCena() {
    $("area-ar").innerHTML = `
      <a-scene
        embedded
        mindar-image="
          imageTargetSrc: ${TARGET};
          autoStart: false;
          uiScanning: no;
          uiLoading: no;
          uiError: no"
        color-space="sRGB"
        renderer="colorManagement: true"
        vr-mode-ui="enabled: false"
        device-orientation-permission-ui="enabled: false">

        <a-camera
          position="0 0 0"
          look-controls="enabled: false">
        </a-camera>

        <a-entity
          id="alvo-ar"
          mindar-image-target="targetIndex: 0">

          <a-plane
            id="animacao-ar"
            position="0 0 0.05"
            width="${LARGURA_AR}"
            height="1"
            material="
              shader: flat;
              transparent: true;
              side: double;
              depthWrite: false;
              opacity: 0"
            visible="false">
          </a-plane>

        </a-entity>
      </a-scene>
    `;

    cena = document.querySelector("a-scene");
    alvo = $("alvo-ar");
    plano = $("animacao-ar");

    cena.addEventListener("arError", () => {
      mostrarErro(
        "Não foi possível iniciar a câmara ou carregar o marcador AR. Verifica as permissões e tenta novamente."
      );
    });

    alvo.addEventListener("targetFound", () => {
      reconhecido = true;

      if (timerPerda) {
        clearTimeout(timerPerda);
        timerPerda = null;
      }

      if (pronto) {
        prepararInicio();
      }
    });

    alvo.addEventListener("targetLost", () => {
      reconhecido = false;

      if (timerPerda) {
        clearTimeout(timerPerda);
      }

      timerPerda = setTimeout(() => {
        if (!reconhecido && !emFinalMusical) {
          cancelar();
        }
      }, ATRASO_PERDA_TARGET);
    });
  }

  // =====================================
  // ESPERAS
  // =====================================

  function esperarCena() {
    return new Promise(resolve => {
      if (cena.hasLoaded) {
        resolve();
        return;
      }

      cena.addEventListener("loaded", resolve, { once: true });
    });
  }

  function esperarMalha() {
    return new Promise((resolve, reject) => {
      const limite = performance.now() + 10000;

      function verificar() {
        const mesh = plano.getObject3D("mesh");

        if (mesh) {
          resolve(mesh);
          return;
        }

        if (performance.now() > limite) {
          reject(new Error("O plano AR não ficou disponível."));
          return;
        }

        requestAnimationFrame(verificar);
      }

      verificar();
    });
  }

  // =====================================
  // RETÂNGULO ARREDONDADO
  // =====================================

  function retanguloArredondado(x, y, largura, altura, raio) {
    const r = Math.min(raio, largura / 2, altura / 2);

    contexto.beginPath();
    contexto.moveTo(x + r, y);
    contexto.lineTo(x + largura - r, y);
    contexto.quadraticCurveTo(x + largura, y, x + largura, y + r);
    contexto.lineTo(x + largura, y + altura - r);
    contexto.quadraticCurveTo(x + largura, y + altura, x + largura - r, y + altura);
    contexto.lineTo(x + r, y + altura);
    contexto.quadraticCurveTo(x, y + altura, x, y + altura - r);
    contexto.lineTo(x, y + r);
    contexto.quadraticCurveTo(x, y, x + r, y);
    contexto.closePath();
  }

  // =====================================
  // DESENHAR COMPOSIÇÃO
  // =====================================

  function desenharComposicao(imagem) {
    const w = canvas.width;
    const h = canvas.height;

    contexto.clearRect(0, 0, w, h);
    contexto.imageSmoothingEnabled = true;
    contexto.imageSmoothingQuality = "high";

    // FUNDO MAIS PEQUENO
    // para as estrelas / ilustrações saírem para fora

    const fundoW = w * FUNDO_LARGURA_PERCENT;
    const fundoH = h * FUNDO_ALTURA_PERCENT;
    const fundoX = (w - fundoW) / 2;
    const fundoY = (h - fundoH) / 2;

    contexto.save();
    retanguloArredondado(
      fundoX,
      fundoY,
      fundoW,
      fundoH,
      RAIO_CANTOS
    );
    contexto.fillStyle = COR_FUNDO;
    contexto.globalAlpha = OPACIDADE_FUNDO;
    contexto.fill();
    contexto.restore();

    // IMAGENS MUITO MAIORES
    // não fazemos clip ao fundo para que alguns elementos saiam fora

    const areaW = w * IMAGEM_LARGURA_PERCENT;
    const areaH = h * IMAGEM_ALTURA_PERCENT;

    const escala = Math.min(
      areaW / imagem.width,
      areaH / imagem.height
    );

    const desenhoW = imagem.width * escala;
    const desenhoH = imagem.height * escala;

    const x = (w - desenhoW) / 2;
    const y = (h - desenhoH) / 2;

    contexto.drawImage(imagem, x, y, desenhoW, desenhoH);

    textura.needsUpdate = true;
  }

  // =====================================
  // PREPARAR TEXTURA
  // =====================================

  async function prepararTextura() {
    await esperarCena();

    const mesh = await esperarMalha();

    const primeira = await createImageBitmap(imagens[0]);

    const proporcao = primeira.height / primeira.width;

    canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = Math.max(1, Math.round(1600 * proporcao));

    contexto = canvas.getContext("2d", { alpha: true });

    plano.setAttribute("width", LARGURA_AR);
    plano.setAttribute("height", LARGURA_AR * proporcao);

    textura = new AFRAME.THREE.CanvasTexture(canvas);

    if (AFRAME.THREE.SRGBColorSpace) {
      textura.colorSpace = AFRAME.THREE.SRGBColorSpace;
    }

    material = mesh.material;
    material.map = textura;
    material.transparent = true;
    material.depthWrite = false;
    material.opacity = 0;
    material.needsUpdate = true;

    desenharComposicao(primeira);

    primeira.close();

    plano.object3D.scale.set(0.94, 0.94, 1);
  }

  // =====================================
  // SUAVIZAÇÃO
  // =====================================

  function suavizar(valor) {
    const t = Math.max(0, Math.min(1, valor));
    return t * t * (3 - 2 * t);
  }

  // =====================================
  // TRANSIÇÃO
  // =====================================

  function atualizarTransicao(decorrido) {
    let opacidade = 1;
    let escala = 1;

    if (decorrido < ENTRADA) {
      const t = suavizar(decorrido / ENTRADA);
      opacidade = t;
      escala = 0.94 + 0.06 * t;
    } else if (decorrido > DURACAO - SAIDA) {
      const restante = DURACAO - decorrido;
      const t = suavizar(restante / SAIDA);
      opacidade = t;
      escala = 0.98 + 0.02 * t;
    }

    material.opacity = opacidade;
    plano.object3D.scale.set(escala, escala, 1);
  }

  // =====================================
  // MÚSICA
  // =====================================

  function pararMusica() {
    audio.pause();

    try {
      audio.currentTime = 0;
    } catch (erro) {
      console.warn(erro);
    }
  }

  async function tocarMusica() {
    try {
      audio.currentTime = 0;
      await audio.play();
      botaoSom.hidden = true;
    } catch (erro) {
      botaoSom.hidden = false;
      console.warn("O navegador bloqueou o áudio.", erro);
    }
  }

  function autorizarSom() {
    const tentativa = audio.play();

    if (tentativa && typeof tentativa.then === "function") {
      tentativa.then(() => {
        audio.pause();
        audio.currentTime = 0;
      }).catch(() => {
        botaoSom.hidden = false;
      });
    }
  }

  // =====================================
  // CANCELAR
  // =====================================

  function cancelar() {
    clearTimeout(timerIntro);
    clearTimeout(timerFinal);
    clearTimeout(timerPerda);

    timerIntro = null;
    timerFinal = null;
    timerPerda = null;

    if (pedidoFrame !== null) {
      cancelAnimationFrame(pedidoFrame);
      pedidoFrame = null;
    }

    sessao++;

    emAnimacao = false;
    emFinalMusical = false;
    executado = false;

    ultimoFrame = -1;
    aDesenhar = false;

    contagem.hidden = true;

    if (plano) {
      plano.setAttribute("visible", false);
      plano.object3D.scale.set(0.94, 0.94, 1);
    }

    if (material) {
      material.opacity = 0;
    }

    pararMusica();

    if (pronto) {
      mensagem.textContent = "Aponta a câmara para a estrela ✦";
    }
  }

  // =====================================
  // DESENHAR FRAME
  // =====================================

  async function desenhar(i, id) {
    aDesenhar = true;

    let imagem = null;

    try {
      imagem = await createImageBitmap(imagens[i]);

      if (id !== sessao || !emAnimacao) {
        return;
      }

      desenharComposicao(imagem);
    } catch (erro) {
      console.error("Erro no fotograma " + i, erro);
    } finally {
      if (imagem) {
        imagem.close();
      }

      aDesenhar = false;
    }
  }

  // =====================================
  // LOOP
  // =====================================

  function atualizar(id) {
    if (!emAnimacao || id !== sessao) {
      return;
    }

    const decorrido = performance.now() - inicioAnimacao;

    if (decorrido >= DURACAO) {
      terminarAnimacao();
      return;
    }

    atualizarTransicao(decorrido);

    const indice = Math.min(
      imagens.length - 1,
      Math.floor(decorrido / TEMPO_FRAME)
    );

    if (!aDesenhar && indice !== ultimoFrame) {
      ultimoFrame = indice;
      desenhar(indice, id);
    }

    pedidoFrame = requestAnimationFrame(() => atualizar(id));
  }

  // =====================================
  // COMEÇAR ANIMAÇÃO
  // =====================================

  function comecarAnimacao() {
    timerIntro = null;

    if (!reconhecido || !pronto) {
      cancelar();
      return;
    }

    contagem.hidden = true;

    emAnimacao = true;
    inicioAnimacao = performance.now();
    ultimoFrame = -1;

    material.opacity = 0;
    plano.object3D.scale.set(0.94, 0.94, 1);
    plano.setAttribute("visible", true);

    mensagem.textContent = "Descobre as minhas ilustrações! ✦";

    atualizar(++sessao);
  }

  // =====================================
  // TERMINAR
  // =====================================

  function terminarAnimacao() {
    emAnimacao = false;
    emFinalMusical = true;

    sessao++;

    if (pedidoFrame !== null) {
      cancelAnimationFrame(pedidoFrame);
      pedidoFrame = null;
    }

    material.opacity = 0;
    plano.setAttribute("visible", false);

    mensagem.textContent = "Animação concluída! ✦";

    const decorrido = performance.now() - inicioCiclo;

    const restante = Math.max(
      0,
      INTRO + DURACAO + FINAL - decorrido
    );

    timerFinal = setTimeout(finalizar, restante);
  }

  function finalizar() {
    clearTimeout(timerFinal);
    timerFinal = null;

    pararMusica();

    emFinalMusical = false;
    mensagem.textContent = "Experiência concluída! ✦";

    if (!reconhecido) {
      executado = false;
    }
  }

  // =====================================
  // PREPARAR INÍCIO
  // =====================================

  function prepararInicio() {
    if (!pronto || !reconhecido || executado) {
      return;
    }

    executado = true;
    inicioCiclo = performance.now();

    tocarMusica();

    mensagem.textContent = "Estrela reconhecida! A começar...";
    contagem.hidden = false;

    function contar() {
      if (!reconhecido || !executado) {
        return;
      }

      const restante = INTRO - (performance.now() - inicioCiclo);

      if (restante <= 0) {
        comecarAnimacao();
        return;
      }

      contagem.textContent = String(Math.ceil(restante / 1000));
      timerIntro = setTimeout(contar, 80);
    }

    contar();
  }

  // =====================================
  // INICIAR EXPERIÊNCIA
  // =====================================

  async function iniciar() {
    $("botao-iniciar").disabled = true;

    mostrar(ecraCarregamento);
    progresso(0, "A preparar o reconhecimento...");

    autorizarSom();

    try {
      await carregarBibliotecas();
      await carregarImagens();

      progresso(88, "A preparar a composição AR...");

      ecraScanner.classList.add("preparar");

      criarCena();
      await prepararTextura();

      progresso(94, "A iniciar a câmara...");

      const sistema = cena.systems["mindar-image-system"];

      if (!sistema) {
        throw new Error("O sistema MindAR não foi iniciado.");
      }

      await sistema.start();

      pronto = true;

      progresso(100, "Tudo pronto!");
      mostrar(ecraScanner);

      mensagem.textContent = "Aponta a câmara para a estrela ✦";

      if (reconhecido) {
        prepararInicio();
      }

    } catch (erro) {
      mostrarErro(
        "Não foi possível carregar a experiência de realidade aumentada. Verifica a ligação à Internet e as permissões da câmara.",
        erro
      );
    }
  }

  // =====================================
  // BOTÕES
  // =====================================

  $("botao-iniciar").addEventListener("click", iniciar);

  $("botao-tentar").addEventListener("click", () => {
    window.location.reload();
  });

  botaoSom.addEventListener("click", async () => {
    try {
      if (executado) {
        const segundos = Math.min(
          (performance.now() - inicioCiclo) / 1000,
          (INTRO + DURACAO + FINAL) / 1000
        );

        audio.currentTime = segundos;
      } else {
        audio.currentTime = 0;
      }

      await audio.play();

      if (!executado) {
        audio.pause();
        audio.currentTime = 0;
      }

      botaoSom.hidden = true;
    } catch (erro) {
      console.warn("Não foi possível ativar o som:", erro);
    }
  });
});