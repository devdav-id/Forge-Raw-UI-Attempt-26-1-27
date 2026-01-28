<?php
/**
 * Forge UI - Tool Definitions and Execution
 *
 * This file contains all the tools that Claude can use,
 * mimicking the Claude Code terminal experience.
 */

require_once __DIR__ . '/config.php';

/**
 * Get the tool definitions to send to Claude API
 */
function getToolDefinitions(): array
{
    return [
        [
            'name' => 'read_file',
            'description' => 'Read the contents of a file at the specified path. Returns the file content as text.',
            'input_schema' => [
                'type' => 'object',
                'properties' => [
                    'path' => [
                        'type' => 'string',
                        'description' => 'The path to the file to read (relative or absolute)'
                    ]
                ],
                'required' => ['path']
            ]
        ],
        [
            'name' => 'write_file',
            'description' => 'Write content to a file. Creates the file if it does not exist, overwrites if it does.',
            'input_schema' => [
                'type' => 'object',
                'properties' => [
                    'path' => [
                        'type' => 'string',
                        'description' => 'The path to the file to write'
                    ],
                    'content' => [
                        'type' => 'string',
                        'description' => 'The content to write to the file'
                    ]
                ],
                'required' => ['path', 'content']
            ]
        ],
        [
            'name' => 'edit_file',
            'description' => 'Edit a file by replacing a specific string with new content. The old_string must match exactly.',
            'input_schema' => [
                'type' => 'object',
                'properties' => [
                    'path' => [
                        'type' => 'string',
                        'description' => 'The path to the file to edit'
                    ],
                    'old_string' => [
                        'type' => 'string',
                        'description' => 'The exact string to find and replace'
                    ],
                    'new_string' => [
                        'type' => 'string',
                        'description' => 'The string to replace it with'
                    ]
                ],
                'required' => ['path', 'old_string', 'new_string']
            ]
        ],
        [
            'name' => 'list_directory',
            'description' => 'List the contents of a directory. Returns files and subdirectories.',
            'input_schema' => [
                'type' => 'object',
                'properties' => [
                    'path' => [
                        'type' => 'string',
                        'description' => 'The directory path to list (default: current directory)'
                    ]
                ],
                'required' => []
            ]
        ],
        [
            'name' => 'search_files',
            'description' => 'Search for files matching a glob pattern (e.g., "*.php", "src/**/*.js").',
            'input_schema' => [
                'type' => 'object',
                'properties' => [
                    'pattern' => [
                        'type' => 'string',
                        'description' => 'Glob pattern to match files'
                    ],
                    'path' => [
                        'type' => 'string',
                        'description' => 'Base directory to search in (default: current directory)'
                    ]
                ],
                'required' => ['pattern']
            ]
        ],
        [
            'name' => 'search_content',
            'description' => 'Search for a pattern in file contents (like grep). Returns matching lines with file paths.',
            'input_schema' => [
                'type' => 'object',
                'properties' => [
                    'pattern' => [
                        'type' => 'string',
                        'description' => 'The text or regex pattern to search for'
                    ],
                    'path' => [
                        'type' => 'string',
                        'description' => 'File or directory to search in (default: current directory)'
                    ],
                    'file_pattern' => [
                        'type' => 'string',
                        'description' => 'Only search files matching this glob pattern (e.g., "*.php")'
                    ]
                ],
                'required' => ['pattern']
            ]
        ],
        [
            'name' => 'execute_command',
            'description' => 'Execute a shell command and return the output. Use for git, npm, and other CLI tools.',
            'input_schema' => [
                'type' => 'object',
                'properties' => [
                    'command' => [
                        'type' => 'string',
                        'description' => 'The shell command to execute'
                    ],
                    'working_directory' => [
                        'type' => 'string',
                        'description' => 'Directory to run the command in (optional)'
                    ]
                ],
                'required' => ['command']
            ]
        ],
        [
            'name' => 'create_directory',
            'description' => 'Create a new directory (including parent directories if needed).',
            'input_schema' => [
                'type' => 'object',
                'properties' => [
                    'path' => [
                        'type' => 'string',
                        'description' => 'The directory path to create'
                    ]
                ],
                'required' => ['path']
            ]
        ]
    ];
}

/**
 * Execute a tool and return the result
 */
