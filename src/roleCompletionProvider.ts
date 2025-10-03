/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *	http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import * as vscode from 'vscode';

export const ICONS = [
    'accessibility', 'aggregate', 'analyzeEvent', 'annotation', 'anomaly_chart', 'anomaly_swim_lane', 'apm_trace', 'app_add_data', 'app_advanced_settings', 'app_agent', 'app_apm', 'app_app_search', 'app_auditbeat', 'app_canvas', 'app_cases', 'app_code', 'app_console', 'app_cross_cluster_replication', 'app_dashboard', 'app_devtools', 'app_discover', 'app_ems', 'app_filebeat', 'app_fleet', 'app_gis', 'app_graph', 'app_grok', 'app_heartbeat', 'app_index_management', 'app_index_pattern', 'app_index_rollup', 'app_lens', 'app_logs', 'app_management', 'app_metricbeat', 'app_metrics', 'app_ml', 'app_monitoring', 'app_notebook', 'app_packetbeat', 'app_pipeline', 'app_recently_viewed', 'app_reporting', 'app_saved_objects', 'app_search_profiler', 'app_security', 'app_security_analytics', 'app_spaces', 'app_sql', 'app_timelion', 'app_upgrade_assistant', 'app_uptime', 'app_users_roles', 'app_visualize', 'app_vulnerability_management', 'app_watches', 'app_workplace_search', 'apps', 'arrowEnd', 'arrowStart', 'arrow_down', 'arrow_left', 'arrow_right', 'arrow_up', 'article', 'asterisk', 'at', 'bell', 'bellSlash', 'beta', 'bolt', 'boxes_horizontal', 'boxes_vertical', 'branch', 'branchUser', 'broom', 'brush', 'bug', 'bullseye', 'calendar', 'change_point_detection', 'check', 'checkCircle', 'checkInCircleFilled', 'cheer', 'clickLeft', 'clickRight', 'clock', 'clockCounter', 'cloudDrizzle', 'cloudStormy', 'cloudSunny', 'cluster', 'code', 'color', 'comment', 'compute', 'console', 'container', 'continuityAbove', 'continuityAboveBelow', 'continuityBelow', 'continuityWithin', 'contrast', 'contrastHigh', 'controls', 'copy', 'copy_clipboard', 'cross', 'cross_in_circle', 'crosshairs', 'currency', 'cut', 'database', 'desktop', 'diff', 'document', 'documentEdit', 'documentation', 'documents', 'dot', 'dotInCircle', 'doubleArrowLeft', 'doubleArrowRight', 'download', 'editorDistributeHorizontal', 'editorDistributeVertical', 'editorItemAlignBottom', 'editorItemAlignCenter', 'editorItemAlignLeft', 'editorItemAlignMiddle', 'editorItemAlignRight', 'editorItemAlignTop', 'editorPositionBottomLeft', 'editorPositionBottomRight', 'editorPositionTopLeft', 'editorPositionTopRight', 'editor_align_center', 'editor_align_left', 'editor_align_right', 'editor_bold', 'editor_checklist', 'editor_heading', 'editor_italic', 'editor_link', 'editor_ordered_list', 'editor_redo', 'editor_strike', 'editor_table', 'editor_underline', 'editor_undo', 'editor_unordered_list', 'email', 'empty', 'endpoint', 'eql', 'eraser', 'error', 'errorFilled', 'esqlVis', 'exit', 'expand', 'expandMini', 'export', 'eye', 'eye_closed', 'face_happy', 'face_neutral', 'face_sad', 'field_statistics', 'filter', 'filterExclude', 'filterIgnore', 'filterInCircle', 'filterInclude', 'flag', 'flask', 'fold', 'folder_check', 'folder_closed', 'folder_exclamation', 'folder_open', 'frameNext', 'framePrevious', 'fullScreenExit', 'full_screen', 'function', 'gear', 'globe', 'grab', 'grabOmnidirectional', 'grab_horizontal', 'gradient', 'grid', 'heart', 'heatmap', 'help', 'home', 'image', 'import', 'index', 'indexTemporary', 'index_close', 'index_edit', 'index_flush', 'index_mapping', 'index_open', 'index_runtime', 'index_settings', 'infinity', 'info', 'inputOutput', 'inspect', 'invert', 'ip', 'key', 'keyboard', 'kql_field', 'kql_function', 'kql_operand', 'kql_selector', 'kql_value', 'kubernetesNode', 'kubernetesPod', 'launch', 'layers', 'lettering', 'lineDashed', 'lineDotted', 'lineSolid', 'link', 'list', 'list_add', 'lock', 'lockOpen', 'log_pattern_analysis', 'log_rate_analysis', 'logo_aerospike', 'logo_apache', 'logo_app_search', 'logo_aws', 'logo_aws_mono', 'logo_azure', 'logo_azure_mono', 'logo_beats', 'logo_business_analytics', 'logo_ceph', 'logo_cloud', 'logo_cloud_ece', 'logo_code', 'logo_codesandbox', 'logo_couchbase', 'logo_docker', 'logo_dropwizard', 'logo_elastic', 'logo_elastic_stack', 'logo_elasticsearch', 'logo_enterprise_search', 'logo_etcd', 'logo_gcp', 'logo_gcp_mono', 'logo_github', 'logo_gmail', 'logo_golang', 'logo_google_g', 'logo_haproxy', 'logo_ibm', 'logo_ibm_mono', 'logo_kafka', 'logo_kibana', 'logo_kubernetes', 'logo_logging', 'logo_logstash', 'logo_maps', 'logo_memcached', 'logo_metrics', 'logo_mongodb', 'logo_mysql', 'logo_nginx', 'logo_observability', 'logo_osquery', 'logo_php', 'logo_postgres', 'logo_prometheus', 'logo_rabbitmq', 'logo_redis', 'logo_security', 'logo_site_search', 'logo_sketch', 'logo_slack', 'logo_uptime', 'logo_vulnerability_management', 'logo_webhook', 'logo_windows', 'logo_workplace_search', 'logstash_filter', 'logstash_if', 'logstash_input', 'logstash_output', 'logstash_queue', 'magnet', 'magnifyWithExclamation', 'magnifyWithMinus', 'magnifyWithPlus', 'map_marker', 'memory', 'menu', 'menuDown', 'menuLeft', 'menuRight', 'menuUp', 'merge', 'minimize', 'minus', 'minus_in_circle', 'minus_in_circle_filled', 'minus_in_square', 'ml_classification_job', 'ml_create_advanced_job', 'ml_create_generic_job', 'ml_create_geo_job', 'ml_create_multi_metric_job', 'ml_create_population_job', 'ml_create_single_metric_job', 'ml_data_visualizer', 'ml_outlier_detection_job', 'ml_regression_job', 'mobile', 'moon', 'move', 'namespace', 'nested', 'new_chat', 'node', 'number', 'offline', 'online', 'package', 'pageSelect', 'pagesSelect', 'paint', 'palette', 'paper_clip', 'partial', 'pause', 'payment', 'pencil', 'percent', 'pin', 'pin_filled', 'pipeBreaks', 'pipeNoBreaks', 'pivot', 'play', 'playFilled', 'plugs', 'plus', 'plus_in_circle', 'plus_in_circle_filled', 'plus_in_square', 'popout', 'push', 'question', 'quote', 'readOnly', 'refresh', 'reporter', 'return_key', 'save', 'scale', 'search', 'section', 'securitySignal', 'securitySignalDetected', 'securitySignalResolved', 'sessionViewer', 'shard', 'share', 'single_metric_viewer', 'snowflake', 'sortAscending', 'sortDescending', 'sortLeft', 'sortRight', 'sort_down', 'sort_up', 'sortable', 'spaces', 'sparkles', 'starPlusEmpty', 'starPlusFilled', 'star_empty', 'star_empty_space', 'star_filled', 'star_filled_space', 'star_minus_empty', 'star_minus_filled', 'stats', 'stop', 'stop_filled', 'stop_slash', 'storage', 'string', 'submodule', 'sun', 'swatch_input', 'symlink', 'tableOfContents', 'table_density_compact', 'table_density_expanded', 'table_density_normal', 'tag', 'tear', 'temperature', 'timeRefresh', 'timeline', 'timelineWithArrow', 'timeslider', 'training', 'transitionLeftIn', 'transitionLeftOut', 'transitionTopIn', 'transitionTopOut', 'trash', 'unfold', 'unlink', 'user', 'users', 'vector', 'videoPlayer', 'vis_area', 'vis_area_stacked', 'vis_bar_horizontal', 'vis_bar_horizontal_stacked', 'vis_bar_vertical', 'vis_bar_vertical_stacked', 'vis_gauge', 'vis_goal', 'vis_line', 'vis_map_coordinate', 'vis_map_region', 'vis_metric', 'vis_pie', 'vis_table', 'vis_tag_cloud', 'vis_text', 'vis_timelion', 'vis_visual_builder', 'warning', 'warningFilled', 'web', 'wordWrap', 'wordWrapDisabled', 'wrench'
];

