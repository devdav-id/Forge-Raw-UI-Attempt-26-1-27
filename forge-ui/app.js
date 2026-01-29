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
    historyEndpoint: 'history.php',
    agentsEndpoint: 'agents.php',

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

    // Auto-save conversations
    autoSave: true,

    // Show agent intro on new conversation
    showAgentIntro: true,
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

    // Tool messages collapsed (default: collapsed)
    toolsCollapsed: true,

    // Tool messages hidden
    toolsHidden: false,

    // Current conversation
    currentConversation: {
        id: null,
        title: null,
        created: null,
        updated: null
    },

    // List of all conversations
    conversations: [],

    // Current agent
    currentAgent: null,

    // List of all agents
    agents: [],
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
    toolsCollapseButton: null,
    toolsVisibilityButton: null,
    statusIndicator: null,
    statusText: null,
    conversationList: null,
    newConversationButton: null,
    agentList: null,

    // Initialize DOM references
    init() {
        this.messagesContainer = document.getElementById('messagesContainer');
        this.userInput = document.getElementById('userInput');
        this.sendButton = document.getElementById('sendButton');
        this.clearButton = document.getElementById('clearChat');
        this.themeButton = document.getElementById('toggleTheme');
        this.toolsCollapseButton = document.getElementById('toggleToolsCollapse');
        this.toolsVisibilityButton = document.getElementById('toggleToolsVisibility');
        this.statusIndicator = document.querySelector('.forge-status__indicator');
        this.statusText = document.querySelector('.forge-status__text');
        this.conversationList = document.getElementById('conversationList');
        this.newConversationButton = document.getElementById('newConversation');
        this.agentList = document.getElementById('agentList');
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
                    agentId: ForgeState.currentAgent?.id || null
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

            // Auto-save conversation
            ForgeHistory.saveConversation();
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
    },

    /**
     * Toggle tool messages collapsed state
     */
    toggleToolsCollapse() {
        ForgeState.toolsCollapsed = !ForgeState.toolsCollapsed;
        ForgeElements.messagesContainer.classList.toggle('forge-tools-collapsed', ForgeState.toolsCollapsed);
        ForgeElements.toolsCollapseButton.classList.toggle('forge-button--active', ForgeState.toolsCollapsed);
        ForgeElements.toolsCollapseButton.textContent = ForgeState.toolsCollapsed ? 'Expand Tools' : 'Collapse Tools';

        // Save preference
        localStorage.setItem('forge-tools-collapsed', ForgeState.toolsCollapsed);
    },

    /**
     * Toggle tool messages visibility
     */
    toggleToolsVisibility() {
        ForgeState.toolsHidden = !ForgeState.toolsHidden;
        ForgeElements.messagesContainer.classList.toggle('forge-tools-hidden', ForgeState.toolsHidden);
        ForgeElements.toolsVisibilityButton.classList.toggle('forge-button--active', ForgeState.toolsHidden);
        ForgeElements.toolsVisibilityButton.textContent = ForgeState.toolsHidden ? 'Show Tools' : 'Hide Tools';

        // Save preference
        localStorage.setItem('forge-tools-hidden', ForgeState.toolsHidden);
    },

    /**
     * Load saved tool preferences
     */
    loadToolPreferences() {
        // Collapsed state (default: collapsed)
        const collapsed = localStorage.getItem('forge-tools-collapsed');
        if (collapsed === 'false') {
            ForgeState.toolsCollapsed = false;
            ForgeElements.toolsCollapseButton.classList.remove('forge-button--active');
            ForgeElements.toolsCollapseButton.textContent = 'Collapse Tools';
        } else {
            // Default: collapsed
            ForgeElements.messagesContainer.classList.add('forge-tools-collapsed');
        }

        // Hidden state
        const hidden = localStorage.getItem('forge-tools-hidden');
        if (hidden === 'true') {
            ForgeState.toolsHidden = true;
            ForgeElements.messagesContainer.classList.add('forge-tools-hidden');
            ForgeElements.toolsVisibilityButton.classList.add('forge-button--active');
            ForgeElements.toolsVisibilityButton.textContent = 'Show Tools';
        }
    }
};


/* ============================================
   8. CHAT HISTORY
   ============================================ */

