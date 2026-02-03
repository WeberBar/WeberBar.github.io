// --- VARIÁVEIS GLOBAIS ---
let net;
let webcamElement;
let isModelLoaded = false;
let requestAnimationFrameId;
let nextClassId = 2; // Começa em 2 pois já temos 0 e 1 (inicialmente)
// Lista ordenada de IDs ativos para manter a ordem da fila
let activeClassIds = [0, 1];

// Armazena os dados: { 0: [{activation, canvas}], 1: [...] }
let classesData = {};

// --- 1. SETUP INICIAL ---
async function setup() {
    if (typeof tf === 'undefined' || typeof mobilenet === 'undefined') {
        console.error("TensorFlow não carregado. Verifique os imports no HTML.");
        return;
    }

    // Carrega MobileNet (Visão) e KNN (Cérebro - neste caso Neural Network)
    try {
        net = await mobilenet.load();

        // Configura webcam invisível na memória
        webcamElement = document.createElement('video');
        webcamElement.autoplay = true;
        webcamElement.muted = true;
        webcamElement.playsInline = true; // Importante para mobile
        webcamElement.width = 224;
        webcamElement.height = 224;

        isModelLoaded = true;

        // Renderiza os cards iniciais
        renderAllCards();

        // Esconde Loading Overlay
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.add('opacity-0');
            setTimeout(() => {
                overlay.classList.add('hidden');
            }, 500);
        }

        // Atualiza conectores inicial
        setTimeout(updateConnectors, 500);
        window.addEventListener('resize', updateConnectors);

    } catch (error) {
        console.error("Erro ao carregar modelos:", error);
    }
}
setup();

// --- 2. FUNÇÕES VISUAIS AUXILIARES ---

// --- 2. FUNÇÕES VISUAIS AUXILIARES ---

// --- 2. FUNÇÕES VISUAIS AUXILIARES ---

// Cria o visual da foto com o efeito de lixeira (Overlay)
function createThumbVisual(sourceCanvas, onClickFunction) {
    // Container Principal (Mantido CSS customizado para hover effects complexos)
    const wrapper = document.createElement('div');
    wrapper.className = 'thumb-container group relative'; // Adicionado group/relative

    // Canvas Visual
    const visualCanvas = document.createElement('canvas');
    visualCanvas.className = 'thumb-img';
    visualCanvas.width = 224;
    visualCanvas.height = 224;
    // Desenha a imagem do source no visual
    visualCanvas.getContext('2d').drawImage(sourceCanvas, 0, 0);

    // Camada da Lixeira (Overlay)
    const overlay = document.createElement('div');
    overlay.className = 'delete-overlay';
    // Ícone de lixeira simples e clean
    overlay.innerHTML = '<span class="material-icons">delete_outline</span>';

    // Montagem
    wrapper.appendChild(visualCanvas);
    wrapper.appendChild(overlay);

    // Evento de Clique (Deletar)
    wrapper.onclick = onClickFunction;

    return wrapper;
}

// --- 3. GERENCIAMENTO DE CLASSES ---

// --- 3. GERENCIAMENTO DE CLASSES ---

// Função principal de renderização de todos os cards
window.renderAllCards = function () {
    const container = document.getElementById('classes-container');
    container.innerHTML = ''; // Limpa tudo

    activeClassIds.forEach((classId, index) => {
        // Cria elementos do card
        const newCard = document.createElement('div');

        // Cores rotativas
        const borderColors = ['border-pi-yellow', 'border-pi-green', 'border-pi-blue', 'border-pi-blue-dark'];
        const activeBorder = borderColors[index % borderColors.length];

        newCard.className = `bg-white border-2 ${activeBorder} rounded-2xl p-4 relative group hover:border-4 transition-all shadow-sm hover:shadow-md min-h-[210px] h-auto flex flex-col justify-between card class-card`;
        newCard.id = `card-${classId}`;

        container.appendChild(newCard); // Adiciona ao DOM (vazio)

        // Renderiza o conteúdo interno
        renderSavedState(classId, newCard.id);
    });

    updateDeleteIcons();
    updateConnectors();
}

// Adicionar Nova Classe (Botão "Adicionar uma classe")
window.addClass = function () {
    const classId = nextClassId++;

    // Adiciona à lista
    activeClassIds.push(classId);

    // Inicializa dados
    classesData[classId] = [];

    // Re-renderiza tudo para manter a ordem
    renderAllCards();
}

