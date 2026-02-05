const knex = require('knex');
const knexConfig = require('../../knexfile');

const environment = process.env.NODE_ENV || 'development';
const config = knexConfig[environment];

const db = knex(config);

async function initializeDatabase() {
  try {
    // Run migrations
    await db.migrate.latest();
    console.log('Migrations completed');

    // Seed default status configurations if empty
    const statusCount = await db('status_config').count('* as count').first();
    if (statusCount.count === 0) {
      await db('status_config').insert([
        { status_code: 'CRTD', status_label: 'Created', is_terminal: false, is_released: false },
        { status_code: 'REL', status_label: 'Released', is_terminal: false, is_released: true },
        { status_code: 'PCNF', status_label: 'Partially Confirmed', is_terminal: false, is_released: true },
        { status_code: 'CNF', status_label: 'Confirmed', is_terminal: false, is_released: true },
        { status_code: 'TECO', status_label: 'Technically Complete', is_terminal: true, is_released: false },
        { status_code: 'CLSD', status_label: 'Closed', is_terminal: true, is_released: false },
        { status_code: 'Closed', status_label: 'Closed', is_terminal: true, is_released: false },
        { status_code: 'DLT', status_label: 'Deleted', is_terminal: true, is_released: false }
      ]);
      console.log('Default status configuration seeded');
    }

    return true;
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

module.exports = { db, initializeDatabase };
