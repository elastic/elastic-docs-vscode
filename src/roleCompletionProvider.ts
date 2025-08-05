import * as vscode from 'vscode';

/**
 * Elastic UI icon names supported in documentation
 */
export const ICONS = [
    'accessibility', 'aggregate', 'analyzeEvent', 'annotation', 'anomaly_chart', 
    'anomaly_swim_lane', 'apm_trace', 'app_add_data', 'app_advanced_settings', 
    'app_agent', 'app_apm', 'app_app_search', 'app_auditbeat', 'app_canvas', 
    'app_cases', 'app_code', 'app_console', 'app_cross_cluster_replication', 
    'app_dashboard', 'app_devtools', 'app_discover', 'app_ems', 'app_filebeat', 
    'app_fleet', 'app_gis', 'app_graph', 'app_grok', 'app_heartbeat', 
    'app_index_management', 'app_index_pattern', 'app_index_rollup', 'app_lens', 
    'app_logs', 'app_management', 'app_metricbeat', 'app_metrics', 'app_ml', 
    'app_monitoring', 'app_notebook', 'app_packetbeat', 'app_pipeline', 
    'app_recently_viewed', 'app_reporting', 'app_saved_objects', 'app_search_profiler', 
    'app_security', 'app_security_analytics', 'app_spaces', 'app_sql', 'app_timelion', 
    'app_upgrade_assistant', 'app_uptime', 'app_users_roles', 'app_visualize', 
    'app_vulnerability_management', 'app_watches', 'app_workplace_search', 'apps', 
    'arrowEnd', 'arrowStart', 'arrow_down', 'arrow_left', 'arrow_right', 'arrow_up', 
    'article', 'asterisk', 'at', 'bell', 'bellSlash', 'beta', 'bolt', 'boxes_horizontal', 
    'boxes_vertical', 'branch', 'branchUser', 'broom', 'brush', 'bug', 'bullseye', 
    'calendar', 'change_point_detection', 'check', 'checkCircle', 'checkInCircleFilled', 
    'cheer', 'clickLeft', 'clickRight', 'clock', 'clockCounter', 'cloudDrizzle', 
    'cloudStormy', 'cloudSunny', 'cluster', 'code', 'color', 'comment', 'compute', 
    'console', 'container', 'continuityAbove', 'continuityAboveBelow', 'continuityBelow', 
    'continuityWithin', 'contrast', 'contrastHigh', 'controls', 'copy', 'copy_clipboard', 
    'cross', 'cross_in_circle', 'crosshairs', 'currency', 'cut', 'database', 'desktop', 
    'diff', 'document', 'documentEdit', 'documentation', 'documents', 'dot', 'dotInCircle', 
    'doubleArrowLeft', 'doubleArrowRight', 'download'
    // Many more icons omitted for brevity
];

/**
 * Keyboard keys supported in documentation
 */
export const KEYBOARD_SHORTCUTS = [
    'shift', 'ctrl', 'alt', 'option', 'cmd', 'win', 'up', 'down', 'left', 'right', 
    'space', 'tab', 'enter', 'esc', 'backspace', 'del', 'ins', 'pageup', 'pagedown', 
    'home', 'end', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 
    'f11', 'f12', 'plus', 'fn', 'pipe'
];

/**
 * Provides intelligent completion for inline icon and keyboard shortcut roles
 */
