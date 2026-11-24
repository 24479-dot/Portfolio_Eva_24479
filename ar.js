
document.addEventListener("DOMContentLoaded", () => {

    // ELEMENTOS DA EXPERIÊNCIA

    const cena = document.querySelector("a-scene");
    const target = document.querySelector("#target-portfolio");
    const plano = document.querySelector("#animacao");
    const mensagem = document.querySelector("#mensagem");
    const musica = document.querySelector("#musica-ar");
    const botaoSom = document.querySelector("#ativar-som");

    // CONFIGURAÇÕES

    const pasta = "animacao-portfolio/imagens animadas/";
    const prefixo = "animaçao_";

    const espera = 3000;
    const duracao = 10000;

    // LIMITE DE SEGURANÇA
    // A ANIMAÇÃO TERMINA NO PRIMEIRO PNG EM FALTA

    const limitePesquisa = 300;

    // VARIÁVEIS

    const fotogramas = [];

    let pronto = false;
    let reconhecido = false;
    let reproduzido = false;
    let aReproduzir = false;

    let esperaTimer = null;
    let pedidoAnimacao = null;

    let inicio = 0;
    let ultimoFrame = -1;
    let sessao = 0;
    let aDesenhar = false;

    // TEXTURA

    const canvas = document.createElement("canvas");
    const contexto = canvas.getContext("2d");

    let textura = null;

    // MENSAGENS

    function informar(texto) {
        mensagem.textContent = texto;
    }

    // MÚSICA

    function pararSom() {

        musica.pause();

        try {
            musica.currentTime = 0;
        } catch (erro) {
            console.warn(erro);
        }

    }

    async function tocarSom() {

        try {

            musica.currentTime = 0;

            await musica.play();

            botaoSom.hidden = true;

        } catch (erro) {

            botaoSom.hidden = false;

            console.warn(
                "O navegador bloqueou o som automático.",
                erro
            );

        }

    }

    // AUTORIZAÇÃO MANUAL DO SOM

    botaoSom.addEventListener("click", async () => {

        try {

            if (aReproduzir) {

                const tempo =
                    (performance.now() - inicio) / 1000;

                musica.currentTime =
                    Math.min(tempo, duracao / 1000);

                await musica.play();

            } else {

                await musica.play();

                musica.pause();
                musica.currentTime = 0;

            }

            botaoSom.hidden = true;

        } catch (erro) {

            console.error("Erro no som:", erro);

            informar(
                "Não foi possível ativar a música."
            );

        }

    });

    // ESPERAR PELO A-FRAME

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

    function esperarMesh() {

        return new Promise(resolve => {

            function verificar() {

                const mesh = plano.getObject3D("mesh");

                if (mesh) {
                    resolve(mesh);
                } else {
                    requestAnimationFrame(verificar);
                }

            }

            verificar();

        });

    }

    // CARREGAR FOTOGRAMAS EXISTENTES

    async function carregarFotogramas() {

        informar("A carregar animação...");

        for (let i = 0; i < limitePesquisa; i++) {

            const numero = String(i).padStart(5, "0");

            const caminho =
                pasta + prefixo + numero + ".png";

            const resposta = await fetch(caminho, {
                cache: "no-store"
            });

            // O PRIMEIRO FICHEIRO EM FALTA
            // INDICA O FIM DA SEQUÊNCIA

            if (resposta.status === 404) {

                console.log(
                    "Fim dos fotogramas no índice:", i
                );

                break;
            }

            if (!resposta.ok) {

                throw new Error(
                    "Erro ao carregar " + caminho +
                    " (HTTP " + resposta.status + ")"
                );

            }

            const blob = await resposta.blob();

            fotogramas.push(blob);

            informar(
                "A carregar animação: " +
                fotogramas.length + " imagens"
            );

        }

        if (fotogramas.length === 0) {

            throw new Error(
                "Não foi encontrado nenhum fotograma. " +
                "Confirma o caminho e o nome do PNG inicial."
            );

        }

        console.log(
            "Total de fotogramas encontrados:",
            fotogramas.length
        );

        await esperarCena();

        const mesh = await esperarMesh();

        // IDENTIFICAR TAMANHO DAS IMAGENS

        const primeira =
            await createImageBitmap(fotogramas[0]);

        const proporcao =
            primeira.height / primeira.width;

        canvas.width = Math.min(primeira.width, 1024);
        canvas.height = Math.round(
            canvas.width * proporcao
        );

        primeira.close();

        plano.setAttribute("width", 1.8);
        plano.setAttribute(
            "height",
            1.8 * proporcao
        );

        // CRIAR TEXTURA TRANSPARENTE

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

        pronto = true;

        informar("Aponta a câmara para a estrela!");

        if (reconhecido) {
            preparar();
        }

    }

    // DESENHAR UMA IMAGEM

    async function desenharFrame(numero, id) {

        aDesenhar = true;

        let imagem = null;

        try {

            imagem = await createImageBitmap(
                fotogramas[numero]
            );

            if (id !== sessao || !aReproduzir) {
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
                "Erro no fotograma " + numero,
                erro
            );

        } finally {

            if (imagem) {
                imagem.close();
            }

            aDesenhar = false;

        }

    }

    // ATUALIZAR ANIMAÇÃO

    function atualizar(id) {

        if (!aReproduzir || id !== sessao) {
            return;
        }

        const decorrido = performance.now() - inicio;

        if (decorrido >= duracao) {
            terminar();
            return;
        }

        // AJUSTA O NÚMERO REAL DE IMAGENS
        // AOS 10 SEGUNDOS DA EXPERIÊNCIA

        const frame = Math.min(
            fotogramas.length - 1,
            Math.floor(
                (decorrido / duracao) *
                fotogramas.length
            )
        );

        if (
            frame !== ultimoFrame &&
            !aDesenhar
        ) {

            ultimoFrame = frame;
            desenharFrame(frame, id);

        }

        pedidoAnimacao = requestAnimationFrame(
            () => atualizar(id)
        );

    }

    // COMEÇAR ANIMAÇÃO

    function começar() {

        if (
            !pronto ||
            !reconhecido ||
            reproduzido
        ) {
            return;
        }

        reproduzido = true;
        aReproduzir = true;

        const id = ++sessao;

        ultimoFrame = -1;
        inicio = performance.now();

        plano.setAttribute("visible", true);

        informar("Descobre as minhas ilustrações!");

        tocarSom();

        atualizar(id);

    }

    // CONTAGEM DOS 3 SEGUNDOS

    function preparar() {

        if (
            !pronto ||
            !reconhecido ||
            reproduzido ||
            esperaTimer !== null
        ) {
            return;
        }

        informar(
            "Estrela reconhecida! A iniciar em 3 segundos..."
        );

        esperaTimer = setTimeout(() => {

            esperaTimer = null;

            if (reconhecido) {
                começar();
            }

        }, espera);

    }

    // TERMINAR ANIMAÇÃO

    function terminar() {

        aReproduzir = false;
        sessao++;

        if (pedidoAnimacao !== null) {

            cancelAnimationFrame(pedidoAnimacao);
            pedidoAnimacao = null;

        }

        plano.setAttribute("visible", false);

        pararSom();

        informar("Experiência concluída!");

    }

    // CANCELAR AO PERDER A ESTRELA

    function cancelar() {

        clearTimeout(esperaTimer);
        esperaTimer = null;

        aReproduzir = false;
        reproduzido = false;

        sessao++;

        if (pedidoAnimacao !== null) {

            cancelAnimationFrame(pedidoAnimacao);
            pedidoAnimacao = null;

        }

        ultimoFrame = -1;

        plano.setAttribute("visible", false);

        pararSom();

        if (pronto) {
            informar("Aponta a câmara para a estrela!");
        }

    }

    // DETETAR ESTRELA

    target.addEventListener("targetFound", () => {

        reconhecido = true;
        preparar();

    });

    target.addEventListener("targetLost", () => {

        reconhecido = false;
        cancelar();

    });

    // ERRO DA CÂMARA

    cena.addEventListener("arError", () => {

        informar(
            "Não foi possível iniciar a câmara."
        );

    });

    // INICIAR CARREGAMENTO

    carregarFotogramas().catch(erro => {

        console.error(
            "Erro na experiência AR:",
            erro
        );

        informar(
            "Erro ao carregar os fotogramas."
        );

    });

});

