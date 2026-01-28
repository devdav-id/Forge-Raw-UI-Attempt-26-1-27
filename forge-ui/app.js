/**
 * ============================================
 * FORGE UI - JavaScript Application
 * ============================================
 *
 * This file handles all interactivity for the Forge UI chat interface.
 * It's organized into modular sections that you can customize.
 *
 * TABLE OF CONTENTS:
 * 1. Configuration
 * 2. State Management
 * 3. DOM Elements
 * 4. Template Helpers
 * 5. Message Rendering
 * 6. API Communication
 * 7. Event Handlers
 * 8. Utilities
 * 9. Initialization
 */


/* ============================================
   1. CONFIGURATION
   Customize API endpoint, settings here
   ============================================ */

const ForgeConfig = {
    // API endpoints
    apiEndpoint: 'api.php',
    infoEndpoint: 'info.php',

    // Agent name (loaded from server)
    agentName: 'Forge',

    // Skills (loaded from server)
    skills: [],

    // Auto-scroll behavior
    autoScroll: true,

    // Show timestamps on messages
    showTimestamps: true,

    // Max messages to keep in history (0 = unlimited)
    maxHistoryMessages: 0,
};


/* ============================================
   2. STATE MANAGEMENT
   ============================================ */

const ForgeState = {
    // Conversation history (sent to API)
    messages: [],

    // Currently streaming response
    isStreaming: false,

    // Current assistant message element (for streaming updates)
    currentAssistantMessage: null,

    // Current assistant content (accumulator for streaming)
    currentAssistantContent: '',

    // Theme (dark is default)
    isLightMode: false,
};


/* ============================================
   3. DOM ELEMENTS
   ============================================ */

const ForgeElements = {
    messagesContainer: null,
    userInput: null,
    sendButton: null,
    clearButton: null,
    themeButton: null,
    statusIndicator: null,
    statusText: null,

    // Initialize DOM references
    init() {
        this.messagesContainer = document.getElementById('messagesContainer');
        this.userInput = document.getElementById('userInput');
        this.sendButton = document.getElementById('sendButton');
        this.clearButton = document.getElementById('clearChat');
        this.themeButton = document.getElementById('toggleTheme');
        this.statusIndicator = document.querySelector('.forge-status__indicator');
        this.statusText = document.querySelector('.forge-status__text');
    }
};


/* ============================================
   4. TEMPLATE HELPERS
   ============================================ */

const ForgeTemplates = {
    /**
     * Clone a template by ID and return the element
     */
    clone(templateId) {
        const template = document.getElementById(templateId);
        if (!template) {
            console.error(`Template not found: ${templateId}`);
            return null;
        }
        return template.content.cloneNode(true).firstElementChild;
    },

    /**
     * Get template for message type
     */
    getMessageTemplate(type) {
        const templateMap = {
            'user': 'template-message-user',
            'assistant': 'template-message-assistant',
            'tool_use': 'template-message-tool-use',
            'tool_result': 'template-message-tool-result',
            'error': 'template-message-error',
            'thinking': 'template-message-thinking',
            'system': 'template-message-user', // Reuse user template
        };
        return this.clone(templateMap[type] || 'template-message-assistant');
    }
};


/* ============================================
   5. MESSAGE RENDERING
   ============================================ */

