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

import { PRODUCTS } from './products';

// Embedded frontmatter schema for Elastic Documentation
export const frontmatterSchema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Elastic Documentation Frontmatter Schema",
  "description": "Complete schema for Elastic documentation frontmatter, including applies_to metadata and all other supported fields",
  "type": "object",
  "properties": {
    "title": {
      "type": "string",
      "description": "Page title for the document. Used for page metadata and display purposes."
    },
    "description": {
      "type": "string",
      "description": "Page description for search engines and social media. Recommended to be around 150 characters. If not set, will be auto-generated from page content.",
      "maxLength": 200
    },
    "navigation_title": {
      "type": "string",
      "description": "Custom title for navigation features: appears in left nav (table of contents), breadcrumbs, and previous/next links. If not set, uses the first heading (H1)."
    },
    "sub": {
      "type": "object",
      "description": "Substitution variables for the page. These can be referenced in the content using {{variable_name}} syntax.",
      "additionalProperties": {
        "type": "string"
      }
    },
    "layout": {
      "type": "string",
      "enum": ["landing-page", "not-found", "archive"],
      "description": "Page layout template to use for rendering. Affects the visual presentation and structure of the page."
    },
    "applies_to": {
      "type": "object",
      "description": "Root object containing all applicability information",
      "properties": {
        "stack": {
          "$ref": "#/definitions/appliesCollection",
          "description": "Elastic Stack applicability across all components"
        },
        "deployment": {
          "$ref": "#/definitions/deploymentApplicability",
          "description": "Deployment model specific applicability"
        },
        "serverless": {
          "$ref": "#/definitions/serverlessProjectApplicability",
          "description": "Serverless project specific applicability"
        },
        "product": {
          "$ref": "#/definitions/appliesCollection",
          "description": "General product applicability (legacy field)"
        },
        "ecctl": {
          "$ref": "#/definitions/appliesCollection",
          "description": "ecctl tool applicability"
        },
        "curator": {
          "$ref": "#/definitions/appliesCollection",
          "description": "Curator tool applicability"
        },
        "apm_agent_android": {
          "$ref": "#/definitions/appliesCollection",
          "description": "APM Android agent applicability"
        },
        "apm_agent_dotnet": {
          "$ref": "#/definitions/appliesCollection",
          "description": "APM .NET agent applicability"
        },
        "apm_agent_go": {
          "$ref": "#/definitions/appliesCollection",
          "description": "APM Go agent applicability"
        },
        "apm_agent_ios": {
          "$ref": "#/definitions/appliesCollection",
          "description": "APM iOS agent applicability"
        },
        "apm_agent_java": {
          "$ref": "#/definitions/appliesCollection",
          "description": "APM Java agent applicability"
        },
        "apm_agent_node": {
          "$ref": "#/definitions/appliesCollection",
          "description": "APM Node.js agent applicability"
        },
        "apm_agent_php": {
          "$ref": "#/definitions/appliesCollection",
          "description": "APM PHP agent applicability"
        },
        "apm_agent_python": {
          "$ref": "#/definitions/appliesCollection",
          "description": "APM Python agent applicability"
        },
        "apm_agent_ruby": {
          "$ref": "#/definitions/appliesCollection",
          "description": "APM Ruby agent applicability"
        },
        "apm_agent_rum": {
          "$ref": "#/definitions/appliesCollection",
          "description": "APM RUM agent applicability"
        },
        "edot_ios": {
          "$ref": "#/definitions/appliesCollection",
          "description": "Elastic iOS applicability"
        },
        "edot_android": {
          "$ref": "#/definitions/appliesCollection",
          "description": "Elastic Android applicability"
        },
        "edot_dotnet": {
          "$ref": "#/definitions/appliesCollection",
          "description": "Elastic .NET applicability"
        },
        "edot_java": {
          "$ref": "#/definitions/appliesCollection",
          "description": "Elastic Java applicability"
        },
        "edot_node": {
          "$ref": "#/definitions/appliesCollection",
          "description": "Elastic Node.js applicability"
        },
        "edot_php": {
          "$ref": "#/definitions/appliesCollection",
          "description": "Elastic PHP applicability"
        },
        "edot_python": {
          "$ref": "#/definitions/appliesCollection",
          "description": "Elastic Python applicability"
        },
        "edot_cf_aws": {
          "$ref": "#/definitions/appliesCollection",
          "description": "Elastic CloudFormation AWS applicability"
        },
        "edot_cf_azure": {
          "$ref": "#/definitions/appliesCollection",
          "description": "Elastic CloudFormation Azure applicability"
        },
        "edot_cf_gcp": {
          "$ref": "#/definitions/appliesCollection",
          "description": "Elastic Cloud Forwarder GCP applicability"
        },
        "edot_collector": {
          "$ref": "#/definitions/appliesCollection",
          "description": "Elastic Collector applicability"
        }
      },
      "additionalProperties": false
    },
    "mapped_pages": {
      "type": "array",
      "description": "List of page paths that this page maps to. Used for legacy URL mapping and redirects.",
      "items": {
        "type": "string"
      }
    },
    "products": {
      "type": "array",
      "description": "List of products that the page relates to. Used for the 'Products' filter in the Search UI. Not displayed on docs pages.",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "enum": Object.keys(PRODUCTS),
            "description": "Product identifier. Must match one of the predefined product IDs."
          }
        },
        "required": ["id"],
        "additionalProperties": false
      }
    }
  },
  "additionalProperties": false,
  "definitions": {
    "appliesCollection": {
      "oneOf": [
        {
          "type": "string",
          "enum": ["ga", "preview", "beta", "deprecated", "removed", "unavailable", "planned", "development", "discontinued"],
          "description": "Simple lifecycle state without version"
        },
        {
          "type": "string",
          "pattern": "^(preview|beta|ga|deprecated|removed|unavailable|planned|development|discontinued)(\\s+(all|=[0-9]+(\\.[0-9]+)*|[0-9]+(\\.[0-9]+)*-[0-9]+(\\.[0-9]+)*|[0-9]+(\\.[0-9]+)*\\+?))?(,\\s*(preview|beta|ga|deprecated|removed|unavailable|planned|development|discontinued)(\\s+(all|=[0-9]+(\\.[0-9]+)*|[0-9]+(\\.[0-9]+)*-[0-9]+(\\.[0-9]+)*|[0-9]+(\\.[0-9]+)*\\+?))?)*$",
          "description": "Lifecycle state with optional version specifier (all, =x.x, x.x-y.y, x.x, x.x+), supports multiple comma-separated entries"
        }
      ],
      "description": "AppliesCollection supports: lifecycle state alone, with 'all', with version (x.x, x.x+), with exact version (=x.x), with range (x.x-y.y), or comma-separated combinations"
    },
    "deploymentApplicability": {
      "type": "object",
      "properties": {
        "self": {
          "$ref": "#/definitions/appliesCollection",
          "description": "Self-managed deployment applicability"
        },
        "ece": {
          "$ref": "#/definitions/appliesCollection",
          "description": "Elastic Cloud Enterprise applicability"
        },
        "eck": {
          "$ref": "#/definitions/appliesCollection",
          "description": "Elastic Cloud on Kubernetes applicability"
        },
        "ess": {
          "$ref": "#/definitions/appliesCollection",
          "description": "Elastic Cloud (ESS) applicability"
        }
      },
      "additionalProperties": false
    },
    "serverlessProjectApplicability": {
      "type": "object",
      "properties": {
        "elasticsearch": {
          "$ref": "#/definitions/appliesCollection",
          "description": "Elasticsearch Serverless applicability"
        },
        "observability": {
          "$ref": "#/definitions/appliesCollection",
          "description": "Observability Serverless applicability"
        },
        "security": {
          "$ref": "#/definitions/appliesCollection",
          "description": "Security Serverless applicability"
        }
      },
      "additionalProperties": false
    }
  },
  "metadata": {
    "lifecycleStates": {
      "description": "Valid lifecycle states for applicability",
      "values": [
        {
          "key": "preview",
          "alias": "preview",
          "description": "Technical preview - feature is available but not production ready"
        },
        {
          "key": "beta",
          "alias": "beta",
          "description": "Beta release - feature is stable but may have bugs"
        },
        {
          "key": "ga",
          "alias": "ga",
          "description": "Generally available - feature is production ready"
        },
        {
          "key": "deprecated",
          "alias": "deprecated",
          "description": "Deprecated - feature will be removed in future version"
        },
        {
          "key": "removed",
          "alias": "removed",
          "description": "Removed - feature no longer exists"
        },
        {
          "key": "unavailable",
          "alias": "unavailable",
          "description": "Unavailable - feature doesn't exist in this context"
        },
        {
          "key": "planned",
          "alias": "planned",
          "description": "Planned - feature is coming in future (deprecated)"
        },
        {
          "key": "development",
          "alias": "development",
          "description": "Development version (deprecated)"
        },
        {
          "key": "discontinued",
          "alias": "discontinued",
          "description": "Discontinued - feature is no longer supported (deprecated)"
        }
      ]
    },
    "knownKeys": {
      "description": "Complete list of valid keys recognized by the parser",
      "keys": [
        "stack", "deployment", "serverless", "product",
        "ece", "eck", "ess", "self",
        "elasticsearch", "observability", "security",
        "ecctl", "curator",
        "apm_agent_android", "apm_agent_dotnet", "apm_agent_go", "apm_agent_ios", "apm_agent_java", "apm_agent_node", "apm_agent_php", "apm_agent_python", "apm_agent_ruby", "apm_agent_rum",
        "edot_ios", "edot_android", "edot_dotnet", "edot_java", "edot_node", "edot_php", "edot_python", "edot_cf_aws", "edot_cf_azure", "edot_cf_gcp", "edot_collector"
      ]
    }
  }
} as const;