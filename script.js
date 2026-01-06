document.addEventListener('DOMContentLoaded', () => {

    console.log("🚀 Script Carregado: v2.5 (Correção Login)");

    // ============================================================
    // ESTADO GLOBAL
    // ============================================================
    let currentTool = 'prontuario'; 
    let selectedFiles = []; 
    let currentUser = null;
    let recorder = null; 
    let isRecording = false;

    // --- CONFIGURAÇÃO DE URL ---
    // Usando concatenação simples (+) para evitar erros de sintaxe
    const BASE_N8N_URL = "https://plantonista50-playground-n8n.zvu2si.easypanel.host";
    
    // Webhooks
    const AUTH_WEBHOOK = BASE_N8N_URL + "/webhook/suga-auth"; 
    
    const TOOLS = {
        prontuario: { 
            title: "SuGa PRONTUÁRIO", 
            webhook: BASE_N8N_URL + "/webhook/cfadce39-4d13-4a1e-ac7d-24ed345a5e9c", 
            placeholder: "Digite a transcrição do áudio ou a história coletada..." 
        },
        examinator: { 
            title: "SuGa EXAMINATOR", 
            webhook: BASE_N8N_URL + "/webhook/processar-exame", 
            placeholder: "Anexe os exames (PDF/Imagem) para análise..." 
        },
    };

    // DOM ELEMENTS
    const loginScreen = document.getElementById('login-screen');
    const loginForm = document.getElementById('login-form');
    const signupModal = document.getElementById('signup-modal');
    const forgotModal = document.getElementById('forgot-modal');
    const forgotStep1 = document.getElementById('forgot-step-1');
    const forgotStep2 = document.getElementById('forgot-step-2');
    const userInitialsDisplay = document.getElementById('user-initials');

    // ============================================================
    // 1. DETECTOR DE URL (Login Mágico)
    // ============================================================
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
        const params = new URLSearchParams(hash.substring(1)); 
        const accessToken = params.get('access_token');
        const type = params.get('type'); 

        if (accessToken) {
            currentUser = { email: "Verificado", token: accessToken };
            window.history.replaceState(null, null, window.location.pathname);

            if (type === 'recovery') {
                alert("🔔 Link aceito! Agora defina sua nova senha.");
                if(loginScreen) loginScreen.style.display = 'none';
                if(forgotModal) forgotModal.style.display = 'flex';
                if(forgotStep1) forgotStep1.style.display = 'none';
                if(forgotStep2) forgotStep2.style.display = 'block';
            } else {
                alert("✅ E-mail confirmado! Você está logado.");
                if(loginScreen) loginScreen.style.display = 'none';
                if(userInitialsDisplay) {
                    userInitialsDisplay.textContent = "OK";
                    userInitialsDisplay.style.backgroundColor = '#4caf50';
                }
            }
        }
    }

    // ============================================================
    // 2. LOGIN (Lógica Reforçada)
    // ============================================================
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log("Tentando logar..."); // Debug

            const emailInput = document.getElementById('email');
            const passInput = document.getElementById('password');
            const email = emailInput ? emailInput.value : '';
            const password = passInput ? passInput.value : '';
            
            const btn = loginForm.querySelector('button');
            const originalBtnText = btn.textContent;
            btn.textContent = "Autenticando..."; 
            btn.disabled = true;

            try {
                // Verifica conexão básica antes
                if (!navigator.onLine) throw new Error("Sem conexão com a internet.");

                const response = await fetch(AUTH_WEBHOOK, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'login', email: email, password: password })
                });
                
                if (!response.ok) throw new Error("Erro HTTP: " + response.status);

                let data = await response.json();
                // Suporte a resposta array ou objeto
                if (Array.isArray(data)) data = data[0]; 

                if (data && data.access_token) {
                    console.log("Login sucesso!");
                    currentUser = { email: data.user.email, token: data.access_token };
                    
                    let displayName = "MD";
                    if (data.user.user_metadata && data.user.user_metadata.full_name) {
                        displayName = data.user.user_metadata.full_name;
                    } else if (data.user.email) {
                        displayName = data.user.email;
                    }
                    
                    const initials = displayName.substring(0,2).toUpperCase();
                    
                    if(userInitialsDisplay) {
                        userInitialsDisplay.textContent = initials;
                        userInitialsDisplay.style.backgroundColor = '#4caf50';
                    }
                    
                    loginScreen.style.opacity = '0';
                    setTimeout(() => { loginScreen.style.display = 'none'; }, 500);
                } else {
                    const errorMsg = data.msg || data.message || "Credenciais inválidas.";
                    alert("Erro no Login: " + errorMsg);
                }
            } catch (err) { 
                console.error("Erro detalhado:", err);
                alert("Falha na conexão: " + err.message); 
            } 
            
            btn.textContent = originalBtnText; 
            btn.disabled = false;
        });
    } else {
        console.error("ERRO CRÍTICO: Formulário de login não encontrado no HTML.");
    }

    // ============================================================
    // 3. OUTROS MODAIS (Cadastro e Senha)
    // ============================================================
    const signupForm = document.getElementById('signup-form');
    // ... Varredura de elementos ...
    const forgotStep1 = document.getElementById('forgot-step-1');
    const forgotStep2 = document.getElementById('forgot-step-2');

    if (signupForm) {
        // Lógica de Wizard do Cadastro
        const btnNextStep = document.getElementById('btn-next-step');
        const termsCheckbox = document.getElementById('signup-terms');
        const step1Div = document.getElementById('step-1-legal');
        const step2Div = document.getElementById('step-2-form');
        const btnBack = document.getElementById('btn-back-step');
        const legalBox = document.getElementById('legal-text-content');

        if(legalBox && termsCheckbox) {
            legalBox.addEventListener('scroll', function() {
                if (this.scrollTop + this.clientHeight >= this.scrollHeight - 20) {
                    if (termsCheckbox.disabled) {
                        termsCheckbox.disabled = false;
                        termsCheckbox.style.cursor = 'pointer';
                    }
                }
            });
        }

        if(termsCheckbox && btnNextStep) {
            termsCheckbox.addEventListener('change', function() {
                if (this.checked) {
                    btnNextStep.disabled = false;
                    btnNextStep.style.opacity = '1';
                    btnNextStep.style.cursor = 'pointer';
                }
            });
        }

        if(btnNextStep) {
            btnNextStep.addEventListener('click', () => {
                if(step1Div) step1Div.style.display = 'none';
                if(step2Div) step2Div.style.display = 'block';
            });
        }

        if(btnBack) {
            btnBack.addEventListener('click', () => {
                if(step2Div) step2Div.style.display = 'none';
                if(step1Div) step1Div.style.display = 'block';
            });
        }

        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nameEl = document.getElementById('signup-name');
            const crmEl = document.getElementById('signup-crm');
            const emailEl = document.getElementById('signup-email');
            const passEl = document.getElementById('signup-pass');
            const confEl = document.getElementById('signup-confirm');

            if (!termsCheckbox || !termsCheckbox.checked) return alert("Aceite os termos.");
            
            const name = nameEl.value;
            let crm = crmEl.value.trim().toUpperCase();
            const email = emailEl.value;
            const pass = passEl.value;
            
            if (pass !== confEl.value) return alert("Senhas não conferem.");
            
            // Validação CRM
            const crmRegex = /^\d+[A-Z]{2}$/;
            if (!crmRegex.test(crm)) return alert("CRM inválido. Formato: 1234CE");

            const btn = document.getElementById('btn-signup-final');
            const originalText = btn.textContent;
            btn.textContent = "Validando..."; btn.disabled = true;

            try {
                const response = await fetch(AUTH_WEBHOOK, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'signup', email: email, password: pass, name: name, crm: crm })
                });
                let data = await response.json();
                if (Array.isArray(data)) data = data[0];

                if (data.user || data.id || data.role === 'authenticated') {
                    alert("Cadastro realizado! Verifique seu e-mail.");
                    signupModal.style.display = 'none';
                    signupForm.reset();
                } else {
                    alert("Erro: " + (data.msg || "Falha no cadastro"));
                }
            } catch (e) { alert("Erro de conexão: " + e.message); }
            btn.textContent = originalText; btn.disabled = false;
        });
    }

    if (forgotStep1) {
        forgotStep1.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('forgot-email').value;
            const btn = forgotStep1.querySelector('button');
            const txt = btn.textContent;
            btn.textContent = "..."; btn.disabled = true;
            try {
                await fetch(AUTH_WEBHOOK, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'forgot', email: email })
                });
                alert("Verifique seu e-mail.");
                if(forgotModal) forgotModal.style.display = 'none';
            } catch (e) { alert("Erro de conexão."); }
            btn.textContent = txt; btn.disabled = false;
        });
    }

    if (forgotStep2) {
        forgotStep2.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newPass = document.getElementById('new-pass').value;
            const btn = forgotStep2.querySelector('button');
            const txt = btn.textContent;
            btn.textContent = "..."; btn.disabled = true;
            try {
                const res = await fetch(AUTH_WEBHOOK, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'update_password', password: newPass, token: currentUser ? currentUser.token : '' })
                });
                const data = await res.json();
                if (data.id || data.email) {
                    alert("Senha alterada.");
                    if(forgotModal) forgotModal.style.display = 'none';
                    if(loginScreen) loginScreen.style.display = 'flex'; 
                } else { alert("Erro ao atualizar."); }
            } catch (e) { alert("Erro de conexão."); }
            btn.textContent = txt; btn.disabled = false;
        });
    }

    // Controle de Modais (Links)
    const linkSignup = document.getElementById('link-signup');
    const linkForgot = document.getElementById('link-forgot');
    const closeButtons = document.querySelectorAll('.close-modal');
    if(linkSignup) linkSignup.addEventListener('click', (e) => { e.preventDefault(); if(signupModal) signupModal.style.display = 'flex'; });
    if(linkForgot) linkForgot.addEventListener('click', (e) => { e.preventDefault(); if(forgotModal) forgotModal.style.display = 'flex'; });
    closeButtons.forEach(btn => { btn.addEventListener('click', () => { 
        if(signupModal) signupModal.style.display='none'; 
        if(forgotModal) forgotModal.style.display='none'; 
    }); });

    // ============================================================
    // 4. CHAT E SISTEMA (Sidebar, Mic, Files)
    // ============================================================
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const desktopMenuToggle = document.getElementById('desktop-sidebar-toggle');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mainTitle = document.getElementById('main-title');
    const navItems = document.querySelectorAll('.nav-item[data-tool]');
    const btnNewChat = document.getElementById('btn-new-chat');
    const chatHistory = document.getElementById('chat-history');
    const welcomeScreen = document.getElementById('welcome-screen');
    const chatInput = document.getElementById('chat-input');
    const btnSend = document.getElementById('btn-send');
    const btnAttachment = document.getElementById('btn-attachment');
    const btnMic = document.getElementById('btn-mic');
    const hiddenFileInput = document.getElementById('hidden-file-input');
    const fileListContainer = document.getElementById('file-list-container');

    function toggleMobileMenu() { 
        if(sidebar) sidebar.classList.toggle('mobile-open'); 
        if(sidebarOverlay) sidebarOverlay.classList.toggle('active'); 
    }
    function closeMobileMenu() { 
        if(sidebar) sidebar.classList.remove('mobile-open'); 
        if(sidebarOverlay) sidebarOverlay.classList.remove('active'); 
    }
    
    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    if (desktopMenuToggle) desktopMenuToggle.addEventListener('click', () => sidebar.classList.toggle('collapsed'));
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeMobileMenu);
    
    navItems.forEach(item => { 
        item.addEventListener('click', () => { 
            const toolId = item.getAttribute('data-tool'); 
            setActiveTool(toolId); 
            if (window.innerWidth <= 768) closeMobileMenu(); 
        }); 
    });
    
    if(btnNewChat) btnNewChat.addEventListener('click', clearChat);

    function setActiveTool(toolId) {
        navItems.forEach(nav => nav.classList.remove('active'));
        const activeNav = document.querySelector(`.nav-item[data-tool="${toolId}"]`);
        if(activeNav) activeNav.classList.add('active');
        currentTool = toolId;
        if(mainTitle) mainTitle.textContent = TOOLS[toolId].title;
        if(chatInput) chatInput.placeholder = TOOLS[toolId].placeholder;
        clearChat();
    }

    function clearChat() {
        if(!chatHistory) return;
        chatHistory.querySelectorAll('.message-wrapper').forEach(msg => msg.remove());
        if(welcomeScreen) welcomeScreen.style.display = 'block';
        resetFileInput(); 
        if(chatInput) { chatInput.value = ''; chatInput.style.height = 'auto'; }
    }

    // --- MICROFONE COM TRATAMENTO DE ERRO (Atualizado) ---
    if (btnMic) {
        btnMic.addEventListener('click', async () => {
            if (isRecording) {
                if (!recorder) return;
                recorder.stopRecording(() => {
                    const blob = recorder.getBlob();
                    const file = new File([blob], "gravacao_" + Date.now() + ".wav", { type: 'audio/wav' });
                    selectedFiles.push(file);
                    renderFileList();
                    isRecording = false;
                    btnMic.classList.remove('recording');
                    btnMic.querySelector('span').textContent = 'mic';
                    chatInput.placeholder = TOOLS[currentTool].placeholder;
                    recorder.camera.stop();
                    recorder = null;
                });
                return;
            }

            try {
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    throw new Error("Seu navegador não suporta gravação ou o site não é HTTPS.");
                }
                if (typeof RecordRTC === 'undefined') {
                    throw new Error("Biblioteca RecordRTC não carregada. Verifique o index.html.");
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
                chatInput.placeholder = "Gravando... (Clique para parar)";

            } catch (e) {
                console.error("Erro Mic:", e);
                let msg = "Erro técnico: " + (e.message || e.name);
                if (e.name === 'NotAllowedError' || e.message.includes('Permission denied')) {
                    msg = "Permissão negada. Clique no cadeado 🔒 na URL e libere o Microfone.";
                }
                alert(msg);
            }
        });
    }

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
        chatInput.addEventListener('input', function() { this.style.height = 'auto'; this.style.height = (this.scrollHeight) + 'px'; if(this.value==='') this.style.height='auto'; });
    }

    async function handleSend() {
        if (isRecording) { 
            // Força parada da gravação antes de enviar
            btnMic.click();
            // Pequeno delay para garantir que o arquivo foi processado
            setTimeout(handleSend, 500);
            return;
        }
        
        const text = chatInput.value.trim();
        if (!text && selectedFiles.length === 0) return;
        if(welcomeScreen) welcomeScreen.style.display = 'none';
        
        const wrapper = document.createElement('div'); wrapper.className = 'message-wrapper user';
        let html = selectedFiles.map(f => `<div style="font-size:0.8rem;color:#a8c7fa;margin-bottom:4px">📎 ${f.name}</div>`).join('');
        if(text) html += `<div>${text.replace(/\n/g,'<br>')}</div>`;
        wrapper.innerHTML = `<div class="message-content">${html}</div><div class="avatar-icon user">VC</div>`;
        chatHistory.appendChild(wrapper);
        
        chatInput.value = ''; chatInput.style.height = 'auto';
        const filesToSend = [...selectedFiles]; 
        resetFileInput();
        
        const ldId = 'ld-'+Date.now();
        const ldDiv = document.createElement('div'); ldDiv.className = 'message-wrapper ai'; ldDiv.id = ldId;
        ldDiv.innerHTML = `<div class="avatar-icon ai"><span class="material-symbols-outlined">smart_toy</span></div><div class="message-content">...</div>`;
        chatHistory.appendChild(ldDiv);
        chatHistory.scrollTop = chatHistory.scrollHeight;

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

    // ============================================================
    // 5. TEMA (Modo Natal / Dark)
    // ============================================================
    const themeBtn = document.getElementById('theme-toggle-btn');
    const themeIcon = document.getElementById('theme-icon');
    const themeText = document.getElementById('theme-text');
    let isXmas = false;

    function startSnowJS({ duration = 5000, count = 80, sizeScale = 0.8 } = {}) {
        const overlay = document.querySelector('.snow-overlay');
        if (!overlay) return;
        overlay.innerHTML = '';
        overlay.style.opacity = '1';

        const baseOriginal = 6;
        const baseSize = baseOriginal * sizeScale;

        for (let i = 0; i < count; i++) {
            const flake = document.createElement('div');
            flake.className = 'snow-flake';
            const randomFactor = 0.6 + Math.random() * 0.8; 
            const size = Math.max(1, baseSize * randomFactor);
            flake.style.width = size + 'px';
            flake.style.height = size + 'px';
            flake.style.left = (Math.random() * 100) + 'vw';
            flake.style.top = (-5 - Math.random() * 20) + 'vh';
            flake.style.opacity = (0.5 + Math.random() * 0.5).toString();
            const delay = (Math.random() * 0.4).toFixed(2);
            // Concatenation string style for safety
            flake.style.animation = "fall-js " + duration + "ms linear " + delay + "s forwards";
            overlay.appendChild(flake);
        }
        setTimeout(() => { overlay.innerHTML = ''; overlay.style.opacity = ''; }, duration + 600);
    }

    const bodyObserver = new MutationObserver((mutations) => {
        for (const m of mutations) {
            if (m.attributeName === 'class') {
                const active = document.body.classList.contains('xmas-mode');
                if (active) startSnowJS({ duration: 5000, count: 150, sizeScale: 0.8 });
            }
        }
    });
    bodyObserver.observe(document.body, { attributes: true });

    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            isXmas = !isXmas;
            document.body.classList.toggle('xmas-mode');

            if (isXmas) {
                themeIcon.textContent = 'ac_unit';
                themeText.textContent = 'Modo Natal';
                themeBtn.style.color = 'var(--accent-color)';
                startSnowJS({ duration: 5000, count: 150, sizeScale: 0.8 });
            } else {
                themeIcon.textContent = 'settings';
                themeText.textContent = 'Modo Dark';
                themeBtn.style.color = '';
            }
        });
    }
});