const ForgeMessages = {
    /**
     * Add a user message to the chat
     */
    addUserMessage(text) {
        const element = ForgeTemplates.getMessageTemplate('user');
        element.querySelector('.forge-message__body').textContent = text;

        if (ForgeConfig.showTimestamps) {
            element.querySelector('.forge-message__time').textContent = this.formatTime(new Date());
        }

        ForgeElements.messagesContainer.appendChild(element);
        this.scrollToBottom();

        // Add to history
        ForgeState.messages.push({
            role: 'user',
            content: text
        });

        return element;
    },

    /**
     * Start a new assistant message (for streaming)
     */
    startAssistantMessage() {
        const element = ForgeTemplates.getMessageTemplate('assistant');
        element.classList.add('forge-message--streaming');
        element.querySelector('.forge-message__body').textContent = '';

        // Use configurable agent name
        element.querySelector('.forge-message__role').textContent = ForgeConfig.agentName;

        if (ForgeConfig.showTimestamps) {
            element.querySelector('.forge-message__time').textContent = this.formatTime(new Date());
        }

        ForgeElements.messagesContainer.appendChild(element);
        ForgeState.currentAssistantMessage = element;
        ForgeState.currentAssistantContent = '';

        this.scrollToBottom();
        return element;
    },

    /**
     * Append text to the current streaming message
     */
    appendToAssistantMessage(text) {
        if (!ForgeState.currentAssistantMessage) {
            this.startAssistantMessage();
        }

        ForgeState.currentAssistantContent += text;
        const body = ForgeState.currentAssistantMessage.querySelector('.forge-message__body');
        body.innerHTML = this.formatMessageContent(ForgeState.currentAssistantContent);

        this.scrollToBottom();
    },

    /**
     * Finalize the current streaming message
     */
    finalizeAssistantMessage() {
        if (ForgeState.currentAssistantMessage) {
            ForgeState.currentAssistantMessage.classList.remove('forge-message--streaming');

            // Add to history if there's content
            if (ForgeState.currentAssistantContent.trim()) {
                ForgeState.messages.push({
                    role: 'assistant',
                    content: ForgeState.currentAssistantContent
                });
            }

            ForgeState.currentAssistantMessage = null;
            ForgeState.currentAssistantContent = '';
        }
    },

    /**
     * Add a tool use message
     */
    addToolUseMessage(name, input) {
        const element = ForgeTemplates.getMessageTemplate('tool_use');
        element.querySelector('.forge-tool-name').textContent = name;
        element.querySelector('.forge-code--json').textContent = JSON.stringify(input, null, 2);

        ForgeElements.messagesContainer.appendChild(element);
        this.scrollToBottom();

        return element;
    },

    /**
     * Add a tool result message
     */
    addToolResultMessage(name, result) {
        const element = ForgeTemplates.getMessageTemplate('tool_result');
        element.querySelector('.forge-tool-name').textContent = name;

        const statusEl = element.querySelector('.forge-tool-status');
        if (result.success) {
            statusEl.textContent = 'Success';
            statusEl.classList.add('forge-tool-status--success');
        } else {
            statusEl.textContent = 'Error';
            statusEl.classList.add('forge-tool-status--error');
            element.classList.add('forge-message--tool-error');
        }

        const output = result.content || result.message || result.error || JSON.stringify(result, null, 2);
        element.querySelector('.forge-code').textContent = output;

        ForgeElements.messagesContainer.appendChild(element);
        this.scrollToBottom();

        return element;
    },

    /**
     * Add an error message
     */
    addErrorMessage(text) {
        const element = ForgeTemplates.getMessageTemplate('error');
        element.querySelector('.forge-message__body').textContent = text;

        ForgeElements.messagesContainer.appendChild(element);
        this.scrollToBottom();

        return element;
    },

    /**
     * Add a thinking message
     */
    addThinkingMessage(text) {
        const element = ForgeTemplates.getMessageTemplate('thinking');
        element.querySelector('.forge-message__body').textContent = text;

        ForgeElements.messagesContainer.appendChild(element);
        this.scrollToBottom();

        return element;
    },

    /**
     * Add a loading indicator
     */
    addLoadingIndicator() {
        const template = document.getElementById('template-loading');
        const element = template.content.cloneNode(true).firstElementChild;
        element.id = 'loadingIndicator';

        ForgeElements.messagesContainer.appendChild(element);
        this.scrollToBottom();

        return element;
    },

    /**
     * Remove the loading indicator
     */
    removeLoadingIndicator() {
        const indicator = document.getElementById('loadingIndicator');
        if (indicator) {
            indicator.remove();
        }
    },

    /**
     * Format message content (handle markdown-like formatting)
     */
    formatMessageContent(text) {
        // Escape HTML
        let formatted = this.escapeHtml(text);

        // Code blocks (```language\ncode```)
        formatted = formatted.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
            return `<div class="forge-code-block">
                <div class="forge-code-block__header">
                    <span class="forge-code-block__language">${lang || 'code'}</span>
                    <button class="forge-code-block__copy" onclick="ForgeUtils.copyToClipboard(this)">Copy</button>
                </div>
                <pre class="forge-code"><code>${code}</code></pre>
            </div>`;
        });

        // Inline code (`code`)
        formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Bold (**text**)
        formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        // Italic (*text*)
        formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');

        // Line breaks
        formatted = formatted.replace(/\n/g, '<br>');

        return formatted;
    },

    /**
     * Escape HTML entities
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Format time for display
     */
    formatTime(date) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    },

    /**
     * Scroll to bottom of messages
     */
    scrollToBottom() {
        if (ForgeConfig.autoScroll) {
            ForgeElements.messagesContainer.scrollTop = ForgeElements.messagesContainer.scrollHeight;
        }
    },

    /**
     * Clear all messages
     */
    clearAll() {
        // Keep only the system welcome message
        const systemMessage = ForgeElements.messagesContainer.querySelector('.forge-message--system');
        ForgeElements.messagesContainer.innerHTML = '';
        if (systemMessage) {
            ForgeElements.messagesContainer.appendChild(systemMessage);
        }

        // Clear history
        ForgeState.messages = [];
        ForgeState.currentAssistantMessage = null;
        ForgeState.currentAssistantContent = '';
    }
};


