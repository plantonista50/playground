// --- AUTO-DIAGNÓSTICO DE ERROS (Removemos isso em produção) ---
window.onerror = function (msg, url, lineNo, columnNo, error) {
    const string = msg.toLowerCase();
    const substring = "script error";
    if (string.indexOf(substring) > -1) {
        alert('Script Error: Verifique o Console (F12) para detalhes.');
    } else {
        console.error("Erro Detectado:", msg, "Linha:", lineNo);
    }
    return false;
};

document.addEventListener('DOMContentLoaded', () => {
    console.log("✅ Script Carregado com Sucesso v3.2 (Object Fix)");

    // ============================================================
    // 1. CONFIGURAÇÕES
    // ============================================================
    const BASE_URL = "https://plantonista50-playground-n8n.zvu2si.easypanel.host";
    const AUTH_WEBHOOK = BASE_URL + "/webhook/suga-auth";
    const PRONTUARIO_WEBHOOK = BASE_URL + "/webhook/cfadce39-4d13-4a1e-ac7d-24ed345a5e9c";
    const EXAMINATOR_WEBHOOK = BASE_URL + "/webhook/processar-exame";
    const CHAT_WEBHOOK = BASE_URL + "/webhook/suga-chat-secure"; 

    const TOOLS = {
        prontuario: { 
            title: "SuGa PRONTUÁRIO", 
            webhook: PRONTUARIO_WEBHOOK, 
            placeholder: "Digite a transcrição do áudio ou a história coletada..." 
        },
        examinator: { 
            title: "SuGa EXAMINATOR", 
            webhook: EXAMINATOR_WEBHOOK, 
            placeholder: "Anexe os exames (PDF/Imagem) para análise..." 
        },
        brainstorm: {
            title: "SuGa BRAINSTORM",
            webhook: CHAT_WEBHOOK,
            placeholder: "Discuta casos clínicos com o Gemini..."
        }
    };

    // Variáveis de Estado
    let currentTool = 'prontuario'; 
    let selectedFiles = []; 
    let currentUser = null;
    let recorder = null; 
    let isRecording = false;

    // Elementos DOM
    const loginScreen = document.getElementById('login-screen');
    const loginForm = document.getElementById('login-form');
    const userInitialsDisplay = document.getElementById('user-initials');
    
    // ============================================================
    // 2. SISTEMA DE LOGIN
    // ============================================================
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const emailEl = document.getElementById('email');
            const passEl = document.getElementById('password');
            const btn = loginForm.querySelector('button');
            
            const originalText = btn.textContent;
            btn.textContent = "Autenticando...";
            btn.disabled = true;

            try {
                const response = await fetch(AUTH_WEBHOOK, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        action: 'login', 
                        email: emailEl.value.trim(), 
                        password: passEl.value 
                    })
                });

                const textData = await response.text();
                let data = {};
                try { data = textData ? JSON.parse(textData) : {}; } catch (e) {}

                if (!response.ok) throw new Error(data.message || "Erro HTTP " + response.status);
                if (Array.isArray(data)) data = data[0];

                if (data && data.access_token) {
                    currentUser = { email: data.user.email, token: data.access_token };
                    let displayName = data.user.user_metadata?.full_name || "MD";
                    if (userInitialsDisplay) {
                        userInitialsDisplay.textContent = displayName.substring(0,2).toUpperCase();
                        userInitialsDisplay.style.backgroundColor = '#4caf50';
                    }
                    if (loginScreen) {
                        loginScreen.style.opacity = '0';
                        setTimeout(() => { loginScreen.style.display = 'none'; }, 500);
                    }
                } else {
                    alert("Acesso Negado: " + (data.msg || data.message || "Credenciais inválidas"));
                }
            } catch (err) {
                alert("Erro de Conexão: " + err.message);
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        });
    }

    // ============================================================
    // 3. LÓGICA DE URL MÁGICA
    // ============================================================
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
        const params = new URLSearchParams(hash.substring(1)); 
        const accessToken = params.get('access_token');
        if (accessToken) {
            currentUser = { email: "Verificado", token: accessToken };
            window.history.replaceState(null, null, window.location.pathname);
            alert("✅ Login automático realizado!");
            if(loginScreen) loginScreen.style.display = 'none';
        }
    }

    // ============================================================
    // 4. MICROFONE
    // ============================================================
    const btnMic = document.getElementById('btn-mic');
    const chatInput = document.getElementById('chat-input');

    if (btnMic) {
        btnMic.addEventListener('click', async () => {
            if (isRecording) {
                if (recorder) {
                    recorder.stopRecording(() => {
                        const blob = recorder.getBlob();
                        const file = new File([blob], "gravacao_" + Date.now() + ".wav", { type: 'audio/wav' });
                        selectedFiles.push(file);
                        renderFileList();
                        isRecording = false;
                        btnMic.classList.remove('recording');
                        btnMic.querySelector('span').textContent = 'mic';
                        if(chatInput) chatInput.placeholder = TOOLS[currentTool].placeholder;
                        recorder.camera.stop();
                        recorder = null;
                    });
                }
                return;
            }
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                recorder = new RecordRTC(stream, {
                    type: 'audio', mimeType: 'audio/wav',
                    recorderType: RecordRTC.StereoAudioRecorder,
                    numberOfAudioChannels: 1, desiredSampRate: 16000
                });
                recorder.startRecording();
                isRecording = true;
                btnMic.classList.add('recording');
                btnMic.querySelector('span').textContent = 'stop_circle';
                if(chatInput) chatInput.placeholder = "Gravando... (Clique para parar)";
            } catch (e) {
                alert("Erro Mic: " + e.message);
            }
        });
    }

    // ============================================================
    // 5. UPLOAD E CHAT (CORE)
    // ============================================================
    const btnSend = document.getElementById('btn-send');
    const btnAttachment = document.getElementById('btn-attachment');
    const hiddenFileInput = document.getElementById('hidden-file-input');
    const fileListContainer = document.getElementById('file-list-container');
    const chatHistory = document.getElementById('chat-history');
    const welcomeScreen = document.getElementById('welcome-screen');

    if(btnAttachment) btnAttachment.addEventListener('click', () => hiddenFileInput.click());
    if(hiddenFileInput) {
        hiddenFileInput.addEventListener('change', (e) => { 
            selectedFiles = [...selectedFiles, ...Array.from(e.target.files)].slice(0, 10); 
            renderFileList(); 
            hiddenFileInput.value = ''; 
        });
    }

    function renderFileList() {
        if(!fileListContainer) return;
        fileListContainer.innerHTML = '';
        fileListContainer.style.display = selectedFiles.length ? 'flex' : 'none';
        selectedFiles.forEach((file, index) => {
            const chip = document.createElement('div'); chip.className = 'file-chip';
            const icon = (file.type.includes('audio') || file.name.endsWith('.wav')) ? 'mic' : 'description';
            chip.innerHTML = `<span class="material-symbols-outlined" style="font-size:1.1rem">${icon}</span> <span class="file-name">${file.name}</span> <button class="remove-btn" onclick="removeFile(${index})">&times;</button>`;
            fileListContainer.appendChild(chip);
        });
        window.removeFile = idx => { selectedFiles.splice(idx, 1); renderFileList(); };
    }
    function resetFileInput() { selectedFiles = []; renderFileList(); }

    if(btnSend) btnSend.addEventListener('click', handleSend);
    if(chatInput) {
        chatInput.addEventListener('keydown', e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } });
        chatInput.addEventListener('input', function() { this.style.height = 'auto'; this.style.height = (this.scrollHeight) + 'px'; });
    }

    // --- FUNÇÃO HANDLESEND (CORREÇÃO [object Object]) ---
    async function handleSend() {
        if (isRecording) { btnMic.click(); setTimeout(handleSend, 500); return; }
        
        const text = chatInput ? chatInput.value.trim() : "";
        if (!text && selectedFiles.length === 0) return;
        if(welcomeScreen) welcomeScreen.style.display = 'none';
        
        // UI User
        const wrapper = document.createElement('div'); wrapper.className = 'message-wrapper user';
        let html = selectedFiles.map(f => `<div style="font-size:0.8rem;color:#a8c7fa;margin-bottom:4px">📎 ${f.name}</div>`).join('');
        if(text) html += `<div>${text.replace(/\n/g,'<br>')}</div>`;
        wrapper.innerHTML = `<div class="message-content">${html}</div><div class="avatar-icon user">VC</div>`;
        chatHistory.appendChild(wrapper);
        
        if(chatInput) { chatInput.value = ''; chatInput.style.height = 'auto'; }
        const filesToSend = [...selectedFiles]; resetFileInput();
        
        // UI Loader
        const ldId = 'ld-'+Date.now();
        const ldDiv = document.createElement('div'); ldDiv.className = 'message-wrapper ai'; ldDiv.id = ldId;
        ldDiv.innerHTML = `<div class="avatar-icon ai"><span class="material-symbols-outlined">smart_toy</span></div><div class="message-content">...</div>`;
        chatHistory.appendChild(ldDiv);
        chatHistory.scrollTop = chatHistory.scrollHeight;

        const formData = new FormData();
        filesToSend.forEach((f, i) => formData.append("file_" + i, f));
        if(text) formData.append('textoBruto', text);
        formData.append('user_email', currentUser ? currentUser.email : "anonimo_erro");
        if (currentTool === 'brainstorm') { formData.append('user_message', text); }

        try {
            const res = await fetch(TOOLS[currentTool].webhook, { method: 'POST', body: formData });
            const rawText = await res.text();
            
            let data = {};
            try { data = rawText ? JSON.parse(rawText) : {}; } 
            catch (e) { data = { message: rawText }; } // Se não for JSON, usa o texto puro

            // SELEÇÃO INTELIGENTE DO TEXTO DA IA
            let aiText = data.reply || data.message || data.msg || data.resumoCompleto || data.text || data.output || data;
            
            // CORREÇÃO CRÍTICA: Se for um Objeto, transforma em String bonita
            if (typeof aiText === 'object') {
                aiText = JSON.stringify(aiText, null, 2);
            }

            const loader = document.getElementById(ldId);
            if(loader) loader.remove();

            const aiWrapper = document.createElement('div'); aiWrapper.className = 'message-wrapper ai';
            aiWrapper.innerHTML = `<div class="avatar-icon ai"><span class="material-symbols-outlined">smart_toy</span></div><div class="message-content"><pre>${aiText}</pre><div style="text-align:right"><span class="material-symbols-outlined" style="cursor:pointer;color:#666" onclick="copyText(this)">content_copy</span></div></div>`;
            chatHistory.appendChild(aiWrapper);

        } catch (e) {
            const loader = document.getElementById(ldId);
            if(loader) loader.remove();
            const errDiv = document.createElement('div'); errDiv.className = 'message-wrapper ai';
            errDiv.innerHTML = `<div class="avatar-icon ai">⚠️</div><div class="message-content">Erro: ${e.message}</div>`;
            chatHistory.appendChild(errDiv);
        }
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    window.copyText = function(btn) {
        const pre = btn.closest('.message-content').querySelector('pre');
        navigator.clipboard.writeText(pre.textContent).then(() => { btn.style.color='#4caf50'; setTimeout(()=>btn.style.color='#666',2000); });
    };

    // 6. MENU (Código original mantido para brevidade, funcionamento padrão)
    const sidebar = document.getElementById('sidebar');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const navItems = document.querySelectorAll('.nav-item[data-tool]');
    const themeBtn = document.getElementById('theme-toggle-btn');
    const btnNewChat = document.getElementById('btn-new-chat');

    if(mobileMenuBtn) mobileMenuBtn.addEventListener('click', () => sidebar.classList.toggle('mobile-open'));
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            currentTool = item.getAttribute('data-tool');
            if(chatHistory) { chatHistory.innerHTML = ''; welcomeScreen.style.display = 'block'; }
        });
    });
    if(btnNewChat) btnNewChat.addEventListener('click', () => { if(chatHistory) chatHistory.innerHTML = ''; welcomeScreen.style.display = 'block'; });

    // ============================================================
    // 7. EFEITO DE NEVE (XMAS MODE)
    // ============================================================
    let snowInterval;
    function startSnowfall() {
        let overlay = document.querySelector('.snow-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'snow-overlay';
            overlay.setAttribute('aria-hidden', 'true');
            document.body.appendChild(overlay);
        }

        // Cria um floco a cada 100ms
        snowInterval = setInterval(() => {
            const flake = document.createElement('div');
            flake.classList.add('snow-flake');
            flake.style.left = Math.random() * 100 + 'vw';
            flake.style.animationDuration = (Math.random() * 3 + 2) + 's'; // 2 a 5 segundos
            flake.style.opacity = Math.random();
            const size = Math.random() * 5 + 5; // 5 a 10px
            flake.style.width = size + 'px';
            flake.style.height = size + 'px';
            flake.style.animationName = 'fall-js'; // Nome da animação no CSS

            overlay.appendChild(flake);

            // Remove o elemento após a animação
            setTimeout(() => { flake.remove(); }, 5000);
        }, 100);
    }

    function stopSnowfall() {
        clearInterval(snowInterval);
        const overlay = document.querySelector('.snow-overlay');
        if (overlay) overlay.innerHTML = '';
    }

    if(themeBtn) themeBtn.addEventListener('click', () => {
        document.body.classList.toggle('xmas-mode');
        if (document.body.classList.contains('xmas-mode')) {
            startSnowfall();
        } else {
            stopSnowfall();
        }
    });
});