// Atualiza status dos ícones de deletar
window.updateDeleteIcons = function () {
    const isMinCards = activeClassIds.length <= 2;

    activeClassIds.forEach(classId => {
        const card = document.getElementById(`card-${classId}`);
        if (!card) return;

        const deleteBtn = card.querySelector('button[onclick^="window.deleteCard"]');
        if (!deleteBtn) return;

        const icon = deleteBtn.querySelector('.material-icons');

        // Sempre mantém o ícone de lixeira
        if (icon) icon.innerText = 'delete_outline';

        if (isMinCards) {
            // Modo "Limpar" (Vassoura/Reciclar) - Mas com ícone de lixeira conforme pedido
            deleteBtn.title = "Limpar fotos";
            // Removemos a cor de alerta para indicar que não destroi estrutura, ou mantemos?
            // O user pediu para tirar a vassoura, então vamos manter o visual mais "padrão"
            // mas talvez um hover amarelo ainda seja util para indicar "Warning" (só limpa) vs "Danger" (apaga)?
            // Vamos manter o hover amarelo para diferenciar sutilmente a ação.
            deleteBtn.classList.remove('hover:text-red-500', 'hover:bg-red-50');
            deleteBtn.classList.add('hover:text-amber-500', 'hover:bg-amber-50');
        } else {
            // Modo "Deletar" (Lixeira)
            deleteBtn.title = "Remover classe";
            deleteBtn.classList.add('hover:text-red-500', 'hover:bg-red-50');
            deleteBtn.classList.remove('hover:text-amber-500', 'hover:bg-amber-50');
        }
    });
}

// Funcao para deletar card
window.deleteCard = function (classId) {
    // LÓGICA DE FILA:
    // Se tiver > 2 cards, remove o card e shift (quem estava embaixo sobe).
    // Se tiver <= 2 cards, apenas limpa os dados (não remove o card).

    const index = activeClassIds.indexOf(classId);
    if (index === -1) return;

    // Caso 1: Apenas limpar (Mínimo 2 cards)
    if (activeClassIds.length <= 2) {
        if (!confirm("Limpar todas as fotos desta classe? (Mínimo de 2 classes mantido)")) return;

        // Limpa dados
        if (classesData[classId]) {
            classesData[classId].forEach(item => item.activation.dispose());
            classesData[classId] = [];
        }

        // Renderiza card limpo
        renderSavedState(classId, `card-${classId}`);
        return;
    }

    // Caso 2: Remover permanentemente (Fila)
    if (!confirm("Remover esta classe da fila?")) return;

    // Remove dados TensorFlow
    if (classesData[classId]) {
        classesData[classId].forEach(item => item.activation.dispose());
        delete classesData[classId];
    }

    // Remove da lista de ativos
    activeClassIds.splice(index, 1);

    // Re-renderiza a fila (quem estava depois sobe)
    renderAllCards();
}

