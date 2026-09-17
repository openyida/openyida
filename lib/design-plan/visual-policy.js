'use strict';

function getVisualDecisionPolicy() {
  return {
    reference: 'yida-skills/skills/yida-design/references/style-design-selection.md#设计方向比较',
    preserve: 'explicit_user_direction_brand_and_existing_app_theme',
    comparison: { baseline: 'first_instinct', alternatives: 2, distinctDimensions: 2,
      dimensions: ['composition', 'typography', 'surface_hierarchy', 'color_relationships'] },
    selection: 'refine_and_choose_a_supported_alternative_within_business_constraints',
    quality: ['task_efficiency', 'readability_and_contrast', 'consistent_spacing_and_alignment', 'coherent_visual_identity'],
    execution: 'one_internal_comparison_in_current_planning_pass',
    handoff: ['visualSelection.visualDirection.description', 'visualSelection.colorStrategy.usage'],
    presentation: 'selected_style_and_business_fit; show_alternatives_when_requested',
  };
}

module.exports = { getVisualDecisionPolicy };
