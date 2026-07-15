#!/usr/bin/env node

/**
 * tests/validate-sql-queries.js
 *
 * Extracts all SQL queries from Postgres nodes across all 15 workflow JSON files,
 * validates them against the database schema (table names, column names),
 * and checks for dangerous patterns.
 *
 * Run: node tests/validate-sql-queries.js
 * Exit: 0 if all pass, 1 if any fail.
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const WORKFLOWS_DIR = path.join(__dirname, '..', 'workflows');
const SCHEMA_PATH = path.join(__dirname, '..', 'database', 'migrations', '0001_initial_schema.sql');

// ---------------------------------------------------------------------------
// Schema parsing
// ---------------------------------------------------------------------------

function parseSchema(sql) {
  const tables = {};

  // Match CREATE TABLE statements
  const createTableRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\(([\s\S]*?)\);/gi;
  let match;
  while ((match = createTableRe.exec(sql)) !== null) {
    const tableName = match[1].toLowerCase();
    const body = match[2];

    const columns = [];
    // Match column definitions: column_name TYPE [constraints...]
    const colRe = /^\s*(\w+)\s+\w+/gm;
    let colMatch;
    while ((colMatch = colRe.exec(body)) !== null) {
      const colName = colMatch[1].toLowerCase();
      // Skip constraint keywords
      if (['constraint', 'unique', 'primary', 'foreign', 'check', 'index'].includes(colName)) continue;
      columns.push(colName);
    }

    tables[tableName] = { columns: new Set(columns) };
  }

  return tables;
}

// ---------------------------------------------------------------------------
// SQL extraction from workflow nodes
// ---------------------------------------------------------------------------

function extractQueries(nodes) {
  const queries = [];
  for (const node of nodes) {
    if (node.type === 'n8n-nodes-base.postgres') {
      const params = node.parameters || {};
      const query = params.query;
      if (query && typeof query === 'string') {
        queries.push({
          nodeName: node.name,
          query: query,
        });
      }
    }
  }
  return queries;
}

// ---------------------------------------------------------------------------
// SQL validation helpers
// ---------------------------------------------------------------------------

// Extract table names from a SQL query (simplified heuristic)
function extractTableNames(query, schema) {
  const tables = new Set();

  const sqlKeywords = new Set([
    'select', 'where', 'set', 'values', 'and', 'or', 'not', 'null',
    'only', 'exists', 'index', 'if', 'into', 'returning', 'default',
    'from', 'join', 'update', 'insert', 'delete', 'table', 'create',
    'alter', 'drop', 'on', 'as', 'in', 'is', 'like', 'between',
    'having', 'group', 'order', 'by', 'limit', 'offset', 'asc', 'desc',
    'using', 'with', 'without', 'for', 'nowait', 'conflict', 'do',
    'nothing', 'all', 'any', 'some', 'true', 'false', 'case', 'when',
    'then', 'else', 'end', 'begin', 'commit', 'rollback', 'distinct',
    'inner', 'outer', 'left', 'right', 'full', 'cross', 'natural',
    'primary', 'key', 'foreign', 'constraint', 'references', 'unique',
    'check', 'cascade', 'restrict', 'action', 'returning', 'updated',
    'set', 'serial', 'bigserial', 'uuid', 'integer', 'text', 'boolean',
    'jsonb', 'timestamptz', 'timestamp', 'varchar', 'char', 'int',
    'bigint', 'float', 'double', 'numeric', 'decimal', 'date', 'time',
    'bytea', 'array', 'smallint', 'real', 'pg_catalog',
  ]);

  // Extract CTE names (WITH name AS (...))
  const cteNames = new Set();
  const cteRe = /WITH\s+(\w+)\s+AS\s*\(/gi;
  let cteMatch;
  while ((cteMatch = cteRe.exec(query)) !== null) {
    cteNames.add(cteMatch[1].toLowerCase());
  }

  const patterns = [
    /FROM\s+(\w+)/gi,
    /JOIN\s+(\w+)/gi,
    /INTO\s+(\w+)/gi,
    /UPDATE\s+(\w+)/gi,
  ];

  for (const pattern of patterns) {
    let m;
    while ((m = pattern.exec(query)) !== null) {
      const name = m[1].toLowerCase();
      if (!sqlKeywords.has(name) && !cteNames.has(name)) {
        tables.add(name);
      }
    }
  }

  return tables;
}

// Extract column names from INSERT INTO (...columns...) VALUES
function extractInsertColumns(query) {
  const m = query.match(/INSERT\s+INTO\s+\w+\s*\(([^)]+)\)/i);
  if (!m) return null;
  return m[1].split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
}

// Extract value placeholders from INSERT ... VALUES (...)
// Handles nested function calls, strings, and n8n template expressions.
function extractInsertValues(query) {
  const m = query.match(/VALUES\s*\(([\s\S]*?)\)\s*(?:\s*(?:RETURNING|ON\s+CONFLICT|;|$))/i);
  if (!m) {
    // Try simpler match without trailing context
    const m2 = query.match(/VALUES\s*\(([\s\S]+?)\)\s*$/i);
    if (!m2) return null;
    return splitValues(m2[1]);
  }
  return splitValues(m[1]);
}

// Split SQL VALUES clause by commas, respecting nested parens and quotes
function splitValues(str) {
  const parts = [];
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let current = '';

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const prev = i > 0 ? str[i - 1] : '';

    if (inSingle) {
      current += ch;
      if (ch === "'" && prev !== '\\') {
        inSingle = false;
      }
    } else if (inDouble) {
      current += ch;
      if (ch === '"' && prev !== '\\') {
        inDouble = false;
      }
    } else if (ch === "'") {
      inSingle = true;
      current += ch;
    } else if (ch === '"') {
      inDouble = true;
      current += ch;
    } else if (ch === '(') {
      depth++;
      current += ch;
    } else if (ch === ')') {
      depth--;
      current += ch;
    } else if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

// Extract column names from SET clause in UPDATE
function extractUpdateColumns(query) {
  const setMatch = query.match(/SET\s+([\s\S]+?)(?:\s+WHERE\s|$)/i);
  if (!setMatch) return [];
  const setClause = setMatch[1];
  const cols = [];
  const re = /(\w+)\s*=/g;
  let m;
  while ((m = re.exec(setClause)) !== null) {
    cols.push(m[1].toLowerCase());
  }
  return cols;
}

// Check if a column exists in a table
function columnExists(tableName, colName, schema) {
  const table = schema[tableName];
  if (!table) return false;
  return table.columns.has(colName);
}

// Known SQL function names that can appear in queries
const SQL_FUNCTIONS = new Set([
  'gen_random_uuid', 'now', 'count', 'sum', 'max', 'min', 'avg',
  'jsonb_build_object', 'array_agg', 'string_agg', 'coalesce', 'nullif',
  'cast', 'lower', 'upper', 'trim', 'length', 'substring', 'replace',
  'concat', 'abs', 'ceil', 'floor', 'round', 'date_trunc', 'extract',
  'to_char', 'to_timestamp', 'current_timestamp', 'current_date',
  'array_length', 'jsonb_extract_path_text', 'jsonb_array_elements',
  'row_number', 'rank', 'dense_rank', 'lag', 'lead',
]);

// Check for dangerous patterns
function checkDangerousPatterns(query) {
  const issues = [];
  const lower = query.toLowerCase();

  if (/\bdrop\s+table\b/.test(lower)) {
    issues.push('DANGER: DROP TABLE statement');
  }
  if (/\btruncate\b/.test(lower)) {
    issues.push('DANGER: TRUNCATE statement');
  }
  if (/\bdelete\s+from\b/.test(lower) && !/\bwhere\b/.test(lower)) {
    issues.push('DANGER: DELETE without WHERE clause');
  }
  // Only flag UPDATE without WHERE when it's a standalone UPDATE (not in a subquery)
  if (/^\s*UPDATE\s+/i.test(query) && !/\bWHERE\b/i.test(query)) {
    issues.push('DANGER: UPDATE without WHERE clause');
  }
  if (/\bselect\s+\*\b/.test(lower)) {
    issues.push('WARNING: SELECT * used (prefer explicit columns)');
  }

  return issues;
}

// Check if query uses parameterized format
function checkParameterization(query) {
  const hasPositional = /\$\d+/.test(query);
  const hasN8nTemplate = /\{\{\s*\$/.test(query) || /\{\{\s*[^}]*\s*\}\}/.test(query);
  const hasN8nExpr = /=\{\{/.test(query);

  if (hasPositional) return 'positional ($1, $2)';
  if (hasN8nTemplate) return 'n8n template ({{ }})';
  if (hasN8nExpr) return 'n8n expression (={{ }})';
  return null; // no parameterization
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  // Load schema
  let schemaSql;
  try {
    schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  } catch (e) {
    console.error(`ERROR: Cannot read schema file: ${SCHEMA_PATH}`);
    console.error(e.message);
    process.exit(1);
  }

  const schema = parseSchema(schemaSql);

  console.log('Database Schema Loaded');
  console.log('Tables:', Object.keys(schema).join(', '));
  console.log('');

  // Load workflow files
  const workflowFiles = fs.readdirSync(WORKFLOWS_DIR)
    .filter(f => f.endsWith('.json'))
    .sort();

  const results = [];
  let totalQueries = 0;
  let totalIssues = 0;

  for (const file of workflowFiles) {
    const wfId = (file.match(/^(WF-\d{2})/) || [])[1] || file;
    const filePath = path.join(WORKFLOWS_DIR, file);

    let wf;
    try {
      wf = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (e) {
      results.push({ wfId, file, queries: 0, issues: [`Failed to parse: ${e.message}`] });
      totalIssues++;
      continue;
    }

    const queries = extractQueries(wf.nodes || []);
    const issues = [];

    for (const q of queries) {
      totalQueries++;

      // Check dangerous patterns
      const dangerous = checkDangerousPatterns(q.query);
      for (const d of dangerous) {
        issues.push(`[${q.nodeName}] ${d}`);
      }

      // Check parameterization
      const paramType = checkParameterization(q.query);
      if (!paramType && !q.query.trim().toUpperCase().startsWith('SELECT')) {
        // Non-SELECT queries should be parameterized
        const upper = q.query.trim().toUpperCase();
        if (upper.startsWith('INSERT') || upper.startsWith('UPDATE') || upper.startsWith('DELETE')) {
          issues.push(`[${q.nodeName}] Unparameterized DML query — use $1/$2 or {{ }} format`);
        }
      }

      // Extract and validate table names
      const tables = extractTableNames(q.query, schema);
      for (const tableName of tables) {
        if (!schema[tableName]) {
          issues.push(`[${q.nodeName}] Unknown table "${tableName}" in query`);
        }
      }

      // Validate INSERT column count
      if (/^\s*INSERT\s+INTO/i.test(q.query)) {
        const columns = extractInsertColumns(q.query);
        const values = extractInsertValues(q.query);

        // Only do count check when VALUES are simple (no nested function calls)
        if (columns && values && columns.length > 0) {
          const hasNestedFuncs = q.query.includes('gen_random_uuid()') ||
            q.query.includes('jsonb_build_object(') ||
            q.query.includes('NOW()');
          if (!hasNestedFuncs && columns.length !== values.length) {
            issues.push(
              `[${q.nodeName}] INSERT column count (${columns.length}) does not match VALUES count (${values.length})`
            );
          }
        }

        // Validate columns against schema
        if (columns) {
          const tableMatch = q.query.match(/INSERT\s+INTO\s+(\w+)/i);
          if (tableMatch) {
            const tableName = tableMatch[1].toLowerCase();
            if (schema[tableName]) {
              for (const col of columns) {
                if (!columnExists(tableName, col, schema)) {
                  issues.push(`[${q.nodeName}] Unknown column "${col}" in table "${tableName}"`);
                }
              }
            }
          }
        }
      }

      // Validate UPDATE columns
      if (/^\s*UPDATE\s+/i.test(q.query)) {
        const tableMatch = q.query.match(/UPDATE\s+(\w+)/i);
        if (tableMatch) {
          const tableName = tableMatch[1].toLowerCase();
          const cols = extractUpdateColumns(q.query);
          for (const col of cols) {
            if (!columnExists(tableName, col, schema)) {
              issues.push(`[${q.nodeName}] Unknown column "${col}" in table "${tableName}"`);
            }
          }
        }
      }

      // Validate SELECT columns
      if (/^\s*SELECT\s+/i.test(q.query) && !/^\s*SELECT\s+\*/i.test(q.query)) {
        const tableMatch = q.query.match(/FROM\s+(\w+)/i);
        if (tableMatch) {
          const tableName = tableMatch[1].toLowerCase();
          if (schema[tableName]) {
            // Extract columns between SELECT and FROM
            const selectMatch = q.query.match(/SELECT\s+([\s\S]+?)\s+FROM\s/i);
            if (selectMatch) {
              const colList = selectMatch[1];
              const colRefs = colList.split(',').map(c => {
                const parts = c.trim().split(/\s+as\s+/i)[0].trim().split('.');
                return parts[parts.length - 1].trim().replace(/"/g, '');
              });
              for (const col of colRefs) {
                if (col.includes('(') || col.includes("'") || col === '*' || /^\d/.test(col)) continue;
                if (SQL_FUNCTIONS.has(col.toLowerCase())) continue;
                if (!columnExists(tableName, col.toLowerCase(), schema)) {
                  issues.push(`[${q.nodeName}] Unknown column "${col}" in table "${tableName}"`);
                }
              }
            }
          }
        }
      }
    }

    totalIssues += issues.length;
    results.push({ wfId, file, queries: queries.length, issues });
  }

  // Print summary table
  console.log('='.repeat(80));
  console.log('SQL QUERY VALIDATION RESULTS');
  console.log('='.repeat(80));
  console.log(`${'Workflow'.padEnd(12)} ${'File'.padEnd(35)} ${'Queries'.padEnd(10)} ${'Issues'.padEnd(10)} Status`);
  console.log('-'.repeat(80));

  for (const r of results) {
    const status = r.issues.length === 0 ? 'PASS' : 'FAIL';
    console.log(
      `${r.wfId.padEnd(12)} ${r.file.padEnd(35)} ${String(r.queries).padEnd(10)} ${String(r.issues.length).padEnd(10)} ${status}`
    );
  }

  console.log('-'.repeat(80));
  const passCount = results.filter(r => r.issues.length === 0).length;
  console.log(`Total: ${totalQueries} queries across ${results.length} workflows, ${totalIssues} issue(s)`);
  console.log(`Pass: ${passCount}/${results.length} workflows`);
  console.log('='.repeat(80));

  // Print detailed issues
  if (totalIssues > 0) {
    console.log('\n--- DETAILED ISSUES ---\n');
    for (const r of results) {
      if (r.issues.length > 0) {
        console.log(`[${r.wfId}] ${r.file}:`);
        for (const issue of r.issues) {
          console.log(`  ✗ ${issue}`);
        }
        console.log('');
      }
    }
  }

  process.exit(totalIssues > 0 ? 1 : 0);
}

main();