// Renderiza o Card quando a câmera está FECHADA (Lista Horizontal)
window.renderSavedState = function (classId, cardId) {
    // Garante que o ID do card seja encontrado
    const card = document.getElementById(cardId) || document.getElementById(`card-${classId}`);
    if (!card) return;

    // Segurança: Garante que a lista existe
    if (!classesData[classId]) classesData[classId] = [];

    const samples = classesData[classId];
    const hasSamples = samples.length > 0;

    // Pega o nome atual se já existir input, senão cria padrão
    const existingInput = card.querySelector('.class-name-input');
    const currentName = existingInput ? existingInput.value : `Classe ${parseInt(classId) + 1}`;

    // Card Responsivo: Força auto-height e mínimo de 210px
    card.classList.remove('h-[180px]', 'min-h-[180px]');
    card.classList.add('h-auto', 'min-h-[210px]');

    // Cores de foco dinâmico
    const focusColors = ['focus-within:border-pi-blue', 'focus-within:border-pi-green', 'focus-within:border-pi-yellow'];
    const focusClass = focusColors[classId % focusColors.length];

    // Cabeçalho Padrão (PiCode Light)
    let html = `
        <div class="flex justify-between items-center mb-4">
             <div class="flex-1 mr-2 px-3 py-2 bg-slate-50 rounded-xl border border-transparent ${focusClass} focus-within:bg-white transition-colors">
                 <input type="text" value="${currentName}" class="class-name-input bg-transparent font-bold text-slate-700 w-full focus:outline-none placeholder-slate-400" placeholder="Nome da Coisa">
             </div>
             <button class="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" onclick="window.deleteCard(${classId})">
                <span class="material-icons">delete_outline</span>
            </button>
        </div>
        <div class="card-body" id="body-${classId}">
    `;

    if (!hasSamples) {
        // MODO 1: VAZIO 
        const btnColor = classId % 2 === 0 ? 'text-pi-blue bg-pi-blue/10 hover:bg-pi-blue' : 'text-pi-green bg-pi-green/10 hover:bg-pi-green';

        html += `
            <div class="flex flex-col gap-3">
                <p class="text-xs text-slate-400 font-bold uppercase tracking-wider pl-1">Adicionar Exemplos:</p>
                <div class="flex gap-2">
                    <button class="flex-1 ${btnColor} py-3 rounded-xl font-bold hover:text-white transition-all flex items-center justify-center gap-2 group-btn" onclick="window.openWebcam(${classId})">
                        <span class="material-icons">videocam</span> Webcam
                    </button>
                    <button class="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2" onclick="window.triggerUpload(${classId})">
                        <span class="material-icons">upload_file</span> Arquivo
                    </button>
                </div>
            </div>
        `;
    } else {
        // MODO 2: COM FOTOS (Lista Horizontal)
        html += `
            <div class="saved-state-card">
                 <div class="saved-count text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide px-1">${samples.length} Exemplos</div>
                <div class="saved-content-row">
                    <div class="saved-buttons">
                        <button class="btn-small" onclick="window.openWebcam(${classId})" title="Abrir Webcam">
                            <span class="material-icons text-sm">videocam</span>
                        </button>
                        <button class="btn-small" onclick="window.triggerUpload(${classId})" title="Enviar Arquivo">
                            <span class="material-icons text-sm">upload_file</span>
                        </button>
                    </div>

                    <div class="saved-samples-list custom-scrollbar" id="saved-list-${classId}"></div>
                </div>
            </div>
        `;
    }

    html += `</div>`;
    card.innerHTML = html;

    // Se tiver fotos, injeta elas na lista horizontal
    if (hasSamples) {
        const listContainer = document.getElementById(`saved-list-${classId}`);
        samples.forEach((item, index) => {
            const thumbWrapper = createThumbVisual(item.canvas, () => window.deleteSample(classId, index, false));
            listContainer.appendChild(thumbWrapper);
        });
    }

    updateConnectors();
}

// --- 4. WEBCAM MODAL LOGIC ---

let activeClassId = null; // Classe sendo editada no modal

// Abrir Modal
window.openWebcam = async function (classId) {
    if (!isModelLoaded) {
        alert("Carregando inteligência...");
        return;
    }

    activeClassId = classId;

    // Inicializa lista se necessário
    if (!classesData[classId]) {
        classesData[classId] = [];
    }

    // Atualiza Título do Modal
    const cardInput = document.querySelector(`#card-${classId} .class-name-input`);
    const className = cardInput ? cardInput.value : `Classe ${classId + 1}`;
    document.getElementById('modal-class-name').innerText = className;

    // Mostra Modal
    const modal = document.getElementById('webcam-modal');
    modal.classList.remove('hidden');

    // Inicia Câmera no Modal
    const modalVideo = document.getElementById('modal-video');

    // Se já temos stream global, reutiliza
    if (!webcamElement.srcObject) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            webcamElement.srcObject = stream;
        } catch (e) {
            console.error(e);
            return alert("Erro ao acessar câmera.");
        }
    }
    modalVideo.srcObject = webcamElement.srcObject;
    await modalVideo.play();

    // Renderiza a galeria do modal com as imagens atuais dessa classe
    renderModalGallery();
}

window.closeWebcamModal = function () {
    const modal = document.getElementById('webcam-modal');
    modal.classList.add('hidden');

    const modalVideo = document.getElementById('modal-video');
    modalVideo.pause();
    modalVideo.srcObject = null;

    // Atualiza o card de fundo para refletir mudanças
    if (activeClassId !== null) {
        renderSavedState(activeClassId, `card-${activeClassId}`);
        activeClassId = null;
    }
}

