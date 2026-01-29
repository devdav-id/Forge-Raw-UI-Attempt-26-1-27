<?php
/**
 * Forge UI - API Backend
 *
 * Handles chat requests, streams responses, and executes tools.
 * Uses Server-Sent Events (SSE) for real-time streaming.
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/tools.php';

// Set headers for SSE
header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('Connection: keep-alive');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Disable output buffering for streaming
if (ob_get_level()) {
    ob_end_clean();
}

/**
 * Send an SSE event
 */
function sendEvent(string $event, $data): void
{
    echo "event: {$event}\n";
    echo "data: " . json_encode($data) . "\n\n";
    flush();
}

/**
 * Send an error and exit
 */
function sendError(string $message): void
{
    sendEvent('error', ['message' => $message]);
    sendEvent('done', ['success' => false]);
    exit;
}

/**
 * Make a streaming request to Anthropic API
 */
function streamAnthropicRequest(array $messages, array $tools, string $systemPrompt): Generator
{
    $url = 'https://api.anthropic.com/v1/messages';

    $payload = [
        'model' => ANTHROPIC_MODEL,
        'max_tokens' => MAX_TOKENS,
        'stream' => true,
        'system' => $systemPrompt,
        'messages' => $messages,
        'tools' => $tools
    ];

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'x-api-key: ' . ANTHROPIC_API_KEY,
            'anthropic-version: 2023-06-01'
        ],
        CURLOPT_RETURNTRANSFER => false,
        CURLOPT_WRITEFUNCTION => function ($ch, $data) use (&$buffer) {
            $buffer .= $data;
            return strlen($data);
        }
    ]);

    $buffer = '';
    curl_exec($ch);

    if (curl_errno($ch)) {
        throw new Exception('Curl error: ' . curl_error($ch));
    }

    curl_close($ch);

    // Parse SSE events from buffer
    $lines = explode("\n", $buffer);
    foreach ($lines as $line) {
        if (strpos($line, 'data: ') === 0) {
            $jsonStr = substr($line, 6);
            if ($jsonStr !== '[DONE]') {
                $event = json_decode($jsonStr, true);
                if ($event) {
                    yield $event;
                }
            }
        }
    }
}

/**
 * Process a streaming response from Anthropic
 * Returns the complete response including any tool uses
 */