export class RoleCompletionProvider implements vscode.CompletionItemProvider {
    /**
     * Main entry point for providing role completions
     * @param document The current text document
     * @param position The cursor position
     * @param _token Cancellation token
     * @param _context Completion context
     * @returns Array of completion items based on context
     */
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken,
        _context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        try {
            // Get text leading up to cursor position
            const lineText = document.lineAt(position).text;
            const textBeforeCursor = lineText.substring(0, position.character);
            
            // Analyze the text to determine what completion to show
            return this.analyzeRoleContext(textBeforeCursor);
        } catch (error) {
            console.error('Error in role completion:', error);
            return [];
        }
    }
    
    /**
     * Analyzes text before cursor to determine what completions to offer
     * @param textBeforeCursor Text up to the cursor position
     * @returns Array of CompletionItems based on context
     */
    private analyzeRoleContext(textBeforeCursor: string): vscode.CompletionItem[] {
        // Case 1: Ready for icon content suggestion after {icon}`
        if (textBeforeCursor.endsWith('{icon}`')) {
            return this.generateIconCompletions();
        }
        
        // Case 2: Ready for keyboard shortcut content after {kbd}`
        if (textBeforeCursor.endsWith('{kbd}`')) {
            return this.generateKeyboardCompletions();
        }
        
        // Case 3: Incomplete role tag - suggest completion for role type
        const roleTypeMatch = textBeforeCursor.match(/\{(icon|kbd)$/);
        if (roleTypeMatch) {
            const roleType = roleTypeMatch[1];
            if (roleType === 'icon') {
                return this.generateRoleTagCompletion('icon', 'Insert icon reference');
            } else if (roleType === 'kbd') {
                return this.generateRoleTagCompletion('kbd', 'Insert keyboard shortcut reference');
            }
        }
        
        return [];
    }
    
    /**
     * Creates a completion item for the role tag itself
     * @param roleType The type of role (icon or kbd)
     * @param description Human-readable description
     * @returns Array with a single CompletionItem for the role
     */
    private generateRoleTagCompletion(roleType: string, description: string): vscode.CompletionItem[] {
        // Create the completion item
        const item = new vscode.CompletionItem(
            `{${roleType}}`,
            vscode.CompletionItemKind.Function
        );
        
        // Determine placeholder value based on role type
        const placeholderValue = roleType === 'icon' ? 'check' : 'enter';
        
        // Create snippet with backticks and placeholder
        item.insertText = new vscode.SnippetString(`{${roleType}}\`\${1:${placeholderValue}}\``);
        
        // Add helpful details
        item.detail = description;
        item.documentation = new vscode.MarkdownString(
            `Inserts a ${roleType} role with a placeholder value`
        );
        
        return [item];
    }
    
    /**
     * Generates completions for all available icons
     * @returns Array of CompletionItems for icons
     */
    private generateIconCompletions(): vscode.CompletionItem[] {
        return ICONS.map(iconName => {
            // Create the completion item
            const item = new vscode.CompletionItem(
                iconName,
                vscode.CompletionItemKind.Value
            );
            
            // Configure item properties
            item.insertText = iconName;
            item.detail = 'Elastic UI icon';
            item.documentation = new vscode.MarkdownString(
                `Inserts the "${iconName}" icon`
            );
            
            return item;
        });
    }
    
    /**
     * Generates completions for keyboard shortcuts
     * @returns Array of CompletionItems for keyboard shortcuts
     */
    private generateKeyboardCompletions(): vscode.CompletionItem[] {
        const completions: vscode.CompletionItem[] = [];
        
        // Add individual key completions
        KEYBOARD_SHORTCUTS.forEach(keyName => {
            // Create the completion item
            const item = new vscode.CompletionItem(
                keyName,
                vscode.CompletionItemKind.Value
            );
            
            // Configure item properties
            item.insertText = keyName;
            item.detail = 'Keyboard key';
            item.documentation = new vscode.MarkdownString(
                `Inserts the "${keyName}" key reference`
            );
            
            completions.push(item);
        });
        
        // Add common key combinations
        const commonCombinations = [
            'cmd+c', 'cmd+v', 'cmd+x', 'cmd+z', 'cmd+shift+z',
            'ctrl+c', 'ctrl+v', 'ctrl+x', 'ctrl+z', 'ctrl+y',
            'ctrl|cmd + c', 'ctrl|cmd + v', 'shift+enter'
        ];
        
        commonCombinations.forEach(combo => {
            // Create the completion item
            const item = new vscode.CompletionItem(
                combo,
                vscode.CompletionItemKind.Value
            );
            
            // Configure item properties
            item.insertText = combo;
            item.detail = 'Key combination';
            item.documentation = new vscode.MarkdownString(
                `Inserts the "${combo}" key combination`
            );
            
            completions.push(item);
        });
        
        return completions;
    }
}