// Renderiza a galeria horizontal do modal
function renderModalGallery() {
    const gallery = document.getElementById('modal-gallery');
    const countSpan = document.getElementById('modal-sample-count');

    gallery.innerHTML = '';
    countSpan.innerText = classesData[activeClassId].length;

    // Mostra as últimas fotos (inverso ou normal? normal append)
    classesData[activeClassId].forEach((item, index) => {
        // Cria thumb simples para o modal
        const thumb = document.createElement('div');
        thumb.className = "w-16 h-16 rounded-lg overflow-hidden border-2 border-slate-200 relative flex-shrink-0 animate-pop-in";

        const img = document.createElement('canvas');
        img.width = 224; img.height = 224;
        img.className = "w-full h-full object-cover";
        img.getContext('2d').drawImage(item.canvas, 0, 0);

        thumb.appendChild(img);
        gallery.appendChild(thumb);
    });

    // Scroll pro final
    gallery.scrollLeft = gallery.scrollWidth;
}


// --- 5. LÓGICA DE GRAVAÇÃO (MODAL) ---

let recordInterval;

window.modalStartRecording = function () {
    if (activeClassId === null) return;

    const indicator = document.getElementById('recording-indicator');
    indicator.classList.remove('hidden');

    // Grava imediatamente
    captureSample(activeClassId);

    // E continua gravando
    recordInterval = setInterval(() => captureSample(activeClassId), 100);
}

window.modalStopRecording = function () {
    clearInterval(recordInterval);
    const indicator = document.getElementById('recording-indicator');
    indicator.classList.add('hidden');
}


async function captureSample(classId) {
    // Usa o vídeo do modal se estiver aberto (garante que está visível e tocando)
    const modalVideo = document.getElementById('modal-video');
    const sourceVideo = (modalVideo && !modalVideo.paused) ? modalVideo : webcamElement;

    // isMirrored = true pois é selfie camera
    await addSampleToClass(sourceVideo, classId, true);
}

// LÓGICA GENÉRICA DE ADICIONAR AMOSTRA (Webcam ou Imagem)
async function addSampleToClass(sourceElement, classId, isMirrored) {
    // 1. Processamento Prévio (Resize na CPU/Canvas 2D)
    const canvasItem = document.createElement('canvas');
    canvasItem.width = 224;
    canvasItem.height = 224;
    const ctx = canvasItem.getContext('2d');

    // Desenha espelhado APENAS se for webcam
    if (isMirrored) {
        ctx.translate(224, 0);
        ctx.scale(-1, 1);
    }

    ctx.drawImage(sourceElement, 0, 0, 224, 224);

    // 2. Cria Tensor
    const imgTensor = tf.browser.fromPixels(canvasItem);
    const activation = net.infer(imgTensor, 'conv_preds');
    imgTensor.dispose();

    // 3. Salva no Array Global
    if (!classesData[classId]) classesData[classId] = [];

    const newIndex = classesData[classId].length;
    classesData[classId].push({ activation: activation, canvas: canvasItem });

    // 4. ATUALIZAÇÃO VISUAL

    // Se estiver no MODAL (activeClassId match)
    const modal = document.getElementById('webcam-modal');
    if (modal && !modal.classList.contains('hidden') && activeClassId == classId) {
        renderModalGallery(); // Atualiza a tirinha do modal
    } else {
        // Se estiver FORA do modal (Upload ou modal fechado)
        // Atualiza o card principal imediatamente
        renderSavedState(classId, `card-${classId}`);
    }
}

// --- FILE UPLOAD LOGIC ---

window.triggerUpload = function (classId) {
    // Cria input invisível dinamicamente se não existir
    let input = document.getElementById(`upload-input-${classId}`);
    if (!input) {
        input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = true; // Permite múltiplos arquivos
        input.id = `upload-input-${classId}`;
        input.style.display = 'none';
        input.onchange = (e) => handleFileUpload(e, classId);
        document.body.appendChild(input);
    }
    input.click();
}