function executeTool(string $toolName, array $input): array
{
    try {
        switch ($toolName) {
            case 'read_file':
                return executeReadFile($input);
            case 'write_file':
                return executeWriteFile($input);
            case 'edit_file':
                return executeEditFile($input);
            case 'list_directory':
                return executeListDirectory($input);
            case 'search_files':
                return executeSearchFiles($input);
            case 'search_content':
                return executeSearchContent($input);
            case 'execute_command':
                return executeCommand($input);
            case 'create_directory':
                return executeCreateDirectory($input);
            default:
                return [
                    'success' => false,
                    'error' => "Unknown tool: {$toolName}"
                ];
        }
    } catch (Exception $e) {
        return [
            'success' => false,
            'error' => $e->getMessage()
        ];
    }
}

/**
 * Check if a path is absolute
 */
function isAbsolutePath(string $path): bool
{
    // Windows absolute path
    if (preg_match('/^[A-Za-z]:/', $path)) {
        return true;
    }
    // Unix absolute path
    if (strpos($path, '/') === 0) {
        return true;
    }
    return false;
}

/**
 * Resolve path for READ operations
 * Searches: 1) Workspace, 2) Framework directory
 */
function resolveReadPath(string $path): string
{
    if (isAbsolutePath($path)) {
        return $path;
    }

    // First check workspace
    if (defined('WORKSPACE_DIRECTORY') && WORKSPACE_DIRECTORY !== '') {
        $workspacePath = WORKSPACE_DIRECTORY . DIRECTORY_SEPARATOR . $path;
        if (file_exists($workspacePath)) {
            return $workspacePath;
        }
    }

    // Then check framework directory
    if (defined('FRAMEWORK_DIRECTORY') && FRAMEWORK_DIRECTORY !== '') {
        $frameworkPath = FRAMEWORK_DIRECTORY . DIRECTORY_SEPARATOR . $path;
        if (file_exists($frameworkPath)) {
            return $frameworkPath;
        }
    }

    // Fall back to workspace path (even if doesn't exist, for error message)
    if (defined('WORKSPACE_DIRECTORY') && WORKSPACE_DIRECTORY !== '') {
        return WORKSPACE_DIRECTORY . DIRECTORY_SEPARATOR . $path;
    }

    return $path;
}

/**
 * Resolve path for WRITE operations
 * Always writes to workspace directory (protects framework files)
 */
function resolveWritePath(string $path): string
{
    if (isAbsolutePath($path)) {
        // Block writes outside workspace
        if (defined('WORKSPACE_DIRECTORY') && WORKSPACE_DIRECTORY !== '') {
            $realWorkspace = realpath(WORKSPACE_DIRECTORY);
            if ($realWorkspace && strpos($path, $realWorkspace) !== 0) {
                // Redirect to workspace
                $basename = basename($path);
                return WORKSPACE_DIRECTORY . DIRECTORY_SEPARATOR . $basename;
            }
        }
        return $path;
    }

    // Always write to workspace
    if (defined('WORKSPACE_DIRECTORY') && WORKSPACE_DIRECTORY !== '') {
        return WORKSPACE_DIRECTORY . DIRECTORY_SEPARATOR . $path;
    }

    return $path;
}

/**
 * Legacy function for backwards compatibility
 */
function resolvePath(string $path): string
{
    return resolveReadPath($path);
}

/**
 * Read file contents
 */
function executeReadFile(array $input): array
{
    $path = resolvePath($input['path'] ?? '');

    if (!file_exists($path)) {
        return [
            'success' => false,
            'error' => "File not found: {$path}"
        ];
    }

    if (!is_readable($path)) {
        return [
            'success' => false,
            'error' => "Cannot read file: {$path}"
        ];
    }

    $content = file_get_contents($path);
    if ($content === false) {
        return [
            'success' => false,
            'error' => "Failed to read file: {$path}"
        ];
    }

    // Add line numbers like Claude Code does
    $lines = explode("\n", $content);
    $numberedContent = '';
    foreach ($lines as $i => $line) {
        $lineNum = $i + 1;
        $numberedContent .= sprintf("%4d\t%s\n", $lineNum, $line);
    }

    return [
        'success' => true,
        'content' => $numberedContent,
        'path' => $path,
        'lines' => count($lines)
    ];
}

/**
 * Write content to a file (always writes to workspace)
 */
