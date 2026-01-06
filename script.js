document.addEventListener('DOMContentLoaded', () => {

    // ============================================================
    // ESTADO GLOBAL
    // ============================================================
    let currentTool = 'prontuario'; 
    let selectedFiles = []; 
    let currentUser = null;
    let recorder = null; 
    let isRecording = false;

    // --- CONFIGURAÇÃO DE URL (SERVIDOR PLAYGROUND) ---
    const BASE_N8N_URL = "https://plantonista50-playground-n8n.zvu2si.easypanel.host";
    
    // Webhooks
    const AUTH_WEBHOOK = `${BASE_N8N_URL}/webhook/suga-auth`; 
    
    const TOOLS = {
        prontuario: { 
            title: "SuGa PRONTUÁRIO", 
            webhook: `${BASE_N8N_URL}/webhook/cfadce39-4d13-4a1e-ac7d-24ed345a5e9c`, 
            placeholder: "Digite a transcrição do áudio ou a história coletada..." 
        },
        examinator: { 
            title: "SuGa EXAMINATOR", 
            webhook: `${BASE_N8N_URL}/webhook/processar-exame`, 
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
        console.log("Link de autenticação detectado!");
        const params = new URLSearchParams(hash.substring(1)); 
        const accessToken = params.get('access_token');
        const type = params.get('type'); 

        if (accessToken) {
            currentUser = { email: "Verificado", token: accessToken };
            window.history.replaceState(null, null, window.location.pathname);

            if (type === 'recovery') {
                alert("🔔 Link aceito! Agora defina sua nova senha.");
                loginScreen.style.display = 'none';
                forgotModal.style.display = 'flex';
                if(forgotStep1) forgotStep1.style.display = 'none';
                if(forgotStep2) forgotStep2.style.display = 'block';
            } else {
                alert("✅ E-mail confirmado! Você está logado.");
                loginScreen.style.display = 'none';
                if(userInitialsDisplay) {
                    userInitialsDisplay.textContent = "OK";
                    userInitialsDisplay.style.backgroundColor = '#4caf50';
                }
            }
        }
    }

    // ============================================================
    // 2. LÓGICA DE CADASTRO COM CRM VALIDADO
    // ============================================================
    const signupForm = document.getElementById('signup-form');
    const step1Div = document.getElementById('step-1-legal');
    const legalBox = document.getElementById('legal-text-content');
    const termsCheckbox = document.getElementById('signup-terms');
    const termsLabel = document.getElementById('label-terms');
    const btnNextStep = document.getElementById('btn-next-step');
    const step2Div = document.getElementById('step-2-form');
    const modalTitle = document.getElementById('signup-title');
    const btnBack = document.getElementById('btn-back-step');

    if (legalBox) {
        legalBox.addEventListener('scroll', function() {
            if (this.scrollTop + this.clientHeight >= this.scrollHeight - 20) {
                if (termsCheckbox.disabled) {
                    termsCheckbox.disabled = false;
                    termsCheckbox.style.cursor = 'pointer';
                    termsLabel.style.opacity = '1';
                    termsLabel.style.cursor = 'pointer';
                }
            }
        });
    }

    if (termsCheckbox) {
        termsCheckbox.addEventListener('change', function() {
            if (this.checked) {
                btnNextStep.disabled = false;
                btnNextStep.style.opacity = '1';
                btnNextStep.style.cursor = 'pointer';
            } else {
                btnNextStep.disabled = true;
                btnNextStep.style.opacity = '0.5';
                btnNextStep.style.cursor = 'not-allowed';
            }
        });
    }

    if (btnNextStep) {
        btnNextStep.addEventListener('click', () => {
            step1Div.style.display = 'none';
            step2Div.style.display = 'block';
            modalTitle.textContent = "Seus Dados";
        });
    }

    if (btnBack) {
        btnBack.addEventListener('click', () => {
            step2Div.style.display = 'none';
            step1Div.style.display = 'block';
            modalTitle.textContent = "Boas-vindas";
        });
    }

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!termsCheckbox || !termsCheckbox.checked) {
                return alert("Erro: Diretrizes não aceitas.");
            }

            const name = document.getElementById('signup-name').value;
            let crm = document.getElementById('signup-crm').value; 
            const email = document.getElementById('signup-email').value;
            const pass = document.getElementById('signup-pass').value;
            const confirm = document.getElementById('signup-confirm').value;
            
            crm = crm.trim().toUpperCase(); 
            const crmRegex = /^\d+[A-Z]{2}$/;

            if (!crmRegex.test(crm)) {
                return alert("O CRM deve conter apenas números seguidos da sigla do estado (ex: 1234CE).");
            }

            if (pass !== confirm) return alert("Senhas não conferem.");
            if (!name) return alert("Preencha o Nome Completo.");
            
            const btn = document.getElementById('btn-signup-final');
            const originalText = btn.textContent;
            btn.textContent = "Validando..."; btn.disabled = true;

            try {
                const response = await fetch(AUTH_WEBHOOK, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        action: 'signup', 
                        email: email, 
                        password: pass,
                        name: name,
                        crm: crm 
                    })
                });
                let data = await response.json();
                if (Array.isArray(data)) data = data[0];

                if (data.user || data.id || (data.role === 'authenticated')) {
                    alert("Cadastro realizado com segurança! Verifique seu e-mail.");
                    signupModal.style.display = 'none';
                    signupForm.reset();
                    step2Div.style.display = 'none';
                    step1Div.style.display = 'block';
                    termsCheckbox.checked = false;
                    termsCheckbox.disabled = true; 
                    btnNextStep.disabled = true;
                } else {
                    alert("Erro: " + (data.msg || "Falha no cadastro"));
                }
            } catch (e) { alert("Erro de conexão: " + e.message); }
            btn.textContent = originalText; btn.disabled = false;
        });
    }

    // ============================================================
    // 3. LOGIN & RECUPERAÇÃO DE SENHA
    // ============================================================
    
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const btn = loginForm.querySelector('button');
        const originalBtnText = btn.textContent;
        btn.textContent = "Autenticando..."; btn.disabled = true;

        try {
            const response = await fetch(AUTH_WEBHOOK, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'login', email, password })
            });
            
            if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);

            let data = await response.json();
            if (Array.isArray(data)) data = data[0]; 

            if (data && data.access_token) {
                currentUser = { email: data.user.email, token: data.access_token };
                let displayName = data.user.user_metadata?.full_name || data.user.email || "MD";
                const initials = displayName.substring(0,2).toUpperCase();
                
                if(userInitialsDisplay) {
                    userInitialsDisplay.textContent = initials;
                    userInitialsDisplay.style.backgroundColor = '#4caf50';
                }
                loginScreen.style.opacity = '0';
                setTimeout(() => { loginScreen.style.display = 'none'; }, 500);
            } else {
                const errorMsg = data.msg || data.message || data.error_description || "Credenciais inválidas.";
                alert("Erro: " + errorMsg);
            }
        } catch (err) { 
            console.error(err);
            alert("Erro de conexão. Verifique o console."); 
        } 
        btn.textContent = originalBtnText; btn.disabled = false;
    });

    if (forgotStep1) {
        forgotStep1.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('forgot-email').value;
            const btn = forgotStep1.querySelector('button');
            const originalText = btn.textContent;
            btn.textContent = "Enviando..."; btn.disabled = true;
            try {
                await fetch(AUTH_WEBHOOK, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'forgot', email: email })
                });
                alert("Se o e-mail existir, você receberá um link.");
                forgotModal.style.display = 'none';
                forgotStep1.reset();
            } catch (e) { alert("Erro de conexão."); }
            btn.textContent = originalText; btn.disabled = false;
        });
    }

    if (forgotStep2) {
        forgotStep2.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newPass = document.getElementById('new-pass').value;
            if(newPass.length < 6) return alert("Mínimo 6 caracteres.");
            const btn = forgotStep2.querySelector('button');
            const originalText = btn.textContent;
            btn.textContent = "Salvando..."; btn.disabled = true;
            try {
                const response = await fetch(AUTH_WEBHOOK, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'update_password', password: newPass, token: currentUser.token })
                });
                const data = await response.json();
                if (data.id || data.email) {
                    alert("Senha alterada! Faça login.");
                    forgotModal.style.display = 'none';
                    loginScreen.style.display = 'flex'; 
                } else { alert("Erro ao atualizar senha."); }
            } catch (error) { alert("Erro de conexão."); }
            btn.textContent = originalText; btn.disabled = false;
        });
    }

    const linkSignup = document.getElementById('link-signup');
    const linkForgot = document.getElementById('link-forgot');
    const closeButtons = document.querySelectorAll('.close-modal');
    if(linkSignup) linkSignup.addEventListener('click', (e) => { e.preventDefault(); signupModal.style.display = 'flex'; });
    if(linkForgot) linkForgot.addEventListener('click', (e) => { e.preventDefault(); forgotModal.style.display = 'flex'; });
    closeButtons.forEach(btn => { btn.addEventListener('click', () => { if(signupModal) signupModal.style.display='none'; if(forgotModal) forgotModal.style.display='none'; }); });

    // ============================================================
    // 4. CHAT E FUNCIONALIDADES (GRAVAÇÃO E ENVIO)
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

    function toggleMobileMenu() { sidebar.classList.toggle('mobile-open'); sidebarOverlay.classList.toggle('active'); }
    function closeMobileMenu() { sidebar.classList.remove('mobile-open'); sidebarOverlay.classList.remove('active'); }
    function toggleDesktopMenu() { sidebar.classList.toggle('collapsed'); }

    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    if (desktopMenuToggle) desktopMenuToggle.addEventListener('click', toggleDesktopMenu);
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeMobileMenu);
    navItems.forEach(item => { item.addEventListener('click', () => { const toolId = item.getAttribute('data-tool'); setActiveTool(toolId); if (window.innerWidth <= 768) closeMobileMenu(); }); });
    if(btnNewChat) btnNewChat.addEventListener('click', clearChat);

    function setActiveTool(toolId) {
        navItems.forEach(nav => nav.classList.remove('active'));
        const activeNav = document.querySelector(`.nav-item[data-tool="${toolId}"]`);
        if(activeNav) activeNav.classList.add('active');
        currentTool = toolId;
        mainTitle.textContent = TOOLS[toolId].title;
        chatInput.placeholder = TOOLS[toolId].placeholder;
        clearChat();
    }
    function clearChat() {
        chatHistory.querySelectorAll('.message-wrapper').forEach(msg => msg.remove());
        welcomeScreen.style.display = 'block';
        resetFileInput(); chatInput.value = ''; chatInput.style.height = 'auto';
    }

    // --- LÓGICA DO MICROFONE CORRIGIDA PARA CHROME/HTTPS ---
    if (btnMic) btnMic.addEventListener('click', async () => {
        if (isRecording) {
            if (!recorder) return;
            recorder.stopRecording(() => {
                const blob = recorder.getBlob();
                const file = new File([blob], `gravacao_${Date.now()}.wav`, { type: 'audio/wav' });
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
                throw new Error("Biblioteca RecordRTC não carregada. Atualize o index.html.");
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
            console.error(e);
            let msg = "Erro ao acessar microfone.";
            if (e.name === 'NotAllowedError') msg = "Permissão negada. Clique no 🔒 da URL e libere o microfone.";
            if (e.message.includes('HTTPS')) msg = "O Chrome exige HTTPS para usar o microfone.";
            alert(msg);
        }
    });

    btnAttachment.addEventListener('click', () => hiddenFileInput.click());
    hiddenFileInput.addEventListener('change', (e) => { selectedFiles = [...selectedFiles, ...Array.from(e.target.files)].slice(0, 10); renderFileList(); hiddenFileInput.value = ''; });
    function renderFileList() {
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

    btnSend.addEventListener('click', handleSend);
    chatInput.addEventListener('keydown', e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } });
    chatInput.addEventListener('input', function() { this.style.height = 'auto'; this.style.height = (this.scrollHeight) + 'px'; if(this.value==='') this.style.height='auto'; });

    async function handleSend() {
        if (isRecording) { 
            recorder.stopRecording(() => {
                const file = new File([recorder.getBlob()], `gravacao_${Date.now()}.wav`, { type: 'audio/wav' });
                selectedFiles.push(file);
                isRecording = false; btnMic.classList.remove('recording'); btnMic.querySelector('span').textContent='mic';
                handleSend(); 
            });
            return;
        }
        const text = chatInput.value.trim();
        if (!text && selectedFiles.length === 0) return;
        welcomeScreen.style.display = 'none';
        
        const wrapper = document.createElement('div'); wrapper.className = 'message-wrapper user';
        let html = selectedFiles.map(f => `<div style="font-size:0.8rem;color:#a8c7fa;margin-bottom:4px">📎 ${f.name}</div>`).join('');
        if(text) html += `<div>${text.replace(/\n/g,'<br>')}</div>`;
        wrapper.innerHTML = `<div class="message-content">${html}</div><div class="avatar-icon user">VC</div>`;
        chatHistory.appendChild(wrapper);
        chatInput.value = ''; chatInput.style.height = 'auto';
        const filesToSend = [...selectedFiles]; resetFileInput();
        
        const ldId = 'ld-'+Date.now();
        const ldDiv = document.createElement('div'); ldDiv.className = 'message-wrapper ai'; ldDiv.id = ldId;
        ldDiv.innerHTML = `<div class="avatar-icon ai"><span class="material-symbols-outlined">smart_toy</span></div><div class="message-content">...</div>`;
        chatHistory.appendChild(ldDiv);
        chatHistory.scrollTop = chatHistory.scrollHeight;

        const formData = new FormData();
        
        // --- EVITA DUPLICIDADE DE ARQUIVOS (CORREÇÃO DE COBRANÇA) ---
        filesToSend.forEach((f, i) => formData.append(`file_${i}`, f));

        if(text) formData.append('textoBruto', text);
        const userEmail = currentUser ? currentUser.email : "anonimo_erro";
        formData.append('user_email', userEmail); 

        try {
            const res = await fetch(TOOLS[currentTool].webhook, { method: 'POST', body: formData });
            if (!res.ok) throw new Error(`Erro ${res.status}`);
            
            const data = await res.json();
            const aiText = data.message || data.msg || data.resumoCompleto || data.text || (data.length ? JSON.stringify(data) : "Processamento concluído.");
            document.getElementById(ldId)?.remove();
            const aiWrapper = document.createElement('div'); aiWrapper.className = 'message-wrapper ai';
            aiWrapper.innerHTML = `<div class="avatar-icon ai"><span class="material-symbols-outlined">smart_toy</span></div><div class="message-content"><pre>${aiText}</pre><div style="text-align:right"><span class="material-symbols-outlined" style="cursor:pointer;color:#666" onclick="copyText(this)">content_copy</span></div></div>`;
            chatHistory.appendChild(aiWrapper);
        } catch (e) {
            document.getElementById(ldId)?.remove();
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
    // 5. MODO NATAL (Sem Ano Novo)
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
            flake.style.animation = `fall-js ${duration}ms linear ${delay}s forwards`;
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