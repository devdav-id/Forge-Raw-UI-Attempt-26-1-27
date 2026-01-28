<?php
/**
 * Forge UI - Info Endpoint
 *
 * Returns configuration and framework info for the UI.
 * Keeps framework data separate from UI code.
 */

require_once __DIR__ . '/config.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$info = [
    'agentName' => defined('AGENT_NAME') ? AGENT_NAME : 'Claude',
    'frameworkDirectory' => defined('FRAMEWORK_DIRECTORY') ? basename(FRAMEWORK_DIRECTORY) : '',
    'workspaceDirectory' => defined('WORKSPACE_DIRECTORY') ? basename(WORKSPACE_DIRECTORY) : '',
    'workingDirectory' => defined('FRAMEWORK_DIRECTORY') ? basename(FRAMEWORK_DIRECTORY) : '', // legacy
    'skills' => [],
];

// Load skills from framework's agent.json if it exists
if (defined('WORKING_DIRECTORY') && WORKING_DIRECTORY !== '') {
    $agentJsonPath = WORKING_DIRECTORY . '/agent.json';
    if (file_exists($agentJsonPath)) {
        $agentData = json_decode(file_get_contents($agentJsonPath), true);
        if ($agentData && isset($agentData['skills'])) {
            foreach ($agentData['skills'] as $skill) {
                $info['skills'][] = [
                    'name' => $skill['name'] ?? 'unknown',
                    'description' => $skill['description'] ?? ''
                ];
            }
        }
    }
}

// If no skills from agent.json, fall back to default tool names
if (empty($info['skills'])) {
    $info['skills'] = [
        ['name' => 'read_file', 'description' => 'Read file contents'],
        ['name' => 'write_file', 'description' => 'Create or overwrite files'],
        ['name' => 'edit_file', 'description' => 'Edit existing files'],
        ['name' => 'list_directory', 'description' => 'List directory contents'],
        ['name' => 'search_files', 'description' => 'Find files by pattern'],
        ['name' => 'search_content', 'description' => 'Search text in files'],
        ['name' => 'execute_command', 'description' => 'Run shell commands'],
        ['name' => 'create_directory', 'description' => 'Create directories'],
    ];
}

echo json_encode($info);
