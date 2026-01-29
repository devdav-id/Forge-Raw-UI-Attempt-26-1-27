<?php
/**
 * Chat History API
 *
 * Manages chat history files in workspace/chat-history/
 *
 * Endpoints:
 *   GET    /history.php           - List all conversations
 *   GET    /history.php?id=xxx    - Load specific conversation
 *   POST   /history.php           - Save/update conversation
 *   DELETE /history.php?id=xxx    - Delete conversation
 */

require_once 'config.php';

header('Content-Type: application/json');

// Ensure chat-history directory exists
$historyDir = WORKSPACE_DIRECTORY . '/chat-history';
if (!is_dir($historyDir)) {
    mkdir($historyDir, 0755, true);
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        if (isset($_GET['id'])) {
            // Load specific conversation
            loadConversation($_GET['id'], $historyDir);
        } else {
            // List all conversations
            listConversations($historyDir);
        }
        break;

    case 'POST':
        // Save/update conversation
        saveConversation($historyDir);
        break;

    case 'DELETE':
        if (isset($_GET['id'])) {
            deleteConversation($_GET['id'], $historyDir);
        } else {
            http_response_code(400);
            echo json_encode(['error' => 'Missing conversation ID']);
        }
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}

/**
 * List all conversations, sorted by updated date (newest first)
 */
function listConversations(string $historyDir): void {
    $conversations = [];

    $files = glob($historyDir . '/*.json');

    foreach ($files as $file) {
        $content = file_get_contents($file);
        $data = json_decode($content, true);

        if ($data) {
            $conversations[] = [
                'id' => $data['id'] ?? basename($file, '.json'),
                'title' => $data['title'] ?? 'Untitled',
                'created' => $data['created'] ?? filemtime($file),
                'updated' => $data['updated'] ?? filemtime($file),
                'messageCount' => count($data['messages'] ?? [])
            ];
        }
    }

    // Sort by updated date, newest first
    usort($conversations, function($a, $b) {
        return $b['updated'] - $a['updated'];
    });

    echo json_encode([
        'success' => true,
        'conversations' => $conversations
    ]);
}

/**
 * Load a specific conversation
 */
function loadConversation(string $id, string $historyDir): void {
    $filePath = $historyDir . '/' . sanitizeFilename($id) . '.json';

    if (!file_exists($filePath)) {
        http_response_code(404);
        echo json_encode(['error' => 'Conversation not found']);
        return;
    }

    $content = file_get_contents($filePath);
    $data = json_decode($content, true);

    if (!$data) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to parse conversation']);
        return;
    }

    echo json_encode([
        'success' => true,
        'conversation' => $data
    ]);
}

/**
 * Save or update a conversation
 */
function saveConversation(string $historyDir): void {
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    if (!$data) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON']);
        return;
    }

    // Generate ID if not provided
    if (empty($data['id'])) {
        $data['id'] = generateId();
    }

    // Set timestamps
    $now = time();
    if (empty($data['created'])) {
        $data['created'] = $now;
    }
    $data['updated'] = $now;

    // Generate title from first user message if not set
    if (empty($data['title']) && !empty($data['messages'])) {
        foreach ($data['messages'] as $msg) {
            if (($msg['role'] ?? '') === 'user') {
                $data['title'] = truncateTitle($msg['content'] ?? 'New conversation');
                break;
            }
        }
    }

    if (empty($data['title'])) {
        $data['title'] = 'New conversation';
    }

    $filePath = $historyDir . '/' . sanitizeFilename($data['id']) . '.json';

    $result = file_put_contents($filePath, json_encode($data, JSON_PRETTY_PRINT));

    if ($result === false) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save conversation']);
        return;
    }

    echo json_encode([
        'success' => true,
        'id' => $data['id'],
        'title' => $data['title'],
        'updated' => $data['updated']
    ]);
}

/**
 * Delete a conversation
 */
function deleteConversation(string $id, string $historyDir): void {
    $filePath = $historyDir . '/' . sanitizeFilename($id) . '.json';

    if (!file_exists($filePath)) {
        http_response_code(404);
        echo json_encode(['error' => 'Conversation not found']);
        return;
    }

    if (!unlink($filePath)) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to delete conversation']);
        return;
    }

    echo json_encode([
        'success' => true,
        'message' => 'Conversation deleted'
    ]);
}

/**
 * Generate a unique ID
 */
function generateId(): string {
    return date('Ymd_His') . '_' . bin2hex(random_bytes(4));
}

/**
 * Sanitize filename to prevent directory traversal
 */
function sanitizeFilename(string $filename): string {
    // Remove any path separators and special characters
    return preg_replace('/[^a-zA-Z0-9_-]/', '', $filename);
}

/**
 * Truncate title to reasonable length
 */
function truncateTitle(string $text, int $maxLength = 50): string {
    $text = trim($text);
    $text = preg_replace('/\s+/', ' ', $text); // Normalize whitespace

    if (strlen($text) <= $maxLength) {
        return $text;
    }

    return substr($text, 0, $maxLength - 3) . '...';
}