/* ============================================
   6. API COMMUNICATION
   ============================================ */

const ForgeAPI = {
    /**
     * Send a message and handle streaming response
     */
    async sendMessage(userText) {
        if (ForgeState.isStreaming) {
            console.warn('Already streaming, please wait...');
            return;
        }

        ForgeState.isStreaming = true;
        ForgeUI.setStatus('loading', 'Sending...');
        ForgeUI.disableInput(true);

        // Add user message to UI
        ForgeMessages.addUserMessage(userText);

        try {
            const response = await fetch(ForgeConfig.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: ForgeState.messages,
                    system: ForgeConfig.systemPrompt
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Handle SSE stream
            await this.handleSSEStream(response);

        } catch (error) {
            console.error('API Error:', error);
            ForgeMessages.addErrorMessage(`Error: ${error.message}`);
        } finally {
            ForgeState.isStreaming = false;
            ForgeUI.setStatus('ready', 'Ready');
            ForgeUI.disableInput(false);
            ForgeMessages.finalizeAssistantMessage();
        }
    },

    /**
     * Handle Server-Sent Events stream
     */
    async handleSSEStream(response) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                break;
            }

            buffer += decoder.decode(value, { stream: true });

            // Process complete events
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (const line of lines) {
                if (line.startsWith('event: ')) {
                    // Event type
                    continue;
                }

                if (line.startsWith('data: ')) {
                    const jsonStr = line.substring(6);
                    try {
                        const data = JSON.parse(jsonStr);
                        this.handleSSEEvent(data);
                    } catch (e) {
                        // Ignore parse errors for incomplete data
                    }
                }
            }
        }
    },

    /**
     * Handle individual SSE event
     */
    handleSSEEvent(data) {
        // Content text
        if (data.text !== undefined) {
            ForgeMessages.appendToAssistantMessage(data.text);
        }

        // Tool use starting
        if (data.name && data.id && !data.result) {
            ForgeUI.setStatus('loading', `Using ${data.name}...`);
        }

        // Tool result
        if (data.result !== undefined) {
            // Finalize any pending assistant message before tool output
            ForgeMessages.finalizeAssistantMessage();

            ForgeMessages.addToolUseMessage(data.name, data.input);
            ForgeMessages.addToolResultMessage(data.name, data.result);

            // Start new assistant message for continuation
            ForgeMessages.startAssistantMessage();
        }

        // Error
        if (data.message && !data.text) {
            ForgeMessages.addErrorMessage(data.message);
        }

        // Done
        if (data.success !== undefined) {
            // Stream complete
            ForgeMessages.finalizeAssistantMessage();
        }
    }
};


/* ============================================
   7. UI HELPERS
   ============================================ */

const ForgeUI = {
    /**
     * Set the status indicator
     */
    setStatus(state, text) {
        const indicator = ForgeElements.statusIndicator;
        const textEl = ForgeElements.statusText;

        if (!indicator || !textEl) return;

        // Remove all state classes
        indicator.classList.remove(
            'forge-status__indicator--ready',
            'forge-status__indicator--loading',
            'forge-status__indicator--error'
        );

        // Add new state class
        indicator.classList.add(`forge-status__indicator--${state}`);
        textEl.textContent = text;
    },

    /**
     * Disable/enable input
     */
    disableInput(disabled) {
        ForgeElements.userInput.disabled = disabled;
        ForgeElements.sendButton.disabled = disabled;
    },

    /**
     * Toggle light mode (dark is default)
     */
    toggleTheme() {
        ForgeState.isLightMode = !ForgeState.isLightMode;
        document.querySelector('.forge-app').classList.toggle('forge-light', ForgeState.isLightMode);

        // Save preference
        localStorage.setItem('forge-light-mode', ForgeState.isLightMode);
    },

    /**
     * Load saved theme preference
     */
    loadTheme() {
        const saved = localStorage.getItem('forge-light-mode');
        if (saved === 'true') {
            ForgeState.isLightMode = true;
            document.querySelector('.forge-app').classList.add('forge-light');
        }
    }
};