window.handleFileUpload = async function (event, classId) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Processa cada arquivo SEQUENCIALMENTE para evitar sobrecarga do WebGL
    for (let i = 0; i < files.length; i++) {
        const file = files[i];

        await new Promise((resolve) => {
            // Cria elemento de imagem temporário
            const img = new Image();
            const reader = new FileReader();

            reader.onload = (e) => {
                img.src = e.target.result;
                img.onload = async () => {
                    try {
                        // Adiciona a amostra (SEM espelhamento para uploads)
                        await addSampleToClass(img, classId, false);
                    } catch (err) {
                        console.error("Erro ao processar imagem:", err);
                    }
                    resolve(); // Continua para a próxima imagem
                };
                img.onerror = () => {
                    console.error("Erro ao carregar imagem.");
                    resolve();
                };
            };

            reader.onerror = () => {
                console.error("Erro ao ler arquivo.");
                resolve();
            };

            reader.readAsDataURL(file);
        });

    }

    // Reseta o input para permitir selecionar o mesmo arquivo novamente
    event.target.value = '';
}

// --- 6. DELETAR AMOSTRA ---

window.deleteSample = function (classId, index, isWebcamOpen) {
    // Remove do TensorFlow
    classesData[classId][index].activation.dispose();

    // Remove do Array
    classesData[classId].splice(index, 1);

    // Atualiza a Tela
    if (isWebcamOpen) {
        // Se a câmera ta aberta, redesenha a grade vertical
        const grid = document.getElementById(`grid-${classId}`);
        grid.innerHTML = '';

        // Recria a lista visualmente com os índices novos
        classesData[classId].forEach((item, i) => {
            const visualItem = createThumbVisual(item.canvas, () => window.deleteSample(classId, i, true));
            grid.appendChild(visualItem);
        });

        document.getElementById(`count-${classId}`).innerText = `${classesData[classId].length} Amostras`;
    } else {
        // Se a câmera ta fechada, redesenha o card fechado (horizontal)
        renderSavedState(classId, `card-${classId}`);
    }
}


// --- 7. TREINAMENTO E PREDIÇÃO (NEURAL NETWORK) ---

const trainBtn = document.getElementById('trainBtn');
let isPredicting = false;
let model; // Modelo Neural

trainBtn.addEventListener('click', async () => {
    if (Object.keys(classesData).length < 2) {
        alert("Adicione pelo menos duas classes com exemplos!");
        return;
    }

    // Pega hiperparâmetros (Valores fixos para modo simplificado)
    const EPOCHS = 50;
    const BATCH_SIZE = 16;
    const LEARNING_RATE = 0.001;

    trainBtn.innerText = "Preparando Dados...";
    await new Promise(resolve => setTimeout(resolve, 100));

    // 1. Prepara Tensores (X = Features, y = Labels)
    const { xs, ys } = prepareTrainingData();

    if (!xs) {
        alert("Nenhuma imagem capturada!");
        trainBtn.innerText = "Treinar Modelo";
        return;
    }

    // 2. Cria Modelo Neural (Dense Layer)
    const numClasses = Object.keys(classesData).length;
    model = tf.sequential();

    // Entrada: 1024 features (saída do MobileNet 'conv_preds')
    model.add(tf.layers.dense({
        inputShape: [1024],
        units: 100,
        activation: 'relu'
    }));

    // Saída: Probabilidade por classe
    model.add(tf.layers.dense({
        units: numClasses,
        activation: 'softmax'
    }));

    // Compilação
    model.compile({
        optimizer: tf.train.adam(LEARNING_RATE),
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
    });

    // 3. Treina (Fit)
    trainBtn.innerText = "Treinando...";

    await model.fit(xs, ys, {
        batchSize: BATCH_SIZE,
        epochs: EPOCHS,
        shuffle: true,
        callbacks: {
            onEpochEnd: (epoch, logs) => {
                // Atualiza botão com progresso
                trainBtn.innerText = `Época ${epoch + 1}/${EPOCHS} - Perda: ${logs.loss.toFixed(4)}`;
            }
        }
    });

    // Limpa tensores de treino
    xs.dispose();
    ys.dispose();

    console.log("Modelo Treinado!");
    trainBtn.innerText = "Modelo Treinado!";
    trainBtn.classList.add('ready');

    // 4. Prepara predição
    startPrediction();
});


