/**
 * Seed initial cost center and work center mappings
 */

exports.seed = async function(knex) {
  // Clear existing mappings
  await knex('cost_center_mapping').del();
  await knex('work_center_mapping').del();

  // Insert cost center mappings
  await knex('cost_center_mapping').insert([
    { cost_center: '5100', area: 'Pressing', department: 'Production', description: 'Press Line 1-3' },
    { cost_center: '5200', area: 'Welding', department: 'Production', description: 'Weld Cells A-C' },
    { cost_center: '5300', area: 'Packaging', department: 'Shipping', description: 'Pack Lines 1-2' },
    { cost_center: '5400', area: 'Assembly', department: 'Production', description: 'Assembly Lines 1-2' },
    { cost_center: '5500', area: 'Quality', department: 'QA', description: 'Quality Inspection' },
    { cost_center: '5600', area: 'Pressing', department: 'Production', description: 'Press Line 4-5' },
    { cost_center: '5700', area: 'Welding', department: 'Production', description: 'Weld Cells D-F' },
  ]);

  // Insert work center mappings
  await knex('work_center_mapping').insert([
    { work_center: 'WC-PRESS-01', cost_center: '5100', area: 'Pressing', description: 'Hydraulic Press 1' },
    { work_center: 'WC-PRESS-02', cost_center: '5100', area: 'Pressing', description: 'Hydraulic Press 2' },
    { work_center: 'WC-PRESS-03', cost_center: '5100', area: 'Pressing', description: 'Hydraulic Press 3' },
    { work_center: 'WC-WELD-01', cost_center: '5200', area: 'Welding', description: 'Robot Weld A' },
    { work_center: 'WC-WELD-02', cost_center: '5200', area: 'Welding', description: 'Robot Weld B' },
    { work_center: 'WC-WELD-03', cost_center: '5200', area: 'Welding', description: 'Robot Weld C' },
    { work_center: 'WC-PACK-01', cost_center: '5300', area: 'Packaging', description: 'Auto Packer 1' },
    { work_center: 'WC-PACK-02', cost_center: '5300', area: 'Packaging', description: 'Auto Packer 2' },
    { work_center: 'WC-ASSY-01', cost_center: '5400', area: 'Assembly', description: 'Assembly Line 1' },
    { work_center: 'WC-ASSY-02', cost_center: '5400', area: 'Assembly', description: 'Assembly Line 2' },
  ]);
};
