
document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  // CONFIGURAÇÕES

  const $ = id => document.getElementById(id);

  const ecras = [
    "inicio",
    "carregamento",
    "erro",
    "scanner"
  ];

  const cena = document.querySelector("a-scene");
  const alvo = $("alvo");
  const plano = $("animacao");
  const audio = $("audio-ar");
  const botaoSom = $("som");

  const PREFIXO =
    "./animacao-portfolio/imagens animadas/animaçao_";

  const INTRO = 3000;
  const DURACAO = 10000;
  const FINAL = 3000;

  const LIMITE = 180;

  // VARIÁVEIS

  let imagens = [];
  let textura;
  let canvas;
  let ctx;

  let pronto = false;
  let encontrado = false;
  let emAnimacao = false;

  let jaTocou = false;
  let finalMusical = false;

  let inicioCiclo = 0;
  let inicioAnimacao = 0;
  let ultimoFrame = -1;

  let sessao = 0;
  let desenhando = false;
  let animFrame = null;

  let timerIntro = null;
  let timerFim = null;
  let timerCiclo = null;

  // TROCAR ECRÃS

  function ecra(id) {

    ecras.forEach(e => {

      $(e).classList.toggle(
        "visivel",
        e === id
      );

    });

  }

  // PROGRESSO REAL

  function progresso(percentagem, texto) {

    const n = Math.min(
      100,
      Math.max(0, Math.round(percentagem))
    );

    $("percentagem").textContent = n + "%";

    $("circulo").style.setProperty(
      "--percentagem",
      n
    );

    $("barra-valor").style.width = n + "%";

    $("barra").setAttribute(
      "aria-valuenow",
      String(n)
    );

    $("detalhe-carga").textContent = texto;

  }

  // ECRÃ DE ERRO

  function erro(texto, detalhe) {

    console.error(
      "Erro AR:",
      detalhe || texto
    );

    cancelar();

    $("erro-texto").textContent = texto;

    ecra("erro");

  }

  // CAMINHO DE CADA PNG

  function caminho(i) {

    return PREFIXO +
      String(i).padStart(5, "0") +
      ".png";

  }

  // VERIFICAR EXISTÊNCIA DO PNG

  async function existe(i) {

    const resposta = await fetch(
      caminho(i),
      {
        method: "HEAD",
        cache: "no-store"
      }
    );

    if (resposta.status === 404) {
      return false;
    }

    if (!resposta.ok) {

      throw new Error(
        "HTTP " +
        resposta.status +
        ": " +
        caminho(i)
      );

    }

    return true;

  }

  // CONTAR IMAGENS EXISTENTES

  async function contarImagens() {

    if (!(await existe(0))) {

      throw new Error(
        "Não encontrei " + caminho(0)
      );

    }

    let esquerda = 0;
    let direita = 1;

    while (
      direita < LIMITE &&
      await existe(direita)
    ) {

      esquerda = direita;
      direita *= 2;

    }

    direita = Math.min(direita, LIMITE);

    if (
      direita === LIMITE &&
      await existe(LIMITE - 1)
    ) {

      throw new Error(
        "Mais de " +
        LIMITE +
        " imagens; aumenta LIMITE."
      );

    }

    while (direita - esquerda > 1) {

      const meio = Math.floor(
        (esquerda + direita) / 2
      );

      if (await existe(meio)) {
        esquerda = meio;
      } else {
        direita = meio;
      }

    }

    return direita;

  }

  // CARREGAR IMAGENS

  async function carregarImagens() {

    progresso(
      8,
      "A procurar as imagens da animação..."
    );

    const total = await contarImagens();

    imagens = new Array(total);

    let seguinte = 0;
    let carregadas = 0;

    async function trabalhador() {

      while (seguinte < total) {

        const i = seguinte++;

        const resposta = await fetch(
          caminho(i),
          {
            cache: "no-store"
          }
        );

        if (!resposta.ok) {

          throw new Error(
            "Não foi possível carregar " +
            caminho(i)
          );

        }

        imagens[i] = await resposta.blob();

        carregadas++;

        progresso(
          10 + carregadas / total * 75,
          "A carregar ilustrações: " +
          carregadas +
          " de " +
          total
        );

      }

    }

    await Promise.all(
      Array.from(
        {
          length: Math.min(6, total)
        },
        () => trabalhador()
      )
    );

    console.log(
      "Fotogramas encontrados:",
      total
    );

  }

  // AGUARDAR PELA CENA

  function quandoCenaCarregada() {

    return new Promise(resolve => {

      if (cena.hasLoaded) {
        resolve();
      } else {

        cena.addEventListener(
          "loaded",
          resolve,
          { once: true }
        );

      }

    });

  }

  // PREPARAR TEXTURA

  async function prepararTextura() {

    await quandoCenaCarregada();

    const mesh = plano.getObject3D("mesh");

    if (!mesh) {

      throw new Error(
        "O plano AR não foi criado."
      );

    }

    const imagem = await createImageBitmap(
      imagens[0]
    );

    const proporcao =
      imagem.height / imagem.width;

    canvas = document.createElement("canvas");

    canvas.width = Math.min(
      imagem.width,
      1024
    );

    canvas.height = Math.round(
      canvas.width * proporcao
    );

    ctx = canvas.getContext(
      "2d",
      { alpha: true }
    );

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

    mesh.material.map = textura;
    mesh.material.transparent = true;
    mesh.material.depthWrite = false;
    mesh.material.needsUpdate = true;

  }

  // PARAR MÚSICA

  function pararAudio() {

    audio.pause();

    try {
      audio.currentTime = 0;
    } catch (e) {
      console.warn(e);
    }

  }

  // AUTORIZAR MÚSICA NO CLIQUE INICIAL

  function autorizarAudio() {

    const tentativa = audio.play();

    if (
      tentativa &&
      typeof tentativa.then === "function"
    ) {

      tentativa
        .then(() => {

          audio.pause();
          audio.currentTime = 0;

        })
        .catch(() => {

          botaoSom.hidden = false;

        });

    }

  }

  // REPRODUZIR MÚSICA

  async function tocarAudio() {

    try {

      audio.currentTime = 0;

      await audio.play();

      botaoSom.hidden = true;

    } catch (e) {

      console.warn(
        "Áudio bloqueado pelo navegador:",
        e
      );

      botaoSom.hidden = false;

    }

  }

  // CANCELAR EXPERIÊNCIA

  function cancelar() {

    clearTimeout(timerIntro);
    clearTimeout(timerFim);
    clearTimeout(timerCiclo);

    timerIntro = null;
    timerFim = null;
    timerCiclo = null;

    if (animFrame !== null) {
      cancelAnimationFrame(animFrame);
    }

    animFrame = null;

    sessao++;

    emAnimacao = false;
    finalMusical = false;
    jaTocou = false;

    ultimoFrame = -1;

    $("contagem").hidden = true;

    plano.setAttribute(
      "visible",
      false
    );

    pararAudio();

    if (pronto) {

      $("mensagem").textContent =
        "Aponta a câmara para a estrela ✦";

    }

  }

  // DESENHAR FOTOGRAMA

  async function desenhar(i, id) {

    desenhando = true;

    let imagem;

    try {

      imagem = await createImageBitmap(
        imagens[i]
      );

      if (
        id !== sessao ||
        !emAnimacao
      ) {
        return;
      }

      ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      );

      ctx.drawImage(
        imagem,
        0,
        0,
        canvas.width,
        canvas.height
      );

      textura.needsUpdate = true;

    } catch (e) {

      console.error(
        "Fotograma " + i,
        e
      );

    } finally {

      if (imagem) {
        imagem.close();
      }

      desenhando = false;

    }

  }

  // ATUALIZAR ANIMAÇÃO

  function atualizar(id) {

    if (
      id !== sessao ||
      !emAnimacao
    ) {
      return;
    }

    const decorrido =
      performance.now() - inicioAnimacao;

    if (decorrido >= DURACAO) {

      acabarAnimacao();
      return;

    }

    const i = Math.min(
      imagens.length - 1,
      Math.floor(
        decorrido /
        DURACAO *
        imagens.length
      )
    );

    if (
      !desenhando &&
      i !== ultimoFrame
    ) {

      ultimoFrame = i;

      desenhar(i, id);

    }

    animFrame = requestAnimationFrame(
      () => atualizar(id)
    );

  }

  // COMEÇAR ANIMAÇÃO

  function comecarAnimacao() {

    timerIntro = null;

    if (
      !encontrado ||
      !pronto
    ) {

      cancelar();
      return;

    }

    $("contagem").hidden = true;

    plano.setAttribute(
      "visible",
      true
    );

    emAnimacao = true;

    inicioAnimacao = performance.now();

    ultimoFrame = -1;

    $("mensagem").textContent =
      "Descobre as minhas ilustrações! ✦";

    atualizar(++sessao);

  }

  // TERMINAR ANIMAÇÃO
  // MÚSICA CONTINUA MAIS 3 SEGUNDOS

  function acabarAnimacao() {

    emAnimacao = false;
    finalMusical = true;

    sessao++;

    if (animFrame !== null) {
      cancelAnimationFrame(animFrame);
    }

    animFrame = null;

    plano.setAttribute(
      "visible",
      false
    );

    $("mensagem").textContent =
      "Animação concluída ✦ A música continua...";

    timerFim = setTimeout(
      finalizar,
      FINAL
    );

  }

  // TERMINAR EXPERIÊNCIA

  function finalizar() {

    clearTimeout(timerFim);
    clearTimeout(timerCiclo);

    timerFim = null;
    timerCiclo = null;

    pararAudio();

    finalMusical = false;

    $("mensagem").textContent =
      "Experiência concluída! ✦";

    if (!encontrado) {
      jaTocou = false;
    }

  }

  // RECONHECIMENTO DA ESTRELA
  // MÚSICA COMEÇA 3 SEGUNDOS ANTES

  function prepararInicio() {

    if (
      !pronto ||
      !encontrado ||
      jaTocou
    ) {
      return;
    }

    jaTocou = true;

    inicioCiclo = performance.now();

    tocarAudio();

    $("mensagem").textContent =
      "Estrela reconhecida! A começar...";

    $("contagem").hidden = false;

    function contar() {

      if (
        !encontrado ||
        !jaTocou
      ) {
        return;
      }

      const restante =
        INTRO -
        (performance.now() - inicioCiclo);

      if (restante <= 0) {

        comecarAnimacao();
        return;

      }

      $("contagem").textContent =
        String(
          Math.ceil(restante / 1000)
        );

      timerIntro = setTimeout(
        contar,
        90
      );

    }

    contar();

    // LIMITE TOTAL DE 16 SEGUNDOS

    timerCiclo = setTimeout(() => {

      if (jaTocou) {
        finalizar();
      }

    }, INTRO + DURACAO + FINAL + 200);

  }

  // EVENTOS DO MINDAR

  alvo.addEventListener(
    "targetFound",
    () => {

      encontrado = true;

      prepararInicio();

    }
  );

  alvo.addEventListener(
    "targetLost",
    () => {

      encontrado = false;

      if (!finalMusical) {
        cancelar();
      }

    }
  );

  // ERRO NA CÂMARA

  cena.addEventListener(
    "arError",
    () => {

      erro(
        "Não foi possível abrir a câmara ou carregar " +
        "o marcador AR. Verifica as permissões e tenta novamente."
      );

    }
  );

  // INICIAR EXPERIÊNCIA

  async function iniciar() {

    $("iniciar").disabled = true;

    ecra("carregamento");

    progresso(
      0,
      "A preparar a experiência..."
    );

    autorizarAudio();

    try {

      if (
        !window.AFRAME ||
        !AFRAME.components["mindar-image"]
      ) {

        throw new Error(
          "As bibliotecas A-Frame/MindAR não carregaram."
        );

      }

      await carregarImagens();

      progresso(
        87,
        "A preparar o ecrã AR..."
      );

      await prepararTextura();

      progresso(
        95,
        "A iniciar a câmara..."
      );

      ecra("scanner");

      await cena.systems[
        "mindar-image-system"
      ].start();

      pronto = true;

      progresso(
        100,
        "Pronto!"
      );

      $("mensagem").textContent =
        "Aponta a câmara para a estrela ✦";

      if (encontrado) {
        prepararInicio();
      }

    } catch (e) {

      erro(
        "Não foi possível iniciar a experiência. " +
        "Verifica o caminho das imagens, " +
        "a ligação à Internet e as permissões da câmara.",
        e
      );

    }

  }

  // BOTÃO INICIAR

  $("iniciar").addEventListener(
    "click",
    iniciar
  );

  // BOTÃO TENTAR NOVAMENTE

  $("tentar").addEventListener(
    "click",
    () => location.reload()
  );

  // BOTÃO ATIVAR SOM

  botaoSom.addEventListener(
    "click",
    async () => {

      try {

        if (jaTocou) {

          audio.currentTime = Math.min(
            (performance.now() - inicioCiclo) / 1000,
            16
          );

        } else {

          audio.currentTime = 0;

        }

        await audio.play();

        if (!jaTocou) {

          audio.pause();
          audio.currentTime = 0;

        }

        botaoSom.hidden = true;

      } catch (e) {

        console.warn(
          "Não foi possível ativar a música:",
          e
        );

      }

    }
  );

});
