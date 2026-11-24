
document.addEventListener("DOMContentLoaded", function () {

    // ELEMENTOS DA PÁGINA

    const cena = document.querySelector("a-scene");
    const target = document.querySelector("#target-portfolio");
    const animacao = document.querySelector("#animacao");
    const mensagem = document.querySelector("#mensagem");
    const musica = document.querySelector("#musica-ar");
    const botaoSom = document.querySelector("#ativar-som");

    // CONFIGURAÇÕES DA EXPERIÊNCIA

    const totalFrames = 250;
    const fps = 25;

    const duracao = 10000;
    const esperaInicial = 3000;

    const largura = 1.8;

    const pasta =
        "animacao-portfolio/imagens animadas/";

    const ficheiros = [];

    // ESTADO DA EXPERIÊNCIA

    let carregado = false;
    let targetVisivel = false;
    let jaExecutado = false;
    let emReproducao = false;

    let temporizadorInicio = null;
    let temporizadorFim = null;
    let animacaoFrame = null;

    let identificador = 0;
    let inicioReproducao = 0;
    let ultimoFrame = -1;
    let aDescodificar = false;

    // TEXTURA DA ANIMAÇÃO

    const canvas = document.createElement("canvas");
    const contexto = canvas.getContext("2d");

    let textura = null;

    // MENSAGENS

    function mostrarMensagem(texto) {
        mensagem.textContent = texto;
    }

    // CONTROLO DA MÚSICA

    function pararMusica() {

        musica.pause();

        try {
            musica.currentTime = 0;
        } catch (erro) {
            console.warn(erro);
        }

    }

    async function reproduzirMusica() {

        try {

            musica.currentTime = 0;

            await musica.play();

            botaoSom.hidden = true;

        } catch (erro) {

            console.warn(
                "O navegador exige ativação manual do som.",
                erro
            );

            botaoSom.hidden = false;

        }

    }

    // ATIVAR SOM NO TELEMÓVEL

    botaoSom.addEventListener("click", async function () {

        try {

            if (emReproducao) {

                // Sincronizar com a animação atual

                const segundos =
                    (performance.now() - inicioReproducao) / 1000;

                musica.currentTime = Math.min(
                    segundos,
                    duracao / 1000
                );

                await musica.play();

            } else {

                // Autorizar o áudio antes da animação

                await musica.play();

                musica.pause();
                musica.currentTime = 0;

            }

            botaoSom.hidden = true;

        } catch (erro) {

            console.error(
                "Não foi possível ativar o som:",
                erro
            );

            mostrarMensagem(
                "Não foi possível reproduzir a música."
            );

        }

    });

    // CARREGAR OS 250 FOTOGRAMAS

    async function carregarFrames() {

        mostrarMensagem(
            "A carregar a experiência: 0%"
        );

        for (
            let inicio = 0;
            inicio < totalFrames;
            inicio += 8
        ) {

            const tarefas = [];

            for (
                let i = inicio;
                i < Math.min(inicio + 8, totalFrames);
                i++
            ) {

                const numero =
                    String(i).padStart(5, "0");

                const caminho =
                    pasta +
                    "Composição 1_" +
                    numero +
                    ".png";

                tarefas.push(

                    fetch(caminho, {
                        cache: "no-store"
                    }).then(async function (resposta) {

                        if (!resposta.ok) {

                            throw new Error(
                                "Fotograma não encontrado: " +
                                caminho
                            );

                        }

                        ficheiros[i] = await resposta.blob();

                    })

                );

            }

            await Promise.all(tarefas);

            const percentagem = Math.round(
                Math.min(inicio + 8, totalFrames) /
                totalFrames * 100
            );

            mostrarMensagem(
                "A carregar a experiência: " +
                percentagem +
                "%"
            );

        }

        // AGUARDAR PELA CENA A-FRAME

        if (!cena.hasLoaded) {

            await new Promise(function (resolve) {

                cena.addEventListener(
                    "loaded",
                    resolve,
                    { once: true }
                );

            });

        }

        // DIMENSÕES DA TEXTURA

        const primeiraImagem =
            await createImageBitmap(ficheiros[0]);

        const proporcao =
            primeiraImagem.height /
            primeiraImagem.width;

        canvas.width = Math.min(
            primeiraImagem.width,
            1024
        );

        canvas.height = Math.round(
            canvas.width * proporcao
        );

        primeiraImagem.close();

        animacao.setAttribute(
            "width",
            largura
        );

        animacao.setAttribute(
            "height",
            largura * proporcao
        );

        // CRIAR TEXTURA

        textura = new AFRAME.THREE.CanvasTexture(
            canvas
        );

        if (AFRAME.THREE.SRGBColorSpace) {

            textura.colorSpace =
                AFRAME.THREE.SRGBColorSpace;

        }

        const mesh = animacao.getObject3D("mesh");

        if (!mesh) {

            throw new Error(
                "Não foi possível criar a animação."
            );

        }

        const material = mesh.material;

        material.map = textura;
        material.transparent = true;
        material.needsUpdate = true;

        carregado = true;

        mostrarMensagem(
            "Aponta a câmara para a estrela!"
        );

        // SE A ESTRELA JÁ ESTIVER RECONHECIDA

        if (targetVisivel && !jaExecutado) {
            prepararInicio();
        }

    }

    // MOSTRAR FOTOGRAMA

    async function mostrarFrame(numero, sessao) {

        aDescodificar = true;

        let imagem = null;

        try {

            imagem = await createImageBitmap(
                ficheiros[numero]
            );

            if (
                sessao !== identificador ||
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

            console.error(
                "Erro no fotograma:",
                numero,
                erro
            );

        } finally {

            if (imagem) {
                imagem.close();
            }

            aDescodificar = false;

        }

    }

    // REPRODUÇÃO SINCRONIZADA

    function atualizarAnimacao(sessao) {

        if (
            sessao !== identificador ||
            !emReproducao
        ) {
            return;
        }

        const tempoDecorrido =
            performance.now() - inicioReproducao;

        if (tempoDecorrido >= duracao) {
            terminarAnimacao();
            return;
        }

        const numero = Math.min(
            totalFrames - 1,
            Math.floor(
                tempoDecorrido / (1000 / fps)
            )
        );

        if (
            numero !== ultimoFrame &&
            !aDescodificar
        ) {

            ultimoFrame = numero;

            mostrarFrame(numero, sessao);

        }

        animacaoFrame = requestAnimationFrame(
            function () {
                atualizarAnimacao(sessao);
            }
        );

    }

    // COMEÇAR A EXPERIÊNCIA

    function iniciarAnimacao() {

        if (
            !carregado ||
            !targetVisivel ||
            jaExecutado
        ) {
            return;
        }

        jaExecutado = true;
        emReproducao = true;

        const sessao = ++identificador;

        ultimoFrame = -1;

        inicioReproducao = performance.now();

        animacao.setAttribute(
            "visible",
            true
        );

        mostrarMensagem(
            "Descobre as minhas ilustrações!"
        );

        // A MÚSICA COMEÇA COM A ANIMAÇÃO

        reproduzirMusica();

        // COMEÇAR OS FOTOGRAMAS

        atualizarAnimacao(sessao);

        // TERMINAR APÓS 10 SEGUNDOS

        temporizadorFim = setTimeout(
            function () {

                if (sessao === identificador) {
                    terminarAnimacao();
                }

            },
            duracao
        );

    }

    // AGUARDAR 3 SEGUNDOS APÓS O SCAN

    function prepararInicio() {

        if (
            !carregado ||
            !targetVisivel ||
            jaExecutado ||
            temporizadorInicio !== null
        ) {
            return;
        }

        mostrarMensagem(
            "Estrela reconhecida! A iniciar em 3 segundos..."
        );

        temporizadorInicio = setTimeout(
            function () {

                temporizadorInicio = null;

                if (targetVisivel) {
                    iniciarAnimacao();
                }

            },
            esperaInicial
        );

    }

    // TERMINAR A EXPERIÊNCIA

    function terminarAnimacao() {

        emReproducao = false;

        identificador++;

        clearTimeout(temporizadorFim);
        temporizadorFim = null;

        if (animacaoFrame !== null) {

            cancelAnimationFrame(animacaoFrame);

            animacaoFrame = null;

        }

        animacao.setAttribute(
            "visible",
            false
        );

        pararMusica();

        mostrarMensagem(
            "Experiência concluída!"
        );

    }

    // CANCELAR QUANDO O TARGET DESAPARECE

    function cancelarExperiencia() {

        clearTimeout(temporizadorInicio);

        temporizadorInicio = null;

        clearTimeout(temporizadorFim);

        temporizadorFim = null;

        if (animacaoFrame !== null) {

            cancelAnimationFrame(animacaoFrame);

            animacaoFrame = null;

        }

        identificador++;

        emReproducao = false;
        jaExecutado = false;
        ultimoFrame = -1;

        animacao.setAttribute(
            "visible",
            false
        );

        pararMusica();

        if (carregado) {

            mostrarMensagem(
                "Aponta a câmara para a estrela!"
            );

        }

    }

    // TARGET RECONHECIDO

    target.addEventListener(
        "targetFound",
        function () {

            targetVisivel = true;

            prepararInicio();

        }
    );

    // TARGET PERDIDO

    target.addEventListener(
        "targetLost",
        function () {

            targetVisivel = false;

            cancelarExperiencia();

        }
    );

    // ERRO DA CÂMARA

    cena.addEventListener(
        "arError",
        function () {

            mostrarMensagem(
                "Não foi possível iniciar a câmara."
            );

        }
    );

    // INICIAR CARREGAMENTO

    carregarFrames().catch(
        function (erro) {

            mostrarMensagem(
                "Erro ao carregar os fotogramas."
            );

            console.error(erro);

        }
    );

});