const ForgeHistory = {
    /**
     * Load all conversations from server
     */
    async loadConversations() {
        try {
            const response = await fetch(ForgeConfig.historyEndpoint);
            const data = await response.json();

            if (data.success) {
                ForgeState.conversations = data.conversations || [];
                this.renderConversationList();
                return data.conversations;
            }
        } catch (error) {
            console.warn('Could not load conversations:', error);
        }
        return [];
    },

    /**
     * Load a specific conversation
     */
    async loadConversation(id) {
        try {
            const response = await fetch(`${ForgeConfig.historyEndpoint}?id=${id}`);
            const data = await response.json();

            if (data.success && data.conversation) {
                // Set current conversation
                ForgeState.currentConversation = {
                    id: data.conversation.id,
                    title: data.conversation.title,
                    created: data.conversation.created,
                    updated: data.conversation.updated
                };

                // Load messages
                ForgeState.messages = data.conversation.messages || [];

                // Render messages in UI
                this.renderLoadedMessages();

                // Update active state in list
                this.setActiveConversation(id);

                return data.conversation;
            }
        } catch (error) {
            console.error('Could not load conversation:', error);
        }
        return null;
    },

    /**
     * Save current conversation
     */
    async saveConversation() {
        if (!ForgeConfig.autoSave) return;
        if (ForgeState.messages.length === 0) return;

        try {
            const payload = {
                id: ForgeState.currentConversation.id,
                title: ForgeState.currentConversation.title,
                created: ForgeState.currentConversation.created,
                messages: ForgeState.messages
            };

            const response = await fetch(ForgeConfig.historyEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (data.success) {
                // Update current conversation with server response
                ForgeState.currentConversation.id = data.id;
                ForgeState.currentConversation.title = data.title;
                ForgeState.currentConversation.updated = data.updated;

                // Refresh conversation list
                await this.loadConversations();
            }
        } catch (error) {
            console.warn('Could not save conversation:', error);
        }
    },

    /**
     * Delete a conversation
     */
    async deleteConversation(id) {
        try {
            const response = await fetch(`${ForgeConfig.historyEndpoint}?id=${id}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.success) {
                // If we deleted the current conversation, start a new one
                if (ForgeState.currentConversation.id === id) {
                    this.startNewConversation();
                }

                // Refresh list
                await this.loadConversations();
                return true;
            }
        } catch (error) {
            console.error('Could not delete conversation:', error);
        }
        return false;
    },

    /**
     * Start a new conversation
     */
    startNewConversation(showIntro = true) {
        // Reset state
        ForgeState.currentConversation = {
            id: null,
            title: null,
            created: null,
            updated: null
        };
        ForgeState.messages = [];

        // Clear UI messages (keep system message)
        ForgeMessages.clearAll();

        // Clear active state in list
        this.setActiveConversation(null);

        // Show agent intro for new conversations
        if (showIntro && ForgeConfig.showAgentIntro && ForgeState.currentAgent) {
            ForgeAgents.showAgentIntro();
        }
    },

    /**
     * Render loaded messages to UI
     */
    renderLoadedMessages() {
        // Clear current messages (keep system message template for reference)
        const systemMessage = ForgeElements.messagesContainer.querySelector('.forge-message--system');
        ForgeElements.messagesContainer.innerHTML = '';

        // Re-add system message
        if (systemMessage) {
            ForgeElements.messagesContainer.appendChild(systemMessage.cloneNode(true));
        }

        // Render each message
        for (const msg of ForgeState.messages) {
            if (msg.role === 'user') {
                const element = ForgeTemplates.getMessageTemplate('user');
                element.querySelector('.forge-message__body').textContent = msg.content;
                ForgeElements.messagesContainer.appendChild(element);
            } else if (msg.role === 'assistant') {
                const element = ForgeTemplates.getMessageTemplate('assistant');
                element.querySelector('.forge-message__role').textContent = ForgeConfig.agentName;
                element.querySelector('.forge-message__body').innerHTML = ForgeMessages.formatMessageContent(msg.content);
                ForgeElements.messagesContainer.appendChild(element);
            }
        }

        ForgeMessages.scrollToBottom();
    },

    /**
     * Render conversation list in sidebar
     */
    renderConversationList() {
        const list = ForgeElements.conversationList;
        if (!list) return;

        if (ForgeState.conversations.length === 0) {
            list.innerHTML = '<li class="forge-conversation-list__empty">No conversations yet</li>';
            return;
        }

        list.innerHTML = ForgeState.conversations.map(conv => {
            const date = new Date(conv.updated * 1000);
            const dateStr = this.formatDate(date);
            const isActive = ForgeState.currentConversation.id === conv.id;

            return `
                <li class="forge-conversation-list__item${isActive ? ' forge-conversation-list__item--active' : ''}"
                    data-id="${conv.id}">
                    <div class="forge-conversation-list__info">
                        <span class="forge-conversation-list__title">${this.escapeHtml(conv.title)}</span>
                        <span class="forge-conversation-list__date">${dateStr}</span>
                    </div>
                    <button class="forge-conversation-list__delete" data-id="${conv.id}" title="Delete">&times;</button>
                </li>
            `;
        }).join('');

        // Add click handlers
        list.querySelectorAll('.forge-conversation-list__item').forEach(item => {
            item.addEventListener('click', (e) => {
                // Don't trigger if clicking delete button
                if (e.target.classList.contains('forge-conversation-list__delete')) return;

                const id = item.dataset.id;
                this.loadConversation(id);
            });
        });

        // Add delete handlers
        list.querySelectorAll('.forge-conversation-list__delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                if (confirm('Delete this conversation?')) {
                    await this.deleteConversation(id);
                }
            });
        });
    },

    /**
     * Set active conversation in list
     */
    setActiveConversation(id) {
        const items = ForgeElements.conversationList?.querySelectorAll('.forge-conversation-list__item');
        items?.forEach(item => {
            item.classList.toggle('forge-conversation-list__item--active', item.dataset.id === id);
        });
    },

    /**
     * Format date for display
     */
    formatDate(date) {
        const now = new Date();
        const diff = now - date;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (days === 1) {
            return 'Yesterday';
        } else if (days < 7) {
            return date.toLocaleDateString([], { weekday: 'short' });
        } else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
    },

    /**
     * Escape HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};


/* ============================================
   9. AGENTS
   ============================================ */

const ForgeAgents = {
    /**
     * Load all agents from server
     */
    async loadAgents() {
        try {
            const response = await fetch(ForgeConfig.agentsEndpoint);
            const data = await response.json();

            if (data.success) {
                ForgeState.agents = data.agents || [];
                this.renderAgentList();

                // Set default agent (first one, usually Forge) - no switch message on init
                if (ForgeState.agents.length > 0 && !ForgeState.currentAgent) {
                    await this.selectAgent(ForgeState.agents[0].id, false); // false = no switch message
                }

                return data.agents;
            }
        } catch (error) {
            console.warn('Could not load agents:', error);
        }
        return [];
    },

    /**
     * Select an agent (switches agent in current conversation)
     */
    async selectAgent(agentId, showSwitchMessage = true) {
        const agent = ForgeState.agents.find(a => a.id === agentId);
        if (!agent) return;

        // Don't do anything if already selected
        if (ForgeState.currentAgent?.id === agentId) return;

        const previousAgent = ForgeState.currentAgent;

        // Load full agent details
        try {
            const response = await fetch(`${ForgeConfig.agentsEndpoint}?id=${agentId}`);
            const data = await response.json();

            if (data.success && data.agent) {
                ForgeState.currentAgent = data.agent;

                // Update UI with agent info
                ForgeConfig.agentName = data.agent.name;

                // Update header
                const headerTitle = document.querySelector('.forge-header__title');
                if (headerTitle) {
                    headerTitle.textContent = data.agent.name;
                }

                // Update active state in list
                this.setActiveAgent(agentId);

                // Show switch message if switching mid-conversation
                if (showSwitchMessage && previousAgent && ForgeState.messages.length > 0) {
                    this.showAgentSwitchMessage(previousAgent.name, data.agent.name);
                }
            }
        } catch (error) {
            console.error('Could not load agent details:', error);
        }
    },

    /**
     * Show a system message when switching agents mid-conversation
     */
    showAgentSwitchMessage(fromName, toName) {
        const element = ForgeTemplates.clone('template-message-user');
        if (!element) return;

        // Restyle as system message
        element.classList.remove('forge-message--user');
        element.classList.add('forge-message--system');
        element.querySelector('.forge-message__role').textContent = 'System';
        element.querySelector('.forge-message__body').textContent = `Switched from ${fromName} to ${toName}`;

        // Update icon
        const icon = element.querySelector('.forge-icon');
        if (icon) {
            icon.classList.remove('forge-icon--user');
            icon.classList.add('forge-icon--system');
        }

        ForgeElements.messagesContainer.appendChild(element);
        ForgeMessages.scrollToBottom();
    },

    /**
     * Show agent introduction message
     */
    showAgentIntro() {
        if (!ForgeConfig.showAgentIntro) return;
        if (!ForgeState.currentAgent) return;

        const intro = ForgeState.currentAgent.intro || ForgeState.currentAgent.description;
        if (!intro) return;

        // Add as assistant message
        const element = ForgeTemplates.getMessageTemplate('assistant');
        element.querySelector('.forge-message__role').textContent = ForgeConfig.agentName;
        element.querySelector('.forge-message__body').textContent = intro;

        ForgeElements.messagesContainer.appendChild(element);
        ForgeMessages.scrollToBottom();

        // Note: Don't add to state.messages - this is just UI, not history
    },

    /**
     * Render agent list in sidebar
     */
    renderAgentList() {
        const list = ForgeElements.agentList;
        if (!list) return;

        if (ForgeState.agents.length === 0) {
            list.innerHTML = '<li class="forge-agent-list__empty">No agents found</li>';
            return;
        }

        list.innerHTML = ForgeState.agents.map(agent => {
            const isActive = ForgeState.currentAgent?.id === agent.id;
            const initials = this.getInitials(agent.name);

            return `
                <li class="forge-agent-list__item${isActive ? ' forge-agent-list__item--active' : ''}"
                    data-id="${agent.id}" title="${this.escapeHtml(agent.description)}">
                    <div class="forge-agent-list__icon">${initials}</div>
                    <div class="forge-agent-list__info">
                        <span class="forge-agent-list__name">${this.escapeHtml(agent.name)}</span>
                        <span class="forge-agent-list__source">${agent.source}</span>
                    </div>
                </li>
            `;
        }).join('');

        // Add click handlers
        list.querySelectorAll('.forge-agent-list__item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.id;
                this.selectAgent(id, true);
            });
        });
    },

    /**
     * Set active agent in list
     */
    setActiveAgent(id) {
        const items = ForgeElements.agentList?.querySelectorAll('.forge-agent-list__item');
        items?.forEach(item => {
            item.classList.toggle('forge-agent-list__item--active', item.dataset.id === id);
        });
    },

    /**
     * Get initials from name
     */
    getInitials(name) {
        return name
            .split(/[\s-]+/)
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    },

    /**
     * Escape HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};


/* ============================================
   10. UTILITIES
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

        // Clear chat button (starts a new conversation)
        ForgeElements.clearButton.addEventListener('click', () => {
            if (confirm('Start a new conversation?')) {
                ForgeHistory.startNewConversation();
            }
        });

        // Theme toggle button
        ForgeElements.themeButton.addEventListener('click', () => {
            ForgeUI.toggleTheme();
        });

        // Tools collapse toggle button
        ForgeElements.toolsCollapseButton.addEventListener('click', () => {
            ForgeUI.toggleToolsCollapse();
        });

        // Tools visibility toggle button
        ForgeElements.toolsVisibilityButton.addEventListener('click', () => {
            ForgeUI.toggleToolsVisibility();
        });

        // New conversation button
        ForgeElements.newConversationButton?.addEventListener('click', () => {
            ForgeHistory.startNewConversation();
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

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize DOM references
    ForgeElements.init();

    // Initialize event listeners
    ForgeEvents.init();

    // Load saved theme
    ForgeUI.loadTheme();

    // Load saved tool preferences
    ForgeUI.loadToolPreferences();

    // Load framework info (updates agent name, skills)
    await loadFrameworkInfo();

    // Load available agents (don't show switch message on initial load)
    await ForgeAgents.loadAgents();

    // Load conversations and restore the newest one
    const conversations = await ForgeHistory.loadConversations();
    if (conversations.length > 0) {
        // Load the newest conversation (first in list, sorted by updated)
        await ForgeHistory.loadConversation(conversations[0].id);
    }
    // Note: No intro on load - intro only shows when explicitly starting new conversation

    // Set initial status
    ForgeUI.setStatus('ready', 'Ready');

    // Focus input
    ForgeElements.userInput.focus();

    console.log('Forge UI initialized');
});


// Expose utilities globally for template onclick handlers
window.ForgeUtils = ForgeUtils;
window.ForgeHistory = ForgeHistory;
window.ForgeAgents = ForgeAgents;
