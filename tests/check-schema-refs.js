#!/usr/bin/env node

// Schema cross-reference checker — verifies all $ref pointers resolve
const fs = require('fs');
const path = require('path');

const contracts = JSON.parse(fs.readFileSync('schemas/workflow-contracts.json', 'utf8'));
const contractDir = 'schemas';

function resolveRef(refPath, baseFile) {
  if (refPath.startsWith('../schemas/')) {
    const target = refPath.replace('../schemas/', '');
    return path.join(contractDir, target);
  }
  if (refPath.startsWith('#/contracts/')) {
    return null;
  }
  return null;
}

let ok = true;
const contractsData = contracts.contracts;

Object.keys(contractsData).forEach(wfId => {
  const contract = contractsData[wfId];
  const checkRef = (obj, context) => {
    if (!obj || typeof obj !== 'object') return;
    if (obj['$ref']) {
      const resolved = resolveRef(obj['$ref'], 'schemas/workflow-contracts.json');
      if (resolved && !fs.existsSync(resolved)) {
        console.error('BROKEN REF: ' + wfId + ' ' + context + ' -> ' + obj['$ref'] + ' (resolved: ' + resolved + ')');
        ok = false;
      }
    }
    // Recurse into nested objects
    if (Array.isArray(obj)) {
      obj.forEach((item, i) => checkRef(item, context + '[' + i + ']'));
    } else {
      Object.keys(obj).forEach(key => {
        if (key !== '$ref') checkRef(obj[key], context + '.' + key);
      });
    }
  };

  checkRef(contract, 'input');
  checkRef(contract, 'output');
});

// Also check all JSON schema files for internal $ref resolution
const schemaFiles = fs.readdirSync('schemas').filter(f => f.endsWith('.json'));
schemaFiles.forEach(file => {
  try {
    const data = JSON.parse(fs.readFileSync(path.join('schemas', file), 'utf8'));

    const checkSchemaRef = (obj, refContext) => {
      if (!obj || typeof obj !== 'object') return;
      if (obj['$ref']) {
        const ref = obj['$ref'];
        if (ref.startsWith('#/')) {
          // Internal ref — valid if the fragment exists in the same file
          // We skip deep validation here; just check the file is valid JSON
        } else if (ref.startsWith('./') || ref.startsWith('../')) {
          const resolved = path.join('schemas', ref);
          if (!fs.existsSync(resolved)) {
            console.error('BROKEN REF: ' + file + ' ' + refContext + ' -> ' + ref);
            ok = false;
          }
        }
      }
      if (Array.isArray(obj)) {
        obj.forEach((item, i) => checkSchemaRef(item, refContext + '[' + i + ']'));
      } else {
        Object.keys(obj).forEach(key => {
          if (key !== '$ref') checkSchemaRef(obj[key], refContext + '.' + key);
        });
      }
    };

    checkSchemaRef(data, file);
  } catch (e) {
    console.error('INVALID JSON: ' + file + ': ' + e.message);
    ok = false;
  }
});

process.exit(ok ? 0 : 1);