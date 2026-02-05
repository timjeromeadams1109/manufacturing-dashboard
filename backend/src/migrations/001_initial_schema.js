/**
 * Initial database schema for Manufacturing Performance Dashboard
 */

exports.up = function(knex) {
  return knex.schema
    // Uploads tracking table
    .createTable('uploads', table => {
      table.increments('id').primary();
      table.string('filename', 255).notNullable();
      table.string('original_filename', 255).notNullable();
      table.string('dataset_type', 50).notNullable();
      table.string('status', 20).defaultTo('pending');
      table.integer('total_rows').defaultTo(0);
      table.integer('processed_rows').defaultTo(0);
      table.integer('error_rows').defaultTo(0);
      table.text('mapping_template');
      table.text('error_summary');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('completed_at');
      table.index(['dataset_type']);
      table.index(['status']);
      table.index(['created_at']);
    })

    // Column mapping templates
    .createTable('mapping_templates', table => {
      table.increments('id').primary();
      table.string('name', 100).notNullable().unique();
      table.string('dataset_type', 50).notNullable();
      table.json('mappings').notNullable();
      table.boolean('is_default').defaultTo(false);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.index(['dataset_type']);
    })

    // Cost center mapping
    .createTable('cost_center_mapping', table => {
      table.string('cost_center', 20).primary();
      table.string('area', 50);
      table.string('department', 50);
      table.string('description', 200);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.index(['area']);
    })

    // Work center mapping
    .createTable('work_center_mapping', table => {
      table.string('work_center', 50).primary();
      table.string('cost_center', 20);
      table.string('area', 50);
      table.string('description', 200);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.index(['cost_center']);
    })

    // Status configuration
    .createTable('status_config', table => {
      table.string('status_code', 20).primary();
      table.string('status_label', 50);
      table.boolean('is_terminal').defaultTo(false);
      table.boolean('is_released').defaultTo(false);
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })

    // Work Order dimension
    .createTable('wo_dim', table => {
      table.string('wo_number', 50).primary();
      table.string('status', 20);
      table.date('due_date');
      table.timestamp('created_date');
      table.timestamp('released_date');
      table.timestamp('closed_date');
      table.string('work_center', 50);
      table.string('cost_center', 20);
      table.string('area', 50);
      table.string('material', 50);
      table.string('order_type', 20);
      table.decimal('planned_qty', 15, 4);
      table.string('unit', 10);
      table.integer('upload_id').references('id').inTable('uploads');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.index(['status']);
      table.index(['due_date']);
      table.index(['cost_center']);
      table.index(['work_center']);
      table.index(['created_date']);
      table.index(['released_date']);
    })

    // Confirmations fact table (pounds)
    .createTable('confirmations_fact', table => {
      table.increments('id').primary();
      table.string('wo_number', 50).notNullable();
      table.string('operation', 10);
      table.timestamp('confirmation_ts').notNullable();
      table.timestamp('hour_bucket_ts').notNullable();
      table.decimal('pounds', 15, 4).notNullable();
      table.string('work_center', 50);
      table.string('cost_center', 20);
      table.string('employee_id', 50);
      table.string('confirmation_number', 50);
      table.integer('upload_id').references('id').inTable('uploads');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.index(['wo_number']);
      table.index(['hour_bucket_ts']);
      table.index(['cost_center']);
      table.index(['confirmation_ts']);
      table.unique(['wo_number', 'confirmation_ts', 'operation', 'confirmation_number']);
    })

    // Kronos labor hours fact table
    .createTable('kronos_fact', table => {
      table.increments('id').primary();
      table.date('punch_date').notNullable();
      table.timestamp('punch_in').notNullable();
      table.timestamp('punch_out').notNullable();
      table.timestamp('hour_bucket_ts').notNullable();
      table.decimal('hours', 10, 4).notNullable();
      table.string('cost_center', 20).notNullable();
      table.string('employee_id', 50);
      table.string('employee_name', 100);
      table.string('shift', 20);
      table.string('pay_type', 20);
      table.integer('upload_id').references('id').inTable('uploads');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.index(['hour_bucket_ts']);
      table.index(['cost_center']);
      table.index(['punch_date']);
      table.index(['shift']);
    })

    // Scanning fact table
    .createTable('scan_fact', table => {
      table.increments('id').primary();
      table.string('wo_number', 50).notNullable();
      table.timestamp('scan_in').notNullable();
      table.timestamp('scan_out');
      table.timestamp('hour_bucket_ts').notNullable();
      table.decimal('scanning_hours', 10, 4);
      table.string('station', 50);
      table.string('employee_id', 50);
      table.string('cost_center', 20);
      table.string('work_center', 50);
      table.boolean('is_orphan').defaultTo(false);
      table.integer('upload_id').references('id').inTable('uploads');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.index(['wo_number']);
      table.index(['hour_bucket_ts']);
      table.index(['cost_center']);
      table.index(['is_orphan']);
      table.unique(['wo_number', 'scan_in']);
    })

    // MRP fact table
    .createTable('mrp_fact', table => {
      table.increments('id').primary();
      table.string('material', 50).notNullable();
      table.date('requirement_date').notNullable();
      table.decimal('pounds_required', 15, 4).notNullable();
      table.decimal('pounds_available', 15, 4).notNullable();
      table.string('plant', 20);
      table.string('area', 50);
      table.decimal('shortage', 15, 4);
      table.string('mrp_controller', 20);
      table.timestamp('extracted_ts').notNullable();
      table.boolean('is_late').defaultTo(false);
      table.integer('upload_id').references('id').inTable('uploads');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.index(['material']);
      table.index(['requirement_date']);
      table.index(['extracted_ts']);
      table.index(['is_late']);
      table.index(['area']);
    })

    // Pre-aggregated KPI hourly table
    .createTable('kpi_hourly', table => {
      table.increments('id').primary();
      table.timestamp('hour_bucket_ts').notNullable();
      table.string('cost_center', 20);
      table.string('area', 50);
      table.decimal('pounds', 15, 4).defaultTo(0);
      table.decimal('kronos_hours', 10, 4).defaultTo(0);
      table.decimal('scanning_hours', 10, 4).defaultTo(0);
      table.decimal('pplh', 10, 4);
      table.decimal('variance', 10, 4);
      table.decimal('variance_pct', 10, 4);
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.unique(['hour_bucket_ts', 'cost_center']);
      table.index(['hour_bucket_ts']);
      table.index(['cost_center']);
      table.index(['area']);
    })

    // Exceptions log
    .createTable('exceptions_log', table => {
      table.increments('id').primary();
      table.string('exception_type', 50).notNullable();
      table.string('severity', 20).defaultTo('Medium');
      table.string('source_table', 50);
      table.string('business_key', 100);
      table.json('details');
      table.integer('upload_id').references('id').inTable('uploads');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('resolved_at');
      table.string('resolved_by', 50);
      table.text('resolution_notes');
      table.index(['exception_type']);
      table.index(['severity']);
      table.index(['resolved_at']);
      table.index(['upload_id']);
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('exceptions_log')
    .dropTableIfExists('kpi_hourly')
    .dropTableIfExists('mrp_fact')
    .dropTableIfExists('scan_fact')
    .dropTableIfExists('kronos_fact')
    .dropTableIfExists('confirmations_fact')
    .dropTableIfExists('wo_dim')
    .dropTableIfExists('status_config')
    .dropTableIfExists('work_center_mapping')
    .dropTableIfExists('cost_center_mapping')
    .dropTableIfExists('mapping_templates')
    .dropTableIfExists('uploads');
};