function executeWriteFile(array $input): array
{
    $path = resolveWritePath($input['path'] ?? '');
    $content = $input['content'] ?? '';

    // Create directory if it doesn't exist
    $dir = dirname($path);
    if (!is_dir($dir)) {
        if (!mkdir($dir, 0755, true)) {
            return [
                'success' => false,
                'error' => "Failed to create directory: {$dir}"
            ];
        }
    }

    $result = file_put_contents($path, $content);
    if ($result === false) {
        return [
            'success' => false,
            'error' => "Failed to write file: {$path}"
        ];
    }

    return [
        'success' => true,
        'message' => "Successfully wrote " . strlen($content) . " bytes to {$path}",
        'path' => $path,
        'bytes' => strlen($content)
    ];
}

/**
 * Edit a file by replacing a string
 * Reads from framework or workspace, writes to workspace
 */
function executeEditFile(array $input): array
{
    $inputPath = $input['path'] ?? '';
    $readPath = resolveReadPath($inputPath);
    $writePath = resolveWritePath($inputPath);
    $oldString = $input['old_string'] ?? '';
    $newString = $input['new_string'] ?? '';

    if (!file_exists($readPath)) {
        return [
            'success' => false,
            'error' => "File not found: {$readPath}"
        ];
    }

    $content = file_get_contents($readPath);
    if ($content === false) {
        return [
            'success' => false,
            'error' => "Failed to read file: {$readPath}"
        ];
    }

    // Count occurrences
    $count = substr_count($content, $oldString);

    if ($count === 0) {
        return [
            'success' => false,
            'error' => "String not found in file. Make sure old_string matches exactly."
        ];
    }

    if ($count > 1) {
        return [
            'success' => false,
            'error' => "String found {$count} times. Please provide more context to make it unique."
        ];
    }

    // Create directory if needed
    $dir = dirname($writePath);
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }

    // Perform the replacement and write to workspace
    $newContent = str_replace($oldString, $newString, $content);
    $result = file_put_contents($writePath, $newContent);

    if ($result === false) {
        return [
            'success' => false,
            'error' => "Failed to write file: {$writePath}"
        ];
    }

    $note = ($readPath !== $writePath) ? " (copied to workspace)" : "";
    return [
        'success' => true,
        'message' => "Successfully edited {$writePath}{$note}",
        'path' => $writePath
    ];
}

/**
 * List directory contents
 */
function executeListDirectory(array $input): array
{
    $path = resolvePath($input['path'] ?? '.');

    if (!is_dir($path)) {
        return [
            'success' => false,
            'error' => "Not a directory: {$path}"
        ];
    }

    $items = scandir($path);
    if ($items === false) {
        return [
            'success' => false,
            'error' => "Failed to list directory: {$path}"
        ];
    }

    $result = [];
    foreach ($items as $item) {
        if ($item === '.' || $item === '..') {
            continue;
        }

        $fullPath = $path . DIRECTORY_SEPARATOR . $item;
        $type = is_dir($fullPath) ? 'directory' : 'file';
        $size = is_file($fullPath) ? filesize($fullPath) : null;

        $result[] = [
            'name' => $item,
            'type' => $type,
            'size' => $size
        ];
    }

    // Format output
    $output = "Contents of {$path}:\n\n";
    foreach ($result as $item) {
        $icon = $item['type'] === 'directory' ? '[DIR]' : '[FILE]';
        $size = $item['size'] !== null ? " ({$item['size']} bytes)" : '';
        $output .= "{$icon} {$item['name']}{$size}\n";
    }

    return [
        'success' => true,
        'content' => $output,
        'items' => $result,
        'count' => count($result)
    ];
}

/**
 * Search for files matching a pattern
 */
function executeSearchFiles(array $input): array
{
    $pattern = $input['pattern'] ?? '*';
    $basePath = resolvePath($input['path'] ?? '.');

    $matches = globRecursive($basePath, $pattern);

    if (empty($matches)) {
        return [
            'success' => true,
            'content' => "No files found matching pattern: {$pattern}",
            'files' => []
        ];
    }

    $output = "Files matching '{$pattern}':\n\n";
    foreach ($matches as $file) {
        $output .= $file . "\n";
    }

    return [
        'success' => true,
        'content' => $output,
        'files' => $matches,
        'count' => count($matches)
    ];
}

