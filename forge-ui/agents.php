<?php
/**
 * Agents API
 *
 * Lists available agents from frameworks and workspace directories.
 *
 * Endpoints:
 *   GET /agents.php           - List all agents
 *   GET /agents.php?id=xxx    - Get specific agent details
 */

require_once 'config.php';

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

if (isset($_GET['id'])) {
    getAgentDetails($_GET['id']);
} else {
    listAgents();
}

/**
 * List all available agents
 */
function listAgents(): void {
    $agents = [];

    // Scan framework directory for agents
    if (defined('FRAMEWORK_DIRECTORY') && is_dir(FRAMEWORK_DIRECTORY)) {
        $frameworkAgent = scanAgent(FRAMEWORK_DIRECTORY, 'framework');
        if ($frameworkAgent) {
            $agents[] = $frameworkAgent;
        }

        // Check for sub-agents in framework
        $frameworkAgentsDir = FRAMEWORK_DIRECTORY . '/agents';
        if (is_dir($frameworkAgentsDir)) {
            $subAgents = scanAgentsDirectory($frameworkAgentsDir, 'framework');
            $agents = array_merge($agents, $subAgents);
        }
    }

    // Scan workspace/agents directory
    if (defined('WORKSPACE_DIRECTORY')) {
        $workspaceAgentsDir = WORKSPACE_DIRECTORY . '/agents';
        if (is_dir($workspaceAgentsDir)) {
            $workspaceAgents = scanAgentsDirectory($workspaceAgentsDir, 'workspace');
            $agents = array_merge($agents, $workspaceAgents);
        }
    }

    echo json_encode([
        'success' => true,
        'agents' => $agents
    ]);
}

/**
 * Get details for a specific agent
 */
function getAgentDetails(string $id): void {
    $agentPath = findAgentPath($id);

    if (!$agentPath) {
        http_response_code(404);
        echo json_encode(['error' => 'Agent not found']);
        return;
    }

    $agent = scanAgent($agentPath, 'unknown');

    if (!$agent) {
        http_response_code(404);
        echo json_encode(['error' => 'Could not load agent']);
        return;
    }

    // Load full CLAUDE.md if available
    $claudeMdPath = $agentPath . '/CLAUDE.md';
    if (file_exists($claudeMdPath)) {
        $agent['systemPrompt'] = file_get_contents($claudeMdPath);
    }

    echo json_encode([
        'success' => true,
        'agent' => $agent
    ]);
}

/**
 * Find the path to an agent by ID
 */
function findAgentPath(string $id): ?string {
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
 * Scan a directory for agents (each subdirectory with agent.json)
 */
function scanAgentsDirectory(string $directory, string $source): array {
    $agents = [];

    $items = scandir($directory);
    foreach ($items as $item) {
        if ($item === '.' || $item === '..') continue;

        $agentDir = $directory . '/' . $item;
        if (is_dir($agentDir)) {
            $agent = scanAgent($agentDir, $source);
            if ($agent) {
                $agents[] = $agent;
            }
        }
    }

    return $agents;
}

/**
 * Scan a single agent directory and return agent info
 */
function scanAgent(string $agentDir, string $source): ?array {
    $agentJsonPath = $agentDir . '/agent.json';

    if (!file_exists($agentJsonPath)) {
        return null;
    }

    $content = file_get_contents($agentJsonPath);
    $data = json_decode($content, true);

    if (!$data) {
        return null;
    }

    // Build agent info
    $agent = [
        'id' => $data['name'] ?? basename($agentDir),
        'name' => $data['displayName'] ?? $data['name'] ?? basename($agentDir),
        'description' => $data['description'] ?? '',
        'version' => $data['version'] ?? '1.0.0',
        'role' => $data['role'] ?? null,
        'personality' => $data['personality'] ?? null,
        'source' => $source,
        'path' => $agentDir,
        'hasClaudeMd' => file_exists($agentDir . '/CLAUDE.md'),
        'skillCount' => count($data['skills'] ?? [])
    ];

    // Generate a short intro from description and personality
    $agent['intro'] = generateIntro($agent);

    return $agent;
}

/**
 * Generate a short introduction for the agent
 */
function generateIntro(array $agent): string {
    $name = $agent['name'];
    $desc = $agent['description'];
    $role = $agent['role'] ?? null;
    $personality = $agent['personality'] ?? null;

    $intro = "I'm {$name}";

    if ($role) {
        $intro .= ", your {$role}";
    }

    $intro .= ". " . $desc;

    if ($personality) {
        $intro .= " " . $personality;
    }

    return $intro;
}