function processStreamingResponse(array $messages, array $tools, string $systemPrompt): array
{
    $url = 'https://api.anthropic.com/v1/messages';

    $payload = [
        'model' => ANTHROPIC_MODEL,
        'max_tokens' => MAX_TOKENS,
        'stream' => true,
        'system' => $systemPrompt,
        'messages' => $messages,
        'tools' => $tools
    ];

    $ch = curl_init($url);

    $responseBuffer = '';
    $currentContent = '';
    $contentBlocks = [];
    $currentBlockIndex = -1;
    $currentBlockType = null;
    $toolUseBlocks = [];
    $stopReason = null;

    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'x-api-key: ' . ANTHROPIC_API_KEY,
            'anthropic-version: 2023-06-01'
        ],
        CURLOPT_RETURNTRANSFER => false,
        CURLOPT_WRITEFUNCTION => function ($ch, $data) use (&$responseBuffer, &$currentContent, &$contentBlocks, &$currentBlockIndex, &$currentBlockType, &$toolUseBlocks, &$stopReason) {
            $responseBuffer .= $data;

            // Process complete SSE events
            while (($pos = strpos($responseBuffer, "\n\n")) !== false) {
                $eventBlock = substr($responseBuffer, 0, $pos);
                $responseBuffer = substr($responseBuffer, $pos + 2);

                // Parse the event
                $eventType = null;
                $eventData = null;

                foreach (explode("\n", $eventBlock) as $line) {
                    if (strpos($line, 'event: ') === 0) {
                        $eventType = substr($line, 7);
                    } elseif (strpos($line, 'data: ') === 0) {
                        $eventData = json_decode(substr($line, 6), true);
                    }
                }

                if (!$eventData) {
                    continue;
                }

                switch ($eventType) {
                    case 'content_block_start':
                        $currentBlockIndex = $eventData['index'] ?? 0;
                        $block = $eventData['content_block'] ?? [];
                        $currentBlockType = $block['type'] ?? null;

                        if ($currentBlockType === 'tool_use') {
                            $toolUseBlocks[$currentBlockIndex] = [
                                'type' => 'tool_use',
                                'id' => $block['id'] ?? '',
                                'name' => $block['name'] ?? '',
                                'input' => ''
                            ];
                            sendEvent('tool_use_start', [
                                'id' => $block['id'] ?? '',
                                'name' => $block['name'] ?? ''
                            ]);
                        } elseif ($currentBlockType === 'text') {
                            $contentBlocks[$currentBlockIndex] = [
                                'type' => 'text',
                                'text' => ''
                            ];
                        }
                        break;

                    case 'content_block_delta':
                        $delta = $eventData['delta'] ?? [];
                        $deltaType = $delta['type'] ?? '';

                        if ($deltaType === 'text_delta') {
                            $text = $delta['text'] ?? '';
                            if (isset($contentBlocks[$currentBlockIndex])) {
                                $contentBlocks[$currentBlockIndex]['text'] .= $text;
                            }
                            $currentContent .= $text;
                            sendEvent('content', ['text' => $text]);
                        } elseif ($deltaType === 'input_json_delta') {
                            $partialJson = $delta['partial_json'] ?? '';
                            if (isset($toolUseBlocks[$currentBlockIndex])) {
                                $toolUseBlocks[$currentBlockIndex]['input'] .= $partialJson;
                            }
                            sendEvent('tool_input_delta', ['partial' => $partialJson]);
                        }
                        break;

                    case 'content_block_stop':
                        if ($currentBlockType === 'tool_use' && isset($toolUseBlocks[$currentBlockIndex])) {
                            // Parse the complete JSON input
                            $inputJson = $toolUseBlocks[$currentBlockIndex]['input'];
                            $toolUseBlocks[$currentBlockIndex]['input'] = json_decode($inputJson, true) ?? [];
                        }
                        break;

                    case 'message_delta':
                        $stopReason = $eventData['delta']['stop_reason'] ?? null;
                        break;
                }
            }

            return strlen($data);
        }
    ]);

    $result = curl_exec($ch);

    if (curl_errno($ch)) {
        $error = curl_error($ch);
        curl_close($ch);
        throw new Exception('API request failed: ' . $error);
    }

    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        $errorMessages = [
            400 => 'Bad request - check your message format',
            401 => 'Invalid API key - check config.php',
            403 => 'Access denied - your API key may not have access to this model',
            429 => 'Rate limit exceeded - please wait a moment and try again',
            500 => 'Anthropic server error - try again later',
            529 => 'Anthropic is overloaded - try again later',
        ];
        $msg = $errorMessages[$httpCode] ?? "API error (HTTP {$httpCode})";
        throw new Exception($msg);
    }

    return [
        'content' => $currentContent,
        'content_blocks' => $contentBlocks,
        'tool_use' => array_values($toolUseBlocks),
        'stop_reason' => $stopReason
    ];
}

/**
 * Load the system prompt for an agent
 */
function loadAgentPrompt(?string $agentId = null): string
{
    // If agent ID is provided, try to find its CLAUDE.md
    if ($agentId) {
        $agentPath = findAgentPath($agentId);
        if ($agentPath) {
            $claudeMdPath = $agentPath . '/CLAUDE.md';
            if (file_exists($claudeMdPath)) {
                $content = file_get_contents($claudeMdPath);
                if ($content !== false) {
                    return $content;
                }
            }

            // If no CLAUDE.md, try to build prompt from agent.json
            $agentJsonPath = $agentPath . '/agent.json';
            if (file_exists($agentJsonPath)) {
                $agentData = json_decode(file_get_contents($agentJsonPath), true);
                if ($agentData) {
                    return buildPromptFromAgentJson($agentData);
                }
            }
        }
    }

    // Fall back to framework's CLAUDE.md
    if (defined('FRAMEWORK_DIRECTORY') && FRAMEWORK_DIRECTORY !== '') {
        $claudeMdPath = FRAMEWORK_DIRECTORY . '/CLAUDE.md';
        if (file_exists($claudeMdPath)) {
            $content = file_get_contents($claudeMdPath);
            if ($content !== false) {
                return $content;
            }
        }
    }

    // Fall back to config SYSTEM_PROMPT or default
    if (defined('SYSTEM_PROMPT')) {
        return SYSTEM_PROMPT;
    }

    return 'You are a helpful AI assistant with access to tools for file operations and command execution.';
}

/**
 * Find the path to an agent by ID
 */
