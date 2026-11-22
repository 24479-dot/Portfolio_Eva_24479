document.addEventListener("DOMContentLoaded", async function () {

    const cena = document.querySelector("a-scene");
    const target = document.querySelector("#target-portfolio");
    const animacao = document.querySelector("#animacao");
    const mensagem = document.querySelector("#mensagem");

    // CONFIGURAÇÕES

    const totalFrames = 250;
    const fps = 25;
    const largura = 1.8;
    const versao = "2";

    const pasta = "animacao-portfolio/Composição 1/";

    const ficheiros = [];

    let carregado = false;
    let targetVisivel = false;
    let reproduzido = false;
    let identificador = 0;

    // TEXTURA DA ANIMAÇÃO

    const canvas = document.createElement("canvas");
    const contexto = canvas.getContext("2d");

    let textura;

    // CARREGAR FOTOGRAMAS

    async function carregarFrames() {

        for (let inicio = 0; inicio < totalFrames; inicio += 8) {

            const tarefas = [];

            for (
                let i = inicio;
                i < Math.min(inicio + 8, totalFrames);
                i++
            ) {

                const numero = String(i).padStart(5, "0");

                const caminho =
                    pasta + "Composição 1_" + numero + ".png?v=" + versao;

                tarefas.push(

                    fetch(caminho, { cache: "no-store" })

                    .then(async resposta => {

                        if (!resposta.ok) {
                            throw new Error(caminho);
                        }

                        ficheiros[i] = await resposta.blob();

                    })
                );

            }

            await Promise.all(tarefas);

            const percentagem = Math.round(
                Math.min(inicio + 8, totalFrames)
                / totalFrames * 100
            );

            mensagem.textContent =
                "A carregar: " + percentagem + "%";

        }

        if (!cena.hasLoaded) {

            await new Promise(resolve => {

                cena.addEventListener(
                    "loaded",
                    resolve,
                    { once: true }
                );

            });

        }

        // PROPORÇÕES DA ANIMAÇÃO

        const primeiraImagem =
            await createImageBitmap(ficheiros[0]);

        const proporcao =
            primeiraImagem.height / primeiraImagem.width;

        canvas.width = Math.min(
            primeiraImagem.width,
            1024
        );

        canvas.height = Math.round(
            canvas.width * proporcao
        );

        primeiraImagem.close();

        animacao.setAttribute("width", largura);

        animacao.setAttribute(
            "height",
            largura * proporcao
        );

        // CRIAR TEXTURA

        textura = new AFRAME.THREE.CanvasTexture(canvas);

        if (AFRAME.THREE.SRGBColorSpace) {

            textura.colorSpace =
                AFRAME.THREE.SRGBColorSpace;

        }

        const material = animacao.getObject3D("mesh").material;

        material.map = textura;
        material.transparent = true;
        material.needsUpdate = true;

        carregado = true;

        mensagem.textContent =
            "Aponta a câmara para a estrela!";

        if (targetVisivel) {
            iniciarAnimacao();
        }

    }

    // INICIAR ANIMAÇÃO

    async function iniciarAnimacao() {

        if (!carregado || reproduzido || !targetVisivel) {
            return;
        }

        reproduzido = true;

        const sessao = ++identificador;

        mensagem.textContent =
            "Descobre as minhas ilustrações!";

        let proximaImagem =
            createImageBitmap(ficheiros[0]);

        try {

            for (let i = 0; i < totalFrames; i++) {

                const imagem = await proximaImagem;

                if (sessao !== identificador) {

                    imagem.close();
                    return;

                }

                const inicio = performance.now();

                // PREPARAR FOTOGRAMA SEGUINTE

                if (i + 1 < totalFrames) {

                    proximaImagem =
                        createImageBitmap(ficheiros[i + 1]);

                }

                // MOSTRAR FOTOGRAMA

                contexto.clearRect(
                    0, 0,
                    canvas.width,
                    canvas.height
                );

                contexto.drawImage(
                    imagem,
                    0, 0,
                    canvas.width,
                    canvas.height
                );

                imagem.close();

                textura.needsUpdate = true;

                animacao.setAttribute("visible", true);

                // REPRODUZIR A 25 FPS

                const espera = Math.max(
                    0,
                    1000 / fps -
                    (performance.now() - inicio)
                );

                await new Promise(resolve =>
                    setTimeout(resolve, espera)
                );

            }

            // FIM DA EXPERIÊNCIA

            if (sessao === identificador) {

                animacao.setAttribute("visible", false);

                mensagem.textContent =
                    "Experiência concluída!";

            }

        } catch (erro) {

            if (sessao === identificador) {

                animacao.setAttribute("visible", false);

                mensagem.textContent =
                    "Erro ao reproduzir a animação.";

                console.error(erro);

            }

        }

    }

    // TARGET RECONHECIDO

    target.addEventListener("targetFound", function () {

        targetVisivel = true;

        iniciarAnimacao();

    });

    // TARGET PERDIDO

    target.addEventListener("targetLost", function () {

        targetVisivel = false;

        identificador++;

        reproduzido = false;

        animacao.setAttribute("visible", false);

        if (carregado) {

            mensagem.textContent =
                "Aponta a câmara para a estrela!";

        }

    });

    // ERRO DA CÂMARA

    cena.addEventListener("arError", function () {

        mensagem.textContent =
            "Não foi possível iniciar a câmara.";

    });

    // CARREGAR EXPERIÊNCIA

    carregarFrames().catch(function (erro) {

        mensagem.textContent =
            "Erro ao carregar os fotogramas.";

        console.error(erro);

    });

});