function prepareTrainingData() {
    return tf.tidy(() => {
        let allFeatures = [];
        let allLabels = [];
        let classIndex = 0;

        // Itera sobre as classes ordenadamente (0, 1, 2...)
        // IMPORTANTE: Garantir ordem consistente das chaves
        const sortedKeys = Object.keys(classesData).sort((a, b) => a - b);

        for (let id of sortedKeys) {
            const data = classesData[id]; // Array de {activation, canvas}
            data.forEach(item => {
                // Flatten: [1, 1024] -> [1024]
                const feature = item.activation.reshape([1024]);
                allFeatures.push(feature);
                allLabels.push(classIndex);
            });
            classIndex++;
        }

        if (allFeatures.length === 0) return { xs: null, ys: null };

        const xs = tf.stack(allFeatures);
        // One-hot encode labels: 0 -> [1, 0], 1 -> [0, 1]
        const numClasses = sortedKeys.length;
        const ys = tf.oneHot(tf.tensor1d(allLabels, 'int32'), numClasses);

        return { xs, ys };
    });
}

async function startPrediction() {
    isPredicting = true;

    // Mostra o vídeo de predição
    const previewContainer = document.getElementById('webcam-preview-container');
    previewContainer.style.display = 'block';

    const predVideo = document.getElementById('prediction-video');

    // Tenta usar o stream da webcam global se já estiver aberto, ou abre um novo
    // Tenta usar o stream da webcam global se já estiver aberto, ou abre um novo
    if (webcamElement.srcObject) {
        predVideo.srcObject = webcamElement.srcObject;
        await webcamElement.play(); // FORÇA O PLAY NO ELEMENTO OCULTO
    } else {
        // Abre webcam só para predição se não estiver aberta
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        predVideo.srcObject = stream;
        webcamElement.srcObject = stream; // Mantém referência global
        await webcamElement.play();
    }

    console.log("Vitor: Predição Iniciada! Webcam tocando:", !webcamElement.paused);

    // Gera as barrinhas de resultado
    createPredictionBars();

    // Inicia Loop
    predictLoop();
}

function createPredictionBars() {
    const container = document.getElementById('label-container');
    container.innerHTML = ""; // Limpa

    // Cria uma barra para cada classe existente
    // IMPORTANTE: Manter ordem ordena
    const sortedKeys = Object.keys(classesData).sort((a, b) => a - b);

    for (let classId of sortedKeys) {
        // Pega o nome atual do input
        const cardInputs = document.querySelectorAll(`#card-${classId} .class-name-input`);
        const name = cardInputs.length ? cardInputs[0].value : `Classe ${parseInt(classId) + 1}`;

        const div = document.createElement('div');
        div.className = 'label-item';
        div.innerHTML = `
            <div class="label-name">${name}</div>
            <div class="progress-bg">
                <div class="progress-fill" id="bar-${classId}"></div>
            </div>
            <div class="label-percent" id="percent-${classId}">0%</div>
        `;
        container.appendChild(div);
    }
}

// --- 10. TROCA DE PREVIEW (WEBCAM / ARQUIVO) ---

let previewMode = 'webcam';

window.setPreviewMode = function (mode) {
    previewMode = mode;

    // Atualiza visibilidade
    const vidContainer = document.getElementById('prediction-video');
    const fileContainer = document.getElementById('file-prediction-container');

    if (mode === 'webcam') {
        vidContainer.style.display = 'block';
        fileContainer.classList.add('hidden');
        fileContainer.classList.remove('flex');

        // Retoma loop se estiver prevendo
        if (isPredicting) {
            predictLoop();
        }
    } else {
        vidContainer.style.display = 'none';
        fileContainer.classList.remove('hidden');
        fileContainer.classList.add('flex');
        // O loop para automaticamente pois verificamos o modo dentro dele
    }
}

window.handlePredictionFile = function (input) {
    if (input.files && input.files[0]) {
        // Garante que as barras de predição existam
        createPredictionBars();

        const reader = new FileReader();
        reader.onload = function (e) {
            const img = document.getElementById('prediction-image');
            img.src = e.target.result;

            // UI Update: Show image, Hide Placeholder
            document.getElementById('file-placeholder').classList.add('hidden');
            document.getElementById('file-image-wrapper').classList.remove('hidden');

            img.onload = async () => {
                // Roda predição única na imagem carregada
                await predictSingle(img);
            };
        }
        reader.readAsDataURL(input.files[0]);
    }
}

