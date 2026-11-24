
document.addEventListener("DOMContentLoaded", function () {

    // ELEMENTOS

    const cena = document.querySelector("a-scene");
    const target = document.querySelector("#target-portfolio");
    const animacao = document.querySelector("#animacao");
    const mensagem = document.querySelector("#mensagem");
    const musica = document.querySelector("#musica-ar");
    const botaoSom = document.querySelector("#ativar-som");

    // CONFIGURAÇÕES

    const maximoFrames = 250;
    const duracao = 10000;
    const esperaInicial = 3000;
    const largura = 1.8;

    const pasta = "animacao-portfolio/imagens animadas/";
    const versao = "5";

    const ficheiros = [];

    let carregado = false;
    let targetVisivel = false;
    let jaExecutado = false;
    let emReproducao = false;

    let temporizadorInicio = null;
    let animacaoFrame = null;
    let identificador = 0;
    let inicioReproducao = 0;
    let ultimoFrame = -1;
    let aDescodificar = false;

    // TEXTURA

    const canvas = document.createElement("canvas");
    const contexto = canvas.getContext("2d");

    let textura = null;

    function mostrarMensagem(texto) {
        mensagem.textContent = texto;
    }

    // MÚSICA

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
                "É necessário ativar o som manualmente.",
                erro
            );

            botaoSom.hidden = false;

        }

    }

    botaoSom.addEventListener("click", async function () {

        try {

            if (emReproducao) {

                const segundos =
                    (performance.now() - inicioReproducao) / 1000;

                musica.currentTime = Math.min(
                    segundos,
                    duracao / 1000
                );

                await musica.play();

            } else {

                await musica.play();
                musica.pause();
                musica.currentTime = 0;

            }

            botaoSom.hidden = true;

        } catch (erro) {

            console.error("Erro no áudio:", erro);

        }

    });

    // CARREGAR OS FOTOGRAMAS

    async function carregarFrames() {

        mostrarMensagem("A carregar: 0%");

        const resultados = [];

        for (let inicio = 0; inicio < maximoFrames; inicio += 8) {

            const tarefas = [];

            for (
                let i = inicio;
                i < Math.min(inicio + 8, maximoFrames);
                i++
            ) {

                const numero = String(i).padStart(5, "0");

                // NOME REAL DOS FICHEIROS

                const caminho =
                    pasta + "animaçao_" + numero +
                    ".png?v=" + versao;

                tarefas.push(

                    fetch(caminho, {
                        cache: "no-store"
                    }).then(async function (resposta) {

                        if (resposta.status === 404) {
                            return { indice: i, ficheiro: null };
                        }

                        if (!resposta.ok) {
                            throw new Error(caminho);
                        }

                        return {
                            indice: i,
                            ficheiro: await resposta.blob()
                        };

                    })

                );

            }

            const lote = await Promise.all(tarefas);

            resultados.push(...lote);

            const percentagem = Math.round(
                Math.min(inicio + 8, maximoFrames) /
                maximoFrames * 100
            );

            mostrarMensagem(
                "A carregar: " + percentagem + "%"
            );

        }

        resultados.sort((a, b) => a.indice - b.indice);

        // USAR TODOS OS FOTOGRAMAS DISPONÍVEIS
        // POR ORDEM, SEM SALTAR FOTOGRAMAS

        for (const resultado of resultados) {

            if (!resultado.ficheiro) {
                break;
            }

            ficheiros.push(resultado.ficheiro);

        }

        if (ficheiros.length === 0) {

            throw new Error(
                "Nenhum fotograma foi encontrado."
            );

        }

        console.log(
            "Fotogramas encontrados:",
            ficheiros.length
        );

        // AGUARDAR PELA CENA

        if (!cena.hasLoaded) {

            await new Promise(resolve => {

                cena.addEventListener(
                    "loaded",
                    resolve,
                    { once: true }
                );

            });

        }

        // DIMENSÕES

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

        // TEXTURA

        textura = new AFRAME.THREE.CanvasTexture(canvas);

        if (AFRAME.THREE.SRGBColorSpace) {

            textura.colorSpace =
                AFRAME.THREE.SRGBColorSpace;

        }

        const mesh = animacao.getObject3D("mesh");

        if (!mesh) {
            throw new Error("Não foi possível criar o plano AR.");
        }

        const material = mesh.material;

        material.map = textura;
        material.transparent = true;
        material.needsUpdate = true;

        carregado = true;

        mostrarMensagem(
            "Aponta a câmara para a estrela!"
        );

        if (targetVisivel && !jaExecutado) {
            prepararInicio();
        }

    }

    // DESENHAR FOTOGRAMA

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

            textura.needsUpdate = true;

        } catch (erro) {

            console.error("Erro no fotograma:", erro);

        } finally {

            if (imagem) {
                imagem.close();
            }

            aDescodificar = false;

        }

    }

    // REPRODUÇÃO DA ANIMAÇÃO

    function atualizarAnimacao(sessao) {

        if (
            sessao !== identificador ||
            !emReproducao
        ) {
            return;
        }

        const decorrido =
            performance.now() - inicioReproducao;

        if (decorrido >= duracao) {
            terminarAnimacao();
            return;
        }

        // DISTRIBUIR OS FOTOGRAMAS POR 10 SEGUNDOS

        const numero = Math.min(
            ficheiros.length - 1,
            Math.floor(
                (decorrido / duracao) * ficheiros.length
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
            () => atualizarAnimacao(sessao)
        );

    }

    // INICIAR EXPERIÊNCIA

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

        animacao.setAttribute("visible", true);

        mostrarMensagem(
            "Descobre as minhas ilustrações!"
        );

        reproduzirMusica();

        atualizarAnimacao(sessao);

    }

    // ESPERAR 3 SEGUNDOS

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

        temporizadorInicio = setTimeout(() => {

            temporizadorInicio = null;

            if (targetVisivel) {
                iniciarAnimacao();
            }

        }, esperaInicial);

    }

    // TERMINAR APÓS 10 SEGUNDOS

    function terminarAnimacao() {

        emReproducao = false;
        identificador++;

        if (animacaoFrame !== null) {
            cancelAnimationFrame(animacaoFrame);
            animacaoFrame = null;
        }

        animacao.setAttribute("visible", false);

        pararMusica();

        mostrarMensagem("Experiência concluída!");

    }

    // CANCELAR SE O TARGET DESAPARECER

    function cancelarExperiencia() {

        clearTimeout(temporizadorInicio);
        temporizadorInicio = null;

        if (animacaoFrame !== null) {
            cancelAnimationFrame(animacaoFrame);
            animacaoFrame = null;
        }

        identificador++;

        emReproducao = false;
        jaExecutado = false;
        ultimoFrame = -1;

        animacao.setAttribute("visible", false);

        pararMusica();

        if (carregado) {
            mostrarMensagem(
                "Aponta a câmara para a estrela!"
            );
        }

    }

    // RECONHECIMENTO DO TARGET

    target.addEventListener("targetFound", function () {

        targetVisivel = true;
        prepararInicio();

    });

    target.addEventListener("targetLost", function () {

        targetVisivel = false;
        cancelarExperiencia();

    });

    // ERRO DA CÂMARA

    cena.addEventListener("arError", function () {

        mostrarMensagem(
            "Não foi possível iniciar a câmara."
        );

    });

    // CARREGAR TUDO

    carregarFrames().catch(function (erro) {

        mostrarMensagem(
            "Erro ao carregar os fotogramas."
        );

        console.error(erro);

    });

});

