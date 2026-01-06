// --- AUTO-DIAGNÓSTICO DE ERROS (Removemos isso em produção) ---
window.onerror = function (msg, url, lineNo, columnNo, error) {
    const string = msg.toLowerCase();
    const substring = "script error";
    if (string.indexOf(substring) > -1) {
        alert('Script Error: Verifique o Console (F12) para detalhes.');
    } else {
        console.error("Erro Detectado:", msg, "Linha:", lineNo);
        // Descomente a linha abaixo se quiser ver o erro na tela:
        // alert("Erro no Script: " + msg + "\nLinha: " + lineNo);
    }
    return false;
};

document.addEventListener('DOMContentLoaded', () => {
    console.log("✅ Script Carregado com Sucesso v3.0 (Diagnóstico)");

    // ============================================================
    // 1. CONFIGURAÇÕES
    // ============================================================
    // Usando concatenação simples (+) para máxima compatibilidade
    const BASE_URL = "https://plantonista50-playground-n8n.zvu2si.easypanel.host";
    const AUTH_WEBHOOK = BASE_URL + "/webhook/suga-auth";
    const PRONTUARIO_WEBHOOK = BASE_URL + "/webhook/cfadce39-4d13-4a1e-ac7d-24ed345a5e9c";
    const EXAMINATOR_WEBHOOK = BASE_URL + "/webhook/processar-exame";

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
    };

    // Variáveis de Estado
    let currentTool = 'prontuario'; 
    let selectedFiles = []; 
    let currentUser = null;
    let recorder = null; 
    let isRecording = false;

    // Elementos DOM (com verificação de segurança)
    const loginScreen = document.getElementById('login-screen');
    const loginForm = document.getElementById('login-form');
    const userInitialsDisplay = document.getElementById('user-initials');
    
    // ============================================================
    // 2. SISTEMA DE LOGIN (Recuperado)
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
                // 1. Monta os dados
                const payload = { 
                    action: 'login', 
                    email: emailEl.value.trim(), 
                    password: passEl.value 
                };

                // 2. Envia para o n8n
                console.log("📡 Enviando requisição para:", AUTH_WEBHOOK);
                const response = await fetch(AUTH_WEBHOOK, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                // 3. Trata a resposta
                if (!response.ok) {
                    throw new Error("Erro HTTP: " + response.status);
                }

                let data = await response.json();
                if (Array.isArray(data)) data = data[0]; // Trata retorno de lista do n8n

                console.log("📥 Resposta recebida:", data);

                // 4. Verifica sucesso
                if (data && data.access_token) {
                    // SUCESSO!
                    currentUser = { email: data.user.email, token: data.access_token };
                    
                    // Atualiza UI
                    let displayName = "MD";
                    if (data.user.user_metadata && data.user.user_metadata.full_name) {
                        displayName = data.user.user_metadata.full_name;
                    }
                    if (userInitialsDisplay) {
                        userInitialsDisplay.textContent = displayName.substring(0,2).toUpperCase();
                        userInitialsDisplay.style.backgroundColor = '#4caf50';
                    }

                    // Esconde Login
                    if (loginScreen) {
                        loginScreen.style.opacity = '0';
                        setTimeout(() => { loginScreen.style.display = 'none'; }, 500);
                    }
                } else {
                    // ERRO DE NEGÓCIO (Senha errada, etc)
                    const errorMsg = data.msg || data.message || "Email ou senha incorretos.";
                    alert("Acesso Negado: " + errorMsg);
                }

            } catch (err) {
                console.error("❌ Erro no Login:", err);
                alert("Erro de Conexão: " + err.message + "\nVerifique se o n8n está ativo.");
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        });
    } else {
        console.error("⚠️ ERRO CRÍTICO: Formulário de login (id='login-form') não encontrado!");
    }

    // ============================================================
    // 3. LÓGICA DE URL MÁGICA (Recuperação de Senha)
    // ============================================================
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
        console.log("🔗 Token de acesso detectado na URL");
        const params = new URLSearchParams(hash.substring(1)); 
        const accessToken = params.get('access_token');
        const type = params.get('type'); 

        if (accessToken) {
            currentUser = { email: "Verificado", token: accessToken };
            window.history.replaceState(null, null, window.location.pathname); // Limpa URL

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
    // 4. MICROFONE (Corrigido e Diagnosticado)
    // ============================================================
    const btnMic = document.getElementById('btn-mic');
    const chatInput = document.getElementById('chat-input');

    if (btnMic) {
        btnMic.addEventListener('click', async () => {
            // Parar gravação
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

            // Iniciar gravação
            try {
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    throw new Error("Navegador incompatível ou sem HTTPS.");
                }
                if (typeof RecordRTC === 'undefined') {
                    throw new Error("RecordRTC não carregou. Verifique o index.html.");
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
                let msg = "Erro técnico: " + (e.message || e.name);
                if (e.name === 'NotAllowedError' || e.message.includes('Permission denied')) {
                    msg = "🚫 Permissão negada!\nClique no cadeado 🔒 na URL e ative o Microfone.";
                }
                alert(msg);
            }
        });
    }

    // ============================================================
    // 5. UPLOAD E CHAT (Funcionalidades Gerais)
    // ============================================================
    const btnSend = document.getElementById('btn-send');
    const btnAttachment = document.getElementById('btn-attachment');
    const hiddenFileInput = document.getElementById('hidden-file-input');
    const fileListContainer = document.getElementById('file-list-container');
    const chatHistory = document.getElementById('chat-history');
    const welcomeScreen = document.getElementById('welcome-screen');

    // Manipulador de Arquivos
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
        // Função global para o botão remover funcionar
        window.removeFile = idx => { selectedFiles.splice(idx, 1); renderFileList(); };
    }
    
    function resetFileInput() { selectedFiles = []; renderFileList(); }

    // Envio de Mensagem
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

    async function handleSend() {
        if (isRecording) { 
            btnMic.click(); // Para a gravação
            setTimeout(handleSend, 500); // Tenta enviar logo após processar
            return;
        }
        
        const text = chatInput ? chatInput.value.trim() : "";
        if (!text && selectedFiles.length === 0) return;
        if(welcomeScreen) welcomeScreen.style.display = 'none';
        
        // 1. Adiciona mensagem do usuário na tela
        const wrapper = document.createElement('div'); wrapper.className = 'message-wrapper user';
        let html = selectedFiles.map(f => `<div style="font-size:0.8rem;color:#a8c7fa;margin-bottom:4px">📎 ${f.name}</div>`).join('');
        if(text) html += `<div>${text.replace(/\n/g,'<br>')}</div>`;
        wrapper.innerHTML = `<div class="message-content">${html}</div><div class="avatar-icon user">VC</div>`;
        chatHistory.appendChild(wrapper);
        
        if(chatInput) { chatInput.value = ''; chatInput.style.height = 'auto'; }
        const filesToSend = [...selectedFiles]; 
        resetFileInput();
        
        // 2. Mostra Loader da IA
        const ldId = 'ld-'+Date.now();
        const ldDiv = document.createElement('div'); ldDiv.className = 'message-wrapper ai'; ldDiv.id = ldId;
        ldDiv.innerHTML = `<div class="avatar-icon ai"><span class="material-symbols-outlined">smart_toy</span></div><div class="message-content">...</div>`;
        chatHistory.appendChild(ldDiv);
        chatHistory.scrollTop = chatHistory.scrollHeight;

        // 3. Prepara FormData (COM CORREÇÃO DE DUPLICIDADE)
        const formData = new FormData();
        filesToSend.forEach((f, i) => formData.append("file_" + i, f));
        if(text) formData.append('textoBruto', text);
        const userEmail = currentUser ? currentUser.email : "anonimo_erro";
        formData.append('user_email', userEmail); 

        try {
            const res = await fetch(TOOLS[currentTool].webhook, { method: 'POST', body: formData });
            if (!res.ok) throw new Error("Erro Servidor: " + res.status);
            
            const data = await res.json();
            const aiText = data.message || data.msg || data.resumoCompleto || data.text || (data.length ? JSON.stringify(data) : "Processamento concluído.");
            
            // Remove Loader e Mostra Resposta
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

    // Função Global de Cópia
    window.copyText = function(btn) {
        const pre = btn.closest('.message-content').querySelector('pre');
        navigator.clipboard.writeText(pre.textContent).then(() => { btn.style.color='#4caf50'; setTimeout(()=>btn.style.color='#666',2000); });
    };

    // ============================================================
    // 6. MODAIS EXTRAS (Cadastro, Senha) - Simplificados
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

    // ============================================================
    // 7. INTERFACE E MENU
    // ============================================================
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
            
            // Limpa o chat ao trocar de ferramenta
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
            const icon = document.getElementById('theme-icon');
            const txt = document.getElementById('theme-text');
            if(document.body.classList.contains('xmas-mode')) {
                if(icon) icon.textContent = 'ac_unit';
                if(txt) txt.textContent = 'Modo Natal';
            } else {
                if(icon) icon.textContent = 'settings';
                if(txt) txt.textContent = 'Modo Dark';
            }
        });
    }
});