// Limpar Imagem
window.clearPredictionImage = function (e) {
    if (e) e.stopPropagation(); // Evita abrir o upload de arquivo ao clicar no X

    const img = document.getElementById('prediction-image');
    img.src = "";

    // UI Update: Hide image, Show Placeholder
    document.getElementById('file-placeholder').classList.remove('hidden');
    document.getElementById('file-image-wrapper').classList.add('hidden');

    // Reset input value to allow selecting same file
    document.getElementById('predict-file-input').value = '';

    // Limpa barras de predição (Visualmente)
    const container = document.getElementById('label-container');

    // Se as barras existirem, apenas zera. Se não, restaura mensagem padrão.
    const bars = container.querySelectorAll('.progress-fill');
    if (bars.length > 0) {
        bars.forEach(b => b.style.width = '0%');
        const labels = container.querySelectorAll('.label-percent');
        labels.forEach(l => l.innerText = '0%');
        const backgrounds = container.querySelectorAll('.progress-fill');
        backgrounds.forEach(b => b.style.background = '#4361ee'); // Volta cor padrão
    } else {
        container.innerHTML = `
            <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                 <p class="text-slate-400 text-sm font-bold animate-pulse">Aguardando você testar...</p>
            </div>
        `;
    }
}

// Refatoração da Predição Principal
async function predictLoop() {
    if (!isPredicting) return;

    // Se mudou para arquivo, para o loop
    if (previewMode === 'file') return;

    if (webcamElement.readyState === 4) {
        // Usa a webcam global
        await predict(webcamElement);
    }

    requestAnimationFrame(predictLoop);
}

// Predição Única (para arquivos)
async function predictSingle(imageElement) {
    if (!model) return;
    await predict(imageElement);
}

// Núcleo da Predição (Genérico)
async function predict(sourceElement) {
    return tf.tidy(() => {
        // 1. Features
        const imgTensor = tf.browser.fromPixels(sourceElement);
        // Resize deve ser feito pelo navegador/css mas garantimos aqui se necessário, 
        // mas o mobilenet aceita tamanhos e faz o resize interno ou espera 224?
        // O `net.infer` espera imagem. Se for diferente de 224x224, convém redimensionar.
        // Vamos forçar resize para garantir (importante para arquivos enviados)
        const resized = tf.image.resizeBilinear(imgTensor, [224, 224]);

        const activation = net.infer(resized, 'conv_preds');

        // 2. Predição Neural
        const predictions = model.predict(activation);

        // 3. Pega dados
        const confidences = predictions.dataSync(); // Array Float32

        // 4. Mapeia índices
        const sortedKeys = Object.keys(classesData).sort((a, b) => a - b);

        const result = {};
        confidences.forEach((score, i) => {
            const realClassId = sortedKeys[i];
            if (realClassId !== undefined) {
                result[realClassId] = score;
            }
        });

        updatePredictionUI(result);
    });
}

function updatePredictionUI(confidences) {
    // confidences é um objeto mapeado: { "0": 0.8, "5": 0.2 }
    for (let classId in confidences) {
        const score = confidences[classId]; // 0.0 a 1.0
        const percent = (score * 100).toFixed(0) + "%";

        const bar = document.getElementById(`bar-${classId}`);
        const txt = document.getElementById(`percent-${classId}`);

        if (bar) bar.style.width = percent;
        if (txt) txt.innerText = percent;

        // Opcional: Destacar a vencedora
        if (score > 0.8) {
            if (bar) bar.style.background = "#4caf50"; // Verde
        } else {
            if (bar) bar.style.background = "var(--primary-color)"; // Azul padrão
        }
    }
}

// --- 8. LINHAS CONECTORAS DINÂMICAS ---