document.addEventListener("DOMContentLoaded", function () {

    // ELEMENTOS

    const cena = document.querySelector("a-scene");
    const target = document.querySelector("#target-portfolio");
    const animacao = document.querySelector("#animacao");
    const mensagem = document.querySelector("#mensagem");
    const musica = document.querySelector("#musica-ar");
    const botaoSom = document.querySelector("#ativar-som");

    // CONFIGURAÇÕES

    const maximoFrames = 250;
    const duracao = 10000;
    const esperaInicial = 3000;
    const largura = 1.8;

    const pasta = "animacao-portfolio/imagens animadas/";
    const versao = "5";

    const ficheiros = [];

    let carregado = false;
    let targetVisivel = false;
    let jaExecutado = false;
    let emReproducao = false;

    let temporizadorInicio = null;
    let animacaoFrame = null;
    let identificador = 0;
    let inicioReproducao = 0;
    let ultimoFrame = -1;
    let aDescodificar = false;

    // TEXTURA

    const canvas = document.createElement("canvas");
    const contexto = canvas.getContext("2d");

    let textura = null;

    function mostrarMensagem(texto) {
        mensagem.textContent = texto;
    }

    // MÚSICA

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
                "É necessário ativar o som manualmente.",
                erro
            );

            botaoSom.hidden = false;

        }

    }

    botaoSom.addEventListener("click", async function () {

        try {

            if (emReproducao) {

                const segundos =
                    (performance.now() - inicioReproducao) / 1000;

                musica.currentTime = Math.min(
                    segundos,
                    duracao / 1000
                );

                await musica.play();

            } else {

                await musica.play();
                musica.pause();
                musica.currentTime = 0;

            }

            botaoSom.hidden = true;

        } catch (erro) {

            console.error("Erro no áudio:", erro);

        }

    });

    // CARREGAR OS FOTOGRAMAS

    async function carregarFrames() {

        mostrarMensagem("A carregar: 0%");

        const resultados = [];

        for (let inicio = 0; inicio < maximoFrames; inicio += 8) {

            const tarefas = [];

            for (
                let i = inicio;
                i < Math.min(inicio + 8, maximoFrames);
                i++
            ) {

                const numero = String(i).padStart(5, "0");

                // NOME REAL DOS FICHEIROS

                const caminho =
                    pasta + "animaçao_" + numero +
                    ".png?v=" + versao;

                tarefas.push(

                    fetch(caminho, {
                        cache: "no-store"
                    }).then(async function (resposta) {

                        if (resposta.status === 404) {
                            return { indice: i, ficheiro: null };
                        }

                        if (!resposta.ok) {
                            throw new Error(caminho);
                        }

                        return {
                            indice: i,
                            ficheiro: await resposta.blob()
                        };

                    })

                );

            }

            const lote = await Promise.all(tarefas);

            resultados.push(...lote);

            const percentagem = Math.round(
                Math.min(inicio + 8, maximoFrames) /
                maximoFrames * 100
            );

            mostrarMensagem(
                "A carregar: " + percentagem + "%"
            );

        }

        resultados.sort((a, b) => a.indice - b.indice);

        // USAR TODOS OS FOTOGRAMAS DISPONÍVEIS
        // POR ORDEM, SEM SALTAR FOTOGRAMAS

        for (const resultado of resultados) {

            if (!resultado.ficheiro) {
                break;
            }

            ficheiros.push(resultado.ficheiro);

        }

        if (ficheiros.length === 0) {

            throw new Error(
                "Nenhum fotograma foi encontrado."
            );

        }

        console.log(
            "Fotogramas encontrados:",
            ficheiros.length
        );

        // AGUARDAR PELA CENA

        if (!cena.hasLoaded) {

            await new Promise(resolve => {

                cena.addEventListener(
                    "loaded",
                    resolve,
                    { once: true }
                );

            });

        }

        // DIMENSÕES

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

        // TEXTURA

        textura = new AFRAME.THREE.CanvasTexture(canvas);

        if (AFRAME.THREE.SRGBColorSpace) {

            textura.colorSpace =
                AFRAME.THREE.SRGBColorSpace;

        }

        const mesh = animacao.getObject3D("mesh");

        if (!mesh) {
            throw new Error("Não foi possível criar o plano AR.");
        }

        const material = mesh.material;

        material.map = textura;
        material.transparent = true;
        material.needsUpdate = true;

        carregado = true;

        mostrarMensagem(
            "Aponta a câmara para a estrela!"
        );

        if (targetVisivel && !jaExecutado) {
            prepararInicio();
        }

    }

    // DESENHAR FOTOGRAMA

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

            textura.needsUpdate = true;

        } catch (erro) {

            console.error("Erro no fotograma:", erro);

        } finally {

            if (imagem) {
                imagem.close();
            }

            aDescodificar = false;

        }

    }

    // REPRODUÇÃO DA ANIMAÇÃO

    function atualizarAnimacao(sessao) {

        if (
            sessao !== identificador ||
            !emReproducao
        ) {
            return;
        }

        const decorrido =
            performance.now() - inicioReproducao;

        if (decorrido >= duracao) {
            terminarAnimacao();
            return;
        }

        // DISTRIBUIR OS FOTOGRAMAS POR 10 SEGUNDOS

        const numero = Math.min(
            ficheiros.length - 1,
            Math.floor(
                (decorrido / duracao) * ficheiros.length
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
            () => atualizarAnimacao(sessao)
        );

    }

    // INICIAR EXPERIÊNCIA

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

        animacao.setAttribute("visible", true);

        mostrarMensagem(
            "Descobre as minhas ilustrações!"
        );

        reproduzirMusica();

        atualizarAnimacao(sessao);

    }

    // ESPERAR 3 SEGUNDOS

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

        temporizadorInicio = setTimeout(() => {

            temporizadorInicio = null;

            if (targetVisivel) {
                iniciarAnimacao();
            }

        }, esperaInicial);

    }

    // TERMINAR APÓS 10 SEGUNDOS

    function terminarAnimacao() {

        emReproducao = false;
        identificador++;

        if (animacaoFrame !== null) {
            cancelAnimationFrame(animacaoFrame);
            animacaoFrame = null;
        }

        animacao.setAttribute("visible", false);

        pararMusica();

        mostrarMensagem("Experiência concluída!");

    }

    // CANCELAR SE O TARGET DESAPARECER

    function cancelarExperiencia() {

        clearTimeout(temporizadorInicio);
        temporizadorInicio = null;

        if (animacaoFrame !== null) {
            cancelAnimationFrame(animacaoFrame);
            animacaoFrame = null;
        }

        identificador++;

        emReproducao = false;
        jaExecutado = false;
        ultimoFrame = -1;

        animacao.setAttribute("visible", false);

        pararMusica();

        if (carregado) {
            mostrarMensagem(
                "Aponta a câmara para a estrela!"
            );
        }

    }

    // RECONHECIMENTO DO TARGET

    target.addEventListener("targetFound", function () {

        targetVisivel = true;
        prepararInicio();

    });

    target.addEventListener("targetLost", function () {

        targetVisivel = false;
        cancelarExperiencia();

    });

    // ERRO DA CÂMARA

    cena.addEventListener("arError", function () {

        mostrarMensagem(
            "Não foi possível iniciar a câmara."
        );

    });

    // CARREGAR TUDO

    carregarFrames().catch(function (erro) {

        mostrarMensagem(
            "Erro ao carregar os fotogramas."
        );
 
    
        console.error(erro);

    });

});