/**
 * Recursive glob function
 */
function globRecursive(string $basePath, string $pattern): array
{
    $results = [];

    // Check if pattern contains directory traversal
    if (strpos($pattern, '**') !== false) {
        // Recursive search
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($basePath, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::SELF_FIRST
        );

        $filePattern = str_replace('**/', '', $pattern);
        $filePattern = str_replace('**', '', $filePattern);

        foreach ($iterator as $file) {
            if ($file->isFile() && fnmatch($filePattern, $file->getFilename())) {
                $results[] = $file->getPathname();
            }
        }
    } else {
        // Simple glob
        $fullPattern = $basePath . DIRECTORY_SEPARATOR . $pattern;
        $matches = glob($fullPattern);
        if ($matches !== false) {
            $results = $matches;
        }
    }

    return $results;
}

/**
 * Search file contents (grep-like)
 */
function executeSearchContent(array $input): array
{
    $pattern = $input['pattern'] ?? '';
    $path = resolvePath($input['path'] ?? '.');
    $filePattern = $input['file_pattern'] ?? '*';

    $results = [];
    $matchCount = 0;

    if (is_file($path)) {
        $files = [$path];
    } else {
        $files = globRecursive($path, '**/' . $filePattern);
        if (empty($files)) {
            $files = globRecursive($path, $filePattern);
        }
    }

    foreach ($files as $file) {
        if (!is_file($file) || !is_readable($file)) {
            continue;
        }

        // Skip binary files
        $mimeType = mime_content_type($file);
        if ($mimeType && strpos($mimeType, 'text') === false && strpos($mimeType, 'application/json') === false) {
            continue;
        }

        $lines = file($file, FILE_IGNORE_NEW_LINES);
        if ($lines === false) {
            continue;
        }

        foreach ($lines as $lineNum => $line) {
            if (preg_match('/' . preg_quote($pattern, '/') . '/i', $line)) {
                $results[] = [
                    'file' => $file,
                    'line' => $lineNum + 1,
                    'content' => $line
                ];
                $matchCount++;

                // Limit results
                if ($matchCount >= 100) {
                    break 2;
                }
            }
        }
    }

    if (empty($results)) {
        return [
            'success' => true,
            'content' => "No matches found for: {$pattern}",
            'matches' => []
        ];
    }

    $output = "Matches for '{$pattern}':\n\n";
    foreach ($results as $match) {
        $output .= "{$match['file']}:{$match['line']}: {$match['content']}\n";
    }

    if ($matchCount >= 100) {
        $output .= "\n(Results truncated at 100 matches)";
    }

    return [
        'success' => true,
        'content' => $output,
        'matches' => $results,
        'count' => $matchCount
    ];
}

/**
 * Execute a shell command (runs in workspace by default)
 */
function executeCommand(array $input): array
{
    $command = $input['command'] ?? '';
    $workingDir = $input['working_directory'] ?? null;

    // Default to workspace directory
    if ($workingDir) {
        $workingDir = resolveWritePath($workingDir);
    } elseif (defined('WORKSPACE_DIRECTORY') && WORKSPACE_DIRECTORY !== '') {
        $workingDir = WORKSPACE_DIRECTORY;
    }

    // Store current directory
    $originalDir = getcwd();

    // Change to working directory
    if ($workingDir && is_dir($workingDir)) {
        chdir($workingDir);
    }

    // Execute command
    $output = [];
    $returnCode = 0;
    exec($command . ' 2>&1', $output, $returnCode);

    // Restore original directory
    chdir($originalDir);

    $outputText = implode("\n", $output);

    return [
        'success' => $returnCode === 0,
        'content' => $outputText,
        'return_code' => $returnCode,
        'command' => $command
    ];
}

/**
 * Create a directory (always in workspace)
 */
function executeCreateDirectory(array $input): array
{
    $path = resolveWritePath($input['path'] ?? '');

    if (is_dir($path)) {
        return [
            'success' => true,
            'message' => "Directory already exists: {$path}"
        ];
    }

    if (!mkdir($path, 0755, true)) {
        return [
            'success' => false,
            'error' => "Failed to create directory: {$path}"
        ];
    }

    return [
        'success' => true,
        'message' => "Successfully created directory: {$path}",
        'path' => $path
    ];
}
