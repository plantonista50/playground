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
    console.log("✅ Script Carregado com Sucesso v3.1 (Gemini Fix)");

    // ============================================================
    // 1. CONFIGURAÇÕES
    // ============================================================
    const BASE_URL = "https://plantonista50-playground-n8n.zvu2si.easypanel.host";
    const AUTH_WEBHOOK = BASE_URL + "/webhook/suga-auth";
    const PRONTUARIO_WEBHOOK = BASE_URL + "/webhook/cfadce39-4d13-4a1e-ac7d-24ed345a5e9c";
    const EXAMINATOR_WEBHOOK = BASE_URL + "/webhook/processar-exame";
    // ATENÇÃO: Verifique se este endpoint do Chat está correto com seu novo fluxo do Gemini
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
        // Adicionando ferramenta de chat caso esteja usando
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
            console.log("🔄 Iniciando tentativa de login...");

            const emailEl = document.getElementById('email');
            const passEl = document.getElementById('password');
            const btn = loginForm.querySelector('button');
            
            if (!emailEl || !passEl) {
                alert("Erro: Campos de email ou senha não encontrados no HTML.");
                return;
            }

            const originalText = btn.textContent;
            btn.textContent = "Autenticando...";
            btn.disabled = true;

            try {
                const payload = { 
                    action: 'login', 
                    email: emailEl.value.trim(), 
                    password: passEl.value 
                };

                console.log("📡 Enviando requisição para:", AUTH_WEBHOOK);
                const response = await fetch(AUTH_WEBHOOK, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                // Tratamento Defensivo de JSON no Login
                const textData = await response.text();
                let data;
                try {
                    data = textData ? JSON.parse(textData) : {};
                } catch (err) {
                    console.error("Erro JSON Login:", textData);
                    throw new Error("Servidor retornou resposta inválida.");
                }

                if (!response.ok) {
                    throw new Error("Erro HTTP: " + response.status);
                }

                if (Array.isArray(data)) data = data[0];

                if (data && data.access_token) {
                    currentUser = { email: data.user.email, token: data.access_token };
                    
                    let displayName = "MD";
                    if (data.user.user_metadata && data.user.user_metadata.full_name) {
                        displayName = data.user.user_metadata.full_name;
                    }
                    if (userInitialsDisplay) {
                        userInitialsDisplay.textContent = displayName.substring(0,2).toUpperCase();
                        userInitialsDisplay.style.backgroundColor = '#4caf50';
                    }

                    if (loginScreen) {
                        loginScreen.style.opacity = '0';
                        setTimeout(() => { loginScreen.style.display = 'none'; }, 500);
                    }
                } else {
                    const errorMsg = data.msg || data.message || "Email ou senha incorretos.";
                    alert("Acesso Negado: " + errorMsg);
                }

            } catch (err) {
                console.error("❌ Erro no Login:", err);
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
        const type = params.get('type'); 

        if (accessToken) {
            currentUser = { email: "Verificado", token: accessToken };
            window.history.replaceState(null, null, window.location.pathname);

            const forgotModal = document.getElementById('forgot-modal');
            const forgotStep1 = document.getElementById('forgot-step-1');
            const forgotStep2 = document.getElementById('forgot-step-2');

            if (type === 'recovery') {
                alert("🔔 Link aceito! Agora defina sua nova senha.");
                if(loginScreen) loginScreen.style.display = 'none';
                if(forgotModal) forgotModal.style.display = 'flex';
                if(forgotStep1) forgotStep1.style.display = 'none';
                if(forgotStep2) forgotStep2.style.display = 'block';
            } else {
                alert("✅ Login automático realizado!");
                if(loginScreen) loginScreen.style.display = 'none';
                if(userInitialsDisplay) userInitialsDisplay.style.backgroundColor = '#4caf50';
            }
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
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    throw new Error("Navegador incompatível ou sem HTTPS.");
                }
                if (typeof RecordRTC === 'undefined') {
                    throw new Error("RecordRTC não carregou.");
                }

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
                console.error("Erro Mic:", e);
                alert("Erro ao acessar microfone: " + e.message);
            }
        });
    }

    // ============================================================
    // 5. UPLOAD E CHAT (AQUI ESTÁ A CORREÇÃO CRÍTICA)
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
        chatInput.addEventListener('keydown', e => { 
            if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } 
        });
        chatInput.addEventListener('input', function() { 
            this.style.height = 'auto'; 
            this.style.height = (this.scrollHeight) + 'px'; 
            if(this.value==='') this.style.height='auto'; 
        });
    }

    // --- FUNÇÃO HANDLESEND CORRIGIDA ---
    async function handleSend() {
        if (isRecording) { 
            btnMic.click(); 
            setTimeout(handleSend, 500); 
            return;
        }
        
        const text = chatInput ? chatInput.value.trim() : "";
        if (!text && selectedFiles.length === 0) return;
        if(welcomeScreen) welcomeScreen.style.display = 'none';
        
        // 1. UI: Mensagem do Usuário
        const wrapper = document.createElement('div'); wrapper.className = 'message-wrapper user';
        let html = selectedFiles.map(f => `<div style="font-size:0.8rem;color:#a8c7fa;margin-bottom:4px">📎 ${f.name}</div>`).join('');
        if(text) html += `<div>${text.replace(/\n/g,'<br>')}</div>`;
        wrapper.innerHTML = `<div class="message-content">${html}</div><div class="avatar-icon user">VC</div>`;
        chatHistory.appendChild(wrapper);
        
        if(chatInput) { chatInput.value = ''; chatInput.style.height = 'auto'; }
        const filesToSend = [...selectedFiles]; 
        resetFileInput();
        
        // 2. UI: Loader
        const ldId = 'ld-'+Date.now();
        const ldDiv = document.createElement('div'); ldDiv.className = 'message-wrapper ai'; ldDiv.id = ldId;
        ldDiv.innerHTML = `<div class="avatar-icon ai"><span class="material-symbols-outlined">smart_toy</span></div><div class="message-content">...</div>`;
        chatHistory.appendChild(ldDiv);
        chatHistory.scrollTop = chatHistory.scrollHeight;

        // 3. Preparação do Envio
        const formData = new FormData();
        filesToSend.forEach((f, i) => formData.append("file_" + i, f));
        if(text) formData.append('textoBruto', text);
        const userEmail = currentUser ? currentUser.email : "anonimo_erro";
        formData.append('user_email', userEmail);
        
        // Para o Chat, adicionamos IDs de sessão se necessário
        if (currentTool === 'brainstorm') {
            formData.append('user_message', text);
            // Idealmente gerar um session_id fixo por conversa, aqui um simples para teste
            formData.append('session_id', 'sessao_' + userEmail); 
        }

        try {
            console.log("Enviando para:", TOOLS[currentTool].webhook);
            const res = await fetch(TOOLS[currentTool].webhook, { method: 'POST', body: formData });
            
            // --- CORREÇÃO CRÍTICA AQUI: LER COMO TEXTO PRIMEIRO ---
            const rawText = await res.text();
            console.log("Resposta Bruta do Servidor:", rawText);

            if (!res.ok) {
                throw new Error(`Erro HTTP ${res.status}: ${rawText.substring(0, 100)}...`);
            }

            let data = {};
            try {
                // Tenta converter se não estiver vazio
                if (rawText.trim()) {
                    data = JSON.parse(rawText);
                } else {
                    throw new Error("Resposta vazia do n8n");
                }
            } catch (jsonErr) {
                console.warn("Falha no parse JSON. Usando texto bruto.");
                // Se falhar o JSON, tenta usar o texto bruto como resposta (fallback)
                data = { message: rawText };
            }

            // Normaliza a resposta da IA (Vários nós retornam campos diferentes)
            const aiText = data.reply || data.message || data.msg || data.resumoCompleto || data.text || data.output || JSON.stringify(data);
            
            // 4. UI: Exibe Resposta
            const loader = document.getElementById(ldId);
            if(loader) loader.remove();

            const aiWrapper = document.createElement('div'); aiWrapper.className = 'message-wrapper ai';
            aiWrapper.innerHTML = `<div class="avatar-icon ai"><span class="material-symbols-outlined">smart_toy</span></div><div class="message-content"><pre>${aiText}</pre><div style="text-align:right"><span class="material-symbols-outlined" style="cursor:pointer;color:#666" onclick="copyText(this)">content_copy</span></div></div>`;
            chatHistory.appendChild(aiWrapper);

        } catch (e) {
            console.error(e);
            const loader = document.getElementById(ldId);
            if(loader) loader.remove();
            
            const errDiv = document.createElement('div'); errDiv.className = 'message-wrapper ai';
            errDiv.innerHTML = `<div class="avatar-icon ai">⚠️</div><div class="message-content"><strong>Erro:</strong> ${e.message}<br><small>Verifique se o n8n está ativo e o nó 'Respond to Webhook' configurado corretamente.</small></div>`;
            chatHistory.appendChild(errDiv);
        }
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    // Função Global de Cópia
    window.copyText = function(btn) {
        const pre = btn.closest('.message-content').querySelector('pre');
        navigator.clipboard.writeText(pre.textContent).then(() => { btn.style.color='#4caf50'; setTimeout(()=>btn.style.color='#666',2000); });
    };

    // ============================================================
    // 6. MENU E TEMA
    // ============================================================
    const linkSignup = document.getElementById('link-signup');
    const linkForgot = document.getElementById('link-forgot');
    const signupModal = document.getElementById('signup-modal');
    const forgotModal = document.getElementById('forgot-modal');
    
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            if(signupModal) signupModal.style.display='none';
            if(forgotModal) forgotModal.style.display='none';
        });
    });

    if(linkSignup) linkSignup.addEventListener('click', (e) => { e.preventDefault(); if(signupModal) signupModal.style.display = 'flex'; });
    if(linkForgot) linkForgot.addEventListener('click', (e) => { e.preventDefault(); if(forgotModal) forgotModal.style.display = 'flex'; });

    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const desktopMenuToggle = document.getElementById('desktop-sidebar-toggle');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const themeBtn = document.getElementById('theme-toggle-btn');
    const navItems = document.querySelectorAll('.nav-item[data-tool]');
    const btnNewChat = document.getElementById('btn-new-chat');
    const mainTitle = document.getElementById('main-title');

    function toggleMobileMenu() { 
        if(sidebar) sidebar.classList.toggle('mobile-open'); 
        if(sidebarOverlay) sidebarOverlay.classList.toggle('active'); 
    }
    
    if(mobileMenuBtn) mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    if(sidebarOverlay) sidebarOverlay.addEventListener('click', toggleMobileMenu);
    if(desktopMenuToggle) desktopMenuToggle.addEventListener('click', () => sidebar.classList.toggle('collapsed'));

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            currentTool = item.getAttribute('data-tool');
            if(mainTitle) mainTitle.textContent = TOOLS[currentTool].title;
            if(chatInput) chatInput.placeholder = TOOLS[currentTool].placeholder;
            if(window.innerWidth <= 768) toggleMobileMenu();
            
            if(chatHistory) {
                chatHistory.querySelectorAll('.message-wrapper').forEach(m => m.remove());
                if(welcomeScreen) welcomeScreen.style.display = 'block';
            }
        });
    });

    if(btnNewChat) {
        btnNewChat.addEventListener('click', () => {
            if(chatHistory) chatHistory.querySelectorAll('.message-wrapper').forEach(m => m.remove());
            if(welcomeScreen) welcomeScreen.style.display = 'block';
            resetFileInput();
        });
    }

    if(themeBtn) {
        themeBtn.addEventListener('click', () => {
            document.body.classList.toggle('xmas-mode');
        });
    }
});
