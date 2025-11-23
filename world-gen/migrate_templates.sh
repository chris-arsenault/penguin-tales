#!/bin/bash

# Batch migration script for template files
# Replaces Graph with TemplateGraphView interface

find src/domain/penguin/templates -name "*.ts" -type f ! -name "index.ts" | while read file; do
    # Check if already migrated
    if grep -q "TemplateGraphView" "$file"; then
        echo "SKIP: $file (already migrated)"
        continue
    fi

    echo "Migrating: $file"

    # 1. Update imports
    sed -i "s/import { GrowthTemplate, TemplateResult, Graph }/import { GrowthTemplate, TemplateResult }/g" "$file"
    sed -i "s/import { GrowthTemplate, TemplateResult, Graph,/import { GrowthTemplate, TemplateResult,/g" "$file"
    sed -i "/^import.*from.*engine';$/a import { TemplateGraphView } from '../../../../services/templateGraphView';" "$file"

    # Remove Graph from imports if still present
    sed -i "s/, Graph,/,/g" "$file"
    sed -i "s/, Graph }/}/g" "$file"
    sed -i "s/{ Graph, /{ /g" "$file"
    sed -i "s/{ Graph }//" "$file"

    # Remove findEntities and getRelated imports
    sed -i "s/, findEntities//g" "$file"
    sed -i "s/, getRelated//g" "$file"
    sed -i "s/, getLocation//g" "$file"
    sed -i "s/findEntities, //g" "$file"
    sed -i "s/getRelated, //g" "$file"
    sed -i "s/getLocation, //g" "$file"

    # 2. Update function signatures
    sed -i "s/canApply: (graph: Graph)/canApply: (graphView: TemplateGraphView)/g" "$file"
    sed -i "s/canApply(graph: Graph)/canApply(graphView: TemplateGraphView)/g" "$file"
    sed -i "s/findTargets: (graph: Graph)/findTargets: (graphView: TemplateGraphView)/g" "$file"
    sed -i "s/findTargets(graph: Graph)/findTargets(graphView: TemplateGraphView)/g" "$file"
    sed -i "s/expand: (graph: Graph,/expand: (graphView: TemplateGraphView,/g" "$file"
    sed -i "s/expand(graph: Graph,/expand(graphView: TemplateGraphView,/g" "$file"

    # 3. Replace graph. calls with graphView. calls
    sed -i "s/graph\.entities\.get/graphView.getEntity/g" "$file"
    sed -i "s/graph\.tick/graphView.tick/g" "$file"
    sed -i "s/graph\.currentEra/graphView.currentEra/g" "$file"
    sed -i "s/graph\.config/graphView.config/g" "$file"
    sed -i "s/graph\.pressures\.get/graphView.getPressure/g" "$file"
    sed -i "s/graph\.entities\.size/graphView.getEntityCount()/g" "$file"
    sed -i "s/graph\.relationships/graphView.relationships/g" "$file"

    # 4. Replace findEntities calls
    sed -i "s/findEntities(graph, /graphView.findEntities(/g" "$file"
    sed -i "s/findEntities(graphView, /graphView.findEntities(/g" "$file"

    # 5. Replace getLocation calls
    sed -i "s/getLocation(graph, /graphView.getLocation(/g" "$file"
    sed -i "s/getLocation(graphView, /graphView.getLocation(/g" "$file"

    echo "Migrated: $file"
done

echo "Migration complete!"
