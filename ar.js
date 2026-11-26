
document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  // ======================================
  // CONFIGURAÇÕES
  // ======================================

  const PASTA = "animacao-portfolio/imagens animadas/";
  const PREFIXO = "animaçao_";
  const ALVO = "./target/target.mind";

  const INTRO_MS = 3000;
  const ANIMACAO_MS = 10000;
  const FINAL_MS = 3000;

  const TOTAL_MS =
    INTRO_MS + ANIMACAO_MS + FINAL_MS;

  const LIMITE_PESQUISA = 300;

  // ======================================
  // ELEMENTOS HTML
  // ======================================

  const $ = id => document.getElementById(id);

  const ecraInicio = $("ecra-inicio");
  const ecraCarga = $("ecra-carregamento");
  const ecraErro = $("ecra-erro");
  const ecraScanner = $("ecra-scanner");

  const mensagem = $("mensagem");
  const botaoSom = $("ativar-som");
  const musica = $("musica-ar");
  const contador = $("contagem");

  const ecras = [
    ecraInicio,
    ecraCarga,
    ecraErro,
    ecraScanner
  ];

  // ======================================
  // ESTADO DA EXPERIÊNCIA
  // ======================================

  let carregamentoAtivo = false;
  let preparado = false;

  let fotogramas = [];

  let cena;
  let target;
  let plano;
  let textura;
  let canvas;
  let contexto;

  let reconhecido = false;
  let emReproducao = false;
  let jaReproduziu = false;
  let finalMusical = false;

  let temporizadorInicio = null;
  let temporizadorFim = null;
  let pedidoAnimacao = null;

  let sessao = 0;
  let inicioAnimacao = 0;
  let inicioMusica = 0;
  let ultimoFrame = -1;
  let aDesenhar = false;

  // ======================================
  // ECRÃS
  // ======================================

  function mostrarEcra(ecra) {

    ecras.forEach(item => {
      item.classList.toggle(
        "ativo",
        item === ecra
      );
    });

  }

  function atualizarProgresso(numero, texto) {

    const valor = Math.max(
      0,
      Math.min(100, Math.round(numero))
    );

    $("percentagem").textContent = valor + "%";

    $("anel-progresso").style.setProperty(
      "--progresso",
      valor
    );

    $("barra-preenchimento").style.width =
      valor + "%";

    $("barra-acessivel").setAttribute(
      "aria-valuenow",
      String(valor)
    );

    $("detalhe-progresso").textContent = texto;

  }

  function apresentarErro(descricao, tecnico) {

    console.error(
      "Erro na experiência AR:",
      tecnico || descricao
    );

    $("detalhe-erro").textContent = descricao;

    pararMusica();

    mostrarEcra(ecraErro);

    carregamentoAtivo = false;

  }

  // ======================================
  // CARREGAMENTO DAS BIBLIOTECAS
  // ======================================

  function adicionarScript(url) {

    return new Promise((resolve, reject) => {

      const script = document.createElement("script");

      script.src = url;

      script.onload = resolve;

      script.onerror = () => reject(
        new Error(
          "Não foi possível carregar: " + url
        )
      );

      document.head.appendChild(script);

    });

  }

  async function carregarBibliotecas() {

    atualizarProgresso(
      5,
      "A preparar o reconhecimento da estrela..."
    );

    if (!window.AFRAME) {

      await adicionarScript(
        "https://aframe.io/releases/1.5.0/aframe.min.js"
      );

    }

    atualizarProgresso(
      10,
      "A iniciar a realidade aumentada..."
    );

    if (!AFRAME.components["mindar-image"]) {

      await adicionarScript(
        "https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js"
      );

    }

    if (!AFRAME.components["mindar-image"]) {

      throw new Error(
        "A biblioteca MindAR não ficou disponível."
      );

    }

  }

  // ======================================
  // DETETAR QUANTOS PNG EXISTEM
  // ======================================

  async function contarFotogramas() {

    async function existe(indice) {

      const numero = String(indice).padStart(5, "0");

      const caminho =
        PASTA + PREFIXO + numero + ".png";

      let resposta = await fetch(caminho, {
        method: "HEAD",
        cache: "no-store"
      });

      if (resposta.status === 405) {

        resposta = await fetch(caminho, {
          cache: "no-store"
        });

      }

      if (resposta.status === 404) {
        return false;
      }

      if (!resposta.ok) {

        throw new Error(
          "Erro HTTP " +
          resposta.status +
          ": " +
          caminho
        );

      }

      return true;

    }

    if (!(await existe(0))) {

      throw new Error(
        "Não foi encontrado o primeiro PNG."
      );

    }

    let inferior = 0;
    let superior = 1;

    while (
      superior < LIMITE_PESQUISA &&
      await existe(superior)
    ) {

      inferior = superior;
      superior *= 2;

    }

    superior = Math.min(
      superior,
      LIMITE_PESQUISA
    );

    while (superior - inferior > 1) {

      const meio = Math.floor(
        (inferior + superior) / 2
      );

      if (await existe(meio)) {
        inferior = meio;
      } else {
        superior = meio;
      }

    }

    if (
      superior === LIMITE_PESQUISA &&
      await existe(LIMITE_PESQUISA - 1)
    ) {

      throw new Error(
        "Foi atingido o limite de pesquisa."
      );

    }

    return superior;

  }

  // ======================================
  // CARREGAR IMAGENS
  // ======================================

  async function carregarImagens() {

    atualizarProgresso(
      14,
      "A procurar os fotogramas..."
    );

    const quantidade = await contarFotogramas();

    fotogramas = new Array(quantidade);

    let completos = 0;
    let proximo = 0;

    async function trabalhador() {

      while (proximo < quantidade) {

        const indice = proximo++;

        const numero = String(indice).padStart(
          5,
          "0"
        );

        const caminho =
          PASTA + PREFIXO + numero + ".png";

        const resposta = await fetch(caminho, {
          cache: "no-store"
        });

        if (!resposta.ok) {

          throw new Error(
            "Não foi possível carregar: " +
            caminho
          );

        }

        fotogramas[indice] =
          await resposta.blob();

        completos++;

        atualizarProgresso(
          14 + (completos / quantidade) * 71,
          "A preparar as ilustrações... " +
          completos +
          " de " +
          quantidade
        );

      }

    }

    const trabalhadores = Array.from(
      {
        length: Math.min(6, quantidade)
      },
      () => trabalhador()
    );

    await Promise.all(trabalhadores);

    console.log(
      quantidade + " fotogramas carregados."
    );

  }

  // ======================================
  // CRIAR CENA AR
  // ======================================

  function criarCena() {

    const contentor = $("cena-container");

    contentor.innerHTML = `
      <a-scene
        embedded
        mindar-image="
          imageTargetSrc: ${ALVO};
          autoStart: true;
          uiScanning: no;
          uiLoading: no;
          uiError: no"
        color-space="sRGB"
        renderer="
          colorManagement: true;
          physicallyCorrectLights: true"
        vr-mode-ui="enabled: false"
        device-orientation-permission-ui="enabled: false">

        <a-camera
          position="0 0 0"
          look-controls="enabled: false">
        </a-camera>

        <a-entity
          id="target-portfolio"
          mindar-image-target="targetIndex: 0">

          <a-plane
            id="animacao"
            position="0 0 0.05"
            width="1.8"
            height="1"
            material="
              shader: flat;
              transparent: true;
              depthWrite: false"
            visible="false">
          </a-plane>

        </a-entity>

      </a-scene>
    `;

    cena = contentor.querySelector("a-scene");

    target = contentor.querySelector(
      "#target-portfolio"
    );

    plano = contentor.querySelector(
      "#animacao"
    );

    cena.addEventListener("arError", () => {

      apresentarErro(
        "Não foi possível iniciar a câmara ou carregar " +
        "a imagem de reconhecimento. Verifica as permissões " +
        "da câmara e tenta novamente."
      );

    });

    // ESTRELA RECONHECIDA

    target.addEventListener("targetFound", () => {

      reconhecido = true;

      if (
        preparado &&
        !jaReproduziu &&
        !finalMusical
      ) {
        prepararInicio();
      }

    });

    // ESTRELA DEIXOU DE SER RECONHECIDA

    target.addEventListener("targetLost", () => {

      reconhecido = false;

      // DEIXAR A MÚSICA TERMINAR
      // SE A ANIMAÇÃO JÁ ACABOU

      if (!finalMusical) {
        cancelar();
      }

    });

  }

  // ======================================
  // AGUARDAR CENA E PLANO 3D
  // ======================================

  function esperarCena() {

    return new Promise(resolve => {

      if (cena.hasLoaded) {
        resolve();
        return;
      }

      cena.addEventListener(
        "loaded",
        resolve,
        { once: true }
      );

    });

  }

  function esperarMalha() {

    return new Promise((resolve, reject) => {

      const inicio = performance.now();

      function verificar() {

        const malha = plano.getObject3D("mesh");

        if (malha) {
          resolve(malha);
          return;
        }

        if (performance.now() - inicio > 15000) {

          reject(
            new Error(
              "O plano 3D não ficou disponível."
            )
          );

          return;

        }

        requestAnimationFrame(verificar);

      }

      verificar();

    });

  }

  // ======================================
  // PREPARAR TEXTURA
  // ======================================

  async function prepararTextura() {

    await esperarCena();

    const malha = await esperarMalha();

    const imagem = await createImageBitmap(
      fotogramas[0]
    );

    const proporcao =
      imagem.height / imagem.width;

    canvas = document.createElement("canvas");

    canvas.width = Math.min(
      imagem.width,
      1024
    );

    canvas.height = Math.max(
      1,
      Math.round(canvas.width * proporcao)
    );

    contexto = canvas.getContext("2d", {
      alpha: true
    });

    imagem.close();

    plano.setAttribute("width", 1.8);

    plano.setAttribute(
      "height",
      1.8 * proporcao
    );

    textura = new AFRAME.THREE.CanvasTexture(
      canvas
    );

    if (AFRAME.THREE.SRGBColorSpace) {

      textura.colorSpace =
        AFRAME.THREE.SRGBColorSpace;

    }

    malha.material.map = textura;
    malha.material.transparent = true;
    malha.material.depthWrite = false;
    malha.material.needsUpdate = true;

    preparado = true;

  }

  // ======================================
  // ÁUDIO HTML5
  // ======================================

  function pararMusica() {

    musica.pause();

    try {
      musica.currentTime = 0;
    } catch (erro) {
      console.warn(erro);
    }

  }

  async function autorizarSomNoClique() {

    // O CLIQUE INICIAL PODE DESBLOQUEAR
    // O ÁUDIO EM ALGUNS NAVEGADORES

    try {

      await musica.play();

      musica.pause();
      musica.currentTime = 0;

      botaoSom.hidden = true;

    } catch (erro) {

      botaoSom.hidden = false;

    }

  }

  async function tocarMusica() {

    try {

      musica.currentTime = 0;

      await musica.play();

      botaoSom.hidden = true;

    } catch (erro) {

      botaoSom.hidden = false;

      console.warn(
        "O navegador bloqueou a reprodução automática.",
        erro
      );

    }

  }

  // ======================================
  // INICIAR CARREGAMENTO
  // ======================================

  async function iniciar() {

    if (carregamentoAtivo) {
      return;
    }

    carregamentoAtivo = true;
    preparado = false;
    reconhecido = false;

    jaReproduziu = false;
    finalMusical = false;

    mostrarEcra(ecraCarga);

    atualizarProgresso(
      0,
      "A preparar a experiência AR..."
    );

    try {

      // TENTAR AUTORIZAR SOM COM O CLIQUE

      const promessaSom =
        autorizarSomNoClique();

      await carregarBibliotecas();

      await carregarImagens();

      atualizarProgresso(
        89,
        "A preparar a câmara..."
      );

      criarCena();

      mostrarEcra(ecraScanner);

      await prepararTextura();

      await promessaSom;

      atualizarProgresso(
        100,
        "Tudo pronto!"
      );

      mensagem.textContent =
        "Aponta a câmara para a estrela ✦";

      carregamentoAtivo = false;

      if (reconhecido) {
        prepararInicio();
      }

    } catch (erro) {

      apresentarErro(
        "Não foi possível carregar a experiência. " +
        "Verifica a ligação à Internet, os PNG " +
        "e as permissões da câmara.",
        erro
      );

    }

  }

  // ======================================
  // DESENHAR FOTOGRAMAS
  // ======================================

  async function desenhar(indice, id) {

    aDesenhar = true;

    let imagem = null;

    try {

      imagem = await createImageBitmap(
        fotogramas[indice]
      );

      if (
        id !== sessao ||
        !emReproducao
      ) {
        return;
      }

      contexto.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      );

      contexto.drawImage(
        imagem,
        0,
        0,
        canvas.width,
        canvas.height
      );

      textura.needsUpdate = true;

    } catch (erro) {

      console.warn(
        "Erro ao desenhar fotograma:",
        erro
      );

    } finally {

      if (imagem) {
        imagem.close();
      }

      aDesenhar = false;

    }

  }

  // ======================================
  // ATUALIZAR ANIMAÇÃO
  // ======================================

  function atualizarAnimacao(id) {

    if (
      !emReproducao ||
      id !== sessao
    ) {
      return;
    }

    const decorrido =
      performance.now() - inicioAnimacao;

    if (decorrido >= ANIMACAO_MS) {

      terminarAnimacao();
      return;

    }

    const indice = Math.min(
      fotogramas.length - 1,

      Math.floor(
        (decorrido / ANIMACAO_MS) *
        fotogramas.length
      )
    );

    if (
      indice !== ultimoFrame &&
      !aDesenhar
    ) {

      ultimoFrame = indice;

      desenhar(indice, id);

    }

    pedidoAnimacao = requestAnimationFrame(
      () => atualizarAnimacao(id)
    );

  }

  // ======================================
  // INÍCIO DA ANIMAÇÃO
  // AOS 3 SEGUNDOS DA MÚSICA
  // ======================================

  function comecarAnimacao() {

    if (
      !reconhecido ||
      !preparado ||
      !textura ||
      emReproducao
    ) {
      return;
    }

    emReproducao = true;

    contador.hidden = true;

    const id = ++sessao;

    ultimoFrame = -1;

    inicioAnimacao = performance.now();

    plano.setAttribute(
      "visible",
      true
    );

    mensagem.textContent =
      "Descobre as minhas ilustrações! ✦";

    atualizarAnimacao(id);

  }

  // ======================================
  // RECONHECIMENTO DA ESTRELA
  // COMEÇA A MÚSICA
  // E A CONTAGEM DE 3 SEGUNDOS
  // ======================================

  function prepararInicio() {

    if (
      !reconhecido ||
      !preparado ||
      jaReproduziu ||
      temporizadorInicio !== null
    ) {
      return;
    }

    jaReproduziu = true;

    inicioMusica = performance.now();

    // MÚSICA COMEÇA AGORA

    tocarMusica();

    // CONTAGEM COMEÇA AGORA

    contador.hidden = false;

    mensagem.textContent =
      "Estrela reconhecida! A começar...";

    function atualizarContagem() {

      if (!reconhecido) {
        return;
      }

      const passado =
        performance.now() - inicioMusica;

      if (passado >= INTRO_MS) {

        temporizadorInicio = null;

        comecarAnimacao();

        return;

      }

      contador.textContent = String(
        Math.ceil(
          (INTRO_MS - passado) / 1000
        )
      );

      temporizadorInicio = setTimeout(
        atualizarContagem,
        80
      );

    }

    atualizarContagem();

  }

  // ======================================
  // FINAL DOS 10 SEGUNDOS DE ANIMAÇÃO
  // A MÚSICA CONTINUA
  // ======================================

  function terminarAnimacao() {

    emReproducao = false;
    finalMusical = true;

    sessao++;

    if (pedidoAnimacao !== null) {

      cancelAnimationFrame(
        pedidoAnimacao
      );

      pedidoAnimacao = null;

    }

    plano.setAttribute(
      "visible",
      false
    );

    mensagem.textContent =
      "Experiência concluída! ✦";

    // A MÚSICA CONTINUA MAIS 3 SEGUNDOS

    const tempoDecorrido =
      performance.now() - inicioMusica;

    const tempoRestante = Math.max(
      0,
      TOTAL_MS - tempoDecorrido
    );

    temporizadorFim = setTimeout(() => {

      finalizarTudo();

    }, tempoRestante);

  }

  // ======================================
  // FINAL DOS 16 SEGUNDOS DE MÚSICA
  // ======================================

  function finalizarTudo() {

    clearTimeout(temporizadorFim);
    temporizadorFim = null;

    pararMusica();

    finalMusical = false;

    mensagem.textContent =
      "Experiência concluída! ✦";

    // PERMITE RECOMEÇAR QUANDO
    // O UTILIZADOR VOLTAR A APONTAR
    // PARA A ESTRELA

    if (!reconhecido) {
      jaReproduziu = false;
    }

  }

  // ======================================
  // CANCELAR SE A ESTRELA DESAPARECER
  // ANTES DO FINAL DA ANIMAÇÃO
  // ======================================

  function cancelar() {

    if (temporizadorInicio !== null) {

      clearTimeout(temporizadorInicio);

      temporizadorInicio = null;

    }

    if (temporizadorFim !== null) {

      clearTimeout(temporizadorFim);

      temporizadorFim = null;

    }

    contador.hidden = true;

    sessao++;

    emReproducao = false;
    jaReproduziu = false;
    finalMusical = false;

    if (pedidoAnimacao !== null) {

      cancelAnimationFrame(
        pedidoAnimacao
      );

      pedidoAnimacao = null;

    }

    ultimoFrame = -1;

    if (plano) {

      plano.setAttribute(
        "visible",
        false
      );

    }

    pararMusica();

    if (preparado) {

      mensagem.textContent =
        "Aponta a câmara para a estrela ✦";

    }

  }

  // ======================================
  // BOTÕES
  // ======================================

  $("iniciar").addEventListener(
    "click",
    iniciar
  );

  $("tentar-novamente").addEventListener(
    "click",
    () => location.reload()
  );

  botaoSom.addEventListener(
    "click",
    async () => {

      try {

        // SE A EXPERIÊNCIA ESTIVER A DECORRER,
        // RETOMAR O SOM NA POSIÇÃO CERTA

        if (
          emReproducao ||
          finalMusical ||
          temporizadorInicio !== null
        ) {

          const segundos = Math.min(
            (performance.now() - inicioMusica) / 1000,
            TOTAL_MS / 1000
          );

          musica.currentTime = segundos;

          await musica.play();

        } else {

          // AUTORIZAR SOM ANTES DO SCAN

          await musica.play();

          musica.pause();

          musica.currentTime = 0;

        }

        botaoSom.hidden = true;

      } catch (erro) {

        console.warn(
          "Não foi possível ativar o som:",
          erro
        );

        botaoSom.hidden = false;

      }

    }
  );

});
