const Ajv = require('ajv');
const fs = require('fs');
const path = require('path');

const ajv = new Ajv({ allErrors: true, strict: false });

function validate(schemaPath, dataPath) {
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  
  const validateFn = ajv.compile(schema);
  
  let errors = [];
  data.forEach((item, i) => {
    const valid = validateFn(item);
    if (!valid) {
      errors.push({ index: i, id: item.id || item.config?.id || 'unknown', errors: validateFn.errors });
    }
  });
  
  return errors;
}

console.log('=== VALIDATING ACTIONS ===');
const actionErrors = validate(
  'lib/schemas/action.schema.json',
  '../canonry/webui/public/default-project/actions.json'
);
if (actionErrors.length === 0) {
  console.log('✓ All actions valid');
} else {
  actionErrors.forEach(e => {
    console.log('\n[' + e.index + '] ' + e.id + ':');
    e.errors.slice(0, 5).forEach(err => {
      console.log('  ' + err.instancePath + ': ' + err.message);
    });
    if (e.errors.length > 5) console.log('  ... and ' + (e.errors.length - 5) + ' more errors');
  });
}

console.log('\n=== VALIDATING SYSTEMS ===');
const systemErrors = validate(
  'lib/schemas/system.schema.json',
  '../canonry/webui/public/default-project/systems.json'
);
if (systemErrors.length === 0) {
  console.log('✓ All systems valid');
} else {
  systemErrors.forEach(e => {
    console.log('\n[' + e.index + '] ' + e.id + ':');
    e.errors.slice(0, 5).forEach(err => {
      console.log('  ' + err.instancePath + ': ' + err.message);
    });
    if (e.errors.length > 5) console.log('  ... and ' + (e.errors.length - 5) + ' more errors');
  });
}

console.log('\n=== VALIDATING GENERATORS ===');
const genErrors = validate(
  'lib/schemas/generator.schema.json',
  '../canonry/webui/public/default-project/generators.json'
);
if (genErrors.length === 0) {
  console.log('✓ All generators valid');
} else {
  genErrors.forEach(e => {
    console.log('\n[' + e.index + '] ' + e.id + ':');
    e.errors.slice(0, 5).forEach(err => {
      console.log('  ' + err.instancePath + ': ' + err.message);
    });
    if (e.errors.length > 5) console.log('  ... and ' + (e.errors.length - 5) + ' more errors');
  });
}