/* ============================================
   8. UTILITIES
   ============================================ */

const ForgeUtils = {
    /**
     * Copy text to clipboard
     */
    copyToClipboard(button) {
        const codeBlock = button.closest('.forge-code-block');
        const code = codeBlock.querySelector('code').textContent;

        navigator.clipboard.writeText(code).then(() => {
            const originalText = button.textContent;
            button.textContent = 'Copied!';
            setTimeout(() => {
                button.textContent = originalText;
            }, 2000);
        });
    },

    /**
     * Auto-resize textarea
     */
    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }
};


/* ============================================
   9. EVENT HANDLERS
   ============================================ */

const ForgeEvents = {
    /**
     * Initialize all event listeners
     */
    init() {
        // Send button click
        ForgeElements.sendButton.addEventListener('click', () => {
            this.handleSend();
        });

        // Input keydown (Enter to send, Shift+Enter for new line)
        ForgeElements.userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSend();
            }
        });

        // Auto-resize textarea on input
        ForgeElements.userInput.addEventListener('input', () => {
            ForgeUtils.autoResizeTextarea(ForgeElements.userInput);
        });

        // Clear chat button
        ForgeElements.clearButton.addEventListener('click', () => {
            if (confirm('Clear all messages?')) {
                ForgeMessages.clearAll();
            }
        });

        // Theme toggle button
        ForgeElements.themeButton.addEventListener('click', () => {
            ForgeUI.toggleTheme();
        });
    },

    /**
     * Handle send action
     */
    handleSend() {
        const text = ForgeElements.userInput.value.trim();

        if (!text) {
            return;
        }

        if (ForgeState.isStreaming) {
            return;
        }

        // Clear input
        ForgeElements.userInput.value = '';
        ForgeUtils.autoResizeTextarea(ForgeElements.userInput);

        // Send message
        ForgeAPI.sendMessage(text);
    }
};


/* ============================================
   10. INITIALIZATION
   ============================================ */

/**
 * Load framework info from server and update UI
 */
async function loadFrameworkInfo() {
    try {
        const response = await fetch(ForgeConfig.infoEndpoint);
        const info = await response.json();

        // Update config
        ForgeConfig.agentName = info.agentName || 'Forge';
        ForgeConfig.skills = info.skills || [];

        // Update header title
        const headerTitle = document.querySelector('.forge-header__title');
        if (headerTitle) {
            headerTitle.textContent = ForgeConfig.agentName;
        }

        // Update directory displays
        const frameworkDirEl = document.getElementById('frameworkDirectory');
        if (frameworkDirEl) {
            frameworkDirEl.textContent = info.frameworkDirectory || info.workingDirectory || 'Not set';
        }

        const workspaceDirEl = document.getElementById('workspaceDirectory');
        if (workspaceDirEl) {
            workspaceDirEl.textContent = info.workspaceDirectory || 'Not set';
        }

        // Update skills list in sidebar
        const toolList = document.querySelector('.forge-tool-list');
        if (toolList && ForgeConfig.skills.length > 0) {
            toolList.innerHTML = ForgeConfig.skills.map(skill =>
                `<li class="forge-tool-list__item" title="${skill.description || ''}">${skill.name}</li>`
            ).join('');
        }

        console.log(`Loaded framework: ${ForgeConfig.agentName}`);
    } catch (error) {
        console.warn('Could not load framework info:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Initialize DOM references
    ForgeElements.init();

    // Initialize event listeners
    ForgeEvents.init();

    // Load saved theme
    ForgeUI.loadTheme();

    // Load framework info (updates agent name, skills)
    loadFrameworkInfo();

    // Set initial status
    ForgeUI.setStatus('ready', 'Ready');

    // Focus input
    ForgeElements.userInput.focus();

    console.log('Forge UI initialized');
});


// Expose utilities globally for template onclick handlers
window.ForgeUtils = ForgeUtils;