function findAgentPath(string $id): ?string
{
    // Check framework directory
    if (defined('FRAMEWORK_DIRECTORY')) {
        // Main framework agent
        $frameworkAgentJson = FRAMEWORK_DIRECTORY . '/agent.json';
        if (file_exists($frameworkAgentJson)) {
            $data = json_decode(file_get_contents($frameworkAgentJson), true);
            if ($data && ($data['name'] ?? '') === $id) {
                return FRAMEWORK_DIRECTORY;
            }
        }

        // Sub-agents in framework
        $subAgentPath = FRAMEWORK_DIRECTORY . '/agents/' . $id;
        if (is_dir($subAgentPath) && file_exists($subAgentPath . '/agent.json')) {
            return $subAgentPath;
        }
    }

    // Check workspace/agents
    if (defined('WORKSPACE_DIRECTORY')) {
        $workspacePath = WORKSPACE_DIRECTORY . '/agents/' . $id;
        if (is_dir($workspacePath) && file_exists($workspacePath . '/agent.json')) {
            return $workspacePath;
        }
    }

    return null;
}

/**
 * Build a system prompt from agent.json data
 */
function buildPromptFromAgentJson(array $data): string
{
    $name = $data['displayName'] ?? $data['name'] ?? 'Agent';
    $description = $data['description'] ?? '';
    $role = $data['role'] ?? '';
    $personality = $data['personality'] ?? '';

    $prompt = "You are {$name}";
    if ($role) {
        $prompt .= ", a {$role}";
    }
    $prompt .= ".\n\n";

    if ($description) {
        $prompt .= "Description: {$description}\n\n";
    }

    if ($personality) {
        $prompt .= "Personality: {$personality}\n\n";
    }

    // Add skills if available
    $skills = $data['skills'] ?? [];
    if (!empty($skills)) {
        $prompt .= "Your skills include:\n";
        foreach ($skills as $skill) {
            $skillName = $skill['name'] ?? $skill['id'] ?? 'Unknown';
            $skillDesc = $skill['description'] ?? '';
            $prompt .= "- {$skillName}: {$skillDesc}\n";
        }
    }

    return $prompt;
}

/**
 * Main chat handler
 */
function handleChat(): void
{
    // Get request body
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    if (!$data) {
        sendError('Invalid JSON input');
    }

    $messages = $data['messages'] ?? [];
    $agentId = $data['agentId'] ?? null;

    // Load system prompt for the selected agent
    $systemPrompt = loadAgentPrompt($agentId);

    if (empty($messages)) {
        sendError('No messages provided');
    }

    // Get tool definitions
    $tools = getToolDefinitions();

    // Process messages (may involve multiple API calls for tool use)
    $maxIterations = 10; // Prevent infinite loops
    $iteration = 0;

    try {
        while ($iteration < $maxIterations) {
            $iteration++;

            // Make streaming request
            $response = processStreamingResponse($messages, $tools, $systemPrompt);

            // Check if we have tool uses to process
            if (!empty($response['tool_use']) && $response['stop_reason'] === 'tool_use') {
                // Add assistant message with tool uses
                $assistantContent = [];
                foreach ($response['content_blocks'] as $block) {
                    $assistantContent[] = $block;
                }
                foreach ($response['tool_use'] as $toolUse) {
                    $assistantContent[] = $toolUse;
                }

                $messages[] = [
                    'role' => 'assistant',
                    'content' => $assistantContent
                ];

                // Execute each tool and collect results
                $toolResults = [];
                foreach ($response['tool_use'] as $toolUse) {
                    $toolName = $toolUse['name'];
                    $toolInput = $toolUse['input'];
                    $toolId = $toolUse['id'];

                    // Execute the tool
                    $result = executeTool($toolName, $toolInput);

                    // Send tool result event
                    sendEvent('tool_result', [
                        'id' => $toolId,
                        'name' => $toolName,
                        'input' => $toolInput,
                        'result' => $result
                    ]);

                    // Format result for API
                    $resultContent = $result['content'] ?? $result['message'] ?? json_encode($result);
                    $toolResults[] = [
                        'type' => 'tool_result',
                        'tool_use_id' => $toolId,
                        'content' => $resultContent
                    ];
                }

                // Add tool results as user message
                $messages[] = [
                    'role' => 'user',
                    'content' => $toolResults
                ];

                // Continue the loop to get Claude's response
                continue;
            }

            // No more tool uses, we're done
            break;
        }

        sendEvent('done', ['success' => true]);

    } catch (Exception $e) {
        sendError($e->getMessage());
    }
}

// Run the handler
handleChat();
