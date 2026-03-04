document.addEventListener("DOMContentLoaded", () => {
    const chatContainer = document.getElementById("chat-container");
    const chatInput = document.getElementById("chat-input");
    const sendBtn = document.getElementById("send-btn");
    const clearBtn = document.getElementById("clear-btn");
    const themeToggle = document.getElementById("theme-toggle");
    const headerContainer = document.getElementById("header-container");
    
    // Create a unique session ID for the tab if not exists
    let sessionId = sessionStorage.getItem("auditSessionId");
    if (!sessionId) {
        sessionId = "session_" + Math.random().toString(36).substring(2, 10);
        sessionStorage.setItem("auditSessionId", sessionId);
    }

    // Auto-resize textarea
    chatInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight < 200 ? this.scrollHeight : 200) + 'px';
        if (this.value === '') {
            this.style.height = 'auto';
        }
    });

    // Handle Enter to send (Shift+Enter for newline)
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Send button click
    sendBtn.addEventListener('click', sendMessage);

    // Clear button click
    clearBtn.addEventListener('click', async () => {
        if(confirm("Are you sure you want to clear the chat?")) {
            await fetch("/api/clear", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ session_id: sessionId })
            });
            chatContainer.innerHTML = "";
            headerContainer.classList.remove("header-hidden");
        }
    });

    // Theme toggle
    themeToggle.addEventListener('click', () => {
        const html = document.documentElement;
        const icon = themeToggle.querySelector('i');
        
        if (html.getAttribute('data-bs-theme') === 'dark') {
            html.setAttribute('data-bs-theme', 'light');
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        } else {
            html.setAttribute('data-bs-theme', 'dark');
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    });

    // Load history
    async function loadHistory() {
        try {
            const res = await fetch(`/api/history?session_id=${sessionId}`);
            const data = await res.json();
            
            if (data.history && data.history.length > 0) {
                headerContainer.classList.add("header-hidden");
                data.history.forEach(msg => {
                    appendMessage(msg.role, msg.content, false);
                });
                scrollToBottom();
            }
        } catch (e) {
            console.error("Failed to load history", e);
        }
    }

    // Send Message
    async function sendMessage() {
        const text = chatInput.value.trim();
        if (!text) return;

        // Hide header on first message
        headerContainer.classList.add("header-hidden");

        // Clear input
        chatInput.value = "";
        chatInput.style.height = 'auto';

        // Append user msg
        appendMessage("user", text, false);

        // Show typing indicator
        const typingId = "typing-" + Date.now();
        appendTypingIndicator(typingId);
        scrollToBottom();

        // Send API request using fetch for streaming
        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text, session_id: sessionId })
            });

            if (!response.ok) {
                throw new Error("API response error");
            }

            // Remove typing indicator
            document.getElementById(typingId).remove();

            // Setup AI message container
            const msgId = "msg-" + Date.now();
            const contentDiv = appendMessage("assistant", "", true, msgId);
            
            // Read stream
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let aiText = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunkText = decoder.decode(value, { stream: true });
                const lines = chunkText.split("\n\n");
                
                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const dataStr = line.substring(6);
                        try {
                            const data = JSON.parse(dataStr);
                            if (data.error) {
                                contentDiv.innerHTML = `<span class="text-danger">Error: ${data.error}</span>`;
                                return;
                            }
                            if (data.done) {
                                break;
                            }
                            if (data.content) {
                                aiText += data.content;
                                // Convert markdown to HTML while building incrementally
                                contentDiv.innerHTML = marked.parse(aiText);
                                scrollToBottom();
                            }
                        } catch(e) {}
                    }
                }
            }
        } catch (error) {
            console.error("Chat error:", error);
            const typingElem = document.getElementById(typingId);
            if(typingElem) typingElem.remove();
            appendMessage("assistant", "<span class='text-danger'>Connection error. Please try again.</span>", false);
        }
    }

    function appendMessage(role, content, isHtmlContent = false, staticId = null) {
        const div = document.createElement("div");
        div.className = `message ${role === 'user' ? 'user-msg' : 'ai-msg'}`;
        if(staticId) div.id = staticId;
        
        const contentDiv = document.createElement("div");
        if (isHtmlContent) {
            contentDiv.innerHTML = content;
        } else if (role === 'assistant') {
            contentDiv.innerHTML = marked.parse(content);
        } else {
            contentDiv.textContent = content; // User content is plain text safely escaped
        }
        
        div.appendChild(contentDiv);
        chatContainer.appendChild(div);
        scrollToBottom();
        return contentDiv;
    }

    function appendTypingIndicator(id) {
        const div = document.createElement("div");
        div.className = "message ai-msg typing-indicator";
        div.id = id;
        div.innerHTML = "<div><span></span><span></span><span></span></div>";
        chatContainer.appendChild(div);
    }

    function scrollToBottom() {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // Init
    loadHistory();
});