export const KEYBOARD_SHORTCUTS = [
    'shift', 'ctrl', 'alt', 'option', 'cmd', 'win', 'up', 'down', 'left', 'right', 'space', 'tab', 'enter', 'esc', 'backspace', 'del', 'ins', 'pageup', 'pagedown', 'home', 'end', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12', 'plus', 'fn', 'pipe'
];

export const APPLIES_TO_KEYS = [
    'stack', 'deployment', 'serverless', 'product',
    'ece', 'eck', 'ess', 'self',
    'elasticsearch', 'observability', 'security',
    'ecctl', 'curator',
    'apm_agent_android', 'apm_agent_dotnet', 'apm_agent_go', 'apm_agent_ios',
    'apm_agent_java', 'apm_agent_node', 'apm_agent_php', 'apm_agent_python',
    'apm_agent_ruby', 'apm_agent_rum',
    'edot_ios', 'edot_android', 'edot_dotnet', 'edot_java', 'edot_node',
    'edot_php', 'edot_python', 'edot_cf_aws', 'edot_cf_azure', 'edot_collector'
];

export const LIFECYCLE_STATES = [
    'ga', 'preview', 'beta', 'deprecated', 'removed',
    'unavailable', 'planned', 'development', 'discontinued'
];

export class RoleCompletionProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken,
        _context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        try {
            const lineText = document.lineAt(position).text;
            const textBefore = lineText.substring(0, position.character);
        
        // Check for {icon}` pattern
        if (textBefore.endsWith('{icon}`')) {
            return this.getIconCompletions();
        }

        // Check for {kbd}` pattern
        if (textBefore.endsWith('{kbd}`')) {
            return this.getKeyboardCompletions();
        }

        // Check for {applies_to}` pattern
        if (textBefore.endsWith('{applies_to}`')) {
            return this.getAppliesToCompletions();
        }

        // Check for incomplete {icon, {kbd, or {applies_to
        if (textBefore.match(/\{(icon|kbd|applies_to)$/)) {
            const roleType = textBefore.match(/\{(icon|kbd|applies_to)$/)?.[1];
            if (roleType === 'icon') {
                return this.getRoleCompletion('icon', 'Insert icon role');
            } else if (roleType === 'kbd') {
                return this.getRoleCompletion('kbd', 'Insert keyboard shortcut role');
            } else if (roleType === 'applies_to') {
                return this.getRoleCompletion('applies_to', 'Insert applies_to role');
            }
        }
            
            return [];
        } catch (error) {
            // If there's an error during completion, return empty array to avoid breaking the editor
            return [];
        }
    }
    
    private getRoleCompletion(roleType: string, description: string): vscode.CompletionItem[] {
        const item = new vscode.CompletionItem(
            `{${roleType}}`,
            vscode.CompletionItemKind.Function
        );

        let sampleValue = 'enter';
        if (roleType === 'icon') {
            sampleValue = 'check';
        } else if (roleType === 'applies_to') {
            sampleValue = 'stack: ga 9.0';
        }

        item.insertText = new vscode.SnippetString(`{${roleType}}\`\${1:${sampleValue}}\``);
        item.detail = description;
        item.documentation = new vscode.MarkdownString(`Insert ${roleType} role with sample value`);

        return [item];
    }
    
    private getIconCompletions(): vscode.CompletionItem[] {
        return ICONS.map(icon => {
            const item = new vscode.CompletionItem(
                icon,
                vscode.CompletionItemKind.Value
            );
            
            item.insertText = icon;
            item.detail = 'Icon name';
            item.documentation = new vscode.MarkdownString(`Insert ${icon} icon`);
            
            return item;
        });
    }
    
    private getKeyboardCompletions(): vscode.CompletionItem[] {
        const completions: vscode.CompletionItem[] = [];
        
        // Add predefined keyboard shortcuts
        KEYBOARD_SHORTCUTS.forEach(key => {
            const item = new vscode.CompletionItem(
                key,
                vscode.CompletionItemKind.Value
            );
            
            item.insertText = key;
            item.detail = 'Keyboard key';
            item.documentation = new vscode.MarkdownString(`Insert ${key} key`);
            
            completions.push(item);
        });
        
        // Add common combinations
        const combinations = [
            'cmd+c', 'cmd+v', 'cmd+x', 'cmd+z', 'cmd+shift+z',
            'ctrl+c', 'ctrl+v', 'ctrl+x', 'ctrl+z', 'ctrl+y',
            'ctrl|cmd + c', 'ctrl|cmd + v', 'shift+enter'
        ];
        
        combinations.forEach(combo => {
            const item = new vscode.CompletionItem(
                combo,
                vscode.CompletionItemKind.Value
            );
            
            item.insertText = combo;
            item.detail = 'Keyboard combination';
            item.documentation = new vscode.MarkdownString(`Insert ${combo} key combination`);
            
            completions.push(item);
        });
        
        return completions;
    }

    private getAppliesToCompletions(): vscode.CompletionItem[] {
        const completions: vscode.CompletionItem[] = [];

        // Add product/deployment keys with lifecycle states
        APPLIES_TO_KEYS.forEach(key => {
            LIFECYCLE_STATES.forEach(state => {
                const item = new vscode.CompletionItem(
                    `${key}: ${state}`,
                    vscode.CompletionItemKind.Value
                );

                item.insertText = `${key}: ${state}`;
                item.detail = `${key} - ${state}`;
                item.documentation = new vscode.MarkdownString(`Insert \`${key}: ${state}\` applies_to value`);
                item.sortText = `1-${key}-${state}`;

                completions.push(item);
            });
        });

        // Add common patterns with version numbers
        const commonPatterns = [
            'stack: ga 9.0',
            'stack: ga 9.1',
            'stack: preview 9.0',
            'serverless: ga',
            'deployment: { ess: ga, ece: ga }',
            'edot_collector: ga 9.2',
            'edot_java: ga 1.0'
        ];

        commonPatterns.forEach(pattern => {
            const item = new vscode.CompletionItem(
                pattern,
                vscode.CompletionItemKind.Snippet
            );

            item.insertText = pattern;
            item.detail = 'Common pattern';
            item.documentation = new vscode.MarkdownString(`Insert common applies_to pattern: \`${pattern}\``);
            item.sortText = `0-${pattern}`;

            completions.push(item);
        });

        return completions;
    }
}