window.updateConnectors = function () {
    const svg = document.getElementById('connections-svg');
    if (!svg) return;

    // Limpa linhas atuais
    svg.innerHTML = '';

    const trainCard = document.getElementById('train-card');
    if (!trainCard) return;

    const trainRect = trainCard.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();

    // Ponto Central do Treinamento (Alvo das Classes)
    const trainLeftX = trainRect.left - svgRect.left;
    const trainRightX = trainRect.right - svgRect.left;
    const trainCenterY = (trainRect.top + trainRect.height / 2) - svgRect.top;

    // 1. Desenha conexões das Classes -> Treinamento
    const classCards = document.querySelectorAll('.class-card');
    const colors = ['#fca311', '#06d6a0', '#4361ee', '#3a0ca3']; // Palette PiCode: Amarelo, Verde, Azul...

    classCards.forEach((card, index) => {
        const cardRect = card.getBoundingClientRect();

        // Ponto de Saída da Classe (Lado Direito)
        const startX = cardRect.right - svgRect.left;
        const startY = (cardRect.top + cardRect.height / 2) - svgRect.top;

        // Cor da linha
        const color = colors[index % colors.length];

        // Cria o path curve (Bezier)
        // Control Point 1: Sai um pouco pra direita
        const cp1x = startX + 50;
        const cp1y = startY;

        // Control Point 2: Chega pela esquerda
        const cp2x = trainLeftX - 50;
        const cp2y = trainCenterY;

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        const d = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${trainLeftX} ${trainCenterY}`;

        path.setAttribute("d", d);
        path.setAttribute("fill", "transparent");
        path.setAttribute("stroke", color);
        path.setAttribute("stroke-width", "3");
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("class", "connector-line");

        // Estilo: Pontilhado animado ou sólido? Vamos de sólido com bolinha na ponta para ser bem visível
        // path.setAttribute("stroke-dasharray", "10, 5");
        path.setAttribute("opacity", "0.6"); // Opacidade na própria linha

        // Adiciona ao SVG
        svg.appendChild(path);

        // Adiciona bolinha nas pontas (no card)
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", startX);
        circle.setAttribute("cy", startY);
        circle.setAttribute("r", "5");
        circle.setAttribute("fill", color);
        svg.appendChild(circle);
    });

    // 2. Desenha conexão Treinamento -> Teste (Aparece se treinado)
    const previewContainer = document.getElementById('webcam-preview-container');

    if (previewContainer) {
        const targetRect = previewContainer.getBoundingClientRect();

        const endX = targetRect.left - svgRect.left;
        const endY = (targetRect.top + targetRect.height / 2) - svgRect.top;

        // Se treinado, linha sólida e colorida. Se não, cinza pontilhada.
        const isTrained = trainBtn.classList.contains('ready');
        const lineColor = isTrained ? '#4361ee' : '#cbd5e1';
        const strokeWidth = isTrained ? "4" : "2";

        const path2 = document.createElementNS("http://www.w3.org/2000/svg", "path");

        // Curva saindo da direita do treino e entrando na esquerda do teste
        const cp3x = trainRightX + 50;
        const cp3y = trainCenterY;
        const cp4x = endX - 50;
        const cp4y = endY;

        const d2 = `M ${trainRightX} ${trainCenterY} C ${cp3x} ${cp3y}, ${cp4x} ${cp4y}, ${endX} ${endY}`;

        path2.setAttribute("d", d2);
        path2.setAttribute("fill", "transparent");
        path2.setAttribute("stroke", lineColor);
        path2.setAttribute("stroke-width", strokeWidth);
        path2.setAttribute("stroke-linecap", "round");

        if (!isTrained) {
            path2.setAttribute("stroke-dasharray", "8, 8"); // Pontilhado mais largo
            path2.setAttribute("opacity", "0.4");
        } else {
            path2.setAttribute("opacity", "1");
            // Animação manual via JS ou CSS class se necessário
        }

        svg.appendChild(path2);
    }
}

// Listener global para resize
window.addEventListener('resize', () => {
    requestAnimationFrame(updateConnectors);
});

// Listener para scroll (Container Principal)
const mainContent = document.querySelector('.overflow-y-auto');
if (mainContent) {
    mainContent.addEventListener('scroll', () => requestAnimationFrame(updateConnectors));
}

// Chama atualização inicial com delay para garantir layout
setTimeout(updateConnectors, 200);
setTimeout(updateConnectors, 1000);

// --- 9. EXPORTAR MODELO ---

const exportBtn = document.getElementById('exportBtn');

if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
        if (!model) {
            alert("Você precisa treinar o modelo antes de exportar!");
            return;
        }

        try {
            // Salva o modelo (JSON + Pesos)
            // O browser fará o download de dois arquivos:
            // 1. my-model.json (topologia)
            // 2. my-model.weights.bin (pesos)
            await model.save('downloads://teachable-machine-model');
            alert("Download iniciado! Verifique 'teachable-machine-model.json' e '.bin'");
        } catch (error) {
            console.error("Erro ao exportar:", error);
            alert("Erro ao exportar modelo. Veja o console.");
        }
    });
}