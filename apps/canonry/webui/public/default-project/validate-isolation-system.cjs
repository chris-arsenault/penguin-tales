const systems = require('./systems.json');
const Ajv = require('ajv');
const schema = require('/home/tsonu/src/penguin-tales/apps/lore-weave/lib/schemas/system.schema.json');

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(schema);

const isoSystem = systems.find(s => s.config?.id === 'cleansed_isolation_decay');

if (!isoSystem) {
  console.log('System not found in systems.json');
  process.exit(1);
}

const valid = validate(isoSystem);

if (valid) {
  console.log('cleansed_isolation_decay: VALID');
} else {
  console.log('cleansed_isolation_decay: INVALID');
  console.log(JSON.stringify(validate.errors, null, 2));
}
