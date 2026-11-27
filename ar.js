
document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  // CONFIGURAÇÃO
  const PASTA =
    "./animacao-portfolio/imagens animadas/";
  const PREFIXO = "animaçao_";
  const TARGET = "./target/target.mind";

  const INTRO = 3000;
  const DURACAO = 10000;
  const FINAL = 3000;
  const LIMITE = 300;

  const $ = id => document.getElementById(id);

  const inicio = $("inicio");
  const carregamento = $("carregamento");
  const erroEcra = $("erro");
  const scanner = $("scanner");

  const audio = $("musica-ar");
  const botaoSom = $("botao-som");
  const mensagem = $("mensagem-scanner");
  const contagem = $("contagem");

  let cena, alvo, plano, textura, canvas, contexto;
  let imagens = [];

  let pronto = false;
  let reconhecido = false;
  let emAnimacao = false;
  let emFinalMusical = false;
  let executado = false;
  let aDesenhar = false;

  let inicioCiclo = 0;
  let inicioAnimacao = 0;
  let ultimoFrame = -1;
  let sessao = 0;

  let timerIntro = null;
  let timerFinal = null;
  let timerLimite = null;
  let pedidoFrame = null;

  // ECRÃS

  function mostrar(ecra) {
    [inicio, carregamento, erroEcra, scanner]
      .forEach(item => {
        item.classList.toggle(
          "ativo",
          item === ecra
        );
      });
  }

  // PROGRESSO

  function progresso(valor, descricao) {
    const n = Math.max(
      0,
      Math.min(100, Math.round(valor))
    );

    $("percentagem").textContent = n + "%";

    $("circulo-progresso").style.setProperty(
      "--valor", n
    );

    $("barra-valor").style.width = n + "%";

    $("barra-progresso").setAttribute(
      "aria-valuenow", String(n)
    );

    $("texto-carregamento").textContent =
      descricao;
  }

  // ECRÃ DE ERRO

  function mostrarErro(texto, detalhe) {
    console.error("Erro na experiência AR:", detalhe);

    cancelar();

    $("texto-erro").textContent = texto;
    mostrar(erroEcra);
  }

  // CARREGAR BIBLIOTECAS

  function carregarScript(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url;

      script.onload = resolve;
      script.onerror = () => reject(
        new Error("Falha ao carregar " + url)
      );

      document.head.appendChild(script);
    });
  }

  async function carregarBibliotecas() {
    progresso(4, "A preparar o reconhecimento...");

    if (!window.AFRAME) {
      await carregarScript(
        "https://aframe.io/releases/1.5.0/aframe.min.js"
      );
    }

    progresso(10, "A iniciar a realidade aumentada...");

    if (!AFRAME.components["mindar-image"]) {
      await carregarScript(
        "https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js"
      );
    }

    if (!AFRAME.components["mindar-image"]) {
      throw new Error("MindAR não ficou disponível.");
    }
  }

  // NOMES DOS PNG

  function caminho(i) {
    return PASTA + PREFIXO +
      String(i).padStart(5, "0") + ".png";
  }

  // VERIFICAR SE EXISTE UM PNG

  async function existe(i) {
    const url = caminho(i);

    let resposta = await fetch(url, {
      method: "HEAD",
      cache: "no-store"
    });

    if (resposta.status === 405) {
      resposta = await fetch(url, {
        cache: "no-store"
      });
    }

    if (resposta.status === 404) {
      return false;
    }

    if (!resposta.ok) {
      throw new Error(
        "Erro HTTP " + resposta.status + ": " + url
      );
    }

    return true;
  }

  // DESCOBRIR QUANTOS FOTOGRAMAS EXISTEM

  async function contarImagens() {
    if (!(await existe(0))) {
      throw new Error(
        "Não encontrei " + caminho(0)
      );
    }

    let inferior = 0;
    let superior = 1;

    while (
      superior < LIMITE &&
      await existe(superior)
    ) {
      inferior = superior;
      superior *= 2;
    }

    superior = Math.min(superior, LIMITE);

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
      superior === LIMITE &&
      await existe(LIMITE - 1)
    ) {
      throw new Error(
        "A sequência excede o limite de imagens."
      );
    }

    return superior;
  }

  // CARREGAR FOTOGRAMAS

  async function carregarImagens() {
    progresso(15, "A procurar as ilustrações...");

    const total = await contarImagens();

    imagens = new Array(total);

    let seguinte = 0;
    let carregadas = 0;

    async function trabalhador() {
      while (seguinte < total) {
        const i = seguinte++;

        const resposta = await fetch(caminho(i), {
          cache: "no-store"
        });

        if (!resposta.ok) {
          throw new Error(
            "Não encontrei " + caminho(i)
          );
        }

        imagens[i] = await resposta.blob();
        carregadas++;

        progresso(
          15 + (carregadas / total) * 70,
          "A carregar ilustrações: " +
          carregadas + " de " + total
        );
      }
    }

    await Promise.all(
      Array.from(
        { length: Math.min(6, total) },
        () => trabalhador()
      )
    );

    console.log("PNG carregados:", total);
  }

  // CRIAR CENA MINDAR

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

    cena = document.querySelector("a-scene");
    alvo = $("alvo-ar");
    plano = $("animacao-ar");

    cena.addEventListener("arError", () => {
      mostrarErro(
        "Não foi possível iniciar a câmara ou " +
        "carregar o marcador AR. Verifica as " +
        "permissões e tenta novamente.",
        new Error("Erro de inicialização MindAR")
      );
    });

    alvo.addEventListener("targetFound", () => {
      reconhecido = true;
      prepararInicio();
    });

    alvo.addEventListener("targetLost", () => {
      reconhecido = false;

      if (!emFinalMusical) {
        cancelar();
      }
    });
  }

  // AGUARDAR CENA

  function esperarCena() {
    return new Promise(resolve => {
      if (cena.hasLoaded) {
        resolve();
      } else {
        cena.addEventListener(
          "loaded", resolve, { once: true }
        );
      }
    });
  }

  // PREPARAR A TEXTURA DA ANIMAÇÃO

  async function prepararTextura() {
    await esperarCena();

    let mesh = plano.getObject3D("mesh");

    if (!mesh) {
      mesh = await new Promise((resolve, reject) => {
        const limite = performance.now() + 10000;

        function verificar() {
          const resultado = plano.getObject3D("mesh");

          if (resultado) {
            resolve(resultado);
          } else if (performance.now() > limite) {
            reject(new Error("Plano 3D indisponível."));
          } else {
            requestAnimationFrame(verificar);
          }
        }

        verificar();
      });
    }

    const primeira = await createImageBitmap(
      imagens[0]
    );

    const proporcao =
      primeira.height / primeira.width;

    canvas = document.createElement("canvas");
    canvas.width = Math.min(primeira.width, 1024);
    canvas.height = Math.max(
      1, Math.round(canvas.width * proporcao)
    );

    contexto = canvas.getContext("2d", {
      alpha: true
    });

    primeira.close();

    plano.setAttribute("width", 1.8);
    plano.setAttribute("height", 1.8 * proporcao);

    textura = new AFRAME.THREE.CanvasTexture(canvas);

    if (AFRAME.THREE.SRGBColorSpace) {
      textura.colorSpace =
        AFRAME.THREE.SRGBColorSpace;
    }

    mesh.material.map = textura;
    mesh.material.transparent = true;
    mesh.material.depthWrite = false;
    mesh.material.needsUpdate = true;
  }

  // MÚSICA

  function pararMusica() {
    audio.pause();

    try {
      audio.currentTime = 0;
    } catch (e) {
      console.warn(e);
    }
  }

  async function tocarMusica() {
    try {
      audio.currentTime = 0;
      await audio.play();
      botaoSom.hidden = true;
    } catch (e) {
      botaoSom.hidden = false;
      console.warn("Som bloqueado:", e);
    }
  }

  function autorizarSom() {
    // Executado no clique inicial do utilizador
    const tentativa = audio.play();

    if (tentativa) {
      tentativa.then(() => {
        audio.pause();
        audio.currentTime = 0;
      }).catch(() => {
        botaoSom.hidden = false;
      });
    }
  }

  // CANCELAR A EXPERIÊNCIA

  function cancelar() {
    clearTimeout(timerIntro);
    clearTimeout(timerFinal);
    clearTimeout(timerLimite);

    timerIntro = null;
    timerFinal = null;
    timerLimite = null;

    if (pedidoFrame !== null) {
      cancelAnimationFrame(pedidoFrame);
      pedidoFrame = null;
    }

    sessao++;
    emAnimacao = false;
    emFinalMusical = false;
    executado = false;

    ultimoFrame = -1;
    contagem.hidden = true;

    if (plano) {
      plano.setAttribute("visible", false);
    }

    pararMusica();

    if (pronto) {
      mensagem.textContent =
        "Aponta a câmara para a estrela ✦";
    }
  }

  // DESENHAR FOTOGRAMA

  async function desenhar(i, id) {
    aDesenhar = true;
    let imagem;

    try {
      imagem = await createImageBitmap(imagens[i]);

      if (!emAnimacao || id !== sessao) {
        return;
      }

      contexto.clearRect(
        0, 0, canvas.width, canvas.height
      );

      contexto.drawImage(
        imagem, 0, 0, canvas.width, canvas.height
      );

      textura.needsUpdate = true;

    } catch (e) {
      console.error("Erro no fotograma:", i, e);
    } finally {
      if (imagem) imagem.close();
      aDesenhar = false;
    }
  }

  // ANIMAÇÃO DURANTE 10 SEGUNDOS

  function atualizar(id) {
    if (!emAnimacao || id !== sessao) return;

    const decorrido =
      performance.now() - inicioAnimacao;

    if (decorrido >= DURACAO) {
      terminarAnimacao();
      return;
    }

    const indice = Math.min(
      imagens.length - 1,
      Math.floor(
        decorrido / DURACAO * imagens.length
      )
    );

    if (!aDesenhar && indice !== ultimoFrame) {
      ultimoFrame = indice;
      desenhar(indice, id);
    }

    pedidoFrame = requestAnimationFrame(
      () => atualizar(id)
    );
  }

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

    plano.setAttribute("visible", true);

    mensagem.textContent =
      "Descobre as minhas ilustrações! ✦";

    atualizar(++sessao);
  }

  // MÚSICA CONTINUA 3 SEGUNDOS NO FINAL

  function terminarAnimacao() {
    emAnimacao = false;
    emFinalMusical = true;
    sessao++;

    if (pedidoFrame !== null) {
      cancelAnimationFrame(pedidoFrame);
      pedidoFrame = null;
    }

    plano.setAttribute("visible", false);

    mensagem.textContent =
      "Animação concluída! ✦";

    const decorrido =
      performance.now() - inicioCiclo;

    timerFinal = setTimeout(
      finalizar,
      Math.max(0, INTRO + DURACAO + FINAL - decorrido)
    );
  }

  function finalizar() {
    clearTimeout(timerFinal);
    clearTimeout(timerLimite);

    timerFinal = null;
    timerLimite = null;

    pararMusica();
    emFinalMusical = false;

    mensagem.textContent =
      "Experiência concluída! ✦";

    if (!reconhecido) {
      executado = false;
    }
  }

  // MÚSICA COMEÇA 3 SEGUNDOS ANTES
  // DA ANIMAÇÃO

  function prepararInicio() {
    if (!pronto || !reconhecido || executado) {
      return;
    }

    executado = true;
    inicioCiclo = performance.now();

    tocarMusica();

    mensagem.textContent =
      "Estrela reconhecida! A começar...";

    contagem.hidden = false;

    function contar() {
      if (!reconhecido) return;

      const restante =
        INTRO - (performance.now() - inicioCiclo);

      if (restante <= 0) {
        comecarAnimacao();
        return;
      }

      contagem.textContent = String(
        Math.ceil(restante / 1000)
      );

      timerIntro = setTimeout(contar, 80);
    }

    contar();

    // LIMITE TOTAL DE 16 SEGUNDOS

    timerLimite = setTimeout(() => {
      if (executado) {
        if (emAnimacao) terminarAnimacao();
        finalizar();
      }
    }, INTRO + DURACAO + FINAL);
  }

  // INICIAR A EXPERIÊNCIA

  async function iniciar() {
    $("botao-iniciar").disabled = true;

    mostrar(carregamento);
    progresso(0, "A preparar o reconhecimento...");

    autorizarSom();

    try {
      await carregarBibliotecas();
      await carregarImagens();

      progresso(88, "A preparar o scanner...");

      // Scanner visível debaixo do carregamento
      scanner.classList.add("ativo");

      criarCena();
      await prepararTextura();

      progresso(94, "A iniciar a câmara...");

      const sistema =
        cena.systems["mindar-image-system"];

      if (!sistema) {
        throw new Error(
          "O sistema MindAR não foi iniciado."
        );
      }

      await sistema.start();

      pronto = true;

      progresso(100, "Tudo pronto!");

      // Retirar ecrã de carregamento
      mostrar(scanner);

      mensagem.textContent =
        "Aponta a câmara para a estrela ✦";

      if (reconhecido) prepararInicio();

    } catch (e) {
      mostrarErro(
        "Não foi possível carregar a experiência " +
        "de realidade aumentada. Verifica a ligação " +
        "à Internet, os ficheiros e as permissões " +
        "da câmara e tenta novamente.",
        e
      );
    }
  }

  // BOTÕES

  $("botao-iniciar").addEventListener(
    "click", iniciar
  );

  $("botao-tentar").addEventListener(
    "click", () => window.location.reload()
  );

  botaoSom.addEventListener("click", async () => {
    try {
      if (executado) {
        audio.currentTime = Math.min(
          (performance.now() - inicioCiclo) / 1000,
          16
        );
      } else {
        audio.currentTime = 0;
      }

      await audio.play();

      if (!executado) {
        audio.pause();
        audio.currentTime = 0;
      }

      botaoSom.hidden = true;

    } catch (e) {
      console.warn("Não foi possível ativar som:", e);
    }
  });

});
