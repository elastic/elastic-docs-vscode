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

export interface DirectiveDefinition {
    name: string;
    hasArgument: boolean;
    parameters: string[];
    template: string;
    description: string;
}

export const DIRECTIVES: readonly DirectiveDefinition[] = [
    {
        name: 'note',
        hasArgument: false,
        parameters: ['open', 'applies_to'],
        template: ':::{note}\nThis is a note.\n:::',
        description: 'A relevant piece of information with no serious repercussions if ignored.'
    },
    {
        name: 'warning',
        hasArgument: false,
        parameters: ['open', 'applies_to'],
        template: ':::{warning}\nThis is a warning.\n:::',
        description: 'You could permanently lose data or leak sensitive information.'
    },
    {
        name: 'tip',
        hasArgument: false,
        parameters: ['open', 'applies_to'],
        template: ':::{tip}\nThis is a tip.\n:::',
        description: 'Advice to help users make better choices when using a feature.'
    },
    {
        name: 'important',
        hasArgument: false,
        parameters: ['open', 'applies_to'],
        template: ':::{important}\nThis is an important notice.\n:::',
        description: 'Ignoring this information could impact performance or the stability of your system.'
    },
    {
        name: 'admonition',
        hasArgument: false,
        parameters: ['open', 'applies_to'],
        template: ':::{admonition} Custom Title\nContent here...\n:::',
        description: 'A plain admonition with custom title and no further styling.'
    },
    {
        name: 'dropdown',
        hasArgument: true,
        parameters: ['open', 'applies_to'],
        template: ':::{dropdown} Dropdown Title\nDropdown content\n:::',
        description: 'Dropdowns allow you to hide and reveal content on user interaction.'
    },
    {
        name: 'include',
        hasArgument: true,
        parameters: [],
        template: ':::{include} _snippets/reusable-snippet.md\n:::',
        description: 'Include content from another file into any given MD file.'
    },
    {
        name: 'image',
        hasArgument: true,
        parameters: ['alt', 'width', 'height', 'screenshot', 'title'],
        template: ':::{image} /path/to/image.png\n:alt: Image description\n:width: 250px\n:::',
        description: 'Include screenshots, inline images, icons, and more.'
    },
    {
        name: 'diagram',
        hasArgument: true,
        parameters: [],
        template: ':::{diagram} mermaid\nflowchart LR\n    A[Start] --> B{Decision}\n    B -->|Yes| C[Action 1]\n    B -->|No| D[Action 2]\n    C --> E[End]\n    D --> E\n:::',
        description: 'Render various types of diagrams using the Kroki service.'
    },
    {
        name: 'carousel',
        hasArgument: false,
        parameters: ['id', 'max-height'],
        template: '::::{carousel}\n:id: carousel-example\n:max-height: small\n\n:::{image} images/example1.png\n:alt: First image\n:title: First image title\n:::\n\n:::{image} images/example2.png\n:alt: Second image\n:title: Second image title\n:::\n\n::::',
        description: 'Create an image carousel with multiple images.'
    },
    {
        name: 'stepper',
        hasArgument: false,
        parameters: [],
        template: ':::::{stepper}\n\n::::{step} Install\nFirst install the dependencies.\n```shell\nnpm install\n```\n::::\n\n::::{step} Build\nThen build the project.\n```shell\nnpm run build\n```\n::::\n\n:::::',
        description: 'Provide a visual representation of sequential steps.'
    },
    {
        name: 'step',
        hasArgument: true,
        parameters: [],
        template: '::::{step} Step Title\nStep content goes here.\n::::',
        description: 'A single step within a stepper directive.'
    },
    {
        name: 'tab-set',
        hasArgument: false,
        parameters: ['group', 'sync'],
        template: '::::{tab-set}\n:group: example-group\n\n:::{tab-item} Tab #1 title\n:sync: tab1\nThis is where the content for tab #1 goes.\n:::\n\n:::{tab-item} Tab #2 title\n:sync: tab2\nThis is where the content for tab #2 goes.\n:::\n\n::::',
        description: 'Create tabbed content with multiple tab items.'
    },
    {
        name: 'tab-item',
        hasArgument: true,
        parameters: ['sync'],
        template: ':::{tab-item} Tab Title\n:sync: tab-id\nTab content goes here.\n:::',
        description: 'A single tab within a tab-set directive.'
    },
    {
        name: 'applies-switch',
        hasArgument: false,
        parameters: [],
        template: '::::{applies-switch}\n\n:::{applies-item} stack:\nContent for Stack\n:::\n\n:::{applies-item} serverless:\nContent for Serverless\n:::\n\n::::',
        description: 'Create tabbed content where each tab displays an applies_to badge instead of text titles.'
    },
    {
        name: 'applies-item',
        hasArgument: true,
        parameters: [],
        template: ':::{applies-item} stack:\nContent for this applicability\n:::',
        description: 'A single item within an applies-switch directive.'
    },
    {
        name: 'csv-include',
        hasArgument: true,
        parameters: ['caption', 'separator'],
        template: ':::{csv-include} _snippets/sample-data.csv\n:caption: Sample user data from the database\n:::',
        description: 'Include and render CSV files as formatted tables.'
    },
];

export const PARAMETER_VALUES: { [key: string]: string[] } = {
    'max-height': ['small', 'medium', 'none'],
    'group': ['languages', 'platforms', 'examples'],
    'sync': ['java', 'golang', 'python', 'javascript', 'curl'],
    'width': ['100px', '200px', '250px', '300px', '400px', '500px', '100%'],
    'height': ['100px', '200px', '300px', '400px', '500px'],
    'alt': ['Image description', 'Screenshot', 'Diagram', 'Icon'],
    'separator': [',', ';', '|', 'tab'],
    'caption': ['Table caption']
};